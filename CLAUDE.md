# Project context for Claude

This repo connects Claude Code to **Affinity Photo's built-in MCP server** on Windows (SSE,
`http://[::1]:6767/sse`, configured in `.mcp.json`). Users script Affinity through the MCP tools
(`execute_script`, `render_spread`, `save_script_to_library`, `read_sdk_documentation_topic`, …).
When a user asks why the connection fails or how it works, the background below is the answer —
surface it as needed instead of making them read it up front.

## IPv6: why the URL is `[::1]`, not `localhost`

Affinity binds an **IPv6 loopback socket only**. Direct probes confirm:

```
127.0.0.1:6767  →  ECONNREFUSED
localhost:6767  →  ECONNREFUSED   (resolver may pick IPv4 first)
[::1]:6767      →  HTTP 200        (SSE handshake)
```

- The `.mcp.json` URL **must** be `http://[::1]:6767/sse`. Never "fix" it to `localhost` or
  `127.0.0.1` — that breaks the connection.
- `ECONNREFUSED` on an IPv4 address is **expected**, not an error.
- If `[::1]` itself is unreachable, IPv6 is disabled at the OS level. Check with
  `Get-NetAdapterBinding -ComponentID ms_tcpip6` (IPv6 on the loopback path is the Windows
  default, so this is rare).

The MCP-over-SSE handshake, for reference:

```
GET  http://[::1]:6767/sse           Accept: text/event-stream
   → 200, content-type: text/event-stream
   → event: endpoint
   → data:  /message?session_id=<UUID>
POST http://[::1]:6767/message?session_id=<UUID>   ← JSON-RPC requests
   ← responses arrive on the SSE stream (event: message)
```

