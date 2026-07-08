# Affinity Photo SDK — field notes

Confirmed behaviours and dead-ends from driving Affinity's scripting SDK over MCP. These are the
things that cost time to discover. Affinity is beta software — treat as a snapshot and re-verify
against your version. The `preamble` doc (read it every session) is always the source of truth.

## Session / connection

- **Read the `preamble` first, every session.** Affinity enforces it with a system-reminder, and
  the response carries accumulated `add_sdk_hint` knowledge from prior sessions. Skipping it means
  writing scripts blind to known API traps.
- **IPv6 only.** The server binds `[::1]:6767`; `127.0.0.1` and (sometimes) `localhost` are
  refused. Your client / `.mcp.json` URL must use `[::1]`.
- **`execute_script` returns nothing by default** — use `console.log(...)` to get output back.

## Object creation & module includes

- Includes use the virtual `require('/module')` form, e.g. `require('/document')`,
  `require('/rasterobject')`, `require('/commands')`, `require('/selections')`, `require('/nodes')`.
- **If a class has `create` / `createDefault`, use it; otherwise use `new`.** (Documented in the
  preamble.)
- Enum classes expose `keys`, `values`, `entries` as **properties**, not methods — use them to find
  valid values rather than guessing.

## Spreads, selection, editing

- **Set the current spread before editing nodes on it** — but only if it isn't already current,
  because setting the spread **clears the selection**.
- `doc.spreads` is a node-children collection: use `.first` / iterate, not `[0]`.
- `doc.layers` is the top-level layer collection; `.toArray()` to iterate.
- Commands go through the history: `doc.executeCommand(DocumentCommand.createXxx(...))`, and are
  undoable via `doc.undo()`.
- Deleting a layer: `DocumentCommand.createDeleteSelection(Selection.create(doc, layer), true)`.

## Loading images from a script

- `Bitmap.loadFromFile(path)` → `ImageNodeDefinition.create(bitmap.format)` → set `def.bitmap` →
  `doc.addNode(def)`. Use this to bring an image **into an existing document**.
- Filesystem access may be **restricted** by the user in Affinity settings; a script command can
  return `NOT_ALLOWED` for filesystem, networking, or AI. If you have filesystem access, it's
  scoped to the **Desktop** (`app.userDesktopPath`).

## Known limitations (as of Affinity Photo 3.2.x)

- **No macro playback from a script.** You can record / import / export a macro, but there is **no
  play/run/apply** method — a `.afmacro` cannot be executed from a script. Re-run your SDK code per
  image instead of replaying a macro.
- **Documents can't be closed from a script, and undo history leaks memory.** A load-per-image loop
  (`Document.load` each time) grows memory and crashes after a handful of images. Workaround for
  batch work: keep **one** document open and reuse it — rewind with
  `doc.executeCommand(DocumentCommand.createSetHistoryIndex(0))` so the next edits *truncate* the
  accumulated history instead of appending to it, delete the old layers, then bring the next image
  into the same document (`Bitmap.loadFromFile` → `ImageNodeDefinition`, see above). This keeps
  memory flat across hundreds of images.
- **Some newer UI filters are not in the scripting SDK.** In our testing the UI "Texture" filter,
  "Multi Band" sharpen, and raw Luminosity/Hue/Compound **mask types** were not scriptable. Work
  around it: use `HighPass` (or a band-pass built from blurs) for texture, and **blend ranges** for
  luminosity-style masking.

## Handy application facts

- `const { app } = require('/application');`
- `app.version`, `app.productLongName`, `app.platformName`, `app.userDesktopPath`
- `app.documents.current` / `app.documents.all`
- Dialog and AI APIs exist in the SDK — prefer the SDK's Dialog API for any UI, and its AI APIs
  over external services for generative work (subject to the user's AI-access setting).

## Recording your own findings

When a script solves a non-obvious SDK problem through experimentation, call `add_sdk_hint` so the
next session (yours or someone else's) inherits it. That shared hint pool is one of the nicer parts
of this setup.
