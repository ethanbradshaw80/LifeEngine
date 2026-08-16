# Resume Here

> **RELEASED 2026-08-10** — live at https://causagames.itch.io/the-life-simulator (build 4e2a5cf, SIMULATION_VERSION 157, American Heartland only). First two days: 292 views, 102 browser plays, 4 collections.

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
  `LIFE_ENGINE_BOOTSTRAP.md`. All 31 ADRs are Accepted or superseded; nothing is pending.

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

**It genuinely passes now (2026-08-16), and had not for a long time.** The
engine's TEST tsconfig carried 98 errors — tests are type-checked by a
stricter project than vitest runs, so they went green while never compiling.
Two of them were real bugs, not noise:

- `createWorld({ seed: 909, townSize: 'small' })` in three files passed an
  OBJECT where the seed goes. It coerces to 0 in the bitwise hashing, so every
  one of those tests built the *same* world whatever number was written on it.
  Fixed to real seeds; all 26 still pass.
- `schoolhouse.test.ts` recorded an event of type `'article15'`, which is a
  PENDING kind and not an event type at all. `flagStatus` reads `disciplined`,
  so the flag never landed, the schools never closed, and the test's own
  escape hatch (`if (open.length > 0) return`) made it pass while proving
  nothing.

The rest were branded-type slips — raw `number` where `EntityId`/`Tick` is
wanted, and `personId ?? 0` widening the brand to `0 | EntityId`.

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

## START HERE (handoff, end of 2026-08-06)

**STATE:** clean tree, everything pushed.
SIMULATION_VERSION **107** · SCHEMA_VERSION **44** · Classic golden
**2b2aef13** · Heartland golden **f135a4b7** · **958 tests** across 84
files, all green in one clean run. Full suite ~15 minutes.

**THE SUITE GOT SLOWER AND THE TIMEOUT WAS RAISED TO MATCH.** 890 tests at
~450s became 958 at ~890s. The long sweeps — two centuries of war, a
forty-year capture study — legitimately exceed five minutes when sixteen
workers compete, so they passed alone and failed in the suite. That is a
false negative, not a slow test; `testTimeout` is 900s now. A genuinely
hung test still fails, just later. **Worth a real optimisation pass**: the
quadratic partnering loop and the per-person whole-ledger scans are the
known offenders, and `stats.test.ts` alone dropped from three grown worlds
to one by sharing a read-only fixture.

### THE ONE HABIT THAT FOUND THE MOST BUGS

**Measure the distribution before picking a threshold.** Six numbers were
set by reasoning in one session and every single one was wrong, each caught
only by measuring afterwards:

| the number | what it was | what it did |
|---|---|---|
| school `minFitness` | 380–540 | fitness caps at **300** — unreachable |
| school `minAptitude` | 560–640 | aptitude is a percentile, **1–99** |
| fitness-failure bar | flat 128 | above the army's median — flagged 15 of 17 |
| the same bar, by age | one number for all | flagged 9 of 31, every one 33+ |
| wellbeing drift | a twelfth | erased all memory; 90% read "about 60" |
| Looks weights | vs 0–300 | capped at 539/1000 — top half of the dial dead |

Two of these were hiding each other: the school gates were never enforced,
which is the only reason impossible numbers did not shut the schoolhouse.

**The corollary: a stat must be checkable, not just correct.** The stats
tests assert every stat REACHES above 600 and SPREADS more than 250, rather
than asserting a particular value. A stat nobody can score well on is as
useless as one everybody scores the same on.

**THE TICK IS THREE TIMES ITS BUDGET, AND THAT IS THE REAL PROBLEM.**
Profiled at twenty years, 400 people:

| system | ms/tick |
|---|---|
| **finances** | **~79** |
| crime | 6.1 (was 23.7) |
| relationships | 5.3 |
| health | 3.8 |
| wellbeing | 3.7 |
| everything else | < 2 each |

Whole tick ~56ms at 400 people against `PERFORMANCE_BASELINE.md`'s 22ms at
1,000 — accumulated over months of per-person monthly work, not one change.
At that speed the full suite sits on its timeout and tips into DYING
WORKERS depending on the machine's mood: the same tree gave 822s green and
then 3,002s with ten failures, every one of which passed in isolation.

