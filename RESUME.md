# Resume Here

**Paste this into a new Claude Code session started in `Documents\LifeEngine`:**

```
Read RESUME.md, follow START HERE, and work down THE QUEUE on your own.
Do not re-read the other docs unless the task needs them. Write all code
yourself. I am asleep — do not stop to ask me questions; pick the sensible
option, write down why, commit as you go, and keep working. Only ask for
things needing physical access to my computer.
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

---

## START HERE (handoff, end of 2026-08-02)

**STATE:** clean tree, everything pushed, HEAD `b533ba7`.
SIMULATION_VERSION **47** · Classic golden **798939fc** · Heartland golden
**c2e846c5** · SCHEMA_VERSION **23** · **527 tests**, all green.
P3, W1 and W2 all COMPLETE and reviewed — six reviews, eighteen must-fixes,
every one fixed.

**THE REAL COUNTRIES QUESTION IS ANSWERED: you picked option 3.** Real
countries, invented wars. ADR-0021 records it; the record below says what
that cost and what it did not buy.

**THE ONE INSTRUCTION FROM THE OWNER FOR THIS WINDOW:** he has gone to
sleep and wants work to continue without him. Keep going down the queue
below, autonomously, committing as you go. He will read it when he wakes
and fix what he does not like. Do NOT stop to ask questions — pick the
sensible option, write down why, and keep moving.

### THE QUEUE, in order

**1. FINISH THE MILITARY MODULE — THREE PIECES, IN THIS ORDER**
(`docs/MILITARY_COMBAT_PLAN.md` is the spec; the owner's awards pack lives
in `C:\Users\ethan\Downloads\awards_badges_pack.zip` if you need it again.)

The design calls below are ALREADY MADE. Do not re-derive them; build them.

---

#### PIECE 1 — Shared unit cutscenes (combat plan step 4/5)

Six moments that make joining a unit feel like something: **the packet
drop**, **selection day**, **reporting in**, **tier-up**, **losing one**,
**the old hand**.

THE KEY DESIGN CALL, already made: **these are NOT combat scenes.** They are
commitment and aftermath, so they need their own pending kind —
`'unit-moment'` — and they must NOT route through `resolveMomentCasualty`,
which is the enemy-contact resolver. Reusing `combat-moment` would put a
firefight's fatal tail on a moment where nobody is shooting.

How to build it, concretely:
  - `scenes.ts` already has the shape to copy: a scene with `tell`,
    `labels`, `did` per option. Add `UNIT_MOMENTS` beside `COMBAT_SCENES`
    with the same three-option spectrum (push / hold / cover re-flavoured).
  - Raise from `service.ts`'s monthly pass, not from `deployment.ts`:
    - packet drop → when `unitOptionsFor` first has an open unit
    - selection day → resolves against the unit's own
      `selectionDenominator`, and the risk is the ACCIDENT channel (an
      injury or a quit), never an enemy
    - reporting in → the month after `joined-unit`
    - tier-up → when a tier-2 unit opens to someone already in its feeder
    - losing one → when a squadmate of theirs dies (`unitRosterOf` gives
      the squad; a `died` event for a member is the trigger)
    - the old hand → 36+ months in the unit, once
  - Selection day should REPLACE the instant pass/fail inside
    `tryOutForUnit` for the player only — the NPC path stays as it is, the
    same way the school seat did.
  - RULE 1, THE ONE THAT KEEPS BITING: if any of these can raise a
    follow-up, resolve it AFTER `commit()` in `resolvePending`. It has
    shipped broken twice.

#### PIECE 2 — The capture system, and the Prisoner of War Medal

The awards pack marks it HOLD until this exists. Build the system, then the
award — in that order, because the pack's rule is that nothing unearnable
exists, and `'pow'` is deliberately NOT in the `AwardKind` union yet.

  - **The branch:** in `deployment.ts`'s casualty resolution, a bad
    **overrun** outcome can end in `was-captured` instead of wound or
    death. Gate it hard — capture should be rarer than death, and only
    from the worst cell.
  - **Captivity is a state, not an event:** the person is neither deployed
    nor home. Simplest shape that fits: a `capturedAtTick` on the service
    record (schema bump), `isCaptured()` beside `isJailed()`, and the same
    absence rules jail already has (no hiring, no promotion, the household
    keeps the pay).
  - **It ends two ways:** `repatriated` (a monthly draw, likelier once the
    war ends) or `died-in-captivity`. Both are permanent record.
  - **Then** add `'pow'` to `AwardKind`, `grantPow` off `was-captured`, and
    `POINTS_PER_POW = 15`.
  - The player's own capture should be a moment, not a silent state change.

#### PIECE 3 — Aviation, and the Air Medal

Same order: the system, then the award. `'air'` is not in the union yet.

  - **A flying specialty** in `content.ts` (`aircrew`, air-guard, its own
    exposure profile weighted to `accident` and `baseAttack`).
  - **The Nighthawk Squadron** as the aviation tier-2 unit — it is already
    in the combat plan §4e with four scenes written and waiting.
  - **An `aerial-mission` event** raised on deployment for aircrew, and the
    four Nighthawk scenes (hot LZ, gun run, brownout, your bird is hit)
    added to `COMBAT_SCENES` with `unitId: 'nighthawk'`.
  - **Then** `'air'` in the union, `grantAirMedal` off `aerial-mission`,
    plus the aviator and aircrew badges from a flight school.

---

#### ALSO OPEN, smaller
  - **The ribbon rack UI.** `ribbon_rack.html` in the owner's pack is the
    reference. The Record sub-tab lists decorations as a timeline today;
    the rack is the visual version of the same data. Render from
    `decorationsOf()` and `badgesOf()` — earned only, never a catalogue.
  - **Senior Parachutist**: holds `parachutist` + 36 months in an airborne
    unit, granted from the monthly service tick as a qualification badge.

#### HOW TO WORK IN THIS REPO (the short version)
  - `npm run check` before every commit. Node needs
    `$env:Path = "C:\Program Files\nodejs;$env:Path";` prefixed.
  - Two goldens move together on any unplayed-world change:
    `determinism.test.ts` + `App.tsx` for Classic, `w2.test.ts` for
    Heartland. Bump SIMULATION_VERSION in the same commit and say why in
    `snapshot.ts`'s history. PLAYER-PATH-ONLY changes move neither.
  - Measure before tuning: write a temp test that prints, read it, delete
    it. That is the house style and it has caught every real balance bug.
  - Run the reviewer before calling a milestone done —
    `military-scope-reviewer` is MANDATORY for anything in this module. It
    has found a real must-fix every single time.

**2. W3 — PLACE DEPTH.** Climate/seasons, university institutions, regional
priors — and the two military items deferred since M-ARMY2 ("families
follow a PCS", "branch-appropriate bases") which need real geography.

**3. C3 — JUSTICE DEPTH** (`docs/CRIME_PLAN.md`). Probation, sentencing
variety, the constable as an occupation, town crime pressure as news,
record-fade gates, the victim's side as player experience.

### THE AWARDS PACK & THE COMBAT PLAN — what landed (8f76883 … 6641e94)
  - **REAL DECORATIONS** (ADR-0024): the Purple Heart, the Good Conduct
    Medal, the Silver Star, the Medal of Honor, the Combat Infantryman
    Badge. Reverted twice before in this repo — the ADR and a test both say
    a reviewer may not do it a third time.
  - **EARNABILITY IS THE PRICE, and it is enforced**: every award grants
    from a qualifying recorded event, a test walks every kind in the union
    and fails if nothing grants it, and the negative tests still prove each
    one refuses what does not qualify.
  - **The campaign medal is generic** — the Armed Forces Expeditionary
    Medal. That was the owner's own exception and it independently fixed a
    bug the military review had caught.
  - **Seven new ribbons**, all off events the engine already recorded, plus
    combat recognition that takes its face from the trade.
  - **FOURTEEN SCHOOLS with a calendar** and **six units, one entry unit per
    branch**, so both tabs are real for everybody.
  - **THE COMBAT SCENE**: threat level rolled from the channel's own weight,
    told to the player, answered push/hold/cover, resolved on the owner's
    matrix. Every cell keeps the fatal tail — that is the invariant, and a
    test walks all nine.
  - FLAGGED, NOT DECIDED: "Medal of Honor" is also a video-game trademark,
    the only name on the list with a commercial conflict. Implemented as
    directed; the Distinguished Service Cross is a one-constant swap.

### THE WAR SPEC — COMPLETE (owner spec, 2026-08-02, in three commits)
7beaa4b · 15a4a29 · cfafbff, plus ADR-0022.
  - **WAR LENGTH** is rolled at the outbreak: 2-15 years, quick when the
    sides are mismatched, a grind when they are even. It is a ceiling —
    weariness still ends a bloodbath early.
  - **DIFFICULTY** is a country's combat rating (the owner's table for
    Heartland; derived from strength for Classic's invented ones) plus what
    its wars taught it — a point per decade of fighting, three at most. What
    a soldier feels is the GAP between the two sides, not the enemy alone.
  - **THE CALL TO ARMS** fires on DISTRESS, not a clock — his own answer,
    and better than the spec's three-year timer: a country that is losing
    badly asks for help, and a really bad war has asked before year five.
    Allies who answer declare against the same enemy, so coalitions are
    built out of ORDINARY PAIRWISE WARS and nothing in the war model had to
    change. Measured: the homeland is pulled into ~2.4 wars it did not start
    per 150 years, coalitions reach 7 countries.
  - **ORDERS** needed no new plumbing at all — a war the homeland joined is
    already a homeland war. What is new is that the player is ASKED: go, ask
    to be excused (rarely granted, and a denial sends you anyway), or refuse
    and take the court-martial — nine months, a misconduct discharge, and a
    conviction the hiring gate reads for years.
  - **THE ONE PLACE THE SPEC WAS NOT FOLLOWED**, recorded in ADR-0022 §4:
    it says the player chooses whether their NATION joins a war. They do
    not. There is no head-of-state seat in this design and Law 2 is why —
    the player is one person, not a government. They get the decision the
    charter says is theirs: whether THEY go.

### REAL COUNTRIES — SETTLED, option 3 (ADR-0021, commits 50d024e, 026f4ce)
You picked 3: real countries, real (generated) wars. What that means now:

  - **american-heartland ships your 21 countries** with your ally/neutral/
    hostile labels. Classic still invents its whole map — that is the point
    of keeping it.
  - **THE LINE THAT DID NOT MOVE: no war here is ever real.** Every
    conflict is generated from modelled pressure. No real war, operation,
    battle or campaign name exists in this codebase, and a test scans the
    engine AND the UI and fails if one appears. Named units and decorations
    stay fictional in every preset — you did not ask for those, and a real
    unit has living members.
  - **Your labels are a STARTING POSITION and nothing else**, which is how
    you framed them yourself. Allies start at peace, rivals start one rung
    up, and the ladder moves from month one. They decide only pairs
    involving the United States, because a US-perspective label says how
    Washington sees Moscow and not how Paris sees Beijing.
  - **The framing is a condition, not a courtesy** (ADR-0021 §3): the
    picker leads with it and a standing notice sits above the tabs in every
    played life — "The countries are real. Every war here is invented."

**THE REVIEW CAUGHT FOUR THINGS AND THE FIRST ONE MATTERED.** Campaign
medals were named after the enemy, which is fine for invented countries and
mints "the Afghanistan Campaign Medal" — a real US decoration's exact name —
for yours. There is one Expeditionary Medal now, with a device per campaign,
and the country appears only in the citation. Also fixed: "the the United
Kingdom front" (your list is the first with a nation carrying its own
article); a framing that a player could miss entirely by never opening the
News tab, and that described the WRONG WORLD after a reload; and alignments
quietly building a permanent seven-country alliance instead of just setting
a starting rung.

**ONE THING RECORDED RATHER THAN FIXED, so you know it is there:** a world
that starts in 1970 and generates its own wars will sometimes land one near
a real conflict's decade, and the engine does not notice. Era-locking
country pairs would mean modelling real history in order to avoid it, which
is worse. It is written into MILITARY_AND_WAR_FOUNDATION §3 as an accepted
consequence.

### W2 — COMPLETE (the American Heartland; military-scope-reviewed)
Commits 1d0d968 · 5f82a16. Ashcroft, a town that does not exist, in
Vermillion County, Indiana, which does. The United States as homeland. The
Army, the Navy and the Air Force by name — no insignia, ever — on the
ladders the engine already had. Seven real installations, branch-tagged.
Invented town, streets, businesses, school, call sign. Foreign nations,
wars, named units and decorations fictional, identical to Classic's.
  - THE THREE CONSTITUTION AMENDMENTS LANDED (CLAUDE.md §3,
    PROJECT_CHARTER.md §2, MILITARY_AND_WAR_FOUNDATION §3): a BRANCH may
    carry its real name where the homeland is real; a named UNIT is
    fictional in every preset, permanently.
  - Heartland has its own golden (41ec53de). A preset is a STRING in a
    save, and nothing else binds that string to the content behind it.
  - The review's three must-fixes: branch-blind base postings, the missing
    charter amendment, and no alternate-history framing anywhere — which
    the plan makes a CONDITION of a real homeland, not a nicety.
  - NOT DONE, and not faked: era-weighted name pools. The preset reuses the
    1990-census pools. Inventing 1940s frequency weights would be inventing
    a fact; that needs real data, not engineering.
  - The engine models no base closures or renamings, and no distance: the
    installations are "home stations" of a town in Indiana.

### RULES THAT KEEP BITING (read these before writing code)

1. **If a moment can raise a FOLLOW-UP question, resolve it AFTER
   `commit()`.** `raisePending` refuses while a pending is held, and it
   returns a boolean nobody checks. This has now shipped broken TWICE —
   the combat moment's field aid, then C2's plea, which meant the player
   was sentenced off-screen for the whole life of the feature. The cure
   both times was moving the call below `commit(world, pending, choice)`
   in `resolvePending`.
2. **A test that never advances the tick loop tests nothing.** The
   allied-war support tour shipped completely dead — closing on its first
   tick — with green tests that only checked the tour was created.
3. **Measure before tuning, and re-measure after.** The war that killed
   nobody was a 1000:1 severity gate, not bad luck; the enlistment "bug"
   was the News tab showing forty years of history at once. Both were
   found by writing a temp audit test that writes a report file, then
   deleting it. That pattern is the house style — use it.
4. **The owner's play notes find more than the reviews do.** When he
   reports something, believe the report and go measure it.
5. **Reviews are mandatory and they always find something.** Every single
   milestone reviewed today produced a real must-fix. Run the right
   reviewer (`military-scope-reviewer`, `architecture-reviewer`,
   `persistence-reviewer`, `documentation-reviewer`) before calling a
   milestone done.
6. **Golden + SIMULATION_VERSION.** The hash lives in TWO places
   (`determinism.test.ts` and `apps/web/src/App.tsx`) and must move
   together. Bump SIMULATION_VERSION for changes to the UNPLAYED world;
   player-path-only changes ride the schema version (DETERMINISM §7) —
   C2 correctly did NOT bump.
7. **Engine purity is enforced by test.** `toLocaleString` and anything
   else locale/time dependent will fail `purity.test.ts`. Use the
   deterministic helpers.

### WHAT SHIPPED TODAY (all reviewed, all pushed)

Perf: the tick loop was re-sorting the relationship graph on every partner
lookup — 86% of tick time on a grown town; sort-free scan, ~10x, byte
identical. · **P2** the fourteen player verbs. · **The 400-person town.** ·
**M-ARMY2** entire: enlistment as modelled pull + recruiting drives,
career shape (up-or-out below E-5, 30-year careers, join to 38, out at
62), company punishments, peacetime rotations to allies, war lethality
(wars killed NOBODY before), unit rosters, allied-war support deployments,
the wound diagram + first-aid moment. · **Retirement pay** and **survivor
benefits** (a widow draws 55%). · **Wars grind nations down.** · **The
import-graph ratchet** (12 known cycles, fails on a new one). · **C2**:
desperation moment, plea, 22-offence charge sheet, verdict sheet. · **The
Why? answers what came of it.** · **Census names** (owner-supplied). ·
**The WCJC newsroom.** · **The left tab rail.**

**Milestone 0 — COMPLETE** (`0620632`)
Monorepo: `packages/shared` (branded primitives, integer money),
`packages/engine` (pure simulation), `apps/web` (React + Vite). Strict
TypeScript. Engine purity enforced twice: `tsconfig.json` declares no
`"types"` so Node/DOM APIs will not compile, and `test/purity.test.ts` scans
for every banned construct in `docs/DETERMINISM.md` §5.

**C1 — COMPLETE** (crime & justice arc opened; commit 255b12b;
`docs/CRIME_PLAN.md` is the spec)
`packages/engine/src/crime.ts` — single writer of world.criminal; absence
IS the clean record. THEFT: motive modelled (arrears 90 + jobless 40 +
both 30 + diligence ≤20 vs threshold 100 — personality alone cannot cross,
Law 10 structural; jobless reads isServing, not service.has — veterans).
Money ONLY via finances-owned transferBetweenHouseholds (clamped,
conservation tested to the cent, self-transfer guarded) / chargeHousehold
(no floor — a fine can dig a hole; arrears machinery verified to handle
it). BOTH + runFinances + distributeEstate emit crossings via shared
noteArrearsCrossing — fell-behind/back-in-the-black is an invariant of the
FIELD (review: an inheritance lifting arrears owes the timeline its
recovery). CHAIN at decision time: committed-theft → was-arrested (350/1000
clearance) → was-convicted (700+100/prior, cap 950) / was-acquitted; jail
6-18mo when priors or take > $250, else fine 2×take. JAIL IS ABSENCE: no
hiring, county feeds them (householdCosts), job lost with
'employment-change' record (factor 'jail-sentence'), serving → misconduct
discharge (discharge() gained trailing streamId param; long-service medal
now REFUSES misconduct like its siblings). GATES: hiring −120 drag (floor
40), enlistmentBar "Not from a cell." / "The record at the courthouse
answers first."; RECORD_GATE_YEARS=10 lives in content.ts (leaf — crime
imports service for discharge, so service can't import back). was-robbed
lands on EVERY adult under the roof (a played non-eldest must see the
cause); crimeNewsSince keys headlines off committed-theft.otherId — one
per theft, thief named only at conviction. PLAYER = bystander/victim ONLY
(guard in runCrime; desperation pending is C2's). DEPLOYED SKIPPED (review
M1: a jailed deployed soldier would earn a fabricated homecoming from
resolveTours). Stream 11 appended + DETERMINISM.md row. Schema v16 (empty
migration), SIMULATION_VERSION 22, golden 1117926a — golden window has NO
theft, so crime.test.ts carries its own 900-tick double-run byte net.
Review ran twice (2 must-fix + 8 should-fix, all fixed, all verified).
KNOWN OPEN (queued): DOMAIN_MAP §4 Rule 4 import-graph test unwritten and
the engine graph HAS function-level cycles (crime⇄systems via
service/deployment and finances/player paths — two predate C1; bless via
ADR or dissolve with a command seam); relationships.ts separation split
predates noteArrearsCrossing; same-tick hire+jail "Why?" answers with the
hire (records first-match) — rare cosmetic.

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

> **The golden hash appears in TWO places** and they must stay in
> step: `packages/engine/test/determinism.test.ts` and
> `apps/web/src/App.tsx`. If simulation behaviour changes deliberately, update
> both AND bump `SIMULATION_VERSION` in `snapshot.ts`. Never edit the constant
> quietly to make a test pass.

### M-ARMY2 — COMPLETE. (Historical record of the arc follows; the live
### queue is in START HERE at the top of this file.)

Ethan's words, itemized. military-scope-reviewer MANDATORY. The
2026-08-01 army audit (temp runner, deleted) measured 120y × 3 seeds:
enlistments 2.3-3.1/decade (NPCs DO join — a VISIBILITY problem),
serving-at-once 0-8, tours 1-10/120y, contacts 1-11/120y, wounded 0-2,
died-serving 1 across 360 sim-years, combat deaths ZERO. Item 3 is a
real rarity, not bad luck; item 4 is surfacing, not rates.
### M-ARMY2 IS COMPLETE (items 1, 3, 4, 4b, 5, 6, 7, 8, 3b-replacement),
### fully reviewed, plus retirement pay.
Final state: SIMULATION_VERSION 35, golden 7264c3f4, schema v19, 349
tests. Commits: 4d5b40c 400-town · a99626a enlistment · 4ec523d career+
misconduct · dab8efa rotations · e6a2b4e review fixes+working-tab ·
523b7c8 war lethality · ac9127f rosters+ally war · e3927fa wound diagram
· 3352376 second review's fixes · 4d4448c retirement pay.
SECOND MILITARY REVIEW (over rosters/ally-war/field-aid) FOUND TWO
MUST-FIX AND BOTH WERE REAL — worth remembering how:
  1. The ally-war support tour CLOSED ON ITS FIRST TICK. resolveTours
     looked the tour's war up in the HOMELAND's war list; an ally's war
     is by definition not in it. The feature shipped completely dead and
     the tests did not advance a single tick. alliedwar.test.ts now
     does exactly that. LESSON: a feature test that never runs the tick
     loop tests nothing.
  2. Field aid labelled every death 'wounds taken in action', so an
     ACCIDENT death earned the wound decoration off a cause that never
     happened — sailing past the negative test in awards.test.ts by
     mislabelling the input rather than by breaking the guard.
Also fixed: field aid was a mortality SURCHARGE (the automatic fatal roll
had already run, so a player's wounds were ~1.5x as lethal as an NPC's
and standing near a player medic was dangerous) — the moment now carries
the whole tail and the automatic roll is skipped; the stakes text
described tradeoffs the model inverted; the casualty's death record said
they chose it; the medic could be summoned to another front; the
combat-moment field-aid call was dead code (pending still held).
THE CARRIED LIST IS NOW CLOSED (commits 4d4448c, 8bb5cf6, 307620a,
+ this one). SIMULATION_VERSION 37, golden f60c641f, schema v20, 353 tests.
  - RETIREMENT PAY (4d4448c): 2.5%/yr of final pay, 20-year minimum,
    capped 75%, stacks with disability, refused to 'end of term' and
    misconduct. Flows through pensionOf → householdIncome.
  - SURVIVOR BENEFITS (8bb5cf6): a widow draws 55% for life. Derived from
    the widowed edge (marriage ended ON the death tick) + the service
    record — no schema change. Granted on the record at the death.
  - WCJC (8bb5cf6): the town's news station, owner-named; the News tab
    runs under its masthead.
  - NATION STRENGTH ERODES (307620a): schema v20 adds baseStrength; war
    grinds strength off CUMULATIVE losses (a month's toll floors to zero —
    the first draft ground nobody down and the test caught it), peace
    rebuilds toward the baseline, floor 120. An enemy ten years into a war
    is now genuinely weaker to face.
  - IMPORT-GRAPH TEST (this commit): DOMAIN_MAP §4 Rule 4, queued since
    C1, finally enforceable. The engine has 12 real cycles and dissolving
    them needs a command seam, so the test MEASURES the graph, holds them
    in a named allowlist with the reason each exists, and fails on any NEW
    one — a ratchet that cannot get worse. ELEVEN OF THE TWELVE RUN
    THROUGH player.ts: every domain that can reach a choice point imports
    raisePending and player imports it back to apply the answer. That is
    the M-PLAY design, and the seam that would dissolve it is a command
    queue between the domains and player. The twelfth
    (finances⇄service⇄worldgen) has nothing to do with the player and is
    the shallowest to break.
STILL OPEN, with reasons:
  - FAMILIES ON PCS: deferred, not skipped. The world is ONE town; both
    bases sit in it, so a transfer between them does not require a family
    to move house, and inventing a move would be inventing geography.
    This becomes real at W3 (place depth), not before.
  - BRANCH-APPROPRIATE BASES: bases are joint-use. Needs a third
    installation, which shifts nation ids (bases are allocated before
    nations) and moves the golden — cheap, but do it with the W-arc when
    places are being touched anyway.
  - HYT ON TIS: effectively answered by M-ARMY2's career shape — the
    20/30-year ceilings ARE a time-in-service rule; high-year tenure stays
    time-in-grade, which is what it models.
NEXT ARC: P3 (the surfaces — relationships tab, finances tab, traits in
words, D1 stats in-game) then W1-W3 world presets. C2 IS DONE — see below.

### C2 — COMPLETE (the player and the law; reviewed, all findings fixed)
Commits 1864c1b (arc) · 9cf8245 (verdict sheet) · the review fixes.
SIMULATION_VERSION stays 39 and the golden did NOT move: every C2 path is
player-only, so an unplayed world is byte identical (DETERMINISM §7 puts
player-path changes on the schema version).
DESPERATION MOMENT: runCrime's player guard is gone — the modelled theft
pressure and its roll raise a 'desperation' pending (take-it/go-without),
and BOTH roads record. THE PLEA: an arrest raises 'plea' (plead-guilty /
stand-trial); resolveCourt is shared with the NPC path. CHARGE SHEET: 22
offences graded US-style (three misdemeanor classes, lettered felonies,
each inside its grade's ceiling) with clearance rates and gain ranges;
commitOffence is the Record-tab verb and offenceBar gates in words.
VERDICT SHEET: the case as its own popup, read by courtOutcomeOf off the
one month the court sat. Also fixed a real pre-existing bug: applyForJob
never checked jail, so a jailed player could be hired from a cell.
THE REVIEW FOUND THREE MUST-FIX, ALL REAL:
  1. THE PLEA COULD NEVER BE RAISED. answerDesperation ran inside
     resolvePending BEFORE commit() freed the slot, so raisePending always
     refused: the player was sentenced off-screen — the one thing C2
     exists to stop — and the VerdictSheet never appeared. THE SAME TRAP
     the combat moment hit with field aid, already documented in
     player.ts, hit again three milestones later. If a moment can raise a
     follow-up question, resolve it AFTER commit.
  2. `taken = -chargeHousehold(...)` moved NO money (it guards cents <= 0)
     and returned -undefined, so eight offences paid nothing and NaN
     reached an event detail and a serialized pending field. finances.ts
     gained creditHousehold; finance stays the single writer of savings.
  3. commitOffence had no log entry, no pending guard and no rate limit,
     and its stream is keyed on the month — pressing "Do it" repeatedly
     drained every household in town while never re-rolling clearance.
     Now logged ('offence' PendingKind), guarded, once a month.
SHOULD-FIXES LANDED: a guilty plea now buys something on the desperation
path (it was strictly dominated while the stakes promised leniency, and
the stakes text now says what the offence actually allows); priors no
longer floor to zero on short-span offences (they were a DISCOUNT at the
low end); a conviction can never cost nothing; the honest road's record is
'major' so it keeps its rejected alternative, and went-without reaches the
Why?; a player's robbery names its victim so it reaches the paper.
KNOWN, LEFT: pending.occupationId/monthlyPay carry the offence id and the
take (a dedicated field is a schema bump — deferred, commented); salts
4141/5252/6363 sit 1111 ticks apart and would only collide for a
110-year-old repeat offender (space >1500 if this code is touched).

### THE NEWSROOM — COMPLETE (WCJC; reviewed)
newsroom.ts writes structured articles to the owner's brief: headline,
dateline, lede, 2-4 body paragraphs, a quote from a REAL simulated person,
and a closing. Templates for died-in-service / came-home / crime / war;
recruiting drives get a headline and no article (owner: a notice, not a
story). Quotes vary by a pure hash of (person, month) and assert only what
the simulation holds. NO GENERATIVE AI — the brief was written for a model
and is executed by code, because CLAUDE.md §7 is absolute and the same
seed must produce the same paper forever. describeOutcome gives the Why?
its "what came of it" line (an award names the act that earned it; a
school names the rating; a conviction reads its sentence). Review found
one must-fix: a ternary with the same word in both branches. A prose guard
test now fails the build on doubled articles, bare numbers where ordinals
belong, gaps, and "undefined" in copy.

7. UNIT ROSTERS — DONE (commit ac9127f). Derived (person, base) → squad,
   so no schema moved and squadmates stay squadmates until a transfer;
   roster sorts by rank then seniority so the leader is whoever holds it;
   Service tab lists rank/name/role/away with each name clickable.
   Original ask below.
   UNIT ROSTERS (owner round 4): "add unit info like who our squad members
   are and our SGT etc like the rank structure of that unit." NEW
   STRUCTURE: soldiers belong to a squad/platoon/company at their base;
   the roster is other REAL simulated people with their real ranks; the
   squad leader / platoon sergeant are whoever actually holds the rank.
   Design notes: derive as much as possible (a Unit id on ServiceRecord +
   read-side roster query beats storing rosters twice — DOMAIN_MAP §1);
   people rotate in and out as they PCS, discharge, deploy and die, so the
   roster is a query over "same base + same unit id + serving", sorted by
   rank then seniority; squad members should appear in deployments and
   combat moments by NAME (that is the point — "my SGT" means something
   when he is a person who can be promoted, hurt, or killed). Feeds the
   3-option combat popups (item 2) and the medic idea (item 8).
8. WOUND DIAGRAM + FIRST-AID MOMENT (owner round 5, verbatim): "when we
   get injured or wounded in combat... a pop up diagram of a body and
   marking the injury that took place on the diagram and the severity of
   the injury along with its after effects... like a little mini game like
   'call out for help' 'apply first aid to self and wait' and whatever
   else... that can either kill or save their life when they have life
   threatening wounds... I also think for the medic this would be a good
   little side thing if they were in combat they can get this and try
   saving a fellow teammate."
   WHAT ALREADY EXISTS (this is mostly a SURFACE on a model that is
   already there): wounds.ts has InjuryKind × BodySite × severity ×
   permanent marks in words — the diagram's data is already computed and
   already on the HealthRecord (ailmentKind/ailmentSite/marks[]). What is
   missing: (a) an SVG body diagram in apps/web keyed off BodySite, with
   severity colour and the mark text as the "after effects"; (b) a
   'first-aid' pending raised when a wound is serious enough (>=600?) —
   options costed against the REAL severity, resolved through the same
   health machinery (a choice must not become a discount on the wound:
   the M-HARM combat-moment rule — both answers roll real danger); (c) the
   MEDIC version: a medic specialty in a squad whose teammate is hit gets
   the same moment aimed at someone else — which needs unit rosters
   (item 7) to know who the teammate IS. Order: 7 then 8.
   REVIEW GATES: military-scope-reviewer (tone — a wound is not a
   minigame's score; asymmetric information; no glory language) and the
   Law-3 rule that the outcome is recorded as a decision with the real
   inputs. Not a QTE: no timers, no reflex tests — the world pauses for a
   decision (Law 5) and the odds come from the model.
1. PEACETIME ROTATIONS — DONE (SIMULATION_VERSION 29, golden 17e3b083,
   schema v19; commit dab8efa). Six-month postings with same-bloc allies
   at peace, issued as ORDERS (share cap 220/1000, call 110/10k) plus a
   volunteer door; Deployment gained kind ('combat'|'rotation') + hostId
   and the war fields went nullable. NO enemy ⇒ no combat/convoy/base
   channel (the permanent rule), accident-only hazard crossed with the
   trade, lower illness rate, exercise texture, NO campaign medal ever,
   +25 performance on COMPLETION only, recall on homeland war. Measured:
   556 rotations vs 28 combat tours per century (~1.1 per career).
   ALSO DONE (owner): enlistments + homecomings OUT of the town news.
   Original spec kept below for the record.
   PEACETIME ROTATIONS: deployments to ALLY countries while at peace —
   the wartime button is now correctly labelled "Volunteer for
   deployment" (done in P2); rotations are the new thing. Points earned,
   pop-up situations, and real risk ("can still get hurt over there").
   Design carefully against threatVectorFor's permanent rule (danger
   from geopolitical STATE — a peacetime posting's risk profile is
   accident/illness-shaped, not combat) and the exposure-profile rule.
2. COMBAT POP-UPS WITH ~3 OPTIONS "which can determine the outcome and
   possible death": extend the combat-moment machinery (both answers
   already roll real danger via resolveMomentCasualty). SPECIAL UNITS
   (owner round 2): "if you are in the special units your combat
   missions and deployments should be different in aspects that make
   you feel like your apart of a special unit" — distinct moment kinds
   / mission texture for Pathfinders/Ember, not just the exposure
   multipliers M-SPECOPS gave them.
3b. SIMULTANEOUS WARS — WITHDRAWN BY THE OWNER (round 6) and REPLACED by
   the ally's war, which is DONE (commit ac9127f). Owner's words: "remove
   this and edit the if a country we are allies with goes to war and send
   us back to our home country we should actually be able to go and
   deploy over there so that we can help and also get some combat time
   ourself. Keep peacetime deployments and everything but I want the
   option to be there as well so that we can get more combat if wanted."
   SHIPPED: alliedWars() (same bloc, at peace with us, we are not a
   belligerent); a 'support-deployment' pending when the host of your
   rotation goes to war (stay-and-fight / go-home, NPCs roll 1-in-4 to
   stay); volunteerForSupport() so a soldier can go LOOKING for an ally's
   war in peacetime, offered ahead of a quiet rotation on the Service tab
   button. Staying opens a real combat tour against the ally's enemy —
   threatVectorFor reads that war's own state, so the permanent rule is
   untouched. All three roads into a war (orders / volunteer / beside an
   ally) share one startCombatTour opener.
3. ARMY DEATHS — DONE (SIMULATION_VERSION 31, golden 7f4af7b0, commit
   523b7c8). ROOT CAUSE WAS ARITHMETIC: the fatal gate wanted severity
   >=940 from nextBellInt(300,1000) (centre 650) — a ~1000:1 draw — then
   took 2/5 of it. Measured: 20y attrition war × 40 enlisted × 3 seeds =
   75-85 contacts, 25 wounded, ZERO dead. Threshold moved to 720 (inside
   the serious band): 2-3 dead per long war, 8-33% of casualties fatal.
   Player combat moments 1/4 → 3/5 of contacts; attend-school 1/36 →
   1/72 and volunteer-deploy 1/6 → 1/12 (owner: base pop-ups crowded out
   the life-or-death ones). deployment.test carries a permanent guard
   (casualties AND deaths, kia < casualties/2). d2 seed-777 collapse bar
   110 → 100, reason recorded (wars kill now; 106 from a founding 100).
   Original note kept: ARMY DEATHS: measured ~zero combat deaths ever. Wars are generational
   by design (M-GAMEDEPTH pacing) — decide deliberately: more contact
   lethality per tour when wars DO come + rotation risk filling the
   peace, vs foundation §6 (most military work is not combat). Tune
   against the measurement, on the record.
4. DONE (SIMULATION_VERSION 27, golden e21827cd; military-scope review
   ran — 7 should-fix, ALL fixed in-session): tradition +30 propensity
   (service-tradition factor finally emitted, NAMES the served parent
   via referencedEntityId; ~40% of enlistments cite it), drives ×3 for
   months 0-2 of ~every 3rd year AND every such window while the
   homeland is at war (review S6 — the drive is downstream of the
   world), player knock parity on BOTH terms ((35+10 tradition)×3 in
   season, review S3), player enlistment records carry the same
   circumstance factors (S4). DRIVE SEASONS ARE EVENTS ('recruiting-
   drive', subject = homeland nation id, emitted at each season's first
   active month) and serviceNewsSince reads EVENTS ONLY — an old save
   never grows drives it did not live (S7). News carries BOTH legs
   (S5): enlistments, came-home-after-N-years, died-in-service, drive
   seasons; player excluded. Factor weights double as story salience
   (S2): recruiting-drive 550 (top-3 visible), reached-adulthood
   demoted 400→150 (tautological). enlistment.test.ts (6 tests, S1):
   drive determinism + cross-seed variation, in-season rate > out
   while the decade band holds, tradition cites a real served parent,
   news both-legs + player exclusion, death closes the record + no-op
   guards. Rates 14.5-16.5/decade. TWO LATENT BUGS SURFACED BY THE NEW
   MIX, both fixed: serviceplay's HYT sweep hardcoded the land-forces
   ladder top (rank>=8; naval/air top at 6 — test now branch-aware),
   and DEATH IN UNIFORM NEVER CLOSED THE RECORD — dead soldiers stayed
   "serving" forever, inflating countServing's deployment-quota
   denominator (closeServiceOnDeath, called from performDeath; reason
   'died in service'; quiet — the death event is the event). Review
   note kept: News tab calls serviceNewsSince in render without
   useMemo (performance-reviewer if it ever shows). OWNER SETTLED THE
   DESIGN (round 3, direct quote:
   "People should join the military how it would be in real life,
   trouble finding a job? military. Don't want to go to college and get
   a tradition job, military. If your parents served it should increase
   the likelyhood a little as well... news stories that encourage
   people to join... should influence people"). NO god-verb, NO
   encourage-verb — DEEPEN THE PROPENSITY MODEL, exactly ADR-0019's
   modelled-circumstance idiom:
   - jobless pull exists (110 vs 16 /12k/mo) — keep, maybe re-tune at
     the new town size;
   - the 18 fork: chose 'work' but no job landed within N months →
     raised propensity (the no-college-no-trade road);
   - SERVICE TRADITION: a parent with a service record raises the
     child's propensity ("a little" — owner's words; the
     'service-tradition' FactorId already exists, cite it in the
     record);
   - RECRUITING DRIVES: occasional news items ("the recruiting board
     comes through town") that temporarily raise town-wide propensity —
     the moment that makes a sim think "I'm going to the recruiter";
   - surface every enlistment as a news/feed card so the town's uniforms
     are VISIBLE.
   4b. STARTING POPULATION — DONE (DEFAULT_POPULATION 100 → 400;
   SIMULATION_VERSION 26, golden cc676397 in both places). MEASURED
   FIRST at 400 × 150y × 3 seeds: fertility 2.36-2.48 (in band),
   childless 6-9%, median first marriage 21 (D2's accepted value), town
   grows to 789-968; ARMY BECOMES VISIBLE: 14-16 enlistments/decade,
   ~30 serving at once, tours 9-64/150y — combat deaths STILL ZERO
   (item 3 stands). ALL 21 pre-existing test files pin population 100
   explicitly (same generation path → byte-identical to their old
   worlds; suite stays fast at 19s); only determinism.test runs the
   default. Saved worlds keep their own population (hydration carries
   people, generation only runs on 'new'). Verified live: 400-person
   list renders, worldgen 15 ms, +5 years = 314 ms in-browser,
   cross-env badge verifies cc676397.
5. CAREER SHAPE (owner round 2, all tuning constants + one rule):
   - HYT/up-or-out ONLY BELOW SGT: "people shouldn't be forced out of
     service after missing rank promotions past like SGT because a ton
     of people retire at SGT, SSG" — HIGH_YEAR_TENURE_TIG applies below
     the SGT grade; at/above SGT you serve on unless you ERR (item 6).
   - Max career 30 YEARS; max join age 38 (today 18-26); max age in
     uniform 62 (mandatory retirement).
   All change NPC behaviour → SIMULATION_VERSION bump, demographics
   re-measured (more/longer careers shift D2's bands slightly).
6. MISTAKES AT BASE → non-judicial punishment ("Article 15's and
   such"): modelled misconduct incidents — rank reduction, forfeited
   pay, extra duty, on the record — which also becomes the honest
   removal path past SGT. NAMING: "Article 15" is real UCMJ language;
   the project's fictional-institutions rule (foundation §2) wants an
   invented equivalent ("company punishment" family) — decide at
   design, military-scope-reviewer rules on it.
Then C2 (CRIME_PLAN.md:52-55: desperation pending, plea question, months
served on-screen, record following into applications — applyForJob needs
the hasRecentConviction refusal AND an isJailed gate, noted by review),
then P3 surfaces. Import-graph test STILL queued. Older queue: survivor
benefits, families on PCS, branch bases, HYT TIS, Ember contact-cap,
relationships.ts separation split not calling noteArrearsCrossing;
enlist option label lowercase; NPC RETRAIN (deferred from P2 — the
player can reclass at reenlistment, NPCs cannot; military review wants
parity or a blessed deferral, this line is the deferral note — an NPC
low-rate reclass through retrainSpecialty is ~10 lines when wanted);
health.ts/crime.ts still write world.employment directly (route through
adjustJobPerformance's pattern when touched).

**P2 — THE VERBS — COMPLETE** (see the block below; commit pending
review at time of writing — check `git log`)
Perf pre-item: partnerOf/spouseOf's per-call graph re-sort WAS 86% of
tick time on a 150y town; sort-free min-(a,b) scan landed byte-identical
(11.4→1.2 ms/tick; commit f43df73). Friendship-loop cohort index stays
deferred by measurement (2.3%); watch-note: runHouseholds' per-person
partnerOf calls are aggregate O(P·E) — currentPartners() is the cure if
a scaled bench shows them hot. PERFORMANCE_BASELINE.md regenerated at
SIMULATION_VERSION 24 (old doc was M3-era; per-seed populations differ
by deliberate version drift, reproduced exactly across runs).
FOURTEEN VERBS in player.ts, all the applyForJob shape (guard → honest
bar → log-before-roll → shared function, own-choice first factor):
courtFriend/propose (courtshipBar/proposalBar in relationships.ts speak
couldCourt/considerMarriage's own gates; clearing the bar IS the yes —
the appetite roll is NPC timing, not consent), endCourtship (the
schema's dormant 'courtship-ended' finally emitted; tie demoted to
friend just above the lapse line), walkOut (performSeparation,
own-choice, no invented drift), tendTheMarriage (+60, 3mo cooldown, vs
reconcile's brink +160), spendTimeWith (+40, one social call/mo),
tryForChild (birthBar words birthEligible's gates; conception rolls
monthlyConceptionChance — conceptionBase EXTRACTED from runBirths
byte-identically, verb salt 3333 — latent infertility stays hidden:
"Not this month." is all anyone is owed), quitJob (performQuit),
askForRaise (annualReview's own formula, roll vs performance, salt
6111, 6mo cooldown, turned-down detail 'a raise'), requestEnrolment
(18-24, the NPC window, closed-forever fork finally reopened),
chooseSpendStance (Household.spendStance thrifty/null/loose read by
discretionaryFor — null = the old formula exactly, NPCs always null;
DecisionType 'spending'), lookForPlace (canAfford gate, 6mo cooldown,
moveHouse), setConvalescenceStance (monthly, shares
applyConvalescenceChoice with the pending's resolution),
requestDischarge (honest refusal ALWAYS: theatre/stop-loss words,
months-left words, or points at the reenlist question). TWO NEW LIVE
PENDINGS: 'foremans-warning' (player-only, perf<240, once per job
spell via log-since-startedAtTick, 'warned-at-work' event at raise,
knuckle-down +80 / shrug; the dismissal model beneath is untouched)
and 'retrain' (follow-up after reenlist 'stay': keep or cross to a
same-branch specialty the schooling admits; retrainSpecialty in
service.ts). SERVICE SINGLE-WRITER FIXED (the carried P1 violation):
boostServicePerformance/assignServiceUnit/setServiceFitness/
addServiceQualification/applyBoardPromotion — player.ts no longer
writes world.service anywhere. Board stakes + Service tab now show
cutoff + 15/pass-over (the real bar); separation stakes count a
serving spouse as working. MOVE CANDIDATE LISTS: move-out/move-house/
arrears-push pendings carry every qualifying street as 'to-<placeId>'
options ('accept' stays the engine's pick — old logs replay);
resolvePending parses both; DecisionPrompt labels them with street
names (and specialty ids got titles at last). UI: ONE worker message
{type:'verb', action} for all 14; act() in useWorld; verbs on Family
(court/spend-time per friend, tend/try/leave on the marriage row,
propose/end on courting), Jobs (raise/quit + 18-24 school block),
Home (stance chips + full street list, disable state = canAfford, the
engine's own gate), Health (rest/push-on while ailing), Service
(request discharge). Two-step confirms on walk-out/end-courtship/quit.
Events: tended-marriage 💐 spent-time ☕ warned-at-work ⚠️
changed-spending 👛 + left-job detail 'quit'; EVENT_EXPLAINED_BY +=
courtship-ended→courtship, tended-marriage→marriage, changed-spending→
spending, got-raise→employment-change (annual raises have no record
and correctly answer null). Schema v18 (spendStance; V17_TO_V18 null
default), SCHEMA_VERSION 18. GOLDEN 32ed2c8d — moved by the serialized
field ONLY (proven: stripping spendStance reproduced c396b96b);
SIMULATION_VERSION stays 24. Dead duplicate moveHouse comment-block in
systems.ts removed. p2.test.ts: 19 tests — refusal honesty per verb,
tryForChild asserts the verb's roll EQUALS a prediction from its own
stream (the verb cannot beat the model), foreman once-per-spell,
'to-N' resolution, verb determinism (same seed+verbs = same hash).
Verified live in the browser (refusal notices, feed events, Why?
resolution, disabled-street states, golden badge).
THREE REVIEWS RAN (architecture, military-scope, persistence — all
findings fixed in-session): arch M1 subjectOf() in relationships.ts —
promoteToCourting/promoteToSpouse/performSeparation (+ reconcile/tend)
now credit the CHOOSER, never the partner's file (event+record subjects
aligned; other-side story prose covers both timelines); arch M2
tryForChild guards the same-tick had-child (double-delivered the SAME
child via re-keyed streams) and checks deliverChild's null; military M1
ServiceRecord += priorSpecialtyIds + specialtyChangedAtTick (folded
into schema v18) — veteranUnlocks UNIONS every trade served, retrain
names the old trade in rejected; military S2 retrain school modelled:
deployment + volunteer + requestSchool gate on isPipelineTrained
(specialtyChangedAtTick + schoolMonths), completed-training fires when
it lands; military S5→SIMULATION_VERSION 25: the STRAIN MODEL counts a
uniform as work (hasWork in relationships.ts, reads world.service
directly — importing isServing would close the relationships→service→
player→relationships loop); courtship-end lands BELOW the re-court bar
(cap COURTSHIP_MIN_STRENGTH−60); lookForPlace/chooseSpendStance refuse
under a parent's roof; enrolmentBar exported (verb + UI read ONE gate);
moveHouse records cheaper-rent (not negative better-neighbourhood) on
downhill moves; spending decision on Stream.Economy; askForRaise's
topped-out gate precedes the log (no burned cooldown); began-training→
'training' Why? mapping; applyBoardPromotion bails on null instead of
lying; DETERMINISM.md §7 now states the convention (SIMULATION_VERSION
tracks the UNPLAYED world; player-path changes ride the schema).
Persistence should-fix: save.test round-trips a non-null stance and
asserts migrated households get null. ACCEPTED CORNERS (documented):
got-raise's Why? can first-match a same-tick quit/hire record (the C1
hire+jail class); requestDischarge's shape always returns
discharged:false today; try-for-child gives a played couple a second
monthly roll (deliberate, commented); NPC retrain deferred (queue).
GOLDEN 843c23ba (three movements: spendStance shape → 32ed2c8d proven
by field-strip; then v25 behaviour + service fields). 312 tests.
Owner wording fix landed mid-milestone: "Volunteer for deployment"
(rotation = the queued peacetime posting, M-ARMY2 item 1).

**P1 — COMPLETE** (the record reads back; SIMULATION_VERSION 24, golden
c396b96b, NO schema change)
WHY? MAPPINGS (records.ts): enlisted/discharged/reenlisted→enlistment,
deployed/wounded-in-action/kept-heads-down→deployment, started-school→
employment-change (the fork RECORDS employment-change — mapping follows
data; NPC compulsory schooling rightly unexplained), convalesced→
convalescence, declined-board→promotion, reconciled→separation. FOUR
INVISIBLE CHOICES got feed events: 'convalesced' (rest|push-on 🛌),
'declined-board' 📋, 'kept-heads-down' ⛑️, 'reconciled' 💞 (subject
derived safely for future NPC callers). FATHER SEES HIS CHILD:
deliverChild emits had-child for BOTH parents (the one NPC-visible
change; golden moved for it alone). STAKES SPEAK THE MODEL: education
(real pay bands from OCCUPATIONS + exported COLLEGE/TRADE_YEARS),
courtship/marriage (compatibility in WORDS + earners), child (net
recomputed WITH the child at the household's own spend habit — review
S2: lifestyle absorbs most of the cost, the naive subtraction lied),
separation (names the modelled strains), convalesce (severity in words,
honest mark risk), specialty (unlocks by name). LEDGER RECONCILES: Home
tab shows lifestyle + net; chip and rows agree to the cent. NO SILENT
LOSS: raisePending returns landed; convalesce's asked-bit and reenlist's
term-zero only burn when landed (retry next month); combat-moment
already fell through to the auto path. REVIEW (must-fix M1, fixed): the
board question could fire the same tick as an automatic junior promotion
— stale TIG opened the next board at 0 months in grade, the pass answer's
Why? read the promotion's record, and put-in died silently; the board now
never asks on a promotion month. Accepted corners: reenlist-retry month
inflates term average ~2% (stop-loss precedent, commented); replay-from-
log is a design property, not a code path (verified — player.log is
serialization + dedupe only). KNOWN-OPEN for P2 (from review): player.ts
writes world.service directly in tab verbs (pre-existing); board stakes
show base cutoff not +15/pass-over bar; separation stakes say "no work"
for a serving spouse (model flaw made visible); decisionForEvent is
O(events×records) per story render. p1.test.ts: father on both timelines
(600t), enlisted/deployed Why? resolution (900t), landed-flag.

**D2 — COMPLETE** (the town must live; same session as the pivot)
Partner-seeking (seekingIntent derived per tick — no stored state;
recovery 18mo off former-spouse edges; age curve peaks 26-33), MEETING
moments (holdSocials, Stream.Relationships salt 505, 'was-introduced'
events with venue flavor, 💫), courtship TENDED (+9/mo — the decay trap
was why nobody married before 38), marriage appetite grows with courtship
+ family window, FAMILY PLANS: 1-5 hoped children (mean 2.45) decided AND
RECORDED at the wedding ('family' decision, aspiration on the spouse
edge, schema v17 with null migration — founders/old saves decide via
settleFamilyPlans on first tick), births read the PLAN (365 under, 12
complete, 60 courting; age penalty 36+; arrears halves; deep arrears cuts
the plan once, recorded via stopFamilyEarly — relationships stays single
writer), LATENT FERTILITY per woman (5.5% never, 6.5% slow ÷7, constant-
keyed stream 424242), married-with-parents conceive (the still-at-home
check sterilized every couple that merged into a parental household),
newlyweds cohabit fast (+320), MAX_AGE_GAP 16. REVIEWED (2 must-fix: the
married-in-parental-home move-out/move-in OSCILLATION — solo move-out now
refuses while the partner shares the roof; ADR-0019 amended to bless
latent per-woman fecundity as circumstance + 'the children never came'
recorded at window close. 7 should-fix incl. partner-map perf for
holdSocials, first-marriage-only median instrument, MAX_FRIENDS+2 cap on
meeting edges, elderly couples decide no plan, childless couples never
'give up' via hardship cut). MEASURED RESULT: pop 99→124/186/132 growing
on 3 seeds × 150y, fertility 2.02-2.46 (mean 2.28), childless 3-18%
(mean ~9% — per-seed spread is binomial noise at n≈100, documented),
medFIRSTMarriage 21-22, remarriage normal, maxLeftHome=1. Eight tuning
iterations, all in DEMOGRAPHICS_AUDIT.md §D2-SHIPPED. SIMULATION_VERSION
23, golden 55e49d20, schema v17. depth twin-world test recast to SCOUT
the earliest founding-mother birth (latent fertility can cast an
infertile wife; hard-expects both twins). vitest timeouts 60s→300s (third
timeouts-not-drift lesson; profile partnerOf's per-call graph re-sort
FIRST per review before assuming the friendship loop). d2.test.ts holds
the bands permanently (12345 full bands + 777 collapse guard).

### Superseded — the old D2 next-up (kept for context)

### Old next up — D2, THE TOWN MUST LIVE (first milestone of the 2026-08-01 pivot)

**THE PIVOT (ADR-0018/0019/0020, owner direction 2026-08-01):** new
simulation institutions are PAUSED. Three arcs, in order: **D** (demographic
repair), **P** (player agency: P1 explanations → P2 verbs → P3 surfaces;
C2 folds into this arc), **W** (world presets: W1 WorldSpec extraction →
W2 American Heartland real-world preset → W3 place depth). The three
governing docs are `docs/DEMOGRAPHICS_AUDIT.md`,
`docs/PLAYER_EXPERIENCE_AUDIT.md`, `docs/WORLD_MODES_PLAN.md` — each is
short and IS the spec, with file:line receipts. D before P2 because
relationship verbs need a partnering pipeline that actually flows.

**D1 — COMPLETE** (this pivot's measurement layer, same session as the
audits): `packages/engine/src/demographics.ts` (yearlyDemographics /
partneringFunnel / fertilityCohort / populationAt, all read-side, golden
untouched), demographics.test.ts (rows reconcile births−deaths=Δpop
exactly; funnel partitions; measuring changes no byte), 📊 panel on the
observer dashboard. THE MEASURED TRUTH: living pop ~100 → 18-41 in 150y
on 3 seeds; completed fertility 1.29-1.67 (need ~2.1); 33-46% of completed
women childless; courtships 1-2/DECADE; median marriage 38-44; remarriage
~absent. Mortality is fine. The owner's "reaches ~190" was
world.people.size — the dead included. (First-draft cohort instrument
counted founder women whose children predate the record — review caught
it; the numbers here are from the corrected instrument, and a 240-tick
regression test keeps founders out of the cohort.)

**D2 spec (DEMOGRAPHICS_AUDIT.md §D2):** partner-seeking intent with
modelled MEETING moments; family-intent marriage timing; family-size
aspiration decided AND recorded at marriage; remarriage after modelled
recovery; verify cohabitation lag. NO artificial birth multipliers
(ADR-0019 forbids). Tune against D1 targets: completed fertility 2.1-2.6,
childless 10-20%, median first marriage 22-27, stable-to-growing pop,
150y × 3 seeds. SIMULATION_VERSION bump + golden + twin-world tests +
architecture-reviewer (relationship graph is core state). Recreate the
audit-runner pattern (a temp test writing a report file — deleted after
use) for the tuning loop.

Still queued from C1 review (small, do inside D2 or before): DOMAIN_MAP §4
Rule 4 import-graph test — the engine graph has function-level cycles (two
predate C1); dissolve with a command seam or bless via ADR, then enforce.
Older notes: survivor benefits, families on PCS, branch bases, HYT TIS,
Ember contact-cap, relationships.ts separation split not calling
noteArrearsCrossing.

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
