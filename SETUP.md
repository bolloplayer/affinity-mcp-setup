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
   file returns `NOT_ALLOWED` outside it. The verification sequence below never writes a file, so it
   does not need this — but the user's real work will. If the folder is elsewhere, say so now rather
   than after the first failed export.

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
| **The transport is SSE, and only SSE** | There is **no Streamable HTTP endpoint**. Any guide claiming a one-line `url = …` form for a Streamable-HTTP-only client is wrong. |
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
| **Antigravity** (`agy`, any model it fronts — not only Gemini) | `.agents/mcp_config.json` in the workspace | SSE native |
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
option 3 of the menu in §3 — not during first setup.

</details>

#### Fetch the files you need — Claude Code only

> **If you are not Claude Code, this block is not for you.** It fetches `verify.ps1`, which other
> harnesses should not run, and it feeds into the `.mcp.json` / §3 / three-option flow below, which
> is Claude Code's. Antigravity readers in particular: go back to your row in the table above.

An empty project folder has none of the repo's files, and the steps below need them — including
this file itself: the restarted session in Part 2 has an empty context and no way to re-derive
`SETUP.md`'s contents, so fetch a copy into the folder now rather than leaving it to guesswork
later. Download everything straight to disk before the restart — no clone required:

```powershell
$raw = "https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main"
New-Item -ItemType Directory -Force -Path examples | Out-Null
Invoke-WebRequest -Uri "$raw/SETUP.md"                          -OutFile SETUP.md                          -UseBasicParsing
Invoke-WebRequest -Uri "$raw/examples/inspect-document.js"      -OutFile examples/inspect-document.js      -UseBasicParsing
Invoke-WebRequest -Uri "$raw/examples/color-boost-two-layer.js" -OutFile examples/color-boost-two-layer.js -UseBasicParsing
Invoke-WebRequest -Uri "$raw/verify.ps1"                        -OutFile verify.ps1                        -UseBasicParsing
```

**Never read a file into your context and write it back out.** `-OutFile` puts the bytes on disk
untouched; re-emitting them from memory has produced files at a fraction of their real size in
testing — valid syntax, wrong contents, silent failure. If you cannot write files or fetch URLs, say
so and ask the user to clone the repo. Do not improvise the script contents.

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
| **Part 1** — this session | write `.mcp.json`, fetch the scripts, run `verify.ps1`, leave the handoff note | no Affinity tools exist yet |
| **↓ restart** | the user quits and relaunches; this is the only way across | |
| **Part 2** — the next session | §3: prove the connection, then offer the menu | Affinity tools are live |

Nothing in Part 2 can be done early, and nothing in Part 1 needs the tools. Get Part 1 completely
finished — config, scripts, `verify.ps1`, note — so the restart happens once and the next session
has everything it needs.

The Part 1 sequence:

1. Write `.mcp.json` in the project folder.
2. Fetch `SETUP.md`, `examples/inspect-document.js`, `examples/color-boost-two-layer.js` and
   `verify.ps1`.
3. Run [`verify.ps1`](verify.ps1) — it confirms the endpoint, tools and open document from
   outside the session, so you know the config is good before anyone restarts anything.
4. **Leave a handoff note** — see below. The session that comes back has none of your context.
5. **Tell the user to restart Claude Code** (`claude`, or reload the VS Code window), approving
   the server when prompted, and to type "continue".

Do not work around a missing server by writing your own SSE client. It appears to work, proves
nothing about the user's actual configuration, and costs far more time than the restart.

#### The handoff note — do not skip this

A restart is a new session with an **empty context**. It will not know that a setup was underway,
what you already did, or that a verification sequence is waiting. Left to itself it greets the user
and does nothing, and the user has to explain the whole thing again.

Claude Code reads **`CLAUDE.md` from the project folder at startup**, automatically. That is the
handoff channel. Before you tell the user to restart, write one:

