/**
 * CITY HALL — the civic record.
 *
 * The owner's restructure: crime and the courthouse were one tab with two
 * sub-tabs, which put the DOING and the RECORD OF HAVING DONE IT in the same
 * place. They are different things and belong to different halves of the
 * town. Crime is now what you can do; this is the building where what
 * happened is written down.
 *
 * A CIVIC HUB, not a records page. Your own rap sheet on top — the thing a
 * player looks for first — then the departments as a grid, then the recent
 * docket underneath. The departments that do not exist yet are shown as
 * departments that do not exist yet, because a civic hub with one working
 * counter and nothing else is a records page pretending.
 *
 * NOTHING BELOW THE UI CHANGED. `CountyRecords` keeps its data, its queries
 * and its behaviour; it has moved house and gained a landing in front of it.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { criminalRecordOf, formatYear, offenceById, sentenceInWords } from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import { CountyRecords } from './CountyRecords.js'

type Department = 'hall' | 'court'

/**
 * The counters that are not open yet. Stubbed HONESTLY — a card that says
 * what it will be and admits it is not there beats a card that quietly does
 * nothing when it is pressed.
 */
const COMING: readonly { readonly icon: string; readonly name: string; readonly detail: string }[] = [
  { icon: '📜', name: 'Vital Records', detail: 'Births, marriages and deaths in the county.' },
  { icon: '🏷️', name: 'Property & Deeds', detail: 'Who owns what, and who owned it before.' },
  { icon: '🏛️', name: 'Business Registry', detail: 'Every business licensed in the county.' },
  { icon: '🗳️', name: 'Elected Officials', detail: 'Who holds office, and since when.' },
  { icon: '📋', name: 'Elections', detail: 'The next ballot, and every one before it.' },
]

export function CityHall({
  world,
  person,
  busy,
  onPetition,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onPetition: () => void
}): JSX.Element {
  const [where, setWhere] = useState<Department>('hall')

  const record = criminalRecordOf(world, person.id)
  const convictions = record?.convictions ?? []
  const jailedUntil = record?.jailedUntilTick ?? null
  const inside = jailedUntil !== null && world.tick < jailedUntil
  const probationUntil = record?.probationUntilTick ?? null
  const onProbation = probationUntil !== null && world.tick < probationUntil

  if (where === 'court') {
    return (
      <div className="hall">
        <button type="button" className="hall-back" onClick={() => setWhere('hall')}>
          ← City Hall
        </button>
        <CountyRecords world={world} person={person} busy={busy} onPetition={onPetition} />
      </div>
    )
  }

  return (
    <div className="hall">
      <div className="hall-head">
        <span className="hall-seal" aria-hidden="true">
          ★
        </span>
        <div>
          <div className="k">County Seat · Public Records</div>
          <div className="t">{world.town.name} City Hall</div>
        </div>
      </div>

      <section className="hall-card hall-rec">
        <h3>Your Record</h3>
        <div className="hall-name">
          {person.givenName} {person.familyName}
        </div>
        <div className="hall-status">
          {convictions.length === 0 ? (
            <>Nothing on file. No convictions, nothing gating anything.</>
          ) : (
            <>
              {convictions.length === 1 ? 'One conviction' : `${convictions.length} convictions`} on
              file — the most recent{' '}
              <b>
                {offenceById(convictions[convictions.length - 1]?.kind ?? '')?.title ?? 'an offence'}{' '}
                ({formatYear(world, convictions[convictions.length - 1]?.tick ?? (0 as never))})
              </b>
              .{' '}
              {inside
                ? 'Currently serving.'
                : onProbation
                  ? `On probation${(record?.suspendedMonths ?? 0) > 0 ? `, with ${sentenceInWords(record?.suspendedMonths ?? 0)} hanging over you` : ''}.`
                  : 'At liberty.'}
            </>
          )}
        </div>
        <div className="hall-btnrow">
          <button type="button" className="hall-btn" onClick={() => setWhere('court')}>
            View rap sheet
          </button>
          <button
            type="button"
            className="hall-btn"
            disabled={busy || convictions.length === 0}
            onClick={onPetition}
          >
            File for expungement
          </button>
        </div>
      </section>

      <div className="hall-grid">
        <button type="button" className="hall-dept" onClick={() => setWhere('court')}>
          <span className="ic">⚖️</span>
          <span className="n">Court Records</span>
          <span className="d">Search anyone&apos;s public record · the recent docket.</span>
        </button>
        {COMING.map((department) => (
          <div key={department.name} className="hall-dept is-soon">
            <span className="ic">{department.icon}</span>
            <span className="n">{department.name}</span>
            <span className="d">{department.detail}</span>
            <span className="soon">not open yet</span>
          </div>
        ))}
      </div>

      <section className="hall-card">
        <h3>Recent docket</h3>
        {(() => {
          // The court's own recent business, read straight off the record —
          // the same events the paper reports, from the county's side.
          const docket = world.events
            .filter(
              (event) =>
                event.type === 'was-convicted' ||
                event.type === 'was-acquitted' ||
                event.type === 'filed-bankruptcy',
            )
            .slice(-8)
            .reverse()
          if (docket.length === 0) {
            return <p className="hall-empty">Nothing before the court this year.</p>
          }
          return (
            <ul className="hall-feed">
              {docket.map((event, index) => {
                const who = world.people.get(event.subjectId)
                const acquitted = event.type === 'was-acquitted'
                const civil = event.type === 'filed-bankruptcy'
                return (
                  <li key={`${String(event.id)}-${String(index)}`}>
                    <span className={civil ? 'hall-tag c' : acquitted ? 'hall-tag a' : 'hall-tag v'}>
                      {civil ? 'civil' : acquitted ? 'acquitted' : 'convicted'}
                    </span>
                    {who === undefined ? 'Somebody' : `${who.givenName} ${who.familyName}`}
                    <span className="s">
                      {civil
                        ? 'petition in bankruptcy'
                        : (offenceById(event.detail?.split(':')[0] ?? '')?.title ?? 'an offence')}{' '}
                      · {formatYear(world, event.tick)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        })()}
      </section>
    </div>
  )
}
