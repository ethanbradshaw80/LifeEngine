/**
 * MY PEOPLE — command, special duty, and the unit's standing.
 * (MILITARY_DEPTH_PLAN §10.1, §10.3, §10.7.)
 *
 * OWNER: "did you not do all the UI's for step 3 and 4?" He was right. The
 * engine knew who was yours, whose trouble had landed on your record, whose
 * letter you had to write, what special duty you were on and how your unit
 * was graded — and not one of those reached a screen. For a set of features
 * whose whole point is NAMES, that is the same as not having built them.
 *
 * §10.3 states the case: "Rank today is a number and a pay grade. It should
 * mean PEOPLE ARE YOURS." This is where that is true.
 *
 * Presentation only (ADR-0012): every fact here is read from the engine on
 * each render, and the only writes are commands.
 */

import type { ReactElement } from 'react'
import { Fold } from './Fold.js'
import {
  DUTY_TITLES,
  enlistedBy,
  formatYear,
  lastInspectionOf,
  letterFor,
  rankTitle,
  specialDutyOf,
  subordinatesOf,
  superiorOf,
  tediumOf,
  unitGradeOf,
  unitKeyOf,
} from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
import type { World } from '@life-engine/engine'

/** Long enough with nothing happening that it is worth saying out loud. */
const QUIET_ENOUGH_TO_WORRY = 600

