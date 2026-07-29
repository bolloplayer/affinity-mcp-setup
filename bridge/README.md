# Codex CLI bridge for Affinity

Affinity currently requires MCP protocol `2025-11-25`, while Codex CLI
`0.145.0` and the bundled `0.146.0-alpha.3.1` client initialize stdio MCP
servers with `2025-06-18`.

`affinity-codex-bridge.mjs` connects to Affinity's SSE endpoint and translates
only that initialization version:

- Codex-facing version: whatever Codex requested (`2025-06-18` today)
- Affinity-facing version: `2025-11-25`
- All other JSON-RPC messages: passed through unchanged

## SSE framing — CRLF, not LF

Affinity separates SSE frames with **CRLF (`\r\n`)**. A parser that splits the stream on `"\n\n"`
never completes a frame, so it misses the `endpoint` event and the connection appears to hang with
no error to go on. The bridge splits on `/\r?\n/` and is unaffected; anyone writing another client
against this server should do the same.

## Smoke test

Keep Affinity running with its MCP server enabled, then run:

```powershell
node .\bridge\smoke-test.mjs
```

The test initializes through the bridge, lists the real Affinity tools and
reads the required `preamble`. It does not execute a script or modify the open
document.

## Codex configuration

Use an absolute path in `%USERPROFILE%\.codex\config.toml`:

```toml
[mcp_servers.affinity]
command = "node.exe"
args = ["C:\\absolute\\path\\to\\bridge\\affinity-codex-bridge.mjs"]
startup_timeout_sec = 30
```

Start a fresh Codex CLI process after changing the configuration.

## Non-interactive `codex exec`

The Affinity tools do not currently publish MCP safety annotations. In
non-interactive mode, `codex exec` with its normal `approval: never` policy may
therefore cancel a tool call with `user cancelled MCP tool call`, even though
the bridge and tool discovery succeeded. An interactive TUI can ask for
approval. For a tightly controlled automated smoke test, Codex's explicit
approval-bypass option also works, but it should only be used with a narrowly
scoped, trusted prompt.
