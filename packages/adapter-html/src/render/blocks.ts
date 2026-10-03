import type { Cta, FormModel, Item, Media, Section } from '@morpheus/core';

export const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const num = (i: number): string => String(i + 1).padStart(2, '0');

export function btn(c: Cta, extra = ''): string {
  const cls = c.kind === 'primary' ? 'm-btn m-btn-primary' : c.kind === 'secondary' ? 'm-btn m-btn-secondary' : 'm-link';
  return `<a class="${cls}${extra ? ' ' + extra : ''}" href="${esc(c.href || '#')}">${esc(c.text)}</a>`;
}

export function ctas(list: Cta[]): string {
  if (!list.length) return '';
  return `<div class="m-actions">${list.map((c) => btn(c)).join('')}</div>`;
}

/** Render-scoped state: the first image in the hero/first section is the likely LCP element, so it loads eagerly. */
export const renderState = { priority: 0 };

export function media(m: Media | undefined, cls = 'm-media'): string {
  if (!m) return '';
  if (m.kind === 'image') {
    const hi = renderState.priority > 0;
    if (hi) renderState.priority -= 1;
    const a = [
      m.src ? ` src="${esc(m.src)}"` : '',
      m.srcset ? ` srcset="${esc(m.srcset)}"` : '',
      m.sizes ? ` sizes="${esc(m.sizes)}"` : '',
      m.width && /^\d+$/.test(m.width) ? ` width="${m.width}"` : '',
      m.height && /^\d+$/.test(m.height) ? ` height="${m.height}"` : '',
      ` alt="${esc(m.alt ?? '')}"`,
      hi ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"',
    ].join('');
    const img = `<img class="${cls} m-img"${a}>`;
    if (m.sources?.length) {
      return `<picture>${m.sources.map((x) => `<source${x.media ? ` media="${esc(x.media)}"` : ''}${x.type ? ` type="${esc(x.type)}"` : ''}${x.sizes ? ` sizes="${esc(x.sizes)}"` : ''} srcset="${esc(x.srcset)}">`).join('')}${img}</picture>`;
    }
    return img;
  }
  if (m.kind === 'svg') return `<div class="${cls} m-svg">${m.html ?? ''}</div>`;
  return `<div class="${cls} m-embed">${m.html ?? ''}</div>`;
}

/** Source content the structured model did not capture, carried through sanitised. */
export function extra(list: string[] | undefined): string {
  return list?.length ? `<div class="m-container"><div class="m-prose m-extra">${list.join('\n')}</div></div>` : '';
}

export function headBlock(s: Section, opts: { level?: number; withSub?: boolean; cls?: string } = {}): string {
  const c = s.content;
  const level = Math.min(Math.max(c.headingLevel ?? 2, 1), 3);
  const parts: string[] = [];
  if (c.eyebrow) parts.push(`<p class="m-eyebrow">${esc(c.eyebrow)}</p>`);
  if (c.heading) parts.push(`<h${level} class="m-h m-h${level}" id="h-${esc(s.id)}">${esc(c.heading)}</h${level}>`);
  if (c.sub && opts.withSub !== false) parts.push(`<p class="m-sub">${esc(c.sub)}</p>`);
  return parts.length ? `<div class="m-head${opts.cls ? ' ' + opts.cls : ''}">${parts.join('')}</div>` : '';
}

export function paragraphs(list: string[]): string {
  return list.map((p) => `<p>${esc(p)}</p>`).join('');
}

/** Replace emoji/glyph icons (an AI tell) with a quiet index; keep real SVG/image icons. */
export function marker(it: Item, i: number, keepIcon: boolean): string {
  if (keepIcon && it.icon) {
    if (it.iconKind === 'svg') return `<span class="m-icon m-icon-svg">${it.icon}</span>`;
    if (it.iconKind === 'image') return `<img class="m-icon m-icon-img" src="${esc(it.icon)}" alt="">`;
    if (it.iconKind === 'emoji' || it.iconKind === 'text') return `<span class="m-icon" aria-hidden="true">${esc(it.icon)}</span>`;
  }
  if (it.iconKind === 'svg' && it.icon) return `<span class="m-icon m-icon-svg">${it.icon}</span>`;
  return `<span class="m-index" aria-hidden="true">${num(i)}</span>`;
}

