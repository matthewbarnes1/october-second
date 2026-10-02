# Architecture (draft)

## Core idea: a framework-neutral site model

Morpheus never edits "React" or "Vue" directly. Every input is first lifted into a **Site IR** (intermediate representation), the design is changed there, and the result is lowered back out. This is what lets one tool handle any stack.

```
 client repo ──► Adapter (read) ──► Site IR ──► Style engine ──► Site IR' ──► Adapter (write) ──► patch / new repo
 (any stack)                          │                                          (same or different stack)
                                      └──► Live editor (edits the IR, preview re-renders)
```

### Site IR contains

- **Pages and routes**: structure, nesting, metadata
- **Component tree**: semantic nodes (Section, Hero, Nav, Card, Form, Media...) with props and slots
- **Content**: copy, images, links, i18n strings, kept separate from presentation
- **Behavior**: event handlers, data fetching and state, carried as opaque blocks and never rewritten by the style engine
- **Design layer**: tokens (color, type, spacing, radius, shadow, motion) and layout rules (section patterns, grid, density)

## Two modes

1. **Restyle in place** (same language): only the design layer changes. Content and behavior are untouched, so the diff is small and safe.
2. **Port**: the same IR is emitted by a different adapter (e.g. Vue/Bootstrap site to React/Tailwind, or plain HTML to Astro). Behavior blocks are translated by an LLM with tests or a preview diff as the check.

## Components

1. **Ingest**: GitHub App (read/write PR scope), uploaded folder, or repo URL, into a sandboxed workspace.
2. **Detector**: identifies languages and frameworks (React, Vue, Svelte, Angular, Next, Nuxt, Astro, Rails/ERB, Django/Jinja, Laravel/Blade, PHP, WordPress themes, plain HTML/CSS...), and styling approach (Tailwind, CSS modules, SCSS, styled-components, Bootstrap, plain CSS).
3. **Adapters**, one per stack, each with a `read` (source to IR) and `write` (IR to source) side. Parsing uses tree-sitter plus per-language template parsers, so new languages are added by writing an adapter, not by changing the core. Anything an adapter can't model is preserved as an opaque block and never silently dropped.
4. **Analyzer**: scores the IR against `AI_TELLS.md`.
5. **Style engine**: presets in `styles/` or a free-text brief an LLM converts into the same token and layout schema.
6. **Live editor**: web app with a rendered preview, element inspector and controls. Edits change the IR, and the adapter regenerates source, so token edits hit the token file and layout edits hit the component.
7. **Publisher**: branch plus pull request, or a fresh repo for ports.

## Rendering for preview

Preview runs the client's real project in a sandbox where possible (dev server per workspace). A fallback renders the IR directly for stacks that can't run in the sandbox.

## MVP roadmap

1. Site IR schema, plus CLI `morpheus scan <path>` (detector and AI-look score)
2. Adapters for plain HTML/CSS and React + Tailwind (read and write); restyle-in-place using presets
3. Free-text style brief to tokens
4. Live editor with token controls and preview
5. GitHub connect and PR output
6. More adapters (Vue, Svelte, Astro, server templates) and **port mode** between them
7. Layout restructuring (section pattern swaps)

## Open questions

- Which adapters first? (Proposed: plain HTML/CSS and React + Tailwind, which prove the IR from both ends)
- Hosted SaaS or local-first tool first?
- How should port mode verify that behavior survived translation (tests, visual diff, or both)?
