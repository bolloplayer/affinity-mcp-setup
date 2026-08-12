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

### Test Path B — no Claude subscription — not Path A

There are two ways to arrive at a DeepSeek session, and only one is worth testing:

- **Path A, sequential:** Part I with Claude writes `.mcp.json`, then the user redirects to DeepSeek.
  The agent has nothing left to configure, so the setup prompt is trivially satisfied. **Don't test
  this.** It proves nothing beyond "an existing file still exists".
- **Path B, DeepSeek-first:** the user has **no Claude subscription and has never logged into
  Anthropic**. They install Claude Code, set the env vars, and launch into an empty folder with no
  `.mcp.json`. **This is the test**, and it is the primary DeepSeek audience — the whole selling
  point is not needing a Claude subscription.

Path A is an artifact of our docs presenting this as Part I → Part II. A DeepSeek-only user never
follows that sequence.

**The env vars are this leg's login step, not extra setup.** Every leg has one thing the agent
cannot do, because it is the step that brings the agent into existence: `claude login`, a ChatGPT
login, a Google login — here, `ANTHROPIC_AUTH_TOKEN`. The human/agent boundary is the same on all
four legs: human does auth and harness install, agent does the MCP wiring.

### Step 0 — the unknown that gates everything

**Does Claude Code start on DeepSeek credentials alone, in a profile that has never authenticated
with Anthropic?** If first-run onboarding demands a login before it honours `ANTHROPIC_AUTH_TOKEN`,
Path B is blocked and the "no Claude subscription needed" premise fails. Neither our
`docs/deepseek.html` nor DeepSeek's own guide covers this — both assume a working Claude Code.

Test it on a clean profile, not the everyday one, and record exactly what the first run demands.

**Result — PASSED, 12 Aug 2026, Claude Code v2.1.228.**

Isolate the profile with **`CLAUDE_CONFIG_DIR`**. It is absent from the published settings docs but
is honoured by `claude.exe`, and it relocates the whole profile including `.credentials.json`, so
the everyday login is untouched:

```powershell
$env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\Desktop\ds-test-profile"
```

On a profile that had **never authenticated with Anthropic**, Claude Code:

- ran first-run onboarding (terminal choice, then theme choice) — confirming the profile really was
  fresh, rather than silently reusing the everyday one;
- **never asked for a login and never opened a browser**;
- started with `deepseek-v4-flash · API Usage Billing` in the banner, no subscription named;
- `/model` listed **only** DeepSeek models — Default and the Opus/Sonnet slots resolving to
  `deepseek-v4-pro`, the Haiku slot to `deepseek-v4-flash`, which was the active model;
- `/mcp` showed **no connections**, the correct Path B starting state. Note that none of the
  account's claude.ai connectors appeared either, as expected with no Anthropic auth.

**Consequence: DeepSeek is a standalone entry point, not a sequel to Part I.** The
"Part I completed" prerequisite at the top of `docs/deepseek.html` is wrong for this audience and
should be revised at the end-of-project refresh — it is what made the agent-driven setup prompt
look redundant for this leg.

**Watch out: `CLAUDE_CODE_EFFORT_LEVEL=max` did not visibly apply** — the model picker still showed
`High effort (default)`. Set it in-session with `←/→` and keep it identical across the Flash and Pro
runs, or the accuracy comparison is confounded.

### Steps, per model

1. From an **empty folder with no `.mcp.json`**, give it the harness-agnostic prompt: *"Set up the
   Affinity MCP connection following https://github.com/bolloplayer/affinity-mcp-setup's SETUP.md."*
   Does it identify itself as Claude Code, write the right file, produce the handoff note, and reach
   the menu after the restart? This is instruction-following on a fiddly multi-step task — the model
   capability the whole comparison turns on.
2. `/mcp` — `affinity` connected, same tool list. Proves the swap touched the model only.
3. `/model` — DeepSeek models listed, no Claude models. Screenshot for the record.
4. Read the `preamble` doc. Note whether the model does it unprompted or needs telling.
5. Run `examples/inspect-document.js` — read-only, proves the round trip.
6. Run `examples/color-boost.js` — proves writes and the history.
7. Ask for something **not** in `examples/`, complex enough to need real SDK knowledge (a two-layer
   adjustment with a mask is the established bar). This is where hallucinated API calls surface.

### Step 1 result — Flash, PASSED all five checks, 12 Aug 2026

`deepseek-v4-flash`, clean profile, empty folder, given only the harness-agnostic prompt.

