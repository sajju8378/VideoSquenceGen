import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Download,
  Scissors,
  CheckCircle2,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { Job, Scene } from '../types.ts';

interface CinemaViewerProps {
  job: Job;
  selectedPreviewScene: Scene | null;
  onClearPreviewScene: () => void;
  onRefreshJob: () => void;
  onSelectScenePreview?: (scene: Scene) => void;
}

export const CinemaViewer: React.FC<CinemaViewerProps> = ({
  job,
  selectedPreviewScene,
  onClearPreviewScene,
  onRefreshJob,
  onSelectScenePreview,
}) => {
  const [isAssembling, setIsAssembling] = useState(false);
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [transitionType, setTransitionType] = useState<'cut' | 'crossfade'>('cut');

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const scenes = job.scenes || [];
  const completedScenes = scenes.filter(s => s.status === 'done' && s.output_path);

  // Active video source: either individual preview scene clip or final assembled video
  const activeVideoUrl = selectedPreviewScene
    ? `/api/media/clips/${selectedPreviewScene.output_path ? selectedPreviewScene.output_path.split('/').pop() : ''}`
    : job.final_video_path
    ? `/api/media/outputs/${job.final_video_path}`
    : completedScenes.length > 0 && completedScenes[0].output_path
    ? `/api/media/clips/${completedScenes[0].output_path.split('/').pop()}`
    : null;

  const isFinalVideo = !selectedPreviewScene && !!job.final_video_path;

  const handleAssemble = async () => {
    setIsAssembling(true);
    setAssemblyError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/assemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transitionType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Assembly failed');
      }
      onClearPreviewScene();
      onRefreshJob();
    } catch (err: any) {
      setAssemblyError(err.message || 'Failed to assemble video');
    } finally {
      setIsAssembling(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6">
      {/* Video Player Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Cinema Screening Room</h3>
              {selectedPreviewScene ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Previewing Scene {selectedPreviewScene.scene_index + 1}
                </span>
              ) : job.final_video_path ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Final Assembled Video
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400">
                  No Video Rendered Yet
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedPreviewScene
                ? `Isolated clip preview for Scene ${selectedPreviewScene.scene_index + 1}`
                : job.final_video_path
                ? 'Full multi-scene video stitched with synced narration and transitions'
                : 'Waiting for scene generation to complete'}
            </p>
          </div>

          {selectedPreviewScene && job.final_video_path && (
            <button
              onClick={onClearPreviewScene}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 underline"
            >
              Back to Full Assembled Video
            </button>
          )}
        </div>

        {/* Video Canvas Container */}
        <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800/80 shadow-2xl flex items-center justify-center">
          {activeVideoUrl ? (
            <div
              className={`w-full flex items-center justify-center bg-black ${
                job.aspect_ratio === '9:16' ? 'max-w-sm mx-auto aspect-[9/16]' : 'aspect-video'
              }`}
            >
              <video
                ref={videoRef}
                key={activeVideoUrl}
                src={activeVideoUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-contain"
                playsInline
              />
            </div>
          ) : (
            <div className="aspect-video w-full flex flex-col items-center justify-center text-slate-600 gap-3 p-8 text-center">
              <Film className="w-12 h-12 stroke-[1.2] text-slate-700" />
              <div>
                <p className="text-sm font-medium text-slate-400">Video Canvas Standby</p>
                <p className="text-xs text-slate-600 mt-1 max-w-sm">
                  Start the generation queue to render individual scene clips and assemble the final cut.
                </p>
              </div>
            </div>
          )}

          {/* Floating Play Overlay if Paused */}
          {activeVideoUrl && !isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-2xl shadow-blue-500/50 hover:scale-105 transition cursor-pointer backdrop-blur-sm"
            >
              <Play className="w-7 h-7 fill-white ml-1" />
            </button>
          )}
        </div>

        {/* Video Controls Bar */}
        {activeVideoUrl && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                onClick={toggleMute}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="text-xs font-mono text-slate-400">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <button
                onClick={handleFullscreen}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scene Clip Switcher / Selector */}
        {completedScenes.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-semibold text-slate-400 block">Switch Scene Clip:</span>
            <div className="flex flex-wrap gap-2">
              {job.final_video_path && (
                <button
                  onClick={onClearPreviewScene}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                    isFinalVideo
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Full Assembled Cut</span>
                </button>
              )}

              {completedScenes.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => onSelectScenePreview?.(scene)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition ${
                    selectedPreviewScene?.id === scene.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700'
                  }`}
                >
                  <Film className="w-3 h-3 text-slate-400" />
                  <span>Scene {idx + 1} ({scene.resolution})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Independent FFmpeg Assembly Card (Requirement #6) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-emerald-400" />
              Independent FFmpeg Assembly (Requirement #6)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Stitches completed scene clips + narration audio without touching or re-running generation state.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Transition:</span>
            <select
              value={transitionType}
              onChange={e => setTransitionType(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200"
            >
              <option value="cut">Direct Cut</option>
              <option value="crossfade">Crossfade (Blend)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-400">
            Available clips: <strong className="text-emerald-400">{completedScenes.length}</strong> / {scenes.length}{' '}
            scenes ready.
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAssemble}
              disabled={isAssembling || completedScenes.length === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              {isAssembling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Stitching with FFmpeg...</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>{job.final_video_path ? 'Re-Assemble Video' : 'Assemble Final Video'}</span>
                </>
              )}
            </button>

            {job.final_video_path && (
              <a
                href={`/api/media/outputs/${job.final_video_path}`}
                download={`video_${job.id}.mp4`}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Download MP4</span>
              </a>
            )}
          </div>
        </div>

        {assemblyError && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{assemblyError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
