import type { FontSpec, StyleSpec } from '../ir';

function fontStack(f: FontSpec): string {
  return `'${f.family}', ${f.fallback}`;
}

export function googleFontsHref(style: StyleSpec): string | null {
  const fonts = [style.type.display, style.type.body, style.type.mono].filter((f): f is FontSpec => !!f && !!f.google);
  const byFamily = new Map<string, Set<number>>();
  for (const f of fonts) {
    const set = byFamily.get(f.family) ?? new Set<number>();
    f.weights.forEach((w) => set.add(w));
    byFamily.set(f.family, set);
  }
  if (!byFamily.size) return null;
  const parts = [...byFamily].map(([family, weights]) => `family=${family.replace(/ /g, '+')}:wght@${[...weights].sort((a, b) => a - b).join(';')}`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** Design tokens as CSS custom properties. The editor overrides these live. */
export function tokensCss(style: StyleSpec): string {
  const t = style.type;
  const steps = [-2, -1, 0, 1, 2, 3, 4, 5].map((n) => ({ n, v: +(t.base * Math.pow(t.scale, n)).toFixed(2) }));
  const sizeVars = steps.map(({ n, v }) => `  --m-step-${n < 0 ? 'm' + -n : n}: ${v / 16}rem;`).join('\n');
  const c = style.colors;
  return `:root {
  --m-bg: ${c.bg};
  --m-surface: ${c.surface};
  --m-fg: ${c.fg};
  --m-muted: ${c.muted};
  --m-accent: ${c.accent};
  --m-accent-fg: ${c.accentFg};
  --m-line: ${c.line};
  --m-inverse: ${c.inverse};
  --m-inverse-fg: ${c.inverseFg};
  --m-font-display: ${fontStack(t.display)};
  --m-font-body: ${fontStack(t.body)};
  --m-font-mono: ${t.mono ? fontStack(t.mono) : "ui-monospace, Menlo, Consolas, monospace"};
  --m-base: ${t.base / 16}rem;
  --m-heading-weight: ${t.headingWeight};
  --m-tracking: ${t.tracking};
  --m-leading: ${t.leading};
  --m-display-case: ${t.displayCase === 'uppercase' ? 'uppercase' : 'none'};
${sizeVars}
  --m-radius: ${style.shape.radius}px;
  --m-radius-btn: ${style.shape.buttonRadius}px;
  --m-border: ${style.shape.border};
  --m-border-w: ${style.shape.borderWidth}px;
  --m-shadow: ${style.shape.shadow};
  --m-unit: ${style.space.unit}px;
  --m-section-y: ${style.space.sectionY}px;
  --m-container: ${style.space.container}px;
  --m-gutter: ${style.space.gutter}px;
}`;
}
