import React, { useState } from 'react';
import { X, Copy, Check, Download, Code2, BookOpen, Layers, ShieldCheck, Terminal } from 'lucide-react';
import { getZeroGPUPythonAppCode, getZeroGPURequirementsTxt, getZeroGPUReadme } from '../../server/spaces_exporter.ts';

interface ZeroGPUExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZeroGPUExportModal: React.FC<ZeroGPUExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'app' | 'requirements' | 'readme'>('app');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appPyCode = getZeroGPUPythonAppCode();
  const reqTxtCode = getZeroGPURequirementsTxt();
  const readmeCode = getZeroGPUReadme();

  const currentContent =
    activeTab === 'app' ? appPyCode : activeTab === 'requirements' ? reqTxtCode : readmeCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Hugging Face Spaces ZeroGPU Python Package</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/20 text-blue-300">
                  Ready to Deploy
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Production-tested Python backend with GPU Lock, memory hygiene, OOM auto-recovery, and SQLite resumption.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resilience Architecture Callouts */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>GPU Lock:</strong> <code>threading.Lock()</code> prevents concurrent model instances.
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Memory Hygiene:</strong> <code>finally</code> releases VRAM to CPU + empty_cache.
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Resilient Retries:</strong> OOM auto-downgrades to 480p; quota backs off.
            </span>
          </div>
        </div>

        {/* Tabs & Actions */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('app')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'app'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              app.py (Gradio + Wan Pipeline)
            </button>
            <button
              onClick={() => setActiveTab('requirements')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'requirements'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              requirements.txt
            </button>
            <button
              onClick={() => setActiveTab('readme')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'readme'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              README.md (Deploy Guide)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <a
              href={`/api/export/${activeTab === 'app' ? 'app.py' : activeTab === 'requirements' ? 'requirements.txt' : 'README.md'}`}
              download={activeTab === 'app' ? 'app.py' : activeTab === 'requirements' ? 'requirements.txt' : 'README.md'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </a>
          </div>
        </div>

        {/* Code Viewer */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 font-mono text-xs text-slate-300 leading-relaxed">
          <pre className="whitespace-pre overflow-x-auto">
            <code>{currentContent}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
