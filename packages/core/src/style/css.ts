import type { FontSpec, StyleSpec } from '../ir';
import { contrast, ensureContrast, luminance, mix, parseColor, toHex, type RGB } from '../color';

/** The accent, adjusted until it is readable as small text on the given backgrounds (WCAG AA, 4.5:1). */
export function accentTextOn(accent: string, backgrounds: string[]): string {
  const a = parseColor(accent) ?? [0, 0, 0];
  const bgs = backgrounds.map((b) => parseColor(b)).filter((c): c is RGB => !!c);
  if (!bgs.length) return accent;
  // Adjust against the background that is hardest for this accent (closest in luminance).
  const la = luminance(a);
  const worst = bgs.reduce((w, c) => (Math.abs(luminance(c) - la) < Math.abs(luminance(w) - la) ? c : w));
  let out = ensureContrast(a, worst, 4.6);
  for (let i = 0; i < 6 && bgs.some((c) => ensureContrast(out, c, 4.5) !== out); i++) out = ensureContrast(out, bgs.find((c) => ensureContrast(out, c, 4.5) !== out)!, 4.6);
  return toHex(out);
}

/** True when the palette already is a dark theme (nothing to derive). */
export function isDarkStyle(style: StyleSpec): boolean {
  const bg = parseColor(style.colors.bg);
  return !!bg && luminance(bg) < 0.12;
}

/** A dark scheme derived from a light palette. Every pairing is contrast-corrected, then checked by verifyStyle. */
export function darkColors(style: StyleSpec): StyleSpec['colors'] {
  const c = style.colors;
  const base = parseColor(c.inverse) ?? [20, 20, 20];
  const bg: RGB = luminance(base) < 0.06 ? base : mix(base, [0, 0, 0], 0.55);
  const light = parseColor(c.inverseFg) ?? [240, 240, 240];
  const fg = ensureContrast(light, bg, 9);
  const surface = mix(bg, light, 0.07);
  const muted = ensureContrast(mix(light, bg, 0.38), surface, 4.8);
  const line = mix(bg, light, 0.22);
  const inverse = mix(bg, light, 0.12);
  const source = parseColor(c.accent) ?? [120, 160, 255];
  let accent = source;
  // Dark backgrounds need a lighter accent: raise it until it clears 4.5:1 on every dark surface it sits on.
  for (let t = 0; t <= 1 && [bg, surface, inverse].some((b) => contrast(accent, b) < 4.6); t += 0.05) accent = mix(source, [255, 255, 255], t);
  const accentFg: RGB = contrast([0, 0, 0], accent) >= contrast([255, 255, 255], accent) ? [0, 0, 0] : [255, 255, 255];
  return { bg: toHex(bg), surface: toHex(surface), fg: toHex(fg), muted: toHex(muted), accent: toHex(accent), accentFg: toHex(accentFg), line: toHex(line), inverse: toHex(inverse), inverseFg: toHex(fg) };
}

function colorVars(c: StyleSpec['colors']): string {
  return `  --m-bg: ${c.bg};
  --m-surface: ${c.surface};
  --m-fg: ${c.fg};
  --m-muted: ${c.muted};
  --m-accent: ${c.accent};
  --m-accent-fg: ${c.accentFg};
  --m-accent-text: ${accentTextOn(c.accent, [c.bg, c.surface])};
  --m-accent-text-inv: ${accentTextOn(c.accent, [c.inverse])};
  --m-line: ${c.line};
  --m-inverse: ${c.inverse};
  --m-inverse-fg: ${c.inverseFg};`;
}

function fontStack(f: FontSpec): string {
  return `'${f.family}', ${f.fallback}`;
}

export function googleFontsHref(style: StyleSpec): string | null {
  const fonts = [style.type.display, style.type.body, style.type.mono].filter((f): f is FontSpec => !!f && !!f.google);
  const byFamily = new Map<string, Set<number>>();
  for (const f of fonts) {
    const set = byFamily.get(f.family) ?? new Set<number>();
    f.weights.forEach((w) => set.add(w));
    byFamily.set(f.family, set);
  }
  if (!byFamily.size) return null;
  const parts = [...byFamily].map(([family, weights]) => `family=${family.replace(/ /g, '+')}:wght@${[...weights].sort((a, b) => a - b).join(';')}`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** Design tokens as CSS custom properties. The editor overrides these live. */
export function tokensCss(style: StyleSpec): string {
  const t = style.type;
  const steps = [-2, -1, 0, 1, 2, 3, 4, 5].map((n) => ({ n, v: +(t.base * Math.pow(t.scale, n)).toFixed(2) }));
  const sizeVars = steps.map(({ n, v }) => `  --m-step-${n < 0 ? 'm' + -n : n}: ${v / 16}rem;`).join('\n');
  const scheme = isDarkStyle(style) ? 'dark' : style.darkMode === 'auto' ? 'light dark' : 'light';
  const dark = style.darkMode === 'auto' && !isDarkStyle(style) ? `\n@media (prefers-color-scheme: dark){:root{\n${colorVars(darkColors(style))}\n}}` : '';
  return `:root {
${colorVars(style.colors)}
  --m-font-display: ${fontStack(t.display)};
  --m-font-body: ${fontStack(t.body)};
  --m-font-mono: ${t.mono ? fontStack(t.mono) : "ui-monospace, Menlo, Consolas, monospace"};
  --m-base: ${t.base / 16}rem;
  --m-heading-weight: ${t.headingWeight};
  --m-tracking: ${t.tracking};
  --m-leading: ${t.leading};
  --m-display-case: ${t.displayCase === 'uppercase' ? 'uppercase' : 'none'};
${sizeVars}
  --m-radius: ${style.shape.radius}px;
  --m-radius-btn: ${style.shape.buttonRadius}px;
  --m-border: ${style.shape.border};
  --m-border-w: ${style.shape.borderWidth}px;
  --m-shadow: ${style.shape.shadow};
  --m-unit: ${style.space.unit}px;
  --m-section-y: ${style.space.sectionY}px;
  --m-container: ${style.space.container}px;
  --m-gutter: ${style.space.gutter}px;
  color-scheme: ${scheme};
}${dark}`;
}
