import type { Intent, SectionContent } from '@morpheus/core';
import { El, attr, classes, tag } from './dom';

const NAME_HINTS: [Intent, RegExp][] = [
  ['hero', /\b(hero|banner|jumbotron|masthead|splash|landing-top|intro)\b/i],
  ['logos', /\b(logos?|trusted|partners?|clients?|brands?|as-seen|press)\b/i],
  ['stats', /\b(stats?|numbers|metrics|counters?|figures|by-the-numbers)\b/i],
  ['features', /\b(features?|benefits?|services?|why|capabilities|solutions?|what-we-do|offer)\b/i],
  ['steps', /\b(steps?|how-?it-?works|process|workflow|timeline)\b/i],
  ['testimonials', /\b(testimonials?|reviews?|quotes?|customers?-say|love|praise|stories)\b/i],
  ['pricing', /\b(pricing|plans?|prices?|packages?|tiers?)\b/i],
  ['faq', /\b(faq|questions|accordion|help)\b/i],
  ['cta', /\b(cta|call-to-action|get-started|signup|sign-up|newsletter|final)\b/i],
  ['contact', /\b(contact|get-in-touch|reach|enquir|inquir)\b/i],
  ['gallery', /\b(gallery|portfolio|work|projects?|showcase|case-?studies)\b/i],
  ['team', /\b(team|people|founders?|staff|crew|meet)\b/i],
];

const HEADING_HINTS: [Intent, RegExp][] = [
  ['features', /\b(features?|benefits?|why (choose|us|\w+)|everything you need|built for|capabilities|what we|services|what you get|designed to|powerful)\b/i],
  ['steps', /\b(how it works|getting started|in \d+ (easy )?steps|simple steps|our process|three steps)\b/i],
  ['testimonials', /\b(what (our|people|customers|users|clients)|testimonials?|reviews?|loved by|trusted by thousands|success stories|customers say)\b/i],
  ['pricing', /\b(pricing|plans|choose your plan|simple pricing|packages)\b/i],
  ['faq', /\b(faq|frequently asked|questions|got questions)\b/i],
  ['cta', /\b(ready to|get started|start (your|today|now|building|free)|join (us|today|thousands)|don't miss|take the next step|let's)\b/i],
  ['contact', /\b(contact|get in touch|say hello|reach out|talk to)\b/i],
  ['gallery', /\b(gallery|our work|selected work|projects|portfolio|case studies)\b/i],
  ['team', /\b(our team|meet the|the team|who we are|founders)\b/i],
  ['logos', /\b(trusted by|used by|as seen|our partners|backed by|powering)\b/i],
  ['stats', /\b(by the numbers|in numbers|our impact|results)\b/i],
];

export interface Classification { intent: Intent; confidence: number }

export function classify(el: El, content: SectionContent, ctx: { isFirst: boolean; isLast: boolean; hasH1: boolean; index: number }): Classification {
  const scores = new Map<Intent, number>();
  const add = (i: Intent, n: number) => scores.set(i, (scores.get(i) ?? 0) + n);

  const names = `${attr(el, 'id') ?? ''} ${classes(el).join(' ')} ${tag(el)}`;
  for (const [intent, re] of NAME_HINTS) if (re.test(names)) add(intent, 3);
  const heading = content.heading ?? '';
  for (const [intent, re] of HEADING_HINTS) if (re.test(heading)) add(intent, 2.5);

  // Structure
  const n = content.items.length;
  const priceItems = content.items.filter((i) => i.price).length;
  const quoteItems = content.items.filter((i) => i.quote).length;
  const qa = content.items.filter((i) => i.title && /\?$/.test(i.title.trim())).length;
  if (priceItems >= 2) add('pricing', 6);
  if (quoteItems >= 1 && quoteItems >= n / 2) add('testimonials', 6);
  if (qa >= 2 && qa >= n / 2) add('faq', 6);
  if (content.stats && content.stats.length >= 2) add('stats', 6);
  if (content.logos && content.logos.length >= 3) add('logos', 5);
  if (content.form) add(heading && /contact|touch|message|talk|hello|reach/i.test(heading) ? 'contact' : content.form.fields.length <= 2 ? 'cta' : 'contact', 4);
  if (n >= 3 && priceItems === 0 && quoteItems === 0 && qa === 0) {
    add('features', 2);
    if (content.items.every((i) => i.image)) add('gallery', 2);
    if (content.items.every((i) => /^\d+[.)]?$|^step\s*\d+/i.test((i.icon ?? i.meta ?? '').trim()))) add('steps', 4);
  }
  if (n === 0 && !content.stats && !content.form) {
    if (content.ctas.length >= 1 && content.paragraphs.length === 0 && !content.media.length && ctx.index > 1) add('cta', 2.5);
    if (content.paragraphs.length >= 2) add('content', 2);
  }
  // Hero
  if (ctx.isFirst) add('hero', 2);
  if (ctx.hasH1) add('hero', 3);
  if (content.headingLevel === 1) add('hero', 2);
  if (ctx.isLast && content.ctas.length && n === 0) add('cta', 2);

  let best: Intent = 'unknown';
  let top = 0;
  for (const [intent, score] of scores) if (score > top) { top = score; best = intent; }
  if (top < 2) best = content.paragraphs.length ? 'content' : 'unknown';
  return { intent: best, confidence: Math.min(1, top / 8) };
}
