import type { Intent, Page, PatternId, Section, StyleSpec } from '../ir';
import { itemsAreUniform } from '../analyze/util';
import type { ProjectProfile } from './discover';

export interface PatternInfo {
  id: PatternId;
  intent: Intent | 'chrome';
  label: string;
  blurb: string;
}

export const PATTERNS: PatternInfo[] = [
  { id: 'header-bar', intent: 'chrome', label: 'Header bar', blurb: 'Brand left, links centre-right, one action at the end.' },
  { id: 'header-minimal', intent: 'chrome', label: 'Minimal header', blurb: 'Brand and a single menu line; for pages with few destinations.' },
  { id: 'header-split', intent: 'chrome', label: 'Split header', blurb: 'Brand centred over a ruled link row; editorial feel.' },
  { id: 'hero-centered', intent: 'hero', label: 'Centered hero (original)', blurb: 'The default template hero; kept only if the client prefers it.' },
  { id: 'hero-split', intent: 'hero', label: 'Split hero', blurb: 'Text on one side, visual or proof on the other.' },
  { id: 'hero-editorial', intent: 'hero', label: 'Editorial hero', blurb: 'Large left-aligned headline with a narrow supporting column.' },
  { id: 'hero-proof-first', intent: 'hero', label: 'Proof-first hero', blurb: 'Headline and action with logos or numbers attached directly beneath.' },
  { id: 'hero-statement', intent: 'hero', label: 'Statement hero', blurb: 'One oversized sentence; nothing else competes.' },
  { id: 'features-grid', intent: 'features', label: 'Feature grid', blurb: 'Compact grid; only used when items are visual or numerous.' },
  { id: 'features-alternating', intent: 'features', label: 'Alternating rows', blurb: 'Each feature gets its own row with space to explain.' },
  { id: 'features-indexed', intent: 'features', label: 'Indexed list', blurb: 'Numbered rows with hairline rules; fast to scan.' },
  { id: 'features-bento', intent: 'features', label: 'Bento', blurb: 'Mixed-size tiles that give key features more weight.' },
  { id: 'steps-timeline', intent: 'steps', label: 'Timeline', blurb: 'Vertical sequence with a connecting rule.' },
  { id: 'steps-columns', intent: 'steps', label: 'Numbered columns', blurb: 'Large numerals above short columns.' },
  { id: 'stats-strip', intent: 'stats', label: 'Stat strip', blurb: 'A single ruled row of numbers.' },
  { id: 'stats-large', intent: 'stats', label: 'Large stats', blurb: 'Few numbers, shown big.' },
  { id: 'quote-pull', intent: 'testimonials', label: 'Pull quote', blurb: 'One quote, set large.' },
  { id: 'quote-wall', intent: 'testimonials', label: 'Staggered quotes', blurb: 'Offset columns of quotes.' },
  { id: 'quote-grid', intent: 'testimonials', label: 'Quote grid', blurb: 'Compact grid for many quotes.' },
  { id: 'pricing-cards', intent: 'pricing', label: 'Pricing cards', blurb: 'Plans side by side with one emphasised.' },
  { id: 'pricing-table', intent: 'pricing', label: 'Pricing table', blurb: 'A comparison table: plans as columns, features as rows.' },
  { id: 'faq-accordion', intent: 'faq', label: 'Accordion', blurb: 'Collapsible questions.' },
  { id: 'faq-two-column', intent: 'faq', label: 'Two-column FAQ', blurb: 'Question and answer visible together, no clicks.' },
  { id: 'cta-band', intent: 'cta', label: 'CTA band', blurb: 'Full-width coloured band.' },
  { id: 'cta-inline', intent: 'cta', label: 'Inline CTA', blurb: 'A quiet ruled line with the action.' },
  { id: 'cta-split', intent: 'cta', label: 'Split CTA', blurb: 'Headline beside a form or action.' },
  { id: 'contact-split', intent: 'contact', label: 'Split contact', blurb: 'Details beside the form.' },
  { id: 'contact-simple', intent: 'contact', label: 'Simple contact', blurb: 'Single column.' },
  { id: 'logos-strip', intent: 'logos', label: 'Logo strip', blurb: 'Muted single-line strip.' },
  { id: 'gallery-grid', intent: 'gallery', label: 'Gallery grid', blurb: 'Even grid.' },
  { id: 'gallery-masonry', intent: 'gallery', label: 'Masonry gallery', blurb: 'Staggered columns.' },
  { id: 'team-grid', intent: 'team', label: 'Team grid', blurb: 'Portraits in a grid.' },
  { id: 'team-list', intent: 'team', label: 'Team list', blurb: 'Names in a ruled list.' },
  { id: 'content-prose', intent: 'content', label: 'Prose', blurb: 'Comfortable reading column.' },
  { id: 'content-two-column', intent: 'content', label: 'Two-column prose', blurb: 'Heading beside the text.' },
  { id: 'footer-columns', intent: 'chrome', label: 'Footer columns', blurb: 'Grouped links.' },
  { id: 'footer-minimal', intent: 'chrome', label: 'Minimal footer', blurb: 'Single line.' },
];

