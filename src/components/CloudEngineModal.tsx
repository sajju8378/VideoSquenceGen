import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cpu,
  ExternalLink,
  Sparkles,
  Activity,
  Globe,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';

interface CloudEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VerificationResult {
  tested: boolean;
  valid: boolean;
  username?: string;
  fullname?: string;
  email?: string;
  type?: string;
  error?: string;
}

export const CloudEngineModal: React.FC<CloudEngineModalProps> = ({ isOpen, onClose }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [spaceInput, setSpaceInput] = useState('Lightricks/ltx-video-distilled');
  const [hasToken, setHasToken] = useState(false);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [verification, setVerification] = useState<VerificationResult>({ tested: false, valid: false });
  const [message, setMessage] = useState<string | null>(null);
  const [activeHostType, setActiveHostType] = useState<'backend' | 'static_github_pages'>('backend');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    const isGithub = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
    setActiveHostType(isGithub ? 'static_github_pages' : 'backend');

    // 1. Check local client storage
    const clientTok = apiClient.getClientToken();
    const clientSpc = apiClient.getClientSpace();
    if (clientSpc) setSpaceInput(clientSpc);

    // 2. Check server storage if available
    try {
      const cfg = await apiClient.getServerConfig();
      const tokenActive = cfg.hasHfToken || Boolean(clientTok);
      setHasToken(tokenActive);
      setTokenPreview(
        cfg.tokenPreview || (clientTok ? `${clientTok.substring(0, 4)}...${clientTok.slice(-4)}` : null)
      );
      if (cfg.hfSpace) setSpaceInput(cfg.hfSpace);

      // Auto-verify existing token if present
      if (clientTok || cfg.hasHfToken) {
        handleVerify(clientTok || undefined);
      }
    } catch {
      if (clientTok) {
        setHasToken(true);
        setTokenPreview(`${clientTok.substring(0, 4)}...${clientTok.slice(-4)}`);
        handleVerify(clientTok);
      }
    }
  };

  const handleVerify = async (candidateToken?: string) => {
    const tok = candidateToken || tokenInput.trim();
    if (!tok && !hasToken) {
      setVerification({
        tested: true,
        valid: false,
        error: 'Please paste your Hugging Face token (starts with hf_...) to test.',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await apiClient.verifyToken(tok || undefined);
      setVerification({
        tested: true,
        valid: result.valid,
        username: result.username,
        fullname: result.fullname,
        email: result.email,
        type: result.type,
        error: result.error,
      });
    } catch (err: any) {
      setVerification({
        tested: true,
        valid: false,
        error: err.message || 'Verification network error',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const tok = tokenInput.trim();
    const spc = spaceInput.trim() || 'Lightricks/ltx-video-distilled';

    try {
      // 1. Save locally for GitHub Pages support
      if (tok) {
        apiClient.setClientToken(tok);
      }
      apiClient.setClientSpace(spc);

      // 2. Save on backend if available
      try {
        await apiClient.updateServerConfig({
          hf_token: tok ? tok : undefined,
          hf_space: spc,
          default_engine: 'auto',
        });
      } catch (backendErr) {
        console.warn('Backend update notice (expected on static GitHub Pages):', backendErr);
      }

      setMessage('Configuration saved! Running verification check...');
      await handleVerify(tok || undefined);
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
                <span>Hugging Face & LTX Cloud Engine</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  activeHostType === 'static_github_pages'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {activeHostType === 'static_github_pages' ? 'GitHub Pages (Direct Mode)' : 'Full-Stack Server'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Verify your API token & check real-time connection status
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
          {/* Explanation Box on Why Static Images Occur */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Why Did My Video Look Like a Static Image Previously?</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              When visiting via <strong>GitHub Pages</strong>, there is no backend server running. Without a verified Hugging Face Token connected, the app could only generate a 2D camera-animated visualizer.
            </p>
            <p className="text-slate-300 leading-relaxed">
              To generate <strong>TRUE AI Diffusion Video</strong> (where characters, cloth, water, and camera deform in real 3D), provide your free Hugging Face token below. Once verified, the app connects directly to the <strong>LTX-Video ZeroGPU</strong> space to render real video!
            </p>
          </div>

          {/* Real-time Token Verification Inspector */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Token Connection Status</span>
              {hasToken && (
                <span className="text-[11px] font-mono text-slate-500">
                  {tokenPreview}
                </span>
              )}
            </div>

            {verification.tested ? (
              verification.valid ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/50 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Hugging Face Token Verified & Active!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-200/90 pt-1 border-t border-emerald-900/60">
                    <div>
                      <span className="text-emerald-500">Account:</span> @{verification.username}
                    </div>
                    <div>
                      <span className="text-emerald-500">Type:</span> {verification.type || 'user'}
                    </div>
                    {verification.fullname && (
                      <div className="col-span-2">
                        <span className="text-emerald-500">Name:</span> {verification.fullname}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-300/80">
                    Your token is authenticated with Hugging Face ZeroGPU. All video generations will utilize the cloud model space.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-600/50 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Token Not Working / Verification Failed</span>
                  </div>
                  <p className="text-[11px] text-rose-200">
                    {verification.error || 'Hugging Face rejected this token. Please make sure it is a valid token with Read access.'}
                  </p>
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-rose-300 underline hover:text-white"
                  >
                    <span>Create a new free Token on Hugging Face</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Activity className="w-4 h-4 text-slate-500" />
                  <span>{hasToken ? 'Token saved. Click "Test Token" to verify connection.' : 'No token configured yet.'}</span>
                </div>
                {hasToken && (
                  <button
                    type="button"
                    onClick={() => handleVerify()}
                    disabled={isVerifying}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition cursor-pointer"
                  >
                    {isVerifying ? 'Checking...' : 'Test Token'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hugging Face Access Token</span>
                </span>
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <span>Get Free Token (Read Scope)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder={hasToken ? 'Enter new token to replace existing' : 'hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={isVerifying || (!tokenInput.trim() && !hasToken)}
                  className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isVerifying && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Test</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                A free Hugging Face User Access Token connects to ZeroGPU spaces with priority queuing.
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
                <option value="Lightricks/ltx-video-distilled">Lightricks/ltx-video-distilled (Recommended: High-Speed Real Diffusion Video)</option>
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
                <span>{isSaving ? 'Saving...' : 'Save & Connect'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
