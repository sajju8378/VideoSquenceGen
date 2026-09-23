import React, { useEffect, useState } from 'react';
import { X, RefreshCw, ScrollText, CheckCircle2, AlertTriangle, Clock, Cpu } from 'lucide-react';
import type { GPULog } from '../types.ts';
import { apiClient } from '../services/apiClient.ts';

interface LogsModalProps {
  jobId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ jobId, isOpen, onClose }) => {
  const [logs, setLogs] = useState<GPULog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    if (!jobId) return;
    setIsLoading(true);
    try {
      const data = await apiClient.getLogs(jobId);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load GPU logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && jobId) {
      fetchLogs();
    }
  }, [isOpen, jobId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>GPU Execution & Memory Hygiene Ledger</span>
                {jobId && <span className="font-mono text-xs text-slate-400 font-normal">[{jobId}]</span>}
              </h3>
              <p className="text-xs text-slate-400">
                Audits VRAM before/after calls, confirming memory release and error classifications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content / Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-sans">
              No GPU generation records found for this job yet.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => {
                const isSuccess = log.outcome === 'SUCCESS';
                const isOOM = log.outcome === 'OOM_RETRY';
                const isQuota = log.outcome === 'QUOTA_BACKOFF';

                return (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isSuccess
                        ? 'bg-slate-950/80 border-slate-800'
                        : isOOM
                        ? 'bg-amber-950/30 border-amber-600/40 text-amber-200'
                        : isQuota
                        ? 'bg-purple-950/30 border-purple-600/40 text-purple-200'
                        : 'bg-red-950/30 border-red-600/40 text-red-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isOOM
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isQuota
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {log.outcome}
                        </span>
                        <span className="text-slate-300 font-bold">{log.scene_id}</span>
                      </div>

                      <div className="text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()} ({log.duration_ms} ms)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 text-[11px]">
                      <div>
                        <span className="text-slate-500">VRAM Before: </span>
                        <strong className="text-slate-300">{(log.vram_before_mb / 1024).toFixed(2)} GB</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Peak VRAM: </span>
                        <strong className={log.vram_peak_mb > 14000 ? 'text-amber-400' : 'text-indigo-400'}>
                          {(log.vram_peak_mb / 1024).toFixed(2)} GB
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500">VRAM Cleaned After: </span>
                        <strong className="text-emerald-400">
                          {(log.vram_after_mb / 1024).toFixed(2)} GB (Hygiene OK)
                        </strong>
                      </div>
                    </div>

                    <div className="mt-2 text-slate-400 font-sans text-xs bg-slate-900/60 p-2 rounded border border-slate-800">
                      {log.details}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