- **If the folder has no `CLAUDE.md`** (a fresh project), create it.
- **If one already exists**, append a section — never overwrite the user's own instructions.

Keep it short and imperative, so the next session acts instead of summarising:

```markdown
## Affinity MCP setup — continue here

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

Then hand over — report what step 3 established, then offer these three, verbatim,
and let them pick. Don't choose one for them, don't run one ahead of time, and say
they can also stop here with nothing changed:

> 1 — Run the colour boost script. I add it to Affinity's Script View and run it on
> your open image, then tell you the name it's listed under. Switch to Affinity and
> see the result yourself.
>
> 2 — Have me write one from scratch. I write a black-and-white conversion against
> the SDK, add it to your Script View and run it. Switch to Affinity and see the
> result yourself.
>
> 3 — Use Affinity from every folder, not just this one. Registers the connection
> machine-wide instead of just here.

`SETUP.md` should be in this folder (Part 1 fetches it) — read its §3 for the exact
run steps once they pick 1 or 2. If it isn't here for any reason, fetch it from
`https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/SETUP.md`
rather than inventing steps; do not run the colour-boost script, or anything else
that writes to their document, until they ask.

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

### Antigravity (`agy`) — follow these seven steps, in order

**Antigravity needs no bridge.** It speaks a protocol version Affinity accepts and connects over
native SSE straight from its config file. It is the simplest non-Claude path — so do not go looking
for a bridge to build.

**This section is complete on its own.** Everything you need is in these seven steps, including the
two options to offer the user at the end. Do not jump to §3, and do not follow the Claude Code
section — an agent that navigates away from this section tends to lose track of where it was and
start inventing config files. If you only read one part of this document, read this one, and follow
it top to bottom.

**Two files in this repo belong to Claude Code, not to you:**

| File | Why it is not yours |
|---|---|
| `.mcp.json` | Claude Code's config format. Antigravity never reads it. **Never create one.** |
| `verify.ps1` | A Claude Code preflight. Its output literally says *"Affinity ↔ Claude Code environment check"* and it reports a missing `.mcp.json` as a problem. **Do not run it and do not ask the user to run it.** |

You do not need an external check. **Assume the connection is up** if Affinity is running with a
document open and the MCP toggle is on (§0). Step 5 proves it from inside the session, which is the
only place that matters, and it needs no PowerShell.

#### Step 1 — write the config

Create `.agents/mcp_config.json` in the workspace root. **The field is `serverUrl`, not `url`** —
`url` prevents the SSE connection from being established and fails silently, with nothing in any
log:

```json
{
  "mcpServers": {
    "affinity": { "serverUrl": "http://[::1]:6767/sse" }
  }
}
```

No machine-specific paths, so it works verbatim on any machine.

**If your file-writing tool refuses the path, shell out — don't keep retrying it.** Some
Antigravity installs scope the built-in write tool to its own artifacts directory, which will not
write into the user's workspace. The way through is PowerShell via the shell tool:

```
powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path '<workspace>/.agents' | Out-Null"
```

Ask the user for permission on the workspace folder once, up front, rather than per file.

**A silent redirect is worse than a refusal, and it is not a success.** Observed at least once:
the write tool reported success, but the config, the cloned repo and the handoff note all landed
under Antigravity's own internal state directory (`~/.gemini/antigravity/scratch/...`) instead of
the folder the user actually opened — with no error, and the agent then asked the *user* to switch
their workspace to match, rather than the other way round. Do not do that. After writing
`.agents/mcp_config.json`, confirm it exists at the literal workspace path the user is in —
`Test-Path '<workspace>/.agents/mcp_config.json'` — before moving on. If it is missing there
(even though the write tool claimed success), the write went into a scratch directory: shell out
with the `New-Item`/`Set-Content` PowerShell pattern above, using the workspace's real absolute
path, and verify again. The user's folder does not move to wherever your tools find it convenient
to write.

#### Step 2 — get the files. The bytes must never pass through you

Step 5 and the options in step 6 run scripts from this repo, and an empty workspace has none of them.

**The rule is not "clone rather than fetch" — it is that you never emit a file's contents.** Any
method where the bytes go from the network straight to disk is fine:

```powershell
$raw = "https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main"
New-Item -ItemType Directory -Force -Path examples | Out-Null
Invoke-WebRequest -Uri "$raw/SETUP.md"                          -OutFile SETUP.md                          -UseBasicParsing
Invoke-WebRequest -Uri "$raw/examples/inspect-document.js"      -OutFile examples/inspect-document.js      -UseBasicParsing
Invoke-WebRequest -Uri "$raw/examples/color-boost-two-layer.js" -OutFile examples/color-boost-two-layer.js -UseBasicParsing
```

Fetch `SETUP.md` itself too, not just the scripts — the handoff note in step 3 points back to its
Antigravity section, and the restarted session has no way to re-derive that content on its own.
`git clone https://github.com/bolloplayer/affinity-mcp-setup` is equally fine — then use paths
relative to where `agy` is running, `affinity-mcp-setup/examples/…` rather than a bare `examples/…`.

