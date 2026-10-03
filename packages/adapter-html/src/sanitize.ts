import { El, attr, isEl, isText, tag } from './dom';

/**
 * Serialises a subtree through an allow-list. Used for content the structured model doesn't capture
 * (code, tables, quotes, lists, media) so it survives the redesign without carrying over scripts,
 * event handlers, inline styles or the original class names.
 */

const ALLOWED = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'colgroup', 'col', 'blockquote', 'cite', 'q', 'figure', 'figcaption', 'details', 'summary', 'hr', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup',
  'mark', 'kbd', 'samp', 'var', 'abbr', 'time', 'a', 'img', 'picture', 'source', 'video', 'audio', 'track', 'span', 'div', 'address', 'dfn', 'del', 'ins', 'wbr', 'data',
]);
const VOID = new Set(['br', 'hr', 'img', 'source', 'track', 'col', 'wbr']);
const DROP = new Set(['script', 'style', 'noscript', 'template', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'svg', 'math', 'canvas', 'form', 'input', 'button', 'select', 'textarea']);
const ATTRS: Record<string, string[]> = {
  '*': ['lang', 'dir', 'title', 'id'],
  a: ['href', 'rel', 'target', 'hreflang', 'download'],
  img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
  source: ['src', 'srcset', 'sizes', 'media', 'type'],
  video: ['src', 'poster', 'controls', 'loop', 'muted', 'playsinline', 'preload', 'width', 'height'],
  audio: ['src', 'controls', 'loop', 'muted', 'preload'],
  track: ['src', 'kind', 'srclang', 'label', 'default'],
  td: ['colspan', 'rowspan', 'headers'], th: ['colspan', 'rowspan', 'scope', 'headers', 'abbr'],
  time: ['datetime'], q: ['cite'], blockquote: ['cite'], details: ['open'], abbr: [], data: ['value'], col: ['span'],
};
const URL_ATTRS = new Set(['href', 'src', 'poster', 'cite']);
const BOOLEAN = new Set(['controls', 'loop', 'muted', 'playsinline', 'open', 'default', 'download']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

export function safeUrl(u: string): boolean {
  const v = u.trim().replace(/[\u0000- ]/g, '').toLowerCase();
  return !(v.startsWith('javascript:') || v.startsWith('vbscript:') || (v.startsWith('data:') && !/^data:image\/(png|jpe?g|gif|webp|avif);/.test(v)));
}

const MAX_DEPTH = 120;

export function sanitizeNode(n: any, depth = 0): string {
  if (depth > MAX_DEPTH) return '';
  if (isText(n)) return esc(n.value ?? '');
  if (!isEl(n)) return '';
  const t = tag(n);
  if (DROP.has(t)) return '';
  const inner = () => ((n.childNodes ?? []) as any[]).map((c) => sanitizeNode(c, depth + 1)).join('');
  if (!ALLOWED.has(t)) return inner(); // unwrap unknown wrappers, keep their content
  const allow = new Set([...(ATTRS['*'] ?? []), ...(ATTRS[t] ?? [])]);
  let attrs = '';
  for (const a of n.attrs ?? []) {
    if (!allow.has(a.name)) continue;
    if (URL_ATTRS.has(a.name) && !safeUrl(a.value)) continue;
    if (a.name === 'srcset' && /javascript:/i.test(a.value)) continue;
    attrs += BOOLEAN.has(a.name) ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`;
  }
  if (t === 'a' && attr(n, 'target') === '_blank') attrs += ' rel="noopener noreferrer"';
  if (t === 'img' && !/ alt=/.test(attrs)) attrs += ' alt=""';
  if (VOID.has(t)) return `<${t}${attrs}>`;
  return `<${t}${attrs}>${inner()}</${t}>`;
}

export function sanitizeFragment(el: El): string {
  return sanitizeNode(el, 0).trim();
}

const SVG_DROP = new Set(['script', 'foreignobject', 'style', 'iframe', 'object', 'embed', 'animate', 'set', 'animatetransform', 'animatemotion']);

/** Inline SVG icons/illustrations: keep geometry and presentation, drop anything executable. */
export function sanitizeSvg(n: any, depth = 0): string {
  if (depth > MAX_DEPTH) return '';
  if (isText(n)) return esc(n.value ?? '');
  if (!isEl(n)) return '';
  const name: string = n.tagName;
  if (SVG_DROP.has(name.toLowerCase())) return '';
  let attrs = '';
  for (const a of n.attrs ?? []) {
    const k = a.name;
    if (/^on/i.test(k) || k === 'style') continue;
    if ((k === 'href' || k === 'xlink:href') && !(a.value.startsWith('#') || /^data:image\/(png|jpe?g|gif|webp);/i.test(a.value))) continue;
    attrs += ` ${k}="${escAttr(a.value)}"`;
  }
  const inner = ((n.childNodes ?? []) as any[]).map((c) => sanitizeSvg(c, depth + 1)).join('');
  return `<${name}${attrs}>${inner}</${name}>`;
}
