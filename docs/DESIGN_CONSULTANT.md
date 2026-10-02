# The design consultant engine

Morpheus does not just reskin. It audits the site the way a UI/UX consultant would, decides what should change and why, then redesigns structure, layout, flow and visuals together.

## Process

1. **Discover**: infer the business, audience, primary goal (sign-ups, sales, bookings, leads) and top user tasks from content and, optionally, a short client brief.
2. **Audit**: score the site against UX heuristics (Nielsen, WCAG accessibility, conversion best practice) as well as the AI tells in [AI_TELLS.md](AI_TELLS.md). Findings are specific and ranked by impact, e.g. "primary CTA appears 6 times with equal weight", "pricing is 3 clicks from the home page", "nav has 9 items with no grouping".
3. **Information architecture**: rework sitemap and navigation: merge or split pages, reorder sections by user priority, rename labels, rethink menu structure.
4. **Page structure**: choose a section pattern for each page from a pattern library based on its goal, not a default template. Examples: narrative scroll, comparison table, proof-first (case study above the fold), task-first dashboard, catalog with filters, long-form editorial.
5. **Flows**: simplify key journeys (signup, checkout, contact): fewer steps, clearer progress, better forms (field count, inline validation, sensible defaults).
6. **Visual system**: apply the chosen style (preset or free-text brief) as tokens, type, spacing, imagery treatment, iconography and motion.
7. **Rationale**: every change ships with a one-line reason, so the client sees a consultant's recommendations rather than a black box. Each can be accepted, rejected or tweaked in the live editor.

## Design depth

The client picks how far to go, per site or per page:

| Level | Changes |
|---|---|
| **Polish** | Tokens, type, spacing, imagery |
| **Restructure** | Plus section order, layout patterns, component choices, nav |
| **Redesign** | Plus information architecture, page set, flows and copy hierarchy |

## Guardrails

- Content, routes the client depends on, and business logic are preserved unless the client approves a change; renamed or removed routes get redirects.
- Accessibility never regresses (contrast, focus order, semantics, tap targets).
- Behavior blocks stay opaque to the design engine.
- Everything is a reviewable diff or pull request, with before/after previews.

## Implementation notes

- Structural changes are operations on the Site IR (move, merge, split, replace-pattern, regroup-nav), so they work identically across languages and ports.
- The pattern library is data (IR templates plus rules for when each applies), versioned in `patterns/`.
- An LLM proposes the plan (audit findings, IA, pattern choices); deterministic code applies it and validates the result (a11y checks, broken links, visual diff).
