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

## Surfaces: one engine, three front-ends

The Site IR, adapters, analyzer and style engine live in a single core library (`@morpheus/core`). Every surface is a thin shell around it:

| Surface | Role | Notes |
|---|---|---|
| **Web app** (primary) | Connect GitHub, scan, choose style, live editor, open PR | Core runs server-side in sandboxed workers; preview streams from a per-workspace dev server |
| **CLI** | `morpheus scan`, `restyle`, `port`; CI and power users | Runs the core locally; same output as the web app |
| **Desktop app** | Local-first: works on a folder on disk, no upload | Wraps the web editor (Tauri or Electron) around the local core, so private code never leaves the machine |

Proposed layout: `packages/core`, `packages/adapters/*`, `apps/web`, `apps/cli`, `apps/desktop`.

## Two modes

1. **Redesign in place** (same language): depth is chosen per site (Polish, Restructure, Redesign). Content and behavior are preserved unless the client approves a change.
2. **Port**: the same IR is emitted by a different adapter (e.g. Vue/Bootstrap site to React/Tailwind, or plain HTML to Astro). Behavior blocks are translated by an LLM with tests or a preview diff as the check.

## Components

1. **Ingest**: GitHub App (read/write PR scope), uploaded folder, or repo URL, into a sandboxed workspace.
2. **Detector**: identifies languages and frameworks (React, Vue, Svelte, Angular, Next, Nuxt, Astro, Rails/ERB, Django/Jinja, Laravel/Blade, PHP, WordPress themes, plain HTML/CSS...), and styling approach (Tailwind, CSS modules, SCSS, styled-components, Bootstrap, plain CSS).
3. **Adapters**, one per stack, each with a `read` (source to IR) and `write` (IR to source) side. Parsing uses tree-sitter plus per-language template parsers, so new languages are added by writing an adapter, not by changing the core. Anything an adapter can't model is preserved as an opaque block and never silently dropped.
4. **Analyzer**: scores the IR against `AI_TELLS.md`.
5. **Design consultant**: audits UX, reworks information architecture and page structure, simplifies flows, and records a rationale for each change. Operates on the IR through structural operations (move, merge, split, replace-pattern, regroup-nav). See [DESIGN_CONSULTANT.md](DESIGN_CONSULTANT.md).
5b. **Style engine**: presets in `styles/` or a free-text brief an LLM converts into the same token and layout schema, applied on top of the new structure.
6. **Live editor**: web app with a rendered preview, element inspector and controls. Edits change the IR, and the adapter regenerates source, so token edits hit the token file and layout edits hit the component.
7. **Publisher**: branch plus pull request, or a fresh repo for ports.

## Rendering for preview

Preview runs the client's real project in a sandbox where possible (dev server per workspace). A fallback renders the IR directly for stacks that can't run in the sandbox.

## Implementation status

Built: Site IR, detector, analyzer, consultant, style system, HTML adapter, CLI, web editor (see README). Not built: other adapters, port mode, GitHub/PR output, desktop shell, hosted mode.

Operations on the IR are data (`Operation`: id, type, params, rationale), which is what lets the editor reject a single change, add manual edits, and replay the whole plan deterministically.

## MVP roadmap

1. `@morpheus/core`: Site IR schema, detector and AI-look score, exposed first through CLI `morpheus scan <path>`
2. Adapters for plain HTML/CSS and React + Tailwind (read and write); polish-level restyle using presets
3. Design consultant v1: UX audit with ranked findings, plus section-level restructuring from a pattern library
4. Free-text style brief to tokens
5. Web app: live editor with token controls, structure controls (drag/reorder/swap pattern) and the consultant's rationale per change
6. Web app: GitHub connect and PR output; desktop wrapper around the same editor
7. More adapters (Vue, Svelte, Astro, server templates) and **port mode** between them
8. Consultant v2: information architecture, flow redesign, page-set changes

## Open questions

- Which adapters first? (Proposed: plain HTML/CSS and React + Tailwind, which prove the IR from both ends)
- Web app hosting model: fully hosted, or hosted editor with an optional local agent for private repos?
- How should port mode verify that behavior survived translation (tests, visual diff, or both)?
