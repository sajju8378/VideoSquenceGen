import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Film,
  Volume2,
  Bug,
  Download,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Video,
  Timer,
  Square,
  SkipForward,
  Unlock
} from 'lucide-react';
import type { Job, Scene } from '../types.ts';
import { apiClient, downloadVideoFile } from '../services/apiClient.ts';
import { HFOngoingProcessSection } from './HFOngoingProcessSection.tsx';

interface QueueMonitorProps {
  job: Job;
  onRefreshJob: () => void;
  onSelectScenePreview?: (scene: Scene) => void;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  job,
  onRefreshJob,
  onSelectScenePreview,
}) => {
  const [isStartingQueue, setIsStartingQueue] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [retryingSceneId, setRetryingSceneId] = useState<string | null>(null);
  const [expandedPreviewSceneId, setExpandedPreviewSceneId] = useState<string | null>(null);

  // Auto-advance pipeline state: Default to false so user has full control and doesn't get stuck in auto-loop
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);

  // Simulation test modes
  const [simOOM, setSimOOM] = useState<boolean>(false);
  const [simQuota, setSimQuota] = useState<boolean>(false);
  const [simTimeout, setSimTimeout] = useState<boolean>(false);
  const [acceleratedSpeed, setAcceleratedSpeed] = useState<boolean>(false);

  const scenes = job.scenes || [];
  const completedCount = scenes.filter(s => s.status === 'done').length;
  const failedCount = scenes.filter(s => s.status === 'failed').length;
  const progressPercent = scenes.length > 0 ? Math.round((completedCount / scenes.length) * 100) : 0;

  // Find next pending scene and currently generating scene
  const nextPendingScene = scenes.find(s => s.status === 'pending');
  const activeGeneratingScene = scenes.find(s => s.status === 'generating');
  const lastCompletedScene = [...scenes].reverse().find(s => s.status === 'done');

  // Single GPU lock is active if any scene is generating
  const isGpuBusy = !!generatingSceneId || !!activeGeneratingScene;

  // Auto-advance countdown effect:
  // When a video completes and there is a next pending scene, automatically start countdown to next scene
  useEffect(() => {
    // Clear any existing countdown if GPU is busy or all scenes done or no pending scene
    if (isGpuBusy || !nextPendingScene || !autoAdvance) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      return;
    }

    // Only trigger auto-advance countdown if at least one scene is already done (i.e. proceeding to scene 2, 3...)
    if (completedCount > 0 && nextPendingScene) {
      setCountdown(3);
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            // Trigger next scene generation
            handleGenerateSingle(nextPendingScene.id);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      };
    }
  }, [completedCount, isGpuBusy, autoAdvance, nextPendingScene?.id]);

  const resolveClipUrl = (filePath: string | null) => {
    if (!filePath) return '';
    if (filePath.startsWith('blob:') || filePath.startsWith('data:') || filePath.startsWith('http')) {
      return filePath;
    }
    const filename = filePath.split('/').pop() || '';
    return `/api/media/clips/${filename}`;
  };

  const handleDownloadScene = (scene: Scene, index: number) => {
    if (!scene.output_path) return;
    const url = resolveClipUrl(scene.output_path);
    const filename = `scene_${index + 1}_${scene.resolution || '720p'}.mp4`;
    downloadVideoFile(url, filename);
  };

  const handleDownloadAll = () => {
    const doneScenes = scenes.filter(s => s.status === 'done' && s.output_path);
    doneScenes.forEach((s, idx) => {
      setTimeout(() => {
        handleDownloadScene(s, s.scene_index ?? idx);
      }, idx * 300);
    });
  };

  const handleGenerateSingle = async (sceneId: string, forcedResolution?: string) => {
    // Cancel any running countdown
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);

    setGeneratingSceneId(sceneId);
    try {
      await apiClient.generateSingleScene(job.id, sceneId, forcedResolution);
      // Automatically expand and play the generated video
      setExpandedPreviewSceneId(sceneId);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to generate scene:', err);
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const cancelAutoAdvance = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
    setAutoAdvance(false);
  };

  const handleStartQueue = async () => {
    setIsStartingQueue(true);
    try {
      const simConfig = {
        simulateOOMOnSceneIndex: simOOM ? 1 : undefined,
        simulateQuotaOnSceneIndex: simQuota ? 0 : undefined,
        simulateTimeoutOnSceneIndex: simTimeout ? 0 : undefined,
        acceleratedSpeed,
      };

      await apiClient.startJobQueue(job.id, simConfig);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to start queue:', err);
    } finally {
      setIsStartingQueue(false);
    }
  };

  const handleStopQueue = async () => {
    setIsStopping(true);
    cancelAutoAdvance();
    try {
      await apiClient.stopJobQueue(job.id);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to stop queue:', err);
    } finally {
      setIsStopping(false);
      setGeneratingSceneId(null);
    }
  };

  const handleResetGpuLock = async () => {
    setIsStopping(true);
    cancelAutoAdvance();
    try {
      await apiClient.resetGpuLock(job.id);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to reset GPU lock:', err);
    } finally {
      setIsStopping(false);
      setGeneratingSceneId(null);
    }
  };

  const handleSkipScene = async (sceneId: string) => {
    setIsStopping(true);
    cancelAutoAdvance();
    try {
      await apiClient.skipScene(job.id, sceneId);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to skip scene:', err);
    } finally {
      setIsStopping(false);
      setGeneratingSceneId(null);
    }
  };

  const handleRetryScene = async (sceneId: string, forcedResolution?: string) => {
    setRetryingSceneId(sceneId);
    try {
      await apiClient.retryScene(job.id, sceneId, forcedResolution);
      onRefreshJob();
    } catch (err) {
      console.error('Failed to retry scene:', err);
    } finally {
      setRetryingSceneId(null);
    }
  };

  const getStatusBadge = (scene: Scene) => {
    switch (scene.status) {
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Done ({scene.resolution})</span>
          </span>
        );
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/40 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>Diffusing AI Video & Motion...</span>
          </span>
        );
      case 'waiting_quota':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            <span>Waiting for GPU Quota</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>In Queue</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. GUIDED STEP-BY-STEP & AUTO-ADVANCE BANNER */}
      <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/50 p-5 md:p-6 shadow-2xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Wan 2.1 Sequential Pipeline</span>
              </span>

              {/* Mode indicator */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span>
                  {job.generation_mode === 'image_upload'
                    ? 'Mode: Image Input'
                    : job.generation_mode === 'inbuilt_image'
                    ? 'Mode: Inbuilt Studio Image'
                    : 'Mode: Diffusion Prompt'}
                </span>
              </span>

              {/* Character Consistency Indicator */}
              {(job.character_anchor_image || job.character_anchor_prompt) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <Check className="w-3 h-3 text-indigo-400" />
                  <span>Character Consistency Active</span>
                </span>
              )}

              {/* Auto-Advance Toggle Badge */}
              <button
                onClick={() => {
                  if (countdown !== null) cancelAutoAdvance();
                  else setAutoAdvance(!autoAdvance);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer border ${
                  autoAdvance
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40 hover:bg-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                }`}
                title="When enabled, proceeds to the next scene automatically after showing download link"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>Auto-Advance: {autoAdvance ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Dynamic Step Title & Status */}
            {activeGeneratingScene ? (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2.5">
                  <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                  <span>
                    Generating Video Scene {activeGeneratingScene.scene_index + 1} of {scenes.length}...
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Synthesizing visual frames ({Number(activeGeneratingScene.target_duration_seconds).toFixed(1)}s full duration) under single GPU lock. Memory is cleared immediately upon completion.
                </p>
              </div>
            ) : countdown !== null && nextPendingScene ? (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-amber-300 flex items-center gap-2.5">
                  <Timer className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span>
                    Video {nextPendingScene.scene_index} Ready! Starting Video {nextPendingScene.scene_index + 1} in {countdown}s...
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Download link for Video {nextPendingScene.scene_index} is available below. Advancing automatically to Video {nextPendingScene.scene_index + 1}.
                </p>
              </div>
            ) : completedCount === scenes.length && scenes.length > 0 ? (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>All {scenes.length} Scene Videos Generated Successfully!</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  All clips have full target duration and can be downloaded individually or joined into the final assembled video.
                </p>
              </div>
            ) : nextPendingScene ? (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <span>
                    {nextPendingScene.scene_index === 0
                      ? 'Ready to Generate Video 1'
                      : `Video ${nextPendingScene.scene_index} Ready! Next: Video ${nextPendingScene.scene_index + 1}`}
                  </span>
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl line-clamp-2">
                  {nextPendingScene.scene_index === 0 ? (
                    <>Generate Video 1 first. Your download link will appear right here when ready.</>
                  ) : (
                    <>
                      Download Video {nextPendingScene.scene_index} below, or proceed to generate Video {nextPendingScene.scene_index + 1} (
                      {Number(nextPendingScene.target_duration_seconds).toFixed(1)}s).
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white">Queue Overview</h2>
                <p className="text-xs text-slate-400 mt-1">Manage scene generations and download individual MP4 clips.</p>
              </div>
            )}
          </div>

          {/* Action Buttons in Step-by-Step Banner */}
          <div className="flex flex-wrap items-center gap-3">
            {/* If countdown is active, show skip & pause buttons */}
            {countdown !== null && nextPendingScene && (
              <>
                <button
                  onClick={() => handleGenerateSingle(nextPendingScene.id)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-2 shadow-xl shadow-blue-600/30 transition cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Proceed to Video {nextPendingScene.scene_index + 1} Now</span>
                </button>
                <button
                  onClick={cancelAutoAdvance}
                  className="px-4 py-2.5 rounded-xl font-medium text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-2 transition cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Auto-Advance</span>
                </button>
              </>
            )}

            {/* Direct download button for the latest completed scene */}
            {lastCompletedScene && lastCompletedScene.output_path && !isGpuBusy && (
              <button
                onClick={() => handleDownloadScene(lastCompletedScene, lastCompletedScene.scene_index)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 flex items-center gap-2 shadow-lg transition cursor-pointer"
                title={`Download Video ${lastCompletedScene.scene_index + 1} (.mp4)`}
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Video {lastCompletedScene.scene_index + 1}</span>
              </button>
            )}

            {/* When GPU is busy generating a scene: Provide Stop, Skip, and Reset controls */}
            {isGpuBusy && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-950/60 border border-blue-500/40 text-xs font-semibold text-blue-300">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Synthesizing Video {activeGeneratingScene ? activeGeneratingScene.scene_index + 1 : ''}...</span>
                </div>

                <button
                  onClick={handleStopQueue}
                  disabled={isStopping}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-rose-200 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 flex items-center gap-2 shadow-lg shadow-rose-950/60 transition cursor-pointer"
                  title="Immediately stop sequential generation and release GPU lock"
                >
                  <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                  <span>{isStopping ? 'Stopping...' : 'Stop Generation'}</span>
                </button>

                {activeGeneratingScene && (
                  <button
                    onClick={() => handleSkipScene(activeGeneratingScene.id)}
                    disabled={isStopping}
                    className="px-3.5 py-2.5 rounded-xl font-medium text-xs text-amber-200 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 flex items-center gap-1.5 transition cursor-pointer"
                    title="Skip this scene and release lock"
                  >
                    <SkipForward className="w-3.5 h-3.5 text-amber-400" />
                    <span>Skip Scene</span>
                  </button>
                )}

                <button
                  onClick={handleResetGpuLock}
                  disabled={isStopping}
                  className="px-3 py-2.5 rounded-xl font-medium text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  title="Reset GPU lock and clear busy flag"
                >
                  <Unlock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Lock</span>
                </button>
              </div>
            )}

            {/* If next pending scene exists and no countdown or generation active */}
            {!isGpuBusy && countdown === null && nextPendingScene && (
              <>
                {/* 1. PRIMARY: Generate Entire Video Sequence */}
                <button
                  onClick={handleStartQueue}
                  disabled={isStartingQueue || isGpuBusy}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition cursor-pointer"
                  title="Generate all remaining scenes sequentially with ZeroGPU queue management"
                >
                  {isStartingQueue ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Starting Sequence...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>🎬 Generate Video Sequence (All {scenes.length} Scenes)</span>
                    </>
                  )}
                </button>

                {/* 2. Step-by-Step Single Scene Option */}
                <button
                  onClick={() => handleGenerateSingle(nextPendingScene.id)}
                  className="px-4 py-2.5 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center gap-2 transition cursor-pointer"
                >
                  {nextPendingScene.scene_index === 0 ? (
                    <>
                      <Film className="w-3.5 h-3.5 text-blue-400" />
                      <span>Generate Video 1 Only</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                      <span>Generate Video {nextPendingScene.scene_index + 1} Only</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* When all done, allow downloading all or restarting */}
            {completedCount === scenes.length && scenes.length > 0 && (
              <>
                <button
                  onClick={handleDownloadAll}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download All {scenes.length} Clips</span>
                </button>
                <button
                  onClick={handleStartQueue}
                  className="px-4 py-2.5 rounded-xl font-medium text-xs text-indigo-300 hover:text-white bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 flex items-center gap-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>🎬 Re-Generate Video Sequence</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Completed Scenes: <strong className="text-emerald-400 font-bold">{completedCount}</strong> / {scenes.length}
            </span>
            <span className="text-blue-400 font-bold">{progressPercent}% Completed</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. ZeroGPU Resilience Simulator Controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Bug className="w-4 h-4 text-amber-400" />
            <span>ZeroGPU Fault Injection & Testing Simulator</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Simulate real Hugging Face ZeroGPU conditions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* OOM Trigger */}
          <label
            className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
              simOOM
                ? 'bg-amber-950/30 border-amber-600/50 text-amber-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={simOOM}
              onChange={e => setSimOOM(e.target.checked)}
              className="mt-0.5 accent-amber-500 cursor-pointer"
            />
            <div>
              <span className="font-semibold block text-slate-200">Test OOM on Scene 2</span>
              <span className="text-[11px] text-slate-400">
                Verifies automatic downgrade (720p→480p) & recovery.
              </span>
            </div>
          </label>

          {/* Quota Exceeded Trigger */}
          <label
            className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
              simQuota
                ? 'bg-purple-950/30 border-purple-600/50 text-purple-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={simQuota}
              onChange={e => setSimQuota(e.target.checked)}
              className="mt-0.5 accent-purple-500 cursor-pointer"
            />
            <div>
              <span className="font-semibold block text-slate-200">Test Quota Exceeded</span>
              <span className="text-[11px] text-slate-400">
                Verifies exponential backoff & status surface.
              </span>
            </div>
          </label>

          {/* Lease Timeout Trigger */}
          <label
            className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
              simTimeout
                ? 'bg-red-950/30 border-red-600/50 text-red-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={simTimeout}
              onChange={e => setSimTimeout(e.target.checked)}
              className="mt-0.5 accent-red-500 cursor-pointer"
            />
            <div>
              <span className="font-semibold block text-slate-200">Test Lease Timeout</span>
              <span className="text-[11px] text-slate-400">
                Verifies duration budget reduction adaptation.
              </span>
            </div>
          </label>

          {/* Accelerated Speed */}
          <label
            className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
              acceleratedSpeed
                ? 'bg-blue-950/30 border-blue-600/50 text-blue-200'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              checked={acceleratedSpeed}
              onChange={e => setAcceleratedSpeed(e.target.checked)}
              className="mt-0.5 accent-blue-500 cursor-pointer"
            />
            <div>
              <span className="font-semibold block text-slate-200">Ultra-Fast Preview (3s)</span>
              <span className="text-[11px] text-slate-400">
                Accelerates frame recording for swift workflow.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* 3. SCENE EXECUTION LEDGER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-400" />
              <span>Scene Execution Ledger</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Each scene is generated with full duration under single GPU lock. Download buttons appear immediately upon completion.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={handleDownloadAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Download All ({completedCount})</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {scenes.map((scene, idx) => {
            const isGeneratingThis = generatingSceneId === scene.id || scene.status === 'generating';
            const isExpanded = expandedPreviewSceneId === scene.id;
            const hasNextScene = idx < scenes.length - 1;
            const nextScene = hasNextScene ? scenes[idx + 1] : null;

            return (
              <div
                key={scene.id}
                className={`p-4 md:p-5 rounded-xl border transition space-y-3.5 ${
                  scene.status === 'generating'
                    ? 'bg-blue-950/25 border-blue-500/50 ring-1 ring-blue-500/30'
                    : scene.status === 'done'
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : scene.status === 'failed'
                    ? 'bg-red-950/20 border-red-500/40'
                    : 'bg-slate-950/50 border-slate-800/80'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {/* Scene Image Keyframe Thumbnail if available */}
                    {scene.image_url || job.character_anchor_image ? (
                      <div className="w-14 h-9 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0 relative shadow-sm">
                        <img
                          src={scene.image_url || job.character_anchor_image || ''}
                          alt={`Keyframe ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 bg-slate-950/80 text-[9px] font-bold text-slate-300 px-1 rounded-tl">
                          #{idx + 1}
                        </span>
                      </div>
                    ) : (
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 font-mono text-xs font-bold flex items-center justify-center border border-slate-700 shrink-0">
                        {idx + 1}
                      </span>
                    )}

                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Video Scene {idx + 1}</span>
                        <span className="font-mono text-[10px] text-slate-500 font-normal">[{scene.id}]</span>
                        {scene.image_url && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">
                            Keyframe Locked
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Target Duration: {Number(scene.target_duration_seconds).toFixed(1)}s • {scene.resolution || '720p'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(scene)}

                    {/* ACTION BUTTONS FOR THIS SCENE */}

                    {/* 0. If Generating: Direct Stop and Skip buttons */}
                    {scene.status === 'generating' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleStopQueue}
                          disabled={isStopping}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          title={`Stop generating Video ${idx + 1}`}
                        >
                          <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                          <span>{isStopping ? 'Stopping...' : 'Stop'}</span>
                        </button>
                        <button
                          onClick={() => handleSkipScene(scene.id)}
                          disabled={isStopping}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-200 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                          title={`Skip Video ${idx + 1}`}
                        >
                          <SkipForward className="w-3 h-3 text-amber-400" />
                          <span>Skip</span>
                        </button>
                      </div>
                    )}

                    {/* 1. If Pending: Direct "Generate Video N" button (Only disabled if GPU is currently busy) */}
                    {scene.status === 'pending' && (
                      <button
                        onClick={() => handleGenerateSingle(scene.id)}
                        disabled={isGpuBusy}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition cursor-pointer"
                        title={`Generate Video ${idx + 1} with Wan 2.1`}
                      >
                        {isGeneratingThis ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Generate Video {idx + 1}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* 2. If Done: Prominent Download Link & Preview & Next Scene Proceed */}
                    {scene.status === 'done' && (
                      <>
                        {/* Direct Download Button */}
                        <button
                          onClick={() => handleDownloadScene(scene, idx)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                          title={`Download Video ${idx + 1} (.mp4)`}
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Download Video {idx + 1}</span>
                        </button>

                        {/* Inline Player Toggle */}
                        <button
                          onClick={() => setExpandedPreviewSceneId(isExpanded ? null : scene.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5 text-blue-400" />
                          <span>{isExpanded ? 'Hide Video' : 'Watch Video'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                        </button>

                        {/* Next Scene Proceed Button (if next scene is pending and GPU is free) */}
                        {nextScene && nextScene.status === 'pending' && (
                          <button
                            onClick={() => handleGenerateSingle(nextScene.id)}
                            disabled={isGpuBusy}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                            title={`Proceed to Generate Video ${idx + 2}`}
                          >
                            <span>Proceed to Video {idx + 2}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}

                    {/* 3. If Failed: Retry Button */}
                    {scene.status === 'failed' && (
                      <button
                        onClick={() => handleRetryScene(scene.id, '480p')}
                        disabled={retryingSceneId === scene.id || isGpuBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 flex items-center gap-1.5 transition cursor-pointer"
                        title="Retry only this scene at 480p"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry (480p)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Hugging Face Ongoing Process Section while Generating */}
                {scene.status === 'generating' && (
                  <HFOngoingProcessSection
                    scene={scene}
                    job={job}
                    isGenerating={true}
                  />
                )}

                {/* Inline Video Player for Completed Scene */}
                {isExpanded && scene.output_path && (
                  <div className="p-3.5 rounded-xl bg-black/75 border border-blue-500/30 shadow-2xl space-y-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                      <span className="flex items-center gap-1.5 font-semibold text-white">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Photorealistic AI Video ({scene.resolution || '720p'} • {Number(scene.target_duration_seconds).toFixed(1)}s)
                      </span>
                      <button
                        onClick={() => handleDownloadScene(scene, idx)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 bg-blue-950/40 px-2.5 py-1 rounded-md border border-blue-500/30 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MP4</span>
                      </button>
                    </div>
                    <div className="relative rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center max-h-80 aspect-video shadow-inner">
                      <video
                        src={resolveClipUrl(scene.output_path)}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Hugging Face Ongoing Process & Token Details Panel under Video Player */}
                    <div className="pt-2 border-t border-slate-800">
                      <HFOngoingProcessSection
                        scene={scene}
                        job={job}
                        isGenerating={false}
                      />
                    </div>
                  </div>
                )}

                {/* Visual Prompt & Narration Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Visual Prompt
                    </span>
                    <p className="text-slate-300 leading-relaxed">{scene.visual_prompt}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                      Voiceover Narration ({Number(scene.target_duration_seconds).toFixed(1)}s)
                    </span>
                    <p className="text-slate-300 italic leading-relaxed">"{scene.narration_text}"</p>
                  </div>
                </div>

                {/* Error Callout (if failed or warning) */}
                {scene.last_error && (
                  <div
                    className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                      scene.status === 'failed'
                        ? 'bg-red-950/40 border border-red-500/30 text-red-300'
                        : 'bg-amber-950/40 border border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="font-mono text-[11px] leading-relaxed">
                      <strong>Resilience Event:</strong> {scene.last_error}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
