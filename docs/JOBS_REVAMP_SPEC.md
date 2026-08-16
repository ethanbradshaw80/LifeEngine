# Jobs & Careers Revamp — design contract

> Source material: the owner's `JOBS_CAREERS.md` (75 paths across 15
> categories, with per-level skill gates, experience gates, education,
> salaries and stress/happiness), `jobs-system.ts` (a reference
> implementation), `jobs-ui.html` (the screen), and the Player's Guide.
>
> **Those files are the specification, not the implementation.** The `.ts`
> file does not compile — it carries doubled braces (`{{ skillName:`) through
> the later paths — and is treated the way `market-system-ts.ts` was in the
> business module: read for intent, rewritten against this repository's
> constitution.

---

## 1. The owner's rulings (2026-08-14)

Asked four questions before any code was written, because each one changed
the architecture rather than the content.

### Ruling 1 — build the full skill system, for the whole town

> Options offered: full skills / map onto the existing `performance` number /
> player-only. **Chosen: full.**

Every gate in all seventy-five paths is written in skills. Mapping them onto
`performance` would have collapsed every path to one number and made
"Creativity 4" flavour text. Player-only would have broken Law 2 — a
promotion rule that binds only the player is a penalty wearing a rule's
clothes.

Cost accepted: a new world map, a schema bump, a migration, and growth that
runs for every working adult in the town.

### Ruling 2 — deflate the salaries to base-year money

> Options offered: deflate / treat as base-year / owner re-issues.
> **Chosen: deflate.**

The spec is written in present-day dollars; this world starts in 1970 and
inflates forward from a table where a shop clerk earns $292 a month. Entered
literally, a junior developer would have earned twenty-five times the town's
median and no business in the game could have made payroll.

**The divisor is read off the engine's own wage table, not invented** — see
`SPEC_DEFLATOR` in `paths.ts` for the two anchors it sits between. The
spec's relative ordering is untouched; only the denomination changes.

### Ruling 3 — foundation first, then all 75

> Options offered: foundation then all / everything at once / content only.
> **Chosen: foundation first.**

Skills, licences, era gates and the screen are built against a first slice
covering every category. The remaining paths then pour into the same table
as pure content. The alternative risked baking a foundational mistake into
320 job levels before anything could be played.

**DONE, 2026-08-15.** All three slices are in: **74 ladders, 310 rungs**,
one file each so the transcription stays reviewable —

| file | what is in it | ladders |
|---|---|---|
| `pathcontent.ts` | the first slice, one per category | 15 |
| `pathmore.ts` | desk trades — technology, finance, management, transport | 29 |
| `pathhands.ts` | hands-on — trades, healthcare, hospitality, creative, services | 30 |

The spread against his fifteen bubbles: Technology 11, Finance & Business 9,
Trades 9, Creative 7, Business & Mgmt 7, Healthcare 5, Hospitality 5, Public
Service 4, Personal Services 4, Retail 3, Transportation 3, Agriculture 3,
Entertainment 2, Education 1, Law 1.

His document lists seventy-five; seventy-four are transcribed, the shortfall
being ladders his tables named twice under different headings. The foundation
held — adding fifty-nine ladders needed **no engine change at all**, and the
three determinism goldens did not move, because a table nothing reads during
a tick cannot change a world.

### Ruling 4 — stress and happiness ship WITH jobs

> Options offered: defer / build now. **Chosen: build now.**

They appear on every level of the owner's tables and are half of what makes
an executive rung a trade rather than a reward.

---

## 2. What existed before this, and what it means for scope

| Piece | Before | After |
|---|---|---|
| Ladders | 9 tracks, 29 rungs (`careers.ts`) | 75 paths, ~320 levels (`paths.ts`) |
| Promotion gate | one number, `performance` | skills + months + schooling + licence |
| Skills | **none** | 18, on every working person |
| Licences | **none** | 13 |
| Stress / happiness | **none** | on every level |

**`careers.ts` is NOT deleted.** The town's existing jobs hang off it and
every NPC in a live save holds one. The paths sit beside it and take over
the surfaces a player touches — the same "extend, don't replace" ruling that
kept the business module out of trouble.

## 3. The skills, and the one number that was changed

The eighteen are extracted from the owner's own tables — every "Key Skills"
gate and every "Skill Growth" line. Words appearing only in job TITLES
("Operations Director", "Security Analyst", "Technical Writing") are
deliberately excluded: reading those as skills would have invented five the
spec never asks for.

**The growth rates were re-scaled, and this is the one place the owner's
numbers were not taken literally.** Applied as written (0.5 to 1.2 levels a
month) a skill reaches the ceiling in four to ten months, which makes every
gate in every path a formality and leaves the experience requirement doing
all the work. Growth now slows as it climbs. Measured:

| Rate | Level 3 | Level 5 |
|---|---|---|
| 0.3 | 2.4 years | 12.8 years |
| 0.5 | 1.6 years | 7.7 years |
| 0.8 | 0.8 years | 4.7 years |
| 1.2 | 0.6 years | 3.2 years |

Relative rates are untouched — a 1.2 skill still masters four times faster
than a 0.3 one. The shape this produces is the one the tables imply:
mid-rung gates are reachable on time and the experience requirement binds,
while level 5 is a decade of staying put and the SKILL gate binds at the
top. The two constraints do different work, which is the point of having
both.