| Check | Result |
|---|---|
| Self-identified as Claude Code, unprompted | ✅ "I'm running in Claude Code, so this is the Claude Code path" |
| Wrote `.mcp.json` — not `config.toml` or `mcp_config.json` | ✅ |
| Preserved `[::1]` — no "correction" to `localhost`/`127.0.0.1` | ✅ `{"type":"sse","url":"http://[::1]:6767/sse"}` |
| Produced the handoff note | ✅ In `CLAUDE.md`, with the three options reproduced **verbatim** |
| Explained the restart rather than a bare "please restart" | ✅ "That's the design, not a failure", numbered steps, said it happens once |

`verify.ps1` passed every check: Affinity running, `[::1]:6767` listening, handshake OK on protocol
`2025-11-25`, 11 tools, preamble readable, document open.

**Behaviours worth noting that the checklist doesn't cover:**

- **Refused to build files from a summarised fetch.** `WebFetch` returned a summary rather than the
  verbatim SETUP.md; it noticed, said so, and went to the repo for real bytes instead of
  reconstructing. This is the failure mode SETUP.md's "the bytes must never pass through you" rule
  exists to prevent, and it caught it unprompted.
- **Read `verify.ps1` before executing it**, confirming it was read-only. Not demanded by the
  instructions.
- **Recalled the Desktop-sandboxing prerequisite** and checked the folder satisfied it.
- **Recovered cleanly from a real error.** `git clone .` failed because Claude Code's own `.claude/`
  directory made the folder non-empty; it diagnosed the cause correctly and cloned to a
  subdirectory.

**Deviation:** it **cloned the whole repo** rather than fetching the specific files SETUP.md lists.
Not harmful — it then copied what it needed into the root — but it cost a failed clone, an extra
copy step, and leaves a nested repo in the project folder. Also spent a 270KB fetch on GitHub's
rendered HTML before switching to `raw.githubusercontent.com`, which costs real tokens on a
per-token plan. Consider whether SETUP.md should say "clone" outright, since two agents now have
reached for it.

### Part 2 result — Flash, PASSED, 12 Aug 2026

After restarting in the same terminal with the env vars still set, and a bare `continue`:

| Check | Result |
|---|---|
| Acted on the handoff note unprompted | ✅ From `continue` alone, no re-prompting |
| Read the `preamble` before `execute_script` | ✅ "Preamble gate passed" — the gate resets per SSE connection and it cleared it unreminded |
| Ran **only** the read-only script | ✅ `inspect-document.js` and nothing else |
| Offered all three options verbatim, chose none | ✅ Plus "or stop here with nothing changed" |
| Planned to delete the handoff section | ✅ Checked `CLAUDE.md` held only that section, so said it would remove the file |

Reported correctly: Affinity **3.2.3.4646 Win32 (Jul 7 2026)**, 1 open document, session
`D0027549-…`, layer stack of 1 spread / 1 top layer (`{Background}` only), `canUndo: false`. It
stated explicitly that nothing in the document had been touched.

**The behavioural signature of this model, seen four times now:** it reads before it executes.
It refused to build files from a summarised fetch, read `verify.ps1` before running it, read
`inspect-document.js` before running it, and read `CLAUDE.md` in full before acting on it. That
disposition is the single best protection against the SDK's silent-failure traps — the
copy-on-get `masterSpline` class of bug, where a script reports success and the image is unchanged.

**Setup leg verdict: `deepseek-v4-flash` completes the full Claude Code setup flow on a clean
profile with no Anthropic account, from a bare prompt, without a single intervention.**

### Steps 6–7 result — Flash, PASSED, zero hallucinated SDK calls

**Option 1 (supplied colour-boost script):** ran clean first try. Two layers added — Boost
(strength 0.6, opacity 40%) over Clean (strength 0.25, opacity 30%). Followed Part B's pattern
correctly: save → confirm via `list_library_scripts` → run, and handed over **without calling
`render_spread`**, as SETUP.md requires.

**Option 2 (black-and-white conversion written from scratch):** ran clean first try, **no
hallucinated API calls at all.** How it got there matters more than the result:

1. Found the node and setter by probing — `addBlackAndWhiteAdjustmentRasterNode`,
   `createSetBlackAndWhiteAdjustmentParameters`.
2. Discovered `BlackAndWhiteAdjustmentParameters` has **no factory**, and inferred the params must
   come from the layer — independently reaching what `docs/sdk-notes.md` records.
3. Needed the value range, hit a **broken doc topic**, diagnosed it rather than guessing, and found
   `struct_ranges.min.json`, reading out `[-2.0, 3.0]` from the SDK itself.

