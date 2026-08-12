---
name: pages-traffic
description: Check whether the public tutorial site is getting visitors. Pulls GitHub's repo traffic stats (views, clones, popular paths, referrers) for the public companion repo bolloplayer/affinity-mcp-setup and its GitHub Pages site — plus the archived predecessor bolloplayer/affinity-photo-claude-code-windows, which old links still reach — prints a summary, and appends a snapshot to analytics/pages-traffic-log.csv so history survives past GitHub's 14-day retention window. Use when the user asks about page views, site traffic, visits, analytics, "is anyone looking at this", or wants to check the tutorial page's stats.
---

# Public repo / Pages traffic check

This repo (`affinity-mcp-setup-private`) is private. The tutorial content is
published from a public sibling repo.

**The public repo moved on 4 August 2026.** There are two, and both still receive traffic:

| Repo | Pages site | Role |
|---|---|---|
| **`bolloplayer/affinity-mcp-setup`** | `https://bolloplayer.github.io/affinity-mcp-setup/` | **Live.** The one that matters — report its numbers first |
| `bolloplayer/affinity-photo-claude-code-windows` | `https://bolloplayer.github.io/affinity-photo-claude-code-windows/` | **Archived**, but its Pages site still serves and its README points at the new home. Old Reddit links land here, so its traffic is the residual-interest signal |

Query **both**. Traffic arriving at the archived repo is real interest that the live repo's own
numbers do not capture, and the split between them shows how well the old links are forwarding.

## Important caveat — read before reporting numbers

GitHub's traffic API measures visits to **github.com pages of the repo** (the repo homepage,
`blob`/`tree` file views, `git clone`/checkout activity) — it does **not** separately track hits
to the rendered GitHub Pages site (`*.github.io`). There is no built-in GitHub analytics for
Pages. Re-confirmed 2026-08-12 against `docs/index.html` in `affinity-mcp-setup`: still no
analytics snippet (no Google Analytics / Plausible / GoatCounter / Umami / etc.), so page-level
visit data doesn't exist anywhere right now. Always state this caveat when reporting results —
"repo traffic" is a proxy for interest, not a direct visit count for the tutorial page itself.

If the user wants real Pages-visit tracking, that requires adding a lightweight analytics snippet
(e.g. GoatCounter or Plausible, both privacy-friendly and free for small sites) to
`docs/index.html` in the public repo. Don't do this unprompted — ask first, since it means editing
the public-facing page and adding a third-party script.

## Steps

1. Confirm `gh auth status` is logged in (it should already be, from prior use in this repo).

2. Pull the four traffic endpoints for **each** repo (14-day rolling window, requires push
   access — the user has it). Archived repos still serve these endpoints normally:

   ```
   gh api repos/bolloplayer/affinity-mcp-setup/traffic/views
   gh api repos/bolloplayer/affinity-mcp-setup/traffic/clones
   gh api repos/bolloplayer/affinity-mcp-setup/traffic/popular/paths
   gh api repos/bolloplayer/affinity-mcp-setup/traffic/popular/referrers

   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/views
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/clones
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/popular/paths
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/popular/referrers
   ```

   Listed literally rather than as a shell loop: this machine's primary shell is PowerShell, where
   `for R in …; do … done` is a parse error. These eight lines run under either shell.

3. Also pull stars/forks/watchers for general-interest context, for both:

   ```
   gh api repos/bolloplayer/affinity-mcp-setup --jq "{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count}"
   gh api repos/bolloplayer/affinity-photo-claude-code-windows --jq "{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count}"
   ```

4. Summarize for the user in plain text (a short table or bullets is fine — don't build an
   artifact/dashboard unless they ask for one). Lead with `affinity-mcp-setup` and give the
   archived repo as a secondary line, then per repo:
   - Total views & unique visitors over the last 14 days, and whether there's a spike on any day
   - Total clones & unique cloners over the last 14 days
   - Popular paths (which files/pages people are actually opening — e.g. if `docs/index.html`-driven
     traffic doesn't show up because Pages hits aren't tracked, say so)
   - Referrers (where traffic is coming from), if any
   - Stars/forks/watchers as a low-traffic-but-nonzero-interest signal

   **Do not try to measure whether the tombstone README is forwarding people.** `popular/referrers`
   returns referring *hosts* only — `github.com`, `bolloplayer.github.io`, `Google` — never a
   source repo or path. A click from the archived README through to `affinity-mcp-setup` arrives
   as an ordinary `github.com` referrer, indistinguishable from any other on-site navigation, so
   the forwarding signal cannot appear even when forwarding is working perfectly. Concluding "old
   links are dead-ending" from its absence is unfalsifiable, and wrong. If forwarding really needs
   measuring, it takes a tagged link (e.g. `?from=archived`) plus page-level analytics, neither of
   which exists today.

5. Append a snapshot row **per repo** to `analytics/pages-traffic-log.csv` in *this* private repo
   (create the file with a header row if it doesn't exist yet — see existing file for the schema).
   Two rows per run, same `checked_at`, distinguished by the `repo` column. This is what makes
   repeated runs useful: GitHub only retains 14 days of traffic history, so without a local log,
   older data is lost. One row per repo per time this skill is run, not one row per day in the
   API response — the API's daily breakdown is transient, only today's cumulative totals matter
   for the log.

6. Do not commit the **snapshot rows** automatically — leave them as a local, uncommitted file
   update unless the user explicitly asks to commit them. They're working data, not something to
   push to either repo. (Git history shows snapshot rows committed on 12 Aug 2026: the user asked
   explicitly that once. It is not the default.)

   Carve-out: changes to the *schema* — the header row, and any backfill needed to keep older rows
   valid under it — are committed, since a header that only exists locally breaks the next run.

## Reddit — obsolete, do not raise it

The earlier r/Affinity posts are **obsolete as of 12 Aug 2026**. They still point at the archived
repo, and that is fine. Do not correlate traffic against them, do not suggest editing them, and
do not ask the user for post scores.

Background, so it isn't re-investigated: reddit.com is hard-blocked from this environment
(WebFetch and raw `curl` both get "your request has been blocked due to a network policy"), and
even with access Reddit exposes no public view count — only `score`, `num_comments` and
`upvote_ratio`. Any automated fetch will fail.

## Log schema (`analytics/pages-traffic-log.csv`)

```
checked_at,repo,views_14d,unique_views_14d,clones_14d,unique_clones_14d,stars,forks,watchers,top_path,notes
```

`checked_at` is an ISO date (`YYYY-MM-DD`) for when the skill ran, not a period. `repo` is the
short name — `affinity-mcp-setup` or `affinity-photo-claude-code-windows`. `top_path` is the
single most-viewed path from `traffic/popular/paths` (or blank if none). `notes` is free text for
anything notable (e.g. "spike from HN post").

### One discontinuity in the history — do not read across it

**4 Aug 2026**: the public repo moved. Rows before that date exist only for
`affinity-photo-claude-code-windows`, which was the live repo then and is the archived one now. A
drop in its numbers after that date is the move, not lost interest. Never total or trend
`views_14d` across the move without splitting by `repo` first.

**`affinity-mcp-setup` lost nothing to the gap in snapshots.** The repo was created
2026-08-04T15:10, and the 12 Aug snapshot's window opened 28 Jul — before the repo existed — so
its entire life to that date is captured in the 2026-08-12 row. There is no missing fortnight.
(An earlier version of this file claimed otherwise; it was wrong, and would have led a future run
to discount the 4–6 Aug clone data it actually holds.)