**`runFinances` is the whole budget and wants a proper pass.** Note that
instrumenting it from inside is not possible — `performance` is not
available in the engine (purity rule, working as intended), so the timing
has to come from the test side or from exported sub-functions.

**AND NEVER FILTER `world.events` INSIDE A PER-PERSON LOOP.** That is now
three separate instances — ADR-0039, `runWellbeing`, and `disciplineOf`,
which cost crime 3.9x. Events are appended in tick order: walk backwards
from the end until the window closes.

**RUN ONE SUITE AT A TIME — AND STOP THE DEV SERVER FIRST.** Two concurrent
runs starve each other, and so does a running Vite server: a suite that
normally takes ~450s took **1,429s** with `npm run dev` alive beside it, and
ten tests failed that pass clean. A starved vitest run reports its in-flight
files as FAIL **with no assertion text**. The tell: failures cluster in the
slowest files and the reason line is missing. **If there is no
AssertionError, suspect the process.**

But do not dismiss a whole batch on that heuristic — check each one. The
1,429s run mixed ten starved failures with **two real ones**, and in the
summary they look identical.

**RE-PIN GOLDENS AFTER THE VERSION BUMP, NEVER BEFORE.** `SIMULATION_VERSION`
is part of the state hash. Measuring a hash, then bumping the version, then
pinning the measured value writes a number that was stale before it was
written. Order: bump → measure → pin → verify.

**RUN ONE SUITE AT A TIME.** Two concurrent runs on this box starve each
other, and a killed or starved vitest run reports its in-flight files as
FAIL with no assertion text. That cost real time twice in one session,
including an hour spent suspecting the engine of non-determinism it does
not have. The tell: failures cluster in the slowest files and the reason
line is missing. If there is no AssertionError, suspect the process.

**THE MILITARY MODULE, THE ECONOMY, THE SAFETY NET AND CIVILIAN CAREERS ARE
ALL FINISHED.** What follows is the record of the last four arcs; the queue
for new work is below that.

### What landed since 2026-08-02, and the one design call behind each

- **M-ECON — money belongs to people, the economy is weather** (ADR-0027).
  A market with cycles, credit and debt, mortgages, financial shocks, a Bank
  tab.
  - THE CALL: the economy is not a difficulty setting. It moves on its own
    and the player rides it.
- **M-SAFETY — bankruptcy, homelessness and three floors** (ADR-0028).
  Means tests, repayment plans, unemployment insurance, assistance, a state
  pension.
  - THE CALL: this **supersedes the Law-7 arrears write-off**, with the
    owner's explicit authorization. Failure creates a chapter; it no longer
    creates a miracle.
  - MEASURED: arrears ran $606,276 across a long save. Four separate fixes
    later it is $25,344.
- **M-CAREER — civilian work brought up to the military's depth** (ADR-0029).
  Nine tracks, twenty-nine rungs, annual reviews, ten work moments,
  interviews, five kinds of business, a Career tab.
  - MEASURED AND RETUNED: business survival was 93 per cent, which no small
    trade has ever had. It is 58 per cent now.
- **Pay repriced against real wage data**, twice. The first pass did only
  civilian jobs, which made things WORSE — an E-8 earned less than a shop
  clerk until the owner caught it. Then calibrated to the 1970 start year,
  so in-game 2025 salaries land within a few percent of real medians.
- **Capture was unreachable, not rare.** The POW medal existed and nobody
  had ever earned it. Now reachable in 5 of 12 test worlds.
- **M-MONEY2 — a household is a building, not a purse** (ADR-0030). Money
  belongs to a financial unit: you, your partner, and dependants — where
  dependency is about INCOME, not age.
- **The stats panel**, all six phases of the owner's `player_stats_spec.md`.
  Wellbeing is the one new STORED stat and it has memory — a life that went
  badly reads differently from an identical life that did not, which is the
  whole argument for storing rather than deriving it. The body moved off the
  service record onto the PERSON, from age twelve, civilians included: a
  teenager who trains enlists fitter. Health, Looks, Smarts and Discipline
  are derived. Activities are HABITS with trajectories — training climbs a
  body 149→211 over two years, plateaus, and falls back to 150 three years
  after it is dropped. Nothing moves the month you press it.
  - THE CALL: fitness stays on 0–300 while every other stat is 0–1000,
    because 0–300 IS the promotion-points scale. Rescaling would have
    rebalanced the entire military ladder as a side effect of building a
    panel. The display divides by three.
  - NOT WIRED, deliberately: romance (looks + wellbeing driving partnering)
    and health (chronic low wellbeing dragging health). They are the two
    most likely to move demographics, and phase 6 was already three systems.
  - MEASURED AND HONEST: phase 6's interconnections touch 71 of 277 adults
    and do **not** move town-level crime or misconduct rates. The loop
    closes for people in trouble and does nothing for anyone else. Do not
    claim more for it than that without a number.
