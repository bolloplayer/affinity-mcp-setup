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
| **Gemini** (Google) | ❌ **Gemini Web** (`gemini.google.com`) | ✅\* **Antigravity 2.0 / IDE** | ✅ **`agy` CLI** (Antigravity) | `~/.gemini/config/mcp_config.json` — global (`serverUrl` field) |
| | | | | |
| **DeepSeek** | ❌ **DeepSeek Web** (`chat.deepseek.com`) | ✅ **Claude Code in VS Code**, redirected | ✅ **`claude` CLI**, redirected | `.mcp.json` — same as Claude, plus env-var redirect † |
| | | | | |

<br>

*(Note: Standard web browser chat interfaces like `gemini.google.com` or `chatgpt.com` cannot reach local Windows loopback sockets like `[::1]:6767`; local MCP requires a supported desktop app or CLI harness.)*

*\* Expected to work by config inheritance — the desktop/IDE surface reads the same config file as the
CLI that was tested — but not individually verified in its own right. The corresponding CLI in the same row **was**
verified.*

*† **DeepSeek has no harness of its own — it borrows Claude's.** DeepSeek publishes an
Anthropic-API-compatible endpoint, so Claude Code can be pointed at it with a handful of environment
variables. The MCP connection, `.mcp.json` and every script stay exactly as they are; only the model
answering changes. **[Setting up DeepSeek in Claude Code — step-by-step guide](deepseek.html)**
covers the environment variables, the separate-terminal warning and how to check the swap worked.
Both `deepseek-v4-flash` and `deepseek-v4-pro` are verified end-to-end. You do **not** need a Claude
subscription: Claude Code runs on a DeepSeek key alone.*

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
| Claude Desktop — **Code** tab (Cowork) | Sonnet / Opus | Inherits the same official app-level connector. No project `.mcp.json` required. | SSE | ✅ Confirmed |
| Claude Code (terminal / VS Code extension) | Opus / Sonnet | Needs `.mcp.json` in the project folder — no app-level connector | SSE native | ✅ Verified, documented in `SETUP.md` |
| ChatGPT app — **Chat** tab | GPT-5.x | Cloud connectors only; no Affinity connector exists and the local loopback server isn't exposed to the chat | None available | ❌ No Affinity connection possible — a missing ChatGPT connector, not an Affinity or script failure |
| ChatGPT app — **Codex** tab | GPT-5.x | Custom stdio/SSE protocol bridge in `bridge/affinity-codex-bridge.mjs`, read from `~/.codex/config.toml` | stdio bridge → SSE, translating `2025-06-18` to `2025-11-25` | ✅ Verified — no terminal needed, the easiest OpenAI path |
| **`codex` CLI** in a terminal | GPT-5.x | Same `~/.codex/config.toml`, same custom bridge | stdio bridge → SSE, same version translation | ✅ Verified |
| Codex **IDE extension** (VS Code / Cursor / JetBrains) | GPT-5.x | Expected to inherit the same `~/.codex/config.toml` and bridge | stdio bridge → SSE | ❓ Not yet run — config inheritance is an assumption |
| Antigravity CLI / IDE (`agy`) | Gemini, plus other models Antigravity fronts — don't assume Gemini | Native SSE via `~/.gemini/config/mcp_config.json` — **global**, `serverUrl` field | SSE native | ✅ Verified |

### What actually matters per harness

Three findings each — the ones that decide whether your setup works.

**Claude Code / Claude Desktop**

1. Claude Desktop needs no config at all: install the **Affinity connector** from its connector
   directory (Settings → Connectors → Browse). Both the Home and Code tabs inherit it, so a project
   `.mcp.json` is redundant there. Requires Affinity April '26 or later.
2. Claude Code (terminal / VS Code) is the opposite — it has no app-level connector and **needs a
   `.mcp.json` in the project folder**.
3. That file is read **at startup only**, so writing it mid-session registers nothing. Expect one
   restart; it isn't a failure.

