/**
 * Site IR: the framework-neutral model every adapter reads into and writes out of.
 * Content is separated from presentation; behavior stays opaque.
 */

export type Intent =
  | 'header' | 'hero' | 'logos' | 'features' | 'steps' | 'stats' | 'testimonials'
  | 'pricing' | 'faq' | 'cta' | 'contact' | 'gallery' | 'team' | 'content' | 'footer' | 'unknown';

export type PatternId =
  | 'original'
  | 'header-bar' | 'header-minimal' | 'header-split'
  | 'hero-centered' | 'hero-split' | 'hero-editorial' | 'hero-proof-first' | 'hero-statement'
  | 'features-grid' | 'features-alternating' | 'features-indexed' | 'features-bento'
  | 'steps-timeline' | 'steps-columns'
  | 'stats-strip' | 'stats-large'
  | 'quote-pull' | 'quote-wall' | 'quote-grid'
  | 'pricing-cards' | 'pricing-table'
  | 'faq-accordion' | 'faq-two-column'
  | 'cta-band' | 'cta-inline' | 'cta-split'
  | 'contact-split' | 'contact-simple'
  | 'logos-strip'
  | 'gallery-grid' | 'gallery-masonry'
  | 'team-grid' | 'team-list'
  | 'content-prose' | 'content-two-column'
  | 'footer-columns' | 'footer-minimal';

export interface Cta { text: string; href: string; kind: 'primary' | 'secondary' | 'link' }

export interface Media {
  kind: 'image' | 'video' | 'svg' | 'embed';
  src?: string;
  alt?: string;
  /** Responsive-image data, kept so the redesign never degrades what the original shipped. */
  srcset?: string;
  sizes?: string;
  width?: string;
  height?: string;
  sources?: { srcset?: string; media?: string; type?: string; sizes?: string }[];
  /** Sanitised markup for video/audio/svg/embed. */
  html?: string;
}

export interface Item {
  icon?: string;            // emoji, short text glyph, or svg markup
  iconKind?: 'emoji' | 'svg' | 'image' | 'text';
  title?: string;
  body?: string;
  image?: Media;
  href?: string;
  meta?: string;            // eyebrow / label / role
  price?: string;
  bullets?: string[];
  quote?: { text: string; author?: string; role?: string; avatar?: Media };
  highlighted?: boolean;
  cta?: Cta;
  /** Sanitised leftovers inside this item (extra paragraphs, labels, nested lists). */
  extra?: string[];
}

export interface FormField { fieldset?: string; value?: string; name?: string; label?: string; type: string; required: boolean; placeholder?: string; options?: string[]; optionGroups?: { label?: string; options: string[] }[]; group?: 'optional' }
export interface FormModel { action?: string; method?: string; fields: FormField[]; submitText: string }

export interface SectionContent {
  eyebrow?: string;         // badge pill / kicker
  heading?: string;
  headingLevel?: number;
  sub?: string;
  paragraphs: string[];
  ctas: Cta[];
  items: Item[];
  media: Media[];
  form?: FormModel;
  stats?: { value: string; label: string }[];
  logos?: Media[];
  alignment: 'left' | 'center';
  /** 'pill' = the original styled it as a badge. The redesign renders every eyebrow as a quiet kicker. */
  eyebrowKind?: 'pill' | 'kicker';
  /**
   * Coverage guarantee: sanitised HTML for source content the structured model did not capture
   * (code blocks, tables, definition lists, quotes...). Appended after the pattern.
   */
  extra?: string[];
  /** For article/documentation sections: the whole body as ordered sanitised blocks. */
  flow?: string[];
}

export type Tone = 'plain' | 'surface' | 'inverse' | 'accent';

export interface SectionVariant {
  tone: Tone;
  spacing: 'tight' | 'normal' | 'loose';
  align: 'left' | 'center';
  columns?: number;
}

export interface Section {
  id: string;
  anchor?: string;
  intent: Intent;
  confidence: number;
  pattern: PatternId;
  variant: SectionVariant;
  content: SectionContent;
  /** Original markup, kept so unmodelled sections are never lost. */
  rawHtml: string;
  /** When true the renderer emits rawHtml instead of rebuilding from content. */
  useRaw: boolean;
  origin: { tag: string; classes: string[] };
  /** Pieces of the section content that are supplementary (e.g. merged-in stats). */
  attachments: { kind: 'stats' | 'logos'; stats?: SectionContent['stats']; logos?: Media[]; heading?: string }[];
  notes: string[];
}