export const PATTERN_BY_ID = new Map(PATTERNS.map((p) => [p.id, p]));

export function patternsFor(intent: Intent): PatternInfo[] {
  return PATTERNS.filter((p) => p.intent === intent);
}

export interface Choice {
  pattern: PatternId;
  why: string;
}

function firstAllowed(prefs: PatternId[], allowed: (p: PatternId) => boolean, fallback: PatternId): PatternId {
  return prefs.find(allowed) ?? fallback;
}

export function choosePattern(section: Section, ctx: { page: Page; style: StyleSpec; profile: ProjectProfile }): Choice {
  const { style, profile } = ctx;
  const c = section.content;
  const n = c.items.length;
  const hasVisual = c.media.length > 0 || section.attachments.length > 0 || !!(c.stats && c.stats.length);

  switch (section.intent) {
    case 'hero': {
      if (section.attachments.length && (profile.goal === 'signup' || profile.goal === 'purchase' || profile.goal === 'lead')) {
        return { pattern: 'hero-proof-first', why: 'The hero carries the page\'s one action, and logos or numbers directly beneath it answer "can I trust this?" before the visitor scrolls.' };
      }
      const headingWords = (c.heading ?? '').split(/\s+/).length;
      const pick = firstAllowed(
        style.layout.heroPreference,
        (p) => (p === 'hero-split' ? hasVisual || c.media.length > 0 : p === 'hero-statement' ? headingWords <= 12 : true),
        headingWords <= 12 ? 'hero-statement' : 'hero-editorial',
      );
      const why: Record<string, string> = {
        'hero-split': 'A split hero pairs the promise with a visual and avoids the centered-stack template.',
        'hero-editorial': 'A left-aligned editorial hero reads like a page someone composed, with the headline given real scale.',
        'hero-statement': 'The headline is short enough to carry the hero alone, so it is set oversized with nothing competing.',
        'hero-proof-first': 'Proof beside the headline builds trust sooner.',
      };
      return { pattern: pick, why: why[pick] ?? 'Matches the chosen style.' };
    }
    case 'features': {
      if (n <= 2) return { pattern: 'features-alternating', why: 'With only a couple of features, each deserves a full row instead of a lonely card.' };
      const uniform = itemsAreUniform(c.items);
      const prefs = style.layout.featurePreference;
      const hasImages = c.items.some((i) => i.image);
      const pick = firstAllowed(
        prefs,
        (p) => (p === 'features-bento' ? n >= 4 && n <= 7 : p === 'features-alternating' ? n <= 6 : p === 'features-grid' ? hasImages || n >= 8 : true),
        n >= 8 ? 'features-grid' : 'features-indexed',
      );
      const why: Record<string, string> = {
        'features-alternating': `${n} features in an identical card grid is the clearest AI tell; alternating rows give each one room and a different rhythm.`,
        'features-indexed': `${n} items are easier to scan as a numbered, ruled list than as ${uniform ? 'identical' : 'equal'} cards.`,
        'features-bento': 'Tiles of different sizes tell the reader which features matter most.',
        'features-grid': 'Many items or images suit a compact grid.',
      };
      return { pattern: pick, why: why[pick] ?? 'Chosen to break the uniform card grid.' };
    }
    case 'steps':
      return n <= 4
        ? { pattern: 'steps-timeline', why: 'A connected vertical sequence makes order explicit.' }
        : { pattern: 'steps-columns', why: 'Many steps fit numbered columns better than a long timeline.' };
    case 'stats':
      return (c.stats?.length ?? 0) <= 3
        ? { pattern: 'stats-large', why: 'Few numbers read best when shown big.' }
        : { pattern: 'stats-strip', why: 'Several numbers read best as one ruled strip.' };
    case 'testimonials':
      if (n === 1) return { pattern: 'quote-pull', why: 'A single quote is more persuasive set large than lost in a card.' };
      if (n <= 3) return { pattern: 'quote-wall', why: 'Offset columns keep a small set of quotes from looking like a card row.' };
      return { pattern: 'quote-grid', why: 'Many quotes need a compact grid.' };
    case 'pricing': {
      const tiers = c.items.filter((i) => i.price);
      const feats = tiers.map((t) => t.bullets?.length ?? 0);
      if (tiers.length >= 3 && feats.every((f) => f >= 3)) return { pattern: 'pricing-table', why: 'Three plans with matching feature lists are a comparison task; a table makes differences visible.' };
      return { pattern: 'pricing-cards', why: 'Few plans work best side by side, with the recommended one emphasised.' };
    }
    case 'faq':
      return n >= 8
        ? { pattern: 'faq-two-column', why: 'Many questions are quicker to read all at once than to open one by one.' }
        : { pattern: 'faq-accordion', why: 'A short FAQ stays compact as an accordion.' };
    case 'cta':
      if (c.form) return { pattern: 'cta-split', why: 'A form beside the headline removes a click.' };
      return { pattern: 'cta-band', why: 'A closing band gives the page a clear final action.' };
    case 'contact':
      return c.paragraphs.length || c.items.length ? { pattern: 'contact-split', why: 'Contact details beside the form answer "how else can I reach you?" without scrolling.' } : { pattern: 'contact-simple', why: 'A simple form needs no extra structure.' };
    case 'logos':
      return { pattern: 'logos-strip', why: 'Logos are supporting evidence and should stay quiet.' };
    case 'gallery':
      return c.media.length >= 6 ? { pattern: 'gallery-masonry', why: 'Mixed image shapes flow better in staggered columns.' } : { pattern: 'gallery-grid', why: 'A few images read cleanly in a grid.' };
    case 'team':
      return n > 8 ? { pattern: 'team-list', why: 'A long team reads faster as a list.' } : { pattern: 'team-grid', why: 'Portraits with names suit a grid.' };
    case 'content': {
      const words = c.paragraphs.join(' ').split(/\s+/).length;
      return words > 160 && c.heading ? { pattern: 'content-two-column', why: 'A long passage reads better with the heading beside it than above a full-width block.' } : { pattern: 'content-prose', why: 'A comfortable reading measure.' };
    }
    default:
      return { pattern: 'content-prose', why: 'Unclassified section kept readable; original markup preserved where it cannot be modelled.' };
  }
}

