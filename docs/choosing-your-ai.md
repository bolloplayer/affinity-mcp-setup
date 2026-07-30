# Choosing your AI setup for Affinity

Affinity v3 ships a built-in MCP server, which means an AI agent can write and run real scripts
inside the app. To get there you need to make three decisions, in this order:

1. **Which model** writes the scripts
2. **Which CLI** (harness) connects that model to Affinity
3. **How to wire it up** so it stays connected

Two facts to get straight before step 1, because they save a lot of confusion:

> **MCP support is a property of the harness, not the model.** No model has an "MCP client" in its
> weights. The CLI app connects to Affinity, translates its tool schemas into whatever
> function-calling format the model speaks, and drives the call → result → continue loop. Any model
> that can do tool calling will work — *if* the CLI in front of it speaks MCP.

> **Affinity speaks SSE, and not every CLI does.** The endpoint is `http://[::1]:6767/sse` —
> Server-Sent Events, the older of the two remote MCP transports. Most CLIs support it; some newer
> ones (Codex) only speak stdio and Streamable HTTP and need a bridge. This is the single most
> likely reason a given CLI won't connect.

So the model is largely a free choice, and the CLI is the real constraint. Pick the model you want,
then check it's reachable from a CLI in step 2.

## Quick view — by app

<br>

### Three-Surface Ecosystem Comparison Table

<br>

| Ecosystem | 1. Home / Chat Surface | 2. Code / Codex Surface | 3. CLI / Terminal Harness | Local MCP Config / Connection |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** (Anthropic) | ✅ **Claude Desktop (Home tab)** | ✅ **Claude Desktop (Code / Cowork)** | ✅ **`claude` CLI** (Claude Code) | Official connector or `.mcp.json` |
| | | | | |
| **GPT** (OpenAI) | ❌ **ChatGPT App (Chat tab)** / Web | ✅ **ChatGPT App (Codex tab)** | ✅ **`codex` CLI** | `~/.codex/config.toml` & custom stdio bridge |
| | | | | |
| **Gemini** (Google) | ❌ **Gemini Web** (`gemini.google.com`) | ✅\* **Antigravity 2.0 / IDE** | ✅ **`agy` CLI** (Antigravity) | `.agents/mcp_config.json` (`serverUrl` field) |
| | | | | |
| | | | | |
| ⎯⎯⎯ *Not a vendor ecosystem — a multi-model harness that can drive any of the models above* ⎯⎯⎯ | | | | |
| | | | | |
| **OpenCode** (Multi-model) | — *(N/A — Local harness)* | ✅\* **OpenCode Desktop App** | ✅ **`opencode` CLI / TUI** | Native SSE (`opencode.jsonc` or CLI) |

<br>

*(Note: Standard web browser chat interfaces like `gemini.google.com` or `chatgpt.com` cannot reach local Windows loopback sockets like `[::1]:6767`; local MCP requires a supported desktop app or CLI harness.)*

*\* Expected to work by config inheritance — the desktop/IDE surface reads the same config file as the
CLI that was tested — but not individually tested. The corresponding CLI in the same row **was**
tested.*

<br>

---

<br>

### Detailed view by surface

Same information, organised by which app you're actually typing into, not by CLI/model. Note that a
single desktop app can hold **more than one** case: Claude Desktop's "Home" and "Code" tabs connect
to Affinity differently, and so do the ChatGPT app's "Chat" and "Codex" surfaces — only one of which
reaches Affinity at all.

