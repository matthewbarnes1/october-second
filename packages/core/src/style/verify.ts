import type { StyleSpec } from '../ir';
import { contrast, parseColor } from '../color';

export interface ContrastCheck { pair: string; ratio: number; min: number; ok: boolean }

/** WCAG checks for every foreground/background pairing the renderer can produce. */
export function verifyStyle(style: StyleSpec): ContrastCheck[] {
  const c = style.colors;
  const pairs: [string, string, string, number][] = [
    ['text on page', c.fg, c.bg, 4.5],
    ['text on surface', c.fg, c.surface, 4.5],
    ['muted text on page', c.muted, c.bg, 4.5],
    ['muted text on surface', c.muted, c.surface, 4.5],
    ['text on inverse sections', c.inverseFg, c.inverse, 4.5],
    ['button label on accent', c.accentFg, c.accent, 4.5],
    ['accent on page (links, marks)', c.accent, c.bg, 3],
  ];
  return pairs.map(([pair, a, b, min]) => {
    const ca = parseColor(a), cb = parseColor(b);
    const ratio = ca && cb ? +contrast(ca, cb).toFixed(2) : 0;
    return { pair, ratio, min, ok: ratio >= min };
  });
}
