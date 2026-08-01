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

**M-HARM — COMPLETE** (owner ×4: enemy variety / 20+ harms / deployment
happenings / more awards; commits eb76bf7 + cfb5de0 review fixes)
GEOPOLITICS: decade-scale zero-mean-ish flashpoint (hash pair×decade,
factor 'regional-flashpoint') + FADING rematch damping (−120 decaying 6/yr
from relation.sinceTick — review killed the permanent ratchet). 22 NEW HARM
KINDS (12 injuries: amputation…animal-bite; 10 illnesses: cancer…dysentery)
in wounds.ts tables with sites/phrases/marks + STANDALONE_KINDS set. DEATHS
NAME CAUSE (runMortality: active ailment → describeAilment; fatal accidents
pick+name; 'a sudden illness' fallback). THEATRE DISEASE 8/1000/mo deployed
(inflictFieldIllness, service-connected, player/NPC parity exact). +12
contact flavors. COMBAT MOMENT ('combat-moment' pending, 1/4 player contact
months, auto-path skipped): BOTH answers roll real danger via shared
resolveMomentCasualty (lead: gate 450/floor 450; keep-down: 250/300 — the
ordinary month), SAME fatal tail (940+, 2/5) with posthumous wound+campaign
grants; 'act-of-valor' event recorded on going forward, VALOR WRITE-UP only
1-in-3 (rack inflation). DECORATIONS: the Star of Valor (guard: act-of-valor
events ONLY — first valor ever, §11's documented act finally exists), the
Standard-Bearer Medal (term avg ≥700), the Long Watch Medal (20y, device
30y) — first-draft names were verbatim real medals, renamed per review.
DEAD-IN-THEATRE FIX: resolveTours iterates OPEN TOURS (not isDeployed),
closes tours posthumously + campaign credit; isDeployed excludes the dead
(quota leak, pre-existing, made common by disease). SIMULATION_VERSION 20,
golden b7c83da6. Five review rounds this session; every substantive finding
fixed in-session.

**M-SPECOPS — COMPLETE** (owner ×3: named schools / special units / points)
SERVICE_SCHOOLS content (Jump School, the Air-Mobile Assault Course, Sniper
School, the Combat Diver Course, the Junior Leaders Course — two renamed by
review as near-verbatim real courses), badge-granting via awards machinery,
gates with engine-authored reasons (schoolOptionsFor/unitOptionsFor — UI
renders, never writes). SPECIAL_UNITS: the Pathfinder Battalion (tier 1) +
Task Unit Ember (tier 2, feeder=Pathfinders) — FICTIONAL names (review:
"correct, leave them"), selection roll fails people ('joined-unit'/
'dropped-selection' events + 'selection' DecisionType), 2-drop cap, duty
pay in servicePayOf, directCombat exposure ×1250/1500 per-mille on the
EXPOSURE side (rule-1 clean per review). NPCs: same roll/cap/feeder chain
(1/240 mo) + schools (1/40). PROMOTION POINTS: promotionPointsFor =
evaluation(perf/2) + fitness(0-300) + badges(40ea) + decorations(CAPPED
125: campaign 25/GC 20/wound 15 per device) + seniority(≤100) vs per-trade
cutoff (550 + 90/step + specialty.boardCutoffOffset, rifleman −40 …
signals +40); used by BOTH NPC branch and player board (+40 packet prep,
+15/prior-pass-over). FITNESS TEST MANDATORY-ANNUAL for all (monthsIn%12
===5; player gets the 'fitness-tested' feed event; review killed both the
forgot-the-button trap and the peak-score-forever exploit); player verb =
trainFitness (+40, ≤2/yr, kind 'fitness-test'). Service-tab ACTIONS:
volunteer rotation / train / request school (1-in-3 slot, 1 ask per 6mo)
/ try out. Schema v15 (unitId, fitnessScore, fitnessTestedAtTick).
SIMULATION_VERSION 16, golden 356ea46e. Accepted corner: Ember-in-offensive
touches the 200/mo contact cap. Reviewer's 4 rounds this session all
should-fix/no-must-fix; every substantive finding fixed in-session.

**M-SERVICE-PLAY — COMPLETE** (owner: "we need to be interactive")
Player never auto-promotes past competitive rank: yearly 'promotion-board'
pending (deferred ≤2mo if another question held the slot; player.log is the
dedupe), stakes show own standing/bar/TIG/prior-non-selections ONLY (no
board-side leak — review-verified); put-in = +40 packet prep; passed-over
EVENT + record; pass recorded too, and recorded non-selections raise the
next bar +15 each (why pass exists). 'attend-school' (+60 perf decaying,
can earn the qual → −50 bar permanently). 'volunteer-deploy' while homeland
at war (same tour machinery, 'own-choice' record). HIGH_YEAR_TENURE_TIG=72:
up-or-out at term end, honorable, good-conduct still judged, never mid-term,
ladder tops exempt. SPC→CPL lateral TIG 6→12 (owner: no mid-career double
promotions; first-year PVT→PV2→PFC kept — real schedule). TAB VERBS:
applyForJob (Jobs-tab Apply per row; honest refusal reasons; 'turned-down'
event; ONE asking/month) + requestEnlistment (Service-tab Enlist via
enlistmentBar reasons — canEnlist = enlistmentBar()===null, cannot drift).
Both log-only PendingKinds ('job-application'/'walk-in-enlist', custom-birth
replay pattern). SIMULATION_VERSION 15, golden d64d83f7, NO schema change.
military-scope-reviewed twice this arc; all findings fixed.

**L4-M5 — COMPLETE** (awards & veterans; LAYER 4 IS NOW COMPLETE)
`packages/engine/src/awards.ts` — single writer of world.awards; grant
functions REFUSE unqualifying events (negative-tested per foundation §11):
wound recognition "the Crimson Band" (enemy action ONLY — 'wounded-in-action'
or died-of-'wounds taken in action'; accidents structurally refused),
campaign medals (3mo in theatre or casualty waiver, judged at tour close,
posthumous incl.), good conduct (completed term at honorable TERM AVERAGE —
termPerformanceSum on ServiceRecord), qualification badges. AwardRecord
keeps qualifyingEventIds (one per medal AND device; idempotent on event id).
Valor deliberately ABSENT (no documented acts to reference). PENSION:
provenance not date-range — wounds stamped ailmentServiceConnected at
inflictWound; HealthRecord.serviceDisability accrues on resolution whenever
that happens; pensionOf = veteran × serviceDisability×120¢ ≥ threshold 200;
granted-pension event + record at discharge OR later crossing (never silent
income). 'Ashkelon' renamed 'Veskarn' (real city caught by review; migration
renames the nation, old events keep text). L4-M4 contact rate fixed: exposure
-normalized weights, ~12x spread, cap 200 a true backstop. Schema v14.
SIMULATION_VERSION 14, golden was 01ccfa5c. Deferred: survivor benefits
(pension ends at death — explicit decision pending), HYT on TIG not TIS
(approximation), service families don't move on PCS, branch-blind joint
bases.

**M-GAMEDEPTH — COMPLETE** (all six owner-feedback items, five commits)
(4) WAR PACING: geopolitics escalation ~5x rarer with steeper rung curve,
de-escalation up, NEW Nation.exhaustedUntilTick (ceasefire → 10-20y no new
escalation, deterministic from weariness). Homeland wars generational: 1-1.5
per century, ~1 per 76y life; homeland news items ~10-14/life (was ~23).
Schema v12. (1) MONEY LABELS: under-18 chip/row says "Family money".
(3) TABS: GameScreen has 📖Story 🏠Home 👪Family 💼Jobs 📰News 🪖Service
🩺Health — all READ-side over existing queries; Jobs is a browse-only
catalog (no "apply" verb — engine design deferred, see note in commit
29b5881). (2) CUSTOM LIFE: createCustomLife(world, spec) — born as a newborn
to an eligible couple (birthEligible extracted from runBirths, identical),
deliverChild gained no-draw overrides, spec logged as 'custom-birth' in
player.log (replay-exact, tested); UI "Be born" tab in CharacterPicker
(name/family name/sex/family, blanks = world decides) + "Take over a life".
(5) MILITARY REALISM: per-branch US-style ladders (BRANCH_RANKS, index +
rankTitle(branch,rank)), MONTHLY promotions — junior by time-in-grade
(6/12/24-30mo), competitive from board ranks (TIG + perf bar + draw scaled
by margin; SPC→CPL lateral quick; quals count toward the bar), NEVER skips
(regression test); per-grade pay table (basePay REMOVED from specialties);
term texture: basic (2mo) → specialty school (schoolMonths) → posting →
exercises/quals/PCS-at-30mo; deployment waits for training. ServiceRecord
+= rankSinceTick, qualifications. 'promotion' DecisionType + Why? wiring.
Schema v13 (rank remap by grade equivalence). military-scope-reviewer ran
(should-fix, all substantive findings fixed; accepted: no non-selection
records, joint bases branch-blind, families don't follow PCS).
SIMULATION_VERSION 13, golden 9e1808d6. 235 tests.
KNOWN ENV QUIRK: editing useWorld.ts with the page open corrupts the live
session via HMR (Rules-of-Hooks console errors, dead clicks) — reload fixes.

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

**M-WOUNDS (named harm) — COMPLETE** (owner direction: "grounded tone" must
not mean vague — depth everywhere, injuries first)
`packages/engine/src/wounds.ts`: InjuryKind (gunshot/shrapnel/blast/burns/
crush/fracture/concussion/laceration) × BodySite, picked by InjuryContext —
machinery/mishap (civilian), direct-combat/convoy/base-attack/field-accident
(deployment channel maps to context: convoy wounds are blast/shrapnel/crush,
base attacks burn). IllnessKind by age (heart-trouble old, pneumonia any).
HealthRecord += ailmentKind/ailmentSite/marks[] (marks = permanent damage IN
WORDS, append-only, from markFor(kind,site): "walked with a limp from then
on", "the hand never worked fine tools again"). Event detail format is now
"serious|minor:description" (tests use startsWith). Stories render specifics:
"Badly hurt: a crush injury to the hand." / "Recovered — but the lungs never
fully recovered." Marks appear in PersonDetail Health row and dead people's
Legacy section. inflictWound(world,tick,id,severity,context,rng) returns
{kind,site,description}. Migrated old ailments keep NULL kinds ("an injury"
— unrecorded specifics stay unrecorded). Schema v11, SIMULATION_VERSION 11,
golden d6d7fc43. Verified: a mill hand's 1977 pneumonia mark ("lungs never
fully recovered") preceded his death of illness at 55 — the mark raised his
mortality for 16 years. DEPTH-PASS PRINCIPLE (Ethan's standing direction):
apply the same specificity elsewhere — candidates: cause of death should
name the illness that killed (performDeath 'illness' → active ailmentKind),
richer courtship/marriage texture, workplace incidents naming the machine.

**L4-M4 (deployment & risk) — COMPLETE**
`packages/engine/src/deployment.ts` on Stream 10 (the last reserved stream,
claimed). Homeland wars issue ORDERS (not pendings — deployment is the
army's decision; 'under-orders' factor says so): callRate by phase, deployed
share capped 60% of serving, 10-month tours numbered and KEPT FOREVER
(Deployment[] per person, schema v10). threatVectorFor(war, enemy) — the API
takes a WAR, which IS the permanent rule: 4 channels (directCombat/convoy/
baseAttack/accident) from enemy strength × war phase; crossed with specialty
exposure; ONE channel checked per month; contact ~8%/mo for a rifleman in an
offensive, single digits rear-echelon; tested contacts < deployedMonths/3
(foundation §6). Wounds → inflictWound() (health-owned, called by war — the
distributeEstate pattern); serious wound = evacuated home (tour closed).
Death: severity>=940 tail → performDeath() — EXTRACTED from runMortality so
combat gets no cheaper death (job released, estate passed, widowhood, record
— identical teardown). Record chain: channel + enemy-capability + war-phase
+ battlefield-chaos; event text short ("wounds taken in action") — asymmetry
per §8. 'wounded-in-action' events distinct from civilian 'was-injured'
(L4-M5 award eligibility will read the difference). STOP-LOSS: terms hold at
1 month while deployed; reenlist question waits for home. vitest hookTimeout
60s (beforeAll centuries hit the 10s default under load — the testTimeout
lesson's sibling). SIMULATION_VERSION 10, golden 69ee4d2c.

**L4-M3 (service careers) — COMPLETE**
`packages/engine/src/service.ts` + content: 3 fictional branches (Land
Forces / Naval Service / Air Guard), 6 specialties with EXPOSURE PROFILES
(directCombat/convoy/baseAttack/accident weights — what a job DOES, never
how dangerous a place is; these are L4-M4's inputs), 6 enlisted ranks,
2 domestic bases (Fort Calder, Redharbor Station — allocated AFTER the
population, same id-shift trap as nations, hit AGAIN and fixed the same
way). ServiceRecord per person; RECORDS SURVIVE DISCHARGE (foundation §10 —
the artifact a descendant finds). Enlistment: player gets 'enlist' as a 4th
education-fork option at 18 (when canEnlist: age 18-26, fit, disability<400,
qualified) + recruiter knocks while young/jobless; accept → chained
'specialty' pending (follow-up raised AFTER commit — see resolvePending
tail). NPC propensity jobless 110 / employed 16 per 12k/mo (first tune: 1
enlistment in 50 years — town hires its young too fast; door must be audible
over a paycheck). Service pay → householdIncome; serving = no civilian
employment (guard in runEmployment); annual promotion by performance
(480+rank*60 threshold); 48-month terms → player 'reenlist' pending
(stay/leave), NPC retention 380+rank*90 /1000; medical discharge at
disability>=400. Veterans: specialty civilianUnlocks open occupations
schooling wouldn't (mechanic→machinist/electrician/carpenter, medic→nurse).
Enlist stakes read activeWars — "The Republic is at war. Service now will
not be quiet." Schema v10? NO — v9 (empty service map; no service predates
the service). SIMULATION_VERSION 9, golden 9daf6e86. Work chip shows
"corporal · medic — serving". PYTHON PATCH LESSON: str.replace replaces ALL
occurrences — an anchor matching two switches put stakes cases inside
resolvePending AND describePending; always use unique anchors or count=1.

**L4-M2 (health) — COMPLETE**
`packages/engine/src/health.ts`: one HealthRecord per person (ailment
injury|illness, severity 0-1000, peakSeverity, permanent disability that
NEVER decreases — the field a war pension will read). Onset: injury tracks
work (RISKY_OCCUPATIONS set), illness tracks age+frailty. Recovery monthly
(youth+vitality heal faster); worsening uncommon; lasting damage judged by
PEAK severity (first draft judged the residual at recovery ≈ 0 and no one
was ever marked — bug found by test). Severe ailments (>=600) block hiring
and drag performance; disability lowers the performance ceiling
(driftPerformance reads it); mortality reads both (mortalityFromHealth).
**2/3 of accident deaths become survivable serious injuries** in
runMortality. Player: 'convalesce' pending (once per ailment via
askedConvalesce): rest = -220 severity, -60 performance; push-on = +20
performance, no healing bonus. Health stat chip in GameScreen; Health row in
PersonDetail (only when notable); 🩹🤒💪 feed icons. Stream.Health with
tick+5555 salt (no collision with mortality draws). Schema v9? NO — v8.
SIMULATION_VERSION 8, golden 2e05c9c8, migration v7→v8 (everyone well and
unmarked — unrecorded history not invented). vitest testTimeout raised to
60s: century-scale tests brushed the 5s default under parallel load and
LOOKED like flaky nondeterminism (failed 1 then 4 then 0) — timeouts, not
drift; determinism was never broken.

**L4-M1 (geopolitics) — COMPLETE**
`packages/engine/src/geopolitics.ts`: 12 fictional nations + 'the Republic'
(homeland, exactly one), all AGGREGATE (statistics; nation ids never appear
in people/education/employment — tested). Pairwise relations on the ladder
peace↔tension↔sanctions↔skirmish↔war→ceasefire→peace, advanced monthly on
Stream 9 (reserved since M1), pair-keyed draws (a*4096+b). Escalation
pressure modelled (bloc rivalry, instability, economic gap; same-bloc damps);
wars have phases (opening→attrition⇄offensive⇄stalemate), aggregate
casualties, and END via weariness. Every transition = event + causal record
(war/ceasefire Defining). newsSince() → GameScreen feed as 📰 cards (dashed
border; solid red when homeland involved; foreign minor shifts filtered out).
Schema v7: old saves get nations GENERATED FROM THEIR OWN SEED at load
(hydration-side, since generation needs the live World; tested against the
v1 fixture — deterministic across loads). SIMULATION_VERSION 7, golden
b94ca00e. TWO LESSONS: (1) rng.chance denominators must be integers —
600_000/odds needed Math.floor (Rng threw, correctly); (2) nations are
allocated LAST in createWorld — allocating them first shifted every person
id, and ids seed trait streams, so the whole town was reborn as strangers.
First tuning gave 20 concurrent wars by year 20; cooled to a handful
(escalation /5, de-escalation ×4, war-end 26k→18k denominator).

**L4-PLANNING — COMPLETE** (docs only; engine, golden, tests untouched)
`docs/LAYER4_PLAN.md`: Layer 4 entered military-first (ADR-0017, **Accepted** 2026-07-31). Five vertical milestones:
L4-M1 geopolitics (fictional nations, relationship state machine on Stream 9
— reserved since M1 — surfacing as news cards; no player mechanics),
L4-M2 health prerequisite (injury/recovery/disability — the one gap the §17
foreclosure audit found), L4-M3 service careers (enlistment pending kind,
ServiceRecord per the employment pattern, occupational specialties),
L4-M4 deployment & risk (danger = VECTOR from geopolitical state, never a
country lookup — the permanent rule, enforced by test), L4-M5 awards &
veterans (strict eligibility in code). THE ARCHITECTURAL RULE: foreign
nations are aggregate-tier ONLY, no individual foreign person ever (O(n²)
measured lesson). military-scope-reviewer agent created (mandatory on
military changes; enforces the 7 rules incl. tone-both-directions and
asymmetric information). Deferred within L4: units/lineage, schools,
Reserve/Guard, officers, POW/MIA, ribbon-rack UI, war economics.

**M-DEPTH2 (career depth & town content) — COMPLETE**
annualReview() in systems.ts: on each job anniversary, pay closes part of the
gap to the occupation ceiling scaled by performance (perf/6500 of headroom;
nothing under 350 perf; skipped under 1% — no event noise). Deliberately NO
random draw: performance already carries the noise, and a raise that follows
from recorded performance is explainable; a payroll lottery is not. Not a
player decision (nobody decides to receive a raise) — lands in the feed as a
💵 card: "A raise: $2,140 a month now." Six new occupations (cook,
bookkeeper, carpenter, foreman, pharmacist, doctor — doctor tops at $6k) and
four new workplaces (the diner, the savings bank, Halloran's garage, the
courthouse). SIMULATION_VERSION 6, golden 075cdc27.

Test lesson (recurring pattern — this is the second): the retirement re-ask
test cast a frail 66-year-old who died one tick before her second birthday
question. Recast with vitality>=750. When a test needs someone to SURVIVE,
filter on vitality; when it needs heirs, start from a founding parent.

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

### Next up — CRIME & JUSTICE, C1 (owner choice 2026-07-31)

Read `docs/CRIME_PLAN.md` — it is one page and it is the spec. Build C1:
petty theft with modelled motive (arrears/joblessness), victim households
losing real money through a finances-owned transfer helper (finances stays
the ONLY writer of household.savings), clearance → arrest → court at the
courthouse → verdict → fine or jail months (jail = absent from work and
wage), criminal record on the person (schema bump, empty migration),
hiring + enlistmentBar read the record, feed/News surface it.
architecture-reviewer on the domain shape before commit. Then C2 (player
crime choices) and C3 (justice depth) per the plan.

M-DEPTH3 landed the queued small items (machines named in workplace
incidents, anniversaries, Enlist label). Older still-open notes: survivor
benefits decision, families on PCS, branch bases, HYT TIS approximation,
Ember contact-cap corner.

### Superseded — the old L4-M5 next-up (kept for context)

M-GAMEDEPTH is done (all six owner items — see its block above). What's
queued, in suggested order:

**1. L4-M5 — awards & veterans** (the last planned Layer 4 milestone).
Strict eligibility IN CODE with a negative test per the foundation: wound
recognition requires a qualifying wound from enemy action
('wounded-in-action' events are already distinct from civilian
'was-injured' for exactly this); campaign credit requires qualifying
service against conflict and dates (Deployment[] has war pair, enemy,
tour dates). Qualifications on ServiceRecord are the badge inputs.
military-scope-reviewer is MANDATORY. Inputs the review flagged for this
milestone: model the promotion board better than a draw if boards become
visible; consider non-selection records; L4-M4's contact rate saturates
~91%/tour for a rifleman in an offensive — revisit against foundation §6
("most military work is not combat").

**2. Depth-pass candidates (standing principle: a screen thinner than the
simulation behind it is a defect):** cause of death naming the illness
that killed (performDeath 'illness' → active ailmentKind); workplace
incidents naming the machine; richer courtship/marriage texture; Jobs tab
"go looking for work" engine verb (design vs opportunities-are-real);
service families following a PCS (households currently stay put);
branch-appropriate base assignment (bases are joint-use today — adding a
base shifts nation ids, mind the id-shift trap and the golden).

**3. Small polish debt:** enlist option label lowercase in the education
fork prompt ('enlist' vs 'Go to college' — OPTION_LABELS in
PlayerPanel.tsx); preview tooling wants a launch.json at the USER level
which project rules forbid — start the dev server from apps/web in a
background shell and preview by URL instead.

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
