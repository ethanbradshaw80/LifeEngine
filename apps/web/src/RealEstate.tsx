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
  downPaymentFor,
  equityOf,
  listingsFor,
  monthlyPaymentFor,
  moveBackInBar,
  offeredRatePerMille,
  ownershipCostOf,
  portfolioValueOf,
  propertiesOwnedBy,
  saleProceedsOf,
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
  const [mode, setMode] = useState<'own' | 'buy' | 'rent'>('own')
  const [open, setOpen] = useState<string | null>(null)
  const [minBeds, setMinBeds] = useState<number>(0)
  const [downPerMille, setDownPerMille] = useState<number>(200)

  const mine = propertiesOwnedBy(world, personId as never)
  const all = listingsFor(world, minBeds > 0 ? { minBeds } : undefined)
  const shown = all.filter((l) => (mode === 'buy' ? l.forSale : l.forRent))
  const detail = open === null ? null : (shown.find((l) => l.property.id === open) ?? null)

  // ---- THE PROPERTY PAGE -------------------------------------------------
  if (detail !== null) {
    const { property, price } = detail
    const place = world.places.get(property.neighbourhoodPlaceId)
    const floor = Math.ceil(price / 5)
    const down = downPaymentFor(price as never, downPerMille, floor as never)
    const borrowed = Math.max(0, price - down)
    // THE RATE IS YOURS, NOT THE POSTCODE'S (Verdant layer): the same
    // credit-gated number the engine writes on the loan, so the estimate
    // and the mortgage that actually arrives cannot disagree.
    const credit = creditOf(world, personId as never)
    const rate = offeredRatePerMille(world, credit, 'mortgage')
    const monthly = monthlyPaymentFor(borrowed as never, rate, 360)
    const cost = ownershipCostOf(world, property, monthly)

    return (
      <div className="re">
        <button type="button" className="re-back" onClick={() => setOpen(null)}>
          ‹ Back to listings
        </button>
        <Illustration type={property.type} desirability={place?.desirability ?? 500} tall />
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

        {mode === 'buy' && (
          <section className="re-sec">
            <h4>Monthly cost estimate</h4>
            <div className="re-slider-label">
              Down payment · {(downPerMille / 10).toFixed(0)}% ({formatMoney(down as never)})
            </div>
            {/* THE SLIDER IS THE CHOICE the spec asks for: more down means a
                smaller payment and less interest, at the cost of everything
                no longer in the bank. */}
            <input
              className="re-slider"
              type="range"
              min={200}
              max={800}
              step={50}
              value={downPerMille}
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
            <div><span>Lot</span><b>{property.lotSqft > 0 ? `${property.lotSqft.toLocaleString()} sqft` : 'none'}</b></div>
          </div>
        </section>

        <div className="re-trade">
          {mode === 'buy' && detail.forSale && (
            <>
              {/* CASH OR A MORTGAGE, SIDE BY SIDE (Verdant layer): the two
                  real ways to buy, each wearing its own price so the choice
                  is a comparison rather than a discovery. */}
              <button
                type="button"
                className="re-buy"
                disabled={cash < floor}
                onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'mortgage' })}
              >
                {cash < floor
                  ? `Needs ${formatMoney(floor as never)} down`
                  : `Buy with mortgage — ${formatMoney(floor as never)} down · ${(rate / 10).toFixed(1)}%`}
              </button>
              <button
                type="button"
                className="re-buy"
                disabled={cash < price}
                onClick={() => onAct({ verb: 'buy-property', propertyId: property.id, method: 'cash' })}
              >
                {cash < price
                  ? `Cash needs ${formatMoney(price)}`
                  : `Buy outright — ${formatMoney(price)} cash`}
              </button>
            </>
          )}
          {mode === 'rent' && detail.forRent && (
            <button
              type="button"
              className="re-buy"
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

  // ---- THE LISTINGS ------------------------------------------------------
  return (
    <div className="re">
      <div className="re-toggle">
        <button type="button" className={mode === 'own' ? 'on' : ''} onClick={() => setMode('own')}>
          Yours{mine.length > 0 ? ` (${String(mine.length)})` : ''}
        </button>
        <button type="button" className={mode === 'buy' ? 'on' : ''} onClick={() => setMode('buy')}>
          Buy
        </button>
        <button type="button" className={mode === 'rent' ? 'on' : ''} onClick={() => setMode('rent')}>
          Rent
        </button>
      </div>
      {mode === 'own' && (
        <>
          {mine.length === 0 ? (
            <p className="bank-note">
              You do not own any property. Buying and renting are both on the tabs above.
            </p>
          ) : (
            <>
              <div className="re-portfolio">
                <span>{mine.length} propert{mine.length === 1 ? 'y' : 'ies'}</span>
                <b>{formatMoney(portfolioValueOf(world, personId as never))}</b>
              </div>
              {mine.map((property) => {
                const place = world.places.get(property.neighbourhoodPlaceId)
                const lived = world.households.get(
                  [...world.households.values()].find((h) => h.propertyId === property.id)?.id ??
                    (-1 as never),
                )
                // THE EQUITY LINE (Verdant layer): what the house is worth
                // to YOU — value less the mortgage still owed on it. The
                // one mortgage a person can carry belongs to the home they
                // live in; everything else is owned clear.
                const mortgage =
                  lived !== undefined
                    ? (accountsOf(world, personId as never).loans.find((l) => l.kind === 'mortgage')
                        ?.balance ?? 0)
                    : 0
                const equity = equityOf(world, property.id, mortgage as never)
                return (
                  <article className="re-card" key={property.id}>
                    <div className="re-thumb">
                      <Illustration type={property.type} desirability={place?.desirability ?? 500} />
                      <span className="re-badge sale">Owned</span>
                      <span className="re-tagpx">{formatMoney(valueOf(world, property))}</span>
                    </div>
                    <div className="re-cbody">
                      <div className="re-addr-sm">{property.address}</div>
                      <div className="re-hood">
                        {place?.name ?? 'town'} · {property.type} ·{' '}
                        {lived === undefined ? 'empty' : 'you live here'}
                      </div>
                      <div className="re-facts">
                        <span><b>{property.beds}</b> bd</span>
                        <span><b>{property.baths}</b> ba</span>
                        <span><b>{property.sqft.toLocaleString()}</b> sqft</span>
                        <span>{conditionWords(property.condition)}</span>
                      </div>
                      <div className="re-row">
                        <span>{mortgage > 0 ? `Equity (owing ${formatMoney(mortgage as never)})` : 'Equity — owned clear'}</span>
                        <b>{formatMoney(equity as never)}</b>
                      </div>
                      <div className="re-trade">
                        <button
                          type="button"
                          className="re-buy"
                          onClick={() => onAct({ verb: 'sell-property', propertyId: property.id })}
                        >
                          Sell — {formatMoney(saleProceedsOf(world, property.id).net)} after fees
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </>
          )}
        </>
      )}

      {/* THE WAY BACK (Verdant layer, owner confirmed): a grown child under
          water on rent can fold the household back into a living parent's.
          The wallet stays theirs — adult kids at home pay nothing (H0). */}
      {mode === 'rent' && moveBackInBar(world, personId as never) === null && (
        <div className="re-trade">
          <button
            type="button"
            className="re-buy"
            onClick={() => onAct({ verb: 'move-in-parents' })}
          >
            Move back in with your parents — rent free, wallet stays yours
          </button>
        </div>
      )}

      {mode !== 'own' && (
      <div className="re-filters">
        {[0, 2, 3, 4].map((n) => (
          <button
            type="button"
            key={n}
            className={minBeds === n ? 'on' : ''}
            onClick={() => setMinBeds(n)}
          >
            {n === 0 ? 'Any beds' : `${String(n)}+ beds`}
          </button>
        ))}
      </div>
      )}

      {mode !== 'own' && (shown.length === 0 ? (
        <p className="bank-note">Nothing on the market matches that right now.</p>
      ) : (
        shown.slice(0, 20).map((listing) => (
          <button
            type="button"
            className="re-card"
            key={listing.property.id}
            onClick={() => setOpen(listing.property.id)}
          >
            <div className="re-thumb">
              <Illustration
                type={listing.property.type}
                desirability={world.places.get(listing.property.neighbourhoodPlaceId)?.desirability ?? 500}
              />
              <span className={`re-badge ${mode === 'buy' ? 'sale' : 'rentb'}`}>
                {mode === 'buy' ? 'For sale' : 'To rent'}
              </span>
              <span className="re-tagpx">
                {mode === 'buy' ? formatMoney(listing.price) : `${formatMoney(listing.monthlyRent)}/mo`}
              </span>
            </div>
            <div className="re-cbody">
              <div className="re-addr-sm">{listing.property.address}</div>
              <div className="re-hood">
                {world.places.get(listing.property.neighbourhoodPlaceId)?.name ?? 'town'} ·{' '}
                {listing.property.type}
              </div>
              <div className="re-facts">
                <span><b>{listing.property.beds}</b> bd</span>
                <span><b>{listing.property.baths}</b> ba</span>
                <span><b>{listing.property.sqft.toLocaleString()}</b> sqft</span>
                <span>{conditionWords(listing.property.condition)}</span>
              </div>
              <p className="re-blurb">
                {listingWords(
                  listing.property,
                  world.places.get(listing.property.neighbourhoodPlaceId)?.desirability ?? 500,
                ).split('. ')[0]}.
              </p>
            </div>
          </button>
        ))
      ))}
      {mode !== 'own' && (
        <p className="bank-note">
          {shown.length} on the market. Prices follow the neighbourhood, the size and the state of
          the place — and every one of these is a home somebody could be living in instead.
        </p>
      )}
    </div>
  )
}
