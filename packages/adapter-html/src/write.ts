import { promises as fs } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { extractSignals, googleFontsHref, type Page, type SiteIR } from '@morpheus/core';
import { esc } from './render/blocks';
import { renderFooter, renderHeader } from './render/chrome';
import { componentCss } from './render/css';
import { renderSection } from './render/patterns';

const SKIP_COPY = new Set(['node_modules', '.git', 'dist', 'build', '.morpheus-out', '.next']);

/** Scope legacy rules under `.m-raw` so unmodelled sections keep their look without leaking into the redesign. */
export function scopeCss(css: string, scope = '.m-raw'): string {
  let root: postcss.Root;
  try { root = postcss.parse(css); } catch { return ''; }
  root.walkRules((rule) => {
    const p = rule.parent;
    if (p && p.type === 'atrule' && /keyframes/i.test((p as postcss.AtRule).name)) return;
    rule.selectors = rule.selectors.map((sel) => {
      const s = sel.trim();
      if (/^(html|body|:root)$/i.test(s)) return scope;
      if (s === '*') return `${scope} *`;
      return `${scope} ${s.replace(/^(html|body)\s+/i, '')}`;
    });
  });
  root.walkAtRules((a) => { if (/^(import|charset)$/i.test(a.name)) a.remove(); });
  return root.toString();
}

export function renderPage(ir: SiteIR, page: Page, cssHref: string, opts: { legacyHref?: string; editor?: boolean } = {}): string {
  const fonts = googleFontsHref(ir.style);
  const hasRaw = page.sections.some((s) => s.useRaw);
  const extras = page.headExtras.filter((h) => !/viewport/i.test(h)).join('\n  ');
  const scripts = page.scripts
    .map((s) => {
      const attrs = Object.entries(s.attrs ?? {}).map(([k, v]) => (v === '' ? k : `${k}="${esc(v)}"`)).join(' ');
      return s.src ? `<script src="${esc(s.src)}"${attrs ? ' ' + attrs : ''}></script>` : `<script${attrs ? ' ' + attrs : ''}>${s.inline}</script>`;
    })
    .join('\n');
  const title = page.title || ir.name;
  return `<!doctype html>
<html lang="${esc(page.lang ?? 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  ${page.description ? `<meta name="description" content="${esc(page.description)}">` : ''}
  ${extras}
  ${fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(fonts)}">` : ''}
  <link rel="stylesheet" href="${esc(cssHref)}">
  ${hasRaw && opts.legacyHref ? `<link rel="stylesheet" href="${esc(opts.legacyHref)}">` : ''}
</head>
<body>
  <a class="m-skip" href="#main">Skip to content</a>
  ${renderHeader(page)}
  <main id="main">
${page.sections.map((s, i) => renderSection(s, i)).join('\n')}
  </main>
  ${renderFooter(page)}
${scripts}
</body>
</html>
`;
}

export interface WriteOptions { sourceDir?: string }

export function buildAssets(ir: SiteIR): { css: string; legacy: string } {
  const legacy = ir.behavior.legacyCss && ir.pages.some((p) => p.sections.some((s) => s.useRaw)) ? scopeCss(ir.behavior.legacyCss) : '';
  return { css: componentCss(ir.style), legacy };
}

export function rel(from: string, to: string): string {
  const r = path.posix.relative(path.posix.dirname(from), to);
  return r || to;
}

export function renderAll(ir: SiteIR): Map<string, string> {
  const out = new Map<string, string>();
  const { css, legacy } = buildAssets(ir);
  out.set('morpheus.css', css);
  if (legacy) out.set('morpheus-legacy.css', legacy);
  for (const page of ir.pages) {
    out.set(page.file, renderPage(ir, page, rel(page.file, 'morpheus.css'), { legacyHref: legacy ? rel(page.file, 'morpheus-legacy.css') : undefined }));
  }
  return out;
}

async function copyTree(src: string, dest: string, rootSrc = src): Promise<void> {
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (SKIP_COPY.has(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) { await fs.mkdir(d, { recursive: true }); await copyTree(s, d, rootSrc); continue; }
    if (/\.(html?|css|scss|sass|less)$/i.test(e.name)) continue; // replaced by the redesign
    await fs.copyFile(s, d);
  }
}

export async function writeSite(ir: SiteIR, outDir: string, opts: WriteOptions = {}): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  if (opts.sourceDir) await copyTree(opts.sourceDir, outDir);
  const files = renderAll(ir);
  const written: string[] = [];
  for (const [rel, content] of files) {
    const full = path.join(outDir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
    written.push(rel);
  }
  return written;
}

/** Recompute design signals from what the redesigned site actually ships, so before/after scores compare fairly. */
export function refreshSignals(ir: SiteIR): SiteIR {
  const { css, legacy } = buildAssets(ir);
  const anyRaw = ir.pages.some((p) => p.sections.some((s) => s.useRaw));
  ir.signals = extractSignals(css + (anyRaw ? '\n' + legacy : ''), []);
  return ir;
}
