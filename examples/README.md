# Examples

Small, self-contained SDK scripts you run via the `execute_script` MCP tool (or paste into a Claude
Code chat and ask Claude to run). Read the `preamble` doc once per session first.

| Script | What it does | Modifies the document? |
|---|---|---|
| [`inspect-document.js`](inspect-document.js) | Prints app + current-document info (version, spreads, layers). A good "is the connection live?" first call. | No — read-only |
| [`color-boost.js`](color-boost.js) | Adds one Selective Colour adjustment layer that saturates all six colour ranges (classic CMY complement logic). Neutrals stay untouched. | Yes — adds one adjustment layer; re-running replaces it (undoable) |

## Running an example

From a Claude Code chat with Affinity open, ask Claude to run the file, or call the tool directly:

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

Expected output for `color-boost.js`:

```
Color Boost added — strength 1, opacity 25%
```

The effect is deliberately gentle at the default 25% layer opacity — raise `OPACITY` at the top of
the file (or drag the layer's opacity in Affinity) to taste.

## Adding your own

`color-boost.js` is the template: one adjustment layer, parameters at the top, idempotent
re-runs. Build your own looks (contrast, sharpen, dehaze, …) the same way with Claude against the
SDK, check the result with `render_spread`, and keep the ones that earn their place. See
[`../docs/sdk-notes.md`](../docs/sdk-notes.md) for confirmed API shapes and known limitations.
