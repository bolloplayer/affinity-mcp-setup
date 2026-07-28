---
name: pages-traffic
description: Check whether the public tutorial site is getting visitors. Pulls GitHub's repo traffic stats (views, clones, popular paths, referrers) for the public companion repo bolloplayer/affinity-photo-claude-code-windows and its GitHub Pages site, prints a summary, and appends a snapshot to analytics/pages-traffic-log.csv so history survives past GitHub's 14-day retention window. Use when the user asks about page views, site traffic, visits, analytics, "is anyone looking at this", or wants to check the tutorial page's stats.
---

# Public repo / Pages traffic check

This repo (`affinity-photo-claude-code-windows-private`) is private. The tutorial content is
published from a public sibling repo, **`bolloplayer/affinity-photo-claude-code-windows`**, whose
GitHub Pages site is `https://bolloplayer.github.io/affinity-photo-claude-code-windows/`
(`docs/index.html` in that repo).

## Important caveat — read before reporting numbers

GitHub's traffic API measures visits to **github.com pages of the repo** (the repo homepage,
`blob`/`tree` file views, `git clone`/checkout activity) — it does **not** separately track hits
to the rendered GitHub Pages site (`*.github.io`). There is no built-in GitHub analytics for
Pages. Confirmed by checking `docs/index.html` in the public repo: it has no analytics snippet
(no Google Analytics / Plausible / GoatCounter / Umami / etc.), so page-level visit data doesn't
exist anywhere right now. Always state this caveat when reporting results — "repo traffic" is a
proxy for interest, not a direct visit count for the tutorial page itself.

If the user wants real Pages-visit tracking, that requires adding a lightweight analytics snippet
(e.g. GoatCounter or Plausible, both privacy-friendly and free for small sites) to
`docs/index.html` in the public repo. Don't do this unprompted — ask first, since it means editing
the public-facing page and adding a third-party script.

## Steps

1. Confirm `gh auth status` is logged in (it should already be, from prior use in this repo).

2. Pull the four traffic endpoints for the public repo (14-day rolling window, requires push
   access — the user has it):

   ```
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/views
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/clones
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/popular/paths
   gh api repos/bolloplayer/affinity-photo-claude-code-windows/traffic/popular/referrers
   ```

3. Also pull stars/forks/watchers for general-interest context:

   ```
   gh api repos/bolloplayer/affinity-photo-claude-code-windows --jq "{stars: .stargazers_count, forks: .forks_count, watchers: .subscribers_count}"
   ```

4. Summarize for the user in plain text (a short table or bullets is fine — don't build an
   artifact/dashboard unless they ask for one):
   - Total views & unique visitors over the last 14 days, and whether there's a spike on any day
   - Total clones & unique cloners over the last 14 days
   - Popular paths (which files/pages people are actually opening — e.g. if `docs/index.html`-driven
     traffic doesn't show up because Pages hits aren't tracked, say so)
   - Referrers (where traffic is coming from), if any
   - Stars/forks/watchers as a low-traffic-but-nonzero-interest signal

5. Append a snapshot row to `analytics/pages-traffic-log.csv` in *this* private repo (create the
   file with a header row if it doesn't exist yet — see existing file for the schema). This is
   what makes repeated runs useful: GitHub only retains 14 days of traffic history, so without a
   local log, older data is lost. One row per time this skill is run, not one row per day in the
   API response — the API's daily breakdown is transient, only today's cumulative totals matter
   for the log.

6. Do not commit the log automatically — leave it as a local, uncommitted file update unless the
   user explicitly asks to commit it. It's working data, not something to push to either repo.

## Tracked Reddit posts

Reddit posts driving traffic to the tutorial, for correlation with GitHub traffic spikes:

- **Part II (DeepSeek)** — posted 2026-07-25 to r/Affinity:
  `https://www.reddit.com/r/Affinity/comments/1v5s036/scripting_affinity_photo_with_deepseek_instead_of/`

**This cannot be fetched automatically.** Confirmed 2026-07-25: both WebFetch and a raw `curl`
from this environment get hard-blocked by Reddit ("whoa there, pardner! Your request has been
blocked due to a network policy") — reddit.com is unreachable from here, JSON endpoint included.

Also, even with access, **Reddit has no public view/impression count** for posts — its API (and
the `.json` endpoint) only exposes `score` (net upvotes), `num_comments`, and `upvote_ratio`.
"Views" isn't a number Reddit ever hands out publicly, from this environment or any other.

**Practical path:** ask the user for the post's current score/comment count when they check it
themselves (e.g. "how's the post doing?"), and log it as a note on the next traffic-log row
alongside that day's GitHub numbers, e.g. `"r/Affinity Part II post: 34 upvotes, 6 comments as of
7/27"`. Don't attempt an automated fetch — it will fail every time until Reddit access changes.

## Log schema (`analytics/pages-traffic-log.csv`)

```
checked_at,views_14d,unique_views_14d,clones_14d,unique_clones_14d,stars,forks,watchers,top_path,notes
```

`checked_at` is an ISO date (`YYYY-MM-DD`) for when the skill ran, not a period. `top_path` is the
single most-viewed path from `traffic/popular/paths` (or blank if none). `notes` is free text for
anything notable (e.g. "spike from HN post").
