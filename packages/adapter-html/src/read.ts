import path from 'node:path';
import postcss from 'postcss';
import {
  conventionalPattern, detectStack, emptyContent, extractSignals, getPreset, uid,
  type Page, type Section, type SiteIR, type VFS,
} from '@morpheus/core';
import { classify } from './classify';
import { El, attr, classes, find, findAll, findAllByTag, findByTag, isEl, kids, outer, parseHtml, tag, textOf } from './dom';
import { extractContent, type ExtractCtx } from './extract';
import { parseFooter, parseNav } from './nav';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const IGNORE = /(^|\/)(node_modules|\.git|dist|build|\.morpheus-out|vendor)(\/|$)/;

export interface ReadOptions { name?: string }

function routeOf(file: string): string {
  const base = file.replace(/\\/g, '/').replace(/\.html?$/i, '');
  if (base === 'index') return '/';
  if (base.endsWith('/index')) return '/' + base.slice(0, -6);
  return '/' + base;
}

function centeredClassesFromCss(css: string): Set<string> {
  const set = new Set<string>();
  try {
    postcss.parse(css).walkRules((rule) => {
      let centered = false;
      rule.walkDecls('text-align', (d) => { if (/center/.test(d.value)) centered = true; });
      if (!centered) return;
      for (const sel of rule.selectors) {
        const last = sel.trim().split(/[\s>+~]+/).pop() ?? '';
        for (const m of last.matchAll(/\.([\w-]+)/g)) set.add(m[1]);
      }
    });
  } catch { /* ignore unparsable css */ }
  return set;
}

function topBlocks(body: El): El[] {
  const ok = (e: El) => !['script', 'style', 'noscript', 'link', 'template'].includes(tag(e));
  const SEMANTIC = ['section', 'header', 'footer', 'nav', 'article', 'aside', 'main'];
  const expand = (els: El[], depth: number): El[] => {
    const out: El[] = [];
    for (const e of els) {
      const k = kids(e).filter(ok);
      const t = tag(e);
      const wrapper = t === 'main' || (['div', 'article'].includes(t) && k.length >= 2 && k.some((c) => SEMANTIC.includes(tag(c))));
      const single = ['div', 'main'].includes(t) && k.length === 1 && depth < 4;
      if (depth < 4 && (wrapper || single)) out.push(...expand(k, depth + 1));
      else out.push(e);
    }
    return out;
  };
  return groupLoose(expand(kids(body).filter(ok), 0));
}

const LOOSE = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'img', 'picture', 'ul', 'ol', 'dl', 'a', 'button', 'span', 'blockquote', 'figure', 'form', 'table', 'pre', 'svg', 'video', 'iframe', 'small', 'strong', 'em', 'br', 'hr']);

/**
 * Content placed directly in <body> (no section wrappers) arrives as a run of loose elements.
 * Group each run into one synthetic block so it is modelled as a single section, not shredded.
 */
function groupLoose(blocks: El[]): El[] {
  const out: El[] = [];
  let run: El[] = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1 && !['p', 'a', 'span', 'img', 'br', 'hr'].includes(tag(run[0]))) { out.push(run[0]); run = []; return; }
    const box: any = { nodeName: 'div', tagName: 'div', attrs: [], namespaceURI: run[0].namespaceURI, childNodes: [], parentNode: run[0].parentNode };
    for (const el of run) { el.parentNode = box; box.childNodes.push(el); }
    out.push(box);
    run = [];
  };
  for (const b of blocks) {
    if (LOOSE.has(tag(b))) run.push(b);
    else { flush(); out.push(b); }
  }
  flush();
  return out;
}

function modeledChars(c: Section['content']): number {
  let n = (c.heading?.length ?? 0) + (c.sub?.length ?? 0) + (c.eyebrow?.length ?? 0);
  n += c.paragraphs.reduce((a, b) => a + b.length, 0);
  n += c.ctas.reduce((a, b) => a + b.text.length, 0);
  for (const i of c.items) n += (i.title?.length ?? 0) + (i.body?.length ?? 0) + (i.quote?.text.length ?? 0) + (i.price?.length ?? 0) + (i.bullets ?? []).reduce((a, b) => a + b.length, 0);
  for (const s of c.stats ?? []) n += s.value.length + s.label.length;
  if (c.form) n += c.form.fields.length * 12;
  return n;
}

