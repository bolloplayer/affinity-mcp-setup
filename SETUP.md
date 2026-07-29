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
3. **The project folder sits under the Desktop** — `C:\Users\<you>\Desktop\my-project`. The MCP
   connection works from anywhere, but Affinity sandboxes **script** file access to the Desktop
   tree (`app.userDesktopPath`). A script that exports a render, writes a batch result or saves a
   file returns `NOT_ALLOWED` outside it. The verification sequence below does not need this —
   `render_spread` returns bytes over MCP — but the user's real work will. If the folder is
   elsewhere, say so now rather than after the first failed export.

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
| **Read the `preamble` doc before your first `execute_script`** | The server requires it, and the gate is **per connection**, not per machine or per day: a new SSE session starts un-gated and `execute_script` returns `The preamble documentation topic has not yet been read` until you call it again. The response also carries accumulated SDK hints that materially reduce hallucinated API calls. Call `read_sdk_documentation_topic` with `filename: "preamble"`. |
| **Put the connection in the config file — never write ad-hoc connection code** | A config entry is read at startup, every session, forever. If the user has to reconnect manually each time, the config step was skipped. |

**Node.js is not required** for the connection itself — with exactly one exception, the Codex
bridge below. Never tell a user to install Node to fix a Claude Code, OpenCode or Antigravity
connection problem; it is never the fix.

---

## 2. Find your harness and write its config

Identify which harness you are running inside, then write **only** that row's file.

| Harness | Config file | Transport |
|---|---|---|
| **Claude Code** (CLI, VS Code ext, Desktop Code tab) | `claude mcp add --scope user` (or `.mcp.json`) | SSE native |
| **Codex** (CLI, ChatGPT Codex tab, IDE extension) | `~/.codex/config.toml` | stdio bridge → SSE |
| **Antigravity** (`agy`, Gemini) | `.agents/mcp_config.json` in the workspace | SSE native |
| **OpenCode** (any model) | `opencode.jsonc`, or one CLI command | SSE native |

### Claude Code

**Register it once for the whole machine — not per project.** Affinity's endpoint is the same
URL in every folder, so a per-project file is the wrong shape for it. One command:

```
claude mcp add --transport sse --scope user affinity http://[::1]:6767/sse
```

`--scope user` writes to `~/.claude.json`, so **every** project on this machine gets the server
from then on. Check it with `claude mcp list` — it reports a health status, and `✔ Connected`
means Affinity answered.

Prefer a committed, per-project config instead — a shared team repo, say? Write `.mcp.json` in
the project root. It has no machine-specific paths, so it works verbatim anywhere:

```json
{
  "mcpServers": {
    "affinity": { "type": "sse", "url": "http://[::1]:6767/sse" }
  }
}
```

Both forms need the same restart, once. Read on — this is where the setup usually stalls.

#### The restart is unavoidable. Plan for it.

**Whichever form you used, the Affinity tools do not exist in your current session.** Claude Code
loads MCP configuration at startup. Writing config mid-session registers nothing, and `/mcp`
cannot reconnect a server that was never registered — it retries *failed* servers and handles
OAuth, which is a different thing. A project server added this way reports
`⏸ Pending approval (run claude to approve)` until a new session picks it up.

This is the single most common way the setup stalls: the agent writes a correct config, finds it
has no tools, concludes something is broken, and starts debugging a transport that was fine.

The sequence that works:

1. Register the server — the `claude mcp add` command above, or `.mcp.json`.
2. Run [`verify.ps1`](verify.ps1) — it confirms the endpoint, tools and open document from
   outside the session, so you know the config is good before anyone restarts anything.
3. **Leave a resume note** — see below. The session that comes back has none of your context.
4. **Stop and tell the user to restart Claude Code** (`claude`, or reload the VS Code window).
   Approve the server when prompted.
5. In the new session, `/mcp` shows `affinity` and the verification sequence in §3 runs on the
   real tools.

With user scope that restart is a one-time cost for the whole machine: every later project has
the server from its first message, and there is no "was Claude launched in the right folder?"
failure mode.

Do not work around a missing server by writing your own SSE client. It appears to work, proves
nothing about the user's actual configuration, and costs far more time than the restart.

#### The resume note — do not skip this

A restart is a new session with an **empty context**. It will not know that a setup was underway,
what you already did, or that a verification sequence is waiting. Left to itself it greets the user
and does nothing, and the user has to explain the whole thing again.

Claude Code reads **`CLAUDE.md` from the project folder at startup**, automatically. That is the
handoff channel. Before you tell the user to restart, write one:

- **If the folder has no `CLAUDE.md`** (a fresh project), create it.
- **If one already exists**, append a section — never overwrite the user's own instructions.

Keep it short and imperative, so the next session acts instead of summarising:

