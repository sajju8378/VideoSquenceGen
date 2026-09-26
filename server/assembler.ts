import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dbService } from './db.ts';

const execFileAsync = promisify(execFile);

export async function assembleFinalVideo(
  jobId: string,
  options?: {
    transitionType?: 'cut' | 'crossfade';
    backgroundMusicVolume?: number;
  }
): Promise<{ success: boolean; finalVideoPath?: string; error?: string }> {
  const job = dbService.getJob(jobId);
  if (!job) return { success: false, error: 'Job not found' };

  const scenes = (job.scenes || []).filter(s => s.status === 'done' && s.output_path && fs.existsSync(s.output_path));
  if (scenes.length === 0) {
    return { success: false, error: 'No completed scene video clips available for assembly.' };
  }

  dbService.updateJobStatus(jobId, job.status, null, null, 'assembling');

  const { outputsDir, clipsDir } = dbService.getPaths();
  const outputFileName = `final_${jobId}.mp4`;
  const finalOutputPath = path.join(outputsDir, outputFileName);
  const concatListPath = path.join(outputsDir, `concat_${jobId}.txt`);

  try {
    // 1. Prepare per-scene muxed clips (video + narration audio)
    const muxedClipPaths: string[] = [];

    for (const scene of scenes) {
      const muxedPath = path.join(clipsDir, `muxed_${scene.id}.mp4`);

      if (scene.audio_path && fs.existsSync(scene.audio_path)) {
        // Mux video clip with narration audio
        await execFileAsync('/usr/bin/ffmpeg', [
          '-y',
          '-i', scene.output_path!,
          '-i', scene.audio_path,
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          muxedPath,
        ]);
        muxedClipPaths.push(muxedPath);
      } else {
        // Use video as-is or ensure valid audio container
        await execFileAsync('/usr/bin/ffmpeg', [
          '-y',
          '-i', scene.output_path!,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          muxedPath,
        ]);
        muxedClipPaths.push(muxedPath);
      }
    }

    // 2. Write concat list for ffmpeg concat demuxer
    const concatContent = muxedClipPaths
      .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf-8');

    // 3. Independent stitch with ffmpeg
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      finalOutputPath,
    ]);

    // Clean up temporary concat file
    try {
      if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
    } catch {}

    dbService.updateJobStatus(jobId, job.status, null, outputFileName, 'completed');
    return { success: true, finalVideoPath: outputFileName };
  } catch (err: any) {
    dbService.updateJobStatus(jobId, job.status, null, null, 'failed');
    return { success: false, error: err.message || 'FFmpeg assembly failed' };
  }
}
