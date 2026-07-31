/**
 * The game screen: your life, full-bleed. M-GAME.
 *
 * When a character is being played, THIS is the product — a portrait, the
 * felt facts of the life, a story feed of everything that has happened, and
 * one big button that moves time. The town dashboard still exists as the
 * observer view; this screen deliberately shows one person's world, because
 * the charter's whole premise is that the player is one person inside it,
 * not the town's manager.
 *
 * Presentation only (ADR-0012): every fact on screen is read from the engine
 * each render, and the only writes are commands — advance, choose, stop.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ageAt,
  childrenIdsOf,
  explainDecision,
  familyHomeSince,
  formatDate,
  formatYear,
  fullName,
  monthlyNetOf,
  newsSince,
  occupationById,
  spouseOf,
  timelineFor,
} from '@life-engine/engine'
import { healthOf, isServing, rankTitle, specialtyById } from '@life-engine/engine'
import type { EventType, Person, World } from '@life-engine/engine'
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

interface Props {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onAdvance: (months: number) => void
  readonly onStop: () => void
  readonly onInspect: (id: EntityId) => void
}

export function GameScreen({ world, person, busy, onAdvance, onStop, onInspect }: Props) {
  const [openWhy, setOpenWhy] = useState<ReadonlySet<number>>(new Set())
  const feedRef = useRef<HTMLDivElement | null>(null)

  const age = ageAt(person.birthTick, world.tick)
  const job = world.employment.get(person.id)
  const household = person.householdId === null ? null : world.households.get(person.householdId)
  const home = household ? world.places.get(household.placeId) : null
  const spouseId = spouseOf(world, person.id)
  const spouse = spouseId === null ? null : world.people.get(spouseId)
  const childCount = childrenIdsOf(world, person.id).length
  const entries = useMemo(() => timelineFor(world, person.id), [world, person.id])

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
  }, [feedItems.length])

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
                  <span className="stat-sub">{formatMoney(record.monthlyPay)}/mo · serving</span>
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
          <span className="stat-label">Money</span>
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
          const icon = EVENT_ICONS[world.events.find((e) => e.id === entry.eventId)?.type ?? 'born']
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
