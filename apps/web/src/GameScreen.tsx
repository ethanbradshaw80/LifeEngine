/**
 * The game screen: your life, full-bleed. M-GAME, tabs M-GAMEDEPTH.
 *
 * When a character is being played, THIS is the product — a portrait, the
 * felt facts of the life, a story feed of everything that has happened, and
 * one big button that moves time. The town dashboard still exists as the
 * observer view; this screen deliberately shows one person's world, because
 * the charter's whole premise is that the player is one person inside it,
 * not the town's manager.
 *
 * The tabs are progressive disclosure (Law 9): the same engine state the
 * feed summarizes, browsable in depth. Every tab is read-side — the only
 * writes remain advance, choose, stop.
 *
 * Presentation only (ADR-0012): every fact on screen is read from the engine
 * each render, and the only writes are commands.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeWars,
  ageAt,
  childrenIdsOf,
  deploymentsOf,
  describeAilment,
  explainDecision,
  familyHomeSince,
  familyTreeOf,
  formatDate,
  formatYear,
  fullName,
  householdCosts,
  householdIncome,
  monthlyNetOf,
  newsSince,
  OCCUPATIONS,
  occupationById,
  other,
  relationshipsOf,
  rentFor,
  spouseOf,
  timelineFor,
  veteranUnlocks,
} from '@life-engine/engine'
import { BRANCH_NAMES, healthOf, isDeployed, isServing, rankTitle, specialtyById } from '@life-engine/engine'
import type { EducationLevel, EventType, Person, Relationship, ServiceBranch, World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { Avatar } from './Avatar.js'

/** One glyph per event type. Emoji: zero assets, universally shipped. */
const EVENT_ICONS: Partial<Record<EventType, string>> = {
  born: '🍼',
  'started-school': '📚',
  'finished-school': '🎓',
  hired: '💼',
  'got-raise': '💵',
  'was-injured': '🩹',
  'fell-ill': '🤒',
  recovered: '💪',
  enlisted: '🪖',
  promoted: '🎖️',
  reenlisted: '✍️',
  discharged: '📜',
  deployed: '🛫',
  'returned-home': '🛬',
  'wounded-in-action': '🎗️',
  'left-job': '📦',
  befriended: '🤝',
  'friendship-lapsed': '🍂',
  'started-courting': '🌹',
  'courtship-ended': '🥀',
  married: '💍',
  divorced: '💔',
  widowed: '🖤',
  'left-home': '🚪',
  'moved-in-together': '🏠',
  'moved-house': '🚚',
  'had-child': '👶',
  'fell-behind': '📉',
  'back-in-the-black': '📈',
  inherited: '🕯️',
  died: '⚰️',
}

type Tab = 'story' | 'home' | 'family' | 'jobs' | 'news' | 'service' | 'health'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'story', label: '📖 Story' },
  { id: 'home', label: '🏠 Home' },
  { id: 'family', label: '👪 Family' },
  { id: 'jobs', label: '💼 Jobs' },
  { id: 'news', label: '📰 News' },
  { id: 'service', label: '🪖 Service' },
  { id: 'health', label: '🩺 Health' },
]

const SCHOOLING_WORDS: Record<EducationLevel, string> = {
  none: 'no schooling needed',
  primary: 'primary schooling',
  secondary: 'secondary schooling',
  trade: 'trade school',
  college: 'college',
}

const HEALTH_EVENTS: ReadonlySet<EventType> = new Set([
  'was-injured',
  'fell-ill',
  'recovered',
  'wounded-in-action',
])

interface Props {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onAdvance: (months: number) => void
  readonly onStop: () => void
  readonly onInspect: (id: EntityId) => void
}

function PersonLink({
  world,
  id,
  onInspect,
}: {
  world: World
  id: EntityId
  onInspect: (id: EntityId) => void
}) {
  const person = world.people.get(id)
  if (!person) return <span>someone</span>
  return (
    <button type="button" className="link" onClick={() => onInspect(id)}>
      {fullName(person)}
    </button>
  )
}

