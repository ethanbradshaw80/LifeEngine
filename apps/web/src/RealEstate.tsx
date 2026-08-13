/**
 * The property marketplace, built to the owner's `real_estate.html`.
 *
 * Two screens, as the mockup has them: a browse list with a buy/rent toggle
 * and filters, and a full property page you reach by tapping a card.
 *
 * ON THE PICTURES. The spec is honest about this and so is the code: a
 * unique image per listing is not feasible, so the illustrations are
 * TYPE-KEYED and reusable — one drawing per kind of home, tinted by its
 * neighbourhood's desirability. Four drawings cover every listing in the
 * game and it reads as real because the attributes underneath it are real.
 */

import { useState } from 'react'
import type { Property, World } from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import {
  accountsOf,
  creditOf,
  creditWords,
  depositFor,
  depositShareFor,
  downPaymentFor,
  equityOf,
  leaseOf,
  listingsFor,
  monthlyPaymentFor,
  moveBackInBar,
  offeredRatePerMille,
  ownershipCostOf,
  propertiesOwnedBy,
  refinanceBar,
  rentalIncomeOf,
  rentOf,
  saleProceedsOf,
  trendOf,
  trendWords,
  valueOf,
} from '@life-engine/engine'
import type { VerbRequest } from './engine.worker.js'

/**
 * THE LISTING, WRITTEN OUT (Verdant layer, owner's screenshots): every home
 * gets a sentence or two in the game's own voice — no DEAL! tags, no ad
 * copy, just what an honest agent would say. Deterministic off the
 * property's own attributes, so the same door always reads the same.
 */
function listingWords(property: Property, desirability: number): string {
  const opener =
    property.type === 'estate'
      ? 'A serious house, and it knows it.'
      : property.type === 'apartment' || property.type === 'condo'
        ? 'A set of rooms that asks very little of you.'
        : property.type === 'townhouse'
          ? 'A tall, narrow house holding its neighbours up.'
          : property.beds >= 4
            ? 'A family house with room to grow into.'
            : 'A modest house that keeps the rain out.'
  const shape =
    property.condition >= 820
      ? 'Kept the way houses are supposed to be kept.'
      : property.condition >= 640
        ? 'Sound under the paint; nothing here will surprise you.'
        : property.condition >= 440
          ? 'Honest wear — a weekend here and there will hold it.'
          : property.condition >= 240
            ? 'It needs work, and the price already admits it.'
            : 'A project. Walk it with somebody who knows joists.'
  const street =
    desirability >= 780
      ? 'The street is the kind people aim for.'
      : desirability >= 560
        ? 'A good street that keeps to itself.'
        : desirability >= 340
          ? 'The street is a mix, like most streets.'
          : 'The street has seen better decades — which is what the money buys.'
  return `${opener} ${shape} ${street}`
}

/** Condition in words. "641" tells a buyer nothing; "good repair" does. */
function conditionWords(condition: number): string {
  if (condition >= 820) return 'Excellent'
  if (condition >= 640) return 'Good condition'
  if (condition >= 440) return 'Fair'
  if (condition >= 240) return 'Needs work'
  return 'Fixer-upper'
}

/** How a neighbourhood reads, in the words the mockup uses. */
function desirabilityWords(desirability: number): string {
  if (desirability >= 780) return 'High'
  if (desirability >= 560) return 'Good'
  if (desirability >= 340) return 'Mixed'
  return 'Low'
}

/**
 * A drawing per kind of home, tinted by the street it stands on.
 *
 * Deliberately simple shapes rather than attempted realism — a flat little
 * illustration reads as a deliberate style, where a bad attempt at a photo
 * reads as a broken image.
 */
