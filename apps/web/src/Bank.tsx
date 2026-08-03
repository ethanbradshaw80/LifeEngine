/**
 * THE BANK (M-ECON §9).
 *
 * Five sections behind a bottom tab bar, the way a banking app is actually
 * laid out: Home is the glance, and the other four are where the actions
 * live. A persistent header carries net worth and the economy's mood, so
 * the weather is never more than a glance away.
 *
 * Every number is read from the engine. Every action routes back through
 * the worker, because finances is the single writer — this file computes
 * nothing about money except which of the engine's numbers to show.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import {
  LOAN_TERMS,
  SECTORS,
  accountsOf,
  atTodaysPrices,
  annualPay,
  creditOf,
  creditWords,
  depositFor,
  economyPhaseWords,
  holdingValue,
  homeEquityOf,
  homePriceFor,
  homeValueOf,
  householdCosts,
  householdIncome,
  incomeTaxFor,
  loanBar,
  marginalRatePerMille,
  marketLevel,
  netWorthOf,
  offeredRatePerMille,
  portfolioValue,
  rentFor,
  totalDebtOf,
} from '@life-engine/engine'
import type { LoanKind, Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

type BankTab = 'home' | 'accounts' | 'invest' | 'loans' | 'taxes'

const TABS: readonly { id: BankTab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏦', label: 'Home' },
  { id: 'accounts', icon: '💳', label: 'Accounts' },
  { id: 'invest', icon: '📈', label: 'Invest' },
  { id: 'loans', icon: '🏷️', label: 'Loans' },
  { id: 'taxes', icon: '🧾', label: 'Taxes' },
]

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string | undefined
}) {
  return (
    <div className="bank-row">
      <span className="bank-row-label">{label}</span>
      <span className={tone ? `bank-row-value ${tone}` : 'bank-row-value'}>{value}</span>
    </div>
  )
}

export function Bank({
  world,
  person,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [tab, setTab] = useState<BankTab>('home')
  const [sector, setSector] = useState<string>(SECTORS[0]?.id ?? 'industrial')

  const accounts = accountsOf(world, person.id)
  const worth = netWorthOf(world, person.id)
  const household = person.householdId === null ? null : world.households.get(person.householdId)
  const portfolio = portfolioValue(world, accounts.holdings)
  const retirement = (accounts.retirement + portfolioValue(world, accounts.retirementHoldings)) as Money
  const homeValue = homeValueOf(world, person.id)
  const credit = creditOf(world, person.id)
  const debt = totalDebtOf(accounts.loans)
  const economy = world.economy

  // A quarter of savings is the unit a player actually trades in — small
  // enough to be a decision, big enough to matter.
  const stake = Math.max(0, Math.floor(accounts.savings / 4)) as Money

  return (
    <div className="bank">
      <div className="bank-header">
        <div>
          <div className="bank-worth-label">Net worth</div>
          <div className={worth < 0 ? 'bank-worth bad' : 'bank-worth'}>{formatMoney(worth)}</div>
        </div>
        <div className={`bank-chip is-${economy.phase}`}>
          <span className="dot" />
          {economyPhaseWords(economy.phase)} · rate{' '}
          {(economy.ratePerMille / 10).toFixed(1)}% · market {Math.round(marketLevel(world) / 100)}
        </div>
      </div>

      <div className="bank-body">
        {tab === 'home' && (
          <>
            <section className="bank-card">
              <h4>Accounts at a glance</h4>
              <Row label="Checking" value={formatMoney(accounts.checking)} />
              <Row label="Savings" value={formatMoney(accounts.savings)} />
              <Row label="Investments" value={formatMoney((portfolio + retirement) as Money)} />
              <Row
                label="Home equity"
                value={homeValue > 0 ? formatMoney(homeEquityOf(accounts.loans, homeValue)) : '—'}
              />
              {debt > 0 && <Row label="Debts" value={`−${formatMoney(debt)}`} tone="bad" />}
            </section>

            <section className="bank-card">
              <h4>This month</h4>
              {(() => {
                const job = world.employment.get(person.id)
                const income = household ? householdIncome(world, household) : (0 as Money)
                const costs = household ? householdCosts(world, household) : (0 as Money)
                return (
                  <>
                    <Row
                      label="Salary"
                      value={job ? `${formatMoney(annualPay(job.monthlyPay))} / yr` : 'no wages'}
                    />
                    <Row
                      label="Tax withheld"
                      value={job ? `−${formatMoney((job.monthlyPay - (income > 0 ? 0 : 0)) as Money)}` : '—'}
                      tone="muted"
                    />
                    <Row label="Rent + living" value={`−${formatMoney(costs)}`} />
                    <Row
                      label="Left over"
                      value={formatMoney(Math.max(0, income - costs) as Money)}
                      tone={income - costs < 0 ? 'bad' : 'good'}
                    />
                    {household && household.savings < 0 && (
                      <Row
                        label="Household behind"
                        value={formatMoney(-household.savings as Money)}
                        tone="bad"
                      />
                    )}
                  </>
                )
              })()}
            </section>
          </>
        )}

        {tab === 'accounts' && (
          <>
            <section className="bank-card">
              <h4>Checking</h4>
              <Row label="Balance" value={formatMoney(accounts.checking)} />
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={accounts.checking <= 0}
                  onClick={() => onAct({ verb: 'bank-deposit', cents: accounts.checking })}
                >
                  Move all to savings
                </button>
              </div>
            </section>
            <section className="bank-card">
              <h4>Savings</h4>
              <Row label="Balance" value={formatMoney(accounts.savings)} />
              <Row label="Interest" value={`${(economy.ratePerMille / 10).toFixed(1)}% APY`} tone="muted" />
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={accounts.savings <= 0}
                  onClick={() => onAct({ verb: 'bank-withdraw', cents: stake })}
                >
                  Withdraw {formatMoney(stake)}
                </button>
              </div>
            </section>
            <section className="bank-card">
              <h4>Retirement</h4>
              <Row label="Balance" value={formatMoney(retirement)} />
              <p className="bank-note">
                Gains inside it are never taxed. Over a life this long, that is the whole point.
              </p>
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={stake <= 0}
                  onClick={() => onAct({ verb: 'invest', sectorId: sector, cents: stake, retirement: true })}
                >
                  Put {formatMoney(stake)} in
                </button>
              </div>
            </section>
          </>
        )}

        {tab === 'invest' && (
          <>
            <section className="bank-card">
              <h4>Portfolio</h4>
              <Row label="Value" value={formatMoney(portfolio)} />
              <Row label="Market" value={String(Math.round(marketLevel(world) / 100))} tone="muted" />
            </section>
            <section className="bank-card">
              <h4>Sectors</h4>
              {SECTORS.map((s) => {
                const price = world.sectorPrices[s.id] ?? 10_000
                const held = accounts.holdings.find((h) => h.sectorId === s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`bank-sector ${sector === s.id ? 'is-picked' : ''}`}
                    onClick={() => setSector(s.id)}
                  >
                    <span className="h">{s.title}</span>
                    <span className="p">{(price / 100).toFixed(0)}</span>
                    <span className="d">
                      {held ? formatMoney(holdingValue(world, held)) : '—'}
                    </span>
                  </button>
                )
              })}
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={stake <= 0}
                  onClick={() => onAct({ verb: 'invest', sectorId: sector, cents: stake, retirement: false })}
                >
                  Buy {formatMoney(stake)}
                </button>
                <button
                  type="button"
                  disabled={!accounts.holdings.some((h) => h.sectorId === sector)}
                  onClick={() => onAct({ verb: 'divest', sectorId: sector, retirement: false })}
                >
                  Sell all
                </button>
              </div>
              <p className="bank-note">
                A sale outside retirement realises the gain, and a realised gain is taxed.
              </p>
            </section>
          </>
        )}

        {tab === 'loans' && (
          <>
            <section className="bank-card">
              <h4>Credit</h4>
              <Row label="Score" value={`${String(credit)} · ${creditWords(credit)}`} />
              <div className="bank-gauge">
                <span style={{ width: `${String(Math.round(((credit - 300) / 550) * 100))}%` }} />
              </div>
              {debt > 0 && <Row label="Owed" value={formatMoney(debt)} tone="bad" />}
            </section>

            {accounts.loans.length > 0 && (
              <section className="bank-card">
                <h4>What you carry</h4>
                {accounts.loans.map((loan) => (
                  <Row
                    key={loan.kind}
                    label={`${loan.kind} · ${(loan.ratePerMille / 10).toFixed(1)}%`}
                    value={`${formatMoney(loan.balance)} · ${formatMoney(loan.monthlyPayment)}/mo`}
                    tone={loan.missedMonths > 0 ? 'bad' : undefined}
                  />
                ))}
              </section>
            )}

            <section className="bank-card">
              <h4>Home</h4>
              {accounts.homePlaceId !== null ? (
                <>
                  <Row label="Value" value={formatMoney(homeValue)} />
                  <Row label="Equity" value={formatMoney(homeEquityOf(accounts.loans, homeValue))} />
                </>
              ) : (
                (() => {
                  const place =
                    household === null || household === undefined
                      ? undefined
                      : world.places.get(household.placeId)
                  if (!place) return <p className="bank-note">Nowhere to buy just yet.</p>
                  const price = homePriceFor(atTodaysPrices(world, rentFor(place.desirability)) as Money)
                  const bar = loanBar(
                    world,
                    'mortgage',
                    credit,
                    accounts.loans,
                    (accounts.savings + accounts.checking) as Money,
                    price,
                  )
                  return (
                    <>
                      <Row label={`Buy in ${place.name}`} value={formatMoney(price)} />
                      <Row label="Deposit needed" value={formatMoney(depositFor(price))} tone="muted" />
                      {bar !== null && <p className="bank-note bad">{bar}</p>}
                      <div className="bank-actions">
                        <button
                          type="button"
                          disabled={bar !== null}
                          onClick={() => onAct({ verb: 'buy-home' })}
                        >
                          Buy this home
                        </button>
                      </div>
                    </>
                  )
                })()
              )}
            </section>

            <section className="bank-card">
              <h4>Apply</h4>
              {LOAN_TERMS.filter((t) => t.kind !== 'mortgage').map((terms) => {
                const rate = offeredRatePerMille(world, credit, terms.kind)
                const has = accounts.loans.some((l) => l.kind === terms.kind)
                return (
                  <div key={terms.kind} className="bank-row">
                    <span className="bank-row-label">
                      {terms.title} · {(rate / 10).toFixed(1)}%
                    </span>
                    <button
                      type="button"
                      className="bank-mini"
                      disabled={has || credit < terms.minCredit}
                      onClick={() =>
                        onAct({
                          verb: 'borrow',
                          kind: terms.kind as LoanKind,
                          cents: 1_500_000 as Money,
                        })
                      }
                    >
                      {has ? 'carried' : credit < terms.minCredit ? 'refused' : 'Borrow $15,000'}
                    </button>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {tab === 'taxes' && (
          <section className="bank-card">
            <h4>This tax year</h4>
            <Row label="Income so far" value={formatMoney(accounts.taxableYtd)} />
            <Row label="Withheld" value={formatMoney(accounts.withheldYtd)} />
            <Row
              label="Marginal band"
              value={`${(marginalRatePerMille(accounts.taxableYtd) / 10).toFixed(0)}%`}
              tone="muted"
            />
            {(() => {
              const owed = incomeTaxFor(accounts.taxableYtd)
              const settled = (accounts.withheldYtd - owed) as Money
              return (
                <Row
                  label={settled >= 0 ? 'Refund, so far' : 'Owing, so far'}
                  value={formatMoney(Math.abs(settled) as Money)}
                  tone={settled >= 0 ? 'good' : 'bad'}
                />
              )
            })()}
            <p className="bank-note">
              The return is filed every January and settles the difference. Sales tax rides on what
              you spend, and a sale of investments is taxed on the gain.
            </p>
          </section>
        )}
      </div>

      <nav className="bank-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="i">{t.icon}</span>
            <span className="l">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
