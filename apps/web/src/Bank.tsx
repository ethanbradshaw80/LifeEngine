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
  causesFor,
  trustBar,
  trustViewFor,
  walletAccountsOf,
  arrearsOf,
  atTodaysPrices,
  creditOf,
  CHAPTER_7_FILE_YEARS,
  CHAPTER_13_FILE_YEARS,
  chapterTitle,
  creditWords,
  filingsOf,
  economyPhaseWords,
  homeEquityOf,
  homeValueOf,
  incomeTaxFor,
  openFilingOf,
  planMonthsLeft,
  planPayoffBar,
  planPayoffFor,
  marginalRatePerMille,
  marketLevel,
  monthAheadFor,
  netWorthOf,
  liquidShareOf,
  businessWorthOf,
  bricksAndMortarOf,
  propertiesOwnedBy,
  offeredRatePerMille,
  portfolioValue,
  personalIncome,
  totalDebtOf,
  withholdingFor,
} from '@life-engine/engine'
import type { Person, TrustRule, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { LoanKind } from '@life-engine/engine'
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

/** What each debt is called on a statement. */
const LOAN_WORDS: Readonly<Record<LoanKind, string>> = {
  mortgage: 'Mortgage',
  auto: 'Car loan',
  student: 'Student loan',
  personal: 'Personal loan',
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
  const [sector] = useState<string>(SECTORS[0]?.id ?? 'industrial')
  const [trustShare, setTrustShare] = useState(250)
  const [trustRule, setTrustRule] = useState<TrustRule>('income')

  const accounts = accountsOf(world, person.id)
  /**
   * THE LIQUID MONEY IS THE WALLET'S, THE REST IS THIS PERSON'S (H0).
   *
   * OWNER, PLAYING (2026-08-14): "now my 'you have' and 'the bank' disagree,
   * it shows I have zero money to put into the account but my money is 1.9
   * million". Both screens were reading honestly and reading DIFFERENT
   * records. A married couple share one liquid balance, kept on the
   * lower-id spouse's record: the header asks `moneyOnHand`, which reads
   * the wallet, while this screen asked `accountsOf`, which reads the raw
   * personal file — so the spouse who does not hold the wallet looked
   * penniless while the family had nearly two million.
   *
   * Worse, the VERBS on this screen already move the wallet's money
   * (`moveBetweenOwnAccounts` reads `walletOf`), so the buttons were greyed
   * out against a balance they were not going to spend.
   *
   * Loans, retirement, holdings and the tax year stay personal, because
   * they genuinely are.
   */
  const wallet = walletAccountsOf(world, person.id)
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
  const stake = Math.max(0, Math.floor(wallet.savings / 4)) as Money
  /**
   * THE PARTS OF WHAT THEY ARE WORTH, read the same way `netWorthOf` reads
   * them so the itemised list and the headline can never disagree.
   */
  const cash = liquidShareOf(world, person.id) as Money
  // The whole pot behind that share, so the screen can show what it is half
  // of. Equal to `cash` for anybody whose wallet is their own.
  const jointCash = (wallet.checking + wallet.savings) as Money
  const investments = (accounts.brokerage + portfolio) as Money
  const businessWorth = businessWorthOf(world, person.id)
  const owned = propertiesOwnedBy(world, person.id)
  const bricks = bricksAndMortarOf(world, person.id)
  const assets = (cash + investments + retirement + bricks + businessWorth) as Money
  const causes = causesFor(world)
  const trust = trustViewFor(world)
  // A share of what they actually hold, so the decision is "how much of this".
  const trustAmount = Math.floor((jointCash * trustShare) / 1000)
  const trustBarNow = trustBar(world, person.id, trustAmount as Money)

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
              <Row label="Checking" value={formatMoney(wallet.checking)} />
              <Row label="Savings" value={formatMoney(wallet.savings)} />
              <Row label="Investments" value={formatMoney((portfolio + retirement) as Money)} />
              <Row
                label="Home equity"
                value={homeValue > 0 ? formatMoney(homeEquityOf(accounts.loans, homeValue)) : '—'}
              />
              {debt > 0 && <Row label="Debts" value={`−${formatMoney(debt)}`} tone="bad" />}
            </section>

            {/*
              WHAT YOU ARE WORTH, ITEMISED (owner: "Move the net worth tab
              over to the money side as well and have it list out all your
              assets and liability").

              The figure was already at the top of this screen and nowhere
              did it say what it was MADE of, so a player could not tell
              whether they were rich in cash, in bricks, or in a business
              they could not sell this afternoon. Every line reads from the
              same function `netWorthOf` sums, so the parts always add to
              the total shown above — they cannot drift apart.
            */}
            <section className="bank-card">
              <h4>What you own</h4>
              {/*
                SAY WHAT IT IS A SHARE OF (owner: "Net worth isn't counting
                all our assest because the net worth is off just from look at
                it").

                A married couple keeps ONE pot under H0 and this line shows
                half of it, which is correct and was impossible to tell from
                the screen — the number simply looked too small, with nothing
                to compare it against. The couple's total now sits under it in
                muted text, so the half-share reads as a half-share instead of
                as a mistake.
              */}
              <Row label="Your share of the cash" value={formatMoney(cash)} />
              {jointCash > cash && (
                <Row
                  label="— the two of you together hold"
                  value={formatMoney(jointCash)}
                  tone="muted"
                />
              )}
              {investments > 0 && <Row label="Investments" value={formatMoney(investments)} />}
              {retirement > 0 && <Row label="Retirement" value={formatMoney(retirement)} />}
              {/* EVERY DOOR, not just the one they sleep behind (owner:
                  "only counts my home I live in on net worth not property
                  total"). The count is named so a landlord can see the
                  portfolio is in there. */}
              {bricks > 0 && (
                <Row
                  label={
                    owned.length > 1
                      ? `Property · ${String(owned.length)} of them`
                      : owned.length === 1
                        ? 'Your property'
                        : 'Your home'
                  }
                  value={formatMoney(bricks)}
                />
              )}
              {businessWorth > 0 && (
                <Row label="Your share of the business" value={formatMoney(businessWorth)} />
              )}
              <Row label="Everything you own" value={formatMoney(assets)} tone="good" />
            </section>

            {/*
              GIVING IT AWAY — the first of the money sinks (owner: "once you
              get money like that theres nothing to really do").

              On the Bank rather than a tab of its own, because it is a thing
              you do with money and this is where money decisions live. Every
              refusal is `giveBar`'s own words, which is the same function the
              verb calls, so a greyed button and its reason cannot disagree.
            */}
            {/*
              THE FAMILY TRUST — money that outlives the person who earned it.

              On the Bank because it is a thing you do with capital. The
              amount is a slider over what they actually hold, so the decision
              is "how much of this" rather than a number to type; the rule is
              three buttons because a trust with twelve options is a form, not
              a choice.
            */}
            <section className="bank-card">
              <h4>The {trust.familyName} family trust</h4>
              {trust.exists ? (
                <>
                  <Row label="Held in trust" value={formatMoney(trust.held)} />
                  <Row label="Pays out each year" value={formatMoney(trust.yearly)} tone="good" />
                  <Row label="Paid out so far" value={formatMoney(trust.paidOut)} />
                  <Row
                    label="Who it pays"
                    value={
                      trust.beneficiaries.length === 0
                        ? 'nobody yet'
                        : `${String(trust.beneficiaries.length)} of your line`
                    }
                  />
                  <p className="career-note">
                    {trust.beneficiaries.length === 0
                      ? 'No living descendant qualifies yet. It waits — a line can skip a generation and come back.'
                      : trust.beneficiaries.slice(0, 6).join(', ')}
                  </p>
                </>
              ) : (
                <p className="career-note">
                  An estate is settled once: taxed, split between your children, and gone.
                  A trust is the other thing. It never passes through anybody's estate, it
                  pays your line for as long as there is one, and it is <b>not yours any
                  more</b> — you cannot draw on it, and it does not count towards what
                  you are worth. That is the whole trade.
                </p>
              )}

              {!trust.exists && (
                <div className="trust-rules">
                  {([
                    ['income', 'Every descendant', 'Split between all of your line, evenly.'],
                    ['schooling', 'Only for schooling', 'Paid to those actually at their books.'],
                    ['eldest', 'The eldest carries it', 'One heir at a time, undivided.'],
                  ] as const).map(([id, label, blurb]) => (
                    <button
                      key={id}
                      type="button"
                      className={trustRule === id ? 'trust-rule on' : 'trust-rule'}
                      title={blurb}
                      onClick={() => setTrustRule(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="re-slider-label">
                Settle {formatMoney(trustAmount as Money)} — {(trustShare / 10).toFixed(0)}% of what
                you hold
                {/* SAY THE FLOOR WHILE THEY ARE STILL MOVING THE SLIDER, not
                    only once they let go on a number that is too small. */}
                {trustAmount < trust.minimum && (
                  <span className="muted small"> · least is {formatMoney(trust.minimum)}</span>
                )}
              </div>
              <input
                className="re-slider"
                type="range"
                min={50}
                max={1000}
                step={50}
                value={trustShare}
                onChange={(e) => setTrustShare(Number(e.target.value))}
              />
              <button
                type="button"
                className="apply"
                disabled={trustBarNow !== null}
                title={trustBarNow ?? 'Settled for good.'}
                onClick={() =>
                  onAct({
                    verb: 'settle-trust',
                    cents: trustAmount,
                    // An existing trust keeps the rule its founder set; a new
                    // one takes the rule chosen above.
                    rule: trust.exists ? trust.rule : trustRule,
                  })
                }
              >
                {trust.exists ? 'Add to the trust' : 'Settle the trust'}
              </button>
              {/* WHAT IS SHORT, not merely that something is. */}
              {trustBarNow !== null && <p className="career-note bad">{trustBarNow}</p>}
            </section>

            <section className="bank-card">
              <h4>Giving</h4>
              <p className="career-note">
                The town's own institutions. Money given is gone — what it buys is a
                better place than the one you found, and a name that outlasts you.
              </p>
              {causes.map((cause) => (
                <div key={String(cause.placeId)} className="give-cause">
                  <div className="give-cause-head">
                    <b>{cause.name}</b>
                    {cause.endowedBy !== null && (
                      <span className="jobs-chip">the {cause.endowedBy} name is on it</span>
                    )}
                  </div>
                  <p className="career-note">{cause.blurb}</p>
                  <div className="give-offers">
                    {cause.offers.map((offer) => (
                      <button
                        key={offer.tier}
                        type="button"
                        className="apply"
                        disabled={offer.bar !== null}
                        title={offer.bar ?? offer.blurb}
                        onClick={() =>
                          onAct({ verb: 'endow', placeId: cause.placeId as number, tier: offer.tier })
                        }
                      >
                        {offer.title} · {formatMoney(offer.cost)}
                      </button>
                    ))}
                  </div>
                  {/* WHAT IS SHORT, not merely that something is. */}
                  {cause.offers.every((o) => o.bar !== null) && (
                    <p className="career-note bad">{cause.offers[0]?.bar}</p>
                  )}
                </div>
              ))}
            </section>

            <section className="bank-card">
              <h4>What you owe</h4>
              {accounts.loans.length === 0 && (
                <p className="career-note">Nothing. You owe nobody a penny.</p>
              )}
              {accounts.loans.map((loan, at) => (
                <Row
                  key={`${loan.kind}-${String(at)}`}
                  label={LOAN_WORDS[loan.kind]}
                  value={`−${formatMoney(loan.balance)}`}
                  tone="bad"
                />
              ))}
              {debt > 0 && <Row label="Everything you owe" value={`−${formatMoney(debt)}`} tone="bad" />}
              <Row
                label="Net worth"
                value={formatMoney(worth)}
                tone={worth < 0 ? 'bad' : 'good'}
              />
            </section>

            <section className="bank-card">
              <h4>This month</h4>
              {(() => {
                /**
                 * ONE FUNCTION, EVERY LINE (owner: "the month stats dont even
                 * really add up").
                 *
                 * They did not, and this card was why. It hand-assembled six
                 * numbers from five different functions: the "your share"
                 * lines were actually reading `householdCosts` and
                 * `discretionaryFor`, which answer for the WHOLE ROOF, and
                 * the total added the business draw to `personalMonthlyNet` —
                 * which now already contains it, so the fix to the chip would
                 * have made this card double-count.
                 *
                 * `monthAheadFor` is the single answer, itemised, and its
                 * parts are guaranteed to sum to its own total. Nothing on
                 * this screen does arithmetic any more.
                 */
                const ahead = monthAheadFor(world, person.id)
                const gross = personalIncome(world, person.id)
                const withheld = withholdingFor(gross, world.economy.priceLevelPerMille, world.policy.incomeTaxPerMille)
                const comingIn = (ahead.earned + ahead.draw + ahead.rent + ahead.interest) as Money
                const left = ahead.net
                const draw = ahead.draw
                return (
                  <>
                    {/*
                      YOUR MONEY, NOT THE HOUSEHOLD'S (owner, playing,
                      2026-08-14: "The money tab should just have my info i
                      hate how we include other peoples money in our income,
                      I dont care if were married lets just keep this info as
                      just all the income you are receiving for that month").
                      
                      Every line here is now this person's own, by the month,
                      and the total is what THEY received. The household's
                      shared costs are still shown, because rent is genuinely
                      shared and pretending otherwise would be a different
                      lie — but they are named as the household's, and no
                      part of a partner's WAGE appears anywhere on this tab.

                      Monthly rather than annualised, because he asked for
                      what arrives "for that month" and a yearly figure on a
                      monthly statement is how the pension confusion started.
                    */}
                    <Row
                      label="Coming in this month"
                      value={comingIn > 0 ? formatMoney(comingIn) : 'nothing'}
                      tone={comingIn > 0 ? 'good' : undefined}
                    />
                    {ahead.earned > 0 && (
                      <Row
                        label={
                          (world.employment.get(person.id)?.monthlyPay ?? 0) > 0
                            ? '— your pay, after tax'
                            : '— pensions & benefits'
                        }
                        value={formatMoney(ahead.earned)}
                        tone="muted"
                      />
                    )}
                    {draw > 0 && (
                      <Row
                        label="— drawn from the business"
                        value={formatMoney(draw)}
                        tone="muted"
                      />
                    )}
                    {/* THE TWO THAT WERE NEVER SHOWN ANYWHERE. On a wealthy
                        character the interest is the biggest line on the
                        card — measured at $4,800 a month against a $500
                        wage — and no screen in the game had ever named it. */}
                    {ahead.rent > 0 && (
                      <Row label="— rent from your tenants" value={formatMoney(ahead.rent)} tone="muted" />
                    )}
                    {ahead.interest > 0 && (
                      <Row label="— interest on your savings" value={formatMoney(ahead.interest)} tone="muted" />
                    )}
                    <Row
                      label="Tax withheld"
                      value={gross > 0 ? `−${formatMoney(withheld)}` : '—'}
                      tone="muted"
                    />
                    <Row label="Your share of rent + living" value={`−${formatMoney(ahead.costs)}`} />
                    {/* SAY WHAT THE CHARGE IS (owner: "a random Lifestyle ·
                        the life between rent and the bank which doesnt even
                        say what the charge really is but its always super
                        high"). It is a SHARE OF WHAT IS LEFT, which is why it
                        rises with income, and the line now says so. */}
                    <Row
                      label="Day-to-day living"
                      value={`−${formatMoney(ahead.lifestyle)}`}
                    />
                    <Row
                      label="Left over"
                      value={formatMoney(left)}
                      tone={left < 0 ? 'bad' : 'good'}
                    />
                    {household && arrearsOf(world, household) > 0 && (
                      <Row
                        label="The roof is behind"
                        value={formatMoney(arrearsOf(world, household))}
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
              <Row label="Balance" value={formatMoney(wallet.checking)} />
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={wallet.checking <= 0}
                  onClick={() => onAct({ verb: 'bank-deposit', cents: wallet.checking })}
                >
                  Move all to savings
                </button>
              </div>
            </section>
            <section className="bank-card">
              <h4>Savings</h4>
              <Row label="Balance" value={formatMoney(wallet.savings)} />
              <Row label="Interest" value={`${(economy.ratePerMille / 10).toFixed(1)}% APY`} tone="muted" />
              <div className="bank-actions">
                <button
                  type="button"
                  disabled={wallet.savings <= 0}
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
              const bar = planPayoffBar(filing, (wallet.checking + wallet.savings) as Money, world.tick)
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
                {accounts.loans.map((loan) => {
                  /**
                   * A DEBT YOU CAN ACTUALLY ATTACK (live player, with a
                   * screenshot: "still no way to pay off your debt, and
                   * debt doesn't automatically mean file for bankruptcy
                   * either — we need to be able to pay off debt").
                   *
                   * The whole chain existed — the 'pay-down' verb, the
                   * bar, the single-writer movement in finances — and
                   * this screen never wired a button to it. The player
                   * held $54,000 against a $57,000 student loan and the
                   * only debt verbs the game surfaced were new loans and
                   * bankruptcy. Eighth time a working capability sat
                   * behind no path.
                   *
                   * Two buttons per loan: a chunk (a tenth of the
                   * balance, floored at $500) and the full balance. Both
                   * grey through the same bar the verb refuses with, and
                   * the engine caps what actually moves at what the
                   * accounts hold — the button names an intent, the
                   * ledger decides the cents.
                   */
                  const liquid = wallet.checking + wallet.savings
                  const chunk = Math.max(50_000, Math.floor(loan.balance / 10))
                  const canPay = liquid > 0
                  return (
                    <div key={loan.kind} className="loan-row">
                      <Row
                        label={`${loan.kind} · ${(loan.ratePerMille / 10).toFixed(1)}%`}
                        value={`${formatMoney(loan.balance)} · ${formatMoney(loan.monthlyPayment)}/mo`}
                        tone={loan.missedMonths > 0 ? 'bad' : undefined}
                      />
                      <div className="loan-actions">
                        <button
                          type="button"
                          className="apply"
                          disabled={!canPay}
                          onClick={() => onAct({ verb: 'pay-down', kind: loan.kind, cents: Math.min(chunk, liquid) })}
                        >
                          Pay {formatMoney(Math.min(chunk, liquid) as never)}
                        </button>
                        <button
                          type="button"
                          className="apply"
                          disabled={liquid < loan.balance}
                          title={liquid < loan.balance ? 'You cannot cover the whole balance yet.' : undefined}
                          onClick={() => onAct({ verb: 'pay-down', kind: loan.kind, cents: loan.balance })}
                        >
                          Pay it off
                        </button>
                      </div>
                    </div>
                  )
                })}
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
