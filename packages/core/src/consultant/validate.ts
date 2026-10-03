import type { Operation } from './apply';
import { PATTERN_BY_ID } from './patterns';

/** Operations that an editor client may add by hand. Everything else is produced by the planner only. */
const MANUAL_TYPES = new Set(['set-pattern', 'set-rhythm', 'set-align', 'reorder']);
const TONES = new Set(['plain', 'surface', 'inverse', 'accent']);
const SPACING = new Set(['tight', 'normal', 'loose']);
const ALIGN = new Set(['left', 'center']);
const ID = /^[\w:./#-]{1,160}$/;

export function validateManualOps(input: unknown): { ops: Operation[]; rejected: string[] } {
  const ops: Operation[] = [];
  const rejected: string[] = [];
  if (!Array.isArray(input)) return { ops, rejected: input === undefined ? [] : ['manual must be an array'] };
  for (const raw of input.slice(0, 200)) {
    const o = raw as any;
    const why = (m: string) => rejected.push(`${String(o?.id ?? '?').slice(0, 60)}: ${m}`);
    if (!o || typeof o !== 'object') { why('not an object'); continue; }
    if (typeof o.id !== 'string' || !ID.test(o.id) || !o.id.startsWith('manual:')) { why('bad id'); continue; }
    if (!MANUAL_TYPES.has(o.type)) { why(`type "${o.type}" is not allowed from the editor`); continue; }
    if (o.page !== undefined && (typeof o.page !== 'string' || !ID.test(o.page))) { why('bad page'); continue; }
    if (o.section !== undefined && (typeof o.section !== 'string' || !ID.test(o.section))) { why('bad section'); continue; }
    const p = o.params ?? {};
    if (o.type === 'set-pattern' && !(typeof p.pattern === 'string' && PATTERN_BY_ID.has(p.pattern as any))) { why('unknown pattern'); continue; }
    if (o.type === 'set-align') {
      if (!ALIGN.has(p.align)) { why('bad alignment'); continue; }
      if (p.sections !== undefined && !(Array.isArray(p.sections) && p.sections.every((x: unknown) => typeof x === 'string' && ID.test(x)))) { why('bad sections'); continue; }
    }
    if (o.type === 'set-rhythm') {
      if (!Array.isArray(p.sections) || !p.sections.every((r: any) => r && typeof r.id === 'string' && ID.test(r.id) && TONES.has(r.tone) && SPACING.has(r.spacing))) { why('bad rhythm'); continue; }
    }
    if (o.type === 'reorder' && !(Array.isArray(p.order) && p.order.length <= 500 && p.order.every((x: unknown) => typeof x === 'string' && ID.test(x)))) { why('bad order'); continue; }
    const sectionsParam = o.type === 'set-rhythm' ? p.sections.map((r: any) => ({ id: r.id, tone: r.tone, spacing: r.spacing })) : p.sections;
    ops.push({
      id: o.id, type: o.type, page: o.page, section: o.section,
      params: o.type === 'set-pattern' ? { pattern: p.pattern } : o.type === 'set-align' ? { align: p.align, sections: p.sections } : o.type === 'set-rhythm' ? { sections: sectionsParam } : { order: p.order },
      change: {
        id: o.id, op: o.type, target: String(o.change?.target ?? '').slice(0, 120), category: 'structure', impact: 'medium',
        rationale: String(o.change?.rationale ?? 'Set by you in the editor.').slice(0, 240),
      },
    });
  }
  return { ops, rejected };
}
