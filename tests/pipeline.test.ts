import { describe, expect, it } from 'vitest';
import {
  analyze, applyPlan, detectStack, getPreset, interpretBrief, listPresets, planRedesign, verifyStyle, contrast, parseColor,
} from '@morpheus/core';
import { loadSite, memVfs, nodeVfs, readSite, refreshSignals, renderAll, runRedesign, scopeCss } from '@morpheus/adapter-html';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSite } from '@morpheus/adapter-html';

const FIXTURE = path.resolve(__dirname, '../fixtures/ai-saas');

describe('stack detection', () => {
  it('recognises plain static HTML', async () => {
    const s = await detectStack(nodeVfs(FIXTURE));
    expect(s.renderer).toBe('static-html');
    expect(s.adapterSupport).toBe('full');
  });

  it('recognises frameworks from manifests and reports adapter status honestly', async () => {
    const s = await detectStack(memVfs({
      'package.json': JSON.stringify({ dependencies: { next: '14', react: '18', tailwindcss: '3' } }),
      'app/page.tsx': '', 'tailwind.config.js': '',
    }));
    expect(s.frameworks).toEqual(expect.arrayContaining(['Next.js', 'React']));
    expect(s.styling).toContain('Tailwind CSS');
    expect(s.adapterSupport).toBe('planned');
    const php = await detectStack(memVfs({ 'composer.json': '{"require":{"laravel/framework":"^11"}}', 'resources/views/home.blade.php': '' }));
    expect(php.frameworks.join()).toMatch(/Laravel/);
    const py = await detectStack(memVfs({ 'requirements.txt': 'Django==5', 'templates/index.html': '<p>x</p>' }));
    expect(py.frameworks).toContain('Django');
  });
});

describe('reading a site into the IR', () => {
  it('models the structure of an AI-built landing page', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const home = ir.pages.find((p) => p.route === '/')!;
    expect(home.sections.map((s) => s.intent)).toEqual(['hero', 'stats', 'features', 'steps', 'testimonials', 'pricing', 'faq', 'cta', 'contact']);
    expect(home.nav.primary).toHaveLength(9);
    const hero = home.sections[0];
    expect(hero.content.eyebrow).toMatch(/Introducing/);
    expect(hero.content.ctas.map((c) => c.text)).toEqual(['Get Started', 'Watch Demo']);
    expect(hero.content.alignment).toBe('center');
    expect(home.sections[2].content.items).toHaveLength(6);
    expect(home.sections[2].content.items[0].iconKind).toBe('emoji');
    const pricing = home.sections.find((s) => s.intent === 'pricing')!;
    expect(pricing.content.items.map((i) => i.price)).toEqual(['$0/mo', '$29/mo', '$99/mo']);
    expect(pricing.content.items[1].highlighted).toBe(true);
    expect(home.sections.find((s) => s.intent === 'contact')!.content.form!.fields.length).toBe(7);
    expect(home.footer.columns.length).toBe(3);
  });

  it('works from an in-memory file set (any source, not just disk)', async () => {
    const { ir } = await readSite(memVfs({ 'index.html': '<html><body><h1>Hello</h1><p>World of things.</p><a class="btn" href="/go">Go</a></body></html>' }));
    expect(ir.pages[0].sections[0].content.heading).toBe('Hello');
    expect(ir.pages[0].sections[0].content.ctas[0].href).toBe('/go');
  });

  it('carries unmodelled content through as sanitised rich content instead of dropping it', async () => {
    const big = '<section><div><table><tr><td>' + 'cell text '.repeat(60) + '</td></tr></table><script>alert(1)</script><p onclick="x()">kept <b>bold</b></p></div></section>';
    const { ir } = await readSite(memVfs({ 'index.html': `<html><body><h1>T</h1>${big}</body></html>` }));
    const html = renderAll(runRedesign(ir, { depth: 'redesign', preset: 'swiss' }).output).get('index.html')!;
    expect(html).toContain('cell text');
    expect(html).toContain('kept <b>bold</b>');
    const main = html.match(/<main[\s\S]*<\/main>/)![0];
    expect(main).not.toContain('alert(1)');
    expect(main).not.toContain('onclick');
  });
});

