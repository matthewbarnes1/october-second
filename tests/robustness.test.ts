import { describe, expect, it } from 'vitest';
import { analyze } from '@morpheus/core';
import { memVfs, readSite, refreshSignals, renderAll, runRedesign } from '@morpheus/adapter-html';
import { CORPUS, wordsOf } from './corpus';

const SKIP_PRESERVE = new Set(['empty', 'whitespace-only', 'no-body', 'spa-shell']);

async function redesignAll(name: string, depth: 'polish' | 'restructure' | 'redesign' = 'redesign', preset = 'editorial') {
  const files = CORPUS[name];
  const { ir } = await readSite(memVfs(files));
  const res = runRedesign(ir, { depth, preset });
  const out = renderAll(res.output);
  return { ir, res, out };
}

describe('corpus: nothing crashes, nothing is lost', () => {
  for (const name of Object.keys(CORPUS)) {
    for (const depth of ['polish', 'restructure', 'redesign'] as const) {
      it(`${name} @ ${depth}`, async () => {
        const { out } = await redesignAll(name, depth);
        expect(out.get('morpheus.css')).toBeTruthy();
        if (SKIP_PRESERVE.has(name)) return;
        const before = new Set(wordsOf(Object.values(CORPUS[name]).join(' ')));
        const after = new Set(wordsOf([...out.entries()].filter(([f]) => f.endsWith('.html')).map(([, h]) => h).join(' ')));
        const lost = [...before].filter((w) => !after.has(w));
        const kept = 1 - lost.length / Math.max(before.size, 1);
        expect(kept, `lost: ${lost.slice(0, 15).join(', ')}`).toBeGreaterThanOrEqual(0.97);
      });
    }
  }
});

describe('modern authoring patterns', () => {
  it('reads Tailwind-CDN sites (no stylesheet) into a sensible structure', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const intents = ir.pages[0].sections.map((s) => s.intent);
    expect(intents).toEqual(expect.arrayContaining(['hero', 'features', 'pricing', 'faq']));
    expect(ir.signals.usesTailwind).toBe(true);
    const hero = ir.pages[0].sections[0];
    expect(hero.content.eyebrow).toMatch(/GPT-5/);
    expect(hero.content.ctas.map((c) => c.text)).toEqual(['Start free trial', 'Book a demo']);
    expect(ir.pages[0].nav.cta?.text).toBe('Get started');
    expect(ir.pages[0].nav.primary.map((l) => l.label)).toEqual(['Features', 'Pricing', 'FAQ', 'Blog']);
  });

  it('flags the Tailwind/AI look on that page', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const ids = analyze(ir).ai.hits.map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(['purple-blue-gradient', 'gradient-text', 'glow-blobs', 'pill-badges', 'buzzword-copy']));
    expect(analyze(ir).ai.score).toBeGreaterThan(45);
  });

  it('reads Bootstrap card rows and logo rows', async () => {
    const { ir } = await readSite(memVfs(CORPUS['bootstrap']));
    const s = ir.pages[0].sections;
    expect(s.find((x) => x.intent === 'features')?.content.items).toHaveLength(3);
    expect(s.find((x) => x.intent === 'logos')?.content.logos).toHaveLength(3);
  });

  it('keeps code, tables, definition lists, quotes and nested lists on a docs page', async () => {
    const { out } = await redesignAll('docs-content');
    const html = out.get('index.html')!;
    for (const needle of ['npm install --global quill-cli', 'Where built files are written', 'A folder of related markdown files', 'Quill made our docs build 10x faster', 'Sitemap plugin']) expect(html, needle).toContain(needle);
  });

  it('preserves right-to-left direction and language', async () => {
    const { out } = await redesignAll('rtl-arabic');
    expect(out.get('index.html')).toMatch(/<html lang="ar" dir="rtl">/);
  });

  it('keeps responsive images, sizes, dimensions and picture sources', async () => {
    const { out } = await redesignAll('head-and-images', 'restructure');
    const html = out.get('index.html')!;
    expect(html).toContain('srcset="img/hero-640.jpg 640w, img/hero-1280.jpg 1280w"');
    expect(html).toContain('sizes="(min-width: 800px) 1200px, 100vw"');
    expect(html).toContain('<source');
    expect(html).toMatch(/<img[^>]*width="1280"[^>]*height="720"|<img[^>]*height="720"[^>]*width="1280"/);
  });

  it('keeps SEO head data: canonical, hreflang, RSS, manifest, Open Graph, JSON-LD', async () => {
    const { out } = await redesignAll('head-and-images', 'redesign');
    const html = out.get('index.html')!;
    for (const needle of ['rel="canonical"', 'hreflang="de"', 'application/rss+xml', 'rel="manifest"', 'og:image', 'application/ld+json', 'Fieldnotes Studio', 'theme-color']) expect(html, needle).toContain(needle);
  });

  it('does not lazy-load the hero image (LCP) but lazy-loads the rest', async () => {
    const { out } = await redesignAll('head-and-images', 'restructure');
    const html = out.get('index.html')!;
    const hero = html.match(/<img[^>]*hero[^>]*>/)?.[0] ?? '';
    expect(hero).not.toContain('loading="lazy"');
    expect(hero).toMatch(/fetchpriority="high"/);
  });

  it('keeps video with poster and sources', async () => {
    const { out } = await redesignAll('head-and-images', 'redesign');
    expect(out.get('index.html')).toMatch(/<video[^>]*poster="img\/poster.jpg"/);
  });

  it('keeps fieldset/legend, radios, checkboxes and optgroups in forms', async () => {
    const { out } = await redesignAll('complex-form');
    const html = out.get('index.html')!;
    for (const needle of ['About you', 'Your riding', 'type="radio"', 'type="checkbox"', 'Canal loop', 'Hill climb', 'Short', 'Send me the newsletter']) expect(html, needle).toContain(needle);
  });

  it('tells the user when a page is a client-rendered shell with nothing static to redesign', async () => {
    const { ir } = await readSite(memVfs(CORPUS['spa-shell']));
    expect(ir.warnings.join(' ')).toMatch(/client-rendered|JavaScript/i);
  });

  it('survives empty, whitespace-only and body-less documents', async () => {
    for (const n of ['empty', 'whitespace-only', 'no-body']) {
      const { out } = await redesignAll(n);
      expect(out.has('morpheus.css')).toBe(true);
    }
  });

  it('handles malformed markup without throwing', async () => {
    const { out } = await redesignAll('malformed');
    expect(out.get('index.html')).toContain('Buy now');
    expect(out.get('index.html')).toContain('Three');
  });
});

