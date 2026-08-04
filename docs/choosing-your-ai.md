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

**Setup steps for any of the harnesses below live in [`SETUP.md`](../SETUP.md)** — this page is
about which one to pick, not how to wire it up.

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
CLI that was tested — but not individually verified in its own right. The corresponding CLI in the same row **was**
verified.*

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
| Claude Desktop — **Home** tab (chat) | Sonnet / Opus | Official **Affinity connector** — install once via Claude Desktop's own Settings → Connectors → Browse connectors → "Affinity". No project `.mcp.json`, no manual URL. | SSE, local (`[::1]:6767`), wrapped by the connector — you never see the URL | ✅ Documented by Affinity's own Help Center article, "AI Automation with Claude" |
| Claude Desktop — **Code** tab (Cowork) | Sonnet / Opus | Inherits the same official app-level connector — a brand-new session with only an empty, `.mcp.json`-free folder still reaches the Affinity MCP server, reads the preamble, and runs a script. No project `.mcp.json` required. | SSE | ✅ Confirmed |
| Claude Code (terminal / VS Code extension) | Opus / Sonnet | Needs `.mcp.json` in the project folder — no app-level connector | SSE native | ✅ Verified, documented in `SETUP.md` |
| ChatGPT app — **Chat** tab | GPT-5.x | Cloud connectors only; no Affinity connector exists and the local loopback server isn't exposed to the chat | None available | ❌ No Affinity connection possible — a missing ChatGPT connector, not an Affinity or script failure |
| ChatGPT app — **Codex** tab | GPT-5.x | Custom stdio/SSE protocol bridge in `bridge/affinity-codex-bridge.mjs`, read from `~/.codex/config.toml` | stdio bridge → SSE, translating `2025-06-18` to `2025-11-25` | ✅ Verified — connects to Affinity and runs scripts. No terminal needed — the easiest OpenAI path |
| **`codex` CLI** in a terminal | GPT-5.x | Same `~/.codex/config.toml`, same custom bridge | stdio bridge → SSE, same version translation | ✅ Verified — auto-loads the tools, reads `preamble`, runs scripts |
| Codex **IDE extension** (VS Code / Cursor / JetBrains) | GPT-5.x | Expected to inherit the same `~/.codex/config.toml` and bridge | stdio bridge → SSE | ❓ Not yet run — config inheritance is an assumption |
| Antigravity CLI / IDE (`agy`) | Gemini, plus other models Antigravity fronts — don't assume Gemini | Native SSE via `.agents/mcp_config.json` (`serverUrl` field) | SSE native | ✅ Verified — connects to Affinity, reads preamble, executes scripts |

### OpenAI — only two of the three surfaces reach Affinity

| Surface | Result |
|---|---|
| **ChatGPT Chat** | ❌ No Affinity entry exists in the plug-in directory, and a local loopback server is not exposed to chat. No tool schema reaches the model at all — a connector-availability gap, not something to fix at the config or script level |
| **ChatGPT app, Codex tab** | ✅ Reads the same `~/.codex/config.toml` as the CLI, so the bridge serves it too. The easiest OpenAI path — no terminal — but the bridge still has to be installed locally; this is not a managed connector like Claude Desktop's |
| **`codex` CLI** | ✅ Full round-trip verified: tools discovered from a fresh process, preamble read, colour-boost script executed and safely re-run |

Both working surfaces need the bridge for one reason: **Codex initializes with MCP protocol
`2025-06-18` and Affinity accepts only `2025-11-25`.** A generic `mcp-remote` establishes the SSE
transport and then passes that initialization through unchanged, so it fails with `-32602` after
appearing to connect. `bridge/affinity-codex-bridge.mjs` translates the version; see `SETUP.md`'s
Codex section for the config. Affinity identifies itself as server `Affinity` `1.0.0`.

### Claude Desktop — both tabs work through the official connector

**Source:** Affinity's Help Center (Automation → *AI Automation with Claude*) describes the
Home-tab flow — install the Affinity connector from Claude's connector directory, enable
`Edit ▸ Settings ▸ Model Context Protocol ▸ Enable MCP server` in Affinity, then verify with the
prompt *"Can you see the Affinity MCP server?"*. Requires **Affinity April '26 or later** and
**Claude Desktop**; free during the current beta. It does not use your Claude plan's monthly AI
allowance unless you also enable Canva AI Studio features in the MCP privacy settings, in which case
premium/ultra Canva AI tools draw on your Canva plan's allowance. Only Claude is supported today;
MCP isn't available in Affinity China or on mobile.

