# Board Meeting 004 — V4 Scope Ruling (Online, Modes, Loadouts, Progression, Bigger Worlds)

Convened: Oct 24, 2026. Chair: Dominic "Apex" Cross. Present: full
studio (33) + Division Zero + Team Lumen leadership. Called by the
owner's green-light: *"lets begin working on v4. lets also include
game modes with clear goals and objectives. so begin building and
include everything I asked about."* — followed by three further
owner directives the same day (personal loadouts; progression + the
3× bar; bigger maps). All four are recorded below as OWNER
DIRECTIVES and ruled into the build. Local commits only; Brett
approves every push.

## Owner directives (binding)

- **D1 — Modes.** V4 ships game modes with clear goals and
  objectives (menu select, HUD objective, win/lose, scoring).
- **D2 — Personal loadouts.** Up to 5 classes: primary weapon +
  attachments + one TACTICAL (flashbang) + one LETHAL (frag
  grenade). **Board 003's Phase 2 grenade cut is SUPERSEDED by
  owner order** — grenades are in V4, server-authoritative online,
  same code path solo.
- **D3 — Progression.** XP from kills/objective play/wins/streaks,
  a level curve, attachments + class slots unlock progressively
  (early levels generous). Level + progress in the menu; post-match
  XP summary. Local profile persistence with V3 settings carried
  forward (no save wipes). Online XP is server-computed, never
  client-trusted. Accounts/cloud saves = future seam, NOT V4.
- **D4 — Bigger worlds.** Every biome map grows, with named points
  of interest, landmarks, hidden/vantage spots and exploration
  rewards (pickups, DMR nests, Relay story transmissions).
  Density-of-interest is the metric. Modes are designed against
  the new sizes; the reachability gate is extended to the new
  areas; worlddata covers the expanded maps exactly.
- **D5 — The 3× bar.** V4 must be TRANSITIONAL from V3, not a
  reskin: "3 times as realistic, 3 times as powerful, 3 times as
  smooth." Translated into checkable targets in §6 below; the V4
  report scores against them honestly.

## 1. Mode list — RULED (Trigger + Ledger + Uplink; Verity canon pass)

Four modes ship. Mode definitions live in ONE shared data module
(`js/modes.js`) read by the client, the sim and the menu — goals,
targets and scoring can never drift between solo and online.

| Mode | Goal (shown to player) | Win | Lose | Scoring |
| --- | --- | --- | --- | --- |
| **Wave Defense** (formalized) | Hold Outpost Meridian against escalating Kestrel waves | Survive wave 10 (VICTORY), then endless continues | All operators down | kills, wave reached, streaks |
| **Team Deathmatch** | First team to 30 eliminations | Team reaches 30 | Kestrel squad reaches 30 | team kills; player death scores for Kestrel |
| **Domination** | Capture and hold zones A/B/C; first to 200 points | Reach 200 | Kestrel reaches 200 | +1 pt / 2 s per zone held |
| **Relay Assault** | Reach the Carrier relay on the tower and hold the channel to 100% before the timer dies | Channel complete | 6:00 timer expires (or team wipe) | channel %, kills, time bonus |

Solo framing is honest: TDM/Domination are operators-vs-Kestrel-
squad (humans + co-op humans vs the bot force), not fake PvP.
Bots respawn continuously in TDM/Domination; Domination zones sit
on the expanded map (A: north deck, B: rooftop, C: relay tower —
see §5). Relay Assault uses STORY canon: the tower relay IS the
Carrier uplink. Relay briefings per mode extend docs/STORY.md.
M-CUT RULE: if a mode cannot reach green this session it is cut
BY THE BOARD with an owner named here, never silently dropped.
No cuts were needed at ruling time.

## 2. Online launch — RULED (Uplink + Lockdown + Vault)

- **§10.1 is settled by proceeding**: hand-rolled RFC 6455
  WebSocket, ZERO new dependencies (Board 003 recommendation;
  owner informed it is the working assumption and may still
  overrule to `ws` — the transport seam stays clean so an
  overrule is a swap). Owners: Sofia "Uplink" Petrova (design),
  Priya "Lockdown" Nair (security review), Sam "Pipeline" Ortiz
  (server). Vault signs the zero-dependency ledger.
- Architecture per docs/MULTIPLAYER.md: authoritative server
  (`net/sim.js`), rooms by 4-char code or link, M3 scope: socket +
  rooms; M4 scope: 2–4 human co-op with bots filling. Player sync
  via 20 Hz snapshots + client interpolation; own-position =
  server position with smooth correction (no prediction in V4,
  per §6.3 of the design doc).
