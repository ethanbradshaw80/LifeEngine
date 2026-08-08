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
import {
  accountsOf,
  criminalRecordOf,
  formatYear,
  offenceById,
  sentenceInWords,
  valueOf,
} from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import type { Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import {
  SEATED_OFFICES,
  candidacyBar,
  holderOf,
  myCandidacy,
  officeById,
  openBallots,
  partyById,
  voteBar,
} from '@life-engine/engine'
import type { VerbRequest } from './engine.worker.js'
import { CountyRecords } from './CountyRecords.js'

type Department = 'hall' | 'court' | 'ballot' | 'officials'

/**
 * The counters that are not open yet. Stubbed HONESTLY — a card that says
 * what it will be and admits it is not there beats a card that quietly does
 * nothing when it is pressed.
 */
const COMING: readonly { readonly icon: string; readonly name: string; readonly detail: string }[] = [
  { icon: '📜', name: 'Vital Records', detail: 'Births, marriages and deaths in the county.' },
  { icon: '🏷️', name: 'Property & Deeds', detail: 'Who owns what, and who owned it before.' },
  { icon: '🏛️', name: 'Business Registry', detail: 'Every business licensed in the county.' },
]

/**
 * YOUR CAMPAIGN, built to the owner's `government.html`.
 *
 * The polls with you, your opponents and THE UNDECIDED — that last share
 * is the most honest thing on the screen and the thing a campaign is
 * actually fighting over. A war chest, and the three things a candidate
 * does with a week.
 *
 * The bar reuses the analyst-consensus component: same shape, three
 * spans summing to a hundred, so no new colours and no new CSS.
 */
function CampaignView({
  world,
  person,
  busy,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element | null {
  const mine = myCandidacy(world, person.id)
  if (mine === undefined) return null
  const { election, polling } = mine
  const office = officeById(election.officeId)
  const party = partyById(
    election.runners.find((r) => r.personId === person.id)?.partyId ?? '',
  )
  const chest = election.warChest ?? 0
  const months = Math.max(0, election.decidesAtTick - world.tick)
  const undecided = Math.max(
    0,
    1000 - election.runners.reduce((sum, r) => sum + r.polling, 0),
  )
  const others = election.runners.filter((r) => r.personId !== person.id)

  return (
    <section className="hall-card">
      <div className="school-k">Your campaign · {party?.name ?? 'independent'}</div>
      <div className="school-name">Running for {office?.title ?? election.officeId}</div>
      <p className="muted small">
        The polls · {months === 0 ? 'decided this month' : `${String(months)} month${months === 1 ? '' : 's'} out`}
      </p>

      <div className="stock-cons" aria-hidden="true">
        <i style={{ width: `${String(polling / 10)}%`, background: 'var(--accent)' }} />
        {others.map((r) => (
          <i
            key={r.personId}
            style={{ width: `${String(r.polling / 10)}%`, background: 'var(--bad)' }}
          />
        ))}
        <i style={{ width: `${String(undecided / 10)}%`, background: 'var(--muted)' }} />
      </div>

      <div className="school-row">
        <span className="l">You</span>
        <span className="v good">{(polling / 10).toFixed(0)}%</span>
      </div>
      {others.map((r) => {
        const who = world.people.get(r.personId)
        return (
          <div className="school-row" key={r.personId}>
            <span className="l">
              {who === undefined ? 'an opponent' : `${who.givenName} ${who.familyName}`}
            </span>
            <span className="v">{(r.polling / 10).toFixed(0)}%</span>
          </div>
        )
      })}
      <div className="school-row">
        <span className="l">Undecided</span>
        <span className="v warn">{(undecided / 10).toFixed(0)}%</span>
      </div>

      <div className="school-row">
        <span className="l">War chest</span>
        <span className="v tabular">{formatMoney(chest as Money)}</span>
      </div>

      <h3 style={{ marginTop: '0.8rem' }}>This week</h3>
      <div className="school-acts">
        <button
          type="button"
          className="school-act"
          disabled={busy}
          onClick={() =>
            onAct({ verb: 'campaign', officeId: election.officeId, action: 'fundraise' })
          }
        >
          <span className="ic">💵</span>
          Fundraise
        </button>
        <button
          type="button"
          className="school-act"
          disabled={busy}
          onClick={() => onAct({ verb: 'campaign', officeId: election.officeId, action: 'rally' })}
        >
          <span className="ic">📣</span>
          Rally
        </button>
        <button
          type="button"
          className="school-act"
          disabled={busy || chest < 40_000}
          title={chest < 40_000 ? 'Not enough in the chest to buy anything worth having.' : undefined}
          onClick={() =>
            onAct({ verb: 'campaign', officeId: election.officeId, action: 'advertise' })
          }
        >
          <span className="ic">📺</span>
          Ad buy
        </button>
      </div>
      <p className="note small">
        A campaign wins over the people who have not made their minds up. Once those are gone it
        starts taking votes off somebody else, which is harder.
      </p>
    </section>
  )
}

/**
 * THE BALLOT, built to the owner's `government.html`.
 *
 * A race per card, a candidate per row: a party dot, the name, the party,
 * where the polls have them, and a Vote button that greys from the
 * ENGINE'S OWN refusal rather than from a guess the screen makes.
 *
 * The polling deliberately does not add up to a hundred. The mockup shows
 * 48 against 45 with the rest undecided, and that gap is the most honest
 * thing on the screen.
 */
function BallotView({
  world,
  person,
  busy,
  onAct,
  onBack,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onAct: (action: VerbRequest) => void
  readonly onBack: () => void
}): JSX.Element {
  const races = openBallots(world)
  return (
    <>
      <section className="hall-card">
        <div className="hall-head">
          <button type="button" className="hall-back" onClick={onBack}>
            ←
          </button>
          <h3>Your ballot</h3>
        </div>
        {races.length === 0 ? (
          <p className="muted small">
            No ballot is open. Seats come up as terms end, and the campaign runs for a few
            months before the vote.
          </p>
        ) : (
          <p className="muted small">
            {races.length} race{races.length === 1 ? '' : 's'} · decided{' '}
            {formatYear(world, races[0]?.decidesAtTick ?? world.tick)}
          </p>
        )}
      </section>

      {races.map((race) => {
        const office = officeById(race.officeId)
        const bar = voteBar(world, person.id, race.officeId, world.tick)
        return (
          <section className="hall-card" key={race.officeId}>
            <h3>{office?.title ?? race.officeId}</h3>
            {race.runners.map((runner) => {
              const who = world.people.get(runner.personId)
              const party = partyById(runner.partyId)
              const mine = race.playerVote === runner.personId
              return (
                <div className="cand" key={runner.personId}>
                  <span className={`dot tone-${party?.tone ?? 'accent'}`} />
                  <div>
                    <div className="nm">
                      {who === undefined ? 'a candidate' : `${who.givenName} ${who.familyName}`}
                    </div>
                    <div className="pt">{party?.name ?? ''}</div>
                  </div>
                  <span className="poll tabular">{(runner.polling / 10).toFixed(0)}%</span>
                  <button
                    type="button"
                    className={mine ? 'voteb on' : 'voteb'}
                    disabled={busy || (bar !== null && !mine)}
                    title={bar ?? undefined}
                    onClick={() =>
                      onAct({ verb: 'vote', officeId: race.officeId, forPersonId: runner.personId })
                    }
                  >
                    {mine ? 'Voted' : 'Vote'}
                  </button>
                </div>
              )
            })}
            {bar !== null && <p className="muted small">{bar}</p>}
          </section>
        )
      })}

      <CampaignView world={world} person={person} busy={busy} onAct={onAct} />

      {myCandidacy(world, person.id) === undefined && (
        <section className="hall-card">
          <h3>Standing yourself</h3>
          {races.length === 0 ? (
            <p className="muted small">
              Nothing is up for election. Seats come open as terms end, and the ladder starts at
              the School Board and the City Council.
            </p>
          ) : (
            races.map((race) => {
              const bar = candidacyBar(world, person.id, race.officeId, world.tick)
              const office = officeById(race.officeId)
              return (
                <div className="school-row" key={`stand-${race.officeId}`}>
                  <span className="l">{office?.title ?? race.officeId}</span>
                  {bar === null ? (
                    <button
                      type="button"
                      className="voteb"
                      disabled={busy}
                      onClick={() => onAct({ verb: 'stand', officeId: race.officeId })}
                    >
                      Stand
                    </button>
                  ) : (
                    <span className="v warn" title={bar}>
                      {bar}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </section>
      )}
    </>
  )
}

export function CityHall({
  world,
  person,
  busy,
  onPetition,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onPetition: () => void
  readonly onAct: (action: VerbRequest) => void
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
        <button type="button" className="hall-dept" onClick={() => setWhere('ballot')}>
          <span className="ic">📋</span>
          <span className="n">Elections</span>
          <span className="d">
            {openBallots(world).length > 0
              ? `${String(openBallots(world).length)} race${openBallots(world).length === 1 ? '' : 's'} on the ballot now.`
              : 'No ballot is open. The next one comes with the terms.'}
          </span>
        </button>
        <button type="button" className="hall-dept" onClick={() => setWhere('officials')}>
          <span className="ic">🗳️</span>
          <span className="n">Elected Officials</span>
          <span className="d">Who holds office, and since when.</span>
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

      {where === 'ballot' && (
        <BallotView world={world} person={person} busy={busy} onAct={onAct} onBack={() => setWhere('hall')} />
      )}

      {where === 'officials' && (
        <section className="hall-card">
          <div className="hall-head">
            <button type="button" className="hall-back" onClick={() => setWhere('hall')}>
              ←
            </button>
            <h3>Elected Officials</h3>
          </div>
          {SEATED_OFFICES.map((officeId) => {
            const holder = holderOf(world, officeId)
            const office = officeById(officeId)
            const who = holder === undefined ? undefined : world.people.get(holder.personId)
            const party = holder === undefined ? undefined : partyById(holder.partyId)
            return (
              <div className="cand" key={officeId}>
                <span className={`dot tone-${party?.tone ?? 'accent'}`} />
                <div>
                  <div className="nm">
                    {who === undefined ? 'Vacant' : `${who.givenName} ${who.familyName}`}
                  </div>
                  <div className="pt">
                    {office?.title ?? officeId}
                    {party !== undefined && ` · ${party.name}`}
                  </div>
                </div>
                {holder !== undefined && (
                  <span className="poll tabular">
                    since {formatYear(world, holder.sinceTick)}
                  </span>
                )}
              </div>
            )
          })}
        </section>
      )}

      {/* THE DEED REGISTRY (owner, playing: "property and deeds should've
          been updated as well in city hall now that people can buy homes").

          He is right, and it is the correct home for it: a deed is a PUBLIC
          record. The county knows who owns what, and it knows before the
          neighbours do. Everything here is read off the households and the
          accounts — the registry does not store a second copy of who owns
          what, because two records of one fact is how they come to disagree. */}
      <section className="hall-card">
        <h3>Deeds &amp; Property</h3>
        {(() => {
          const household =
            person.householdId === null ? undefined : world.households.get(person.householdId)
          const ownedId = household?.propertyId
          const property = typeof ownedId === 'string' ? world.properties.get(ownedId) : undefined
          const owns = accountsOf(world, person.id).homePlaceId !== null

          return (
            <>
              {property === undefined ? (
                <div className="hall-status">No property is registered to your name.</div>
              ) : (
                <>
                  <div className="hall-name">{property.address}</div>
                  <div className="hall-status">
                    {world.places.get(property.neighbourhoodPlaceId)?.name ?? 'the town'} ·{' '}
                    {property.type} · built {property.yearBuilt}
                  </div>
                  <dl className="hall-facts">
                    <dt>Tenure</dt>
                    <dd>{owns ? 'Owner' : 'Tenant'}</dd>
                    <dt>Assessed value</dt>
                    <dd>{formatMoney(valueOf(world, property))}</dd>
                    <dt>Lot</dt>
                    <dd>
                      {property.lotSqft > 0
                        ? `${property.lotSqft.toLocaleString()} sqft`
                        : 'no land of its own'}
                    </dd>
                  </dl>
                </>
              )}

              {/* WHO OWNS WHAT, for the whole town. A registry that only ever
                  showed your own door would not be a registry. */}
              {(() => {
                const owned = [...world.households.values()]
                  .filter((h) => h.dissolvedTick !== null ? false : typeof h.propertyId === 'string')
                  .slice(0, 8)
                if (owned.length === 0) return null
                return (
                  <>
                    <div className="hall-sub">Registered this county</div>
                    <ul className="hall-deeds">
                      {owned.map((h) => {
                        const p2 = world.properties.get(h.propertyId as string)
                        const head = [...h.memberIds]
                          .map((id) => world.people.get(id))
                          .find((m) => m !== undefined && m.deathTick === null)
                        if (p2 === undefined) return null
                        return (
                          <li key={h.id}>
                            <span className="deed-addr">{p2.address}</span>
                            <span className="deed-who">
                              {head === undefined ? 'unoccupied' : `${head.givenName} ${head.familyName}`}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )
              })()}
            </>
          )
        })()}
      </section>

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
