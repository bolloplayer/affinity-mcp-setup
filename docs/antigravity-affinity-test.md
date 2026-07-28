# Antigravity (`agy`) → Affinity MCP acceptance test

Status: **run 29 July 2026 — connection and generation confirmed, full report not yet recorded.**
Antigravity reached Affinity, read the preamble, executed scripts, and produced a generated two-layer
variant saved as `examples/test-color-boost.js` (`Boost (Test)` / `Clean (Test)`). The structured
final report at the bottom of this document has not been filled in yet — in particular the negotiated
MCP protocol version, which model answered (Gemini 3.x vs gpt-oss-120b — grid rows 9 and 10 are
separate), and the hallucinated-SDK-call count.

Earlier attempts (27 July 2026) had died on Antigravity's daily quota wall — "quota reached" on every
request — not on anything Affinity-related. That wall cleared long enough to complete the run above,
then **the quota was exhausted again on 29 July 2026**, which is why the structured report below is
incomplete. Testing is paused, not blocked: the connection question is answered, and only
nice-to-have detail is outstanding.

**Do not re-run this test just to fill in the report.** The result that matters — Antigravity reaches
Affinity over native SSE and executes generated scripts — is confirmed. Pick the remaining fields up
opportunistically if a future session happens to have quota to spare.

**Notable:** Antigravity connected over **native SSE with no bridge**, unlike Codex. If confirmed,
that makes it a materially simpler setup than the OpenAI path — worth stating explicitly, since it
inverts the expectation set by the Codex experience.

This test proves the same three things the Codex test proved, in the same order:

1. **Connect** — Antigravity reaches Affinity's MCP server automatically from config.
2. **Run** — it executes a real script inside the running Affinity application.
3. **Generate** — it writes a *new* script from a prompt, based on `examples/color-boost.js`.

## The one thing most likely to go wrong

Read this before starting, because it determines whether the test can pass at all.

**Affinity accepts MCP protocol `2025-11-25` and nothing else.** Codex CLI failed here: its client
initializes with `2025-06-18`, and Affinity rejects it outright:

```text
-32602 Unsupported protocol version
{"supported":["2025-11-25"],"requested":"2025-06-18"}
```

That failure had nothing to do with the URL, IPv6, SSE, or the config file — the transport connected
fine and the handshake was refused. Codex needed `bridge/affinity-codex-bridge.mjs` to translate the
version.

**Whether Antigravity has the same problem is unknown and is the single most valuable finding of this
test.** Two possible outcomes:

- **Antigravity speaks `2025-11-25`** → direct SSE works, no bridge, and Antigravity is a *simpler*
  setup than Codex. Record this clearly; it would make it the easiest non-Claude path.
- **Antigravity speaks an older version** → same `-32602` rejection. See "If the handshake fails"
  below before concluding anything.

## Prerequisites

- Windows, Affinity v3 running, with a test image open.
- `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP` is on.
- `agy` on PATH (verified: `1.1.8`).
- `.agents/mcp_config.json` in this repository, containing:

  ```json
  {
    "mcpServers": {
      "affinity": {
        "serverUrl": "http://[::1]:6767/sse"
      }
    }
  }
  ```

  Note the field is `serverUrl`, **not** `url`. This file already exists in the repo.

- Use `http://[::1]:6767/sse`. Not `localhost`, not `127.0.0.1` — Affinity binds an IPv6 loopback
  socket and an IPv4 connection is refused by design.

## Test-integrity rule

During this test, **do not** use `curl`, a hand-written Node/Python/PowerShell MCP client, a browser,
or a manually opened SSE connection to reach Affinity.

Every Affinity action must go through the MCP tools Antigravity exposes automatically after startup —
in particular `read_sdk_documentation_topic` and `execute_script`. Automatic loading from config is
part of what is being tested. If the tools are absent, stop and record a startup failure rather than
working around it.

## Phase 0 — preflight

