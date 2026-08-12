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

## Left in the public docs

The redirect mechanism above stays in `docs/choosing-your-ai.md` — it is a config recipe a reader
needs, not a test verdict. What was removed is the **accuracy verdicts and the ✅ Verified status**,
which are now pending.