| App | Model | MCP | Transport | Status |
|---|---|---|---|---|
| Claude Desktop — **Home** tab (chat) | Sonnet / Opus | Official **Affinity connector** — install once via Claude Desktop's own Settings → Connectors → Browse connectors → "Affinity". No project `.mcp.json`, no manual URL. | SSE, local (`[::1]:6767`), wrapped by the connector — you never see the URL | ✅ Confirmed — Affinity's own Help Center article, "AI Automation with Claude" |
| Claude Desktop — **Code** tab (Cowork) | Sonnet / Opus | Inherits the same official app-level connector — **confirmed** by a clean test: a brand-new session started with only an empty, `.mcp.json`-free folder connected still reached the Affinity MCP server, read the preamble, and ran a script successfully. No project `.mcp.json` required. | SSE | ✅ Confirmed by direct test (this project, empty `empty-mcp-test/` folder) |
| Claude Code (terminal / VS Code extension) | Opus / Sonnet | Needs `.mcp.json` in the project folder — no app-level connector | SSE native | ✅ Tested, documented below |
| ChatGPT app — **Chat** tab | GPT-5.x / GPT-5.6 | Cloud connectors only; no Affinity connector was available and the local loopback server was not exposed to the chat | None available | ❌ Tested 28 July 2026 — no Affinity connection, tool schemas, preamble or script execution. This is a missing ChatGPT connector, not an Affinity or script failure |
| ChatGPT app — **Codex** tab | GPT-5.x / GPT-5.6 | Custom stdio/SSE protocol bridge in `bridge/affinity-codex-bridge.mjs`, read from `~/.codex/config.toml` | stdio bridge → SSE, translating `2025-06-18` to `2025-11-25` | ✅ Tested 29 July 2026 — connects to Affinity and runs scripts. **No terminal needed** — this is the easiest OpenAI path |
| **`codex` CLI** in a terminal | GPT-5.x / GPT-5.6 | Same `~/.codex/config.toml`, same custom bridge | stdio bridge → SSE, same version translation | ✅ Fresh `codex exec` auto-loaded the tools, read `preamble`, ran a read-only script. Verified independently on npm CLI `0.145.0`, 29 July 2026 |
| Codex **IDE extension** (VS Code / Cursor / JetBrains) | GPT-5.x / GPT-5.6 | Expected to inherit the same `~/.codex/config.toml` and bridge | stdio bridge → SSE | ❓ Never run — config inheritance is an assumption, not a test |
| Antigravity CLI / IDE (`agy`) | Gemini, plus the other models Antigravity fronts | Native SSE via `.agents/mcp_config.json` (`serverUrl` field) | SSE native | ✅ Verified 29 July 2026 — connects to Affinity, reads preamble, executes scripts. The run's model was not recorded, so this proves the harness |

### OpenAI — only two of the three surfaces reach Affinity

| Surface | Result |
|---|---|
| **ChatGPT Chat** | ❌ Tested 28 July 2026. No Affinity entry exists in the plug-in directory, and a local loopback server is not exposed to chat. No tool schema reaches the model at all — a connector-availability gap, so there is nothing to fix at the config or script level |
| **ChatGPT app, Codex tab** | ✅ Tested 29 July 2026. Reads the same `~/.codex/config.toml` as the CLI, so the bridge serves it too. The easiest OpenAI path — no terminal — but the bridge still has to be installed locally; this is not a managed connector like Claude Desktop's |
| **`codex` CLI** | ✅ Tested 29 July 2026 on npm CLI `0.145.0` and packaged `0.146.0-alpha.3.1`. Full round-trip: 11 tools discovered from a fresh process, preamble read, `examples/color-boost.js` executed, and a generated two-layer variant executed and re-run safely |

Both working surfaces need the bridge for one reason: **Codex initializes with MCP protocol
`2025-06-18` and Affinity accepts only `2025-11-25`.** A generic `mcp-remote` establishes the SSE
transport and then passes that initialization through unchanged, so it fails with `-32602` after
appearing to connect. `bridge/affinity-codex-bridge.mjs` translates the version; see
"Codex on Windows" below for the config. Affinity identifies itself as server `Affinity` `1.0.0`.

### Claude Desktop — both tabs work through the official connector

**Source, confirmed:** Affinity's Help Center (Automation → *AI Automation with Claude*) describes
the Home-tab flow — install the Affinity connector from Claude's connector directory, enable
`Edit ▸ Settings ▸ Model Context Protocol ▸ Enable MCP server` in Affinity, then verify with the
prompt *"Can you see the Affinity MCP server?"*. Requires **Affinity April '26 or later** and
**Claude Desktop**; free during the current beta. It does not use your Claude plan's monthly AI
allowance unless you also enable Canva AI Studio features in the MCP privacy settings, in which case
premium/ultra Canva AI tools draw on your Canva plan's allowance. Only Claude is supported today;
MCP isn't available in Affinity China or on mobile.