export interface NavLink { label: string; href: string; children?: NavLink[] }

export interface Nav {
  brand: { text?: string; logo?: Media; href: string };
  primary: NavLink[];
  secondary: NavLink[];
  cta?: Cta;
}

export interface Footer {
  blurb?: string;
  columns: { title?: string; links: NavLink[] }[];
  legal?: string;
  social: NavLink[];
  rawHtml: string;
  /** Sanitised footer content the structured model did not capture (addresses, registration lines...). */
  extra?: string[];
}

export interface Page {
  id: string;
  route: string;            // "/", "/pricing"
  file: string;             // source path relative to project root
  title: string;
  description?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  nav: Nav;
  sections: Section[];
  footer: Footer;
  chrome: { header: PatternId; footer: PatternId };
  headExtras: string[];     // preserved <meta>/<link rel=icon>/etc.
  scripts: { src?: string; inline?: string; attrs?: Record<string, string> }[];
}

export interface FontSpec { family: string; fallback: string; weights: number[]; google?: boolean }

export interface StyleSpec {
  id: string;
  name: string;
  description: string;
  colors: { bg: string; surface: string; fg: string; muted: string; accent: string; accentFg: string; line: string; inverse: string; inverseFg: string };
  type: {
    display: FontSpec; body: FontSpec; mono?: FontSpec;
    scale: number; base: number; headingWeight: number; tracking: string; leading: number;
    displayCase?: 'none' | 'uppercase'; italicAccents?: boolean;
  };
  shape: { radius: number; border: string; shadow: string; buttonRadius: number; borderWidth: number };
  space: { unit: number; sectionY: number; container: number; gutter: number };
  layout: { align: 'left' | 'center'; density: 'tight' | 'comfortable' | 'airy'; rhythm: 'uniform' | 'alternating' | 'varied'; heroPreference: PatternId[]; featurePreference: PatternId[] };
  motion: 'none' | 'minimal' | 'subtle';
  /** 'auto' also ships a dark scheme (prefers-color-scheme: dark) derived from the palette and verified for contrast. */
  darkMode?: 'off' | 'auto';
  imagery: 'duotone' | 'natural' | 'bordered' | 'grain';
}

export interface DesignSignals {
  gradients: string[];
  fonts: string[];
  radii: number[];
  shadows: string[];
  colors: string[];
  animations: string[];
  classNames: string[];
  usesTailwind: boolean;
  gradientText: boolean;
  blurBlobs: number;
  hoverScale: number;
  fadeIn: number;
  /** Elements using backdrop blur (glassmorphism) and translucent surfaces. */
  backdropBlur: number;
  translucent: number;
  glowShadows: number;
  /** Custom property names declared by the stylesheet (e.g. shadcn/ui theme tokens). */
  customProps: string[];
}

export interface Behavior { scripts: Page["scripts"]; note: string; legacyCss?: string }

export interface StackInfo {
  languages: string[];
  frameworks: string[];
  styling: string[];
  packageManager?: string;
  renderer: string;
  adapter: 'html' | 'none';
  adapterSupport: 'full' | 'planned' | 'none';
  notes: string[];
}

export interface Change {
  id: string;
  op: string;
  target: string;
  category: 'style' | 'structure' | 'navigation' | 'flow' | 'content' | 'a11y' | 'conversion';
  impact: 'high' | 'medium' | 'low';
  rationale: string;
  before?: string;
  after?: string;
  /** When rejected by the client in the editor, the plan is rebuilt without it. */
  depends?: string[];
}

export interface Redirect { from: string; to: string }

export interface SiteIR {
  version: 1;
  name: string;
  stack: StackInfo;
  pages: Page[];
  style: StyleSpec;
  signals: DesignSignals;
  behavior: Behavior;
  redirects: Redirect[];
  /** Source files Morpheus could not analyse safely; they are copied through unchanged. */
  passthrough: string[];
  changeLog: Change[];
  warnings: string[];
}

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}`;
}

export function emptyContent(): SectionContent {
  return { paragraphs: [], ctas: [], items: [], media: [], alignment: 'left' };
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section';
}
