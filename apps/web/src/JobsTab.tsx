/**
 * JOBS & CAREERS (owner's `jobs-ui.html`).
 *
 * His mockup, built against the engine rather than mock data: category
 * bubbles across the top, the ladders you could start today as cards, the
 * ones that are shut in their own section WITH THE REASON, and a detail view
 * showing the whole climb rung by rung.
 *
 * EVERY REFUSAL ON THIS SCREEN IS THE ENGINE'S OWN WORDS. `joinBar` is the
 * function the verb itself calls, so a card that says you cannot start and a
 * button that refuses can never disagree — the bar pattern this codebase has
 * had to learn the hard way more than once.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { PATH_CATEGORIES, licencesFor, pathsFor } from '@life-engine/engine'
import type { LicenceView, PathView, RungView, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="jobs-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

/** The stress/happiness pair the owner's tables carry, as words. */
function toneOf(rung: RungView): string {
  const stress = rung.stress >= 2 ? 'heavy going' : rung.stress >= 1 ? 'demanding' : 'steady'
  const joy = rung.happiness >= 2 ? 'and worth it' : rung.happiness >= 1 ? 'and rewarding' : rung.happiness < 0 ? 'and thankless' : ''
  return joy === '' ? stress : `${stress} ${joy}`
}

function RungRow({
  rung,
  onClimb,
  busy,
  canClimb,
}: {
  rung: RungView
  onClimb: () => void
  busy: boolean
  canClimb: boolean
}): JSX.Element {
  return (
    <li className={rung.held ? 'jobs-rung is-held' : 'jobs-rung'}>
      <div className="jobs-rung-head">
        <span className="jobs-rung-level">{String(rung.level)}</span>
        <div>
          <div className="jobs-rung-title">
            {rung.title}
            {rung.held && <span className="jobs-chip">where you are</span>}
          </div>
          <div className="jobs-rung-pay">{formatMoney(rung.monthlyPay)}/mo · {toneOf(rung)}</div>
        </div>
      </div>
      <p className="jobs-rung-blurb">{rung.blurb}</p>
      {rung.asks.length > 0 && (
        <div className="jobs-asks">
          {rung.asks.map((ask) => (
            <span key={ask} className="jobs-ask">
              {ask}
            </span>
          ))}
        </div>
      )}
      {/* WHAT IS SHORT, not merely that something is. */}
      {rung.bars.length > 0 && (
        <ul className="jobs-bars">
          {rung.bars.map((bar) => (
            <li key={bar}>{bar}</li>
          ))}
        </ul>
      )}
      {canClimb && (
        <button type="button" className="apply" disabled={busy} onClick={onClimb}>
          Go for it
        </button>
      )}
    </li>
  )
}

function PathCard({
  path,
  onOpen,
}: {
  path: PathView
  onOpen: () => void
}): JSX.Element {
  const entry = path.rungs[0]
  const top = path.rungs[path.rungs.length - 1]
  return (
    <button type="button" className={path.entryBar === null ? 'jobs-card' : 'jobs-card is-shut'} onClick={onOpen}>
      {path.current && <span className="jobs-card-flag">your trade</span>}
      <div className="jobs-card-title">{entry?.title ?? path.name}</div>
      <div className="jobs-card-path">{path.name}</div>
      <div className="jobs-card-pay">
        {formatMoney((entry?.monthlyPay ?? 0) as Money)} — {formatMoney((top?.monthlyPay ?? 0) as Money)}/mo
      </div>
      <p className="jobs-card-blurb">{path.blurb}</p>
      <div className="jobs-card-foot">
        <span className="jobs-card-rungs">{String(path.rungs.length)} rungs</span>
        {path.entryBar !== null && !path.current && <span className="jobs-card-lock">🔒</span>}
      </div>
      {path.entryBar !== null && !path.current && <div className="jobs-card-why">{path.entryBar}</div>}
    </button>
  )
}

