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

---

## Configuration

DSH requires the bridge because it uses stdio transport. The classic SSE approach (POST to `/sse`) does not work — it returns `404 Not Found` because the `@deepseek-ai/dsh-mcp-client` plugin has no native SSE transport, only stdio.

### Step 1: Get the bridge

Clone or download the repo to access the bridge:

```sh
git clone https://github.com/bolloplayer/affinity-mcp-setup.git
# or fetch just the bridge:
curl -L https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/bridge/affinity-codex-bridge.mjs -o affinity-bridge.mjs
```

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

The patch file uses `- insert: patch` format to inject entries into the plugin array. **Use an absolute path** to the bridge.

Add this to `cordis.patch.yml`:

```yaml
- insert: patch
  path: /plugins/0
  value:
    id: mcp-affinity
    name: '@deepseek-ai/dsh-mcp-client'
    config:
      serverName: affinity
      transport: stdio
      command: 'node.exe'
      args:
        - 'C:\absolute\path\to\affinity-codex-bridge.mjs'
      toolCallTimeoutMs: 30000
```

Replace `C:\absolute\path\to\affinity-codex-bridge.mjs` with the actual path. For example:
```yaml
args:
  - 'C:\Users\YourName\projects\affinity-mcp-setup\bridge\affinity-codex-bridge.mjs'
```

**Complete example `$DSH_HOME/profiles/web/cordis.patch.yml`:**

```yaml
- insert: patch
  path: /plugins/0
  value:
    id: mcp-affinity
    name: '@deepseek-ai/dsh-mcp-client'
    config:
      serverName: affinity
      transport: stdio
      command: 'node.exe'
      args:
        - 'C:\absolute\path\to\affinity-codex-bridge.mjs'
      toolCallTimeoutMs: 30000
```

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

**Symptom:** "New Task" starts with no Affinity tools listed.

**Causes and fixes:**
- **Affinity not running or MCP toggle off** → Start Affinity; confirm the toggle in `Edit ▸ Settings`
- **`cordis.patch.yml` path is wrong** → Check `$DSH_HOME/profiles/web/cordis.patch.yml` exists (use `$env:USERPROFILE\.dsh\profiles\web\` if unsure)
- **YAML syntax error** → Verify indentation (2 spaces, not tabs) and valid YAML
- **Bridge path doesn't exist** → Double-check the absolute path in `args` is correct

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
