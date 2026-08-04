# Examples

Small, self-contained SDK scripts you run via the `execute_script` MCP tool — from any harness that
reaches Affinity (Claude Code, Codex, Antigravity, OpenCode). Read the `preamble` doc once per
session first; the server requires it.

`inspect-document.js` and `color-boost-two-layer.js` are the connection test in
[`../SETUP.md`](../SETUP.md): the read-only one proves the transport, the boost proves the whole
chain down to a document write.

| Script | What it does | Modifies the document? |
|---|---|---|
| [`inspect-document.js`](inspect-document.js) | Prints app + current-document info (version, spreads, layers). A good "is the connection live?" first call. | No — read-only |
| [`color-boost-two-layer.js`](color-boost-two-layer.js) | **The demo.** Adds `Boost` (saturates the six colour ranges) over `Clean` (lifts highlights, keeps blacks solid) as two independently tunable layers. | Yes — adds two adjustment layers; re-running replaces its own (undoable) |
| [`color-boost.js`](color-boost.js) | The single-layer original: one Selective Colour layer, all six ranges, neutrals untouched. Simpler to read, and what the step-by-step tutorial walks through. | Yes — adds one adjustment layer; re-running replaces it (undoable) |

## Running an example

From an agent session with Affinity open, ask it to run the file, or call the tool directly:

```
execute_script({ script: "<contents of the .js file>" })
```

Expected output for `inspect-document.js` (yours will differ):

```
=== Application ===
Product : Affinity 3.2.x ...
Platform: Win32
Open documents: 1
=== Current document ===
Spreads     : 1
Top layers  : 1
  [0] Background
```

Expected output for `color-boost-two-layer.js`:

```
Two-layer Color Boost added — Boost (strength 0.6, opacity 40%) over Clean (strength 0.25, opacity 30%)
```

Every parameter sits at the top of the file. `BOOST_OPACITY` and `CLEAN_OPACITY` are the master
"how much" controls — or just drag either layer's opacity in Affinity.

### Why two layers

One layer per idea. `Boost` carries the colour, `Clean` carries the tone, and neither touches the
other's territory — `Boost` leaves neutrals alone, `Clean` only moves the black channel. So you can
switch off the cleanup and keep the colour, or halve the boost without flattening the contrast.

That separation is the habit worth copying when you build your own looks. A single layer doing four
things at once can only be tuned as one lump.

### Seeing the difference

Call `render_spread` **before** running the script and again after, then put the two renders side by
side. That comparison is the point: it shows what you just gained, and it proves config, transport,
protocol, SDK and document write all work — which a "connected" status message does not.

Re-running replaces only this script's own `Boost` and `Clean` layers and leaves everything else
alone, so you can tune, re-run and re-render as often as you like.

## Adding your own

`color-boost-two-layer.js` is the template: parameters at the top, one layer per idea, undoable
document commands, idempotent re-runs, a concise success message. Build your own looks (contrast,
sharpen, dehaze, …) the same way against the SDK, check the result with `render_spread`, and keep
the ones that earn their place. See [`../docs/sdk-notes.md`](../docs/sdk-notes.md) for confirmed API
shapes and known limitations.
