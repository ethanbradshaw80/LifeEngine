/**
 * The clerk's office (C3 §18).
 *
 * A read-only browser over what the county actually holds: who has been to
 * court lately and how it ended, and anybody's public convictions. The one
 * exception is the petition, which is the player's own action.
 *
 * THE C1 ASYMMETRY HOLDS AND IS THE WHOLE POINT. A crime nobody was charged
 * with is on no page here. A sealed conviction is on no page here either —
 * that is what sealing means. Your own record shows yours, annotated, so
 * you can see what the county can no longer tell anybody.
 */

import type { JSX } from 'react'
import {
  expungementBar,
  formatYear,
  gateStrengthOf,
  GRADE_TITLES,
  offenceById,
  sentenceInWords,
} from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import type { Person, World } from '@life-engine/engine'

const DISPOSITION_WORDS: Readonly<Record<string, string>> = {
  dismissed: 'dismissed',
  fine: 'fined',
  service: 'community service',
  probation: 'probation',
  suspended: 'suspended sentence',
  split: 'split sentence',
  jail: 'custody',
}

const GATE_WORDS: Readonly<Record<string, string>> = {
  hard: 'still bars doors',
  soft: 'still counts against you',
  none: 'no longer read',
}

export function CountyRecords({
  world,
  person,
  busy,
  onPetition,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  /** The one action here. Everything else is a read-only record. */
  readonly onPetition: () => void
}): JSX.Element {
  // The public docket: everyone with a conviction the county may disclose.
  const docket: { readonly who: Person; readonly tick: number; readonly text: string }[] = []
  for (const record of world.criminal.values()) {
    const who = world.people.get(record.personId)
    if (!who) continue
    for (const conviction of record.convictions) {
      // Sealed is sealed: not on the public page, at any age.
      if (conviction.sealed === true) continue
      const offence = offenceById(conviction.kind)
      const outcome =
        conviction.sentenceMonths > 0
          ? sentenceInWords(conviction.sentenceMonths)
          : DISPOSITION_WORDS[conviction.disposition ?? 'fine'] ?? 'fined'
      docket.push({
        who,
        tick: conviction.tick,
        text: `${who.givenName} ${who.familyName} — ${offence?.title ?? conviction.kind} — ${outcome}`,
      })
    }
  }
  docket.sort((a, b) => b.tick - a.tick || a.who.id - b.who.id)

  const own = world.criminal.get(person.id)
  const bar = expungementBar(world, person.id, world.tick)

  return (
    <>
      <h3>Recent cases</h3>
      {docket.length === 0 ? (
        <p className="muted">The docket is empty. Nobody in the county has been convicted of anything.</p>
      ) : (
        <ol className="timeline">
          {docket.slice(0, 12).map((entry, i) => (
            <li key={`${String(entry.tick)}-${String(entry.who.id)}-${String(i)}`}>
              <div className="row">
                <span className="year">{formatYear(world, entry.tick as never)}</span>
                <span className="what">{entry.text}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small">
        Public record only. A case the county declined to charge is on no page here, and neither
        is a sealed conviction — that is what sealing means.
      </p>

      {own !== undefined && own.convictions.length > 0 && (
        <>
          <h3>What your record still does</h3>
          <ul className="offences">
            {own.convictions.map((conviction, i) => {
              const offence = offenceById(conviction.kind)
              const gate = gateStrengthOf(conviction, world.tick)
              return (
                <li key={`own-${String(conviction.tick)}-${String(i)}`}>
                  <div className="offence-head">
                    <span className="offence-title">
                      {offence?.title ?? conviction.kind}
                      {conviction.sealed === true && <span className="muted small"> · sealed</span>}
                    </span>
                    <span className="muted small">
                      {offence === undefined ? '' : GRADE_TITLES[offence.grade]}
                    </span>
                  </div>
                  <div className="offence-foot">
                    <span className="muted small">
                      {formatYear(world, conviction.tick as never)} ·{' '}
                      {conviction.sentenceMonths > 0
                        ? sentenceInWords(conviction.sentenceMonths)
                        : `${DISPOSITION_WORDS[conviction.disposition ?? 'fine'] ?? 'fined'} ${
                            conviction.fine > 0 ? formatMoney(conviction.fine as never) : ''
                          }`}{' '}
                      · {GATE_WORDS[gate] ?? ''}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <h3>Sealing the file</h3>
          <p className="muted small">
            A petition asks the court to stop everybody reading it. The convictions stay in your
            history — a descendant reading your life still finds them — but hiring and the
            recruiting office no longer see them. A violent felony is never sealed.
          </p>
          <div className="offence-foot">
            <span className="muted small">
              {bar === null ? 'The court would hear a petition now.' : bar}
            </span>
            <button
              type="button"
              className="apply"
              disabled={busy || bar !== null}
              title={bar ?? undefined}
              onClick={onPetition}
            >
              File the petition
            </button>
          </div>
        </>
      )}
    </>
  )
}