**Codex (CLI and the ChatGPT app's Codex tab)**

1. **The Chat tab cannot reach Affinity at all** — no Affinity connector exists, and a local
   loopback server isn't exposed to chat. Nothing to fix at the config level; use the Codex tab.
2. `config.toml` accepts only **stdio** or **Streamable HTTP** servers. SSE isn't in the list, so
   Affinity's `/sse` URL dropped into `url = …` will not work.
3. A generic `mcp-remote` is not enough either: **Codex initializes with MCP protocol `2025-06-18`
   and Affinity accepts only `2025-11-25`**, so it fails with `-32602` *after* appearing to connect.
   `bridge/affinity-codex-bridge.mjs` translates both the transport and the version.

**Antigravity (`agy`)**

1. **The config is global, not per-workspace** — `~/.gemini/config/mcp_config.json`. A workspace
   file is silently never read, so the tools never appear no matter how correct it looks.
2. It speaks native SSE, and the field is **`serverUrl`**, not `url`.
3. Antigravity fronts several models, not just Gemini. Pick one deliberately with `agy models`
   rather than taking the default.

---

## The whole picture, at a glance

Rough framework — every combination we know of, in one place. Status is honest: some of the grid is
unverified.

| # | Model | How you pay | CLI | Config file | Transport | Status |
|---|---|---|---|---|---|---|
| 1 | Claude (Opus / Sonnet) | Claude subscription | Claude Code | `.mcp.json` | SSE | ✅ Verified |
| 2 | `deepseek-v4-flash` | Prepaid credits | Claude Code (redirected) | `.mcp.json` | SSE | ✅ Verified end-to-end — setup, restart, supplied script and a script written from scratch, all first try |
| 3 | `deepseek-v4-pro` | Prepaid credits | Claude Code (redirected) | `.mcp.json` | SSE | ✅ Verified end-to-end, including a masked two-layer script written from scratch |
| 4 | GPT-5.x | ChatGPT subscription | Codex CLI | `~/.codex/config.toml` | custom stdio bridge | ✅ Verified |
| 5 | GPT-5.x | OpenAI API key | Codex CLI | `~/.codex/config.toml` | stdio bridge | ✅ Same local transport verified; API-key authentication itself not separately tested |
| 6 | Gemini | Google subscription | Antigravity | `~/.gemini/config/mcp_config.json` (global) | SSE | ✅ Verified end-to-end |
| 7 | Antigravity's other models | Via Antigravity | Antigravity | `~/.gemini/config/mcp_config.json` (global) | SSE | ❓ Harness proven, model not separately verified |
| 8 | Gemini | Google API key | Gemini CLI | `~/.gemini/settings.json` | ❓ | ❓ Not looked at yet |
| 9 | Any local model | Free | Ollama / LM Studio | — | none | ❌ No MCP client — not viable |

### Settled — Affinity is SSE-only

There is no Streamable HTTP endpoint; every path but `/sse` returns `404`. Consequence: rows 4–5
keep a bridge **permanently**. There is no one-line `url = …` form to collapse to.

---

## Step 1 — Which model

### Tested here

| Model | Cost | SDK accuracy | Verdict |
|---|---|---|---|
| **Claude** (Opus / Sonnet) | Claude subscription | Best — this project's whole SDK knowledge base was built with it | The baseline. Best choice for complex, exploratory work |
| **DeepSeek** `v4-flash` | Prepaid credits | No hallucinated SDK calls on the scripts tested | **Both DeepSeek models work.** Reachable through Claude Code's own connection — see the redirect in step 2 |
| **DeepSeek** `v4-pro` | Prepaid credits, ~3× Flash per token | No hallucinated SDK calls, including a masked two-layer script written from scratch | Pick either. The cost difference is cents, so choose on nothing much at all |

**What a run actually costs, measured rather than extrapolated** (12 Aug 2026, prepaid tokens): a
complete setup from an empty folder — config written, connection verified, restart, plus a supplied
script and one written from scratch — came to **about 3 cents on Flash**. The same on Pro, *plus* a
masked two-layer script, came to **about 5 cents**. Per-token rates make Pro look 3× dearer; in
practice the whole day's testing cost eight cents.

So the honest advice is: **don't agonise over which DeepSeek model.** Both wrote correct SDK code
first try, including the hard case. Note that DeepSeek has announced a significant price rise, so
re-check before relying on these figures.

### Additional model notes

| Model | Reach it via | Status |
|---|---|---|
| **GPT-5.x / GPT-5.x-Codex** (ChatGPT subscription or OpenAI API key) | Codex CLI | Automatic loading, SDK reads, script execution and a generated two-layer variant are all verified |
| **Gemini** | Antigravity, Gemini CLI | Verified end-to-end through Antigravity, with the config in its global location (`~/.gemini/config/mcp_config.json`) |
| **Antigravity's other models** | Antigravity | Not separately verified. Choose a model with `agy models` rather than taking the default |

#### On the OpenAI side specifically

OpenAI's coding models sit behind two different doors, and it matters which one you have:

- **ChatGPT Plus / Pro subscription** — sign into Codex CLI with your ChatGPT account. No API key,
  no per-token billing; you get the Codex model tiers included in your plan.
- **OpenAI API key** — pay per token, billed separately from ChatGPT. Works with Codex CLI.

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
| **Codex CLI / desktop environment** | GPT-5.x via ChatGPT login or OpenAI API key | `~/.codex/config.toml` | custom stdio bridge → SSE | ✅ Automatically discovers the tools, reads `preamble`, runs scripts |
| **Antigravity** (`agy`) | Gemini, plus its other models | `~/.gemini/config/mcp_config.json` — global | SSE (`serverUrl` field) | ✅ Verified — live round-trip and script execution passed |

### Recommended combinations

| If you want… | Use |
|---|---|
| **The most reliable setup** | Claude Code + Claude |
| **Cheap, on the proven connection** | Claude Code + DeepSeek, via the redirect below — verified end-to-end on both `v4-flash` and `v4-pro`, and a whole session costs cents |
| **You already pay for ChatGPT** | The ChatGPT app's **Codex** tab + the custom bridge — no terminal needed. Same capability in a terminal via the `codex` CLI. (`Chat` cannot reach Affinity at all.) |

That middle row is a useful trick: DeepSeek publishes an **Anthropic-API-compatible endpoint**, so
Claude Code can be pointed at DeepSeek instead of Anthropic. The harness, the MCP connection, and
every config file stay exactly as they were — only the model changes.

### ▸ [Setting up DeepSeek in Claude Code — the guide](deepseek.html)

**Follow that page for the setup.** It has the environment variables, why the terminal has to be a
separate one, and how to confirm the swap actually took. It is the single source for this — the
steps aren't repeated here, so they can't drift apart.

Two things worth knowing before you go: the redirect sends *all* Claude Code traffic including
billing away from Anthropic, so it belongs in a throwaway terminal rather than the one you normally
work in. And Claude Code's web-search tool makes extra LLM calls under the hood, which costs extra
tokens against your DeepSeek balance when running this way.

---

## What it costs

Rough shape, so you can budget:

- **Claude subscription** — flat monthly, no per-script thinking required. Best if you're iterating
  heavily.
- **ChatGPT Plus / Pro** — flat monthly, and Codex CLI is included in it. Same shape as above if
  you're already paying for it; not worth subscribing to *just* for this.
- **OpenAI API key** — pay per token, meaningfully pricier than DeepSeek for the same work.
- **DeepSeek prepaid credits** — no subscription, no monthly fee, pay per token. The cheapest of
  these by some distance; check current rates, they move.

For per-token setups, the models above are cheap enough that the real cost of this workflow is your
time reviewing hallucinated SDK calls — which is why the accuracy column in step 1 matters more than
the price column.
