import type { StyleSpec } from '../ir';
import { hslToRgb, toHex, parseColor, ensureContrast, mix, contrast, rgbToHsl } from '../color';
import { PRESETS, deepMerge, getPreset } from './presets';

/**
 * Turns a free-text brief ("quiet editorial, warm paper tones, serif headlines")
 * into a StyleSpec. Deterministic and offline: scores presets by keyword affinity
 * then applies modifiers. A language-model provider can replace `interpretBrief`
 * behind the same signature.
 */

const PRESET_KEYWORDS: Record<string, string[]> = {
  editorial: ['editorial', 'magazine', 'newspaper', 'paper', 'journal', 'literary', 'print', 'quiet', 'serif', 'essay', 'publication'],
  brutalist: ['brutalist', 'brutal', 'raw', 'harsh', 'stark', 'anti-design', 'punk', 'bold borders', 'hard shadow'],
  'warm-craft': ['warm', 'craft', 'handmade', 'artisan', 'cozy', 'earthy', 'organic', 'friendly', 'bakery', 'cafe', 'natural'],
  swiss: ['swiss', 'grid', 'helvetica', 'international', 'modernist', 'rational', 'neutral', 'typographic'],
  midnight: ['dark', 'midnight', 'developer', 'technical', 'terminal', 'hacker', 'infrastructure', 'devtool', 'night', 'code'],
  playful: ['playful', 'fun', 'colorful', 'colourful', 'pop', 'quirky', 'kids', 'cheerful', 'energetic', 'bubbly'],
  luxury: ['luxury', 'luxurious', 'premium', 'elegant', 'high-end', 'exclusive', 'fashion', 'boutique', 'upscale', 'refined'],
  corporate: ['corporate', 'enterprise', 'trust', 'bank', 'finance', 'law', 'insurance', 'professional', 'credible', 'b2b', 'conservative'],
  'retro-print': ['retro', 'vintage', 'riso', 'risograph', 'print', 'poster', '70s', '80s', 'nostalgic', 'grain'],
};

const COLOR_WORDS: Record<string, string> = {
  red: '#c8281e', crimson: '#b3122f', orange: '#d9611f', amber: '#c98a12', gold: '#b8923a', yellow: '#d9b100',
  lime: '#6a9d1c', green: '#1f7a4d', emerald: '#0f8a5f', forest: '#245c3b', teal: '#0f766e', cyan: '#0e8aa8',
  sky: '#2a8bd0', blue: '#1f55c5', navy: '#1a2f66', cobalt: '#0b4fd1', pink: '#d63d83', rose: '#cf3a5a', magenta: '#b3237a',
  terracotta: '#b9553a', rust: '#a8452a', coral: '#e8594a', mustard: '#c99b1b', olive: '#6b7430', sage: '#7d9a77', brown: '#7a4a2b',
  black: '#111111', charcoal: '#2a2d31', burgundy: '#6e1a2e',
};

