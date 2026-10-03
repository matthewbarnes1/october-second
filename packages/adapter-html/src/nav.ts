import type { Cta, Footer, Nav, NavLink } from '@morpheus/core';
import { El, attr, classes, find, findAll, findAllByTag, findByTag, isEl, kids, outer, tag, textOf } from './dom';
import { ctaOf, mediaOf } from './extract';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

function linkOf(a: El): NavLink | null {
  const label = norm(textOf(a));
  const href = attr(a, 'href') ?? '';
  if (!label && !findByTag(a, 'img')) return null;
  return { label, href };
}

function listLinks(container: El): NavLink[] {
  const out: NavLink[] = [];
  const ul = findAll(container, (e) => ['ul', 'ol'].includes(tag(e)))[0];
  const scope = ul ?? container;
  const direct = ul ? kids(ul).filter((k) => tag(k) === 'li') : [];
  if (direct.length) {
    for (const li of direct) {
      const a = findByTag(li, 'a');
      if (!a) continue;
      const l = linkOf(a);
      if (!l) continue;
      const sub = findAll(li, (e) => ['ul', 'ol'].includes(tag(e)))[0];
      if (sub) {
        l.children = findAllByTag(sub, 'a').map(linkOf).filter((x): x is NavLink => !!x);
      }
      out.push(l);
    }
    return out;
  }
  for (const a of findAllByTag(scope, 'a')) {
    const l = linkOf(a);
    if (l) out.push(l);
  }
  return out;
}

const BTNISH = /btn|button|cta|primary|signup|sign-up|get-started|pill/i;

export function parseNav(root: El | undefined, fallbackBrand: string): Nav {
  const nav: Nav = { brand: { text: fallbackBrand, href: '/' }, primary: [], secondary: [] };
  if (!root) return nav;
  const brandEl = find(root, (e) => tag(e) === 'a' && (/logo|brand|site-title|navbar-brand/i.test(classes(e).join(' ')) || !!findByTag(e, 'img', 'svg'))) ?? findByTag(root, 'a');
  if (brandEl) {
    const img = findByTag(brandEl, 'img', 'svg');
    nav.brand = {
      text: norm(textOf(brandEl)) || undefined,
      logo: img ? mediaOf(img) ?? undefined : undefined,
      href: attr(brandEl, 'href') ?? '/',
    };
  } else {
    const logoText = find(root, (e) => /logo|brand/i.test(classes(e).join(' ')));
    if (logoText) nav.brand.text = norm(textOf(logoText)) || nav.brand.text;
  }
  const navEl = findByTag(root, 'nav') ?? root;
  let links = listLinks(navEl).filter((l) => !(brandEl && l.href === attr(brandEl, 'href') && l.label === nav.brand.text));
  // Pull a button-styled last link out as the CTA
  const anchors = findAllByTag(navEl, 'a', 'button');
  const ctaEl = [...anchors].reverse().find((a) => BTNISH.test(classes(a).join(' ')) || (/\b(px-\d|py-\d)/.test(classes(a).join(' ')) && /bg-|border/.test(classes(a).join(' '))));
  if (ctaEl) {
    const c = ctaOf(ctaEl, 0);
    if (c) {
      nav.cta = { ...c, kind: 'primary' } as Cta;
      links = links.filter((l) => !(l.label === c.text && l.href === c.href));
    }
  }
  nav.primary = links;
  return nav;
}

const SOCIAL_RE = /(twitter|x\.com|linkedin|github|instagram|facebook|youtube|tiktok|mastodon|dribbble|behance|discord)/i;

export function parseFooter(root: El | undefined): Footer {
  const footer: Footer = { columns: [], social: [], rawHtml: root ? outer(root) : '' };
  if (!root) return footer;
  const lists = findAll(root, (e) => ['ul', 'ol'].includes(tag(e)));
  for (const ul of lists) {
    const links = findAllByTag(ul, 'a').map(linkOf).filter((x): x is NavLink => !!x);
    if (!links.length) continue;
    if (links.every((l) => SOCIAL_RE.test(l.href))) { footer.social.push(...links); continue; }
    // Title: nearest heading before the list within its parent
    const parent = ul.parentNode;
    const heading = isEl(parent) ? kids(parent).find((k) => /^h[1-6]$/.test(tag(k)) || (['p', 'span', 'div', 'strong'].includes(tag(k)) && norm(textOf(k)).length < 30 && !findByTag(k, 'a', 'ul'))) : undefined;
    footer.columns.push({ title: heading ? norm(textOf(heading)) : undefined, links });
  }
  // Loose links not in any list
  if (!footer.columns.length) {
    const links = findAllByTag(root, 'a').map(linkOf).filter((x): x is NavLink => !!x);
    const social = links.filter((l) => SOCIAL_RE.test(l.href));
    const plain = links.filter((l) => !SOCIAL_RE.test(l.href));
    footer.social.push(...social);
    if (plain.length) footer.columns.push({ links: plain });
  }
  const socialLinks = findAllByTag(root, 'a').filter((a) => SOCIAL_RE.test(attr(a, 'href') ?? '')).map(linkOf).filter((x): x is NavLink => !!x);
  for (const s of socialLinks) if (!footer.social.some((x) => x.href === s.href)) footer.social.push(s);
  const legal = find(root, (e) => ['p', 'small', 'div', 'span'].includes(tag(e)) && /©|copyright|all rights/i.test(norm(textOf(e))) && norm(textOf(e)).length < 200 && !findByTag(e, 'ul'));
  if (legal) footer.legal = norm(textOf(legal));
  const blurb = find(root, (e) => tag(e) === 'p' && !/©|copyright/i.test(textOf(e)) && norm(textOf(e)).length > 20 && !findByTag(e, 'a'));
  if (blurb) footer.blurb = norm(textOf(blurb));
  return footer;
}
