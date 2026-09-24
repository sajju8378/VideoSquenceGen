import React, { useState, useEffect } from 'react';
import { X, Server, Key, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Cpu, ExternalLink, Sparkles } from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';

interface CloudEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudEngineModal: React.FC<CloudEngineModalProps> = ({ isOpen, onClose }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [spaceInput, setSpaceInput] = useState('Lightricks/ltx-video-distilled');
  const [hasToken, setHasToken] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await apiClient.getServerConfig();
      setHasToken(cfg.hasHfToken);
      setTokenPreview(cfg.tokenPreview);
      if (cfg.hfSpace) setSpaceInput(cfg.hfSpace);
      setStatus(cfg.status || 'online');
    } catch {
      setStatus('fallback_ready');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await apiClient.updateServerConfig({
        hf_token: tokenInput.trim() ? tokenInput.trim() : undefined,
        hf_space: spaceInput.trim() || 'Lightricks/ltx-video-distilled',
        default_engine: 'auto',
      });
      setMessage('Server Cloud GPU configuration saved successfully!');
      setTokenInput('');
      await loadConfig();
    } catch (err: any) {
      setMessage(`Error: ${err.message || 'Failed to save configuration'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Cloud Video Engine Settings</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Zero End-User Friction
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Server-side Hugging Face & LTX GPU Bridge
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Notice Card */}
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>How Token Security & Privacy Works</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Tokens entered here are stored <strong>privately on the backend server</strong>. Your visitors and end-users <strong>never see or need any token</strong>. They just visit your site, enter a prompt, and get instant moving video clips like LTX Studio.
            </p>
          </div>

          {/* Current Status */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${hasToken ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-amber-500 ring-4 ring-amber-500/20'}`} />
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {hasToken ? 'Hugging Face Token Configured' : 'Using Accelerated Fallback Engine'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {hasToken ? `Token: ${tokenPreview}` : 'Free high-motion video generation ready out-of-the-box'}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-indigo-300 font-mono">
                {spaceInput.split('/')[1] || 'LTX-Video'}
              </span>
            </div>
          </div>

          {/* Configuration Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hugging Face Access Token (Optional)</span>
                </span>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <span>Get Free Token</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={hasToken ? 'Enter new token to replace existing' : 'hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                A free read token from Hugging Face unlocks higher throughput on ZeroGPU spaces.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>Target Video Model Space</span>
              </label>
              <select
                value={spaceInput}
                onChange={e => setSpaceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Lightricks/ltx-video-distilled">Lightricks/ltx-video-distilled (Fastest LTX Real-Time Video)</option>
                <option value="zerogpu-aoti/Wan2.1-14B">zerogpu-aoti/Wan2.1-14B (Wan 2.1 14B High-Fidelity)</option>
                <option value="Wan-AI/Wan2.1">Wan-AI/Wan2.1 (Official Wan 2.1 Foundation)</option>
              </select>
            </div>

            {message && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${message.startsWith('Error') ? 'bg-red-950/40 border border-red-800 text-red-300' : 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'}`}>
                {message.startsWith('Error') ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
