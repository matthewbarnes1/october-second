import { parse, serializeOuter } from 'parse5';

export type Node = any;
export type El = any;

export function parseHtml(html: string): Node {
  return parse(html);
}

export const isEl = (n: Node): n is El => !!n && typeof n.tagName === 'string';
export const isText = (n: Node): boolean => !!n && n.nodeName === '#text';
export const tag = (n: Node): string => (isEl(n) ? n.tagName.toLowerCase() : '');

export function attr(n: Node, name: string): string | undefined {
  if (!isEl(n)) return undefined;
  const a = n.attrs?.find((x: any) => x.name === name);
  return a?.value;
}

export function classes(n: Node): string[] {
  return (attr(n, 'class') ?? '').split(/\s+/).filter(Boolean);
}

export function kids(n: Node): El[] {
  return ((n?.childNodes ?? []) as Node[]).filter(isEl);
}

export function walk(n: Node, fn: (e: El) => boolean | void): void {
  for (const c of kids(n)) {
    if (fn(c) === false) continue;
    walk(c, fn);
  }
}

export function findAll(n: Node, pred: (e: El) => boolean): El[] {
  const out: El[] = [];
  walk(n, (e) => { if (pred(e)) out.push(e); });
  return out;
}

export function find(n: Node, pred: (e: El) => boolean): El | undefined {
  let hit: El | undefined;
  walk(n, (e) => {
    if (hit) return false;
    if (pred(e)) { hit = e; return false; }
  });
  return hit;
}

export function findByTag(n: Node, ...tags: string[]): El | undefined {
  return find(n, (e) => tags.includes(tag(e)));
}

export function findAllByTag(n: Node, ...tags: string[]): El[] {
  return findAll(n, (e) => tags.includes(tag(e)));
}

const SKIP_TEXT = new Set(['script', 'style', 'noscript', 'template']);

export function textOf(n: Node, skip?: Set<Node>): string {
  let out = '';
  const rec = (x: Node) => {
    if (skip?.has(x)) return;
    if (isText(x)) { out += x.value; return; }
    if (isEl(x)) {
      const t = tag(x);
      if (SKIP_TEXT.has(t)) return;
      if (t === 'br') { out += ' '; return; }
      const block = /^(p|div|li|h[1-6]|section|article|tr|ul|ol|blockquote|figure|dt|dd|footer|header|nav)$/.test(t);
      if (block) out += ' ';
      for (const c of x.childNodes ?? []) rec(c);
      if (block) out += ' ';
    }
  };
  rec(n);
  return out.replace(/\s+/g, ' ').trim();
}

export function outer(n: Node): string {
  return serializeOuter(n);
}

export function ancestors(n: Node): El[] {
  const out: El[] = [];
  let p = n?.parentNode;
  while (p && isEl(p)) { out.push(p); p = p.parentNode; }
  return out;
}

export function contains(root: Node, target: Node): boolean {
  let p = target;
  while (p) { if (p === root) return true; p = p.parentNode; }
  return false;
}

/** Elements that carry no content of their own. */
export function isDecor(n: Node): boolean {
  return ['script', 'style', 'link', 'meta', 'noscript', 'template', 'br', 'hr'].includes(tag(n));
}

export function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** A structural fingerprint used to find repeated siblings (cards, list items, etc.). */
export function signature(n: Node, depth = 2): string {
  if (!isEl(n)) return '';
  const own = tag(n);
  if (depth === 0) return own;
  const parts: string[] = [];
  for (const k of kids(n).filter((x) => !isDecor(x))) {
    const sig = signature(k, depth - 1);
    if (parts[parts.length - 1] !== sig) parts.push(sig); // collapse runs, so 3 bullets match 4 bullets
  }
  return `${own}(${parts.join(',')})`;
}
