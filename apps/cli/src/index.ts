#!/usr/bin/env -S npx tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listPresets, type Depth } from '@morpheus/core';
import { loadSite, runRedesign, writeSite, nodeVfs } from '@morpheus/adapter-html';
import { detectStack } from '@morpheus/core';
import { c, bar, report, scanReport } from './format';

const HELP = `
${c.bold('Morpheus')}: redesign AI-built websites like a UI/UX consultant

${c.bold('Usage')}
  morpheus scan <path>                      detect the stack, score the AI look, audit UX
  morpheus audit <path> [--json]            full UX audit and AI-tell findings
  morpheus styles                           list style presets
  morpheus plan <path> [options]            show the redesign plan with a reason for every change
  morpheus redesign <path> [options]        apply the plan and write the new site
  morpheus serve [path]                     open the live editor (web app)

${c.bold('Options')}
  --style <id>        preset (default: editorial)
  --brief "<text>"    describe the style you want; refines --style when both are given
  --depth <level>     polish | restructure | redesign   (default: restructure)
  --out <dir>         output folder for redesign (default: <path>.morpheus)
  --json              machine-readable output
`;

function parse(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[k] = true;
      else { flags[k] = next; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

async function main() {
  const { pos, flags } = parse(process.argv.slice(2));
  const [cmd, target] = pos;
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }

  if (cmd === 'styles') {
    for (const s of listPresets()) {
      console.log(`${c.bold(s.id.padEnd(12))} ${s.name.padEnd(16)} ${c.dim(s.description)}`);
    }
    return;
  }
  if (cmd === 'serve') {
    process.env.MORPHEUS_ROOT = target ? path.resolve(target) : process.cwd();
    await import('../../web/src/server');
    return;
  }
  if (!target) { console.error('Missing <path>.\n' + HELP); process.exit(1); }
  const dir = path.resolve(target);
  try { await fs.access(dir); } catch { console.error(`Not found: ${dir}`); process.exit(1); }

  const depth = (String(flags.depth ?? 'restructure')) as Depth;
  if (!['polish', 'restructure', 'redesign'].includes(depth)) { console.error('--depth must be polish, restructure or redesign'); process.exit(1); }

  if (cmd === 'scan' || cmd === 'audit') {
    const stack = await detectStack(nodeVfs(dir));
    const { ir } = await loadSite(dir);
    const { runRedesign: _r } = await import('@morpheus/adapter-html');
    void _r;
    const { analyze } = await import('@morpheus/core');
    const a = analyze(ir);
    if (flags.json) { console.log(JSON.stringify({ stack, ai: a.ai, ux: a.ux, pages: ir.pages.map((p) => ({ route: p.route, sections: p.sections.map((s) => s.intent) })) }, null, 2)); return; }
    console.log(scanReport(dir, stack, ir, a, cmd === 'audit'));
    return;
  }

  if (cmd === 'plan' || cmd === 'redesign') {
    const stack = await detectStack(nodeVfs(dir));
    if (stack.adapterSupport !== 'full') {
      console.error(c.yellow(`\nNo adapter for ${stack.renderer} yet (${stack.frameworks.join(', ') || stack.languages.join(', ')}).`));
      console.error(stack.notes.join('\n'));
      console.error('Morpheus can analyse this project but cannot rewrite it until an adapter exists.\n');
      process.exit(2);
    }
    const { ir } = await loadSite(dir);
    const res = runRedesign(ir, { depth, preset: typeof flags.style === 'string' ? flags.style : flags.brief ? undefined : 'editorial', brief: typeof flags.brief === 'string' ? flags.brief : undefined });
    if (flags.json) { console.log(JSON.stringify({ profile: res.plan.profile, ops: res.plan.ops.map((o) => o.change), before: { ai: res.before.ai.score, ux: res.before.ux.score }, after: { ai: res.after.ai.score, ux: res.after.ux.score } }, null, 2)); return; }
    console.log(report(res, cmd === 'plan'));
    if (cmd === 'redesign') {
      const out = path.resolve(typeof flags.out === 'string' ? flags.out : `${dir.replace(/\/$/, '')}.morpheus`);
      const written = await writeSite(res.output, out, { sourceDir: dir });
      await fs.writeFile(path.join(out, 'MORPHEUS-REPORT.md'), report(res, false, true), 'utf8');
      await fs.writeFile(path.join(out, 'morpheus-changes.json'), JSON.stringify(res.plan.ops.map((o) => o.change), null, 2));
      console.log(`\n${c.green('Wrote')} ${written.length} files to ${c.bold(out)}`);
      console.log(c.dim('Open the pages in a browser, or run `morpheus serve` for the live editor.'));
    }
    return;
  }
  console.error(`Unknown command "${cmd}".\n` + HELP);
  process.exit(1);
}

main().catch((e) => { console.error(c.red(e?.stack ?? String(e))); process.exit(1); });
void bar;
