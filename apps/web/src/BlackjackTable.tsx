/**
 * THE BLACKJACK TABLE (owner, playing: "there is no popup for when you do
 * blackjack, you should enter the room choose what you bet then a hand comes
 * out and you play blackjack").
 *
 * What was there offered Stand / Hit / Double as three buttons, each of
 * which resolved an ENTIRE hand from its own label. No cards existed in the
 * model at all — you picked a strategy and were told how it went.
 *
 * Every card here is real: dealt by the engine from a seeded shoe, scored by
 * the engine, settled by the engine. This screen renders the hand and sends
 * back a choice. It computes nothing about the outcome, which is the whole
 * point — a table that did its own arithmetic would eventually disagree with
 * the ledger that pays it.
 *
 * NO SUITS, deliberately. The engine models rank only, because rank is all
 * that scores. Drawing hearts and spades would be inventing state the
 * simulation does not have, and this project's rule is that the picture
 * cannot say anything the record does not.
 */

import { formatMoney } from '@life-engine/shared'
import { cardValue, handTotal } from '@life-engine/engine'
import type { BlackjackHand } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'

/** A, J, Q, K or the number — what a player reads off a card face. */
function rankFace(rank: number): string {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

function Card({ rank }: { rank: number }) {
  return (
    <span className="bj-card" aria-label={`card ${rankFace(rank)}`}>
      {rankFace(rank)}
    </span>
  )
}

export function BlackjackTable({
  hand,
  chips,
  options,
  onChoose,
}: {
  hand: BlackjackHand
  chips: number
  options: readonly string[]
  onChoose: (choice: string) => void
}) {
  const mine = handTotal(hand.player)
  const theirs = handTotal(hand.dealer)
  const natural = hand.player.length === 2 && mine === 21
  const bust = mine > 21

  return (
    <div className="bj-table">
      <div className="bj-hd">
        <span className="bj-ttl">Blackjack</span>
        <span className="bj-chips">{formatMoney(chips as Money)} in chips</span>
      </div>

      <div className="bj-side">
        <div className="bj-lbl">
          The house{' '}
          <span className="bj-total">
            {/* ONE CARD SHOWING is the whole tension of the game — the
                second is face down until you have committed. */}
            {hand.dealer.length === 1 ? `showing ${String(theirs)}` : theirs}
          </span>
        </div>
        <div className="bj-cards">
          {hand.dealer.map((rank, i) => (
            <Card key={`d${String(i)}-${String(rank)}`} rank={rank} />
          ))}
          {hand.dealer.length === 1 && <span className="bj-card face-down" aria-label="face down" />}
        </div>
      </div>

      <div className="bj-side">
        <div className="bj-lbl">
          You{' '}
          <span className={`bj-total${bust ? ' bust' : natural ? ' natural' : ''}`}>
            {mine}
            {bust ? ' — bust' : natural ? ' — blackjack' : ''}
          </span>
        </div>
        <div className="bj-cards">
          {hand.player.map((rank, i) => (
            <Card key={`p${String(i)}-${String(rank)}`} rank={rank} />
          ))}
        </div>
      </div>

      <p className="bj-stake muted small">
        {hand.doubled ? 'Doubled — ' : ''}
        {formatMoney((hand.doubled ? hand.wager * 2 : hand.wager) as Money)} on this hand.
      </p>

      <div className="bj-acts">
        {options.map((choice) => (
          <button key={choice} type="button" className="apply" onClick={() => onChoose(choice)}>
            {choice === 'hit'
              ? 'Hit'
              : choice === 'stand'
                ? 'Stand'
                : choice === 'double'
                  ? `Double (${formatMoney((hand.wager * 2) as Money)})`
                  : choice}
          </button>
        ))}
      </div>

      <p className="muted small bj-note">
        {/* The honest line. The house draws to sixteen and stands on
            seventeen, and that fixed rule IS the edge. */}
        The house draws to 16 and stands on 17. That rule is the whole of its
        advantage, and playing well narrows it without ever turning it round.
      </p>
    </div>
  )
}

/** Exported for the panel that decides whether a hand is worth showing. */
export function handIsLive(hand: BlackjackHand): boolean {
  return handTotal(hand.player) <= 21 && cardValue(hand.player[0] ?? 0) > 0
}
