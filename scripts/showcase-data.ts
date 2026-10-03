import { promises as fs } from 'node:fs';
import path from 'node:path';
import { memVfs, nodeVfs, readSite, renderAll, runRedesign } from '@morpheus/adapter-html';

const out = process.argv[2];
const STYLES = ['editorial', 'swiss', 'midnight', 'warm-craft', 'playful', 'brutalist'];
const { ir } = await readSite(nodeVfs('fixtures/ai-saas'));
const inline = (html: string, files: Map<string, string>) =>
  html.replace(/<link rel="stylesheet" href="morpheus\.css">/, `<style>${files.get('morpheus.css')}</style>`);

// original, with its stylesheet inlined
const origCss = await fs.readFile('fixtures/ai-saas/styles.css', 'utf8');
const origHtml = (await fs.readFile('fixtures/ai-saas/index.html', 'utf8')).replace('<link rel="stylesheet" href="styles.css">', `<style>${origCss}</style>`).replace(/href="about\.html"/g, 'href="#"');

const data: any = { original: { home: origHtml }, styles: {} };
for (const id of STYLES) {
  const r = runRedesign(ir, { depth: 'redesign', preset: id });
  const files = renderAll(r.output);
  const neutral = (h: string) => h.replace(/href="(?!#)[^"]*\.html"/g, 'href="#"').replace(/<script[\s\S]*?<\/script>/g, '');
  data.styles[id] = {
    name: r.plan.style.name, description: r.plan.style.description.split('.')[0],
    colors: r.plan.style.colors,
    before: { ai: r.before.ai.score, ux: r.before.ux.score }, after: { ai: r.after.ai.score, ux: r.after.ux.score },
    contrastOk: r.contrast.every((c) => c.ok),
    pages: { home: neutral(inline(files.get('index.html')!, files)), pricing: neutral(inline(files.get('pricing.html')!, files)) },
    ops: r.plan.ops.filter((o) => o.change.impact !== 'low' || o.type === 'advise').map((o) => ({ cat: o.change.category, target: o.change.target, impact: o.change.impact, why: o.change.rationale, advise: o.type === 'advise' })),
    remaining: r.after.ai.hits.map((h) => h.title),
    ux: r.after.ux.findings.length,
  };
}
data.beforeTells = (await import('@morpheus/core')).analyze(ir).ai.hits.map((h) => h.title);
await fs.writeFile(path.join(out, 'showcase.json'), JSON.stringify(data));
console.log('bytes', JSON.stringify(data).length, Object.keys(data.styles).map((k) => `${k}:${data.styles[k].after.ai}`).join(' '));
