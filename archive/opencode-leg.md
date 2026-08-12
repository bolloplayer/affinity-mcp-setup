# OpenCode leg — archived findings

**Archived 12 Aug 2026**, ahead of a clean re-test of the OpenCode leg. Everything below was
removed from the user-facing docs on the same day; this file is the record so the re-test starts
from what was actually established rather than from memory.

Private-only. `archive/` is not in the public repo's allowed paths (see `CLAUDE.md`), so nothing
here ships to `bolloplayer/affinity-mcp-setup`.

## The three findings worth carrying forward

1. **Native SSE, no bridge.** OpenCode was the only non-Claude harness that reached Affinity
   without a translation layer. It speaks SSE directly, so Affinity's endpoint goes in as-is and
   there is no protocol-version problem of the kind Codex has.

   ```
   opencode mcp add affinity --url "http://[::1]:6767/sse"
   opencode mcp list          # reported: connected
   ```

   Config lives at `~/.config/opencode/opencode.jsonc` (the `remote` server type). The one-line
   CLI form above writes it for you.

2. **It is the cheapest verified path, including a genuinely free one.**
   `opencode/deepseek-v4-flash-free` completed a full round-trip with **no API key and no
   credentials at all** — a $0 smoke test. That made OpenCode the recommended way to prove the
   Affinity connection works before spending anything.

3. **Multi-model, so it is a harness rather than an ecosystem.** It fronts Claude, GPT, DeepSeek,
   Gemini and local models. In the ecosystem comparison table it therefore sat below a separator,
   outside the three vendor rows.

## Model results measured on this leg

These are model findings, not harness findings, and they still hold — but they were measured
*through* OpenCode, so re-confirm them if the re-test changes anything about how scripts are fed
to the model.

| Model | Cost | SDK accuracy | Verdict |
|---|---|---|---|
| `deepseek-v4-flash` | $0.14/M in, $0.28/M out | Zero SDK hallucinations on the script tested | Best value |
| `deepseek-v4-pro` | $0.435/M in, $0.87/M out | 3–4 hallucinated SDK calls per complex script | Not worth the 3× premium — Flash was cheaper *and* more accurate |

The Flash-beats-Pro result is the interesting one: on identical-complexity tasks the cheap model
produced cleaner SDK code than the expensive one.

## Open at time of archiving

- **OpenCode + an OpenAI API key** was never run. It was listed as "should just work" — native SSE,
  no bridge, same GPT models — and was the path of least resistance for ChatGPT owners who did not
  want to install the Codex bridge. Still unverified.
- The **OpenCode Desktop app** was never verified in its own right. It was assumed to work by
  config inheritance from the CLI, which *was* verified.

## What stayed in the docs

The DeepSeek-via-Claude-Code redirect is **not** part of this leg and was deliberately kept:
DeepSeek publishes an Anthropic-compatible endpoint, so Claude Code can be pointed at it with
environment variables, using `.mcp.json` and the already-proven Claude Code connection. That row
never depended on OpenCode.
