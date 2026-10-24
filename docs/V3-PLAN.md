# Over n' Out — V3 Plan (QUEUED — do not start until v2 ships and Brett approves)

Status: PLANNED ONLY. Brett's order on Oct 23, 2026: finish version 2
first. This team does no work until v2 is shipped and Brett says go.

## Mission

Version 3 = online multiplayer + three new landscape theaters, built on
v2's weapons system, multi-floor course design, and landscaping work.

## The V3 Strike Team — "Division Zero" (20 seats, all senior-tier or above)

This team is deliberately more powerful than the studio roster: every seat
is a specialist at lead/senior level. Before kickoff, every member must
read the studio team's full record — docs/TEAM.md, docs/ROADMAP.md, the
session reports and board-meeting minutes under docs/sessions/, and
docs/MULTIPLAYER.md — and inherit its standing rules (smoke suite green,
local labeled commits, never push without Brett's approval, procedural
assets only, zero unsecured calls). They learn from the first team, then
they out-build them.

1. **Aurelia "Overlord" Kane** — V3 Program Director. Owns the whole v3
   mission and the go/no-go calls.
2. **Dmitri "Mainframe" Volkov** — Chief Network Architect. Authoritative
   server design and implementation.
3. **Lena "Sync" Fischer** — State Sync & Replication Senior. What the
   server sends each client, how often, and how it stays cheat-proof.
4. **Ezra "Backbone" Whitfield** — Server Infrastructure Senior. Hosting,
   scaling, uptime.
5. **Ravi "Firewall Prime" Menon** — Anti-Cheat & Security Architect.
   Server-validated everything; client data is never trusted.
6. **Dario "Gatekeeper" Fontaine** — Matchmaking & Lobby Senior. Rooms,
   parties, joining friends.
7. **Tessa "Loadout" Marchetti** — Multiplayer Gameplay Senior. Modes,
   teams, spawning fairness with real players.
8. **Selene "Oracle" Voss** — QA & Simulation Lead. Load tests using bot
   players before real players ever connect.

### Landscape division — the three new theaters

9. **Silas "Timberline" Reed** — Dense Forest Biome Lead. Thick tree
   cover, underbrush, low sightlines, ambush country.
10. **Freya "Canopy" Lindholm** — Forest Vegetation Senior. Canopy layers,
    ground cover, root systems at forest scale.
11. **Hana "Blizzard" Kimura** — Snow Biome Lead. Multi-level snowy
    terrain: ridges, drifts, ice fields.
12. **Ingrid "Permafrost" Solberg** — Snow Systems Senior. Snowfall,
    footprints, breath-cold atmosphere, slippery surfaces.
13. **Yara "Dune" Haddad** — Planetary Biome Lead. The Mars theater:
    rust-red regolith, rock formations, alien sky.
14. **Mateo "Crater" Alvarez** — Planetary Terrain Senior. Craters,
    canyons, dust flats.
15. **Orion "Low-G" Blake** — Planetary Physics. Low-gravity movement and
    ballistics feel that still plays fair.
16. **Vera "Terraform" Ivanova** — Terrain Generation Senior. Procedural
    terrain for all three theaters from one system.
17. **Nadia "Whiteout" Rahman** — Weather Systems Senior. Blizzards, dust
    storms, dynamic conditions.
18. **Aiko "Shimmer" Tanaka** — Lighting & Atmosphere Senior. Alien suns,
    whiteout glare, forest gloom.
19. **Omar "Pathfinder" Sayeed** — Navigation Systems Senior. Bot and
    player movement across multi-level terrain in every biome.
20. **Jonas "Overclock" Weber** — Performance & Streaming Senior. Keeps
    dense worlds inside the frame budget; streams terrain in and out.

## Scope locked by Brett (Oct 23, 2026)

- Online multiplayer with other players (the v3 headline).
- Dense forest landscape.
- Multi-level snowy landscape.
- Planetary landscape (Mars-like).
- Everything v2 established carries forward: weapons system + selection,
  multi-floor design, landscaping language, guardian coverage.

## Kickoff gate

1. v2 shipped and verified.
2. Brett explicitly says start v3.
3. Division Zero reads the first team's record (above), files a kickoff
   plan, and only then writes code.

## Full mobilization (Brett's order, Oct 23, 2026)

When v3 starts, BOTH teams come together on it — nobody sits out:

- The 33-seat studio team (docs/TEAM.md) brings everything it learned
  building v1 and v2: the weapons system, the multi-floor engine work,
  the landscaping language, the guardian discipline.
- Division Zero's 20 seats bring the v3 specialties: netcode, biomes,
  weather, terrain, anti-cheat.
- **Total mobilized: 53 seats**, one mission, one vital task at a time,
  run through board meetings chaired by Apex and Overlord together.
- Division Zero leads on v3-new systems (multiplayer, the three
  theaters); the studio leads own the systems they built. File ownership
  rules still apply — one owner per file, no collisions.
