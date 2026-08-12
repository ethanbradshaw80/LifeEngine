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
  annualPay,
  atTodaysPrices,
  annualRevenueOf,
  businessBar,
  businessHealthWords,
  businessKindById,
  companyHeadcountOf,
  floatProceedsFor,
  founderSalaryOf,
  ipoBar,
  scaleUpBar,
  valuationOf,
  nextRungOf,
  branchName,
  isServing,
  occupationById,
  rankTitle,
  specialtyFor,
  specialtyTitleFor,
  placeOf,
  promotionBar,
  standingWords,
  moneyOnHand,
  trackById,
  disciplineOf,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

type CareerTab = 'over' | 'ladder' | 'resume' | 'biz'

const TABS: readonly { id: CareerTab; icon: string; label: string }[] = [
  { id: 'over', icon: '▚', label: 'Overview' },
  { id: 'ladder', icon: '≣', label: 'Ladder' },
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
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
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
  // WHETHER THEY ARE SERVING, which is the thing the civilian jobs map
  // cannot answer.
  const record = world.service.get(person.id)
  const serving = record !== undefined && isServing(world, person.id) ? record : undefined
  const businessKind = business === undefined ? undefined : businessKindById(business.kindId)

  return (
    <div className="career">
      <div className="career-head">
        <div className="k">Career</div>
        {/* THE UNIFORM IS THE WORK (owner, playing, about the person
            panel: "if they're in the military it says 'no work'").

            The same wrong assumption lives here, on the player's OWN
            career screen: a serving person holds no employment record
            because the service system owns their working life, so this
            read the civilian jobs map, found nothing, and told a soldier
            they were not working and had no employer. */}
        <div className="career-title">
          {job !== undefined
            ? occupationById(job.occupationId).title
            : serving !== undefined
              ? specialtyTitleFor(
                  specialtyFor(world, serving.specialtyId),
                  serving.commissioned === true,
                )
              : 'Not working'}
        </div>
        <div className="career-emp">
          {job !== undefined
            ? `${workplace?.name ?? 'somewhere in town'}${track === undefined ? '' : ` · ${track.title}`}`
            : serving !== undefined
              ? `${branchName(world, serving.branch)} · ${rankTitle(world, serving.branch, serving.rank, serving.commissioned === true)}`
              : 'No employer'}
        </div>
        {job === undefined && serving !== undefined && (
          <div className="career-pay">{formatMoney(annualPay(serving.monthlyPay))} / yr</div>
        )}
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
            {job === undefined && serving !== undefined ? (
              <section className="career-card">
                <h4>In uniform</h4>
                <p className="career-note">
                  Your working life is the service. The Service tab carries the record — rank,
                  time in grade, schools and deployments.
                </p>
              </section>
            ) : job === undefined ? (
              <section className="career-card">
                <h4>No work</h4>
                <p className="career-note">
                  Nothing coming in from a job this month. The Jobs tab has what the town is
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
                        {state === 'here' &&
                          ` — you · standing ${String(Math.floor((job?.performance ?? 0) / 10))}`}
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
              {(() => {
                /**
                 * WHY YOU ARE STILL ON THIS RUNG (live players, two of
                 * them: "never got promoted in 30 years"). The ladder
                 * quoted the bar — needs 58 — and never your own number or
                 * the reason this year's review said no. An invisible gate
                 * reads as a broken game; this is the same fix the military
                 * Standing row got, from the same complaint. The words are
                 * `promotionBar`'s own — the engine that refuses is the
                 * engine that explains.
                 */
                if (job === undefined || job.trackId === null || track === undefined) return null
                const rungNow = placeOf(job.occupationId)?.rung ?? 0
                const holding = promotionBar(
                  track,
                  rungNow,
                  job.performance,
                  world.tick - job.rungSinceTick,
                  disciplineOf(world, person.id, world.tick),
                  world.education.get(person.id)?.level ?? 'none',
                )
                return (
                  <p className="muted small ladder-holding">
                    {holding !== null
                      ? `What is holding the next rung: ${holding.charAt(0).toLowerCase()}${holding.slice(1)}`
                      : 'You meet the bar. The yearly review decides — being qualified is not the same as being chosen.'}
                  </p>
                )
              })()}
              </ol>
            )}
          </section>
        )}

        {/* OPENINGS LIVED HERE TWICE (owner: "take away 'openings' under
            the career tab — these are the old job layout"; the playtest
            called the same duplication out in §6). The Jobs tab is the job
            board; this was an older copy of it, and once the two tabs sat
            beside each other under Work the duplicate stopped being
            navigable clutter and became visibly the same list twice. One
            board, one place. */}

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
            ) : null}

            {/* THE COMPANY AND THE IPO, built from the owner's careers.html
                third screen: a valuation hero, four figures in a grid, and
                the offering with its rows and its one big button.

                TOKENS ARE THE APP'S, not the mockup's. The mockup is dark
                only and names --green/--gold/--panel2, none of which exist
                here; the equivalents (--ok, --gold, --panel-raised) are all
                defined for light AND dark, which is the mistake that made
                the school screen unreadable in daylight. */}
            {business !== undefined && businessKind !== undefined ? (
              business.scaledAtTick != null ? (
                <section className="co">
                  <div className="co-val">
                    <div className="k">Estimated valuation</div>
                    <div className="v">{formatMoney(valuationOf(business, businessKind))}</div>
                    <div className="g">
                      {business.listedStockId != null
                        ? 'Public — the market prices it now'
                        : `${String(Math.floor((world.tick - (business.scaledAtTick ?? 0)) / 12))} years as a company`}
                    </div>
                  </div>
                  <div className="co-grid">
                    <div className="kv">
                      <div className="k">Annual revenue</div>
                      <div className="v">
                        {formatMoney(annualRevenueOf(business, businessKind))}
                      </div>
                    </div>
                    <div className="kv">
                      <div className="k">Your ownership</div>
                      <div className="v">
                        {String(Math.floor((business.founderStakePerMille ?? 1000) / 10))}%
                      </div>
                    </div>
                    <div className="kv">
                      <div className="k">Your salary</div>
                      <div className="v">
                        {formatMoney(annualPay(founderSalaryOf(business, businessKind)))}
                      </div>
                    </div>
                    <div className="kv">
                      <div className="k">Employees</div>
                      <div className="v">
                        {String(companyHeadcountOf(business, businessKind))}
                      </div>
                    </div>
                  </div>

                  {business.listedStockId == null ? (
                    (() => {
                      const shut = ipoBar(world, person.id)
                      const valuation = valuationOf(business, businessKind)
                      return (
                        <div className={`ipo${shut === null ? '' : ' locked'}`}>
                          <h3>Take the company public</h3>
                          <p>
                            You would sell a slice to the public, keep control, and turn your
                            ownership into tradable shares.
                          </p>
                          <div className="row">
                            <span>Sell to the public</span>
                            <span className="v">30%</span>
                          </div>
                          <div className="row">
                            <span>Cash to you (est.)</span>
                            <span className="v ok">{formatMoney(floatProceedsFor(valuation))}</span>
                          </div>
                          <div className="row">
                            <span>Your remaining stake</span>
                            <span className="v">
                              70% · {formatMoney(Math.floor((valuation * 700) / 1000) as Money)}
                            </span>
                          </div>
                          {shut !== null && <div className="reason">🔒 {shut}</div>}
                          <button
                            type="button"
                            disabled={busy || shut !== null}
                            onClick={() => onAct({ verb: 'take-public' })}
                          >
                            Take {business.name} public (IPO)
                          </button>
                        </div>
                      )
                    })()
                  ) : (
                    <p className="career-note">
                      It trades on the exchange like any other company — a live price, analyst
                      coverage, and news of its own. Your remaining stake is real net worth that
                      rises and falls with the share price. A great year makes you rich; a bad
                      enough run takes the company off the board and the shares with it.
                    </p>
                  )}
                </section>
              ) : (
                (() => {
                  const shut = scaleUpBar(business, businessKind, world.tick)
                  return (
                    <section className="career-card">
                      <h4>Grow it into a company</h4>
                      <p className="career-note">
                        Past a certain size a trade stops being a trade. A company keeps its profit
                        instead of paying it out to you, which is how it grows into something worth
                        floating — you draw a salary and the rest builds the valuation.
                      </p>
                      {shut !== null && <div className="reason">🔒 {shut}</div>}
                      <button
                        type="button"
                        className="apply"
                        disabled={busy || shut !== null}
                        onClick={() => onAct({ verb: 'scale-up' })}
                      >
                        Grow {business.name} into a company
                      </button>
                    </section>
                  )
                })()
              )
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
