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
   opencode mcp add affinity --url "http://[::1]:6767/sse"   # ⚠️ see below — may no longer exist
   opencode mcp list          # reported: connected
   ```

   > **⚠️ Both of these are suspect as of 12 Aug 2026 (OpenCode 1.18.x).** Checked against
   > `opencode.ai/docs/mcp-servers`:
   >
   > - **`opencode mcp add` is not in the current command list.** The documented commands are
   >   `auth`, `list`, `logout` and `debug`. Write the config file directly instead.
   > - **The docs now put config in `opencode.json` at the *workspace root*,** not the global
   >   `~/.config/opencode/opencode.jsonc` recorded here. **RESOLVED 12 Aug 2026: the workspace file
   >   works.** From a clean machine — OpenCode fully uninstalled, all four data directories deleted —
   >   a fresh `opencode.json` in an empty project folder produced:
   >
   >   ```
   >   ✓ affinity connected
   >       http://[::1]:6767/sse
   >   ```
   >
   >   That is a live SSE handshake, not merely a parsed file. **Unlike Antigravity, OpenCode really
   >   does read a workspace-scoped config.** The two harnesses are opposites on this point, which is
   >   worth stating plainly in SETUP.md so nobody generalises from one to the other.
   >
   > Documented remote-server shape:
   >
   > ```json
   > {
   >   "$schema": "https://opencode.ai/config.json",
   >   "mcp": {
   >     "affinity": { "type": "remote", "url": "http://[::1]:6767/sse", "enabled": true }
   >   }
   > }
   > ```
   >
   > The field is **`url`**, not `serverUrl` — `serverUrl` is Antigravity's, and confusing the two
   > fails silently.

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
- **RESOLVED 12 Aug 2026: the mask task is burned too.** The preamble now carries the mask knowledge
  — `createReplaceBitmap` must be applied after the node reaches its final tree position, and mask
  format must match the layer's own `rasterInterface.format`, with M8 on a 16-bit document failing as
  `COMMAND_FAILED`. Exactly what Pro worked out. Do not use masks to measure a model.

- **Correction: `add_sdk_hint` and `search_sdk_hints` are different stores.** `search_sdk_hints`
  queries a **global** pool that returned **empty** on five separate queries, while added hints come
  back through the **`preamble`**. An empty search is therefore *not* evidence a task is clean —
  read the preamble itself. This was mis-stated earlier in this file's history.

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

## Re-test result — 12 Aug 2026, OpenCode CLI 1.18.7, DeepSeek V4 Flash Free

Run from a **fully clean machine**: OpenCode uninstalled, all four data directories deleted
(`.config`, `.cache`, `.local/share`, `.local/state`), then reinstalled. No stored credentials, no
prior config, empty project folder.

**Setup — manual, and it worked first time.**

- Workspace-root `opencode.json` with `{"mcp": {"affinity": {"type": "remote", "url":
  "http://[::1]:6767/sse", "enabled": true}}}`.
- `opencode mcp list` → `✓ affinity connected`. A live handshake, not just a parsed file.
- All **11 tools** reached the model, namespaced **`affinity_*`** (Claude Code uses
  `mcp__affinity__*`). Same 11 as every other harness — nothing added by the Script Manager app.

**Complex masked task — PASSED.** Given the same verbatim prompt Pro got on Claude Code, it produced
two adjustment layers each carrying a **real pixel mask**, confirmed visually in Affinity's Layers
panel as mask thumbnails with visible gradients.

Interpretation differed from Pro's, both valid: Flash chose **Vibrance + Brightness/Contrast and
masked both**; Pro chose **two Selective Colour layers and masked only the top one**.

**This answers the question the leg exists for.** The old results conflated harness and model. Here
the *same model family* on the *same task* with the *same preamble knowledge* differed only by
harness — and OpenCode delivered SDK context to the model just as effectively as Claude Code did.
**There is no evidence OpenCode degrades the model's SDK accuracy.** The original suspicion behind
the archived numbers is not supported.

**Behaviour matched Claude Code's, too.** It read the documentation list, read the `preamble`, and
tried five separate query formulations against `search_sdk_hints` before concluding the pool was
empty — then reported the global-versus-local distinction honestly instead of glossing it. The
read-before-execute disposition survives the harness change.

**It verified the mask numerically — the best behaviour observed on any leg.** Rather than trusting
the script's success line or reaching for a render it cannot see, it measured the composite-vs-base
pixel difference in bands and reported the gradient working: **18.7 at the top, 0.9 at the bottom.**
It also stated plainly that the render succeeded but it could not view images, so the numeric check
was the confirmation.

This is a direct answer to the silent-no-op problem that has shadowed every leg — the copy-on-get
`masterSpline` class of bug, where a script reports success and the document is unchanged. **A model
can prove its own work by measuring pixels.** Compare Pro on Claude Code, which called
`render_spread` to "confirm" an image it equally could not see. Worth pushing into `SETUP.md` as the
recommended way to verify a script, since it does not depend on the user looking.

It correctly used **M8** to match the 8-bit document — the format rule from the preamble, applied
rather than merely recited.

**Cost: $0, but the free tier is quota-limited.** `DeepSeek V4 Flash Free` needs no API key, which
re-verifies the archived claim that OpenCode offers a genuinely free path. New detail: the complex
masked task consumed **~100K tokens, roughly half the free allowance**. So the free tier is good for
about two tasks of that size — ample to prove the connection works, not enough for a working
session. That nuance was missing from the original "$0 smoke test" claim.

## Agent-driven run — PASSED, 12 Aug 2026

Second pass, after the manual test proved the config shape and `SETUP.md`'s OpenCode row was written
from it. Fresh empty folder, the harness-agnostic prompt only.

**Part 1 — all five checks.** Self-identified as OpenCode from §2's table unprompted; wrote
`opencode.json` in the **project folder**; used `url` and `"type": "remote"`; did **not** reach for
the dead `opencode mcp add`; explained the restart as "expected, not a fault".

**It diagnosed the IPv6 trap unaided.** Its first probe reported port 6767 not listening — the
classic false negative — and instead of concluding Affinity was broken it re-queried by process ID,
found `::1:6767`, and confirmed with `Test-NetConnection`. That is the single most common failure in
this integration, caught without help. It also used `-OutFile` so fetched bytes went straight to
disk rather than through the model, per SETUP.md's rule.

**Part 2 — passed, and notably without a handoff note.** Every other harness's section instructs the
agent to leave one, because the restart wipes context. **The OpenCode section has no such step**, and
it did not need one: the restarted session read the directory, `SETUP.md`, `opencode.json` and
`examples/`, then concluded *"The config file already exists, so I'm the Part 2 session"* purely by
inference. It then read the preamble, confirmed 11 `affinity_*` tools, read
`inspect-document.js` before running it, reported the stack correctly, and offered all three options
verbatim without choosing.

**Option 1 (supplied colour-boost script) ran and was confirmed in Affinity** — save to library, run,
pixels changed. The transport is proven end to end on the agent-driven path, not just the manual one.

**Judgement on the missing handoff step: leave it out for now, but know it is inference, not
instruction.** It worked here on a capable model with `SETUP.md` sitting on disk. A weaker model may
not make the leap. If a future OpenCode run gets lost after the restart, adding an `AGENTS.md`
handoff note — the convention OpenCode reads, already used in this repo for Antigravity — is the fix.

**Harness quirk:** OpenCode's WebFetch failed outright on `github.com` with a transport error; the
model recovered by going to `raw.githubusercontent.com`, trying both `main` and `master`. Claude Code
fetched the GitHub HTML fine. The recovery was the model's doing, not the harness's.

## What stayed in the docs

The DeepSeek-via-Claude-Code redirect is **not** part of this leg and was deliberately kept:
DeepSeek publishes an Anthropic-compatible endpoint, so Claude Code can be pointed at it with
environment variables, using `.mcp.json` and the already-proven Claude Code connection. That row
never depended on OpenCode.
