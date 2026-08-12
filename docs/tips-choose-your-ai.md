# Which AI should you use with Affinity?

Affinity Photo v3 has a built-in MCP server, so an AI agent can write and run real scripts inside
the app. Almost any AI can do it. This page is the short version of which one to pick.

**[`SETUP.md`](../SETUP.md) is how to wire it up** — point your agent at it and it configures itself.
This page is only about *which* one.

---

## Two things that save an afternoon

**MCP is a property of the app you type into, not the model.** No model has an "MCP client" inside
it. The app connects to Affinity and hands the tools to whichever model it's driving. So the model
is mostly a free choice; the app is the real constraint.

**The address is `http://[::1]:6767/sse` — and it must be exactly that.** Affinity listens on IPv6
only, so `localhost` and `127.0.0.1` are refused. That refusal is expected, not a fault. Don't
"correct" the address.

---

## Pick one

| If you… | Use |
|---|---|
| **want the most reliable setup** | **Claude Code** + Claude |
| **want to try it for free** | **OpenCode** + a free model — no API key, no card. Enough for about two setups |
| **want it cheap but solid** | **Claude Code + DeepSeek** — a whole session costs cents, and you don't need a Claude subscription. [Guide →](deepseek.html) |
| **already pay for ChatGPT** | The ChatGPT app's **Codex** tab. (Its **Chat** tab can't reach Affinity at all.) |
| **use Gemini** | **Antigravity** (`agy`) |

Any of these works. If you're undecided, start with the free one and switch once you know you like
the workflow.

---

## What we tested

Each of these was taken from nothing to a working script inside Affinity.

<br>

### Three-Surface Ecosystem Comparison Table

<br>

| Ecosystem | 1. Home / Chat Surface | 2. Code / Codex Surface | 3. CLI / Terminal Harness | Local MCP Config / Connection |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** (Anthropic) | ✅ **Claude Desktop (Home tab)** | ✅ **Claude Desktop (Code / Cowork)** | ✅ **`claude` CLI** (Claude Code) | Official connector or `.mcp.json` |
| | | | | |
| **GPT** (OpenAI) | ❌ **ChatGPT App (Chat tab)** / Web | ✅ **ChatGPT App (Codex tab)** | ✅ **`codex` CLI** | `~/.codex/config.toml` & custom stdio bridge |
| | | | | |
| **Gemini** (Google) | ❌ **Gemini Web** (`gemini.google.com`) | ✅ **Antigravity 2.0 / IDE** | ✅ **`agy` CLI** (Antigravity) | `~/.gemini/config/mcp_config.json` — global (`serverUrl` field) |
| | | | | |
| **DeepSeek** | ❌ **DeepSeek Web** (`chat.deepseek.com`) | ✅ **Claude Code in VS Code**, redirected | ✅ **`claude` CLI**, redirected | `.mcp.json` — same as Claude, plus env-var redirect † |
| | | | | |
| | | | | |
| ⎯⎯⎯ *Not a vendor ecosystem — a multi-model harness that can drive any of the models above* ⎯⎯⎯ | | | | |
| | | | | |
| **OpenCode** (Multi-model) | — *(N/A — local harness)* | ✅ **OpenCode Desktop App** (beta) | ✅ **`opencode` CLI / TUI** | `opencode.json` in the project — **workspace**, `url` field |
| | | | | |

<br>

*† **DeepSeek has no harness of its own — it borrows Claude's.** It publishes an
Anthropic-API-compatible endpoint, so Claude Code can be pointed at it with a handful of environment
variables. The MCP connection, `.mcp.json` and every script stay exactly as they are; only the model
answering changes. **[Setting up DeepSeek in Claude Code — step-by-step guide](deepseek.html)** has
the details. You do **not** need a Claude subscription: Claude Code runs on a DeepSeek key alone.*

<br>

**Two config traps worth knowing.** Antigravity's config is **global** — a per-project file is
silently ignored. OpenCode is the exact opposite: it reads the **per-project** file. Don't carry an
assumption from one to the other.

**Expect one restart.** Every one of these reads its config when it starts, so the tools appear only
after you restart. That's normal — it isn't a sign anything went wrong.

---

## What it costs

Less than you'd think. A complete setup plus two working scripts came to **a few cents** on
DeepSeek, and **nothing at all** on OpenCode's free tier.

---

## Won't work

**Web chat** — `chatgpt.com`, `gemini.google.com`, `chat.deepseek.com`. A page in your browser can't
reach a server running on your own machine.

**Ollama or LM Studio on their own.** They serve models but have no agent around them and nothing
that speaks MCP.

---

*Verified on Windows 11 with Affinity Photo 3.2.x, August 2026. Affinity's AI Connector is a free
beta — treat version-specific details as a snapshot.*
