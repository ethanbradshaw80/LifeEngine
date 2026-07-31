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

**Milestone 0 — COMPLETE** (commit `0620632`)

Monorepo: `packages/shared` (branded primitives, integer money),
`packages/engine` (pure simulation), `apps/web` (React + Vite).
TypeScript strict. 16 tests pass. Build works. Page renders.

Engine purity is enforced twice, independently:
1. `packages/engine/tsconfig.json` declares no `"types"`, so importing
   `node:fs` or touching `document` from engine source is a compile error.
2. `packages/engine/test/purity.test.ts` scans source for forbidden imports
   and every banned construct in `docs/DETERMINISM.md` §5.

**Milestone 1 — IN PROGRESS**

Done so far:
- `packages/engine/src/rng.ts` — seeded RNG, derived streams, integer-only

Remaining (see `docs/MILESTONE_PLAN.md` for the binding scope list):
- Clock (monthly ticks ↔ calendar dates)
- Entity ID allocator
- Domain types: Person, Place, Household, Event, CausalRecord, World
- Name generation and world generation (~100 people, one town)
- Tick systems: education, employment, friendship, household, birth, death
- Life-story rendering — a person's life as readable prose
- Snapshot (serializable world state, with `userId: "local"` in the header)
- Determinism tests: golden seed, double-run, cross-process, cross-environment

### Next up

Continue Milestone 1 at the clock and domain types, then world generation.

**Exit criteria:** run seed 12345 twice and get byte-identical output; print a
person's life story and it reads as a coherent, plausible life; all tests pass.

**Binding out-of-scope for M1** — do not build these, changing this list needs
an ADR: marriage/divorce, relationship depth, businesses as entities, economy,
health beyond alive/dead, government, military, crime, media, weather,
inheritance, multiple towns, simulation tiers beyond Deep, save/load, causal
compression.

---

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

- **GitHub:** no remote configured; nothing has been pushed. `gh` CLI is not
  installed. Needs him to choose public vs private and authenticate.
- **Git identity is repo-local only.** Global is still unset.
