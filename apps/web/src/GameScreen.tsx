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
 * feed summarizes, browsable in depth. Since M-SERVICE-PLAY and P2 the tabs
 * also carry the player's VERBS — every one a command to the engine, which
 * answers honestly (the notice) and stays the only authority.
 *
 * Presentation only (ADR-0012): every fact on screen is read from the engine
 * each render, and the only writes are commands.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeWars,
  ageAt,
  canAfford,
  childrenIdsOf,
  enrolmentBar,
  decorationsOf,
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
  discretionaryFor,
  monthlyNetOf,
  newsSince,
  OCCUPATIONS,
  occupationById,
  other,
  relationshipsOf,
  rentFor,
  serviceNewsSince,
  spouseOf,
  timelineFor,
  veteranUnlocks,
} from '@life-engine/engine'
import {
  boardStandingFor,
  currentDeployment,
  disciplinaryFileOf,
  rotationAvailable,
  supportDeploymentAvailable,
  unitRosterOf,
  BRANCH_NAMES,
  crimeNewsSince,
  enlistmentBar,
  isJailed,
  healthOf,
  isDeployed,
  isServing,
  rankTitle,
  schoolOptionsFor,
  servicePayOf,
  specialtyById,
  specialUnitById,
  unitOptionsFor,
} from '@life-engine/engine'
import type { EducationLevel, EventType, Person, Relationship, ServiceBranch, World } from '@life-engine/engine'
import {
  articleFor,
  criminalRecordOf,
  GRADE_TITLES,
  NEWS_STATION,
  OFFENCES,
  offenceBar,
  offenceById,
  placesOfKind,
} from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { Avatar } from './Avatar.js'
import type { VerbRequest } from './engine.worker.js'

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
  'began-training': '🥾',
  'completed-training': '📗',
  'field-exercise': '⛺',
  'earned-qualification': '🎯',
  'changed-post': '🧳',
  awarded: '🏅',
  'granted-pension': '🏛️',
  'passed-over': '⏳',
  'turned-down': '🚪',
  'joined-unit': '🪂',
  'dropped-selection': '↩️',
  'fitness-tested': '🏃',
  disciplined: '📛',
  'field-aid': '🩹',
  deployed: '🛫',
  'returned-home': '🛬',
  'wounded-in-action': '🎗️',
  'saw-combat': '💥',
  'act-of-valor': '⭐',
  'left-job': '📦',
  befriended: '🤝',
  'friendship-lapsed': '🍂',
  'started-courting': '🌹',
  'courtship-ended': '🥀',
  married: '💍',
  anniversary: '💞',
  divorced: '💔',
  widowed: '🖤',
  'left-home': '🚪',
  'was-introduced': '💫',
  convalesced: '🛌',
  'declined-board': '📋',
  'kept-heads-down': '⛑️',
  reconciled: '💞',
  'tended-marriage': '💐',
  'spent-time': '☕',
  'warned-at-work': '⚠️',
  'changed-spending': '👛',
  'moved-in-together': '🏠',
  'moved-house': '🚚',
  'had-child': '👶',
  'committed-theft': '🕶️',
  'was-robbed': '🚪',
  'was-arrested': '🚔',
  'was-convicted': '⚖️',
  'was-acquitted': '⚖️',
  'released-from-jail': '🔓',
  'fell-behind': '📉',
  'back-in-the-black': '📈',
  inherited: '🕯️',
  died: '⚰️',
}

type Tab = 'story' | 'home' | 'family' | 'jobs' | 'news' | 'service' | 'health' | 'record'

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'story', label: '📖 Story' },
  { id: 'home', label: '🏠 Home' },
  { id: 'family', label: '👪 Family' },
  { id: 'jobs', label: '💼 Jobs' },
  { id: 'news', label: '📰 News' },
  { id: 'service', label: '🪖 Service' },
  { id: 'health', label: '🩺 Health' },
  { id: 'record', label: '⚖️ Record' },
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
  /** Tab verbs (M-SERVICE-PLAY): ask after work; walk into the recruiter. */
  readonly onApplyJob: (occupationId: string) => void
  readonly onRequestEnlist: () => void
  readonly onRequestSchool: (schoolId: string) => void
  readonly onTryUnit: (unitId: string) => void
  readonly onRequestDeploy: () => void
  readonly onFitnessTest: () => void
  /** P2: any player-initiated verb; the engine's honest refusal returns as
   *  the notice. One channel for court/propose/quit/move/… */
  readonly onAct: (action: VerbRequest) => void
  /** The world's short answer to the last action ("no place this month"). */
  readonly notice: string | null
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

