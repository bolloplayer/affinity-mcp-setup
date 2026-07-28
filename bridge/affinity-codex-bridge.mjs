#!/usr/bin/env node

import readline from "node:readline";

const affinitySseUrl =
  process.env.AFFINITY_MCP_SSE_URL ?? "http://[::1]:6767/sse";
const affinityProtocolVersion =
  process.env.AFFINITY_MCP_PROTOCOL_VERSION ?? "2025-11-25";

const pendingClientProtocolVersions = new Map();
let messageEndpoint;
let resolveMessageEndpoint;
let rejectMessageEndpoint;
let shuttingDown = false;

const messageEndpointReady = new Promise((resolve, reject) => {
  resolveMessageEndpoint = resolve;
  rejectMessageEndpoint = reject;
});

function log(message) {
  process.stderr.write(`[affinity-codex-bridge] ${message}\n`);
}

function writeJsonRpc(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handleRemoteMessage(data) {
  let message;
  try {
    message = JSON.parse(data);
  } catch (error) {
    log(`Ignoring invalid JSON from Affinity: ${error.message}`);
    return;
  }

  if (
    Object.hasOwn(message, "id") &&
    pendingClientProtocolVersions.has(message.id)
  ) {
    const clientProtocolVersion = pendingClientProtocolVersions.get(message.id);
    pendingClientProtocolVersions.delete(message.id);

    if (message.result && typeof message.result === "object") {
      message.result.protocolVersion = clientProtocolVersion;
    }
  }

  writeJsonRpc(message);
}

function handleSseEvent(eventName, data) {
  if (eventName === "endpoint") {
    if (messageEndpoint) {
      return;
    }

    messageEndpoint = new URL(data, affinitySseUrl).href;
    log(`Affinity SSE connected; message endpoint discovered`);
    resolveMessageEndpoint(messageEndpoint);
    return;
  }

  if (eventName === "message") {
    handleRemoteMessage(data);
  }
}

async function consumeSse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines = [];

  function processLine(line) {
    if (line === "") {
      if (dataLines.length > 0) {
        handleSseEvent(eventName, dataLines.join("\n"));
      }
      eventName = "message";
      dataLines = [];
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  while (!shuttingDown) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processLine(line);
    }
  }

  if (!shuttingDown) {
    throw new Error("Affinity closed the SSE stream");
  }
}

async function connectToAffinity() {
  const response = await fetch(affinitySseUrl, {
    headers: { Accept: "text/event-stream" },
  });

  if (!response.ok) {
    throw new Error(
      `Affinity SSE connection returned HTTP ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/event-stream")) {
    throw new Error(
      `Affinity returned unexpected content type: ${contentType || "(none)"}`,
    );
  }

  await consumeSse(response);
}

async function sendToAffinity(message) {
  const endpoint = await messageEndpointReady;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(
      `Affinity message endpoint returned HTTP ${response.status}`,
    );
  }
}

async function handleClientLine(line) {
  if (!line.trim()) {
    return;
  }

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    log(`Ignoring invalid JSON from Codex: ${error.message}`);
    return;
  }

  if (
    message.method === "initialize" &&
    message.params &&
    typeof message.params === "object"
  ) {
    const clientProtocolVersion = message.params.protocolVersion;
    if (Object.hasOwn(message, "id")) {
      pendingClientProtocolVersions.set(message.id, clientProtocolVersion);
    }

    message.params = {
      ...message.params,
      protocolVersion: affinityProtocolVersion,
    };
    log(
      `Translating initialize protocol ${clientProtocolVersion} -> ${affinityProtocolVersion}`,
    );
  }

  await sendToAffinity(message);
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`Fatal error: ${message}`);
  rejectMessageEndpoint(error);
  process.exitCode = 1;
  shuttingDown = true;
}

connectToAffinity().catch(fail);

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false,
});

let inputQueue = Promise.resolve();
input.on("line", (line) => {
  inputQueue = inputQueue.then(() => handleClientLine(line)).catch(fail);
});

input.on("close", () => {
  shuttingDown = true;
});

process.on("SIGINT", () => {
  shuttingDown = true;
  process.exit(0);
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  process.exit(0);
});
