# Leg 6: DeepSeek Harness (DSH)

**If you are an AI agent reading this on a user's behalf: start with the main [SETUP.md](../SETUP.md) first.** This page is the harness-specific section. Identify your harness in §2 of SETUP.md, then return here.

---

## DeepSeek Harness (DSH) — web UI at `localhost:3080`

**DeepSeek Harness** is a plugin-based agent harness that runs as a web application. It connects to Affinity Photo's MCP server through its built-in MCP client plugin (`@deepseek-ai/dsh-mcp-client`).

| Aspect | Detail |
|---|---|
| **Web UI** | `http://localhost:3080` (default) |
| **Transport to Affinity** | `stdio` bridge → SSE |
| **Config format** | YAML (`cordis.yml`) |
| **Scope** | Workspace — project-level configuration |
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
   To verify from PowerShell (no Node.js required):
   ```powershell
   # Check if the port is listening
   Get-NetTCPConnection -LocalAddress '::1' -LocalPort 6767 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "✓ Affinity MCP listening on [$($_.LocalAddress)]:$($_.LocalPort)" }
   
   # If nothing appears, Affinity may not have the MCP toggle enabled, or it crashed
   ```

---

## Configuration

DSH requires the bridge because it uses stdio transport, just like Codex. The classic SSE approach does not work with DSH.

### Step 1: Get the bridge

Clone or download the repo to access the bridge:

```sh
git clone https://github.com/bolloplayer/affinity-mcp-setup.git
# or fetch just the bridge:
curl -L https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/bridge/affinity-codex-bridge.mjs -o affinity-bridge.mjs
```

If you are inside DSH and the network is sandboxed, ask for approval to run `git clone` or `Invoke-WebRequest`.

### Step 2: Locate or create `cordis.yml` in your project

DSH loads a `cordis.yml` file from your project folder. If one doesn't exist, create it at the project root:

```yaml
version: '1'
plugins: []
```

### Step 3: Add the MCP client plugin with the bridge

Add this plugin entry to your `plugins:` array. **Use an absolute path** to the bridge:

```yaml
- id: mcp-affinity
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: affinity
    transport: stdio
    command: 'node.exe'
    args:
      - 'C:\absolute\path\to\affinity-codex-bridge.mjs'
    toolCallTimeoutMs: 30000
```

Replace `C:\absolute\path\to\affinity-codex-bridge.mjs` with the actual path to the bridge file on your machine. For example:
```yaml
args:
  - 'C:\Users\YourName\projects\affinity-mcp-setup\bridge\affinity-codex-bridge.mjs'
```

**Complete example `cordis.yml`:**

```yaml
version: '1'
plugins:
  - id: mcp-affinity
    name: '@deepseek-ai/dsh-mcp-client'
    config:
      serverName: affinity
      transport: stdio
      command: 'node.exe'
      args:
        - 'C:\absolute\path\to\affinity-codex-bridge.mjs'
      toolCallTimeoutMs: 30000
```

### Step 4: Restart DSH

Stop the running DSH instance (`Ctrl+C`) and restart it:

```sh
npx @deepseek-ai/dsh web
# or
pnpm dsh web
```

DSH loads `cordis.yml` at startup. When the harness starts, it will:
1. Launch the Node.js bridge as a subprocess
2. The bridge connects to the Affinity MCP server on `[::1]:6767`
3. Discover available tools and register them as native DSH tools

---

## Verification

### In the DSH web UI

1. **Open DSH** at `http://localhost:3080`
2. **Start a new task** — click "New Task" or similar
3. **Check tool availability** — the Affinity tools should appear in the tools panel (11 tools including `affinity_read_sdk_documentation_topic`, `affinity_execute_script`, etc.)
4. **Try a tool** — call `affinity_read_sdk_documentation_topic` with `filename: "preamble"` to verify the connection works

Example in a task:
```
You have access to Affinity Photo tools. First, read the preamble documentation.
```

The agent should call `affinity_read_sdk_documentation_topic` and receive the preamble response.

