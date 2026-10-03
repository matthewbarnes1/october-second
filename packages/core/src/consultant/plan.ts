import type { Change, Cta, Intent, NavLink, Page, Section, SiteIR, StyleSpec, Tone } from '../ir';
import { clone } from '../ir';
import { analyze } from '../analyze';
import { discover, type Goal, type ProjectProfile } from './discover';
import { applyOp, isBadgeLike, navScore, sectionLabel, shortLabel, type Operation } from './apply';
import { choosePattern, chooseChrome, PATTERN_BY_ID } from './patterns';
import { sanitizeStyle } from '../style/sanitize';

export type Depth = 'polish' | 'restructure' | 'redesign';

export interface PlanOptions {
  depth: Depth;
  style: StyleSpec;
  brief?: string;
  /** Operation ids the client rejected in the editor. */
  excluded?: string[];
  /** Operations the client added by hand in the editor. */
  manual?: Operation[];
}

export interface RedesignPlan {
  depth: Depth;
  profile: ProjectProfile;
  style: StyleSpec;
  ops: Operation[];
  excluded: string[];
}

const ORDER: Record<Goal, Intent[]> = {
  signup: ['hero', 'logos', 'stats', 'features', 'testimonials', 'steps', 'pricing', 'faq', 'team', 'gallery', 'contact', 'cta'],
  purchase: ['hero', 'gallery', 'features', 'testimonials', 'stats', 'steps', 'pricing', 'faq', 'contact', 'cta'],
  lead: ['hero', 'logos', 'gallery', 'features', 'testimonials', 'steps', 'stats', 'team', 'pricing', 'faq', 'contact', 'cta'],
  book: ['hero', 'features', 'gallery', 'testimonials', 'team', 'pricing', 'faq', 'contact', 'cta'],
  inform: ['hero', 'features', 'steps', 'stats', 'team', 'faq', 'contact', 'cta'],
  showcase: ['hero', 'gallery', 'features', 'testimonials', 'team', 'contact', 'cta'],
  donate: ['hero', 'stats', 'features', 'testimonials', 'gallery', 'team', 'faq', 'cta'],
  read: ['hero', 'features', 'gallery', 'team', 'contact', 'cta'],
};

const RHYTHM_TONES: Record<string, Partial<Record<Intent, Tone>>> = {
  varied: { hero: 'plain', logos: 'plain', stats: 'surface', features: 'surface', steps: 'plain', testimonials: 'inverse', pricing: 'plain', faq: 'surface', cta: 'accent', contact: 'surface', team: 'plain', gallery: 'plain' },
};

function mk(id: string, op: Operation['type'], change: Omit<Change, 'id' | 'op'>, extra: Partial<Operation> = {}): Operation {
  return { id, type: op, params: {}, ...extra, change: { id, op, ...change } };
}

