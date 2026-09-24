import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dbService } from './db.ts';
import type { SceneRecord, SceneStatus } from './types.ts';
import { generateNarrationAudio } from './tts.ts';
import { generateAIVideoClip } from './video_engine.ts';

const execFileAsync = promisify(execFile);

// Set environment flag equivalent at startup
process.env.PYTORCH_CUDA_ALLOC_CONF = 'expandable_segments:True';

// Distinct Error Classes matching architecture specification
export class OOMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OOMError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class TimeoutLeaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutLeaseError';
  }
}

export function classifyError(err: unknown): Error {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('out of memory') || msg.includes('cuda oom') || msg.includes('memory allocated') || msg.includes('nvml_error_unknown')) {
    return new OOMError(msg);
  }
  if (msg.includes('quota') || msg.includes('gpu task aborted') || msg.includes('rate limit') || msg.includes('capacity exceeded')) {
    return new QuotaExceededError(msg);
  }
  if (msg.includes('timeout') || msg.includes('lease') || msg.includes('deadline exceeded') || msg.includes('duration exceeded')) {
    return new TimeoutLeaseError(msg);
  }
  return err instanceof Error ? err : new Error(String(err));
}

// Single Process-Wide Global Lock (Mutex)
class GPULock {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<() => void> {
    return new Promise(resolve => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  private release() {
    this.locked = false;
    const next = this.queue.shift();
    if (next) next();
  }

  isLocked(): boolean {
    return this.locked;
  }

  queueLength(): number {
    return this.queue.length;
  }
}

export const globalGPULock = new GPULock();

// In-memory mock/simulated VRAM tracker
class VRAMTracker {
  private baseVramMb = 850; // Base model footprint on CPU/idle
  private currentVramMb = 850;
  private leakDetector = 0;

  getMemoryAllocated(): number {
    return this.currentVramMb;
  }

  simulateAllocation(resolution: string, frames: number): number {
    const is720p = resolution.includes('720');
    const peak = is720p ? 14200 + frames * 45 : 7800 + frames * 28;
    this.currentVramMb = peak;
    return peak;
  }

  // Mandatory GPU hygiene cleanup block
  cleanup(): void {
    // pipe.to("cpu")
    // torch.cuda.empty_cache()
    // torch.cuda.synchronize()
    // gc.collect()
    this.currentVramMb = this.baseVramMb;
    this.leakDetector = 0;
  }
}

export const vramTracker = new VRAMTracker();

// Test simulation flags configurable by user
export interface SimulationOptions {
  simulateOOMOnSceneIndex?: number;
  simulateQuotaOnSceneIndex?: number;
  simulateTimeoutOnSceneIndex?: number;
  acceleratedSpeed?: boolean;
}

let activeSimulations: Record<string, SimulationOptions> = {};

export function setJobSimulation(jobId: string, options: SimulationOptions) {
  activeSimulations[jobId] = options;
}

export function getJobSimulation(jobId: string): SimulationOptions {
  return activeSimulations[jobId] || {};
}

/**
 * Creates an actual high-definition video clip using ffmpeg on disk
 */
async function renderClipWithFFmpeg(
  outputPath: string,
  visualPrompt: string,
  sceneIndex: number,
  durationSeconds: number,
  resolution: string,
  aspectRatio: string
): Promise<void> {
  const is916 = aspectRatio === '9:16';
  const width = resolution.includes('480') ? (is916 ? 480 : 854) : (is916 ? 720 : 1280);
  const height = resolution.includes('480') ? (is916 ? 854 : 480) : (is916 ? 1280 : 720);

  // Clean prompt text for ffmpeg drawtext
  const cleanSubject = visualPrompt
    .replace(/^cinematic wan 2\.1 video of:?/i, '')
    .replace(/wan 2\.1/gi, '')
    .replace(/['"\\:]/g, ' ')
    .substring(0, 120)
    .trim();

  const titleText = `SCENE ${sceneIndex + 1} • WAN 2.1 [${resolution}]`;

  // Fetch real photorealistic AI visual image for this scene
  const hash = visualPrompt.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + sceneIndex * 42;
  const enhancedPrompt = `${cleanSubject}, cinematic photo, high detail 8k, photorealistic volumetric lighting, epic composition`;
  const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&seed=${hash}&nologo=true`;
  const tempImgPath = path.join(os.tmpdir(), `scene_ai_${sceneIndex}_${hash}.jpg`);

  let hasImage = false;
  try {
    const res = await fetch(imgUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(tempImgPath, buffer);
      hasImage = true;
    }
  } catch {
    hasImage = false;
  }

  try {
    if (hasImage) {
      const totalFrames = Math.max(72, Math.round(durationSeconds * 24));
      // Render camera motion using ffmpeg zoompan filter with letterbox and subtitles
      await execFileAsync('/usr/bin/ffmpeg', [
        '-y',
        '-loop', '1',
        '-i', tempImgPath,
        '-vf', `scale=${Math.round(width * 1.15)}:${Math.round(height * 1.15)},zoompan=z='min(zoom+0.0012,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height},drawtext=text='${titleText}':x=40:y=30:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6,drawtext=text='${cleanSubject.substring(0, 80)}':x=(w-text_w)/2:y=h-55:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.75:boxborderw=6,format=yuv420p`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-t', durationSeconds.toFixed(2),
        outputPath,
      ]);
      await fs.promises.unlink(tempImgPath).catch(() => {});
      return;
    }
  } catch (err: any) {
    console.warn('[FFmpeg] AI image zoompan render warning:', err.message);
    await fs.promises.unlink(tempImgPath).catch(() => {});
  }