Antigravity has no `mcp` subcommand, so there is no `agy mcp list` equivalent — the connection can
only be verified from inside a session. Record versions first:

```powershell
agy --version
node --version
```

Confirm Affinity is running and listening:

```powershell
Get-Process Affinity | Select-Object ProcessName, Id
```

Then start a session from the repository root, so `.agents/mcp_config.json` is picked up:

```powershell
agy
```

Do not resume an older conversation (`-c` / `--continue`) for this test.

## Phase 1 — automatic MCP discovery

Inside the fresh session:

1. Confirm an Affinity MCP server / tool namespace is present.
2. List the real MCP tools reached through the automatically loaded connection.
3. Confirm at least `read_sdk_documentation_topic` and `execute_script` are present.
4. Report the Affinity server name, version, and the **negotiated MCP protocol version** if exposed.

Affinity publishes **11 tools**. The full set, for comparison:

```text
add_sdk_hint, execute_script, list_library_scripts, list_sdk_documentation,
read_library_script, read_sdk_documentation_topic, render_selection, render_spread,
report_sdk_issue, save_script_to_library, search_sdk_hints
```

**Pass:** tools available with no manual connection code.

**Fail:** tools missing, bridge/transport timeout, or the agent proposes writing its own client.
Stop and preserve the exact error text — especially any `-32602`.

## Phase 2 — required SDK read, then safe inspection

Affinity's server instruction is explicit: *"You MUST read the 'preamble' documentation before using
the SDK."* Read it first:

```json
{"filename":"preamble"}
```

Only after that succeeds, run one **read-only** script via `execute_script`:

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

Report the exact JSON returned. This phase must not modify the document.

> Expect the model to get SDK details wrong on the first try — every model tested so far has. In our
> Codex run it invented `Document.all.toArray()` before self-correcting. That is normal and does not
> constitute a test failure, as long as it recovers using the documentation rather than guessing
> again.

## Phase 3 — run the existing Color Boost script

1. Read these SDK topics through Affinity: `nodes.js`, `commands.js`, `adjustment_ranges`.
2. Read `examples/color-boost.js` from this repository.
3. Verify it only uses SDK calls present in the documentation just read.
4. Execute the file contents through `execute_script`.
5. Record the exact output. Expected:

   ```text
   Color Boost added — strength 1, opacity 25%
   ```

6. Run a read-only follow-up and confirm exactly one root-level layer is named `Color Boost`.

The script is idempotent by design: re-running replaces its own previous layer and must leave
unrelated layers untouched.

## Phase 4 — generate a new script from a prompt

This is the part that actually tests the *model*, not the plumbing. **Use the prompt below verbatim.**
It is the same prompt given to Codex, so the outputs are directly comparable across models — that
comparison is the point, so do not improve or reword it.

> Read the Affinity SDK `preamble` first, then read the relevant `nodes.js`, `commands.js`, and
> adjustment-range documentation. Write a directly executable, idempotent Affinity JavaScript
> colour-boost script for the current document. It must create exactly two independently adjustable
> root-level Selective Colour layers named `Boost` and `Clean`. `Boost` should use the six chromatic
> ranges to increase colour separation without clipping; `Clean` should gently clear whites and
> neutrals while preserving solid blacks. Re-running must delete only earlier `Boost` and `Clean`
> layers. Handle Affinity's topmost-group insertion quirk, use undoable document commands, set
> conservative opacities, print a concise success message, execute it, then inspect the root layer
> names to verify both layers exist. Finally compare the code and effect controls with
> `examples/color-boost.js`; do not invent SDK calls.

Then:

1. Save the generated script as `examples/gemini-color-boost-two-layer.js`.
2. Execute it and record the exact console output.
3. Inspect root-layer names and confirm `Boost` occurs exactly once, `Clean` occurs exactly once,
   both at root level, and `Color Boost` plus any unrelated layers are untouched.
