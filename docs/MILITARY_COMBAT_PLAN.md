# Military & Combat — the master plan

**Owner spec, 2026-08-02.** The single source for the military side: the
Service tab structure, the three-option combat scene system, the scene
catalogue, and the schools and units behind them. Supersedes the earlier
combat-master and service-schools notes.

Recorded here verbatim in substance so it outlives a chat window. Where a
ruling was needed the ruling is marked **[DECIDED]** with its reason.

---

## Build order (the owner's, followed as given)

1. **Service sub-tabs** (presentation) + School Houses branch filter and class schedule.
2. **Drop a Packet** tab (reuses the selection engine).
3. **The three-option upgrade** on the existing `combat-moment`, then the Tier 1 regular scenes.
4. **Shared unit cutscenes** (packet drop, selection day, reporting in) — makes joining a unit feel like something.
5. **Per-unit mission scenes**, one unit at a time, starting with whichever unit a player reaches first.

**All five are built as of 2026-08-02.** Step 4 landed with its own pending
kind, `'unit-moment'`, deliberately NOT routed through the combat casualty
resolver: a ramp ceremony is not enemy contact, and reusing that resolver
would have put a rifle round in a moment where nobody is shooting. Selection
stopped being a silent coin flip in the same change — it is played now, and
the answer moves the odds off the same stream and the same margin.

Since then, and beyond the plan: the awards pack in full (ADR-0024), the
capture system and the Prisoner of War Medal (ADR-0025), aviation and the
Air Medal (ADR-0026), the ribbon rack and a drawn mark for every badge.

---

## 1. Service tab structure

Split the long Service tab into sub-tabs so nothing scrolls forever:

| Sub-tab | Holds |
|---|---|
| **Career** | Rank, trade, pay, board status, time in grade, current unit |
| **School Houses** | Branch-eligible schools + the class schedule |
| **Drop a Packet** | Special units you can try out for |
| **Deployments** | Current war and tour, history, the combat-scene log |
| **Record** | Decorations, badges, the shadow box |

**School Houses.** Only schools this branch can attend; locked ones show the
engine's own reason ("Opens at Sergeant"). Classes run on cycles —
`courseMonths`, `classCadenceMonths`, `seatsPerClass` — so a player can see
WHEN they can go. Request a Seat → slotted into the next class with a free
seat → countdown → attend → graduation grants the badge. Class dates come
off a fixed epoch grid, so they are deterministic.

**Drop a Packet.** Its own tab, branch-filtered. Drop a packet → selection
course (seeded pass/fail against the unit's `selectionDenominator`) → pass
and you are in; fail is a `dropped-selection` and the file allows two
packets. Every branch gets a tier-1 entry unit so the tab is never empty.

---

## 2. The combat scene system — three options, severity-driven

Every scene is a `combat-moment` pending. On an answer: record the event,
write a causal decision whose first factor is `own-choice`, then run
`resolveMomentCasualty(gate, severityFloor)`. **Every option keeps the fatal
tail.**

The upgrade is that there are three options and the outcome depends on how
bad the moment is:

1. Roll a hidden **threat level** (seeded): light, heavy, or overrun.
2. **The scene text tells the player which** — a read, not a coin flip, so
   the choice is fair and the record can explain it (Law 3).
3. The player picks along the spectrum: **push → hold → cover**.
4. The outcome is the option shifted by the threat.

| Option | Meaning | Reward | Exposure |
|---|---|---|---|
| **Push** | Go forward, act | Valor possible | Highest |
| **Hold** | Stand ground, return fire | Steady, no glory | Middle |
| **Cover** | Protect yourself | Survives best | Lowest, never zero |

Outcome matrix — `(gate, severityFloor)` and the valor chance:

| Choice ↓ / Threat → | Light | Heavy | Overrun |
|---|---|---|---|
| **Push** | (300, 400), valor 1/6 | (500, 520), valor 1/3 | (750, 650), valor 1/2 |
| **Hold** | (220, 350) | (380, 450) | (560, 560), valor 1/8 |
| **Cover** | (120, 300) | (250, 380) | (420, 500) |

The diagonal is the smart play: push the light, cover the overrun, hold when
unsure. Special-unit scenes bias the threat roll toward heavy and overrun —
the unit takes the sharpest jobs, so danger and valor both run high.

---

## 3. The scene catalogue

**Tier 1 — pure combat.** Convoy ambush · base attack · point man at the
breach · pinned by a marksman.

**Tier 2 — brotherhood and rescue** (needs a friendly `otherId`). Man down
in the open · bring them home.

**Tier 3 — leadership** (rank-gated). Danger close · hold or fall back ·
send them or go yourself.

**Tier 4 — conscience** (sober, non-graphic, reputation on the record). A
surrender mid-fight · civilians in the line of fire.

**Tier 5 — aftermath and the mind** (ties health.ts). The shaken private ·
the first one · your slot on the leave bird.

Per-unit mission scenes are catalogued in the owner's doc for the
Pathfinders, the Trident Detachment, the Guardian Flight, the Nighthawk
Squadron and the Grey Section.

---

## 4. Schools and units

**Schools — REAL NAMES, by owner override.** Airborne, Air Assault, Ranger,
Sniper, Pathfinder, Military Freefall, SERE, Combat Diver, EOD, the Special
Forces Qualification Course, Combat Medic, Jumpmaster, Mountain Warfare,
Officer Candidate School.

> **OWNER OVERRIDE (amends MILITARY_AND_WAR_FOUNDATION §3):** real names for
> the SCHOOLS. The fictional-name rule is relaxed for school names by owner
> direction and this override takes precedence. The authentic structure —
> badge gates, failable selection, tiers, duty pay — is unchanged.

**Units — FICTIONAL, unchanged.** [DECIDED] The owner's own note: "real
school names are low-risk and common in games. Real unit names are the thing
§3 chose to keep fictional... Default here is real schools + fictional
units; add unit names to the override line if you want them real." He did
not add them, so units keep their invented names: the Pathfinder Battalion,
the Vanguard Group, the Trident Detachment, Task Unit Ember, the Guardian
Flight, the Nighthawk Squadron, the Grey Section. This also keeps ADR-0021
and ADR-0022 intact, which have named units fictional in every preset.

---

## 5. Implementation notes (the owner's, with the engine's names)

- **Pending fields:** `combat-moment` gains `sceneId`, `threat`
  (`'light' | 'heavy' | 'overrun'`) and `unitId`. Options stay
  `['push', 'hold', 'cover']`, relabelled per scene in the UI.
- **resolvePending:** look up `(choice, threat)` → `(gate, severityFloor,
  valorChance)`, record the event, add `factor('threat-level', …)` so the
  record explains how bad it was, call `resolveMomentCasualty`, roll valor
  on the push line. Field aid still chains after a wound — and it must chain
  AFTER `commit()`, which is this project's most expensive recurring bug.
- **Unit scenes** raise only while the person serves in that unit.
- **School Houses:** filter `schoolOptionsFor()` to branch-eligible; add
  `courseMonths`, `classCadenceMonths`, `seatsPerClass`, an enrolment state
  and an epoch-grid class-start tick.
- **Drop a Packet** runs off `unitOptionsFor()`, branch-filtered, keeping the
  two-packet cap and `dropped-selection`.
- **Determinism:** threat rolls, the class grid and selection rolls all come
  from seeded streams, so replays are exact.
- **Invariants:** every cell keeps the fatal tail; valor stays rare; unit
  structure is unchanged; sensitive scenes (hostage, civilians) stay sober
  and non-graphic (Law 10).
