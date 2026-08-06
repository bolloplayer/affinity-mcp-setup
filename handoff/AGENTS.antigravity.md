## Affinity MCP setup — continue here

State: the `affinity` entry is merged into `~/.gemini/config/mcp_config.json`, and the scripts
are in `examples/`. The connection could not be used in the session that wrote the config,
because MCP configuration loads at startup. This session is the restart.

Do this now, without waiting to be asked. It is read-only:

1. Confirm the `affinity` MCP tools are present (11 of them).
2. `read_sdk_documentation_topic({ filename: "preamble" })` — the gate is per connection.
3. Run `examples/inspect-document.js` via `execute_script` and report the Affinity
   version, the open document and its layer stack.

Then hand over — report what step 3 established, then offer these two, verbatim,
and let them pick:

1 — Run the colour boost script. Add examples/color-boost-two-layer.js to Affinity's
script library, run it on the open image, tell them the name it's saved under and how
to undo it. Don't render or describe the result — they'll look in Affinity.

2 — Have me write one from scratch. Write a black-and-white conversion against the
SDK docs (don't guess at API calls), save it to the library, run it, same ending as
option 1.

SETUP.md should be in this folder (fetched earlier) — read its Antigravity section
for the exact run steps once they pick 1 or 2. If it isn't here, fetch it from
https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/SETUP.md rather
than inventing steps. Do not run anything that writes to their document until they
ask. Do not run verify.ps1 and do not create a .mcp.json.

Delete this section once you have offered the choices; the file too if nothing else is
left in it.
