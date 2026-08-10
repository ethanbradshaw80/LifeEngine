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
  CHAPTER_7_FILE_YEARS,
  CHAPTER_13_FILE_YEARS,
  chapterTitle,
  creditWords,
  filingsOf,
  discretionaryFor,
  economyPhaseWords,
  homeEquityOf,
  homeValueOf,
  householdCosts,
  incomeTaxFor,
  openFilingOf,
  planMonthsLeft,
  planPayoffBar,
  planPayoffFor,
  marginalRatePerMille,
  marketLevel,
  monthlyNetOf,
  netWorthOf,
  offeredRatePerMille,
  portfolioValue,
  personalIncome,
  totalDebtOf,
  withholdingFor,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

type BankTab = 'home' | 'accounts' | 'loans' | 'taxes'

const TABS: readonly { id: BankTab; icon: string; label: string }[] = [
  { id: 'home', icon: '🏦', label: 'Home' },
  { id: 'accounts', icon: '💳', label: 'Accounts' },
  // INVESTING LEFT (owner, playing: "we have investing showing up as its
  // own tab as markets and in the banking app it still shows"). The
  // market has companies, a chart, analysts and its own screen now; a
  // second, thinner version of it behind a bank sub-tab is two places to
  // do one thing, and the one that would go stale is this one.
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

/**
 * The debts a person can walk in and ask for. The `borrow` verb takes
 * exactly these, so the list and the type are declared together and
 * cannot drift: adding a loan kind to the engine does NOT silently put it
 * on the counter here.
 */
type OverTheCounter = 'personal' | 'auto'
const OVER_THE_COUNTER: readonly OverTheCounter[] = ['personal', 'auto']

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
  const [sector] = useState<string>(SECTORS[0]?.id ?? 'industrial')

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
                // EVERY LINE IS THE ENGINE'S OWN, and deliberately the same
                // functions the household ledger on the other view reads —
                // two screens showing the same month must not be able to
                // disagree about it. The gross is personal; the outgoings
                // are the roof's, because rent genuinely is.
                const gross = personalIncome(world, person.id)
                const withheld = withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille)
                const costs = household ? householdCosts(world, household) : (0 as Money)
                const lifestyle = household ? discretionaryFor(world, household) : (0 as Money)
                const left = household ? monthlyNetOf(world, household) : (0 as Money)
                return (
                  <>
                    {/* NAMED FOR WHAT IT IS (playtest: after retiring,
                        "Your pay: $172,804.92/yr" — "a figure that doesn't
                        reconcile with pension income... or any prior
                        salary"). It reconciled perfectly — it WAS the
                        pensions, at today's prices, printed under a label
                        that says wages. The reviewer chased a phantom
                        salary because the label lied about the
                        composition. `personalIncome` is wages + service
                        pay + sports pay + pensions; the label now follows
                        whichever is actually flowing. */}
                    <Row
                      label={
                        (world.employment.get(person.id)?.monthlyPay ?? 0) > 0
                          ? 'Your pay'
                          : gross > 0
                            ? 'Pensions & benefits'
                            : 'Your pay'
                      }
                      value={gross > 0 ? `${formatMoney(annualPay(gross))} / yr` : 'no wages'}
                    />
                    <Row
                      label="Tax withheld"
                      value={gross > 0 ? `−${formatMoney(withheld)} / mo` : '—'}
                      tone="muted"
                    />
                    <Row label="Rent + living" value={`−${formatMoney(costs)}`} />
                    <Row label="Lifestyle + sales tax" value={`−${formatMoney(lifestyle)}`} />
                    <Row
                      label="Left over"
                      value={formatMoney(left)}
                      tone={left < 0 ? 'bad' : 'good'}
                    />
                    {household && household.savings < 0 && (
                      <Row
                        label="The roof is behind"
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


        {tab === 'loans' && (
          <>
            <section className="bank-card">
              <h4>Credit</h4>
              <Row label="Score" value={`${String(credit)} · ${creditWords(credit)}`} />
              {(() => {
                // M-SAFETY §2. A filing is the heaviest thing a file can
                // carry, and it FADES — so the screen says which year it
                // stops counting rather than leaving it as a life sentence.
                const filings = filingsOf(world, person.id)
                const last = filings[filings.length - 1]
                if (!last) return null
                const carries = last.chapter === 7 ? CHAPTER_7_FILE_YEARS : CHAPTER_13_FILE_YEARS
                const off = Math.max(
                  0,
                  carries - Math.floor((world.tick - last.filedAtTick) / 12),
                )
                return (
                  <>
                    <Row label="On file" value={chapterTitle(last.chapter)} tone="bad" />
                    <Row
                      label="Clears in"
                      value={off <= 0 ? 'cleared' : `${String(off)} ${off === 1 ? 'year' : 'years'}`}
                      tone="muted"
                    />
                  </>
                )
              })()}
              <div className="bank-gauge">
                <span style={{ width: `${String(Math.round(((credit - 300) / 550) * 100))}%` }} />
              </div>
              {debt > 0 && <Row label="Owed" value={formatMoney(debt)} tone="bad" />}
            </section>

            {/* ADR-0038. THE PLAN, WHICH USED TO BE INVISIBLE. A chapter 13
                filing took money out of the account every month for three
                to five years and no screen ever mentioned it — the owner
                found out by not being able to do anything about it. */}
            {(() => {
              const filing = openFilingOf(world, person.id)
              if (!filing || filing.dischargedAtTick !== null) return null
              const monthsLeft = planMonthsLeft(filing, world.tick)
              const payoff = planPayoffFor(filing, world.tick)
              const bar = planPayoffBar(filing, (accounts.checking + accounts.savings) as Money, world.tick)
              return (
                <section className="bank-card">
                  <h4>Under the court</h4>
                  <Row label="Filing" value={`Chapter ${String(filing.chapter)}`} />
                  <Row label="Owed at filing" value={formatMoney(filing.owed)} tone="bad" />
                  {filing.chapter === 13 && (
                    <>
                      <Row label="Plan payment" value={`${formatMoney(filing.planMonthly)}/mo`} />
                      <Row
                        label="Months left"
                        value={monthsLeft === 0 ? 'term served' : String(monthsLeft)}
                        tone="muted"
                      />
                      <Row label="Settle in full" value={formatMoney(payoff)} />
                      <div className="bank-actions">
                        <button
                          type="button"
                          disabled={bar !== null}
                          onClick={() => onAct({ verb: 'pay-off-plan' })}
                        >
                          Pay the plan off
                        </button>
                      </div>
                      {bar !== null && <p className="bank-note">{bar}</p>}
                      <p className="bank-note">
                        Settling ends the payments and discharges what is left. The filing itself
                        stays on the record either way.
                      </p>
                    </>
                  )}
                </section>
              )
            })()}

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

            {/* THE OLD HOME SECTION IS GONE (owner, playing: "the home
                section in the bank tab under loans should probably be
                removed now that we have this").

                It let you buy "a home" INTO A NEIGHBOURHOOD — the abstract
                model the property market replaces. Leaving it would have
                been two ways to buy a house that disagree: one that picks a
                street and prices off its rent, one that picks an actual
                door. Money → Property is the only way in now.

                What is worth keeping is the STATE, and it lives where the
                house does. */}

            <section className="bank-card">
              <h4>Apply</h4>
              {/*
                A MORTGAGE IS NOT DRAWN FROM HERE (it belongs to a house),
                AND NEITHER IS A STUDENT LOAN. That one is not a product
                anybody walks in and asks for: it is raised by the
                schoolhouse, for the exact cost of a year, and only when
                the money is not there. Listing it as a cash offer would
                make the cheapest debt in the game a way to borrow
                spending money — and it is the one debt bankruptcy cannot
                clear, so the exploit would also be a trap.
              */}
              {LOAN_TERMS.filter((t) => OVER_THE_COUNTER.includes(t.kind as never)).map((terms) => {
                const rate = offeredRatePerMille(world, credit, terms.kind)
                const has = accounts.loans.some((l) => l.kind === terms.kind)
                // CARRIED FORWARD AT TODAY'S PRICES: $15,000 is a car in the
                // base year and a tank of fuel a century later. The offer has
                // to inflate with everything else or the Loans tab quietly
                // stops meaning anything.
                const offer = atTodaysPrices(world, 1_500_000 as Money) as Money
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
                        onAct({ verb: 'borrow', kind: terms.kind as OverTheCounter, cents: offer })
                      }
                    >
                      {has
                        ? 'carried'
                        : credit < terms.minCredit
                          ? 'refused'
                          : `Borrow ${formatMoney(offer)}`}
                    </button>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {/* REAL ESTATE (owner's real_estate_revamp.md). The mockup puts
            this under Money, and the Money tab already has sub-tabs, so
            it lives here rather than becoming a twelfth top-level tab. */}
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
              const owed = incomeTaxFor(accounts.taxableYtd, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille)
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