export function JobsTab({
  world,
  onAct,
  busy,
}: {
  world: World
  onAct: (request: VerbRequest) => void
  busy: boolean
}): JSX.Element {
  const [category, setCategory] = useState<string>('retail-service')
  const [open, setOpen] = useState<string | null>(null)
  const [showLicences, setShowLicences] = useState(false)

  const paths = pathsFor(world)
  const licences: readonly LicenceView[] = licencesFor(world)
  const mine = paths.find((path) => path.current)
  const inCategory = paths.filter((path) => path.categoryId === category)
  const openable = inCategory.filter((path) => path.entryBar === null || path.current)
  const shut = inCategory.filter((path) => path.entryBar !== null && !path.current)
  const opened = open === null ? undefined : paths.find((path) => path.id === open)

  return (
    <div className="jobs">
      <header className="jobs-head">
        <h3>Jobs &amp; Careers</h3>
        <p className="career-note">
          Every ladder in town, what each rung asks for, and how far it goes. You start at the
          bottom of any trade you take up — what you already know makes the climb quicker, never
          the entry higher.
        </p>
      </header>

      {mine !== undefined && (
        <section className="career-card jobs-mine">
          <h4>Where you are</h4>
          <Stat label="Trade" value={mine.name} />
          <Stat
            label="Rung"
            value={mine.rungs.find((rung) => rung.held)?.title ?? 'starting out'}
          />
          <Stat label="Top of this ladder" value={`${formatMoney(mine.topPay)}/mo`} />
          <button type="button" className="apply" onClick={() => setOpen(mine.id)}>
            See the whole climb
          </button>
        </section>
      )}

      {/* THE BUBBLES, straight from his mockup. */}
      <div className="jobs-bubbles">
        {PATH_CATEGORIES.map((entry) => {
          const count = paths.filter((path) => path.categoryId === entry.id).length
          if (count === 0) return null
          return (
            <button
              key={entry.id}
              type="button"
              className={entry.id === category ? 'jobs-bubble on' : 'jobs-bubble'}
              onClick={() => setCategory(entry.id)}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      {opened !== undefined ? (
        <section className="career-card jobs-detail">
          <button type="button" className="jobs-back" onClick={() => setOpen(null)}>
            ← every trade
          </button>
          <h4>{opened.name}</h4>
          <p className="career-note">{opened.blurb}</p>
          {opened.entryBar !== null && !opened.current && (
            <p className="career-note bad">{opened.entryBar}</p>
          )}
          {opened.entryBar === null && !opened.current && (
            <button
              type="button"
              className="apply"
              disabled={busy}
              onClick={() => onAct({ verb: 'join-path', pathId: opened.id })}
            >
              Start at the bottom — {formatMoney((opened.rungs[0]?.monthlyPay ?? 0) as Money)}/mo
            </button>
          )}
          <ol className="jobs-rungs">
            {opened.rungs.map((rung) => {
              const heldAt = opened.rungs.findIndex((entry) => entry.held)
              const isNext = heldAt >= 0 && rung.level === heldAt + 2
              return (
                <RungRow
                  key={rung.id}
                  rung={rung}
                  busy={busy}
                  canClimb={opened.current && isNext && rung.bars.length === 0}
                  onClimb={() => onAct({ verb: 'climb-path' })}
                />
              )
            })}
          </ol>
        </section>
      ) : (
        <>
          <h4 className="jobs-section">Open to you</h4>
          {openable.length === 0 && (
            <p className="career-note">Nothing in this line of work is open to you yet.</p>
          )}
          <div className="jobs-grid">
            {openable.map((path) => (
              <PathCard key={path.id} path={path} onOpen={() => setOpen(path.id)} />
            ))}
          </div>

          {shut.length > 0 && (
            <>
              <h4 className="jobs-section shut">Shut, for now</h4>
              <div className="jobs-grid">
                {shut.map((path) => (
                  <PathCard key={path.id} path={path} onOpen={() => setOpen(path.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* THE PAPERS. Some trades will not have you without them, and this is
          where you go and get one. */}
      <section className="career-card">
        <button type="button" className="jobs-toggle" onClick={() => setShowLicences(!showLicences)}>
          <h4>Licences &amp; certificates</h4>
          <span>{showLicences ? '−' : '+'}</span>
        </button>
        {showLicences && (
          <>
            <p className="career-note">
              Some work will not have you without the papers, however good you are. You can go
              and get them.
            </p>
            <ul className="jobs-licences">
              {licences.map((licence) => (
                <li key={licence.id} className={licence.held ? 'is-held' : ''}>
                  <div>
                    <div className="jobs-licence-title">
                      {licence.title}
                      {licence.held && <span className="jobs-chip">held</span>}
                    </div>
                    <div className="jobs-licence-blurb">{licence.blurb}</div>
                  </div>
                  {!licence.held && (
                    <button
                      type="button"
                      className="apply"
                      disabled={busy || licence.bar !== null}
                      title={licence.bar ?? undefined}
                      onClick={() => onAct({ verb: 'earn-licence', licenceId: licence.id })}
                    >
                      {formatMoney(licence.cost)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