export function attachments(s: Section): string {
  const out: string[] = [];
  for (const a of s.attachments) {
    if (a.kind === 'stats' && a.stats?.length) {
      out.push(`<dl class="m-statrow">${a.stats.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>`);
    }
    if (a.kind === 'logos' && a.logos?.length) {
      out.push(`<div class="m-logorow">${a.heading ? `<p class="m-kicker">${esc(a.heading)}</p>` : ''}<ul>${a.logos.map((l) => `<li>${media(l, 'm-logo')}</li>`).join('')}</ul></div>`);
    }
  }
  return out.join('');
}

export function form(f: FormModel | undefined, id: string): string {
  if (!f) return '';
  const field = (x: FormModel['fields'][number], i: number) => {
    const fid = `${id}-${x.name ?? i}-${i}`;
    const label = x.label ?? x.placeholder ?? x.name ?? '';
    const req = x.required ? ' required' : '';
    const nm = x.name ? ` name="${esc(x.name)}"` : '';
    const val = x.value !== undefined && (x.type === 'radio' || x.type === 'checkbox') ? ` value="${esc(x.value)}"` : '';
    let control: string;
    if (x.type === 'textarea') control = `<textarea id="${fid}"${nm} rows="5"${req}></textarea>`;
    else if (x.type === 'select') control = `<select id="${fid}"${nm}${req}>${x.optionGroups?.length ? x.optionGroups.map((g) => (g.label ? `<optgroup label="${esc(g.label)}">${g.options.map((o) => `<option>${esc(o)}</option>`).join('')}</optgroup>` : g.options.map((o) => `<option>${esc(o)}</option>`).join(''))).join('') : (x.options ?? []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    else if (x.type === 'checkbox' || x.type === 'radio') return `<label class="m-check"><input type="${x.type}" id="${fid}"${nm}${val}${req}> <span>${esc(label)}</span></label>`;
    else control = `<input id="${fid}" type="${esc(x.type)}"${nm}${req}>`;
    return `<div class="m-field"><label for="${fid}">${esc(label)}${x.required ? '' : ' <span class="m-opt">(optional)</span>'}</label>${control}</div>`;
  };
  // Consecutive fields with the same fieldset legend are grouped back into a <fieldset>.
  const groups = (fields: FormModel['fields'], offset: number) => {
    const out: string[] = [];
    let i = 0;
    while (i < fields.length) {
      const legend = fields[i].fieldset;
      let j = i;
      const chunk: string[] = [];
      while (j < fields.length && fields[j].fieldset === legend) { chunk.push(field(fields[j], offset + j)); j++; }
      out.push(legend ? `<fieldset class="m-fieldset"><legend>${esc(legend)}</legend>${chunk.join('')}</fieldset>` : chunk.join(''));
      i = j;
    }
    return out.join('');
  };
  const main = groups(f.fields.filter((x) => x.group !== 'optional'), 0);
  const more = f.fields.filter((x) => x.group === 'optional');
  const moreHtml = more.length ? `<details class="m-more"><summary>More details (optional)</summary>${groups(more, 1000)}</details>` : '';
  const action = f.action ? ` action="${esc(f.action)}"` : '';
  const method = f.method ? ` method="${esc(f.method)}"` : '';
  return `<form class="m-form"${action}${method}>${main}${moreHtml}<button class="m-btn m-btn-primary" type="submit">${esc(f.submitText)}</button></form>`;
}

export function itemHref(it: Item): string | undefined {
  return it.href ?? it.cta?.href;
}
