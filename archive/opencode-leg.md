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

These are model findings, not harness findings. They were measured *through* OpenCode, so re-confirm
them if the re-test changes anything about how scripts are fed to the model. **The same table also
sits in `archive/deepseek-leg.md`** — DeepSeek is now its own leg, and the two must be separated in
the re-test: a number measured on OpenCode is not automatically a number for
DeepSeek-via-Claude-Code.

| Model | Cost | SDK accuracy as recorded here | Status |
|---|---|---|---|
| `deepseek-v4-flash` | $0.14/M in, $0.28/M out | Zero SDK hallucinations on the script tested | Consistent with the later clean test |
| `deepseek-v4-pro` | $0.435/M in, $0.87/M out | 3–4 hallucinated SDK calls per complex script | ❌ **Disproven** — see below |

> **⚠️ The Flash-beats-Pro claim did not survive testing.** On 12 Aug 2026 both DeepSeek models were
> tested properly through Claude Code (see `archive/deepseek-leg.md`). Pro wrote a 169-line masked
> two-layer script first try with **zero** hallucinated API calls — reviewed line by line. The
> "3–4 hallucinated calls per complex script" figure above is wrong, and the likeliest explanation is
> that it was measured here, on OpenCode, and then quoted as a general truth about the model.
>
> **Treat every number in this table as unreliable until re-measured on this harness.** They are kept
> only as a record of what was once believed.

## Open at time of archiving

- **OpenCode + an OpenAI API key** was never run. It was listed as "should just work" — native SSE,
  no bridge, same GPT models — and was the path of least resistance for ChatGPT owners who did not
  want to install the Codex bridge. Still unverified.
- The **OpenCode Desktop app** was never verified in its own right. It was assumed to work by
  config inheritance from the CLI, which *was* verified.

## Test protocol — carried over from the DeepSeek leg, 12 Aug 2026

The DeepSeek leg was run properly and taught five things that apply here directly. **Read these
before starting**; each cost real time to learn.

### 1. Test from an empty folder with no config — never a folder that already works

The DeepSeek leg nearly produced a meaningless result because the obvious setup (do it with a
working connection already in place) tests nothing. Delete or relocate any existing
`~/.config/opencode/opencode.jsonc` entry for `affinity` first, and start in a **new, empty project
folder**. If the agent finds Affinity already wired up, the whole point of the test evaporates.

**Open question for this leg:** Claude Code has `CLAUDE_CONFIG_DIR` (undocumented but honoured) to
relocate an entire profile for testing. **Find out whether OpenCode has an equivalent** before
touching the real config — if not, back up `~/.config/opencode/` and restore it afterwards.

### 2. `add_sdk_hint` burns a benchmark task permanently

Hints go into Affinity's **shared pool** and are returned by `preamble` to every later session. On
the DeepSeek leg, Flash volunteered a black-and-white hint covering the missing factory, the
read-mutate-reapply pattern and the `[-2.0, 3.0]` range — which permanently disqualified B&W as a
comparison task for every model afterwards.

- **B&W is burned.** Do not use it to measure anything here.
- **Decline `add_sdk_hint` while a benchmark is in progress**, then accept it once every model has
  attempted the task.
- **Unknown:** whether the mask-task hint was accepted at the end of the Pro run. Check what
  `preamble` returns before assuming the mask task is still clean.

### 3. Check the canvas, never the transcript

The SDK's signature failure — the copy-on-get `masterSpline` class — is a script that reports
success while the document is unchanged. A transcript cannot tell the two apart. **Look at Affinity
before recording any pass.** A mask makes this worse: a script that adds layers but fails to apply
the mask produces a plausible-looking result, just applied to the whole image.

### 4. The setup prompt is worth testing, and the auth step is not a flaw

Give the same harness-agnostic prompt, verbatim:

> Set up the Affinity MCP connection following https://github.com/bolloplayer/affinity-mcp-setup's
> SETUP.md.

Note that **SETUP.md no longer has an OpenCode row** — it was removed when this leg was retired. So
this prompt will *not* self-identify OpenCode until the row is restored. Decide deliberately: either
restore the row first and test the real flow, or test manual setup and add the row after it passes.

Whatever OpenCode needs before an agent exists — installing it, credentials — is that leg's
equivalent of `claude login`, not a defect. No leg's agent configures its own authentication.

### 5. Record cost from the provider's dashboard

The DeepSeek leg's most publishable finding was a measured number: a full setup plus two working
scripts cost **a few cents**. Per-token rates are abstract; a measured session total is not. Note the
balance before and after.

## What stayed in the docs

The DeepSeek-via-Claude-Code redirect is **not** part of this leg and was deliberately kept:
DeepSeek publishes an Anthropic-compatible endpoint, so Claude Code can be pointed at it with
environment variables, using `.mcp.json` and the already-proven Claude Code connection. That row
never depended on OpenCode.
