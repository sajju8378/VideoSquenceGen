import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { ScriptSplitter } from './components/ScriptSplitter.tsx';
import { QueueMonitor } from './components/QueueMonitor.tsx';
import { CinemaViewer } from './components/CinemaViewer.tsx';
import { LogsModal } from './components/LogsModal.tsx';
import { ZeroGPUExportModal } from './components/ZeroGPUExportModal.tsx';
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
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'script' | 'queue' | 'cinema'>('script');

  const [selectedPreviewScene, setSelectedPreviewScene] = useState<Scene | null>(null);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

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

    // Poll every 1.5 seconds if processing
    const interval = setInterval(() => {
      if (currentJob?.status === 'processing') {
        fetchActiveJob();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJobId, currentJob?.status]);

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
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs & Job Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                activeTab === 'script'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. Storyboard & Script</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              disabled={!activeJobId}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                activeTab === 'queue'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : !activeJobId
                  ? 'bg-slate-900/40 text-slate-600 border-slate-900 cursor-not-allowed'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>2. Sequential Queue</span>
              {currentJob?.status === 'processing' && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('cinema')}
              disabled={!activeJobId}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                activeTab === 'cinema'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : !activeJobId
                  ? 'bg-slate-900/40 text-slate-600 border-slate-900 cursor-not-allowed'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>3. Cinema & Assembly</span>
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

        {/* Tab 1: Script & Storyboard Studio */}
        {activeTab === 'script' && (
          <ScriptSplitter onJobCreated={handleJobCreated} />
        )}

        {/* Tab 2: Queue Monitor & Resilience Lab */}
        {activeTab === 'queue' && currentJob && (
          <QueueMonitor
            job={currentJob}
            onRefreshJob={fetchActiveJob}
            onSelectScenePreview={scene => {
              setSelectedPreviewScene(scene);
              setActiveTab('cinema');
            }}
          />
        )}

        {/* Tab 3: Cinema Viewer & Assembly */}
        {activeTab === 'cinema' && currentJob && (
          <CinemaViewer
            job={currentJob}
            selectedPreviewScene={selectedPreviewScene}
            onClearPreviewScene={() => setSelectedPreviewScene(null)}
            onRefreshJob={fetchActiveJob}
            onSelectScenePreview={setSelectedPreviewScene}
          />
        )}
      </main>

      {/* Floating Status Bar for Ongoing Job */}
      {currentJob && currentJob.status === 'processing' && (
        <div className="fixed bottom-4 right-4 z-40 bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md max-w-sm flex items-center gap-3 ring-1 ring-blue-500/20">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white block">Sequential Queue Active</span>
            <span className="text-slate-400 text-[11px]">
              Generating scenes under single GPU lock. Memory is cleared after each call.
            </span>
          </div>
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
    </div>
  );
}
