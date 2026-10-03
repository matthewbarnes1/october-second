import type { SiteIR } from '../ir';
import { isBlueish, isPurpleish, parseColor, extractColors } from '../color';
import { primaryFont } from '../signals';
import { EMOJI_RE, allSections, itemsAreUniform, siteText } from './util';

export interface TellResult {
  id: string;
  area: 'color' | 'type' | 'layout' | 'components' | 'copy' | 'imagery' | 'motion';
  title: string;
  weight: number;
  hit: boolean;
  evidence: string[];
}

export interface AiLookReport {
  score: number;             // 0-100, higher = more AI-looking
  level: 'distinctive' | 'mixed' | 'generic' | 'strongly-generic';
  tells: TellResult[];
  hits: TellResult[];
}

const BUZZWORDS = [
  'elevate', 'seamless', 'seamlessly', 'unlock', 'unleash', 'revolutionize', 'revolutionise', 'supercharge', 'streamline',
  'cutting-edge', 'next-generation', 'next-gen', 'game-changer', 'game-changing', 'empower', 'leverage', 'harness', 'robust',
  'effortless', 'effortlessly', 'transform your', 'take your', 'world-class', 'state-of-the-art', 'innovative', 'all-in-one',
  'reimagine', 'reimagined', 'delve', 'tapestry', 'in today\'s fast-paced', 'built for the future', 'scale with confidence',
];

const GENERIC_NAMES = /\b(john doe|jane doe|jane smith|john smith|sarah johnson|michael chen|emily rodriguez|david kim|alex rivera|sarah chen|mike johnson|emily davis|lisa wang)\b/i;
const DEFAULT_ACCENTS = new Set(['#6366f1', '#8b5cf6', '#a855f7', '#4f46e5', '#7c3aed', '#3b82f6', '#2563eb', '#ec4899', '#06b6d4', '#667eea', '#764ba2', '#818cf8', '#c084fc']);
const GENERIC_CTA = /^(get started( for free| now| today)?|learn more|start (your )?free trial|sign up (free|now|today)|book a demo|request a demo|try (it )?(for )?free)$/i;

type Rule = Omit<TellResult, 'hit' | 'evidence'> & { test: (ir: SiteIR) => string[] | null };