**The "Code" tab (Cowork) needs no project `.mcp.json`** — settled by a clean test: a brand-new
session started with only an empty, `.mcp.json`-free folder connected from the first message reached
Affinity immediately, loaded the preamble and ran a script. It inherits the same app-level connector
as the Home tab, which makes a project `.mcp.json` redundant there, though harmless. (Testing this
mid-session proves nothing — a session already connected to the folder holding `.mcp.json` keeps that
connection when you mount a second empty folder.)

---

## The whole picture, at a glance

Rough framework — every combination we know of, in one place. Status is honest: most of the grid is
unverified, and the endpoint details for the untested rows still need checking.

| # | Model | How you pay | CLI | Config file | Transport | Status |
|---|---|---|---|---|---|---|
| 1 | Claude (Opus / Sonnet) | Claude subscription | Claude Code | `.mcp.json` | SSE | ✅ Verified |
| 2 | deepseek-v4-flash | Prepaid credits | OpenCode | `opencode.jsonc` | SSE | ✅ Verified |
| 3 | deepseek-v4-pro | Prepaid credits | OpenCode | `opencode.jsonc` | SSE | ✅ Verified — worse than Flash |
| 4 | deepseek-v4-flash | Prepaid credits | Claude Code (redirected) | `.mcp.json` | SSE | ✅ Verified |
| 5 | `opencode/deepseek-v4-flash-free` | Free | OpenCode | `opencode.jsonc` | SSE | ✅ Verified — $0 smoke test |
| 6 | GPT-5.x | ChatGPT subscription | Codex CLI | `~/.codex/config.toml` | custom stdio bridge | ✅ Fresh CLI auto-loaded tools, read `preamble`, and ran a read-only script |
| 7 | GPT-5.x | OpenAI API key | Codex CLI | `~/.codex/config.toml` | stdio bridge | ✅ Same local transport verified; API-key authentication itself not tested |
| 8 | GPT-5.x | OpenAI API key | OpenCode | `opencode.jsonc` | SSE | ❓ Untested — should just work |
| 9 | Gemini | Google subscription | Antigravity | `.agents/mcp_config.json` | SSE | ✅ Connection and script execution verified (29 July 2026) — which model served the run was not recorded |
| 10 | Antigravity's other models | Via Antigravity | Antigravity | `.agents/mcp_config.json` | SSE | ❓ Inferred — the harness is proven, but no run is attributable to a specific alternative model |
| 11 | Gemini | Google API key | Gemini CLI | `~/.gemini/settings.json` | ❓ | ❓ Not looked at yet |
| 12 | Any local model | Free | Ollama / LM Studio | — | none | ❌ No MCP client — not viable |

### Settled — Affinity is SSE-only, there is no Streamable HTTP endpoint

This was previously listed as the highest-value open question. It is now answered: **no.** Probed on
28 July 2026 with a JSON-RPC `initialize` POST against `/mcp`, `/`, `/message`, `/streamable`,
`/http` and `/sse` — every path returned `404`. Only `/message` responded at all, with
`{"error":"Session not found"}`, confirming it is the SSE session's POST channel rather than a
standalone transport. `mcp-remote` reaches the same conclusion independently: it attempts Streamable
HTTP first, takes the 404, and falls back to SSE.

Consequence: rows 6–7 keep a bridge **permanently**. There is no one-line `url = …` form to collapse
to, and any future guide claiming otherwise is wrong.

### Open questions to settle later

- **Row 8** — OpenCode + an OpenAI key is the path of least resistance for ChatGPT owners, but
  nobody has run it here.
