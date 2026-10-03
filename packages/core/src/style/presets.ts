import type { FontSpec, StyleSpec } from '../ir';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends any[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch as any)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null) {
      out[k] = deepMerge(out[k], v as any);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

const serif = (family: string, weights = [400, 600, 700]): FontSpec => ({ family, fallback: "Georgia, 'Times New Roman', serif", weights, google: true });
const sans = (family: string, weights = [400, 500, 600, 700]): FontSpec => ({ family, fallback: "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif", weights, google: true });
const mono = (family: string, weights = [400, 500, 700]): FontSpec => ({ family, fallback: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace", weights, google: true });

const BASE: StyleSpec = {
  id: 'base',
  name: 'Base',
  description: 'Neutral baseline used as the starting point for presets and briefs.',
  colors: { bg: '#ffffff', surface: '#f5f5f4', fg: '#1c1917', muted: '#57534e', accent: '#0f766e', accentFg: '#ffffff', line: '#e7e5e4', inverse: '#1c1917', inverseFg: '#fafaf9' },
  type: { display: sans('Manrope'), body: sans('Public Sans'), scale: 1.25, base: 17, headingWeight: 700, tracking: '-0.01em', leading: 1.6, displayCase: 'none' },
  shape: { radius: 6, border: '1px solid var(--m-line)', shadow: 'none', buttonRadius: 6, borderWidth: 1 },
  space: { unit: 8, sectionY: 96, container: 1120, gutter: 24 },
  layout: { align: 'left', density: 'comfortable', rhythm: 'alternating', heroPreference: ['hero-split', 'hero-editorial'], featurePreference: ['features-alternating', 'features-indexed'] },
  motion: 'minimal',
  imagery: 'natural',
};

function make(patch: DeepPartial<StyleSpec> & { id: string; name: string; description: string }): StyleSpec {
  return deepMerge(BASE, patch as any);
}

export const PRESETS: StyleSpec[] = [
  make({
    id: 'editorial',
    name: 'Editorial',
    description: 'Quiet and typographic, warm paper tones, print-inspired. Large serif headlines, left-aligned, generous margins.',
    colors: { bg: '#f6f1e7', surface: '#ede5d3', fg: '#1d1b17', muted: '#6b655a', accent: '#9a3b1f', accentFg: '#fffaf0', line: '#d9d1bf', inverse: '#1d1b17', inverseFg: '#f6f1e7' },
    type: { display: serif('Fraunces', [400, 600, 800]), body: serif('Source Serif 4', [400, 600]), scale: 1.333, base: 18, headingWeight: 600, tracking: '-0.02em', leading: 1.65 },
    shape: { radius: 0, shadow: 'none', buttonRadius: 0 },
    space: { sectionY: 112, container: 1080 },
    layout: { align: 'left', density: 'airy', rhythm: 'varied', heroPreference: ['hero-editorial', 'hero-statement'], featurePreference: ['features-indexed', 'features-alternating'] },
    motion: 'minimal',
    imagery: 'natural',
  }),
  make({
    id: 'brutalist',
    name: 'Brutalist',
    description: 'Raw and high-contrast. Heavy borders, hard offset shadows, mono type, visible grid.',
    colors: { bg: '#ffffff', surface: '#f2f2f2', fg: '#000000', muted: '#3d3d3d', accent: '#ff3b00', accentFg: '#000000', line: '#000000', inverse: '#000000', inverseFg: '#ffffff' },
    type: { display: sans('Space Grotesk', [500, 700]), body: mono('IBM Plex Mono'), scale: 1.5, base: 16, headingWeight: 700, tracking: '-0.03em', leading: 1.5, displayCase: 'uppercase' },
    shape: { radius: 0, border: '2px solid #000', shadow: '6px 6px 0 #000', buttonRadius: 0, borderWidth: 2 },
    space: { sectionY: 72, container: 1200, gutter: 20 },
    layout: { align: 'left', density: 'tight', rhythm: 'varied', heroPreference: ['hero-statement', 'hero-split'], featurePreference: ['features-bento', 'features-indexed'] },
    motion: 'none',
    imagery: 'bordered',
  }),
  make({
    id: 'warm-craft',
    name: 'Warm Craft',
    description: 'Earthy and tactile with soft organic shapes. Hand-made, friendly, human.',
    colors: { bg: '#fbf6ee', surface: '#f3e8d6', fg: '#2b2118', muted: '#76654f', accent: '#a94f1f', accentFg: '#fffaf3', line: '#e6d8c3', inverse: '#2b2118', inverseFg: '#fbf6ee' },
    type: { display: serif('DM Serif Display', [400]), body: sans('DM Sans', [400, 500, 700]), scale: 1.25, base: 17, headingWeight: 400, tracking: '-0.01em', leading: 1.65 },
    shape: { radius: 14, shadow: '0 1px 0 rgba(43,33,24,.08)', buttonRadius: 999 },
    space: { sectionY: 96, container: 1100 },
    layout: { align: 'left', density: 'comfortable', rhythm: 'alternating', heroPreference: ['hero-split', 'hero-editorial'], featurePreference: ['features-alternating', 'features-grid'] },
    motion: 'subtle',
    imagery: 'grain',
  }),
  make({
    id: 'swiss',
    name: 'Swiss',
    description: 'International typographic style. Strict grid, neutral grotesque, red accent, asymmetry and white space.',
    colors: { bg: '#fafafa', surface: '#eeeeee', fg: '#111111', muted: '#5f5f5f', accent: '#e30613', accentFg: '#ffffff', line: '#d4d4d4', inverse: '#111111', inverseFg: '#fafafa' },
    type: { display: sans('Inter Tight', [500, 700, 800]), body: sans('Inter', [400, 500]), scale: 1.414, base: 16, headingWeight: 700, tracking: '-0.035em', leading: 1.55 },
    shape: { radius: 0, shadow: 'none', buttonRadius: 0 },
    space: { sectionY: 104, container: 1240, gutter: 28 },
    layout: { align: 'left', density: 'airy', rhythm: 'uniform', heroPreference: ['hero-statement', 'hero-editorial'], featurePreference: ['features-indexed', 'features-bento'] },
    motion: 'none',
    imagery: 'natural',
  }),
  make({
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark, technical and calm. Deep slate surfaces, mono details, a single acid-green accent. Built for developer and infrastructure products.',
    colors: { bg: '#0d1117', surface: '#151b23', fg: '#e6edf3', muted: '#8b98a8', accent: '#7ee787', accentFg: '#06210d', line: '#263040', inverse: '#e6edf3', inverseFg: '#0d1117' },
    type: { display: sans('Geist', [500, 600, 700]), body: sans('Geist', [400, 500]), mono: mono('JetBrains Mono'), scale: 1.25, base: 16, headingWeight: 600, tracking: '-0.025em', leading: 1.6 },
    shape: { radius: 4, border: '1px solid var(--m-line)', shadow: 'none', buttonRadius: 4 },
    space: { sectionY: 88, container: 1160 },
    layout: { align: 'left', density: 'comfortable', rhythm: 'uniform', heroPreference: ['hero-split', 'hero-proof-first'], featurePreference: ['features-bento', 'features-alternating'] },
    motion: 'subtle',
    imagery: 'bordered',
  }),
  make({
    id: 'playful',
    name: 'Playful Pop',
    description: 'Bold flat colour, chunky rounded shapes, friendly display type. Energetic and approachable.',
    colors: { bg: '#fff8e7', surface: '#ffe9a8', fg: '#1a1a2e', muted: '#4b4b63', accent: '#cc3512', accentFg: '#ffffff', line: '#1a1a2e', inverse: '#1a1a2e', inverseFg: '#fff8e7' },
    type: { display: sans('Bricolage Grotesque', [600, 800]), body: sans('Figtree', [400, 500, 700]), scale: 1.333, base: 17, headingWeight: 800, tracking: '-0.02em', leading: 1.55 },
    shape: { radius: 20, border: '2px solid var(--m-line)', shadow: '4px 4px 0 var(--m-line)', buttonRadius: 999, borderWidth: 2 },
    space: { sectionY: 88, container: 1120 },
    layout: { align: 'left', density: 'comfortable', rhythm: 'varied', heroPreference: ['hero-split', 'hero-statement'], featurePreference: ['features-bento', 'features-grid'] },
    motion: 'subtle',
    imagery: 'bordered',
  }),
  make({
    id: 'luxury',
    name: 'Luxury Minimal',
    description: 'Restrained and expensive-feeling. Hairline rules, wide tracking, deep neutrals, one muted gold accent.',
    colors: { bg: '#0f0e0c', surface: '#171512', fg: '#efe9dd', muted: '#a39a89', accent: '#c8a45c', accentFg: '#17130a', line: '#2c2820', inverse: '#efe9dd', inverseFg: '#0f0e0c' },
    type: { display: serif('Cormorant Garamond', [400, 500, 600]), body: sans('Jost', [300, 400, 500]), scale: 1.333, base: 17, headingWeight: 500, tracking: '0.01em', leading: 1.7 },
    shape: { radius: 0, border: '1px solid var(--m-line)', shadow: 'none', buttonRadius: 0, borderWidth: 1 },
    space: { sectionY: 128, container: 1100 },
    layout: { align: 'left', density: 'airy', rhythm: 'uniform', heroPreference: ['hero-statement', 'hero-editorial'], featurePreference: ['features-indexed', 'features-alternating'] },
    motion: 'minimal',
    imagery: 'duotone',
  }),
  make({
    id: 'corporate',
    name: 'Corporate Trust',
    description: 'Clear, credible and conventional-but-considered. Deep navy, structured grid, plain language layouts.',
    colors: { bg: '#ffffff', surface: '#f1f4f8', fg: '#0f1b2d', muted: '#4c5b70', accent: '#0b5fa5', accentFg: '#ffffff', line: '#d7dee8', inverse: '#0f1b2d', inverseFg: '#f1f4f8' },
    type: { display: sans('Source Sans 3', [600, 700]), body: sans('Source Sans 3', [400, 600]), scale: 1.2, base: 17, headingWeight: 700, tracking: '-0.005em', leading: 1.6 },
    shape: { radius: 4, shadow: '0 1px 2px rgba(15,27,45,.08)', buttonRadius: 4 },
    space: { sectionY: 88, container: 1160 },
    layout: { align: 'left', density: 'comfortable', rhythm: 'alternating', heroPreference: ['hero-split', 'hero-proof-first'], featurePreference: ['features-alternating', 'features-grid'] },
    motion: 'minimal',
    imagery: 'natural',
  }),
  make({
    id: 'retro-print',
    name: 'Retro Print',
    description: 'Risograph-inspired. Two-ink palette, grain, condensed display type, offset print feel.',
    colors: { bg: '#f4ecd8', surface: '#e8dcc0', fg: '#22313f', muted: '#44525f', accent: '#bb3a20', accentFg: '#f4ecd8', line: '#22313f', inverse: '#22313f', inverseFg: '#f4ecd8' },
    type: { display: sans('Anton', [400]), body: serif('Libre Baskerville', [400, 700]), scale: 1.414, base: 17, headingWeight: 400, tracking: '0.01em', leading: 1.65, displayCase: 'uppercase' },
    shape: { radius: 2, border: '2px solid var(--m-line)', shadow: '5px 5px 0 var(--m-accent)', buttonRadius: 2, borderWidth: 2 },
    space: { sectionY: 88, container: 1100 },
    layout: { align: 'left', density: 'comfortable', rhythm: 'varied', heroPreference: ['hero-statement', 'hero-editorial'], featurePreference: ['features-bento', 'features-indexed'] },
    motion: 'minimal',
    imagery: 'duotone',
  }),
];

export function listPresets(): StyleSpec[] {
  return PRESETS;
}

export function getPreset(id: string): StyleSpec | undefined {
  return PRESETS.find((p) => p.id === id);
}

export { BASE as BASE_STYLE };
export type { DeepPartial };