**What fails is reading a file into your context and writing it back out.** Reconstructions from
memory come out a fraction of their real size — plausible, syntactically valid, and wrong: a rebuilt
`verify.ps1` can print an invented success line, and a rebuilt colour-boost script can end up with
zero real `executeCommand` calls, driving nothing at all. If you find yourself typing the body of a
file you just read into a here-string, stop and re-download it to disk instead.

Do not fetch `verify.ps1` at all on this path — see above.

**One exception, and it is not really one.** This rule is about *creating files on disk*. Later,
`execute_script` takes the **script source as an argument**, not a file path — so reading
`examples/inspect-document.js` and passing its contents to the tool is correct and required. Reading
a file in order to write it back to disk is the thing that fails; reading it in order to hand it to
Affinity is the job.

#### Step 3 — write the handoff note. Do not skip this

The restart in step 4 starts a session with an **empty context**. Without a note it greets the user
and does nothing, and they have to explain the whole setup again.

**Download it — do not compose it.** The note is a file in the repo, so getting it is the same
one-liner as step 2, and it lands in the workspace root, the folder the user runs `agy` from:

```powershell
Invoke-WebRequest -Uri "$raw/handoff/AGENTS.antigravity.md" -OutFile AGENTS.md -UseBasicParsing
```

A PowerShell literal here-string (`@'…'@`) does not interpret escapes — writing the note by hand
this way tends to produce a file full of literal `\n` instead of real newlines. Download the file
instead. For reference, this is what lands (and what to reproduce only if the download is genuinely
unavailable):

```markdown
## Affinity MCP setup — continue here

State: `.agents/mcp_config.json` is written and the repo is cloned. The connection could
not be used in the session that wrote the config, because MCP configuration loads at
startup. This session is the restart.

Do this now, without waiting to be asked. It is read-only:

1. Confirm the `affinity` MCP tools are present (11 of them).
2. `read_sdk_documentation_topic({ filename: "preamble" })` — the gate is per connection.
3. Run `examples/inspect-document.js` via `execute_script` and report the Affinity
   version, the open document and its layer stack.

Then hand over — report what step 3 established, then offer these two, verbatim,
and let them pick:

1 — Run the colour boost script. Add examples/color-boost-two-layer.js to Affinity's
script library, run it on the open image, tell them the name it's saved under and how
to undo it. Don't render or describe the result — they'll look in Affinity.

2 — Have me write one from scratch. Write a black-and-white conversion against the
SDK docs (don't guess at API calls), save it to the library, run it, same ending as
option 1.

SETUP.md should be in this folder (fetched earlier) — read its Antigravity section
for the exact run steps once they pick 1 or 2. If it isn't here, fetch it from
https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/SETUP.md rather
than inventing steps. Do not run anything that writes to their document until they
ask. Do not run verify.ps1 and do not create a .mcp.json.

Delete this section once you have offered the choices; the file too if nothing else is
left in it.
```

