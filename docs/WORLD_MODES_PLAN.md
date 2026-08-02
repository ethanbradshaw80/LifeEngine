# World Modes — Real World Mode and the WorldSpec

**Status: audited and designed, 2026-08-01 (owner direction). Not yet
implemented.** The owner wants the game to support a believable real-world
setting alongside fully fictional worlds, via a world configuration system
extensible to future presets. The full placeholder inventory (every proper
noun in the game, with file:line) was taken 2026-08-01; rulings and
architecture below. Implementation is the W-arc, after the P/D arcs.

## The two launch presets

- **Classic (today's world, unchanged):** Haverlock, the Republic, 12
  fictional nations, fictional branches — every current save loads as this
  preset forever.
- **American Heartland (Real World Mode):** a REALISTIC-FICTIONAL town in a
  real US state and county; homeland = the United States; real geography
  and climate priors; real service branch names; real installation names;
  era-weighted real name pools; START_YEAR configurable. Foreign nations
  REMAIN FICTIONAL (below).

## Real vs fictional — the rulings

| Content | Ruling | Why |
|---|---|---|
| US states, counties, geography, climate | REAL | Facts; public-domain government data. Already sanctioned by CLAUDE.md §3. |
| The player's town | REALISTIC-FICTIONAL in a real county | A real small town implies real residents and businesses. Real metros acceptable later. |
| Streets/neighbourhoods | REALISTIC-FICTIONAL | Real addresses imply real occupants. |
| Homeland nation | REAL (United States) | CLAUDE.md §3 already says "realistic simulated United States"; the fictional Republic was the deviation. Requires the two amendments below. Frame explicitly as alternate history (1970 start + generated wars). |
**Owner reference data, 2026-08-02.** The owner supplied a list of 21 real
foreign countries (with US-perspective ally/hostile labels) and a large list of
real military bases. THE BASES ARE IN USE — see W2 above. THE COUNTRIES ARE NOT,
and cannot be without changing the ruling below and ADR-0020 §2, because this
engine GENERATES wars: it escalates relations to war, kills people in them, and
writes the enemy's name onto campaign medals, headlines and death records that
are never rewritten. Naming Russia or China there would fabricate a war that
did not happen and make real casualties a mechanic. This is flagged for the
owner as his decision, with the options written up in the handoff; nothing has
been changed on the strength of the data alone.

| Foreign nations & wars | FICTIONAL, permanently | R-14 + MILITARY_AND_WAR_FOUNDATION §3: generated wars with real countries put fabricated history on permanent records; real wars make real casualties a mechanic. The foundation's compromise stands: real domestic, fictional theatres. |
| Service branches | REAL names, NO insignia | Nominative use of "US Army/Navy/Air Force" in an expressive work; DoD licenses emblems — never ship them. Rank ladders are already real by owner direction. |
| Bases/installations | REAL names | Facts about government property; foundation §3 already sanctions. Care: era-correct names (2023 renamings); never attach invented scandal to a named real base. |
| Named military units | FICTIONAL, permanently | Real units carry real casualty history and living members; insignia trademarked. Pathfinders/Ember stay. |
| Decorations | REALISTIC-FICTIONAL (stay) | Already litigated in-repo twice (verbatim names reverted at v13→v14 and M-HARM). "Medal of Honor" is also a game trademark. |
| Universities | REALISTIC-FICTIONAL when attended; real names only in inert factual references | Flunking the player out of a named real school is avoidable risk; mascots/seals licensed. (Also text.ts's article() mishandles "a university" — fix before any such content.) |
| Companies/branded workplaces | REALISTIC-FICTIONAL | Charter forbids real companies; the sim bankrupts and injures people at work. Never real small businesses. |
| Politicians, parties, media, sports, celebrities, private individuals | FICTIONAL-ALWAYS | Publicity rights, defamation, charter. Unchanged. |
| Person name pools | REAL ordinary names, era/region weighted, no real individuals | Already the model; extend with era weighting. |
| Occupations, calendar | REAL (already are) | No IP in job titles or months. |

**Constitution amendments required (exactly two, both narrow):**
1. MILITARY_AND_WAR_FOUNDATION §3 "All countries… fictional" → "all
   FOREIGN countries fictional; the homeland is preset-defined."
2. CLAUDE.md §3 "military units are fictional" → distinguish branches
   (real, name-only, per preset) from units (always fictional). Same
   clarification in the charter.
   The content.ts:71-73 "no real places on permanent records" rule
   re-scopes to foreign theatres.

## Architecture — the WorldSpec

**Seam:** `createWorld(seed, population)` → `createWorld(seed, population,
spec)` (worldgen.ts:130). The spec is chosen at world creation, recorded in
the save header, and IMMUTABLE for that world's life. Determinism statement
becomes seed + **preset** + version + decisions. One golden fingerprint per
preset.

**The spec carries (from the measured read sites):** given/family name
pools; town gazetteer (town name, neighbourhoods, workplaces, civic
places, schools, bases); nation set (homeland identity, foreign pool,
count, blocs); service content (branches with ladders/pay/TIG, specialties,
schools, units, decoration titles); START_YEAR; region/state identity and
climate priors (Heartland). Balance constants (pay tables, prices,
cutoffs) are TUNING, not world identity — they stay engine-owned and split
out of content.ts.

**Known resistances (all measured, all must be handled in W1):**
1. **Id-shift trap:** places allocate before people and person ids seed
   trait streams (worldgen.ts:79-111, 293-297) — presets with different
   place counts produce different people from the same seed. Acceptable
   (preset fixed at creation); document it, never "switch" a save's
   preset.
2. **Throwing string lookups:** occupationById/specialtyById throw on
   unknown ids that live in saves (content.ts:284, 447) — content resolved
   per-preset, additively versioned; a build carries every shipped
   preset's content forever.
3. **ServiceBranch is a compile-time union** keying five tables
   (content.ts:149-208) — becomes data on the spec.
4. **Display names as logic keys:** unit-selection dedupe and pass-over
   dedupe string-match names (service.ts:228-230, 280-282, 663-665) — key
   on ids before any preset work.
5. **Names minted into permanent records** (headlines, fronts,
   campaign-medal titles): correct-before-generation, never renamed after
   (the Ashkelon→Veskarn doctrine, migrations.ts:448-451).
6. **Prose hardcodes:** "the Republic" in player.ts:485/1044/1239/1241 and
   "Haverlock" in Welcome.tsx:24 → render homeland(world).name /
   world.town.name. (Cheap; do in W1.)

## Structure Real World Mode needs that does not exist

Town→county→state→nation chain (today the town and the homeland nation are
completely unlinked); optional lat/long or region tags; climate priors
(new system, new append-only stream, own milestone); multiple towns and
migration (LARGE — deferred, gated on the O(n²) tick-loop fix per
PERFORMANCE_BASELINE). Time zones: skipped — meaningless at monthly ticks.

## W-milestones

- **W1 — WorldSpec extraction. COMPLETE 2026-08-02** (commits 298fb0e,
  1ee4dcb, 86d7bdf, 7c9e6bd, a2a064f, 7f5f021, 4850c53, 6129fb4, afabf0d).
  Everything a preset decides now comes from `world.spec`: name pools, the
  gazetteer (town, school, streets, workplaces, civic places, bases, the
  news station), the homeland's name, the foreign nations, the service
  branches (name, ladder, pay grades, competitive threshold, junior TIG),
  the trades, the schools, the units, and the start year. `createWorld`
  takes a spec; the save header records its id (schema v21, migration names
  every older save 'classic'); the worker's 'new world' message can carry
  one. **Classic's golden hash never moved** — the whole extraction is a
  proved pure refactor.
  Resistances: **2 CLOSED** (every content lookup is total — an id out of a
  save can no longer throw inside the tick), **3 CLOSED** (branches are
  data, not a compile-time union), **4 CLOSED** (records key on ids, never
  display names), **6 CLOSED** (no homeland name typed into engine prose,
  with a test that fails if one reappears). **1 stands and always will**:
  presets with different place counts or ORDER produce different people
  from the same seed, because place ids lead person ids lead trait streams
  — a save can never be switched to another preset.
  Reviewed twice (architecture + persistence); four must-fixes found and
  fixed, the worst of them a `RangeError` on the first birth under any
  preset whose name pool was a different length from Classic's.
  DEFERRED, deliberately: decoration titles and named units stay shared
  fictional content in every preset (this plan already rules them so); the
  nation COUNT and bloc count stay engine balance; and if a start year is
  ever player-selectable it moves from the spec to the save header beside
  presetId, which is one schema bump then and nothing now.
- **W1 (original scope, for reference) — WorldSpec extraction.** Classic preset = current content
  verbatim; engine reads the spec everywhere content.ts is read today;
  resistances 2-4 and 6 fixed; save header gains preset id (schema bump;
  old saves = classic); golden per preset; determinism docs updated.
  Zero behavior change for Classic (same golden hash is the exit
  criterion).
- **W2 — American Heartland preset. COMPLETE 2026-08-02** (commits 1d0d968,
  5f82a16). Ashcroft — a town that does not exist — in Vermillion County,
  Indiana, which does. Homeland: the United States. The Army, the Navy and
  the Air Force by name, on the ladders the engine already had (they were
  modelled on the real enlisted structure from the start, so no mechanic
  changed). Seven real installations from the owner's own reference list,
  filtered by ERA and by BRANCH. Invented town, streets, businesses, school
  and call sign. Foreign nations, wars, named units and decorations
  fictional, identical to Classic's. The three constitution amendments
  landed with it (CLAUDE.md §3, PROJECT_CHARTER.md §2,
  MILITARY_AND_WAR_FOUNDATION §3). Reviewed by military-scope-reviewer;
  three must-fixes, all fixed:
    1. Base assignment had no branch filter, so sailors were posted to army
       forts — harmless while the names were invented, a false claim about
       a real place once they were not. `BaseSpec` now names the services
       posted at each installation.
    2. The charter amendment was missing, so the charter contradicted the
       shipped preset.
    3. Nothing told the player this is alternate history, which this plan
       makes a CONDITION of the homeland-real ruling. Presets carry a
       description now, shown under the picker.
  PINNED: Heartland has its own golden fingerprint (41ec53de), per this
  document's own one-golden-per-preset rule.
  KNOWN AND ACCEPTED: the engine does not model base closures or renamings,
  so a century-long run posts people to installations whose real-world
  status changed after 1970 (Fort Bragg, Fort Campbell, Fort Riley, Naval
  Station Norfolk, Naval Base San Diego, Wright-Patterson and Nellis were
  all chosen for being long-lived and correctly named at both ends of the
  run, but the sim asserts nothing about their status). The preset also
  does not model distance: installations are "home stations" of a town in
  Indiana. ERA-WEIGHTED NAME POOLS ARE NOT DONE — the preset reuses the
  1990-census pools, because inventing 1940s frequency weights would be
  inventing a fact. That needs real data, not engineering.

- **W2 (original scope, for reference) — American Heartland preset.** The rulings above become content:
  real state/county frame, fictional town, US homeland + real branches
  and bases, era name pools, configurable START_YEAR; the two
  constitution amendments land with this milestone's ADR; military-scope-
  reviewer mandatory.
- **W3 — Place depth (scoped later).** Climate/seasons; university
  institutions behind the education level; regional priors. Each gated by
  the Three Gates on its own.

No hardcoded assumption may prevent adding future countries or custom
presets: everything preset-specific lives on the spec, nothing in engine
logic branches on a preset NAME.
