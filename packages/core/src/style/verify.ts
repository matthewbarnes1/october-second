import type { StyleSpec } from '../ir';
import { contrast, parseColor } from '../color';
import { accentTextOn, darkColors, isDarkStyle } from './css';

export interface ContrastCheck { pair: string; ratio: number; min: number; ok: boolean }

/** WCAG checks for every foreground/background pairing the renderer can produce. */
export function verifyStyle(style: StyleSpec): ContrastCheck[] {
  const checks = verifyColors(style.colors, '');
  if (style.darkMode === 'auto' && !isDarkStyle(style)) checks.push(...verifyColors(darkColors(style), 'dark: '));
  return checks;
}

function verifyColors(c: StyleSpec['colors'], prefix: string): ContrastCheck[] {
  const pairs: [string, string, string, number][] = [
    ['text on page', c.fg, c.bg, 4.5],
    ['text on surface', c.fg, c.surface, 4.5],
    ['muted text on page', c.muted, c.bg, 4.5],
    ['muted text on surface', c.muted, c.surface, 4.5],
    ['text on inverse sections', c.inverseFg, c.inverse, 4.5],
    ['button label on accent', c.accentFg, c.accent, 4.5],
    ['accent as text on page', accentTextOn(c.accent, [c.bg, c.surface]), c.bg, 4.5],
    ['accent as text on surface', accentTextOn(c.accent, [c.bg, c.surface]), c.surface, 4.5],
    ['accent as text on inverse sections', accentTextOn(c.accent, [c.inverse]), c.inverse, 4.5],
    ['accent fill against page (buttons, marks)', c.accent, c.bg, 3],
  ];
  return pairs.map(([pair, a, b, min]) => {
    const ca = parseColor(a), cb = parseColor(b);
    const ratio = ca && cb ? +contrast(ca, cb).toFixed(2) : 0;
    return { pair: prefix + pair, ratio, min, ok: ratio >= min };
  });
}
