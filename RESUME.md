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

**Milestone 3 — measure and prove.** See `docs/MILESTONE_PLAN.md`.
Replace every performance guess in the docs with real numbers: tick time at
100 / 1,000 / 10,000 people, **browser memory per person and per causal
record** (the binding constraint, not CPU), save-object growth per simulated
year. Write `docs/PERFORMANCE_BASELINE.md`, update the estimates in
`SIMULATION_LEVELS.md` §7, `CAUSAL_RECORDS.md` §5 and
`ARCHITECTURE_PROPOSAL.md` §6, and create the `performance-reviewer` agent
(ADR-0007). **Measure only — no optimizing.**

Known already: advancing 5 years blocks the main thread briefly. M4 moves the
engine to a Web Worker; do not fix it early.

After that: M4 saves + Web Worker, M5 relationships, M6 accounts.

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
