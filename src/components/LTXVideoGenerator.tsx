import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  Download,
  RotateCcw,
  Film,
  Zap,
  Clock,
  Ratio,
  Compass,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sliders,
  Layers,
  Wand2,
  Share2
} from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';

interface GeneratedVideo {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  timestamp: number;
  engineUsed: string;
}

const INSPIRATION_PROMPTS = [
  {
    title: 'Lord Hanuman Flight',
    prompt: 'Lord Hanuman flying majestically over tumultuous stormy ocean towards golden fortress of Lanka, divine glowing golden mace forward, volumetric god rays and sunset twilight',
  },
  {
    title: 'Cosmic Warrior Reveal',
    prompt: 'Lord Hanuman expanding into colossal cosmic warrior form against glowing celestial nebula, lightning arcing across deep space, golden amber aura and ruby mukut crown',
  },
  {
    title: 'Cyberpunk Neon Rain',
    prompt: 'A futuristic cybernetic speeder gliding through rainy neon Tokyo skyscrapers at night, wet reflections, vibrant cyan and magenta volumetric lights, 8k cinematic live action',
  },
  {
    title: 'Ancient Himalayan Temple',
    prompt: 'Ancient Himalayan stone mandir temple atop snowy cliff at sunrise, golden prayer flags billowing in wind, sacred morning mist and dramatic sunlight rays breaking through peaks',
  },
];

interface LTXVideoGeneratorProps {
  onNavigateTab?: (tab: 'ltx' | 'script' | 'queue' | 'cinema') => void;
}

