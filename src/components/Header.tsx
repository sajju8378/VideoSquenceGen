import React from 'react';
import { Film, Lock, Unlock, Cpu, Code2, ScrollText, ShieldCheck, Zap } from 'lucide-react';

interface HeaderProps {
  gpuLockActive: boolean;
  currentVramMb: number;
  activeJobId: string | null;
  onOpenLogs: () => void;
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gpuLockActive,
  currentVramMb,
  activeJobId,
  onOpenLogs,
  onOpenExport,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold ring-1 ring-white/20">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">WanScript Video Studio</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Wan 2.1 ZeroGPU
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Resilient sequential queue • OOM auto-recovery • Single GPU Lock</span>
            </p>
          </div>
        </div>

        {/* Live Engine Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* GPU Lock State */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              gpuLockActive
                ? 'bg-amber-950/40 border-amber-600/40 text-amber-300 ring-1 ring-amber-500/20'
                : 'bg-emerald-950/30 border-emerald-600/30 text-emerald-400'
            }`}
            title="Single process-wide lock guarantees scenes generate one-by-one with zero concurrency."
          >
            {gpuLockActive ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="font-semibold">GPU LOCK: BUSY</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                <span>GPU LOCK: READY</span>
              </>
            )}
          </div>

          {/* VRAM Allocation & Memory Hygiene */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 text-xs font-mono text-slate-300"
            title="Monitored VRAM: Model moved to CPU & empty_cache called in finally block after every call."
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              VRAM:{' '}
              <strong className={currentVramMb > 10000 ? 'text-amber-400' : 'text-blue-300'}>
                {(currentVramMb / 1024).toFixed(1)} GB
              </strong>{' '}
              <span className="text-slate-500">/ 16 GB</span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/60 transition shadow-sm"
              title="Inspect structured GPU before/after memory telemetry and call records"
            >
              <ScrollText className="w-3.5 h-3.5 text-indigo-400" />
              <span>GPU Logs</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition shadow-md shadow-indigo-600/20 border border-indigo-500/30"
              title="Export complete Python Gradio ZeroGPU code for Hugging Face Spaces"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>ZeroGPU Python Code</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
