/**
 * LEGACY — what money is FOR, once there is enough of it.
 *
 * THE REPORT (owner): "Both the trust and giving cards live behind Money →
 * 'The bank', which is a genuinely easy thing to miss."
 *
 * He is right, and burying them was the wrong call. They sat below the
 * accounts, the itemised net worth and the debts on one long scrolling card,
 * so the two things a wealthy player most wants to DO with money were the
 * last things on the screen — and a sink nobody finds is a sink nobody uses.
 *
 * Their own view, named for what they are rather than where they live. The
 * Bank is what you HOLD; this is what outlives you.
 *
 * Every number and every refusal is the engine's own — `causesFor`,
 * `trustViewFor` and `trustBar` — so this file decides nothing about money.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { causesFor, trustBar, trustViewFor, walletAccountsOf } from '@life-engine/engine'
import type { Person, TrustRule, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

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

export function Legacy({
  world,
  person,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [trustShare, setTrustShare] = useState(250)
  const [trustRule, setTrustRule] = useState<TrustRule>('income')

  const wallet = walletAccountsOf(world, person.id)
  const jointCash = (wallet.checking + wallet.savings) as Money
  const causes = causesFor(world)
  const trust = trustViewFor(world)
  const trustAmount = Math.floor((jointCash * trustShare) / 1000)
  const trustBarNow = trustBar(world, person.id, trustAmount as Money)

  return (
    <div className="bank">
      <div className="bank-body">
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

      </div>
    </div>
  )
}