Two details that matter when reading this stream directly (`verify.ps1`'s probe does both):

- **Frames are separated by CRLF**, so the terminator is `\r\n\r\n`. Splitting on `\n\n` never
  matches, the `endpoint` event is never seen, and the client hangs with no error — the GET still
  returned 200, which makes it look like a server problem. Normalise line endings before splitting.
- The stream emits periodic `event: heartbeat` frames. Ignore them; they are not JSON-RPC.

Note that a `200` on the GET only means the endpoint answered. It arrives before any MCP session
exists, so it is not evidence that `initialize` will succeed or that any tool is reachable.

## Node.js: not a requirement

Nothing in the integration needs Node. The only optional use is `verify.ps1`'s SSE handshake
probe, which is skipped with an informational note when Node is absent. Don't tell users to
install Node to fix a connection problem — it never is the fix.

## Diagnosing connection problems

`verify.ps1` at the repo root checks the plumbing (Affinity process, port `[::1]:6767` listening,
optional handshake probe, Claude Code present). If scripts are blocked:
`powershell -ExecutionPolicy Bypass -File .\verify.ps1`.

| Symptom | Cause | Fix |
|---|---|---|
| Tools missing in the session that created `.mcp.json` | The file is read at startup; a mid-session write registers nothing, and `/mcp` cannot reconnect a server that was never loaded | Restart Claude Code in that folder. Do not hand-roll an SSE client instead |
| Affinity tools missing but `verify.ps1` all green | SSE connection detached (e.g. resumed chat) | `/mcp` → reconnect `affinity`. Try this first |
| Tools missing at startup | Affinity wasn't running when Claude Code started | Open Affinity, restart Claude Code |
| Tools connect but hang | Affinity restarted after Claude Code connected → stale session | `/mcp` → reconnect, or restart Claude Code |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or MCP toggle off | Restart Affinity, confirm `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP` |

## Working with the SDK

- Read the `preamble` doc (`read_sdk_documentation_topic`, `filename: "preamble"`) once per
  session **before** any `execute_script` call — the server requires it, and the response carries
  accumulated SDK hints from prior sessions. The gate is tracked per SSE connection, so a
  reconnect means reading it again.
- `render_spread` takes `document_session_uuid` (from `doc.sessionUuid`) plus a zero-based
  `spread_index`, and returns **JPEG** bytes regardless of the document format.
- Record non-obvious SDK discoveries back with `add_sdk_hint`.
- Confirmed API shapes and known dead-ends live in `docs/sdk-notes.md`; example scripts in
  `examples/` (see `examples/README.md`).

## Project shape — settled, do not deviate

**This structure is fixed. Treat it as a constraint on any plan, not a snapshot to be improved on.**
Every part below is a deliberate decision, and several of them look like neglect to a fresh pair of
eyes. If a plan would add a leg, merge one, restructure the docs around a different spine, or
"tidy" any of the five items, that plan is wrong — raise it with the user instead of acting.

Five moving parts:

1. **Four legs plus an OpenCode section** — see the status table below. Two are untested.
2. **Two tutorial webpages, `docs/index.html` and `docs/deepseek.html`.** These are **relics**,
   kept deliberately as an extra route for readers who'd rather install by hand than point an agent
   at `SETUP.md`. **They are not maintained in step with the docs, and that is intentional** — a
   refresh pass is planned for the end of the project, not now. Do not "fix" their drift from
   `SETUP.md` or from `docs/choosing-your-ai.md` unless asked.
3. **The archived repo `bolloplayer/affinity-photo-claude-code-windows` is a tombstone.** It exists
   only so old links resolve and its README points at the live repo. Never publish content there.
4. **`.claude/skills/pages-traffic/`** measures whether anyone is reading the site. It targets the
   current repo (`affinity-mcp-setup`) plus the tombstone.
5. **The old Reddit posts are no longer relevant.** Don't treat referrer traffic from them as a
   signal worth chasing, and don't reintroduce Reddit-correlation reporting — it was retired
   deliberately in `035d2be`.

What *does* change within this structure: leg statuses as tests are run, cell contents in the
tables, and the archive files as findings are re-verified. The shape itself doesn't.

## Leg status — four legs plus the OpenCode ecosystem

A "leg" is one end-to-end path from a harness to a running script in Affinity. Three are done; the
fourth and the OpenCode ecosystem are queued for a clean test.

| Leg | What it is | Status |
|---|---|---|
| **Claude Code** | `.mcp.json`, SSE native | ✅ Done |
| **Codex** | `~/.codex/config.toml` + the stdio bridge | ✅ Done |
| **Antigravity** | global `~/.gemini/config/mcp_config.json`, SSE native | ✅ Done |
| **DeepSeek** | Claude Code redirected at DeepSeek's Anthropic-compatible endpoint | ⬜ To test |
| **OpenCode** *(ecosystem, not a vendor leg)* | multi-model harness, SSE native | ⬜ To test |

The two queued ones have had their prior findings pulled out of the docs and parked in
`archive/deepseek-leg.md` and `archive/opencode-leg.md`, so each test starts from a clean slate
rather than from half-remembered results. **Read the relevant archive file before starting a leg** —
it lists exactly which claims need re-verifying and which were never run at all.

Keep the two straight when testing: DeepSeek's leg runs *through Claude Code*, while OpenCode is a
harness in its own right. Some of the old model numbers were measured on OpenCode and then quoted as
DeepSeek results; that conflation is what the split is meant to fix.

**A single harness-agnostic prompt works for all three finished legs** — good for a public post,
since it means one instruction rather than three:

> Set up the Affinity MCP connection following https://github.com/bolloplayer/affinity-mcp-setup's
> SETUP.md.

It self-identifies which harness it's in from the table in `SETUP.md` §2 and writes only that
harness's config, without being told which one it's running in. Note that §2's table no longer has
an OpenCode row — restore one only when that leg passes.

**Antigravity's config location is global, not per-workspace — `SETUP.md` now reflects that.**
Antigravity has no per-workspace MCP config file; only a global one,
`~/.gemini/config/mcp_config.json` (or a plugin-scoped file), per Antigravity's own bundled docs.
The Antigravity section previously had agents write `.agents/mcp_config.json` into the workspace,
which Antigravity silently never read — tools would never appear no matter how correctly that file
was written. Fixed in `SETUP.md`'s Antigravity §1: merge an `affinity` entry into the global file
instead. Verified live end-to-end on real Gemini after the fix — all 11 tools loaded, the preamble
read, and `inspect-document.js` ran successfully against a real open document.

## Publishing to the public repo

This repo (`affinity-mcp-setup-private`) is the private/working one — it's where
testing, debugging narrative, and this file live. **`bolloplayer/affinity-mcp-setup`** (remote
`public`) is what Reddit/tutorial readers actually clone. Never push this repo's branch there
wholesale — it pulls in `CLAUDE.md` and whatever else this repo happens to be carrying.

Only these paths belong in the public repo: `SETUP.md`, `README.md`, `docs/`, `examples/`,
`bridge/`, `handoff/`, `verify.ps1`, `LICENSE`. **Never push `CLAUDE.md`** — it's private working
context, not user-facing setup content. **`archive/` is private-only too** — it holds the retired
findings for legs being re-tested from scratch (see `archive/opencode-leg.md`), which is working
history rather than setup content. **Never commit a real `.mcp.json` or
`.agents/mcp_config.json`** (or any other generated config) — the setup instructions tell users to
create these themselves, so a pre-existing copy in the repo contradicts that and can go stale
(both are now gitignored in the public repo to catch this).

Process for pushing a fix over:

```
git worktree add "$TEMP/agy-public-sync" public/main
cp <files-you-changed> "$TEMP/agy-public-sync/"
cd "$TEMP/agy-public-sync" && git status --short   # review before staging
git add <specific files> && git commit -m "..."
git push public HEAD:main
cd - && git worktree remove "$TEMP/agy-public-sync" --force
```

Never merge private `main` into public `main`, and never `git push public main` from this repo's
own working tree — always stage the copy in a disposable worktree first so only the intended files
move across.