Two things about that note:

- **Do not also write `GEMINI.md` "to be safe."** Two copies of a self-deleting note means one
  survives and re-runs this sequence later against whatever document happens to be open.
- **Antigravity does read `AGENTS.md`** at startup. A restarted session given the single word
  "resume" will list the folder, read the note, and begin working through its steps unprompted.
  Still hand the user a fallback line for the restart — *"Continue the Affinity MCP setup — read
  `AGENTS.md` in this folder and do the read-only steps."*

Write it as UTF-8 and read it back as UTF-8. `Get-Content` without `-Encoding utf8` turns every em
dash into `â€"`; that is cosmetic and not a reason to "fix" the file.

#### Step 4 — ask the user to restart

Look for the Affinity tools in your current session first:

- **Tools present** → Antigravity reloaded the config live. Skip the restart and go to step 5.
- **Tools absent** → expected. Every harness tested so far loads MCP config only at startup.

No tools plus a correctly written config means **restart, not diagnose.** Do not debug SSE or IPv6,
and do not write your own SSE client — it proves nothing about the user's config, which is the entire
deliverable. Tell the user four things: it worked, nothing is broken; MCP config loads at startup so
this session cannot see it; quit and relaunch `agy` in this folder, then type "continue"; and hand
them the fallback line from step 3 in case the new session comes back blank.

#### Step 5 — after the restart, prove the connection (read-only)

**These are MCP tool calls. Do not shell out for any of them.** To be explicit about failure modes
worth avoiding here:

- Affinity SDK scripts **cannot run under Node** — there is no Affinity runtime outside the app. The
  only way a script reaches the document is `execute_script`.
- **`agy` has no `mcp` subcommand.** Running `agy` from a shell spawns a nested session, not a tool
  call, and it never returns.
- **Never report a call as in progress.** These tools return synchronously. If you have no result,
  the call did not happen — say so and make it.

Run these three without asking. They change nothing.

1. **The tools are there.** Confirm the Affinity server's tools appear — 11 of them, including
   `read_sdk_documentation_topic`, `execute_script` and `save_script_to_library`.
2. **Read the preamble.** `read_sdk_documentation_topic({ filename: "preamble" })`. Required before
   any script runs, and the gate is **per SSE connection** — if a later script returns `The preamble
   documentation topic has not yet been read`, the connection was re-established. Read it again
   rather than treating it as a regression.
3. **Run `examples/inspect-document.js`** via `execute_script` — read the file and pass its
   **contents** as the script argument; the tool takes source, not a path. It reports the Affinity
   version, open documents, spreads and top-level layers, and changes nothing:

   ```
   === Application ===
   Product : Affinity 3.2.x ...
   Open documents: 1
   === Current document ===
   Spreads     : 1
   Top layers  : 1
     [0] Background
   ```

#### Step 6 — report, then offer these two options

Report what step 5 established — Affinity version, which document is open, its layer stack. Then
**stop.** Everything past here writes to a photo the user has open, so it is theirs to ask for.

Offer these two, verbatim, and let them pick:

> **1 — Run the colour boost script.** I add it to Affinity's Script View and run it on your open
> image, then tell you the name it's listed under. Switch to Affinity and see the result yourself.
>
> ```
> Add examples/color-boost-two-layer.js to Affinity's script library, check it really landed
> there, then run it on the image I have open. Tell me the name it's saved under and how to undo
> it. Don't render the image or describe the result — I'll look in Affinity.
> ```