- The solo browser game stays on its local loop this version;
  **the M2 full loopback refactor remains DEFERRED** (owner:
  Uplink; reason: regression risk to Brett-approved movement feel
  outweighs the dedup win mid-launch). Solo and online share
  mode/loadout/gear DATA and mirrored rules — the same parity
  discipline weapons/bots already use.
- Client join flow lives in the menu (name, server address, room
  code, mode); connection status is always visible; any failure
  falls back to solo with a plain-language message.
- **Hosting is Brett's decision.** A costed brief ships as
  `docs/sessions/v4-hosting-brief.md`. Nobody signs up for
  anything; deployment is not part of this build.
- Smoke §1b lint: the `WebSocket(` ban gets a SCOPED exception
  for the single client transport module (`js/online.js`) only,
  recorded here as a deliberate, reviewed change — the rule's
  intent (no accidental network surface) is preserved by making
  the one allowed surface explicit and tested.

## 3. Loadouts — RULED (Ballistic + Trigger; Budget vetoes accounted)

- Data module `js/loadouts.js` (DOM-free, imported by client,
  sim and server validation): ATTACHMENTS, THROWABLES, class
  shape, `validateLoadout()`, `effectiveWeapon()` — the single
  stats table stays `js/weapons.js`; attachments are MULTIPLIER
  sidegrades with a stated tradeoff each. No straight power
  creep (Ballistic owns the numbers; every attachment lists its
  cost next to its benefit in the data).
- Slots: optic / underbarrel / magazine / barrel / stock, max
  one per slot, per-weapon allowlists.
- ADS is added as a real mechanic (right mouse): FOV zoom,
  spread tightening — because "scopes" without aiming are
  decoration. Optic tiers change ADS zoom.
- Attachments VISIBLE on gunmodels (named parts join the part
  lists; bot-held forms get the merged treatment). Draw-call
  discipline: attachments add parts to EXISTING merged meshes —
  bot guns stay 1 draw call; viewmodel stays ≤ 6 meshes.
- Frag: thrown arc, 1.6 s fuse, AoE radius 5.5 m, 110 centre
  damage with distance falloff — consistent with the barrel
  model (95 @ 6.5 m). Flash: 1.0 s fuse; players looking at it
  in-cone with line-of-sight get a decaying blind (client renders
  the flash; the SERVER decides who is blinded and for how long);
  bots get a 2.5 s blind window (no fire, perception reset).
  Counts: 1 lethal + 1 tactical per life; refilled on redeploy
  and wave clear. Throw inputs ride the existing input message
  as optional edge booleans (protocol stays at 8 message types).
- Loadout UI in the menu: class tabs 1–5, weapon, attachment
  pickers per slot, tactical/lethal shown per class, unlock
  states from progression (§4). Classes persist in the local
  profile; online, the loadout travels in `hello` and the server
  validates it against the same tables before the sim sees it.

## 4. Progression — RULED (Ledger + Herald; Lockdown for online XP)

- Module `js/progression.js` (DOM-free): XP table (kill 100,
  headshot bonus +25, objective tick/channel/capture events,
  wave clear 150, match win 300, streak milestones), level curve
  `xpForLevel(n) = 400 * n^1.6` rounded — level 2 lands inside
  the first match by design (owner: "feel the first unlocks
  fast").
- Unlock ladder (level → reward): L2 red-dot optic · L3 extended
  mag · L4 class slot 2 · L5 laser · L6 foregrip · L7 scope 4× ·
  L8 class slot 3 · L9 long barrel · L10 fast mag · L12 class
  slot 4 · L14 stock · L16 short barrel · L18 class slot 5.
  Everything NOT gated: all 5 weapons, frag, flash, class slot 1
  — a level-1 player is fully playable.
  **AMENDMENT (Odin drift report, Oct 24):** the shipped ladder
  in `js/progression.js` carries **15 unlocks**, adding HOLO
  SIGHT (L11) and SUPPRESSOR (L17) — the attachment set grew to
  11 to clear the §6 combinations line (729), and every gated
  attachment needs a rung. Levels run to 30 (L19–30 are prestige
  headroom past the last unlock). This 15-rung ladder is the
  shipped interim; **Havoc's design pack rules on the final
  ladder** and the module will be retuned to match it.
- Profile: one versioned local save (`ono-profile-v1`) carrying
  XP/level, classes, and Brett's existing settings (sensitivity
  migrates from its V3 key — read-once migration, no wipe). The
  post-match summary screen shows XP earned by source, level-ups
  and unlocks earned. Online: the server computes XP from sim
  events and reports it in the results event — the client
  displays, never asserts. Server-side XP is per-session
  (accounts are the future seam; noted, not built).

