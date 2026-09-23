import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  Cpu,
  RefreshCw,
  Film,
  Zap,
  Volume2,
  Bug,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import type { Job, Scene } from '../types.ts';
import { apiClient } from '../services/apiClient.ts';

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
  const [retryingSceneId, setRetryingSceneId] = useState<string | null>(null);

  // Simulation test modes
  const [simOOM, setSimOOM] = useState<boolean>(false);
  const [simQuota, setSimQuota] = useState<boolean>(false);
  const [simTimeout, setSimTimeout] = useState<boolean>(false);
  const [acceleratedSpeed, setAcceleratedSpeed] = useState<boolean>(true);

  const scenes = job.scenes || [];
  const completedCount = scenes.filter(s => s.status === 'done').length;
  const failedCount = scenes.filter(s => s.status === 'failed').length;
  const progressPercent = scenes.length > 0 ? Math.round((completedCount / scenes.length) * 100) : 0;

  const handleStartQueue = async () => {
    setIsStartingQueue(true);
    try {
      const simConfig = {
        simulateOOMOnSceneIndex: simOOM ? 1 : undefined, // Scene 2 OOM
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Generating (GPU Lock)</span>
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
      {/* Queue Header & Global Lock State */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Sequential Generation Queue</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                Job: {job.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Processes scenes sequentially behind a single process-wide lock. Completed scenes are saved to disk
              and will never be regenerated.
            </p>
          </div>

          {/* Start/Resume Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartQueue}
              disabled={isStartingQueue || job.status === 'processing'}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              {job.status === 'processing' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Processing Queue...</span>
                </>
              ) : completedCount === scenes.length && scenes.length > 0 ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Restart Queue</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Sequential Queue</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar & Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Completed Scenes: <strong className="text-white">{completedCount}</strong> / {scenes.length}
            </span>
            <span className="text-blue-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Resilience Laboratory Controls */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Bug className="w-4 h-4 text-amber-400" />
              <span>Resilience & Failure Recovery Laboratory</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Simulate real ZeroGPU edge cases</span>
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
                className="mt-0.5 accent-amber-500"
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
                className="mt-0.5 accent-purple-500"
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
                className="mt-0.5 accent-red-500"
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
                className="mt-0.5 accent-blue-500"
              />
              <div>
                <span className="font-semibold block text-slate-200">Accelerated Demo Speed</span>
                <span className="text-[11px] text-slate-400">
                  Quick clip synthesis for rapid UI testing.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Per-Scene Queue Table / Cards (Requirement #4 & #8) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center justify-between">
          <span>Scene Execution Ledger</span>
          <span className="text-xs font-mono text-slate-500 font-normal">
            Independent state per scene • SQLite persisted
          </span>
        </h3>

        <div className="space-y-3 pt-2">
          {scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className={`p-4 rounded-xl border transition space-y-3 ${
                scene.status === 'generating'
                  ? 'bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/20'
                  : scene.status === 'done'
                  ? 'bg-slate-950/70 border-slate-800'
                  : scene.status === 'failed'
                  ? 'bg-red-950/20 border-red-500/40'
                  : 'bg-slate-950/50 border-slate-800/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-200 font-mono text-xs font-bold flex items-center justify-center border border-slate-700">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Scene {idx + 1}</span>
                      <span className="font-mono text-[10px] text-slate-500">[{scene.id}]</span>
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {getStatusBadge(scene)}

                  <span className="text-[11px] text-slate-400 font-mono">
                    Attempt #{scene.attempt_count}
                  </span>

                  {/* Actions for this scene */}
                  {scene.status === 'failed' && (
                    <button
                      onClick={() => handleRetryScene(scene.id, '480p')}
                      disabled={retryingSceneId === scene.id}
                      className="px-2.5 py-1 rounded text-xs font-medium text-white bg-red-600 hover:bg-red-500 flex items-center gap-1 transition"
                      title="Retry only this scene at 480p"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry (480p)</span>
                    </button>
                  )}

                  {scene.status === 'done' && (
                    <button
                      onClick={() => onSelectScenePreview?.(scene)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-blue-300 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 flex items-center gap-1 transition"
                    >
                      <Film className="w-3 h-3" />
                      <span>Preview Clip</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Visual Prompt & Narration Text */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                    Visual Prompt
                  </span>
                  <p className="text-slate-300 line-clamp-2">{scene.visual_prompt}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-blue-400" />
                    Voiceover Narration ({scene.target_duration_seconds}s)
                  </span>
                  <p className="text-slate-300 italic line-clamp-2">"{scene.narration_text}"</p>
                </div>
              </div>

              {/* Error Callout (if failed or warning) */}
              {scene.last_error && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
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
          ))}
        </div>
      </div>
    </div>
  );
};
