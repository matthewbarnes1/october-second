# Morpheus

**Take an AI-built website and make it look human-designed.**

Point Morpheus at a folder or GitHub repo, pick a design style (or describe one in a few words), and it redesigns the site without the tell-tale "AI look" in seconds. It works like a UI/UX consultant: it audits the experience, then restructures navigation, page layouts and flows as well as colors and type, and explains each change. Then refine it live with real-time visual editing tools.

## Flow

1. **Connect**: paste a repo URL, connect GitHub, or upload a folder.
2. **Scan**: Morpheus detects the framework, pages, components and content, and scores how "AI-looking" the design is.
3. **Choose a style**: pick a preset or write a short brief ("quiet editorial, warm paper tones, serif headlines").
4. **Redesign**: the consultant engine audits the UX, restructures navigation and page layouts, simplifies flows, and applies the visual style. Content and functionality are preserved. You choose the depth: Polish, Restructure or Redesign.
5. **Refine live**: edit colors, type, spacing and layout in a real-time preview.
6. **Ship**: Morpheus opens a pull request against the repo.

## Where it runs

A **web app** is the main product. A **CLI** and a **desktop app** use the same engine, for scripting, CI, and fully local work on private code.

## Any stack, in or out

Morpheus reads the site into a framework-neutral model, redesigns it there, and writes it back out. That gives two modes:

- **Restyle**: keep the client's language and change only the visual design.
- **Port**: reformat the site into a different language or framework.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What "AI look" means

See [docs/AI_TELLS.md](docs/AI_TELLS.md). Examples: purple-to-blue gradients, centered hero with two pills and a badge, uniform three-card feature grids, emoji as icons, Inter everywhere, identical rounded cards with soft shadows, generic stock copy.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system design and MVP roadmap
- [docs/DESIGN_CONSULTANT.md](docs/DESIGN_CONSULTANT.md): the audit and restructuring process
- [docs/AI_TELLS.md](docs/AI_TELLS.md): the detector's checklist
- Style presets live in `packages/core/src/style/presets.ts`

## Try it

```bash
pnpm install
pnpm morpheus scan fixtures/ai-saas                # stack, AI-look score, UX audit
pnpm morpheus styles                               # presets
pnpm morpheus plan fixtures/ai-saas --style swiss --depth redesign
pnpm morpheus redesign fixtures/ai-saas --brief "calm, warm, handmade, serif headlines" --out out/
pnpm web                                           # live editor at http://127.0.0.1:4173
pnpm test
```

`fixtures/ai-saas` is a deliberately generic AI-built landing page (purple gradients, emoji cards, centered hero with a badge, nine nav items). On it, a full redesign takes the AI-look score from 100 to about 19 and UX health from 37 to 100, and every change comes with a reason.

## What exists today

- **Core engine** (`packages/core`): Site IR, stack detector (JS frameworks, PHP/Laravel/WordPress, Rails/Jekyll, Django/Flask, Hugo, Flutter and more), AI-tell detector (19 rules, weighted), UX audit (26 checks), project discovery (industry, goal, audience), a pattern library with 37 layouts, the consultant planner (reorder, merge, restructure, navigation regrouping, page extraction, form simplification, accessibility fixes), 9 style presets verified for WCAG contrast, and a free-text style brief interpreter.
- **HTML adapter** (`packages/adapter-html`): reads static HTML/CSS sites into the IR and writes a rebuilt site with a token-driven stylesheet. Content is never rewritten; sections it cannot model are kept as original markup.
- **CLI** (`apps/cli`): `scan`, `audit`, `styles`, `plan`, `redesign`, `serve`.
- **Web editor** (`apps/web`): before/after preview, device widths, style presets and brief, live fine-tuning (colours, fonts, corners, spacing, width, type scale), per-change accept/reject, click-a-section inspector (layout, background, alignment, reorder), audit panel, export.

## Not built yet

- Adapters for React/Vue/Svelte/Astro, server templates (Blade, ERB, Jinja...) and WordPress themes. The detector recognises them and reports honestly that no adapter exists; the IR is built so an adapter only has to implement `read` and `write`.
- **Port mode** (emit the IR in a different stack).
- GitHub connection and pull-request output, and a hosted multi-user version.
- Desktop shell.
- LLM-assisted planning. Everything runs deterministically offline today; the brief interpreter and planner have clean seams for a model.
- Copy rewriting. Morpheus flags buzzword copy and placeholder proof but leaves the client's words alone.

## Known limits

- Scripts are carried over unchanged; selectors they rely on may no longer match the rebuilt markup.
- Web fonts load from Google Fonts at view time.
- English is assumed when a page declares no language (the change is listed so it can be rejected).