## 5. Bigger worlds — RULED (Vista + Terra + Mason; Hawkeye gate)

Footprints (playable bounds, square half-extent):

| Map | V3 | V4 target | How |
| --- | --- | --- | --- |
| Compound | ±47 m | **±62 m** | Inner course UNCHANGED (every V3 route/pin intact); old perimeter becomes an interior ruin line; new outer ring with POIs |
| Forest | props inside ±44 | props to **±58** + POIs | denser outer bands, fallen relay mast POI |
| Snow Station | scaffold | **FULL BUILD ±58** | drifts/rocks full treatment + buried-dome POI |
| Mars Uplink | design only | **FULL BUILD ±58** | regolith field, crater, uplink spire POI; low-g is a solo biome variant (sim/mode maps stay compound — stated honestly) |

Compound outer-ring POIs (named, sight-navigable): **Relay Tower**
(climbable, Domination C + DMR nest + Assault relay base area),
**Motor Pool** (wrecked vehicle props, cover), **North Ridge**
(vantage), **Depot Row** (crate maze, pickups), plus exploration
rewards: 2 off-lane pickup caches and 3 Relay **transmissions**
(story collectibles, solo). New bot spawns ring the outside.
worlddata mirrors the expansion EXACTLY in the same commits
(solids/extras/spawns counts re-pinned deliberately in smoke).
Reachability gate EXTENDED: tower stairs route + ring traversal
join the table; the V3 routes must not regress.
Perf: ring content is instanced/merged like the forest; per-biome
draw calls + triangles are reported in the V4 report (Budget).

## 6. The 3× bar — translated into checkable targets (Apex + Verity + Sixty)

**3× REALISTIC** — scored by Verity verdicts (report table):
V3 ended with 4 features at the realism bar (guns, characters,
lighting, world). V4 target: **≥ 8 features PASS** — the four
carried, plus modes presentation, soldiers-uniform discipline,
landscape/biome surfaces, audio distance/flash/frag believability,
loadout presentation, HUD consistency. Each is pass/fail with a
stated reason; no vibes.

**3× POWERFUL** — capability counts, V3 → V4 targets:
modes 1 → **4** · online players/session 0 → **4 humans + bots**
· loadout combinations 5 (weapons only) → **≥ 500** (5 weapons ×
attachment sets × 5 classes, computed from the shipped tables)
· progression depth 0 → **30 levels / 15 unlocks** (as amended,
§4) · maps 2 live biomes → **4** · playable footprint 94 m →
**124 m**.

**3× SMOOTH** — frame discipline (Sixty; honest measurement
rule: this environment cannot run Brett's GPU, so targets are
code-derived budgets + the exact F9 check he runs):
draw calls worst case **≤ 165** (V3 line 150; the ring/biomes
must pay for themselves via instancing — Budget veto armed) ·
triangles **≤ 300k** · sim tick **≤ 0.5 ms** — RESTATED per
Odin's measurement (Oct 24): the original "8 players + 12 bots"
phrasing exceeds the shipped caps (4 humans per §2 M4 scope;
9-bot alive cap), so the bar is scored at the real caps — Odin
measured **0.121 ms/tick hot-window at 4 clients + 9 bots
(wave ≥ 5): PASS with ~4× headroom** · quality scaler must hold
L0→L2 steps under load in the F9 check Brett runs · online
snapshot rate 20 Hz at ≤ 4 KB/message (protocol cap) — Odin's
stress snapshot measured 1,785 B of the 4,096 B cap: headroom
holds, flagged as a WATCH item as maps/rosters grow.

## 7. Carried watches from Board 003

- **Lighting (Phase 1 defect) — RESOLVED BY PLAYTEST (Oct 24,
  2026).** Brett, on the live Phase 2 build: *"lighting in v3
  looks way better than it did — keep it or make it better, but
  it looks good how it is."* The defect is closed by the owner's
  eyes, not just the ×1.83 math. **The current grade is the
  LOCKED V4 BASELINE**: hemisphere fill 0.95, sun 1.85, exposure
  1.10, bot emissive readability floor, fog floor unchanged. The
  V4 realism pass may improve on it but must not regress
  visibility or enemy readability; any lighting change in V4
  ships with before/after numbers against this baseline in the
  V4 report.
- **Rooftop DMR nest** — still pending Brett's playtest verdict.
  RULED: do not block; the nest gains a second user in V4
  (Domination B sits on the rooftop; ring tower becomes the
  counter-nest). Verdict remains Brett's; no geometry change
  this version beyond the ring.
- **North-corridor spawn** — RULED what's ruleable: with the
  ring, outside spawns relieve corridor pressure; the corridor
  spawn itself is UNCHANGED until Brett's playtest says move it.
