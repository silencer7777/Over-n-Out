# Over n' Out — Story Bible

Canon for V3 Fix 3. This document is the source of truth for the
premise. The runtime strings live in `js/story.js` and must stay in
sync with this document — if a line changes here, change it there.

## The premise in one breath

The last relay operator of a decommissioned comms compound holds its
broadcast tower against waves of the compound's own mothballed
auto-security units, reactivated by a rogue carrier signal that locks
on stronger with every wave. If the relay falls, the signal gets a
tower. The operator never signs off — so the fight never ends.

## Who the player is

**Corporal Rhea Calder — callsign "Relay."**

- Sole remaining operator at Outpost Meridian. Everyone else rotated
  out when the compound was decommissioned; Calder stayed on a
  caretaker posting: keep the mast powered, log the bands, file a
  weekly check-in.
- A comms specialist, not infantry. Calder knows the compound's
  frequencies, fences, floors, and blind spots better than anyone —
  that home-ground knowledge is why one operator can hold it at all.
- The callsign is literal: Calder *is* the relay. Every transmission
  in and out of Meridian goes through one headset, one mic, one pair
  of hands.
- Character in voice, not cutscenes: terse, dry, unhurried on the
  radio even when the yard is not. Calder does not panic on an open
  channel.

## The compound — Outpost Meridian

- A decommissioned military comms compound: relay tower, ops building,
  yard, and storage, built around one asset that still matters — a
  full-power broadcast tower with regional reach.
- Mothballed, not demolished. Power still runs, doors still seal, and
  the Kestrel Dynamics auto-security units were shut down in place
  rather than removed. Decommissioning paperwork moved faster than
  the salvage crews ever did.
- The tower is the prize. Dark, it is scrap. Lit by the wrong hands,
  it is a voice that can reach every receiver in the region at once.

## The enemy — the Carrier and the Kestrels

- **The Carrier** is a rogue carrier signal of unknown origin. It has
  no face, no voice, and no demands — it is a tone looking for a
  tower. It cannot speak on its own; it needs Meridian's broadcast
  hardware to become more than interference.
- **Kestrel Dynamics auto-security units** are the compound's own
  mothballed guard machines. The Carrier does not build them or send
  them — it *wakes* them, overriding their shutdown with its own
  carrier wave and pointing them at the operator defending their own
  post.
- Every unit the player destroys was once Meridian's own security.
  That is deliberate: the compound is being turned against its last
  keeper by a signal that wants her tower.

## Why the waves escalate

Escalation is signal lock, not reinforcements arriving:

1. **Wave 1 — first lock.** The Carrier brushes the compound's
   systems and wakes the nearest units in their factory patrol
   configuration — standard rifles, no coordination.
2. **Wave 2 — stronger lock.** The signal resolves more of the
   compound network and wakes more units.
3. **Wave 3 — full lock.** The Carrier has the compound's measure.
   Heavier unit classes come online.
4. **Waves 4–5 — directed lock.** The signal starts *choosing*:
   better-armed units, pressed attacks, no wasted motion.
5. **Wave 6+ — peak lock.** Full-spectrum control. Elite units,
   maximum density. The Carrier is no longer probing the compound —
   it is trying to finish the operator so it can take the tower
   unopposed.

Each wave cleared is the operator knocking the lock back — jamming,
killing the woken units, forcing the Carrier to re-acquire. It always
re-acquires. That is the loop, in-fiction.

## What "Over n' Out" means in-fiction

"Over" means: my transmission ends, yours may begin. "Out" means:
this conversation is over, the channel closes. Said together —
"over and out" — it is the final sign-off.

**Calder never sends it.**

The channel stays open because closing it is surrender: the moment
Meridian goes silent, the Carrier takes the tower unopposed and
broadcasts on a dead operator's frequency. So every exchange ends
with "over" and never "out." The title is the sign-off the operator
never gets to send — the fight continues precisely because the
conversation does.

- **Death = signal lost.** The headset goes silent, the lock completes,
  the tower changes hands. The game-over screen is a lost channel,
  not a corpse-cam.
- **Wave clear = channel clear, for now.** A held compound and an
  open mic — plus the certainty the Carrier is already re-acquiring.

