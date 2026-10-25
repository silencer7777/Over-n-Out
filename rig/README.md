# OVER N' OUT — TEST RIG (the "5 VMs", 10 agents, 100 bots)

Owner order, Oct 25, 2026: five test environments (stability, balance,
compatibility, comparative, backup), a 10-agent roster, and a 100-bot
test team — all kept in this repo with the game code.

## What these "VMs" honestly are

They are **five isolated test environments**, not five operating-system
virtual machines. Each one is a dedicated runner (in this directory)
that checks out the exact commit under test into its own throwaway
**git worktree sandbox** under `~/workspace/over-n-out-rig-scratch/`,
runs its instruments against that tree, and writes a dated report to
`rig/reports/`. Isolation is real (no VM can see another's tree, and
none of them can touch the live checkout); the boundary is the
filesystem + process, not a hypervisor. That is the right tool here:
the game is a zero-dependency Node/Three.js codebase whose failures
are code failures, not OS failures.

The **"100 bots"** are a **swarm**: many headless bot matches stepped
in parallel (`rig/swarm/`). The sim fields ≤9 bots alive per match by
design, so the swarm runs *many matches at once* — 2 scripted players +
bot fill each. Every swarm report states two honest numbers: total bot
lives simulated in the run, and the concurrent bot ceiling
(workers × per-match peak). On this 2-core box the validated
parallelism is small (see the latest swarm report); the swarm scales
linearly with cores/machines — ~10 concurrent matches ≈ 100+
concurrent bots. Nobody should quote "100 bots" without saying which
number they mean.

## The five environments

| VM | Directory | Job | Run |
|---|---|---|---|
| VM1 Stability | `vm1-stability/` | Full gate suite (smoke, biome, reachability, map reachability) + repeated soak/ws-soak — the long-run stability config | `node rig/vm1-stability/run.mjs --commit <ref> --soaks 10 --ws-soaks 2` |
| VM2 Balance | `vm2-balance/` | balance-probe TTK tables vs the V5 baseline + a bot-vs-field win-rate matrix over every round mode × map × weapon profile | `node rig/vm2-balance/run.mjs --commit <ref>` |
| VM3 Compatibility | `vm3-compatibility/` | Boots the commit's real server; checks routes + touch-detection contract across desktop/laptop/iPhone/Android/tablet profiles + the mobile-check suite | `node rig/vm3-compatibility/run.mjs --commit <ref>` |
| VM4 Comparative | `vm4-comparative/` | A/B regression: v6-metrics scene audit + smoke on two commits, per-map diff verdict vs Board 006 bars | `node rig/vm4-comparative/run.mjs --a <ref> --b <ref>` |
| VM5 Backup | `vm5-backup/` | `git archive` snapshot + per-file checksums + metrics + ledger into `rig/backups/` manifests (archives stay in scratch); restore drill proves a snapshot boots | `node rig/vm5-backup/backup.mjs --commit <ref>` then `node rig/vm5-backup/restore-drill.mjs --backup <date>-<sha>` |

Supporting pieces: `lib/riglib.mjs` (shared plumbing), `agents/ROSTER.md`
(the 10 seats), `swarm/` (the bot team), `reports/` (every run's dated
output — the rig's memory), `backups/` (manifests only, never archives).

## Rules of the rig

1. **Runners never edit game code.** A VM that finds a failure reports
   it; fixes belong to the owning seat (see roster), in the open.
2. **Pinned commits only.** Every run names the exact SHA it tested. A
   report without a SHA is not a report.
3. **Gates need exit 0 AND the PASSED marker.** One signal has lied
   before; two agreeing signals are the bar.
4. **Scratch stays in scratch.** Worktrees, archives and extracts live
   under `~/workspace/over-n-out-rig-scratch/` and are cleaned up;
   only definitions, docs, manifests and reports are committed.
5. **One pen per surface** — the rig directory belongs to the Rig
   Engineer seat; game surfaces belong to their owners (AGENTS.md).
6. **Nothing pushes.** Rig commits are local `v6(rig):` only; the
   owner taps every push, as always.
