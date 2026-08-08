/**
 * A COMPANY, AS THE PLAYER MEETS IT (stock revamp §8).
 *
 * The owner's mockup: the price and the day's move across the top, a
 * chart with range pills, buy and sell, your position, what the analysts
 * think, the key stats, what the company actually does, and the news.
 *
 * Everything here is READ from the engine — price, history, consensus,
 * fundamentals are all either stored state or derived by functions the
 * simulation itself uses. The UI computes no market truth of its own;
 * the one thing it does compute is the shape of the chart line, which is
 * a drawing, not a fact.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import {
  betaOf,
  dividendYieldOf,
  holdingValue,
  marketCapOf,
  peRatioOf,
  ratingOf,
  upsidePerMille,
  yearRangeOf,
} from '@life-engine/engine'
import type { Holding, Stock, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

/**
 * THE RANGES ARE MONTHLY, AND SAY SO.
 *
 * The spec is explicit about this: the simulation advances a month at a
 * time, so there is no intraday and a "1D" pill would be a lie drawn as a
 * line. It recommends dropping it and starting at 1M, which is what this
 * does — every range here is a real number of real closes.
 */
const RANGES: readonly { readonly id: string; readonly months: number }[] = [
  { id: '3M', months: 3 },
  { id: '6M', months: 6 },
  { id: '1Y', months: 12 },
  { id: '5Y', months: 60 },
  { id: 'MAX', months: 0 },
]

/** Basis points off par, as money. Par is one dollar. */
function priceToMoney(basisPoints: number): Money {
  return Math.floor(basisPoints / 100) as Money
}

function pct(perMille: number): string {
  const sign = perMille > 0 ? '+' : ''
  return `${sign}${(perMille / 10).toFixed(1)}%`
}

