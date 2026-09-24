import { GoogleGenAI, Type } from '@google/genai';
import type { SplitSceneResult } from './types.ts';

// Server-side initialization per skill instructions
const apiKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function splitScriptWithGemini(
  scriptText: string,
  options?: {
    targetSceneDuration?: number;
    genreStyle?: string;
    aspectRatio?: string;
  }
): Promise<{ title: string; scenes: SplitSceneResult[] }> {
  const defaultDuration = options?.targetSceneDuration || 5.0;
  const genre = options?.genreStyle || 'Photorealistic Live-Action Epic, IMAX 70mm, Masterpiece';

  const systemInstruction = `You are an expert Hollywood video director and master AI video prompt engineer specializing in Wan 2.1 video diffusion models.
Your task is to take a raw video script or narrative text and split it into sequential, cohesive, photorealistic visual scenes.

CRITICAL MANDATORY INSTRUCTIONS FOR 'visual_prompt':
You must NEVER just copy or rephrase the narration text.
Instead, for EVERY scene, you MUST craft a rich, professional, 60-90 word diffusion prompt containing:
1. CHARACTER DETAILS: Explicitly describe the character's physical anatomy, athletic build, facial features, skin tone, clothing textures, sacred ornaments, weapons/items held, and exact body pose/flight trajectory. (e.g. for Hanuman: "Lord Hanuman, the divine Hindu warrior deity, towering muscular heroic physique, glowing golden-amber skin, wearing an ornate golden Mukut crown, celestial armlets, royal saffron silk dhoti billowing in high winds, wielding a heavy celestial golden Gada mace in right hand, soaring forward in flight").
2. BACKGROUND SETUP (BG SETUP): Explicitly describe the full environment and depth layers: landscape, terrain, ocean/sea waves with foam and spray, weather, architectural landmarks on the horizon (e.g. "vast dark-teal tumultuous ocean with crashing whitecap waves, distant island of Lanka with golden palace citadels on the horizon, dramatic golden-hour sky with volumetric god rays breaking through clouds").
3. CINEMATOGRAPHY & LIGHTING: Specify tracking camera movement, lens, volumetric lighting, and color grading (e.g. "cinematic tracking side-angle shot, IMAX 70mm, Panavision anamorphic lens, epic atmospheric depth haze").
4. STRICT NEGATIVE CONSTRAINTS: Always conclude with: "Photorealistic live-action film still, 8K, Unreal Engine 5 render, NOT cartoon, NOT comic, NOT 2D animation, NOT sketch, NOT bird caricature".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Please split this script into video scenes:\n\n"""\n${scriptText}\n"""`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Compelling title for this video',
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  scene_id: {
                    type: Type.STRING,
                    description: 'Unique scene identifier e.g. scene_1',
                  },
                  narration_text: {
                    type: Type.STRING,
                    description: 'The spoken voiceover or dialogue text for this scene',
                  },
                  visual_prompt: {
                    type: Type.STRING,
                    description: 'Detailed Wan diffusion video prompt specifying camera motion, subjects, lighting, and cinematic quality',
                  },
                  target_duration_seconds: {
                    type: Type.NUMBER,
                    description: 'Duration in seconds (e.g. 5.0)',
                  },
                },
                required: ['scene_id', 'narration_text', 'visual_prompt', 'target_duration_seconds'],
              },
            },
          },
          required: ['title', 'scenes'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
      return {
        title: parsed.title || 'Untitled Video Project',
        scenes: parsed.scenes.map((s: any, idx: number) => ({
          scene_id: s.scene_id || `scene_${idx + 1}`,
          narration_text: s.narration_text || '',
          visual_prompt: s.visual_prompt || '',
          target_duration_seconds: Number(s.target_duration_seconds) || defaultDuration,
        })),
      };
    }
  } catch (err: any) {
    console.warn('Gemini script splitting fallback invoked:', err.message);
  }

  // Graceful rule-based fallback if API is unreachable or rate limited
  const sentences = scriptText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const fallbackScenes: SplitSceneResult[] = (sentences.length > 0 ? sentences : ['Opening scene of the narrative.']).map((text, idx) => ({
    scene_id: `scene_${idx + 1}`,
    narration_text: text,
    visual_prompt: `Cinematic shot depicting: ${text}. Smooth dynamic camera movement, cinematic lighting, 8k resolution, highly detailed realism.`,
    target_duration_seconds: Math.max(4.0, Math.min(8.0, text.split(' ').length * 0.4 + 2)),
  }));

  return {
    title: 'Custom Script Project',
    scenes: fallbackScenes,
  };
}
