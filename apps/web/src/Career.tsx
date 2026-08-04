/**
 * THE CAREER TAB (M-CAREER §6).
 *
 * The Service tab's civilian twin, and the owner's mockup: five sections
 * behind a bottom bar. Overview is the glance — title, employer, YEARLY
 * pay, a performance meter and how far the next rung is. Ladder draws the
 * track with you on it. Openings lists what you qualify for, in yearly
 * salary, with a plain-English reason on the ones you do not. Résumé is
 * what you have done. Business is the other road.
 *
 * PAY IS SHOWN YEARLY AND PAID MONTHLY, which is the module's own rule —
 * `annualPay` is the one place that multiplication happens.
 *
 * Every number is the engine's. This file computes nothing about a career
 * except which of its numbers to show.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import {
  BUSINESS_KINDS,
  OCCUPATIONS,
  annualPay,
  atTodaysPrices,
  businessBar,
  businessHealthWords,
  businessKindById,
  jobBar,
  nextRungOf,
  occupationById,
  placeOf,
  promotionBar,
  standingWords,
  moneyOnHand,
  trackById,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

type CareerTab = 'over' | 'ladder' | 'open' | 'resume' | 'biz'

const TABS: readonly { id: CareerTab; icon: string; label: string }[] = [
  { id: 'over', icon: '▚', label: 'Overview' },
  { id: 'ladder', icon: '≣', label: 'Ladder' },
  { id: 'open', icon: '🔎', label: 'Openings' },
  { id: 'resume', icon: '▤', label: 'Résumé' },
  { id: 'biz', icon: '◈', label: 'Business' },
]

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="career-row">
      <span className="career-row-label">
        {label}
        {sub !== undefined && <span className="career-row-sub">{sub}</span>}
      </span>
      <span className="career-row-value">{value}</span>
    </div>
  )
}

export function Career({
  world,
  person,
  busy,
  onApplyJob,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onApplyJob: (occupationId: string) => void
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [tab, setTab] = useState<CareerTab>('over')

  const job = world.employment.get(person.id)
  const place = job === undefined ? undefined : placeOf(job.occupationId)
  const track = place?.track ?? (job?.trackId === undefined ? undefined : trackById(job.trackId ?? ''))
  const workplace = job === undefined ? undefined : world.places.get(job.workplaceId)
  const monthsInRung = job === undefined ? 0 : world.tick - job.rungSinceTick
  const next = track === undefined || place === undefined ? undefined : nextRungOf(track, place.rung)
  const bar =
    track === undefined || place === undefined || job === undefined
      ? null
      : promotionBar(track, place.rung, job.performance, monthsInRung)

  const business = [...world.businesses.values()].find(
    (entry) => entry.ownerId === person.id && entry.closedTick === null,
  )

  return (
    <div className="career">
      <div className="career-head">
        <div className="k">Career</div>
        <div className="career-title">
          {job === undefined ? 'Not working' : occupationById(job.occupationId).title}
        </div>
        <div className="career-emp">
          {job === undefined
            ? 'No employer'
            : `${workplace?.name ?? 'somewhere in town'}${track === undefined ? '' : ` · ${track.title}`}`}
        </div>
        {job !== undefined && (
          <div className="career-pay">
            {formatMoney(annualPay(job.monthlyPay))} / yr{' '}
            <span>
              · {Math.floor(monthsInRung / 12)} {Math.floor(monthsInRung / 12) === 1 ? 'year' : 'years'} in
              the job
            </span>
          </div>
        )}
      </div>

      <div className="career-body">
        {tab === 'over' && (
          <>
            {job === undefined ? (
              <section className="career-card">
                <h4>No work</h4>
                <p className="career-note">
                  Nothing coming in from a job this month. The Openings tab has what the town is
                  hiring for.
                </p>
              </section>
            ) : (
              <>
                <section className="career-card">
                  <h4>Performance</h4>
                  <div className="career-meter">
                    <i
                      style={{ width: `${String(Math.round(job.performance / 10))}%` }}
                      className={job.performance >= 500 ? 'good' : 'bad'}
                    />
                  </div>
                  <div className="career-meterline">
                    <span>{standingWords(job.performance)}</span>
                    <span>{Math.round(job.performance / 10)} / 100</span>
                  </div>
                </section>

                <section className="career-card">
                  <h4>
                    {next === undefined
                      ? 'The top of this ladder'
                      : `Next — ${occupationById(next.occupationId).title}`}
                  </h4>
                  {next === undefined ? (
                    <p className="career-note">
                      There is nothing above this one. What is left is doing it well.
                    </p>
                  ) : (
                    <>
                      <div className="career-meter">
                        <i
                          className="gold"
                          style={{
                            width: `${String(
                              Math.min(
                                100,
                                Math.round(
                                  ((monthsInRung / Math.max(1, next.needsMonths)) * 50 +
                                    (job.performance / Math.max(1, next.needsPerformance)) * 50) /
                                    1,
                                ),
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="career-meterline">
                        <span>{bar === null ? 'Ready — the review is the door' : 'On the way'}</span>
                        <span>
                          needs {next.needsPerformance / 10} · {next.needsMonths} months
                        </span>
                      </div>
                      <p className="career-note">{bar ?? 'You meet it. The next review decides.'}</p>
                    </>
                  )}
                </section>

                <section className="career-card">
                  <h4>This job</h4>
                  <Row label="Pay" value={`${formatMoney(annualPay(job.monthlyPay))} / yr`} />
                  <Row
                    label="Time in the job"
                    value={`${String(Math.floor(monthsInRung / 12))} yr ${String(monthsInRung % 12)} mo`}
                  />
                  <Row label="Standing" value={standingWords(job.performance)} />
                </section>
              </>
            )}
          </>
        )}

        {tab === 'ladder' && (
          <section className="career-card">
            <h4>{track === undefined ? 'No ladder' : track.title}</h4>
            {track === undefined || place === undefined ? (
              <p className="career-note">
                This job is not on one of the town&apos;s ladders. Not every job is.
              </p>
            ) : (
              <ol className="rungs">
                {track.rungs.map((rung, index) => {
                  const occupation = occupationById(rung.occupationId)
                  const state = index < place.rung ? 'done' : index === place.rung ? 'here' : 'future'
                  return (
                    <li key={rung.occupationId} className={`rung ${state}`}>
                      <span className="dot" />
                      <span className="t">
                        {occupation.title}
                        {state === 'here' && ' — you'}
                        <span className="s">
                          {formatMoney(annualPay(atTodaysPrices(world, occupation.minMonthlyPay) as Money))}
                          {state === 'future' &&
                            ` · needs ${String(rung.needsPerformance / 10)} · ${String(rung.needsMonths)} mo`}
                          {rung.branchPoint === true && <span className="chip">branch point</span>}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )}

        {tab === 'open' && (
          <>
            <section className="career-card">
              <h4>Openings</h4>
              {/* THE ENGINE'S OWN REFUSAL. jobBar is the same function the
                  button answers from, so a live row and an honest no cannot
                  disagree — the offenceBar pattern. */}
              <ul className="openings">
                {OCCUPATIONS.map((occupation) => ({
                  occupation,
                  shut: jobBar(world, occupation.id),
                }))
                  .sort(
                    (a, b) =>
                      Number(a.shut !== null) - Number(b.shut !== null) ||
                      b.occupation.minMonthlyPay - a.occupation.minMonthlyPay,
                  )
                  .slice(0, 18)
                  .map(({ occupation, shut }) => (
                    <li key={occupation.id} className={shut === null ? undefined : 'is-shut'}>
                      <span className="o-title">
                        {occupation.title}
                        <span className="s">
                          {formatMoney(
                            annualPay(atTodaysPrices(world, occupation.minMonthlyPay) as Money),
                          )}
                          –
                          {formatMoney(
                            annualPay(atTodaysPrices(world, occupation.maxMonthlyPay) as Money),
                          )}{' '}
                          / yr
                        </span>
                        {shut !== null && <span className="s bar">{shut}</span>}
                      </span>
                      <button
                        type="button"
                        className="apply"
                        disabled={busy || shut !== null}
                        onClick={() => onApplyJob(occupation.id)}
                      >
                        Apply
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          </>
        )}

        {tab === 'resume' && (
          <section className="career-card">
            <h4>Work history</h4>
            {(() => {
              const history = world.events.filter(
                (event) =>
                  event.subjectId === person.id &&
                  (event.type === 'hired' ||
                    event.type === 'promoted-at-work' ||
                    event.type === 'left-job' ||
                    event.type === 'opened-business'),
              )
              if (history.length === 0) {
                return <p className="career-note">Nothing on the record yet.</p>
              }
              return (
                <ul className="resume">
                  {[...history].reverse().map((event, index) => (
                    <li key={`${String(event.id)}-${String(index)}`}>
                      <span className="o-title">
                        {event.type === 'promoted-at-work'
                          ? `Promoted — ${occupationById(event.detail ?? '').title}`
                          : event.type === 'opened-business'
                            ? `Opened ${event.detail ?? 'a business'}`
                            : event.type === 'left-job'
                              ? `Left — ${event.detail ?? 'the job'}`
                              : `Hired — ${event.detail ?? 'a job'}`}
                        <span className="s">
                          {1970 + Math.floor(event.tick / 12) + (world.spec.startYear ?? 0) - 1970}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </section>
        )}

        {tab === 'biz' && (
          <>
            {business !== undefined ? (
              <section className="career-card">
                <h4>{business.name}</h4>
                <Row
                  label="Trade"
                  value={businessKindById(business.kindId)?.title ?? business.kindId}
                />
                <Row label="Capital in it" value={formatMoney(business.capital)} />
                <Row label="How it is going" value={businessHealthWords(business)} />
                {business.generations > 0 && (
                  <Row
                    label="Passed down"
                    value={`${String(business.generations)} ${business.generations === 1 ? 'time' : 'times'}`}
                  />
                )}
                <p className="career-note">
                  What it makes is drawn as income each month; what it loses comes out of the capital
                  first. Three bad months in a row and the doors shut.
                </p>
              </section>
            ) : (
              <section className="career-card">
                <h4>Working for yourself</h4>
                <p className="career-note">
                  Capital out of your own savings, gone the moment it is spent. It rides the economy
                  directly — worth more than a wage in a boom and worth less than nothing in a
                  slump — and it can pass to your children.
                </p>
                <ul className="openings">
                  {BUSINESS_KINDS.map((kind) => {
                    const capital = atTodaysPrices(world, kind.capital) as Money
                    const shut = businessBar(
                      kind,
                      moneyOnHand(world, person.id),
                      capital,
                      false,
                      // The bar's own age check reads the person; this screen
                      // only ever draws for the played character.
                      99,
                    )
                    return (
                      <li key={kind.id} className={shut === null ? undefined : 'is-shut'}>
                        <span className="o-title">
                          {kind.title}
                          <span className="s">{formatMoney(capital)} to open</span>
                          {shut !== null && <span className="s bar">{shut}</span>}
                        </span>
                        <button
                          type="button"
                          className="apply"
                          disabled={busy || shut !== null}
                          onClick={() => onAct({ verb: 'start-business', kindId: kind.id })}
                        >
                          Open
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <nav className="career-tabs">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={tab === entry.id ? 'is-active' : ''}
            onClick={() => setTab(entry.id)}
          >
            <span className="i">{entry.icon}</span>
            <span className="l">{entry.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