function has(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z]|$)`, 'i').test(text);
}

export interface BriefResult {
  style: StyleSpec;
  basePreset: string;
  matched: string[];
  notes: string[];
}

export function interpretBrief(brief: string, fallbackPreset = 'warm-craft'): BriefResult {
  const text = brief.toLowerCase();
  const notes: string[] = [];
  const matched: string[] = [];

  const scores = Object.entries(PRESET_KEYWORDS).map(([id, words]) => {
    const hits = words.filter((w) => has(text, w));
    if (hits.length) matched.push(...hits);
    return { id, score: hits.length };
  });
  scores.sort((a, b) => b.score - a.score);
  const baseId = scores[0].score > 0 ? scores[0].id : fallbackPreset;
  if (scores[0].score === 0) notes.push(`No style keywords recognised; starting from "${fallbackPreset}".`);
  let style = structuredClone(getPreset(baseId) ?? PRESETS[0]);

  const patch: any = { colors: {}, type: {}, shape: {}, space: {}, layout: {} };

  // Light / dark
  const wantsDark = /\b(dark|night|midnight|black background|dark mode)\b/.test(text);
  const wantsLight = /\b(light|bright|airy|white|clean|paper)\b/.test(text) && !wantsDark;
  if (wantsDark && luminanceOf(style.colors.bg) > 0.4) {
    Object.assign(patch.colors, { bg: '#0e0f12', surface: '#16181d', fg: '#ecebe6', muted: '#9a9a96', line: '#2a2d33', inverse: '#ecebe6', inverseFg: '#0e0f12' });
    notes.push('Switched to a dark palette.');
  } else if (wantsLight && luminanceOf(style.colors.bg) < 0.2) {
    Object.assign(patch.colors, { bg: '#fbfaf7', surface: '#f0eee8', fg: '#1a1917', muted: '#5d5a52', line: '#dedbd2', inverse: '#1a1917', inverseFg: '#fbfaf7' });
    notes.push('Switched to a light palette.');
  }

  // Temperature
  if (/\bwarm\b/.test(text) && !wantsDark && !patch.colors.bg) {
    Object.assign(patch.colors, { bg: '#fbf6ee', surface: '#f3e8d6', line: '#e6d8c3' });
  }
  if (/\b(cool|crisp|icy|clinical)\b/.test(text) && !wantsDark) {
    Object.assign(patch.colors, { bg: '#f7f9fb', surface: '#e9eef3', line: '#d3dbe4' });
  }

  // Accent colour
  for (const [word, hex] of Object.entries(COLOR_WORDS)) {
    if (has(text, word)) {
      patch.colors.accent = hex;
      notes.push(`Accent set from "${word}".`);
      break;
    }
  }
  const explicit = brief.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/);
  if (explicit) {
    patch.colors.accent = explicit[0];
    notes.push(`Accent set to ${explicit[0]}.`);
  }

  // Typography
  if (has(text, 'serif') && !has(text, 'sans-serif') && !has(text, 'sans')) {
    patch.type.display = { family: 'Newsreader', fallback: "Georgia, serif", weights: [400, 600, 700], google: true };
  }
  if (has(text, 'sans-serif') || has(text, 'sans') || has(text, 'grotesque') || has(text, 'geometric')) {
    patch.type.display = { family: 'Instrument Sans', fallback: 'system-ui, sans-serif', weights: [500, 600, 700], google: true };
    patch.type.body = { family: 'Instrument Sans', fallback: 'system-ui, sans-serif', weights: [400, 500, 600], google: true };
  }
  if (has(text, 'mono') || has(text, 'monospace') || has(text, 'terminal')) {
    patch.type.body = { family: 'IBM Plex Mono', fallback: "ui-monospace, Menlo, monospace", weights: [400, 500], google: true };
  }
  if (/\b(huge|oversized|giant|massive|big) (type|headlines?|headings?)\b/.test(text)) patch.type.scale = 1.5;
  if (/\b(small|compact|subtle) (type|headlines?|headings?)\b/.test(text)) patch.type.scale = 1.2;
  if (/\b(uppercase|all caps|caps)\b/.test(text)) patch.type.displayCase = 'uppercase';

  // Shape
  if (/\b(sharp|square|angular|hard)\b/.test(text)) Object.assign(patch.shape, { radius: 0, buttonRadius: 0 });
  if (/\b(rounded|soft|pill|bubbly|friendly)\b/.test(text)) Object.assign(patch.shape, { radius: 16, buttonRadius: 999 });
  if (/\b(flat|no shadows?)\b/.test(text)) patch.shape.shadow = 'none';
  if (/\b(hard shadows?|offset shadows?)\b/.test(text)) patch.shape.shadow = '5px 5px 0 var(--m-line)';

  // Density
  if (/\b(dense|compact|tight|information-rich)\b/.test(text)) {
    patch.layout.density = 'tight';
    patch.space.sectionY = 64;
  }
  if (/\b(spacious|airy|generous|white ?space|breathing)\b/.test(text)) {
    patch.layout.density = 'airy';
    patch.space.sectionY = 128;
  }

  // Alignment
  if (/\b(centered|centred|symmetr)/.test(text)) patch.layout.align = 'center';
  if (/\b(asymmetric|left-aligned|ragged)\b/.test(text)) patch.layout.align = 'left';

  // Motion
  if (/\b(no animation|static|no motion)\b/.test(text)) patch.motion = 'none';
  if (/\b(animated|lively|dynamic)\b/.test(text)) patch.motion = 'subtle';

  style = deepMerge(style, patch);
  // Brief-derived colours must still be readable.
  style = fixPalette(style);
  style.id = `brief-${baseId}`;
  style.name = `Custom (${style.name})`;
  style.description = brief.trim().slice(0, 200);
  return { style, basePreset: baseId, matched: [...new Set(matched)], notes };
}

function luminanceOf(hex: string): number {
  const c = parseColor(hex);
  if (!c) return 1;
  return rgbToHsl(c)[2];
}

/** Guarantee text/accent contrast so a brief can't produce an unreadable site. */
export function fixPalette(style: StyleSpec): StyleSpec {
  const s = structuredClone(style);
  const bg = parseColor(s.colors.bg) ?? [255, 255, 255];
  const surface = parseColor(s.colors.surface) ?? bg;
  const fg = ensureContrast(parseColor(s.colors.fg) ?? [0, 0, 0], bg, 7);
  const muted = ensureContrast(parseColor(s.colors.muted) ?? fg, surface, 4.6);
  let accent = parseColor(s.colors.accent) ?? [15, 118, 110];
  // Accent is used both as text on bg and as a button fill; keep it distinguishable from bg.
  accent = ensureContrast(accent, bg, 3.2);
  const onAccent = contrast([255, 255, 255], accent) >= contrast([0, 0, 0], accent) ? [255, 255, 255] : [0, 0, 0];
  s.colors.fg = toHex(fg);
  s.colors.muted = toHex(muted);
  s.colors.accent = toHex(accent);
  s.colors.accentFg = toHex(onAccent as any);
  const inv = parseColor(s.colors.inverse) ?? [20, 20, 20];
  s.colors.inverseFg = toHex(ensureContrast(parseColor(s.colors.inverseFg) ?? [255, 255, 255], inv, 7));
  void mix; void hslToRgb;
  return s;
}
