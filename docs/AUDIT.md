# Audit report

What was tested, what it found, what was fixed, and what is still not covered. Everything below is reproducible with `pnpm audit:all` (or the individual commands shown).

## How it was tested

| Area | Method | Where |
|---|---|---|
| Server security | Real server started on a random port and attacked with raw HTTP (spoofed `Host`/`Origin`, `text/plain` forged requests, traversal, symlinks, oversized bodies, injected style values, hostile editor operations) | `tests/security.test.ts` |
| Content preservation | 10-site corpus of modern and hostile markup; every visible word must survive all three depths | `tests/robustness.test.ts`, `tests/corpus/` |
| Layout invariants | Every one of 32 layouts forced onto every section of 7 sites (224 combinations); no content may disappear | `tests/invariants.test.ts` |
| Accessibility | axe-core with WCAG 2.2 A/AA + best-practice rules in real Chromium, 9 styles x 6 sites, light and dark | `tests/quality.test.ts`, `tests/landscape.test.ts`, `pnpm audit:a11y` |
| HTML validity | html-validate (recommended rules) on 36 generated pages | `tests/quality.test.ts`, `pnpm audit:html` |
| Responsive | No horizontal scroll at 320/390/768/1280 px in all 9 styles; RTL mirroring; no-JS usability | `tests/quality.test.ts` |
| Dependencies | `pnpm audit` | CI, weekly |
| Performance | Timed pipeline on a 310 KB / 1,500-section page and a 300-page site | see below |
| Detector currency | Checked the AI-tell list against a typical 2025-26 generated page | `tests/landscape.test.ts` |

## Findings and fixes

### Security (local web app)

| # | Finding | Severity | Fix |
|---|---|---|---|
| S1 | Any web page the user visited could drive the local server with a forged `text/plain` POST, including `/api/export`, which wrote files to an arbitrary path | Critical | Per-launch secret token required on every API call; `Content-Type` must be `application/json`; `Origin` must match; export is confined to the project root, refuses non-empty folders Morpheus did not create, and refuses the source folder |
| S2 | No `Host` validation, so DNS rebinding could read responses | High | `Host` allow-list on both servers (421 otherwise) |
| S3 | `.env` and files outside the project (via symlinks) were served by the preview and copied on export | High | Dotfiles and `node_modules` denied; real-path containment; symlinks never followed or copied; stylesheet reads confined to the project |
| S4 | A previewed site's scripts ran on the same origin as the editor, so a malicious site loaded for redesign could script the editor | High | Previews are served from a second origin (second port) with `frame-ancestors`, the iframe is sandboxed, `postMessage` is origin-checked both ways; a test confirms preview scripts cannot reach the API |
| S5 | Unbounded request body (30 MB accepted) | Medium | 1 MB cap, request/header timeouts |
| S6 | Style overrides were interpolated into generated CSS and font URLs (CSS injection) | Medium | `sanitizeStyle` is the single choke point: colours re-parsed to hex, font names allow-listed, numbers clamped, CSS strings rejected if they contain `; { } url( @import`. Also applied to briefs and saved plans |
| S7 | Editor-submitted operations were trusted (an `extract-page` operation could name `../../x.html`) | Medium | Editor may submit only four operation types with validated parameters; writer also refuses any path that resolves outside the output folder |
| S8 | `deepMerge` followed `__proto__` keys | Low | Keys ignored |
| S9 | Editor page embedded the project path unescaped in an inline script | Low | `<` escaped; strict nonce-based CSP, `X-Frame-Options: DENY` |
| S10 | Embedded content from client markup (rich content, SVG, head tags) | Medium | Allow-list sanitiser: no scripts, handlers, inline styles, `javascript:` URLs, or non-HTTPS iframes; head tags rebuilt from allowed attributes only |

Dependencies: 7 advisories in the test toolchain (vitest/vite/esbuild) were cleared by upgrading; `pnpm audit` is now clean and runs weekly in CI. None affected shipped runtime code (parse5, postcss).

### Correctness: content loss (the most serious product defect)

The first version modelled what it recognised and silently dropped the rest.

| # | Finding | Fix |
|---|---|---|
| C1 | Documentation-style pages lost 57% of their words (code blocks, tables, definition lists, quotes) | Coverage guarantee: the reader tracks which elements the model consumed; everything else is carried through as sanitised rich content in source order. Article-like sections use an ordered "flow" |
| C2 | A form with fieldsets and radios lost 63% of its words | Fieldset/legend, radio/checkbox values and `optgroup` support |
| C3 | Hero layouts did not render a section's form at all | Render-time completeness check: whatever a layout does not render is appended, for any layout and any chooser (planner, editor, saved plan). Verified by forcing all 32 layouts on all sections |
| C4 | A layout showed an item's title but dropped its description | Completeness check now covers every field of every item |
| C5 | "Strip badge" deleted real copy ("Powered by GPT-5") | Now keeps the wording, drops decoration (emoji, pill styling) |
| C6 | Loose content directly in `<body>` was shredded into empty sections | Loose runs are grouped into one section |
| C7 | A 4-character Japanese title was "improved" by a length check that assumed Latin text | Script-aware title rule |
| C8 | Pathologically deep markup crashed with a stack overflow | Pre-scan refuses nesting over 400; page is copied through unchanged with a warning |
| C9 | Footer text such as company registration lines was dropped | Footer coverage |
| C10 | Client-rendered app shells gave no warning that there is nothing static to redesign | Warning |

