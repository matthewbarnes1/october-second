import type { FontSpec, StyleSpec } from '../ir';
import { parseColor, toHex } from '../color';
import { BASE_STYLE } from './presets';

/**
 * Style values end up inside generated CSS and Google Fonts URLs, and they can come from
 * a free-text brief, an editor request or a saved plan. Nothing reaches the stylesheet
 * without passing through here, so a hostile value can't break out of a declaration.
 */

const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,59}$/;
const STACK = /^[A-Za-z0-9 ,'"\-]{1,200}$/;
const CSS_VALUE = /^[A-Za-z0-9 #%.,()+\-/*]{0,120}$/;
const FORBIDDEN = /url\(|expression\(|@import|javascript:|[;{}\\<>]/i;

const clamp = (v: unknown, lo: number, hi: number, fb: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb;
};
const color = (v: unknown, fb: string): string => {
  const c = typeof v === 'string' ? parseColor(v) : null;
  return c ? toHex(c) : fb;
};
const css = (v: unknown, fb: string): string => (typeof v === 'string' && CSS_VALUE.test(v) && !FORBIDDEN.test(v) ? v : fb);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);

function font(v: FontSpec | undefined, fb: FontSpec | undefined): FontSpec | undefined {
  if (!v) return fb;
  const family = typeof v.family === 'string' && FAMILY.test(v.family) ? v.family : fb?.family;
  if (!family) return fb;
  const stack = typeof v.fallback === 'string' && STACK.test(v.fallback) && !FORBIDDEN.test(v.fallback) ? v.fallback : (fb?.fallback ?? 'system-ui, sans-serif');
  const weights = Array.isArray(v.weights) ? v.weights.map((w) => Math.round(clamp(w, 100, 900, 400))).filter((w, i, a) => a.indexOf(w) === i).slice(0, 8) : (fb?.weights ?? [400, 700]);
  return { family, fallback: stack, weights: weights.length ? weights : [400], google: v.google !== false };
}

export function sanitizeStyle(input: StyleSpec, fallback: StyleSpec = BASE_STYLE): StyleSpec {
  const s = structuredClone(input);
  const f = fallback;
  const c = s.colors ?? ({} as StyleSpec['colors']);
  s.colors = {
    bg: color(c.bg, f.colors.bg), surface: color(c.surface, f.colors.surface), fg: color(c.fg, f.colors.fg), muted: color(c.muted, f.colors.muted),
    accent: color(c.accent, f.colors.accent), accentFg: color(c.accentFg, f.colors.accentFg), line: color(c.line, f.colors.line),
    inverse: color(c.inverse, f.colors.inverse), inverseFg: color(c.inverseFg, f.colors.inverseFg),
  };
  const t = s.type ?? ({} as StyleSpec['type']);
  s.type = {
    display: font(t.display, f.type.display)!, body: font(t.body, f.type.body)!, mono: font(t.mono, f.type.mono),
    scale: clamp(t.scale, 1.05, 1.8, f.type.scale), base: clamp(t.base, 14, 22, f.type.base),
    headingWeight: Math.round(clamp(t.headingWeight, 100, 900, f.type.headingWeight)),
    tracking: css(t.tracking, f.type.tracking), leading: clamp(t.leading, 1.1, 2, f.type.leading),
    displayCase: oneOf(t.displayCase, ['none', 'uppercase'] as const, 'none'), italicAccents: !!t.italicAccents,
  };
  const sh = s.shape ?? ({} as StyleSpec['shape']);
  s.shape = {
    radius: clamp(sh.radius, 0, 64, f.shape.radius), buttonRadius: clamp(sh.buttonRadius, 0, 999, f.shape.buttonRadius),
    border: css(sh.border, f.shape.border), shadow: css(sh.shadow, f.shape.shadow), borderWidth: clamp(sh.borderWidth, 0, 6, f.shape.borderWidth),
  };
  const sp = s.space ?? ({} as StyleSpec['space']);
  s.space = { unit: clamp(sp.unit, 4, 12, f.space.unit), sectionY: clamp(sp.sectionY, 24, 240, f.space.sectionY), container: clamp(sp.container, 600, 1600, f.space.container), gutter: clamp(sp.gutter, 8, 64, f.space.gutter) };
  const l = s.layout ?? ({} as StyleSpec['layout']);
  s.layout = {
    align: oneOf(l.align, ['left', 'center'] as const, 'left'), density: oneOf(l.density, ['tight', 'comfortable', 'airy'] as const, 'comfortable'),
    rhythm: oneOf(l.rhythm, ['uniform', 'alternating', 'varied'] as const, 'alternating'),
    heroPreference: Array.isArray(l.heroPreference) ? l.heroPreference.filter((p) => typeof p === 'string').slice(0, 6) : f.layout.heroPreference,
    featurePreference: Array.isArray(l.featurePreference) ? l.featurePreference.filter((p) => typeof p === 'string').slice(0, 6) : f.layout.featurePreference,
  };
  s.motion = oneOf(s.motion, ['none', 'minimal', 'subtle'] as const, 'minimal');
  s.darkMode = oneOf(s.darkMode, ['off', 'auto'] as const, 'off');
  s.imagery = oneOf(s.imagery, ['duotone', 'natural', 'bordered', 'grain'] as const, 'natural');
  s.id = typeof s.id === 'string' && /^[\w-]{1,60}$/.test(s.id) ? s.id : 'custom';
  s.name = String(s.name ?? 'Custom').slice(0, 60);
  s.description = String(s.description ?? '').slice(0, 300);
  return s;
}
