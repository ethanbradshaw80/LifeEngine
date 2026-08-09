/**
 * ATHLETE CAREERS (owner's `sports.html`).
 *
 * Built from the mockup's screens: the overall-and-position card, the
 * position stat bars, the college offers earned by your record, and the
 * pro dashboard with its contract and season line.
 *
 * THE PALETTE IS THE APP'S. `sports.html` is dark-only and names
 * `--green`/`--gold`/`--panel2`; the equivalents here are defined for
 * light and dark both.
 *
 * WHAT THE SCREEN NEVER SHOWS is potential. A player does not know their
 * own ceiling, and a number for it on this screen would end the story on
 * the first day.
 */

import type { ReactElement } from 'react'
import { formatMoney } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import {
  DRAFT_AGE,
  SKILL_TITLES,
  athleteOf,
  overallOf,
  positionById,
  positionsFor,
  trainingRisk,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { VerbRequest } from './engine.worker.js'

interface Props {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly age: number
  readonly onAct: (action: VerbRequest) => void
}

export function Sports({ world, person, busy, age, onAct }: Props): ReactElement {
  const record = athleteOf(world, person.id)

  // NEVER PLAYED, which is where almost everybody stays.
  if (record === undefined) {
    return (
      <div className="sp">
        <section className="sp-card">
          <h4>Try out for the team</h4>
          <p className="muted small">
            It starts at school, and most people who try out are cut. Pick a position — what you
            train and what a scout reads depend on it.
          </p>
          <div className="sp-positions">
            {positionsFor('basketball').map((position) => (
              <button
                key={position.id}
                type="button"
                className="apply"
                disabled={busy || age < 12 || age > 18}
                onClick={() =>
                  onAct({ verb: 'try-out', sport: 'basketball', positionId: position.id })
                }
              >
                {position.short} · {position.title}
              </button>
            ))}
          </div>
          {(age < 12 || age > 18) && (
            <div className="reason">
              🔒 {age < 12 ? 'Too young for the school team yet.' : 'That road starts at school, and school is behind you.'}
            </div>
          )}
        </section>
      </div>
    )
  }

  const position = positionById(record.positionId)
  const overall = overallOf(record)
  const done = record.level === 'done'
  const offers = record.offers ?? []

  return (
    <div className="sp">
      {/* THE HEADLINE CARD — the mockup's overall-and-position block. */}
      <section className="sp-ovr">
        <div className="ball">🏀</div>
        <div>
          <div className="pos">{position?.title ?? 'Player'}</div>
          <div className="sub">
            {done
              ? `It ended: ${record.endedBecause || 'you stopped playing'}`
              : record.level === 'pro'
                ? `${record.teamName}${record.draftPick === null ? '' : ` · drafted ${String(record.draftPick)}`}`
                : record.level === 'college'
                  ? record.teamName
                  : record.level === 'highschool'
                    ? 'varsity'
                    : 'school team'}
          </div>
        </div>
        <div className="rate">
          <div className="n">{overall}</div>
          <div className="k">Overall</div>
        </div>
      </section>

      {!done && (
        <>
          <section className="sp-card">
            <h4>Your position stats</h4>
            {(position?.skills ?? []).map((skill) => {
              const value = record.stats[skill] ?? 0
              return (
                <div key={skill} className="sp-stat">
                  <div className="top">
                    <span>{SKILL_TITLES[skill] ?? skill}</span>
                    <span className="v">{value}</span>
                  </div>
                  <div className="bar">
                    <i className={value >= 80 ? 'hot' : ''} style={{ width: `${String(value)}%` }} />
                  </div>
                </div>
              )
            })}
          </section>

          {/* TRAINING, AND THE FATIGUE THAT MAKES IT A RHYTHM RATHER THAN A
              BUTTON. The risk is shown as words, because a percentage
              would invite optimising instead of deciding. */}
          <section className="sp-card">
            <h4>The work</h4>
            <div className="sp-fatigue">
              <div className="top">
                <span>Fatigue</span>
                <span className="v">
                  {record.fatigue >= 700
                    ? 'running on empty'
                    : record.fatigue >= 400
                      ? 'carrying a load'
                      : 'fresh'}
                </span>
              </div>
              <div className="bar">
                <i
                  className={record.fatigue >= 700 ? 'bad' : record.fatigue >= 400 ? 'warn' : ''}
                  style={{ width: `${String(Math.min(100, Math.floor(record.fatigue / 10)))}%` }}
                />
              </div>
            </div>
            {trainingRisk(record.fatigue, record.stats['durability'] ?? 50) > 0 && (
              <p className="reason">
                ⚠ Training this tired is how people get hurt, and it is worth less than it would be
                fresh.
              </p>
            )}
            <div className="sp-btns">
              {(['skill', 'strength', 'conditioning'] as const).map((focus) => (
                <button
                  key={focus}
                  type="button"
                  className="apply"
                  disabled={busy}
                  onClick={() => onAct({ verb: 'train', focus })}
                >
                  {focus === 'skill' ? 'Skill work' : focus === 'strength' ? 'Lift' : 'Conditioning'}
                </button>
              ))}
              <button
                type="button"
                className="apply ghost"
                disabled={busy || record.fatigue <= 0}
                onClick={() => onAct({ verb: 'rest-up' })}
              >
                Rest
              </button>
            </div>
          </section>

          {offers.length > 0 && (
            <section className="sp-card">
              <h4>College offers · earned by your record</h4>
              {offers.map((offer) => (
                <div key={offer.id} className="sp-offer">
                  <div>
                    <div className="nm">{offer.programme}</div>
                    <div className="sub">{offer.blurb}</div>
                  </div>
                  <span className={`sp-tag ${offer.ride}`}>
                    {offer.ride === 'full' ? 'Full ride' : offer.ride === 'partial' ? 'Partial' : 'Walk-on'}
                  </span>
                  <button
                    type="button"
                    className="apply"
                    disabled={busy}
                    onClick={() => onAct({ verb: 'take-offer', offerId: offer.id })}
                  >
                    Sign
                  </button>
                </div>
              ))}
            </section>
          )}

          {record.lastSeason !== undefined && (
            <section className="sp-card">
              <h4>Last season</h4>
              <div className="sp-line">
                <div className="sl">
                  <div className="n">{record.lastSeason.points}</div>
                  <div className="k">PPG</div>
                </div>
                <div className="sl">
                  <div className="n">{record.lastSeason.rebounds}</div>
                  <div className="k">RPG</div>
                </div>
                <div className="sl">
                  <div className="n">{record.lastSeason.assists}</div>
                  <div className="k">APG</div>
                </div>
                <div className="sl">
                  <div className="n">{Math.floor(record.lastSeason.shootingPerMille / 10)}%</div>
                  <div className="k">FG</div>
                </div>
              </div>
              <div className="sp-row">
                <span>Team record</span>
                <span className="v">
                  {record.lastSeason.teamWins}–{record.lastSeason.teamLosses}
                </span>
              </div>
            </section>
          )}

          {record.level === 'pro' && (
            <section className="sp-card">
              <h4>Contract</h4>
              <div className="sp-row">
                <span>Salary</span>
                <span className="v">{formatMoney((record.wage * 12) as Money)} / yr</span>
              </div>
              <div className="sp-row">
                <span>Seasons played</span>
                <span className="v">{record.seasons}</span>
              </div>
            </section>
          )}

          {record.level === 'college' && (
            <section className="sp-card">
              <h4>The draft</h4>
              <p className="muted small">
                The league takes nobody under {DRAFT_AGE}, and a year removed from school. Sixty
                names are called. Most people who declare do not hear theirs, and the developmental
                road is still there for those who do not.
              </p>
              <button
                type="button"
                className="apply"
                disabled={busy || age < DRAFT_AGE}
                onClick={() => onAct({ verb: 'declare-draft' })}
              >
                Declare for the draft
              </button>
            </section>
          )}

          <button
            type="button"
            className="apply ghost"
            disabled={busy}
            onClick={() => onAct({ verb: 'retire-sport' })}
          >
            Hang them up
          </button>
        </>
      )}

      {done && (
        <p className="muted small">
          It is a life, not a game over. Most people who ever played are here, and there is plenty
          of it left.
        </p>
      )}
    </div>
  )
}