### If tools don't appear

**Most common causes:**

| Symptom | Cause | Fix |
|---|---|---|
| Tools are empty or "affinity" namespace missing | `cordis.yml` not found or malformed YAML | Check file path and syntax; restart DSH |
| Connection refused to `[::1]:6767` | Affinity not running or MCP toggle off | Restart Affinity; confirm toggle in `Edit ▸ Settings` |
| `node.exe` not found | Node.js not installed or not in PATH | Install Node.js LTS; verify with `node --version` |
| Bridge path invalid | `args` points to non-existent file | Check the absolute path to `affinity-codex-bridge.mjs` exists and is correct |
| Tools appear but hang when called | Affinity crashed or lost connection | Restart Affinity and DSH |

---

## Key notes

**The bridge handles protocol translation.** DSH uses stdio transport and the bridge converts it to SSE and handles the protocol version mismatch between DSH and Affinity, just like with Codex.

**The preamble rule still applies** — as with all harnesses, read `affinity_read_sdk_documentation_topic` with `filename: "preamble"` before your first `affinity_execute_script` call in a task. The gate is per connection, so a new task means you should read it again if a prior task ended.

**Affinity MCP toggle is already enabled** — if you see the toggle documented elsewhere, you likely already have it on. It persists across Affinity restarts, so you only need to enable it once.

---

## Configuration reference

### `cordis.yml` fields for `dsh-mcp-client` with bridge

| Field | Type | Required | Notes |
|---|---|---|---|
| `serverName` | string | ✓ | Stable local name for this server's tools (e.g., `affinity`). Must be `[A-Za-z0-9_-]{1,32}`. This becomes the prefix in tool names. |
| `transport` | enum | ✓ | **`stdio`** for the bridge approach (not `streamable-http`). |
| `command` | string | ✓ | `node.exe` — the bridge runs as a Node.js subprocess. |
| `args` | array | ✓ | Array containing the absolute path to `affinity-codex-bridge.mjs`. |
| `toolCallTimeoutMs` | number | optional | Timeout for a single tool call. Default: `60000` (1 minute). Affinity scripts can be slow; adjust as needed. |

---

## Troubleshooting

### "Port 3080 is already in use"

DSH is already running, or another service has claimed the port. Check for existing DSH processes:

```powershell
Get-Process | Where-Object { $_.Name -match 'node|dsh' }
```

Kill the existing process or start DSH on a different port:

```sh
npx @deepseek-ai/dsh web --port 3081
```

### "node.exe is not recognized as an internal or external command"

Node.js is not installed or not in your PATH. Install Node.js LTS from https://nodejs.org/ and restart your terminal.

### "The specified path does not exist" (bridge path error)

The `args` in `cordis.yml` points to a non-existent file. Double-check:
1. The absolute path is correct
2. The file `affinity-codex-bridge.mjs` exists at that location
3. Use forward slashes or escape backslashes in YAML: `C:\\Users\\...` or `C:/Users/...`

### "IPv6 is disabled on this system"

Affinity's MCP server only listens on IPv6 loopback (`[::1]`). If IPv6 is disabled:

```powershell
# Check IPv6 binding status
Get-NetAdapterBinding -ComponentID ms_tcpip6 | Format-Table Name, Enabled

# Enable IPv6 (if currently Disabled)
Enable-NetAdapterBinding -Name "Ethernet" -ComponentID ms_tcpip6
# Replace "Ethernet" with your actual adapter name
```

Then restart Affinity and DSH.

### "The preamble documentation topic has not yet been read"

The gate is per connection. If you see this error, call `affinity_read_sdk_documentation_topic` with `filename: "preamble"` again before proceeding with script execution.

---

## See also

- **Main setup:** [SETUP.md](../SETUP.md)
- **Bridge details:** [bridge/README.md](../bridge/README.md)
- **DeepSeek Harness docs:** https://deepseek.com/harness/en/
- **Affinity SDK tips:** [docs/sdk-notes.md](sdk-notes.md)
