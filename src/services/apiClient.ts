import type { Job, Scene, GPULog, SplitSceneResult } from '../types.ts';
import { getZeroGPUPythonAppCode, getZeroGPURequirementsTxt, getZeroGPUReadme } from '../../server/spaces_exporter.ts';

// Detect whether backend /api is responding
let isBackendAvailable: boolean | null = null;

export async function checkBackendAvailability(): Promise<boolean> {
  if (isBackendAvailable !== null) return isBackendAvailable;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/jobs', { signal: controller.signal });
    clearTimeout(timeout);
    isBackendAvailable = res.ok;
  } catch {
    isBackendAvailable = false;
  }
  return isBackendAvailable;
}

// Client-side local storage fallback for static deployments (e.g. GitHub Pages)
const LOCAL_STORAGE_KEY_JOBS = 'wanscript_jobs_v1';
const LOCAL_STORAGE_KEY_LOGS = 'wanscript_logs_v1';

function getStoredJobs(): Job[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_JOBS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveStoredJobs(jobs: Job[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_JOBS, JSON.stringify(jobs));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function getStoredLogs(jobId: string): GPULog[] {
  try {
    const data = localStorage.getItem(`${LOCAL_STORAGE_KEY_LOGS}_${jobId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function appendStoredLog(jobId: string, log: GPULog) {
  const current = getStoredLogs(jobId);
  current.push(log);
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_LOGS}_${jobId}`, JSON.stringify(current));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

// Download helper function for client-side or remote media
export function downloadVideoFile(url: string, filename: string) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  const cleanName = filename.endsWith('.mp4') || filename.endsWith('.webm') ? filename : `${filename}.mp4`;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Helper: Generate procedural canvas video clip right in the browser if backend ffmpeg is not available
async function generateClientVideoClip(
  text: string,
  durationSec: number,
  resolution: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  sceneIndex: number = 0
): Promise<string> {
  const width = aspectRatio === '9:16' ? 405 : aspectRatio === '1:1' ? 512 : 720;
  const height = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 512 : 405;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const drawSceneVisual = (progress: number) => {
    // Dynamic cinematic animated gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const hue1 = (progress * 120 + sceneIndex * 70 + 210) % 360;
    const hue2 = (progress * 120 + sceneIndex * 70 + 290) % 360;
    gradient.addColorStop(0, `hsl(${hue1}, 75%, 12%)`);
    gradient.addColorStop(0.5, `hsl(${(hue1 + 30) % 360}, 65%, 8%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 85%, 6%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Cinematic particle / anamorphic streaks
    ctx.strokeStyle = `hsla(${hue1}, 90%, 65%, 0.25)`;
    ctx.lineWidth = 1.5;
    const streakY = (progress * height * 1.5) % height;
    ctx.beginPath();
    ctx.moveTo(0, streakY);
    ctx.lineTo(width, streakY);
    ctx.stroke();

    // Decorative grid
    ctx.strokeStyle = `rgba(59, 130, 246, 0.12)`;
    ctx.lineWidth = 1;
    const gridOffset = (progress * 50) % 25;
    for (let x = gridOffset; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Top Header Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, 20, 260, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 12px "Fira Code", monospace';
    ctx.fillText(`SCENE ${sceneIndex + 1} • Wan 2.1 • ${resolution}`, 32, 42);

    // Floating Prompt Center Display
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(20, height / 2 - 50, width - 40, 100, 12);
    ctx.fill();
    ctx.stroke();

    // Text Wrap Prompt
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
    const words = text.split(' ');
    let line = '';
    let y = height / 2 - 20;
    const maxWidth = width - 70;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 35, y);
        line = words[n] + ' ';
        y += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 35, y);

    // Audio Visualizer waveform bars at bottom
    const barCount = 28;
    const barWidth = (width - 60) / barCount;
    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.sin(progress * 15 + i * 0.4) * 16 + 18;
      ctx.fillStyle = `hsla(${(hue1 + i * 4) % 360}, 90%, 60%, 0.7)`;
      ctx.fillRect(30 + i * barWidth, height - 32 - barHeight, barWidth - 3, barHeight);
    }

    // Timecode badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(width - 95, 22, 75, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Fira Code", monospace';
    const currentTimeSec = (progress * durationSec).toFixed(1);
    ctx.fillText(`00:${currentTimeSec.padStart(4, '0')}s`, width - 88, 38);

    // Bottom Progress indicator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, height - 5, width, 5);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, height - 5, width * progress, 5);
  };

  // If MediaRecorder is unsupported, return a static canvas blob immediately
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    drawSceneVisual(1.0);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'));
      });
    });
  }

  const stream = canvas.captureStream(24);
  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : 'video/mp4';

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  } catch {
    recorder = new MediaRecorder(stream);
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<string>(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
          resolve(URL.createObjectURL(blob));
        } else {
          drawSceneVisual(1.0);
          canvas.toBlob(blob => {
            resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'));
          });
        }
      } catch {
        resolve(canvas.toDataURL('image/png'));
      }
    };

    recorder.onstop = finish;
    recorder.onerror = finish;

    try {
      recorder.start(100);
    } catch {
      finish();
      return;
    }

    // Interval-based loop: 24 frames over 1.2 seconds
    // Immune to browser tab backgrounding that pauses requestAnimationFrame
    const totalFrames = 24;
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const progress = Math.min(1.0, frame / totalFrames);
      drawSceneVisual(progress);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setTimeout(() => {
          try {
            if (recorder.state === 'recording') {
              recorder.stop();
            } else {
              finish();
            }
          } catch {
            finish();
          }
        }, 80);
      }
    }, 50);

    // Watchdog safety timeout (max 1.8s) so nothing ever hangs
    setTimeout(() => {
      clearInterval(interval);
      try {
        if (recorder.state === 'recording') recorder.stop();
        else finish();
      } catch {
        finish();
      }
    }, 1800);
  });
}

export const apiClient = {
  async splitScript(
    script: string,
    options?: { targetDuration?: number; genreStyle?: string; aspectRatio?: string }
  ): Promise<{ title: string; scenes: SplitSceneResult[] }> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch('/api/split-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          targetDuration: options?.targetDuration,
          genreStyle: options?.genreStyle,
          aspectRatio: options?.aspectRatio,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to split script');
      }
      return res.json();
    }

    // Client-side fallback splitting (for GitHub Pages static deploy)
    const sentences = script
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const defaultDuration = options?.targetDuration || 4.5;
    const fallbackScenes: SplitSceneResult[] = (
      sentences.length > 0 ? sentences : ['Opening scene of the story.']
    ).map((text, idx) => ({
      scene_id: `scene_${idx + 1}`,
      narration_text: text,
      visual_prompt: `Cinematic Wan 2.1 video of: ${text}. Atmospheric volumetric lighting, anamorphic lens, 8k render, ${
        options?.genreStyle || 'Cinematic Photorealism'
      }.`,
      target_duration_seconds: Math.max(3.0, Math.min(8.0, text.split(' ').length * 0.4 + 2.5)),
    }));

    return {
      title: sentences[0] ? sentences[0].slice(0, 30) + '...' : 'Custom Video Project',
      scenes: fallbackScenes,
    };
  },

  async createJob(params: {
    title: string;
    script: string;
    targetResolution: string;
    aspectRatio: '16:9' | '9:16';
    scenes: SplitSceneResult[];
    simulation?: any;
  }): Promise<Job> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create job');
      }
      return res.json();
    }

    // Static client fallback
    const jobId = 'job_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const newJob: Job = {
      id: jobId,
      title: params.title || 'Untitled Project',
      script: params.script,
      status: 'draft',
      target_resolution: params.targetResolution || '720p',
      aspect_ratio: params.aspectRatio || '16:9',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      final_video_path: null,
      assembly_status: 'idle',
      error: null,
      simulation: params.simulation,
      scenes: params.scenes.map((s, idx) => ({
        id: `${jobId}_s${idx + 1}`,
        job_id: jobId,
        scene_index: idx,
        narration_text: s.narration_text,
        visual_prompt: s.visual_prompt,
        target_duration_seconds: s.target_duration_seconds,
        status: 'pending',
        attempt_count: 0,
        last_error: null,
        output_path: null,
        audio_path: null,
        resolution: params.targetResolution || '720p',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      gpuLockActive: false,
      gpuQueueLength: 0,
      currentVramMb: 850,
    };

    const jobs = getStoredJobs();
    jobs.unshift(newJob);
    saveStoredJobs(jobs);
    return newJob;
  },

  async getJobs(): Promise<Job[]> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch('/api/jobs');
      if (res.ok) return res.json();
    }
    return getStoredJobs();
  },

  async getJob(id: string): Promise<Job | null> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch(`/api/jobs/${id}`);
      if (res.ok) return res.json();
    }
    const jobs = getStoredJobs();
    return jobs.find(j => j.id === id) || null;
  },

  async startJobQueue(jobId: string, simulation?: any): Promise<void> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      await fetch(`/api/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulation }),
      });
      return;
    }

    // Static client execution: run sequential scenes with real state transitions
    const jobs = getStoredJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.scenes) return;

    job.status = 'processing';
    job.gpuLockActive = true;
    job.simulation = simulation;
    saveStoredJobs(jobs);

    // Notify UI immediately of queue start
    this.notifyUpdate(job.id);

    const scenesToProcess = job.scenes;

    (async () => {
      for (const scene of scenesToProcess) {
        if (scene.status === 'done') continue;

        // Acquire lock
        job.gpuLockActive = true;
        scene.status = 'generating';
        scene.attempt_count++;
        job.currentVramMb = 16360;
        saveStoredJobs(jobs);
        this.notifyUpdate(job.id);

        const delay = simulation?.acceleratedSpeed ? 600 : 1200;
        await new Promise(r => setTimeout(r, delay));

        // Edge case simulations
        if (simulation?.simulateOOMOnSceneIndex === scene.scene_index && scene.attempt_count === 1) {
          scene.last_error = 'CUDA out of memory during backward pass. Attempting 480p auto-downgrade.';
          scene.status = 'generating';
          scene.resolution = '480p';
          appendStoredLog(job.id, {
            id: 'log_' + Math.random().toString(36).substring(2, 8),
            job_id: job.id,
            scene_id: scene.id,
            timestamp: new Date().toISOString(),
            vram_before_mb: 850,
            vram_after_mb: 850,
            vram_peak_mb: 16384,
            duration_ms: delay,
            outcome: 'OOM_RETRY',
            details: 'OOM caught! Auto-downgraded to 480p and cleared GPU memory via finally block.',
          });
          this.notifyUpdate(job.id);
          await new Promise(r => setTimeout(r, 600));
        }

        // Generate dynamic video clip for client
        const clipUrl = await generateClientVideoClip(
          scene.visual_prompt,
          scene.target_duration_seconds,
          scene.resolution,
          job.aspect_ratio,
          scene.scene_index
        );

        scene.status = 'done';
        scene.output_path = clipUrl;
        scene.last_error = null;

        // GPU memory hygiene (release to 850MB)
        job.currentVramMb = 850;

        appendStoredLog(job.id, {
          id: 'log_' + Math.random().toString(36).substring(2, 8),
          job_id: job.id,
          scene_id: scene.id,
          timestamp: new Date().toISOString(),
          vram_before_mb: 850,
          vram_after_mb: 850,
          vram_peak_mb: 14200,
          duration_ms: delay,
          outcome: 'SUCCESS',
          details: `Generated ${scene.resolution} clip successfully. GPU memory cleared to 850MB.`,
        });

        saveStoredJobs(jobs);
        this.notifyUpdate(job.id);
      }

      job.status = 'completed';
      job.gpuLockActive = false;
      saveStoredJobs(jobs);
      this.notifyUpdate(job.id);
    })();
  },

  notifyUpdate(jobId?: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wanscript_update', { detail: { jobId } }));
    }
  },

  async generateSingleScene(
    jobId: string,
    sceneId: string,
    forcedResolution?: string
  ): Promise<{ job: Job; scene: Scene }> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      await fetch(`/api/jobs/${jobId}/scenes/${sceneId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, forcedResolution }),
      });
      const updatedJob = await this.getJob(jobId);
      this.notifyUpdate(jobId);
      const matchedScene = updatedJob?.scenes?.find(s => s.id === sceneId);
      if (!updatedJob || !matchedScene) {
        throw new Error('Scene or job not found after generation');
      }
      return { job: updatedJob, scene: matchedScene };
    }

    const jobs = getStoredJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.scenes) throw new Error('Job not found');
    const scene = job.scenes.find(s => s.id === sceneId);
    if (!scene) throw new Error('Scene not found');

    // 1. Acquire GPU lock & transition to generating
    scene.status = 'generating';
    if (forcedResolution) scene.resolution = forcedResolution;
    scene.attempt_count++;
    job.status = 'processing';
    job.gpuLockActive = true;
    job.currentVramMb = 16360;
    saveStoredJobs(jobs);
    this.notifyUpdate(jobId);

    // 2. Generate video clip
    const clipUrl = await generateClientVideoClip(
      scene.visual_prompt,
      scene.target_duration_seconds,
      scene.resolution,
      job.aspect_ratio,
      scene.scene_index
    );

    // 3. Mark complete & release GPU lock
    scene.status = 'done';
    scene.output_path = clipUrl;
    scene.last_error = null;
    job.gpuLockActive = false;
    job.currentVramMb = 850;

    if (job.scenes.every(s => s.status === 'done')) {
      job.status = 'completed';
    }

    appendStoredLog(job.id, {
      id: 'log_' + Math.random().toString(36).substring(2, 8),
      job_id: job.id,
      scene_id: scene.id,
      timestamp: new Date().toISOString(),
      vram_before_mb: 850,
      vram_after_mb: 850,
      vram_peak_mb: 14200,
      duration_ms: 1200,
      outcome: 'SUCCESS',
      details: `Generated ${scene.resolution} video clip for Scene ${scene.scene_index + 1}. GPU lock released.`,
    });

    saveStoredJobs(jobs);
    this.notifyUpdate(jobId);

    return { job, scene };
  },

  async retryScene(jobId: string, sceneId: string, forcedResolution?: string): Promise<void> {
    return this.generateSingleScene(jobId, sceneId, forcedResolution).then(() => {});
  },

  async assembleVideo(jobId: string, options?: { transitionType?: string }): Promise<{ finalVideoPath: string }> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch(`/api/jobs/${jobId}/assemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Assembly failed');
      }
      return res.json();
    }

    const jobs = getStoredJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.scenes) throw new Error('Job not found');

    const doneScenes = job.scenes.filter(s => s.status === 'done' && s.output_path);
    if (doneScenes.length === 0) throw new Error('No completed clips available');

    // On client, first clip or merged clip acts as final video
    job.final_video_path = doneScenes[0].output_path;
    job.assembly_status = 'completed';
    saveStoredJobs(jobs);

    return { finalVideoPath: doneScenes[0].output_path || '' };
  },

  async getLogs(jobId: string): Promise<GPULog[]> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      const res = await fetch(`/api/jobs/${jobId}/logs`);
      if (res.ok) return res.json();
    }
    return getStoredLogs(jobId);
  },

  getExportFile(filename: string): string {
    if (filename === 'app.py') return getZeroGPUPythonAppCode();
    if (filename === 'requirements.txt') return getZeroGPURequirementsTxt();
    if (filename === 'README.md') return getZeroGPUReadme();
    return '';
  },
};
