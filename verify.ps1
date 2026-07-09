# verify.ps1 — Affinity Photo <-> Claude Code environment check
#
# Confirms this Windows machine is ready for Claude Code to connect to Affinity's
# built-in MCP server. Run it from a PowerShell terminal BEFORE starting Claude Code
# (the `claude` CLI or the VS Code extension — both connect the same way).
# Exits 0 if every requirement is satisfied, 1 otherwise. Safe to re-run any time.
#
# Note: this checks the *plumbing* (Affinity up, port listening, IPv6 reachable).
# It does NOT test the MCP tools themselves — that can only be done from inside a
# Claude Code session by calling read_sdk_documentation_topic({ filename: "preamble" }).

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
    Fail "Affinity is not running. Open it first."
}

# 2. Port 6767 LISTENING on IPv6 loopback
$listening = netstat -ano | Select-String "\[::1\]:6767\s+\[::\]:0\s+LISTENING"
if ($listening) {
    Pass "Port 6767 listening on [::1] (IPv6 loopback)"
} elseif ($aff) {
    Fail "Nothing listening on [::1]:6767. Affinity is running but its MCP server did not start -- check Edit > Settings > Model Context Protocol > Enable Affinity MCP, then restart Affinity."
} else {
    Fail "Nothing listening on [::1]:6767 (expected while Affinity is not running -- fix the check above first)."
}

# 3. IPv6 SSE handshake reachability (optional — needs Node just for this probe)
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
    $probe = @"
const http = require('http');
const r = http.request({ hostname:'::1', family:6, port:6767, path:'/sse', method:'GET',
                         headers:{Accept:'text/event-stream'} }, (res) => {
    process.stdout.write(String(res.statusCode));
    res.destroy(); r.destroy(); process.exit(0);
});
r.setTimeout(3000, () => { process.stdout.write('TIMEOUT'); process.exit(1); });
r.on('error', e => { process.stdout.write('ERR:'+e.code); process.exit(1); });
r.end();
"@
    $tmp = Join-Path $env:TEMP "aff_ipv6_probe.js"
    [System.IO.File]::WriteAllText($tmp, $probe, [System.Text.UTF8Encoding]::new($false))
    $status = & $nodeExe $tmp 2>&1
    Remove-Item $tmp -ErrorAction SilentlyContinue
    if ($status -eq '200') {
        Pass "IPv6 SSE handshake reachable ($status)"
    } else {
        Fail "IPv6 SSE probe failed: $status"
    }
} elseif (-not $nodeExe) {
    Info "Skipping SSE handshake probe (Node.js not found -- it is not required for the connection, only for this optional probe)."
} else {
    Info "Skipping SSE handshake probe (nothing listening on [::1]:6767 yet)."
}

# 4. Claude Code present — CLI and/or VS Code extension (best-effort, informational)
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
    Write-Host "All required checks passed. Start Claude Code (run 'claude' here, or reload VS Code), then ask for the preamble in a chat." -ForegroundColor Green
    exit 0
} else {
    Write-Host "One or more checks failed. Fix the items above, then re-run." -ForegroundColor Red
    exit 1
}
