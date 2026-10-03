import type { Page, Section, SiteIR } from '../ir';

export function sectionText(s: Section): string {
  const c = s.content;
  const parts = [c.eyebrow, c.heading, c.sub, ...c.paragraphs, ...c.ctas.map((x) => x.text)];
  for (const it of c.items) parts.push(it.title, it.body, it.meta, it.quote?.text, it.quote?.author, ...(it.bullets ?? []));
  for (const st of c.stats ?? []) parts.push(st.value, st.label);
  return parts.filter(Boolean).join(' \n ');
}

export function pageText(p: Page): string {
  return p.sections.map(sectionText).join('\n');
}

export function siteText(ir: SiteIR): string {
  return ir.pages.map(pageText).join('\n');
}

export function allSections(ir: SiteIR): { page: Page; section: Section }[] {
  return ir.pages.flatMap((page) => page.sections.map((section) => ({ page, section })));
}

export const EMOJI_RE = /\p{Extended_Pictographic}/u;

export function itemsAreUniform(items: { icon?: string; title?: string; body?: string; image?: unknown; bullets?: string[] }[]): boolean {
  if (items.length < 3) return false;
  const shape = (i: (typeof items)[number]) => [!!i.icon, !!i.title, !!i.body, !!i.image, !!(i.bullets && i.bullets.length)].join('');
  const first = shape(items[0]);
  if (!items.every((i) => shape(i) === first)) return false;
  const lens = items.map((i) => (i.body ?? '').length).filter((n) => n > 0);
  if (!lens.length) return true;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  return lens.every((n) => Math.abs(n - mean) / mean < 0.6);
}