function Illustration({
  type,
  desirability,
  tall,
}: {
  readonly type: Property['type']
  readonly desirability: number
  readonly tall?: boolean
}): React.ReactElement {
  const hue = desirability >= 700 ? 150 : desirability >= 500 ? 215 : desirability >= 320 ? 280 : 20
  const roof = `hsl(${String(hue)}, 22%, 46%)`
  const wall = `hsl(${String(hue)}, 20%, 36%)`
  const dark = `hsl(${String(hue)}, 24%, 18%)`
  const h = tall === true ? 168 : 108
  return (
    <svg className="prop-art" viewBox="0 0 380 120" height={h} preserveAspectRatio="xMidYMid slice">
      <rect width="380" height="120" fill={dark} opacity="0.55" />
      {type === 'estate' ? (
        <>
          <polygon points="90,42 290,42 315,64 65,64" fill={roof} />
          <rect x="82" y="64" width="216" height="46" fill={wall} />
          <rect x="104" y="76" width="26" height="26" fill={dark} />
          <rect x="168" y="76" width="26" height="26" fill={dark} />
          <rect x="232" y="76" width="26" height="26" fill={dark} />
        </>
      ) : type === 'apartment' || type === 'condo' ? (
        <>
          <rect x="120" y="30" width="140" height="80" fill={wall} />
          <rect x="120" y="30" width="140" height="14" fill={roof} />
          <rect x="136" y="54" width="24" height="24" fill={dark} />
          <rect x="220" y="54" width="24" height="24" fill={dark} />
          <rect x="178" y="62" width="26" height="48" fill={dark} />
        </>
      ) : type === 'townhouse' ? (
        <>
          <rect x="118" y="38" width="66" height="72" fill={wall} />
          <rect x="196" y="38" width="66" height="72" fill={wall} />
          <rect x="118" y="38" width="144" height="12" fill={roof} />
          <rect x="136" y="60" width="24" height="24" fill={dark} />
          <rect x="214" y="60" width="24" height="24" fill={dark} />
        </>
      ) : (
        <>
          <polygon points="128,42 252,42 274,64 106,64" fill={roof} />
          <rect x="126" y="64" width="128" height="46" fill={wall} />
          <rect x="144" y="76" width="24" height="24" fill={dark} />
          <rect x="212" y="76" width="24" height="24" fill={dark} />
          <rect x="180" y="82" width="24" height="28" fill={dark} />
        </>
      )}
    </svg>
  )
}

