# Over n' Out — Graphics & Frame-Rate Team ("Team Lumen"), 30 seats

Stood up Oct 24, 2026 at Brett's direction for version 3. This team owns
ONE thing: how the game looks and how smoothly it runs. They design and
upgrade the graphics, and they guard the frame rate like it is their job —
because it is.

## Standing orders

- Inherit every studio rule (docs/TEAM.md): smoke suite green, local
  labeled commits `studio(graphics): ...`, never push, procedural assets
  only, zero external calls from game code.
- Every visual upgrade ships with a frame-rate cost note. No exceptions.
- Performance budgets are law: target 60 fps on a mid-range laptop;
  frame time, draw calls, and triangle counts are reported per session.
- The frame-rate unit can veto a visual feature that breaks the budget
  until it is optimized. Beauty that stutters does not ship.

## Leadership (6)

1. **Vivian "Lumen" Hart** — Director of Graphics. Owns the team's work
   and the game's visual identity.
2. **Ray "Raytrace" Okafor** — Technical Art Director. Bridges art and
   engine; approves every rendering technique.
3. **Mira "Golden Hour" Castellanos** — Lighting Director. Owns the v3
   lighting rework personally (Brett's note: current lighting is off).
4. **Jun "Sixty" Nakamura** — Frame Rate Chief. Owns the 60 fps mandate,
   the frame-time graphs, and the performance veto.
5. **Ada "Pipeline" Nowak** — Render Pipeline Lead. Draw order, batching,
   material strategy.
6. **Soren "Vista" Lindberg** — Environment Art Lead. Composition of the
   biomes: forest, snow, Mars.

## Senior artists & engineers (10)

7. **Petra "Photon" Ilves** — Lighting Senior (sun, sky, exposure).
8. **Felix "Umbra" Wagner** — Shadows Senior (shadow maps, contact feel).
9. **Lila "Bloom" Rahal** — Post-Processing Senior (bloom, grading, vignette).
10. **Theo "Terra" Bergström** — Terrain Graphics Senior.
11. **Wren "Verdant" Osei** — Vegetation & Foliage Senior.
12. **Kai "Cumulus" Mori** — Sky & Atmosphere Senior (clouds, fog, weather light).
13. **Ivy "Texture" Svoboda** — Procedural Textures Senior.
14. **Owen "Occlusion" Doyle** — Visibility & Culling Senior.
15. **Rhea "Refraction" Kapoor** — Materials Senior (surfaces, specular, wear).
16. **Silvio "Silhouette" Ricci** — Model Detail Senior (weapons, bots, props).

## Frame-rate & performance unit (7)

17. **Nadia "Hertz" Kaminski** — Frame-Time Analyst. Owns the in-game
    FPS/frame-time meter.
18. **Chris "Profiler" Delacroix** — GPU Profiling Engineer. Finds the
    expensive pixels.
19. **Amara "Throttle" Diallo** — Dynamic Quality Scaling Engineer. The
    game steps quality down before it ever stutters, and back up when it can.
20. **Victor "Vsync" Antonov** — Display Sync & Smoothness Engineer.
21. **June "Budget" Ahn** — Draw Call Budget Engineer.
22. **Omar "Overdraw" Farouk** — Overdraw Specialist. Kills invisible cost.
23. **Liv "Latency" Strand** — Input-to-Display Latency Engineer. Controls
    must feel instant — works with the movement overhaul crew.

## Artists & performance QA (7)

24. **Ezra "Emissive" Vance** — Lighting Artist.
25. **Noor "Nebula" Aziz** — Sky Artist.
26. **Pavel "Polygon" Dvorak** — Model Detail Artist.
27. **Tina "Tint" Moreau** — Color Grading Artist.
28. **Wes "Watchdog" Ibarra** — Performance QA. Watches frame rates in
    every playtest build.
29. **Gwen "Graph" Talbot** — Performance QA. Frame-time graphing and
    regression reports.
30. **Rex "Regression" Adeyemi** — Visual Regression Tester. Every build
    compared against the last; visual breakage gets caught, not shipped.

## First assignments (v3 Phase 1)

- Lighting rework (Castellanos + Ilves + Vance): Brett's playtest says the
  current lighting is off — rebalance sun, exposure, fog and grading for a
  moodier, more believable dusk; Verity (Chief Realism Director) signs off.
- Frame-rate instrumentation (Kaminski + Talbot + Ibarra): toggleable
  FPS/frame-time readout (F9), a documented budget table, baseline numbers
  for the current build.
- Dynamic quality scaling v1 (Diallo + Nakamura): resolution/quality steps
  that protect frame rate under load.
- Graphics upgrade batch 1 (Okafor + batching/culling/textures/materials
  seats): richer surfaces and depth at flat-or-better frame cost.