**The "Code" tab (Cowork) needs no project `.mcp.json`.** It inherits the same app-level connector
as the Home tab, which makes a project `.mcp.json` redundant there, though harmless.

---

## The whole picture, at a glance

Rough framework — every combination we know of, in one place. Status is honest: some of the grid is
unverified.

| # | Model | How you pay | CLI | Config file | Transport | Status |
|---|---|---|---|---|---|---|
| 1 | Claude (Opus / Sonnet) | Claude subscription | Claude Code | `.mcp.json` | SSE | ✅ Verified |
| 2 | deepseek-v4-flash | Prepaid credits | OpenCode | `opencode.jsonc` | SSE | ✅ Verified |
| 3 | deepseek-v4-pro | Prepaid credits | OpenCode | `opencode.jsonc` | SSE | ✅ Verified — worse than Flash |
| 4 | deepseek-v4-flash | Prepaid credits | Claude Code (redirected) | `.mcp.json` | SSE | ✅ Verified |
| 5 | `opencode/deepseek-v4-flash-free` | Free | OpenCode | `opencode.jsonc` | SSE | ✅ Verified — $0 smoke test |
| 6 | GPT-5.x | ChatGPT subscription | Codex CLI | `~/.codex/config.toml` | custom stdio bridge | ✅ Verified |
| 7 | GPT-5.x | OpenAI API key | Codex CLI | `~/.codex/config.toml` | stdio bridge | ✅ Same local transport verified; API-key authentication itself not separately tested |
| 8 | GPT-5.x | OpenAI API key | OpenCode | `opencode.jsonc` | SSE | ❓ Untested — should just work |
| 9 | Gemini | Google subscription | Antigravity | `.agents/mcp_config.json` | SSE | ✅ Connection and script execution verified — which model actually served the run wasn't recorded, so "Gemini" is a label rather than a confirmed fact |
| 10 | Antigravity's other models | Via Antigravity | Antigravity | `.agents/mcp_config.json` | SSE | ⚠️ At least one non-Gemini model completed setup correctly but could not call the MCP tools it had been given. Harness fine, model unable to drive MCP — pick a model in Antigravity deliberately (`agy models`) rather than taking the default |
| 11 | Gemini | Google API key | Gemini CLI | `~/.gemini/settings.json` | ❓ | ❓ Not looked at yet |
| 12 | Any local model | Free | Ollama / LM Studio | — | none | ❌ No MCP client — not viable |

### Settled — Affinity is SSE-only, there is no Streamable HTTP endpoint

Probed exhaustively: a JSON-RPC `initialize` POST against `/mcp`, `/`, `/message`, `/streamable`,
`/http` and `/sse` — every path but `/sse` returned `404`. `mcp-remote` reaches the same conclusion
independently: it attempts Streamable HTTP first, takes the 404, and falls back to SSE.

Consequence: rows 6–7 keep a bridge **permanently**. There is no one-line `url = …` form to collapse
to.

### Open questions

- **Row 8** — OpenCode + an OpenAI key is the path of least resistance for ChatGPT owners, but
  nobody has run it here yet.
- **Row 11** — Gemini CLI's config shape and transport are unconfirmed; the row is a placeholder.
- **Rows 9–10** — the **harness** is settled: Antigravity connects over native SSE, loads the
  preamble, and executes scripts. What is *not* settled is the **model** — a run needs to both name
  its model and successfully execute a script before either row moves.

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
| **GPT-5.x / GPT-5.x-Codex** (ChatGPT subscription or OpenAI API key) | Codex CLI, OpenCode | Automatic loading, SDK reads, script execution and a generated two-layer variant are all verified |
| **Gemini** | Antigravity, Gemini CLI | Config shape verified and a live round-trip passed through Antigravity. SDK accuracy not measured — the run's model wasn't recorded, and an Antigravity session is not necessarily Gemini |
| **Antigravity's other models** | Antigravity | At least one non-Gemini model is a poor pick for this work: it set the connection up correctly and then could not call the MCP tools it had been given, so no script ever ran and SDK accuracy could not be measured. Choose a model in Antigravity with `agy models` rather than taking the default |

