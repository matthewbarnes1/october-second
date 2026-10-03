import { chromium } from 'playwright-core';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { listPresets } from '@morpheus/core';
import { memVfs, nodeVfs, readSite, runRedesign, writeSite } from '@morpheus/adapter-html';
import { CORPUS } from '../tests/corpus';

const axeSrc = await fs.readFile(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8');
const sites: Record<string, () => Promise<any>> = {
  'ai-saas': async () => (await readSite(nodeVfs('fixtures/ai-saas'))).ir,
  'tailwind-cdn': async () => (await readSite(memVfs(CORPUS['tailwind-cdn']))).ir,
  'docs-content': async () => (await readSite(memVfs(CORPUS['docs-content']))).ir,
  'complex-form': async () => (await readSite(memVfs(CORPUS['complex-form']))).ir,
  'rtl-arabic': async () => (await readSite(memVfs(CORPUS['rtl-arabic']))).ir,
};
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'axe-'));
const agg = new Map<string, { n: number; impact: string; help: string; where: Set<string>; sample: string }>();
let runs = 0;
const overflow: string[] = [];
for (const [name, load] of Object.entries(sites)) {
  const src = await load();
  for (const preset of listPresets()) {
    const { output } = runRedesign(src, { depth: 'redesign', preset: preset.id });
    const out = path.join(tmp, `${name}-${preset.id}`);
    await writeSite(output, out);
    for (const page of output.pages) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.route(/^https?:/, (r) => r.abort());
      await p.goto('file://' + path.join(out, page.file));
      await p.evaluate(axeSrc);
      const res: any = await p.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice'] } })`);
      runs++;
      for (const v of res.violations) {
        const e = agg.get(v.id) ?? { n: 0, impact: v.impact, help: v.help, where: new Set(), sample: '' };
        e.n += v.nodes.length; e.where.add(`${name}/${preset.id}`);
        if (!e.sample) e.sample = v.nodes[0].html.slice(0, 140) + ' || ' + (v.nodes[0].any[0]?.message ?? v.nodes[0].failureSummary ?? '').slice(0, 160);
        agg.set(v.id, e);
      }
      for (const w of [1280, 390]) {
        await p.setViewportSize({ width: w, height: 900 });
        const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (o > 1) overflow.push(`${name}/${preset.id}${page.route} @${w}px overflows by ${o}px`);
      }
      await p.close();
    }
  }
}
await browser.close();
console.log(`axe runs: ${runs}`);
if (!agg.size) console.log('NO AXE VIOLATIONS');
for (const [id, e] of [...agg].sort((a, b) => b[1].n - a[1].n)) console.log(`\n[${e.impact}] ${id} x${e.n} in ${e.where.size} configs: ${e.help}\n   ${e.sample}\n   e.g. ${[...e.where].slice(0, 4).join(', ')}`);
console.log('\noverflow:', overflow.length ? overflow.slice(0, 12) : 'none');
