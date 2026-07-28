# Codex CLI → Affinity MCP acceptance test

## Completed live test — 29 July 2026

The Codex-to-Affinity connection was tested live from this repository and **passed**. Codex
discovered the Affinity MCP tools, read the required SDK preamble, executed JavaScript inside the
running Affinity application, inspected the open document and rendered the result for visual
verification.

### Test environment

| Item | Observed value |
|---|---|
| Affinity | Affinity 3.2.3.4646 Win32 (7 July 2026 build) |
| Platform | Win32 |
| Open documents | 1 |
| Test document | `Giraffe.psd` |
| Document size | 1263 × 1930 px |
| Resolution | 144 dpi |
| Initial layer count | 1 (`Background`) |

The first script was read-only and returned `AFF_CONNECTION_OK`. It confirmed that Codex could
query the running application and current document without changing the canvas, layers, selection
or files.

### Color Boost script test

Codex then read the installed Affinity library script `4. Color Boost`. Unlike the earlier
repository example described later in this document, this library version already builds two
relative Selective Colour adjustments:

- `Clean`, which removes opposing CMY colour components;
- `Boost`, which reinforces the selected colour families and adds black for depth.

Both adjustments are placed in a `Color Boost` group at 25% opacity. The original library script
executed successfully and the spread was rendered for visual inspection.

Codex subsequently designed and executed a clearer two-layer version based on the same colour
weights and construction order:

- `Clear Color` — renamed from `Clean` to describe its purpose;
- `Boost` — retains the original boost calculations.

The generated group is named `Color Boost — Boost + Clear Color`, has 25% opacity and contains
exactly two visible child layers. Execution returned:

```text
TWO_LAYER_COLOR_BOOST_OK
group=Color Boost — Boost + Clear Color
opacity=0.25
children=Clear Color, Boost
childCount=2
```

The resulting render was visually indistinguishable from the installed original because the
Selective Colour weights, strength, green black-weight scaling, layer order and group opacity were
preserved. The new version improves naming, readability and post-run structural validation. It was
saved successfully to Affinity's script library as `Color Boost — Boost + Clear Color`.

### Result

| Check | Result |
|---|---|
| Affinity MCP tools discovered | PASS |
| SDK preamble read before scripting | PASS |
| Read-only JavaScript execution | PASS |
| Current-document inspection | PASS |
| Original library Color Boost execution | PASS |
| Generated two-layer execution | PASS |
| Layer structure validation | PASS |
| Visual render verification | PASS |
| Script saved to Affinity library | PASS |
| Overall live test | **PASS** |

This completed test proves the practical Codex workflow: **connect → inspect → read an existing
Affinity script → generate a related script → execute it → render and assess the result → save the
working script**.

Use this test to prove that a **fresh Codex CLI process automatically loads the configured custom
protocol bridge** and can use Affinity's real MCP tools. This is deliberately stricter than a port
or direct-SSE test.

Codex CLI `0.145.0` and the bundled `0.146.0-alpha.3.1` request MCP protocol `2025-06-18`, while
Affinity accepts only `2025-11-25`. The generic `mcp-remote` bridge transports stdio to SSE but does
not translate that protocol version, so it is rejected with JSON-RPC error `-32602`. The local
bridge in `bridge/affinity-codex-bridge.mjs` translates the initialization version and passes all
subsequent JSON-RPC messages through unchanged.

## What this test must prove

1. A fresh `codex` process reads `%USERPROFILE%\.codex\config.toml`.
2. Codex starts `node.exe bridge/affinity-codex-bridge.mjs` automatically.
3. The Affinity tool schemas reach the model without an ad-hoc client.
4. Codex reads the required SDK preamble.
5. Codex can inspect the current document without changing it.
6. Codex can execute the original one-layer Color Boost script.
7. Codex can execute and re-run the generated two-layer `Boost` + `Clean` script safely.

## Important test-integrity rule

During this acceptance test, **do not** use `curl`, a custom Node/Python/PowerShell MCP client, the
in-app browser, or a manually opened SSE connection to call Affinity.

All Affinity actions must use the Affinity MCP tools that Codex exposes automatically after startup,
especially:

- `read_sdk_documentation_topic`
- `execute_script`

If those tools are not available in the fresh CLI session, stop and record a startup failure. Do not
work around it: automatic MCP loading is the part being tested.

## Prerequisites

- Windows.
- Affinity v3 is running.
- A test image/document is open in Affinity.
- `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP` is enabled.
- Node.js and `npx.cmd` are installed.
- `%USERPROFILE%\.codex\config.toml` contains an absolute bridge path:

  ```toml
  [mcp_servers.affinity]
  command = "node.exe"
  args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
  ```

