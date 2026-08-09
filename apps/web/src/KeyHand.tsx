/**
 * THE KEY HAND (owner's `casino_1.html`, screen 2).
 *
 * The felt, the villain, the pot, the board and your two cards — then a
 * read that is deliberately in words rather than a percentage, and three
 * buttons.
 *
 * THE READ IS BLURRED ON PURPOSE. Being told "you are ahead 61 per cent"
 * turns this into arithmetic; being told what you think it is makes it a
 * decision, which is what the spec asks for.
 *
 * The felt is the one place in the app that carries its own colour rather
 * than a token — a poker table is green, and the mockup makes the same
 * call. Everything else here is the app's palette so it reads in both
 * themes.
 */

import type { ReactElement } from 'react'
import { formatMoney } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import type { KeyHand } from '@life-engine/engine'

interface Props {
  readonly hand: KeyHand
  readonly buyIn: Money
  readonly chips: Money
  readonly onChoose: (choice: string) => void
}

/** Split "A♥ K♠ 7♦ 2♣" into cards, so red suits can be red. */
function cards(text: string): readonly string[] {
  return text.split(' ').filter((card) => card.length > 0)
}

function isRed(card: string): boolean {
  return card.includes('♥') || card.includes('♦')
}

export function KeyHandView({ hand, buyIn, chips, onChoose }: Props): ReactElement {
  const pot = Math.floor((buyIn * hand.potPerMille) / 1_000) as Money
  const toCall = Math.floor((buyIn * hand.toCallPerMille) / 1_000) as Money

  return (
    <div className="kh">
      <div className="kh-head">
        <div className="k">A key hand</div>
        <div className="t">{hand.villain} moves all in</div>
      </div>

      <div className="kh-felt">
        <div className="kh-pot">
          Pot <b>{formatMoney(pot)}</b>
        </div>
        <div className="kh-cards">
          {cards(hand.board).map((card, i) => (
            <span key={`${card}-${String(i)}`} className={`kh-card${isRed(card) ? ' r' : ''}`}>
              {card}
            </span>
          ))}
          <span className="kh-card back">?</span>
        </div>
        <div className="kh-hole">
          {cards(hand.hole).map((card, i) => (
            <span key={`${card}-${String(i)}`} className={`kh-card${isRed(card) ? ' r' : ''}`}>
              {card}
            </span>
          ))}
        </div>
        <div className="kh-you">Your hand · {formatMoney(chips)} behind</div>
      </div>

      <p className="kh-read">{hand.read}</p>

      <div className="kh-decide">
        <button type="button" className="fold" onClick={() => onChoose('fold')}>
          Fold
        </button>
        <button type="button" className="call" onClick={() => onChoose('call')}>
          Call {formatMoney(toCall)}
        </button>
        <button type="button" className="shove" onClick={() => onChoose('shove')}>
          Shove
        </button>
      </div>
      <p className="muted small kh-note">
        Folding costs what is already yours in that pot. It is not nothing, and it is not the worst
        thing that can happen here.
      </p>
    </div>
  )
}
