# verify.ps1 — Affinity Photo <-> Claude Code environment check
#
# Confirms this Windows machine is ready for Claude Code to connect to Affinity's
# built-in MCP server. Run it from a PowerShell terminal BEFORE starting Claude Code
# (the `claude` CLI or the VS Code extension — both connect the same way).
# Exits 0 if every requirement is satisfied, 1 otherwise. Safe to re-run any time.
#
# When Node.js is present this goes beyond the plumbing and performs the real MCP
# handshake — initialize at protocol 2025-11-25, tools/list, read the preamble, and
# one read-only script — so a green run means the tools genuinely work and a document
# is open, not merely that a socket answered. Without Node it degrades to the plumbing
# checks alone and says so.

$ErrorActionPreference = 'Stop'
$ok = $true

function Pass($msg) { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:ok = $false }
function Info($msg) { Write-Host "  [info] $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "Affinity <-> Claude Code environment check" -ForegroundColor Cyan
Write-Host "-------------------------------------------"

# 1. Affinity process running
$aff = Get-Process -Name "Affinity*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($aff) {
    Pass "Affinity running (PID $($aff.Id))"
} else {
    # Distinguish "not installed" from "installed but not launched" — the fixes differ.
    $pkg = $null
    try { $pkg = Get-AppxPackage -Name "*Affinity*" -ErrorAction Stop | Select-Object -First 1 } catch {}
    if ($pkg) {
        Fail "Affinity is installed ($($pkg.Name) $($pkg.Version)) but not running. Launch it and open an image, then re-run."
    } else {
        Fail "Affinity is not running (and no Affinity package was found under this user). Install/open Affinity Photo v3, then re-run."
    }
}

# 2. Port 6767 LISTENING on IPv6 loopback
# Get-NetTCPConnection's State is a .NET enum name ("Listen"), not a localized string, so it
# works on non-English Windows -- netstat's text column ("LISTENING") is localized (e.g.
# "ABHOEREN" on German Windows) and silently never matches there.
try {
    $listening = Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $_.LocalPort -eq 6767 -and $_.LocalAddress -eq '::1' }
} catch {
    $listening = netstat -ano | Select-String "\[::1\]:6767\s+\[::\]:0\s+LISTENING"
}
if ($listening) {
    Pass "Port 6767 listening on [::1] (IPv6 loopback)"
} elseif ($aff) {
    Fail "Nothing listening on [::1]:6767. Affinity is running but its MCP server did not start -- check Edit > Settings > Model Context Protocol > Enable Affinity MCP, then restart Affinity."
} else {
    Fail "Nothing listening on [::1]:6767 (expected while Affinity is not running -- fix the check above first)."
}

# 3. .mcp.json in the current folder — this is what Claude Code reads at startup
$cfgPath = Join-Path (Get-Location) ".mcp.json"
$cfgReady = $false
if (Test-Path $cfgPath) {
    $cfgRaw = Get-Content $cfgPath -Raw
    if ($cfgRaw -match '\[::1\]:6767/sse') {
        Pass ".mcp.json present with the [::1]:6767/sse endpoint"
        $cfgReady = $true
    } elseif ($cfgRaw -match '127\.0\.0\.1|localhost') {
        Fail ".mcp.json points at localhost/127.0.0.1 -- Affinity binds IPv6 only. Change the url to http://[::1]:6767/sse"
    } else {
        Info ".mcp.json present but no Affinity entry found -- add the 'affinity' server (see SETUP.md)."
    }
} else {
    Info "No .mcp.json in this folder. Claude Code reads it at startup from the folder you launch it in -- create it here (see SETUP.md) before starting the session."
}

# 4. Real MCP handshake: initialize -> tools/list -> preamble -> read-only script.
#    Needs Node only for this probe; the connection itself never needs Node.
$nodeCandidates = @(
    "C:\Program Files\nodejs\node.exe",
    "C:\Program Files (x86)\nodejs\node.exe"
)
$nodeExe = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $nodeExe) {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { $nodeExe = $cmd.Source }
}