- **Row 11** — Gemini CLI's config shape and transport are unconfirmed; the row is a placeholder.
- **Rows 9–10** — the **harness** is settled: on 29 July 2026 Antigravity connected over native SSE,
  loaded the preamble, ran the inspection script and executed a generated two-layer script against
  Affinity. What is *not* settled is the **model**: the run did not record which of Antigravity's
  models served it, and one run cannot verify two rows. Treat row 9 as the proven path and row 10 as
  inferred from the shared harness until someone notes the model while testing.

---

## Step 1 — Which model

### Tested here

| Model | Cost | SDK accuracy | Verdict |
|---|---|---|---|
| **Claude** (Opus / Sonnet) | Claude subscription | Best — this project's whole SDK knowledge base was built with it | The baseline. Best choice for complex, exploratory work |
| **deepseek-v4-flash** | $0.14/M in, $0.28/M out | **Zero SDK hallucinations** on the script we tested | **Best value.** Recommended if you'd rather pay per token than subscribe |
| **deepseek-v4-pro** | $0.435/M in, $0.87/M out | 3–4 hallucinated SDK calls per complex script | Not worth the 3× premium for this work — Flash was cheaper *and* more accurate |

That Flash-beats-Pro result is worth pausing on: on identical-complexity tasks, the cheap model
produced cleaner SDK code than the expensive one. Don't assume the flagship is the right pick here.

### Additional model notes

| Model | Reach it via | Status |
|---|---|---|
| **GPT-5.x / GPT-5.x-Codex** (ChatGPT subscription or OpenAI API key) | Codex CLI, OpenCode | Fresh Codex CLI automatic loading, SDK reads, read-only execution, and the generated two-layer Selective Colour variant are verified |
| **Gemini** | Antigravity, Gemini CLI | Config shape verified and a live round-trip passed through Antigravity (29 July 2026). SDK accuracy not measured — the run's model was not recorded |
| **Antigravity's other models** | Antigravity | The harness is proven, so they should work; no run is attributable to one specifically |

#### On the OpenAI side specifically

OpenAI's coding models sit behind two different doors, and it matters which one you have:

- **ChatGPT Plus / Pro subscription** — sign into Codex CLI with your ChatGPT account. No API key,
  no per-token billing; you get the Codex model tiers included in your plan.
- **OpenAI API key** — pay per token, billed separately from ChatGPT. Works with Codex CLI and with
  third-party harnesses like OpenCode.

Model names on this side churn fast (GPT-5.5 in spring 2026, the GPT-5.6 *sol / terra / luna* tiers
from July 2026, plus `-Codex`, `-Max`, `-Mini` and `-Spark` variants). **Don't trust any list,
including this one, to still be current.** Run `/model` inside Codex CLI — it shows exactly what
your install and your plan can actually reach today. As a rule of thumb: the mid tier is the right
default for Affinity scripting, and the cheap/small tier is fine for simple one-adjustment scripts.

### Not viable as "the model"

Raw **Ollama**, **LM Studio**, or a bare model API. These serve models; they have no agent harness
and nothing that speaks MCP. Using them means hand-writing a bridge between the model API and the
MCP protocol — a real project in itself, and unnecessary given the options below.

### The one pattern that holds across every model

**All of them get the architecture right and the API calls wrong.** Every model tested knew *what*
to build — which adjustment layers, how to structure the loop, where the mask goes — and then
invented plausible-sounding SDK method names, missed that a parameter is silently clamped, or
treated a read-only property as a setter.

Practical consequence:

- **Simple scripts** (one adjustment layer, set some parameters, set opacity/blend mode) —
  production-ready from any of these models, first try.
- **Complex scripts** (pixel buffers, render engine, file I/O, history manipulation) — expect to
  review and fix the specific API calls. Our complex test needed four fixes before it ran correctly.
  Treat it like a capable junior dev: sound instincts, shaky API recall.

This isn't really a model weakness — the Affinity SDK is new and thinly represented in training
data. The fix is context, not a bigger model: have the agent read the SDK preamble each session
(step 3), and record discoveries with `add_sdk_hint` so the next session inherits them.

---

## Step 2 — Which CLI

Any CLI here can drive any model it has access to. What differs is the MCP config file, the
transport it speaks, and how much of it is proven.