Step 3 is the important one. The obvious guesses are `0–1` or `0–100`; both are wrong, and neither
errors — the value clamps silently and the conversion comes out weak or unchanged. **It refused to
guess a number it could look up.** That is the specific discipline the whole SDK punishes people
for lacking.

It then called `add_sdk_hint` unprompted, per the preamble's rule, with an accurate and detailed
hint covering the factory absence, the read-mutate-reapply pattern, the range, and the broken topic.

**New SDK finding, now in `docs/sdk-notes.md`:** `adjustment_ranges` is listed by
`list_sdk_documentation` but `read_sdk_documentation_topic` returns `ERROR: File not found`. Dead
name in the listing; use `param_ranges.min.json` / `struct_ranges.min.json`.

**Visually confirmed in Affinity, not just in the transcript:** the image is actually black and
white. This matters because the SDK's signature failure — the copy-on-get `masterSpline` class — is
a script that reports success while the document is unchanged. A transcript alone cannot
distinguish the two, so **every future leg must check the canvas before recording a pass.**

**Caveat on this result:** B&W is a single-layer adjustment — moderate, not the two-layer-with-mask
bar in step 7. The harder task is still unrun, and the old Pro-vs-Flash claim was specifically about
*complex* scripts. Do not conclude Flash beats Pro from this alone.

### Cost — the whole Flash leg came to about $0.03

Balance **$9.63 → $9.60**, measured 12 Aug 2026 either side of the run. Rounding to cents means the
true figure is $0.03 ± $0.005, so treat it as "about three cents", not a precise number.

That covered **everything**: fetching the repo, writing the config, running `verify.ps1`, the
restart, the preamble read, `inspect-document.js`, the supplied colour-boost script, probing the SDK
for the B&W API and ranges, writing and running a novel script, and the `add_sdk_hint` call. It also
absorbed the wasteful 270KB fetch of GitHub's rendered HTML.

**This is the finding that most deserves to reach readers.** The per-token rates on DeepSeek's
pricing page are abstract; "a complete setup plus two scripts costs three cents" is not. It also
reframes the Flash-vs-Pro question — at this scale, Pro's 3× premium is the difference between three
cents and nine, so **cost is not the reason to prefer Flash.** Accuracy is the only axis that
matters here, which is exactly what the complex-script test is for.

Note the price-increase warning on DeepSeek's docs: date any cost claim published from this.

### The complex task — use this wording verbatim on every model

B&W is **burned as a benchmark**: Flash's `add_sdk_hint` put the factory absence, the
read-mutate-reapply pattern and the `[-2.0, 3.0]` range into the pool, so every later session is
handed the answer. Use this instead — nothing in the pool covers it:

> Add a two-layer adjustment to my open document, with a mask so the effect applies selectively
> rather than to the whole image. Save it to the Script View and run it.

**Decline `add_sdk_hint` until every model has attempted this.** Whichever model goes first would
otherwise deposit its solution in the pool and hand it to the next — the same one-way door that
burned B&W, except this one is foreseeable. Once both runs are recorded, accept the hint for
whichever solution was better.

Neither run is pristine — the pool already held hints from earlier sessions. What is controllable is
that both models get the *same* inherited help, which this achieves.

**Watch for subagent leakage.** `CLAUDE_CODE_SUBAGENT_MODEL` and the Haiku slot both point at Flash,
so anything delegated to a subagent runs on Flash even during a Pro session. If that happens, the
run is not purely Pro and must be noted or redone.

### Pro run — 12 Aug 2026, `deepseek-v4-pro`, effort max, fresh profile and folder

**Setup (Part 1 + Part 2): PASSED, and cleaner than Flash on two points.**

| | Flash | Pro |
|---|---|---|
| Fetching SETUP.md | 270KB of GitHub HTML first, then raw | **Straight to raw** |
| Getting helper files | **Cloned the whole repo** — a deviation, plus a failed `clone .` and a copy step | **Downloaded the four listed files** — as SETUP.md instructs |
| `.mcp.json`, `[::1]` preserved | ✅ | ✅ |
| Handoff note, restart explained | ✅ | ✅ |
| Part 2 checks | ✅ all five | ✅ all five |

Both models share the **read-before-execute** disposition, so that is a DeepSeek family trait rather
than a Flash-specific one.

**Then Pro broke the no-renders rule — twice.**

