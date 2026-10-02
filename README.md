# Morpheus

**Take an AI-built website and make it look human-designed.**

Point Morpheus at a folder or GitHub repo, pick a design style (or describe one in a few words), and it rebuilds the site's design without the tell-tale "AI look" in seconds. Then refine it live with real-time visual editing tools.

## Flow

1. **Connect**: paste a repo URL, connect GitHub, or upload a folder.
2. **Scan**: Morpheus detects the framework, pages, components and content, and scores how "AI-looking" the design is.
3. **Choose a style**: pick a preset or write a short brief ("quiet editorial, warm paper tones, serif headlines").
4. **Rebuild**: design tokens, typography, layout and components are regenerated. Content and functionality are preserved.
5. **Refine live**: edit colors, type, spacing and layout in a real-time preview.
6. **Ship**: Morpheus opens a pull request against the repo.

## Any stack, in or out

Morpheus reads the site into a framework-neutral model, redesigns it there, and writes it back out. That gives two modes:

- **Restyle**: keep the client's language and change only the visual design.
- **Port**: reformat the site into a different language or framework.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What "AI look" means

See [docs/AI_TELLS.md](docs/AI_TELLS.md). Examples: purple-to-blue gradients, centered hero with two pills and a badge, uniform three-card feature grids, emoji as icons, Inter everywhere, identical rounded cards with soft shadows, generic stock copy.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system design and MVP roadmap
- [docs/AI_TELLS.md](docs/AI_TELLS.md): the detector's checklist
- [styles/](styles/): style presets (design tokens plus layout rules)

## Status

Planning. Nothing is built yet.
