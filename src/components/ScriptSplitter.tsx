import React, { useState } from 'react';
import {
  Wand2,
  Sparkles,
  Layers,
  Clock,
  Ratio,
  Plus,
  Trash2,
  RefreshCw,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SCRIPT_PRESETS, ScriptPreset } from '../presets.ts';
import type { SplitSceneResult } from '../types.ts';
import { apiClient } from '../services/apiClient.ts';

interface ScriptSplitterProps {
  onJobCreated: (jobId: string) => void;
}

export const ScriptSplitter: React.FC<ScriptSplitterProps> = ({ onJobCreated }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SCRIPT_PRESETS[0].id);
  const [scriptText, setScriptText] = useState<string>(SCRIPT_PRESETS[0].script);
  const [projectTitle, setProjectTitle] = useState<string>('Cyberpunk Noir: Neon Infiltration');
  const [genreStyle, setGenreStyle] = useState<string>(SCRIPT_PRESETS[0].genre);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(SCRIPT_PRESETS[0].aspectRatio);
  const [targetDuration, setTargetDuration] = useState<number>(4.5);
  const [resolution, setResolution] = useState<string>('720p');

  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [scenes, setScenes] = useState<SplitSceneResult[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState<boolean>(false);

  const handleSelectPreset = (preset: ScriptPreset) => {
    setSelectedPresetId(preset.id);
    setScriptText(preset.script);
    setProjectTitle(preset.name);
    setGenreStyle(preset.genre);
    setAspectRatio(preset.aspectRatio);
    setTargetDuration(preset.durationPerScene);
  };

  const handleSplitScript = async () => {
    if (!scriptText.trim()) {
      setSplitError('Please enter a script before splitting.');
      return;
    }
    setIsSplitting(true);
    setSplitError(null);

    try {
      const data = await apiClient.splitScript(scriptText, {
        targetDuration,
        genreStyle,
        aspectRatio,
      });

      if (data.title && !projectTitle) {
        setProjectTitle(data.title);
      }
      setScenes(data.scenes || []);
    } catch (err: any) {
      setSplitError(err.message || 'Error communicating with splitting worker');
    } finally {
      setIsSplitting(false);
    }
  };

  const handleUpdateScene = (index: number, field: keyof SplitSceneResult, value: any) => {
    setScenes(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddScene = () => {
    const newIdx = scenes.length + 1;
    setScenes(prev => [
      ...prev,
      {
        scene_id: `scene_${newIdx}`,
        narration_text: 'Voiceover narration for this moment.',
        visual_prompt: 'Cinematic wide camera shot, dramatic volumetric lighting, highly detailed 8k.',
        target_duration_seconds: targetDuration,
      },
    ]);
  };

  const handleRemoveScene = (index: number) => {
    setScenes(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateJob = async () => {
    if (scenes.length === 0) {
      setSplitError('Please split your script into scenes before creating a generation job.');
      return;
    }

    setIsCreatingJob(true);
    setSplitError(null);

    try {
      const job = await apiClient.createJob({
        title: projectTitle || 'Untitled Project',
        script: scriptText,
        targetResolution: resolution,
        aspectRatio,
        scenes,
        simulation: {
          acceleratedSpeed: true, // Default accelerated ffmpeg generation for snappy testing
        },
      });

      onJobCreated(job.id);
    } catch (err: any) {
      setSplitError(err.message || 'Failed to create job');
    } finally {
      setIsCreatingJob(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Script Configuration Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-400" />
              1. Script Input & Scene Breakdown
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your narrative text. Gemini 3.8 Flash will structure it into synchronized Wan 2.1 video scenes.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium mr-1">Presets:</span>
            {SCRIPT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`px-2.5 py-1 text-xs rounded-md transition border ${
                  selectedPresetId === preset.id
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 font-medium'
                    : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {preset.name.split(':')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Project Title and Script Area */}
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Project Title</label>
              <input
                type="text"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                placeholder="e.g. Cyberpunk Noir"
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                    aspectRatio === '16:9'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Ratio className="w-3.5 h-3.5" />
                  <span>16:9 (Landscape)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition ${
                    aspectRatio === '9:16'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Ratio className="w-3.5 h-3.5" />
                  <span>9:16 (Vertical)</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">Raw Narrative Script</label>
              <span className="text-xs text-slate-500 font-mono">
                {scriptText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={4}
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              placeholder="Paste your script or narration sentences here..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
            />
          </div>

          {/* Model & Generation Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs">
            <div>
              <label className="text-slate-400 font-medium mb-1 block flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                Target Scene Duration: <span className="text-blue-300 font-mono font-bold">{targetDuration}s</span>
              </label>
              <input
                type="range"
                min="3.0"
                max="8.0"
                step="0.5"
                value={targetDuration}
                onChange={e => setTargetDuration(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">ZeroGPU lease-safe: 3s - 8s per clip</span>
            </div>

            <div>
              <label className="text-slate-400 font-medium mb-1 block">Visual Genre & Aesthetic</label>
              <input
                type="text"
                value={genreStyle}
                onChange={e => setGenreStyle(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/60 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 font-medium mb-1 block">Default Resolution</label>
              <select
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/60 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="720p">720p HD (Wan 2.1 Standard)</option>
                <option value="480p">480p SD (High Reliability / Low VRAM)</option>
              </select>
            </div>
          </div>

          {/* Split Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Uses Gemini 3.8 Flash with structured JSON output</span>
            </div>

            <button
              type="button"
              onClick={handleSplitScript}
              disabled={isSplitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              {isSplitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Splitting with Gemini 3.8 Flash...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Split Script into Scenes</span>
                </>
              )}
            </button>
          </div>

          {splitError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{splitError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Structured Scenes List (if split) */}
      {scenes.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                2. Scene Storyboard Breakdown ({scenes.length} Scenes)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and refine visual diffusion prompts and voiceover narration before queuing.
              </p>
            </div>

            <button
              onClick={handleAddScene}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 border border-slate-700/60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Scene</span>
            </button>
          </div>

          <div className="space-y-3.5">
            {scenes.map((scene, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 transition space-y-3 group"
              >
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 font-mono text-[11px] font-bold flex items-center justify-center border border-blue-500/30">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">Scene {idx + 1}</span>
                    <span className="font-mono text-[11px] text-slate-500">ID: {scene.scene_id}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="number"
                        min="2"
                        max="12"
                        step="0.5"
                        value={scene.target_duration_seconds}
                        onChange={e =>
                          handleUpdateScene(idx, 'target_duration_seconds', parseFloat(e.target.value) || 5.0)
                        }
                        className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-center text-xs text-blue-300 font-bold focus:outline-none"
                      />
                      <span>sec</span>
                    </div>

                    <button
                      onClick={() => handleRemoveScene(idx)}
                      className="text-slate-500 hover:text-red-400 transition p-1"
                      title="Remove Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Visual Diffusion Prompt (Wan 2.1)
                    </label>
                    <textarea
                      rows={2}
                      value={scene.visual_prompt}
                      onChange={e => handleUpdateScene(idx, 'visual_prompt', e.target.value)}
                      placeholder="Detailed visual prompt describing camera movement, subject, lighting..."
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Voiceover Narration (TTS Audio)
                    </label>
                    <textarea
                      rows={2}
                      value={scene.narration_text}
                      onChange={e => handleUpdateScene(idx, 'narration_text', e.target.value)}
                      placeholder="Spoken voiceover or dialogue line..."
                      className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Job CTA */}
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Total estimated duration: ~
              <strong className="text-blue-300">
                {scenes.reduce((acc, s) => acc + (s.target_duration_seconds || 5), 0).toFixed(1)}s
              </strong>{' '}
              across {scenes.length} sequential GPU generation jobs.
            </p>

            <button
              onClick={handleCreateJob}
              disabled={isCreatingJob}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              {isCreatingJob ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Configuring Resilient Pipeline...</span>
                </>
              ) : (
                <>
                  <span>Initialize Video Job & Queue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