export const LTXVideoGenerator: React.FC<LTXVideoGeneratorProps> = ({ onNavigateTab }) => {
  const [prompt, setPrompt] = useState<string>(
    'Lord Hanuman soaring through golden sunset sky over deep ocean, holding glowing celestial Gada mace, divine aura with sweeping volumetric god rays'
  );
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [cameraMotion, setCameraMotion] = useState<string>('fly_track');
  const [duration, setDuration] = useState<number>(5);
  const [resolution, setResolution] = useState<string>('720p');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);
  const [history, setHistory] = useState<GeneratedVideo[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [hasVerifiedToken, setHasVerifiedToken] = useState(false);
  const [tokenUsername, setTokenUsername] = useState<string | null>(null);

  // Check token status on mount
  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    try {
      const clientTok = apiClient.getClientToken();
      if (clientTok) {
        const res = await apiClient.verifyToken(clientTok);
        if (res.valid) {
          setHasVerifiedToken(true);
          setTokenUsername(res.username || null);
          return;
        }
      }
      const cfg = await apiClient.getServerConfig();
      if (cfg.hasHfToken) {
        setHasVerifiedToken(true);
      }
    } catch {}
  };

  const videoRef = useRef<HTMLVideoElement>(null);

  // Load past generations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ltx_generated_videos_v1');
      if (saved) {
        const list: GeneratedVideo[] = JSON.parse(saved);
        setHistory(list);
        if (list.length > 0 && !currentVideo) {
          setCurrentVideo(list[0]);
        }
      }
    } catch {}
  }, []);

  const saveToHistory = (item: GeneratedVideo) => {
    setHistory(prev => {
      const updated = [item, ...prev.filter(p => p.id !== item.id)].slice(0, 12);
      try {
        localStorage.setItem('ltx_generated_videos_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setErrorMessage(null);
    try {
      const enhanced = await apiClient.enhancePrompt(prompt, {
        genreStyle: 'Photorealistic Live-Action Epic, IMAX 70mm',
      });
      if (enhanced) {
        setPrompt(typeof enhanced === 'string' ? enhanced : (enhanced as any).enhancedPrompt || prompt);
      }
    } catch {
      // Fallback client prompt enricher
      setPrompt(
        `${prompt.trim()}, cinematic 8k masterpiece, IMAX 70mm lens, dynamic volumetric lighting, masterwork composition`
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setProgressPercent(10);
    setProgressStage('Allocating Cloud GPU & Initializing Pipeline...');

    // Progress simulation while server computes
    const timer1 = setTimeout(() => {
      setProgressPercent(35);
      setProgressStage('Synthesizing Photorealistic Keyframe & Depth Maps...');
    }, 1200);

    const timer2 = setTimeout(() => {
      setProgressPercent(65);
      setProgressStage('Applying 24 FPS Camera Physics & Motion Diffusion...');
    }, 3200);

    const timer3 = setTimeout(() => {
      setProgressPercent(88);
      setProgressStage('Mastering H.264 Video Stream & Ambient Soundscape...');
    }, 5500);

    try {
      const result = await apiClient.generateDirectVideo({
        prompt: prompt.trim(),
        duration,
        aspectRatio,
        resolution,
        cameraMovement: cameraMotion,
        onProgress: (stage: string) => {
          setProgressStage(stage);
          setProgressPercent(prev => Math.min(95, prev + 15));
        },
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setProgressPercent(100);
      setProgressStage('Video Generation Complete!');

      const newVideo: GeneratedVideo = {
        id: `vid_${Date.now()}`,
        url: result.videoUrl,
        prompt: prompt.trim(),
        duration: result.duration || duration,
        aspectRatio: result.aspectRatio || aspectRatio,
        timestamp: Date.now(),
        engineUsed: result.engineUsed || 'ltx_cloud_gpu',
      };

      setCurrentVideo(newVideo);
      saveToHistory(newVideo);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setErrorMessage(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!currentVideo?.url) return;
    const a = document.createElement('a');
    a.href = currentVideo.url;
    a.download = `ltx_video_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = () => {
    if (!currentVideo?.url) return;
    const fullUrl = currentVideo.url.startsWith('http')
      ? currentVideo.url
      : window.location.origin + currentVideo.url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-800/30 p-6 md:p-8 shadow-xl">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              hasVerifiedToken
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}>
              <Zap className="w-3.5 h-3.5" />
              <span>
                {hasVerifiedToken
                  ? `Hugging Face ZeroGPU Active (${tokenUsername ? `@${tokenUsername}` : 'Authenticated'})`
                  : 'Free Camera Motion Mode Active'}
              </span>
            </div>
            {!hasVerifiedToken && (
              <span className="text-xs text-slate-400">
                Tip: Click <strong>"Cloud Engine"</strong> in the top header to test & connect your Hugging Face token for real AI diffusion.
              </span>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Generate Cinematic AI Video in Seconds
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Enter any visual scene or story concept. The system runs real frame-by-frame generative motion with dynamic camera angles, cinematic volumetric lighting, and 24 FPS MP4 playback.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab?.('script')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 border border-blue-400/40 cursor-pointer transition"
            >
              <Layers className="w-4 h-4 text-amber-300" />
              <span>🎬 Generate Video Sequence (Multi-Scene Studio)</span>
            </button>
            <span className="text-xs text-slate-400">
              For structured multi-scene scripts, consistent characters, and full storylines.
            </span>
          </div>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Panel: Prompt & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
            {/* Prompt Input Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Film className="w-4 h-4 text-blue-400" />
                  <span>Scene Prompt</span>
                </label>
                <button
                  type="button"
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing || !prompt.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 transition cursor-pointer disabled:opacity-50"
                  title="Enhance prompt with photorealistic cinematography details via Gemini 3.8 Flash"
                >
                  <Wand2 className={`w-3.5 h-3.5 ${isEnhancing ? 'animate-spin' : ''}`} />
                  <span>{isEnhancing ? 'Enhancing...' : 'Enhance with AI'}</span>
                </button>
              </div>

              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your scene in detail (e.g. Lord Hanuman flying majestically over deep ocean with glowing golden mace, volumetric sunset lighting)..."
                rows={4}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-y"
              />
            </div>

            {/* Inspiration Chips */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400">Quick Inspiration:</span>
              <div className="flex flex-wrap gap-2">
                {INSPIRATION_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(item.prompt)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Studio Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              {/* Aspect Ratio */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Ratio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Aspect Ratio</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        aspectRatio === ratio
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Motion */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  <span>Camera Shot</span>
                </label>
                <select
                  value={cameraMotion}
                  onChange={e => setCameraMotion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="fly_track">Flight Tracking & Pan</option>
                  <option value="push_in">Heroic Push-In Zoom</option>
                  <option value="pull_reveal">Epic Pull-Back Reveal</option>
                  <option value="aerial_drift">2.5D Aerial Drift Sway</option>
                </select>
              </div>

              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Duration</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[3, 5, 8].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDuration(sec)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        duration === sec
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGenerating ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Generating AI Video Clip...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Generate Video (LTX Engine)</span>
                </>
              )}
            </button>

            {/* Direct Switch to Video Sequence Studio */}
            <button
              type="button"
              onClick={() => onNavigateTab?.('script')}
              className="w-full py-2.5 px-3 rounded-xl font-medium text-xs text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Looking for full Multi-Scene Storyboard? <strong>Open Video Sequence Studio</strong> →</span>
            </button>

            {/* Progress Bar when generating */}
            {isGenerating && (
              <div className="space-y-2 pt-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    <span>{progressStage}</span>
                  </span>
                  <span className="font-mono text-blue-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Output Panel: Video Player & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span>Generated Video Output</span>
              </h3>
              {currentVideo && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-700/50 text-emerald-400">
                  24 FPS • {currentVideo.aspectRatio}
                </span>
              )}
            </div>

            {/* Video Canvas / Player Container */}
            <div
              className={`w-full bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center relative ${
                currentVideo?.aspectRatio === '9:16'
                  ? 'aspect-[9/16] max-h-[460px] mx-auto'
                  : currentVideo?.aspectRatio === '1:1'
                  ? 'aspect-square'
                  : 'aspect-video'
              }`}
            >
              {currentVideo ? (
                <video
                  ref={videoRef}
                  src={currentVideo.url}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                    <Film className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Ready for Generation</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] mx-auto">
                      Click "Generate Video" to create your first moving AI video clip.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Player Toolbar / Download Actions */}
            {currentVideo && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP4</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                    title="Copy direct video link"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 truncate">
                    "{currentVideo.prompt}"
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span>Engine: {currentVideo.engineUsed}</span>
                    <span>Duration: {currentVideo.duration}s</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* History Gallery */}
          {history.length > 1 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Video Generations ({history.length})
              </h4>
              <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                {history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setCurrentVideo(item)}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                      currentVideo?.id === item.id
                        ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-[11px] text-slate-200 line-clamp-2 font-medium">
                      {item.prompt}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{item.duration}s</span>
                      <span className="font-mono">{item.aspectRatio}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
