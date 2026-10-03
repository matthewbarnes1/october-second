import type { Cta, FormModel, Item, Media, SectionContent } from '@morpheus/core';
import { EMOJI_RE } from '@morpheus/core';
import { El, attr, classes, contains, find, findAll, findAllByTag, findByTag, isEl, kids, outer, signature, tag, textOf } from './dom';

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

export function mediaOf(e: El): Media | null {
  const t = tag(e);
  if (t === 'img') return { kind: 'image', src: attr(e, 'src') ?? attr(e, 'data-src'), alt: attr(e, 'alt') };
  if (t === 'picture') {
    const img = findByTag(e, 'img');
    return img ? mediaOf(img) : null;
  }
  if (t === 'svg') return { kind: 'svg', html: outer(e) };
  if (t === 'video') return { kind: 'video', src: attr(e, 'src') ?? attr(findByTag(e, 'source'), 'src'), html: outer(e) };
  if (t === 'iframe') return { kind: 'embed', src: attr(e, 'src'), html: outer(e) };
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
    fields.push({
      name: attr(el, 'name') ?? id,
      label: labelText || undefined,
      type,
      required: attr(el, 'required') !== undefined || attr(el, 'aria-required') === 'true',
      placeholder: attr(el, 'placeholder'),
      options: tag(el) === 'select' ? findAllByTag(el, 'option').map((o) => norm(textOf(o))) : undefined,
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

  // Form
  const form = findByTag(section, 'form');
  if (form && !inIgnore(form)) content.form = formOf(form);

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
      rep.forEach((r) => repSet.add(r));
    } else if (items.length >= 2) {
      const statLike = items.filter((i) => i.title && STAT_VALUE.test(i.title) && !i.body?.length && false);
      void statLike;
      content.items = items;
      rep.forEach((r) => repSet.add(r));
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
      statBlocks.forEach((e) => repSet.add(e));
    }
  }

  const inRepeater = (e: El) => [...repSet].some((r) => contains(r, e));
  const inForm = (e: El) => !!form && contains(form, e);

  // Heading
  const heading = find(section, (e) => /^h[1-6]$/.test(tag(e)) && !inRepeater(e) && !inForm(e) && !inIgnore(e));
  if (heading) {
    content.heading = norm(textOf(heading));
    content.headingLevel = Number(tag(heading)[1]);
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
      if (txt && txt.length < 80 && looksBadge && !/^h[1-6]$/.test(tag(cand))) content.eyebrow = txt;
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
  });
  // Eyebrow can't be a CTA
  if (content.eyebrow && content.ctas.some((c) => c.text === content.eyebrow)) content.eyebrow = undefined;

  // Paragraphs and sub
  const ctaEls = new Set<El>(btns);
  const paras = findAllByTag(section, 'p').filter((p) => !inRepeater(p) && !inForm(p) && !inIgnore(p) && ![...ctaEls].some((c) => contains(c, p)) && !contains(p, heading ?? {}));
  const ptexts = paras.map((p) => norm(textOf(p))).filter((t) => t && t !== content.eyebrow && t !== content.heading);
  if (ptexts.length) {
    // Sub = the first paragraph if it follows the heading closely
    content.sub = ptexts[0];
    content.paragraphs = ptexts.slice(1);
    if (!content.heading && ptexts.length > 1) { content.sub = undefined; content.paragraphs = ptexts; }
  }

  // Media outside items
  for (const m of findAll(section, (e) => ['img', 'svg', 'video', 'iframe', 'picture'].includes(tag(e)))) {
    if (inRepeater(m) || inForm(m) || inIgnore(m)) continue;
    // svg inside an inline button/link isn't hero media
    if (tag(m) === 'svg' && (ancestorsTag(m, section, ['a', 'button']) || (kids(m).length === 0))) continue;
    if (tag(m) === 'img' && ancestorsTag(m, section, ['picture'])) continue;
    const media = mediaOf(m);
    if (media) content.media.push(media);
  }
  return content;
}

function ancestorsTag(n: El, stop: El, tags: string[]): boolean {
  let p = n.parentNode;
  while (p && p !== stop && isEl(p)) { if (tags.includes(tag(p))) return true; p = p.parentNode; }
  return false;
}

export { outer };