export interface ReadResult { ir: SiteIR; css: string; htmlFiles: string[] }

export async function readSite(vfs: VFS, opts: ReadOptions = {}): Promise<ReadResult> {
  const stack = await detectStack(vfs);
  const all = (await vfs.list()).filter((p) => !IGNORE.test(p));
  const htmlFiles = all.filter((p) => /\.html?$/i.test(p)).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  const warnings: string[] = [];
  if (!htmlFiles.length) warnings.push('No HTML files found; nothing to read.');

  const docs: { file: string; doc: any }[] = [];
  let css = '';
  const classNames: string[] = [];
  for (const file of htmlFiles) {
    const src = await vfs.read(file);
    if (!src) continue;
    const doc = parseHtml(src);
    docs.push({ file, doc });
    for (const style of findAllByTag(doc, 'style')) css += '\n' + (style.childNodes ?? []).map((n: any) => n.value ?? '').join('');
    for (const link of findAll(doc, (e) => tag(e) === 'link' && /stylesheet/i.test(attr(e, 'rel') ?? ''))) {
      const href = attr(link, 'href');
      if (!href || /^(https?:)?\/\//.test(href)) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), href.split('?')[0]));
      const text = await vfs.read(resolved);
      if (text) css += '\n' + text;
      else warnings.push(`Stylesheet ${href} referenced in ${file} was not found.`);
    }
    walkAll(doc, (e) => { classNames.push(...classes(e)); const st = attr(e, 'style'); if (st) css += `\n.__inline{${st}}`; });
  }
  const signals = extractSignals(css, [...new Set(classNames)]);
  const ctx: ExtractCtx = { centered: centeredClassesFromCss(css) };

  const pages: Page[] = [];
  const scriptsAll: Page['scripts'] = [];
  for (const { file, doc } of docs) {
    const htmlEl = findByTag(doc, 'html');
    const head = findByTag(doc, 'head');
    const body = findByTag(doc, 'body');
    if (!body) continue;
    const title = norm(textOf(findByTag(head ?? doc, 'title')));
    const metas = head ? findAllByTag(head, 'meta', 'link') : [];
    const description = metas.map((m) => (attr(m, 'name') === 'description' ? attr(m, 'content') : undefined)).find(Boolean);
    const headExtras = metas
      .filter((m) => {
        const t = tag(m);
        if (t === 'meta') {
          const name = (attr(m, 'name') ?? attr(m, 'property') ?? '').toLowerCase();
          return /viewport|og:|twitter:|theme-color|robots|author|keywords/.test(name) ;
        }
        return /icon|canonical|manifest|apple-touch/.test(attr(m, 'rel') ?? '');
      })
      .map((m) => outer(m));

    const scripts: Page['scripts'] = [];
    for (const s of findAllByTag(doc, 'script')) {
      const src = attr(s, 'src');
      const inline = (s.childNodes ?? []).map((n: any) => n.value ?? '').join('');
      if (src && /cdn\.tailwindcss\.com|tailwindcss/.test(src)) continue;
      if (!src && /tailwind\.config|tailwind\s*=/.test(inline)) continue;
      if (!src && !inline.trim()) continue;
      const attrs: Record<string, string> = {};
      for (const a of s.attrs ?? []) if (a.name !== 'src') attrs[a.name] = a.value;
      scripts.push({ src, inline: src ? undefined : inline, attrs });
    }
    scriptsAll.push(...scripts);

    let blocks = topBlocks(body);
    // Header
    let navEl: El | undefined;
    let headerSkip = new Set<El>();
    const first = blocks[0];
    if (first) {
      const t = tag(first);
      const hasNav = t === 'nav' || !!findByTag(first, 'nav');
      const bigHeading = find(first, (e) => /^h[1-2]$/.test(tag(e)));
      if (t === 'nav' || (t === 'header' && (!bigHeading || (hasNav && textOf(first).length < 300)))) {
        navEl = first; blocks = blocks.slice(1);
      } else if (t === 'header' && hasNav && bigHeading) {
        navEl = findByTag(first, 'nav'); headerSkip = new Set([navEl!]);
      } else if (hasNav && !bigHeading && textOf(first).length < 400) {
        navEl = first; blocks = blocks.slice(1);
      }
    }
    // Footer
    let footerEl: El | undefined;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    if (last && (tag(last) === 'footer' || /\bfooter\b/i.test(classes(last).join(' ') + ' ' + (attr(last, 'id') ?? '')))) {
      footerEl = last; blocks = blocks.slice(0, lastIdx);
    }
    const brandFallback = norm(textOf(navEl ? (findByTag(navEl, 'a') ?? navEl) : doc)).slice(0, 40) || opts.name || 'Site';
    const nav = parseNav(navEl, brandFallback);
    const footer = parseFooter(footerEl);

    const sections: Section[] = [];
    const hasH1 = (b: El) => !!find(b, (e) => tag(e) === 'h1');
    blocks.forEach((b, i) => {
      const skip = i === 0 && headerSkip.size ? headerSkip : new Set<El>();
      if (!textOf(b, skip).length && !findByTag(b, 'img', 'svg', 'video', 'iframe', 'form')) return; // decorative
      const content = extractContent(b, ctx, skip);
      const cls = classify(b, content, { isFirst: sections.length === 0, isLast: i === blocks.length - 1, hasH1: hasH1(b), index: sections.length });
      const raw = outer(b);
      const total = textOf(b, skip).length;
      const modeled = modeledChars(content);
      const useRaw = total > 160 && modeled / total < 0.4;
      const section: Section = {
        id: uid('sec'),
        anchor: attr(b, 'id') ?? undefined,
        intent: cls.intent,
        confidence: cls.confidence,
        pattern: conventionalPattern(cls.intent, content.alignment, content.media.length > 0),
        variant: { tone: 'plain', spacing: 'normal', align: content.alignment },
        content,
        rawHtml: raw,
        useRaw,
        origin: { tag: tag(b), classes: classes(b) },
        attachments: [],
        notes: useRaw ? [`Only ${Math.round((modeled / Math.max(total, 1)) * 100)}% of this section's text could be modelled; original markup is kept.`] : [],
      };
      if (content.logos?.length && cls.intent !== 'logos') section.attachments = [];
      sections.push(section);
    });

    // Content that used to be in a combined header+hero gets the nav CTA only once
    pages.push({
      id: uid('page'),
      route: routeOf(file),
      file,
      title,
      description,
      lang: htmlEl ? attr(htmlEl, 'lang') : undefined,
      nav,
      sections,
      footer,
      chrome: { header: 'header-bar', footer: 'footer-columns' },
      headExtras,
      scripts,
    });
  }

  let name = opts.name ?? pages[0]?.nav.brand.text ?? 'site';
  if (name.length > 40) name = pages[0]?.title.split(/[|–—·-]/)[0].trim() || 'site';

  const ir: SiteIR = {
    version: 1,
    name,
    stack,
    pages,
    style: inferStyle(),
    signals,
    behavior: {
      scripts: dedupeScripts(scriptsAll),
      note: 'Scripts are carried over unchanged. Selectors they depend on may no longer match once markup is rebuilt; review interactive features after redesign.',
      legacyCss: css,
    },
    redirects: [],
    changeLog: [],
    warnings,
  };
  return { ir, css, htmlFiles };
}

function inferStyle() {
  const base = structuredClone(getPreset('corporate')!);
  base.id = 'original';
  base.name = 'Original';
  base.description = 'The visual design the site arrived with (approximated).';
  return base;
}

function dedupeScripts(s: Page['scripts']): Page['scripts'] {
  const seen = new Set<string>();
  return s.filter((x) => {
    const k = x.src ?? x.inline ?? '';
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function walkAll(n: any, fn: (e: El) => void) {
  for (const c of kids(n)) { fn(c); walkAll(c, fn); }
}

void emptyContent; void isEl;
