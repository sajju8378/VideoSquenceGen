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
  AlertCircle,
  Upload,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  UserCheck,
  X,
  Eye,
  Check,
  Play
} from 'lucide-react';
import { SCRIPT_PRESETS, ScriptPreset } from '../presets.ts';
import type { SplitSceneResult, VideoGenerationMode } from '../types.ts';
import { apiClient, generateDetailedDiffusionPrompt, generateInbuiltImage } from '../services/apiClient.ts';

interface ScriptSplitterProps {
  onJobCreated: (jobId: string) => void;
}

export const ScriptSplitter: React.FC<ScriptSplitterProps> = ({ onJobCreated }) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SCRIPT_PRESETS[0].id);
  const [scriptText, setScriptText] = useState<string>(SCRIPT_PRESETS[0].script);
  const [projectTitle, setProjectTitle] = useState<string>(SCRIPT_PRESETS[0].name);
  const [genreStyle, setGenreStyle] = useState<string>(SCRIPT_PRESETS[0].genre);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(SCRIPT_PRESETS[0].aspectRatio);
  const [targetDuration, setTargetDuration] = useState<number>(5.0);
  const [resolution, setResolution] = useState<string>('720p');

  // The 3 Generation Choices requested by the user
  const [generationMode, setGenerationMode] = useState<VideoGenerationMode>('inbuilt_image');

  // Character Consistency Anchor State
  const [characterAnchor, setCharacterAnchor] = useState<{
    name: string;
    description: string;
    imageUrl: string | null;
    isGenerating: boolean;
    enforceConsistency: boolean;
  }>({
    name: 'Lord Hanuman',
    description:
      'Divine Hindu warrior deity Lord Hanuman with radiant golden-amber skin, powerful muscular physique with defined abdominal definition, ornate golden Mukut crown studded with ruby gems and peacock feather, sacred red Tilak on forehead, noble fearless vanara warrior facial features, sacred golden armlets and beaded kanthamala necklaces, long curving divine tail, flowing royal vermilion-saffron silk dhoti with gold-embroidered waistband, holding large celestial golden Gada mace firmly in hand.',
    imageUrl: null,
    isGenerating: false,
    enforceConsistency: true,
  });

  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const [scenes, setScenes] = useState<SplitSceneResult[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState<boolean>(false);

  // Per-scene image generation & prompt enhancing states
  const [generatingScenes, setGeneratingScenes] = useState<Record<number, boolean>>({});
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [enhancingSceneIndex, setEnhancingSceneIndex] = useState<number | null>(null);
  const [isEnhancingAll, setIsEnhancingAll] = useState<boolean>(false);

  const handleSelectPreset = (preset: ScriptPreset) => {
    setSelectedPresetId(preset.id);
    setScriptText(preset.script);
    setProjectTitle(preset.name);
    setGenreStyle(preset.genre);
    setAspectRatio(preset.aspectRatio);
    setTargetDuration(preset.durationPerScene);

    if (preset.id === 'hanuman_lanka') {
      setCharacterAnchor(prev => ({
        ...prev,
        name: 'Lord Hanuman',
        description:
          'Divine Hindu warrior deity Lord Hanuman with radiant golden-amber skin, powerful muscular physique with defined abdominal definition, ornate golden Mukut crown studded with ruby gems and peacock feather, sacred red Tilak on forehead, noble fearless vanara warrior facial features, sacred golden armlets and beaded kanthamala necklaces, long curving divine tail, flowing royal vermilion-saffron silk dhoti with gold-embroidered waistband, holding large celestial golden Gada mace firmly in hand.',
      }));
    }
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScriptText(val);

    const lower = val.toLowerCase();
    if (lower.includes('hanuman') || lower.includes('lanka') || lower.includes('ramayana')) {
      if (genreStyle.toLowerCase().includes('cyberpunk') || !genreStyle) {
        setGenreStyle('Photorealistic Live-Action Epic, IMAX 70mm, Divine Mythological Realism');
      }
      if (!projectTitle || projectTitle.includes('Cyberpunk')) {
        setProjectTitle('Mythological Epic: Hanuman Soaring to Lanka');
      }
    }
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
        characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
      });

      if (data.title) {
        setProjectTitle(data.title);
      }
      const initialScenes: SplitSceneResult[] = (data.scenes || []).map(s => ({
        ...s,
        image_url: undefined,
        image_source: 'none',
      }));
      setScenes(initialScenes);
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

  const handleAutoDetailPrompt = async (index: number) => {
    const scene = scenes[index];
    setEnhancingSceneIndex(index);
    try {
      const rawPrompt = scene.narration_text || scene.visual_prompt;
      const res = await apiClient.enhancePrompt(rawPrompt, {
        characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
        genreStyle,
        sceneContext: `Scene ${index + 1} of ${scenes.length}: ${scene.narration_text}`,
      });
      if (res?.enhancedPrompt) {
        handleUpdateScene(index, 'visual_prompt', res.enhancedPrompt);
      } else {
        const fallback = generateDetailedDiffusionPrompt(rawPrompt, genreStyle);
        handleUpdateScene(index, 'visual_prompt', fallback);
      }
    } catch {
      const fallback = generateDetailedDiffusionPrompt(scene.narration_text || scene.visual_prompt, genreStyle);
      handleUpdateScene(index, 'visual_prompt', fallback);
    } finally {
      setEnhancingSceneIndex(null);
    }
  };

  const handleEnhanceAllPrompts = async () => {
    if (scenes.length === 0) return;
    setIsEnhancingAll(true);
    try {
      const updatedScenes = [...scenes];
      for (let i = 0; i < updatedScenes.length; i++) {
        const s = updatedScenes[i];
        const raw = s.narration_text || s.visual_prompt;
        try {
          const res = await apiClient.enhancePrompt(raw, {
            characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
            genreStyle,
            sceneContext: `Scene ${i + 1} of ${updatedScenes.length}: ${s.narration_text}`,
          });
          if (res?.enhancedPrompt) {
            updatedScenes[i] = { ...updatedScenes[i], visual_prompt: res.enhancedPrompt };
            continue;
          }
        } catch {}
        updatedScenes[i] = {
          ...updatedScenes[i],
          visual_prompt: generateDetailedDiffusionPrompt(raw, genreStyle),
        };
      }
      setScenes(updatedScenes);
    } finally {
      setIsEnhancingAll(false);
    }
  };

  // --- Character Consistency Actions ---
  const handleLoadMasterHanumanPrompt = () => {
    const masterPrompt =
      'Divine Hindu warrior deity Lord Hanuman with radiant golden-amber skin, powerful muscular physique with defined abdominal definition, ornate golden Mukut crown studded with rubies and peacock feather, sacred red Tilak on forehead, noble fearless vanara warrior facial features, sacred golden armlets and beaded kanthamala necklaces, long curving divine tail, flowing royal vermilion-saffron silk dhoti, standing in a heroic full-body stance atop a rugged weathered Himalayan mountain cliff summit, right hand raised in divine Abhaya Mudra blessing with radiant glowing Om aura, left hand firmly resting on large golden Gada mace planted on the stone, ancient carved stone Hindu temples (mandirs) with warm glowing oil lamps and mist-veiled valleys at sunrise with volumetric god rays.';
    setCharacterAnchor(prev => ({
      ...prev,
      name: 'Lord Hanuman',
      description: masterPrompt,
    }));
  };

  const handleUploadCharacterImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCharacterAnchor(prev => ({
      ...prev,
      imageUrl: objectUrl,
    }));
  };

  const handleGenerateCharacterAnchor = async () => {
    setCharacterAnchor(prev => ({ ...prev, isGenerating: true }));
    try {
      const masterPrompt = `${characterAnchor.description}, standing in a heroic full-body stance atop a rugged weathered Himalayan mountain cliff summit, overlooking mist-shrouded valleys below, ancient carved stone Hindu temples (mandirs) with warm glowing oil lamps, right hand raised in divine Abhaya Mudra blessing with radiant golden Om aura, left hand firmly resting on large golden Gada mace planted upright on stone, radiant golden sunrise with volumetric god rays breaking through clouds, 16:9 cinematic wide shot, IMAX 70mm, 8K resolution, Unreal Engine 5 realism, NOT flat background, NOT cropped portrait, NOT cartoon, NOT anime, NOT comic, NOT 2D illustration.`;
      
      const url = await generateInbuiltImage(masterPrompt, aspectRatio);
      setCharacterAnchor(prev => ({
        ...prev,
        description: masterPrompt,
        imageUrl: url,
      }));
    } catch (err) {
      console.error('Failed to generate character anchor:', err);
    } finally {
      setCharacterAnchor(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const handleApplyCharacterAnchorToAllScenes = () => {
    if (!characterAnchor.imageUrl) return;
    setScenes(prev =>
      prev.map(s => ({
        ...s,
        image_url: characterAnchor.imageUrl || undefined,
        image_source: 'character_anchor',
      }))
    );
  };

  // --- Scene Image Handling ---
  const handleUploadSceneImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    handleUpdateScene(index, 'image_url', objectUrl);
    handleUpdateScene(index, 'image_source', 'upload');
  };

  const handleGenerateSceneImage = async (index: number) => {
    const scene = scenes[index];
    setGeneratingScenes(prev => ({ ...prev, [index]: true }));

    try {
      // If consistency is locked, inject the character anchor description
      const basePrompt = characterAnchor.enforceConsistency
        ? `${characterAnchor.description}. Scene action: ${scene.visual_prompt}`
        : scene.visual_prompt;

      // Enhance prompt with Gemini / rich background before calling image generation
      let enhancedPrompt = basePrompt;
      try {
        const enhancedRes = await apiClient.enhancePrompt(basePrompt, {
          characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
          genreStyle,
          sceneContext: `Scene ${index + 1} of ${scenes.length}: ${scene.narration_text}`,
        });
        if (enhancedRes?.enhancedPrompt) {
          enhancedPrompt = enhancedRes.enhancedPrompt;
        }
      } catch (enhanceErr) {
        console.warn('Prompt enhancement fallback:', enhanceErr);
      }

      const randomSeed = Math.floor(Math.random() * 9999999);
      const url = await generateInbuiltImage(enhancedPrompt, aspectRatio, randomSeed);
      handleUpdateScene(index, 'image_url', url);
      handleUpdateScene(index, 'image_source', 'inbuilt');
    } catch (err) {
      console.error(`Failed to generate image for scene ${index}:`, err);
    } finally {
      setGeneratingScenes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleGenerateAllSceneImages = async () => {
    if (scenes.length === 0) return;
    setIsBatchGenerating(true);

    for (let i = 0; i < scenes.length; i++) {
      setGeneratingScenes(prev => ({ ...prev, [i]: true }));
      try {
        const s = scenes[i];
        const basePrompt = characterAnchor.enforceConsistency
          ? `${characterAnchor.description}. Scene action: ${s.visual_prompt}`
          : s.visual_prompt;

        let enhancedPrompt = basePrompt;
        try {
          const enhancedRes = await apiClient.enhancePrompt(basePrompt, {
            characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
            genreStyle,
            sceneContext: `Scene ${i + 1} of ${scenes.length}: ${s.narration_text}`,
          });
          if (enhancedRes?.enhancedPrompt) {
            enhancedPrompt = enhancedRes.enhancedPrompt;
          }
        } catch {}

        const seed = Math.floor(Math.random() * 9999999) + i * 137;
        const url = await generateInbuiltImage(enhancedPrompt, aspectRatio, seed);
        handleUpdateScene(i, 'image_url', url);
        handleUpdateScene(i, 'image_source', 'inbuilt');
      } catch (err) {
        console.error(`Batch gen error on scene ${i}:`, err);
      } finally {
        setGeneratingScenes(prev => ({ ...prev, [i]: false }));
      }
    }
    setIsBatchGenerating(false);
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
        image_url: characterAnchor.imageUrl || undefined,
        image_source: characterAnchor.imageUrl ? 'character_anchor' : 'none',
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
        generationMode,
        characterAnchorImage: characterAnchor.imageUrl || null,
        characterAnchorPrompt: characterAnchor.description || null,
        simulation: {
          acceleratedSpeed: true,
        },
      });

      onJobCreated(job.id);
    } catch (err: any) {
      setSplitError(err.message || 'Failed to create job');
    } finally {
      setIsCreatingJob(false);
    }
  };

  // Direct 1-Click Generate Video Sequence: auto-splits if not split, creates job, and navigates to sequence queue
  const handleGenerateVideoSequence = async () => {
    if (!scriptText.trim()) {
      setSplitError('Please enter a script before generating video sequence.');
      return;
    }

    setSplitError(null);
    let scenesToUse = scenes;

    // If scenes are not split yet, auto-split them with Gemini first!
    if (scenesToUse.length === 0) {
      setIsSplitting(true);
      try {
        const data = await apiClient.splitScript(scriptText, {
          targetDuration,
          genreStyle,
          aspectRatio,
          characterAnchor: characterAnchor.enforceConsistency ? characterAnchor.description : undefined,
        });

        if (data.title && !projectTitle) {
          setProjectTitle(data.title);
        }
        scenesToUse = (data.scenes || []).map(s => ({
          ...s,
          image_url: characterAnchor.imageUrl || undefined,
          image_source: characterAnchor.imageUrl ? 'character_anchor' : 'none',
        }));
        setScenes(scenesToUse);
      } catch (err: any) {
        setSplitError(err.message || 'Error splitting script into scenes');
        setIsSplitting(false);
        return;
      } finally {
        setIsSplitting(false);
      }
    }

    if (scenesToUse.length === 0) {
      setSplitError('Unable to generate scenes from script. Please try editing your script text.');
      return;
    }

    setIsCreatingJob(true);
    try {
      const job = await apiClient.createJob({
        title: projectTitle || 'Untitled Project',
        script: scriptText,
        targetResolution: resolution,
        aspectRatio,
        scenes: scenesToUse,
        generationMode,
        characterAnchorImage: characterAnchor.imageUrl || null,
        characterAnchorPrompt: characterAnchor.description || null,
        simulation: {
          acceleratedSpeed: true,
        },
      });

      onJobCreated(job.id);
    } catch (err: any) {
      setSplitError(err.message || 'Failed to create video sequence job');
    } finally {
      setIsCreatingJob(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Script Configuration Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-400" />
              1. Script Input & Story Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your story script. Gemini 3.8 Flash structures it into cinematic synchronized scene beats.
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
                placeholder="e.g. Mythological Epic: Hanuman Soaring to Lanka"
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Aspect Ratio</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    aspectRatio === '16:9'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                      : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <Ratio className="w-3.5 h-3.5" />
                  <span>16:9 (Cinema)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                    aspectRatio === '9:16'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
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
              rows={3}
              value={scriptText}
              onChange={handleScriptChange}
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
              <label className="text-slate-400 font-medium mb-1 block">Output Video Resolution</label>
              <select
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/60 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="720p">720p HD (1280x720 Modern 30fps)</option>
                <option value="1080p">1080p Full HD (1920x1080 Ultra Crisp)</option>
              </select>
            </div>
          </div>

          {/* Primary Sequence & Split Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Uses Gemini 3.8 Flash structured scene breakdown</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* 1-Click Generate Video Sequence Button */}
              <button
                type="button"
                onClick={handleGenerateVideoSequence}
                disabled={isSplitting || isCreatingJob}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                title="Direct 1-Click: auto-splits into cinematic scenes and begins Video Sequence generation"
              >
                {isCreatingJob ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Starting Video Sequence...</span>
                  </>
                ) : isSplitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Splitting Script into Scenes...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white text-white" />
                    <span>🎬 Generate Video Sequence</span>
                    {scenes.length > 0 ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">
                        {scenes.length} Scenes
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20">
                        Auto-Split & Run
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Secondary Split Button for editing */}
              <button
                type="button"
                onClick={handleSplitScript}
                disabled={isSplitting || isCreatingJob}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
                title="Split script to review and customize scene prompts before generating"
              >
                {isSplitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Splitting...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Review / Edit Scenes First</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {splitError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{splitError}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. THREE-CHOICE GENERATION MODE SELECTOR */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              2. Generation Mode (Choose ONLY ONE of 3 Options)
            </h3>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              Active: {generationMode === 'prompt' ? 'Choice 1 (Prompt)' : generationMode === 'image_upload' ? 'Choice 2 (Image Input)' : 'Choice 3 (Inbuilt Studio Image)'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Select how scenes are generated: purely from text prompts, by uploading your own reference images, or by generating images with the inbuilt studio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* CHOICE 1: Prompt-Based Video */}
          <button
            type="button"
            onClick={() => setGenerationMode('prompt')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
              generationMode === 'prompt'
                ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/40 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                {generationMode === 'prompt' ? (
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-700" />
                )}
              </div>
              <h4 className="font-bold text-sm text-white mb-1">Choice 1: Prompt-Based Video</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct text-to-video generation using visual diffusion prompts with modern 8K photorealism.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-blue-300 font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Pure AI Diffusion Prompts</span>
            </div>
          </button>

          {/* CHOICE 2: Upload Custom Images */}
          <button
            type="button"
            onClick={() => setGenerationMode('image_upload')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
              generationMode === 'image_upload'
                ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/40 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Upload className="w-4 h-4" />
                </div>
                {generationMode === 'image_upload' ? (
                  <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-700" />
                )}
              </div>
              <h4 className="font-bold text-sm text-white mb-1">Choice 2: Give Image Input</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload your own images for the scenes. The video animates them with modern 3D camera drift.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-purple-300 font-medium">
              <Upload className="w-3 h-3" />
              <span>User Image Files Input</span>
            </div>
          </button>

          {/* CHOICE 3: Inbuilt Studio Image Generator */}
          <button
            type="button"
            onClick={() => setGenerationMode('inbuilt_image')}
            className={`p-4 rounded-xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
              generationMode === 'inbuilt_image'
                ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/40 opacity-75'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <ImageIcon className="w-4 h-4" />
                </div>
                {generationMode === 'inbuilt_image' ? (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-700" />
                )}
              </div>
              <h4 className="font-bold text-sm text-white mb-1">Choice 3: Inbuilt Image Generated</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate modern photorealistic keyframes first, approve or regenerate them, then proceed to video.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
              <Sparkles className="w-3 h-3" />
              <span>Generate & Approve Keyframes First</span>
            </div>
          </button>
        </div>
      </div>

      {/* 3. CHARACTER CONSISTENCY GUARANTEE CARD */}
      <div className="rounded-2xl border border-indigo-900/60 bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-900/40">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              3. Character Consistency Anchor (Guaranteed Uniformity)
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Locks the character's facial features, divine build, ornaments, and Gada across ALL scenes to prevent morphing.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 px-3 py-1.5 rounded-lg border border-indigo-800/40">
            <input
              type="checkbox"
              checked={characterAnchor.enforceConsistency}
              onChange={e =>
                setCharacterAnchor(prev => ({ ...prev, enforceConsistency: e.target.checked }))
              }
              className="accent-indigo-500 rounded cursor-pointer"
            />
            <span className="text-xs font-semibold text-indigo-300">Enforce Across All Scenes</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Character Visual Anchor Preview */}
          <div className="md:col-span-1">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-950 border border-indigo-800/50 flex flex-col items-center justify-center group shadow-md">
              {characterAnchor.imageUrl ? (
                <>
                  <img
                    src={characterAnchor.imageUrl}
                    alt={characterAnchor.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCharacterAnchor(prev => ({ ...prev, imageUrl: null }))}
                      className="p-1.5 rounded-full bg-red-600/80 hover:bg-red-500 text-white cursor-pointer"
                      title="Remove Reference Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600/90 text-white">
                    Master Anchor Active
                  </span>
                </>
              ) : (
                <div className="p-3 text-center flex flex-col items-center justify-center space-y-2">
                  <UserCheck className="w-8 h-8 text-indigo-400/70" />
                  <span className="text-[11px] text-slate-400 font-medium leading-tight">
                    No Character Anchor Image Set
                  </span>
                  <span className="text-[10px] text-slate-500">Upload or generate below</span>
                </div>
              )}
            </div>
          </div>

          {/* Character Description & Controls */}
          <div className="md:col-span-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-indigo-200 mb-1">
                Character Name & Master Description
              </label>
              <textarea
                rows={3}
                value={characterAnchor.description}
                onChange={e =>
                  setCharacterAnchor(prev => ({ ...prev, description: e.target.value }))
                }
                placeholder="Detailed description of the character's face, body build, attire, ornaments, weapons..."
                className="w-full px-3 py-2 bg-slate-950/80 border border-indigo-900/60 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Option A: Upload reference image */}
              <label className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-200 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 flex items-center gap-1.5 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload Reference Character</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCharacterImage}
                  className="hidden"
                />
              </label>

              {/* Option B: Generate reference image using Inbuilt studio */}
              <button
                type="button"
                onClick={handleGenerateCharacterAnchor}
                disabled={characterAnchor.isGenerating}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                {characterAnchor.isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Synthesizing Anchor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>AI Generate Character Anchor</span>
                  </>
                )}
              </button>

              {/* Option C: Load Master Epic Prompt */}
              <button
                type="button"
                onClick={handleLoadMasterHanumanPrompt}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/50 flex items-center gap-1.5 cursor-pointer transition"
                title="Load the high-fidelity prompt with Himalayan Mandir cliff summit and Abhaya Mudra"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Load Master Epic Prompt</span>
              </button>

              {characterAnchor.imageUrl && (
                <button
                  type="button"
                  onClick={handleApplyCharacterAnchorToAllScenes}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Apply Anchor to All Scenes</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. STRUCTURED SCENE STORYBOARD BREAKDOWN */}
      {scenes.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                4. Scene Storyboard Breakdown ({scenes.length} Scenes)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {generationMode === 'image_upload' && 'Upload images for each scene or use the master character anchor.'}
                {generationMode === 'inbuilt_image' && 'Generate & inspect keyframe images before initiating video assembly.'}
                {generationMode === 'prompt' && 'Review diffusion prompts with character anatomy and background setup.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleEnhanceAllPrompts}
                disabled={isEnhancingAll}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Automatically expand all scene prompts with character and background details using Gemini"
              >
                {isEnhancingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Gemini Enhancing Prompts...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gemini Enhance All Prompts & BG</span>
                  </>
                )}
              </button>

              {generationMode === 'inbuilt_image' && (
                <button
                  type="button"
                  onClick={handleGenerateAllSceneImages}
                  disabled={isBatchGenerating}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Generate keyframe images for all scenes at once with character consistency"
                >
                  {isBatchGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating All Keyframes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Generate All Scene Images</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={handleAddScene}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5 border border-slate-700/60 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Scene</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
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
                    {characterAnchor.enforceConsistency && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-indigo-400" />
                        <span>Anchor Locked</span>
                      </span>
                    )}
                    {scene.image_url && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Image Keyframe Attached</span>
                      </span>
                    )}
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
                      className="text-slate-500 hover:text-red-400 transition p-1 cursor-pointer"
                      title="Remove Scene"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Left Column: Image Keyframe Slot (Upload / Generated / Preview) */}
                  <div className="md:col-span-4 flex flex-col justify-between space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Scene Keyframe Visual
                    </label>

                    <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900/90 border border-slate-800 flex items-center justify-center">
                      {scene.image_url ? (
                        <>
                          <img
                            src={scene.image_url}
                            alt={`Scene ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateScene(idx, 'image_url', undefined);
                              handleUpdateScene(idx, 'image_source', 'none');
                            }}
                            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 hover:bg-red-600 text-white transition cursor-pointer"
                            title="Remove Image"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="p-3 text-center flex flex-col items-center justify-center text-slate-500">
                          <ImageIcon className="w-6 h-6 mb-1 opacity-60" />
                          <span className="text-[11px]">No image assigned</span>
                          <span className="text-[10px] text-slate-600">Will use prompt diffusion</span>
                        </div>
                      )}

                      {generatingScenes[idx] && (
                        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-amber-300">
                          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                          <span className="text-[11px] font-medium">Generating Keyframe...</span>
                        </div>
                      )}
                    </div>

                    {/* Mode-Specific Image Controls */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {/* Choice 2: Image Upload */}
                      {generationMode === 'image_upload' && (
                        <>
                          <label className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium text-purple-200 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition">
                            <Upload className="w-3 h-3 text-purple-400" />
                            <span>Upload Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleUploadSceneImage(idx, e)}
                              className="hidden"
                            />
                          </label>

                          {characterAnchor.imageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateScene(idx, 'image_url', characterAnchor.imageUrl);
                                handleUpdateScene(idx, 'image_source', 'character_anchor');
                              }}
                              className="py-1.5 px-2 rounded-lg text-[11px] font-medium text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700/40 flex items-center gap-1 cursor-pointer transition"
                              title="Use Master Character Anchor"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Use Anchor</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Choice 3: Inbuilt Studio Image */}
                      {generationMode === 'inbuilt_image' && (
                        <button
                          type="button"
                          onClick={() => handleGenerateSceneImage(idx)}
                          disabled={generatingScenes[idx]}
                          className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{scene.image_url ? 'Regenerate Keyframe' : 'Generate Keyframe Image'}</span>
                        </button>
                      )}

                      {/* Choice 1: Prompt Mode allows optional image override */}
                      {generationMode === 'prompt' && (
                        <label className="w-full py-1 px-2 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-850 border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer transition">
                          <Upload className="w-3 h-3" />
                          <span>Optional Image Override</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleUploadSceneImage(idx, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Visual Prompt & Voiceover Narration */}
                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                          Visual Prompt (Camera Movement & Background Setup)
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAutoDetailPrompt(idx)}
                          disabled={enhancingSceneIndex === idx}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition cursor-pointer disabled:opacity-50"
                          title="Expand with character anatomy, costume, background setup & photorealism with Gemini"
                        >
                          {enhancingSceneIndex === idx ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                              <span>Gemini Enhancing...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              <span>Gemini Enhance Prompt & BG</span>
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={scene.visual_prompt}
                        onChange={e => handleUpdateScene(idx, 'visual_prompt', e.target.value)}
                        placeholder="Detailed visual prompt describing character action, background setup, lighting..."
                        className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500/70 font-sans leading-relaxed text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Voiceover Narration (Spoken Dialogue)
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={scene.narration_text}
                        onChange={e => handleUpdateScene(idx, 'narration_text', e.target.value)}
                        placeholder="Spoken voiceover or dialogue line..."
                        className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500 font-sans leading-relaxed text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Job CTA */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Total estimated duration: ~
              <strong className="text-blue-300">
                {scenes.reduce((acc, s) => acc + (s.target_duration_seconds || 5), 0).toFixed(1)}s
              </strong>{' '}
              across {scenes.length} sequential scenes with modern cinematic camera motion.
            </p>

            <button
              onClick={handleCreateJob}
              disabled={isCreatingJob}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:via-teal-500 hover:to-blue-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              {isCreatingJob ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Initializing Video Sequence Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>🎬 Generate Video Sequence ({scenes.length} Scenes)</span>
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