> **2 — Have me write one from scratch.** The real loop, and where this starts paying off. No supplied
> script this time: I write a black-and-white conversion against the SDK, add it to your Script View
> and run it. Switch to Affinity and see the result yourself.
>
> ```
> Write a black-and-white conversion script for the photo I have open. Work from the SDK docs —
> don't guess at API calls. Save it to Affinity's script library, check it landed there, then run
> it. Tell me the name it's saved under and how to undo it. Don't render the image or describe the
> result — I'll look in Affinity.
> ```

Close by telling them they can also stop here and nothing will be changed — that is a real answer,
not a failure to choose. Do not pick for them, do not run one ahead of time, and **do not offer a
third option.** Promoting the connection machine-wide is a Claude Code distinction; if they ask about
other folders, the answer is to copy `.agents/mcp_config.json` into that workspace.

#### Step 7 — run only what they picked

Both options end the same way, and only the authorship differs:

1. `save_script_to_library` — for option 1 that is `examples/color-boost-two-layer.js`; for option 2,
   the script you just wrote.
2. `list_library_scripts` — confirm the name really is there. The write's own response is not proof,
   and you are about to send someone looking for it.
3. `execute_script` — run it once on the open document.

Then hand over: switch to Affinity and see the result, the name it is listed under, and how to undo
(Ctrl+Z, or delete the layers it added). If they came from option 1, mention option 2 is worth coming
back for. Finally, delete the handoff note from step 3 — left behind, it re-runs this whole sequence on
every future session.

**No renders, and no describing the result.** The user is seconds from the document itself at full
resolution. `render_spread` exists, but do not reach for it here — including to diagnose a script that
threw. If a script throws, show the error.

For option 2, two properties separate a script worth keeping from a one-shot, so build both in:
**non-destructive** (an adjustment layer, not a pixel operation) and **idempotent** (delete your own
layer by name first, so a second run replaces rather than stacks). One trap to know before you hit it:
**if the top of the layer stack is a group, the builder parents your new layer inside it** — detect it
by the root layer count not changing after the insert, then move the layer back out. Missing this
fails silently. Use `read_sdk_documentation_topic` and `search_sdk_hints` rather than guessing at an
API call; a hallucinated method is the most common way option 2 fails. Record what you learn with
`add_sdk_hint`, or in `docs/sdk-notes.md` if that call is refused.

**Antigravity fronts more than one model, and not always Gemini** — `agy models` lists what is
reachable. Don't assume the model behind a session is Gemini just because the harness is
Antigravity; if asked, state the model you actually are.

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

4. Check with `codex mcp list`, then **restart Codex** — see "The restart is unavoidable here too"
   below, and leave the handoff note *before* you ask for it. Note that `enabled` only means the
   config was loaded — successful tool discovery is what proves the handshake.

The bridge can be dropped only once Codex and Affinity share a protocol version and transport.

#### Getting the repo — expect the network to be blocked

Codex sandboxes network access. Your first attempt to fetch anything — the raw URLs above, a
`git clone`, even a web search for this page — can fail with a connection error that looks like the
user's network is down:

```text
fatal: unable to access 'https://github.com/...': Failed to connect to github.com port 443 after 84 ms
```

**That is the sandbox, not their connection** — a failure that fast is too quick to have left the
machine. Ask for approval to run `git clone` and say why you need it. Do not conclude the repo is
unreachable, and do not improvise the script contents from memory.

