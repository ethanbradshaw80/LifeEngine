# Military Depth — design contract

> Owner's report, 2026-08-16:
>
> *"I feel as though they should become more in depth like '12 enemy soldiers
> on top of a mountain spot you'... Right now it just feels so reptitive like
> you see every screen everytime you get combat and its the same 3 options and
> you never get to see results like your squad killed this many people... We
> also always get into the same fight with belrus every single time."*

Nothing here is built. This is the contract to approve first.

**`CLAUDE.md` §10 makes independent review MANDATORY** for changes touching
combat resolution, casualties, awards and military architecture. The
`military-scope-reviewer` agent runs against this plan and against the work.

---

## 1. The owner's rulings

| Question | Ruling |
|---|---|
| Kill visibility | Squad results **always**. Personal kills rare and uncertain — **except** snipers, special units and infantry, who would genuinely know |
| PTSD prevalence | **Well under half** of combat veterans carry lasting damage |
| Nations | Up to **40**, and more of them actually fighting |
| Squad selection | **Assigned.** More honest than choosing |
| The war at home | **Show it** |
| War modelling | **After real life** |
| Shape | **One big update** |
| Also in scope | **Unit identity** and **peacetime**. Everything else queued |

**Explicitly dropped for now:** the draft, Reserve and Guard, duty stations
and PCS moves, the family at home during a deployment, and casualty
notification as a moment in the survivor's life. All are good; none are this
update.

---

## 2. What the code actually does today — measured, not assumed

- **24 combat scenes.** Each carries three sentences (one per threat level)
  and **the same three buttons every time**: `push` / `hold` / `cover`.
- **Resolution is a 3×3 matrix.** Choice crossed with `light` / `heavy` /
  `overrun` yields an injury gate, a severity floor and a valour chance.
  That is the entire model.
- **Enemy losses do not exist.** Not hidden, not unshown — there is no such
  number anywhere in the engine. The only outputs are what happened to *you*
  and whether you were decorated.
- **Squadmates are invented per tour** with "no household, no job, no place",
  rather than drawn from the unit the player actually serves in.
- **Bond is time and nothing else**: `months × 28`, capped at 1000. So
  *"you are getting to know him"* spans months 4 to 13 — longer than most
  tours, which is why it is the only line a player ever sees. Surviving a
  firefight together moves it by zero.
- **21 nations with STATIC alignments** — 7 ally, 2 neutral, 12 rival — and a
  fixed combat rating each. Wars emerge from escalation pressure, but because
  alignment never changes the same pairs keep winning the same ranking. That
  is the "always Belarus" report: it is not hardcoded, it is unchanging.

---

## 3. The two failure modes this must avoid

`MILITARY_AND_WAR_FOUNDATION.md` §1 names them, and treats them as equally
bad:

> **Glorification** — service as pure heroism, medals as achievements, war as
> spectacle.
> **Reduction to trauma** — service as pure damage, every veteran broken.

The two headline features of this update sit exactly on those two lines. The
shape of each matters more than the fact of it.

---

## 4. Combat encounters

### 4.1 A situation, not a threat level

A contact generates a **situation** the scene describes: how many, what
ground, what distance, who saw whom first, what support is within reach, what
the light and weather are doing. "Twelve on a ridge, they saw you first,
mortars twenty minutes out" is a different problem from "three in a ditch at
forty metres, you saw them first".

The same scene therefore never reads the same way twice, which is the actual
fix for repetitiveness — 24 scenes read as one scene today because the
*structure* is identical, not because the prose is thin.

### 4.2 Choices come from the situation

Four to six options drawn from what is genuinely available, replacing the
three constants. Break contact, flank, fix and manoeuvre, call for fire, go
to ground, get the wounded out first. **An option only appears when the
situation supports it** — you cannot call for fire with no radio and nothing
in range.

This is the single largest change and the one the owner asked for first.

### 4.3 Every scene rewritten, per MOS and per branch

A medic's contact is not a rifleman's. A naval engagement is not a convoy
ambush. A mechanic's bad day is a vehicle recovery under fire, not a bayonet
charge. Scenes carry the trade and the branch they belong to.

### 4.4 Most months have no scene at all

Foundation §9: a character may serve an entire conflict without witnessing a
decisive engagement. **If every month is a firefight, no firefight means
anything.** Heat, waiting, a convoy that arrives without incident, a patrol
where nothing happens. This is half the repetitiveness fix.

### 4.5 Non-combat casualties

Foundation §8 calls them "a real and substantial share of military
casualties" and we model none. Vehicle rollovers, training accidents,
illness. It also gives a cook or a mechanic a deployment that can go wrong
without pretending they are in a firefight.

---

## 5. Results, kills and the after-action report

### 5.1 What is always reported

The **engagement**: what it cost both sides, who did what, who was hurt, by
name. Squad results are always visible — this is the owner's ruling and it is
also how it is actually recorded.

### 5.2 Personal attribution

Rare and uncertain by default. Fire is collective; most infantrymen never
confirm one. **Except** where the trade genuinely tracks it:

- **Snipers** — and the count is **spotter-confirmed**. The confirmation is a
  named person, which turns a statistic into a relationship rather than a
  score.