| CLI | Models it reaches | Where MCP config goes | Transport | Status |
|---|---|---|---|---|
| **Claude Code** | Claude; anything on an Anthropic-compatible endpoint (DeepSeek) | `.mcp.json` in the project | SSE native | ✅ Proven, extensively |
| **OpenCode** | Almost anything — Claude, GPT, DeepSeek, Gemini, local | `~/.config/opencode/opencode.jsonc` | SSE native (`remote`) | ✅ Full round-trip passed |
| **Codex CLI / desktop environment** | GPT-5.x via ChatGPT login or OpenAI API key | `~/.codex/config.toml` | custom stdio bridge → SSE | ✅ Fresh CLI automatically discovered the tools, read `preamble`, and ran a read-only Affinity script |
| **Antigravity** (`agy`) | Gemini, plus its other models | `.agents/mcp_config.json` | SSE (`serverUrl` field) | ✅ Verified 29 July 2026 — live round-trip and script execution passed |

### The Codex caveat, in full

Codex CLI's `config.toml` accepts exactly two kinds of MCP server: a **stdio** server (`command` +
`args`) or a **Streamable HTTP** server (`url`). SSE isn't in the list. So dropping Affinity's
`/sse` URL straight into `url = …` is not expected to work — the client will try to speak Streamable
HTTP to an SSE endpoint.

The workaround is the repository's **custom stdio bridge**. A generic `mcp-remote` subprocess is
not enough: Codex `0.145.0` and `0.146.0-alpha.3.1` request MCP `2025-06-18`, while Affinity accepts
only `2025-11-25`. The custom bridge performs that initialization translation in addition to the
stdio-to-SSE transport. It rewrites only `initialize`; subsequent JSON-RPC messages pass through
unchanged. This is the one place in the project where Node.js is required.

If you only have a ChatGPT subscription and no interest in installing a bridge, the cleaner path is
**OpenCode with an OpenAI API key** — native SSE, no bridge, same models.

### Recommended combinations

| If you want… | Use |
|---|---|
| **The most reliable setup** | Claude Code + Claude |
| **The cheapest verified setup** | OpenCode + `deepseek-v4-flash` |
| **Cheap, on the proven connection** | Claude Code + DeepSeek, via the redirect in step 3 |
| **Zero-cost smoke test** | OpenCode + `opencode/deepseek-v4-flash-free` — works with no API key at all |
| **You already pay for ChatGPT** | The ChatGPT app's **Codex** tab + the custom bridge — no terminal needed. Same capability in a terminal via the `codex` CLI. (`Chat` cannot reach Affinity at all.) |

That third row is a useful trick: DeepSeek publishes an **Anthropic-API-compatible endpoint**, so
Claude Code can be pointed at DeepSeek instead of Anthropic. The harness, the MCP connection, and
every config file stay exactly as they were — only the model changes. It's the cleanest way to swap
models without re-learning a new CLI's config format.

---

## Step 3 — Setup, short

### Prerequisites (both required, every time)

1. **Affinity is running.** Its MCP server only listens while the app is open. Launch Affinity
   *before* the CLI.
2. **The MCP toggle is on:** `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`.

The endpoint is always:

```
http://[::1]:6767/sse
```

### Minimal config, per CLI

**Claude Code** — `.mcp.json` in your project folder:

```json
{
  "mcpServers": {
    "affinity": { "type": "sse", "url": "http://[::1]:6767/sse" }
  }
}
```

**OpenCode** — one command, no file editing:

```
opencode mcp add affinity --url "http://[::1]:6767/sse"
opencode mcp list          # should report: connected
```

**Codex CLI / desktop environment** — sign in first (`codex login` for ChatGPT accounts, or set
`OPENAI_API_KEY`), then add the bridge to `~/.codex/config.toml`. On Windows, `~` means the current
user profile, so the normal path is `%USERPROFILE%\.codex\config.toml`:

```toml
[mcp_servers.affinity]
command = "node.exe"
args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
```

