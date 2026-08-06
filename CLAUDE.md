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

## Three-leg re-test — done

All three harnesses verified against **`bolloplayer/affinity-mcp-setup`**: Claude Code, Codex
(ChatGPT app), and Antigravity (Gemini) connect, survive the restart/handoff-note, and reach the
two-option menu.

**A single harness-agnostic prompt works for all three** — good for a public post, since it means
one instruction rather than three:

> Set up the Affinity MCP connection following https://github.com/bolloplayer/affinity-mcp-setup's
> SETUP.md.

It self-identifies which harness it's in from the table in `SETUP.md` §2 and writes only that
harness's config, without being told which one it's running in.

**Antigravity's config location is global, not per-workspace — `SETUP.md` now reflects that.**
Antigravity has no per-workspace MCP config file; only a global one,
`~/.gemini/config/mcp_config.json` (or a plugin-scoped file), per Antigravity's own bundled docs.
The Antigravity section previously had agents write `.agents/mcp_config.json` into the workspace,
which Antigravity silently never read — tools would never appear no matter how correctly that file
was written. Fixed in `SETUP.md`'s Antigravity §1: merge an `affinity` entry into the global file
instead. Verified live end-to-end on real Gemini after the fix — all 11 tools loaded, the preamble
read, and `inspect-document.js` ran successfully against a real open document.