export function planRedesign(source: SiteIR, options: PlanOptions): RedesignPlan {
  const { depth } = options;
  const style = sanitizeStyle(options.style);
  const profile = discover(source, options.brief);
  const work = clone(source);
  work.changeLog = [];
  const excluded = new Set(options.excluded ?? []);
  const ops: Operation[] = [];
  const emit = (op: Operation) => {
    ops.push(op);
    if (!excluded.has(op.id)) applyOp(work, op);
  };
  const restructure = depth !== 'polish';
  const redesign = depth === 'redesign';

  const before = analyze(source);

  // ---- 1. Visual system -----------------------------------------------------------------
  emit(mk('set-style', 'set-style', {
    target: 'site', category: 'style', impact: 'high',
    rationale: `Applies the "${style.name}" visual system (type, colour, shape, spacing). ${style.description}`,
    before: `${source.style.name}`, after: style.name,
  }, { params: { style } }));

  for (const page of [...work.pages]) {
    const route = page.route;
    const pid = (s: string) => `${s}:${route}`;
    const sid = (t: string, id: string) => `${t}:${route}:${id}`;

    // ---- 2. Document-level fixes (all depths) ------------------------------------------
    const hero = page.sections.find((s) => s.intent === 'hero') ?? page.sections.find((s) => s.content.heading);
    const meta: Record<string, string> = {};
    if (!page.lang) meta.lang = 'en';
    if (!page.description) {
      const src = hero?.content.sub ?? hero?.content.paragraphs[0];
      if (src) meta.description = src.length > 155 ? src.slice(0, 152).replace(/\s+\S*$/, '') + '…' : src;
    }
    const brandName = page.nav.brand.text ?? work.name;
    const latin = /^[\x00-\u024f\s\p{P}]*$/u.test(page.title);
    const thinTitle = !page.title || (latin ? page.title.length < 8 || page.title.trim() === brandName : page.title.length < 2);
    if (thinTitle && hero?.content.heading) {
      const t = `${brandName}: ${hero.content.heading}`;
      meta.title = t.length > 62 ? t.slice(0, 59).replace(/\s+\S*$/, '') + '…' : t;
    }
    const params: Record<string, any> = { ...meta };
    if (!page.headExtras.some((h) => /og:title/i.test(h))) {
      params.og = { title: meta.title ?? (page.title || `${brandName}`), description: meta.description ?? page.description ?? hero?.content.sub?.slice(0, 155) ?? '' };
    }
    if (!page.headExtras.some((h) => /viewport/i.test(h))) params.viewport = true;
    if (Object.keys(params).length) {
      emit(mk(pid('fix-meta'), 'fix-meta', {
        target: route, category: 'content', impact: params.viewport ? 'high' : 'low',
        rationale: [params.viewport ? 'Added the responsive viewport tag (without it phones render a shrunken desktop layout)' : '', meta.lang ? 'declared the page language (assumed English; change if wrong)' : '', meta.description ? 'wrote a meta description from the hero text' : '', meta.title ? `replaced the thin page title with "${meta.title}"` : '', params.og ? 'added Open Graph and Twitter card tags so links preview properly when shared' : ''].filter(Boolean).join('; ').replace(/^./, (c) => c.toUpperCase()) + '.',
      }, { page: route, params }));
    }
    if (page.sections.some((s) => s.content.form?.fields.some((f) => !f.label && f.type !== 'checkbox'))) {
      emit(mk(pid('fix-labels'), 'fix-labels', {
        target: route, category: 'a11y', impact: 'high',
        rationale: 'Gave every form field a persistent visible label (taken from its placeholder). Placeholders vanish while typing and are not reliable accessible names.',
      }, { page: route }));
    }

    const levelsOk = hero && page.sections.filter((s) => s.content.heading && s.content.headingLevel === 1).length === 1 && hero.content.headingLevel === 1;
    if (hero && hero.content.heading && !levelsOk) {
      emit(mk(pid('fix-headings'), 'fix-headings', {
        target: route, category: 'a11y', impact: 'medium',
        rationale: 'Established one H1 (the hero) with H2 section headings so the page has a correct outline for screen readers and search.',
      }, { page: route, params: { h1: hero.id } }));
    }

    const missingAlt = page.sections.some((s) => [...s.content.media, ...s.content.items.map((i) => i.image).filter(Boolean), ...(s.content.logos ?? [])].some((m) => m && m.kind === 'image' && m.alt == null));
    if (missingAlt) {
      emit(mk(pid('fix-alt'), 'fix-alt', {
        target: route, category: 'a11y', impact: 'high',
        rationale: 'Added alt text to images that had none, taken from the nearest heading or filename. Review for accuracy.',
      }, { page: route }));
    }

    for (const s of page.sections) {
      const eb = s.content.eyebrow;
      if (eb && (s.content.eyebrowKind === 'pill' || (s.intent === 'hero' && isBadgeLike(eb)))) {
        const cleaned = eb.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+|[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/gu, '').trim() || eb;
        emit(mk(sid('strip-badge', s.id), 'strip-badge', {
          target: `${route} ${sectionLabel(s)}`, category: 'content', impact: 'medium',
          rationale: `Turned the pill badge "${eb}" into a quiet kicker line above the headline and removed decorative emoji. The wording is unchanged; the pill is a stock template device that competes with the headline.`,
          before: eb, after: cleaned,
        }, { page: route, section: s.id, params: { text: cleaned } }));
      }
    }

    // ---- 3. Restructure -------------------------------------------------------------------
    if (restructure) {
      // Merge thin proof sections into the hero.
      const heroIdx = page.sections.findIndex((s) => s.intent === 'hero');
      if (heroIdx >= 0) {
        for (const kind of ['logos', 'stats'] as const) {
          const cand = page.sections.slice(heroIdx + 1, heroIdx + 3).find((s) => s.intent === kind && !s.content.items.length);
          const attached = page.sections[heroIdx].attachments.some((a) => a.kind === kind);
          if (cand && !attached && ['signup', 'purchase', 'lead'].includes(profile.goal)) {
            emit(mk(sid('merge-sections', cand.id), 'merge-sections', {
              target: `${route} ${sectionLabel(cand)}`, category: 'structure', impact: 'high',
              rationale: kind === 'logos'
                ? 'Moved the logo row up under the hero headline. Trust signals do the most work next to the first call to action, and it removes a separate thin section.'
                : 'Folded the headline numbers into the hero so the claim and its evidence are read together.',
            }, { page: route, section: page.sections[heroIdx].id, params: { from: cand.id, kind } }));
          }
        }
      }

      // CTA hygiene
      for (const s of work.pages.find((p) => p.route === route)!.sections) {
        const ctas = s.content.ctas;
        const prim = ctas.filter((c) => c.kind === 'primary');
        const dupe = ctas.length !== new Set(ctas.map((c) => `${c.text}|${c.href}`)).size;
        if (prim.length > 1 || dupe) {
          const seen = new Set<string>();
          let first = true;
          const next: Cta[] = [];
          for (const c of ctas) {
            const key = `${c.text}|${c.href}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (c.kind === 'primary') {
              next.push(first ? c : { ...c, kind: s.intent === 'hero' ? 'link' : 'secondary' });
              first = false;
            } else next.push(c);
          }
          emit(mk(sid('dedupe-ctas', s.id), 'dedupe-ctas', {
            target: `${route} ${sectionLabel(s)}`, category: 'conversion', impact: 'medium',
            rationale: 'One filled primary action per section; the others are demoted so visitors are not asked to choose between equal buttons.',
            before: ctas.map((c) => `${c.text} (${c.kind})`).join(', '), after: next.map((c) => `${c.text} (${c.kind})`).join(', '),
          }, { page: route, section: s.id, params: { ctas: next } }));
        }
      }

      // Section order by goal
      const cur = work.pages.find((p) => p.route === route)!;
      const rankList = ORDER[profile.goal];
      let last = 0;
      const ranks = cur.sections.map((s) => {
        const at = rankList.indexOf(s.intent);
        const r = s.intent === 'hero' ? -1 : at >= 0 ? at : last + 0.1;
        if (at >= 0) last = at;
        return { s, r };
      });
      const sorted = [...ranks].sort((a, b) => a.r - b.r);
      const newOrder = sorted.map((x) => x.s.id);
      if (newOrder.join() !== cur.sections.map((s) => s.id).join()) {
        const moves = sorted
          .map((x, i) => ({ x, from: cur.sections.indexOf(x.s), to: i }))
          .filter((m) => m.from !== m.to && ['testimonials', 'pricing', 'features', 'steps', 'faq', 'logos', 'stats', 'gallery', 'team'].includes(m.x.s.intent))
          .slice(0, 3)
          .map((m) => `${m.x.s.intent} from position ${m.from + 1} to ${m.to + 1}`);
        emit(mk(pid('reorder'), 'reorder', {
          target: route, category: 'structure', impact: 'high',
          rationale: `Reordered sections around the goal of "${profile.goal}": evidence sits before the ask, and detail (pricing, FAQ) comes after the reader is convinced${moves.length ? `. Moved ${moves.join('; ')}` : ''}.`,
          before: cur.sections.map((s) => s.intent).join(' → '), after: sorted.map((x) => x.s.intent).join(' → '),
        }, { page: route, params: { order: newOrder } }));
      }

      // Anchors (stable deep links, also used by nav)
      const anchored = work.pages.find((p) => p.route === route)!;
      const used = new Set<string>();
      const anchors = anchored.sections
        .filter((s) => !s.anchor || used.has(s.anchor))
        .map((s) => {
          let a = (s.content.heading ? s.content.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) : '') || s.intent;
          let n = 2;
          while (used.has(a) || anchored.sections.some((o) => o !== s && o.anchor === a)) a = `${a.replace(/-\d+$/, '')}-${n++}`;
          used.add(a);
          return { id: s.id, anchor: a };
        });
      if (anchors.length) {
        emit(mk(pid('ensure-anchors'), 'ensure-anchors', {
          target: route, category: 'navigation', impact: 'low',
          rationale: 'Gave every section a stable anchor so it can be linked to, skipped to and shared.',
        }, { page: route, params: { anchors } }));
      }

      // Navigation
      const nav = work.pages.find((p) => p.route === route)!.nav;
      if (nav.primary.length === 0 && anchored.sections.length >= 4) {
        const primary: NavLink[] = anchored.sections
          .filter((s) => ['features', 'pricing', 'testimonials', 'faq', 'contact', 'team', 'gallery', 'steps'].includes(s.intent))
          .slice(0, 5)
          .map((s) => ({ label: shortLabel(s.content.heading ?? s.intent, s.intent), href: `#${s.anchor ?? ''}` }));
        if (primary.length) {
          emit(mk(pid('synthesize-nav'), 'synthesize-nav', {
            target: route, category: 'navigation', impact: 'medium',
            rationale: 'The page had no navigation; built one from the section headings so visitors can jump to what they need.',
            after: primary.map((l) => l.label).join(', '),
          }, { page: route, params: { primary } }));
        }
      }
      const nv = work.pages.find((p) => p.route === route)!.nav;
      const dedup = [...nv.primary, ...nv.secondary].filter((l, i, a) => a.findIndex((x) => x.href === l.href && x.label.toLowerCase() === l.label.toLowerCase()) === i);
      if (dedup.length > 5 || dedup.length !== nv.primary.length + nv.secondary.length) {
        const ranked = dedup.map((l, i) => ({ l, i, s: navScore(l) }));
        const keepSet = new Set([...ranked].sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 5).map((x) => x.i));
        const primary = ranked.filter((x) => keepSet.has(x.i)).map((x) => x.l);
        const secondary = ranked.filter((x) => !keepSet.has(x.i)).map((x) => x.l);
        if (secondary.length || dedup.length !== nv.primary.length) {
          emit(mk(pid('regroup-nav'), 'regroup-nav', {
            target: route, category: 'navigation', impact: 'high',
            rationale: `Cut the primary navigation from ${nv.primary.length} to ${primary.length} items by importance for a "${profile.goal}" goal; the rest move to a secondary group in the menu and footer. Fewer choices means faster decisions and a cleaner mobile menu.`,
            before: nv.primary.map((l) => l.label).join(' | '), after: primary.map((l) => l.label).join(' | '),
          }, { page: route, params: { primary, secondary } }));
        }
      }
      const nvc = work.pages.find((p) => p.route === route)!;
      if (!nvc.nav.cta) {
        const heroC = nvc.sections.find((s) => s.intent === 'hero')?.content.ctas.find((c) => c.kind === 'primary') ?? nvc.sections.flatMap((s) => s.content.ctas).find((c) => c.kind === 'primary');
        if (heroC) {
          emit(mk(pid('nav-cta'), 'nav-cta', {
            target: route, category: 'conversion', impact: 'medium',
            rationale: `Added "${heroC.text}" to the header so the main action is reachable from anywhere on the page.`,
          }, { page: route, params: { cta: { ...heroC, kind: 'primary' } } }));
        }
      }

      // Section patterns: after merges/reorders so choices see the final structure
      for (const s of work.pages.find((p) => p.route === route)!.sections) {
        const choice = choosePattern(s, { page: work.pages.find((p) => p.route === route)!, style, profile });
        if (choice.pattern !== s.pattern) {
          const info = PATTERN_BY_ID.get(choice.pattern);
          emit(mk(sid('set-pattern', s.id), 'set-pattern', {
            target: `${route} ${sectionLabel(s)}`, category: 'structure', impact: s.intent === 'hero' || s.intent === 'features' ? 'high' : 'medium',
            rationale: `${info?.label ?? choice.pattern}: ${choice.why}`,
            before: PATTERN_BY_ID.get(s.pattern)?.label ?? s.pattern, after: info?.label ?? choice.pattern,
          }, { page: route, section: s.id, params: { pattern: choice.pattern } }));
        }
      }

      // Alignment: break the all-centred rhythm
      if (style.layout.align === 'left') {
        const centered = work.pages.find((p) => p.route === route)!.sections.filter((s) => s.content.alignment === 'center' && s.content.heading);
        if (centered.length >= 2) {
          emit(mk(pid('set-align'), 'set-align', {
            target: route, category: 'structure', impact: 'medium',
            rationale: `Left-aligned ${centered.length} section headings. One strong left edge reads faster than every heading centred, and it removes the repeated centred-title rhythm.`,
            before: 'center', after: 'left',
          }, { page: route, params: { align: 'left', sections: centered.map((s) => s.id) } }));
        }
      }

      // Chrome
      const cw = work.pages.find((p) => p.route === route)!;
      const chrome = chooseChrome(cw, style);
      if (chrome.header !== cw.chrome.header || chrome.footer !== cw.chrome.footer) {
        emit(mk(pid('set-chrome'), 'set-chrome', {
          target: route, category: 'structure', impact: 'medium',
          rationale: `Header "${PATTERN_BY_ID.get(chrome.header)?.label}" and footer "${PATTERN_BY_ID.get(chrome.footer)?.label}" chosen for ${cw.nav.primary.length} links and ${cw.footer.columns.length} footer groups.`,
        }, { page: route, params: { chrome } }));
      }
    }

    // ---- 4. Redesign (information architecture, flows) -----------------------------------
    if (redesign) {
      const cur = work.pages.find((p) => p.route === route)!;
      if (route === '/' && cur.sections.length >= 7) {
        for (const s of [...cur.sections]) {
          if (s.intent === 'pricing' && s.content.items.length >= 3) {
            emit(mk(sid('extract-page', s.id), 'extract-page', {
              target: `${route} ${sectionLabel(s)}`, category: 'structure', impact: 'high',
              rationale: 'Moved pricing to its own page. Buyers compare plans deliberately, and a dedicated page keeps the home page short while giving pricing room for detail. A teaser on the home page and a nav link keep it one click away.',
            }, { page: route, section: s.id, params: { route: '/pricing', file: 'pricing.html', title: 'Pricing', navLabel: 'Pricing', teaserHeading: 'Simple, published pricing.', teaserCta: 'See plans and pricing' } }));
          } else if (s.intent === 'faq' && s.content.items.length >= 6) {
            emit(mk(sid('extract-page', s.id), 'extract-page', {
              target: `${route} ${sectionLabel(s)}`, category: 'structure', impact: 'medium',
              rationale: `Moved the ${s.content.items.length}-question FAQ to its own page. Long FAQs bury the closing call to action; a help page also gets found directly from search.`,
            }, { page: route, section: s.id, params: { route: '/faq', file: 'faq.html', title: 'FAQ', navLabel: 'FAQ', teaserHeading: 'Questions? We have written the answers down.', teaserCta: 'Read the FAQ' } }));
          }
        }
      }
      for (const s of cur.sections) {
        const f = s.content.form;
        if (f && f.fields.length > 5) {
          emit(mk(sid('progressive-form', s.id), 'progressive-form', {
            target: `${route} ${sectionLabel(s)}`, category: 'flow', impact: 'high',
            rationale: `The form asks for ${f.fields.length} fields. Kept the first 5 visible and tucked the optional rest behind a "More details" disclosure; shorter first impressions complete more often. No field was removed.`,
          }, { page: route, section: s.id, params: { keep: 5 } }));
        }
      }
    }
  }

  // ---- 5. Rhythm (tone + spacing) after structure is final ----------------------------------
  for (const page of work.pages) {
    const tonesFor = RHYTHM_TONES.varied;
    let alt = 0;
    const settings = page.sections.map((s) => {
      let tone: Tone = 'plain';
      if (style.layout.rhythm === 'varied') tone = tonesFor[s.intent] ?? 'plain';
      else if (style.layout.rhythm === 'alternating') {
        if (s.intent === 'hero') tone = 'plain';
        else if (s.intent === 'cta') tone = 'inverse';
        else { alt += 1; tone = alt % 2 === 1 ? 'surface' : 'plain'; }
      } else tone = s.intent === 'cta' ? 'inverse' : 'plain';
      const spacing = ['logos', 'stats'].includes(s.intent) || s.pattern === 'cta-inline' ? 'tight' : s.intent === 'hero' ? 'loose' : style.layout.density === 'airy' ? 'loose' : style.layout.density === 'tight' ? 'tight' : 'normal';
      return { id: s.id, tone, spacing };
    });
    emit(mk(`set-rhythm:${page.route}`, 'set-rhythm', {
      target: page.route, category: 'style', impact: 'medium',
      rationale: `Section backgrounds and spacing follow the "${style.layout.rhythm}" rhythm of the style, so adjacent sections do not blur into identical blocks.`,
    }, { page: page.route, params: { sections: settings } }));
  }

  // ---- 6. Advice: things flagged, deliberately not rewritten --------------------------------
  const after = analyze(work);
  for (const tell of before.ai.hits.filter((t) => t.area === 'copy')) {
    ops.push(mk(`advise:${tell.id}`, 'advise', {
      target: 'copy', category: 'content', impact: 'medium',
      rationale: `${tell.title} (${tell.evidence.join('; ')}). Morpheus changes structure and design, not your voice; rewrite these in the client's own words.`,
    }));
    work.changeLog.push(ops[ops.length - 1].change);
  }
  void after;

  // ---- 7. Manual operations from the editor ---------------------------------------------------
  for (const m of options.manual ?? []) ops.push(m);

  return { depth, profile, style, ops, excluded: [...excluded] };
}

/** Replay a plan on the original IR. Rejected operations are skipped. */
export function applyPlan(source: SiteIR, plan: RedesignPlan): SiteIR {
  const ir = clone(source);
  ir.changeLog = [];
  const excluded = new Set(plan.excluded);
  for (const op of plan.ops) {
    if (excluded.has(op.id)) continue;
    applyOp(ir, op);
  }
  return ir;
}

export function redesign(source: SiteIR, options: PlanOptions): { plan: RedesignPlan; ir: SiteIR } {
  const plan = planRedesign(source, options);
  return { plan, ir: applyPlan(source, plan) };
}

void ({} as Page); void ({} as Section);
