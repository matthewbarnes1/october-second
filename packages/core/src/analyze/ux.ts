import type { Page, SiteIR } from '../ir';
import { pageText } from './util';

export type UxCategory = 'a11y' | 'navigation' | 'hierarchy' | 'conversion' | 'forms' | 'seo' | 'content' | 'performance';

export interface UxFinding {
  id: string;
  category: UxCategory;
  severity: 'high' | 'medium' | 'low';
  page: string;
  title: string;
  detail: string;
  recommendation: string;
  sectionId?: string;
}

export interface UxReport {
  score: number;          // 0-100, higher = healthier
  findings: UxFinding[];
}

const SEV = { high: 12, medium: 6, low: 2 } as const;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function auditUx(ir: SiteIR): UxReport {
  const findings: UxFinding[] = [];
  const push = (f: UxFinding) => findings.push(f);

  for (const page of ir.pages) {
    const route = page.route;

    // --- Document basics
    if (!page.lang) push({ id: 'missing-lang', category: 'a11y', severity: 'medium', page: route, title: 'No language declared', detail: 'The <html> element has no lang attribute, so screen readers guess pronunciation.', recommendation: 'Set lang on <html>.' });
    if (!page.description) push({ id: 'missing-meta-description', category: 'seo', severity: 'low', page: route, title: 'No meta description', detail: 'Search results will show an auto-generated snippet.', recommendation: 'Write a 140-160 character description per page.' });
    if (!page.title || page.title.length < 8) push({ id: 'weak-title', category: 'seo', severity: 'medium', page: route, title: 'Missing or very short page title', detail: `Title is "${page.title}".`, recommendation: 'Use a descriptive title: page topic, then brand.' });
    if (!page.headExtras.some((h) => /viewport/i.test(h))) push({ id: 'missing-viewport', category: 'performance', severity: 'high', page: route, title: 'No responsive viewport meta tag', detail: 'Mobile browsers will render the desktop layout zoomed out.', recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.' });

    // --- Heading structure
    const levels = page.sections.filter((s) => s.content.heading).map((s) => ({ l: s.content.headingLevel ?? 2, id: s.id }));
    const h1s = levels.filter((x) => x.l === 1);
    if (page.sections.length && !h1s.length) push({ id: 'no-h1', category: 'hierarchy', severity: 'high', page: route, title: 'No H1 on the page', detail: 'Neither users nor assistive tech get a clear page title.', recommendation: 'Give the hero or first heading the only H1.' });
    if (h1s.length > 1) push({ id: 'multiple-h1', category: 'hierarchy', severity: 'medium', page: route, title: `${h1s.length} H1 headings`, detail: 'Several competing top-level headings dilute the hierarchy.', recommendation: 'Keep one H1; demote the rest to H2.' });
    for (let i = 1; i < levels.length; i++) {
      if (levels[i].l - levels[i - 1].l > 1) {
        push({ id: 'heading-skip', category: 'hierarchy', severity: 'low', page: route, title: `Heading level jumps h${levels[i - 1].l} → h${levels[i].l}`, detail: 'Skipped levels break the document outline.', recommendation: 'Use sequential heading levels.', sectionId: levels[i].id });
        break;
      }
    }
    const headless = page.sections.filter((s) => !['header', 'footer', 'logos', 'stats'].includes(s.intent) && !s.content.heading && s.content.items.length > 1);
    if (headless.length >= 2) push({ id: 'sections-without-heading', category: 'hierarchy', severity: 'low', page: route, title: `${headless.length} sections have no heading`, detail: 'Readers scanning the page cannot tell what these blocks are for.', recommendation: 'Give each section a heading that states its point.' });

    // --- Navigation
    const nav = page.nav;
    if (nav.primary.length > 7) push({ id: 'nav-overload', category: 'navigation', severity: 'high', page: route, title: `${nav.primary.length} primary navigation items`, detail: 'Past about 7 items, choosing becomes slower and mobile menus get long.', recommendation: 'Keep 5 or fewer primary links; move the rest to a secondary or footer group.' });
    if (nav.primary.length === 0 && ir.pages.length > 1) push({ id: 'no-nav', category: 'navigation', severity: 'high', page: route, title: 'No navigation found', detail: 'Visitors have no way to reach other pages.', recommendation: 'Add a header navigation with the key destinations.' });
    if (!nav.cta && route === '/' && page.sections.some((s) => s.intent === 'hero' || s.intent === 'pricing')) push({ id: 'nav-no-cta', category: 'conversion', severity: 'medium', page: route, title: 'No call-to-action in the header', detail: 'Visitors who are ready to act have nothing visible without scrolling.', recommendation: 'Surface one primary action in the header.' });
    const internal = nav.primary.filter((l) => l.href.startsWith('#')).length;
    if (page.sections.length > 8 && internal === 0 && ir.pages.length === 1) push({ id: 'long-page-no-anchors', category: 'navigation', severity: 'low', page: route, title: 'Long single page with no in-page navigation', detail: `${page.sections.length} sections and no way to jump between them.`, recommendation: 'Add anchor links or a sticky section index.' });

    // --- Conversion
    const hero = page.sections.find((s) => s.intent === 'hero');
    if (hero && route === '/' && hero.content.ctas.length === 0) push({ id: 'hero-no-cta', category: 'conversion', severity: 'high', page: route, title: 'Hero has no call to action', detail: 'The most-read part of the page does not tell visitors what to do next.', recommendation: 'Add one primary action in the hero.', sectionId: hero.id });
    if (hero && hero.content.ctas.filter((c) => c.kind !== 'link').length >= 2 && hero.content.ctas.filter((c) => c.kind === 'primary').length >= 2) push({ id: 'cta-competition', category: 'conversion', severity: 'medium', page: route, title: 'Two equal-weight buttons in the hero', detail: 'Equal emphasis forces a decision and splits clicks between two goals.', recommendation: 'One filled primary action; demote the other to a text link.', sectionId: hero.id });
    const allCtas = page.sections.flatMap((s) => s.content.ctas);
    const primaries = new Set(allCtas.filter((c) => c.kind === 'primary').map((c) => c.href));
    if (primaries.size >= 4) push({ id: 'too-many-destinations', category: 'conversion', severity: 'medium', page: route, title: `${primaries.size} different primary-button destinations`, detail: 'Many different "main" actions make it unclear what the site wants.', recommendation: 'Converge primary buttons on one or two destinations.' });
    const proofIdx = page.sections.findIndex((s) => s.intent === 'testimonials');
    const priceIdx = page.sections.findIndex((s) => s.intent === 'pricing');
    if (proofIdx >= 0 && page.sections.length > 5 && proofIdx / page.sections.length > 0.65) push({ id: 'proof-buried', category: 'conversion', severity: 'medium', page: route, title: 'Social proof sits near the bottom', detail: 'Testimonials appear after most visitors have stopped scrolling.', recommendation: 'Move proof next to the first call to action.', sectionId: page.sections[proofIdx].id });
    if (priceIdx >= 0 && ir.pages.length > 1 && !nav.primary.some((l) => /pric/i.test(l.label))) push({ id: 'pricing-not-in-nav', category: 'navigation', severity: 'low', page: route, title: 'Pricing is not reachable from the navigation', detail: 'Pricing is the top thing buyers look for.', recommendation: 'Add Pricing to the primary navigation.' });

    // --- Links and copy
    const generic = allCtas.filter((c) => /^(click here|read more|learn more|more|here|link)$/i.test(c.text.trim()));
    if (generic.length >= 3) push({ id: 'generic-link-text', category: 'a11y', severity: 'medium', page: route, title: `${generic.length} links say "${generic[0].text}"`, detail: 'Link text is meaningless out of context (screen reader link lists, skimming).', recommendation: 'Make link text describe the destination or outcome.' });
    const dead = allCtas.filter((c) => !c.href || c.href === '#');
    if (dead.length >= 2) push({ id: 'dead-links', category: 'content', severity: 'medium', page: route, title: `${dead.length} buttons link nowhere`, detail: 'Buttons with href="#" do nothing.', recommendation: 'Point each button at a real destination or remove it.' });
    for (const s of page.sections) {
      for (const p of s.content.paragraphs) {
        if (words(p) > 120) { push({ id: 'wall-of-text', category: 'content', severity: 'low', page: route, title: 'Paragraph over 120 words', detail: `"${p.slice(0, 60)}…"`, recommendation: 'Break into shorter paragraphs or a list.', sectionId: s.id }); break; }
      }
    }

    // --- Images
    const imgs = page.sections.flatMap((s) => [...s.content.media, ...s.content.items.map((i) => i.image).filter(Boolean)] as NonNullable<typeof s.content.media[number]>[]).filter((m) => m.kind === 'image');
    const noAlt = imgs.filter((m) => m.alt === undefined || m.alt === null);
    if (noAlt.length) push({ id: 'img-missing-alt', category: 'a11y', severity: 'high', page: route, title: `${noAlt.length} image(s) with no alt attribute`, detail: 'Screen readers announce the filename instead of meaning.', recommendation: 'Add descriptive alt text, or alt="" for decorative images.' });

    // --- Forms
    for (const s of page.sections) {
      const f = s.content.form;
      if (!f) continue;
      const required = f.fields.filter((x) => x.required).length;
      const visible = f.fields.filter((x) => x.group !== 'optional').length;
      if (visible > 6) push({ id: 'long-form', category: 'forms', severity: 'medium', page: route, title: `Form has ${visible} visible fields`, detail: 'Each extra field cuts completion rates.', recommendation: 'Cut to what you truly need now; ask the rest later.', sectionId: s.id });
      const unlabeled = f.fields.filter((x) => !x.label && x.type !== 'hidden' && x.type !== 'submit' && x.type !== 'checkbox');
      if (unlabeled.length) push({ id: 'form-no-labels', category: 'forms', severity: 'high', page: route, title: `${unlabeled.length} form field(s) have no visible label`, detail: 'Placeholders disappear on input and are not accessible labels.', recommendation: 'Use a persistent label above each field.', sectionId: s.id });
      if (required === 0 && f.fields.length > 3) push({ id: 'form-no-required', category: 'forms', severity: 'low', page: route, title: 'No fields marked required', detail: 'Users cannot tell what is mandatory.', recommendation: 'Mark required fields (or mark optional ones).', sectionId: s.id });
      if (!f.action && !/^(post|get)$/i.test(f.method ?? '')) push({ id: 'form-no-action', category: 'forms', severity: 'medium', page: route, title: 'Form has no submit target', detail: 'There is no action or handler visible in the markup.', recommendation: 'Wire the form to an endpoint or service.', sectionId: s.id });
    }

    // --- Footer
    if (!page.footer.columns.length && !page.footer.legal && !page.footer.rawHtml) push({ id: 'no-footer', category: 'navigation', severity: 'low', page: route, title: 'No footer', detail: 'Footers are where people look for contact info, legal and secondary links.', recommendation: 'Add a footer with contact, legal and key links.' });

    void pageText(page as Page);
  }

  const penalty = findings.reduce((n, f) => n + SEV[f.severity], 0);
  const score = Math.round(100 * Math.exp(-penalty / 70));
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, findings };
}
