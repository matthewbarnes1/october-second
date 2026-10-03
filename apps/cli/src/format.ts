import type { AnalysisReport, SiteIR, StackInfo } from '@morpheus/core';
import type { RunResult } from '@morpheus/adapter-html';

const on = process.stdout.isTTY && !process.env.NO_COLOR;
const w = (n: number) => (s: string) => (on ? `\x1b[${n}m${s}\x1b[0m` : s);
export const c = { bold: w(1), dim: w(2), red: w(31), green: w(32), yellow: w(33), blue: w(34), cyan: w(36) };

export function bar(score: number, width = 20, invert = false): string {
  const filled = Math.round((score / 100) * width);
  const bad = invert ? score >= 55 : score < 45;
  const mid = invert ? score >= 30 : score < 70;
  const col = bad ? c.red : mid ? c.yellow : c.green;
  return col('█'.repeat(filled)) + c.dim('░'.repeat(width - filled));
}

export function scanReport(dir: string, stack: StackInfo, ir: SiteIR, a: AnalysisReport, full: boolean): string {
  const L: string[] = [];
  L.push(c.bold(`\nMorpheus scan: ${dir}\n`));
  L.push(`${c.bold('Stack')}      ${[...stack.frameworks, ...stack.languages.slice(0, 4)].join(', ') || 'unknown'}`);
  if (stack.styling.length) L.push(`${c.bold('Styling')}    ${stack.styling.join(', ')}`);
  L.push(`${c.bold('Adapter')}    ${stack.adapterSupport === 'full' ? c.green('available (' + stack.adapter + ')') : c.yellow(stack.adapterSupport)}${stack.notes.length ? c.dim('  ' + stack.notes[0]) : ''}`);
  L.push(`${c.bold('Pages')}      ${ir.pages.map((p) => `${p.route} (${p.sections.length} sections)`).join(', ')}`);
  L.push('');
  L.push(`${c.bold('AI look')}    ${bar(a.ai.score, 20, true)} ${a.ai.score}/100  ${c.dim(a.ai.level)}`);
  L.push(`${c.bold('UX health')}  ${bar(a.ux.score)} ${a.ux.score}/100`);
  L.push('');
  L.push(c.bold('AI tells found'));
  for (const t of a.ai.hits.slice(0, full ? 99 : 6)) L.push(`  ${c.red('●')} ${t.title}  ${c.dim(t.evidence.slice(0, 2).join(' · '))}`);
  if (!a.ai.hits.length) L.push(c.dim('  none'));
  L.push('');
  L.push(c.bold('UX findings'));
  for (const f of a.ux.findings.slice(0, full ? 99 : 6)) {
    const col = f.severity === 'high' ? c.red : f.severity === 'medium' ? c.yellow : c.dim;
    L.push(`  ${col(f.severity.padEnd(6))} ${f.title}${f.page !== '/' ? c.dim(' [' + f.page + ']') : ''}`);
    if (full) L.push(c.dim(`         ${f.detail} ${f.recommendation}`));
  }
  if (!full && (a.ai.hits.length > 6 || a.ux.findings.length > 6)) L.push(c.dim('\n  Run `morpheus audit` for everything.'));
  L.push('');
  return L.join('\n');
}

export function report(r: RunResult, plansOnly: boolean, markdown = false): string {
  const L: string[] = [];
  const h = (s: string) => (markdown ? `\n## ${s}\n` : c.bold(`\n${s}`));
  const p = r.plan.profile;
  L.push(markdown ? `# Morpheus redesign report\n` : c.bold(`\nMorpheus ${plansOnly ? 'plan' : 'redesign'}`));
  L.push(`Style: ${r.plan.style.name}  |  Depth: ${r.plan.depth}`);
  L.push(`Read as: ${p.industry} site for ${p.audience}, goal "${p.goal}", ${p.tone} tone${p.evidence.length ? ` (from: ${p.evidence.slice(0, 4).join(', ')})` : ''}`);
  if (r.styleNotes.length) L.push(r.styleNotes.join('. ') + '.');
  L.push(h('Scores'));
  L.push(`AI look   ${r.before.ai.score} → ${r.after.ai.score}   (lower is better)`);
  L.push(`UX health ${r.before.ux.score} → ${r.after.ux.score}   (higher is better)`);
  const bad = r.contrast.filter((x) => !x.ok);
  L.push(bad.length ? `Contrast: ${bad.map((b) => `${b.pair} ${b.ratio}:1`).join('; ')} below WCAG` : 'Contrast: all palette pairs meet WCAG AA');
  L.push(h(`Changes (${r.plan.ops.length})`));
  const groups: Record<string, typeof r.plan.ops> = {};
  for (const o of r.plan.ops) (groups[o.change.category] ??= []).push(o);
  for (const [cat, ops] of Object.entries(groups)) {
    L.push(markdown ? `\n### ${cat}\n` : c.cyan(`\n  ${cat}`));
    for (const o of ops) {
      const imp = o.change.impact === 'high' ? (markdown ? '**high**' : c.red('high')) : o.change.impact;
      L.push(markdown ? `- \`${o.id}\` (${o.change.impact}) ${o.change.rationale}` : `   ${imp.padEnd(markdown ? 0 : 14)} ${o.change.target.padEnd(18).slice(0, 18)} ${o.change.rationale}`);
    }
  }
  const remaining = r.after.ai.hits;
  if (remaining.length) {
    L.push(h('Still reads as generic'));
    for (const t of remaining) L.push(`  - ${t.title}${t.evidence.length ? ` (${t.evidence.slice(0, 2).join('; ')})` : ''}`);
  }
  const warn = r.output.warnings;
  if (warn.length) { L.push(h('Warnings')); warn.forEach((x) => L.push('  - ' + x)); }
  L.push(h('Review before shipping'));
  L.push('  - Scripts were carried over unchanged; selectors they use may no longer match. Test interactive features.');
  L.push('  - Copy was not rewritten. Flagged copy issues need the client\'s own words.');
  return L.join('\n');
}
