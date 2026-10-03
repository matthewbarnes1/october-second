import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { sanitizeStyle, validateManualOps, getPreset, deepMerge, tokensCss } from '@morpheus/core';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = 4300 + Math.floor(Math.random() * 400) * 2;
let proc: ChildProcess;
let root: string;
let token = '';

/** Raw HTTP so we can set Host/Origin exactly as an attacker's browser or proxy would. */
function req(port: number, method: string, p: string, opts: { headers?: Record<string, string>; body?: string | Buffer } = {}): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host: `127.0.0.1:${port}`, ...opts.headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}
const api = (p: string, body?: unknown, extra: Record<string, string> = {}) =>
  req(PORT, body === undefined ? 'GET' : 'POST', p, { headers: { 'x-morpheus-token': token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'morph-sec-'));
  await fs.mkdir(path.join(root, 'site'), { recursive: true });
  await fs.writeFile(path.join(root, 'site/index.html'), '<html><body><h1>Hello</h1><p>World of friends.</p></body></html>');
  await fs.writeFile(path.join(root, 'site/.env'), 'SECRET=hunter2');
  await fs.mkdir(path.join(root, 'outside'));
  await fs.writeFile(path.join(root, 'outside/private.txt'), 'top secret');
  await fs.symlink(path.join(root, 'outside/private.txt'), path.join(root, 'site/link.txt'));
  const projectRoot = path.join(root, 'workspace');
  await fs.mkdir(projectRoot);
  await fs.rename(path.join(root, 'site'), path.join(projectRoot, 'site'));
  await fs.symlink(path.join(root, 'outside/private.txt'), path.join(projectRoot, 'site/link.txt')).catch(() => {});
  root = projectRoot;
  proc = spawn(path.join(REPO, 'node_modules/.bin/tsx'), ['apps/web/src/server.ts'], { cwd: REPO, env: { ...process.env, MORPHEUS_ROOT: root, PORT: String(PORT) }, stdio: 'pipe' });
  for (let i = 0; i < 60; i++) {
    try { const r = await req(PORT, 'GET', '/'); if (r.status === 200) { token = /const TOKEN = "([a-f0-9]+)"/.exec(r.body)?.[1] ?? ''; break; } } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
}, 30_000);

afterAll(() => { proc?.kill(); });

