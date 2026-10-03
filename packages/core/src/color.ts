export type RGB = [number, number, number];

const NAMED: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff', green: '#008000',
  purple: '#800080', violet: '#ee82ee', indigo: '#4b0082', orange: '#ffa500', yellow: '#ffff00',
  pink: '#ffc0cb', gray: '#808080', grey: '#808080', teal: '#008080', cyan: '#00ffff',
  navy: '#000080', transparent: '#000000',
};

export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (NAMED[s] && !s.startsWith('#')) return parseColor(NAMED[s]);
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)) as RGB;
  m = s.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as RGB;
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
  if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return null;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function toHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio, 1..21 */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as RGB;
}

/** Adjust until the foreground reaches the target contrast against bg. */
export function ensureContrast(fg: RGB, bg: RGB, target = 4.5): RGB {
  if (contrast(fg, bg) >= target) return fg;
  const towards: RGB = luminance(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, towards, t);
    if (contrast(c, bg) >= target) return c;
  }
  return towards;
}

export function hueOf(rgb: RGB): number {
  return rgbToHsl(rgb)[0];
}

/** The hue band that dominates generated-site gradients: indigo through violet/magenta. */
export function isPurpleish(rgb: RGB): boolean {
  const [h, s] = rgbToHsl(rgb);
  return h >= 235 && h <= 310 && s > 0.3;
}

export function isBlueish(rgb: RGB): boolean {
  const [h, s] = rgbToHsl(rgb);
  return h >= 195 && h <= 260 && s > 0.35;
}

export function extractColors(text: string): RGB[] {
  const out: RGB[] = [];
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
  for (const m of text.match(re) ?? []) {
    const c = parseColor(m);
    if (c) out.push(c);
  }
  return out;
}