## Tone notes

- **Radio brevity first.** Short lines, no speeches. If a string
  cannot be said in one breath on a bad channel, it is too long.
- **Dry, not grimdark.** Calder is tired and outnumbered, not
  tortured. Understatement carries the dread; the Carrier never
  taunts, because a tone cannot gloat.
- **The horror is administrative.** Decommissioned post, mothballed
  units, a signal that is basically interference with intent. Keep
  the language procedural — locks, channels, carriers, towers.
- **No exposition dumps.** The menu panel gets three short paragraphs
  (see `STORY.premise` in `js/story.js`); everything else is learned
  one briefing line at a time.
- **Never break the rule:** no character ever says the full sign-off
  as a victory line. "Over n' out" is what *not* happening keeps the
  game going.

## V3 arc hook — the road to the source

The Carrier has a source, and V3 goes looking for it. The coming
biomes are not new arenas; they are the road to the signal:

| Leg | Theater | Story beat |
| --- | --- | --- |
| 1 | Forest relay | A repeater station in dense forest is re-broadcasting the Carrier deeper into the region. Calder pushes out from Meridian for the first time to cut the relay — and finds the signal is being *helped* along the chain. |
| 2 | Snow station | A high-altitude listening station in the snow went dark on the same frequency. Its logs hold the Carrier's first recorded lock — the origin coordinates are in a frozen ops room at the top of the line. |
| 3 | Mars uplink | The trail ends at a planetary uplink: the oldest tower in the network, built to talk off-world. Whatever sent the Carrier came through that dish — or is still on the other end of it, listening for a reply. |

The arc question V3 asks, in order: *What is carrying the Carrier —
and what happens if Calder finally answers it?*

## Story beats by game screen

All runtime strings below are implemented in `js/story.js`.

| Screen | Beat | Source in `js/story.js` |
| --- | --- | --- |
| Menu | The premise panel: who Calder is, what Meridian is, what the Carrier wants, and why the channel never closes. Sets the stakes before the first deploy. | `STORY` — `operator`, `compound`, `enemy`, `premise[]` |
| Briefing (wave start) | One radio line per wave, escalating by band (1 / 2 / 3 / 4–5 / 6+) from first lock to peak lock. Paired with the objective line naming the hold order and wave number. | `briefingForWave(wave)`, `objectiveForWave(wave)` |
| Wave clear | A held breath, not a victory: channel clear, tower still dark, compound still Calder's — for now. Implies the breather heal and the next re-acquisition. | `clearLine(wave)` |
| Death | Signal lost. The channel flatlines, Meridian goes dark, and the Carrier takes the tower. Shown on the death / redeploy screen alongside the run stats. | `deathLine(seed)` |

## V4 — the modes in fiction

The four V4 game modes are four ways the fight for Meridian is
fought. Same operator, same tower, same enemy — different orders.

- **Wave Defense** is the premise itself: hold the compound against
  escalating lock (above).
- **Team Deathmatch** is a contested yard: a standing Kestrel squad
  patrols Meridian in force, and Calder's side — operators who
  answered her open channel — fights to break the squad before it
  breaks them. Eliminations are the score because the squad's
  cohesion is the Carrier's local foothold.
- **Domination** is a frequency war. The compound's three relay
  points — north deck, rooftop, and the relay tower — each hold a slice of the
  broadcast band. Whoever holds them starves the other side's
  signal: hold the frequencies and the Carrier cannot coordinate
  a lock; lose them and it can.
- **Relay Assault** is the direct play: the rooftop relay is the
  door the Carrier keeps knocking on. Calder gets to the roof,
  opens a channel into the relay and scrambles its lock pattern —
  while everything the Carrier has left defends the one piece of
  hardware it cannot afford to lose. The timer is the window
  before the Carrier rotates its pattern out of reach.

## V4 — transmissions

Hidden off Meridian's main lanes are dead drops and logged
fragments from the operators who held this post before Calder —
the transmissions. They are rewards for wandering: small pieces
of the compound's memory, in the same radio voice, that make the
place older than the current fight. Runtime strings:
`transmissionLine(index)` in `js/story.js`; placement on the maps
is Atlas's (Worlds & Soldiers).
