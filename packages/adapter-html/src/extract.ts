import type { Cta, FormModel, Item, Media, SectionContent } from '@morpheus/core';
import { EMOJI_RE } from '@morpheus/core';
import { El, attr, classes, contains, find, findAll, findAllByTag, findByTag, isEl, isText, kids, outer, signature, tag, textOf } from './dom';
import { safeUrl, sanitizeFragment, sanitizeNode, sanitizeSvg } from './sanitize';

export interface ExtractCtx {
  /** Class names whose CSS centres text. Built from the stylesheet. */
  centered: Set<string>;
}

const BTN_RE = /\b(btn|button|cta|action)\b|btn-|button-|-btn|-button/i;
const SECONDARY_RE = /outline|secondary|ghost|ghost|tertiary|border|text-link|link|subtle|light|white|alt/i;
const BADGE_CLASS = /badge|pill|eyebrow|kicker|chip|tag|label|overline|announcement|tagline-top|subtitle-top/i;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function isCentered(el: El, ctx: ExtractCtx): boolean {
  const check = (e: El | undefined) => {
    if (!e) return false;
    const cl = classes(e);
    if (cl.some((c) => /(^|[-_:])(text-center|center|centered|centre|mx-auto-center|items-center)($|[-_])/.test(c) || ctx.centered.has(c))) {
      // items-center alone (flex cross-axis) is not text alignment
      if (cl.every((c) => c === 'items-center' || !/center/.test(c))) return cl.some((c) => ctx.centered.has(c));
      return true;
    }
    const st = attr(e, 'style') ?? '';
    return /text-align\s*:\s*center/.test(st);
  };
  const h = find(el, (e) => /^h[1-6]$/.test(tag(e)));
  return check(el) || check(h) || check(h?.parentNode) || check(h?.parentNode?.parentNode);
}

function imgMedia(e: El): Media {
  const src = attr(e, 'src') ?? attr(e, 'data-src');
  return {
    kind: 'image',
    src: src && safeUrl(src) ? src : undefined,
    alt: attr(e, 'alt'),
    srcset: attr(e, 'srcset') ?? attr(e, 'data-srcset'),
    sizes: attr(e, 'sizes'),
    width: attr(e, 'width'),
    height: attr(e, 'height'),
  };
}

