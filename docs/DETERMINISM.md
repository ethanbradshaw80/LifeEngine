# Determinism

**Law 11 is an engineering requirement, not an aspiration.**

Same starting state + same seed + same simulation version + same player decisions
⇒ **byte-identical results.**

This document is enforceable. Violations are bugs, not style preferences.

> **Why this matters more than it sounds.** Determinism is what makes every other
> guarantee testable. Without it you cannot reproduce a bug report, cannot verify that
> a refactor changed nothing, cannot trust a causal record, and cannot write a
> regression test that means anything. It is also the one property that **cannot be
> added later** — retrofitting determinism into a simulation that lacks it is a
> rewrite. It costs almost nothing to build in from commit one and is ruinous to add
> at Layer 3.

---

## 1. Seed strategy

A save has exactly one **world seed**: a 64-bit integer, chosen at world creation,
stored in the save header, and never changed.

Every random stream derives from it deterministically:

```
streamSeed = Hash64(worldSeed, streamId, entityId, tickNumber)
```

- `streamId` — a stable constant per subsystem (see §2)
- `entityId` — the entity the draw concerns, or 0 for world-level draws
- `tickNumber` — the simulation tick

**Why derive rather than share one generator?** If every subsystem draws from a single
sequential generator, adding one new draw anywhere shifts every subsequent value in
the entire world. A bug fix in employment would silently change every birth, death,
and marriage thereafter. Derived streams make each subsystem independent: changing
employment logic cannot perturb weather.

The hash must be a fixed, documented algorithm implemented in the repository — not a
built-in, not a library whose implementation could change between versions. Write it
once, test it against known vectors, and never change it without incrementing the
simulation version.

---

## 2. Random stream ownership

Every stream has exactly one owner. `streamId` values are assigned once and **never
reused or renumbered** — a save records which stream produced which outcome.

| streamId | Stream | Owner |
|---|---|---|
| 1 | World generation | Worldgen |
| 2 | Person trait assignment | People |
| 3 | Life-event timing | Lifecycle |
| 4 | Relationship formation | Relationships |
| 5 | Education outcomes | Education |
| 6 | Employment and hiring | Careers |
| 7 | Health and mortality | Health |
| 8 | Economy and markets | Economy |
| 9 | Reserved — geopolitics | *(Layer 4)* |
| 10 | Reserved — combat resolution | *(Layer 4)* |

Extend by appending. Never renumber.

---

## 3. Ordering guarantees

Nondeterminism most often enters through iteration order, not through randomness.

**JavaScript is unusually good here**, and this is worth knowing because it inverts the
usual advice:

| Property | Status |
|---|---|
| `Map` and `Set` iteration order | **Specified as insertion order** by ECMAScript |
| `Array.prototype.sort` stability | **Required** to be stable since ES2019 |
| Array iteration | Index order, deterministic |

The classic hazard in most languages — unordered hash-map iteration — is simply not a
hazard here. `Map` is safe to iterate.

Rules that still apply:

| Rule | Detail |
|---|---|
| **Use `Map`, never plain objects, for keyed collections** | Object key order has subtleties: integer-like keys sort ascending before string keys. `Map` has none of this. |
| **Never use `for...in`** | Walks the prototype chain; ordering subtleties. Use `Map` or explicit arrays. |
| **Sort keys must be total** | Sorting by a non-unique key leaves ties in input order, which is fragile. Always include entity ID as the final tiebreaker. |
| **The tick is synchronous** | No `async`/`await`, no promises, no timers inside a tick. Interleaving order is not guaranteed. |
| **Entity processing order is by ascending entity ID** | Not by insertion order, not by collection order. |
| **Event queues are ordered by (tick, priority, entityId)** | Never by insertion order alone. |
| **Sort object keys before hashing** | `JSON.stringify` follows insertion order, so two equal states can stringify differently. Canonicalize before hashing. |

---

## 4. Stable identifiers

Entity IDs come from a monotonic counter stored in the save, allocated in a documented
order during world generation.

- **`crypto.randomUUID()` and any random ID generator are banned for entity IDs.**
  Nondeterministic by design.
- IDs are never reused, even after an entity dies. A dead person's ID must keep
  resolving in historical records.
- IDs are stable across save/load. They are the primary key of the entire simulation.

---

## 5. Banned constructs inside `packages/engine`

| Banned | Reason | Use instead |
|---|---|---|
| `Math.random()` | Unseeded | The seeded RNG service |
| `Date.now()`, `new Date()`, `performance.now()` | Wall clock | The simulation clock |
| `crypto.randomUUID()`, `crypto.getRandomValues()` | Nondeterministic | Sequential ID allocator |
| `Math.sin/cos/tan/exp/log/pow` | **ECMAScript leaves precision implementation-defined** — results legitimately differ across browsers and versions | Lookup tables or integer approximations |
| `setTimeout`, `setInterval`, `queueMicrotask` | Timing-dependent | Nothing — remove it |
| `async` / `await` / promises in the tick | Nondeterministic interleaving | Synchronous tick |
| `for...in` | Prototype chain, ordering subtleties | `Map`, or explicit arrays |
| `toLocaleString`, `Intl.*` | Locale-dependent | Format in the UI, never the engine |
| Floating point in authoritative state | Drift risk | Integers, cents, integer scales |
| `window`, `document`, `localStorage`, `fetch` | Not I/O-free; also breaks server portability | Nothing — the engine performs no I/O |
| Module-level mutable state | Breaks test isolation and replay | State lives in the world object |

