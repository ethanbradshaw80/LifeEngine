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

**STATE:** clean tree, everything pushed.
SIMULATION_VERSION **50** · Classic golden **e3061487** · Heartland golden
**1bb337ad** · SCHEMA_VERSION **26** · **541 tests**, all green.

**THE MILITARY MODULE IS FINISHED.** Everything the owner asked for is
built, reviewed and pushed. What follows is the record of it; the queue for
new work is below that.

### What landed, and the one design call behind each

- **The combat plan, all five steps** (`docs/MILITARY_COMBAT_PLAN.md`).
  Service sub-tabs, Drop a Packet, the three-option scene system, the shared
  unit cutscenes, the per-unit mission scenes.
  - THE CALL: unit moments are NOT combat scenes. They have their own
    pending kind, `'unit-moment'`, and never route through
    `resolveMomentCasualty` — that is the enemy-contact resolver, and a ramp
    ceremony is not enemy contact.
  - Selection stopped being a silent coin flip: it is played, and the answer
    moves the odds off the same stream and the same margin as before.
- **The awards pack in full** (ADR-0024). Real decoration names, tiered
  valour, combat badge by trade, seven new grants.
  - THE CALL: the top valour tier is **the Distinguished Service Cross**,
    not the Medal of Honor — the owner's own change.
- **Capture and the Prisoner of War Medal** (ADR-0025). The third thing a
  bad month can end in. A captive's tour stops running on the calendar; the
  medal grants at capture, so the man who dies held earns it too.
  - MEASURED AND RETUNED: the first numbers ran 33% home / 67% dead, median
    31 months. Now ~75% home, ~25% dead, median 15 months.
- **Aviation and the Air Medal** (ADR-0026). Two flying trades, Flight
  School, the Nighthawk Squadron. The awards pack's HOLD list is now empty,
  and the earnability test asserts it in both directions.
- **The ribbon rack and a drawn mark for every badge**
  (`apps/web/src/BadgeMark.tsx`).
  - THE CALL: none of the ribbon colours or badge marks reproduces real
    insignia. A branch may be NAMED; its insignia may not be drawn
    (charter §3). The marks are invented shapes built from the plain object
    each badge is about.
- **Senior Parachutist**, and the field it needed: `unitSinceTick` on the
  service record. Months in the UNIT is not months enlisted. Null means
  unknown, so a migrated record's clock starts where the knowledge starts.

### Reviews

Every military change went through `military-scope-reviewer`, which is
mandatory. Across this window it produced **sixteen must-fixes**, all fixed
in-session. The recurring shapes, worth knowing before writing more:

1. **A cutscene must not assert a fact the world has not produced.** Losing
   one of the team shipped as a scripted casualty — nobody had died. It
   waits on a real death now.
2. **A player-log dedupe must be SCOPED.** The log is never cleared on
   succession, so an unscoped "has this played" check silently denied every
   heir for the rest of the save.
3. **A new event must be made VISIBLE** — `story.ts` case,
   `EVENT_EXPLAINED_BY` entry, and an icon — or it is written to the ledger
   and appears nowhere in the game.
4. **A follow-up pending must be raised AFTER `commit()`** in
   `resolvePending`, or `raisePending` silently refuses it. This has shipped
   broken three times.
5. **A system that runs for the serving must ask whether they are a
   prisoner.** The schoolhouse did not, and pinned medals on a man in a cell.

### THE QUEUE — what is NOT built

Nothing military is outstanding. The next work is whatever the owner asks
for. If he asks for "more of the same", these are the honest candidates,
in the order that would pay off:

1. **The player-agency gaps the reviewers logged as out-of-scope.**
   Relationship, finance and convalescence questions still reach a deployed
   person — a prisoner can be asked to rest or push on from a cell.
2. **`termPerformanceSum` accrues while held**, so months in a cell feed the
   term average that later grants Good Conduct.
3. **A veteran's second act.** Discharge is modelled; the years after it are
   thin — pension, disability, the civilian career the trade unlocked.
4. **Performance:** `unitOptionsFor` scans `world.events` linearly per unit
   per month for the player. Not hot yet; measure before touching it.

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
