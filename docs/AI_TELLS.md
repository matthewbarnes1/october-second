# AI tells: what the detector looks for

Each tell has a weight; the weighted share of tells found is the "AI-look score" (0-100, lower is better). The built-in checklist is versioned (`AI_TELLS_VERSION`, currently `2026.10`) and every report states which version it used. It is a heuristic ranked checklist, not a measurement.

| Area | Tell |
|---|---|
| Color | Purple/indigo-to-blue gradients; gradient text; blurred glow blobs; near-black slate base with a coloured glow; coloured neon glow shadows; untouched framework accent colours; untouched shadcn/ui theme tokens |
| Type | Inter/system font as the only typeface; no display/body pairing |
| Layout | Centered hero with a badge pill and two equal buttons; uniform grid of identical cards; every section centred with the same heading rhythm; textbook section order |
| Components | One rounded soft-shadow card repeated everywhere; emoji or identical stroke icons in tinted tiles; pill badges; glassmorphism (backdrop blur on translucent panels) |
| Copy | Marketing buzzwords; stock CTA labels; placeholder-feeling proof (round-number stats, stock names); AI sentence patterns ("not just X, but Y", "say goodbye to", clipped triads, heavy em-dash use); sparkle emoji |
| Imagery | No real imagery (gradients only); placeholder or random-stock image services |
| Motion | Fade-up on every block; hover scale on every card |

Morpheus changes structure and visuals, so it clears the colour, layout, component, imagery and motion tells. It deliberately does **not** rewrite copy: copy tells are reported so the client can rewrite them in their own voice, which is why the score rarely reaches 0.

## Keeping up without a code release

Add or override rules at runtime with a **tell pack**, a JSON file:

```json
{
  "name": "2027-q1",
  "version": "1",
  "tells": [
    {
      "id": "neo-bold-claim",
      "title": "Overused \"10x\" claim",
      "area": "copy",
      "weight": 5,
      "text": ["\\b10x\\b"],
      "classes": ["backdrop-blur"],
      "css": ["mix-blend-mode:\\s*overlay"],
      "minMatches": 1
    }
  ]
}
```

`text` is matched against the site's visible copy, `classes` against all class names, `css` against the stylesheet; patterns are case-insensitive. Use it with `pnpm morpheus scan <path> --tells pack.json`, or programmatically with `loadTellPack` / `registerTell`. Packs are validated and report precise errors.
