import { describe, expect, it } from 'vitest';
import { PATTERNS, clone, applyPlan, getPreset, planRedesign, type PatternId, type SiteIR } from '@morpheus/core';
import { memVfs, readSite, renderAll, runRedesign } from '@morpheus/adapter-html';
import { CORPUS, wordsOf } from './corpus';

/**
 * Invariants that must hold for ANY layout, in ANY combination, whoever chose it
 * (planner, editor or a saved plan): the redesign may restructure but never lose content.
 */
describe('every layout can host every kind of section without dropping content', () => {
  const pages = ['tailwind-cdn', 'bootstrap', 'docs-content', 'complex-form', 'head-and-images', 'unicode', 'malformed'] as const;
  const patterns = PATTERNS.filter((p) => !p.id.startsWith('header') && !p.id.startsWith('footer')).map((p) => p.id as PatternId);

  for (const name of pages) {
    it(`${name}: all ${patterns.length} patterns on every section`, async () => {
      const { ir } = await readSite(memVfs(CORPUS[name]));
      const base = wordsOf(Object.values(CORPUS[name]).join(' '));
      const baseSet = new Set(base);
      for (const pattern of patterns) {
        const forced: SiteIR = clone(ir);
        for (const page of forced.pages) for (const s of page.sections) s.pattern = pattern;
        const html = [...renderAll(forced).entries()].filter(([f]) => f.endsWith('.html')).map(([, h]) => h).join(' ');
        const got = new Set(wordsOf(html));
        const lost = [...baseSet].filter((w) => !got.has(w));
        // title words are not part of the body; allow only those
        const titleWords = new Set(wordsOf(forced.pages.map((p) => p.title).join(' ')));
        const real = lost.filter((w) => !titleWords.has(w));
        expect(real, `${name} forced into ${pattern} lost: ${real.slice(0, 12).join(', ')}`).toEqual([]);
      }
    });
  }

  it('output is stable: redesigning the output of a redesign keeps the same words', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const once = renderAll(runRedesign(ir, { depth: 'redesign', preset: 'editorial' }).output);
    const html1 = once.get('index.html')!;
    const again = await readSite(memVfs({ 'index.html': html1 }));
    const twice = renderAll(runRedesign(again.ir, { depth: 'redesign', preset: 'swiss' }).output).get('index.html')!;
    const w1 = new Set(wordsOf(html1));
    const w2 = new Set(wordsOf(twice));
    const lost = [...w1].filter((w) => !w2.has(w) && !['skip', 'content', 'primary'].includes(w));
    expect(lost.slice(0, 20)).toEqual([]);
  });

  it('plans are pure: planning never mutates the source IR', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const before = JSON.stringify(ir);
    const plan = planRedesign(ir, { depth: 'redesign', style: getPreset('swiss')! });
    applyPlan(ir, plan);
    expect(JSON.stringify(ir)).toBe(before);
  });
});
