# Resume Here

**Paste this into a new Claude Code session started in `Documents\LifeEngine`:**

```
Read RESUME.md and continue from "Next up". Do not re-read the other docs
unless the task needs them. Write all code yourself; only ask me to do things
that need physical access to my computer, explained in one or two sentences.
```

That is all you need to type. Everything below is for Claude, not for you.

---

## Standing instructions for Claude

- Ethan is a non-programmer and does not want to learn software engineering.
  Write all the code. Ask him only for actions requiring physical access to
  his machine (installing software, signing in, clicking a browser button),
  explained in one or two sentences.
- **Token budget is tight.** Do not re-read `CLAUDE.md`, the ADRs, or the
  design docs unless the current task actually requires them. This file plus
  the code is usually enough. Do not re-verify settled decisions.
- `CLAUDE.md` is the constitution and `docs/DECISION_LOG.md` outranks
  `LIFE_ENGINE_BOOTSTRAP.md`. All 15 ADRs are Accepted; nothing is pending.

## Environment notes that will otherwise waste your time

- **Node is at `C:\Program Files\nodejs` but may be missing from the shell
  PATH.** Prefix commands: `$env:Path = "C:\Program Files\nodejs;$env:Path";`
- Git identity is set **repo-locally only**, not globally.
- The dev server must be started from `apps/web`, not the repo root, or Vite
  serves the wrong folder and the page renders blank.