Check it with `codex mcp list`, then fully restart Codex or open a fresh task so the configuration is
loaded. An `enabled` row confirms only that Codex loaded the configuration; successful tool
discovery proves the handshake. Pick your model with `/model` inside the CLI. The custom bridge can
be removed only when Codex and Affinity support a common protocol version and compatible transport.

**Antigravity** — `.agents/mcp_config.json` (mind the `serverUrl` field, not `url`):

```json
{
  "mcpServers": {
    "affinity": { "serverUrl": "http://[::1]:6767/sse" }
  }
}
```

### Codex on Windows — start-to-finish setup

A Codex project does **not** use Claude's `.mcp.json`. Configure the bridge once for the Windows user:

1. Launch Affinity and enable
   `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`.
2. Install the current Node.js LTS release, then verify `node --version` in a new terminal.
3. Sign in with `codex login` for a ChatGPT subscription, or configure `OPENAI_API_KEY` for API
   billing. Model authentication is separate from the local Affinity connection.
4. Open or create `%USERPROFILE%\.codex\config.toml`, preserving unrelated settings, and add:

   ```toml
   [mcp_servers.affinity]
   command = "node.exe"
   args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
   ```

5. Check the saved entry with `codex mcp list`.
6. Keep Affinity open and start a genuinely fresh `codex` process or Codex task.
7. Ask Codex to confirm that the Affinity tools were loaded automatically, read `preamble`, and run
   a read-only document inspection before any editing script.

Do not configure Affinity as `url = "http://[::1]:6767/sse"` in Codex: that field expects
Streamable HTTP, while Affinity exposes legacy SSE. The local stdio bridge performs the conversion.

To prove the whole chain from outside Codex — initialize through the bridge, list the real tools,
read the preamble, touch nothing — run `node .\bridge\smoke-test.mjs`.

#### Codex troubleshooting

- **`mcp-remote` reports `-32602 Unsupported protocol version`:** it does not translate Codex's
  `2025-06-18` initialization. Use `bridge/affinity-codex-bridge.mjs`.
- **Connection tries `127.0.0.1`:** use the IPv6 loopback URL `http://[::1]:6767/sse`.
- **Nothing listens on port 6767:** start Affinity, enable MCP, and restart Affinity if the toggle
  was just changed.
- **`codex mcp list` says `enabled`, but no tools appear:** `enabled` describes configuration state,
  not handshake success. Check the startup log for a protocol error.
- **`codex exec` says `user cancelled MCP tool call`:** its non-interactive approval policy blocked
  the call. Use the interactive TUI for normal work; this message does not mean the bridge failed.
- **Tools disappear after an Affinity restart:** start a fresh task or reconnect the MCP server.
- **Affinity tools are missing in a fresh CLI:** record the exact startup/protocol error. Do not
  substitute a hand-written SSE client — it proves nothing about the config, which is the thing being
  tested.

### Antigravity (`agy`) on Windows — start-to-finish setup

Antigravity uses native SSE transport to connect directly to Affinity Photo without needing a protocol translation bridge.

#### Configuration File

Place `.agents/mcp_config.json` in your project root workspace:

```json
{
  "mcpServers": {
    "affinity": {
      "serverUrl": "http://[::1]:6767/sse"
    }
  }
}
```

> **Important Note on Field Name:** Antigravity requires the JSON key to be **`serverUrl`** (not `url`). Using `url` will prevent Antigravity from establishing the SSE connection.

#### Step-by-Step Connection & Execution Guide