export function chooseChrome(page: Page, style: StyleSpec): { header: PatternId; footer: PatternId } {
  const links = page.nav.primary.length;
  const header: PatternId = style.id.includes('editorial') || style.id.includes('luxury') ? 'header-split' : links <= 3 ? 'header-minimal' : 'header-bar';
  const cols = page.footer.columns.length;
  return { header, footer: cols >= 2 ? 'footer-columns' : 'footer-minimal' };
}

/** The pattern that matches what a stock template would have produced; used so Polish depth keeps structure. */
export function conventionalPattern(intent: Intent, alignment: 'left' | 'center', hasMedia: boolean): PatternId {
  switch (intent) {
    case 'hero': return alignment === 'center' ? 'hero-centered' : hasMedia ? 'hero-split' : 'hero-editorial';
    case 'features': return 'features-grid';
    case 'steps': return 'steps-columns';
    case 'stats': return 'stats-strip';
    case 'testimonials': return 'quote-grid';
    case 'pricing': return 'pricing-cards';
    case 'faq': return 'faq-accordion';
    case 'cta': return 'cta-band';
    case 'contact': return 'contact-simple';
    case 'logos': return 'logos-strip';
    case 'gallery': return 'gallery-grid';
    case 'team': return 'team-grid';
    default: return 'content-prose';
  }
}
