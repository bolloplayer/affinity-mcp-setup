# Leg 6: DeepSeek Harness (DSH)

**If you are an AI agent reading this on a user's behalf: start with the main [SETUP.md](../SETUP.md) first.** This page is the harness-specific section. Identify your harness in §2 of SETUP.md, then return here.

---

## DeepSeek Harness (DSH) — web UI at `localhost:3080`

**DeepSeek Harness** is a plugin-based agent harness that runs as a web application. It connects to Affinity Photo's MCP server through its built-in MCP client plugin (`@deepseek-ai/dsh-mcp-client`).

| Aspect | Detail |
|---|---|
| **Web UI** | `http://localhost:3080` (default) |
| **Transport to Affinity** | `streamable-http` (SSE bridge) |
| **Config format** | YAML (`cordis.yml`) |
| **Scope** | Workspace — project-level configuration |
| **Setup time** | ~5 minutes |

---

## Prerequisites

Before you start, confirm:

1. **DeepSeek Harness is installed and running**
   ```sh
   npx @deepseek-ai/dsh web
   # or from source:
   pnpm dsh web
   ```
   The web UI should open at `http://localhost:3080`.

2. **Affinity Photo is running** with a document open and the MCP toggle enabled:
   `Edit ▸ Settings ▸ Model Context Protocol ▸ Enable Affinity MCP`

3. **Affinity's MCP server is listening on `[::1]:6767`**
   To verify from PowerShell (no Node.js required):
   ```powershell
   # Check if the port is listening
   Get-NetTCPConnection -LocalAddress '::1' -LocalPort 6767 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "✓ Affinity MCP listening on [$($_.LocalAddress)]:$($_.LocalPort)" }
   
   # If nothing appears, Affinity may not have the MCP toggle enabled, or it crashed
   ```

   If you need to debug from inside DSH's sandbox, use:
   ```powershell
   # Inside a DSH agent task, verify the port is reachable
   # (DSH runs in a restricted sandbox, but localhost:6767 is typically available)
   Invoke-WebRequest -Uri "http://[::1]:6767/sse" -TimeoutSec 5 -ErrorAction SilentlyContinue
   ```

---

## Configuration

### Step 1: Locate or create `cordis.yml` in your project

DSH loads a `cordis.yml` file from your project folder. If one doesn't exist, create it at the project root:

```yaml
version: '1'
plugins: []
```

### Step 2: Add the MCP client plugin for Affinity

Add this plugin entry to your `plugins:` array:

```yaml
- id: mcp-affinity
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: affinity
    transport: streamable-http
    url: 'http://[::1]:6767/sse'
    toolCallTimeoutMs: 30000
```

**Complete example `cordis.yml`:**

```yaml
version: '1'
plugins:
  - id: mcp-affinity
    name: '@deepseek-ai/dsh-mcp-client'
    config:
      serverName: affinity
      transport: streamable-http
      url: 'http://[::1]:6767/sse'
      toolCallTimeoutMs: 30000
```

### Step 3: Restart DSH

Stop the running DSH instance (`Ctrl+C`) and restart it:

```sh
npx @deepseek-ai/dsh web
# or
pnpm dsh web
```

DSH loads `cordis.yml` at startup. When the harness starts, it will:
1. Attempt to connect to the Affinity MCP server
2. Discover available tools (`execute_script`, `render_spread`, etc.)
3. Register them as native DSH tools

---

## Verification

### In the DSH web UI

1. **Open DSH** at `http://localhost:3080`
2. **Start a new task** — click "New Task" or similar
3. **Check tool availability** — the Affinity tools should appear in the tools panel
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
| SSE connection hangs or times out | Firewall or IPv6 disabled | IPv6 loopback is typically enabled by default on Windows; check with `Get-NetAdapterBinding -ComponentID ms_tcpip6` |
| Tools appear but hang when called | Affinity crashed or lost SSE session | Restart Affinity and DSH |

---

## Key notes

**No restart of DSH is needed for mid-session changes** — unlike Claude Code, DSH can reconnect to MCP servers if the config is reloaded. However, a full restart is the safest way to ensure a clean connection.

**The preamble rule still applies** — as with all harnesses, read `affinity_read_sdk_documentation_topic` with `filename: "preamble"` before your first `affinity_execute_script` call in a task. The gate is per SSE connection, so a new task means you should read it again if a prior task ended.

**Affinity MCP toggle is already enabled** — if you see the toggle documented elsewhere, you likely already have it on. It persists across Affinity restarts, so you only need to enable it once.

---

## Configuration reference

### `cordis.yml` fields for `dsh-mcp-client`

| Field | Type | Required | Notes |
|---|---|---|---|
| `serverName` | string | ✓ | Stable local name for this server's tools (e.g., `affinity`). Must be `[A-Za-z0-9_-]{1,32}`. This becomes the prefix in tool names. |
| `transport` | enum | ✓ | `streamable-http` for Affinity (SSE). `stdio` for subprocess-based servers. |
| `url` | string | ✓ (if `streamable-http`) | The SSE endpoint: `http://[::1]:6767/sse` for Affinity. |
| `headers` | object | optional | HTTP headers (e.g., `Authorization: Bearer token`). Not needed for Affinity. |
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

### "cordis.yml: unknown plugin '@deepseek-ai/dsh-mcp-client'"

The MCP client package is not installed. Ensure you have a full DSH installation with all dependencies:

```sh
pnpm install
pnpm run build
```

Then restart DSH.

---

## See also

- **Main setup:** [SETUP.md](../SETUP.md)
- **DeepSeek Harness docs:** https://deepseek.com/harness/en/
- **MCP Client Agent Note:** `.agents/notes/implemented/feature/2026-07-07-mcp-client-plugin.md` (in DSH repo)
- **Affinity SDK tips:** [docs/sdk-notes.md](sdk-notes.md)