## Phase 0 — terminal preflight

Open a **new VS Code terminal** in this repository and run:

```powershell
node --version
npx.cmd --version
codex --version
codex mcp list
```

Record the versions. `codex mcp list` must contain an enabled `affinity` entry using `node.exe` and
the absolute path to `affinity-codex-bridge.mjs`.

Then start a genuinely fresh CLI process:

```powershell
codex
```

Do not resume an older Codex conversation for this test.

## Phase 1 — automatic MCP discovery

Inside the fresh Codex CLI session:

1. Confirm whether an Affinity MCP server/tool namespace is present.
2. Obtain the real MCP tool list through the automatically loaded connection.
3. Confirm that at least `read_sdk_documentation_topic` and `execute_script` are present.
4. Report the Affinity server name, version and negotiated MCP protocol version when exposed.

**Pass:** the Affinity tools are available without any manual connection code.

**Fail:** the tools are missing, the bridge times out, or Codex asks to create a direct client.
Stop here and preserve the exact error output.

## Phase 2 — required SDK read and safe inspection

Use the Affinity documentation tool to read:

```json
{"filename":"preamble"}
```

Only after that succeeds, run one read-only Affinity script with `execute_script`:

```javascript
'use strict';
const { app } = require('/application');
const doc = app.documents.current;

console.log(JSON.stringify({
  product: app.productLongName,
  version: app.version,
  openDocuments: app.documents.all.length,
  hasCurrentDocument: Boolean(doc),
  spreads: doc ? doc.spreads.length : null,
  topLevelLayers: doc ? doc.layers.length : null
}));
```

Report the exact returned JSON. This phase must not change the document.

## Phase 3 — original one-layer Color Boost

1. Read these SDK topics through Affinity:
   - `nodes.js`
   - `commands.js`
   - `adjustment_ranges`
2. Read `examples/color-boost.js` from this repository.
3. Check that the script uses only SDK calls supported by the documentation just read.
4. Execute the file contents through the Affinity `execute_script` tool.
5. Record the exact console output. The expected form is:

   ```text
   Color Boost added — strength 1, opacity 25%
   ```

6. Run a read-only follow-up inspection and confirm that exactly one root-level layer has the exact
   name `Color Boost`.

The script is idempotent: an earlier exact-name `Color Boost` layer may be replaced, but unrelated
layers must remain untouched.

## Phase 4 — generated two-layer variant

1. Read `examples/openai-color-boost-two-layer.js`.
2. Compare it with `examples/color-boost.js` before execution:
   - original: one `Color Boost` layer;
   - variant: independent `Boost` and `Clean` layers;
   - original boost strength: `1.0`;
   - variant boost strength/opacity: `0.12` / `25%`;
   - variant clean strength/opacity: `0.06` / `30%`.
3. Execute `examples/openai-color-boost-two-layer.js` through Affinity.
4. Record the exact console output. The expected form is:

   ```text
   Added Boost (25%) and Clean (30%)
   ```

5. Inspect the root-layer names and confirm:
   - `Boost` occurs exactly once;
   - `Clean` occurs exactly once;
   - both are root-level layers;
   - unrelated layers, including `Color Boost`, remain untouched.
6. Execute the same two-layer script a second time.
7. Inspect again and confirm that `Boost` and `Clean` still each occur exactly once. This proves
   re-run safety.

## Required final report

At the end, print a compact report using this template:

```text
Codex CLI → Affinity MCP test
Date/time:
Codex version:
Node version:
Affinity version:
MCP server/version:
MCP protocol:

Automatic config loading: PASS/FAIL
Affinity tools discovered: PASS/FAIL
Preamble read: PASS/FAIL
Read-only inspection: PASS/FAIL
Original Color Boost execution: PASS/FAIL
Two-layer execution: PASS/FAIL
Two-layer second-run idempotency: PASS/FAIL

Read-only inspection output:
Original script output:
Two-layer first-run output:
Two-layer second-run output:
Final root-layer names:
Errors or warnings:
Overall result: PASS/FAIL
```

The overall result is **PASS** only when every line above passes using the automatically exposed
Affinity MCP tools.

## Prompt to paste into the fresh Codex CLI

> Read `docs/codex-cli-affinity-test.md` completely and perform the acceptance test exactly as
> written. Do not use curl, the browser, or a custom MCP/SSE client. The purpose is to prove that
> this fresh Codex CLI process automatically loaded the Affinity MCP configuration. If the Affinity
> tools are missing, stop and report the exact startup failure without working around it. If they
> are available, read `preamble` before any script, complete all four phases, and return the required
> final report with exact outputs.
