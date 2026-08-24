#!/usr/bin/env node
/**
 * bootstrap.mjs — Download Affinity MCP setup files reliably
 *
 * Works in sandboxes where TLS/schannel/Invoke-WebRequest fail.
 * Uses Node.js fetch (available in Node 18+) which succeeds where
 * platform-native TLS backends cannot acquire credentials.
 *
 * Usage:
 *   node bootstrap.mjs
 *
 * Downloads: SETUP.md, bridge/, examples/, verify.ps1, docs/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main';

const FILES = [
  'SETUP.md',
  'README.md',
  'verify.ps1',
  'bridge/affinity-codex-bridge.mjs',
  'bridge/README.md',
  'bridge/smoke-test.mjs',
  'examples/inspect-document.js',
  'examples/color-boost.js',
  'examples/color-boost-two-layer.js',
  'examples/README.md',
  'docs/sdk-notes.md',
  'docs/tips-choose-your-ai.md',
];

async function downloadFile(relPath) {
  const url = `${BASE_URL}/${relPath}`;
  const filePath = path.join(__dirname, relPath);
  const dirPath = path.dirname(filePath);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ${relPath}: HTTP ${res.status}`);
      return false;
    }

    const text = await res.text();
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
    console.log(`✓ ${relPath}`);
    return true;
  } catch (err) {
    console.error(`✗ ${relPath}: ${err.message}`);
    return false;
  }
}

async function bootstrap() {
  console.log('Fetching Affinity MCP setup files...\n');

  let succeeded = 0;
  let failed = 0;

  for (const file of FILES) {
    if (await downloadFile(file)) {
      succeeded++;
    } else {
      failed++;
    }
  }

  console.log(`\n${succeeded} files downloaded, ${failed} failed.`);

  if (succeeded > 0) {
    console.log('\nNext steps:');
    console.log('1. Read SETUP.md');
    console.log('2. Find your harness in §2 (Claude Code, Codex, Antigravity, etc.)');
    console.log('3. Follow the setup instructions for your harness');
  }

  process.exit(failed > 0 ? 1 : 0);
}

bootstrap();
