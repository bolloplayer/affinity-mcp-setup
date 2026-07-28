#!/usr/bin/env node

import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const bridgePath = fileURLToPath(
  new URL("./affinity-codex-bridge.mjs", import.meta.url),
);
const child = spawn(process.execPath, [bridgePath], {
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

const responses = new Map();
let nextId = 1;

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

const output = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

output.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (responses.has(message.id)) {
    const { resolve, reject, timer } = responses.get(message.id);
    clearTimeout(timer);
    responses.delete(message.id);
    if (message.error) {
      reject(new Error(JSON.stringify(message.error)));
    } else {
      resolve(message.result);
    }
  }
});

function request(method, params = {}) {
  const id = nextId++;
  const message = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(`${JSON.stringify(message)}\n`);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      responses.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 15_000);
    responses.set(id, { resolve, reject, timer });
  });
}

function notify(method, params = {}) {
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`,
  );
}

try {
  const initialized = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "affinity-codex-bridge-smoke-test",
      version: "1.0.0",
    },
  });

  notify("notifications/initialized");

  const listed = await request("tools/list");
  const toolNames = (listed.tools ?? []).map((tool) => tool.name);
  const requiredToolMetadata = Object.fromEntries(
    (listed.tools ?? [])
      .filter((tool) =>
        ["read_sdk_documentation_topic", "execute_script"].includes(tool.name),
      )
      .map((tool) => [
        tool.name,
        {
          annotations: tool.annotations ?? null,
          meta: tool._meta ?? null,
        },
      ]),
  );
  const requiredTools = [
    "read_sdk_documentation_topic",
    "execute_script",
  ];
  for (const requiredTool of requiredTools) {
    if (!toolNames.includes(requiredTool)) {
      throw new Error(`Required tool missing: ${requiredTool}`);
    }
  }

  const preamble = await request("tools/call", {
    name: "read_sdk_documentation_topic",
    arguments: { filename: "preamble" },
  });

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        clientFacingProtocolVersion: initialized.protocolVersion,
        server: initialized.serverInfo,
        toolCount: toolNames.length,
        requiredTools,
        requiredToolMetadata,
        preambleRead:
          Array.isArray(preamble.content) && preamble.content.length > 0,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Smoke test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  child.stdin.end();
  child.kill();
}