Clone into the workspace folder, then use paths **relative to where Codex is running**. If you
cloned into `my-project\affinity-mcp-setup\`, the inspection script is
`affinity-mcp-setup/examples/inspect-document.js`, not the bare `examples/...` path §3 uses.

Once the bridge is configured, `node .\bridge\smoke-test.mjs` proves the whole chain from outside
Codex — it initializes through the bridge, lists the real tools and reads the preamble, without
touching the document. That is this section's equivalent of `verify.ps1`.

#### The restart is unavoidable here too

Everything in "The restart is unavoidable. Plan for it." above applies to Codex, for the same
reason: **Codex reads `config.toml` at startup.** The entry you just wrote does not exist in the
process that wrote it, and no command loads it live.

This is where a Codex run actually stalls: the model writes a correct config, verifies the bridge
end to end, sees no Affinity tools in its own session, and concludes the CLI is faulty. Everything
was already working. **A successful smoke test plus no visible tools is the signature of this, and
it means restart — not diagnose.**

The handoff channel is **`AGENTS.md` in the workspace root**, which Codex reads at startup, exactly
as Claude Code reads `CLAUDE.md`. Write it before you ask for the restart, using the same shape as
the handoff note above — current state, the three Part A steps, offer the three choices, touch
nothing until the user picks, and delete yourself when done.

Put it in the folder the user will run `codex` from. If they cloned this repo into a subfolder,
that is the **parent**, not the clone.

Write it with UTF-8 and read it back the same way. `Get-Content` on a UTF-8 file without
`-Encoding utf8` decodes it as the ANSI codepage and turns every em dash into `â€"`. It is
cosmetic and it changes nothing about the setup, but do not "fix" the file in response to it.

#### One change to the §3 menu

Offer the three choices as written, with a single exception: **option 3 does not apply to Codex.**
It offers to promote a project-scoped server to user scope, which is a Claude Code distinction.
`%USERPROFILE%\.codex\config.toml` is already user-level, so Affinity works from every folder from
the moment it is written. Tell the user that rather than offering them an upgrade they already
have.

If the user asks how to check the connection themselves, `/mcp` is a Claude Code command — give
`codex mcp list` instead.

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
offer these three, verbatim, and let them pick. Don't choose one for them, and don't run one ahead
of time to save a turn. Close by telling them they can also stop here and nothing will be changed —
that is a real answer, not a failure to choose.

> **1 — Run the colour boost script.** I add it to Affinity's Script View and run it on your open
> image, then tell you the name it's listed under. Switch to Affinity and see the result yourself.
>
> ```
> Add examples/color-boost-two-layer.js to Affinity's script library, check it really landed
> there, then run it on the image I have open. Tell me the name it's saved under and how to undo
> it. Don't render the image or describe the result — I'll look in Affinity.
> ```

**Option 1 ends at the user's screen, not in your output.** Save with `save_script_to_library`,
confirm with `list_library_scripts` — the write's own response is not proof, and you are about to
send someone looking for it — then run it. **Do not call `render_spread` and do not describe the
result:** they are seconds away from the document itself, at full resolution.

Then close briefly: *switch to Affinity and see the result*, the name the script is listed under, how
to undo the edit (Ctrl+Z, or delete `Boost` and `Clean`), and that option 2 is worth coming back for.
Leave the rest of the Script View for them to discover — re-running and tidying up are obvious once
they are in there, and spelling them out turns a two-line handover into a manual. Do not start
option 2 for them.

> **2 — Have me write one from scratch.** The real loop, and where this starts paying off. No supplied
> script this time: I write a black-and-white conversion against the SDK, add it to your Script View
> and run it. Switch to Affinity and see the result yourself.
>
> ```
> Write a black-and-white conversion script for the photo I have open. Work from the SDK docs —
> don't guess at API calls. Save it to Affinity's script library, check it landed there, then run
> it. Tell me the name it's saved under and how to undo it. Don't render the image or describe the
> result — I'll look in Affinity.
> ```

**Option 2 is option 1's handover with one difference: the script is yours.** Same ending — save,
confirm with `list_library_scripts`, run, name it, send them to Affinity. No renders, no description
of the result.

The difference is the writing. Use `read_sdk_documentation_topic` and `search_sdk_hints` before
reaching for an API call you are not sure of; a hallucinated method here is the most common way this
option fails. Two properties make the difference between a script worth keeping and a one-shot, so
build both in:

- **Non-destructive** — an adjustment layer, not a pixel operation. The user's original stays intact
  underneath and the effect can be switched off.
