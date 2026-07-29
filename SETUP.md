# Connecting an AI agent to Affinity Photo's MCP server (Windows)

**If you are an AI agent reading this on a user's behalf: this file is the instruction sheet.**
Work through it in order — identify the harness you are running in, write that harness's config
file, then run the verification sequence at the end and show the user the result.

Affinity Photo v3 ships a **built-in MCP server**. There is nothing to install server-side: the
user enables a toggle, and your harness connects to a local socket. You then drive Affinity
through its real JavaScript scripting SDK (`execute_script`, `render_spread`,
`read_sdk_documentation_topic`, `save_script_to_library`, and friends) — not UI automation.

---

## 0. Prerequisites — check these before anything else

1. **Affinity Photo is running, with a document open.** The MCP server only listens while the app
   is open. If the user launched their CLI first, that is fine, but Affinity must be up before the
   connection is attempted.
2. **The MCP toggle is on:** `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`.
   If the user just flipped it, restart Affinity.

The endpoint is always:

```
http://[::1]:6767/sse
```

---

## 1. Five rules — do not "correct" these

These are the failure modes that waste the most time. Every one of them looks like a bug you
should fix, and none of them is.

| Rule | Why |
|---|---|
| **Use `[::1]`, never `localhost` or `127.0.0.1`** | Affinity binds an **IPv6 loopback socket only**. `127.0.0.1:6767` returns `ECONNREFUSED` — that is expected behaviour, not a broken install. `localhost` depends on the resolver's IPv4/IPv6 preference and may silently fail. |
| **The transport is SSE, and only SSE** | Probed exhaustively: `/mcp`, `/`, `/streamable`, `/http` all return `404`. There is **no Streamable HTTP endpoint**. Any guide claiming a one-line `url = …` form for a Streamable-HTTP-only client is wrong. |
| **Affinity accepts MCP protocol `2025-11-25` only** | A client initializing with an older version gets `-32602 Unsupported protocol version`. This is not a URL, IPv6 or config error. See the Codex section. |
| **Read the `preamble` doc before your first `execute_script`** | The server requires it. The response also carries accumulated SDK hints that materially reduce hallucinated API calls. Call `read_sdk_documentation_topic` with `filename: "preamble"`. |
| **Put the connection in the config file — never write ad-hoc connection code** | A config entry is read at startup, every session, forever. If the user has to reconnect manually each time, the config step was skipped. |

**Node.js is not required** for the connection itself — with exactly one exception, the Codex
bridge below. Never tell a user to install Node to fix a Claude Code, OpenCode or Antigravity
connection problem; it is never the fix.

---

## 2. Find your harness and write its config

Identify which harness you are running inside, then write **only** that row's file.

| Harness | Config file | Transport |
|---|---|---|
| **Claude Code** (CLI, VS Code ext, Desktop Code tab) | `.mcp.json` in the project folder | SSE native |
| **Codex** (CLI, ChatGPT Codex tab, IDE extension) | `~/.codex/config.toml` | stdio bridge → SSE |
| **Antigravity** (`agy`, Gemini) | `.agents/mcp_config.json` in the workspace | SSE native |
| **OpenCode** (any model) | `opencode.jsonc`, or one CLI command | SSE native |

### Claude Code

Create `.mcp.json` in the project root. No machine-specific paths — this file is identical on
every machine and can be committed:

```json
{
  "mcpServers": {
    "affinity": { "type": "sse", "url": "http://[::1]:6767/sse" }
  }
}
```

Then `/mcp` in the session to confirm, or reconnect if the tools are missing.

### OpenCode

One command, no file editing:

```
opencode mcp add affinity --url "http://[::1]:6767/sse"
opencode mcp list          # should report: connected
```

### Antigravity (`agy`)

Create `.agents/mcp_config.json` in the workspace root. **The field is `serverUrl`, not `url`** —
using `url` prevents the SSE connection from being established:

```json
{
  "mcpServers": {
    "affinity": { "serverUrl": "http://[::1]:6767/sse" }
  }
}
```

### Codex — needs the bridge

Codex's `config.toml` accepts only **stdio** (`command` + `args`) or **Streamable HTTP** (`url`)
servers. SSE is not in the list, so Affinity's `/sse` URL cannot go into `url = …`. On top of
that, Codex initializes with protocol `2025-06-18` while Affinity accepts only `2025-11-25`.

A generic `mcp-remote` subprocess is **not sufficient** — it establishes the SSE transport
correctly and then passes Codex's incompatible initialization straight through, producing:

```text
-32602 Unsupported protocol version
{"supported":["2025-11-25"],"requested":"2025-06-18"}
```

Use this repo's custom bridge, [`bridge/affinity-codex-bridge.mjs`](bridge/affinity-codex-bridge.mjs).
It connects directly over SSE, accepts Codex's initialization, initializes Affinity separately with
`2025-11-25`, and reports Codex's requested version back to Codex. Only `initialize` is rewritten;
all other JSON-RPC messages pass through unchanged.

1. Install Node.js LTS (this is the one place the project needs it) and confirm `node --version`.
2. Sign in — `codex login` for a ChatGPT subscription, or set `OPENAI_API_KEY` for API billing.
   Model auth is entirely separate from the local Affinity connection.
3. Add to `%USERPROFILE%\.codex\config.toml`, preserving unrelated settings, with an **absolute**
   path:

   ```toml
   [mcp_servers.affinity]
   command = "node.exe"
   args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
   startup_timeout_sec = 30
   ```