/** The line, as an SVG path. A drawing, not a fact. */
function pathFor(series: readonly number[], width: number, height: number): string {
  if (series.length < 2) return ''
  let low = series[0] ?? 0
  let high = series[0] ?? 0
  for (const value of series) {
    if (value < low) low = value
    if (value > high) high = value
  }
  const span = Math.max(1, high - low)
  const step = width / (series.length - 1)
  return series
    .map((value, index) => {
      const x = (index * step).toFixed(1)
      // Padded top and bottom so the extremes are not drawn on the edge.
      const y = (height - 8 - ((value - low) / span) * (height - 16)).toFixed(1)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

export function StockDetail({
  world,
  stock,
  holding,
  cash,
  onBack,
  onAct,
}: {
  readonly world: World
  readonly stock: Stock
  readonly holding: Holding | undefined
  readonly cash: number
  readonly onBack: () => void
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [range, setRange] = useState('1Y')

  const price = world.stockPrices[stock.id] ?? 10_000
  const history = world.stockHistory[stock.id] ?? []
  const months = RANGES.find((r) => r.id === range)?.months ?? 0
  const series = months === 0 ? history : history.slice(Math.max(0, history.length - months))
  const shown = series.length >= 2 ? series : [price, price]

  const first = shown[0] ?? price
  const movePerMille = first > 0 ? Math.trunc(((price - first) * 1_000) / first) : 0
  const up = movePerMille >= 0

  // Last month against the one before it — "today" in a game that steps
  // monthly, and marked as such rather than dressed up as a day's move.
  const previous = history[history.length - 2] ?? price
  const monthMove = previous > 0 ? Math.trunc(((price - previous) * 1_000) / previous) : 0

  const view = world.analystViews.get(stock.id)
  const range52 = yearRangeOf(world, stock)
  const pe = peRatioOf(world, stock)
  const equity = holding === undefined ? (0 as Money) : holdingValue(world, holding)
  const gain = holding === undefined ? 0 : equity - holding.costBasis
  const gainPerMille =
    holding === undefined || holding.costBasis <= 0
      ? 0
      : Math.trunc((gain * 1_000) / holding.costBasis)

  // A quarter of what is liquid, so the button is a real amount without
  // being everything somebody owns.
  const stake = Math.max(0, Math.floor(cash / 4))

  return (
    <div className="stock-detail">
      <div className="stock-bar">
        <button type="button" className="stock-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <span className="stock-sym">{stock.ticker}</span>
      </div>

      <div className="stock-head">
        <div className="stock-co">{stock.name}</div>
        <div className="stock-px tabular">{formatMoney(priceToMoney(price))}</div>
        <div className={up ? 'stock-chg up' : 'stock-chg down'}>
          {pct(movePerMille)} <span className="muted">over {range}</span>
          <span className="muted">
            {' '}
            · {pct(monthMove)} this month
          </span>
        </div>
      </div>

      <div className="stock-chart">
        <svg viewBox="0 0 320 170" preserveAspectRatio="none" role="img" aria-label="Price history">
          <path
            d={pathFor(shown, 320, 170)}
            fill="none"
            stroke={up ? 'var(--green, #3ecf8e)' : 'var(--red, #f0776f)'}
            strokeWidth="2"
          />
        </svg>
        <p className="muted small stock-note">
          {/* GRANULARITY HONESTY, the spec's own heading: this world steps
              a month at a time, so there is no intraday to draw. */}
          Monthly closes — this world moves a month at a time.
        </p>
      </div>

      <div className="stock-pills">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === range ? 'stock-pill on' : 'stock-pill'}
            onClick={() => setRange(r.id)}
          >
            {r.id}
          </button>
        ))}
      </div>

      <div className="stock-trade">
        <button
          type="button"
          className="stock-buy"
          disabled={stake <= 0}
          onClick={() => onAct({ verb: 'buy-shares', stockId: stock.id, cents: stake, retirement: false })}
        >
          {stake <= 0 ? 'Nothing to invest' : `Buy ${formatMoney(stake as Money)}`}
        </button>
        <button
          type="button"
          className="stock-sell"
          disabled={holding === undefined}
          onClick={() => onAct({ verb: 'sell-shares', stockId: stock.id, retirement: false })}
        >
          {holding === undefined ? 'None held' : 'Sell all'}
        </button>
      </div>

      {holding !== undefined && (
        <section className="stock-sec">
          <h3>Your position</h3>
          <div className="stock-grid">
            <div className="kv">
              <div className="k">Shares</div>
              <div className="v tabular">{holding.units.toLocaleString()}</div>
            </div>
            <div className="kv">
              <div className="k">Value</div>
              <div className="v tabular">{formatMoney(equity)}</div>
            </div>
            <div className="kv">
              <div className="k">Cost</div>
              <div className="v tabular">{formatMoney(holding.costBasis)}</div>
            </div>
            <div className="kv">
              <div className="k">Return</div>
              <div className={gain >= 0 ? 'v tabular up' : 'v tabular down'}>
                {formatMoney(gain as Money)} ({pct(gainPerMille)})
              </div>
            </div>
          </div>
        </section>
      )}

      {view !== undefined && (
        <section className="stock-sec">
          <h3>Analyst ratings</h3>
          <div className="stock-rating">
            <span className="stock-badge">{ratingOf(view)}</span>
            <span className="muted small">
              {view.analysts} analysts · {view.buy} buy, {view.hold} hold, {view.sell} sell
            </span>
          </div>
          <div className="stock-cons" aria-hidden="true">
            <i style={{ width: `${String((view.buy * 100) / view.analysts)}%`, background: 'var(--green, #3ecf8e)' }} />
            <i style={{ width: `${String((view.hold * 100) / view.analysts)}%`, background: '#5b6673' }} />
            <i style={{ width: `${String((view.sell * 100) / view.analysts)}%`, background: 'var(--red, #f0776f)' }} />
          </div>
          <div className="stock-target muted small">
            12-month target {formatMoney(priceToMoney(view.targetLow))} –{' '}
            {formatMoney(priceToMoney(view.targetHigh))}, average{' '}
            <b>{formatMoney(priceToMoney(view.targetAvg))}</b> ({pct(upsidePerMille(world, view))})
          </div>
        </section>
      )}

      <section className="stock-sec">
        <h3>Key stats</h3>
        <div className="stock-grid">
          <div className="kv">
            <div className="k">Market cap</div>
            <div className="v tabular">{formatMoney(marketCapOf(world, stock))}</div>
          </div>
          <div className="kv">
            <div className="k">P/E</div>
            {/* Zero means the company earns nothing; "n/a" is the honest
                word for that, not an infinity dressed as a number. */}
            <div className="v tabular">{pe <= 0 ? 'n/a' : (pe / 100).toFixed(1)}</div>
          </div>
          <div className="kv">
            <div className="k">Dividend yield</div>
            <div className="v tabular">{(dividendYieldOf(stock) / 10).toFixed(1)}%</div>
          </div>
          <div className="kv">
            <div className="k">Beta</div>
            <div className="v tabular">{(betaOf(stock) / 1000).toFixed(2)}</div>
          </div>
          <div className="kv">
            <div className="k">52-week high</div>
            <div className="v tabular">{formatMoney(priceToMoney(range52.high))}</div>
          </div>
          <div className="kv">
            <div className="k">52-week low</div>
            <div className="v tabular">{formatMoney(priceToMoney(range52.low))}</div>
          </div>
        </div>
      </section>

      <section className="stock-sec">
        <h3>About</h3>
        <span className="stock-sectag">{stock.subIndustry}</span>
        <p className="muted small">{stock.blurb}</p>
      </section>
    </div>
  )
}