- **Idempotent** — delete your own layer by name before adding it, so a second run replaces rather
  than stacks, and every other layer is left alone.

One trap worth knowing before you hit it: **if the top of the layer stack is a group, the builder
parents your new layer inside it.** Detect it by the root layer count not changing after the insert,
then move the layer back out. Missing this fails silently — the script reports success while the
adjustment lands on one group instead of the image.

Where an SDK call did not exist or behaved unexpectedly, say so and record it with `add_sdk_hint` so
the next session inherits it. If that call is refused, put it in `docs/sdk-notes.md` instead — do not
let the finding evaporate.

> **3 — Use Affinity from every folder, not just this one.** Setup put the connection in this
> folder. This promotes it machine-wide, so you never do it again.
>
> ```
> Register the Affinity MCP server at user scope instead of just this folder, then tell me what
> to delete and whether I need to restart.
> ```

If they pick 1 or 2, the remaining steps below are how you run it. If they pick 3, see the Claude
Code section. If they choose to stop instead, you are done — say so plainly and don't talk them into
an edit.

### Part B — only if the user asked for it

Both options end the same way — a script in the user's Script View, run once on their open document,
and the user looking at the result in Affinity rather than at a render from you. Only the authorship
differs.

**Step 4 — put the script in the library and run it.**

For **option 1**, that script is
[`examples/color-boost-two-layer.js`](examples/color-boost-two-layer.js). It adds two Selective
Colour adjustment layers — `Boost`, which saturates the six colour ranges, over `Clean`, which lifts
the highlights and keeps the blacks solid — and prints:

```
Two-layer Color Boost added — Boost (strength 0.6, opacity 40%) over Clean (strength 0.25, opacity 30%)
```

Two layers rather than one is the point worth making to the user: each is a separate control, so the
colour and the tone can be tuned or switched off independently. That is the shape to copy when
building their own looks — one layer per idea.

For **option 2**, it is the black-and-white script you just wrote.

Either way, all three parts have to happen: `save_script_to_library`, then `list_library_scripts` to
confirm the name really is there, then `execute_script` to run it. Saving alone changes nothing on
the image; running alone leaves them nothing to keep.

The script's own success line is your confirmation that it worked. **You will not see the result, and
that is deliberate** — the user is looking at the document itself. If the script throws, say so and
show the error; do not reach for `render_spread` to find out what happened.

**Step 5 — hand over.** Tell them to switch to Affinity and see the result, give the name the script
is listed under, and say how to undo the edit — Ctrl+Z, or delete the layers it added. Then, if they
came from option 1, tell them option 2 is worth coming back for, and offer the menu again when they
return. Don't start it for them.

**Step 6 — clean up.** Delete the handoff note now that its job is done: remove the "Affinity MCP
setup — continue here" section from `CLAUDE.md`, and the file too if nothing else is left in it. Left
behind it re-runs this whole sequence on every future session, against whatever document happens to
be open.

Then remind the user of the choices they did not take — option 2 in particular, having the script
written against the SDK rather than supplied, is where the project starts paying off. Do not start it
for them.

---

## 4. When it doesn't connect

