import { HtmlValidate } from 'html-validate';
import { listPresets } from '@morpheus/core';
import { memVfs, nodeVfs, readSite, renderAll, runRedesign } from '@morpheus/adapter-html';
import { CORPUS } from '../tests/corpus';
const hv = new HtmlValidate({ extends: ['html-validate:recommended'], rules: { 'no-inline-style': 'off', 'void-style': 'off', 'prefer-native-element': 'off', 'no-trailing-whitespace': 'off', 'attribute-allowed-values': 'error' } });
const sources: Record<string, any> = { 'ai-saas': (await readSite(nodeVfs('fixtures/ai-saas'))).ir };
for (const n of ['tailwind-cdn', 'bootstrap', 'docs-content', 'complex-form', 'rtl-arabic', 'head-and-images', 'unicode', 'malformed']) sources[n] = (await readSite(memVfs(CORPUS[n]))).ir;
const agg = new Map<string, { n: number; msg: string; where: string }>();
let pages = 0;
for (const [name, ir] of Object.entries(sources)) {
  for (const preset of ['editorial', 'brutalist', 'midnight']) {
    const out = renderAll(runRedesign(ir, { depth: 'redesign', preset }).output);
    for (const [f, html] of out) {
      if (!f.endsWith('.html')) continue;
      pages++;
      const r = await hv.validateString(html, f);
      for (const m of r.results[0]?.messages ?? []) {
        const k = m.ruleId ?? 'x';
        const e = agg.get(k) ?? { n: 0, msg: m.message + ' <' + (m.selector ?? '') + '>', where: `${name}/${preset}/${f}:${m.line}` };
        e.n++; agg.set(k, e);
      }
    }
  }
}
console.log('pages validated:', pages);
if (!agg.size) console.log('VALID');
for (const [k, e] of [...agg].sort((a, b) => b[1].n - a[1].n)) console.log(`${k} x${e.n}: ${e.msg}  [${e.where}]`);