export function CommandTab({
  world,
  personId,
  onInspect,
}: {
  readonly world: World
  readonly personId: EntityId
  readonly onInspect: (id: EntityId) => void
}): ReactElement {
  const record = world.service.get(personId)
  if (record === undefined) return <p className="feed-empty">No service record.</p>

  const mine = subordinatesOf(world, personId)
  const above = superiorOf(world, personId)
  const boss = above === null ? undefined : world.people.get(above)
  const bossRecord = above === null ? undefined : world.service.get(above)
  const duty = specialDutyOf(world, personId)
  const key = unitKeyOf(world, personId)
  const grade = key === null ? null : unitGradeOf(world, key, world.tick)
  const inspection = lastInspectionOf(world, personId)
  const signedUp = enlistedBy(world, personId)
  const lost = mine.find((id) => world.people.get(id)?.deathTick !== null)
  const letter = lost === undefined ? null : letterFor(world, personId, lost)

  return (
    <div className="tour-squad">
      {/* §10.1. WHERE THE SERVICE HAS YOU, which is not always with your unit.
          Open on arrival: it is the one thing this tab is usually opened for,
          and a screen of shut boxes is its own kind of unfriendly. */}
      <Fold
        title="Where you are"
        open
        hint={duty === null ? 'with your unit' : DUTY_TITLES[duty.duty]}
      >
      <div className="sq-row">
        <span className="sq-ic" aria-hidden="true">
          🧭
        </span>
        <div>
          <div className="nm">
            {duty === null ? 'With your unit' : `On ${DUTY_TITLES[duty.duty]}`}
          </div>
          <div className="sub">
            {duty === null
              ? 'Doing the job you were trained for.'
              : `Away from your unit and your trade until ${formatYear(world, duty.untilTick)}. Hard on the family, good for promotion.`}
          </div>
        </div>
      </div>

      {boss !== undefined && (
        <div className="sq-row">
          <span className="sq-ic" aria-hidden="true">
            ⬆️
          </span>
          <div>
            <div className="nm">You answer to</div>
            <div className="sub">
              <button
                type="button"
                className="link"
                onClick={() => {
                  onInspect(boss.id)
                }}
              >
                {bossRecord === undefined
                  ? ''
                  : `${rankTitle(world, bossRecord.branch, bossRecord.rank, bossRecord.commissioned === true)} `}
                {boss.givenName} {boss.familyName}
              </button>
            </div>
          </div>
        </div>
      )}

      </Fold>

      {/* §10.7. THE UNIT'S OWN STANDING — where the peacetime MUC comes from. */}
      {grade !== null && (
        <Fold
          title="The unit"
          hint={inspection === null ? 'not inspected yet' : inspection.verdict}
        >
          <div className="sq-row">
            <span className="sq-ic" aria-hidden="true">
              🏅
            </span>
            <div>
              <div className="nm">
                {inspection === null
                  ? 'Not inspected yet'
                  : `Last inspection: ${inspection.verdict} (${String(inspection.year)})`}
              </div>
              <div className="sub">
                Standing {Math.round(grade / 10)} out of 100. A better unit is a harder board —
                the bar in the room is the standard of the room.
              </div>
            </div>
            <span
              className={`sq-state ${grade >= 700 ? 's-ok' : grade >= 400 ? 's-warn' : 's-bad'}`}
            >
              {Math.round(grade / 10)}
            </span>
          </div>
        </Fold>
      )}

      {/* §10.3. THE PEOPLE WHO ARE YOURS. */}
      <Fold
        title={mine.length === 0 ? 'Nobody is yours yet' : 'Yours'}
        {...(mine.length === 0 ? {} : { count: mine.length })}
        open={mine.length > 0}
      >
      {mine.length === 0 ? (
        <p className="muted small">
          Below sergeant nobody answers to you. That changes with the third stripe, and then
          their trouble is your trouble.
        </p>
      ) : (
        mine.map((id) => {
          const them = world.people.get(id)
          const theirs = world.service.get(id)
          if (them === undefined || theirs === undefined) return null
          // WHAT THIS ONE HAS COST YOU, read off your own record rather than
          // asserted — the event exists precisely so this line can be true.
          const trouble = world.events.filter(
            (event) =>
              event.type === 'answered-for-one-of-yours' &&
              event.subjectId === personId &&
              event.otherId === id,
          )
          const last = trouble[trouble.length - 1]
          const quiet = tediumOf(world, id, world.tick)
          const dead = them.deathTick !== null
          return (
            <div key={id} className={dead ? 'sq-row gone' : 'sq-row'}>
              <span className="sq-ic" aria-hidden="true">
                {dead ? '🕯️' : trouble.length > 0 ? '⚠️' : '🪖'}
              </span>
              <div>
                <button
                  type="button"
                  className="link nm"
                  onClick={() => {
                    onInspect(id)
                  }}
                >
                  {rankTitle(world, theirs.branch, theirs.rank, theirs.commissioned === true)}{' '}
                  {them.givenName} {them.familyName}
                </button>
                <div className="sub">
                  {dead
                    ? 'Killed. You are the one who writes the letter.'
                    : trouble.length > 0
                      ? `${last?.detail ?? 'Trouble off duty'} — and it went on your record too.`
                      : quiet > QUIET_ENOUGH_TO_WORRY
                        ? 'Nothing has happened to him in a long time. That is when people get into trouble.'
                        : 'Nothing to report, which is what you want.'}
                </div>
              </div>
            </div>
          )
        })
      )}

      </Fold>

      {/* §10.3: "when one of yours dies, you are the one who writes the
          letter. That is the moment the whole system is for." */}
      {letter !== null && (
        <Fold title="The letter" hint="one of yours did not come home" open>
          <p className="muted small">
            One of yours did not come home, and this is the part of the job nobody trains you
            for.
          </p>
          <div className="aar-doc">
            {letter.slice(0, 4).map((line) => (
              <p key={line} className="aar-line">
                {line}
              </p>
            ))}
            <p className="aar-sign">{letter[letter.length - 1]}</p>
          </div>
        </Fold>
      )}

      {/* §10.1's whole reason for existing: the recruiter's own list. */}
      {signedUp.length > 0 && (
        <Fold title="People you signed up" count={signedUp.length}>
          <p className="muted small">
            You sat in the office and they walked in. Their records carry your name on the day
            they enlisted, and will for the rest of their lives.
          </p>
          {signedUp.map((id) => {
            const them = world.people.get(id)
            if (them === undefined) return null
            return (
              <div key={id} className="sq-row">
                <span className="sq-ic" aria-hidden="true">
                  ✍️
                </span>
                <div>
                  <button
                    type="button"
                    className="link nm"
                    onClick={() => {
                      onInspect(id)
                    }}
                  >
                    {them.givenName} {them.familyName}
                  </button>
                  <div className="sub">
                    {them.deathTick !== null ? 'Did not come home.' : 'Enlisted on your watch.'}
                  </div>
                </div>
              </div>
            )
          })}
        </Fold>
      )}
    </div>
  )
}
