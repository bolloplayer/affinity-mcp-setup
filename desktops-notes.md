# Desktop / Cowork — Track B notes

Summary of the "Claude Desktop with a connected folder" test flow, from `workspace-assumption-checklist.md`.

## What Track B is testing

Whether Claude Desktop (Cowork) can replicate the Claude Code project-folder workflow: a persistent folder holding scripts, notes, and exports that a brand-new session picks up automatically, without being re-told the context each time.

## Flow

1. **Connect folder** — `request_cowork_directory` mounts a real folder on disk (this one: `affinity-photo-claude-code-windows`). Confirmed working: the folder persists on disk regardless of session.
2. **Set up structure** — `PROJECT.md` (stand-in for Code's `CLAUDE.md`), `scripts/`, `exports/`, `notes.md`.
3. **Session 1** — run an Affinity script through the connector, save it into `scripts/`, log a line in `notes.md`.
4. **End the conversation** completely.
5. **Session 2** — reconnect the same folder in a new chat. Before typing anything project-specific, check:
   - Does the folder need re-approval, or does it reconnect silently?
   - Does Claude read `PROJECT.md` / `notes.md` unprompted, or only when explicitly told to look?
   - Say "continue from where we left off" with no other context — does it find last session's script on its own?
6. **Shell test** — export a render, composite it with a prior export using the sandbox shell (git/node/python confirmed available), `git commit` inside the mounted folder, confirm the result matches what's actually on disk.

## Already confirmed (not still open)

- Desktop can mount and keep a real persistent folder — the "Desktop can't give you a workspace" claim is too strong as written.
- The sandbox shell has git, Node, Python — so versioning and compositing are possible from Desktop, not just Code.
- The sandbox is an isolated Linux VM, not the user's actual Windows machine — it can't literally invoke Windows PowerShell, only Linux-side equivalents (writes still land on the real mounted folder).

## Still open — the real test

Whether a **new session auto-loads context with zero prompting**, the way Code reads `CLAUDE.md` on its own. This can't be simulated inside one continuous conversation — it requires actually closing this chat and starting a fresh one against this same folder, then checking step 5 above.

## Session 2 result (2026-07-11) — resolved

Ran it for real: closed the chat, opened a brand-new one, said only "this is a new session to test if we can pick up where we left the AFF scripting" — no filenames, no other context.

- **Re-approval or silent reconnect?** Silent on my end — `request_cowork_directory` connected the folder in one call, no visible re-approval step.
- **Does Claude read `CLAUDE.md` / notes unprompted?** No. The session started with zero context. Nothing was auto-loaded — no file contents, no memory of session 1.
- **"Continue from where we left off" with no other context — does it find last session's work on its own?** Only through active effort, not recall: the prompt cued me to go looking, so I ran a directory listing (`Glob`), spotted `CLAUDE.md`, `desktops-notes.md`, `examples/color-boost.js`, and the render images, then read them explicitly. Without that listing step, none of it would have surfaced.

**Verdict:** Cowork does not replicate Code's automatic `CLAUDE.md` ingestion. A folder persists on disk and is fully readable once you look, but "looking" is a deliberate action each new session, not a default. Practical implication for the tutorial copy: a connected folder gives Desktop/Cowork durable storage, not durable *context* — you still need to prompt it (even a vague "pick up where we left off" works) to make it go read what's there.

## Step 6 result (2026-07-11) — shell compositing test

Ran the full loop: real Affinity export → sandbox composite → git commit inside the mounted folder → verified on disk.

1. **Export from Affinity via script.** `doc.export()` needed `FileExportOptions`/`FileExportArea` imported from `/document` (not `/exportconfig`, which only holds the lower-level handle classes) — `search_sdk_hints` had this already recorded, so no blind trial-and-error needed. Exported the current spread as JPEG to `IMG/session2-export.jpg`, inside `app.userDesktopPath` — confirmed filesystem access is scoped to the Desktop tree, and the mounted project folder qualifies since it *is* a subfolder of Desktop.
2. **Round-trip confirmed.** The exported file was immediately visible from the sandbox shell side of the mount (`ls IMG/` showed it at the right size/timestamp) — Affinity (Windows) → mounted folder → Linux sandbox is a real, working path, not just one-directional.
3. **Composited in the sandbox** with Python/PIL: session-1's `SDIM0953b-color-boost-75.jpg` side-by-side with the new `session2-export.jpg`, labeled, saved as `IMG/session1-session2-composite.jpg`.
4. **`git commit` hit real friction.** `.git/index` was corrupt (`bad signature 0x00000000`) and `.git/index.lock` couldn't be removed (`Operation not permitted` — the mount doesn't allow unlinking that file from the Linux side). Standard `git add`/`git commit` was fully blocked. Worked around it by pointing `GIT_INDEX_FILE` at a scratch path outside the mount, building the tree/commit there (`read-tree` → `add` → `write-tree` → `commit-tree` → `update-ref refs/heads/main`), then copying the repaired index back over `.git/index`. After that, plain `git status`/`git log` worked normally again — the repair persisted.
5. **Verified match, not assumed:** `git ls-tree` blob hashes for both new files matched `git hash-object` run directly against the on-disk files. Commit `1b609a6` is confirmed to contain exactly the bytes sitting in `IMG/`.

**Verdict:** the shell/git side of the workflow works, but isn't friction-free — a Windows↔Linux mounted folder can leave the git index in a state plain `git commit` can't recover from on its own (lock file permission mismatch across the mount boundary). The `GIT_INDEX_FILE` + manual plumbing workaround is reliable and repairs the repo for future normal `git` use, but it's not something a non-technical user would find unprompted. Worth a callout in the tutorial rather than a claim that "git commit just works" from Desktop.

**Follow-up finding:** the stale `.git/index.lock`, `.git/HEAD.lock`, and `.git/refs/heads/main.lock` from the first corrupted attempt could never be unlinked from the sandbox side (`Operation not permitted` every time) — they're still sitting there. That means every *subsequent* commit in this session also hit "Unable to create .lock: File exists" and needed the same manual workaround, including overwriting `.git/refs/heads/main` directly with `echo <sha> >` instead of `git update-ref`, since even `update-ref` couldn't create its own lock. This isn't a one-time fix — it's a standing condition of this repo in this sandbox until the lock files are cleared from the Windows side directly (outside the sandbox's reach).

## UI finding (2026-07-11) — no VS Code-style file tree in Cowork

Asked directly whether Desktop/Cowork has a folder/file-tree view like VS Code's Explorer sidebar. Checked the official docs (support.claude.com, claude.com tutorials) rather than guessing:

- **No persistent file-tree sidebar.** Cowork's sidebar shows plan progress and the sources/files a task is drawing from as it runs — not a navigable folder tree of the connected directory.
- **Finished files appear as cards** you open or download (what `present_files` produces in this chat), not as entries in a browsable tree.
- **To actually see folder contents**, you ask Claude to list them (e.g. "what's in this folder") — same as the `Glob` calls used earlier in Track B — there's no UI-level browse-by-yourself option inside Cowork.
- **The closer match is the separate "Code" tab** in the same desktop app (Claude Code, not Cowork) — built more like an IDE with diffs and a project view. Not confirmed whether it has a literal file tree either; that's a separate, unverified claim.

**Practical implication:** if the tutorial implies Desktop gives you an IDE-like project browser, that's overstated. What Desktop/Cowork actually gives you is folder *access* (read/write via the mount) plus the ability to ask Claude to enumerate/inspect it — not a visual file explorer.
