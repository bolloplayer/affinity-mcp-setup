# Connecting an AI agent to Affinity Photo's MCP server (Windows)

**If you are an AI agent reading this on a user's behalf: this file is the instruction sheet.**
Work through it in order — identify the harness you are running in, write that harness's config
file, then run the verification sequence at the end and show the user the result.

Affinity Photo v3 ships a **built-in MCP server**. There is nothing to install server-side: the
user enables a toggle, and your harness connects to a local socket. You then drive Affinity
through its real JavaScript scripting SDK (`execute_script`, `render_spread`,
`read_sdk_documentation_topic`, `save_script_to_library`, and friends) — not UI automation.

---

## 0. Prerequisites — check these before anything else

1. **Affinity Photo is running, with a document open.** The MCP server only listens while the app
   is open. If the user launched their CLI first, that is fine, but Affinity must be up before the
   connection is attempted.
2. **The MCP toggle is on:** `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`.
   If the user just flipped it, restart Affinity.
3. **The project folder sits under the Desktop** — `C:\Users\<you>\Desktop\my-project`. The MCP
   connection works from anywhere, but Affinity sandboxes **script** file access to the Desktop
   tree (`app.userDesktopPath`). A script that exports a render, writes a batch result or saves a
   file returns `NOT_ALLOWED` outside it. The verification sequence below does not need this —
   `render_spread` returns bytes over MCP — but the user's real work will. If the folder is
   elsewhere, say so now rather than after the first failed export.

The endpoint is always:

```
http://[::1]:6767/sse
```

---

## 1. Five rules — do not "correct" these

These are the failure modes that waste the most time. Every one of them looks like a bug you
should fix, and none of them is.

| Rule | Why |
|---|---|
| **Use `[::1]`, never `localhost` or `127.0.0.1`** | Affinity binds an **IPv6 loopback socket only**. `127.0.0.1:6767` returns `ECONNREFUSED` — that is expected behaviour, not a broken install. `localhost` depends on the resolver's IPv4/IPv6 preference and may silently fail. |
| **The transport is SSE, and only SSE** | Probed exhaustively: `/mcp`, `/`, `/streamable`, `/http` all return `404`. There is **no Streamable HTTP endpoint**. Any guide claiming a one-line `url = …` form for a Streamable-HTTP-only client is wrong. |
| **Affinity accepts MCP protocol `2025-11-25` only** | A client initializing with an older version gets `-32602 Unsupported protocol version`. This is not a URL, IPv6 or config error. See the Codex section. |
| **Read the `preamble` doc before your first `execute_script`** | The server requires it, and the gate is **per connection**, not per machine or per day: a new SSE session starts un-gated and `execute_script` returns `The preamble documentation topic has not yet been read` until you call it again. The response also carries accumulated SDK hints that materially reduce hallucinated API calls. Call `read_sdk_documentation_topic` with `filename: "preamble"`. |
| **Put the connection in the config file — never write ad-hoc connection code** | A config entry is read at startup, every session, forever. If the user has to reconnect manually each time, the config step was skipped. |

**Node.js is not required** for the connection itself — with exactly one exception, the Codex
bridge below. Never tell a user to install Node to fix a Claude Code, OpenCode or Antigravity
connection problem; it is never the fix.

---

## 2. Find your harness and write its config

Identify which harness you are running inside, then write **only** that row's file.

| Harness | Config file | Transport |
|---|---|---|
| **Claude Code** (CLI, VS Code ext, Desktop Code tab) | `.mcp.json` in the project folder | SSE native |
| **Codex** (CLI, ChatGPT Codex tab, IDE extension) | `~/.codex/config.toml` | stdio bridge → SSE |
| **Antigravity** (`agy`, Gemini) | `.agents/mcp_config.json` in the workspace | SSE native |
| **OpenCode** (any model) | `opencode.jsonc`, or one CLI command | SSE native |

