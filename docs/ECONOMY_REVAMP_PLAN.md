# Economy & Money Revamp — findings and plan

> Owner's report, 2026-08-15, playing with his brother:
>
> *"its kind really easy to make money and feels unrealistic, military pay is
> absolute shit compared to pretty much any job, I get a random Lifestyle · the
> life between rent and the bank which doesnt even say what the charge really
> is but its always super high, the month stats dont even really add up... Net
> worth isn't counting all our assest... it doesnt list what we have as assest
> it just says 'everything you own'... the +money amount per month isnt even
> accurate either because ill click advance one month and make way more than it
> says... my brother and I have been playing and he hit 1 trillion dollar net
> worth in 110 years by just doing businesses. Along with this once you get
> money like that theres nothing to really do, houses run out."*

Every number below is **measured**, not reasoned. Where something could not be
reproduced it says so plainly rather than guessing.

---

## 1. What is actually wrong

### BUG 1 — the monthly chip is 13.7× out (his "+money per month isnt accurate")

**MEASURED.** A player with a shop, 24 months in:

| | |
|---|---|
| chip promised | **$522.55** |
| wallet actually moved | **$7,152.87** |
| gap | **$6,630.32** |

Four months running, same shape. Two separate causes:

- **The business draw is missing.** `personalIncome` in `finances.ts` is
  wage + service pay + sports + pensions, and nothing else.
  `businessDrawOf` is *deliberately* excluded — and the comment explaining
  why is correct: `runBusinesses` has already credited that money, so adding
  it there would pay the draw twice, "the exact shape of the shadow-ledger
  bugs this codebase has now had seven times."
  **The reasoning is sound and the conclusion was half-applied.** It is right
  to keep the draw out of the *crediting* path. Nobody added it back to the
  *display* path, so the projection cannot see a third of his income.
- **Investment income is missing entirely.** The gap ($6,630) is far larger
  than the draw ($1,810). The remainder is interest on savings — at $4.6M in
  the bank, roughly $4,800 a month that no projection models.

**This is the single worst bug in the list**, because it silently teaches the
player that the game's numbers cannot be trusted.

### BUG 2 — military pay was calibrated against a world that no longer exists

**MEASURED**, against the tables as they stand:

| | |
|---|---|
| E-9 (top enlisted, 20+ year career) | **$985/mo** |
| O-6 (colonel) | **$1,475/mo** |
| career ladders topping out **above a colonel** | **71 of 74** |
| individual rungs paying more than a colonel | **146 of 310** |
| ladder **entry** rungs beating an E-9 | **10** |
| median ladder top | **$2,250/mo** |

Against the *old* 47-occupation town table only **12 of 47** beat a colonel,
and they were the genuine summits — chief executive, chief of medicine,
doctor. The military table was priced correctly against that world.

**This is a regression from the jobs module, and it is mine.** 310 rungs were
poured in around a pay table nobody re-checked. He is right, and the cause is
recent.

### BUG 3 — there is no military compensation model at all

`finances.ts` never once mentions `isServing`. No quarters, no rations, no
housing allowance. **A soldier pays full market rent and full lifestyle
spending exactly like a civilian.**

In life, roughly a third of enlisted compensation is untaxed housing and
subsistence, plus healthcare and a pension at twenty years. The game gives the
cash wage and nothing else, so service is far poorer here than in reality —
which is most of why it *feels* punishing beyond what BUG 2 explains.

### BUG 4 — "Lifestyle" is unbounded, and that is why it is always huge

`discretionaryForUnit` spends **83.7%–92% of ALL surplus above basics**, at
every income, for ever. The savings rate never rises with income.

- At $5,000/mo surplus, lifestyle is ~$4,300.
- At $1,000,000/mo surplus, lifestyle is ~$860,000.

Real discretionary spending saturates — people do not spend 86% of a million
a month on "the life between rent and the bank." It was written to fix the
opposite problem (a working couple banking 80% of income and a six-year-old's
family holding $414,605 by 1977) and it overcorrected into a percentage that
never stops scaling.

His second complaint about it is separate and also fair: **the line does not
say what it is.** "The life between rent and the bank" is a description of a
category, not of a charge.

### BUG 5 — business growth is additively unbounded (the $1 trillion)

Two multiplying pieces with no ceiling between them:

```
upliftPerMilleOf = list.reduce((sum, e) => sum + e.upliftPerMille, 0)   // no cap
privateValuationOf = assets + annualProfit × EARNINGS_MULTIPLE (8)
```

Every expansion adds its uplift **permanently and additively** (+55% a second
location, +40% a supply chain, and so on). Uplift raises profit; valuation is
eight times annual profit. Expansions and acquisitions have no limit, so
profit compounds, valuation compounds on top of it, and an heir inherits the
compounding rather than restarting it.

`CAPITAL_CEILING_MULTIPLE = 4` caps the *till*. Nothing caps the *earnings*,
and earnings are what the valuation is eight times of.

### NOT REPRODUCED — net worth (his complaints 5 and 6)

Stated honestly: **I could not reproduce either, and both need his save.**