4. Check with `codex mcp list`, then start a genuinely fresh Codex process or task. Note that
   `enabled` only means the config was loaded — successful tool discovery is what proves the
   handshake.

The bridge can be dropped only once Codex and Affinity share a protocol version and transport.

---

## 3. Verify — run this sequence and show the user the result

Do not report success until a script has actually executed. Connection state alone proves nothing.

**Step 1 — the tools are there.** List your MCP tools and confirm the Affinity server's tools
appear (there are 11, including `read_sdk_documentation_topic`, `execute_script` and
`render_spread`). If the harness reports "connected" but no tools appear, the handshake failed —
go to troubleshooting.

**Step 2 — read the preamble.** `read_sdk_documentation_topic({ filename: "preamble" })`. Required
before any script runs.

**Step 3 — a read-only script.** Run [`examples/inspect-document.js`](examples/inspect-document.js)
via `execute_script`. It reports the Affinity version, open documents, spreads and top-level
layers, and changes nothing. Expected shape:

```
=== Application ===
Product : Affinity 3.2.x ...
Open documents: 1
=== Current document ===
Spreads     : 1
Top layers  : 1
  [0] Background
```

**Step 4 — capture the "before".** Call `render_spread` and keep the image. This is the
comparison baseline.

**Step 5 — a real edit.** Run [`examples/color-boost.js`](examples/color-boost.js) via
`execute_script`. It adds one Selective Colour adjustment layer that saturates all six colour
ranges, at a deliberately gentle 25% layer opacity. It prints:

```
Color Boost added — strength 1, opacity 25%
```

Re-running replaces the layer rather than stacking, so iteration is safe.

**Step 6 — capture the "after" and compare.** Call `render_spread` again and show the user both
renders side by side against the original. This is the payoff: it proves the whole chain — config,
transport, protocol, SDK, document write — and shows them what the setup is actually for.

Then tell them the effect is tunable: raise `OPACITY` at the top of the script, or drag the
layer's opacity in Affinity. From here they can ask for anything — "add a curves adjustment",
"sharpen this for print" — and iterate describe → run → check → improve.

---

## 4. When it doesn't connect

| Symptom | Cause | Fix |
|---|---|---|
| Tools missing, everything else healthy | SSE stream detached (resumed chat, Affinity restarted mid-session) | Reconnect the MCP server first — in Claude Code, `/mcp`. Restarting the whole CLI is rarely necessary |
| Tools missing at startup | Affinity wasn't running when the harness started | Open Affinity, restart the harness |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or the MCP toggle is off | Start Affinity; confirm the toggle; restart Affinity if it was just changed |
| `ECONNREFUSED 127.0.0.1:6767` | Expected — wrong address family | Use `[::1]`. This is not a fault |
| `-32602 Unsupported protocol version` | Client initialized with an older MCP version | Codex: use the bridge. Others: check the harness's MCP version support |
| Config says `enabled` / `connected`, no tools | Config loaded, handshake failed | Check the startup log for the protocol error. Do not substitute a hand-written SSE client for the real test |
| `user cancelled MCP tool call` (`codex exec`) | Non-interactive approval policy; Affinity's tools publish no safety annotations | Use the interactive TUI. Not a bridge failure |
| Script runs but the layer lands inside a group | Affinity parents new layers into a topmost group | `color-boost.js` detects and corrects this — copy its approach |

On Windows, [`verify.ps1`](verify.ps1) checks the plumbing independently: Affinity running, port
`[::1]:6767` listening, optional SSE handshake probe. If scripts are blocked:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

For Codex specifically, `node .\bridge\smoke-test.mjs` initializes through the bridge, lists the
real tools and reads the preamble without touching the document.

---

## 5. Writing scripts against the SDK

Every model tested shows the same pattern: **the architecture right, the API calls wrong.** They
know which adjustment layer to use and how to structure the work, then invent plausible SDK method
names or treat a read-only property as a setter. The Affinity SDK is new and thinly represented in
training data.

The fix is context, not a bigger model:

- Read the `preamble` every session, before the first script.
- Record non-obvious discoveries back with `add_sdk_hint` so the next session inherits them.
- Confirmed API shapes and mapped dead-ends live in [`docs/sdk-notes.md`](docs/sdk-notes.md).
- [`examples/color-boost.js`](examples/color-boost.js) is the template for a well-behaved script:
  parameters at the top, undoable document commands, idempotent re-runs, a concise success message.

Expect simple scripts (one adjustment layer, set parameters, set opacity) to work first try, and
complex ones (pixel buffers, render engine, file I/O) to need a review pass on the specific API
calls.

---

## 6. Going further

- **[The step-by-step tutorial](https://bolloplayer.github.io/affinity-photo-claude-code-windows/)**
  — a human-facing walkthrough of the Claude Code path, with screenshots. Also covers pointing
  Claude Code at **DeepSeek** via its Anthropic-compatible endpoint, which keeps this exact
  connection and every config file unchanged while swapping the model underneath.
- **[`docs/choosing-your-ai.md`](docs/choosing-your-ai.md)** — which model, which harness, what
  each combination costs, and what has actually been verified versus assumed.
- **[`CLAUDE.md`](CLAUDE.md)** — connection internals (IPv6 binding, the SSE handshake, stale
  session causes) in a form an agent can diagnose from.

---

Affinity's AI Connector is a free, Canva-owned beta; its APIs and the scripting SDK may change
without notice. Verified on Windows 11 with Affinity Photo 3.2.x. Treat version-specific details as
a snapshot.