export function RealEstate({
  world,
  personId,
  cash,
  hasLease,
  onAct,
}: {
  readonly world: World
  readonly personId: number
  readonly cash: number
  readonly hasLease: boolean
  readonly onAct: (action: VerbRequest) => void
}): React.ReactElement {
  const [open, setOpen] = useState<string | null>(null)
  const [downPerMille, setDownPerMille] = useState<number>(0)

  const mine = propertiesOwnedBy(world, personId as never)
  const all = listingsFor(world)
  const detail = open === null ? null : (all.find((l) => l.property.id === open) ?? null)
  const credit = creditOf(world, personId as never)
  const rate = offeredRatePerMille(world, credit, 'mortgage')
  const minSharePerMille = depositShareFor(credit)
  const accounts = accountsOf(world, personId as never)
  const myMortgage = accounts.loans.find((l) => l.kind === 'mortgage')

  /** The household actually living in a property, if it is not the player's. */
  const tenantOf = (propertyId: string) => {
    for (const household of world.households.values()) {
      if (household.dissolvedTick !== null || household.propertyId !== propertyId) continue
      if (household.memberIds.includes(personId as never)) return undefined
      return household
    }
    return undefined
  }

  /** Whether this deed is the roof over the player's own head. */
  const livedIn = (propertyId: string) => {
    const person = world.people.get(personId as never)
    const household = person?.householdId === null || person === undefined
      ? undefined
      : world.households.get(person.householdId)
    return household?.propertyId === propertyId
  }

  // ---- THE PROPERTY PAGE (More Info) --------------------------------------
  if (detail !== null) {
    const { property, price } = detail
    const place = world.places.get(property.neighbourhoodPlaceId)
    // THE FLOOR IS YOUR FILE'S (housing spec): the bank names the minimum
    // down off the credit score, the same number the loan door checks.
    const floor = depositFor(price as never, credit)
    const share = Math.max(minSharePerMille, downPerMille)
    const down = downPaymentFor(price as never, share, floor as never)
    const borrowed = Math.max(0, price - down)
    const monthly = monthlyPaymentFor(borrowed as never, rate, 360)
    const cost = ownershipCostOf(world, property, monthly)
    const trend = trendOf(world, property.neighbourhoodPlaceId, world.tick)

    return (
      <div className="re2">
        <button type="button" className="re-back" onClick={() => setOpen(null)}>
          ‹ Back to the portfolio
        </button>
        <div className="re-hero">
          <Illustration type={property.type} desirability={place?.desirability ?? 500} tall />
        </div>
        <div className="re-hero-price">
          <b>{formatMoney(price)}</b>
          <span>Est. {formatMoney(cost.total as never)}/mo</span>
        </div>

        <section className="re-sec">
          <div className="re-addr">{property.address}</div>
          <div className="re-hood">
            {place?.name ?? 'town'} · {property.type} · built {property.yearBuilt}
          </div>
          <p className="re-blurb">{listingWords(property, place?.desirability ?? 500)}</p>
          <div className="re-kfacts">
            <div><b>{property.beds}</b><span>Beds</span></div>
            <div><b>{property.baths}</b><span>Baths</span></div>
            <div><b>{property.sqft.toLocaleString()}</b><span>Sqft</span></div>
          </div>
        </section>

        {detail.forSale && (
          <section className="re-sec">
            <h4>The numbers</h4>
            <div className="re-tiles">
              <div className="re-tile hot"><span>Price</span><b>{formatMoney(price)}</b></div>
              <div className="re-tile hot"><span>Down payment</span><b>{formatMoney(down as never)} ({(share / 10).toFixed(0)}%)</b></div>
              <div className="re-tile"><span>Mortgage rate</span><b>{(rate / 10).toFixed(1)}%/yr</b></div>
              <div className="re-tile"><span>Est. monthly</span><b>{formatMoney(cost.total as never)}</b></div>
              <div className="re-tile"><span>Market rent</span><b>{formatMoney(detail.monthlyRent)}/mo</b></div>
              <div className="re-tile"><span>Market trend</span><b>{trendWords(trend)}</b></div>
            </div>
            <h4>Your month, itemized</h4>
            <div className="re-slider-label">
              Down payment · {(share / 10).toFixed(0)}% ({formatMoney(down as never)})
            </div>
            {/* THE SLIDER IS THE CHOICE the spec asks for: more down means a
                smaller payment and less interest, at the cost of everything
                no longer in the bank. The bank's own minimum is the floor. */}
            <input
              className="re-slider"
              type="range"
              min={minSharePerMille}
              max={800}
              step={50}
              value={share}
              onChange={(e) => setDownPerMille(Number(e.target.value))}
            />
            <div className="re-row">
              <span>Mortgage rate · credit {credit} ({creditWords(credit)})</span>
              <b>{(rate / 10).toFixed(1)}%/yr</b>
            </div>
            <div className="re-row"><span>Mortgage (30-yr)</span><b>{formatMoney(cost.mortgage)}</b></div>
            <div className="re-row"><span>Property tax</span><b>{formatMoney(cost.propertyTax)}</b></div>
            <div className="re-row"><span>Insurance</span><b>{formatMoney(cost.insurance)}</b></div>
            {cost.hoa > 0 && (
              <div className="re-row"><span>Service charge</span><b>{formatMoney(cost.hoa)}</b></div>
            )}
            <div className="re-row"><span>Upkeep</span><b>{formatMoney(cost.maintenance)}</b></div>
            <div className="re-row re-total"><span>Estimated monthly</span><b>{formatMoney(cost.total as never)}</b></div>
          </section>
        )}

        <section className="re-sec">
          <h4>The neighbourhood · {place?.name ?? 'town'}</h4>
          <div className="re-hoodgrid">
            <div><span>Desirability</span><b>{desirabilityWords(place?.desirability ?? 0)}</b></div>
            <div><span>Condition</span><b>{conditionWords(property.condition)}</b></div>
            <div><span>Rent here</span><b>{formatMoney(detail.monthlyRent)}/mo</b></div>
            <div><span>Trajectory</span><b>{trendWords(trend)}</b></div>
          </div>
        </section>

        <div className="re-trade">
          {detail.forSale && (
            <>
              <button
                type="button"
                className="re-buy"
                disabled={cash < down}
                onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'mortgage' })}
              >
                {cash < down
                  ? `Needs ${formatMoney(down as never)} down`
                  : `Buy with mortgage — ${formatMoney(down as never)} down · ${(rate / 10).toFixed(1)}%`}
              </button>
              <button
                type="button"
                className="re-buy re-alt"
                disabled={cash < price}
                onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'cash' })}
              >
                {cash < price
                  ? `Cash needs ${formatMoney(price)}`
                  : `Buy outright — ${formatMoney(price)} cash`}
              </button>
            </>
          )}
          {detail.forRent && (
            <button
              type="button"
              className="re-buy re-alt"
              disabled={hasLease || cash < detail.monthlyRent * 2}
              onClick={() => onAct({ verb: 'rent-property', propertyId: property.id })}
            >
              {hasLease ? 'You are already on a lease' : 'Take the lease'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- THE PORTFOLIO (the owner's property-ui mockup) ----------------------
  const totalEquity = mine.reduce((total, property) => {
    const owing = livedIn(property.id) ? (myMortgage?.balance ?? 0) : 0
    return total + equityOf(world, property.id, owing as never)
  }, 0)
  const rental = rentalIncomeOf(world, personId as never)
  const forSale = all.filter((l) => l.forSale).slice(0, 9)
  const forRent = all.filter((l) => l.forRent && !l.forSale).slice(0, 6)
  const hoods = [...world.places.values()]
    .filter((entry) => entry.kind === 'neighbourhood')
    .sort((a, b) => a.id - b.id)
  const refiBar = refinanceBar(world, personId as never)
  const canMoveHome = moveBackInBar(world, personId as never) === null

  const trendTag = (placeId: number) => {
    const trend = trendOf(world, placeId as never, world.tick)
    return (
      <span className={`re2-tag re2-tag-${trend}`}>
        {trend === 'gentrifying' ? 'Gentrifying' : trend === 'declining' ? 'Declining' : 'Established'}
      </span>
    )
  }
  /** An honest "Deal": the rent covers the price unusually fast. */
  const isDeal = (price: number, rent: number) => price > 0 && (rent * 12_000) / price >= 62

  return (
    <div className="re2">
      <div className="re2-header">
        <h1>Property</h1>
        <p>Own the roof, collect the rents, watch the streets move.</p>
      </div>

      <div className="re2-summary">
        <div className="re2-scard">
          <span>Total equity</span>
          <b className={totalEquity >= 0 ? 'good' : 'bad'}>{formatMoney(totalEquity as never)}</b>
        </div>
        <div className="re2-scard">
          <span>Properties owned</span>
          <b>{mine.length}</b>
        </div>
        <div className="re2-scard">
          <span>Rental income</span>
          <b className={rental > 0 ? 'good' : ''}>{formatMoney(rental)}/mo</b>
        </div>
        <div className="re2-scard">
          <span>Cash available</span>
          <b>{formatMoney(cash as never)}</b>
        </div>
      </div>

      <div className="re2-title">Your properties</div>
      {mine.length === 0 ? (
        <p className="re2-cdesc">
          You own nothing yet. Every deed you buy lands here — live in it, rent it out, or sell it.
        </p>
      ) : (
        <>
          <div className="re2-grid">
            {mine.map((property) => {
              const place = world.places.get(property.neighbourhoodPlaceId)
              const value = valueOf(world, property)
              const isHome = livedIn(property.id)
              const owing = isHome ? (myMortgage?.balance ?? 0) : 0
              const equity = equityOf(world, property.id, owing as never)
              const tenant = tenantOf(property.id)
              const lease = tenant === undefined ? undefined : leaseOf(world, tenant.id)
              const income = tenant === undefined ? 0 : (lease?.monthlyRent ?? rentOf(world, property))
              const upkeep = ownershipCostOf(world, property, 0 as never).maintenance
              return (
                <article className="re2-card" key={property.id}>
                  <div className="re2-chead">
                    <div>
                      <div className="re2-ctitle">{property.address}</div>
                      <div className="re2-cmeta">
                        {(place?.name ?? 'town').toUpperCase()} · {property.type.toUpperCase()}
                        {isHome ? ' · YOUR HOME' : ''}
                      </div>
                    </div>
                    <div className="re2-cprice">{formatMoney(value)}</div>
                  </div>
                  <p className="re2-cdesc">{listingWords(property, place?.desirability ?? 500)}</p>
                  <div className="re2-tags">
                    {trendTag(property.neighbourhoodPlaceId)}
                    {tenant !== undefined && <span className="re2-tag re2-tag-let">Tenanted</span>}
                  </div>
                  <div className="re2-stats">
                    <div className="re2-srow">
                      <span>Equity{owing > 0 ? ` (owing ${formatMoney(owing as never)})` : ' — owned clear'}</span>
                      <b className={equity >= 0 ? 'good' : 'bad'}>{formatMoney(equity as never)}</b>
                    </div>
                    {isHome && myMortgage !== undefined && (
                      <div className="re2-srow">
                        <span>Mortgage rate</span>
                        <b>{(myMortgage.ratePerMille / 10).toFixed(1)}%/yr</b>
                      </div>
                    )}
                    <div className="re2-srow">
                      <span>Monthly rent</span>
                      <b className={income > 0 ? 'good' : ''}>
                        {tenant === undefined ? (isHome ? '— you live here' : 'vacant') : `${formatMoney(income as never)}/mo`}
                      </b>
                    </div>
                    <div className="re2-srow">
                      <span>Upkeep</span>
                      <b className="bad">−{formatMoney(upkeep)}/mo</b>
                    </div>
                  </div>
                  <div className="re2-actions">
                    <button
                      type="button"
                      className="re2-btn"
                      onClick={() => onAct({ verb: 'sell-property', propertyId: property.id })}
                    >
                      Sell · {formatMoney(saleProceedsOf(world, property.id).net)}
                    </button>
                    <button type="button" className="re2-btn" onClick={() => setOpen(property.id)}>
                      Details
                    </button>
                    {/* THE MANAGEMENT VERBS (owner: "live in one, rent out
                        the other"): what the deed's state allows, only. */}
                    {!isHome && tenant === undefined && (
                      <>
                        <button
                          type="button"
                          className="re2-btn"
                          onClick={() => onAct({ verb: 'move-into-own', propertyId: property.id })}
                        >
                          Move in
                        </button>
                        <button
                          type="button"
                          className="re2-btn re2-primary"
                          onClick={() => onAct({ verb: 'find-tenant', propertyId: property.id })}
                        >
                          Find a tenant — {formatMoney(rentOf(world, property))}/mo
                        </button>
                      </>
                    )}
                    {!isHome && tenant !== undefined && (
                      <button
                        type="button"
                        className="re2-btn re2-primary"
                        onClick={() => onAct({ verb: 'end-tenancy', propertyId: property.id })}
                      >
                        End the tenancy
                      </button>
                    )}
                    {isHome && myMortgage !== undefined && (
                      <button
                        type="button"
                        className="re2-btn re2-primary"
                        disabled={refiBar !== null}
                        title={refiBar ?? undefined}
                        onClick={() => onAct({ verb: 'refinance' })}
                      >
                        {refiBar === null ? 'Refinance' : 'Refinance — nothing better today'}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <div className="re2-title">Available this month</div>
      <div className="re2-grid">
        {forSale.map(({ property, price, monthlyRent }) => {
          const place = world.places.get(property.neighbourhoodPlaceId)
          const down = depositFor(price as never, credit)
          return (
            <article className="re2-card" key={property.id}>
              <div className="re2-chead">
                <div>
                  <div className="re2-ctitle">{property.address}</div>
                  <div className="re2-cmeta">
                    {(place?.name ?? 'town').toUpperCase()} · {property.type.toUpperCase()} · {property.beds}bd {property.baths}ba
                  </div>
                </div>
                <div className="re2-cprice">{formatMoney(price)}</div>
              </div>
              <p className="re2-cdesc">{listingWords(property, place?.desirability ?? 500)}</p>
              <div className="re2-tags">
                {trendTag(property.neighbourhoodPlaceId)}
                {isDeal(price, monthlyRent) && <span className="re2-tag re2-tag-deal">Deal</span>}
              </div>
              <div className="re2-stats">
                <div className="re2-srow">
                  <span>Down payment</span>
                  <b>{formatMoney(down as never)} ({(minSharePerMille / 10).toFixed(0)}%)</b>
                </div>
                <div className="re2-srow">
                  <span>Mortgage rate</span>
                  <b>{(rate / 10).toFixed(1)}%/yr</b>
                </div>
                <div className="re2-srow">
                  <span>Est. monthly rent</span>
                  <b className="good">{formatMoney(monthlyRent)}/mo</b>
                </div>
                <div className="re2-srow">
                  <span>Market trend</span>
                  <b>{trendWords(trendOf(world, property.neighbourhoodPlaceId, world.tick))}</b>
                </div>
              </div>
              <div className="re2-actions">
                <button type="button" className="re2-btn" onClick={() => setOpen(property.id)}>
                  More info
                </button>
                <button
                  type="button"
                  className="re2-btn"
                  disabled={cash < price}
                  onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'cash' })}
                >
                  Buy cash
                </button>
                <button
                  type="button"
                  className="re2-btn re2-primary"
                  disabled={cash < down}
                  onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'mortgage' })}
                >
                  {cash < down ? `Needs ${formatMoney(down as never)} down` : 'Buy with mortgage'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="re2-title">Places to rent</div>
      {canMoveHome && (
        <div className="re2-moveback">
          <button type="button" className="re2-btn re2-primary" onClick={() => onAct({ verb: 'move-in-parents' })}>
            Move back in with your parents — rent free, wallet stays yours
          </button>
        </div>
      )}
      <div className="re2-grid">
        {forRent.map(({ property, monthlyRent }) => {
          const place = world.places.get(property.neighbourhoodPlaceId)
          return (
            <article className="re2-card" key={property.id}>
              <div className="re2-chead">
                <div>
                  <div className="re2-ctitle">{property.address}</div>
                  <div className="re2-cmeta">
                    {(place?.name ?? 'town').toUpperCase()} · {property.type.toUpperCase()} · {property.beds}bd {property.baths}ba
                  </div>
                </div>
                <div className="re2-cprice">{formatMoney(monthlyRent)}/mo</div>
              </div>
              <p className="re2-cdesc">{listingWords(property, place?.desirability ?? 500)}</p>
              <div className="re2-tags">{trendTag(property.neighbourhoodPlaceId)}</div>
              <div className="re2-actions">
                <button type="button" className="re2-btn" onClick={() => setOpen(property.id)}>
                  More info
                </button>
                <button
                  type="button"
                  className="re2-btn re2-primary"
                  disabled={hasLease || cash < monthlyRent * 2}
                  onClick={() => onAct({ verb: 'rent-property', propertyId: property.id })}
                >
                  {hasLease ? 'Already on a lease' : 'Take the lease'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="re2-watch">
        <h3>Neighbourhood watch</h3>
        {hoods.map((place) => {
          const trend = trendOf(world, place.id, world.tick)
          return (
            <div className="re2-trendrow" key={place.id}>
              <span>{place.name}</span>
              <b className={trend === 'gentrifying' ? 'warn' : trend === 'declining' ? 'bad' : 'good'}>
                {trendWords(trend)}
              </b>
            </div>
          )
        })}
      </div>
    </div>
  )
}
