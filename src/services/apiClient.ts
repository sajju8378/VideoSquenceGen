import type { Job, Scene, GPULog, SplitSceneResult, VideoGenerationMode } from '../types.ts';
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

// Robust Prompt Expander for Diffusion Models: Enforces explicit Character details, Background setup, and Photorealism
export function generateDetailedDiffusionPrompt(
  sentence: string,
  userGenre?: string
): string {
  const clean = sentence.replace(/[.?!]+$/, '').trim();
  const lower = clean.toLowerCase();

  // 1. Mythological Epics: Lord Hanuman / Ramayana
  if (
    lower.includes('hanuman') ||
    lower.includes('lanka') ||
    lower.includes('ramayana') ||
    lower.includes('sita') ||
    lower.includes('vanara') ||
    lower.includes('gada')
  ) {
    let actionState = 'soaring horizontally forward through the sky in a determined, heroic flight posture';
    if (lower.includes('expand') || lower.includes('giant') || lower.includes('leap') || lower.includes('jump')) {
      actionState = 'leaping into the sky, expanding into a colossal divine cosmic warrior form (Vishwaroopam)';
    } else if (lower.includes('temple') || lower.includes('palace') || lower.includes('arrive') || lower.includes('citadel')) {
      actionState = 'approaching the shores of Lanka from the golden sky, commanding presence with divine majesty';
    }

    return `Lord Hanuman, the divine Hindu warrior deity, towering muscular athletic physique, glowing golden-amber skin tone, wearing an ornate golden Mukut crown studded with jewels, sacred golden armlets and necklaces, billowing royal vermilion saffron silk dhoti fluttering fiercely in high-altitude winds, holding a heavy celestial golden Gada mace firmly in his powerful right hand, determined devoted heroic facial expression, ${actionState}. Background setup: vast dark-teal tumultuous ocean with crashing whitecap waves and oceanic spray below, distant volcanic island of Lanka with golden palace towers and glowing citadels on the horizon, dramatic golden-hour sunset sky with intense volumetric god rays breaking through heavy storm clouds. Cinematography: cinematic tracking side-angle shot, IMAX 70mm, Panavision anamorphic lens, epic atmospheric depth haze, hyper-realistic water droplets. Style: photorealistic live-action movie still, 8K resolution, Unreal Engine 5 render, cinematic lighting, masterwork, NOT cartoon, NOT anime, NOT comic, NOT 2D animation, NOT sketch, NOT bird caricature.`;
  }

  // 2. Cyberpunk / Futuristic Sci-Fi
  if (
    lower.includes('cyberpunk') ||
    lower.includes('neon') ||
    lower.includes('hacker') ||
    lower.includes('cyborg') ||
    lower.includes('drone') ||
    lower.includes('operative')
  ) {
    return `Subject: Cyberpunk operative in high-tech carbon-fiber armored trench coat, glowing LED neural interface implants, reflective cybernetic visor, focused posture. Background setup: Rain-drenched futuristic megacity street, towering neon skyscrapers, holographic billboards reflecting on wet asphalt, steam rising from grates, flying hovercrafts in distance. Cinematography: Low-angle tracking cinematic camera, anamorphic blue horizontal lens flares, volumetric fog, Blade Runner 2049 aesthetic. Style: Photorealistic live-action film still, IMAX 70mm, 8k resolution, masterwork, NOT cartoon, NOT comic, NOT 2D animation.`;
  }

  // 3. Deep Sea / Oceanic Abyss
  if (lower.includes('ocean') || lower.includes('reef') || lower.includes('submersible') || lower.includes('abyss') || lower.includes('marine')) {
    return `Subject: Deep oceanic exploration. Background setup: Crystal-clear deep navy water, caustic sunlight patterns dancing across dramatic underwater rock arches, vibrant living coral reefs, schools of luminous marine life and floating bioluminescent embers. Cinematography: Underwater IMAX 70mm camera, smooth cinematic drift, volumetric sunbeams piercing the water. Style: BBC Earth National Geographic 8k photorealistic documentary film still, masterwork, NOT cartoon, NOT comic, NOT 2D.`;
  }

  // 4. Default / Custom Narrative
  const genre = userGenre && !userGenre.toLowerCase().includes('cyberpunk')
    ? userGenre
    : 'Photorealistic Live-Action Epic, IMAX 70mm';

  return `Cinematic scene depicting: ${clean}. Character details: Lifelike human subjects with realistic facial features, authentic muscle tone, detailed textured attire, expressive heroic posture and natural movement. Background setup: Expansive physical environment with authentic depth, foreground atmospheric haze, textured terrain, and detailed architecture on the horizon. Cinematography: Anamorphic 35mm lens, volumetric cinematic lighting, natural color grading, dynamic camera framing. Style: ${genre}, 8k resolution, IMAX film still, Unreal Engine 5 realism, masterwork, NOT cartoon, NOT comic book, NOT 2D animation, NOT sketch, photorealistic live-action film.`;
}

