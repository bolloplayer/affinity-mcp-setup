## Affinity MCP setup — continue here

You are **Part 2**. Part 1 is done: the `affinity` entry is merged into
`~/.gemini/config/mcp_config.json` and the scripts are in `examples/`. The connection could not be
used in the session that wrote the config, because MCP configuration loads at startup. This session
is the restart.

Do this now, without waiting to be asked: follow the **Antigravity section** of `SETUP.md` in this
folder — steps 5 to 7. Step 5 is read-only; then offer the two options in step 6 and let the user
pick. Don't choose for them and don't run anything that writes to their document until they ask.

Two Antigravity-specific guards: **do not run `verify.ps1`, and do not create a `.mcp.json`.**
Neither applies to this harness.

If `SETUP.md` isn't in this folder, fetch it from
https://raw.githubusercontent.com/bolloplayer/affinity-mcp-setup/main/SETUP.md rather than inventing
the steps.

Delete this section once you have offered the choices; the file too if nothing else is left in it.
Don't state what has or hasn't been done to the document — check the layer stack yourself, because
this note may be out of date.