### Modern web standards

| # | Finding | Fix |
|---|---|---|
| W1 | `dir="rtl"` dropped; layouts used physical left/right | `dir` preserved (also inferred from the language); logical CSS properties; verified in a browser |
| W2 | `srcset`, `sizes`, `<picture>`, image dimensions, video posters dropped (regressing responsive images and layout stability) | All preserved |
| W3 | The hero image was lazy-loaded (hurts Largest Contentful Paint) | First image is eager with `fetchpriority="high"`; the rest lazy |
| W4 | `hreflang`, RSS/alternate links, `theme-color` and similar head data dropped | Preserved through an attribute allow-list |
| W5 | Accent colour used as small text failed WCAG on surface colours (38 axe failures in 10 styles) | Dedicated accessible accent-for-text token, derived per background, verified for every preset |
| W6 | Headline words wider than a phone overflowed horizontally in uppercase styles | Word breaking and smaller minimum sizes; verified at 320 px |
| W7 | `aria-label` on a plain `<span>` (pricing table checkmarks) and on `<summary>` | Real hidden text; sections named by `aria-labelledby` pointing at their own heading |
| W9 | Three layout-overflow bugs found only after widening the test from one page to every page, style and width: the header did not collapse at tablet width; `1fr` grid columns let unwrappable content stretch the grid on 320 px phones; visually-hidden labels inside a scrolling table wrapper stretched the page | Header collapses at 900 px; all grid tracks use `minmax(0, 1fr)`; scroll wrapper is a positioned containing block and hidden text is anchored. Test now covers every page x 9 styles x 6 sites x 4 widths |
| W8 | No dark scheme, no way to avoid third-party font hosting, no Open Graph tags | Opt-in verified dark scheme (`--dark`), `--no-web-fonts`, generated Open Graph/Twitter tags when missing; forced-colors and print styles |

### The AI landscape

The detector could not see four patterns common in current generated sites: glassmorphism, a near-black slate base with a coloured glow, identical stroke-icon tiles, and AI sentence cadence ("not just X, but Y", stock openers, clipped triads). Added, plus shadcn default tokens, placeholder image services and sparkle emoji (27 rules total, version `2026.10`).

Because any fixed list ages, the detector is now extensible without a code release:

- **Registry**: `registerTell`, `unregisterTell`, `listTells`; every report carries the checklist version.
- **Tell packs**: declarative JSON (`text` / `classes` / `css` patterns, weight, minimum matches), validated with precise errors, loadable with `--tells pack.json`.

## Performance

| Case | Time |
|---|---|
| Read + full redesign of the 2-page fixture | about 100 ms |
| 310 KB page, 1,500 sections: read / plan+apply / render | 380 ms / 230 ms / 35 ms |
| 300-page site: read + redesign | about 140 ms |
| Peak heap in that run | 44 MB |

## Not covered or not solved (read this)

- **Only static HTML/CSS sites can be rewritten.** React, Vue, Svelte, Astro, Next, WordPress, Blade/ERB/Jinja and others are detected and reported but not supported. This is the largest gap against "any language".
- **Interactive behaviour is not preserved by construction.** Scripts are carried over verbatim; selectors they depend on may not match rebuilt markup.
- **The AI-look score is a heuristic.** Weights are hand-tuned and were checked against a handful of fixtures, not a labelled dataset. Treat it as a ranked checklist, not a measurement.
- **Automated accessibility testing finds only a portion of real issues.** axe, a validator and viewport checks pass, but no manual screen-reader, keyboard-only or cognitive review has been done.
- **Chromium only.** Not run in Firefox or Safari; not run on Windows (path handling untested).
- **Derived dark palettes are mechanical.** They pass contrast checks but have not had design review.
- **The local server is a single-user developer tool.** It is hardened against web-based attack but has no accounts, no TLS and must not be exposed to a network.
- **Tell packs run user-supplied regular expressions.** Length-limited, but a pathological pattern can still be slow; treat packs as trusted configuration.
- **Copy is flagged, never rewritten.** English-centric heuristics (buzzwords, link text, sentence patterns) will under-detect in other languages.
- **No LLM is involved.** All decisions are deterministic. This makes results reproducible and offline but limits free-text style briefs to keyword understanding.
- **No licence file has been added**; that is the owner's decision.