### Claude Code

**Write `.mcp.json` in the project folder. Do not ask the user which scope they want** — a config
file in their own folder is the smallest, most reversible thing that works, and they can promote it
to machine-wide later from the menu in §3 once they have seen it working. Deciding scope is not a
question to put to someone who has not connected yet.

```json
{
  "mcpServers": {
    "affinity": { "type": "sse", "url": "http://[::1]:6767/sse" }
  }
}
```

No machine-specific paths, so the file works verbatim on any machine and can be committed.

<details><summary>Machine-wide instead — the upgrade, not the default</summary>

`claude mcp add --transport sse --scope user affinity http://[::1]:6767/sse` writes to
`~/.claude.json`, so every project on the machine gets the server. Check with `claude mcp list`;
`✔ Connected` means Affinity answered. Offer this **after** the connection is proven — it is
option 4 of the menu in §3 — not during first setup.

</details>

#### Fetch the files you need

An empty project folder has none of the repo's scripts, and the steps below run two of them. Before
the restart, download what you need into the folder — no clone required:

```
https://raw.githubusercontent.com/bolloplayer/affinity-photo-claude-code-windows/main/examples/inspect-document.js
https://raw.githubusercontent.com/bolloplayer/affinity-photo-claude-code-windows/main/examples/color-boost-two-layer.js
https://raw.githubusercontent.com/bolloplayer/affinity-photo-claude-code-windows/main/verify.ps1
```

Put the two scripts in `examples/` and `verify.ps1` in the folder root. If you cannot write files or
fetch URLs, say so and ask the user to clone the repo instead — do not skip ahead and improvise the
script contents from memory.

Now read on. This next part is where the setup usually stalls.

#### The restart is unavoidable. Plan for it.

**Whichever form you used, the Affinity tools do not exist in your current session.** Claude Code
loads MCP configuration at startup. Writing config mid-session registers nothing, and `/mcp`
cannot reconnect a server that was never registered — it retries *failed* servers and handles
OAuth, which is a different thing. A project server added this way reports
`⏸ Pending approval (run claude to approve)` until a new session picks it up.

This is the single most common way the setup stalls: the agent writes a correct config, finds it
has no tools, concludes something is broken, and starts debugging a transport that was fine.

**The whole setup therefore has two parts, and the restart is the door between them:**

| | | |
|---|---|---|
| **Part 1** — this session | write `.mcp.json`, fetch the scripts, run `verify.ps1`, leave the resume note | no Affinity tools exist yet |
| **↓ restart** | the user quits and relaunches; this is the only way across | |
| **Part 2** — the next session | §3: prove the connection, then offer the menu | Affinity tools are live |

Nothing in Part 2 can be done early, and nothing in Part 1 needs the tools. Get Part 1 completely
finished — config, scripts, `verify.ps1`, note — so the restart happens once and the next session
has everything it needs.

The Part 1 sequence:

1. Write `.mcp.json` in the project folder.
2. Fetch `examples/inspect-document.js`, `examples/color-boost-two-layer.js` and `verify.ps1`.
3. Run [`verify.ps1`](verify.ps1) — it confirms the endpoint, tools and open document from
   outside the session, so you know the config is good before anyone restarts anything.
4. **Leave a resume note** — see below. The session that comes back has none of your context.
5. **Tell the user to restart Claude Code** (`claude`, or reload the VS Code window), approving
   the server when prompted, and to type "continue".

Do not work around a missing server by writing your own SSE client. It appears to work, proves
nothing about the user's actual configuration, and costs far more time than the restart.

#### The resume note — do not skip this

A restart is a new session with an **empty context**. It will not know that a setup was underway,
what you already did, or that a verification sequence is waiting. Left to itself it greets the user
and does nothing, and the user has to explain the whole thing again.

Claude Code reads **`CLAUDE.md` from the project folder at startup**, automatically. That is the
handoff channel. Before you tell the user to restart, write one:

- **If the folder has no `CLAUDE.md`** (a fresh project), create it.
- **If one already exists**, append a section — never overwrite the user's own instructions.

Keep it short and imperative, so the next session acts instead of summarising:

```markdown
## Affinity MCP setup — resume here

State: the `affinity` MCP server was registered (user scope via `claude mcp add`,
or `.mcp.json` in this folder) and `verify.ps1` passed. The connection could not be
used in the session that registered it, because Claude Code loads MCP configuration
only at startup. This session is the restart.

You are Part 2. Part 1 (config, scripts, verify.ps1) is done. Do this now, without
waiting to be asked — but only Part A of §3. It is read-only.

1. Confirm the `affinity` MCP tools are present (11 of them).
2. `read_sdk_documentation_topic({ filename: "preamble" })` — the gate is per connection.
3. Run `examples/inspect-document.js` and report the Affinity version, the open
   document and its layer stack.

Then hand over: offer the user the four choices from SETUP.md §3 and let them pick.
Do not run the colour-boost script, or anything else that writes to their document,
until they ask. Follow SETUP.md from that point — do not invent your own step list.

Delete this section once you have offered the choices; the file too if nothing else
is left in it. Do not state what has or hasn't been done to the document — check the
layer stack yourself, because this note may be out of date.
```

**The note is disposable, and it has to say so.** It exists to survive one restart. Left behind, it
tells every future session to re-run a verification the user already watched, and it re-adds the
`Boost` and `Clean` layers to whatever document happens to be open. That is the failure mode: a
stale instruction that keeps executing. Make the deletion step part of the note itself, as above —
the session that acts on it is the one that must remove it.

#### What to tell the user before they restart

Your final message before the restart is the one place this can go wrong for them. To a user, an
agent that stops mid-task looks like an agent that failed — and a failure they caused. Say all
four of these, plainly:

1. **It worked.** The connection is registered and `verify.ps1` passed. Nothing is broken.
2. **Why the restart is needed** — Claude Code reads MCP configuration only at startup, so the
   server you just registered cannot load into this session. One sentence; no protocol detail.
3. **Exactly what to do**: quit, run `claude` again in this folder, approve the `affinity` server
   if prompted, then type "continue".
4. **That it is once** — with user scope, every future project has Affinity from its first
   message.

Do not end on a bare "please restart Claude Code". Users read that as the setup having failed,
and some will start over from scratch rather than restart.

### OpenCode

One command, no file editing:

```
opencode mcp add affinity --url "http://[::1]:6767/sse"
opencode mcp list          # should report: connected
```

### Antigravity (`agy`)

Create `.agents/mcp_config.json` in the workspace root. **The field is `serverUrl`, not `url`** —
using `url` prevents the SSE connection from being established:

```json
{
  "mcpServers": {
    "affinity": { "serverUrl": "http://[::1]:6767/sse" }
  }
}
```

### Codex — needs the bridge

Codex's `config.toml` accepts only **stdio** (`command` + `args`) or **Streamable HTTP** (`url`)
servers. SSE is not in the list, so Affinity's `/sse` URL cannot go into `url = …`. On top of
that, Codex initializes with protocol `2025-06-18` while Affinity accepts only `2025-11-25`.

A generic `mcp-remote` subprocess is **not sufficient** — it establishes the SSE transport
correctly and then passes Codex's incompatible initialization straight through, producing:

```text
-32602 Unsupported protocol version
{"supported":["2025-11-25"],"requested":"2025-06-18"}
```

Use this repo's custom bridge, [`bridge/affinity-codex-bridge.mjs`](bridge/affinity-codex-bridge.mjs).
It connects directly over SSE, accepts Codex's initialization, initializes Affinity separately with
`2025-11-25`, and reports Codex's requested version back to Codex. Only `initialize` is rewritten;
all other JSON-RPC messages pass through unchanged.

