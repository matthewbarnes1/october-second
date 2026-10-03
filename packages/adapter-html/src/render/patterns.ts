import type { Item, PatternId, Section } from '@morpheus/core';
import { attachments, btn, ctas, esc, extra, form, headBlock, itemHref, marker, media, num, paragraphs, renderState } from './blocks';

type R = (s: Section) => string;

const wrapTop = (s: Section, inner: string, cls = '') => `<div class="m-container ${cls}">${inner}</div>`;

// ----------------------------------------------------------------------------- HERO
const heroCentered: R = (s) =>
  wrapTop(s, `<div class="m-hero m-hero-centered">${headBlock(s)}${ctas(s.content.ctas)}${attachments(s)}${s.content.media[0] ? media(s.content.media[0], 'm-hero-media') : ''}</div>`);

const heroSplit: R = (s) => {
  const art = s.content.media[0]
    ? media(s.content.media[0], 'm-hero-media')
    : s.attachments.some((a) => a.kind === 'stats') ? `<div class="m-hero-panel">${attachments({ ...s, attachments: s.attachments.filter((a) => a.kind === 'stats') } as Section)}</div>` : `<div class="m-hero-art" aria-hidden="true"></div>`;
  const logos = s.attachments.filter((a) => a.kind === 'logos');
  return wrapTop(s, `<div class="m-hero m-hero-split"><div class="m-hero-text">${headBlock(s)}${ctas(s.content.ctas)}${logos.length ? attachments({ ...s, attachments: logos } as Section) : ''}</div><div class="m-hero-side">${art}</div></div>`);
};

const heroEditorial: R = (s) =>
  wrapTop(s, `<div class="m-hero m-hero-editorial"><div class="m-hero-main">${s.content.eyebrow ? `<p class="m-eyebrow">${esc(s.content.eyebrow)}</p>` : ''}${s.content.heading ? `<h1 class="m-h m-h1" id="h-${esc(s.id)}">${esc(s.content.heading)}</h1>` : ''}</div><div class="m-hero-aside">${s.content.sub ? `<p class="m-sub">${esc(s.content.sub)}</p>` : ''}${paragraphs(s.content.paragraphs)}${ctas(s.content.ctas)}</div>${s.content.media[0] ? `<div class="m-hero-wide">${media(s.content.media[0], 'm-hero-media')}</div>` : ''}${attachments(s)}</div>`);

const heroProof: R = (s) =>
  wrapTop(s, `<div class="m-hero m-hero-proof${s.content.media[0] ? '' : ' m-hero-solo'}"><div class="m-hero-text">${headBlock(s)}${ctas(s.content.ctas)}</div>${s.content.media[0] ? `<div class="m-hero-side">${media(s.content.media[0], 'm-hero-media')}</div>` : ''}<div class="m-hero-proofbar">${attachments(s)}</div></div>`);

const heroStatement: R = (s) =>
  wrapTop(s, `<div class="m-hero m-hero-statement">${s.content.eyebrow ? `<p class="m-eyebrow">${esc(s.content.eyebrow)}</p>` : ''}${s.content.heading ? `<h1 class="m-h m-h1" id="h-${esc(s.id)}">${esc(s.content.heading)}</h1>` : ''}<div class="m-hero-row">${s.content.sub ? `<p class="m-sub">${esc(s.content.sub)}</p>` : ''}${ctas(s.content.ctas)}</div>${attachments(s)}${s.content.media[0] ? media(s.content.media[0], 'm-hero-media') : ''}</div>`);

// ----------------------------------------------------------------------------- FEATURES
const itemBody = (it: Item) => `${it.body ? `<p>${esc(it.body)}</p>` : ''}${it.extra?.length ? `<div class="m-prose m-item-extra">${it.extra.join('')}</div>` : ''}${it.bullets?.length ? `<ul class="m-bullets">${it.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}`;
const itemLink = (it: Item) => { const h = itemHref(it); return h ? `<a class="m-link" href="${esc(h)}">${it.cta ? esc(it.cta.text) : 'Read more'}</a>` : ''; };

const featuresGrid: R = (s) =>
  wrapTop(s, `${headBlock(s)}<div class="m-grid m-grid-${Math.min(s.content.items.length, 4) || 3}">${s.content.items.map((it, i) => `<article class="m-card">${it.image ? media(it.image, 'm-card-img') : marker(it, i, true)}${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}${itemLink(it)}</article>`).join('')}</div>`);

const featuresAlternating: R = (s) =>
  wrapTop(s, `${headBlock(s)}<div class="m-rows">${s.content.items.map((it, i) => `<article class="m-row${i % 2 ? ' m-row-flip' : ''}"><div class="m-row-lead">${marker(it, i, false)}${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}</div><div class="m-row-body">${itemBody(it)}${itemLink(it)}</div>${it.image ? `<div class="m-row-media">${media(it.image)}</div>` : ''}</article>`).join('')}</div>`);

const featuresIndexed: R = (s) =>
  wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<ol class="m-index-list">${s.content.items.map((it, i) => `<li><span class="m-index" aria-hidden="true">${num(i)}</span><div>${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}${itemLink(it)}</div></li>`).join('')}</ol></div>`);

