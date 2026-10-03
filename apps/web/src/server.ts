import http from 'node:http';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PATTERNS, analyze, applyPlan, deepMerge, detectStack, listPresets, planRedesign, validateManualOps, verifyStyle,
  type Depth, type FontSpec, type SiteIR, type StyleSpec,
} from '@morpheus/core';
import {
  buildAssets, loadSite, nodeVfs, refreshSignals, rel, renderPage, resolveStyle, writeSite, type RunResult,
} from '@morpheus/adapter-html';

/**
 * Local web app. The editor and the previews are served from two different origins (two ports)
 * so that scripts inside a previewed site, which is untrusted input, can never reach the editor API.
 * Every API call needs a per-launch token, a JSON content type, a same-origin Origin header and an
 * allow-listed Host header (CSRF and DNS-rebinding protection). File access is confined to the project root.
 */

interface Session { dir: string; source: SiteIR; last: RunResult | null; webFonts: boolean }

const UI_HTML = await fs.readFile(fileURLToPath(new URL('./ui.html', import.meta.url)), 'utf8');
const ROOT = await fs.realpath(path.resolve(process.env.MORPHEUS_ROOT ?? process.cwd()));
const PORT = Number(process.env.PORT ?? 4173);
const PREVIEW_PORT = PORT + 1;
const TOKEN = crypto.randomBytes(24).toString('hex');
const MAX_BODY = 1024 * 1024;
const EDITOR_ORIGIN = `http://127.0.0.1:${PORT}`;
const PREVIEW_ORIGIN = `http://127.0.0.1:${PREVIEW_PORT}`;

let session: Session | null = null;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

class HttpError extends Error { constructor(public code: number, msg: string) { super(msg); } }

const hostOk = (req: http.IncomingMessage, port: number) => {
  const h = (req.headers.host ?? '').toLowerCase();
  return h === `127.0.0.1:${port}` || h === `localhost:${port}`;
};

const EDIT_SCRIPT = `<script>(function(){
  var P=${JSON.stringify(EDITOR_ORIGIN)};
  var sel=null,hov=null;
  var st=document.createElement('style');
  st.textContent='[data-m-section]{cursor:pointer}[data-m-section].m-hover{outline:2px dashed rgba(80,120,255,.7);outline-offset:-2px}[data-m-section].m-selected{outline:3px solid #4f7cff;outline-offset:-3px}';
  document.head.appendChild(st);
  document.addEventListener('mouseover',function(e){var s=e.target.closest&&e.target.closest('[data-m-section]');if(hov)hov.classList.remove('m-hover');hov=s;if(s)s.classList.add('m-hover');});
  document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('[data-m-section]');if(!s)return;e.preventDefault();select(s.getAttribute('data-m-section'),true);},true);
  function select(id,notify){if(sel)sel.classList.remove('m-selected');sel=document.querySelector('[data-m-section="'+id+'"]');if(sel){sel.classList.add('m-selected');if(!notify)sel.scrollIntoView({behavior:'smooth',block:'center'});}
    if(notify)parent.postMessage({type:'m-select',id:id,route:location.pathname},P);}
  window.addEventListener('message',function(e){if(e.origin!==P)return;var d=e.data||{};
    if(d.type==='m-vars'){var ok=/^--m-[a-z0-9-]+$/;for(var k in d.vars){if(ok.test(k)&&/^[#\\w .,()%-]{1,80}$/.test(String(d.vars[k])))document.documentElement.style.setProperty(k,d.vars[k]);}}
    if(d.type==='m-select')select(String(d.id),false);});
  parent.postMessage({type:'m-ready',route:location.pathname},P);
})();</script>`;

