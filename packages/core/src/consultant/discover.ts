import type { SiteIR } from '../ir';
import { siteText } from '../analyze/util';

export type Industry =
  | 'saas' | 'devtool' | 'ecommerce' | 'portfolio' | 'agency' | 'local-business' | 'restaurant'
  | 'nonprofit' | 'publication' | 'education' | 'health' | 'finance' | 'event' | 'generic';
export type Goal = 'signup' | 'purchase' | 'lead' | 'book' | 'inform' | 'showcase' | 'donate' | 'read';
export type Audience = 'developers' | 'business' | 'consumers' | 'creative' | 'general';
export type VoiceTone = 'formal' | 'friendly' | 'technical' | 'premium' | 'playful';

export interface ProjectProfile {
  brand: string;
  industry: Industry;
  goal: Goal;
  audience: Audience;
  tone: VoiceTone;
  confidence: number;
  evidence: string[];
}

const INDUSTRY_WORDS: Record<Industry, string[]> = {
  saas: ['platform', 'dashboard', 'workflow', 'integrations', 'team', 'saas', 'automation', 'analytics', 'per month', 'free trial', 'crm', 'api'],
  devtool: ['api', 'sdk', 'cli', 'open source', 'github', 'developers', 'deploy', 'docs', 'repository', 'git', 'terminal', 'infrastructure', 'npm', 'kubernetes'],
  ecommerce: ['add to cart', 'shop', 'free shipping', 'checkout', 'collection', 'shipping', 'returns', 'in stock', 'buy now', 'product'],
  portfolio: ['portfolio', 'my work', 'selected work', 'case study', 'freelance', 'hire me', 'projects', 'i design', 'i build', "i'm a"],
  agency: ['agency', 'our clients', 'our work', 'studio', 'we design', 'we build', 'brand strategy', 'creative'],
  'local-business': ['near you', 'our location', 'opening hours', 'visit us', 'call us', 'service area', 'free quote', 'family owned', 'since 19', 'plumbing', 'dental', 'salon', 'repair'],
  restaurant: ['menu', 'reservation', 'reserve a table', 'chef', 'dinner', 'brunch', 'cocktail', 'tasting', 'kitchen'],
  nonprofit: ['donate', 'our mission', 'volunteer', 'charity', 'nonprofit', 'non-profit', 'impact', 'community', 'fundraising'],
  publication: ['subscribe', 'newsletter', 'latest articles', 'read more', 'editor', 'essay', 'blog', 'podcast', 'issue'],
  education: ['course', 'curriculum', 'students', 'learn', 'lessons', 'instructor', 'enroll', 'bootcamp', 'university'],
  health: ['patients', 'clinic', 'treatment', 'wellness', 'therapy', 'appointment', 'doctor', 'care'],
  finance: ['invest', 'loan', 'bank', 'savings', 'insurance', 'mortgage', 'wealth', 'interest rate', 'portfolio performance'],
  event: ['tickets', 'speakers', 'schedule', 'venue', 'register now', 'conference', 'agenda', 'summit', 'festival'],
  generic: [],
};

const GOAL_FOR: Record<Industry, Goal> = {
  saas: 'signup', devtool: 'signup', ecommerce: 'purchase', portfolio: 'lead', agency: 'lead', 'local-business': 'book',
  restaurant: 'book', nonprofit: 'donate', publication: 'read', education: 'signup', health: 'book', finance: 'lead',
  event: 'signup', generic: 'inform',
};

function count(text: string, word: string): number {
  let n = 0, i = 0;
  while ((i = text.indexOf(word, i)) !== -1) { n += 1; i += word.length; }
  return n;
}

export function discover(ir: SiteIR, brief?: string): ProjectProfile {
  const text = (siteText(ir) + ' ' + ir.pages.map((p) => p.title).join(' ') + ' ' + (brief ?? '')).toLowerCase();
  const scores = (Object.keys(INDUSTRY_WORDS) as Industry[]).map((ind) => {
    let s = 0;
    const ev: string[] = [];
    for (const w of INDUSTRY_WORDS[ind]) {
      const n = count(text, w);
      if (n) { s += Math.min(n, 3); ev.push(w); }
    }
    return { ind, s, ev };
  });
  scores.sort((a, b) => b.s - a.s);
  const top = scores[0];
  const industry: Industry = top.s >= 2 ? top.ind : 'generic';
  let goal = GOAL_FOR[industry];

  // Structure overrides goal when the page itself is explicit.
  const intents = new Set(ir.pages.flatMap((p) => p.sections.map((s) => s.intent)));
  if (intents.has('pricing') && (industry === 'saas' || industry === 'devtool' || industry === 'generic')) goal = 'signup';
  if (/(donate|donation)/.test(text) && industry === 'nonprofit') goal = 'donate';
  if (/(reserve|reservation|book (a|your)|appointment)/.test(text) && goal === 'inform') goal = 'book';

  const audience: Audience =
    industry === 'devtool' ? 'developers' : industry === 'portfolio' || industry === 'agency' ? 'creative'
    : industry === 'saas' || industry === 'finance' ? 'business' : industry === 'generic' ? 'general' : 'consumers';

  const tone: VoiceTone =
    industry === 'devtool' ? 'technical' : industry === 'finance' || industry === 'health' ? 'formal'
    : /(luxury|premium|bespoke|exclusive|atelier)/.test(text) ? 'premium'
    : /(fun|play|delight|wow|yay)/.test(text) || industry === 'education' ? 'friendly' : 'friendly';

  const brand = ir.pages[0]?.nav.brand.text ?? ir.name;
  const confidence = Math.min(1, top.s / 8);
  return { brand, industry, goal, audience, tone, confidence: +confidence.toFixed(2), evidence: top.ev.slice(0, 6) };
}
