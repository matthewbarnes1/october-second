import type { NavLink, Page } from '@morpheus/core';
import { btn, esc, media } from './blocks';

const links = (l: NavLink[]) => l.map((x) => `<li><a href="${esc(x.href || '#')}">${esc(x.label)}</a></li>`).join('');

function brand(page: Page): string {
  const b = page.nav.brand;
  const inner = b.logo ? media(b.logo, 'm-brand-logo') + (b.text ? `<span class="m-brand-text">${esc(b.text)}</span>` : '') : `<span class="m-brand-text">${esc(b.text ?? 'Home')}</span>`;
  return `<a class="m-brand" href="${esc(b.href || '/')}">${inner}</a>`;
}

export function renderHeader(page: Page): string {
  const nav = page.nav;
  const more = nav.secondary.length
    ? `<li class="m-more-links"><details><summary>More</summary><ul>${links(nav.secondary)}</ul></details></li>`
    : '';
  const cta = nav.cta ? btn(nav.cta) : '';
  const list = `<ul>${links(nav.primary)}${more}</ul>`;
  const mobile = `<details class="m-menu"><summary><span class="m-sr">Menu</span><span class="m-burger" aria-hidden="true"></span></summary><div class="m-menu-panel"><ul>${links([...nav.primary, ...nav.secondary])}</ul>${cta}</div></details>`;
  const pattern = page.chrome.header;
  if (pattern === 'header-split') {
    return `<header class="m-header m-header-split"><div class="m-container"><div class="m-header-top">${brand(page)}</div><div class="m-header-row"><nav aria-label="Primary" class="m-nav">${list}</nav>${cta}${mobile}</div></div></header>`;
  }
  if (pattern === 'header-minimal') {
    return `<header class="m-header m-header-minimal"><div class="m-container">${brand(page)}<nav aria-label="Primary" class="m-nav">${list}</nav>${cta}${mobile}</div></header>`;
  }
  return `<header class="m-header m-header-bar"><div class="m-container">${brand(page)}<nav aria-label="Primary" class="m-nav">${list}</nav>${cta}${mobile}</div></header>`;
}

export function renderFooter(page: Page): string {
  const f = page.footer;
  const social = f.social.length ? `<ul class="m-social">${links(f.social)}</ul>` : '';
  const legal = (f.legal ? `<p class="m-legal">${esc(f.legal)}</p>` : '') + (f.extra?.length ? `<div class="m-prose m-footer-extra">${f.extra.join('')}</div>` : '');
  if (page.chrome.footer === 'footer-minimal' || !f.columns.length) {
    const flat = [...f.columns.flatMap((c) => c.links), ...page.nav.secondary];
    return `<footer class="m-footer m-footer-minimal"><div class="m-container"><div class="m-footer-line">${brand(page)}${flat.length ? `<ul class="m-footer-links">${links(flat)}</ul>` : ''}</div>${f.blurb ? `<p class="m-footer-blurb">${esc(f.blurb)}</p>` : ''}${legal}${social}</div></footer>`;
  }
  const extra = page.nav.secondary.length && !f.columns.some((c) => c.links.some((l) => page.nav.secondary.some((s) => s.href === l.href)))
    ? [{ title: 'More', links: page.nav.secondary }] : [];
  const cols = [...f.columns, ...extra].map((c) => `<div class="m-footer-col">${c.title ? `<h2 class="m-footer-h">${esc(c.title)}</h2>` : ''}<ul>${links(c.links)}</ul></div>`).join('');
  return `<footer class="m-footer m-footer-columns"><div class="m-container"><div class="m-footer-grid"><div class="m-footer-brand">${brand(page)}${f.blurb ? `<p>${esc(f.blurb)}</p>` : ''}${social}</div>${cols}</div>${legal}</div></footer>`;
}