if ($nodeExe -and $listening) {
    # Single-quoted here-string: the JS below is written literally, no PowerShell expansion.
    $probe = @'
const http = require('http');
const HOST = '::1', PORT = 6767;
const DOC_SCRIPT = [
  "const { app } = require('/application');",
  "const all = app.documents.all;",
  "console.log('DOCS=' + all.length);",
  "const d = app.documents.current;",
  "if (d) {",
  "  let n = '(untitled)';",
  "  try { n = d.fileName || n; } catch (e) {}",
  "  console.log('DOCNAME=' + n);",
  "  console.log('SPREADS=' + d.spreads.length);",
  "  console.log('LAYERS=' + d.layers.length);",
  "}"
].join('\n');

let endpoint = null, buf = '';
const done = (code) => { try { sse.destroy(); } catch (e) {} process.exit(code); };
const guard = setTimeout(() => { console.log('PROBE_ERR=timeout'); done(1); }, 20000);

const sse = http.request({ hostname: HOST, family: 6, port: PORT, path: '/sse', method: 'GET',
                           headers: { Accept: 'text/event-stream' } }, (res) => {
  if (res.statusCode !== 200) { console.log('PROBE_ERR=http_' + res.statusCode); done(1); }
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    // Affinity separates SSE frames with CRLF. Normalise before splitting on a
    // blank line, or the endpoint event is never recognised and this hangs.
    buf += chunk.replace(/\r\n/g, '\n');
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /event:\s*(.+)/.exec(block);
      const data = /data:\s*([\s\S]+)/.exec(block);
      if (!data) continue;
      const name = ev ? ev[1].trim() : 'message';
      if (name === 'heartbeat') continue;
      if (name === 'endpoint') {
        endpoint = data[1].trim();
        send(1, 'initialize', { protocolVersion: '2025-11-25', capabilities: {},
                                clientInfo: { name: 'verify.ps1', version: '1.0.0' } });
        continue;
      }
      handle(data[1].trim());
    }
  });
});
sse.on('error', (e) => { console.log('PROBE_ERR=' + e.code); done(1); });
sse.end();

function rpc(msg) {
  const body = JSON.stringify(msg);
  const u = new URL(endpoint.startsWith('http') ? endpoint : 'http://x' + endpoint);
  const r = http.request({ hostname: HOST, family: 6, port: PORT, path: u.pathname + u.search,
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json',
                                      'Content-Length': Buffer.byteLength(body) } },
                         (res) => res.resume());
  r.on('error', (e) => { console.log('PROBE_ERR=' + e.code); done(1); });
  r.end(body);
}
function send(id, method, params) { rpc({ jsonrpc: '2.0', id, method, params }); }
function notify(method, params) { rpc({ jsonrpc: '2.0', method, params }); }