function send(res: http.ServerResponse, code: number, body: string | Buffer, headers: Record<string, string> = {}) {
  res.writeHead(code, { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', ...headers });
  res.end(body);
}
const json = (res: http.ServerResponse, code: number, body: unknown) => send(res, code, JSON.stringify(body), { 'content-type': 'application/json; charset=utf-8' });

async function readJson(req: http.IncomingMessage): Promise<any> {
  if (!/^application\/json(\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'Content-Type must be application/json.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request body too large.');
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw, (k, v) => (k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v)); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
}

/** Resolve `p` against `base` and require the real (symlink-resolved) path to stay inside `base`. */
async function contained(base: string, p: string, mustExist = true): Promise<string> {
  const full = path.resolve(base, p);
  let real = full;
  try { real = await fs.realpath(full); } catch (e) { if (mustExist) throw new HttpError(404, 'Not found.'); }
  const b = await fs.realpath(base);
  if (real !== b && !real.startsWith(b + path.sep)) throw new HttpError(403, 'That path is outside the allowed folder.');
  return real;
}

function applyOverrides(style: StyleSpec, o: unknown): StyleSpec {
  if (!o || typeof o !== 'object') return style;
  const patch: any = structuredClone(o);
  for (const k of ['display', 'body', 'mono'] as const) {
    const v = patch.type?.[k];
    if (typeof v === 'string') {
      const base: FontSpec = (style.type as any)[k] ?? style.type.body;
      patch.type[k] = { ...base, family: v, google: true };
    }
  }
  return deepMerge(style, patch);
}

function summarise(r: RunResult) {
  return {
    ops: r.plan.ops.map((o) => ({ type: o.type, page: o.page, section: o.section, ...o.change, manual: o.id.startsWith('manual:') })),
    profile: r.plan.profile, style: r.plan.style, contrast: r.contrast, styleNotes: r.styleNotes,
    before: { ai: r.before.ai.score, aiLevel: r.before.ai.level, ux: r.before.ux.score },
    after: { ai: r.after.ai.score, aiLevel: r.after.ai.level, ux: r.after.ux.score },
    remaining: r.after.ai.hits.map((h) => ({ id: h.id, title: h.title, evidence: h.evidence.slice(0, 2) })),
    uxFindings: r.after.ux.findings.slice(0, 12),
    warnings: r.output.warnings,
    pages: r.output.pages.map((p) => ({
      route: p.route, file: p.file, title: p.title,
      sections: p.sections.map((s) => ({ id: s.id, intent: s.intent, pattern: s.pattern, heading: s.content.heading ?? s.content.items[0]?.title ?? s.intent, tone: s.variant.tone, spacing: s.variant.spacing, align: s.variant.align, useRaw: s.useRaw })),
    })),
  };
}

const MARKER = '.morpheus-export';

async function safeExportTarget(requested: string, sourceDir: string): Promise<string> {
  const out = path.resolve(ROOT, requested);
  const parent = await contained(ROOT, path.dirname(out));
  const target = path.join(parent, path.basename(out));
  const src = await fs.realpath(sourceDir);
  if (target === ROOT) throw new HttpError(400, 'Choose a subfolder, not the project root.');
  if (target === src || src.startsWith(target + path.sep) || target.startsWith(src + path.sep)) throw new HttpError(400, 'The export folder cannot contain or sit inside the source project.');
  let entries: string[] = [];
  try { entries = await fs.readdir(target); } catch { /* new folder */ }
  if (entries.length && !entries.includes(MARKER)) throw new HttpError(409, 'That folder already has files that Morpheus did not create. Choose a new folder.');
  return target;
}

// ------------------------------------------------------------------------------------ editor server
const editor = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req, PORT)) return send(res, 421, 'Misdirected request');
    const url = new URL(req.url ?? '/', EDITOR_ORIGIN);

    if (req.method === 'GET' && url.pathname === '/') {
      const nonce = crypto.randomBytes(16).toString('base64');
      const html = UI_HTML
        .replace(/__NONCE__/g, nonce)
        .replace('__ROOT__', JSON.stringify(ROOT).replace(/</g, '\\u003c'))
        .replace('__TOKEN__', JSON.stringify(TOKEN))
        .replace(/__PREVIEW__/g, PREVIEW_ORIGIN);
      return send(res, 200, html, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; connect-src 'self'; frame-src ${PREVIEW_ORIGIN}; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        'x-frame-options': 'DENY',
      });
    }

    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-morpheus-token'] !== TOKEN) throw new HttpError(401, 'Missing or invalid token.');
      const origin = req.headers.origin;
      if (origin && origin !== EDITOR_ORIGIN && origin !== `http://localhost:${PORT}`) throw new HttpError(403, 'Cross-origin request refused.');

      if (req.method === 'GET' && url.pathname === '/api/meta') return json(res, 200, { root: ROOT, presets: listPresets(), patterns: PATTERNS });

      if (req.method === 'POST' && url.pathname === '/api/load') {
        const body = await readJson(req);
        const dir = await contained(ROOT, String(body.path || '.'));
        if (!(await fs.stat(dir)).isDirectory()) throw new HttpError(400, 'That path is not a folder.');
        const stack = await detectStack(nodeVfs(dir));
        if (stack.adapterSupport !== 'full') {
          return json(res, 422, { error: `No adapter for ${stack.renderer} yet. Morpheus can currently rewrite static HTML/CSS sites.`, stack });
        }
        const { ir } = await loadSite(dir);
        if (!ir.pages.length) throw new HttpError(422, 'No HTML pages found in that folder.');
        session = { dir, source: ir, last: null, webFonts: true };
        const a = analyze(ir);
        return json(res, 200, { name: ir.name, dir, stack, warnings: ir.warnings, before: { ai: a.ai, ux: a.ux }, pages: ir.pages.map((p) => ({ route: p.route, file: p.file, sections: p.sections.length })) });
      }

      if (req.method === 'POST' && url.pathname === '/api/run') {
        if (!session) throw new HttpError(400, 'Load a project first.');
        const b = await readJson(req);
        const depth = (['polish', 'restructure', 'redesign'].includes(b.depth) ? b.depth : 'restructure') as Depth;
        const { style, notes } = resolveStyle({ preset: typeof b.preset === 'string' ? b.preset : undefined, brief: typeof b.brief === 'string' ? b.brief.slice(0, 600) : undefined });
        const finalStyle = applyOverrides(b.dark === true ? { ...style, darkMode: 'auto' as const } : style, b.overrides);
        session.webFonts = b.webFonts !== false;
        const { ops: manual, rejected } = validateManualOps(b.manual);
        const excluded = Array.isArray(b.excluded) ? b.excluded.filter((x: unknown) => typeof x === 'string').slice(0, 500) : [];
        const plan = planRedesign(session.source, { depth, style: finalStyle, brief: typeof b.brief === 'string' ? b.brief : undefined, excluded, manual });
        const output = refreshSignals(applyPlan(session.source, plan));
        session.last = { source: session.source, plan, output, before: analyze(session.source), after: analyze(output), styleNotes: [...notes, ...rejected.map((r) => `Ignored an edit: ${r}`)], contrast: verifyStyle(plan.style) };
        return json(res, 200, summarise(session.last));
      }

      if (req.method === 'POST' && url.pathname === '/api/export') {
        if (!session?.last) throw new HttpError(400, 'Run a redesign first.');
        const b = await readJson(req);
        const out = await safeExportTarget(String(b.out || `${path.basename(session.dir)}.morpheus`), session.dir);
        const written = await writeSite(session.last.output, out, { sourceDir: session.dir, webFonts: session.webFonts });
        await fs.writeFile(path.join(out, 'morpheus-changes.json'), JSON.stringify(session.last.plan.ops.map((o) => o.change), null, 2));
        await fs.writeFile(path.join(out, MARKER), 'Created by Morpheus. Safe to overwrite on re-export.\n');
        return json(res, 200, { out, files: written });
      }
      throw new HttpError(404, 'Unknown API route.');
    }
    send(res, 404, 'Not found');
  } catch (e: any) {
    if (e instanceof HttpError) return json(res, e.code, { error: e.message });
    console.error(e);
    json(res, 500, { error: 'Internal error.' });
  }
});