Add an automated test over the import graph and source of `packages/engine` asserting
none of these appear. Automated enforcement beats remembering — especially for a
solo developer reviewing their own code.

---

## 6. Numbers and floating point

**All JavaScript numbers are IEEE-754 doubles.** Integer arithmetic is exact only up to
2^53−1. This is the main thing to design around.

Per ADR-0008:

| Quantity | Representation | Range note |
|---|---|---|
| Money (personal, household, business) | Integer **cents** in a `Number` | Exact to ~$90 trillion — ample |
| Money (aggregate national economy, Layer 4) | **`BigInt` cents** | Exact at any size |
| Traits, skills, bounded values | Integer scales (0–1000, not 0.0–1.0) | Exact |
| Derived display values | `Number` permitted | Never fed back into state |

**What is safe:** `+`, `-`, `*`, `/`, and `Math.sqrt` on doubles are IEEE-754 required
operations and produce identical results across conforming engines.

**What is not:** `Math.sin`, `cos`, `tan`, `exp`, `log`, `pow`, and friends. ECMAScript
explicitly permits implementation-defined precision for these. Two browsers can
legitimately disagree in the last bits, and one divergent bit at tick 3 becomes a
different life by tick 300. This is why they are banned outright rather than used
carefully.

Rounding must be explicit and documented at every site where it occurs. Never let
rounding be an accident of the type system.

The persistence layer must handle `BigInt` from the start — `JSON.stringify` throws on
`BigInt` rather than failing quietly, which is helpful, but it must be handled rather
than discovered at Layer 4.

---

## 7. Simulation version

Every save records `simulationVersion`. It increments on any change to simulation
*behaviour* — not on refactors that provably change nothing.

Loading a save with an older version:

1. Apply migrations in sequence to reach the current version.
2. Record the migration in the save's history.
3. **State plainly that results may now diverge from the original run.** Determinism
   is guaranteed within a version, not across an intentional behaviour change.

Never silently change behaviour without incrementing the version. That converts
"reproducible" into "reproducible except when it isn't," which is worthless.

---

## 8. Replay expectations

**Guaranteed:** same seed + same version + same decisions ⇒ byte-identical state at
every tick.

**Not guaranteed:** identical results across simulation versions, or across a
migration. Both are intentional divergences and must be reported to the player, not
hidden.

A saved game therefore needs to store only: world seed, simulation version, the
ordered list of player decisions, and the current tick. The full world state is
recoverable by replay — a useful property for corruption recovery and for shrinking
bug reports to a seed plus a decision list.

---

## 9. Test strategy

| Test | Assertion |
|---|---|
| **Golden seed** | Simulate a fixed seed for N ticks; hash the world state; compare to a committed reference hash. Any drift fails. |
| **Double-run** | Run the same seed twice in one process. Byte-identical, or fail. |
| **Cross-process** | Run the same seed in two Node processes. Byte-identical, or fail. Catches module-level mutable state, which the double-run test cannot. |
| **Cross-environment** | Run the same seed in Node and in a real browser. Byte-identical, or fail. **The only test that catches a banned `Math.sin` slipping through**, and the one that matters most for a web app the player runs on an unknown browser. |
| **Save round-trip** | Save at tick N, load, continue to tick N+M. Must match an uninterrupted run to tick N+M. |
| **Stream isolation** | Change a draw in one subsystem; assert unrelated subsystems produce identical output. Proves §1's derivation works. |
| **Migration** | Load a committed old-format save; assert it migrates without data loss. |

These run in CI from Milestone 1. Determinism tests that only run manually will stop
running.

---

## 10. Debugging nondeterminism

When two runs of the same seed diverge:

1. **Bisect by tick.** Hash world state each tick; find the first differing tick.
2. **Bisect by subsystem.** Hash per-domain state at that tick; find which domain differs.
3. **Check the usual suspects first, in this order:** a stray `Math.random()` → a
   `Date.now()` read → a banned `Math.*` transcendental → a plain object iterated where
   a `Map` was meant → floating point in authoritative state → module-level mutable
   state. If the divergence appears only in one browser, it is almost certainly the
   transcendental-function rule (§5).
4. **Log RNG draws** for the failing tick in both runs and diff them. A draw count
   mismatch localizes the bug immediately.

Build the state-hashing helper during Milestone 1, before it is needed. Adding it
mid-panic is much harder.
