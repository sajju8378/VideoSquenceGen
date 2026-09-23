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

// Helper: Generate procedural canvas video clip right in the browser if backend ffmpeg is not available
async function generateClientVideoClip(
  text: string,
  durationSec: number,
  resolution: string,
  aspectRatio: '16:9' | '9:16' | '1:1'
): Promise<string> {
  const width = aspectRatio === '9:16' ? 405 : aspectRatio === '1:1' ? 512 : 720;
  const height = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 512 : 405;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const stream = canvas.captureStream(24);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : 'video/mp4';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<string>(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(URL.createObjectURL(blob));
    };
  });

  recorder.start();

  const fps = 24;
  const totalFrames = Math.max(24, Math.floor(durationSec * fps));
  let frame = 0;

  const renderFrame = () => {
    const progress = frame / totalFrames;
    // Dynamic animated background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    const hue1 = (progress * 180 + 200) % 360;
    const hue2 = (progress * 180 + 280) % 360;
    gradient.addColorStop(0, `hsl(${hue1}, 70%, 15%)`);
    gradient.addColorStop(1, `hsl(${hue2}, 80%, 8%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative motion grid
    ctx.strokeStyle = `rgba(59, 130, 246, 0.15)`;
    ctx.lineWidth = 1;
    const gridOffset = (progress * 60) % 30;
    for (let x = gridOffset; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridOffset; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Badge
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 24, 210, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 12px "Fira Code", monospace';
    ctx.fillText(`Wan 2.1 • ${resolution} • ${aspectRatio}`, 36, 46);

    // Title / prompt text
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    const words = text.split(' ');
    let line = '';
    let y = height / 2 - 20;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > width - 60 && n > 0) {
        ctx.fillText(line, 30, y);
        line = words[n] + ' ';
        y += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 30, y);

    // Progress bar at bottom
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, height - 6, width, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, height - 6, width * progress, 6);

    frame++;
    if (frame < totalFrames) {
      requestAnimationFrame(renderFrame);
    } else {
      setTimeout(() => recorder.stop(), 100);
    }
  };

  renderFrame();
  return recordingPromise;
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

        const delay = simulation?.acceleratedSpeed ? 1200 : 2500;
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
          await new Promise(r => setTimeout(r, 1000));
        }

        // Generate dynamic video clip for client
        const clipUrl = await generateClientVideoClip(
          scene.visual_prompt,
          scene.target_duration_seconds,
          scene.resolution,
          job.aspect_ratio
        );

        scene.status = 'done';
        scene.output_path = clipUrl;

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
      }

      job.status = 'completed';
      job.gpuLockActive = false;
      saveStoredJobs(jobs);
    })();
  },

  async retryScene(jobId: string, sceneId: string, forcedResolution?: string): Promise<void> {
    const hasBackend = await checkBackendAvailability();
    if (hasBackend) {
      await fetch(`/api/jobs/${jobId}/retry-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId, forcedResolution }),
      });
      return;
    }

    const jobs = getStoredJobs();
    const job = jobs.find(j => j.id === jobId);
    if (!job || !job.scenes) return;
    const scene = job.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    scene.status = 'generating';
    if (forcedResolution) scene.resolution = forcedResolution;
    scene.attempt_count++;
    job.gpuLockActive = true;
    saveStoredJobs(jobs);

    setTimeout(async () => {
      const clipUrl = await generateClientVideoClip(
        scene.visual_prompt,
        scene.target_duration_seconds,
        scene.resolution,
        job.aspect_ratio
      );
      scene.status = 'done';
      scene.output_path = clipUrl;
      job.gpuLockActive = false;
      saveStoredJobs(jobs);
    }, 1500);
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
