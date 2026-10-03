import type { Rule } from './ai-tells';
import { registerTell } from './ai-tells';
import { siteText } from './util';

/**
 * Tell packs: declarative JSON rules so the checklist can follow the landscape without a code release.
 *
 *   { "name": "2027-q1", "version": "2027.1", "tells": [
 *       { "id": "neo-brutal-cards", "title": "...", "area": "components", "weight": 4,
 *         "text": ["regex"], "classes": ["regex"], "css": ["regex"], "minMatches": 1 } ] }
 *
 * `text` is matched against the site's visible copy, `classes` against all class names, `css` against the stylesheet.
 * Patterns are case-insensitive. Packs are trusted local files, like any other build configuration.
 */

export interface TellPackRule {
  id: string;
  title: string;
  area?: Rule['area'];
  weight?: number;
  text?: string[];
  classes?: string[];
  css?: string[];
  minMatches?: number;
}
export interface TellPack { name?: string; version?: string; tells: TellPackRule[] }

const AREAS = new Set(['color', 'type', 'layout', 'components', 'copy', 'imagery', 'motion']);
const MAX_PATTERN = 300;
const MAX_HAYSTACK = 400_000;

export function compileTellPack(pack: unknown): { rules: Rule[]; errors: string[] } {
  const errors: string[] = [];
  const rules: Rule[] = [];
  const p = pack as TellPack;
  if (!p || typeof p !== 'object' || !Array.isArray(p.tells)) return { rules, errors: ['A tell pack needs a "tells" array.'] };
  for (const [i, t] of p.tells.entries()) {
    const label = `tells[${i}]${t?.id ? ` (${t.id})` : ''}`;
    if (!t || typeof t.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(t.id)) { errors.push(`${label}: id must be lowercase letters, numbers and dashes.`); continue; }
    if (typeof t.title !== 'string' || !t.title.trim()) { errors.push(`${label}: missing title.`); continue; }
    const weight = Math.min(10, Math.max(1, Number(t.weight ?? 4)));
    const area = AREAS.has(t.area as string) ? (t.area as Rule['area']) : 'components';
    const compile = (list: unknown, kind: string): RegExp[] | null => {
      if (list === undefined) return [];
      if (!Array.isArray(list)) { errors.push(`${label}: ${kind} must be an array of patterns.`); return null; }
      const out: RegExp[] = [];
      for (const src of list) {
        if (typeof src !== 'string' || src.length > MAX_PATTERN) { errors.push(`${label}: ${kind} pattern missing or longer than ${MAX_PATTERN} characters.`); return null; }
        try { out.push(new RegExp(src, 'i')); } catch (e: any) { errors.push(`${label}: invalid ${kind} pattern "${src}" (${e.message}).`); return null; }
      }
      return out;
    };
    const text = compile(t.text, 'text'), classes = compile(t.classes, 'classes'), css = compile(t.css, 'css');
    if (!text || !classes || !css) continue;
    if (!text.length && !classes.length && !css.length) { errors.push(`${label}: give at least one of text, classes or css.`); continue; }
    const min = Math.max(1, Math.round(Number(t.minMatches ?? 1)));
    rules.push({
      id: t.id, area, title: t.title.slice(0, 120), weight,
      test: (ir) => {
        const hay = { text: siteText(ir).slice(0, MAX_HAYSTACK), classes: ir.signals.classNames.join(' ').slice(0, MAX_HAYSTACK), css: (ir.behavior.legacyCss ?? '').slice(0, MAX_HAYSTACK) };
        const found: string[] = [];
        for (const [kind, res] of [['text', text], ['classes', classes], ['css', css]] as const) {
          for (const re of res) { const m = re.exec(hay[kind]); if (m) found.push(m[0].slice(0, 60)); }
        }
        return found.length >= min ? found.slice(0, 4) : null;
      },
    });
  }
  return { rules, errors };
}

/** Compile and register a pack globally. Returns how many rules were added and any problems found. */
export function loadTellPack(pack: unknown): { added: number; errors: string[] } {
  const { rules, errors } = compileTellPack(pack);
  rules.forEach(registerTell);
  return { added: rules.length, errors };
}
