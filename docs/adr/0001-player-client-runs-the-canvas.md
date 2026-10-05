---
status: accepted
---

# The player client runs Atlas' own canvas

Online players first saw the scene as JPEG frames that the GM's Atlas rendered per player and streamed over SSE. That kept every secret on the GM's machine, but the player's view drifted from the GM's: blurry text, black margins while zooming until the next frame came, no smooth camera, and a hand-made copy of every control (selection ring, token drag, party panel). We chose parity instead: the player client runs the same canvas engine (PIXI renderers, store, interaction) on a copy of the presented scene, in player view. The GM's Atlas stays the one authority: it sends the scene and its changes, and players change it only through player commands it validates. The canvas takes its services (image URLs, collection rules, statblocks) from outside and imports neither Obsidian nor the GM's React UI, so both sides run one code.

## Consequences

- **Known security debt, accepted for now**: the browser receives the scene as data, including hidden tokens and what the fog covers. A player who opens the console can read it. Filtering what is sent is deferred, not forgotten.
- **No dynamic lighting online**: the player client never runs the lighting engine. A scene with lighting on shows unlit to online players, with fog of war only. The GM reveals the map by hand with the fog.
- The JPEG frame stream (per-player renders, encoding, frame quality settings, the hand-drawn client overlays and camera) is removed once the player client replaces it.
- The local player window is untouched: it still mirrors the GM's canvas and can show lighting.