export function GameScreen({ world, person, busy, onAdvance, onStop, onInspect }: Props) {
  const [openWhy, setOpenWhy] = useState<ReadonlySet<number>>(new Set())
  const [tab, setTab] = useState<Tab>('story')
  const feedRef = useRef<HTMLDivElement | null>(null)

  const age = ageAt(person.birthTick, world.tick)
  const job = world.employment.get(person.id)
  const household = person.householdId === null ? null : world.households.get(person.householdId)
  const home = household ? world.places.get(household.placeId) : null
  const spouseId = spouseOf(world, person.id)
  const spouse = spouseId === null ? null : world.people.get(spouseId)
  const childCount = childrenIdsOf(world, person.id).length
  const entries = useMemo(() => timelineFor(world, person.id), [world, person.id])
  const eventTypeById = useMemo(
    () => new Map(world.events.map((e) => [e.id, e.type])),
    [world],
  )

  // The world's news, woven into the life at the months it happened. A war on
  // the other side of the world shares a feed with a first job — which is how
  // it feels to live through one, until L4-M3 makes it personal.
  const feedItems = useMemo(() => {
    const news = newsSince(world, person.birthTick)
    const merged: (
      | { kind: 'life'; tick: number; entry: (typeof entries)[number] }
      | { kind: 'news'; tick: number; text: string; nearby: boolean }
    )[] = []
    for (const entry of entries) merged.push({ kind: 'life', tick: entry.tick, entry })
    for (const item of news) merged.push({ kind: 'news', tick: item.tick, text: item.text, nearby: item.nearby })
    merged.sort((x, y) => x.tick - y.tick)
    return merged
  }, [world, person.birthTick, entries])

  // The feed follows the life: new events scroll into view as years pass.
  useEffect(() => {
    const feed = feedRef.current
    if (feed) feed.scrollTop = feed.scrollHeight
  }, [feedItems.length, tab])

  function toggleWhy(eventId: number) {
    setOpenWhy((open) => {
      const next = new Set(open)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  // The TRUE monthly change — after lifestyle spending, not just the bills —
  // mirroring the ledger exactly so the chip never flatters the household.
  const monthlyNet = household ? monthlyNetOf(world, household) : 0

  return (
    <div className="game">
      <header className="game-header">
        <Avatar world={world} person={person} size={72} />
        <div className="game-title">
          <h1>{fullName(person)}</h1>
          <p>
            {age} years old · {formatDate(world.tick)}
          </p>
        </div>
        <div className="game-menu">
          <button type="button" onClick={onStop} title="Back to the town view">
            ⏸ Town
          </button>
        </div>
      </header>

      <section className="stat-strip" aria-label="Your life at a glance">
        <div className="stat">
          <span className="stat-label">Work</span>
          {(() => {
            const record = world.service.get(person.id)
            if (record && isServing(world, person.id)) {
              return (
                <>
                  <span className="stat-value">
                    {rankTitle(record.rank)} · {specialtyById(record.specialtyId).title}
                  </span>
                  <span className={isDeployed(world, person.id) ? 'stat-sub bad' : 'stat-sub'}>
                    {formatMoney(record.monthlyPay)}/mo · {isDeployed(world, person.id) ? 'deployed' : 'serving'}
                  </span>
                </>
              )
            }
            return (
              <>
                <span className="stat-value">
                  {job ? `${occupationById(job.occupationId).title}` : age < 18 ? 'growing up' : 'none'}
                </span>
                {job && <span className="stat-sub">{formatMoney(job.monthlyPay)}/mo</span>}
              </>
            )
          })()}
        </div>
        <div className="stat">
          {/* Money is household-level and nobody under 18 works; a child's
              chip says whose pot this actually is (owner feedback). */}
          <span className="stat-label">{age < 18 ? 'Family money' : 'Money'}</span>
          <span className={household && household.savings < 0 ? 'stat-value bad' : 'stat-value'}>
            {household ? formatMoney(household.savings) : '—'}
          </span>
          {household && (
            <span className={monthlyNet < 0 ? 'stat-sub bad' : 'stat-sub'}>
              {monthlyNet >= 0 ? '+' : ''}
              {formatMoney(monthlyNet as never)}/mo
            </span>
          )}
        </div>
        <div className="stat">
          <span className="stat-label">Home</span>
          <span className="stat-value">{home?.name ?? '—'}</span>
          {household && familyHomeSince(world, household) !== null && (
            <span className="stat-sub">the family home</span>
          )}
        </div>
        <div className="stat">
          <span className="stat-label">Health</span>
          {(() => {
            const record = healthOf(world, person.id)
            const ailing = record !== undefined && record.ailment !== null
            const marked = (record?.disability ?? 0) > 0
            return (
              <>
                <span className={ailing && record.severity >= 600 ? 'stat-value bad' : 'stat-value'}>
                  {ailing ? (record.ailment === 'injury' ? 'injured' : 'ill') : 'well'}
                </span>
                <span className="stat-sub">
                  {ailing
                    ? record.severity >= 600
                      ? 'seriously'
                      : 'mending'
                    : marked
                      ? 'carries old wounds'
                      : ' '}
                </span>
              </>
            )
          })()}
        </div>
        <div className="stat">
          <span className="stat-label">Family</span>
          <span className="stat-value">
            {spouse ? (
              <button type="button" className="link" onClick={() => onInspect(spouse.id)}>
                {spouse.givenName}
              </button>
            ) : (
              'single'
            )}
          </span>
          <span className="stat-sub">
            {childCount === 0 ? 'no children' : `${childCount} ${childCount === 1 ? 'child' : 'children'}`}
          </span>
        </div>
      </section>

      <nav className="tab-bar" aria-label="Life sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : undefined}
            aria-current={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'story' && (
        <div className="feed" ref={feedRef} aria-label="Your story so far">
          {feedItems.length === 0 && (
            <p className="feed-empty">
              Your story starts now. Age up and see what the years bring.
            </p>
          )}
          {feedItems.map((item, index) => {
            const previous = feedItems[index - 1]
            const year = formatYear(item.tick as never)
            const showYear = previous === undefined || formatYear(previous.tick as never) !== year

            if (item.kind === 'news') {
              return (
                <div key={`news-${item.tick}-${item.text}`}>
                  {showYear && <div className="feed-year">{year}</div>}
                  <div className={item.nearby ? 'card news nearby' : 'card news'}>
                    <span className="card-icon" aria-hidden="true">
                      📰
                    </span>
                    <span className="card-text">
                      {item.text.charAt(0).toUpperCase() + item.text.slice(1)}.
                    </span>
                  </div>
                </div>
              )
            }

            const entry = item.entry
            const icon = EVENT_ICONS[eventTypeById.get(entry.eventId) ?? 'born']
            return (
              <div key={entry.eventId}>
                {showYear && <div className="feed-year">{year}</div>}
                <div className="card">
                  <span className="card-icon" aria-hidden="true">
                    {icon ?? '•'}
                  </span>
                  <span className="card-text">{entry.text}</span>
                  {entry.decision !== null && (
                    <button
                      type="button"
                      className="why"
                      aria-expanded={openWhy.has(entry.eventId)}
                      onClick={() => toggleWhy(entry.eventId)}
                    >
                      Why?
                    </button>
                  )}
                </div>
                {entry.decision !== null && openWhy.has(entry.eventId) && (
                  <p className="card-why">{explainDecision(world, entry.decision)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'home' && (
        <div className="panel" aria-label="Home">
          {!household || !home ? (
            <p className="feed-empty">No household yet.</p>
          ) : (
            <dl className="facts">
              <dt>Home</dt>
              <dd>
                {home.name}
                {familyHomeSince(world, household) !== null && (
                  <span className="muted small">
                    {' '}· the family home since{' '}
                    {formatYear(familyHomeSince(world, household) ?? household.formedTick)}
                  </span>
                )}
              </dd>
              <dt>Rent</dt>
              <dd>{formatMoney(rentFor(home.desirability))} a month</dd>
              <dt>{age < 18 ? 'Family money' : 'Money'}</dt>
              <dd>
                {formatMoney(household.savings)}
                {household.savings < 0 && <span className="muted"> (behind)</span>}
                <span className="muted small">
                  {' '}· {formatMoney(householdIncome(world, household))} in ·{' '}
                  {formatMoney(householdCosts(world, household))} out
                </span>
              </dd>
              <dt>Household</dt>
              <dd>
                {household.memberIds.length === 1 ? (
                  <span className="muted">just you</span>
                ) : (
                  household.memberIds
                    .filter((id) => id !== person.id)
                    .map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <PersonLink world={world} id={id} onInspect={onInspect} />
                      </span>
                    ))
                )}
                <span className="muted small"> · this household since {formatYear(household.formedTick)}</span>
              </dd>
            </dl>
          )}
        </div>
      )}

      {tab === 'family' && (
        <div className="panel" aria-label="Family">
          {(() => {
            const tree = familyTreeOf(world, person.id)
            const ties = relationshipsOf(world, person.id)
            const byType = (type: Relationship['type']) => ties.filter((tie) => tie.type === type)
            const groups = [
              ['Grandparents', tree.grandparents],
              ['Parents', tree.parents],
              ['Siblings', tree.siblings],
              ['Children', tree.children],
              ['Grandchildren', tree.grandchildren],
            ] as const
            return (
              <dl className="facts">
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
                            <PersonLink world={world} id={other(tie, person.id)} onInspect={onInspect} />
                            <span className="muted small"> since {formatYear(tie.typeSinceTick)}</span>
                          </span>
                        ))}
                      </dd>
                    </Fragment>
                  )
                })}
                {groups.map(([label, ids]) =>
                  ids.length === 0 ? null : (
                    <Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {ids.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ', '}
                            <PersonLink world={world} id={id} onInspect={onInspect} />
                            {world.people.get(id)?.deathTick !== null && <span className="muted"> †</span>}
                          </span>
                        ))}
                      </dd>
                    </Fragment>
                  ),
                )}
                <dt>Friends</dt>
                <dd>
                  {byType('friend').length === 0 ? (
                    <span className="muted">none currently</span>
                  ) : (
                    byType('friend').map((tie, i) => (
                      <span key={`${tie.a}:${tie.b}`}>
                        {i > 0 && ', '}
                        <PersonLink world={world} id={other(tie, person.id)} onInspect={onInspect} />
                      </span>
                    ))
                  )}
                </dd>
              </dl>
            )
          })()}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="panel" aria-label="Jobs">
          {job && (
            <>
              <h3>Your work</h3>
              <dl className="facts">
                <dt>{occupationById(job.occupationId).title}</dt>
                <dd>
                  {formatMoney(job.monthlyPay)} a month
                  {world.places.get(job.workplaceId) && (
                    <span className="muted small"> · at {world.places.get(job.workplaceId)?.name}</span>
                  )}
                  <span className="muted small"> · since {formatYear(job.startedAtTick)}</span>
                </dd>
              </dl>
            </>
          )}
          {isServing(world, person.id) && (
            <p className="muted">You are serving — see the Service tab.</p>
          )}
          <h3>Work in town</h3>
          <ul className="job-list">
            {(() => {
              const unlocks = veteranUnlocks(world, person.id)
              return [...OCCUPATIONS]
                .sort((a, b) => a.minMonthlyPay - b.minMonthlyPay)
                .map((occupation) => {
                  const mine = job?.occupationId === occupation.id
                  const unlocked = unlocks.includes(occupation.id)
                  return (
                    <li key={occupation.id} className={mine ? 'current' : undefined}>
                      <span className="job-title">{occupation.title}</span>
                      <span className="muted small">
                        {SCHOOLING_WORDS[occupation.requires]}
                        {unlocked && ' — or your service training'}
                      </span>
                      <span className="job-pay">
                        {formatMoney(occupation.minMonthlyPay)}–{formatMoney(occupation.maxMonthlyPay)}
                      </span>
                    </li>
                  )
                })
            })()}
          </ul>
          <p className="note small">
            Work arrives as offers — the town hires when there is an opening and
            you fit it. Schooling, a clean record and good performance are what
            get you noticed.
          </p>
        </div>
      )}

      {tab === 'news' && (
        <div className="panel" aria-label="World news">
          {(() => {
            const wars = activeWars(world)
            const allNews = [...newsSince(world, 0 as never)].reverse()
            return (
              <>
                {wars.length > 0 && (
                  <>
                    <h3>Wars now</h3>
                    {wars.map((war) => {
                      const a = world.nations.get(war.a)
                      const b = world.nations.get(war.b)
                      if (!a || !b) return null
                      return (
                        <div className="card news nearby" key={`${war.a}:${war.b}`}>
                          <span className="card-icon" aria-hidden="true">
                            ⚔️
                          </span>
                          <span className="card-text">
                            {a.name} and {b.name} — at war since {formatYear(war.sinceTick)}
                            {war.warPhase !== null && `, ${war.warPhase}`}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
                <h3>The record</h3>
                {allNews.length === 0 && <p className="muted">Nothing yet. The world is quiet.</p>}
                {allNews.map((item, index) => {
                  const previous = allNews[index - 1]
                  const year = formatYear(item.tick)
                  const showYear = previous === undefined || formatYear(previous.tick) !== year
                  return (
                    <div key={`${item.tick}-${item.text}`}>
                      {showYear && <div className="news-year">{year}</div>}
                      <div className={item.nearby ? 'card news nearby' : 'card news'}>
                        <span className="card-icon" aria-hidden="true">
                          📰
                        </span>
                        <span className="card-text">
                          {item.text.charAt(0).toUpperCase() + item.text.slice(1)}.
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {tab === 'service' && (
        <div className="panel" aria-label="Service record">
          {(() => {
            const record = world.service.get(person.id)
            if (!record) {
              return (
                <p className="feed-empty">
                  No service record.
                  <br />
                  <span className="muted small">
                    Service begins with an enlistment — the question comes at
                    eighteen, or when a recruiter knocks.
                  </span>
                </p>
              )
            }
            const tours = deploymentsOf(world, person.id)
            const unlocks = veteranUnlocks(world, person.id)
            return (
              <>
                <dl className="facts">
                  <dt>Branch</dt>
                  <dd>{BRANCH_NAMES[record.branch as ServiceBranch] ?? record.branch}</dd>
                  <dt>Rank</dt>
                  <dd>{rankTitle(record.rank)}</dd>
                  <dt>Specialty</dt>
                  <dd>{specialtyById(record.specialtyId).title}</dd>
                  <dt>Status</dt>
                  <dd>
                    {record.dischargedAtTick === null ? (
                      isDeployed(world, person.id) ? (
                        <span className="bad">deployed</span>
                      ) : (
                        `serving · ${record.termMonthsLeft} months left on the term`
                      )
                    ) : (
                      `discharged ${formatYear(record.dischargedAtTick)}${
                        record.dischargeReason ? ` — ${record.dischargeReason}` : ''
                      }`
                    )}
                  </dd>
                  <dt>Enlisted</dt>
                  <dd>{formatYear(record.enlistedAtTick)}</dd>
                  {record.dischargedAtTick === null && (
                    <>
                      <dt>Posting</dt>
                      <dd>{world.places.get(record.baseId)?.name ?? 'unknown'}</dd>
                      <dt>Pay</dt>
                      <dd>{formatMoney(record.monthlyPay)} a month</dd>
                    </>
                  )}
                  {unlocks.length > 0 && (
                    <>
                      <dt>Training carried home</dt>
                      <dd>
                        {unlocks.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ', '}
                            {occupationById(id).title}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>
                <h3>Deployments</h3>
                {tours.length === 0 ? (
                  <p className="muted">None. Service so far has been at home station.</p>
                ) : (
                  <ol className="timeline">
                    {tours.map((tour) => (
                      <li key={tour.tourNumber}>
                        <div className="row">
                          <span className="year">{formatYear(tour.startedAtTick)}</span>
                          <span className="what">
                            Tour {tour.tourNumber} — against{' '}
                            {world.nations.get(tour.enemyId)?.name ?? 'the enemy'}
                            {tour.returnedAtTick !== null
                              ? ` · came home ${formatYear(tour.returnedAtTick)}`
                              : ' · still there'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )
          })()}
        </div>
      )}

      {tab === 'health' && (
        <div className="panel" aria-label="Health">
          {(() => {
            const record = healthOf(world, person.id)
            const ailing = record !== undefined && record.ailment !== null
            const history = entries.filter((entry) =>
              HEALTH_EVENTS.has(eventTypeById.get(entry.eventId) ?? 'born'),
            )
            return (
              <>
                <dl className="facts">
                  <dt>Now</dt>
                  <dd>
                    {ailing ? (
                      <>
                        {describeAilment(record.ailment ?? 'injury', record.ailmentKind, record.ailmentSite)}
                        <span className="muted small">
                          {' '}· {record.severity >= 600 ? 'serious' : 'mending'}
                          {record.sinceTick !== null && ` · since ${formatYear(record.sinceTick)}`}
                        </span>
                      </>
                    ) : (
                      'well'
                    )}
                  </dd>
                  {record !== undefined && record.marks.length > 0 && (
                    <>
                      <dt>Carried marks</dt>
                      <dd>
                        {record.marks.map((mark, i) => (
                          <span key={mark}>
                            {i > 0 && '; '}
                            {mark}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>
                <h3>History</h3>
                {history.length === 0 ? (
                  <p className="muted">Nothing on record. A quiet body so far.</p>
                ) : (
                  <ol className="timeline">
                    {history.map((entry) => (
                      <li key={entry.eventId}>
                        <div className="row">
                          <span className="year">{entry.year}</span>
                          <span className="what">{entry.text}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )
          })()}
        </div>
      )}

      <footer className="action-bar">
        <button type="button" disabled={busy} onClick={() => onAdvance(1)}>
          + month
        </button>
        <button type="button" className="age-up" disabled={busy} onClick={() => onAdvance(12)}>
          {busy ? '…' : 'Age a year'}
        </button>
        <button type="button" disabled={busy} onClick={() => onAdvance(60)}>
          + 5 years
        </button>
      </footer>
    </div>
  )
}
