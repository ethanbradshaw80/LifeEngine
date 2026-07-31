# Architecture Proposal

**Status: ACCEPTED 2026-07-30.** Approved by the owner. This is the architecture.
**Revision 2 — 2026-07-30.** Supersedes revision 1 (Windows desktop / C#).
**Supersedes:** the iOS / Swift / SwiftUI assumption in `LIFE_ENGINE_BOOTSTRAP.md`.

---

## 0. Direction

The Life Engine is a **web application**. It will eventually support multiple users,
each with their own account and their own save files.

The simulation engine remains strictly separate from the frontend so it stays
deterministic and testable — this is the one principle that has survived every
direction change, and it is the reason those changes were cheap.

**Confirmed by the owner:**

| | |
|---|---|
| Platform | Web application |
| Language | TypeScript, end to end |
| Simulation runs | In the browser; engine written to run server-side unchanged |
| Multi-user | Architecturally ready from day one; shipped later |

---

## 1. History of this document

Two prior directions, both now void. Recorded because the *reason* the changes were
cheap is itself an architectural finding.

| Rev | Platform | Language | Why it changed |
|---|---|---|---|
| 0 | iOS | Swift | No Mac available; Apple tooling is macOS-only |
| 1 | Windows desktop | C# | Owner chose a web application |
| **2** | **Web** | **TypeScript** | **Current** |

Across all three, the engine's independence from any presentation framework held. That
is the whole payoff of ADR-0003: two total platform reversals cost documentation edits
and zero code, because no code was written that assumed a platform. Preserve this
property — it is worth more than any individual technology choice below.

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | Deterministic — same seed and version ⇒ same result | No unseeded RNG, no wall-clock reads, no unordered iteration |
| C2 | Engine testable with no UI | Engine is its own package with zero DOM or framework imports |
| C3 | Runs in a browser | Memory and CPU are the *player's*, and are more limited than a desktop's |
| C4 | Engine must run server-side unchanged later | No browser-only APIs in engine code — no `window`, `document`, `localStorage` |
| C5 | Multi-user eventually | Every save carries a user ID from the first save ever written |
| C6 | Causal records for major outcomes | Event log is core infrastructure |
| C7 | Versioned persistence with tested migrations | Save format is a public contract |
| C8 | Solo dev, ~10 hrs/week, still learning | Favours one language, mainstream tooling, large community |

**C3 and C4 together are the interesting pair.** They mean the engine must be pure
computation: it takes state in, returns state out, and touches nothing else. No
storage, no network, no clock, no globals. That is also exactly what makes it testable
and deterministic, so the constraints reinforce rather than fight each other.

---

## 3. Options evaluated

### Option A — TypeScript monorepo: pure engine package + React frontend *(recommended)*

The engine is a plain TypeScript package importing nothing but its own code. The web
app imports the engine and renders its state. A backend is added later for accounts and
save sync.

**Strengths**

- **One language across the entire stack.** At ~10 hrs/week while learning, this is the
  single biggest practical advantage available. Everything learned about TypeScript
  applies everywhere.
- Determinism is more tractable in JS than the reputation suggests — see §5. `Map` and
  `Set` iteration order is *specified* by ECMAScript, which removes the largest
  determinism trap that C# has.
- The engine package has no framework dependency, satisfying C2 and C4 by construction.
- Enormous ecosystem and community. When stuck at 11pm, the answer exists.
- Excellent free testing tooling (Vitest) that runs the engine headlessly in Node.
- Distribution is a URL. No installer, no store approval, no signing.

**Weaknesses**

- TypeScript's types vanish at runtime. Save-file validation must be explicit — a
  schema validator, not a cast.
- All JS numbers are IEEE-754 doubles. Integer arithmetic is exact only to 2^53−1.
  Manageable, and §5 says how.
- Browser memory limits population scale more tightly than a desktop app would.

### Option B — C# backend + TypeScript frontend

Keeps the previous engine decision; ASP.NET Core serves a browser UI.

**Rejected.** Forces simulation server-side, which contradicts the browser-first
decision and puts hosting cost on every tick of every active player. Requires learning
two languages, two toolchains, and two package managers simultaneously. The performance
advantage is real but does not pay for that under C8.

### Option C — C# everywhere via Blazor WebAssembly

C# compiled to WebAssembly, preserving the engine language.

**Rejected.** Smaller community and fewer answers online — which matters most precisely
when learning. WebAssembly payloads are heavier than JavaScript on first load. The
one-language benefit is real but is available from Option A with a far larger
ecosystem.

### Option D — Rust engine compiled to WebAssembly + TypeScript frontend

Technically the strongest determinism and performance story available.

**Rejected on C8**, as in revision 1. Ownership, borrowing, and lifetimes plausibly cost
months before the first person is simulated, and this version adds the wasm-bindgen
boundary on top. Wrong trade at this time budget.

### Option E — Python backend, browser frontend

**Rejected.** Two languages, server-side simulation contradicting the browser-first
decision, and Python is too slow to support the population scale the product promises.

---

## 4. Recommended structure

```
life-engine/
├── packages/
│   ├── engine/            # Pure TypeScript. THE PRODUCT.
│   │   ├── src/
│   │   └── test/          # Runs in Node. No browser, no DOM.
│   ├── persistence/       # Save serialization, schema versions, migrations.
│   │                      # Pure — takes/returns data, performs no I/O.
│   └── shared/            # EntityId, Tick, Money, Seed. Types only.
├── apps/
│   ├── web/               # React + Vite. Imports engine. Owns all I/O.
│   └── api/               # DOES NOT EXIST YET. Milestone 6.
└── docs/
```

**The rule that makes this work:**

> `packages/engine` may import from `packages/shared` and nothing else.
> No React. No DOM. No `window`, `document`, `localStorage`, `fetch`.
> No date, no timer, no storage, no network.

The engine is a pure function of (state, seed, inputs) → new state. Everything that
touches the outside world lives in `apps/web`. This is what makes C2, C3, and C4 all
true at once, and it is enforceable by an automated test over the import graph.

**Why Vite + React rather than Next.js.** Milestones 1–5 need no server whatsoever, so
a full-stack framework would be unused complexity during exactly the period when
complexity hurts most. Next.js becomes worth reconsidering at Milestone 6, when
accounts arrive. Recorded as ADR-0011.

---

## 5. Determinism in TypeScript — the concrete rules

Belongs in `DETERMINISM.md` as enforceable rules. Summarized here because it is the
main technical objection to this stack, and it is answerable.

**What JavaScript gets right** (better than C#):

| Property | Status |
|---|---|
| `Map` and `Set` iteration order | **Specified** as insertion order by ECMAScript |
| `Array.prototype.sort` stability | **Required** to be stable since ES2019 |
| Array iteration | Index order, deterministic |
| `+ - * /` and `Math.sqrt` on doubles | IEEE-754 required — same result everywhere |

That first row matters a great deal. Unordered dictionary iteration was the number one
determinism hazard in the C# plan; in JavaScript it is specified behaviour.

**What must be controlled:**

| Hazard | Rule |
|---|---|
| `Math.random()` | Banned. All randomness through the seeded RNG service. |
| `Date.now()`, `new Date()`, `performance.now()` | Banned in the engine. Time comes only from the simulation clock. |
| `Math.sin/cos/tan/exp/log/pow` | **Banned in engine logic.** ECMAScript does *not* specify their precision — results legitimately differ across engines and versions. Use lookup tables or integer approximations if ever needed. |
| Float accumulation | Money is integer cents. Traits are integer scales. Doubles only for derived display values. |
| Integers beyond 2^53−1 | Use `BigInt` for aggregate economy figures. Personal finance in cents fits comfortably in a `Number`. |
| `for...in` | Banned — prototype chain and ordering subtleties. Use `Map` or explicit arrays. |
| Object key order in hashing | `JSON.stringify` follows insertion order. For state hashes, sort keys explicitly. |
| `toLocaleString`, `Intl` | Banned in the engine. Locale-dependent. Formatting belongs in the UI. |
| `async` / `await` in the tick | Banned. Interleaving order is not guaranteed. The tick is synchronous. |
| Spread/structured clone of `Map` | Fine — preserves order. |

Confidence note: the "specified" rows above are ECMAScript language guarantees and are
stable across engines. The `Math.sin`-family imprecision is likewise specified *as
implementation-defined*, which is exactly why it is banned. Verify against the current
spec before relying on any edge case not listed here.

---

## 6. Performance — estimates, not measurements

**No code exists. Nothing has been profiled. These are order-of-magnitude guesses.**

Milestone 1 is 100 people × 120 ticks = 12,000 person-months. Trivial in any language.

The real constraint is now **browser memory**, not CPU. A browser tab has considerably
less headroom than a desktop process, and a tab that exhausts memory is killed without
warning. This tightens the case for the tiering in `SIMULATION_LEVELS.md`: the majority
of the population must be aggregate statistics rather than objects.

TypeScript running in a modern JS engine is roughly in the same order of magnitude as
C# for this workload and far faster than Python — but that is a general expectation, not
a measurement of this code.

**Milestone 3 measures this and replaces the guesses.** Make no architectural
commitments based on this section.

### Long ticks and the UI

Simulating many years could block the browser's main thread and freeze the page. The
planned mitigation is to run the engine in a **Web Worker** — a background thread —
so the interface stays responsive. This works precisely *because* the engine is pure:
a worker cannot touch the DOM anyway.

Deferred to Milestone 4, once there is a measured problem to solve. Noted here so the
engine is not built in a way that forecloses it: **keep engine state serializable**,
since it must cross the worker boundary.

---

## 7. Persistence and the multi-user path

Deliberately staged so the expensive part is deferred until something is worth protecting.

**Now (Milestones 1–5) — no server.**
Saves go to **IndexedDB** in the player's browser. No account, no database, no hosting
bill, no security surface. `packages/persistence` produces a serializable save object;
`apps/web` writes it. The engine never touches storage.

**Later (Milestone 6+) — accounts.**
A thin API plus a database. Saves gain a user ID, sync to the server, and local storage
becomes a cache.

**The one thing that must be right now:** every save carries a `userId` field from the
very first save ever written. It is `"local"` until accounts exist. Adding auth to a
schema that already has the column is routine; retrofitting it across existing saves is
a migration nobody enjoys. This costs nothing today. Recorded as ADR-0010.

### Multi-user is not multiplayer

Each user runs an isolated world. No shared state, no synchronization, no netcode, no
authority arbitration. The "no multiplayer" non-goal in `PROJECT_CHARTER.md` §5 stands
unchanged — and it is the genuinely expensive thing this design avoids.

### When accounts arrive

Deliberately unspecified now — this is a Milestone 6 decision and the landscape moves.
Firm guidance regardless:

- **Do not write your own authentication.** Use a maintained provider or library.
  Password hashing, session handling, reset flows, and rate limiting are easy to get
  subtly and dangerously wrong.
- **Verify any provider's current pricing, status, and maintenance before committing.**
  Do not rely on this document — or on any AI's recollection — for that.
- Saves are user data. A leak is a real-world harm, not a game bug.
- Free hosting tiers exist across several providers and change constantly. Check
  current terms rather than assuming.

---

## 8. Reversibility

| Decision | Reversible? | Notes |
|---|---|---|
| Frontend framework (React) | **Easily** | Engine has no framework dependency |
| Vite → Next.js | **Easily** | Revisit at Milestone 6 |
| Sim location (browser ↔ server) | **Easily** | The point of the purity rule — same code both places |
| Adding accounts | **Easily**, if `userId` exists from day one | Painful otherwise |
| Save format | Moderately | Migration infrastructure is the mitigation |
| Language (TypeScript) | **Poorly** | A rewrite. Be confident now. |
| Determinism | **Not at all** | Retrofitting is a rewrite. Build it in from commit one. |
| Domain boundaries | Poorly | Why `DOMAIN_MAP.md` precedes Layer 2 code |

Two total platform reversals have now cost only documentation. That is not luck — it is
ADR-0003 doing its job.

---

## 9. Recommendation

**Adopt Option A.** TypeScript monorepo, pure engine package, React + Vite frontend,
simulation in the browser, IndexedDB saves, accounts deferred to Milestone 6, engine
written to run server-side unchanged.

### Required before Milestone 1

1. Install Node.js (not currently on this machine) and verify `node --version`.
2. Configure `git config --global user.name` and `user.email`.
3. ~~Owner approves this proposal and the ADRs it generated.~~ **Done — 2026-07-30.**
