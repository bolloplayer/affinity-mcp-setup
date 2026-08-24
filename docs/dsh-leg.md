# Leg 6: DeepSeek Harness (DSH)

**If you are an AI agent reading this on a user's behalf: start with the main [SETUP.md](../SETUP.md) first.** This page is the harness-specific section. Identify your harness in §2 of SETUP.md, then return here.

---

## DeepSeek Harness (DSH) — web UI at `localhost:3080`

**DeepSeek Harness** is a plugin-based agent harness that runs as a web application. It connects to Affinity Photo's MCP server through its built-in MCP client plugin (`@deepseek-ai/dsh-mcp-client`).

| Aspect | Detail |
|---|---|
| **Web UI** | `http://localhost:3080` (default) |
| **Transport to Affinity** | `stdio` bridge → SSE |
| **Config format** | YAML (`cordis.patch.yml`) |
| **Scope** | Profile-scoped — applies only to the web UI profile |
| **Setup time** | ~5 minutes |

---

## Prerequisites

Before you start, confirm:

1. **Node.js LTS is installed** — the bridge requires it.
   ```sh
   node --version
   ```
   If not installed, download it from https://nodejs.org/

2. **DeepSeek Harness is installed and running**
   ```sh
   npx @deepseek-ai/dsh web
   # or from source:
   pnpm dsh web
   ```
   The web UI should open at `http://localhost:3080`.

3. **Affinity Photo is running** with a document open and the MCP toggle enabled:
   `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`

4. **Affinity's MCP server is listening on `[::1]:6767`**
   To verify from PowerShell:
   ```powershell
   Get-NetTCPConnection -LocalAddress '::1' -LocalPort 6767 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "✓ Affinity MCP listening on [$($_.LocalAddress)]:$($_.LocalPort)" }
   ```

5. **For real work: move your project under `C:\Users\<you>\Desktop\`** — The MCP connection works from anywhere, but Affinity sandboxes **script file I/O** (exports, saves, batch work) to the Desktop tree. A script that tries to write outside it returns `NOT_ALLOWED`. The verification sequence only reads, so it works from any folder, but move your actual project under Desktop before the first export.

---

## Configuration

DSH requires the bridge because it uses stdio transport. The classic SSE approach (POST to `/sse`) does not work — it returns `404 Not Found` because the `@deepseek-ai/dsh-mcp-client` plugin has no native SSE transport, only stdio.

### Step 1: Download the bridge file to your project

The config points to an absolute bridge path. **This file must exist** before you write the config, or the plugin will silently fail to spawn the bridge.

Download just the bridge file to your project folder (or keep it in a permanent location you control):

**Option A: From PowerShell (recommended — no git needed)**
```powershell
# Create a bridge folder in your project (or use project root)
New-Item -ItemType Directory -Force -Path bridge | Out-Null

# Download the single bridge file
$url = "https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/bridge/affinity-codex-bridge.mjs"
Invoke-WebRequest -Uri $url -OutFile bridge/affinity-codex-bridge.mjs -UseBasicParsing
```

**Option B: If sandboxed (Codex, DSH), use git with OpenSSL backend**
```sh
# In your project folder:
mkdir bridge
git clone -c http.sslBackend=openssl --depth 1 https://github.com/bolloplayer/affinity-mcp-setup.git _temp
cp _temp/bridge/affinity-codex-bridge.mjs bridge/
rm -r _temp
```

Once downloaded, the bridge is at: `<your-project>\bridge\affinity-codex-bridge.mjs` (or wherever you saved it)

### Step 2: Locate or create the DSH profile config

DSH loads configuration from **profile-scoped** YAML files, not project-folder files. The web UI profile reads from:

```
$DSH_HOME/profiles/web/cordis.patch.yml
```

**Find your `$DSH_HOME`:** it's typically one of these, in order:
- The `DSH_HOME` environment variable (if set)
- `~/.dsh` (the default)

If the file doesn't exist, create the directory structure and an empty patch file:

```powershell
# Example with default location
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.dsh\profiles\web" | Out-Null
```

### Step 3: Add the MCP client plugin entry

The patch file uses `- insert:` at the top level with an array of plugin entries. **Use absolute paths** for both Node.js and the bridge — these MUST exist or the plugin will silently fail.

Add this to `cordis.patch.yml`:

```yaml
# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; `!!js` expressions allowed).
- insert:
    - id: mcp-affinity
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: affinity
        transport: stdio
        command: 'C:\Program Files\nodejs\node.exe'
        args:
          - 'C:\your\clone\path\affinity-mcp-setup\bridge\affinity-codex-bridge.mjs'
        toolCallTimeoutMs: 30000
```

**Replace these absolute paths — they MUST match your actual system:**
- `command`: `C:\Program Files\nodejs\node.exe` (or wherever your Node.js is installed — verify with `node --version`)
- `args[0]`: The full path to `affinity-codex-bridge.mjs` from Step 1. For example, if you saved it to your project's `bridge/` folder at `C:\Users\YourName\Desktop\my-project\bridge\affinity-codex-bridge.mjs`, use that full path.

**Real example** (bridge in project folder):
```yaml
# Your patch layer for this dsh profile, applied after every bundle layer:
- insert:
    - id: mcp-affinity
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: affinity
        transport: stdio
        command: 'C:\Program Files\nodejs\node.exe'
        args:
          - 'C:\Users\fons\Desktop\my-project\bridge\affinity-codex-bridge.mjs'
        toolCallTimeoutMs: 30000
