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
  PRICE_STEPS,
  boardFor,
  booksFor,
  buyersForBusiness,
  ceilingReport,
  growthOffersFor,
  demandFromPricePerMille,
  insurancePremiumFor,
  opsFor,
  stockReport,
  vendorOffersFor,
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

/** What the owner can choose to leave in the business each month. */
const RETAIN_STEPS: readonly { readonly perMille: number; readonly title: string }[] = [
  { perMille: 0, title: 'Take it all' },
  { perMille: 300, title: 'Take most' },
  { perMille: 550, title: 'Split it' },
  { perMille: 800, title: 'Leave it in' },
]

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
          <div className="re-tile hot">
            <b>{formatMoney(business.capital)}</b>
            <span>In the business</span>
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

      {/* RUNNING IT. The month to month of it: what is on the shelf, who
          supplies you, what you charge, and what you do with what it makes.
          Every one of these is a real trade-off — none of them is simply
          good, which is what stops the screen being a row of upgrades. */}
      {(() => {
        const ops = opsFor(world)
        const stock = stockReport(world)
        if (ops === undefined) return null
        const vendors = vendorOffersFor(world)
        const priceLift = demandFromPricePerMille(ops.markupPerMille)
        return (
          <section className="career-card">
            <h4>Running it</h4>

            {stock !== undefined && stock.monthly > 0 && (
              <>
                <Row label="On the shelf" value={formatMoney(stock.held)} />
                <Row
                  label="That covers"
                  value={`${stock.monthsCovered.toFixed(1)} months of trading`}
                />
                {stock.held < stock.monthly && (
                  <p className="career-note bad">
                    Short of stock. You cannot serve the whole month, and the custom you turn
                    away goes to somebody else.
                  </p>
                )}
                <div className="biz-actions">
                  {stock.quotes.map((quote) => (
                    <button
                      key={quote.months}
                      type="button"
                      className="apply"
                      disabled={busy}
                      onClick={() => onAct({ verb: 'order-stock', months: quote.months })}
                    >
                      Order {String(quote.months)} month{quote.months === 1 ? '' : 's'} ·{' '}
                      {formatMoney(quote.cost)}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="apply"
                    disabled={busy || stock.held <= 0}
                    onClick={() => onAct({ verb: 'clear-stock' })}
                  >
                    Clear the stockroom
                  </button>
                </div>
              </>
            )}

            <h4 style={{ marginTop: '0.9rem' }}>Your supplier</h4>
            <Row label="Who" value={ops.vendorName} />
            <Row
              label="Their rate"
              value={`${String(Math.abs(Math.round(ops.vendorRatePerMille / 10) - 100))}% ${
                ops.vendorRatePerMille >= 1000 ? 'over' : 'under'
              } the going rate`}
            />
            <Row
              label="Their goods"
              value={
                ops.vendorQualityPerMille >= 1050
                  ? 'better than most'
                  : ops.vendorQualityPerMille >= 950
                    ? 'ordinary'
                    : 'people notice, and not kindly'
              }
            />
            <div className="biz-actions">
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 'haggle-vendor' })}
              >
                Haggle with them
              </button>
            </div>
            {vendors.length > 0 && (
              <ul className="openings">
                {vendors.map((vendor, at) => (
                  // Keyed by position as well as name: the engine now hands
                  // back distinct names, and a belt as well as braces costs
                  // nothing.
                  <li key={`${vendor.name}-${String(at)}`}>
                    <span className="o-title">
                      {vendor.name}
                      <span className="s">
                        {String(Math.abs(Math.round(vendor.ratePerMille / 10) - 100))}%{' '}
                        {vendor.ratePerMille >= 1000 ? 'over' : 'under'} the going rate ·{' '}
                        {vendor.qualityPerMille >= 1050
                          ? 'good goods'
                          : vendor.qualityPerMille >= 950
                            ? 'ordinary goods'
                            : 'shoddy goods'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="apply"
                      disabled={busy || vendor.name === ops.vendorName}
                      onClick={() => onAct({ verb: 'switch-vendor', name: vendor.name })}
                    >
                      Switch
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h4 style={{ marginTop: '0.9rem' }}>What you charge</h4>
            <div className="biz-chips">
              {PRICE_STEPS.map((step) => (
                <button
                  key={step.perMille}
                  type="button"
                  className={step.perMille === ops.markupPerMille ? 'on' : ''}
                  disabled={busy}
                  onClick={() => onAct({ verb: 'set-price', perMille: step.perMille })}
                >
                  {step.title}
                </button>
              ))}
            </div>
            <p className="career-note">
              {priceLift === 0
                ? 'The going rate — what everybody else in the trade charges.'
                : priceLift > 0
                  ? `About ${String(Math.round(priceLift / 10))}% more through the door, and less kept on each sale.`
                  : `About ${String(Math.abs(Math.round(priceLift / 10)))}% fewer through the door, and more kept on each sale.`}
            </p>

            <h4 style={{ marginTop: '0.9rem' }}>What you take out</h4>
            <div className="biz-chips">
              {RETAIN_STEPS.map((step) => (
                <button
                  key={step.perMille}
                  type="button"
                  className={step.perMille === ops.retainPerMille ? 'on' : ''}
                  disabled={busy}
                  onClick={() => onAct({ verb: 'set-retain', perMille: step.perMille })}
                >
                  {step.title}
                </button>
              ))}
            </div>
            <p className="career-note">
              {String(Math.round(ops.retainPerMille / 10))}% stays in as capital and{' '}
              {String(100 - Math.round(ops.retainPerMille / 10))}% comes to you as income. What
              stays in is what the business grows on.
            </p>
            {(() => {
              /**
               * WHAT THE DIAL ASKED FOR, AND WHAT ACTUALLY HAPPENED (owner,
               * playing: "The 'what you take out' option and the actual
               * books numbers are off way off, figure out why they dont read
               * the read numbers").
               *
               * They were not lying to each other — they were both right
               * about different things, which is worse, because nothing on
               * the screen said so. The dial sets what the business TRIES to
               * keep; the CEILING caps what it can hold. A business already
               * full keeps nothing however the dial is set, and every cent
               * is drawn instead. Measured: below the ceiling the two agree
               * exactly (80% asked, 80% retained); at it they diverge
               * completely.
               */
              const months = booksFor(world)?.months ?? []
              const last = months[months.length - 1]
              if (last === undefined || last.profit <= 0) return null
              const reallyKept = Math.round((last.retained * 100) / last.profit)
              const asked = Math.round(ops.retainPerMille / 10)
              if (Math.abs(reallyKept - asked) <= 2) return null
              const report = ceilingReport(world)
              return (
                <p className="career-note bad">
                  Last month it actually kept {String(reallyKept)}%, not {String(asked)}%.
                  {report !== undefined && report.capital >= report.ceiling
                    ? ` The business is full at ${formatMoney(report.ceiling)} — there is nowhere
                       to put the rest, so it comes to you instead. Buy more capacity under
                       “Growing it” to make room.`
                    : ' There was not room in the business for all of it.'}
                </p>
              )
            })()}
            <p className="career-note">
              The money in the business is what the business spends: stock, advertising, a
              refit, another set of rooms. Your own savings only reach it if you put them in.
            </p>
            <div className="biz-actions">
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() =>
                  onAct({ verb: 'invest-business', cents: Math.floor(business.capital / 4) })
                }
              >
                Put in {formatMoney(Math.floor(business.capital / 4) as Money)}
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy || business.capital <= 0}
                onClick={() =>
                  onAct({ verb: 'withdraw-business', cents: Math.floor(business.capital / 4) })
                }
              >
                Take out {formatMoney(Math.floor(business.capital / 4) as Money)}
              </button>
            </div>

            <h4 style={{ marginTop: '0.9rem' }}>The rest of it</h4>
            <div className="biz-actions">
              <button
                type="button"
                className="apply"
                disabled={
                  busy ||
                  (ops.advertisedUntilTick !== null && world.tick < ops.advertisedUntilTick)
                }
                onClick={() => onAct({ verb: 'advertise' })}
              >
                {ops.advertisedUntilTick !== null && world.tick < ops.advertisedUntilTick
                  ? 'The advertising is running'
                  : `Put the word out · ${formatMoney(Math.floor(business.capital / 20) as Money)}`}
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 'long-hours', on: !ops.longHours })}
              >
                {ops.longHours ? 'Go back to ordinary hours' : 'Open evenings and Sundays'}
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 'insure', on: !ops.insured })}
              >
                {ops.insured ? 'Stop the insurance' : 'Insure the place'} ·{' '}
                {formatMoney(insurancePremiumFor(business))}/mo
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy || ops.owedToYouCents <= 0}
                onClick={() => onAct({ verb: 'chase-debts' })}
              >
                {ops.owedToYouCents > 0
                  ? `Chase the ${formatMoney(ops.owedToYouCents)} owed you`
                  : 'Nobody owes you anything'}
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 'refit' })}
              >
                Smarten it up · {formatMoney(Math.floor(business.capital / 6) as Money)}
              </button>
            </div>
          </section>
        )
      })()}

      {/* THE BOOKS (the owner's business-financials.html). Real months,
          not a projection: the engine keeps a rolling two years per
          business, which is what Law 6 asks for — history summarised
          rather than a ledger kept for ever. */}
      {(() => {
        const books = booksFor(world)
        if (books === undefined || books.months.length === 0) {
          return (
            <section className="career-card">
              <h4>The books</h4>
              <p className="career-note">
                Nothing in them yet. A month of trading has to go by first.
              </p>
            </section>
          )
        }
        const { year, growthPerMille } = books
        return (
          <section className="career-card">
            <h4>The books · last {String(year.months)} months</h4>
            <div className="re-tiles">
              <div className="re-tile">
                <span>Takings</span>
                <b>{formatMoney(year.takings)}</b>
              </div>
              <div className="re-tile">
                <span>Wages</span>
                <b>{formatMoney(year.wages)}</b>
              </div>
              <div className={year.profit >= 0 ? 're-tile hot' : 're-tile'}>
                <span>Profit</span>
                <b>{formatMoney(year.profit)}</b>
              </div>
              <div className="re-tile">
                <span>Margin</span>
                <b>{(year.marginPerMille / 10).toFixed(0)}%</b>
              </div>
              <div className="re-tile">
                <span>You drew</span>
                <b>{formatMoney(year.drawn)}</b>
              </div>
              <div className="re-tile">
                <span>Left in</span>
                <b>{formatMoney(year.retained)}</b>
              </div>
            </div>
            <Row
              label="Year on year"
              value={
                books.months.length < 24
                  ? 'not enough history yet'
                  : `${growthPerMille >= 0 ? '+' : ''}${(growthPerMille / 10).toFixed(0)}%`
              }
            />
            <p className="career-note">
              What it takes, less what the staff cost, is what it made. What you drew is income;
              what was left in became capital, and capital is what the valuation is built on.
            </p>
          </section>
        )
      })()}

      {/* THE BOARD (the owner's business-investors.html). Not a mock
          meeting: institutions take a seat when they buy in, and the seat
          is a real gate on raising again. They read the books. */}
      {(() => {
        const board = boardFor(world)
        if (board === undefined || board.weightPerMille <= 0) return null
        return (
          <section className="career-card">
            <h4>The board</h4>
            <Row
              label="Seats hold"
              value={`${(board.weightPerMille / 10).toFixed(1)}% of the company`}
            />
            <Row label="On the next round" value={board.approves ? 'they would back it' : 'they would not'} />
            <p className="career-note">{board.reason}</p>
          </section>
        )
      })()}

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

