# DeepSeek leg — archived findings

**Archived 12 Aug 2026**, when DeepSeek was promoted from a footnote under Claude Code to a leg in
its own right, pending a clean re-test. The results below come from the original runs and are
**unverified until that re-test happens** — they were gathered informally alongside other work,
not as a dedicated leg.

Private-only. See `CLAUDE.md` for why `archive/` never ships to the public repo.

## What the leg is

DeepSeek publishes an **Anthropic-API-compatible endpoint**, so Claude Code can be pointed at
DeepSeek instead of Anthropic. The harness, the MCP connection and every config file stay exactly
as they are — only the model changes. That makes this the cheapest way to use the fully proven
Claude Code transport.

```powershell
$env:ANTHROPIC_BASE_URL   = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN = "<your DeepSeek API key>"
$env:ANTHROPIC_MODEL      = "deepseek-v4-flash"
claude
```

Use a **separate terminal window**: these variables redirect *all* traffic, including auth and
billing, away from Anthropic.

## Claims to re-verify

| Claim | Where it came from |
|---|---|
| `deepseek-v4-flash` produced **zero SDK hallucinations** on the script tested | A single script, one run |
| `deepseek-v4-pro` produced **3–4 hallucinated SDK calls** per complex script | Complex scripts only |
| Flash was cheaper *and* more accurate than Pro — the flagship was the worse pick | Comparison across the two runs above |
| Pricing: Flash $0.14/M in, $0.28/M out; Pro $0.435/M in, $0.87/M out | Published rates at the time — re-check, these move |

The Flash-beats-Pro result is the one worth re-running carefully. It is the most interesting claim
in the whole model comparison, and it currently rests on the thinnest evidence: a single script per
model, with no control for prompt variation. If it holds up under a real leg test it is genuinely
worth publishing; if it doesn't, it should come out of the docs entirely.

## Overlap with the OpenCode leg

Some of these same model results were measured *through* OpenCode rather than through the Claude
Code redirect — see [[opencode-leg]] (`archive/opencode-leg.md`), which carries the same Flash-vs-Pro
table. **The two legs need separating in the re-test:** a model result measured on OpenCode is not
automatically a result for DeepSeek-via-Claude-Code, because the harness shapes how much SDK
context reaches the model. Run each leg on its own and record which harness produced which number.

## Test protocol — DeepSeek in Claude Code, on a paid token plan

Scope: **one harness (Claude Code), one billing mode (prepaid tokens), both current models.** This
is deliberately narrow so the result is attributable. Do not fold OpenCode results into it.

### Models available (verified 12 Aug 2026, DeepSeek's own pricing page)

| Model | API string | Context | Max output | In (miss) | In (cache hit) | Out |
|---|---|---|---|---|---|---|
| DeepSeek-V4-Flash-0731 | `deepseek-v4-flash` | 1M | 384K | $0.14/M | $0.0028/M | $0.28/M |
| DeepSeek-V4-Pro | `deepseek-v4-pro` | 1M | 384K | $0.435/M | $0.003625/M | $0.87/M |

A paid token balance reaches both; there is no tier gating. DeepSeek warns a **significant price
increase** is planned, so record the date alongside any cost claim.

### Environment — a fresh terminal, never an existing one

These redirect *all* Claude Code traffic including billing. `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is in
DeepSeek's current guide but missing from our `docs/deepseek.html`; include it.

```powershell
$env:ANTHROPIC_BASE_URL             = "https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN           = "<DeepSeek key>"
$env:ANTHROPIC_MODEL                = "deepseek-v4-flash"   # swap to -pro for run 2
$env:ANTHROPIC_DEFAULT_OPUS_MODEL   = "deepseek-v4-pro"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "deepseek-v4-pro"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL  = "deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL     = "deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL       = "max"
$env:CLAUDE_CODE_AUTO_COMPACT_WINDOW = "786432"
claude
```

**Set `ANTHROPIC_MODEL` explicitly per run rather than switching with `/model` mid-session.** The
Opus/Sonnet/Haiku aliases map to different DeepSeek models, so a mid-session switch leaves it
ambiguous which model produced which script — exactly the ambiguity that spoiled the last results.

### Steps, per model

1. `/mcp` — `affinity` connected, same tool list. Proves the swap touched the model only.
2. `/model` — DeepSeek models listed, no Claude models. Screenshot for the record.
3. Read the `preamble` doc. Note whether the model does it unprompted or needs telling.
4. Run `examples/inspect-document.js` — read-only, proves the round trip.
5. Run `examples/color-boost.js` — proves writes and the history.
6. Ask for something **not** in `examples/`, complex enough to need real SDK knowledge (a two-layer
   adjustment with a mask is the established bar). This is where hallucinated API calls surface.

### What to record — this is the actual deliverable

| Field | Why |
|---|---|
| Model + date | Pricing and model versions both move |
| Did it read the preamble unprompted? | The single biggest driver of SDK accuracy |
| Hallucinated SDK calls in step 6, counted | The claim being re-verified. Count calls, not attempts |
| Did steps 4–5 pass first try? | Separates "harness works" from "model is accurate" |
| Token spend for the session | The cost half of the comparison, from DeepSeek's dashboard |
| Anything the harness did differently | e.g. compaction behaviour at this context size |

### Then

One row per model in `docs/choosing-your-ai.md`'s combination grid, harness column **Claude Code
(redirected)**, plus a refreshed accuracy row in the step 1 model table. Only then does the
Flash-vs-Pro claim go back into the docs as settled — or come out for good.

## Left in the public docs

The redirect mechanism above stays in `docs/choosing-your-ai.md` — it is a config recipe a reader
needs, not a test verdict. What was removed is the **accuracy verdicts and the ✅ Verified status**,
which are now pending.