- **Special units** — confirmed through the team.
- **Infantry** — aware of theirs, with more uncertainty than a sniper's.

**No lifetime counter to farm.** A count exists where a real person would
have one, on the record, and nowhere else.

### 5.3 The after-action report

A **filed document**, not a popup — readable twenty years later in the
service record.

This is where foundation §8's asymmetric information pays off: *at the time*
the character saw muzzle flashes on a ridge. *The record*, afterwards, says
the position held twelve men and the squad broke it. **The character never
knew. The player does.** That asymmetry is the emotional weight of the whole
system and it must be preserved deliberately.

---

## 6. The squad

- **Assigned, never chosen** (owner's ruling).
- **Drawn from the player's unit** where the unit has people to give. A unit
  that advertises for volunteers and then supplies nobody is the defect the
  owner found.
- **Persistent across tours.** The same man is the same man, with the same
  history, not a stranger because a field was reset.
- **Bond is earned, not waited out.** Months become the smallest input. What
  moves it: coming through a bad contact together, him being hit, you being
  hit and him staying, losing somebody you both knew.

That last change is also the emotional engine for §7, because trauma should
be about **who**, not about how many months in country.

---

## 7. Lasting psychological injury

- **Well under half** of combat veterans (owner's ruling), measured and
  reported, not asserted.
- **Driven by what specifically happened** — losing a named squadmate, a
  mass-casualty event, a near miss — never by "was deployed".
- **Routes into systems that already exist**: wellbeing, the medical board,
  and the benefits claim path.
- **Recovery is real** (Law 7). Treatment can work. A life continues either
  way. This is not a permanent stat debuff.

---

## 8. Fitness for duty is not disability — the owner's correction

> *"You should only be med boarded in the military if have serious injuries
> like limbs blown off... I had playthroughs where I got hurt like 8 times and
> only got 20%."*

He is right, and the cause is that **the game asks one question where reality
asks two.**

| | The military asks | The department asks |
|---|---|---|
| Question | Can you still do your job? | What has this cost you for life? |
| Answer | **Fit or unfit** | **A percentage** |
| Triggers | Limb loss, major head injury, anything that stops you deploying | Everything, cumulatively |
| Timing | While serving | Mostly after |

Three consequences:

1. **The medical board stops reading a percentage.** It reads severity and
   whether the person can still serve. Healed-up injuries do not board
   anybody out.
2. **Ratings must COMBINE across conditions.** "Hurt eight times, got 20%" is
   the bug in one line — it reads like the highest single injury winning.
   Real combination is not addition (30% and 20% make 44%, rounded to 40%),
   but eight rated conditions land far above 20%.
3. **You can be rated for things that never boarded you.** You served your
   twenty fine and it caught up afterwards — the normal case, and there is no
   path for it today. The unglamorous conditions belong here: hearing and
   tinnitus first, then backs, knees, sleep, and PTSD.

---

## 9. Unit identity

Foundation §13. Today a unit is a label.

- Its own **history**: where it has been, which wars, what it lost.
- **Losses that accumulate** and are readable.
- A **reputation** that means something to the people posted into it.
- If a player spends a decade in one, it should feel like somewhere they are
  rather than a line on a record.

---

## 10. Peacetime

Most of a military career is not a war, and today the years between
deployments are empty.

- Exercises and field problems.
- Schools and qualifications (some of this exists).
- Inspections, duty, the administrative grind.
- The people: a first sergeant who has it in for you, a good officer, a bad
  one.
- Promotion and stagnation felt month to month rather than at a board.

---

## 11. Geopolitics — forty nations that actually fight

- **Up to 40**, from 21.
- **Alignments drift.** A nation's bloc is a state that changes over decades,
  not a constant. This is the root fix for "the same 7 or 8 countries".
- **Alliances that drag third parties in.** Defensive pacts pulling a country
  into somebody else's war, and neutrals picking a side. That is what makes a
  century read as history rather than as rolls.
- **Wars have a shape** — opening, grind, turning point, end — so a four-year
  war is not 48 interchangeable months.
- **Foundation §2 is absolute**: danger is derived from the geopolitical
  state, never from a per-country danger table. If danger is ever implemented
  as a lookup keyed on country, the design has failed.

---

## 12. The war seen from home

Foundation §9, and the owner has asked for it. A war the character never
deploys to should still be felt: prices, shortages, the news, public opinion,
protest, and the town's own people going and coming back — or not.

This is where Law 4 pays: a war moves a spouse's job, a town's economy, and a
child's opportunities.

---

## 13. What gets measured

Every one of these is a number to report, not a claim to make:

- Share of combat veterans with lasting psychological injury (target: well
  under half).
- Share of deployed months containing any scene at all (expect: a minority).
- Distinct nation pairs at war across a century (today: too few — the
  complaint).
- Distribution of disability ratings, and the rate of medical boards against
  it (they should not track each other).
- Squad deaths per tour, and how many of the dead the player actually knew.
- Non-combat share of all casualties.

---

## 14. Open questions

1. Does an after-action report ever contradict what the character believed at
   the time — and should the game show that seam explicitly?
2. Should a unit's history be generated backwards at worldgen (it fought in
   1971) or only accumulate from play forward?
3. How much peacetime is too much before it becomes the boredom it is
   modelling?
