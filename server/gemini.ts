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
  const genre = options?.genreStyle || 'Cinematic, Photorealistic';

  const systemInstruction = `You are an expert Hollywood video director and AI video prompt engineer specializing in Wan 2.1 video diffusion models.
Your task is to take a raw video script or narrative text and split it into sequential, cohesive visual scenes.
For each scene:
1. Provide a unique scene_id ('scene_1', 'scene_2', etc.)
2. Provide concise, impactful 'narration_text' for the voiceover
3. Provide a highly descriptive 'visual_prompt' optimized for video diffusion (describing camera movement, lighting, subject action, atmosphere, cinematic color grading, ${genre})
4. Provide 'target_duration_seconds' (between 3.5 and 8.0 seconds, average around ${defaultDuration} seconds).
Also generate a compelling title for the video project.`;

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
