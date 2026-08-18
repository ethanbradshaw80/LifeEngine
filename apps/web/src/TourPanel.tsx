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
  ownSquadRowFor,
  unitRosterOf,
  rankTitle,
  specialtyFor,
  specialtyTitleFor,
  tempoWords,
} from '@life-engine/engine'
import type { Deployment, World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
import type { SquadRole } from '@life-engine/engine'

/**
 * A FACE FOR EACH JOB (owner, playing: the roster rows were bare — "it
 * doesn't have an emoji or logo or nothing, just a dot"). The rest of the
 * app leads every list row with an icon; the squad, the most personal list
 * in the game, led with nothing.
 */
const ROLE_ICONS: Readonly<Record<SquadRole, string>> = {
  leader: '🎖️',
  rifleman: '🪖',
  'automatic-rifleman': '🔫',
  medic: '💊',
  radio: '📻',
}

export function TourPanel({
  world,
  tour,
  onInspect,
}: {
  readonly world: World
  readonly tour: Deployment
  /** Open somebody's own screen. Absent where the panel is read-only. */
  readonly onInspect?: (id: EntityId) => void
}): ReactElement {
  const months = tour.endsAtTick - tour.startedAtTick
  const monthsIn = Math.max(0, world.tick - tour.startedAtTick)
  const left = Math.max(0, tour.endsAtTick - world.tick)
  const beat = beatFor(monthsIn, months)
  const phase = phaseFor(beat)
  const squad = tour.squad ?? []
  const living = squad.filter((m) => world.people.get(m.personId)?.deathTick === null)
  /**
   * YOU ARE IN YOUR OWN TEAM (owner: "the character you are playing should
   * show up in the squad as well with a nickname and stuff").
   *
   * The engine's `squad` is the list the casualty picker draws from, so the
   * player is deliberately absent from it — being shot as your own squadmate
   * is not a thing that should be possible. `ownSquadRowFor` computes his row
   * for the screen instead, so the team reads as five men and him rather than
   * as five men and a gap.
   */
  const you = ownSquadRowFor(
    world,
    tour.personId,
    squad,
    (unitRosterOf(world, tour.personId)?.members ?? []).map((m) => m.personId),
  )
  const rows: readonly { member: typeof you; isYou: boolean }[] = [
    { member: you, isYou: true },
    ...squad.map((member) => ({ member, isYou: false })),
  ]

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
            {/* THE PLAYER IS ON THIS LIST NOW, so he is in the count. It
                read "5 of 5" above six rows. */}
            The team · {living.length + 1} of {squad.length + 1}
          </h4>
          {rows.map(({ member, isYou }) => {
            const person = world.people.get(member.personId)
            const dead = person === undefined || person.deathTick !== null
            /**
             * WHERE EACH OF THEM STANDS, at a glance (the mockup's own
             * d-ok / d-evac / d-kia dots).
             *
             * READ FROM THE HEALTH RECORD, never guessed. A roster that
             * decided for itself who was hurt would eventually contradict
             * the simulation, and this panel exists to report a squad, not
             * to narrate one.
             */
            const health = world.health.get(member.personId)
            const hurt =
              !dead && health !== undefined && health.ailment !== null && health.severity >= 400
            /**
             * SENT HOME IS A STATE OF ITS OWN (owner: "we just saved Robert
             * and he was evacuated but when you go to the squad hes still
             * there and hes on the line all good to go").
             *
             * The row read the health record alone, so an evacuated man went
             * back to "in the fight" the moment his wound healed — the roster
             * had no way to know he was not there any more. Now it reads
             * whether HIS OWN TOUR closed while the player's is still open,
             * which is the fact rather than an inference from a scar.
             */
            const gone =
              !dead &&
              (world.deployments.get(member.personId) ?? []).some(
                (t) => t.startedAtTick === tour.startedAtTick && t.returnedAtTick !== null,
              )
            const state = dead ? 'kia' : gone || hurt ? 'evac' : 'ok'
            const stateWords = dead
              ? `KIA${person?.causeOfDeath ? ` · ${String(person.causeOfDeath).replace(/-/g, ' ')}` : ''}`
              : gone
                ? 'WIA · evacuated, sent home'
                : hurt
                  ? health !== undefined && health.severity >= 700
                    ? 'WIA · medevac'
                    : 'WIA · still on the line'
                  : 'in the fight'
            return (
              <div
                key={member.personId}
                className={`sq-row${dead ? ' gone' : ''}${isYou ? ' you' : ''}`}
              >
                <span className="sq-ic" aria-hidden="true">
                  {ROLE_ICONS[member.role as SquadRole] ?? '🪖'}
                </span>
                <div>
                  {/**
                    * CLICK HIM AND SEE WHO HE IS (owner: "We should be able
                    * to click on the squad member and see their stats").
                    *
                    * They are real people in `world.people` now, so the same
                    * person screen the town uses already knows how to render
                    * them — rank, trade, hometown, service record, the lot.
                    * A squad of names you cannot open was the last place the
                    * old invented squadmates still showed through.
                    */}
                  {(() => {
                    /**
                     * A BOND WITH YOURSELF IS NOT A THING, and `squadLineFor`
                     * ends every line with one. Seen in the browser: the
                     * player's own row read `Gomez "Pockets" · rifleman ·
                     * you have been together a long time`, which is Harry
                     * Gomez being told how well he knows Harry Gomez.
                     *
                     * His row is his name and the name they call him. The
                     * sub-line below already says it is him.
                     */
                    /**
                     * THE NAME LINE IS THE NAME. Seen in the browser: every
                     * row printed its role and bond TWICE — `squadLineFor`
                     * ends with "· automatic rifleman · he is new" and the
                     * sub-line underneath said "automatic rifleman · he is
                     * new" again. Harmless before, when the sub-line was the
                     * only other thing on the row; plainly wrong now that
                     * each man carries three lines.
                     *
                     * So the heading is who he is, and the two lines under it
                     * are what he does and who he is in the service.
                     * `squadLineFor` is still the authority for the dead,
                     * because "killed" belongs in the name.
                     */
                    const label = dead
                      ? squadLineFor(member, person, world.tick)
                      : `${person?.familyName ?? 'You'} "${member.nickname}"`
                    return onInspect === undefined ? (
                      <div className="nm">{label}</div>
                    ) : (
                      <button
                        type="button"
                        className="link nm"
                        onClick={() => { onInspect(member.personId) }}
                      >
                        {label}
                      </button>
                    )
                  })()}
                  {!dead && (
                    <div className="sub">
                      {/**
                        * TWO MEN CALLED "TEAM LEADER" IS NOT A TEAM.
                        *
                        * Seen in the browser: a 1LT and a PV2 both labelled
                        * team leader. Both being there is CORRECT — an
                        * officer commands and an NCO runs the fireteam — but
                        * they are not the same job and must not read as the
                        * same word.
                        */}
                      {isYou && member.role === 'leader'
                        ? 'in command'
                        : (ROLE_TITLES[member.role as SquadRole] ?? member.role)}
                      {/* A bond with yourself is not a thing. */}
                      {isYou ? ' · this is you' : ` · ${bondWords(bondWith(member, world.tick))}`}
                    </div>
                  )}
                  {/**
                    * WHO HE ACTUALLY IS (MILITARY_DEPTH_PLAN §9.0).
                    *
                    * The squad used to be five invented strangers, so a
                    * surname and a nickname were the whole of what existed
                    * to show. They are drawn from the player's own unit now
                    * — real people with a rank, a trade and a hometown —
                    * and a row that still said only "Garcia 'Halo'" would be
                    * hiding the entire point of the change.
                    *
                    * This is the same line the roster and the person screen
                    * give, so the man beside you in a firefight reads as the
                    * man you have been standing next to at the station.
                    */}
                  {(() => {
                    const record = world.service.get(member.personId)
                    if (record === undefined || person === undefined) return null
                    const rank = rankTitle(
                      world,
                      record.branch,
                      record.rank,
                      record.commissioned === true,
                    )
                    const trade = specialtyTitleFor(
                      specialtyFor(world, record.specialtyId),
                      record.commissioned === true,
                    )
                    return (
                      <div className="sub muted">
                        {rank} · {trade}
                        {person.fromAway !== undefined && ` · from ${person.fromAway}`}
                      </div>
                    )
                  })()}
                </div>
                <span className={`sq-state s-${state}`}>
                  <i className={`sq-dot d-${state}`} aria-hidden="true" />
                  {stateWords}
                </span>
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