1. Install Node.js LTS (this is the one place the project needs it) and confirm `node --version`.
2. Sign in — `codex login` for a ChatGPT subscription, or set `OPENAI_API_KEY` for API billing.
   Model auth is entirely separate from the local Affinity connection.
3. Add to `%USERPROFILE%\.codex\config.toml`, preserving unrelated settings, with an **absolute**
   path:

   ```toml
   [mcp_servers.affinity]
   command = "node.exe"
   args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
   startup_timeout_sec = 30
   ```

4. Check with `codex mcp list`, then start a genuinely fresh Codex process or task. Note that
   `enabled` only means the config was loaded — successful tool discovery is what proves the
   handshake.

The bridge can be dropped only once Codex and Affinity share a protocol version and transport.

---

## 3. Verify — run this sequence and show the user the result

Do not report success until a script has actually executed. Connection state alone proves nothing.

Run this in a session that started **after** the config file existed — see the restart note in the
Claude Code section above. If you wrote `.mcp.json` earlier in this same session, stop here and ask
the user to restart; the steps below cannot pass without the real tools.

The sequence is in **two halves, and the split is deliberate**. Steps 1–3 are read-only: run them
without asking, because they change nothing and they prove the connection. Everything after that
writes to a photo the user has open, so it is **their** call — see "Stop here and offer the
choice" below. Do not run the whole thing as one sweep.

### Part A — prove the connection (read-only, run it)

**Step 1 — the tools are there.** List your MCP tools and confirm the Affinity server's tools
appear (there are 11, including `read_sdk_documentation_topic`, `execute_script` and
`render_spread`). If the harness reports "connected" but no tools appear, the handshake failed —
go to troubleshooting.

**Step 2 — read the preamble.** `read_sdk_documentation_topic({ filename: "preamble" })`. Required
before any script runs.

**Step 3 — a read-only script.** Run [`examples/inspect-document.js`](examples/inspect-document.js)
via `execute_script`. It reports the Affinity version, open documents, spreads and top-level
layers, and changes nothing. Expected shape:

```
=== Application ===
Product : Affinity 3.2.x ...
Open documents: 1
=== Current document ===
Spreads     : 1
Top layers  : 1
  [0] Background
```

### Hand over to the user here

The connection is proven, and that is a good place to pause. Everything below this point changes a
photo the user has open, so it is theirs to ask for. It is also the moment they get their bearings
in something they have never used — more useful than a finished result they didn't choose.

Report what Part A established — Affinity version, which document is open, its layer stack — then
offer these four, verbatim, and let them pick. Don't choose one for them, and don't run one ahead
of time to save a turn.

> **1 — Just check the connection.** Already done, above. Nothing was changed.
>
> Type `/mcp` yourself to see the `affinity` server and its status — that one is a Claude Code
> command, not something I can run.

> **2 — See what it can do (adds two layers to your open photo).**
>
> ```
> Run examples/color-boost-two-layer.js on the image I have open in Affinity. Render before
> and after, show me both, and confirm both layers landed — layer count and names, plus the
> mean pixel difference between the two renders. Finish with a short summary: what changed,
> at what opacity, and how to undo it.
> ```

> **3 — Write your own look.** The real loop, and where this starts paying off.
>
> ```
> Using examples/color-boost-two-layer.js as the template, write me a new adjustment script —
> <say what you want: a warm film look, a punchy black and white, a soft matte fade>. Read the
> SDK docs you need first, keep it idempotent so re-running replaces its own layers, and put
> the parameters at the top.
>
> Then run it, render before and after, and show me the comparison. Report on two things: how
> the code differs from color-boost-two-layer.js and why, and what the visual difference
> actually is — measured, not asserted. If it needs fixing, fix it and tell me what was wrong.
> ```

