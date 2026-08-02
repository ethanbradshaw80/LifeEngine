import { Fragment, useState } from 'react'
import {
  ageAt,
  criminalRecordOf,
  decorationsOf,
  describeAilment,
  describeTraits,
  isJailed,
  explainDecision,
  healthOf,
  familyHomeSince,
  familyTreeOf,
  formatYear,
  fullName,
  householdCosts,
  householdIncome,
  occupationById,
  other,
  relationshipsOf,
  rentFor,
  timelineFor,
} from '@life-engine/engine'
import type { Relationship, RelationshipType } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'

interface Props {
  readonly world: World
  readonly personId: EntityId
  readonly onSelect: (id: EntityId) => void
}

function NameLink({
  world,
  id,
  onSelect,
}: {
  world: World
  id: EntityId
  onSelect: (id: EntityId) => void
}) {
  const person = world.people.get(id)
  if (!person) return <span>someone</span>
  return (
    <button type="button" className="link" onClick={() => onSelect(id)}>
      {fullName(person)}
    </button>
  )
}

export function PersonDetail({ world, personId, onSelect }: Props) {
  // Which timeline entries have their explanation expanded. This is interface
  // state (what the user has opened), not simulation state — the explanations
  // themselves are generated from the engine's records every render.
  const [openExplanations, setOpenExplanations] = useState<ReadonlySet<number>>(new Set())

  const person = world.people.get(personId)
  if (!person) return <p>That person is not in this world.</p>

  const alive = person.deathTick === null
  const age = ageAt(person.birthTick, alive ? world.tick : person.deathTick)
  const job = world.employment.get(personId)
  const education = world.education.get(personId)
  const household = person.householdId === null ? null : world.households.get(person.householdId)
  const housemates = household?.memberIds.filter((id) => id !== personId) ?? []
  const tree = familyTreeOf(world, personId)
  const timeline = timelineFor(world, personId)

  // Grouped by type so a marriage does not sit in a list of acquaintances.
  const ties = relationshipsOf(world, personId)
  const byType = (type: RelationshipType): Relationship[] =>
    ties.filter((tie) => tie.type === type)

  function toggle(eventId: number) {
    setOpenExplanations((open) => {
      const next = new Set(open)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  return (
    <article className="detail">
      <header>
        <h2>{fullName(person)}</h2>
        <p className="standfirst">
          {alive
            ? `${age} years old · born ${formatYear(world, person.birthTick)}`
            : `Died ${formatYear(world, person.deathTick)} aged ${age} · ${person.causeOfDeath}`}
        </p>
      </header>

      <dl className="facts">
        {/* P3: temperament in words. Reading a friend before deciding to
            court them is the whole point of showing it here. */}
        {describeTraits(person.traits) !== '' && (
          <>
            <dt>Temperament</dt>
            <dd>{describeTraits(person.traits)}</dd>
          </>
        )}
        {alive && job && (
          <>
            <dt>Work</dt>
            <dd>
              {occupationById(job.occupationId).title} · {formatMoney(job.monthlyPay)} a month
            </dd>
          </>
        )}
        {alive && !job && (
          <>
            <dt>Work</dt>
            <dd className="muted">
              {education?.enrolledIn ? `studying (${education.enrolledIn})` : 'not working'}
            </dd>
          </>
        )}
        {education && education.level !== 'none' && (
          <>
            <dt>Schooling</dt>
            <dd>{education.level}</dd>
          </>
        )}
        {alive && (() => {
          const record = healthOf(world, personId)
          const ailing = record !== undefined && record.ailment !== null
          const marked = (record?.disability ?? 0) > 0
          if (!ailing && !marked) return null
          return (
            <>
              <dt>Health</dt>
              <dd>
                {ailing && describeAilment(record.ailment ?? 'injury', record.ailmentKind, record.ailmentSite)}
                {ailing && record.severity >= 600 && <span className="muted"> (serious)</span>}
                {ailing && marked && ' · '}
                {marked && <span className="muted">{record?.marks.join('; ') ?? 'carries old wounds'}</span>}
              </dd>
            </>
          )
        })()}
        {(() => {
          const record = criminalRecordOf(world, personId)
          if (!record || record.convictions.length === 0) return null
          return (
            <>
              <dt>Record</dt>
              <dd>
                {record.convictions.length} conviction{record.convictions.length === 1 ? '' : 's'}
                {isJailed(world, personId) && <span className="bad"> · serving time</span>}
              </dd>
            </>
          )
        })()}
        {decorationsOf(world, personId).length > 0 && (
          <>
            <dt>Decorations</dt>
            <dd>
              {decorationsOf(world, personId).map((award, i) => (
                <span key={`${award.kind}:${award.title}`}>
                  {i > 0 && ', '}
                  {award.title}
                  {award.count > 1 && ` ×${award.count}`}
                  <span className="muted small"> ({formatYear(world, award.tick)})</span>
                </span>
              ))}
            </dd>
          </>
        )}
        {alive && household && (
          <>
            <dt>{age < 18 ? 'Family money' : 'Money'}</dt>
            <dd>
              {formatMoney(household.savings)}
              {household.savings < 0 && <span className="muted"> (behind)</span>}
              <span className="muted small">
                {' '}· {formatMoney(householdIncome(world, household))} in ·{' '}
                {formatMoney(householdCosts(world, household))} out ·{' '}
                {formatMoney(rentFor(world.places.get(household.placeId)?.desirability ?? 0))} rent
              </span>
            </dd>
          </>
        )}
        {household && (
          <>
            <dt>{alive ? 'Home' : 'Lived'}</dt>
            <dd>
              {world.places.get(household.placeId)?.name ?? 'unknown'}
              {familyHomeSince(world, household) !== null && (
                <span className="muted small">
                  {' '}· the family home since {formatYear(world, familyHomeSince(world, household) ?? household.formedTick)}
                </span>
              )}
              {housemates.length > 0 && (
                <>
                  {' with '}
                  {housemates.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ', '}
                      <NameLink world={world} id={id} onSelect={onSelect} />
                    </span>
                  ))}
                </>
              )}
            </dd>
          </>
        )}
        {(
          [
            ['Grandparents', tree.grandparents],
            ['Parents', tree.parents],
            ['Siblings', tree.siblings],
            ['Children', tree.children],
            ['Grandchildren', tree.grandchildren],
          ] as const
        ).map(([label, ids]) =>
          ids.length === 0 ? null : (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd>
                {ids.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <NameLink world={world} id={id} onSelect={onSelect} />
                    {world.people.get(id)?.deathTick !== null && <span className="muted"> †</span>}
                  </span>
                ))}
              </dd>
            </Fragment>
          ),
        )}
        {(['spouse', 'courting', 'former-spouse'] as const).map((type) => {
          const group = byType(type)
          if (group.length === 0) return null
          const label =
            type === 'spouse' ? 'Married to' : type === 'courting' ? 'Courting' : 'Formerly married'
          return (
            <Fragment key={type}>
              <dt>{label}</dt>
              <dd>
                {group.map((tie, i) => (
                  <span key={`${tie.a}:${tie.b}`}>
                    {i > 0 && ', '}
                    <NameLink world={world} id={other(tie, personId)} onSelect={onSelect} />
                    <span className="muted small">
                      {' '}
                      {/* Founding ties are stamped at tick 0 BECAUSE the
                          wedding predates the simulation; printing the
                          record's first year as the date would invent one. */}
                      {tie.typeSinceTick <= 0 ? 'from before the record' : `since ${formatYear(world, tie.typeSinceTick)}`}
                      {tie.endedAtTick !== null && ` — ended ${formatYear(world, tie.endedAtTick)}`}
                    </span>
                  </span>
                ))}
              </dd>
            </Fragment>
          )
        })}

        <dt>Friends</dt>
        <dd>
          {byType('friend').length === 0 ? (
            <span className="muted">none currently</span>
          ) : (
            byType('friend').map((tie, i) => (
              <span key={`${tie.a}:${tie.b}`}>
                {i > 0 && ', '}
                <NameLink world={world} id={other(tie, personId)} onSelect={onSelect} />
              </span>
            ))
          )}
        </dd>
      </dl>

      <h3>Life</h3>
      {timeline.length === 0 ? (
        <p className="muted">Nothing of note has happened yet.</p>
      ) : (
        <ol className="timeline">
          {timeline.map((entry) => (
            <li key={entry.eventId}>
              <div className="row">
                <span className="year">{entry.year}</span>
                <span className="what">{entry.text}</span>
                {entry.decision !== null && (
                  <button
                    type="button"
                    className="why"
                    aria-expanded={openExplanations.has(entry.eventId)}
                    onClick={() => toggle(entry.eventId)}
                  >
                    Why?
                  </button>
                )}
              </div>
              {entry.decision !== null && openExplanations.has(entry.eventId) && (
                <p className="explanation">{explainDecision(world, entry.decision)}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="note small">
        Explanations are assembled from what the simulation recorded at the time.
        Events with no “Why?” were not decisions — being born, or a friend
        drifting away, happened to this person rather than being chosen.
      </p>
    </article>
  )
}
