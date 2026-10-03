import type { Change, Cta, Intent, Nav, NavLink, Page, PatternId, Section, SiteIR, StyleSpec, Tone } from '../ir';
import { clone, slugify, uid } from '../ir';
import { chooseChrome } from './patterns';

export type OpType =
  | 'set-style' | 'fix-meta' | 'fix-headings' | 'fix-alt' | 'strip-badge' | 'set-rhythm' | 'set-align'
  | 'dedupe-ctas' | 'merge-sections' | 'set-pattern' | 'reorder' | 'regroup-nav' | 'nav-cta'
  | 'fix-labels' | 'synthesize-nav' | 'ensure-anchors' | 'set-chrome' | 'extract-page' | 'progressive-form' | 'advise';

export interface Operation {
  id: string;
  type: OpType;
  page?: string;          // route
  section?: string;       // section id
  params: Record<string, any>;
  change: Change;
}

export function getPage(ir: SiteIR, route: string): Page | undefined {
  return ir.pages.find((p) => p.route === route);
}

export function getSection(page: Page, id: string): Section | undefined {
  return page.sections.find((s) => s.id === id);
}

const BADGE_RE = /new|beta|introducing|launch|announc|now |v\d|✨|🚀|🎉|trusted by|#1|powered by|just (shipped|launched)|early access/i;

export function isBadgeLike(text: string | undefined): boolean {
  return !!text && text.length < 70 && BADGE_RE.test(text);
}

function label(s: Section): string {
  return s.content.heading ? `"${s.content.heading.slice(0, 40)}"` : s.intent;
}

function shortLabel(text: string, intent: Intent): string {
  const m: Partial<Record<Intent, string>> = { features: 'Features', pricing: 'Pricing', testimonials: 'Customers', faq: 'FAQ', contact: 'Contact', team: 'Team', gallery: 'Work', steps: 'How it works', stats: 'Results', content: '' };
  return m[intent] || text.split(/\s+/).slice(0, 2).join(' ');
}

const NAV_PRIORITY: [RegExp, number][] = [
  [/pric|plans|buy|shop|store|order/i, 90], [/product|feature|solution|service|work|menu|portfolio|project|collection|how/i, 80],
  [/about|story|team|company|mission/i, 60], [/doc|guide|help|resource|learn|support|faq/i, 55], [/blog|news|article|journal|press/i, 50],
  [/contact|book|reserve|quote/i, 45], [/log ?in|sign ?in|account|my /i, 15],
];

export function navScore(l: NavLink): number {
  for (const [re, s] of NAV_PRIORITY) if (re.test(l.label)) return s;
  return 30;
}