1. **Enable MCP in Affinity:** Open Affinity Photo and navigate to `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`.
2. **Create Project Config:** Create `.agents/mcp_config.json` in your workspace directory with the `"serverUrl": "http://[::1]:6767/sse"` configuration above.
3. **Verify Environment & Network Plumbing:** Run `verify.ps1` from PowerShell to confirm Affinity is running, port 6767 is listening on IPv6 loopback (`[::1]`), and the SSE handshake returns HTTP 200:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
   ```
4. **Start Antigravity:** Launch `agy` or start an Antigravity agentic session. Antigravity automatically parses `.agents/mcp_config.json` and connects to the Affinity MCP server.
5. **Read the SDK Preamble First:** Before executing any script in Affinity, call `read_sdk_documentation_topic` with `{ filename: "preamble" }`. Affinity's MCP server enforces that the preamble documentation topic must be read prior to accepting `execute_script` calls.
6. **Execute JavaScript Scripts:** Run scripts via the `execute_script` tool (e.g., `examples/inspect-document.js` or `examples/test-color-boost.js`).

#### What the 29 July 2026 run showed

Run live from this repository through `agy`. The model that served it was not recorded, so read this
as the **harness** being proven, not any particular model:

* **Connection & handshake:** native SSE to `http://[::1]:6767/sse`, no bridge.
* **Tool discovery:** all 11 Affinity tools loaded automatically from the config file.
* **SDK preamble:** read successfully.
* **Script execution:** ran document inspection, then a generated two-layer Selective Colour script
  that created its adjustment layers live in Affinity.

Everything past the connection — whether a restart is needed, which file carries a resume note across
one — is **best guess** rather than tested, extrapolated from the Claude Code and Codex paths. SETUP.md's
Antigravity section marks each guess in place and says what to record when a live run settles it.


### Tips that save the most pain

**Put the connection in the config file — never let the agent write connection code.** The most
common failure we've seen reported is someone asking their CLI to "connect to Affinity," getting
working ad-hoc code, and then having to redo it every session. A config-file entry is read at
startup, every time, forever. If you're reconnecting manually each session, you skipped this step.

**Use `[::1]`, not `127.0.0.1`.** Affinity binds an IPv6 loopback socket. `[::1]` always works;
`localhost` usually resolves correctly on current builds but depends on your resolver's
IPv4/IPv6 preference; `127.0.0.1` will refuse the connection outright. An `ECONNREFUSED` on an IPv4
address is expected behaviour, not a broken install.

**Have the agent read the SDK preamble before its first script.** In Claude Code that's
`read_sdk_documentation_topic` with `filename: "preamble"`. The server expects it, and the response
carries accumulated SDK hints — this is the single biggest lever on how much hallucinated API code
you'll have to fix.

**When tools vanish mid-session, reconnect before restarting.** A resumed chat or an Affinity
restart detaches the SSE stream while leaving everything else healthy. In Claude Code: `/mcp` →
reconnect `affinity`. Restarting the whole CLI is rarely necessary.

**You don't need Node.js** — with one exception. Nothing in the integration itself uses it. The only
things that do are `verify.ps1`'s optional handshake probe and the Codex custom bridge above.
If a troubleshooting guide tells you to install Node to fix a *connection* problem on Claude Code or
OpenCode, it's wrong.

**If you redirect Claude Code to DeepSeek, use a separate terminal window.** The environment
variables that do this redirect *all* traffic — including auth and billing — away from Anthropic.
Set them in a throwaway shell, not your normal profile:

```powershell
$env:ANTHROPIC_BASE_URL  = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "<your DeepSeek API key>"
$env:ANTHROPIC_MODEL      = "deepseek-v4-flash"
claude
```

Also note: Claude Code's web-search tool triggers extra LLM calls under the hood, which costs extra
tokens against your DeepSeek balance when running this way.

---

## What it costs

Rough shape, so you can budget:

- **Claude subscription** — flat monthly, no per-script thinking required. Best if you're iterating
  heavily.
- **ChatGPT Plus / Pro** — flat monthly, and Codex CLI is included in it. Same shape as above if
  you're already paying for it; not worth subscribing to *just* for this.
- **OpenAI API key** — pay per token, meaningfully pricier than DeepSeek for the same work.
- **DeepSeek prepaid credits** — no subscription, no monthly fee, pay per token. A few dollars goes
  a long way at Flash's rates; a whole session of script writing and testing is cents, not dollars.
- **OpenCode free tier** — genuinely $0 for a smoke test, no credentials.

For per-token setups, the models above are cheap enough that the real cost of this workflow is your
time reviewing hallucinated SDK calls — which is why the accuracy column in step 1 matters more than
the price column.
