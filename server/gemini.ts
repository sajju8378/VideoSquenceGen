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
    characterAnchor?: string;
  }
): Promise<{ title: string; scenes: SplitSceneResult[] }> {
  const defaultDuration = options?.targetSceneDuration || 5.0;
  const genre = options?.genreStyle || 'Photorealistic Live-Action Epic, IMAX 70mm, Masterpiece';
  const characterAnchor = options?.characterAnchor || '';

  const systemInstruction = `You are an elite Hollywood director, visual effects supervisor, and master AI prompt engineer specializing in cinematic Wan 2.1 video diffusion and image generation.
Your task is to convert a raw video script into sequential, cohesive, masterwork visual scenes with 100% CHARACTER CONSISTENCY and BREATHTAKING BACKGROUNDS.

MANDATORY RULES FOR EVERY 'visual_prompt':
1. CHARACTER CONSISTENCY ANCHOR (NEVER MORPH):
   If a character is present (especially Lord Hanuman or divine deities), you MUST anchor the EXACT same character anatomy, costume, and accessories across EVERY single scene:
   - Lord Hanuman Anchor: "Lord Hanuman, the divine Hindu warrior deity, towering muscular athletic physique with chiseled abdominal definition, glowing radiant golden-amber skin tone, sacred red vermilion Tilak on forehead, noble and fearless vanara warrior facial features, wearing an exquisite golden Mukut (crown) adorned with rubies and a peacock feather, ornate gold armlets (bajuband), kanthamala necklaces, long curving divine tail rising behind back, flowing royal vermilion-saffron silk dhoti with gold-embroidered waistband billowing in the wind, holding a massive celestial golden Gada (mace) with ancient Vedic engravings".
   ${characterAnchor ? `User Master Character Anchor to enforce: "${characterAnchor}"` : ''}

2. CINEMATIC BACKGROUND & ENVIRONMENT (MANDATORY RICH BG):
   NEVER leave the background flat, plain, or empty! Always craft an expansive, layered physical setting with foreground, midground, and background:
   - Scene on Mountain/Temple: "Standing atop a rugged weathered Himalayan mountain cliff summit. In the background: sprawling mist-shrouded mountain valleys below, ancient Vedic carved stone temples (mandirs) with tiered shikharas and warm glowing oil lamps perched on mountain ridges, golden-hour morning sunrise with radiant volumetric god rays (crepuscular rays) piercing dramatic clouds".
   - Scene Soaring in Flight: "High-altitude wide flight perspective over a vast roaring dark-teal ocean with surging whitecap waves and sea spray, distant volcanic island fortress of Lanka with soaring golden towers and burning watchfires on the horizon".
   - Scene Landing / Arrival: "Ancient coastal stone ramparts overlooking crashing ocean tides, colossal carved statues of guardians, mystical incense smoke and floating golden light embers in the dusk air".

3. CINEMATOGRAPHY, FRAMING & LIGHTING:
   Specify camera angle (e.g. "cinematic wide-angle establishing shot", "heroic low-angle tracking shot", "IMAX 70mm film still, Panavision anamorphic lens"), golden-hour rim lighting accentuating muscular contours, atmospheric depth haze, 8k hyper-realism.

4. STRICT NEGATIVE CONSTRAINTS:
   Conclude with: "Photorealistic live-action cinematic film still, 8K resolution, Unreal Engine 5 render, Octane Render masterwork, NOT flat background, NOT cropped portrait, NOT cartoon, NOT anime, NOT comic book, NOT 2D illustration, NOT bird caricature".`;

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

export async function enhancePromptWithGemini(
  promptText: string,
  options?: {
    characterAnchor?: string;
    genreStyle?: string;
    sceneContext?: string;
  }
): Promise<{ enhancedPrompt: string; backgroundDescription: string; characterDetails: string }> {
  const characterAnchor = options?.characterAnchor || '';
  const genre = options?.genreStyle || 'Photorealistic Live-Action Epic, IMAX 70mm, 8k Resolution';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Transform this raw video/image prompt into a cinema-grade visual prompt:
Raw prompt: "${promptText}"
${characterAnchor ? `Character consistency anchor: "${characterAnchor}"` : ''}
${options?.sceneContext ? `Scene narrative context: "${options.sceneContext}"` : ''}`,
      config: {
        systemInstruction: `You are an elite Hollywood director, visual effects supervisor, and prompt engineer.
Given a raw prompt, enhance it into an awe-inspiring, cinema-grade diffusion visual prompt that produces stunning 16:9 imagery like a big-budget mythological or cinematic feature film.

Your output JSON must contain:
1. "enhancedPrompt": Complete 80-120 word prompt specifying:
   - HEROIC SUBJECT & POSE: Full-body heroic stance, precise anatomy, facial expression, divine/royal regalia, weapons/props firmly held, mudras or action.
   - BREATHTAKING BACKGROUND & ENVIRONMENT: Never plain or studio-like. Specify layered landscape, mountain cliffs, mist-shrouded valleys, ancient carved stone temples (mandirs) with glowing oil lamps, stormy oceans, or cosmic horizons.
   - LIGHTING & ATMOSPHERE: Golden-hour crepuscular rays (god rays), volumetric morning mist, rim-light on muscles and ornaments, cinematic color grading.
   - CINEMATOGRAPHY & QUALITY: Wide-angle 16:9 IMAX 70mm camera, Panavision lens, 8K resolution, Unreal Engine 5 render, Octane photorealism.
   - NEGATIVE DIRECTIVES: Conclude with "NOT flat background, NOT cropped portrait, NOT cartoon, NOT 2D illustration, NOT comic, NOT caricature".
2. "backgroundDescription": Summary of the background layers and environment.
3. "characterDetails": Summary of character anatomy, clothing, and accessories.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            enhancedPrompt: { type: Type.STRING },
            backgroundDescription: { type: Type.STRING },
            characterDetails: { type: Type.STRING },
          },
          required: ['enhancedPrompt', 'backgroundDescription', 'characterDetails'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.enhancedPrompt) {
      return {
        enhancedPrompt: parsed.enhancedPrompt,
        backgroundDescription: parsed.backgroundDescription || '',
        characterDetails: parsed.characterDetails || '',
      };
    }
  } catch (err: any) {
    console.warn('Gemini prompt enhancement fallback invoked:', err.message);
  }

  // High-fidelity fallback if API fails
  const lower = promptText.toLowerCase();
  let bg = 'Standing atop a rugged weathered Himalayan mountain cliff summit, overlooking sprawling mist-shrouded valleys below, with ancient Vedic carved stone temples (mandirs) perched on mountain peaks with glowing oil lamps, radiant golden sunrise with volumetric god rays breaking through morning clouds';
  let char = 'Divine Hindu warrior deity Lord Hanuman with radiant golden-amber skin, powerful muscular heroic physique, ornate golden Mukut crown with ruby gems and peacock feather, sacred tilak on forehead, noble vanara warrior facial features, flowing royal vermilion-saffron silk dhoti, long curling divine tail, holding large golden Gada mace firmly grounded on the stone';

  return {
    enhancedPrompt: `${char}. Background environment: ${bg}. Cinematography: Cinematic wide-angle 16:9 shot, IMAX 70mm, golden-hour rim lighting, atmospheric volumetric haze, 8K resolution, Unreal Engine 5 realism, NOT flat background, NOT cropped portrait, NOT cartoon, NOT 2D, NOT caricature.`,
    backgroundDescription: bg,
    characterDetails: char,
  };
}