- **A mortgage is not bankruptcy** (owner, playing). Insolvency compared
  TOTAL DEBT against six months of income, so signing a mortgage declared
  you insolvent the same month, every time. It reads distress now — missed
  payments count, principal does not — and filing is the player's own
  choice with a twelve-month cooling-off.
  - FOUND WHILE MEASURING: **no NPC in this game has ever owned a home.**
    `buyHome` is called from one place, the player's verb. That is why the
    bug survived every test. The owner has a real-estate module planned;
    leave it alone until then.
- **A bankruptcy you can see and pay off** (ADR-0038), owner-reported. A
  chapter 13 plan was **entirely invisible** — no screen said what the
  payment was or how long it ran — and there was no early payoff. Both
  fixed: a Bank card and a `payOffPlan` verb. Found a real bug while
  building it: the discharge figure used a flat 36 months for every plan
  when plans run 36–60, so a long plan reported a bigger write-off than
  happened. Moved both goldens, which proves NPC filings carried it too.
- **The Article 15** (ADR-0037), from the owner's spec. Nonjudicial
  punishment is a paper you sign, and a civilian conviction with no
  confinement now reaches a serving member. Court-martial fork deliberately
  not built.
- **The phantom household member** (ADR-0036), found by a new invariant
  sweep: `runHouseholds` iterated a snapshot of people while moving them.
  Rent splits, household income, the financial unit and the estate all
  counted a list that could name somebody who had left.
- **A house can be bought with money** (ADR-0035) and **a job offer is an
  offer** (ADR-0034), both owner-reported while playing.
- **The twelve-year wall** (ADR-0032). Indefinite or out at twelve years,
  and indefinite wants SGT. No more career corporals.
- **A conviction reaches the hiring desk** (ADR-0033), and an heir gets
  their own life — `hasAnswered` was unscoped, so an heir inherited every
  once-in-a-life flag their parent set and was never asked the fork at
  eighteen at all. **That is the fourth bug from an unscoped read of the
  player log.** See failure shape 2.
- **M-ENLIST — the recruiting station** (ADR-0031). All five phases. The
  pipeline, 22 trades with real job codes, 26 officer roles, three accession
  models, trade-tagged scenes, two written officer moments, the recruiter's
  wall.

### Recurring failure shapes, worth knowing before writing more

These have each cost real time more than once:

0. **A number invented without measuring its distribution is wrong.** Six
   for six in one session — see the table at the top. Before choosing any
   threshold, print the range the engine actually produces. Two of the six
   were sitting above the achievable maximum of the thing they gated.

0b. **TWO PARALLEL TABLES INDEXED BY THE SAME VARIABLE.** `BRANCH_GRADES`
   is the ENLISTED table; indexing it with an officer's rank returned an
   E-4 for a major and the twelve-year wall threw him out as a career
   corporal — 30% of all officer careers, and nobody had ever reached
   lieutenant colonel. The tables agree for the first five rungs, which is
   why it read as correct and no test caught it. Fixed with one accessor,
   `gradeOf`, that cannot be called wrongly. **The same bug then turned up
   in two TESTS** that were reading the tables by hand.

1. **A follow-up pending must be raised AFTER `commit()`** in
   `resolvePending`, or `raisePending` silently refuses it. Hit **about
   seven times now**. The single-slot pending model is the root cause; a
   queue would make the whole class impossible and is the highest-value
   refactor on the board.
2. **A read of `world.player.log` must be SCOPED — by person, by tick, or
   both.** The log is never cleared on succession because it is the
   dynasty's record, so any "has this happened" question asked against it
   unscoped is really asking about the whole lineage. Four bugs so far.
   `PlayerChoice.personId` now exists; use it.