const BENTO: Record<number, number[]> = { 4: [4, 2, 3, 3], 5: [3, 3, 2, 2, 2], 6: [4, 2, 2, 2, 3, 3], 7: [3, 3, 2, 2, 2, 3, 3] };
const featuresBento: R = (s) => {
  const spans = BENTO[s.content.items.length] ?? s.content.items.map(() => 2);
  return wrapTop(s, `${headBlock(s)}<div class="m-bento">${s.content.items.map((it, i) => `<article class="m-tile m-span-${spans[i] ?? 2}${i === 0 ? ' m-tile-lead' : ''}">${marker(it, i, false)}${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}${it.image ? media(it.image, 'm-tile-img') : ''}${itemLink(it)}</article>`).join('')}</div>`);
};

// ----------------------------------------------------------------------------- STEPS / STATS
const stepsTimeline: R = (s) =>
  wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<ol class="m-timeline">${s.content.items.map((it, i) => `<li><span class="m-step-n" aria-hidden="true">${i + 1}</span><div>${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}</div></li>`).join('')}</ol></div>`);

const stepsColumns: R = (s) =>
  wrapTop(s, `${headBlock(s)}<ol class="m-steps-cols m-cols-${Math.min(s.content.items.length, 4)}">${s.content.items.map((it, i) => `<li><span class="m-big-n" aria-hidden="true">${i + 1}</span>${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}</li>`).join('')}</ol>`);

const statsBlock = (s: Section, large: boolean) =>
  wrapTop(s, `${s.content.heading ? headBlock(s) : ''}<dl class="m-stats${large ? ' m-stats-large' : ''}">${(s.content.stats ?? []).map((x) => `<div><dd>${esc(x.value)}</dd><dt>${esc(x.label)}</dt></div>`).join('')}</dl>`);

// ----------------------------------------------------------------------------- TESTIMONIALS
const attribution = (it: Item) => it.quote ? `<footer class="m-attrib">${it.quote.avatar ? media(it.quote.avatar, 'm-avatar') : ''}<span><strong>${esc(it.quote.author)}</strong>${it.quote.role ? `<span class="m-role">${esc(it.quote.role)}</span>` : ''}</span></footer>` : '';

const quotePull: R = (s) => {
  const it = s.content.items[0];
  return wrapTop(s, `<figure class="m-pull"><blockquote><p>${esc(it?.quote?.text)}</p></blockquote>${it ? attribution(it) : ''}</figure>`);
};
const quoteWall: R = (s) =>
  wrapTop(s, `${headBlock(s)}<div class="m-wall">${s.content.items.map((it) => `<figure class="m-quote"><blockquote><p>${esc(it.quote?.text)}</p></blockquote>${attribution(it)}</figure>`).join('')}</div>`);
const quoteGrid: R = (s) =>
  wrapTop(s, `${headBlock(s)}<div class="m-grid m-grid-3">${s.content.items.map((it) => `<figure class="m-card m-quote"><blockquote><p>${esc(it.quote?.text)}</p></blockquote>${attribution(it)}</figure>`).join('')}</div>`);

// ----------------------------------------------------------------------------- PRICING
const priceCta = (it: Item) => it.cta ? btn({ ...it.cta, kind: it.highlighted ? 'primary' : 'secondary' }) : '';
const pricingCards: R = (s) =>
  wrapTop(s, `${headBlock(s)}<div class="m-grid m-grid-${Math.min(s.content.items.length, 4) || 3} m-pricing">${s.content.items.map((it) => `<article class="m-card m-plan${it.highlighted ? ' m-plan-hl' : ''}">${it.highlighted ? '<p class="m-flag">Recommended</p>' : ''}${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${it.price ? `<p class="m-price">${esc(it.price)}</p>` : ''}${it.body ? `<p>${esc(it.body)}</p>` : ''}${it.bullets?.length ? `<ul class="m-ticks">${it.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${priceCta(it)}</article>`).join('')}</div>`);

const pricingTable: R = (s) => {
  const tiers = s.content.items;
  const feats: string[] = [];
  for (const t of tiers) for (const b of t.bullets ?? []) if (!feats.includes(b)) feats.push(b);
  const head = `<tr><th scope="col"><span class="m-sr">Feature</span></th>${tiers.map((t) => `<th scope="col"${t.highlighted ? ' class="m-hl"' : ''}>${esc(t.title)}${t.highlighted ? '<span class="m-flag">Recommended</span>' : ''}<span class="m-price">${esc(t.price)}</span></th>`).join('')}</tr>`;
  const rows = feats.map((f) => `<tr><th scope="row">${esc(f)}</th>${tiers.map((t) => `<td${t.highlighted ? ' class="m-hl"' : ''}>${(t.bullets ?? []).includes(f) ? '<span class="m-yes" aria-hidden="true">●</span><span class="m-sr">Included</span>' : '<span class="m-no" aria-hidden="true">–</span><span class="m-sr">Not included</span>'}</td>`).join('')}</tr>`).join('');
  const foot = `<tr><td></td>${tiers.map((t) => `<td${t.highlighted ? ' class="m-hl"' : ''}>${priceCta(t)}</td>`).join('')}</tr>`;
  return wrapTop(s, `${headBlock(s)}<div class="m-table-wrap"><table class="m-table"><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>`);
};

// ----------------------------------------------------------------------------- FAQ
const faqAccordion: R = (s) =>
  wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<div class="m-faq">${s.content.items.map((it) => `<details><summary>${esc(it.title)}</summary><p>${esc(it.body)}</p></details>`).join('')}</div></div>`);
const faqTwoCol: R = (s) =>
  wrapTop(s, `${headBlock(s)}<dl class="m-qa">${s.content.items.map((it) => `<div><dt>${esc(it.title)}</dt><dd>${esc(it.body)}</dd></div>`).join('')}</dl>`);

// ----------------------------------------------------------------------------- CTA / CONTACT
const ctaBand: R = (s) => wrapTop(s, `<div class="m-cta-band">${headBlock(s)}${form(s.content.form, s.id)}${ctas(s.content.ctas)}</div>`);
const ctaInline: R = (s) => wrapTop(s, `<div class="m-cta-inline"><div>${s.content.heading ? `<p class="m-h m-h3">${esc(s.content.heading)}</p>` : ''}${s.content.sub ? `<p class="m-sub">${esc(s.content.sub)}</p>` : ''}</div>${ctas(s.content.ctas)}</div>`);
const ctaSplit: R = (s) => wrapTop(s, `<div class="m-split">${headBlock(s)}<div>${form(s.content.form, s.id)}${ctas(s.content.ctas)}</div></div>`);

const contactSplit: R = (s) =>
  wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<div>${paragraphs(s.content.paragraphs)}${s.content.items.length ? `<dl class="m-contact-list">${s.content.items.map((it) => `<div><dt>${esc(it.title ?? it.meta)}</dt><dd>${esc(it.body)}</dd></div>`).join('')}</dl>` : ''}${form(s.content.form, s.id)}${ctas(s.content.ctas)}</div></div>`);
const contactSimple: R = (s) => wrapTop(s, `<div class="m-narrow">${headBlock(s)}${paragraphs(s.content.paragraphs)}${form(s.content.form, s.id)}${ctas(s.content.ctas)}</div>`);

// ----------------------------------------------------------------------------- MISC
const logosStrip: R = (s) => wrapTop(s, `${s.content.heading ? `<p class="m-kicker">${esc(s.content.heading)}</p>` : ''}<ul class="m-logos">${(s.content.logos ?? []).map((l) => `<li>${media(l, 'm-logo')}</li>`).join('')}</ul>`);

const galleryImgs = (s: Section) => [...s.content.items.filter((i) => i.image).map((i) => ({ m: i.image!, cap: i.title })), ...s.content.media.map((m) => ({ m, cap: undefined as string | undefined }))];
const galleryGrid: R = (s) => wrapTop(s, `${headBlock(s)}<div class="m-gallery">${galleryImgs(s).map(({ m, cap }) => `<figure>${media(m)}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`).join('')}</div>`);
const galleryMasonry: R = (s) => wrapTop(s, `${headBlock(s)}<div class="m-gallery m-masonry">${galleryImgs(s).map(({ m, cap }) => `<figure>${media(m)}${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`).join('')}</div>`);

const teamGrid: R = (s) => wrapTop(s, `${headBlock(s)}<div class="m-team">${s.content.items.map((it) => `<article>${it.image ? media(it.image, 'm-portrait') : ''}<h3 class="m-h m-h4">${esc(it.title)}</h3>${it.body ? `<p>${esc(it.body)}</p>` : ''}</article>`).join('')}</div>`);
const teamList: R = (s) => wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<ul class="m-ruled">${s.content.items.map((it) => `<li><strong>${esc(it.title)}</strong><span>${esc(it.body)}</span></li>`).join('')}</ul></div>`);

const prose = (s: Section) => `${s.content.flow?.length ? s.content.flow.join('\n') : ''}${paragraphs(s.content.paragraphs)}${s.content.media.map((m) => media(m)).join('')}${s.content.items.length ? `<div class="m-grid m-grid-2">${s.content.items.map((it) => `<div>${it.title ? `<h3 class="m-h m-h3">${esc(it.title)}</h3>` : ''}${itemBody(it)}</div>`).join('')}</div>` : ''}${form(s.content.form, s.id)}${ctas(s.content.ctas)}`;
const contentProse: R = (s) => wrapTop(s, `<div class="m-narrow">${headBlock(s)}<div class="m-prose">${prose(s)}</div></div>`);
const contentTwoCol: R = (s) => wrapTop(s, `<div class="m-split">${headBlock(s, { cls: 'm-sticky' })}<div class="m-prose">${prose(s)}</div></div>`);

export const RENDERERS: Partial<Record<PatternId, R>> = {
  'hero-centered': heroCentered, 'hero-split': heroSplit, 'hero-editorial': heroEditorial, 'hero-proof-first': heroProof, 'hero-statement': heroStatement,
  'features-grid': featuresGrid, 'features-alternating': featuresAlternating, 'features-indexed': featuresIndexed, 'features-bento': featuresBento,
  'steps-timeline': stepsTimeline, 'steps-columns': stepsColumns,
  'stats-strip': (s) => statsBlock(s, false), 'stats-large': (s) => statsBlock(s, true),
  'quote-pull': quotePull, 'quote-wall': quoteWall, 'quote-grid': quoteGrid,
  'pricing-cards': pricingCards, 'pricing-table': pricingTable,
  'faq-accordion': faqAccordion, 'faq-two-column': faqTwoCol,
  'cta-band': ctaBand, 'cta-inline': ctaInline, 'cta-split': ctaSplit,
  'contact-split': contactSplit, 'contact-simple': contactSimple,
  'logos-strip': logosStrip, 'gallery-grid': galleryGrid, 'gallery-masonry': galleryMasonry,
  'team-grid': teamGrid, 'team-list': teamList,
  'content-prose': contentProse, 'content-two-column': contentTwoCol,
};

/** Some intents can arrive with an incompatible pattern (e.g. after a manual edit); degrade gracefully. */
function safePattern(s: Section): PatternId {
  const c = s.content;
  const p = s.pattern;
  if (p.startsWith('stats') && !(c.stats && c.stats.length)) return c.items.length ? 'features-indexed' : 'content-prose';
  if (p.startsWith('quote') && !c.items.some((i) => i.quote)) return 'content-prose';
  if (p.startsWith('pricing') && !c.items.length) return 'content-prose';
  if (p.startsWith('faq') && !c.items.length) return 'content-prose';
  if (p.startsWith('logos') && !c.logos?.length) return 'content-prose';
  if (p.startsWith('features') && !c.items.length) return c.stats?.length ? 'stats-strip' : 'content-prose';
  if (p === 'hero-split' && !c.media.length && !s.attachments.length) return 'hero-editorial';
  return p;
}

/**
 * Render-time completeness guarantee. Whatever pattern is chosen (by the planner, the editor or a saved plan),
 * every part of the section's content must appear in the output. Parts the pattern didn't render are appended.
 */
function ensureComplete(s: Section, html: string): string {
  const c = s.content;
  const has = (t?: string) => !t || html.includes(esc(t));
  const parts: string[] = [];
  if ((c.heading && !has(c.heading)) || (c.eyebrow && !has(c.eyebrow))) parts.push(headBlock({ ...s, content: { ...c, sub: has(c.sub) ? undefined : c.sub } } as Section));
  else if (c.sub && !has(c.sub)) parts.push(`<p class="m-sub">${esc(c.sub)}</p>`);
  const missingParas = c.paragraphs.filter((p) => !has(p));
  if (missingParas.length) parts.push(`<div class="m-prose">${paragraphs(missingParas)}</div>`);
  if (c.flow?.length && !c.flow.every((f) => html.includes(f.slice(0, 60)))) parts.push(`<div class="m-prose">${c.flow.join('\n')}</div>`);
  if (c.form && !html.includes('<form')) parts.push(form(c.form, s.id));
  const missingCtas = c.ctas.filter((x) => !has(x.text));
  if (missingCtas.length) parts.push(ctas(missingCtas));
  for (const m of c.media) {
    const key = m.src ?? m.html?.slice(0, 40);
    if (key && !html.includes(esc(key))) parts.push(media(m));
  }
  // Every field of every item, not just its headline: a layout may show a title and drop the description.
  const lost = c.items.map((it) => {
    const bits: string[] = [];
    if (it.quote && !has(it.quote.text)) bits.push(`<blockquote><p>${esc(it.quote.text)}</p></blockquote>${attribution(it)}`);
    if (it.title && !has(it.title)) bits.push(`<h3 class="m-h m-h3">${esc(it.title)}</h3>`);
    if (it.price && !has(it.price)) bits.push(`<p class="m-price">${esc(it.price)}</p>`);
    if (it.body && !has(it.body)) bits.push(`<p>${esc(it.body)}</p>`);
    const bl = (it.bullets ?? []).filter((b) => !has(b));
    if (bl.length) bits.push(`<ul class="m-bullets">${bl.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
    if (it.meta && !has(it.meta)) bits.push(`<p class="m-eyebrow">${esc(it.meta)}</p>`);
    if (it.extra?.length && !it.extra.every((x) => html.includes(x.slice(0, 60)))) bits.push(`<div class="m-prose">${it.extra.join('')}</div>`);
    if (it.cta && !has(it.cta.text)) bits.push(btn(it.cta));
    return bits;
  }).filter((b) => b.length);
  if (lost.length) {
    parts.push(`<div class="m-grid m-grid-${Math.min(lost.length, 3)}">${lost.map((bits) => `<article class="m-card">${bits.join('')}</article>`).join('')}</div>`);
  }
  if (c.stats?.length && !c.stats.every((x) => has(x.value))) parts.push(`<dl class="m-stats">${c.stats.map((x) => `<div><dd>${esc(x.value)}</dd><dt>${esc(x.label)}</dt></div>`).join('')}</dl>`);
  const logos = (c.logos ?? []).filter((l) => l.src && !html.includes(esc(l.src)));
  if (logos.length) parts.push(`<ul class="m-logos">${logos.map((l) => `<li>${media(l, 'm-logo')}</li>`).join('')}</ul>`);
  for (const a of s.attachments) {
    if (a.kind === 'stats' && a.stats?.length && !a.stats.every((x) => has(x.value))) parts.push(attachments({ ...s, attachments: [a] } as Section));
    if (a.kind === 'logos' && a.logos?.length && !a.logos.every((l) => !l.src || html.includes(esc(l.src)))) parts.push(attachments({ ...s, attachments: [a] } as Section));
  }
  return parts.length ? `${html}<div class="m-container m-leftover">${parts.join('')}</div>` : html;
}

