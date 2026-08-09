/**
 * THE TOUR DASHBOARD (owner's `combat_tours_revamp.html` §11).
 *
 * Theatre and operation, a tempo bar, where in the five-beat arc this
 * month falls, the squad roster with who is still standing, and how long
 * is left.
 *
 * WHY IT IS WORTH A SCREEN AT ALL: the tour scaffold and the squad exist
 * in the engine, and without somewhere to show them a player experiences
 * exactly what they experienced before — popups arriving out of nowhere.
 * The arc is the thing that makes a tour readable, and an arc nobody can
 * see is not an arc.
 *
 * The component computes nothing: every value is the engine's.
 */

import type { ReactElement } from 'react'
import {
  ROLE_TITLES,
  beatFor,
  bondWords,
  bondWith,
  phaseFor,
  squadLineFor,
  tempoWords,
} from '@life-engine/engine'
import type { Deployment, World } from '@life-engine/engine'
import type { SquadRole } from '@life-engine/engine'

export function TourPanel({
  world,
  tour,
}: {
  readonly world: World
  readonly tour: Deployment
}): ReactElement {
  const months = tour.endsAtTick - tour.startedAtTick
  const monthsIn = Math.max(0, world.tick - tour.startedAtTick)
  const left = Math.max(0, tour.endsAtTick - world.tick)
  const beat = beatFor(monthsIn, months)
  const phase = phaseFor(beat)
  const squad = tour.squad ?? []
  const living = squad.filter((m) => world.people.get(m.personId)?.deathTick === null)

  return (
    <section className="tour">
      <div className="tour-hd">
        <div className="k">
          {tour.kind === 'rotation' ? 'Rotation' : 'Combat tour'} {tour.tourNumber}
        </div>
        <div className="t">{tour.operation ?? 'Deployed'}</div>
        {tour.tempo !== undefined && (
          <div className="sub">{tempoWords(tour.tempo)}</div>
        )}
      </div>

      {/* THE TEMPO, because how hot a tour runs is the single fact that
          decides what it will be like, and it is set by the war rather
          than by anything the player did. */}
      {tour.tempo !== undefined && (
        <div className="tour-tempo">
          <div className="top">
            <span>Tempo</span>
            <span className="v">{tempoWords(tour.tempo)}</span>
          </div>
          <div className="bar">
            <i
              className={tour.tempo >= 700 ? 'hot' : tour.tempo >= 400 ? 'warm' : ''}
              style={{ width: `${String(Math.min(100, Math.floor(tour.tempo / 10)))}%` }}
            />
          </div>
        </div>
      )}

      {/* WHERE IN THE TOUR THIS IS. The arc is the whole reason month four
          does not read like month one. */}
      <div className="tour-arc">
        <div className="beats">
          {(['arrival', 'grind', 'defining', 'winddown', 'home'] as const).map((id) => (
            <span key={id} className={id === beat ? 'on' : ''}>
              {phaseFor(id).title.split(' · ')[0]}
            </span>
          ))}
        </div>
        <h4>{phase.title}</h4>
        <p>{phase.words}</p>
        <div className="tour-rows">
          <div className="row">
            <span>Month</span>
            <span className="v">
              {monthsIn} of {months}
            </span>
          </div>
          <div className="row">
            <span>Left</span>
            <span className="v">
              {left} month{left === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* THE SQUAD. Names, because that is the whole point of them — and
          the dead stay on the roster, because a squad that quietly forgets
          its losses is the opposite of what this models. */}
      {squad.length > 0 && (
        <div className="tour-squad">
          <h4>
            The team · {living.length} of {squad.length}
          </h4>
          {squad.map((member) => {
            const person = world.people.get(member.personId)
            const dead = person === undefined || person.deathTick !== null
            return (
              <div key={member.personId} className={`sq-row${dead ? ' gone' : ''}`}>
                <div>
                  <div className="nm">{squadLineFor(member, person, world.tick)}</div>
                  {!dead && (
                    <div className="sub">
                      {ROLE_TITLES[member.role as SquadRole] ?? member.role} ·{' '}
                      {bondWords(bondWith(member, world.tick))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {living.length < squad.length && (
            <p className="muted small">
              The ones who are gone stay on this list. That is how it works.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