- **Stair margin** — closed at Board 003; tower stairs reuse the
  same 0.575 rise so the closed ruling covers them.

## 8. Build order (priority, per owner + parent)

1. Modes core + online transport/server/client (M3/M4).
2. Loadouts (classes, attachments, frag/flash).
3. Progression (unlocks gate §3 content; post-match summary).
4. Soldier characters (uniform discipline + viewmodel arms).
5. Bigger worlds + landscape (ring, snow full, Mars full,
   dressing hook, transmissions).
6. All-features realism pass + final tuning of modes to map size.
7. Hosting brief + V4 report.

Ship the largest green subset in that order; deferrals get an
owner + reason in the V4 report. Smoke/reachability/biome-check/
soak stay green at every commit boundary. Version steps to
**0.4.0-dev** with the first V4 code commit (package.json, menu
tag and smoke pins move together).

Signed: Apex (chair), Vault, Verity, Uplink, Lockdown, Trigger,
Ballistic, Ledger, Vista, Sixty, Budget, Sentry.

## ADDENDUM — Team change (owner directive, Oct 24, 2026, post-ruling)

The owner has added TWO ACTUAL SPECIALIST AGENTS to the team.
They are real agents working in this repo under the same
discipline (local `v4():` commits, never push, gates green), not
studio seats. Registered and assigned as follows:

- **VEGA — Online Systems (agent).** Owns item §2 END-TO-END:
  everything under `net/` (hand-rolled RFC 6455 WebSocket
  transport, real sessions/rooms on the sim, two-client soak)
  PLUS `docs/sessions/v4-hosting-brief.md`. The V4 Coordinator no
  longer owns the §2 build; the Coordinator owns its INTEGRATION:
  the menu join flow, mode carriage over Vega's protocol (spec:
  `docs/sessions/v4-net-contract.md`), and consuming Vega's
  session API client-side. Nobody else edits `net/` except by
  exception routed through the parent agent.
- **ATLAS — Worlds & Soldiers (agent).** Owns item §5 and the
  soldier half of the realism mandate END-TO-END: `js/world.js`,
  `js/biomes.js`, `js/worlddata.js`, bot soldier-model visuals in
  `js/bots.js` — bigger maps, landscape realism, snow FULL build,
  Mars build, worlddata integrity, reachability extension. The
  Coordinator owns integration on top (mode wiring on Atlas's
  maps, viewmodel arms consistency) and flags spec needs through
  the parent instead of editing Atlas's files.
- **Coordinator retains**: game modes (§1 logic + solo
  implementation + net contract spec), loadouts (§3),
  progression (§4), the all-features realism pass for NON-world
  features (guns pass 2, audio, HUD), client online join flow,
  these minutes, and the V4 report — which must incorporate
  Vega's and Atlas's ledgers.
- **Shared truth**: smoke / reachability / biome-check gates.
  Whoever's change reddens a gate owns fixing or reverting it.
  Build on latest commits; small atomic commits; the version
  priority order is unchanged. If workstreams land at different
  times, integrate what's green and defer the rest with owners.

## ADDENDUM 2 — Two senior AIs added (owner directive, Oct 24, 2026)

- **ODIN — Chief Engineer AI (agent).** Cross-cutting authority:
  verification and the 3× bar. Owns the metrics harness (tools/),
  performance audits against Team Lumen budgets (with a REAL
  smoothness veto), independent gate re-runs at integration
  points, and commit patrol/review of ALL agents' work. Odin may
  land small corrective commits anywhere for genuine defects
  (labeled `v4(chief):`) but builds no features inside Vega's or
  Atlas's territories — feature needs get spec'd to the owner.
  The V4 report must incorporate Odin's metrics file.
- **HAVOC — Gameplay Director AI (agent).** Owns game feel:
  measured balance baseline via the sim (TTK, pacing), the MODE
  DESIGN PACK (goals / scoring / win conditions / match length
  per mode), the progression XP curve + unlock schedule, bot
  difficulty tiers, and grenade/flash tuning. The Coordinator
  owns mode/loadout/progression IMPLEMENTATION and builds to
  Havoc's design pack when it lands. **Until the pack lands, the
  numbers in §1/§3/§4 of these minutes are COORDINATOR
  ASSUMPTIONS**, flagged as such in code and commits so Havoc can
  retune without archaeology. Havoc's pack supersedes them on
  arrival.

Updated org: Coordinator (integration, systems, Board 004, V4
report) · Vega (net/) · Atlas (worlds/soldiers) · Odin
(verification/perf/3× metrics) · Havoc (balance/mode design/
progression numbers). All coordination flows through the parent
agent; territory rules and gate discipline unchanged.
