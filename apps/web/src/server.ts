import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  PATTERNS, deepMerge, detectStack, listPresets, type Depth, type FontSpec, type Operation, type SiteIR, type StyleSpec,
} from '@morpheus/core';
import {
  buildAssets, loadSite, renderPage, rel, resolveStyle, runRedesign, writeSite, nodeVfs, type RunResult,
} from '@morpheus/adapter-html';
import { fileURLToPath } from 'node:url';

const UI_HTML = await fs.readFile(fileURLToPath(new URL('./ui.html', import.meta.url)), 'utf8');

/**
 * Local web app. Serves the editor UI, a JSON API around the same pipeline the CLI uses,
 * and live previews of the original and redesigned site. Binds to localhost only.
 */

interface Session {
  dir: string;
  source: SiteIR;
  last: RunResult | null;
  stack: Awaited<ReturnType<typeof detectStack>>;
}

let session: Session | null = null;
const ROOT = process.env.MORPHEUS_ROOT ?? process.cwd();
const PORT = Number(process.env.PORT ?? 4173);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.xml': 'application/xml',
};

const EDIT_SCRIPT = `<script>(function(){
  var sel=null,hov=null;
  var st=document.createElement('style');
  st.textContent='[data-m-section]{cursor:pointer}[data-m-section].m-hover{outline:2px dashed rgba(80,120,255,.7);outline-offset:-2px}[data-m-section].m-selected{outline:3px solid #4f7cff;outline-offset:-3px}';
  document.head.appendChild(st);
  document.addEventListener('mouseover',function(e){var s=e.target.closest&&e.target.closest('[data-m-section]');if(hov)hov.classList.remove('m-hover');hov=s;if(s)s.classList.add('m-hover');});
  document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('[data-m-section]');if(!s)return;e.preventDefault();select(s.getAttribute('data-m-section'),true);},true);
  function select(id,notify){if(sel)sel.classList.remove('m-selected');sel=document.querySelector('[data-m-section="'+id+'"]');if(sel){sel.classList.add('m-selected');if(!notify)sel.scrollIntoView({behavior:'smooth',block:'center'});}
    if(notify)parent.postMessage({type:'m-select',id:id,route:location.pathname},'*');}
  window.addEventListener('message',function(e){var d=e.data||{};
    if(d.type==='m-vars'){for(var k in d.vars)document.documentElement.style.setProperty(k,d.vars[k]);}
    if(d.type==='m-select')select(d.id,false);});
  parent.postMessage({type:'m-ready',route:location.pathname},'*');
})();</script>`;

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function applyOverrides(style: StyleSpec, o: any): StyleSpec {
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
    profile: r.plan.profile,
    style: r.plan.style,
    contrast: r.contrast,
    styleNotes: r.styleNotes,
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

async function serveFile(res: http.ServerResponse, file: string) {
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

function safeJoin(base: string, rel: string): string | null {
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  return full.startsWith(path.resolve(base)) ? full : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(UI_HTML.replace('__ROOT__', JSON.stringify(ROOT)));
    }

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      return json(res, 200, { root: ROOT, presets: listPresets(), patterns: PATTERNS });
    }

    if (req.method === 'POST' && url.pathname === '/api/load') {
      const body = await readBody(req);
      const dir = path.resolve(ROOT, String(body.path || '.'));
      await fs.access(dir);
      const stack = await detectStack(nodeVfs(dir));
      if (stack.adapterSupport !== 'full') {
        return json(res, 422, { error: `No adapter for ${stack.renderer} yet. Morpheus can currently rewrite static HTML/CSS sites.`, stack });
      }
      const { ir } = await loadSite(dir);
      session = { dir, source: ir, last: null, stack };
      const { analyze } = await import('@morpheus/core');
      const a = analyze(ir);
      return json(res, 200, {
        name: ir.name, dir, stack,
        before: { ai: a.ai, ux: a.ux },
        pages: ir.pages.map((p) => ({ route: p.route, file: p.file, sections: p.sections.length })),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/run') {
      if (!session) return json(res, 400, { error: 'Load a project first.' });
      const b = await readBody(req);
      const depth = (['polish', 'restructure', 'redesign'].includes(b.depth) ? b.depth : 'restructure') as Depth;
      const { style, notes } = resolveStyle({ preset: b.preset || undefined, brief: b.brief || undefined });
      const finalStyle = applyOverrides(style, b.overrides);
      // runRedesign resolves style itself; pass an already-resolved style by monkey-patching the preset path
      const { planRedesign, applyPlan, analyze, verifyStyle } = await import('@morpheus/core');
      const { refreshSignals } = await import('@morpheus/adapter-html');
      const plan = planRedesign(session.source, { depth, style: finalStyle, brief: b.brief, excluded: b.excluded ?? [], manual: (b.manual ?? []) as Operation[] });
      const output = refreshSignals(applyPlan(session.source, plan));
      session.last = { source: session.source, plan, output, before: analyze(session.source), after: analyze(output), styleNotes: notes, contrast: verifyStyle(finalStyle) };
      return json(res, 200, summarise(session.last));
    }

    if (req.method === 'POST' && url.pathname === '/api/export') {
      if (!session?.last) return json(res, 400, { error: 'Run a redesign first.' });
      const b = await readBody(req);
      const out = path.resolve(ROOT, String(b.out || `${session.dir}.morpheus`));
      const written = await writeSite(session.last.output, out, { sourceDir: session.dir });
      await fs.writeFile(path.join(out, 'morpheus-changes.json'), JSON.stringify(session.last.plan.ops.map((o) => o.change), null, 2));
      return json(res, 200, { out, files: written });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/preview/')) {
      if (!session) { res.writeHead(400); return res.end('No project loaded'); }
      const relPath = decodeURIComponent(url.pathname.slice('/preview/'.length)) || 'index.html';
      const mode = url.searchParams.get('mode') ?? 'after';
      const edit = url.searchParams.get('edit') === '1';
      if (mode === 'before') {
        const full = safeJoin(session.dir, relPath);
        return full ? serveFile(res, full) : (res.writeHead(403), res.end());
      }
      const out = session.last?.output;
      if (!out) { res.writeHead(400); return res.end('Run a redesign first'); }
      const { css, legacy } = buildAssets(out);
      if (relPath === 'morpheus.css') { res.writeHead(200, { 'content-type': MIME['.css'], 'cache-control': 'no-store' }); return res.end(css); }
      if (relPath === 'morpheus-legacy.css') { res.writeHead(200, { 'content-type': MIME['.css'], 'cache-control': 'no-store' }); return res.end(legacy); }
      const page = out.pages.find((p) => p.file === relPath);
      if (page) {
        let html = renderPage(out, page, rel(page.file, 'morpheus.css'), { legacyHref: legacy ? rel(page.file, 'morpheus-legacy.css') : undefined });
        // keep same-origin navigation inside the preview, in the same mode
        html = html.replace(/<\/body>/i, `${edit ? EDIT_SCRIPT : ''}</body>`);
        res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
        return res.end(html);
      }
      const full = safeJoin(session.dir, relPath);
      return full ? serveFile(res, full) : (res.writeHead(403), res.end());
    }

    res.writeHead(404); res.end('Not found');
  } catch (e: any) {
    json(res, 500, { error: e?.message ?? String(e) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nMorpheus editor running at http://127.0.0.1:${PORT}\nProject root: ${ROOT}\n`);
});