export function renderSection(s: Section, index: number): string {
  const tone = s.variant.tone;
  const anchor = s.anchor ? ` id="${esc(s.anchor)}"` : '';
  const data = `data-m-section="${esc(s.id)}" data-m-intent="${s.intent}"`;
  if (s.useRaw && s.rawHtml) {
    return `<section class="m-sec m-tone-${tone} m-space-${s.variant.spacing} m-raw"${anchor} ${data} data-m-pattern="original"><div class="m-container">${s.rawHtml}</div></section>`;
  }
  const pattern = safePattern(s);
  const fn = RENDERERS[pattern] ?? contentProse;
  renderState.priority = s.intent === 'hero' || index === 0 ? 1 : 0;
  const body = ensureComplete(s, fn(s)) + extra(s.content.extra);
  renderState.priority = 0;
  // Name the landmark by pointing at its own visible heading (no duplicated text for screen readers).
  const labelled = body.includes(`id="h-${esc(s.id)}"`) ? ` aria-labelledby="h-${esc(s.id)}"` : '';
  return `<section class="m-sec m-tone-${tone} m-space-${s.variant.spacing} m-align-${s.variant.align} m-p-${pattern}"${anchor}${labelled} ${data} data-m-pattern="${pattern}">${body}</section>`;
}
