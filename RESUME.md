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

## START HERE (handoff, end of 2026-08-04)

**STATE:** clean tree, everything pushed.
SIMULATION_VERSION **95** · SCHEMA_VERSION **40** · Classic golden
**967a2f7e** · Heartland golden **48030648** · **890 tests** across 77
files, all green. Full suite ~7 minutes on a quiet machine.

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