3. **A new event must be made VISIBLE** — `story.ts` case,
   `EVENT_EXPLAINED_BY` entry, and an icon — or it is written to the ledger
   and appears nowhere in the game.
4. **A cutscene must not assert a fact the world has not produced.**
5. **A system that runs for the serving must ask whether they are a
   prisoner.**
6. **Import cycles are caught by `imports.test.ts` and are usually avoidable
   by reading state inline** rather than importing the module that owns it.
7. **A CONTENT TABLE THAT VALIDATES CAN STILL REACH THE SCREEN EMPTY.**
   `paths.test.ts` checked all 74 career ladders — ids unique, rungs in
   order, every skill real, every ladder climbable — and passed. But the
   thing a player touches is `pathsFor(world)`, and through THAT seam the
   whole Personal Services category was sealed: stylist, trainer, masseur
   and groomer each demanded a licence on the entry rung, so the bubble
   opened on four locks and no way in. **Test the seam the screen reads,
   not only the table the seam reads from** — `pathseam.test.ts` is that
   test, and it found the flaw on its first run.
8. **CODE THAT RUNS EVERY TICK AND DOES NOTHING IS NOT TESTED CODE.**
   `runLadderClimbs` ran monthly over the whole town for an entire release
   while no NPC had a `pathId`, so its body never executed once. It was
   raising `promoted` — service.ts's event for a military RANK — where every
   civilian promotion in this codebase uses `promoted-at-work`. The day the
   town went onto the ladders it fired and six tests across three files broke
   together, reporting "warehouse lead is not a rank". This is the third
   instance of the shape (see the two probes that found code that never ran);
   the tell is a loop whose guard nothing in the world can currently satisfy.
9. **TWO CONTENT TABLES SHARING A NAMESPACE WILL SILENTLY REDEFINE EACH
   OTHER.** Nine ids are in both the town's occupation table and the career
   ladders — `teacher`, `accountant`, `sergeant`, `partner` and five more.
   Concatenating `[...OCCUPATIONS, ...RUNGS]` let the later entry win, which
   repriced nine of the town's own wages without a word (a law partner moved
   from $1,458-2,396 to $3,300-4,033) and claimed plain schoolteachers for a
   ladder at rung 2. Found by a test, not by reading. `occupationtables.test.ts`
   now holds both halves.

### WHERE IT ACTUALLY IS (2026-08-14, SIMULATION_VERSION 174, SCHEMA_VERSION 75)

The queue below was assessed on 2026-08-04 and predates the housing revamp
and the whole business module. What has shipped since:

- **Housing** (v163/v164): buying outright, the portfolio, renting out, and
  the H0 wallet repair that killed six money-duplication paths.
- **The business module** (v168-v174), built from the owner's thirteen design
  files: era-gated trades, the cap table with real townsfolk as angels,
  player-controlled hiring, the operations loop (stock, vendors, price, the
  draw dial), the growth ladder to a 25x ceiling, selling and winding down,
  the IPO gate at $10M inside eight years, and **takeovers** — a stake
  readout, a blocking stake at 25%, control past 50%, a premium that makes
  the last tenth hurt, and an NPC who can come for what the player floated.
- **Business lives in its own tab**, per the owner's mockups. The panels that
  were wrongly built inside Career are gone.