{/* GROWING IT, THE FIVE WAYS. Capacity is the one that moves the wall —
    everything else decides whether you are the shop people go to. The
    names change with the trade: a salon takes on another chair, a shop
    takes on more room. */}
{(() => {
  const offers = growthOffersFor(world)
  const ceiling = ceilingReport(world)
  if (offers.length === 0) return null
  const room = ceiling === undefined ? 0 : ceiling.ceiling - ceiling.capital
  return (
    <section className="career-card">
      <h4>Growing it</h4>
      {ceiling !== undefined && (
        <>
          <Row
            label="As big as it can be"
            value={`${formatMoney(ceiling.capital)} of ${formatMoney(ceiling.ceiling)}`}
          />
          <div className="own-track" style={{ margin: '0.4rem 0 0.6rem' }}>
            <span
              className="own-fill"
              style={{
                width: `${String(Math.min(100, Math.round((ceiling.capital / Math.max(1, ceiling.ceiling)) * 100)))}%`,
              }}
            />
          </div>
          {room <= 0 && (
            <p className="career-note bad">
              It is as big as it can get. Take on more room, or it stops here however well you
              run it.
            </p>
          )}
        </>
      )}
      <ul className="openings">
        {offers.map((offer) => (
          <li key={offer.terms.kind} className={offer.bar === null ? undefined : 'is-shut'}>
            <span className="o-title">
              {offer.terms.title}
              {offer.taken > 0 && offer.terms.repeatable ? ` · ${String(offer.taken)} so far` : ''}
              <span className="s">{offer.terms.blurb}</span>
              <span className="s">
                {formatMoney(offer.cost)}
                {offer.terms.ceilingPerMille > 0
                  ? ` · raises the ceiling by ${String(offer.terms.ceilingPerMille / 1000)}×`
                  : ''}
                {offer.terms.upliftPerMille > 0
                  ? ` · +${String(Math.round(offer.terms.upliftPerMille / 10))}% a month`
                  : ''}
                {offer.terms.weightBonus > 0 ? ' · takes custom off rivals' : ''}
                {offer.terms.floorPerMille > 0 ? ' · steadies a bad month' : ''}
              </span>
              {offer.bar !== null && <span className="s bar">{offer.bar}</span>}
            </span>
            <button
              type="button"
              className="apply"
              disabled={busy || offer.bar !== null}
              onClick={() => onAct({ verb: 'grow-business', kind: offer.terms.kind })}
            >
              Do it
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
})()}

{/* GETTING OUT. Somebody who grew a business to its ceiling and could not
    sell it would simply be stuck with it, which was the owner's own
    objection. A rival in the trade pays more than a stranger, because
    taking you out is worth something beyond what you earn. */}
{(() => {
  const buyers = buyersForBusiness(world)
  return (
    <section className="career-card">
      <h4>Getting out</h4>
      {buyers.length === 0 ? (
        <p className="career-note">
          Nobody is buying just now. You can always shut it yourself.
        </p>
      ) : (
        <ul className="openings">
          {buyers.map((buyer) => (
            <li key={buyer.personId}>
              <span className="o-title">
                {buyer.firm ?? buyer.name}
                <span className="s">
                  {buyer.firm !== undefined
                    ? `an acquirer from away — they would put ${buyer.name} in to run it`
                    : buyer.rival
                      ? 'a rival in your trade — worth more to them than to anybody else'
                      : 'money in the town, looking for something to put it in'}
                </span>
              </span>
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 'sell-business', buyerId: buyer.personId })}
              >
                Sell for {formatMoney(buyer.offer)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="career-note">
        Backers are paid what they were promised before you see a penny. Sell for too little and
        there may be nothing left for you at all.
      </p>
      <div className="biz-actions">
        <button
          type="button"
          className="apply"
          disabled={busy}
          onClick={() => onAct({ verb: 'wind-down' })}
        >
          Shut it and take what is left
        </button>
      </div>
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
      {table !== undefined && table.shareholders.length > 0 && (
        <>
          <h4 style={{ marginTop: '0.9rem' }}>What was agreed</h4>
          <ul className="openings">
            {table.shareholders.map((holder) => (
              <li key={`terms-${holder.id}`}>
                <span className="o-title">
                  {holder.name}
                  <span className="s">
                    gets {(holder.preferencePerMille / 1000).toFixed(1)}× their money back before
                    anybody else
                  </span>
                  <span className="s">
                    {holder.boardSeat
                      ? 'holds a seat — raising again is their decision too'
                      : 'no seat: they own a share, not a say'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
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