4. **Execute it a second time.** Inspect again and confirm `Boost` and `Clean` still occur exactly
   once each. This proves re-run safety.
5. Optionally call `render_spread` for visual confirmation.

### The two known traps in this script

Both were found the hard way; the generated script must handle them:

- **Topmost-group insertion quirk** — if the top of the layer stack is a group, the builder parents
  the new layer *inside* it. Detect via unchanged root-layer count and move it out. See
  `examples/color-boost.js` lines 50–56.
- **Idempotency by exact name only** — delete only layers whose name matches exactly, so unrelated
  work survives a re-run.

## If the handshake fails

If you see `-32602 Unsupported protocol version`, the transport is fine and only the version is
wrong. Before concluding Antigravity cannot work:

1. Record the exact `requested` version from the error. This is the finding — write it down.
2. Check whether `.agents/mcp_config.json` also accepts a **stdio** server (`command` + `args`)
   alongside `serverUrl`. If it does, the existing bridge may work directly:

   ```json
   {
     "mcpServers": {
       "affinity": {
         "command": "node.exe",
         "args": ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
       }
     }
   }
   ```

3. If Antigravity accepts **only** `serverUrl`, the current stdio bridge does not fit — it speaks
   stdio outward, and Antigravity wants to *dial* an SSE URL. That would need a different bridge that
   listens as an SSE server and forwards to Affinity. Do not build it during this test; record the
   requirement and stop.

Verify the bridge itself is healthy at any point with:

```powershell
node .\bridge\smoke-test.mjs
```

That is a diagnostic, not part of the acceptance test — it uses its own client and so cannot prove
anything about Antigravity's automatic loading.

## Also worth recording

- **Quota.** Antigravity blocked all previous attempts with "quota reached". If it happens again,
  note the time and whether it was before or after any Affinity call, so we can tell a quota wall
  from a connection failure.
- **Which model answered.** `agy models` lists what is reachable. Gemini 3.x and gpt-oss-120b are
  both expected here and are separate grid rows (9 and 10) — record which one ran, since a pass on
  one says nothing about the other.
- **SDK hints.** If a non-obvious SDK fact turns up, record it with `add_sdk_hint` so later sessions
  inherit it, and add it to `docs/sdk-notes.md`.

## Required final report

```text
Antigravity → Affinity MCP test
Date/time:
agy version:
Model used:
Affinity version:
MCP server/version:
MCP protocol requested / accepted:
Bridge used: none (direct SSE) / custom

Automatic config loading: PASS/FAIL
Affinity tools discovered (expect 11): PASS/FAIL
Preamble read: PASS/FAIL
Read-only inspection: PASS/FAIL
Original Color Boost execution: PASS/FAIL
Generated two-layer execution: PASS/FAIL
Generated two-layer second-run idempotency: PASS/FAIL

Read-only inspection output:
Original script output:
Generated first-run output:
Generated second-run output:
Final root-layer names:
Hallucinated SDK calls (count + which):
Errors or warnings:
Overall result: PASS/FAIL
```

Overall result is **PASS** only if every line passes using the automatically exposed Affinity MCP
tools, with no hand-written client anywhere.

The `Hallucinated SDK calls` line is not a pass/fail criterion — it is the comparison metric against
Claude and DeepSeek in `docs/choosing-your-ai.md`, step 1. Record it even on a clean run (`0`).

## Prompt to paste into a fresh `agy` session

> Read `docs/antigravity-affinity-test.md` completely and perform the acceptance test exactly as
> written. Do not use curl, a browser, or a custom MCP/SSE client — the point is to prove this fresh
> session automatically loaded the Affinity MCP configuration from `.agents/mcp_config.json`. If the
> Affinity tools are missing, stop and report the exact startup failure, including any `-32602`
> protocol version error, without working around it. If they are available, read `preamble` before
> any script, complete all four phases including the second idempotency run, and return the required
> final report with exact outputs.