- **Jobs & Careers, from his four files** (2026-08-14/15). Eighteen skills on
  every person in thousandths, growth that slows by level so mastery takes a
  career; thirteen licences that money and months can buy and no amount of
  skill can substitute for; **74 ladders and 310 rungs** across his fifteen
  categories, salaries deflated by 5 into 1970 money; and his `jobs-ui.html`
  built against the engine, so every refusal on the screen is the same
  function the verb calls. See `docs/JOBS_REVAMP_SPEC.md`.
  - THE CALL that saved the content pass: **a ladder is made climbable at
    load, not in the data.** A validator found all fifteen first-slice paths
    were dead ends — 74 gates demanding skills nothing below them taught, not
    one visible by eye. `climbable()` teaches, at a trickle, whatever the
    rung above demands. The remaining 59 ladders were then covered by
    construction rather than by remembering.
  - **AND THE TOWN IS ON THEM** (2026-08-15, SIMULATION_VERSION 180). One in
    six new hires starts a ladder, is taught by the work and climbs by the
    player's own gates. `runLadderClimbs` and `runSkillGrowth` had existed and
    run over the whole town for a release doing NOTHING, because no NPC ever
    had a `pathId` — the single blocker was that a rung was not an occupation,
    so `considerBetterJob` priced it at zero, read every job in town as a
    raise, and would have pulled anyone off a ladder within a year.
  - MEASURED, twice, because the first attempt was reverted: the share is one
    in six, not two in five, which collapsed the town to 45 people against a
    band of 59+. And a degree still points somewhere — the fix was giving a
    RUNG `preferredMajors` so a nursing degree pointing at the healthcare
    ladder counts, not the guard that kept graduates off ladders entirely.
  - **THE LADDERS WERE LEAKING FROM THE MIDDLE** (v181). Over forty years
    FIFTY townspeople started a path and only TEN were still on one. Fourteen
    had retired; sixteen were poached into exactly two jobs — `sergeant` and
    `constable` — because those pay more than a third rung and a climber's
    standing let them in. `considerBetterJob` compared the offer against what
    somebody HOLDS; for a person on a ladder it now compares against the rung
    they are climbing TOWARDS, which is what they are actually giving up.
    Measured after: 10% of the employed on ladders → **19%**, distinct ladders
    in use 7 → **12**, highest rung reached 4 → **5**. Intake untouched, so
    the population band never moved.
  - **AND THE TOWN CAN SIT FOR ITS PAPERS** (v181). Twelve of the 74 ladders
    ask for a licence on the FIRST rung — lorry, salon, cockpit, fire station,
    trading floor — and nothing let an NPC get one, so those trades were
    player-only by omission. The same wall stood mid-climb: anybody reaching a
    rung wanting a certificate stopped there for life. `earnLicence` in
    finances.ts is now the one road both the player's verb and the town take.

**The recurring failure shape this module added to the list:** a test that
hand-rolls the same arithmetic as the code it is testing will pass beside the
bug. `costToReachPerMille` priced a whole company at a HUNDREDTH of its worth
and the test agreed with it, because both divided by 10,000 where cents needs
100. A five-line probe printing real numbers caught it in one run. **Print the
figures and look at them; do not only assert relations between them.**

### THE QUEUE

**The owner's standing preference is that he writes the design doc.** It
worked for the combat plan, the awards pack, the career overhaul and the
enlistment rework — his specs make the calls that would otherwise be
guessed. If a doc has not arrived, ask rather than inventing scope.

Assessed 2026-08-04, in rough order of value:

1. **A veteran's second act.** Discharge is modelled; the years after it are
   thin — pension, disability, the civilian career the trade unlocked.
   Now that civilian careers are deep, this is a much better payoff than it
   was.
2. **Authored content, not systems.** ~19 combat scenes, 10 work moments, 32
   crime scenes. For eighty years across generations, a player sees repeats
   fast. Systems make content possible; they are not content.
3. **The pending queue** (see failure shape 1).
4. **Ordinary life is thinner than the uniform.** A player who never enlists
   is playing a much smaller game. Relationships, parenting and the middle
   years deserve what the military got.
5. **C3 — crime and justice**, scoped in `docs/CRIME_PLAN.md`: sentencing
   variety, probation, the constable as an occupation, town crime pressure
   as a force, record-fade, the victim's side. Violent crime against the
   player, organized crime, civil disputes and juvenile justice are
   deliberately deferred beyond C3.
6. **Test runtime.** ~400 seconds clean and climbing; the invariant sweep
   alone is 145 of them. Worth splitting into a fast tier (every change)
   and a slow tier (sweeps, wars, goldens — before commits only) before it
   stops being run at all. Long tests now carry explicit timeouts and build
   their fixtures in `beforeAll`, so a slow machine no longer reports a
   timeout as an assertion failure.

### Still open, and honest about it

1. **Performance:** `unitOptionsFor` scans `world.events` linearly per unit
   per month for the player. Not hot yet; measure before touching it.
2. **`player.ts` is 4,191 lines.** It is the biggest module by a wide margin
   and it is where the pending trap lives.
3. **`combatWeight`'s effect on how often a moment fires has not been
   measured in a long war** — only verified arithmetically and by tests.
4. **Nobody has played the newest surfaces at length.** The recruiter's
   wall, the Career tab and the Bank are built, typechecked and tested, but
   only the owner can say whether they read right on his screen.

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
