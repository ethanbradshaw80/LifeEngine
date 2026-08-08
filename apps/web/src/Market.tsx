/**
 * THE MARKET SCREEN (stock revamp §8).
 *
 * The index with its own line, the sectors as they stand today, and every
 * company listed — tap one to open it. What the owner asked for is the
 * thing this screen makes possible: something to tap INTO.
 *
 * Reads engine state and derived functions only. No market truth is
 * computed here.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import {
  SECTORS,
  STOCKS,
  holdingValue,
  marketLevel,
  ratingOf,
  stockById,
} from '@life-engine/engine'
import type { Holding, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'
import { StockDetail } from './StockDetail.js'

function priceToMoney(basisPoints: number): Money {
  return Math.floor(basisPoints / 100) as Money
}

function pct(perMille: number): string {
  return `${perMille > 0 ? '+' : ''}${(perMille / 10).toFixed(1)}%`
}

/** This month against last, for a stored series. */
function monthMove(history: readonly number[], price: number): number {
  const previous = history[history.length - 2] ?? price
  return previous > 0 ? Math.trunc(((price - previous) * 1_000) / previous) : 0
}

export function Market({
  world,
  holdings,
  cash,
  onAct,
}: {
  readonly world: World
  readonly holdings: readonly Holding[]
  readonly cash: number
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null)
  const [sector, setSector] = useState<string>('all')

  const open = openId === null ? undefined : stockById(openId)
  if (open !== undefined) {
    return (
      <StockDetail
        world={world}
        stock={open}
        holding={holdings.find((h) => h.stockId === open.id)}
        cash={cash}
        onBack={() => setOpenId(null)}
        onAct={onAct}
      />
    )
  }

  const level = marketLevel(world)
  const owned = new Set(holdings.map((h) => h.stockId).filter((id) => id !== undefined))
  const listed = sector === 'all' ? STOCKS : STOCKS.filter((s) => s.sectorId === sector)

  // Movers, by this month's move. The screen's own sort, not stored state.
  const withMove = STOCKS.map((stock) => ({
    stock,
    move: monthMove(world.stockHistory[stock.id] ?? [], world.stockPrices[stock.id] ?? 10_000),
  })).sort((a, b) => b.move - a.move)
  const risers = withMove.slice(0, 3)
  const fallers = withMove.slice(-3).reverse()

  return (
    <div className="market">
      <div className="mkt-index">
        <div className="mkt-index-name">The Haverlock Composite</div>
        <div className="mkt-index-px tabular">{(level / 100).toFixed(1)}</div>
        <div className="muted small">
          The average of every sector. Par is 100 — where the market began.
        </div>
      </div>

      {holdings.length > 0 && (
        <section className="mkt-sec">
          <h3>What you hold</h3>
          {holdings.map((holding) => {
            const stock = holding.stockId === undefined ? undefined : stockById(holding.stockId)
            const value = holdingValue(world, holding)
            const gain = value - holding.costBasis
            return (
              <button
                type="button"
                key={holding.stockId ?? holding.sectorId}
                className="mkt-row"
                onClick={() => (stock === undefined ? undefined : setOpenId(stock.id))}
              >
                <span className="mkt-row-sym">{stock?.ticker ?? holding.sectorId}</span>
                <span className="mkt-row-name">
                  {stock?.name ?? `${SECTORS.find((s) => s.id === holding.sectorId)?.title ?? ''} fund`}
                </span>
                <span className="mkt-row-px tabular">{formatMoney(value)}</span>
                <span className={gain >= 0 ? 'mkt-row-chg up' : 'mkt-row-chg down'}>
                  {gain >= 0 ? '+' : ''}
                  {formatMoney(gain as Money)}
                </span>
              </button>
            )
          })}
        </section>
      )}

      <section className="mkt-sec">
        <h3>Movers this month</h3>
        {[...risers, ...fallers].map(({ stock, move }) => (
          <button
            type="button"
            key={`m-${stock.id}`}
            className="mkt-row"
            onClick={() => setOpenId(stock.id)}
          >
            <span className="mkt-row-sym">{stock.ticker}</span>
            <span className="mkt-row-name">{stock.name}</span>
            <span className="mkt-row-px tabular">
              {formatMoney(priceToMoney(world.stockPrices[stock.id] ?? 10_000))}
            </span>
            <span className={move >= 0 ? 'mkt-row-chg up' : 'mkt-row-chg down'}>{pct(move)}</span>
          </button>
        ))}
      </section>

      <section className="mkt-sec">
        <h3>Sectors today</h3>
        <div className="mkt-sectors">
          <button
            type="button"
            className={sector === 'all' ? 'mkt-chip on' : 'mkt-chip'}
            onClick={() => setSector('all')}
          >
            All
          </button>
          {SECTORS.map((s) => (
            <button
              type="button"
              key={s.id}
              className={sector === s.id ? 'mkt-chip on' : 'mkt-chip'}
              onClick={() => setSector(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
      </section>

      <section className="mkt-sec">
        <h3>{sector === 'all' ? 'Every listing' : SECTORS.find((s) => s.id === sector)?.title}</h3>
        {listed.map((stock) => {
          const view = world.analystViews.get(stock.id)
          const move = monthMove(
            world.stockHistory[stock.id] ?? [],
            world.stockPrices[stock.id] ?? 10_000,
          )
          return (
            <button
              type="button"
              key={stock.id}
              className={owned.has(stock.id) ? 'mkt-row owned' : 'mkt-row'}
              onClick={() => setOpenId(stock.id)}
            >
              <span className="mkt-row-sym">
                {stock.ticker}
                {owned.has(stock.id) ? ' ●' : ''}
              </span>
              <span className="mkt-row-name">
                {stock.name}
                {view === undefined ? '' : ` · ${ratingOf(view)}`}
              </span>
              <span className="mkt-row-px tabular">
                {formatMoney(priceToMoney(world.stockPrices[stock.id] ?? 10_000))}
              </span>
              <span className={move >= 0 ? 'mkt-row-chg up' : 'mkt-row-chg down'}>{pct(move)}</span>
            </button>
          )
        })}
      </section>
    </div>
  )
}
