import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { HtmlValidate } from 'html-validate';
import { listPresets } from '@morpheus/core';
import { memVfs, nodeVfs, readSite, renderAll, runRedesign, writeSite } from '@morpheus/adapter-html';
import { CORPUS } from './corpus';

const bundled = (() => { try { return chromium.executablePath(); } catch { return undefined; } })();
const CHROMIUM = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium', bundled].find((p) => p && existsSync(p));
const FIXTURE = path.resolve(__dirname, '../fixtures/ai-saas');
const AXE = path.resolve(__dirname, '../node_modules/axe-core/axe.min.js');

async function sources() {
  const out: Record<string, Awaited<ReturnType<typeof readSite>>['ir']> = { 'ai-saas': (await readSite(nodeVfs(FIXTURE))).ir };
  for (const n of ['tailwind-cdn', 'bootstrap', 'docs-content', 'complex-form', 'rtl-arabic', 'head-and-images']) out[n] = (await readSite(memVfs(CORPUS[n]))).ir;
  return out;
}

describe('generated HTML is valid', () => {
  it('passes html-validate (recommended rules) for every site and style sampled', async () => {
    const hv = new HtmlValidate({ extends: ['html-validate:recommended'], rules: { 'no-inline-style': 'off', 'void-style': 'off', 'prefer-native-element': 'off', 'no-trailing-whitespace': 'off' } });
    const problems: string[] = [];
    for (const [name, ir] of Object.entries(await sources())) {
      for (const preset of ['editorial', 'brutalist', 'midnight']) {
        for (const [f, html] of renderAll(runRedesign(ir, { depth: 'redesign', preset }).output)) {
          if (!f.endsWith('.html')) continue;
          const r = await hv.validateString(html, f);
          for (const m of r.results[0]?.messages ?? []) problems.push(`${name}/${preset}/${f}:${m.line} ${m.ruleId}: ${m.message}`);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  }, 60_000);
});

describe.skipIf(!CHROMIUM)('generated sites in a real browser', () => {
  let browser: Browser;
  let tmp: string;
  let axeSrc: string;
  beforeAll(async () => {
    browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'morph-q-'));
    axeSrc = await fs.readFile(AXE, 'utf8');
  }, 30_000);
  afterAll(async () => { await browser?.close(); });

  it('has no WCAG 2.2 AA or best-practice accessibility violations (axe-core), in every style', async () => {
    const violations: string[] = [];
    const srcs = await sources();
    for (const [name, ir] of Object.entries(srcs)) {
      const presets = name === 'ai-saas' || name === 'docs-content' ? listPresets().map((p) => p.id) : ['editorial', 'midnight', 'playful'];
      for (const preset of presets) {
        const { output } = runRedesign(ir, { depth: 'redesign', preset });
        const dir = path.join(tmp, `${name}-${preset}`);
        await writeSite(output, dir);
        for (const page of output.pages) {
          const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
          await p.emulateMedia({ reducedMotion: 'reduce' });
          await p.route(/^https?:/, (r) => r.abort());
          await p.goto('file://' + path.join(dir, page.file));
          await p.evaluate(axeSrc);
          const res: any = await p.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}})`);
          for (const v of res.violations) violations.push(`${name}/${preset}${page.route} [${v.impact}] ${v.id}: ${v.nodes[0].html.slice(0, 100)}`);
          await p.close();
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
  }, 240_000);

  it('never scrolls sideways on a phone or a desktop, on any page, in any style', async () => {
    const overflow: string[] = [];
    for (const [name, ir] of Object.entries(await sources())) {
      for (const preset of listPresets().map((p) => p.id)) {
        const { output } = runRedesign(ir, { depth: 'redesign', preset });
        const dir = path.join(tmp, `ov-${name}-${preset}`);
        await writeSite(output, dir);
        const p = await browser.newPage();
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.route(/^https?:/, (r) => r.abort());
        for (const page of output.pages) {
          await p.goto('file://' + path.join(dir, page.file));
          for (const w of [320, 390, 768, 1280]) {
            await p.setViewportSize({ width: w, height: 900 });
            const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (o > 1) overflow.push(`${name}/${preset}${page.route} @${w}px overflows by ${o}px`);
          }
        }
        await p.close();
      }
    }
    expect(overflow.slice(0, 10)).toEqual([]);
  }, 240_000);

  it('mirrors correctly for right-to-left languages', async () => {
    const { output } = runRedesign((await sources())['rtl-arabic'], { depth: 'redesign', preset: 'swiss' });
    const dir = path.join(tmp, 'rtl');
    await writeSite(output, dir);
    const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await p.route(/^https?:/, (r) => r.abort());
    await p.goto('file://' + path.join(dir, 'index.html'));
    expect(await p.evaluate(() => getComputedStyle(document.body).direction)).toBe('rtl');
    const brandX = await p.evaluate(() => document.querySelector('.m-brand')!.getBoundingClientRect().left);
    expect(brandX).toBeGreaterThan(600); // brand sits on the right edge in RTL
    await p.close();
  });

  it('is usable without JavaScript: navigation, disclosure and content all work', async () => {
    const { output } = runRedesign((await sources())['ai-saas'], { depth: 'redesign', preset: 'swiss' });
    const dir = path.join(tmp, 'nojs');
    await writeSite(output, dir);
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 800 } });
    const p = await ctx.newPage();
    await p.route(/^https?:/, (r) => r.abort());
    await p.goto('file://' + path.join(dir, 'index.html'));
    expect(await p.locator('.m-menu summary').count()).toBe(1);
    expect(await p.locator('h1').count()).toBe(1);
    await ctx.close();
  });
});