export function mediaOf(e: El): Media | null {
  const t = tag(e);
  if (t === 'img') return imgMedia(e);
  if (t === 'picture') {
    const img = findByTag(e, 'img');
    if (!img) return null;
    const m = imgMedia(img);
    m.sources = findAllByTag(e, 'source').map((s) => ({ srcset: attr(s, 'srcset'), media: attr(s, 'media'), type: attr(s, 'type'), sizes: attr(s, 'sizes') })).filter((s) => s.srcset);
    return m;
  }
  if (t === 'svg') return { kind: 'svg', html: sanitizeSvg(e) };
  if (t === 'video' || t === 'audio') {
    const src = attr(e, 'src') ?? attr(findByTag(e, 'source'), 'src');
    return { kind: 'video', src, html: sanitizeFragment(e) };
  }
  if (t === 'iframe') {
    const src = attr(e, 'src') ?? '';
    if (!/^https:\/\//i.test(src)) return null;
    const title = (attr(e, 'title') ?? '').replace(/"/g, '&quot;');
    const q = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return { kind: 'embed', src, html: `<iframe src="${q(src)}" title="${title}" loading="lazy" allowfullscreen referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"></iframe>` };
  }
  return null;
}

export function ctaOf(e: El, index: number): Cta | null {
  const t = tag(e);
  const text = norm(textOf(e));
  if (!text || text.length > 60) return null;
  const href = t === 'a' ? (attr(e, 'href') ?? '') : (attr(e, 'data-href') ?? attr(e, 'formaction') ?? '');
  const cl = classes(e).join(' ');
  let kind: Cta['kind'] = 'primary';
  if (SECONDARY_RE.test(cl)) kind = 'secondary';
  if (/\blink\b|text-link|underline/.test(cl) && !BTN_RE.test(cl.replace(/link/g, ''))) kind = 'link';
  if (index === 0 && kind === 'secondary' && /\bprimary\b/.test(cl)) kind = 'primary';
  return { text, href, kind };
}

function looksLikeButton(e: El): boolean {
  const t = tag(e);
  if (t === 'button') return (attr(e, 'type') ?? 'button') !== 'submit' || true;
  if (t !== 'a') return false;
  const cl = classes(e).join(' ');
  if (BTN_RE.test(cl) || attr(e, 'role') === 'button') return true;
  // Tailwind-style filled/outlined links
  if (/\b(px-\d|py-\d)/.test(cl) && /\b(bg-|border|rounded)/.test(cl)) return true;
  // A lone link in its own paragraph/div with short text is a call to action
  const parent = e.parentNode;
  if (isEl(parent) && ['p', 'div'].includes(tag(parent)) && kids(parent).length <= 3 && textOf(parent).length <= 70 && textOf(e).length <= 36 && kids(parent).every((k) => tag(k) === 'a' || tag(k) === 'button')) return true;
  return false;
}

function leadingGlyph(e: El): { icon?: string; kind?: Item['iconKind'] } {
  const first = kids(e).find((k) => !['script', 'style'].includes(tag(k)));
  if (first) {
    const t = tag(first);
    if (t === 'svg') return { icon: outer(first), kind: 'svg' };
    if (t === 'img') {
      const w = Number(attr(first, 'width') ?? 0);
      if ((w && w <= 96) || /icon/.test(classes(first).join(' '))) return { icon: attr(first, 'src'), kind: 'image' };
    }
    const txt = norm(textOf(first));
    if (txt && txt.length <= 6 && (EMOJI_RE.test(txt) || /icon|emoji|glyph/.test(classes(first).join(' ')))) {
      return { icon: txt, kind: EMOJI_RE.test(txt) ? 'emoji' : 'text' };
    }
    if (t === 'i' && /fa|icon|bi-|lucide|material/.test(classes(first).join(' '))) return { icon: classes(first).join(' '), kind: 'text' };
    const svgIn = kids(first).length === 1 && tag(kids(first)[0]) === 'svg' ? kids(first)[0] : null;
    if (svgIn) return { icon: outer(svgIn), kind: 'svg' };
  }
  return {};
}

const PRICE_RE = /(?:[$€£₹]\s?\d[\d,.]*|\d[\d,.]*\s?(?:\/\s?(?:mo|month|yr|year|user|seat)))|\bfree\b|\bcustom\b|\bcontact (us|sales)\b/i;

export function itemOf(it: El): Item {
  const item: Item = {};
  const cl = classes(it).join(' ');
  if (/popular|featured|recommended|highlight|best|premium|pro\b|active/.test(cl)) item.highlighted = true;

  // FAQ-style <details>
  if (tag(it) === 'details') {
    const sum = findByTag(it, 'summary');
    item.title = norm(textOf(sum));
    const rest = norm(textOf(it, new Set(sum ? [sum] : [])));
    item.body = rest;
    return item;
  }

  const quote = findByTag(it, 'blockquote');
  const isQuote = !!quote || /testimonial|quote|review/.test(cl);
  if (isQuote) {
    const qEl = quote ?? findByTag(it, 'p');
    const qText = norm(textOf(qEl)).replace(/^["“”']|["“”']$/g, '');
    const cite = find(it, (e) => ['cite', 'figcaption', 'footer'].includes(tag(e)) || /author|name|person|cite/.test(classes(e).join(' ')));
    const avatar = findByTag(it, 'img');
    let author = cite ? norm(textOf(cite)) : '';
    let role = '';
    const strong = cite ? findByTag(cite, 'strong', 'b', 'h4', 'h5', 'h6') : find(it, (e) => ['strong', 'b', 'h4', 'h5', 'h6'].includes(tag(e)) && e !== qEl);
    if (strong) {
      author = norm(textOf(strong));
      const after = norm(textOf(cite ?? it, new Set([strong, ...(qEl ? [qEl] : [])]))).replace(author, '').replace(/^[—–\-,·\s]+/, '');
      role = after.slice(0, 80);
    } else if (/[—–-]/.test(author)) {
      const [a, ...r] = author.split(/\s*[—–-]\s*/);
      author = a.replace(/^[—–\-\s]+/, '');
      role = r.join(', ');
    }
    if (qText) {
      item.quote = { text: qText, author: author || undefined, role: role || undefined, avatar: avatar ? mediaOf(avatar) ?? undefined : undefined };
      return item;
    }
  }

  const glyph = leadingGlyph(it);
  if (glyph.icon) { item.icon = glyph.icon; item.iconKind = glyph.kind; }

  const heading = find(it, (e) => /^h[1-6]$/.test(tag(e)) || ['strong', 'b', 'dt'].includes(tag(e)) || /(^|[-_ ])(title|name|heading)($|[-_ ])/.test(classes(e).join(' ')));
  if (heading) item.title = norm(textOf(heading));

  const priceEl = find(it, (e) => /price|amount|cost/.test(classes(e).join(' ')) && textOf(e).length < 40) ?? find(it, (e) => ['span', 'div', 'p', 'strong', 'h2', 'h3', 'h4'].includes(tag(e)) && textOf(e).length < 28 && /[$€£]\s?\d/.test(textOf(e)));
  if (priceEl) item.price = norm(textOf(priceEl));

  const lis = findAllByTag(it, 'li').map((li) => norm(textOf(li))).filter(Boolean);
  if (lis.length) item.bullets = lis;

  const skip = new Set<El>();
  if (heading) skip.add(heading);
  if (priceEl) skip.add(priceEl);
  findAllByTag(it, 'ul', 'ol', 'a', 'button', 'svg', 'img', 'i').forEach((e) => skip.add(e));
  if (item.icon && kids(it)[0]) skip.add(kids(it)[0]);
  const paras = findAllByTag(it, 'p').filter((p) => !skip.has(p) && !contains(priceEl ?? {}, p)).map((p) => norm(textOf(p))).filter(Boolean);
  if (paras.length) item.body = paras.join(' ');
  else {
    const rest = norm(textOf(it, skip));
    const body = item.title ? rest.replace(item.title, '').trim() : rest;
    if (body && body !== item.price) item.body = body.replace(item.price ?? '\u0000', '').trim() || undefined;
  }

  const img = findByTag(it, 'img');
  if (img && !(item.iconKind === 'image')) item.image = mediaOf(img) ?? undefined;
  const link = findByTag(it, 'a');
  if (link) {
    const text = norm(textOf(link));
    const c = ctaOf(link, 0);
    if (c && (looksLikeButton(link) || PRICE_RE.test(item.price ?? ''))) item.cta = c;
    else if (attr(link, 'href')) item.href = attr(link, 'href');
    void text;
  } else {
    const btn = findByTag(it, 'button');
    if (btn) item.cta = ctaOf(btn, 0) ?? undefined;
  }
  if (!item.title && !item.body && !item.image && !item.quote && !item.icon && !item.bullets) return {};
  return item;
}

/** Find the largest group of structurally identical siblings anywhere under `root`. */
export function findRepeater(root: El, exclude: Set<El>): El[] | null {
  const cands: { items: El[]; score: number }[] = [];
  const consider = (container: El) => {
    const children = kids(container).filter((k) => !['script', 'style', 'template'].includes(tag(k)) && !exclude.has(k));
    if (children.length < 2) return;
    const groups = new Map<string, El[]>();
    for (const c of children) {
      const sig = `${tag(c)}|${signature(c, 2)}`;
      const g = groups.get(sig) ?? [];
      g.push(c);
      groups.set(sig, g);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const texty = g.filter((c) => textOf(c).length > 0 || findByTag(c, 'img', 'svg'));
      if (texty.length < 2) continue;
      // Runs of bare paragraphs/spans/links are prose or buttons, not cards.
      if (texty.every((c) => ['p', 'span', 'br', 'strong', 'em'].includes(tag(c)))) continue;
      if (texty.every((c) => tag(c) === 'a' || tag(c) === 'button') && texty.every((c) => textOf(c).length < 30)) continue;
      if (['nav'].includes(tag(container))) continue;
      const chars = texty.reduce((n, c) => n + textOf(c).length, 0);
      cands.push({ items: texty, score: texty.length * 1000 + Math.min(chars, 900) });
    }
  };
  consider(root);
  walkContainers(root, consider);
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  let best = cands[0];
  // Prefer an enclosing repeater (e.g. the pricing cards) over a repeater nested inside them (their bullets).
  for (const outer of cands.slice(1)) {
    if (outer.items.length >= 2 && best.items.every((b) => outer.items.some((o) => contains(o, b) && o !== b))) best = outer;
  }
  return best.items;
}

function walkContainers(n: El, fn: (e: El) => void) {
  for (const c of kids(n)) {
    if (['script', 'style', 'svg', 'form', 'nav'].includes(tag(c))) continue;
    fn(c);
    walkContainers(c, fn);
  }
}

function selectGroups(sel: El): { label?: string; options: string[] }[] {
  const groups: { label?: string; options: string[] }[] = [];
  let loose: string[] = [];
  for (const k of kids(sel)) {
    if (tag(k) === 'optgroup') { if (loose.length) { groups.push({ options: loose }); loose = []; } groups.push({ label: attr(k, 'label'), options: findAllByTag(k, 'option').map((o) => norm(textOf(o))) }); }
    else if (tag(k) === 'option') loose.push(norm(textOf(k)));
  }
  if (loose.length) groups.push({ options: loose });
  return groups;
}

function formOf(f: El): FormModel {
  const fields: FormModel['fields'] = [];
  for (const el of findAll(f, (e) => ['input', 'textarea', 'select'].includes(tag(e)))) {
    const type = tag(el) === 'input' ? (attr(el, 'type') ?? 'text') : tag(el);
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    const id = attr(el, 'id');
    const forLabel = id ? find(f, (e) => tag(e) === 'label' && attr(e, 'for') === id) : undefined;
    let wrap: El | undefined;
    let p = el.parentNode;
    while (p && isEl(p) && p !== f) { if (tag(p) === 'label') { wrap = p; break; } p = p.parentNode; }
    const labelEl = forLabel ?? wrap;
    const labelText = labelEl ? norm(textOf(labelEl, new Set([el]))) : attr(el, 'aria-label');
    let fs: El | undefined;
    for (let q = el.parentNode; q && isEl(q) && q !== f; q = q.parentNode) { if (tag(q) === 'fieldset') { fs = q; break; } }
    const legend = fs ? norm(textOf(findByTag(fs, 'legend'))) : '';
    fields.push({
      fieldset: legend || undefined,
      name: attr(el, 'name') ?? id,
      label: labelText || undefined,
      type,
      required: attr(el, 'required') !== undefined || attr(el, 'aria-required') === 'true',
      placeholder: attr(el, 'placeholder'),
      options: tag(el) === 'select' ? findAllByTag(el, 'option').map((o) => norm(textOf(o))) : undefined,
      value: attr(el, 'value'),
      optionGroups: tag(el) === 'select' ? selectGroups(el) : undefined,
    });
  }
  const submit = find(f, (e) => (tag(e) === 'button' && (attr(e, 'type') ?? 'submit') === 'submit') || (tag(e) === 'input' && attr(e, 'type') === 'submit'));
  const submitText = submit ? (tag(submit) === 'input' ? attr(submit, 'value') ?? 'Submit' : norm(textOf(submit))) : 'Submit';
  return { action: attr(f, 'action'), method: attr(f, 'method'), fields, submitText: submitText || 'Submit' };
}

const STAT_VALUE = /^[\s$€£]*[\d][\d,.]*\s?(?:%|\+|k|m|b|x|×|\/\d+|\s?(?:hrs?|ms|s|min|days?))?\+?$|^[\d.,]+[kKmMbB]?\+?%?$/;

export function extractContent(section: El, ctx: ExtractCtx, ignore: Set<El> = new Set()): SectionContent {
  const content: SectionContent = { paragraphs: [], ctas: [], items: [], media: [], alignment: isCentered(section, ctx) ? 'center' : 'left' };

  const inIgnore = (e: El) => [...ignore].some((i) => contains(i, e));
  /** Elements whose content the structured model now holds. Everything else is carried over as rich content. */
  const consumed = new Set<El>();

  // Form
  const form = findByTag(section, 'form');
  if (form && !inIgnore(form)) { content.form = formOf(form); consumed.add(form); }

  // Repeater
  const exclude = new Set<El>(ignore);
  const rep = findRepeater(section, exclude);
  let repSet = new Set<El>();
  if (rep) {
    const items = rep.map(itemOf).filter((i) => Object.keys(i).length);
    // A repeater that is only images is a logo row / gallery
    const onlyImgs = rep.every((r) => (tag(r) === 'img' || (kids(r).length <= 2 && !!findByTag(r, 'img', 'svg') && textOf(r).length < 14)));
    if (onlyImgs) {
      content.logos = rep.map((r) => (tag(r) === 'img' ? mediaOf(r) : mediaOf(findByTag(r, 'img', 'svg')!))).filter((m): m is Media => !!m);
      rep.forEach((r) => { repSet.add(r); consumed.add(r); });
    } else if (items.length >= 2) {
      const statLike = items.filter((i) => i.title && STAT_VALUE.test(i.title) && !i.body?.length && false);
      void statLike;
      content.items = items;
      // Per item: anything the item model missed (extra paragraphs, labels, nested lists) stays attached to that item.
      rep.forEach((r, i) => {
        repSet.add(r); consumed.add(r);
        const it = content.items[i];
        if (!it) return;
        const have = new Set(tokens(modeledText({ ...emptyBase(), items: [it] })));
        const lo = leftovers(r, new Set(), have);
        if (lo.length) it.extra = lo;
      });
    }
  }

  // Stats: items (or flat children) whose lead text is numeric
  const statSource = content.items.length ? content.items : [];
  if (statSource.length >= 2) {
    const numeric = statSource.filter((i) => {
      const lead = (i.title ?? '').trim();
      const alt = (i.body ?? '').trim();
      return (STAT_VALUE.test(lead) && alt.length < 50) || (STAT_VALUE.test(alt.split(' ')[0] ?? '') && (i.title ?? '').length < 40 && !i.title);
    });
    if (numeric.length === statSource.length) {
      content.stats = statSource.map((i) => ({ value: (i.title ?? '').trim(), label: i.body ?? '' }));
      content.items = [];
    }
  }
  if (!content.stats && !content.items.length && !content.logos) {
    // Flat stat blocks: elements whose own text is only a number-ish token followed by a short label
    const candidates = findAll(section, (e) => ['div', 'li', 'p'].includes(tag(e)) && kids(e).length >= 1 && kids(e).length <= 3);
    const statBlocks = candidates.filter((e) => {
      const ks = kids(e);
      return ks.length >= 2 && STAT_VALUE.test(norm(textOf(ks[0]))) && norm(textOf(ks[1])).length < 50 && norm(textOf(e)).length < 70;
    });
    if (statBlocks.length >= 2) {
      content.stats = statBlocks.map((e) => ({ value: norm(textOf(kids(e)[0])), label: norm(textOf(kids(e)[1])) }));
      statBlocks.forEach((e) => { repSet.add(e); consumed.add(e); });
    }
  }

  const inRepeater = (e: El) => [...repSet].some((r) => contains(r, e));
  const inForm = (e: El) => !!form && contains(form, e);

  // Heading
  const heading = find(section, (e) => /^h[1-6]$/.test(tag(e)) && !inRepeater(e) && !inForm(e) && !inIgnore(e));
  if (heading) {
    content.heading = norm(textOf(heading));
    content.headingLevel = Number(tag(heading)[1]);
    consumed.add(heading);
  }

  // Eyebrow / kicker: a short element before the heading
  if (heading) {
    const container = heading.parentNode;
    const sibs: El[] = isEl(container) ? kids(container) : [];
    const hi = sibs.indexOf(heading);
    const before = sibs.slice(0, hi).reverse().find((s) => !['script', 'style', 'svg', 'img'].includes(tag(s)) && norm(textOf(s)).length > 0);
    const cand = before ?? (isEl(container) && container !== section ? kids(container.parentNode).slice(0, kids(container.parentNode).indexOf(container)).reverse().find((s) => norm(textOf(s)).length > 0 && norm(textOf(s)).length < 70) : undefined);
    if (cand && cand !== heading && !inRepeater(cand)) {
      const txt = norm(textOf(cand));
      const looksBadge = BADGE_CLASS.test(classes(cand).join(' ')) || (['span', 'p', 'div', 'small'].includes(tag(cand)) && txt.length < 60 && !findByTag(cand, 'a', 'button', 'img'));
      if (txt && txt.length < 80 && looksBadge && !/^h[1-6]$/.test(tag(cand))) {
        content.eyebrow = txt;
        consumed.add(cand);
        const cl = classes(cand).join(' ');
        content.eyebrowKind = /badge|pill|chip|announce|rounded-full|rounded-xl|\bborder\b|\bbg-/.test(cl) ? 'pill' : 'kicker';
      }
    }
  }

  // CTAs (outside items and forms)
  const btns = findAll(section, (e) => (tag(e) === 'a' || tag(e) === 'button') && looksLikeButton(e) && !inRepeater(e) && !inForm(e) && !inIgnore(e));
  const seenCta = new Set<string>();
  btns.forEach((b, i) => {
    const c = ctaOf(b, i);
    if (!c) return;
    const k = `${c.text}|${c.href}`;
    if (seenCta.has(k)) return;
    seenCta.add(k);
    content.ctas.push(c);
    consumed.add(b);
  });
  // Eyebrow can't be a CTA
  if (content.eyebrow && content.ctas.some((c) => c.text === content.eyebrow)) content.eyebrow = undefined;

  // Paragraphs and sub. Only free-standing paragraphs: those inside quotes, lists, tables, figures and
  // similar keep their structure and are carried over whole by the coverage pass.
  const ctaEls = new Set<El>(btns);
  const STRUCTURAL = ['blockquote', 'li', 'td', 'th', 'dd', 'dt', 'figure', 'details', 'pre', 'table', 'ul', 'ol', 'dl', 'address', 'fieldset', 'label', 'aside'];
  const paras = findAllByTag(section, 'p').filter((p) => !inRepeater(p) && !inForm(p) && !inIgnore(p) && ![...ctaEls].some((c) => contains(c, p)) && !contains(p, heading ?? {}) && !ancestorsTag(p, section, STRUCTURAL));
  const usedParas: El[] = [];
  const ptexts: string[] = [];
  for (const p of paras) {
    const t = norm(textOf(p));
    if (t && t !== content.eyebrow && t !== content.heading) { ptexts.push(t); usedParas.push(p); }
  }
  if (ptexts.length) {
    // Sub = the first paragraph if it follows the heading closely
    content.sub = ptexts[0];
    content.paragraphs = ptexts.slice(1);
    if (!content.heading && ptexts.length > 1) { content.sub = undefined; content.paragraphs = ptexts; }
    usedParas.forEach((p) => consumed.add(p));
  }

  // Media outside items (including a section that is itself a single media element)
  const mediaEls = ['img', 'svg', 'video', 'audio', 'iframe', 'picture'];
  const candidates = [...(mediaEls.includes(tag(section)) ? [section] : []), ...findAll(section, (e) => mediaEls.includes(tag(e)))];
  for (const m of candidates) {
    if (inRepeater(m) || inForm(m) || inIgnore(m)) continue;
    // svg inside an inline button/link isn't hero media
    if (tag(m) === 'svg' && (ancestorsTag(m, section, ['a', 'button']) || (kids(m).length === 0))) continue;
    if (['img', 'picture'].includes(tag(m)) && ancestorsTag(m, section, ['picture', 'figure', 'table', 'details', 'blockquote', 'button'])) continue;
    if (ancestorsTag(m, section, ['a']) && tag(m) === 'svg') continue;
    const media = mediaOf(m);
    if (media) { content.media.push(media); consumed.add(m); }
  }
  const extra = leftovers(section, consumed);
  if (extra.length) content.extra = extra;
  return content;
}

function emptyBase(): SectionContent {
  return { paragraphs: [], ctas: [], items: [], media: [], alignment: 'left' };
}

// ------------------------------------------------------------------------------------------------
// Coverage guarantee. The structured model only captures what it recognises; whatever it misses is
// carried through as sanitised rich content so a redesign can never silently drop client content.

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu;
export const tokens = (text: string): string[] => (text.toLowerCase().match(TOKEN) ?? []).filter((t) => t.length >= 2);

export function modeledText(c: SectionContent): string {
  const parts: (string | undefined)[] = [c.eyebrow, c.heading, c.sub, ...c.paragraphs, ...c.ctas.map((x) => x.text)];
  for (const it of c.items) parts.push(it.title, it.body, it.meta, it.price, it.quote?.text, it.quote?.author, it.quote?.role, it.cta?.text, ...(it.bullets ?? []), it.image?.alt);
  for (const st of c.stats ?? []) parts.push(st.value, st.label);
  for (const m of [...c.media, ...(c.logos ?? [])]) parts.push(m.alt);
  if (c.form) {
    parts.push(c.form.submitText);
    for (const f of c.form.fields) parts.push(f.label, f.placeholder, f.fieldset, f.value, ...(f.options ?? []), ...(f.optionGroups ?? []).map((g) => g.label));
  }
  return parts.filter(Boolean).join(' \n ');
}

const STRUCT = new Set(['table', 'dl', 'ul', 'ol', 'pre', 'blockquote', 'figure', 'details', 'address', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const INLINE = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'small', 'code', 'mark', 'abbr', 'time', 'label', 'cite', 'q', 'u', 's', 'sub', 'sup', 'kbd']);
const SKIP_RESIDUAL = new Set(['script', 'style', 'noscript', 'template', 'form', 'nav', 'svg', 'button', 'select', 'textarea', 'input']);
const MEDIA_TAGS = new Set(['img', 'picture', 'video', 'audio', 'iframe']);
const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Everything under `root` that is not inside a consumed element, as sanitised blocks in source order.
 * With `have`, a node is skipped when all of its words are already present (used inside small items).
 */
export function leftovers(root: El, consumed: Set<El>, have?: Set<string>): string[] {
  const out: string[] = [];
  const holdsConsumed = new Set<El>();
  for (const c of consumed) for (let a = c.parentNode; a && isEl(a); a = a.parentNode) { if (holdsConsumed.has(a)) break; holdsConsumed.add(a); }
  const wordy = (t: string) => tokens(t).some((x) => !have || !have.has(x));
  const visit = (el: El, depth: number) => {
    if (depth > 60) return;
    for (const node of (el.childNodes ?? []) as any[]) {
      if (isText(node)) {
        const t = (node.value as string).replace(/\s+/g, ' ').trim();
        if (t && wordy(t)) out.push(`<p>${escHtml(t)}</p>`);
        continue;
      }
      if (!isEl(node) || consumed.has(node)) continue;
      const t = tag(node);
      if (SKIP_RESIDUAL.has(t)) continue;
      if (MEDIA_TAGS.has(t)) {
        const m = mediaOf(node);
        const h = m ? (m.kind === 'image' ? sanitizeFragment(node) : m.html ?? '') : '';
        if (h && !have) out.push(h);
        continue;
      }
      const text = textOf(node);
      if (!text && !findByTag(node, 'img', 'picture', 'video', 'audio', 'iframe')) continue;
      if (text && !wordy(text) && !findByTag(node, 'img', 'picture', 'video', 'audio', 'iframe')) continue;
      if (holdsConsumed.has(node)) { visit(node, depth + 1); continue; }
      if (STRUCT.has(t)) { const h = sanitizeFragment(node); if (h) out.push(h); continue; }
      if (INLINE.has(t)) { const h = sanitizeFragment(node); if (h) out.push(`<p>${h}</p>`); continue; }
      visit(node, depth + 1);
    }
  };
  visit(root, 0);
  return out.filter(Boolean).slice(0, 400);
}

const FLOW_LEAF = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'pre', 'table', 'dl', 'blockquote', 'figure', 'details', 'hr', 'address', 'img', 'picture', 'video', 'audio']);

/** Article/documentation bodies keep their natural reading order as sanitised blocks. */
export function flowOf(section: El, skip: Set<El>): string[] {
  const out: string[] = [];
  const visit = (el: El, depth: number) => {
    if (depth > 60) return;
    for (const node of (el.childNodes ?? []) as any[]) {
      if (isText(node)) { const t = (node.value as string).replace(/\s+/g, ' ').trim(); if (t) out.push(`<p>${escHtml(t)}</p>`); continue; }
      if (!isEl(node) || skip.has(node)) continue;
      const t = tag(node);
      if (SKIP_RESIDUAL.has(t) && !(t === 'button')) continue;
      if (t === 'iframe') { const m = mediaOf(node); if (m?.html) out.push(m.html); continue; }
      if (FLOW_LEAF.has(t)) { const h = sanitizeFragment(node); if (h) out.push(h); continue; }
      if (INLINE.has(t) || t === 'button') { const h = sanitizeFragment(node); if (h) out.push(`<p>${h}</p>`); continue; }
      visit(node, depth + 1);
    }
  };
  visit(section, 0);
  return out.slice(0, 2000);
}

function ancestorsTag(n: El, stop: El, tags: string[]): boolean {
  let p = n.parentNode;
  while (p && p !== stop && isEl(p)) { if (tags.includes(tag(p))) return true; p = p.parentNode; }
  return false;
}

export { outer };