```markdown
## Affinity MCP setup — resume here

State: the `affinity` MCP server was registered (user scope via `claude mcp add`,
or `.mcp.json` in this folder) and `verify.ps1` passed. The connection could not be
used in the session that registered it, because Claude Code loads MCP configuration
only at startup. This session is the restart.

Do this now, without waiting to be asked:

1. Confirm the `affinity` MCP tools are present (11 of them).
2. `read_sdk_documentation_topic({ filename: "preamble" })` — the gate is per connection.
3. Run the verification sequence in SETUP.md §3, steps 3–6: inspect the document,
   `render_spread` for the "before", run `examples/color-boost.js`, render the "after",
   then show the user both and confirm the layer count rose.

Delete this section once the user has seen the before/after.
```

Then tell the user, in your final message before they restart, exactly what to type — a plain
"continue" is enough once the note is in place, but say it explicitly rather than assuming.

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

Run this in a session that started **after** the config file existed — see the restart note in the
Claude Code section above. If you wrote `.mcp.json` earlier in this same session, stop here and ask
the user to restart; the steps below cannot pass without the real tools.

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
comparison baseline. It takes the document's `sessionUuid` (step 3 prints it) and a zero-based
`spread_index`, and returns **JPEG** — don't save the bytes as `.png`.

**Step 5 — a real edit.** Run [`examples/color-boost.js`](examples/color-boost.js) via
`execute_script`. It adds one Selective Colour adjustment layer that saturates all six colour
ranges, at a deliberately gentle 25% layer opacity. It prints:

```
Color Boost added — strength 1, opacity 25%
```

Re-running replaces the layer rather than stacking, so iteration is safe. Tell the user this step
modifies the document they have open — it adds one non-destructive adjustment layer, removable with
Ctrl+Z or by deleting the `Color Boost` layer.

**Step 6 — capture the "after" and compare.** Call `render_spread` again and show the user both
renders side by side against the original. This is the payoff: it proves the whole chain — config,
transport, protocol, SDK, document write — and shows them what the setup is actually for.

At 25% opacity the difference is real but subtle, and on a downscaled render it can be hard to see.
Confirm it rather than asserting it: re-run `inspect-document.js` to show the layer count went up
with `Color Boost` on top, and if you want a number, compare the two renders pixelwise (a gentle
boost lands around 3/255 mean absolute difference). Never describe a change you have not verified.

Then tell them the effect is tunable: raise `OPACITY` at the top of the script, or drag the
layer's opacity in Affinity. From here they can ask for anything — "add a curves adjustment",
"sharpen this for print" — and iterate describe → run → check → improve.

---

## 4. When it doesn't connect

| Symptom | Cause | Fix |
|---|---|---|
| **Tools missing right after you registered the server** | MCP config is loaded at startup. A server added mid-session was never registered, and `/mcp` only retries *failed* servers — it cannot load a new one | Restart Claude Code. Expected, not a fault — see the Claude Code section |
| `⏸ Pending approval (run claude to approve)` in `claude mcp list` | A project-scoped server from `.mcp.json` is waiting for interactive approval | Start a session and approve it. Confirms the config is valid, not broken |
| **The restarted session does nothing / doesn't know about the setup** | A restart starts with an empty context. Without a resume note there is nothing telling it a verification was pending | Write the setup state into the folder's `CLAUDE.md` **before** asking for the restart — Claude Code loads it at startup. See "The resume note" above |
| `NOT_ALLOWED` from a script doing file I/O | Affinity sandboxes script filesystem access to the Desktop tree | Move the project under `C:\Users\<you>\Desktop\`. Not a permissions bug — a location rule |
| Tools missing, everything else healthy | SSE stream detached (resumed chat, Affinity restarted mid-session) | Reconnect the MCP server first — in Claude Code, `/mcp`. Restarting the whole CLI is rarely necessary |
| `The preamble documentation topic has not yet been read` | The gate is per SSE connection; the preamble was read on a different one | Call `read_sdk_documentation_topic({ filename: "preamble" })` again on the current connection |
| Tools missing at startup | Affinity wasn't running when the harness started | Open Affinity, restart the harness |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or the MCP toggle is off | Start Affinity; confirm the toggle; restart Affinity if it was just changed |
| `ECONNREFUSED 127.0.0.1:6767` | Expected — wrong address family | Use `[::1]`. This is not a fault |
| `-32602 Unsupported protocol version` | Client initialized with an older MCP version | Codex: use the bridge. Others: check the harness's MCP version support |
| Config says `enabled` / `connected`, no tools | Config loaded, handshake failed | Check the startup log for the protocol error. Do not substitute a hand-written SSE client for the real test |
| `user cancelled MCP tool call` (`codex exec`) | Non-interactive approval policy; Affinity's tools publish no safety annotations | Use the interactive TUI. Not a bridge failure |
| Script runs but the layer lands inside a group | Affinity parents new layers into a topmost group | `color-boost.js` detects and corrects this — copy its approach |

On Windows, [`verify.ps1`](verify.ps1) checks everything independently of any harness, and is the
fastest way to tell a config problem from an Affinity problem. With Node.js present it performs the
real MCP handshake — `initialize` at `2025-11-25`, `tools/list`, reads the preamble, and runs one
read-only script — so it also confirms the tools work and a document is open. Without Node it falls
back to the plumbing checks (process, port, `.mcp.json`) and says so. Run it **before** starting the
session. If scripts are blocked:

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