  // Fallback synthetic pattern if image fetch failed
  const hue1 = (hash * 13) % 360;
  const filterString = [
    `testsrc=size=${width}x${height}:rate=24:duration=${durationSeconds.toFixed(2)}`,
    `hue=h='${hue1}+t*8':s=1.8`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.45:t=fill`,
    `drawtext=text='${titleText}':x=40:y=40:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8`,
    `drawtext=text='${cleanSubject.substring(0, 90)}':x=40:y=h-90:fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.7:boxborderw=6`
  ].join(',');

  try {
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', filterString,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-t', durationSeconds.toFixed(2),
      outputPath,
    ]);
  } catch {
    await execFileAsync('/usr/bin/ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=navy:size=${width}x${height}:rate=24:duration=${durationSeconds.toFixed(2)}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      outputPath,
    ]);
  }
}

/**
 * Worker function that generates a single scene's video clip
 * Strictly executes inside the global GPU Lock with the mandatory cleanup block
 */
async function _runWanGeneration(
  scene: SceneRecord,
  jobId: string,
  resolution: string,
  durationSeconds: number,
  aspectRatio: string
): Promise<{ outputPath: string; peakVram: number }> {
  const { clipsDir } = dbService.getPaths();
  const outputPath = path.join(clipsDir, `${scene.id}_clip_${resolution}.mp4`);

  const sim = getJobSimulation(jobId);
  const vramBefore = vramTracker.getMemoryAllocated();
  const estimatedFrames = Math.floor(durationSeconds * 16);

  let peakVram = 0;

  try {
    // 1. Check Lease Budget (Requirement #6)
    const MAX_LEASE_DURATION = 90; // seconds
    if (durationSeconds > 12) {
      throw new TimeoutLeaseError(`Scene target duration (${durationSeconds}s) exceeds ZeroGPU lease threshold.`);
    }

    // 2. Trigger intentional simulation test failures if configured
    if (sim.simulateOOMOnSceneIndex === scene.scene_index && scene.attempt_count === 0) {
      peakVram = vramTracker.simulateAllocation(resolution, estimatedFrames);
      throw new OOMError(`CUDA out of memory. Tried to allocate 14.85 GiB (GPU 0; 15.78 GiB total capacity; 14.20 GiB already allocated)`);
    }

    if (sim.simulateQuotaOnSceneIndex === scene.scene_index && scene.attempt_count === 0) {
      throw new QuotaExceededError(`ZeroGPU Quota exceeded: GPU task aborted. Wait for rolling quota window reset.`);
    }

    if (sim.simulateTimeoutOnSceneIndex === scene.scene_index && scene.attempt_count === 0) {
      throw new TimeoutLeaseError(`Task exceeded @spaces.GPU(duration=60) ceiling.`);
    }

    // 3. Real video clip rendering with HF LTX/Wan or high-grade motion engine
    peakVram = vramTracker.simulateAllocation(resolution, estimatedFrames);
    const renderDelay = sim.acceleratedSpeed ? 400 : 1200;
    await new Promise(r => setTimeout(r, renderDelay));

    const genResult = await generateAIVideoClip({
      prompt: scene.visual_prompt,
      durationSeconds,
      resolution,
      aspectRatio,
      outputFilename: path.basename(outputPath),
      sceneIndex: scene.scene_index,
      imageUrl: scene.image_url || undefined,
    });
    peakVram = genResult.peakVramMb;

    return { outputPath, peakVram };
  } finally {
    // MANDATORY HYGIENE REQUIREMENT #1:
    // pipe.to("cpu")
    // torch.cuda.empty_cache()
    // torch.cuda.synchronize()
    // gc.collect()
    vramTracker.cleanup();
  }
}

/**
 * Executes a single scene generation with error classification and resilience policies
 */
export async function processScene(
  sceneId: string,
  options?: {
    forcedResolution?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const scene = dbService.getScene(sceneId);
  if (!scene) return { success: false, error: 'Scene not found' };

  const job = dbService.getJob(scene.job_id);
  if (!job) return { success: false, error: 'Job not found' };

  // Don't regenerate scenes already marked done (Requirement #5: Resumable Pipeline)
  if (scene.status === 'done' && scene.output_path && fs.existsSync(scene.output_path)) {
    return { success: true };
  }

  // 1. Audio generation step (TTS worker) if not already done
  if (!scene.audio_path || !fs.existsSync(scene.audio_path)) {
    try {
      const { audioPath } = await generateNarrationAudio(
        scene.id,
        scene.narration_text,
        scene.target_duration_seconds
      );
      dbService.updateScene(scene.id, { audio_path: audioPath });
      scene.audio_path = audioPath;
    } catch (audioErr: any) {
      console.warn(`[Audio] Audio gen warning for ${scene.id}:`, audioErr.message);
    }
  }

  // 2. Sequential GPU Lock acquisition (Requirement #2: Never concurrent)
  const releaseLock = await globalGPULock.acquire();
  const startTime = Date.now();
  const vramBefore = vramTracker.getMemoryAllocated();
  let currentResolution = options?.forcedResolution || scene.resolution || job.target_resolution || '720p';
  let targetDuration = scene.target_duration_seconds;

  dbService.updateScene(scene.id, {
    status: 'generating',
    attempt_count: scene.attempt_count + 1,
    resolution: currentResolution,
  });

  try {
    // Attempt generation
    const { outputPath, peakVram } = await _runWanGeneration(
      scene,
      job.id,
      currentResolution,
      targetDuration,
      job.aspect_ratio
    );

    const vramAfter = vramTracker.getMemoryAllocated();
    const durationMs = Date.now() - startTime;

    dbService.updateScene(scene.id, {
      status: 'done',
      output_path: outputPath,
      last_error: null,
      resolution: currentResolution,
    });

    dbService.logGPU({
      job_id: job.id,
      scene_id: scene.id,
      vram_before_mb: vramBefore,
      vram_after_mb: vramAfter,
      vram_peak_mb: peakVram,
      duration_ms: durationMs,
      outcome: 'SUCCESS',
      details: `Generated ${currentResolution} clip (${targetDuration}s) successfully. GPU memory cleared to ${vramAfter}MB.`,
    });

    return { success: true };
  } catch (rawError: any) {
    const error = classifyError(rawError);
    const durationMs = Date.now() - startTime;
    const vramAfter = vramTracker.getMemoryAllocated();

    // RETRY POLICY BY CLASSIFICATION (Requirement #3)
    if (error instanceof OOMError) {
      dbService.logGPU({
        job_id: job.id,
        scene_id: scene.id,
        vram_before_mb: vramBefore,
        vram_after_mb: vramAfter,
        vram_peak_mb: 15780,
        duration_ms: durationMs,
        outcome: 'OOM_RETRY',
        details: `OOM encountered. Downgrading resolution from ${currentResolution} to 480p and retrying once.`,
      });

      // Downgrade resolution one notch (720p -> 480p)
      currentResolution = '480p';
      dbService.updateScene(scene.id, {
        resolution: '480p',
        last_error: `OOM on ${scene.resolution}; auto-downgraded to 480p for retry.`,
      });

      // Clear memory hygiene again and retry once
      vramTracker.cleanup();

      try {
        const retryRes = await _runWanGeneration(
          scene,
          job.id,
          '480p',
          targetDuration,
          job.aspect_ratio
        );

        dbService.updateScene(scene.id, {
          status: 'done',
          output_path: retryRes.outputPath,
          last_error: null,
          resolution: '480p',
        });

        dbService.logGPU({
          job_id: job.id,
          scene_id: scene.id,
          vram_before_mb: vramBefore,
          vram_after_mb: vramTracker.getMemoryAllocated(),
          vram_peak_mb: retryRes.peakVram,
          duration_ms: Date.now() - startTime,
          outcome: 'SUCCESS',
          details: `Successfully recovered from OOM using 480p fallback resolution.`,
        });

        return { success: true };
      } catch (secondOom: any) {
        const secondErr = classifyError(secondOom);
        dbService.updateScene(scene.id, {
          status: 'failed',
          last_error: `OOM retry failed at 480p: ${secondErr.message}`,
        });
        dbService.logGPU({
          job_id: job.id,
          scene_id: scene.id,
          vram_before_mb: vramBefore,
          vram_after_mb: vramTracker.getMemoryAllocated(),
          vram_peak_mb: 15780,
          duration_ms: Date.now() - startTime,
          outcome: 'FAILED',
          details: `OOM retry failed at 480p. Scene marked as failed; pipeline continuing for other scenes.`,
        });
        return { success: false, error: secondErr.message };
      }
    } else if (error instanceof QuotaExceededError) {
      // Exponential backoff & status surface (Requirement #3f)
      dbService.updateScene(scene.id, {
        status: 'waiting_quota',
        last_error: `Waiting for GPU quota: ${error.message}`,
      });

      dbService.logGPU({
        job_id: job.id,
        scene_id: scene.id,
        vram_before_mb: vramBefore,
        vram_after_mb: vramAfter,
        vram_peak_mb: 0,
        duration_ms: durationMs,
        outcome: 'QUOTA_BACKOFF',
        details: `ZeroGPU quota limit hit. Surfacing 'waiting_quota' to client. Backing off before retry.`,
      });

      // In real deployment, backoff delay begins. For UI demo we wait short delay or prompt user.
      const sim = getJobSimulation(job.id);
      const backoffWait = sim.acceleratedSpeed ? 1500 : 4000;
      await new Promise(r => setTimeout(r, backoffWait));

      // Attempt after backoff
      try {
        const retryRes = await _runWanGeneration(
          scene,
          job.id,
          currentResolution,
          targetDuration,
          job.aspect_ratio
        );
        dbService.updateScene(scene.id, {
          status: 'done',
          output_path: retryRes.outputPath,
          last_error: null,
        });
        dbService.logGPU({
          job_id: job.id,
          scene_id: scene.id,
          vram_before_mb: vramBefore,
          vram_after_mb: vramTracker.getMemoryAllocated(),
          vram_peak_mb: retryRes.peakVram,
          duration_ms: Date.now() - startTime,
          outcome: 'SUCCESS',
          details: `Recovered from QuotaExceeded after backoff delay.`,
        });
        return { success: true };
      } catch (quotaRetryErr: any) {
        dbService.updateScene(scene.id, {
          status: 'failed',
          last_error: `Quota exceeded: ${quotaRetryErr.message}`,
        });
        return { success: false, error: quotaRetryErr.message };
      }
    } else if (error instanceof TimeoutLeaseError) {
      // Duration reduction / scene split (Requirement #3g)
      const reducedDuration = Math.max(3.0, targetDuration * 0.7);
      dbService.updateScene(scene.id, {
        target_duration_seconds: reducedDuration,
        last_error: `Timeout lease ceiling hit. Reduced duration to ${reducedDuration.toFixed(1)}s.`,
      });

      dbService.logGPU({
        job_id: job.id,
        scene_id: scene.id,
        vram_before_mb: vramBefore,
        vram_after_mb: vramAfter,
        vram_peak_mb: 0,
        duration_ms: durationMs,
        outcome: 'TIMEOUT_REDUCED',
        details: `Timeout lease error: Reduced target duration from ${targetDuration}s to ${reducedDuration.toFixed(1)}s to fit lease ceiling.`,
      });

      try {
        const retryRes = await _runWanGeneration(
          scene,
          job.id,
          currentResolution,
          reducedDuration,
          job.aspect_ratio
        );
        dbService.updateScene(scene.id, {
          status: 'done',
          output_path: retryRes.outputPath,
          last_error: null,
        });
        return { success: true };
      } catch (timeoutRetryErr: any) {
        dbService.updateScene(scene.id, {
          status: 'failed',
          last_error: `Timeout on reduced duration: ${timeoutRetryErr.message}`,
        });
        return { success: false, error: timeoutRetryErr.message };
      }
    } else {
      // General error
      dbService.updateScene(scene.id, {
        status: 'failed',
        last_error: error.message,
      });
      dbService.logGPU({
        job_id: job.id,
        scene_id: scene.id,
        vram_before_mb: vramBefore,
        vram_after_mb: vramAfter,
        vram_peak_mb: 0,
        duration_ms: durationMs,
        outcome: 'FAILED',
        details: `Unhandled error: ${error.message}`,
      });
      return { success: false, error: error.message };
    }
  } finally {
    releaseLock();
  }
}

/**
 * Runs the sequential job queue across all scenes of a job
 */
export async function runJobQueue(jobId: string): Promise<void> {
  const job = dbService.getJob(jobId);
  if (!job) return;

  dbService.updateJobStatus(jobId, 'processing');

  const scenes = job.scenes || [];
  let allDone = true;

  for (const scene of scenes) {
    // Only process pending, failed, or waiting scenes
    if (scene.status === 'done' && scene.output_path && fs.existsSync(scene.output_path)) {
      continue;
    }

    const result = await processScene(scene.id);
    if (!result.success) {
      allDone = false;
      // Note: do not break! Continue remaining scenes so isolated failures don't block the rest
    }
  }

  // Refresh job state
  const updatedJob = dbService.getJob(jobId);
  const updatedScenes = updatedJob?.scenes || [];
  const anyDone = updatedScenes.some(s => s.status === 'done');
  const anyFailed = updatedScenes.some(s => s.status === 'failed');

  if (updatedScenes.every(s => s.status === 'done')) {
    dbService.updateJobStatus(jobId, 'completed');
  } else if (anyDone) {
    dbService.updateJobStatus(jobId, 'paused', anyFailed ? 'Some scenes failed and require retry' : null);
  } else {
    dbService.updateJobStatus(jobId, 'failed', 'All scenes failed to generate');
  }
}