- `netWorthOf` already includes the property portfolio and the business share.
  My probe's arithmetic balanced exactly: $4,645,724 cash + $108,953 property
  + $444,119 business − $44,774 debt = $5,154,022.
- `Bank.tsx` already itemises — cash, investments, retirement, property with a
  count, business share, then the total.

Two live hypotheses, both cheap to check against a real save:

1. **The married-wallet share.** `liquidShareOf` returns only *his* share of a
   couple's single pot (the H0 model). If he is married, the headline may be
   showing roughly half the household's cash while he is mentally counting all
   of it. This is the same shape as the header-vs-Bank disagreement already
   fixed once.
2. **He is reading a different screen.** The itemisation is on the Bank tab;
   the home tab's money section is a different, thinner component.

**Ask before building:** which screen, and is that character married?

---

## 2. The plan

Ordered by *damage to the player's trust*, not by difficulty.

### Phase 1 — make the numbers honest (no balance changes)

Nothing here changes how much money exists. It changes what the game *says*,
which is the part he cannot currently trust.

1. **One function computes a month, and every screen reads it.** Introduce a
   single `monthAheadFor(world, personId)` returning an itemised projection —
   wage, draw, rent received, interest, minus costs, lifestyle, tax. The chip,
   the Bank tab and the ledger all read it. The crediting path stays exactly
   where it is; this is a *forecast*, and the two must be tested against each
   other.
2. **A test that fails on drift.** Project the month, advance one tick, assert
   the wallet moved by the projection ±1 cent. This is the test that would have
   caught BUG 1 the day it appeared, and it must cover a player with a
   business, a tenant and savings — the three sources currently invisible.
3. **Name every ledger line in plain words.** "Lifestyle" becomes what it
   actually is, with the rate shown: *"Day-to-day living — 86% of what's left
   after the bills."* Replace "the roof" with "household".
4. **Itemise net worth wherever it appears**, and settle the married-wallet
   question — if the headline is a half-share, say so on the line.

### Phase 2 — make wealth mean something (the balance work)

5. **Lifestyle saturates.** Keep the current percentage at ordinary incomes and
   taper it above a comfortable standard of living, so the savings rate rises
   with income the way it does in life. A cap in absolute terms per adult, not
   a flat percentage for ever.
6. **Cap compounding growth.** Give `upliftPerMilleOf` diminishing returns —
   each further expansion worth less than the last — and a hard ceiling. A
   second location should be transformative; a ninth should not.
7. **Re-price the uniform against the world that now exists**, and build the
   compensation model that is missing: quarters (no rent while serving),
   rations, and the twenty-year pension counted where a player can see it.
   The comparison to beat is a real one — an E-7 should live like a skilled
   tradesman, not like a shop clerk.

### Phase 3 — somewhere for the money to go

His question: *"there is no way to really spend this amount of money either we
neeed ideas for that too."*

The principle worth holding: **a money sink should buy a story, not a number.**
Anything that just raises an attribute is a bigger number in a game that
already has too many.

- **Property that scales with wealth.** He is right that houses run out. Estates,
  land, a second home in another town, commercial buildings that carry real
  tenants. The real-estate module already models tenants and upkeep.
- **Buy the town's businesses outright.** The acquisition machinery exists; what
  is missing is being able to *hold a portfolio* of other people's trades and
  live off them.
- **Philanthropy with consequences.** Endow the school, the hospital wing, the
  library. It should visibly change the town — the school's outcomes, the
  hospital's survival rates — and put the family name on a building that
  outlives the character. This one is worth the most: it is the only sink on
  this list that speaks to Law 8, legacy.
- **Politics.** Money into a campaign, for the character or a family member.
  The government module exists.
- **Patronage of people.** Pay a promising townsperson's tuition; back a
  friend's business. Relationships and businesses both already exist.
- **The things that cost money to keep**: a stable, a boat, an aircraft, an art
  collection — each with real upkeep, so wealth becomes a *rate* to sustain
  rather than a pile to sit on.
- **A family trust.** Money that survives the estate, with rules the player sets
  for heirs. Directly serves the generational play the whole game is built on.

---

## 3. What I need from him before Phase 1 finishes

1. **His save file**, or the answers to: which screen showed the wrong net
   worth, and was that character married?
2. **A ruling on Phase 2's aggressiveness.** Capping growth and taming lifestyle
   will make money materially harder to accumulate. That is the stated goal —
   but it is his game, and "harder" has a floor below which it stops being fun.
3. **Which money sinks he actually wants**, in what order. The list above is
   seven suggestions; building all of them is a module of its own.

---

## 4. Order of work

| Step | What | Risk |
|---|---|---|
| 1 | `monthAheadFor` + the drift test | low — display only |
| 2 | Ledger wording, itemised net worth | low |
| 3 | Military compensation model + reprice | medium — moves goldens |
| 4 | Lifestyle saturation | **high** — touches every household |
| 5 | Growth ceilings | **high** — touches every business |
| 6 | Money sinks | new content |

Steps 4 and 5 are where the town can be broken. Both get measured before and
after against `invariants.test.ts` and `demographics.test.ts`, the way the
ladder share was — the two-in-five collapse is the standing warning.
