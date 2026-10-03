import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import {
  AI_TELLS_VERSION, analyze, compileTellPack, darkColors, getPreset, listPresets, listTells, loadTellPack, sanitizeStyle, unregisterTell, verifyStyle,
} from '@morpheus/core';
import { memVfs, readSite, renderAll, runRedesign, writeSite } from '@morpheus/adapter-html';
import { CORPUS } from './corpus';

const bundled = (() => { try { return chromium.executablePath(); } catch { return undefined; } })();
const CHROMIUM = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', bundled].find((p) => p && existsSync(p));
const registered: string[] = [];
afterEach(() => { registered.splice(0).forEach(unregisterTell); });

describe('the AI-tell checklist tracks current patterns', () => {
  it('is versioned and reports its version', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    expect(AI_TELLS_VERSION).toMatch(/^\d{4}\.\d+$/);
    expect(analyze(ir).ai.version).toBe(AI_TELLS_VERSION);
  });

  it('catches glassmorphism, dark-slate glow, icon tiles, AI copy cadence and sparkle emoji on a typical 2025-26 generated page', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const ids = analyze(ir).ai.hits.map((h) => h.id);
    for (const id of ['glassmorphism', 'dark-slate-glow', 'icon-tiles', 'ai-copy-cadence', 'sparkle-emoji']) expect(ids, id).toContain(id);
  });

  it('does not flag a distinctive hand-built page for any of the new rules', async () => {
    const { ir } = await readSite(memVfs({ 'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Harbour Bakery: bread since 1987</title><style>:root{--bread:#c9a063}body{font-family:Fraunces,serif;background:#fffaf0;color:#2b1d12}h1{font-size:64px}</style></head>
      <body><section><h1>Bread, baked at four in the morning</h1><p>Come early. The first loaves are out by six and they are gone by nine.</p><a class="btn" href="/visit">Find the shop</a></section></body></html>` }));
    const hits = analyze(ir).ai.hits.map((h) => h.id);
    for (const id of ['glassmorphism', 'dark-slate-glow', 'icon-tiles', 'ai-copy-cadence', 'sparkle-emoji', 'shadcn-default-theme', 'glow-shadows', 'stock-placeholder-images']) expect(hits, id).not.toContain(id);
  });

  it('detects shadcn default tokens and placeholder image hosts', async () => {
    const { ir } = await readSite(memVfs({ 'index.html': `<html><head><style>:root{--background:0 0% 100%;--foreground:222 47% 11%;--primary:222 47% 11%;--primary-foreground:210 40% 98%;--muted:210 40% 96%;--muted-foreground:215 16% 47%;--card:0 0% 100%;--border:214 32% 91%;--ring:222 84% 5%;--radius:.5rem}</style></head><body><section><h1>Hi there</h1><p>Welcome friends.</p><img src="https://i.pravatar.cc/150?img=3" alt="Ann"></section></body></html>` }));
    const ids = analyze(ir).ai.hits.map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(['shadcn-default-theme', 'stock-placeholder-images']));
  });

  it('a redesign clears the structural and visual tells it is responsible for', async () => {
    const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
    const r = runRedesign(ir, { depth: 'redesign', preset: 'editorial' });
    const left = r.after.ai.hits.map((h) => h.id);
    for (const id of ['glassmorphism', 'dark-slate-glow', 'icon-tiles', 'purple-blue-gradient', 'gradient-text', 'glow-blobs', 'pill-badges', 'centered-hero-pills']) expect(left, id).not.toContain(id);
    expect(r.after.ai.score).toBeLessThan(r.before.ai.score - 40);
  });
});

describe('tell packs: extend the detector without a code release', () => {
  it('compiles a valid pack and applies it', async () => {
    const pack = { name: 'test', version: '1', tells: [{ id: 'neo-bold-claim', title: 'Overused "10x" claim', area: 'copy', weight: 5, text: ['\\b10x\\b'] }] };
    const { rules, errors } = compileTellPack(pack);
    expect(errors).toEqual([]);
    expect(rules).toHaveLength(1);
    const r = loadTellPack(pack);
    registered.push('neo-bold-claim');
    expect(r.added).toBe(1);
    expect(listTells().some((t) => t.id === 'neo-bold-claim' && !t.builtin)).toBe(true);
    const { ir } = await readSite(memVfs({ 'index.html': '<html><body><h1>Ship 10x faster</h1><p>Really quite fast.</p></body></html>' }));
    expect(analyze(ir).ai.hits.map((h) => h.id)).toContain('neo-bold-claim');
  });

  it('reports problems precisely and refuses unsafe or malformed rules', () => {
    const { rules, errors } = compileTellPack({ tells: [
      { id: 'Bad Id', title: 'x', text: ['a'] },
      { id: 'no-title', text: ['a'] },
      { id: 'bad-regex', title: 'x', text: ['(unclosed'] },
      { id: 'too-long', title: 'x', text: ['a'.repeat(400)] },
      { id: 'empty', title: 'x' },
      { id: 'ok-rule', title: 'fine', classes: ['backdrop-blur'] },
    ] });
    expect(rules.map((r) => r.id)).toEqual(['ok-rule']);
    expect(errors).toHaveLength(5);
    expect(compileTellPack('nonsense').errors[0]).toMatch(/tells/);
  });
});

describe('modern output options', () => {
  it('can ship a verified dark colour scheme for every light preset', () => {
    for (const p of listPresets()) {
      const s = { ...p, darkMode: 'auto' as const };
      const bad = verifyStyle(s).filter((c) => !c.ok);
      expect(bad, `${p.id}: ${bad.map((b) => `${b.pair} ${b.ratio}`).join(', ')}`).toEqual([]);
    }
    const light = getPreset('editorial')!;
    expect(darkColors(light).bg).not.toBe(light.colors.bg);
  });

  it('emits prefers-color-scheme CSS and a color-scheme meta only when asked', async () => {
    const { ir } = await readSite(memVfs(CORPUS['head-and-images']));
    const off = renderAll(runRedesign(ir, { depth: 'restructure', preset: 'editorial' }).output);
    const on = renderAll(runRedesign(ir, { depth: 'restructure', preset: 'editorial', dark: true }).output);
    expect(off.get('morpheus.css')).not.toContain('prefers-color-scheme');
    expect(on.get('morpheus.css')).toContain('prefers-color-scheme: dark');
    expect(on.get('index.html')).toContain('content="light dark"');
  });

  it('can omit hosted web fonts entirely (privacy, speed)', async () => {
    const { ir } = await readSite(memVfs(CORPUS['head-and-images']));
    const res = runRedesign(ir, { depth: 'restructure', preset: 'editorial' });
    expect(renderAll(res.output).get('index.html')).toContain('fonts.googleapis.com');
    const html = renderAll(res.output, { webFonts: false }).get('index.html')!;
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('adds Open Graph and Twitter card tags when a page has none, and keeps existing ones', async () => {
    const bare = await readSite(memVfs({ 'index.html': '<html lang="en"><head><title>Plain page title here</title></head><body><h1>Plain</h1><p>Some words to describe the page.</p></body></html>' }));
    const html = renderAll(runRedesign(bare.ir, { depth: 'restructure', preset: 'swiss' }).output).get('index.html')!;
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card"');
    const rich = await readSite(memVfs(CORPUS['head-and-images']));
    const h2 = renderAll(runRedesign(rich.ir, { depth: 'restructure', preset: 'swiss' }).output).get('index.html')!;
    expect(h2.match(/property="og:title"/g)).toHaveLength(1);
  });

  it('sanitising a style keeps darkMode a known value', () => {
    expect(sanitizeStyle({ ...getPreset('swiss')!, darkMode: 'evil' as any }).darkMode).toBe('off');
  });

  it.skipIf(!CHROMIUM)('dark scheme passes axe in a real browser (WCAG 2.2 AA)', async () => {
    const axeSrc = await fs.readFile(path.resolve(__dirname, '../node_modules/axe-core/axe.min.js'), 'utf8');
    const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'morph-dark-'));
    const problems: string[] = [];
    try {
      const { ir } = await readSite(memVfs(CORPUS['tailwind-cdn']));
      for (const preset of listPresets().map((p) => p.id)) {
        const { output } = runRedesign(ir, { depth: 'redesign', preset, dark: true });
        const dir = path.join(tmp, preset);
        await writeSite(output, dir, { webFonts: false });
        const ctx = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
        const p = await ctx.newPage();
        await p.route(/^https?:/, (r) => r.abort());
        await p.goto('file://' + path.join(dir, 'index.html'));
        await p.evaluate(axeSrc);
        const res: any = await p.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}})`);
        for (const v of res.violations) problems.push(`${preset} ${v.id}: ${v.nodes[0].html.slice(0, 90)} :: ${(v.nodes[0].any[0]?.message ?? '').slice(0, 120)}`);
        await ctx.close();
      }
    } finally { await browser.close(); }
    expect(problems.slice(0, 8)).toEqual([]);
  }, 180_000);
});