A first attempt at the curve was too gentle — 23 months to mastery — and the
test caught it. The figures above are measured, not asserted.

### Ruling 5 — a switch starts at the bottom of the new ladder (2026-08-14)

> *"they should have to go through the management ladder like everyone else
> and not just handed a higher position because he has the skills"*

Skills do not buy rungs. A welder with Technical Knowledge 5 who moves into
management enters management at level 1, exactly like somebody who has never
worked a day.

**What his history is worth instead: speed.** Because he already clears the
skill gates of the rungs above, only the MONTHS hold him back — so twenty
years of work shows up as a faster climb rather than a higher entry. That
falls out of the model rather than being special-cased: skill gates and
experience gates are separate constraints, and a switcher arrives having
satisfied one of them.

## 4. Open questions for the owner

1. **Where the remaining paths' stress/happiness rows come from** for those
   whose tables list them only in the summary sections.
   — ANSWERED BY DOING, and stated plainly so it can be overruled: where his
   document gave per-rung figures they are his; where it gave only a summary,
   the rungs interpolate between the ends he named. Era windows on trades
   that plainly did not exist in 1970 (barista, brand designer, video
   production) are mine, not his.

2. ~~The town is still not on these ladders.~~ **DONE, 2026-08-15** — see §6.

## 5. Acceptance

- A skill is earned only by doing the work that teaches it, never bought.
- Mastery takes a career; the measured curve above is pinned by a test.
- Every gate the owner's tables write is the gate actually enforced, and the
  screen can say which one is short.
- Salaries land inside the wage world that already exists — no rung out of
  order against the engine's own table.
- A save from before this opens, and nobody is awarded a skill they cannot
  be shown to have earned.
- **Every bubble opens on a career somebody could actually start.** Held by
  `pathseam.test.ts`, which tests what `pathsFor` hands the screen rather
  than what the table contains — and which found the one real flaw in the
  content: Personal Services was sealed outright, because the stylist, the
  trainer, the masseur AND the groomer all demanded a licence at the entry
  rung. Four locks and no way in. The groomer's ticket moved up a rung.

---

## 6. The town on the ladders (2026-08-15)

Law 2 says every person is the main character of their own life, and a
promotion rule that binds only the player is a penalty wearing a rule's
clothes. Townspeople now take the same paths, are taught by the same work and
climb by the same gates.

### What actually blocked it

`runLadderClimbs` and `runSkillGrowth` had both existed for a release and
both ran every month over the whole town — doing nothing, because no NPC ever
had a `pathId`. The block was one thing: **a rung was not an occupation.**

`considerBetterJob` ranks work by `typicalPay(occupationById(id))`. A rung
that is not in the occupation table falls through to a synthetic that pays
ZERO, so every job in town reads as a raise and the first ambition roll pulls
the person straight back off their ladder. The town could have been put on the
paths and would have walked off them within a year or two.

So all 310 rungs became ordinary `Occupation`s in `content.ts` — pay bands
±10% around the owner's figure so the midpoint is exactly his, schooling from
the rung or the ladder, and `preferredMajors` mapped from the category.

### The three things it took, each one a bug the first attempt hit

- **A degree still points somewhere.** The first attempt dropped `pulls
  graduates toward the work their field is for` to 60 against a floor of 67,
  and the guard bolted on afterwards "fixed" it by keeping graduates OFF the
  ladders — which is not putting the town on them. The real fix is upstream: a
  rung carries `preferredMajors`, so a nursing degree pointing at the
  healthcare ladder is a match that COUNTS. Hiring then weights a matching
  field up rather than requiring it, exactly as the town's own hiring does.
- **The share is measured, not chosen.** One in six new hires starts a ladder
  (`LADDER_SHARE`). At two in five the town collapsed — 150 years ended with
  45 people against a band of 59+, because two fifths of every cohort stopped
  reaching the occupations the rest of the simulation is tuned around.
- **`hirePerson` derives the path, and nothing else does.** The reverted first
  attempt set `pathId` back onto the record at one call site. Every other way
  into a rung — the player's own application, a business hiring, a poach —
  produced somebody standing on a ladder with no idea they were on one, so
  they never grew a skill and never climbed.

### Two bugs this surfaced that were already in the tree

- **Nine ids mean two different things.** `teacher`, `accountant`, `sergeant`,
  `partner`, `charge-nurse`, `store-manager`, `shift-lead`,
  `senior-accountant`, `department-head` are in both tables. Concatenating the
  rungs second silently REPRICED nine of the town's own wages — a law partner
  went from $1,458-2,396 to $3,300-4,033 — and claimed plain schoolteachers
  for a ladder they never joined, at rung 2. The town's table owns a shared
  id; `occupationtables.test.ts` holds it.
- **A civilian promotion was raising the military's event.** `runLadderClimbs`
  emitted `promoted`, which is service.ts's event for a RANK, where the town's
  own career tracks have always used `promoted-at-work`. Invisible for a whole
  release because the line never ran. The moment the town went onto the
  ladders it fired and six tests across three files failed at once: a
  discharged veteran who climbed a civilian ladder produced a `promoted` event
  reading "warehouse lead".

### Held by

`townladders.test.ts` — real people on real ladders, the share bounded both
ways, nobody seated above the bottom of a ladder they just joined, somebody
above their entry rung, the work teaching the people doing it, and a rung
paying and reading like any other job.
