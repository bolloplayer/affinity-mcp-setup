## Affinity MCP setup — continue here

State: `.agents/mcp_config.json` is written and the scripts are in `examples/`. The
connection could not be used in the session that wrote the config, because MCP
configuration loads at startup. This session is the restart.

Do this now, without waiting to be asked. It is read-only:

1. Confirm the `affinity` MCP tools are present (11 of them).
2. `read_sdk_documentation_topic({ filename: "preamble" })` — the gate is per connection.
3. Run `examples/inspect-document.js` via `execute_script` and report the Affinity
   version, the open document and its layer stack.

Then offer the user the two options from SETUP.md's Antigravity section and let them
pick. Do not run anything that writes to their document until they ask. Do not run
verify.ps1 and do not create a .mcp.json.

Delete this section once you have offered the choices; the file too if nothing else is
left in it.