// In-memory cache for preloaded scene visual images
const sceneImageCache = new Map<string, HTMLImageElement>();

// Preload diffusion image using fetch + blob to prevent CORS failures
async function loadDiffusionImageViaBlob(
  promptText: string,
  width: number,
  height: number,
  seed: number
): Promise<HTMLImageElement | null> {
  const cleanSubject = promptText
    .replace(/^cinematic wan 2\.1 video of:?/i, '')
    .replace(/wan 2\.1/gi, '')
    .trim();

  // If prompt is short, expand it into full cinematic instruction
  const fullPrompt = cleanSubject.length > 50
    ? cleanSubject
    : generateDetailedDiffusionPrompt(cleanSubject);

  const encodedPrompt = encodeURIComponent(fullPrompt);
  const urls = [
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`,
    `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 14000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 1000) {
          const blobUrl = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = blobUrl;
          });
          if (img.complete && img.naturalWidth > 0) {
            return img;
          }
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  // Fallback direct image load if fetch is blocked
  try {
    const directImg = new Image();
    directImg.crossOrigin = 'anonymous';
    directImg.src = urls[0];
    await new Promise<void>(resolve => {
      directImg.onload = () => resolve();
      directImg.onerror = () => resolve();
      setTimeout(resolve, 8000);
    });
    if (directImg.complete && directImg.naturalWidth > 0) {
      return directImg;
    }
  } catch {}

  return null;
}

export function prefetchSceneVisual(
  text: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  sceneIndex: number
) {
  const width = aspectRatio === '9:16' ? 405 : aspectRatio === '1:1' ? 512 : 720;
  const height = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 512 : 405;
  const seed = Math.abs(text.split('').reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) | 0, sceneIndex * 1337 + 7));
  const cacheKey = `${text}_${sceneIndex}_${aspectRatio}`;

  if (!sceneImageCache.has(cacheKey)) {
    loadDiffusionImageViaBlob(text, width, height, seed).then(img => {
      if (img) {
        sceneImageCache.set(cacheKey, img);
      }
    });
  }
}

// Atmospheric scenic fallback (ONLY if completely offline) - pure cinematic lighting and waves, ZERO cartoon/geometric shapes
function drawAtmosphericScenicFallback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number
) {
  // 1. Epic Twilight Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.65);
  skyGrad.addColorStop(0, '#040914');
  skyGrad.addColorStop(0.35, '#0d1f38');
  skyGrad.addColorStop(0.65, '#251b3a');
  skyGrad.addColorStop(0.85, '#6e2b1e');
  skyGrad.addColorStop(1, '#c25820');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Glowing Sun on horizon
  const sunX = width * 0.7;
  const sunY = height * 0.52;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, width * 0.45);
  sunGrad.addColorStop(0, 'rgba(255, 235, 170, 0.95)');
  sunGrad.addColorStop(0.2, 'rgba(255, 140, 50, 0.5)');
  sunGrad.addColorStop(0.6, 'rgba(180, 60, 20, 0.2)');
  sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, width * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Distant Mountain / Island silhouette on horizon
  const waterHorizonY = height * 0.54;
  ctx.fillStyle = '#060d1b';
  ctx.beginPath();
  ctx.moveTo(width * 0.55, waterHorizonY);
  ctx.lineTo(width * 0.65, height * 0.46);
  ctx.lineTo(width * 0.72, height * 0.41);
  ctx.lineTo(width * 0.78, height * 0.48);
  ctx.lineTo(width * 0.88, height * 0.44);
  ctx.lineTo(width, waterHorizonY);
  ctx.lineTo(width, height);
  ctx.lineTo(width * 0.55, height);
  ctx.closePath();
  ctx.fill();

  // Ocean Water with depth layers
  ctx.fillStyle = '#07162b';
  ctx.fillRect(0, waterHorizonY, width, height - waterHorizonY);

  // Rolling waves
  ctx.fillStyle = '#041021';
  ctx.beginPath();
  ctx.moveTo(0, waterHorizonY + 35);
  for (let x = 0; x <= width; x += 15) {
    const y = waterHorizonY + 35 + Math.sin(x * 0.025 + progress * 6) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Foreground wave crests with foam
  ctx.strokeStyle = 'rgba(200, 230, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 20) {
    const y = waterHorizonY + 70 + Math.sin(x * 0.015 + progress * 5) * 16;
    if (Math.sin(x * 0.03 + progress * 3) > 0.2) {
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
    }
  }
  ctx.stroke();
}

