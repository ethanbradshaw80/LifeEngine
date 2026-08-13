# Business & Market Revamp — design contract

> Source material: thirteen design files supplied by the owner (business types,
> stock/cap table, expansion, valuation, integration, five HTML mockups, three
> reference docs) plus a market simulation file. **Those files are the
> specification, not the implementation** — every line is rewritten against this
> repository's constitution. See §6 for why.

---

## 1. Owner's rulings (2026-08-13)

### Ruling 1 — business types unlock over the decades, they are not trimmed

> *"Businesses should be able to populate over the years so if SaaS isn't in
> 1970 just make it available only after a certain year."*

Better than cutting the anachronisms. The town's economy **evolves across
generations**: a grandfather runs a filling station, his son a video rental
shop, his grandson a software company. Each business type carries an era
window, and the founding screen only offers what the year allows.

The flip side is required for the same reason: some types **retire**. A video
rental shop founded in 1985 is a good business; the same shop in 2010 is a
tragedy, and the simulation should be able to tell that story. A retired type
cannot be founded, and existing ones face a declining market rather than
vanishing (Law 6 — history is persistent; Law 7 — failure creates chapters).

**Era windows are a design choice, tuned for play, not sourced history.** They
are approximately right (microcomputers early 80s, consumer internet mid 90s)
but no claim is made to precision, and they live in one table so they are cheap
to re-tune.

### Ruling 2 — investors are BOTH real townspeople and generated firms

> *"we can do real townspeople but I also wanted to do generated firms"*

Scale decides which, which is also how it works in life:

| Round | Who | Money | Dies? |
|---|---|---|---|
| Seed / angel | **A real townsperson** — the dentist, the man who sold his hardware store | Leaves their wallet, to the cent | Yes — the stake passes to their heirs |
| Series A and beyond | **A generated firm** (fictional name, out of town) | Abstract institutional capital | No — but it can lose patience |

This is the best of both. A local angel makes the seed round a *relationship*:
you know them, they know you, they might be your wife's brother, and when they
die their children own a piece of your company. A Series B firm is correctly
faceless — it is an institution, and its board vote is a spreadsheet, not a
friendship.

**Board votes read from the voter.** A townsperson votes off their own
personality, values and their relationship with the founder. A firm votes off
metrics alone. Same interface, two very different tables.

### The era table (owner: adjust freely — this is the tuning dial)

Years are **calendar years** read from `toDate(world, tick).year`, not hardcoded
offsets, because a preset sets its own `startYear`. "—" means always available.

| Business | From | Retires | Note |
|---|---|---|---|
| Freelancer / consultant | — | — | The trade has no era |
| Food cart | — | — | |
| Repair shop | — | — | What it repairs changes; the shop does not |
| Beauty salon | — | — | |
| Tutoring | — | — | |
| Retail shop | — | — | |
| Restaurant | — | — | |
| Cleaning service | — | — | |
| Medical / dental practice | — | — | |
| Contracting firm | — | — | |
| Light manufacturing | — | — | |
| Logistics / haulage | — | — | |
| Real estate | — | — | Already partly built (H3 landlord layer) |
| Entertainment venue | — | — | |
| **Filling station** | — | — | *Added.* The 1970 main street |
| **Print shop** | — | ~2005 | *Added.* Dies to desktop publishing |
| **Feed store** | — | — | *Added.* Rural staple |
| **Typewriter & office machines** | — | ~1990 | *Added.* A business that ends |
| Fitness studio | ~1980 | — | The jogging boom |
| **Computer shop / software** | ~1980 | — | Microcomputer era |
| **Video rental** | ~1982 | ~2007 | Founded 1985 it is a good business; run to 2010 it is a tragedy |
| E-commerce | ~1996 | — | Needs the consumer internet |
| SaaS / subscription software | ~2002 | — | Needs always-on connections |

A **retiring** type is not deleted. It stops being offered at founding, and
existing ones face a declining market — the owner can sell, pivot or ride it
down. That arc is the whole reason to model retirement at all.

---

## 2. What already exists (to be confirmed by the code map, not assumed)

The engine already has businesses: founding, monthly revenue and profit,
closure, ownership recorded on a `Business` record, inheritance via
`passOnBusinesses`, and an NPC venture pass. **This module extends that; it
does not replace it.** The supplied files invent a parallel `IBusinessState`
with its own locations, valuation and dividends — adopting that wholesale would
leave two business systems that disagree, which is the exact failure mode the
housing ledger trio hit six times.

## 3. Scope, in build order

1. **Era-gated business types.** One table, each entry carrying its startup
   capital, return, COGS, licence, employee ceiling, seasonal curve, sector
   multiple, expansion path, and its `availableFrom` / `retiredAfter` years.
2. **Equity and the cap table.** Founder starts at 100%. Rounds dilute.
   Anti-dilution, liquidation preferences, board seats.
3. **The expansion ladder.** Second location → franchise → vertical
   integration → acquisition of a rival.
4. **Valuation and IPO.** Revenue multiple shaped by growth, margin and market
   position; snapshots over time; the IPO gate and the founder's payout.
5. **The market.** Real competitors with quality and strategy, price discovery,
   market share, failure — and **business formation**, so the market refills.
6. **The screens**, rebuilt to the owner's mockups.

## 4. Rules this module must obey (the ones the source files break)

- **Determinism (Law 11).** No `Date.now()`, no `Math.random()`. Every roll from
  a seeded stream; every id from the entity counter. The source files use both
  in about thirty places.
- **Integer money.** Cents and per-mille throughout. No floats, no percentages
  as decimals. All figures scale with `priceLevelPerMille` so a 1970 seed round
  and a 2020 one are both believable.
- **Immutability and the single writer.** `finances.ts` owns money; nothing
  else moves a balance. The source files mutate state in place.
- **The wallet (H0).** Every cent an investor puts in leaves their wallet;
  every dividend arrives in one. Conservation is testable and will be tested.
- **Real people.** Employees are townspeople with jobs, not an
  `employees: number`. A competitor going under puts real people out of work.

## 5. Known bugs in the supplied market file (do not port)

- **Market share is inverted.** `baseShare × (2 − p) × p` peaks at p = 1.0, so
  undercutting the market *loses* share. Shares also never normalise, so the
  town's demand is not conserved.
- **Healthy businesses price at zero.** The healthy branch multiplies price by
  `(100 − strategy) / 200`, which maxes at 0.5 — the strongest competitors
  would undercut everyone into oblivion.
- **`seededRandom` does not exist** in our `rng.ts` (we have `hash32` and
  `openStream`); the import is invented.
- **The market only ever shrinks.** Every NPC is founded at tick 0 and closes
  after three bad months, with nothing ever opening. Over 150 years the town
  empties.
- **Two different share formulas** in one file — the UI's and the simulation's
  disagree by construction.

## 6. Acceptance

- Founding offers only era-appropriate types; a retired type cannot be founded
  and existing ones decline rather than vanishing.
- A seed round moves money out of a named townsperson's wallet, to the cent,
  and their death passes the stake to their heirs.
- Cap table sums to 100% after any sequence of rounds; dilution is exact.
- Market shares across all participants sum to the town's demand, conserved.
- The market refills: founded and closed businesses both non-zero over 150
  years, and the count does not trend to zero.
- Employment is real: a closure puts named people out of work.
- Ledger agreement — business money reconciles with personal money to the cent.
