export interface ScriptPreset {
  id: string;
  name: string;
  genre: string;
  aspectRatio: '16:9' | '9:16';
  durationPerScene: number;
  script: string;
}

export const SCRIPT_PRESETS: ScriptPreset[] = [
  {
    id: 'hanuman_lanka',
    name: 'Mythological Epic: Hanuman Soaring to Lanka',
    genre: 'Photorealistic Live-Action Epic, IMAX 70mm, Divine Mythological Realism',
    aspectRatio: '16:9',
    durationPerScene: 5.5,
    script: `Lord Hanuman stands in a heroic stance atop a rugged Himalayan mountain summit at sunrise, right hand in Abhaya Mudra blessing and holding his golden Gada, overlooking ancient mist-veiled temples.
Leaping fearlessly into the sky, he expands his divine form and soars across the vast tumultuous dark-teal ocean with waves crashing below.
Holding his celestial golden Gada firmly forward, his royal vermilion-saffron silk dhoti billows fiercely in high-altitude winds as sunset rays illuminate his golden skin.
The island fortress of Lanka emerges on the horizon with towering golden spires, torchlit colossal stone ramparts, and ancient citadels.`,
  },
  {
    id: 'cyberpunk_noir',
    name: 'Cyberpunk Noir: Neon Infiltration',
    genre: 'Cinematic Cyberpunk, Anamorphic lens, Blade Runner aesthetic',
    aspectRatio: '16:9',
    durationPerScene: 4.5,
    script: `Heavy acid rain falls upon the neon-saturated towers of Neo-Shinjuku at midnight.
A lone operative clad in a holographic trench coat walks down an abandoned alleyway, scanning for digital anomalies.
A flickering neon sign reveals a hidden basement doorway guarded by automated sentinel drones.
With a flash of neural override, the heavy steel blast doors slide open into the pulsating mainframe room.`,
  },
  {
    id: 'bioluminescent_abyss',
    name: 'Bioluminescent Abyss: Ocean Odyssey',
    genre: 'Ultra-HD Nature Documentary, BBC Earth aesthetic, deep-sea bioluminescence',
    aspectRatio: '16:9',
    durationPerScene: 5.0,
    script: `Two thousand meters below the Pacific Ocean surface, eternal darkness reigns supreme.
A deep-sea submersible switches on soft golden floodlights, revealing an ethereal glass sponge reef.
Suddenly, a giant siphonophore spirals into view, shimmering with emerald and sapphire rhythmic pulses.
The robotic arm gently collects a mineral sample as ancient hydrothermal vents bubble in the distance.`,
  },
  {
    id: 'vertical_reel',
    name: 'Vertical Reel: Speed of Tomorrow',
    genre: 'Fast-paced Kinetic Commercial, Hyper-realistic, 9:16 Mobile Optimized',
    aspectRatio: '9:16',
    durationPerScene: 3.5,
    script: `The engines roar to life as the futuristic electric hypercar launches down an empty mountain pass.
Close-up dynamic wheel spin with orange sparks carving through the dusk mist.
The driver engages hyper-boost, blurring the winding coastal highway into a streak of pure golden light.`,
  },
  {
    id: 'lost_temple',
    name: 'Lost Temple of the Sun',
    genre: 'Cinematic Adventure, Golden hour sunbeams, Indiana Jones realism',
    aspectRatio: '16:9',
    durationPerScene: 4.5,
    script: `An emerald jungle canopy parts to reveal towering moss-covered Mayan stone ruins.
Sunbeams pierce through the damp mist, illuminating ancient gold hieroglyphs on the altar.
A stone dial turns slowly, awakening an ancient mechanical water fountain lost for centuries.`,
  },
];