SETUP.md states it in six places, e.g. *"No renders, and no describing the result. `render_spread`
exists, but do not reach for it here — including to diagnose a script that threw."* Pro called
`render_spread` after option 1 and again "to confirm the final state", **and** described the result
in detail ("Boost saturates the six colour ranges… Clean lifts whites, opens midtones, keeps blacks
solid"). Both halves of the rule.

Flash followed it correctly, handing over with "switch to Affinity and take a look" and no render.

**This is the first real quality separation between the models, and it runs opposite to the
archived Flash-beats-Pro framing** — but note the axis: it is *instruction-following*, not SDK
accuracy. The old claim was about hallucinated API calls on complex scripts. On that axis nothing is
settled yet.

Why the rule exists, and so why the miss matters: the user is seconds from the document at full
resolution, so a render is wasted tokens and a described result invites the model to narrate an
outcome it cannot actually see.

### Complex task — Pro, PASSED with zero hallucinations

Given the locked mask prompt, Pro checked the global hint pool (**nothing on masks — the benchmark
was clean**), read the SDK docs for `PixelBuffer` and `createReplaceBitmap` rather than guessing,
and wrote a 169-line script that ran first try.

The code was reviewed line by line. **No hallucinated API calls.** It gets several non-obvious
things right:

- Reads the mask format from **`layer.rasterInterface`**, not the document's assumed depth — forcing
  M8 onto a 16-bit document fails with `COMMAND_FAILED`.
- Applies the mask **last**, once the layer is in final position in the tree.
- Detects the group-parenting case with a root-count check and moves the layer back out.
- Idempotent: deletes only its own layers by name, leaving everything else alone.
- Correct chain: `PixelBuffer.create` → `createCompatibleBitmap(true)` → `createReplaceBitmap`.

**This contradicts the archived claim outright.** "`deepseek-v4-pro` produced 3–4 hallucinated SDK
calls per complex script" does not survive contact with a dedicated test: this *was* the complex
script and it produced none. The likeliest explanation is the contamination already suspected — the
old numbers were gathered informally, partly through OpenCode, and were never a clean measurement of
Pro on this harness.

**It also rendered a third time**, and described the result again. Three renders across the run makes
this systematic rather than a slip.

## Verdict — 12 Aug 2026

**Both models work. The difference is minor and does not favour either strongly.**

| | `deepseek-v4-flash` | `deepseek-v4-pro` |
|---|---|---|
| Setup flow, clean profile | ✅ | ✅ |
| Following fetch instructions | Cloned the repo (deviation) | ✅ Fetched the listed files |
| Fetch efficiency | Wasted 270KB on rendered HTML | ✅ Straight to raw |
| No-renders rule | ✅ Obeyed | ❌ Broke it 3× and described results |
| Novel script, first try | ✅ (B&W) | ✅ (B&W, but hint-contaminated) |
| Complex masked script | **not run** | ✅ Zero hallucinations |
| Cost, full run | ~$0.03 | **~$0.05**, and it did *more* — the complex task too |

**Claims now settled:**

- ❌ **"Flash beats Pro on accuracy"** — not supported. Pro handled the hardest task cleanly. Retire
  this claim rather than republish it.
- ❌ **"Pro hallucinates 3–4 calls per complex script"** — contradicted directly.
- ✅ **Cost is negligible either way** — measured, not extrapolated: Flash's full run **$0.03**
  ($9.63 → $9.60), Pro's full run **$0.05** ($9.60 → $9.55) *including the complex mask task Flash
  never attempted*. Eight cents for the entire day's testing. Price is not a deciding factor at this
  workload, which is what the old docs framing got most wrong: Pro's 3× per-token premium turns out
  to be two cents in practice.

**Known gap, stated plainly:** Flash was never given the complex mask task, so the accuracy
comparison rests on Pro succeeding rather than on a head-to-head. That is enough to *retire* the old
claim — it was that Pro fails, and Pro did not — but not enough to assert Pro is better. If the
question ever matters, run the same locked prompt on Flash.

### What to record — this is the actual deliverable

| Field | Why |
|---|---|
| Model + date | Pricing and model versions both move |
| Did it read the preamble unprompted? | The single biggest driver of SDK accuracy |
| Did step 0 work — no Anthropic login needed? | Gates the whole "no subscription" premise |
| Did it self-configure in step 1? | Instruction-following, and whether the setup prompt holds up under this model |
| Hallucinated SDK calls in step 7, counted | The claim being re-verified. Count calls, not attempts |
| Did steps 5–6 pass first try? | Separates "harness works" from "model is accurate" |
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