export function GameScreen({ world, person, busy, onAdvance, onStop, onInspect, onApplyJob, onRequestEnlist, onRequestSchool, onTryUnit, onRequestDeploy, onFitnessTest, onAct, notice }: Props) {
  const [openWhy, setOpenWhy] = useState<ReadonlySet<number>>(new Set())
  // Which news articles are open. Keyed by tick+headline: news items have no
  // id of their own because they are derived from events, not stored.
  const [openArticles, setOpenArticles] = useState<ReadonlySet<string>>(new Set())
  const [tab, setTab] = useState<Tab>('story')
  // Two-step confirmation for the irreversible verbs (walk-out, quit): the
  // first click arms, the second sends. Any tab change disarms.
  const [confirming, setConfirming] = useState<string | null>(null)
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
  // it feels to live through one, until L4-M3 makes it personal. M-ARMY2:
  // the town's own service news too — neighbors enlisting, drives on the
  // square — so the uniforms are visible (owner direction).
  const feedItems = useMemo(() => {
    const news = [...newsSince(world, person.birthTick), ...serviceNewsSince(world, person.birthTick)]
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
            {age} {age === 1 ? 'year' : 'years'} old · {formatDate(world.tick)}
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
            if (isJailed(world, person.id)) {
              return (
                <>
                  <span className="stat-value bad">in jail</span>
                  <span className="stat-sub">serving time</span>
                </>
              )
            }
            const record = world.service.get(person.id)
            if (record && isServing(world, person.id)) {
              return (
                <>
                  <span className="stat-value">
                    {rankTitle(record.branch, record.rank)} · {specialtyById(record.specialtyId).title}
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
            onClick={() => {
              setTab(t.id)
              setConfirming(null)
            }}
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
                  {(entry.decision !== null || entry.outcome !== null) && (
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
                {openWhy.has(entry.eventId) && (
                  <div className="card-why">
                    {/* What came of it leads — that is what the question
                        usually means (owner). The causes follow. */}
                    {entry.outcome !== null && <p className="why-outcome">{entry.outcome}</p>}
                    {entry.decision !== null && (
                      <p className="why-cause">{explainDecision(world, entry.decision)}</p>
                    )}
                  </div>
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
                  {formatMoney(householdCosts(world, household))} out ·{' '}
                  {formatMoney(discretionaryFor(world, household))} lifestyle ·{' '}
                  {formatMoney(monthlyNetOf(world, household))} net
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
              {age >= 18 && (
                <>
                  <dt>Spending</dt>
                  <dd>
                    {/* P2: the stance discretionaryFor reads. The active one
                        is the household's current posture; null is the
                        character-driven default. */}
                    <span className="verb-row">
                      {([
                        ['thrifty', 'Thrifty'],
                        [null, 'As it comes'],
                        ['loose', 'Open-handed'],
                      ] as const).map(([stance, label]) => (
                        <button
                          key={label}
                          type="button"
                          className={household.spendStance === stance ? 'apply active' : 'apply'}
                          disabled={busy || household.spendStance === stance}
                          onClick={() => onAct({ verb: 'spend-stance', stance })}
                        >
                          {label}
                        </button>
                      ))}
                    </span>
                  </dd>
                  <dt>Streets</dt>
                  <dd>
                    <ul className="job-list">
                      {placesOfKind(world, 'neighbourhood')
                        .slice()
                        .sort((a, b) => a.desirability - b.desirability)
                        .map((place) => {
                          const current = place.id === household.placeId
                          // The engine's own gate, so the disabled state
                          // never disagrees with the refusal words.
                          const affordable = canAfford(householdIncome(world, household), place.desirability)
                          return (
                            <li key={place.id} className={current ? 'current' : undefined}>
                              <span className="job-title">{place.name}</span>
                              <span className="muted small">
                                {formatMoney(rentFor(place.desirability))} a month
                                {current && ' — home'}
                              </span>
                              {!current && (
                                <button
                                  type="button"
                                  className="apply"
                                  disabled={busy || !affordable}
                                  title={affordable ? undefined : 'The household cannot carry that rent.'}
                                  onClick={() => onAct({ verb: 'look-for-place', placeId: place.id })}
                                >
                                  Look for a place
                                </button>
                              )}
                            </li>
                          )
                        })}
                    </ul>
                  </dd>
                </>
              )}
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
            const adult = age >= 18
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
                        {/* P2 — the marriage and courtship verbs live beside
                            the person they concern. The engine gates; these
                            buttons only ask. */}
                        {type === 'spouse' && adult && (
                          <span className="verb-row">
                            <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'tend-marriage' })}>
                              💐 Make time
                            </button>
                            <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'try-for-child' })}>
                              👶 Try for a child
                            </button>
                            {confirming === 'walk-out' ? (
                              <button type="button" className="apply" disabled={busy} onClick={() => { setConfirming(null); onAct({ verb: 'walk-out' }) }}>
                                💔 Leave — for certain?
                              </button>
                            ) : (
                              <button type="button" className="apply" disabled={busy} onClick={() => setConfirming('walk-out')}>
                                💔 Leave the marriage
                              </button>
                            )}
                          </span>
                        )}
                        {type === 'courting' && adult && (
                          <span className="verb-row">
                            <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'propose' })}>
                              💍 Propose
                            </button>
                            <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'try-for-child' })}>
                              👶 Try for a child
                            </button>
                            {confirming === 'end-courtship' ? (
                              <button type="button" className="apply" disabled={busy} onClick={() => { setConfirming(null); onAct({ verb: 'end-courtship' }) }}>
                                🥀 End it — for certain?
                              </button>
                            ) : (
                              <button type="button" className="apply" disabled={busy} onClick={() => setConfirming('end-courtship')}>
                                🥀 End the courtship
                              </button>
                            )}
                          </span>
                        )}
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
                    <ul className="job-list">
                      {byType('friend').map((tie) => {
                        const friendId = other(tie, person.id)
                        return (
                          <li key={`${tie.a}:${tie.b}`}>
                            <span className="job-title">
                              <PersonLink world={world} id={friendId} onInspect={onInspect} />
                            </span>
                            <span className="verb-row">
                              <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'spend-time', otherId: friendId })}>
                                ☕ Spend time
                              </button>
                              {adult && (
                                <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'court', otherId: friendId })}>
                                  🌹 Court
                                </button>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
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
                  <span className="verb-row">
                    <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'ask-raise' })}>
                      💵 Ask for a raise
                    </button>
                    {confirming === 'quit-job' ? (
                      <button type="button" className="apply" disabled={busy} onClick={() => { setConfirming(null); onAct({ verb: 'quit-job' }) }}>
                        📦 Quit — for certain?
                      </button>
                    ) : (
                      <button type="button" className="apply" disabled={busy} onClick={() => setConfirming('quit-job')}>
                        📦 Quit
                      </button>
                    )}
                  </span>
                </dd>
              </dl>
            </>
          )}
          {isServing(world, person.id) && (
            <p className="muted">You are serving — see the Service tab.</p>
          )}
          {(() => {
            // P2: the engine's own gate (enrolmentBar), so the block can
            // never appear when the verb would refuse.
            if (enrolmentBar(world, person, world.tick) !== null) return null
            return (
              <>
                <h3>School</h3>
                <p className="muted small">The window is open until 25 — the schoolhouse takes them younger.</p>
                <div className="svc-actions">
                  <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 're-enrol', level: 'college' })}>
                    🎓 Enrol in college
                  </button>
                  <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 're-enrol', level: 'trade' })}>
                    🔧 Enrol in trade school
                  </button>
                </div>
              </>
            )
          })()}
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
                      {!mine && age >= 18 && !isServing(world, person.id) && (
                        <button
                          type="button"
                          className="apply"
                          disabled={busy}
                          onClick={() => onApplyJob(occupation.id)}
                        >
                          Apply
                        </button>
                      )}
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
            const allNews = [
              ...newsSince(world, 0 as never),
              ...crimeNewsSince(world, 0 as never),
              ...serviceNewsSince(world, 0 as never),
            ]
              .sort((a, b) => a.tick - b.tick)
              .reverse()
            return (
              <>
                <div className="station">
                  <span className="station-call">{NEWS_STATION}</span>
                  <span className="station-line">
                    {world.town.name} — everything here happened
                  </span>
                </div>
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
                {allNews.length === 0 && (
                  <p className="muted">Nothing yet. {NEWS_STATION} has a quiet town to report.</p>
                )}
                {allNews.map((item, index) => {
                  const previous = allNews[index - 1]
                  const year = formatYear(item.tick)
                  const showYear = previous === undefined || formatYear(previous.tick) !== year
                  const key = `${String(item.tick)}-${item.text}`
                  const article = articleFor(world, item)
                  return (
                    <div key={key}>
                      {showYear && <div className="news-year">{year}</div>}
                      <div className={item.nearby ? 'card news nearby' : 'card news'}>
                        <span className="card-icon" aria-hidden="true">
                          📰
                        </span>
                        <span className="card-text">
                          {item.text.charAt(0).toUpperCase() + item.text.slice(1)}.
                        </span>
                        {article !== null && (
                          <button
                            type="button"
                            className="why"
                            aria-expanded={openArticles.has(key)}
                            onClick={() =>
                              setOpenArticles((open) => {
                                const next = new Set(open)
                                if (next.has(key)) next.delete(key)
                                else next.add(key)
                                return next
                              })
                            }
                          >
                            Article
                          </button>
                        )}
                      </div>
                      {openArticles.has(key) && article !== null && (
                        <div className="card-why article">
                          <p className="article-byline">{NEWS_STATION} — {article.dateline}</p>
                          <h4 className="article-headline">{article.headline}</h4>
                          <p className="article-lede">{article.lede}</p>
                          {article.body.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                          {article.quote !== null && (
                            <blockquote className="article-quote">
                              <p>“{article.quote.text}”</p>
                              <cite>— {article.quote.source}</cite>
                            </blockquote>
                          )}
                          {article.closing !== null && (
                            <p className="article-closing">{article.closing}</p>
                          )}
                        </div>
                      )}
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
              const bar = enlistmentBar(world, person, world.tick)
              return (
                <div className="feed-empty">
                  <p>No service record.</p>
                  {bar === null ? (
                    <>
                      <p className="muted small">The recruiting office is open, and you qualify.</p>
                      <button type="button" className="enlist-now" disabled={busy} onClick={onRequestEnlist}>
                        🪖 Enlist
                      </button>
                    </>
                  ) : (
                    <p className="muted small">{bar}</p>
                  )}
                </div>
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
                  <dd>{rankTitle(record.branch, record.rank)}</dd>
                  <dt>Specialty</dt>
                  <dd>{specialtyById(record.specialtyId).title}</dd>
                  {record.qualifications.length > 0 && (
                    <>
                      <dt>Qualifications</dt>
                      <dd>{record.qualifications.join(', ')}</dd>
                    </>
                  )}
                  <dt>Status</dt>
                  <dd>
                    {record.dischargedAtTick === null ? (
                      isDeployed(world, person.id) ? (
                        // A peacetime posting is duty, not danger — it does
                        // not wear the war colour.
                        currentDeployment(world, person.id)?.kind === 'rotation' ? (
                          <span>on rotation abroad</span>
                        ) : (
                          <span className="bad">deployed</span>
                        )
                      ) : (
                        `serving · ${record.termMonthsLeft} months left on the term`
                      )
                    ) : (
                      `discharged ${formatYear(record.dischargedAtTick)}${
                        record.dischargeReason ? ` — ${record.dischargeReason}` : ''
                      }`
                    )}
                  </dd>
                  {(() => {
                    // The file, which the soldier has always known and the
                    // player never saw.
                    const file = disciplinaryFileOf(world, person.id)
                    if (!file || file.marks === 0) return null
                    return (
                      <>
                        <dt>File</dt>
                        <dd className={file.marks + 1 >= file.endsCareerAt ? 'bad' : undefined}>
                          {file.marks} company punishment{file.marks === 1 ? '' : 's'} in the last{' '}
                          {file.windowYears} years — {file.endsCareerAt} ends the career
                        </dd>
                      </>
                    )
                  })()}
                  <dt>Enlisted</dt>
                  <dd>{formatYear(record.enlistedAtTick)}</dd>
                  {record.unitId !== null && (
                    <>
                      <dt>Unit</dt>
                      <dd>{specialUnitById(record.unitId)?.name ?? record.unitId}</dd>
                    </>
                  )}
                  {record.dischargedAtTick === null && (
                    <>
                      <dt>Posting</dt>
                      <dd>
                        {world.places.get(record.baseId)?.name ?? 'unknown'}
                        {(() => {
                          const roster = unitRosterOf(world, person.id)
                          return roster === null ? null : (
                            <span className="muted small"> · {roster.unitName}</span>
                          )
                        })()}
                      </dd>
                      <dt>Pay</dt>
                      <dd>
                        {formatMoney(servicePayOf(world, person.id) as never)} a month
                        {record.unitId !== null && <span className="muted small"> incl. special-duty pay</span>}
                      </dd>
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
                {record.dischargedAtTick === null &&
                  (() => {
                    // The squad: real people, real ranks. Whoever actually
                    // holds the rank answers for the rest — nobody is
                    // labelled "your sergeant" who is not one.
                    const roster = unitRosterOf(world, person.id)
                    if (roster === null || roster.members.length <= 1) return null
                    return (
                      <>
                        <h3>{roster.unitName}</h3>
                        <p className="muted small">
                          {roster.branchName} · {roster.baseName}
                        </p>
                        <ul className="roster">
                          {roster.members.map((member) => (
                            <li key={member.personId}>
                              <button
                                type="button"
                                className="linky"
                                onClick={() => onInspect(member.personId)}
                              >
                                <span className="rank">{member.rankTitle}</span>{' '}
                                {member.name}
                                {member.personId === person.id && (
                                  <span className="muted small"> — you</span>
                                )}
                              </button>
                              <span className="muted small">
                                {member.role}
                                {member.deployed ? ' · away' : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )
                  })()}
                {record.dischargedAtTick === null && (
                  <>
                    <h3>Actions</h3>
                    <div className="svc-actions">
                      {/* The button says what the world is actually
                          offering this month: a war's rotation list, or —
                          in peacetime — a posting with an ally (review S5,
                          which caught this comment claiming rotations were
                          still unbuilt). */}
                      <button type="button" className="apply" disabled={busy} onClick={onRequestDeploy}>
                        {supportDeploymentAvailable(world)
                          ? "🛫 Volunteer for an ally's war"
                          : rotationAvailable(world)
                            ? '🛫 Volunteer for a rotation abroad'
                            : '🛫 Volunteer for deployment'}
                      </button>
                      <button type="button" className="apply" disabled={busy} onClick={onFitnessTest}>
                        🏃 Train for the fitness test
                      </button>
                      <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'request-discharge' })}>
                        📜 Request discharge
                      </button>
                    </div>
                    {(() => {
                      const standing = boardStandingFor(world, person.id)
                      if (!standing) return null
                      // The bar the board actually applies (P2): base cutoff
                      // plus what the file of non-selections adds.
                      const realBar = standing.cutoff + standing.priorPassOvers * 15
                      return (
                        <p className="muted small">
                          Promotion points: {standing.points.total} against the {standing.targetTitle} cutoff
                          of {realBar}{standing.priorPassOvers > 0 && ' (raised by the file)'} — evaluation{' '}
                          {standing.points.performance}, fitness{' '}
                          {standing.points.fitness}, badges {standing.points.badges}, decorations{' '}
                          {standing.points.decorations}, seniority {standing.points.seniority}.
                        </p>
                      )
                    })()}
                    <h3>Schools</h3>
                    <ul className="job-list">
                      {schoolOptionsFor(world, person.id).map((option) => (
                        <li key={option.id}>
                          <span className="job-title">{option.title}</span>
                          <span className="muted small">
                            {option.open ? `earns ${option.badge}` : option.reason}
                          </span>
                          {option.open && (
                            <button type="button" className="apply" disabled={busy} onClick={() => onRequestSchool(option.id)}>
                              Request
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <h3>Special units</h3>
                    <ul className="job-list">
                      {unitOptionsFor(world, person.id).map((option) => (
                        <li key={option.id}>
                          <span className="job-title">{option.name}</span>
                          <span className="muted small">
                            {option.open
                              ? option.tier === 2
                                ? 'selection — the quiet tier'
                                : 'selection — it can be failed'
                              : option.reason}
                          </span>
                          {option.open && (
                            <button type="button" className="apply" disabled={busy} onClick={() => onTryUnit(option.id)}>
                              Try out
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {(() => {
                  const decorations = decorationsOf(world, person.id)
                  if (decorations.length === 0) return null
                  return (
                    <>
                      <h3>Decorations</h3>
                      <ol className="timeline">
                        {decorations.map((award) => (
                          <li key={`${award.kind}:${award.title}`}>
                            <div className="row">
                              <span className="year">{formatYear(award.tick)}</span>
                              <span className="what">
                                {award.title}
                                {award.count > 1 && ` ×${award.count}`}
                                <span className="muted small"> — {award.citation}</span>
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </>
                  )
                })()}
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
                            {tour.kind === 'rotation'
                              ? `Rotation ${tour.tourNumber} — with ${
                                  tour.hostId === null
                                    ? 'an ally'
                                    : (world.nations.get(tour.hostId)?.name ?? 'an ally')
                                }`
                              : `Tour ${tour.tourNumber} — against ${
                                  tour.enemyId === null
                                    ? 'the enemy'
                                    : (world.nations.get(tour.enemyId)?.name ?? 'the enemy')
                                }`}
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

      {tab === 'record' && (
        <div className="panel" aria-label="Record">
          {(() => {
            const record = criminalRecordOf(world, person.id)
            const jailedUntil = record?.jailedUntilTick ?? null
            const inside = jailedUntil !== null && world.tick < jailedUntil
            const monthsLeft = inside ? jailedUntil - world.tick : 0
            const adult = ageAt(person.birthTick, world.tick) >= 18
            return (
              <>
                {inside && (
                  <p className="card news nearby">
                    <span className="card-icon" aria-hidden="true">🔒</span>
                    <span className="card-text">
                      Serving a sentence — {monthsLeft} month{monthsLeft === 1 ? '' : 's'} left.
                      The world keeps going without you.
                    </span>
                  </p>
                )}

                <h3>The record</h3>
                {record === undefined || record.convictions.length === 0 ? (
                  <p className="muted">Nothing on it. Absence is the clean record.</p>
                ) : (
                  <ol className="timeline">
                    {record.convictions.map((conviction, i) => {
                      const offence = offenceById(conviction.kind)
                      return (
                        <li key={`${String(conviction.tick)}-${String(i)}`}>
                          <div className="row">
                            <span className="year">{formatYear(conviction.tick)}</span>
                            <span className="what">
                              {offence?.title ?? conviction.kind}
                              {offence !== undefined && (
                                <span className="muted small"> · {GRADE_TITLES[offence.grade]}</span>
                              )}
                              {' — '}
                              {conviction.sentenceMonths > 0
                                ? `${conviction.sentenceMonths} months`
                                : `fined ${formatMoney(conviction.fine as never)}`}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
                {record !== undefined && record.convictions.length > 0 && (
                  <p className="muted small">
                    A conviction closes doors for ten years — every job you ask for, and the
                    recruiting office. It never leaves the record.
                  </p>
                )}

                <h3>What you could do</h3>
                <p className="muted small">
                  The town has a courthouse and it works. Every one of these can end in a
                  cell, and what you take is real money out of somebody's real ledger.
                </p>
                {!adult ? (
                  <p className="muted">Not yet eighteen.</p>
                ) : (
                  <ul className="offences">
                    {OFFENCES.map((offence) => {
                      const bar = offenceBar(world, person.id, offence.id)
                      return (
                        <li key={offence.id}>
                          <div className="offence-head">
                            <span className="offence-title">{offence.title}</span>
                            <span className="muted small">{GRADE_TITLES[offence.grade]}</span>
                          </div>
                          <div className="offence-foot">
                            <span className="muted small">
                              {offence.maxMonths === 0
                                ? 'a fine'
                                : `up to ${
                                    offence.maxMonths >= 24
                                      ? `${String(Math.floor(offence.maxMonths / 12))} years`
                                      : `${String(offence.maxMonths)} months`
                                  }`}
                            </span>
                            <button
                              type="button"
                              className="apply"
                              disabled={busy || bar !== null}
                              title={bar ?? undefined}
                              onClick={() => onAct({ verb: 'commit-offence', offenceId: offence.id })}
                            >
                              Do it
                            </button>
                          </div>
                          {bar !== null && <p className="muted small">{bar}</p>}
                        </li>
                      )
                    })}
                  </ul>
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
                  {ailing && (
                    <>
                      <dt>This month</dt>
                      <dd>
                        {/* P2: the convalesce stance, repeatable while it
                            ails — rest heals faster and the work slips;
                            pushing on is the reverse. */}
                        <span className="verb-row">
                          <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'convalesce-stance', rest: true })}>
                            🛌 Rest
                          </button>
                          <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'convalesce-stance', rest: false })}>
                            💪 Push on
                          </button>
                        </span>
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

      {notice !== null && <div className="action-notice">{notice}</div>}

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
