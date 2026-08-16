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

Foundation §13. **Measured first, and it is worse than "a unit is a label":
most people are in no unit at all.** `SPECIAL_UNITS` holds six elite units you
try out for, and `record.unitId` is `null` for everybody else. An ordinary
soldier serves nowhere.

So step one is not history or reputation. **Step one is that everybody who
serves is assigned to a unit** — a line unit with a name, a home station, a
branch and a trade mix. The six special units stay exactly what they are: the
ones you have to earn.

Then:

- Its own **history**: where it has been, which wars, what it lost.
- **Losses that accumulate** and are readable.
- A **reputation** that means something to the people posted into it.
- The squad in §6 is **drawn from it**, which is what makes "your unit is
  taking volunteers" stop being a lie.

### 9.1 Unit awards — the owner's ruling, researched

> *"unit awards are different from people awards"*

He is right, and the difference is sharper than it first looks. Two real
mechanics matter and both are gameable in the honest sense:

**One — the award goes to the unit, for a period.** Not to a person, for an
act. The citation names the unit and names the dates. Precedence, highest
first:

| Award | Earned for |
|---|---|
| **Presidential Unit Citation** | Gallantry and esprit de corps under extremely difficult and hazardous conditions — the unit equivalent of the highest individual decorations |
| **Valorous Unit Award** | Extraordinary heroism in action; the unit standard is the individual Silver Star standard |
| **Meritorious Unit Commendation** | Exceptionally meritorious conduct or outstanding service, **combat or not**, over a sustained period (the Army's runs six months) |

The naval and air services carry their own equivalents — Navy Unit
Commendation, Gallant Unit Citation, Meritorious Unit Award — and there is a
**Joint** award for units serving under a joint command. Branch parity is
easy content and the game already has three branches to spend it on.

That last row is the one that changes the game most: **a unit award can be
earned with nobody firing a shot.** A maintenance unit, a hospital, a supply
battalion — they can be decorated for doing a hard job well for six months.
That is the single best answer to "the military is only worth playing in a
war", and it costs one award type.

**Two — permanent versus temporary wear. This is the mechanic.**

- You were **assigned and present during the cited period** → you wear it
  **permanently**, for the rest of your life. It is on your record at the
  funeral.
- You **arrived afterwards** → you wear it **temporarily**, and **only while
  you are in that unit.** Post out, and it comes off your chest.

That is a real rule, and it is a *magnificent* game mechanic, because it
encodes belonging. Two soldiers stand next to each other wearing the same
ribbon, and one of them earned it and one of them inherited it, and both of
them know which is which. A player who transfers into a famous unit gets to
wear its history — and loses it when they leave. A player who was *there*
keeps it forever.

It also means the service record needs to say **which kind**, and the
after-action reports of §5 are what prove it.

**Three — campaign streamers.** A unit's colours carry an embroidered
streamer for each campaign it took part in; the practice grew out of
inscribing battle names on the colours during the Civil War. This is the
readable form of §9's "history": a unit's flag *is* its lineage, and a player
can look at it. When our unit takes part in a war, its colours get a streamer
with that war's name and years, permanently. A unit standing up in 2041 has a
bare staff. One that has been fighting since 1970 does not.

**What this must not become:** a collection screen. No completion percentage,
no "3 of 7 unit awards". The record shows what the unit did and where the
player was standing when it did it. Nothing more.

Sources: [Presidential Unit Citation](https://en.wikipedia.org/wiki/Presidential_Unit_Citation_(United_States)) · [Valorous Unit Award](https://en.wikipedia.org/wiki/Valorous_Unit_Award) · [Meritorious Unit Commendation](https://en.wikipedia.org/wiki/Meritorious_Unit_Commendation) · [Joint Meritorious Unit Award](https://en.wikipedia.org/wiki/Joint_Meritorious_Unit_Award) · [Navy Unit Commendation](https://en.wikipedia.org/wiki/Navy_Unit_Commendation) · [Gallant Unit Citation](https://en.wikipedia.org/wiki/Gallant_Unit_Citation) · [HRC unit award wear rules](https://www.hrc.army.mil/content/Unit%20Award%20Info) · [DA PAM 670-1 §22-10](https://ar670.com/guide/da-pam-670-1-22-10-u-s-and-foreign-unit-awards/) · [Named campaign streamers](https://www.army.mil/article/26512/named_campaign_streamers_for_unit_colors)

---

## 10. Peacetime

Most of a military career is not a war, and today the years between
deployments are empty. The owner asked for things to actually do.

**The rule that keeps this from becoming chores:** peacetime should generate
*a life*, not a task list. Most months should pass with a line of texture and
no decision. When a decision does come, it should matter for years.

### 10.1 More schools, per branch

Schools exist and are the strongest thing we already have — extend rather
than invent. Each is months of your life, a qualification on the record, and
a different career afterwards.

- **Leadership schools by grade** — the ladder every NCO actually climbs, and
  a hard gate on promotion. Failing one costs you years.
- **Trade schools deeper in your own MOS** — advanced, senior, master. A
  mechanic who is *the* mechanic.
- **Badge schools** — jump, air assault, dive, survival. Short, brutal, and
  they change which units will take you (§9's real gate).
- **Instructor duty** — you go *back* to the school to teach. Two or three
  years, no deployment, and a reputation that follows you.
- **Joint and staff courses** for officers, which is how a career stops being
  a platoon and becomes a headquarters.

### 10.2 Things that happen through the year

- **Field exercises** — a month in the mud pretending. Squad bonds move (§6),
  people get hurt for real (§4.5), and units get graded.
- **Inspections and evaluations** — the unit's grade, not yours, which is
  where §9's reputation comes from and where the **Meritorious Unit
  Commendation** is earned.
- **Ranges and quals** — routine, but a bad one in front of the wrong person
  costs you.
- **Duty rosters** — CQ, staff duty, the weekend you lose. Small, frequent,
  and the honest texture of the job.
- **Details** — the working party nobody wanted. Cheap, and instantly
  recognisable to anyone who has served.
- **Ceremony** — change of command, a retirement, a memorial. This is where
  the unit's history gets said out loud.
- **Humanitarian and disaster response** — a real peacetime mission, it can
  go wrong, and it earns real awards without a war.
- **Training accidents** — §4.5 lives here too, and this is where peacetime
  stops being safe.

### 10.3 The people

- A first sergeant who has it in for you, or a good officer, or a bad one —
  **a named person whose opinion moves your evaluations for years.**
- Reenlistment moments: they want you to stay, and the bonus is real money
  against a life you could have instead.
- Barracks life, and the friend who gets in trouble and takes you with him
  (Article 15 already exists — peacetime is when it should fire).

### 10.4 Promotion and stagnation felt month to month

Not just at a board. You should be able to see it coming: the year you are
clearly ahead, the year you are clearly not, and the quiet realisation that
the next grade is not going to happen. High-year tenure already ends careers
(`HIGH_YEAR_TENURE_TIG = 72`) — the player should *feel* that clock, not be
told about it on the last month.

### 10.5 The honest risk

Too much peacetime is boredom, which is the thing being modelled and also the
thing that makes people stop playing. **Measure it:** share of service months
that produce a decision, and share that produce any text at all. If a decade
of peace reads as ten identical years, it has failed even if it is accurate.

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
- Share of service months producing a decision, and share producing any text
  at all (§10.5 — the boredom guard).
- Unit awards earned in peace versus in war (both should be non-zero).
- Share of a veteran's unit awards worn permanently versus temporarily.

---

## 14. The three questions, answered

**1. The after-action report is modelled on the real thing.**

> *"I think the after action report should be how its based upon in real
> life."*

So it is a **document, written by somebody, for the record** — not a results
screen addressed to the player. It has an author, a date, a unit, a place and
a dry institutional voice. It says what the unit was doing, what happened,
what it cost, and what it assessed of the enemy — and enemy assessments in
real reports are **estimates, hedged**, not scores.

Two consequences follow from "real":

- **It can be wrong, and it is never corrected.** Reports are written from
  what was known at the time. If it says twelve and it was eight, it says
  twelve forever. §5.3's asymmetry stands — but now the seam runs the *other*
  way too: sometimes the record knows more than the character did, and
  sometimes it knows less.
- **It outlives everyone in it.** Filed in the service record, readable
  decades later, readable by a descendant. That is the payoff.

**2. Unit history accumulates from play. Nothing is invented backwards.**

> *"units get accumulated from play"*

A unit that stands up in 2041 has a bare staff and no honours, and that is
correct — it has not done anything yet. History is earned in the century the
player is living through, which also means **the player's own tours are part
of the unit's lineage** for every soldier who comes after. Awards and
streamers are earned per §9.1, with permanent-versus-temporary wear making
"were you there" a fact the record keeps.

The one thing this costs: worldgen units start blank, so the earliest players
serve in units with no story. That is honest, and by 1990 it will not be true
any more.

**3. Peacetime gets things to do.** Answered in full at §10 — more schools per
branch, exercises, inspections, duty and details, instructor tours,
humanitarian missions, named people whose opinion of you compounds, and
promotion pressure felt month to month. With a measurement (§10.5) to catch
it if a decade of peace reads as ten identical years.