describe('AI-look and UX analysis', () => {
  it('scores the fixture as strongly generic and lists concrete tells', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const a = analyze(ir);
    expect(a.ai.score).toBeGreaterThanOrEqual(80);
    const ids = a.ai.hits.map((h) => h.id);
    for (const id of ['purple-blue-gradient', 'gradient-text', 'centered-hero-pills', 'uniform-feature-grid', 'emoji-icons', 'buzzword-copy', 'inter-only']) expect(ids).toContain(id);
  });

  it('finds real UX problems', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const ids = analyze(ir).ux.findings.map((f) => f.id);
    for (const id of ['missing-viewport', 'nav-overload', 'form-no-labels', 'cta-competition', 'missing-lang']) expect(ids).toContain(id);
  });

  it('does not flag a distinctive hand-built page', async () => {
    const { ir } = await readSite(memVfs({
      'index.html': `<html lang="en"><head><meta name="viewport" content="width=device-width"><title>Harbour Bakery: bread since 1987</title><meta name="description" content="x"><style>body{font-family:'Fraunces',serif;color:#222}h1{font-size:60px}</style></head>
      <body><nav><a href="/">Harbour</a><ul><li><a href="/menu">Menu</a></li><li><a href="/visit">Visit</a></li></ul></nav><section><h1>Bread, baked at four in the morning</h1><p>Come early.</p></section><footer><p>© Harbour</p></footer></body></html>`,
    }));
    expect(analyze(ir).ai.score).toBeLessThan(25);
  });
});

describe('style system', () => {
  it('every preset meets WCAG AA for its own palette', () => {
    for (const p of listPresets()) {
      const bad = verifyStyle(p).filter((c) => !c.ok);
      expect(bad, `${p.id}: ${bad.map((b) => b.pair + ' ' + b.ratio).join(', ')}`).toEqual([]);
    }
  });

  it('turns a free-text brief into a readable style', () => {
    const r = interpretBrief('quiet and editorial, warm paper tones, serif headlines, terracotta accent, lots of white space');
    expect(r.basePreset).toBe('editorial');
    expect(r.style.layout.density).toBe('airy');
    expect(verifyStyle(r.style).every((c) => c.ok)).toBe(true);
    const dark = interpretBrief('dark technical developer tool, mono type, sharp corners, green');
    expect(dark.style.shape.radius).toBe(0);
    expect(contrast(parseColor(dark.style.colors.fg)!, parseColor(dark.style.colors.bg)!)).toBeGreaterThan(7);
  });

  it('a brief can never produce an unreadable accent', () => {
    for (const b of ['pale yellow on white', 'very light pink', '#ffff00 accent bright']) {
      const r = interpretBrief(b);
      expect(verifyStyle(r.style).filter((c) => !c.ok)).toEqual([]);
    }
  });
});

