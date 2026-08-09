/**
 * THE CASINO (owner's `casino_1.html`).
 *
 * Built from the mockup's five screens: the lobby with its rooms and the
 * tournament board, the cashier, the poker room and its stakes ladder, the
 * tournament payout, and the cash-game recap.
 *
 * THE PALETTE IS THE APP'S, NOT THE MOCKUP'S. `casino_1.html` is dark-only
 * and names `--green`, `--red`, `--panel2`, `--felt` and a gold header —
 * none of which exist here. The equivalents used below (`--ok`, `--bad`,
 * `--panel-raised`, `--gold`) are all defined for light AND dark, which is
 * the mistake that made the school screen unreadable in daylight.
 *
 * WHAT THE SCREEN NEVER DOES IS DECIDE ANYTHING. Every outcome is the
 * engine's; this reads state and sends verbs.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'
import { formatMoney } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import {
  BUY_INS_FOR_A_ROLL,
  STAKES,
  TOURNAMENTS,
  gamblerOf,
  holdLevelOf,
  holdWords,
  rollWordsFor,
  tournamentRunning,
  turnProBar,
  stakeById,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { VerbRequest } from './engine.worker.js'

interface Props {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly wallet: Money
  readonly onAct: (action: VerbRequest) => void
}

type Room = 'floor' | 'poker' | 'grind'

/** Today's price of a base-year figure, so the ladder ages with the world. */
function atToday(world: World, cents: Money): Money {
  const level = world.economy?.priceLevelPerMille ?? 1_000
  return Math.floor((cents * level) / 1_000) as Money
}

