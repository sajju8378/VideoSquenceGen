import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { ScriptSplitter } from './components/ScriptSplitter.tsx';
import { QueueMonitor } from './components/QueueMonitor.tsx';
import { CinemaViewer } from './components/CinemaViewer.tsx';
import { LogsModal } from './components/LogsModal.tsx';
import { ZeroGPUExportModal } from './components/ZeroGPUExportModal.tsx';
import { LTXVideoGenerator } from './components/LTXVideoGenerator.tsx';
import { CloudEngineModal } from './components/CloudEngineModal.tsx';
import type { Job, Scene } from './types.ts';
import { apiClient } from './services/apiClient.ts';
import {
  Film,
  Layers,
  Activity,
  PlayCircle,
  FolderOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Square,
  Zap
} from 'lucide-react';

export default function App() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'ltx' | 'script' | 'queue' | 'cinema'>('ltx');

  const [selectedPreviewScene, setSelectedPreviewScene] = useState<Scene | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showCloudSettingsModal, setShowCloudSettingsModal] = useState<boolean>(false);

  // Poll active job status
  const fetchActiveJob = async () => {
    if (!activeJobId) return;
    try {
      const data = await apiClient.getJob(activeJobId);
      if (data) {
        setCurrentJob(data);
      }
    } catch (err) {
      console.error('Failed to fetch job:', err);
    }
  };

  const fetchRecentJobs = async () => {
    try {
      const data = await apiClient.getJobs();
      setRecentJobs(Array.isArray(data) ? data : []);
      if (!activeJobId && data.length > 0) {
        setActiveJobId(data[0].id);
        setCurrentJob(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch recent jobs:', err);
    }
  };

  useEffect(() => {
    fetchRecentJobs();
  }, []);

  useEffect(() => {
    if (!activeJobId) return;
    fetchActiveJob();

    // Listen to custom updates from apiClient for real-time reactivity
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ jobId?: string }>;
      if (!customEvent.detail?.jobId || customEvent.detail.jobId === activeJobId) {
        fetchActiveJob();
      }
    };
    window.addEventListener('wanscript_update', handleUpdate);

    // Poll every 1.2 seconds if processing or any scene is generating
    const isGenerating = currentJob?.status === 'processing' || currentJob?.scenes?.some(s => s.status === 'generating');
    const interval = setInterval(() => {
      if (isGenerating) {
        fetchActiveJob();
      }
    }, 1200);

    return () => {
      window.removeEventListener('wanscript_update', handleUpdate);
      clearInterval(interval);
    };
  }, [activeJobId, currentJob?.status, currentJob?.scenes]);

  const handleJobCreated = (jobId: string) => {
    setActiveJobId(jobId);
    setActiveTab('queue');
    fetchRecentJobs();
  };

  const handleSelectJob = (id: string) => {
    setActiveJobId(id);
    setSelectedPreviewScene(null);
  };

  const handleStartNewScript = () => {
    setActiveJobId(null);
    setCurrentJob(null);
    setSelectedPreviewScene(null);
    setActiveTab('script');
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Studio Bar */}
      <Header
        gpuLockActive={!!currentJob?.gpuLockActive}
        currentVramMb={currentJob?.currentVramMb || 850}
        activeJobId={activeJobId}
        onOpenLogs={() => setShowLogsModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenCloudSettings={() => setShowCloudSettingsModal(true)}
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs & Job Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('ltx')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                activeTab === 'ltx'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-1 ring-white/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>⚡ Instant LTX Video</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200">
                Direct
              </span>
            </button>

            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                activeTab === 'script'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>🎬 Storyboard & Video Sequence</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>▶ Video Sequence Queue</span>
              {currentJob?.status === 'processing' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('cinema')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                activeTab === 'cinema'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Cinema & Assembly</span>
              {currentJob?.final_video_path && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          </div>

          {/* Job Picker & Actions */}
          <div className="flex items-center gap-2">
            {recentJobs.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={activeJobId || ''}
                  onChange={e => handleSelectJob(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none max-w-[180px] truncate"
                >
                  {recentJobs.map(j => (
                    <option key={j.id} value={j.id} className="bg-slate-900 text-slate-200">
                      {j.title || j.id} ({j.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleStartNewScript}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition"
              title="Create a new script project"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Tab 0: Instant LTX Video Generator */}
        {activeTab === 'ltx' && (
          <LTXVideoGenerator onNavigateTab={tab => setActiveTab(tab)} />
        )}

        {/* Tab 1: Script & Storyboard Studio */}
        {activeTab === 'script' && (
          <ScriptSplitter onJobCreated={handleJobCreated} />
        )}

        {/* Tab 2: Queue Monitor & Resilience Lab */}
        {activeTab === 'queue' && (
          currentJob ? (
            <QueueMonitor
              job={currentJob}
              onRefreshJob={fetchActiveJob}
              onSelectScenePreview={scene => {
                setSelectedPreviewScene(scene);
                setActiveTab('cinema');
              }}
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 md:p-12 shadow-xl backdrop-blur-sm text-center max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Video Sequence Queue</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                No video sequence project is currently loaded in the queue. You can generate a new video sequence from your narrative script or storyboard.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('script')}
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-indigo-600/25 flex items-center gap-2 cursor-pointer transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>🎬 Open Video Sequence Studio</span>
                </button>
                <button
                  onClick={() => setActiveTab('ltx')}
                  className="px-5 py-3 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center gap-2 cursor-pointer transition"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>⚡ Instant LTX Single Video</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* Tab 3: Cinema Viewer & Assembly */}
        {activeTab === 'cinema' && (
          currentJob ? (
            <CinemaViewer
              job={currentJob}
              selectedPreviewScene={selectedPreviewScene}
              onClearPreviewScene={() => setSelectedPreviewScene(null)}
              onRefreshJob={fetchActiveJob}
              onSelectScenePreview={setSelectedPreviewScene}
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 md:p-12 shadow-xl backdrop-blur-sm text-center max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                <Film className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">Cinema & Assembly Studio</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Generate video scenes in the sequence queue first. Once your scene videos are ready, you can preview clips, assemble audio narration, and export the finished master film here.
              </p>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={() => setActiveTab('script')}
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 flex items-center gap-2 cursor-pointer transition"
                >
                  <Layers className="w-4 h-4" />
                  <span>🎬 Start a Video Sequence Project</span>
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Floating Status Bar for Ongoing Job */}
      {currentJob && (currentJob.gpuLockActive || currentJob.scenes?.some(s => s.status === 'generating')) && (
        <div className="fixed bottom-4 right-4 z-40 bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-sm flex items-center justify-between gap-3 ring-1 ring-blue-500/20">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Sequential Queue Active</span>
              <span className="text-slate-400 text-[11px]">
                Generating scenes under single GPU lock.
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              if (currentJob) {
                await apiClient.stopJobQueue(currentJob.id);
                fetchActiveJob();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title="Stop generation now"
          >
            <Square className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Structured GPU Logs Modal */}
      <LogsModal
        jobId={activeJobId}
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />

      {/* ZeroGPU Python Code Exporter Modal */}
      <ZeroGPUExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* Server Cloud Engine Configuration Modal */}
      <CloudEngineModal
        isOpen={showCloudSettingsModal}
        onClose={() => setShowCloudSettingsModal(false)}
      />
    </div>
  );
}