> **4 — Use Affinity from every folder, not just this one.** Setup put the connection in this
> folder. This promotes it machine-wide, so you never do it again.
>
> ```
> Register the Affinity MCP server at user scope instead of just this folder, then tell me what
> to delete and whether I need to restart.
> ```

If they pick 2 or 3, the remaining steps below are how you run it. If they pick 4, see the Claude
Code section. If they pick 1, you are done — say so and stop.

### Part B — only if the user asked for it

**Step 4 — capture the "before".** Call `render_spread` and keep the image. This is the
comparison baseline. It takes the document's `sessionUuid` (step 3 prints it) and a zero-based
`spread_index`, and returns **JPEG** — don't save the bytes as `.png`.

Check the layer stack from step 3 first. If `Boost` and `Clean` are already there from an earlier
run, this render is **not** a clean baseline — it already contains the effect, and comparing
against it will show no difference. Delete those two layers, re-render, and say why you did.

**Step 5 — a real edit.** Run
[`examples/color-boost-two-layer.js`](examples/color-boost-two-layer.js) via `execute_script`. It
adds **two** Selective Colour adjustment layers — `Boost`, which saturates the six colour ranges,
over `Clean`, which lifts the highlights and keeps the blacks solid. It prints:

```
Two-layer Color Boost added — Boost (strength 0.6, opacity 40%) over Clean (strength 0.25, opacity 30%)
```

Two layers rather than one is the point worth making to the user: each is a separate control, so
the colour and the tone can be tuned or switched off independently. That is the shape to copy when
building their own looks — one layer per idea.

Re-running replaces its own two layers rather than stacking, so iteration is safe. Both are
non-destructive adjustment layers: the pixels are untouched, and the user can undo with Ctrl+Z or
delete `Boost` and `Clean` in the Layers panel.

**Step 6 — capture the "after" and compare.** Call `render_spread` again and show the user both
renders side by side against the original. This is the payoff: it proves the whole chain — config,
transport, protocol, SDK, document write — and shows them what the setup is actually for.

Confirm the change rather than asserting it: re-run `inspect-document.js` to show the layer count
rose with `Boost` and `Clean` on top, and give a number — compare the two renders pixelwise.
Never describe a change you have not verified.

Then tell them it is tunable: `BOOST_OPACITY` and `CLEAN_OPACITY` at the top of the script, or just
drag either layer's opacity in Affinity. Point out that the two layers are independent — the colour
and the tone can be adjusted, or switched off, separately.

**Step 7 — clean up, and hand back.** Delete the resume note now that its job is done: remove the
"Affinity MCP setup — resume here" section from `CLAUDE.md`, and the file too if nothing else is
left in it. Left behind it re-runs this whole sequence on every future session, against whatever
document happens to be open.

Then remind the user of the choices they did not take — option 3 in particular, writing their own
look, is where the project starts paying off. Do not start it for them.

---

## 4. When it doesn't connect