```

⚠️ **If the bridge path doesn't exist:** the config will parse correctly, but the plugin will silently fail to spawn the bridge when a task starts. If tools don't appear after page refresh, double-check that:
1. The file exists: `Test-Path 'C:\your\path\bridge\affinity-codex-bridge.mjs'`
2. The path in `args[0]` is absolute and matches exactly

### Step 4: Verify the connection (no restart needed)

DSH's web profile supports **Hot Module Reload (HMR)** for config changes. The connection will load the next time you refresh the page — no restart required.

1. **Open DSH** at `http://localhost:3080` (or refresh if already open)
2. **Start a new task** — click "New Task" or similar
3. **List your tools** — you should see 11 Affinity tools prefixed with `mcp__affinity__`:
   - `mcp__affinity__read_sdk_documentation_topic`
   - `mcp__affinity__execute_script`
   - `mcp__affinity__render_spread`
   - (and 8 more)
4. **Run a preflight check** — (optional) verify the whole chain works:
   ```sh
   node bridge\smoke-test.mjs
   ```
   This initializes through the bridge, lists tools, and reads the preamble without touching your document — the DSH equivalent of `verify.ps1`.

### Step 5: Verify the tools work

In a task, call one of the Affinity tools to confirm the connection:

```
You have access to Affinity Photo tools. First, read the preamble documentation.
```

The agent should call `mcp__affinity__read_sdk_documentation_topic` with `filename: "preamble"` and receive the preamble response.

---

## Key notes

**Tool names in DSH are server-qualified.** The `serverName: affinity` in the config makes all tools appear as `mcp__affinity__*` in the task UI (like Claude Code), not bare `affinity_*`. This is how DSH's plugin discovers and namespaces external tools.

**The bridge handles protocol translation.** DSH uses stdio transport, the bridge converts it to SSE, and handles the version mismatch between DSH's initialization and Affinity's MCP protocol.

**The preamble rule still applies** — read `mcp__affinity__read_sdk_documentation_topic` with `filename: "preamble"` before your first `mcp__affinity__execute_script` call. The gate is per connection: a new task starts ungated and needs the preamble read again if a prior task ended.

**Affinity MCP toggle must be on** — `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`. It persists across Affinity restarts, so enable it once.

---

## Configuration reference

### `cordis.patch.yml` fields for the MCP client plugin

| Field | Type | Required | Notes |
|---|---|---|---|
| `serverName` | string | ✓ | Stable local name for this server's tools. Must match `[A-Za-z0-9_-]{1,32}`. Tools appear as `mcp__<serverName>__*`. |
| `transport` | enum | ✓ | **`stdio`** for the bridge approach (not `streamable-http`). |
| `command` | string | ✓ | `node.exe` — the bridge runs as a Node.js subprocess. |
| `args` | array | ✓ | Array containing the absolute path to `affinity-codex-bridge.mjs`. |
| `toolCallTimeoutMs` | number | optional | Timeout for a single tool call (ms). Default: `60000`. Affinity scripts can be slow; adjust as needed. |

---

## Troubleshooting

### "Node.js is not installed or not in PATH"

Install Node.js LTS from https://nodejs.org/ and verify:
```sh
node --version
```

### Tools don't appear after refresh

**Symptom:** "New Task" starts with no Affinity tools listed, or config shows as loaded but connection fails.

**Most common cause — bridge file doesn't exist:**
Check that the path in `args[0]` of `cordis.patch.yml` points to the bridge file you saved:
```powershell
Test-Path 'C:\your\actual\path\bridge\affinity-codex-bridge.mjs'
```
If this returns `$false`, either:
- Download the bridge file to that location (Step 1, Option A)
- Update the path in `cordis.patch.yml` to where you did save it
- Then refresh the page

**Other causes:**
- **Affinity not running or MCP toggle off** → Start Affinity; confirm the toggle in `Edit ▸ Settings`
- **`cordis.patch.yml` path is wrong** → Check `$DSH_HOME/profiles/web/cordis.patch.yml` exists (use `$env:USERPROFILE\.dsh\profiles\web\` if unsure)
- **YAML syntax error** → Verify indentation (2 spaces, not tabs), array structure, and valid YAML
- **Node.js path doesn't exist** → Verify `command` path; run `node --version` from PowerShell to confirm Node is in PATH or get its full path

### "Connection refused" or "404 Not Found"

**Old symptom from testing:** the config used `transport: streamable-http` with `url: http://[::1]:6767/sse`.

**Fix:** Change to `transport: stdio` with the bridge. The plugin has no native SSE transport — stdio + bridge is the only working approach.

### "IPv6 is disabled on this system"

Affinity's MCP server only listens on IPv6 loopback (`[::1]`). If IPv6 is disabled:

```powershell
Get-NetAdapterBinding -ComponentID ms_tcpip6 | Format-Table Name, Enabled
# Enable if needed:
Enable-NetAdapterBinding -Name "Ethernet" -ComponentID ms_tcpip6
# Replace "Ethernet" with your actual adapter name
```

Then restart Affinity and DSH.

### "The preamble documentation topic has not yet been read"

The gate is per connection. If you see this during `execute_script`, call `mcp__affinity__read_sdk_documentation_topic` with `filename: "preamble"` again before proceeding.

---

## See also

- **Main setup:** [SETUP.md](../SETUP.md)
- **Bridge details:** [bridge/README.md](../bridge/README.md)
- **Bridge smoke test:** `node bridge/smoke-test.mjs`
- **DeepSeek Harness docs:** https://deepseek.com/harness/en/
- **Affinity SDK tips:** [docs/sdk-notes.md](sdk-notes.md)
