# Affinity Photo + Claude Code on Windows

**Affinity's scripting, made easier.** Tell Claude Code what you'd like to script — "boost the
colours", "add a gentle S-curve", "sharpen this for print" — and it writes the script, runs it
live in Affinity Photo, and renders the result so you can both see what happened. Not quite
right? Say so, and it adjusts and runs again. **Describe → run → check → improve**, in a tight
loop, until the effect is yours. Keepers go into Affinity's script library and live in a normal
git repo.

The whole integration is one small config file: Claude Code talks directly to **Affinity
Photo's built-in MCP server** on **Windows**. Nothing else to install, nothing to run in
between.

> **Why this repo exists.** Affinity's AI Connector (free beta, Canva-owned) is officially
> documented for **Claude Desktop**, and most third-party Affinity tooling targets **macOS**
> and drives the app through AppleScript/UI automation. The combination this repo covers —
> **Windows + Claude Code + Affinity's real scripting SDK** — is barely documented anywhere,
> even though it needs no extra software at all.

---

## What you get

- A **one-file `.mcp.json`** that points Claude Code straight at Affinity — identical on every
  machine (no absolute paths), so it can live in your repo and sync across PCs.
- A **`verify.ps1`** environment checker that tells you *before* you start Claude Code whether
  the connection will come up.
- **SDK field notes** ([`docs/sdk-notes.md`](docs/sdk-notes.md)) — confirmed behaviours and
  dead-ends so you don't rediscover them the hard way.
- Minimal, **verified example scripts** ([`examples/`](examples/)) — a read-only connection
  check, and a one-layer **Color Boost** effect you can run on any photo.

## What this is NOT

- Not a new MCP server — it uses the one **built into Affinity Photo**. You enable a toggle; there
  is nothing to install server-side.
- Not UI automation — it drives Affinity's **JavaScript scripting SDK** (real document/layer/filter
  APIs), not menu clicks.
- Not another macOS-only tool — this guide targets **Windows**, which existing tooling mostly
  skips. (Affinity exposes the same server on macOS, but only Windows is verified here.)

---

## Requirements

| Item | Requirement | Notes |
|---|---|---|
| Affinity Photo | Installed and **running**, MCP toggle **on** | Enable at `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP` |
| IPv6 loopback (`::1`) | Enabled (Windows default) | Affinity binds `[::1]:6767` **only** — IPv4 is refused |
| Claude Code | Terminal CLI (`claude`) **or** the VS Code extension (`anthropic.claude-code`) | Both read the same `.mcp.json` — pick whichever you work in |
| Node.js | Not required | Only `verify.ps1`'s optional handshake probe uses it (skipped if absent) |

Claude Desktop is **not** required.

---

## Quick start

0. **MCP server in Affinity is enabled** — `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable
   Affinity MCP`, and Affinity stays open.

1. **In a clone of this repo, start Claude Code:**

   ```
   claude
   ```

   Approve the `affinity` MCP server when prompted.

2. **Run `/mcp`** to check the MCP status — and, if needed, connect.

3. **Tell Claude** to run [`examples/color-boost.js`](examples/color-boost.js) on the image you
   opened in Affinity, and watch the adjustment layer appear.

4. **From here on, code away** — describe what you want ("add a curves adjustment", "render the
   current image", "save this script to the library") and Claude drives Affinity through
   `execute_script`, `render_spread`, `save_script_to_library`, and friends.

Something not connecting? Run [`verify.ps1`](verify.ps1) to check the environment
(`powershell -ExecutionPolicy Bypass -File .\verify.ps1` if Windows blocks scripts).

Working in your own project instead of a clone? Copy this repo's [`.mcp.json`](.mcp.json) to its
root — it has no machine-specific paths, so it works verbatim on any machine:

```json
{
  "mcpServers": {
    "affinity": {
      "type": "sse",
      "url": "http://[::1]:6767/sse"
    }
  }
}
```

---

## Why IPv6 / `[::1]` (not optional)

Affinity binds an IPv6 loopback socket only. Direct probes:

```
127.0.0.1:6767  →  ECONNREFUSED
localhost:6767  →  ECONNREFUSED   (resolver may pick IPv4 first)
[::1]:6767      →  HTTP 200        (SSE handshake)
```

So the `.mcp.json` URL **must** use `http://[::1]:6767/sse`. If `[::1]` is unreachable, IPv6 is
disabled at the OS level — check `Get-NetAdapterBinding -ComponentID ms_tcpip6`.

The MCP-over-SSE handshake, for reference:

```
GET  http://[::1]:6767/sse           Accept: text/event-stream
   → 200, content-type: text/event-stream
   → event: endpoint
   → data:  /message?session_id=<UUID>
POST http://[::1]:6767/message?session_id=<UUID>   ← JSON-RPC requests
   ← responses arrive on the SSE stream (event: message)
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Affinity tools missing but `verify.ps1` is all green | SSE connection detached from the session (e.g. a resumed chat) | Type `/mcp` in the Claude Code prompt → reconnect `affinity`. Try this first |
| Tools missing at startup | Affinity wasn't running when Claude Code started | Open Affinity, then restart Claude Code (CLI: relaunch `claude`; VS Code: reload the window) |
| Tools connect but hang | Affinity was restarted after Claude Code connected → stale session | `/mcp` → reconnect, or restart Claude Code |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or MCP toggle off | Restart Affinity, confirm the MCP toggle |
| `ECONNREFUSED` on IPv4 only | **Expected** — Affinity is IPv6-only | The URL already uses `[::1]` |

---

## The preamble, every session

Affinity's MCP server emits a system-reminder at the start of every session requiring you to read
the `preamble` doc before any `execute_script` call. Do it — the response also carries accumulated
**SDK hints** from prior sessions (API-shape gotchas, format rules, etc.) that save real debugging
time. If a script solves a non-obvious SDK problem, record it back with `add_sdk_hint`.

---

## Status & caveats

- **Verified on:** Windows 11, Affinity Photo 3.2.x, Claude Code as both the terminal CLI and
  the VS Code extension. Read, write (undoable commands), `render_spread`, library list/read,
  and SDK docs all confirmed end-to-end.
- **Beta software.** Affinity's AI Connector is a free beta and Canva-owned; its APIs and the
  scripting SDK may change without notice. Treat version-specific details as a snapshot.

## License

MIT — see [`LICENSE`](LICENSE).

## Acknowledgements

Built against Affinity Photo's built-in MCP server (Affinity / Canva). This project is
independent and not affiliated with or endorsed by Canva or Affinity.