| Symptom | Cause | Fix |
|---|---|---|
| **Tools missing right after you registered the server** | MCP config is loaded at startup. A server added mid-session was never registered, and `/mcp` only retries *failed* servers — it cannot load a new one | Restart Claude Code. Expected, not a fault — see the Claude Code section |
| `⏸ Pending approval (run claude to approve)` in `claude mcp list` | A project-scoped server from `.mcp.json` is waiting for interactive approval | Start a session and approve it. Confirms the config is valid, not broken |
| **The restarted session does nothing / doesn't know about the setup** | A restart starts with an empty context. Without a resume note there is nothing telling it a verification was pending | Write the setup state into the folder's `CLAUDE.md` **before** asking for the restart — Claude Code loads it at startup. See "The resume note" above |
| `NOT_ALLOWED` from a script doing file I/O | Affinity sandboxes script filesystem access to the Desktop tree | Move the project under `C:\Users\<you>\Desktop\`. Not a permissions bug — a location rule |
| Tools missing, everything else healthy | SSE stream detached (resumed chat, Affinity restarted mid-session) | Reconnect the MCP server first — in Claude Code, `/mcp`. Restarting the whole CLI is rarely necessary |
| `The preamble documentation topic has not yet been read` | The gate is per SSE connection; the preamble was read on a different one | Call `read_sdk_documentation_topic({ filename: "preamble" })` again on the current connection |
| Tools missing at startup | Affinity wasn't running when the harness started | Open Affinity, restart the harness |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or the MCP toggle is off | Start Affinity; confirm the toggle; restart Affinity if it was just changed |
| `ECONNREFUSED 127.0.0.1:6767` | Expected — wrong address family | Use `[::1]`. This is not a fault |
| `-32602 Unsupported protocol version` | Client initialized with an older MCP version | Codex: use the bridge. Others: check the harness's MCP version support |
| Config says `enabled` / `connected`, no tools | Config loaded, handshake failed | Check the startup log for the protocol error. Do not substitute a hand-written SSE client for the real test |
| `user cancelled MCP tool call` (`codex exec`) | Non-interactive approval policy; Affinity's tools publish no safety annotations | Use the interactive TUI. Not a bridge failure |
| Script runs but the layer lands inside a group | Affinity parents new layers into a topmost group | `color-boost-two-layer.js` detects and corrects this — copy its `addSelectiveColourLayer` helper |

On Windows, [`verify.ps1`](verify.ps1) checks everything independently of any harness, and is the
fastest way to tell a config problem from an Affinity problem. With Node.js present it performs the
real MCP handshake — `initialize` at `2025-11-25`, `tools/list`, reads the preamble, and runs one
read-only script — so it also confirms the tools work and a document is open. Without Node it falls
back to the plumbing checks (process, port, `.mcp.json`) and says so. Run it **before** starting the
session. If scripts are blocked:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

For Codex specifically, `node .\bridge\smoke-test.mjs` initializes through the bridge, lists the
real tools and reads the preamble without touching the document.

---

## 5. Writing scripts against the SDK

Every model tested shows the same pattern: **the architecture right, the API calls wrong.** They
know which adjustment layer to use and how to structure the work, then invent plausible SDK method
names or treat a read-only property as a setter. The Affinity SDK is new and thinly represented in
training data.

The fix is context, not a bigger model:

- Read the `preamble` every session, before the first script.
- Record non-obvious discoveries back with `add_sdk_hint` so the next session inherits them.
- Confirmed API shapes and mapped dead-ends live in [`docs/sdk-notes.md`](docs/sdk-notes.md).
- [`examples/color-boost-two-layer.js`](examples/color-boost-two-layer.js) is the template for a
  well-behaved script: parameters at the top, one layer per idea, undoable document commands,
  idempotent re-runs, a concise success message.

Expect simple scripts (one adjustment layer, set parameters, set opacity) to work first try, and
complex ones (pixel buffers, render engine, file I/O) to need a review pass on the specific API
calls.

---

## 6. Going further

- **[The step-by-step tutorial](https://bolloplayer.github.io/affinity-photo-claude-code-windows/)**
  — a human-facing walkthrough of the Claude Code path, with screenshots. Also covers pointing
  Claude Code at **DeepSeek** via its Anthropic-compatible endpoint, which keeps this exact
  connection and every config file unchanged while swapping the model underneath.
- **[`docs/choosing-your-ai.md`](docs/choosing-your-ai.md)** — which model, which harness, what
  each combination costs, and what has actually been verified versus assumed.
- **[`CLAUDE.md`](CLAUDE.md)** — connection internals (IPv6 binding, the SSE handshake, stale
  session causes) in a form an agent can diagnose from.

---

Affinity's AI Connector is a free, Canva-owned beta; its APIs and the scripting SDK may change
without notice. Verified on Windows 11 with Affinity Photo 3.2.x. Treat version-specific details as
a snapshot.
