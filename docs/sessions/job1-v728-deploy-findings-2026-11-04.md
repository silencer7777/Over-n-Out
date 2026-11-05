# Job 1 — V7.28 deploy: findings (Wed Nov 4, 2026, ~21:40 PT)

Coordinator: new session (one pen). Method: direct GitHub API reads via the
connector's approved helper (no cached/stale surfaces), live-page fetches,
filesystem search. Zero writes were made to any remote during this audit.

## Verified facts

1. **Pages configuration (API, /repos/silencer7777/Over-n-Out/pages):**
   `build_type: legacy`, `source: { branch: "main", path: "/" }`, status built.
   **Pages serves `main`. There is no gh-pages serving configuration.**
2. **Remote refs (API, /git/refs/heads):** exactly one branch — `main` at
   `96e865a6d1fac1e45d7a66bb9185fc74a07c7f6a`. **`gh-pages` ref: 404 — the
   branch does not exist.** No tags.
3. **Remote main content:** tip commit "V7.21 data-map expansion + team
   upgrades" (per-file Contents-API commit chain, parent 95f39ee). Served
   `index.html` on main decodes to **BUILD V7.21 · v0.7.21**. Marker files
   `js/mappick.js`, `js/expansion.js`, `js/tripwire.js` → 404 on main;
   `js/characters.js`/`js/clans.js` present (V7.19/V7.20 content). Tree: 252
   blobs. **Remote main == V7.21 == live site. The pipeline is healthy; it
   simply never received V7.22+.**
4. **V7.22–V7.28 source: nowhere.** `~/workspace/.over-n-out-scratch/` does
   not exist. Filesystem-wide search for `mappick.js` / `expansion.js` /
   `tripwire.js` / `weather.js`: zero hits. Main clone `git log --all -S
   "V7.28"`: zero commits. The prior run's reported SHAs (4e440a5, ba2b5d4,
   0a6b596, 72472d2, 959d470) resolve to nothing reachable.

## Conclusion

The V7.22–V7.28 mega-build work product is **lost** — it was never durably
written to any location that survives (same session produced the false
"29/29" gate log it later "corrected" and the phantom-push verification;
its byte-level claims are not trustworthy). The earlier "Pages serves
gh-pages" root-cause conclusion was also wrong.

**Deploy verdict: HARD BLOCKER — source artifact lost.** Nothing to push.
The V7.21 build serving live is untouched and consistent with remote main;
no remote state was changed by this audit.

## What this means for the work order

Job 2 proceeds on the real, canonical codebase: main clone at 0d85968
(V7.21). Features the earlier report claimed as shipped in V7.22–V7.28
(5 pipeline maps, Compound tunnels, weather system, V7.23 audio pass) are
**not in the live game** and would need to be rebuilt if still wanted —
a separate decision from Job 2's forward directives.