const RULES: Rule[] = [
  {
    id: 'purple-blue-gradient', area: 'color', title: 'Purple/indigo-to-blue gradient', weight: 10,
    test: (ir) => {
      const ev: string[] = [];
      for (const g of ir.signals.gradients) {
        if (g.startsWith('tailwind:')) {
          if (/(from|via|to)-(purple|indigo|violet|fuchsia|blue|sky|cyan)-/.test(g)) ev.push(g.slice(9));
          continue;
        }
        const cols = extractColors(g);
        if (cols.some(isPurpleish) || (cols.some(isBlueish) && cols.length > 1 && cols.some((c) => isPurpleish(c) || isBlueish(c)))) ev.push(g.slice(0, 70));
      }
      return ev.length ? [...new Set(ev)].slice(0, 4) : null;
    },
  },
  {
    id: 'gradient-text', area: 'color', title: 'Gradient-filled headline text', weight: 6,
    test: (ir) => (ir.signals.gradientText ? ['background-clip:text / text-transparent on a gradient'] : null),
  },
  {
    id: 'glow-blobs', area: 'color', title: 'Blurred glow blobs behind content', weight: 5,
    test: (ir) => (ir.signals.blurBlobs > 0 ? [`${ir.signals.blurBlobs} large blur() layer(s)`] : null),
  },
  {
    id: 'default-palette', area: 'color', title: 'Untouched framework/default accent colours', weight: 4,
    test: (ir) => {
      const hits = ir.signals.colors.filter((c) => DEFAULT_ACCENTS.has(c.toLowerCase()));
      const tw = ir.signals.gradients.filter((g) => /-(indigo|purple|violet)-(500|600)/.test(g));
      const all = [...hits, ...tw.map((t) => t.slice(9))];
      return all.length >= 2 ? all.slice(0, 4) : null;
    },
  },
  {
    id: 'inter-only', area: 'type', title: 'Inter / system font as the only typeface', weight: 6,
    test: (ir) => {
      const fams = ir.signals.fonts.map((f) => f.split(',')[0]?.replace(/['"]/g, '').trim().toLowerCase()).filter(Boolean) as string[];
      const named = new Set(fams.filter((f) => !/^(inherit|serif|sans-serif|monospace|system-ui|-apple-system|ui-sans-serif)$/.test(f)));
      const font = primaryFont(ir.signals.fonts);
      const generic = !font || /^(inter|system-ui|-apple-system|segoe ui|roboto|helvetica|arial|ui-sans-serif|poppins|open sans)$/i.test(font);
      return generic && named.size <= 1 ? [font ? `${font} used everywhere` : 'no deliberate typeface'] : null;
    },
  },
  {
    id: 'flat-type-scale', area: 'type', title: 'No display/body pairing (single family, uniform weights)', weight: 3,
    test: (ir) => {
      const fams = new Set(ir.signals.fonts.map((f) => f.split(',')[0]?.replace(/['"]/g, '').trim().toLowerCase()).filter((f) => f && !/inherit|serif|monospace/.test(f)));
      return fams.size <= 1 ? [`${fams.size} font family`] : null;
    },
  },
  {
    id: 'centered-hero-pills', area: 'layout', title: 'Centered hero with badge pill and two buttons', weight: 9,
    test: (ir) => {
      for (const { section: s } of allSections(ir)) {
        if (s.intent !== 'hero') continue;
        const c = s.content;
        const score = Number(c.alignment === 'center') + Number(!!c.eyebrow) + Number(c.ctas.length >= 2);
        if (score >= 2) return [`hero: ${c.alignment}-aligned${c.eyebrow ? `, badge "${c.eyebrow.slice(0, 40)}"` : ''}, ${c.ctas.length} CTAs`];
      }
      return null;
    },
  },
  {
    id: 'uniform-feature-grid', area: 'layout', title: 'Uniform card grid of identical icon + title + text items', weight: 9,
    test: (ir) => {
      const ev: string[] = [];
      for (const { section: s } of allSections(ir)) {
        if (['features-grid', 'steps-columns', 'quote-grid'].includes(s.pattern) && ['features', 'steps', 'unknown', 'content'].includes(s.intent) && itemsAreUniform(s.content.items) && s.content.items.length >= 3) {
          ev.push(`${s.content.items.length} identical items in "${s.content.heading ?? s.intent}"`);
        }
      }
      return ev.length ? ev.slice(0, 3) : null;
    },
  },
  {
    id: 'all-centered-sections', area: 'layout', title: 'Every section uses the same centered heading + subtitle rhythm', weight: 6,
    test: (ir) => {
      const secs = allSections(ir).map((x) => x.section).filter((s) => !['header', 'footer'].includes(s.intent));
      if (secs.length < 4) return null;
      const centered = secs.filter((s) => s.content.alignment === 'center' && s.content.heading).length;
      return centered / secs.length >= 0.7 ? [`${centered}/${secs.length} sections centered`] : null;
    },
  },
  {
    id: 'stock-section-order', area: 'layout', title: 'Textbook landing-page section order', weight: 6,
    test: (ir) => {
      const home = ir.pages.find((p) => p.route === '/') ?? ir.pages[0];
      if (!home) return null;
      const seq = home.sections.map((s) => s.intent).filter((i) => !['header', 'footer', 'unknown', 'content'].includes(i));
      const stock = ['hero', 'logos', 'features', 'stats', 'testimonials', 'pricing', 'faq', 'cta'];
      let idx = -1, matched = 0;
      for (const i of seq) {
        const at = stock.indexOf(i);
        if (at > idx) { idx = at; matched += 1; }
      }
      return matched >= 5 && matched >= seq.length - 1 ? [seq.join(' → ')] : null;
    },
  },
  {
    id: 'emoji-icons', area: 'components', title: 'Emoji or generic glyphs used as feature icons', weight: 6,
    test: (ir) => {
      const ev: string[] = [];
      for (const { section: s } of allSections(ir)) {
        const emoji = s.pattern === 'features-grid' || s.useRaw ? s.content.items.filter((i) => i.iconKind === 'emoji' || (i.icon && EMOJI_RE.test(i.icon))) : [];
        if (emoji.length >= 2) ev.push(`${emoji.length} emoji icons in "${s.content.heading ?? s.intent}"`);
        else if (s.content.heading && EMOJI_RE.test(s.content.heading)) ev.push(`emoji in heading "${s.content.heading.slice(0, 40)}"`);
      }
      return ev.length ? ev : null;
    },
  },
  {
    id: 'identical-soft-cards', area: 'components', title: 'One rounded, soft-shadow card style repeated everywhere', weight: 5,
    test: (ir) => {
      const r = ir.signals.radii.filter((x) => x >= 12 && x < 100);
      const sh = ir.signals.shadows.length;
      return r.length >= 2 && sh >= 1 ? [`${r.length} large-radius declarations, ${sh} shadow declarations`] : null;
    },
  },
  {
    id: 'pill-badges', area: 'components', title: 'Pill badges ("New", "Now in beta", "✨ Introducing…")', weight: 4,
    test: (ir) => {
      const ev = allSections(ir).filter(({ section: s }) => s.content.eyebrow && s.content.eyebrow.length < 60 && /new|beta|introducing|launch|v\d|announc|now|✨|🚀|trusted|#1|powered/i.test(s.content.eyebrow)).map(({ section: s }) => `"${s.content.eyebrow}"`);
      return ev.length ? ev.slice(0, 3) : null;
    },
  },
  {
    id: 'buzzword-copy', area: 'copy', title: 'Generic marketing buzzwords', weight: 8,
    test: (ir) => {
      const t = siteText(ir).toLowerCase();
      const found = BUZZWORDS.filter((b) => t.includes(b));
      return found.length >= 3 ? found.slice(0, 6) : null;
    },
  },
  {
    id: 'generic-cta-copy', area: 'copy', title: 'Stock CTA labels ("Get Started", "Learn More")', weight: 3,
    test: (ir) => {
      const labels = allSections(ir).flatMap(({ section: s }) => s.content.ctas.map((c) => c.text.trim()));
      const generic = labels.filter((l) => GENERIC_CTA.test(l));
      return generic.length >= 2 ? [...new Set(generic)].slice(0, 4) : null;
    },
  },
  {
    id: 'placeholder-proof', area: 'copy', title: 'Placeholder-feeling social proof', weight: 4,
    test: (ir) => {
      const t = siteText(ir);
      const ev: string[] = [];
      const name = t.match(GENERIC_NAMES);
      if (name) ev.push(`stock name "${name[0]}"`);
      if (/(\b10,?000\+|\b99\.9+%|\b50,?000\+|\b1m\+|\b4\.9\/5|\b24\/7)/i.test(t)) ev.push('round-number stats (10,000+, 99.9%, 24/7)');
      if (/lorem ipsum|your company|company name|your text here|placeholder/i.test(t)) ev.push('placeholder text');
      return ev.length >= 1 && (name || ev.length >= 2) ? ev : null;
    },
  },
  {
    id: 'placeholder-imagery', area: 'imagery', title: 'No real imagery, only gradients or abstract placeholders', weight: 4,
    test: (ir) => {
      const imgs = allSections(ir).reduce((n, { section: s }) => n + s.content.media.filter((m) => m.kind === 'image').length + s.content.items.filter((i) => i.image).length, 0);
      const hasSvgDeco = allSections(ir).some(({ section: s }) => s.content.media.some((m) => m.kind === 'svg'));
      return imgs === 0 && ir.pages.length > 0 && (ir.signals.gradients.length > 0 || hasSvgDeco) ? ['zero raster images; visuals are gradients/SVG'] : null;
    },
  },
  {
    id: 'motion-on-everything', area: 'motion', title: 'Fade-up / slide-in on every block', weight: 4,
    test: (ir) => (ir.signals.fadeIn >= 3 ? [`${ir.signals.fadeIn} entrance-animation hooks`] : null),
  },
  {
    id: 'hover-scale-everywhere', area: 'motion', title: 'Hover scale on every card/button', weight: 3,
    test: (ir) => (ir.signals.hoverScale >= 2 ? [`${ir.signals.hoverScale} hover:scale rules`] : null),
  },
];

export function scoreAiLook(ir: SiteIR): AiLookReport {
  const tells: TellResult[] = RULES.map((r) => {
    const ev = r.test(ir);
    return { id: r.id, area: r.area, title: r.title, weight: r.weight, hit: !!ev, evidence: ev ?? [] };
  });
  const total = tells.reduce((n, t) => n + t.weight, 0);
  const got = tells.filter((t) => t.hit).reduce((n, t) => n + t.weight, 0);
  const score = Math.min(100, Math.round((got / total) * 135));
  const level = score >= 65 ? 'strongly-generic' : score >= 40 ? 'generic' : score >= 20 ? 'mixed' : 'distinctive';
  return { score, level, tells, hits: tells.filter((t) => t.hit).sort((a, b) => b.weight - a.weight) };
}

void parseColor;
