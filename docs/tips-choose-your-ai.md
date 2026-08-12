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

Five setups, each taken from nothing to a working script inside Affinity.

| Setup | What it needs | Notes |
|---|---|---|
| **Claude Code** | `.mcp.json` in your project folder | The baseline. Terminal, VS Code, or Claude Desktop's Code tab |
| **Claude Desktop** | Nothing — install the Affinity connector | Easiest of all if you have Claude Desktop |
| **Codex** (ChatGPT) | `~/.codex/config.toml` + a small bridge | Codex can't speak Affinity's protocol directly, so the bridge translates. The ChatGPT app's Codex tab needs no terminal |
| **Antigravity** (Gemini) | `~/.gemini/config/mcp_config.json` — **global** | A per-project file is silently ignored here |
| **OpenCode** | `opencode.json` in your project folder | The opposite of Antigravity: this one *is* per-project. Fronts almost any model, including free ones |

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
