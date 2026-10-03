import postcss from 'postcss';
import type { DesignSignals } from './ir';
import { extractColors, parseColor, toHex } from './color';

const TAILWIND_RE = /^(?:sm:|md:|lg:|xl:|hover:|focus:|dark:)*(?:flex|grid|p[xytblr]?-\d|m[xytblr]?-\d|text-(?:xs|sm|base|lg|xl|\dxl)|bg-|rounded|shadow|gap-|space-[xy]-|w-|h-|max-w-|font-(?:bold|semibold|medium))/;

export function emptySignals(): DesignSignals {
  return { gradients: [], fonts: [], radii: [], shadows: [], colors: [], animations: [], classNames: [], usesTailwind: false, gradientText: false, blurBlobs: 0, hoverScale: 0, fadeIn: 0 };
}

export function extractSignals(css: string, classNames: string[]): DesignSignals {
  const s = emptySignals();
  const colorSet = new Set<string>();
  let root: postcss.Root | null = null;
  try {
    root = postcss.parse(css);
  } catch {
    root = null;
  }
  root?.walkRules((rule) => {
    const hoverRule = /:hover/.test(rule.selector);
    rule.walkDecls((d) => {
      const prop = d.prop.toLowerCase();
      const val = d.value;
      if ((prop === 'background' || prop === 'background-image') && /gradient\(/i.test(val) && !/repeating-/i.test(val)) s.gradients.push(val.trim());
      if (prop === 'background-clip' || prop === '-webkit-background-clip') {
        if (/text/i.test(val)) s.gradientText = true;
      }
      if (prop === 'font-family' || /^--[\w-]*font[\w-]*$/.test(prop)) s.fonts.push(val.trim());
      if (prop === 'border-radius') {
        const px = val.match(/([\d.]+)(px|rem)/);
        if (px) s.radii.push(Math.round(parseFloat(px[1]) * (px[2] === 'rem' ? 16 : 1)));
      }
      if (prop === 'box-shadow' && val !== 'none') s.shadows.push(val.trim());
      if (prop === 'animation' || prop === 'animation-name') s.animations.push(val.trim());
      if (prop === 'filter' || prop === 'backdrop-filter') {
        const m = val.match(/blur\(([\d.]+)px\)/);
        if (m && parseFloat(m[1]) >= 40) s.blurBlobs += 1;
      }
      if (hoverRule && prop === 'transform' && /scale\(/.test(val)) s.hoverScale += 1;
      if (/^(color|background|background-color|border-color|fill|stroke)$/.test(prop)) {
        for (const c of extractColors(val)) colorSet.add(toHex(c));
      }
    });
  });
  root?.walkAtRules('keyframes', (r) => {
    if (/fade|slide|float|pulse|blob|gradient/i.test(r.params)) s.fadeIn += 1;
  });
  for (const g of s.gradients) for (const c of extractColors(g)) colorSet.add(toHex(c));
  s.colors = [...colorSet];

  s.classNames = classNames;
  const tw = classNames.filter((c) => TAILWIND_RE.test(c));
  s.usesTailwind = tw.length >= 8;
  for (const c of classNames) {
    if (/bg-clip-text|text-transparent/.test(c)) s.gradientText = true;
    if (/(^|:)(blur-(3xl|2xl)|blur-\[)/.test(c)) s.blurBlobs += 1;
    if (/hover:scale-/.test(c)) s.hoverScale += 1;
    if (/^animate-(fade|slide|bounce|pulse)|^aos|data-aos|fade-up|fade-in|animate-in/.test(c)) s.fadeIn += 1;
    const g = c.match(/^(?:from|via|to)-([a-z]+)-(\d+)$/);
    if (g) s.gradients.push(`tailwind:${c}`);
    const r = c.match(/^rounded(?:-(sm|md|lg|xl|2xl|3xl|full))?$/);
    if (r) s.radii.push({ sm: 2, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999 }[r[1] ?? 'md'] ?? 4);
    if (/^shadow(-(sm|md|lg|xl|2xl))?$/.test(c)) s.shadows.push(`tailwind:${c}`);
    if (c.startsWith('font-') && !/bold|semibold|medium|light|normal|black|extrabold|thin/.test(c)) s.fonts.push(c.replace('font-', ''));
  }
  return s;
}

/** Fonts that identify "default web look": the first family wins. */
export function primaryFont(fonts: string[]): string | null {
  for (const f of fonts) {
    const first = f.split(',')[0]?.replace(/['"]/g, '').trim();
    if (first && !/^(inherit|initial|serif|sans-serif|monospace)$/i.test(first)) return first;
  }
  return null;
}

export function colorsOf(text: string): string[] {
  return extractColors(text).map(toHex);
}

export { parseColor };