// ----------------------------------------------------------------------------------- preview server
const DENY_SEGMENT = /^(\.|node_modules$)/i;

const preview = http.createServer(async (req, res) => {
  try {
    if (!hostOk(req, PREVIEW_PORT)) return send(res, 421, 'Misdirected request');
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed');
    const url = new URL(req.url ?? '/', PREVIEW_ORIGIN);
    if (!url.pathname.startsWith('/preview/') || !session) return send(res, 404, 'Not found');
    const relPath = decodeURIComponent(url.pathname.slice('/preview/'.length)) || 'index.html';
    if (relPath.split('/').some((seg) => DENY_SEGMENT.test(seg) || seg === '..')) return send(res, 404, 'Not found');
    const mode = url.searchParams.get('mode') === 'before' ? 'before' : 'after';
    const edit = url.searchParams.get('edit') === '1';
    const common = { 'content-security-policy': `frame-ancestors ${EDITOR_ORIGIN} http://localhost:${PORT}` };

    const asset = async () => {
      const full = await contained(session!.dir, relPath);
      const st = await fs.stat(full);
      if (!st.isFile()) throw new HttpError(404, 'Not found.');
      send(res, 200, await fs.readFile(full), { ...common, 'content-type': MIME[path.extname(full).toLowerCase()] ?? 'application/octet-stream' });
    };

    if (mode === 'before') return await asset();

    const out = session.last?.output;
    if (!out) return send(res, 409, 'Run a redesign first');
    const { css, legacy } = buildAssets(out);
    if (relPath === 'morpheus.css') return send(res, 200, css, { ...common, 'content-type': MIME['.css'] });
    if (relPath === 'morpheus-legacy.css') return send(res, 200, legacy, { ...common, 'content-type': MIME['.css'] });
    const page = out.pages.find((p) => p.file === relPath);
    if (page) {
      let html = renderPage(out, page, rel(page.file, 'morpheus.css'), { legacyHref: legacy ? rel(page.file, 'morpheus-legacy.css') : undefined, webFonts: session.webFonts });
      if (edit) html = html.replace(/<\/body>/i, `${EDIT_SCRIPT}</body>`);
      return send(res, 200, html, { ...common, 'content-type': MIME['.html'] });
    }
    return await asset();
  } catch (e: any) {
    if (e instanceof HttpError) return send(res, e.code, e.message);
    console.error(e);
    send(res, 500, 'Internal error');
  }
});

for (const s of [editor, preview]) { s.requestTimeout = 30_000; s.headersTimeout = 10_000; s.maxHeadersCount = 50; }
editor.listen(PORT, '127.0.0.1', () => {
  preview.listen(PREVIEW_PORT, '127.0.0.1', () => {
    console.log(`\nMorpheus editor   ${EDITOR_ORIGIN}\nMorpheus previews ${PREVIEW_ORIGIN}  (separate origin on purpose)\nProject root      ${ROOT}\n`);
  });
});