describe('local server: request forgery and rebinding', () => {
  it('serves the editor with a per-launch token and a strict CSP', async () => {
    expect(token).toMatch(/^[a-f0-9]{48}$/);
    const r = await req(PORT, 'GET', '/');
    expect(r.headers['content-security-policy']).toMatch(/script-src 'nonce-/);
    expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers['x-frame-options']).toBe('DENY');
  });

  it('sandboxes the preview iframe so a previewed site cannot navigate the editor', async () => {
    const r = await req(PORT, 'GET', '/');
    const tag = /<iframe id="frame"[^>]*>|fw\.innerHTML = '([^']*iframe[^']*)'/.exec(r.body)?.[0] ?? '';
    expect(tag).toMatch(/sandbox="/);
    expect(tag).not.toMatch(/allow-top-navigation/);
  });

  it('refuses API calls without the token (a malicious web page cannot know it)', async () => {
    const r = await req(PORT, 'POST', '/api/load', { headers: { 'content-type': 'application/json' }, body: '{"path":"site"}' });
    expect(r.status).toBe(401);
  });

  it('refuses text/plain "simple request" bodies even with the token', async () => {
    const r = await req(PORT, 'POST', '/api/load', { headers: { 'x-morpheus-token': token, 'content-type': 'text/plain' }, body: '{"path":"site"}' });
    expect(r.status).toBe(415);
  });

  it('refuses a cross-origin Origin header', async () => {
    const r = await api('/api/meta', undefined, { origin: 'https://evil.example' });
    expect(r.status).toBe(403);
  });

  it('refuses a spoofed Host header (DNS rebinding)', async () => {
    const r = await req(PORT, 'GET', '/api/meta', { headers: { host: 'attacker.example', 'x-morpheus-token': token } });
    expect(r.status).toBe(421);
    const p = await req(PORT + 1, 'GET', '/preview/index.html', { headers: { host: 'attacker.example' } });
    expect(p.status).toBe(421);
  });

  it('rejects oversized bodies', async () => {
    const r = await req(PORT, 'POST', '/api/run', { headers: { 'x-morpheus-token': token, 'content-type': 'application/json' }, body: 'a'.repeat(2 * 1024 * 1024) }).catch((e) => ({ status: 413, body: String(e) }));
    expect([413, 400]).toContain(r.status);
  });
});

describe('local server: file access is confined', () => {
  it('will not load a project outside the root', async () => {
    expect((await api('/api/load', { path: '../outside' })).status).toBe(403);
    expect((await api('/api/load', { path: '/etc' })).status).toBe(403);
  });

  it('loads a project inside the root', async () => {
    const r = await api('/api/load', { path: 'site' });
    expect(r.status).toBe(200);
    expect((await api('/api/run', { preset: 'swiss', depth: 'restructure' })).status).toBe(200);
  });

  it('previews live on a different origin than the editor', async () => {
    const page = await req(PORT + 1, 'GET', '/preview/index.html?mode=after&edit=1');
    expect(page.status).toBe(200);
    expect(page.headers['content-security-policy']).toContain('frame-ancestors');
    expect((await req(PORT, 'GET', '/preview/index.html')).status).toBe(404);
  });

  it('does not serve dotfiles, traversal paths or symlinks that escape the project', async () => {
    expect((await req(PORT + 1, 'GET', '/preview/.env?mode=before')).status).toBe(404);
    expect((await req(PORT + 1, 'GET', '/preview/%2e%2e/outside/private.txt?mode=before')).status).toBe(404);
    expect((await req(PORT + 1, 'GET', '/preview/link.txt?mode=before')).status).toBe(403);
  });

  it('only exports inside the root, never over foreign files or the source', async () => {
    expect((await api('/api/export', { out: '../escape' })).status).toBe(403);
    expect((await api('/api/export', { out: '/tmp/morph-pwn' })).status).toBe(403);
    expect((await api('/api/export', { out: 'site' })).status).toBe(400);
    expect([400, 403]).toContain((await api('/api/export', { out: '.' })).status);
    await fs.mkdir(path.join(root, 'precious'));
    await fs.writeFile(path.join(root, 'precious/keep.txt'), 'x');
    expect((await api('/api/export', { out: 'precious' })).status).toBe(409);
    const ok = await api('/api/export', { out: 'site.morpheus' });
    expect(ok.status).toBe(200);
    const files = await fs.readdir(path.join(root, 'site.morpheus'));
    expect(files).toEqual(expect.arrayContaining(['index.html', 'morpheus.css']));
    expect(files).not.toContain('.env');
    expect(files).not.toContain('link.txt'); // symlink target never copied
    expect((await api('/api/export', { out: 'site.morpheus' })).status).toBe(200); // own folder may be refreshed
  });
});

describe('untrusted values never reach generated CSS or files', () => {
  it('sanitizeStyle neutralises CSS injection in colours, fonts and strings', () => {
    const evil = deepMerge(getPreset('swiss')!, {
      colors: { accent: 'red;} body{display:none} .x{' as any },
      type: { display: { family: "x;} *{display:none} a{", fallback: 'serif', weights: [400], google: true } },
      shape: { shadow: 'none; } @import url(//evil.example/x.css)' as any, border: 'url(javascript:alert(1))' as any },
    } as any);
    const s = sanitizeStyle(evil, getPreset('swiss')!);
    const strings: string[] = [];
    (function walk(v: unknown) { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); })(s);
    for (const str of strings) expect(str, str).not.toMatch(/display:none|@import|javascript:|url\(|[;{}<>\\]/);
    expect(tokensCss(s)).not.toMatch(/display:none|@import|javascript:/);
    expect(s.type.display.family).toBe(getPreset('swiss')!.type.display.family);
    expect(s.colors.accent).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clamps absurd numbers', () => {
    const s = sanitizeStyle(deepMerge(getPreset('swiss')!, { space: { sectionY: 99999, container: -5 }, shape: { radius: 1e9 }, type: { scale: NaN } } as any), getPreset('swiss')!);
    expect(s.space.sectionY).toBeLessThanOrEqual(240);
    expect(s.space.container).toBeGreaterThanOrEqual(600);
    expect(s.shape.radius).toBeLessThanOrEqual(64);
    expect(Number.isFinite(s.type.scale)).toBe(true);
  });

  it('only accepts the editor operations it should, with validated parameters', () => {
    const mk = (type: string, params: any, extra: any = {}) => ({ id: 'manual:t', type, page: '/', section: 'sec_1', params, change: { rationale: 'r' }, ...extra });
    const { ops, rejected } = validateManualOps([
      mk('set-pattern', { pattern: 'features-bento' }),
      mk('set-pattern', { pattern: '../../etc' }),
      mk('extract-page', { file: '../../x.html', route: '/x' }),
      mk('set-align', { align: 'sideways' }),
      mk('set-rhythm', { sections: [{ id: 'a', tone: 'inverse', spacing: 'tight' }] }),
      mk('reorder', { order: ['a', 'b'] }),
      { ...mk('set-pattern', { pattern: 'faq-accordion' }), id: 'not-manual' },
    ]);
    expect(ops.map((o) => o.type)).toEqual(['set-pattern', 'set-rhythm', 'reorder']);
    expect(rejected).toHaveLength(4);
  });

  it('prototype-pollution keys are ignored by deepMerge', () => {
    const polluted = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
    deepMerge({ a: 1 } as any, polluted);
    expect(({} as any).polluted).toBeUndefined();
  });
});
