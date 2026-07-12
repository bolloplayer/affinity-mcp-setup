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
> documented for **Claude Desktop** — and that route handles the scripting loop well. But most
> third-party Affinity tooling targets **macOS** and drives the app through AppleScript/UI
> automation, and the combination this repo covers — **Windows + Claude Code + Affinity's real
> scripting SDK** — is barely documented anywhere, even though it needs no extra software at
> all. What Claude Code adds over the official route isn't the loop; it's the **folder** — see
> below.

---

## What you get

- A **one-file `.mcp.json`** that points Claude Code straight at Affinity — identical on every
  machine (no absolute paths), so it can live in your repo and sync across PCs.
- A **`verify.ps1`** environment checker that tells you *before* you start Claude Code whether
  the connection will come up.
- A **[`CLAUDE.md`](CLAUDE.md)** that briefs Claude on the connection internals, so you can ask
  it to diagnose problems ("why are the Affinity tools missing?") instead of reading protocol
  docs yourself.
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

## Why Claude Code instead of Claude Desktop? The folder.

Claude Desktop has two tabs. **Home** is the chat: it talks to Affinity through the official
connector and runs the same describe → run → check → improve loop — we verified it end to end,
but you re-attach your files every conversation and it doesn't read `CLAUDE.md` on its own.
**Code** is Claude Code — the same agent you get in VS Code or a terminal — and it works
**inside a project folder that remembers**:

```
my-affinity-project/
├── .mcp.json     ← the connection — one file, done once, syncs via git
├── CLAUDE.md     ← your goals & project quirks — Claude reads it every session
├── scripts/      ← every look Claude writes for you, versioned with history
├── exports/      ← renders, before/afters, batch output
└── notes.md      ← what worked and what didn't — knowledge that compounds
```

Open a new session and Claude already knows the project: the goals from `CLAUDE.md`, last week's
scripts, the SDK dead-ends already mapped in your notes. And because Claude Code has your
**shell**, the work doesn't stop at Affinity's edge — the before/after showcase in
[`examples/`](examples/) was exported from Affinity by script, composited side-by-side with
PowerShell, and committed to git, all in one request. Scripts, images, config, and knowledge
live together, so the project gets smarter every session instead of restarting from zero.

---

## Requirements

| Item | Requirement | Notes |
|---|---|---|
| Affinity Photo | Installed and **running**, MCP toggle **on** | Enable at `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP` |
| [Claude Code](https://claude.com/claude-code) | Terminal CLI (`claude`), the VS Code extension (`anthropic.claude-code`), **or** the **Code tab** in the Claude Desktop app | All three read the same `.mcp.json` — pick whichever you work in ([install instructions](https://docs.claude.com/en/docs/claude-code/setup)) |

That's all. No Node.js, no Claude Desktop, no extra software. (Affinity's server listens on IPv6
loopback, which is on by default in Windows — the technical details live in
[`CLAUDE.md`](CLAUDE.md), so you can just ask Claude if the connection misbehaves.)

---

## Quick start

0. **Open Affinity with your image** and check that the MCP server is enabled:
   `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`. Leave Affinity open.

1. **Clone this repo and start Claude Code in it:**

   ```
   git clone https://github.com/bolloplayer/affinity-photo-claude-code-windows.git
   cd affinity-photo-claude-code-windows
   claude
   ```

   Approve the `affinity` MCP server when prompted.

   *Using the VS Code extension instead?* Open the cloned folder in VS Code and open a Claude
   Code chat from there — the extension reads the same `.mcp.json` and shows the same approval
   prompt. If the folder was already open in VS Code, reload the window first
   (`Ctrl+Shift+P → Developer: Reload Window`) so the config is picked up.

2. **Run `/mcp`** to check the MCP status — and, if needed, connect. (Same command in the CLI
   and in the extension's chat.)

3. **Tell Claude** to run [`examples/color-boost.js`](examples/color-boost.js) on the image you
   opened in Affinity, and watch the adjustment layer appear.

4. **From here on, code away** — describe what you want ("add a curves adjustment", "render the
   current image", "save this script to the library") and Claude drives Affinity through
   `execute_script`, `render_spread`, `save_script_to_library`, and friends.

Something not connecting? Run [`verify.ps1`](verify.ps1) to check the environment
(`powershell -ExecutionPolicy Bypass -File .\verify.ps1` if Windows blocks scripts).

**Using the Code tab inside the Claude Desktop app?** The Affinity connector you set up for the
Home tab serves the Code tab too — ask Claude to *"connect to the Affinity server"*, then search
for the **Affinity Connector** in the dialog it shows and approve the connection; no `.mcp.json`
needed (verified from an empty folder). The file below remains required for the terminal CLI and
the VS Code extension.

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

Keep the URL exactly as written — Affinity's server only answers on `[::1]` (IPv6 loopback), not
`localhost` or `127.0.0.1`.

---

## Troubleshooting

First move: type `/mcp` in Claude Code and reconnect `affinity` — it fixes most cases (resumed
chats, Affinity restarted mid-session). If tools are still missing, make sure Affinity was running
*before* Claude Code started, then restart Claude Code (CLI: relaunch `claude`; VS Code: reload
the window). `ECONNREFUSED` on `[::1]:6767` means Affinity isn't running or the MCP toggle is off.

For anything deeper, run [`verify.ps1`](verify.ps1) — or just describe the symptom to Claude:
[`CLAUDE.md`](CLAUDE.md) gives it the full connection internals (IPv6 binding, SSE handshake,
stale-session causes), so it can diagnose from inside the chat.

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