describe('the consultant', () => {
  it('polish changes only the visual layer; structure is untouched', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { plan, output } = runRedesign(ir, { depth: 'polish', preset: 'swiss' });
    const structural = plan.ops.filter((o) => ['set-pattern', 'reorder', 'merge-sections', 'regroup-nav', 'extract-page'].includes(o.type));
    expect(structural).toEqual([]);
    expect(output.pages[0].sections.map((s) => s.intent)).toEqual(ir.pages[0].sections.map((s) => s.intent));
  });

  it('restructure reorders, merges proof into the hero, trims nav, and varies layouts', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { output } = runRedesign(ir, { depth: 'restructure', preset: 'editorial' });
    const home = output.pages.find((p) => p.route === '/')!;
    expect(home.sections.some((s) => s.intent === 'stats')).toBe(false);
    expect(home.sections[0].attachments.length).toBe(1);
    expect(home.nav.primary.length).toBeLessThanOrEqual(5);
    expect(home.nav.cta?.text).toBe('Get Started');
    const feats = home.sections.find((s) => s.intent === 'features')!;
    expect(feats.pattern).not.toBe('features-grid');
    expect(home.sections[0].content.ctas.filter((c) => c.kind === 'primary')).toHaveLength(1);
    const idx = (i: string) => home.sections.findIndex((s) => s.intent === i);
    expect(idx('testimonials')).toBeLessThan(idx('pricing'));
  });

  it('redesign moves pricing/FAQ to their own pages and keeps them reachable', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { output } = runRedesign(ir, { depth: 'redesign', preset: 'corporate' });
    expect(output.pages.map((p) => p.route)).toEqual(expect.arrayContaining(['/pricing', '/faq']));
    const home = output.pages.find((p) => p.route === '/')!;
    expect([...home.nav.primary, ...home.nav.secondary].some((l) => l.href === 'pricing.html')).toBe(true);
    expect(output.redirects.length).toBeGreaterThan(0);
    const form = home.sections.find((s) => s.intent === 'contact')!.content.form!;
    expect(form.fields.filter((f) => f.group === 'optional').length).toBeGreaterThan(0);
    expect(form.fields).toHaveLength(7); // nothing removed
  });

  it('never loses content: every heading and price survives a full redesign', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { output } = runRedesign(ir, { depth: 'redesign', preset: 'brutalist' });
    const html = [...renderAll(refreshSignals(output)).entries()].filter(([f]) => f.endsWith('.html')).map(([, h]) => h).join('\n');
    for (const needle of ['Everything you need to succeed', 'Lightning Fast', 'Global Scale', '$29/mo', 'Is there a free trial?', 'Emily Rodriguez', 'Send message', 'Up to 3 projects']) {
      expect(html, needle).toContain(needle);
    }
  });

  it('is deterministic and replayable', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const style = getPreset('warm-craft')!;
    const a = planRedesign(ir, { depth: 'redesign', style });
    const b = planRedesign(ir, { depth: 'redesign', style });
    expect(a.ops.map((o) => o.id)).toEqual(b.ops.map((o) => o.id));
    expect(JSON.stringify(applyPlan(ir, a).pages)).toBe(JSON.stringify(applyPlan(ir, b).pages));
  });

  it('rejected changes are really skipped', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const style = getPreset('editorial')!;
    const plan = planRedesign(ir, { depth: 'restructure', style });
    const reorder = plan.ops.find((o) => o.type === 'reorder')!;
    const kept = applyPlan(ir, { ...plan, excluded: [reorder.id] });
    expect(kept.pages[0].sections.map((s) => s.intent).indexOf('pricing')).toBeLessThanOrEqual(kept.pages[0].sections.map((s) => s.intent).indexOf('testimonials') + 2);
    const rejected = planRedesign(ir, { depth: 'restructure', style, excluded: [reorder.id] });
    expect(rejected.excluded).toContain(reorder.id);
  });

  it('manual editor operations override the consultant', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const style = getPreset('editorial')!;
    const base = planRedesign(ir, { depth: 'restructure', style });
    const feat = applyPlan(ir, base).pages[0].sections.find((s) => s.intent === 'features')!;
    const manual = { id: 'manual:p', type: 'set-pattern' as const, page: '/', section: feat.id, params: { pattern: 'features-bento' }, change: { id: 'manual:p', op: 'set-pattern', target: 'x', category: 'structure' as const, impact: 'low' as const, rationale: 'you' } };
    const out = applyPlan(ir, planRedesign(ir, { depth: 'restructure', style, manual: [manual] }));
    expect(out.pages[0].sections.find((s) => s.id === feat.id)!.pattern).toBe('features-bento');
  });

  it('every change carries a reason a client can read', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { plan } = runRedesign(ir, { depth: 'redesign', preset: 'swiss' });
    for (const o of plan.ops) expect(o.change.rationale.length, o.id).toBeGreaterThan(20);
  });

  it('measurably improves both scores on the fixture', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const r = runRedesign(ir, { depth: 'redesign', preset: 'editorial' });
    expect(r.before.ai.score - r.after.ai.score).toBeGreaterThan(50);
    expect(r.after.ux.score).toBeGreaterThan(r.before.ux.score + 40);
  });
});

describe('writing the site', () => {
  it('produces valid, accessible, self-consistent output', async () => {
    const { ir } = await readSite(nodeVfs(FIXTURE));
    const { output } = runRedesign(ir, { depth: 'redesign', preset: 'midnight' });
    const files = renderAll(output);
    const home = files.get('index.html')!;
    expect(home).toMatch(/<html lang="en">/);
    expect(home).toContain('name="viewport"');
    expect(home).toContain('class="m-skip"');
    expect(home.match(/<h1[ >]/g)).toHaveLength(1);
    expect(files.get('morpheus.css')).toContain('--m-accent');
    expect(files.has('pricing.html')).toBe(true);
    expect(files.get('pricing.html')).toContain('<table');
    // no leftover template signature
    expect(home).not.toMatch(/linear-gradient\(135deg/);
  });

  it('writes to disk and copies untouched assets', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'morph-'));
    const src = path.join(tmp, 'src');
    await fs.mkdir(path.join(src, 'img'), { recursive: true });
    await fs.writeFile(path.join(src, 'index.html'), '<html><body><h1>Hi</h1><p>There friend.</p><img src="img/a.png" alt="a"></body></html>');
    await fs.writeFile(path.join(src, 'img/a.png'), 'png');
    const { ir } = await loadSite(src);
    const { output } = runRedesign(ir, { depth: 'restructure', preset: 'swiss' });
    const out = path.join(tmp, 'out');
    await writeSite(output, out, { sourceDir: src });
    expect(await fs.readFile(path.join(out, 'img/a.png'), 'utf8')).toBe('png');
    expect(await fs.readFile(path.join(out, 'index.html'), 'utf8')).toContain('img/a.png');
  });

  it('scopes legacy CSS so kept sections cannot leak styles', () => {
    const out = scopeCss('body{color:red}.card{padding:1px}@media (max-width:1px){.a{x:y}}@keyframes k{from{a:b}}');
    expect(out).toContain('.m-raw{color:red}');
    expect(out).toContain('.m-raw .card');
    expect(out).toContain('.m-raw .a');
  });
});