#### On the OpenAI side specifically

OpenAI's coding models sit behind two different doors, and it matters which one you have:

- **ChatGPT Plus / Pro subscription** — sign into Codex CLI with your ChatGPT account. No API key,
  no per-token billing; you get the Codex model tiers included in your plan.
- **OpenAI API key** — pay per token, billed separately from ChatGPT. Works with Codex CLI and with
  third-party harnesses like OpenCode.

Model names on this side churn fast. **Don't trust any list, including this one, to still be
current.** Run `/model` inside Codex CLI — it shows exactly what your install and your plan can
actually reach today. As a rule of thumb: the mid tier is the right default for Affinity scripting,
and the cheap/small tier is fine for simple one-adjustment scripts.

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
  review and fix the specific API calls.

This isn't really a model weakness — the Affinity SDK is new and thinly represented in training
data. The fix is context, not a bigger model: have the agent read the SDK preamble each session,
and record discoveries with `add_sdk_hint` so the next session inherits them.

---

## Step 2 — Which CLI

Any CLI here can drive any model it has access to. What differs is the MCP config file, the
transport it speaks, and how much of it is proven.

| CLI | Models it reaches | Where MCP config goes | Transport | Status |
|---|---|---|---|---|
| **Claude Code** | Claude; anything on an Anthropic-compatible endpoint (DeepSeek) | `.mcp.json` in the project | SSE native | ✅ Proven, extensively |
| **OpenCode** | Almost anything — Claude, GPT, DeepSeek, Gemini, local | `~/.config/opencode/opencode.jsonc` | SSE native (`remote`) | ✅ Full round-trip passed |
| **Codex CLI / desktop environment** | GPT-5.x via ChatGPT login or OpenAI API key | `~/.codex/config.toml` | custom stdio bridge → SSE | ✅ Automatically discovers the tools, reads `preamble`, runs scripts |
| **Antigravity** (`agy`) | Gemini, plus its other models | `.agents/mcp_config.json` | SSE (`serverUrl` field) | ✅ Verified — live round-trip and script execution passed |

### The Codex caveat, in full

Codex CLI's `config.toml` accepts exactly two kinds of MCP server: a **stdio** server (`command` +
`args`) or a **Streamable HTTP** server (`url`). SSE isn't in the list. So dropping Affinity's
`/sse` URL straight into `url = …` doesn't work — the client tries to speak Streamable HTTP to an
SSE endpoint.

The workaround is the repository's **custom stdio bridge** — see `SETUP.md`'s Codex section for the
config. A generic `mcp-remote` subprocess is not enough, because Codex requests MCP `2025-06-18`
while Affinity accepts only `2025-11-25`; the custom bridge translates that in addition to the
stdio-to-SSE transport.

If you only have a ChatGPT subscription and no interest in installing a bridge, the cleaner path is
**OpenCode with an OpenAI API key** — native SSE, no bridge, same models.

### Recommended combinations

| If you want… | Use |
|---|---|
| **The most reliable setup** | Claude Code + Claude |
| **The cheapest verified setup** | OpenCode + `deepseek-v4-flash` |
| **Cheap, on the proven connection** | Claude Code + DeepSeek, via the redirect below |
| **Zero-cost smoke test** | OpenCode + `opencode/deepseek-v4-flash-free` — works with no API key at all |
| **You already pay for ChatGPT** | The ChatGPT app's **Codex** tab + the custom bridge — no terminal needed. Same capability in a terminal via the `codex` CLI. (`Chat` cannot reach Affinity at all.) |

That third row is a useful trick: DeepSeek publishes an **Anthropic-API-compatible endpoint**, so
Claude Code can be pointed at DeepSeek instead of Anthropic. The harness, the MCP connection, and
every config file stay exactly as they were — only the model changes.

**Use a separate terminal window for the redirect** — the environment variables involved redirect
*all* traffic, including auth and billing, away from Anthropic:

```powershell
$env:ANTHROPIC_BASE_URL  = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "<your DeepSeek API key>"
$env:ANTHROPIC_MODEL      = "deepseek-v4-flash"
claude
```

Claude Code's web-search tool triggers extra LLM calls under the hood, which costs extra tokens
against your DeepSeek balance when running this way.

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