describe('limits and resilience', () => {
  it('refuses pathologically deep nesting safely: no crash, page passed through, user warned', async () => {
    const deep = '<div>'.repeat(6000) + '<h1>Deep</h1><p>Still readable content here.</p>' + '</div>'.repeat(6000);
    const { ir } = await readSite(memVfs({ 'index.html': `<html><body>${deep}</body></html>`, 'ok.html': '<html><body><h1>Fine</h1><p>Normal page.</p></body></html>' }));
    expect(ir.passthrough).toEqual(['index.html']);
    expect(ir.warnings.join(' ')).toMatch(/nested more than/);
    expect(ir.pages.map((p) => p.file)).toEqual(['ok.html']);
  });

  it('handles a very large page in reasonable time', async () => {
    const sec = (i: number) => `<section><h2>Section ${i}</h2><p>Paragraph ${i} with some words in it.</p><div><div><h3>A${i}</h3><p>aa aa aa</p></div><div><h3>B${i}</h3><p>bb bb bb</p></div><div><h3>C${i}</h3><p>cc cc cc</p></div></div></section>`;
    const html = `<html><body><h1>Big</h1>${Array.from({ length: 1500 }, (_, i) => sec(i)).join('')}</body></html>`;
    const t = Date.now();
    const { ir } = await readSite(memVfs({ 'index.html': html }));
    const res = runRedesign(ir, { depth: 'redesign', preset: 'swiss' });
    renderAll(refreshSignals(res.output));
    expect(Date.now() - t).toBeLessThan(15000);
  }, 30000);

  it('ignores unreadable or oversized stylesheets rather than failing', async () => {
    const { ir } = await readSite(memVfs({ 'index.html': '<html><head><link rel="stylesheet" href="missing.css"></head><body><h1>Hi</h1><p>Some words here.</p></body></html>' }));
    expect(ir.warnings.join(' ')).toMatch(/missing\.css/);
  });
});
