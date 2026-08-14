/**
 * THE BUSINESS TAB (the business revamp, to the owner's own
 * `business-tab-main.html`).
 *
 * ITS OWN DOOR, not a room inside Career. Running a business is not a
 * chapter of somebody's employment history — it has staff, a share
 * register, rivals in the same trade and three ways to grow, and the
 * owner's mockups put all of it behind one tab with a dashboard at the
 * top. Career keeps the job ladder; this keeps the firm.
 *
 * The dashboard row is the four numbers the mockup leads with: what it is
 * worth, what it clears, what share of your own share is left, and how
 * many people are on the books.
 */

import type { JSX } from 'react'
import {
  BUSINESS_KINDS,
  annualPay,
  annualRevenueOf,
  businessBar,
  atTodaysPrices,
  businessHealthWords,
  companyHeadcountOf,
  floatProceedsFor,
  founderSalaryOf,
  ipoBar,
  kindAvailableIn,
  moneyOnHand,
  scaleUpBar,
  toDate,
  valuationOf,
  businessKindById,
  candidatesForBusiness,
  employeesOf,
  expansionOffers,
  fullName,
  hireBar,
  monthlyProfitFor,
  nextRoundOffer,
  privateValuationOf,
  raiseBar,
  rivalsForSale,
  upliftPerMilleOf,
} from '@life-engine/engine'
import type { Business, Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { occupationById } from '@life-engine/engine'
import type { VerbRequest } from './engine.worker.js'

function Row({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className="career-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

export function BusinessTab({
  world,
  person,
  business,
  busy,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly business: Business | undefined
  readonly busy: boolean
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  /**
   * NOTHING OF YOUR OWN YET — so this is where you start one (owner: "we
   * should remove the business UI in the Careers tab and move it over to
   * our new business tabs to have everything in one place"). The list of
   * trades used to live on Career, which meant opening a business and
   * running one were behind two different doors.
   */
  if (business === undefined) {
    return (
      <div className="career">
        <section className="career-card">
          <h4>Working for yourself</h4>
          <p className="career-note">
            Capital out of your own savings, gone the moment it is spent. It rides the economy
            directly — worth more than a wage in a boom and worth less than nothing in a slump —
            and it can pass to your children.
          </p>
          {/* ONLY THE TRADES THAT EXIST THIS YEAR (the era ruling). A trade
              whose time has not come is not listed at all rather than
              listed and greyed; a trade whose time has PASSED is gone too,
              and the engine's own bar refuses it either way. */}
          <ul className="openings">
            {BUSINESS_KINDS.filter((entry) =>
              kindAvailableIn(entry, toDate(world, world.tick).year),
            ).map((entry) => {
              const capital = atTodaysPrices(world, entry.capital) as Money
              const shut = businessBar(
                entry,
                moneyOnHand(world, person.id),
                capital,
                false,
                99,
                toDate(world, world.tick).year,
              )
              return (
                <li key={entry.id} className={shut === null ? undefined : 'is-shut'}>
                  <span className="o-title">
                    {entry.title}
                    <span className="s">{formatMoney(capital)} to open</span>
                    {shut !== null && <span className="s bar">{shut}</span>}
                  </span>
                  <button
                    type="button"
                    className="apply"
                    disabled={busy || shut !== null}
                    onClick={() => onAct({ verb: 'start-business', kindId: entry.id })}
                  >
                    Open
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    )
  }

  const kind = businessKindById(business.kindId)
  const staff = employeesOf(world, business.id)
  const table = world.capTables.get(business.id)
  const clears = Math.floor((business.capital * (kind?.returnPerMille ?? 0)) / 1000 / 12)
  void monthlyProfitFor
  void upliftPerMilleOf
  void person

  return (
    <div className="career">
      {/* THE DASHBOARD, the four figures the owner's mockup leads with. */}
      <section className="career-card">
        <h4>{business.name}</h4>
        <div className="re-kfacts">
          <div>
            <b>{formatMoney(privateValuationOf(world, business))}</b>
            <span>Worth</span>
          </div>
          <div>
            <b>{formatMoney(clears as Money)}</b>
            <span>A month</span>
          </div>
          <div>
            <b>{((table?.founderPerMille ?? 1000) / 10).toFixed(0)}%</b>
            <span>Yours</span>
          </div>
          <div>
            <b>{String(staff.length)}</b>
            <span>On the books</span>
          </div>
        </div>
      </section>

<section className="career-card">
          <h4>{business.name}</h4>
          <Row
            label="Trade"
            value={businessKindById(business.kindId)?.title ?? business.kindId}
          />
          <Row label="Capital in it" value={formatMoney(business.capital)} />
          <Row label="How it is going" value={businessHealthWords(business)} />
          {business.generations > 0 && (
            <Row
              label="Passed down"
              value={`${String(business.generations)} ${business.generations === 1 ? 'time' : 'times'}`}
            />
          )}
          <p className="career-note">
            What it makes is drawn as income each month; what it loses comes out of the capital
            first. Three bad months in a row and the doors shut.
          </p>
        </section>

      {/* THE COMPANY AND THE IPO, built from the owner's careers.html
          third screen: a valuation hero, four figures in a grid, and
          the offering with its rows and its one big button.

          TOKENS ARE THE APP'S, not the mockup's. The mockup is dark
          only and names --green/--gold/--panel2, none of which exist
          here; the equivalents (--ok, --gold, --panel-raised) are all
          defined for light AND dark, which is the mistake that made
          the school screen unreadable in daylight. */}
      {kind !== undefined ? (
        business.scaledAtTick != null ? (
          <section className="co">
            <div className="co-val">
              <div className="k">Estimated valuation</div>
              <div className="v">{formatMoney(valuationOf(business, kind))}</div>
              <div className="g">
                {business.listedStockId != null
                  ? 'Public — the market prices it now'
                  : `${String(Math.floor((world.tick - (business.scaledAtTick ?? 0)) / 12))} years as a company`}
              </div>
            </div>
            <div className="co-grid">
              <div className="kv">
                <div className="k">Annual revenue</div>
                <div className="v">
                  {formatMoney(annualRevenueOf(business, kind))}
                </div>
              </div>
              <div className="kv">
                <div className="k">Your ownership</div>
                <div className="v">
                  {String(Math.floor((business.founderStakePerMille ?? 1000) / 10))}%
                </div>
              </div>
              <div className="kv">
                <div className="k">Your salary</div>
                <div className="v">
                  {formatMoney(annualPay(founderSalaryOf(business, kind)))}
                </div>
              </div>
              <div className="kv">
                <div className="k">Employees</div>
                <div className="v">
                  {String(companyHeadcountOf(business, kind))}
                </div>
              </div>
            </div>

            {business.listedStockId == null ? (
              (() => {
                const shut = ipoBar(world, person.id)
                const valuation = valuationOf(business, kind)
                return (
                  <div className={`ipo${shut === null ? '' : ' locked'}`}>
                    <h3>Take the company public</h3>
                    <p>
                      You would sell a slice to the public, keep control, and turn your
                      ownership into tradable shares.
                    </p>
                    <div className="row">
                      <span>Sell to the public</span>
                      <span className="v">30%</span>
                    </div>
                    <div className="row">
                      <span>Cash to you (est.)</span>
                      <span className="v ok">{formatMoney(floatProceedsFor(valuation))}</span>
                    </div>
                    <div className="row">
                      <span>Your remaining stake</span>
                      <span className="v">
                        70% · {formatMoney(Math.floor((valuation * 700) / 1000) as Money)}
                      </span>
                    </div>
                    {shut !== null && <div className="reason">🔒 {shut}</div>}
                    <button
                      type="button"
                      disabled={busy || shut !== null}
                      onClick={() => onAct({ verb: 'take-public' })}
                    >
                      Take {business.name} public (IPO)
                    </button>
                  </div>
                )
              })()
            ) : (
              <p className="career-note">
                Public — the market prices it now, and what you kept is on the Market tab.
              </p>
            )}
          </section>
        ) : (
          <section className="career-card">
            <h4>Grow it into a company</h4>
            <p className="career-note">
              A company has a valuation, a salary instead of a draw, and a ceiling far above a
              trade&apos;s. It is the road to taking it public.
            </p>
            {scaleUpBar(business, kind, world.tick) !== null && (
              <p className="career-note">{scaleUpBar(business, kind, world.tick)}</p>
            )}
            <button
              type="button"
              className="apply"
              disabled={busy || scaleUpBar(business, kind, world.tick) !== null}
              onClick={() => onAct({ verb: 'scale-up' })}
            >
              Grow it into a company
            </button>
          </section>
        )
      ) : null}

      {/* GROWING IT (the expansion ladder). Every rung asks for years
    at the wheel, a run of good months and the money — and each
    one is bought once and changes how the business earns from
    then on. This is what raising money is FOR. */}
{(() => {
  const offers = expansionOffers(world)
  if (offers.length === 0) return null
  return (
    <section className="career-card">
      <h4>Growing it</h4>
      <ul className="openings">
        {offers.map((offer) => (
          <li
            key={offer.terms.kind}
            className={offer.bought || offer.bar === null ? undefined : 'is-shut'}
          >
            <span className="o-title">
              {offer.terms.title}
              <span className="s">{offer.terms.blurb}</span>
              <span className="s">
                {formatMoney(offer.cost)} · adds{' '}
                {(offer.terms.upliftPerMille / 10).toFixed(0)}% to the month
              </span>
              {!offer.bought && offer.bar !== null && (
                <span className="s bar">{offer.bar}</span>
              )}
            </span>
            {offer.bought ? (
              <span className="s">Done</span>
            ) : (
              <button
                type="button"
                className="apply"
                disabled={busy || offer.bar !== null}
                onClick={() =>
                  onAct({ verb: 'expand-business', kind: offer.terms.kind })
                }
              >
                Do it
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
})()}

{/* THE RIVALS. The town's custom in a trade is a fixed thing
    that gets divided, so one shop winning is another losing.
    Buying one out is real money to a real person, and what
    they built folds into yours. */}
{(() => {
  const rivals = rivalsForSale(world)
  if (rivals.length === 0) return null
  return (
    <section className="career-card">
      <h4>Others in your trade</h4>
      <p className="career-note">
        The town only has so much custom for {businessKindById(business.kindId)?.title ?? 'this'}.
        Every one of these is taking a share of it.
      </p>
      <ul className="openings">
        {rivals.map((rival) => (
          <li
            key={rival.business.id}
            className={rival.bar === null ? undefined : 'is-shut'}
          >
            <span className="o-title">
              {rival.business.name}
              <span className="s">
                capital {formatMoney(rival.business.capital)} ·{' '}
                {businessHealthWords(rival.business)}
              </span>
              {rival.bar !== null && <span className="s bar">{rival.bar}</span>}
            </span>
            <button
              type="button"
              className="apply"
              disabled={busy || rival.bar !== null}
              onClick={() => onAct({ verb: 'buy-rival', rivalId: rival.business.id })}
            >
              Buy for {formatMoney(rival.price)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
})()}

{/* WHO OWNS IT (owner's ruling: real townspeople AND generated
    firms). A trade nobody has backed shows the register at a
    thousand per-mille and an offer; once somebody buys in, they
    own a piece of every month the business ever has. */}
{(() => {
  const table = world.capTables.get(business.id)
  const offer = nextRoundOffer(world)
  const shut = raiseBar(world)
  const founder = table?.founderPerMille ?? 1000
  return (
    <section className="career-card">
      <h4>Who owns it</h4>
      <Row label="Your share" value={`${(founder / 10).toFixed(1)}%`} />
      <Row
        label="What it is worth"
        value={formatMoney(privateValuationOf(world, business))}
      />
      {table !== undefined && table.shareholders.length > 0 && (
        <ul className="openings">
          {table.shareholders.map((holder) => (
            <li key={holder.id}>
              <span className="o-title">
                {holder.name}
                <span className="s">
                  {(holder.perMille / 10).toFixed(1)}% ·{' '}
                  {holder.personId === null ? 'a firm' : 'in the town'}
                  {holder.boardSeat ? ' · board seat' : ''} · put in{' '}
                  {formatMoney(holder.investedCents)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {offer === undefined ? (
        <p className="career-note">
          There is nothing further to sell. What it earns is yours and your backers&apos;.
        </p>
      ) : (
        <>
          <p className="career-note">
            {offer.terms.round === 'seed'
              ? 'A backer in the town would put money in for a slice of it — somebody you know, whose children will own their share after them.'
              : 'A firm from outside would put money in for a slice, and take a seat at the table with it.'}
          </p>
          <Row
            label={`Raise · ${offer.terms.title}`}
            value={`${formatMoney(offer.amount)} for ${(offer.terms.perMille / 10).toFixed(1)}%`}
          />
          {shut !== null && <p className="career-note">{shut}</p>}
          <button
            type="button"
            className="apply"
            disabled={busy || shut !== null}
            onClick={() => onAct({ verb: 'raise-capital' })}
          >
            Sell {(offer.terms.perMille / 10).toFixed(1)}% for {formatMoney(offer.amount)}
          </button>
        </>
      )}
    </section>
  )
})()}

{/* THE PEOPLE WHO WORK FOR YOU (owner: "expanding like adding
    employees and stuff should 100% be user controlled").

    The town's own businesses staff themselves in the background.
    Yours does not — taking somebody on is a decision with a name
    and a wage against it, so it belongs here. The wage shown is
    the wage you pay: the engine draws it once and the button
    spends exactly that. */}
{(businessKindById(business.kindId)?.maxEmployees ?? 0) > 0 && (
  <section className="career-card">
    <h4>Who works for you</h4>
    {(() => {
      const kind = businessKindById(business.kindId)
      const staff = employeesOf(world, business.id)
      const wages = staff.reduce(
        (sum, id) => sum + (world.employment.get(id)?.monthlyPay ?? 0),
        0,
      )
      const clears = Math.floor(
        (business.capital * (kind?.returnPerMille ?? 0)) / 1000 / 12,
      )
      return (
        <>
          <Row
            label="On the books"
            value={`${String(staff.length)} of ${String(kind?.maxEmployees ?? 0)}`}
          />
          <Row label="Wages a month" value={formatMoney(wages as Money)} />
          <Row label="The month clears" value={formatMoney(clears as Money)} />
          {staff.length === 0 ? (
            <p className="career-note">
              You run it alone. Somebody on the books earns more than they cost in a
              good month — and is paid just the same in a bad one.
            </p>
          ) : (
            <ul className="openings">
              {staff.map((id) => {
                const job = world.employment.get(id)
                return (
                  <li key={id}>
                    <span className="o-title">
                      {(() => { const p = world.people.get(id); return p ? fullName(p) : 'somebody' })()}
                      <span className="s">
                        {occupationById(job?.occupationId ?? '').title} ·{' '}
                        {formatMoney((job?.monthlyPay ?? 0) as Money)}/mo
                      </span>
                    </span>
                    <button
                      type="button"
                      className="apply"
                      disabled={busy}
                      onClick={() => onAct({ verb: 'let-go', employeeId: id })}
                    >
                      Let go
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <h4 style={{ marginTop: '0.9rem' }}>Looking for work</h4>
          {(() => {
            const candidates = candidatesForBusiness(world, business.id)
            if (candidates.length === 0) {
              return <p className="career-note">Nobody in town is looking just now.</p>
            }
            return (
              <ul className="openings">
                {candidates.map((candidate) => {
                  const shut = hireBar(world, candidate.personId)
                  return (
                    <li
                      key={candidate.personId}
                      className={shut === null ? undefined : 'is-shut'}
                    >
                      <span className="o-title">
                        {(() => { const p = world.people.get(candidate.personId); return p ? fullName(p) : 'somebody' })()}
                        <span className="s">
                          {occupationById(candidate.occupationId).title} · asks{' '}
                          {formatMoney(candidate.monthlyPay)}/mo
                        </span>
                        {shut !== null && <span className="s bar">{shut}</span>}
                      </span>
                      <button
                        type="button"
                        className="apply"
                        disabled={busy || shut !== null}
                        onClick={() =>
                          onAct({ verb: 'hire-staff', candidateId: candidate.personId })
                        }
                      >
                        Take on
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          })()}
        </>
      )
    })()}
  </section>
)}
    </div>
  )
}