function handle(raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (m.error) {
    console.log('PROBE_ERR=rpc:' + (m.error.message || JSON.stringify(m.error)));
    done(1);
  }
  if (m.id === 1) {
    console.log('PROTO=' + m.result.protocolVersion);
    const si = m.result.serverInfo || {};
    console.log('SERVER=' + (si.name || '?') + ' ' + (si.version || '?'));
    notify('notifications/initialized', {});
    send(2, 'tools/list', {});
    return;
  }
  if (m.id === 2) {
    const names = (m.result.tools || []).map(t => t.name);
    console.log('TOOLCOUNT=' + names.length);
    console.log('TOOLS=' + names.join(','));
    // The preamble gate is per SSE session, so it must be read on THIS connection
    // before execute_script will run.
    send(3, 'tools/call', { name: 'read_sdk_documentation_topic',
                            arguments: { filename: 'preamble' } });
    return;
  }
  if (m.id === 3) {
    console.log('PREAMBLE=ok');
    send(4, 'tools/call', { name: 'execute_script', arguments: { script: DOC_SCRIPT } });
    return;
  }
  if (m.id === 4) {
    const texts = (m.result.content || []).filter(c => c.type === 'text').map(c => c.text);
    if (m.result.isError) { console.log('PROBE_ERR=script:' + texts.join(' ')); done(1); }
    console.log(texts.join('\n'));
    clearTimeout(guard);
    done(0);
  }
}
'@
    $tmp = Join-Path $env:TEMP "aff_mcp_probe.js"
    [System.IO.File]::WriteAllText($tmp, $probe, [System.Text.UTF8Encoding]::new($false))
    $out = & $nodeExe $tmp 2>&1 | Out-String
    Remove-Item $tmp -ErrorAction SilentlyContinue

    $probeErr = [regex]::Match($out, 'PROBE_ERR=(.+)')
    if ($probeErr.Success) {
        Fail "MCP handshake failed: $($probeErr.Groups[1].Value.Trim())"
    } else {
        $proto  = [regex]::Match($out, 'PROTO=(\S+)')
        $server = [regex]::Match($out, 'SERVER=(.+)')
        $count  = [regex]::Match($out, 'TOOLCOUNT=(\d+)')
        $tools  = [regex]::Match($out, 'TOOLS=(.+)')

        if ($proto.Success) {
            Pass "MCP handshake OK -- $($server.Groups[1].Value.Trim()), protocol $($proto.Groups[1].Value)"
        } else {
            Fail "MCP handshake produced no protocol version. Raw output: $out"
        }

        if ($count.Success) {
            $names = if ($tools.Success) { $tools.Groups[1].Value.Trim() -split ',' } else { @() }
            $required = @('read_sdk_documentation_topic', 'execute_script', 'render_spread')
            $missing = $required | Where-Object { $names -notcontains $_ }
            if ($missing) {
                Fail "Tools listed ($($count.Groups[1].Value)) but missing: $($missing -join ', ')"
            } else {
                Pass "$($count.Groups[1].Value) tools exposed, including execute_script and render_spread"
            }
        }

        if ($out -match 'PREAMBLE=ok') { Pass "Preamble readable and script execution allowed" }

        # A document must be open: SETUP.md steps 3-6 all operate on the current document.
        $docs = [regex]::Match($out, 'DOCS=(\d+)')
        if ($docs.Success) {
            if ([int]$docs.Groups[1].Value -gt 0) {
                $dn = [regex]::Match($out, 'DOCNAME=(.+)')
                $ly = [regex]::Match($out, 'LAYERS=(\d+)')
                $label = if ($dn.Success) { $dn.Groups[1].Value.Trim() } else { '(unnamed)' }
                $lay = if ($ly.Success) { ", $($ly.Groups[1].Value) top layer(s)" } else { '' }
                Pass "Document open: $label$lay"
            } else {
                Fail "No document open in Affinity. Open an image before running the verification sequence -- steps 3-6 all need one."
            }
        }
    }
} elseif (-not $nodeExe) {
    Info "Node.js not found -- skipping the MCP handshake probe. The connection itself does NOT need Node; only this deeper check does. Plumbing checks above still apply."
} else {
    Info "Skipping MCP handshake probe (nothing listening on [::1]:6767 yet)."
}

# 5. Claude Code present — CLI and/or VS Code extension (best-effort, informational)
$cli = Get-Command claude -ErrorAction SilentlyContinue
if ($cli) {
    Pass "Claude Code CLI on PATH ($($cli.Source))"
}
$ext = Get-ChildItem "$env:USERPROFILE\.vscode\extensions" -Filter "anthropic.claude-code-*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ext) {
    Pass "Claude Code VS Code extension installed ($($ext.Name))"
}
if (-not $cli -and -not $ext) {
    Info "Claude Code not detected (no 'claude' on PATH, no VS Code extension at the default path). Fine if installed elsewhere -- either one works."
}

Write-Host ""
if ($ok) {
    if ($cfgReady) {
        Write-Host "All required checks passed. Start Claude Code in THIS folder ('claude', or reload VS Code) so it picks up .mcp.json at startup, then run the verification sequence in SETUP.md." -ForegroundColor Green
    } else {
        Write-Host "Affinity is ready, but there is no .mcp.json here. Create it in the folder you will launch Claude Code from (see SETUP.md), then start the session there -- the file is only read at startup." -ForegroundColor Yellow
    }
    exit 0
} else {
    Write-Host "One or more checks failed. Fix the items above, then re-run." -ForegroundColor Red
    exit 1
}