export function Casino({ world, person, busy, wallet, onAct }: Props): ReactElement {
  const [room, setRoom] = useState<Room>('floor')
  const [bet, setBet] = useState(2_000)
  const record = gamblerOf(world, person.id)
  const level = holdLevelOf(record)
  const chips = record.chips

  return (
    <div className="cas">
      {/* THE TRAY, ALWAYS VISIBLE. The mockup puts the bankroll under the
          header on every screen, and it should: what you can lose tonight
          is the one number that matters at a casino. */}
      <div className="cas-roll">
        <span className="k">Chips</span>
        <span className="v">{formatMoney(chips)}</span>
      </div>
      <div className="cas-wallet">
        <span>Money at the bank</span>
        <span>{formatMoney(wallet)}</span>
      </div>

      {/* THE HONEST WARNING. Not a scold and not a game-over — a plain
          description of a situation, which is what the spec asks for. */}
      {level !== 'none' && (
        <div className={`cas-warn ${level}`}>
          <p>{holdWords(level)}</p>
          {record.inRecoverySinceTick === null ? (
            <button
              type="button"
              className="apply"
              disabled={busy}
              onClick={() => onAct({ verb: 'seek-help' })}
            >
              Walk away, and get help with it
            </button>
          ) : (
            <p className="muted small">
              You have been staying away. It gets easier the longer you do.
            </p>
          )}
        </div>
      )}

      {/* THE CASHIER — the only place money and chips meet. */}
      <section className="cas-cashier">
        <h4>The cashier</h4>
        <div className="cas-betrow">
          <input
            type="range"
            min={1_000}
            max={Math.max(2_000, Math.min(wallet, 5_000_000))}
            step={1_000}
            value={Math.min(bet, Math.max(2_000, wallet))}
            onChange={(e) => setBet(Number(e.target.value))}
            aria-label="How much to buy in for"
          />
          <span className="cas-amt">{formatMoney(bet as Money)}</span>
        </div>
        <div className="cas-btns">
          <button
            type="button"
            className="apply"
            disabled={busy || wallet < bet}
            onClick={() => onAct({ verb: 'buy-chips', cents: bet })}
          >
            Buy chips
          </button>
          <button
            type="button"
            className="apply ghost"
            disabled={busy || chips <= 0}
            onClick={() => onAct({ verb: 'cash-out' })}
          >
            Cash out
          </button>
        </div>
        <p className="muted small">
          Only chips go to a table. Nothing you leave at the cashier can be lost tonight.
        </p>
      </section>

      <div className="cas-tabs">
        {(
          [
            ['floor', 'The floor'],
            ['poker', 'Poker room'],
            ['grind', 'The grind'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={room === id ? 'on' : ''}
            onClick={() => setRoom(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {room === 'floor' && (
        <>
          <div className="cas-room">
            <div className="ic">🃏</div>
            <div>
              <div className="nm">Blackjack</div>
              <div className="d">
                Beat the dealer. The house edge is small but real, and playing well narrows it
                without ever turning it round.
              </div>
              <div className="cas-btns">
                {(['stand', 'hit', 'double'] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className="apply"
                    disabled={busy || chips < bet}
                    onClick={() => onAct({ verb: 'gamble', game: 'blackjack', wager: bet, choice })}
                  >
                    {choice === 'double' ? 'Double' : choice === 'hit' ? 'Hit' : 'Stand'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cas-room">
            <div className="ic">🎰</div>
            <div>
              <div className="nm">Slots</div>
              <div className="d">
                Pure luck and no decision at all. Big prizes, much worse odds. The fastest road to
                trouble in the building.
              </div>
              <div className="cas-btns">
                <button
                  type="button"
                  className="apply"
                  disabled={busy || chips < bet}
                  onClick={() => onAct({ verb: 'gamble', game: 'slots', wager: bet, choice: 'stand' })}
                >
                  Spin
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {room === 'poker' && (
        <>
          <section className="cas-card">
            <h4>Cash games</h4>
            {STAKES.map((stake) => {
              const buyIn = atToday(world, stake.buyIn)
              const roll = rollWordsFor(chips, buyIn)
              return (
                <div key={stake.id} className="cas-stake">
                  <div>
                    <div className="nm">{stake.title}</div>
                    <div className="sub">{formatMoney(buyIn)} a buy-in</div>
                  </div>
                  <span className={`cas-pill ${roll}`}>
                    {roll === 'yes' ? 'Rolled for it' : roll === 'close' ? 'Under-rolled' : 'Not close'}
                  </span>
                  <button
                    type="button"
                    className="apply"
                    disabled={busy || chips < buyIn}
                    onClick={() => onAct({ verb: 'poker', stakeId: stake.id, hours: 5 })}
                  >
                    Sit down
                  </button>
                </div>
              )
            })}
            {/* THE GAME LETS YOU PLAY ABOVE YOUR ROLL, deliberately. It is
                the commonest way people go broke at this, and a casino that
                stopped you would remove the decision the bankroll model
                exists to pose. You are told, and then it is yours. */}
            <p className="muted small">
              A bankroll is {BUY_INS_FOR_A_ROLL} buy-ins. Nothing stops you sitting down short — it
              is just how most people go broke.
            </p>
          </section>

          <section className="cas-card">
            <h4>Tournaments</h4>
            {TOURNAMENTS.map((event) => {
              const buyIn = atToday(world, event.buyIn)
              const running = tournamentRunning(event, world.tick)
              return (
                <div key={event.id} className="cas-stake">
                  <div>
                    <div className="nm">{event.title}</div>
                    <div className="sub">
                      {event.field.toLocaleString()} players · {event.blurb}
                    </div>
                  </div>
                  <span className="cas-buy">{formatMoney(buyIn)}</span>
                  <button
                    type="button"
                    className="apply"
                    disabled={busy || !running || chips < buyIn}
                    onClick={() => onAct({ verb: 'tournament', tournamentId: event.id })}
                  >
                    {running ? 'Enter' : 'Not running'}
                  </button>
                </div>
              )
            })}
          </section>
        </>
      )}

      {room === 'grind' && (
        <>
          <div className="cas-bank">
            <div className="k">Lifetime, at this game</div>
            <div className={`v ${record.lifetimeNet >= 0 ? 'up' : 'dn'}`}>
              {record.lifetimeNet >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(record.lifetimeNet) as Money)}
            </div>
            <div className="g">
              {record.lifetimeNet >= 0
                ? 'Ahead — which most people who play are not.'
                : 'Down. That is the ordinary outcome and it is worth knowing.'}
            </div>
          </div>

          <div className="cas-three">
            <div className="kf">
              <div className="v">{record.pokerSkill}</div>
              <div className="k">Poker skill</div>
            </div>
            <div className="kf">
              <div className="v">{record.hoursPlayed.toLocaleString()}</div>
              <div className="k">Hours played</div>
            </div>
            <div className="kf">
              <div className="v">{record.bestFinish === null ? '—' : `#${record.bestFinish}`}</div>
              <div className="k">Best finish</div>
            </div>
          </div>

          <section className="cas-card">
            <h4>Getting better at it</h4>
            <p className="muted small">
              Skill comes from playing and from studying, and nothing else. It plateaus without real
              volume — there is no switch for this.
            </p>
            <button
              type="button"
              className="apply"
              disabled={busy}
              onClick={() => onAct({ verb: 'study-poker' })}
            >
              📖 Study the game
            </button>
          </section>

          {(() => {
            const low = stakeById('low')
            const bar = turnProBar(record, wallet, low === undefined ? (0 as Money) : atToday(world, low.buyIn))
            if (record.turnedProAtTick !== null) {
              return (
                <section className="cas-card">
                  <h4>You do this for a living</h4>
                  <p className="muted small">
                    Lumpy income and no safety net. A hot stretch funds a life; a long downswing
                    sends you back to a day job.
                  </p>
                </section>
              )
            }
            return (
              <section className="cas-card">
                <h4>Playing for a living</h4>
                <p className="muted small">
                  Self-employment, not a job somebody gives you — which means no wage, no sick pay,
                  and a downswing you have to be able to sit through.
                </p>
                {bar !== null && <div className="reason">🔒 {bar}</div>}
                <button
                  type="button"
                  className="apply"
                  disabled={busy || bar !== null}
                  onClick={() => onAct({ verb: 'turn-pro' })}
                >
                  Turn pro
                </button>
              </section>
            )
          })()}
        </>
      )}
    </div>
  )
}
