# Architecture (draft)

## Components

1. **Ingest**: clone a GitHub repo (GitHub App, read/write PR scope) or accept an uploaded folder into a sandboxed workspace.
2. **Analyzer**: detects framework (Next, Vite/React, Astro, plain HTML), extracts pages, components, copy, assets, and existing styling approach (Tailwind, CSS modules, plain CSS). Produces an AI-look report from `AI_TELLS.md`.
3. **Style engine**: a style is a set of design tokens (color, type scale, spacing, radius, shadow, motion) plus layout rules (section patterns, grid behavior, density). Sources: presets in `styles/` or a free-text brief an LLM turns into the same schema.
4. **Rebuilder**: rewrites the design layer only: token files, global CSS/Tailwind config, component styling and section layout. Content, routes and logic are untouched. Output is a patch against the repo.
5. **Live editor**: web app with an iframe preview of the running site, element inspector, and controls for tokens, type, spacing and layout. Edits map back to source (token changes edit the token file; layout changes edit the component).
6. **Publisher**: commits to a branch and opens a PR.

## Tech (proposed)

- TypeScript throughout; Next.js app for the editor; Node worker for analysis/rebuild jobs
- Preview via sandboxed dev server per workspace
- Codemods (ts-morph / PostCSS) for safe edits; LLM for the style brief and layout decisions, never raw whole-file rewrites

## MVP roadmap

1. CLI: `morpheus scan <path>` prints framework + AI-look score
2. Token-level restyle for Tailwind/React sites using presets
3. Free-text style brief to tokens
4. Live editor with token controls and preview
5. GitHub connect and PR output
6. Layout restructuring (section pattern swaps)

## Open questions

- Which frameworks first? (Proposed: React + Tailwind, then plain HTML)
- Hosted SaaS or local-first tool first?
- How much layout change is acceptable vs token-only?
