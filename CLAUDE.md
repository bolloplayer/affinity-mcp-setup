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

## Three-leg re-test status

The setup instructions moved to the public repo **`bolloplayer/affinity-mcp-setup`** (this repo
stays private/working; the old `affinity-photo-claude-code-windows` repo is archived). Re-verifying
all three harnesses against the cleaned-up `SETUP.md` there:

- ✅ **Claude Code, reconnect path** — re-tested. Both menu options ran clean (colour boost, and a
  black-and-white script written from scratch against the SDK docs). Found and fixed a real
  `verify.ps1` bug along the way: its port check parsed `netstat`'s localized state text, which
  fails on non-English Windows. This pass reused a folder whose `.mcp.json` already existed, so it
  only exercised `/mcp` reconnect — not the restart+handoff-note path.
- ✅ **Claude Code, restart/handoff-note path** — observed and passing. A fresh folder
  (`affinity-mcp-restart-test`, since deleted) went through Part 1 from scratch, and the restarted
  session read the `CLAUDE.md` note off a bare "resume" and did Part A unprompted. It surfaced a
  real gap — no local `SETUP.md`, so it correctly refused to invent the three-choice menu and asked
  instead — fixed by making both handoff-note templates self-contained (menu text embedded
  directly) and adding `SETUP.md` to both fetch lists. Confirmed fixed on re-fetch.
- ✅ **Codex, ChatGPT desktop app (Codex tab)** — full pass, no doc bugs found. Bridge smoke test
  passed, config written with the idempotent duplicate-check the doc doesn't even mandate, handoff
  note correctly placed in the parent folder (it cloned into a subfolder), restart worked, Part A
  ran with correct subfolder-relative paths, the two-choice menu appeared verbatim and correctly
  *without* option 3 (doc says machine-wide registration doesn't apply to Codex). Both demo scripts
  ran clean, and a follow-up ad-hoc request ("put them back in the library") correctly triggered
  only `save_script_to_library`, not a re-run — it kept the save-vs-execute distinction straight
  outside the scripted flow. Codex CLI itself (as opposed to the ChatGPT app's Codex tab) not
  separately tested — same config file and bridge, so treat as covered by inheritance, not verified
  independently.
- ⬜ **Antigravity** — not yet re-tested against the new repo.

Antigravity needs its own CLI/session to test — not available from a Claude Code session. Update
this section as it's re-run.