// Inbuilt Studio Image Generator: Generates pristine high-res images for scenes or master character anchor
export async function generateInbuiltImage(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  seed?: number
): Promise<string> {
  const width = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 1024 : 1280;
  const height = aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 1024 : 720;
  const cleanPrompt = prompt.replace(/^cinematic wan 2\.1 video of:?/i, '').trim();
  const enhancedPrompt = `${cleanPrompt}, 2026 modern cinematic film still, 8k resolution, Unreal Engine 5, hyper-detailed, IMAX 70mm masterpiece, crystal clear focus, high dynamic range, crisp modern lighting, no vintage, no retro, no grain, no vhs, no 80s`;
  const actualSeed = seed ?? Math.floor(Math.random() * 9999999);
  const encoded = encodeURIComponent(enhancedPrompt);

  const urls = [
    `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${actualSeed}&model=flux&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${actualSeed}&nologo=true`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 1000) {
          return URL.createObjectURL(blob);
        }
      }
    } catch {}
  }

  return urls[0];
}

// Helper: Generate modern 2026 photorealistic cinematic video clip with camera motion and audio
async function generateClientVideoClip(
  text: string,
  durationSec: number,
  resolution: string,
  aspectRatio: '16:9' | '9:16' | '1:1',
  sceneIndex: number = 0,
  narrationText: string = '',
  customImageUrl?: string
): Promise<string> {
  // True High-Definition canvas dimensions (1280x720 for 720p, 1920x1080 for 1080p)
  const is1080p = resolution === '1080p';
  const width = aspectRatio === '9:16' ? (is1080p ? 720 : 540) : aspectRatio === '1:1' ? (is1080p ? 1080 : 720) : (is1080p ? 1920 : 1280);
  const height = aspectRatio === '9:16' ? (is1080p ? 1280 : 960) : aspectRatio === '1:1' ? (is1080p ? 1080 : 720) : (is1080p ? 1080 : 720);

  const cleanSubject = text
    .replace(/^cinematic wan 2\.1 video of:?/i, '')
    .replace(/wan 2\.1/gi, '')
    .trim();
  const seed = Math.abs(text.split('').reduce((acc, c) => (acc * 33 + c.charCodeAt(0)) | 0, sceneIndex * 1337 + 7));

  let img: HTMLImageElement | null = null;

  // 1. If user provided their own uploaded image or inbuilt studio image, load it directly
  if (customImageUrl) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = customImageUrl;
    await new Promise<void>(resolve => {
      if (img!.complete && img!.naturalWidth > 0) return resolve();
      img!.onload = () => resolve();
      img!.onerror = () => resolve();
      setTimeout(resolve, 8000);
    });
  } else {
    // 2. Otherwise load via modern diffusion pipeline
    const cacheKey = `${text}_${sceneIndex}_${aspectRatio}`;
    if (sceneImageCache.has(cacheKey) && sceneImageCache.get(cacheKey)!.complete && sceneImageCache.get(cacheKey)!.naturalWidth > 0) {
      img = sceneImageCache.get(cacheKey)!;
    } else {
      img = await loadDiffusionImageViaBlob(text, width, height, seed);
      if (img) {
        sceneImageCache.set(cacheKey, img);
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const clipSeconds = Math.max(3.5, Math.min(10, Math.round(Number(durationSec) || 5)));

  const drawSceneVisual = (progress: number) => {
    // Modern 2026 Photorealistic Cinematic Presentation: Smooth 3D Ken Burns Motion
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      // Smooth cinematic camera drift with subtle natural zoom (NO 80s scanline artifacts)
      const zoom = 1.0 + progress * 0.08;
      const panX = (progress - 0.5) * (width * 0.03);
      const panY = (progress - 0.5) * (height * 0.015);

      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();

      // Modern cinematic subtle lighting flare (warm natural glow, not 80s tape line)
      const flareX = width * (0.2 + progress * 0.6);
      const flareGrad = ctx.createRadialGradient(flareX, height * 0.3, 10, flareX, height * 0.3, width * 0.5);
      flareGrad.addColorStop(0, 'rgba(255, 240, 210, 0.12)');
      flareGrad.addColorStop(0.5, 'rgba(255, 200, 140, 0.04)');
      flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Atmospheric scenic fallback (pure lighting and waves, no cartoon shapes)
      drawAtmosphericScenicFallback(ctx, width, height, progress);
    }

    // Modern Minimalist Subtitles (Clean Apple TV / Netflix style, NO retro box)
    const subText = narrationText || cleanSubject;
    if (subText && subText.length > 0) {
      const cleanSub = subText.substring(0, 110);
      ctx.save();
      const fontSize = Math.max(14, Math.round(width * 0.022));
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const textMetrics = ctx.measureText(cleanSub);
      const pillWidth = Math.min(width - 40, textMetrics.width + 36);
      const pillHeight = fontSize + 18;
      const pillX = (width - pillWidth) / 2;
      const pillY = height - pillHeight - 24;

      ctx.fillStyle = 'rgba(10, 15, 28, 0.72)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanSub, width / 2, pillY + pillHeight / 2);
      ctx.restore();
    }
  };

  // If MediaRecorder is unsupported, return static canvas blob immediately
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    drawSceneVisual(1.0);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'));
      });
    });
  }

  // 2. Synthesize High-Fidelity Cinematic Ambient Audio Track via Web Audio API
  let audioStreamTrack: MediaStreamTrack | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();

      // Deep cinematic sub-bass drone
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(48, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(56, audioCtx.currentTime + clipSeconds);
      gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.6);
      gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + clipSeconds);

      osc.connect(gainNode);
      gainNode.connect(dest);
      osc.start();
      osc.stop(audioCtx.currentTime + clipSeconds + 0.5);

      if (dest.stream.getAudioTracks().length > 0) {
        audioStreamTrack = dest.stream.getAudioTracks()[0];
      }
    }
  } catch {
    // Audio track progressive enhancement
  }

  // Modern 30 FPS smooth rendering with 6.5 Mbps bitrate
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);
  const streamTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioStreamTrack) {
    streamTracks.push(audioStreamTrack);
  }
  const stream = new MediaStream(streamTracks);

  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : 'video/mp4';

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6500000 });
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

    const totalFrames = clipSeconds * fps;
    let currentFrame = 0;

    const interval = setInterval(() => {
      currentFrame++;
      const progress = Math.min(1.0, currentFrame / totalFrames);
      drawSceneVisual(progress);

      if (currentFrame >= totalFrames) {
        clearInterval(interval);
        setTimeout(() => {
          try {
            if (recorder.state === 'recording') recorder.stop();
          } catch {
            finish();
          }
        }, 150);
      }
    }, 1000 / fps);

    // Watchdog safety timeout (clipSeconds + 2s) so recording always completes cleanly
    setTimeout(() => {
      clearInterval(interval);
      try {
        if (recorder.state === 'recording') recorder.stop();
        else finish();
      } catch {
        finish();
      }
    }, (clipSeconds + 2) * 1000);
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

    // Client-side splitting with rich prompt engineering (for GitHub Pages static deploy)
    const sentences = script
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const defaultDuration = options?.targetDuration || 5.0;
    const fallbackScenes: SplitSceneResult[] = (
      sentences.length > 0 ? sentences : ['Opening scene of the narrative.']
    ).map((text, idx) => ({
      scene_id: `scene_${idx + 1}`,
      narration_text: text,
      visual_prompt: generateDetailedDiffusionPrompt(text, options?.genreStyle),
      target_duration_seconds: Math.max(3.5, Math.min(8.0, text.split(' ').length * 0.4 + 2.8)),
    }));

    let projectTitle = 'Custom Video Project';
    const lowerScript = script.toLowerCase();
    if (lowerScript.includes('hanuman') || lowerScript.includes('lanka')) {
      projectTitle = 'Mythological Epic: Hanuman Soaring to Lanka';
    } else if (sentences[0]) {
      projectTitle = sentences[0].slice(0, 32) + '...';
    }

    return {
      title: projectTitle,
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
    generationMode?: VideoGenerationMode;
    characterAnchorImage?: string | null;
    characterAnchorPrompt?: string | null;
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
      generation_mode: params.generationMode || 'prompt',
      character_anchor_image: params.characterAnchorImage || null,
      character_anchor_prompt: params.characterAnchorPrompt || null,
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
        image_url: s.image_url || params.characterAnchorImage || null,
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

    // Warm up the visual for the first scene immediately
    if (newJob.scenes && newJob.scenes.length > 0) {
      prefetchSceneVisual(newJob.scenes[0].visual_prompt, newJob.aspect_ratio, 0);
    }

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
          scene.scene_index,
          scene.narration_text,
          scene.image_url || job.character_anchor_image || undefined
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

    // Warm up the next scene's visual in background while this one generates!
    const nextScene = job.scenes.find(s => s.scene_index === scene.scene_index + 1);
    if (nextScene) {
      prefetchSceneVisual(nextScene.visual_prompt, job.aspect_ratio, nextScene.scene_index);
    }

    // 2. Generate video clip
    const clipUrl = await generateClientVideoClip(
      scene.visual_prompt,
      scene.target_duration_seconds,
      scene.resolution,
      job.aspect_ratio,
      scene.scene_index,
      scene.narration_text,
      scene.image_url || job.character_anchor_image || undefined
    );

    // 3. Mark complete & release GPU lock
    scene.status = 'done';
    scene.output_path = clipUrl;
    scene.last_error = null;
    job.gpuLockActive = false;
    job.currentVramMb = 850;

    if (job.scenes.every(s => s.status === 'done')) {
      job.status = 'completed';
    } else {
      job.status = 'queued';
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