export function applyOp(ir: SiteIR, op: Operation): void {
  const page = op.page ? getPage(ir, op.page) : undefined;
  const section = page && op.section ? getSection(page, op.section) : undefined;
  const p = op.params;

  switch (op.type) {
    case 'set-style':
      ir.style = clone(p.style as StyleSpec);
      break;

    case 'fix-meta':
      if (page) {
        if (p.lang) page.lang = p.lang;
        if (p.description) page.description = p.description;
        if (p.title) page.title = p.title;
        if (p.og) {
          const q = (v: string) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
          page.headExtras.push(`<meta property="og:title" content="${q(p.og.title)}">`, ...(p.og.description ? [`<meta property="og:description" content="${q(p.og.description)}">`] : []), '<meta property="og:type" content="website">', '<meta name="twitter:card" content="summary">');
        }
        if (p.viewport && !page.headExtras.some((h) => /viewport/i.test(h))) page.headExtras.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
      }
      break;

    case 'fix-headings':
      if (page) {
        for (const s of page.sections) {
          if (!s.content.heading) continue;
          s.content.headingLevel = s.id === p.h1 ? 1 : 2;
        }
      }
      break;

    case 'fix-alt':
      if (page) {
        for (const s of page.sections) {
          const fix = (m: { kind: string; alt?: string; src?: string } | undefined, fallback: string) => {
            if (m && m.kind === 'image' && (m.alt === undefined || m.alt === null)) m.alt = fallback;
          };
          for (const m of s.content.media) fix(m, s.content.heading ?? '');
          for (const it of s.content.items) fix(it.image, it.title ?? s.content.heading ?? '');
          for (const m of s.content.logos ?? []) fix(m, (m.src ?? '').split('/').pop()?.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ') ?? '');
        }
      }
      break;

    case 'strip-badge':
      if (section) { section.content.eyebrow = p.text ?? section.content.eyebrow; section.content.eyebrowKind = 'kicker'; }
      break;

    case 'set-rhythm':
      if (page) {
        for (const r of p.sections as { id: string; tone: Tone; spacing: 'tight' | 'normal' | 'loose' }[]) {
          const s = getSection(page, r.id);
          if (s) { s.variant.tone = r.tone; s.variant.spacing = r.spacing; }
        }
      }
      break;

    case 'set-align':
      if (page) {
        const ids: string[] = p.sections ?? (op.section ? [op.section] : []);
        for (const id of ids) {
          const s = getSection(page, id);
          if (s) { s.variant.align = p.align; s.content.alignment = p.align; }
        }
      }
      break;

    case 'fix-labels':
      if (page) {
        for (const s of page.sections) {
          for (const f of s.content.form?.fields ?? []) {
            if (!f.label && f.type !== 'checkbox') f.label = (f.placeholder ?? f.name ?? f.type).replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
          }
        }
      }
      break;

    case 'dedupe-ctas':
      if (section) section.content.ctas = p.ctas as Cta[];
      break;

    case 'merge-sections':
      if (page && section) {
        const from = getSection(page, p.from as string);
        if (from) {
          section.attachments.push({ kind: p.kind, stats: from.content.stats, logos: from.content.logos, heading: from.content.heading });
          page.sections = page.sections.filter((s) => s.id !== from.id);
        }
      }
      break;

    case 'set-pattern':
      if (section) {
        section.pattern = p.pattern as PatternId;
        section.useRaw = false;
      }
      break;

    case 'reorder':
      if (page) {
        const byId = new Map(page.sections.map((s) => [s.id, s]));
        const next = (p.order as string[]).map((id) => byId.get(id)).filter((s): s is Section => !!s);
        const missing = page.sections.filter((s) => !(p.order as string[]).includes(s.id));
        page.sections = [...next, ...missing];
      }
      break;

    case 'regroup-nav':
      if (page) {
        page.nav.primary = p.primary as NavLink[];
        page.nav.secondary = p.secondary as NavLink[];
      }
      break;

    case 'nav-cta':
      if (page) page.nav.cta = p.cta as Cta;
      break;

    case 'synthesize-nav':
      if (page) page.nav.primary = p.primary as NavLink[];
      break;

    case 'ensure-anchors':
      if (page) for (const a of p.anchors as { id: string; anchor: string }[]) {
        const s = getSection(page, a.id);
        if (s) s.anchor = a.anchor;
      }
      break;

    case 'set-chrome':
      if (page) page.chrome = p.chrome;
      break;

    case 'progressive-form':
      if (section?.content.form) {
        const keep = p.keep as number;
        section.content.form.fields.forEach((f, i) => { if (i >= keep && !f.required) f.group = 'optional'; });
      }
      break;

    case 'extract-page':
      if (page && section) extractPage(ir, page, section, p);
      break;

    case 'advise':
      break;
  }

  ir.changeLog.push(op.change);
}

function extractPage(ir: SiteIR, home: Page, section: Section, p: Record<string, any>): void {
  const route: string = p.route;
  const file: string = p.file;
  const anchor = section.anchor ?? slugify(section.content.heading ?? section.intent);
  const moved = clone(section);
  moved.content.headingLevel = 1;
  moved.variant.tone = 'plain';
  moved.variant.spacing = 'loose';
  const page: Page = {
    id: `page_${route.replace(/\W+/g, '_')}`,
    route,
    file,
    title: `${p.title} · ${home.nav.brand.text ?? ir.name}`,
    description: section.content.sub ?? home.description,
    lang: home.lang,
    nav: clone(home.nav),
    sections: [moved],
    footer: clone(home.footer),
    chrome: clone(home.chrome),
    headExtras: clone(home.headExtras),
    scripts: [],
  };
  const teaser: Section = {
    ...clone(section),
    id: `${section.id}_teaser`,
    intent: 'cta',
    pattern: 'cta-inline',
    useRaw: false,
    rawHtml: '',
    attachments: [],
    content: {
      paragraphs: [],
      items: [],
      media: [],
      alignment: 'left',
      heading: p.teaserHeading,
      sub: undefined,
      ctas: [{ text: p.teaserCta, href: file, kind: 'link' }],
    },
    notes: [`Replaces ${section.intent} section moved to ${file}`],
    variant: { tone: 'plain', spacing: 'tight', align: 'left' },
  };
  home.sections = home.sections.map((s) => (s.id === section.id ? teaser : s));
  // Point every in-page anchor link at the new page.
  const relink = (l: NavLink) => { if (l.href === `#${anchor}` || l.href.endsWith(`#${anchor}`)) l.href = file; l.children?.forEach(relink); };
  for (const pg of [home, page, ...ir.pages]) {
    pg.nav.primary.forEach(relink);
    pg.nav.secondary.forEach(relink);
    pg.footer.columns.forEach((c) => c.links.forEach(relink));
    for (const s of pg.sections) for (const c of s.content.ctas) if (c.href === `#${anchor}`) c.href = file;
  }
  // The new destination must be reachable from the primary nav.
  const addLink = (n: Nav) => {
    if (![...n.primary, ...n.secondary].some((l) => l.href === file)) n.primary.push({ label: p.navLabel, href: file });
  };
  addLink(home.nav);
  addLink(page.nav);
  for (const pg of ir.pages) if (pg !== home) addLink(pg.nav);
  ir.pages.push(page);
  ir.redirects.push({ from: `${home.file}#${anchor}`, to: file });
}

export function chromeFor(page: Page, style: StyleSpec) {
  return chooseChrome(page, style);
}

export { label as sectionLabel, shortLabel };