| Symptom | Cause | Fix |
|---|---|---|
| **Tools missing right after you registered the server** | MCP config is loaded at startup. A server added mid-session was never registered, and `/mcp` only retries *failed* servers — it cannot load a new one | Restart Claude Code. Expected, not a fault — see the Claude Code section |
| `⏸ Pending approval (run claude to approve)` in `claude mcp list` | A project-scoped server from `.mcp.json` is waiting for interactive approval | Start a session and approve it. Confirms the config is valid, not broken |
| **The restarted session does nothing / doesn't know about the setup** | A restart starts with an empty context. Without a handoff note there is nothing telling it a verification was pending | Write the setup state into the folder's `CLAUDE.md` **before** asking for the restart — Claude Code loads it at startup. See "The handoff note" above |
| `NOT_ALLOWED` from a script doing file I/O | Affinity sandboxes script filesystem access to the Desktop tree | Move the project under `C:\Users\<you>\Desktop\`. Not a permissions bug — a location rule |
| Tools missing, everything else healthy | SSE stream detached (resumed chat, Affinity restarted mid-session) | Reconnect the MCP server first — in Claude Code, `/mcp`. Restarting the whole CLI is rarely necessary |
| `The preamble documentation topic has not yet been read` | The gate is per SSE connection; the preamble was read on a different one | Call `read_sdk_documentation_topic({ filename: "preamble" })` again on the current connection |
| Tools missing at startup | Affinity wasn't running when the harness started | Open Affinity, restart the harness |
| `ECONNREFUSED [::1]:6767` | Affinity not running, or the MCP toggle is off | Start Affinity; confirm the toggle; restart Affinity if it was just changed |
| `ECONNREFUSED 127.0.0.1:6767` | Expected — wrong address family | Use `[::1]`. This is not a fault |
| `-32602 Unsupported protocol version` | Client initialized with an older MCP version | Codex: use the bridge. Others: check the harness's MCP version support |
| Config says `enabled` / `connected`, no tools | Config loaded, handshake failed | Check the startup log for the protocol error. Do not substitute a hand-written SSE client for the real test |
| `user cancelled MCP tool call` (`codex exec`) | Non-interactive approval policy; Affinity's tools publish no safety annotations | Use the interactive TUI. Not a bridge failure |
| **Antigravity: no connection, no error at all** | The config used `url` instead of `serverUrl` | Rename the field in `.agents/mcp_config.json`. It fails silently, so there is nothing in the log to find |
| **Antigravity: agent asks the user to switch workspace to somewhere under `~/.gemini/antigravity/scratch/...`** | The write tool reported success but silently redirected into Antigravity's own internal state directory instead of the user's opened folder | Don't switch. `Test-Path` the config at the user's real workspace path; if it's not there, shell out with PowerShell to write it at the real absolute path, and verify again |
| **A script fails oddly, or a "verified" check passes suspiciously easily** | The file was reconstructed from a fetched page rather than copied, and came out smaller than the real file — syntactically valid, silently wrong | Re-download it with `Invoke-WebRequest -OutFile` or `git clone`, so the bytes go to disk without passing through you. Never retype the body of a file you just read |
| **A multi-line file writes as one line full of `\n`** | `@'…'@` is a PowerShell *literal* here-string and does not interpret escapes | Download the file instead of composing it — the handoff note lives at `handoff/AGENTS.antigravity.md`. If you must write one, use real line breaks and `Out-File -Encoding utf8` |
| **Antigravity: `verify.ps1` reports a missing `.mcp.json`** | `verify.ps1` is a Claude Code preflight; that check is hardcoded to Claude Code's filename | Don't run it on this path at all — see the Antigravity section. Never create a `.mcp.json` to satisfy it |
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

- **[The step-by-step tutorial](https://bolloplayer.github.io/affinity-mcp-setup/)** — a
  human-facing walkthrough of the Claude Code path, with screenshots. Also covers pointing Claude
  Code at **DeepSeek** via its Anthropic-compatible endpoint, which keeps this exact connection and
  every config file unchanged while swapping the model underneath.
- **[`docs/choosing-your-ai.md`](docs/choosing-your-ai.md)** — which model, which harness, what
  each combination costs, and what has actually been verified versus assumed.
- **[`CLAUDE.md`](CLAUDE.md)** — connection internals (IPv6 binding, the SSE handshake, stale
  session causes) in a form an agent can diagnose from.

---

Affinity's AI Connector is a free, Canva-owned beta; its APIs and the scripting SDK may change
without notice. Verified on Windows 11 with Affinity Photo 3.2.x. Treat version-specific details as
a snapshot.