- If port 5173 is stuck after a killed task:
  `Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

## Commands

```bash
npm run check
```
Typecheck all workspaces, then run every test. **Run this before any commit.**

```bash
npm test
```
Tests only.

```bash
npm run dev
```
Dev server at http://localhost:5173

---

## Where the project is

**GitHub:** https://github.com/ethanbradshaw80/LifeEngine (PRIVATE).
Remote `origin` is configured and `gh` is authenticated as ethanbradshaw80.
Push normally with `git push`.

**Milestone 0 — COMPLETE** (`0620632`)
Monorepo: `packages/shared` (branded primitives, integer money),
`packages/engine` (pure simulation), `apps/web` (React + Vite). Strict
TypeScript. Engine purity enforced twice: `tsconfig.json` declares no
`"types"` so Node/DOM APIs will not compile, and `test/purity.test.ts` scans
for every banned construct in `docs/DETERMINISM.md` §5.

**Milestone 4 — COMPLETE**
Saves and responsiveness. Resolves ADR-0004.

`packages/persistence` — NEW, and pure (no I/O, no "types" in its tsconfig).
Save schema v2: `{header, world}` with checksum, savedAtTick, seed, tick,
simulationVersion and **userId** (`"local"` until M6). Runtime validation with
no casts (R-23). BigInt encode/decode ready for Layer 4. Migration v1 to v2
tested against a REAL committed v1 save at
`packages/persistence/test/fixtures/save-v1-seed777.json` — do not regenerate
it, a test asserts it is still schema v1.

`apps/web/src/storage.ts` — IndexedDB. **The only I/O in the project.**
`apps/web/src/engine.worker.ts` — the engine on a background thread. The worker
OWNS the world; the main thread holds a structured-clone snapshot for rendering
and never mutates it.

Verified in a real browser: 50 years simulated in 469 ms while the main thread
blocked for only **3.3 ms**; save, reload, continue restores exactly; a
deliberately corrupted save is refused with an honest message and the previous
save is left untouched.

**M-SPEND (money tuning) — COMPLETE**
discretionaryFor() in finances.ts: households spend 83.7-92% of the surplus
above rent+living (spendPerMille = 920 - avgAdultDiligence/12 — thrift is
character, deterministic, no draw); NOTHING discretionary while in arrears
(belt-tightening is what makes digging out possible). monthlyNetOf() mirrors
the ledger exactly; GameScreen money chip uses it so the UI never flatters
the household. Retirement stakes now include runway: "At today's costs that
carries the household about N years." Balances after: year-7 top $48.8k
(was $414k), median $11.6k; year-60 top $373k, median $35k, 3/36 behind.
SIMULATION_VERSION 5, golden 6a4dc287. Old saves load with the
version-change notice (verified live). Solvency test ceiling now $1m.

**M-GAME (game presentation) — COMPLETE** (web only; engine + golden untouched)
Direction set by Ethan: BitLife-style story-first game, presentation before
depth. When playing and alive, GameScreen.tsx IS the app: header (deterministic
SVG portrait from Avatar.tsx — hash of person id picks palette, sex/age band
shape hair/size, dead = greyscale), 4-chip stat strip (work/money/home/family,
red when negative or in arrears), scrolling story feed (timelineFor rendered as
event cards with emoji icons + sticky year chips + Why? expanders,
auto-scrolls), big "Age a year" action bar. Decision prompts show the other
person's portrait. Spouse chip opens PersonDetail in an overlay ("inspecting"
UI state). Town dashboard remains as observer view via ⏸ Town / Stop playing.

**KNOWN ISSUE surfaced by the new screen (next tuning pass): household savings
accumulate absurdly** — only rent+living are spent, so a working couple banks
~80% of income; a child's family showed $414k in 1977. Fix direction:
discretionary/lifestyle spending scaling with income (people spend most of
what they earn), likely SIMULATION_VERSION 5 + golden change + rebalanced
arrears/solvency tests. Do NOT silently hotfix; it interacts with marriage
strain and the cheaper-rent mechanic.

**M-POLISH (onboarding & polish) — COMPLETE** (web app only; engine untouched,
golden hash unchanged)
Welcome.tsx first-run explainer (three ideas: everyone lives their own life /
you can live one, the world pauses for your decisions / everything keeps a
reason). Seen-flag in localStorage 'life-sim:welcomed' (UI preference, NOT
sim state); "?" button in topbar reopens it. **Autosave**: every worker world
response triggers a debounced (600ms) writeSave in useWorld — the manual Save
button is gone, replaced by a Saved ✓ / Saving… indicator; reload resumes
where you were (verified live: advanced a year, reloaded, world came back at
Jan 1971). "New world" is two-step now ("Replace this world and its
history?" / Yes, start over / Keep it) — an autosaved world is too valuable
to lose to one mis-click. Better empty-state copy; small-screen CSS pass
(stacked controls, full-width sheets). Save slots considered and SKIPPED
(storage work, low value while one world per browser is the model).

**M-LEGACY (generational play) — COMPLETE**
`packages/engine/src/legacy.ts` — all READ-side queries over existing records
(kinship from parentIds, money from 'inherited' events): familyTreeOf (2 up,
2 down + siblings), legacySummaryOf (inherited / leftToHeirs sums that agree
with events to the cent — tested), descendantGenerations, familyHomeSince
(20+ years standing AND a generation raised there), lineageOf /
playsDescendantLine. PlayerState.lineage records SUCCESSIONS only: setPlayer
(id, asHeir=true) appends the dead predecessor; switching to an unrelated
person records nothing (abandonment ≠ succession — tested). Schema v6
(migration adds empty lineage: unrecorded history stays unrecorded).
SIMULATION_VERSION still 4 (shape-only change); golden a96231d9.

UI: PersonDetail family block (Grandparents/Parents/Siblings/Children/
Grandchildren, † for the dead, all clickable), "the family home since YYYY"
on the Home row, Retrospective legacy chips (children/grandchildren/
inherited/left) + "The Nth life of this line". Verified live: Ronald Gaines
died (3 children, 5 grandchildren chips), continued as Rebecca Gaines, her
panel showed parents † and "Cedar Flats · the family home since 1991".

Flaky-test lesson recorded in legacy.test.ts: first lineage test started
with a founding CHILD — she lived 75 years, never got one courtship moment,
died heirless. Believable life, flaky test. Start lineage tests from a
founding PARENT whose children exist at tick 0.

**M-MONEY (household finances) — COMPLETE**
`packages/engine/src/finances.ts` — one pot per roof, integer cents, single
writer of `household.savings`. Monthly: wages in, rent (`rentFor(desirability)`,
$242-$682) + living costs ($210/adult, $120/child) out. Negative = arrears, a
modelled state: fell-behind / back-in-the-black events at the crossings;
sustained arrears (4 months of shortfall deep) pushes a cheaper-rent move —
asked if the player lives there (reuses 'move-house' kind, prompt words it
"Money is short"), automatic otherwise. Arrears strains marriages (replaces
part of the joblessness proxy; 'financial-strain' factor now has a ledger
behind it). Move-out and move-up are affordability-gated (canAfford = rent +
one adult's living margin). Divorce splits the pot AND debts evenly. Death
that empties a household passes the estate to living children, split exactly,
eldest takes the remainder cent, debts never inherited (distributeEstate,
called from mortality). Founding households start unequal (1-9 months of
income, Law 10). Move-out grants one month of the mover's wages, NOT a share
of the family pot (would drain founders in a generation).

Stakes now carry money: job offers show pay vs current + household shortfall/
arrears; move-out shows rent vs wage; move-house shows rent delta; retirement
shows what's put by; child shows arrears warning. UI Money row: savings · in ·
out · rent. Schema v5 (migration computes 4 months of own wages from the
save's employment records). SIMULATION_VERSION 4, golden 58c84c3c. Full-arc
seed for the M5 exit test moved to 44/900 ticks (money stabilized dual-earner
marriages; 3 of 20 seeds have an arc — believable, not broken). Town solvency
test: <50% of households behind at year 60, richest < $5m.

**M-DEPTH (playable-life depth) — COMPLETE**
Four new decision kinds, same interception pattern (roll creates the moment;
player answers it): **child** (couple decides; deliverChild() keys all RNG on
(mother,tick)+childId so accept produces the IDENTICAL child the auto path
would have — tested by twin-world comparison), **move-house** (destination
shown), **retirement** (asked yearly on birthday from 66; keep-working forever
is allowed; NPC auto-retires), **separation** (stay = reconcile(): +160
strength and an own-choice record — a played marriage can be fought for, NPCs'
cannot; that asymmetry is the point). describeStakes() returns fact lines the
UI shows before answering (pay compared vs current, children affected, years
together). SIMULATION_VERSION 3 (births moved to fresh 8888 stream); golden
e34b0a16. Two bugs fixed: isBirthdayMonth never matched for founders
(negative birthTick, sign-preserving %— first use of an M1 helper caught it);
"a office clerk" grammar via withArticle. depth.test.ts builds scenarios by
hand (weakened marriage, hand-given job) instead of simulating decades.

**M-PLAY (playable character) — COMPLETE** (ADR-0016 deferred accounts/M6)
It is a GAME now. `packages/engine/src/player.ts` + interceptions in
systems.ts/relationships.ts: the player is one person in the world, not a
special entity. At each choice point the simulation already models (education
at 18, job offers, moving out, courtship, marriage), if the person is the
player the system raises a PendingDecision and the clock HALTS (Law 5) instead
of rolling. resolvePending() applies the answer through the SAME code the
auto path uses (hirePerson/enrolPlayer/performMoveOut/promoteToCourting/
promoteToSpouse — extracted shared helpers), records an 'own-choice' factor,
and appends to world.player.log. Same seed + same answers = byte-identical
world (tested). Playing nobody = pure simulation, byte-identical to golden.
Death halts the run; UI shows lifeStory retrospective + heirsOf() to continue
as a child. Schema v4 (world.player), migrationsApplied for v1 saves is now 3.
Golden hash e6f86483 (shape-only change; SIMULATION_VERSION stays 2 — NPC
behaviour identical, asserted by the playing-nobody test).

UI: worker gained 'play'/'choose' messages; useWorld gained play()/choose();
PlayerPanel.tsx has CharacterPicker (living ≤25), DecisionPrompt (modal over
paused world), Retrospective (life story + heir picker). Player chip in
topbar; ▶ marker in list. Verified live: played Donna Ingram from age 0 to
death at 97 — 6 decisions answered, retrospective correct, continued as her
son David Okafor. Known cosmetic non-issue: two Rules-of-Hooks console errors
are HMR artifacts from editing useWorld with the page open; count never grows
on fresh loads, production build unaffected.

**Milestone 5 — COMPLETE**
The relationships domain (`packages/engine/src/relationships.ts`) — the template
for every remaining Layer 2 domain. Typed edges: friend / courting / spouse /
former-spouse, with strength, formedAtTick, typeSinceTick, endedAtTick.
Friendship forms from compatibility + proximity (shared home/work/street, never
a random pick); strong friendships become courtships; courtships become
marriages; marriages erode under modelled strain (habituation + mismatch +
joblessness) and can end in separation or widowhood. Every transition writes a
causal record at decision time. Kinship stays on Person.parentIds — never
duplicated into the graph.

Save schema v3 (friendships → typed relationships; migration keeps every old
edge as 'friend' — inventing marriages would be fabricating history).
SIMULATION_VERSION = 2. Golden hash c67a53ef (in determinism.test.ts AND
App.tsx — keep in step). UI shows Married to / Courting / Formerly married
with dates, and Why? on marriage/separation events.

Three bugs found and fixed this milestone, all worth remembering:
1. **Iteration-order nondeterminism.** Courtship depends on who is already
   paired, so Map insertion order changed outcomes after save/load. All
   relationship loops now iterate sortedRelationships() (sorted by a,b).
   Caught by the save-load-continue test.
2. **Population collapse.** Couples never moved in together — household
   formation only fired for people living with parents, so births starved
   (town of 100 → 38 in 50 yrs). Fix: moveInWithPartner() in systems.ts.
   Births now require partnerOf(), not accidental cohabitation.
3. **Girls named Peter.** Newborn name list and sex were independent draws.
   Sex first, then matching name list. Regression test in simulation.test.ts.

Divorce is rare by design (courtship selects hard for compatibility; every
married pair scores 721-916). Most separations hit founding couples. Only seed
4242/720 ticks of 8 tried produced a full in-sim arc (wed AND separated) — the
exit-criterion test uses it deliberately; see comment in relationships.test.ts.

**Milestone 3 — COMPLETE**
`npm run bench` writes `docs/PERFORMANCE_BASELINE.md`. Every performance guess in
the docs is now a measurement. `performance-reviewer` agent created (ADR-0007).

**The headline finding: the tick loop is O(n squared) in population.** Ten times
the people costs ~66x the time per tick. Cause: friendship formation in
`systems.ts` filters the whole living population per person. At 10,000 people a
tick costs 210 ms against a ~100 ms budget.

**NOT FIXED — deliberately.** M3 measures; it does not tune. The fix is either
the tier system or a cohort index, and it should be chosen deliberately. Route
the next tick-loop change through `performance-reviewer`.

Second finding: **CPU bites before memory.** The docs assumed browser memory was
the binding constraint; 10,000 people fit in ~20 MB and the whole page measured
11 MB. Priorities reordered in `SIMULATION_LEVELS.md` §7.

At the shipped ~100 people the game is fast: 0.27 ms/tick, 5 years in 14 ms in a
real browser.

**Milestone 2 — COMPLETE**
Real interface: person list with living/working/children/dead filters, person
detail (work, schooling, home, parents, children, friends -- all clickable to
navigate), life timeline, per-event "Why?" explanations, and time controls
(+1 month / +1 year / +5 years) with a seed box for a new world.

`useWorld.ts` holds the World in a **ref**, not React state, with a `version`
counter to trigger renders. The engine mutates in place and stays the single
source of truth -- copying the world into React state would create a second
copy of the truth, which is exactly what ADR-0012 has to guard against now
that the UI arrives early. `version` is a render trigger, never a fact.

**Milestone 1 — COMPLETE**
A deterministic town of ~100 people over 120 monthly ticks with readable life
stories and causal records. 69 tests pass.

Engine modules: `rng.ts` (derived streams, integer-only), `clock.ts`,
`types.ts`, `content.ts`, `worldgen.ts`, `systems.ts` (education, employment,
friendship, households, births, mortality), `tick.ts`, `records.ts`,
`story.ts`, `snapshot.ts`, `text.ts`.

Determinism is covered by golden seed, double-run, per-10-tick comparison,
seed sensitivity, staged resumption, narrative stability, and a
**cross-environment check in the browser** — `apps/web/src/App.tsx` recomputes
the same fingerprint and displays pass/fail.

> **The golden hash `d5a213eb` appears in TWO places** and they must stay in
> step: `packages/engine/test/determinism.test.ts` and
> `apps/web/src/App.tsx`. If simulation behaviour changes deliberately, update
> both AND bump `SIMULATION_VERSION` in `snapshot.ts`. Never edit the constant
> quietly to make a test pass.

### Next up

**Milestone 5 — relationships, one domain done properly.** See
`docs/MILESTONE_PLAN.md`. The template for how every Layer 2 domain gets built.

In scope: typed relationship edges; formation from compatibility, proximity and
shared context; decay and reinforcement; **marriage and divorce with causal
records**; household composition changes; UI for viewing relationships; full
test coverage.

Exit criterion: a generated life story contains a relationship whose beginning
AND end are both explainable from records, and the explanation is not obviously
wrong.

Out of scope: every other Layer 2 domain. This is a template, not a race.

**Note:** marriage moving in-scope means the M1 birth rule (an adult woman with
a co-resident adult man) should be replaced by a real partnership model. See
"Known simplifications".

After that: M6 accounts.

**Binding out-of-scope until an ADR says otherwise:** marriage/divorce,
relationship depth, businesses as entities, economy, health beyond
alive/dead, government, military, crime, media, weather, inheritance,
multiple towns, simulation tiers beyond Deep, causal compression.

### Known simplifications worth revisiting

- Births require an adult woman and a co-resident adult man in the same
  household. A deliberate placeholder for Layer 2's relationship systems, not
  a claim about families.
- Names are not unique, so two living people can share a full name.
- No economy: pay bands are fixed and there is no inflation.
- **Population declines over long runs.** Seed 12345 went 100 living to 38 over
  50 years. Births need an adult woman aged 20-42 in a household with a
  co-resident adult man, and many people never form one. Not a bug in the code
  so much as a missing model — M5's partnership system is the right place to
  fix it. Worth re-checking after M5.

## Rules that cannot be bent

1. **Engine purity.** `packages/engine` imports from `@life-engine/shared` and
   nothing else. No React, no DOM, no I/O, no clock, no timers.
2. **Determinism.** Same seed + version ⇒ byte-identical results. Every banned
   construct in `docs/DETERMINISM.md` §5 is banned, not discouraged. Cannot be
   retrofitted.
3. **One owner per piece of data** (`docs/DOMAIN_MAP.md` §2).
4. **Causal records are written when the decision happens**, never
   reconstructed afterward.

## Open items for Ethan

- **Git identity is repo-local only.** Global is still unset, so other repos
  on this machine cannot commit until he runs:
  `git config --global user.name "Ethan"` and
  `git config --global user.email "ethanbradshaw80@gmail.com"`
