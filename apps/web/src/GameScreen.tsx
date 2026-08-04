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
import { sentenceInWords } from '@life-engine/engine'
import { FrontPage } from './FrontPage.js'
import { CityHall } from './CityHall.js'
import { BadgeMark } from './BadgeMark.js'
import {
  activeWars,
  ageAt,
  arrearsHistoryOf,
  canAfford,
  childrenIdsOf,
  compatibility,
  courtshipBar,
  DISMISSAL_PERFORMANCE,
  proposalBar,
  RAISE_MIN_PERFORMANCE,
  WARNING_PERFORMANCE,
  enrolmentBar,
  decorationsOf,
  badgesOf,
  deploymentsOf,
  describeAilment,
  describeTraits,
  explainDecision,
  familyHomeSince,
  familyTreeOf,
  formatDate,
  formatYear,
  fullName,
  householdLedger,
  livingPeople,
  monthlyNetOf,
  personalMonthlyNet,
  moveBar,
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
  upOrOutStandingFor,
  currentDeployment,
  disciplinaryFileOf,
  rotationAvailable,
  supportDeploymentAvailable,
  unitRosterOf,
  branchName,
  crimeNewsSince,
  enlistmentBar,
  isJailed,
  healthOf,
  isDeployed,
  isCaptive,
  capturedSince,
  isServing,
  rankTitle,
  schoolOptionsFor,
  servicePayOf,
  annualPay,
  moneyOnHand,
  specialtyFor,
  specialtyTitleFor,
  unitFor,
  unitOptionsFor,
  isOnProbation,
} from '@life-engine/engine'
import type { EducationLevel, EventType, Person, Relationship, World } from '@life-engine/engine'
import {
  articleFor,
  criminalRecordOf,
  GRADE_TITLES,
  OFFENCES,
  offenceBar,
  placesOfKind,
} from '@life-engine/engine'
import type { EntityId, Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { Avatar } from './Avatar.js'
import { TownStats } from './TownStats.js'
import { Bank } from './Bank.js'
import { Career } from './Career.js'
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
  'unit-moment': '🎖️',
  'aerial-mission': '🚁',
  'received-orders': '📜',
  'reported-crime': '🚔',
  'declined-to-report': '🤐',
  'was-assaulted': '🩸',
  'placed-on-probation': '📋',
  'violated-probation': '⚖️',
  'completed-probation': '✅',
  'was-captured': '⛓️',
  'repatriated': '🕊️',
  'died-in-captivity': '🕯️',
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
  'committed-offence': '🕶️',
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

/**
 * The Service tab's own sub-tabs (owner spec, 2026-08-02). One tab that
 * scrolled forever became five that do not — and on a phone that is the
 * difference between a screen you use and one you give up on.
 */
type ServiceTab = 'career' | 'schools' | 'packet' | 'deployments' | 'record'

/**
 * C3 §18. The Crime section: the acts, and the county's own record of them.
 *
 * One tab used to hold both, and with fifty-nine charges in the catalogue
 * that made it a wall. 'acts' is what you can do; 'records' is the clerk's
 * office — anybody's public convictions, the recent docket, and your own
 * rap sheet with the one action that is yours to take.
 */

/**
 * C3 §18. The charges, grouped, because fifty-nine of them in one list is
 * not a menu — it is a phone book.
 */
const OFFENCE_GROUPS: readonly { readonly title: string; readonly match: (id: string, grade: string, violent: boolean) => boolean }[] = [
  { title: 'Public order', match: (_id, grade, violent) => !violent && grade.includes('misdemeanor') },
  { title: 'Property and theft', match: (id, _g, violent) => !violent && /theft|burglary|robbery|looting|stolen|vandal|arson|trespass/.test(id) },
  { title: 'Fraud and money', match: (id, _g, violent) => !violent && /fraud|launder|forgery|embezzle|bribery|extortion|tax|check|identity/.test(id) },
  { title: 'Drugs', match: (id) => /drug|possession/.test(id) },
  { title: 'Weapons', match: (id) => /firearm|weapon|brandish|discharge/.test(id) },
  { title: 'Violence', match: (_id, _g, violent) => violent },
]

const SERVICE_TABS: readonly { id: ServiceTab; label: string }[] = [
  { id: 'career', label: 'Career' },
  { id: 'schools', label: 'School Houses' },
  { id: 'packet', label: 'Drop a Packet' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'record', label: 'Record' },
]

type Tab =
  | 'story'
  | 'home'
  | 'money'
  | 'family'
  | 'people'
  | 'career'
  | 'jobs'
  | 'news'
  | 'stats'
  | 'service'
  | 'health'
  | 'record'
  | 'cityhall'

// Icon and name are separate so the rail can drop to icons alone when the
// screen is too narrow to carry both.
const TABS: readonly { id: Tab; icon: string; label: string }[] = [
  { id: 'story', icon: '📖', label: 'Story' },
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'money', icon: '💰', label: 'Money' },
  { id: 'career', icon: '📈', label: 'Career' },
  { id: 'family', icon: '👪', label: 'Family' },
  { id: 'people', icon: '💞', label: 'People' },
  { id: 'jobs', icon: '💼', label: 'Jobs' },
  { id: 'news', icon: '📰', label: 'News' },
  { id: 'service', icon: '🪖', label: 'Service' },
  { id: 'health', icon: '🩺', label: 'Health' },
  { id: 'record', icon: '⚖️', label: 'Crime' },
  { id: 'cityhall', icon: '🏛️', label: 'City Hall' },
  { id: 'stats', icon: '📊', label: 'Town' },
]

const SCHOOLING_WORDS: Record<EducationLevel, string> = {
  none: 'no schooling needed',
  primary: 'primary schooling',
  secondary: 'secondary schooling',
  trade: 'trade school',
  college: 'college',
}

// The same levels said as a PERSON'S schooling rather than a job's
// requirement — "secondary school", not "secondary schooling" (P3).
const LEVEL_WORDS: Record<EducationLevel, string> = {
  none: 'no schooling',
  primary: 'primary school',
  secondary: 'secondary school',
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

/**
 * P3 — the ties in words.
 *
 * The engine keeps a tie's strength as 0-1000 and nothing has ever rendered
 * it. A raw number would be a leaked internal (Law 9); these are the same
 * fact said the way a person would say it. Presentation only — no threshold
 * here gates anything, the engine's bars do that.
 */
function closenessWords(strength: number): string {
  if (strength >= 880) return 'inseparable'
  if (strength >= 740) return 'very close'
  if (strength >= 600) return 'close'
  if (strength >= 440) return 'steady'
  if (strength >= 300) return 'drifting'
  return 'barely there'
}

function compatibilityWords(score: number): string {
  if (score >= 820) return 'you see the world the same way'
  if (score >= 660) return 'easy company'
  if (score >= 480) return 'different in ways that show'
  return 'chalk and cheese'
}

/** e.g. "12 years", "7 months". Whole units, the way people say them. */
function spanWords(months: number): string {
  if (months < 1) return 'less than a month'
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`
  const years = Math.floor(months / 12)
  return `${years} years`
}

/**
 * How long a tie has been what it is — or nothing, when the answer predates
 * the record. Worldgen marries the founding couples at tick 0 precisely
 * BECAUSE their wedding happened before the simulation began ("formedAtTick
 * is 0 rather than invented"), so counting from there would put a number on
 * a date the engine deliberately does not know. Law 6: unrecorded history
 * stays unrecorded.
 */
function tieSpan(from: number, tick: number): string | null {
  if (from <= 0) return null
  return spanWords(tick - from)
}

/**
 * P3 — where you stand at work, in words.
 *
 * performance is a 0-1000 the engine has always kept and never shown, and it
 * decides three real things: the annual raise (nothing below
 * RAISE_MIN_PERFORMANCE), the foreman's warning (WARNING_PERFORMANCE) and
 * dismissal (DISMISSAL_PERFORMANCE). The thresholds are imported from the
 * engine rather than retyped, so this can never describe a model that has
 * moved on.
 */
function standingWords(performance: number): string {
  if (performance >= 800) return 'held up as an example'
  if (performance >= 650) return 'well thought of'
  if (performance >= 450) return 'solid'
  if (performance >= RAISE_MIN_PERFORMANCE) return 'getting by'
  // Between the raise line and the warning line: safe, but going nowhere.
  if (performance >= WARNING_PERFORMANCE) return 'coasting'
  if (performance >= DISMISSAL_PERFORMANCE) return 'slipping'
  return 'a bad month from being let go'
}

/** Schooling, judged the way a school report would put it. */
function attainmentWords(attainment: number): string {
  if (attainment >= 800) return 'top of the class'
  if (attainment >= 650) return 'a good student'
  if (attainment >= 450) return 'a fair student'
  if (attainment >= 300) return 'scraped through'
  return 'school was not for you'
}

/** A tie's strength as a bar. Decorative twin of the words beside it. */
function StrengthMeter({ strength }: { strength: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(strength / 10)))
  return (
    <span className="meter" aria-hidden="true">
      <span className="meter-fill" style={{ width: `${String(pct)}%` }} />
    </span>
  )
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

/**
 * THE RIBBON RACK (awards pack §9).
 *
 * Rendered from the player's REAL decorations — nothing on this rack that
 * the record does not already hold, which is the owner's own rule: no award
 * exists that cannot be earned, and none is displayed that was not.
 *
 * The colours are deliberately NOT the real ribbon designs. A ribbon's
 * pattern is insignia, and the charter permits a real branch's NAME and
 * never its insignia. So each bar is keyed to what the award is — valour, a
 * wound, a campaign, a course — and reads at a glance without copying
 * anything licensed.
 */
const RIBBON_LOOK: Record<string, { readonly css: string; readonly says: string }> = {
  valor: { css: 'linear-gradient(90deg,#7b1020 0 30%,#c9a227 30% 70%,#7b1020 70%)', says: 'valour' },
  'wound-recognition': { css: 'linear-gradient(90deg,#4a1d5e 0 35%,#e8d9a0 35% 65%,#4a1d5e 65%)', says: 'a wound' },
  'combat-action': { css: 'linear-gradient(90deg,#1f3a5f 0 25%,#b0483a 25% 75%,#1f3a5f 75%)', says: 'ground combat' },
  'combat-merit': { css: 'linear-gradient(90deg,#8a3b1a 0 40%,#d8b04a 40% 60%,#8a3b1a 60%)', says: 'merit in a combat zone' },
  pow: { css: 'linear-gradient(90deg,#2b2b2b 0 45%,#8e8e8e 45% 55%,#2b2b2b 55%)', says: 'captivity' },
  air: { css: 'linear-gradient(90deg,#1c4f78 0 33%,#d9c46a 33% 66%,#1c4f78 66%)', says: 'a mission flown' },
  campaign: { css: 'linear-gradient(90deg,#3f5d3a 0 20%,#c2a86b 20% 80%,#3f5d3a 80%)', says: 'a campaign' },
  'meritorious-service': { css: 'linear-gradient(90deg,#5a2f6e 0 50%,#c9a227 50%)', says: 'a meritorious term' },
  commendation: { css: 'linear-gradient(90deg,#2f6e4f 0 50%,#dcd2a8 50%)', says: 'a commendable term' },
  achievement: { css: 'linear-gradient(90deg,#3d5a80 0 50%,#98c1d9 50%)', says: 'an achievement' },
  'good-conduct': { css: 'linear-gradient(90deg,#7a5230 0 100%)', says: 'an honourable term' },
  'national-defense': { css: 'linear-gradient(90deg,#8c6f2f 0 50%,#5c4a1f 50%)', says: 'service in wartime' },
  overseas: { css: 'linear-gradient(90deg,#2f4f4f 0 50%,#7fa8a8 50%)', says: 'a tour abroad' },
  'nco-development': { css: 'linear-gradient(90deg,#4a4a6a 0 50%,#a8a8c0 50%)', says: 'the leaders course' },
  'service-ribbon': { css: 'linear-gradient(90deg,#6b6b6b 0 50%,#cfcfcf 50%)', says: 'initial training' },
  'long-service': { css: 'linear-gradient(90deg,#405a75 0 100%)', says: 'long service' },
}

/**
 * Precedence — most senior first, the way a real rack is worn. Anything the
 * table does not name sorts last rather than vanishing: a rack that silently
 * drops an award is worse than one with an unranked bar on the end.
 */
const RACK_ORDER: readonly string[] = [
  'valor',
  'combat-merit',
  'pow',
  'wound-recognition',
  'meritorious-service',
  'air',
  'commendation',
  'achievement',
  'combat-action',
  'good-conduct',
  'national-defense',
  'campaign',
  'overseas',
  'nco-development',
  'service-ribbon',
  'long-service',
]

/**
 * A ribbon nobody else wears.
 *
 * THE OWNER: "no ribbons should ever be the same colour, they need to be
 * unique to that battle." A campaign ribbon is now one per conflict, so its
 * colours are derived from the campaign's own name — deterministic, so the
 * Belarus ribbon looks the same every time it is drawn and in every save,
 * and different from every other war's.
 *
 * Real ribbon designs are insignia and stay out of this (charter §3). These
 * are generated, and the point of generating them is that the rack reads as
 * a history: three campaigns are three different bars, not one bar worn
 * three times.
 */
function campaignRibbon(title: string): string {
  let hash = 2166136261
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  const hue = hash % 360
  const second = (hue + 40 + (hash % 90)) % 360
  const light = `hsl(${String(hue)} 45% 42%)`
  const dark = `hsl(${String(second)} 40% 26%)`
  const centre = `hsl(${String((hue + 180) % 360)} 35% 60%)`
  // A stripe pattern that also varies, so two campaigns with close hues
  // still read apart at a glance.
  return hash % 2 === 0
    ? `linear-gradient(90deg,${dark} 0 22%,${centre} 22% 34%,${light} 34% 66%,${centre} 66% 78%,${dark} 78%)`
    : `linear-gradient(90deg,${light} 0 30%,${dark} 30% 50%,${centre} 50% 70%,${dark} 70%)`
}

function ribbonFor(kind: string, title: string): string {
  if (kind === 'campaign') return campaignRibbon(title)
  return RIBBON_LOOK[kind]?.css ?? 'linear-gradient(90deg,#555 0 100%)'
}

function RibbonRack({ world, personId }: { readonly world: World; readonly personId: EntityId }) {
  const decorations = [...decorationsOf(world, personId)]
    // A COMBAT BADGE IS A BADGE. The Combat Infantryman Badge is not a
    // ribbon and does not belong on a rack of them — it was sitting there
    // because its AwardKind reads like one.
    .filter((award) => award.kind !== 'qualification-badge' && award.kind !== 'combat-action')
    .sort((a, b) => {
      const rank = (kind: string) => {
        const at = RACK_ORDER.indexOf(kind)
        return at === -1 ? RACK_ORDER.length : at
      }
      return rank(a.kind) - rank(b.kind) || a.tick - b.tick
    })
  if (decorations.length === 0) return null
  return (
    <>
      <ul className="rack">
        {decorations.map((award) => (
          <li
            key={`${award.kind}:${award.title}`}
            title={`${award.title}${award.count > 1 ? ` (×${String(award.count)})` : ''} — ${award.citation}`}
            style={{ background: ribbonFor(award.kind, award.title) }}
          >
            {award.count > 1 && <span className="count">×{award.count}</span>}
          </li>
        ))}
      </ul>
      <ul className="rack-legend">
        {decorations.map((award) => (
          <li key={`legend:${award.kind}:${award.title}`}>
            <span
              className="swatch"
              style={{ background: ribbonFor(award.kind, award.title) }}
            />
            {award.title}
            {award.count > 1 && ` ×${award.count}`}
          </li>
        ))}
      </ul>
    </>
  )
}

export function GameScreen({ world, person, busy, onAdvance, onStop, onInspect, onApplyJob, onRequestEnlist, onRequestSchool, onTryUnit, onRequestDeploy, onFitnessTest, onAct, notice }: Props) {
  const [openWhy, setOpenWhy] = useState<ReadonlySet<number>>(new Set())
  // Which news articles are open. Keyed by tick+headline: news items have no
  // id of their own because they are derived from events, not stored.
  const [openArticles, setOpenArticles] = useState<ReadonlySet<string>>(new Set())
  const [tab, setTab] = useState<Tab>('story')
  const [moneyView, setMoneyView] = useState<'month' | 'bank'>('month')
  const [serviceTab, setServiceTab] = useState<ServiceTab>('career')
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
    // The service feed is asked WHOSE story this is, so a recruiting season
    // reaches the people it could be about rather than everyone alive.
    const news = [
      ...newsSince(world, person.birthTick),
      ...serviceNewsSince(world, person.birthTick, person.id),
    ]
    const merged: (
      | { kind: 'life'; tick: number; entry: (typeof entries)[number] }
      | { kind: 'news'; tick: number; text: string; nearby: boolean }
    )[] = []
    for (const entry of entries) merged.push({ kind: 'life', tick: entry.tick, entry })
    for (const item of news) merged.push({ kind: 'news', tick: item.tick, text: item.text, nearby: item.nearby })
    merged.sort((x, y) => x.tick - y.tick)
    return merged
  }, [world, person.birthTick, person.id, entries])

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

  // The Money tab's two reads, memoized on the world snapshot: the ledger
  // walks every member and arrearsHistoryOf walks the entire event log, and
  // neither may re-run on a keystroke (review D1-5, and again at P3). The
  // world object is replaced wholesale by the worker each tick, so this is
  // fresh exactly when the facts are.
  const ledger = useMemo(
    () => (household ? householdLedger(world, household) : null),
    [world, household],
  )
  const arrearsSpells = useMemo(
    () => (household ? arrearsHistoryOf(world, household) : []),
    [world, household],
  )

  // The chip is about THIS PERSON: their money, and what their money does.
  // Under 18 nobody earns, so the roof's month is the honest thing to show.
  const monthlyNet =
    age < 18 ? (household ? monthlyNetOf(world, household) : 0) : personalMonthlyNet(world, person.id)

  return (
    <div className="game">
      <header className="game-header">
        <Avatar world={world} person={person} size={72} />
        <div className="game-title">
          <h1>{fullName(person)}</h1>
          <p>
            {age} {age === 1 ? 'year' : 'years'} old · {formatDate(world, world.tick)}
          </p>
          {/* P3 — temperament in words. The six traits have driven school,
              work, spending, study and survival since M1 without ever being
              shown, so every Why? that cited one landed on a stranger. */}
          {describeTraits(person.traits) !== '' && (
            <p className="traits" title="Your temperament — it shapes how the world answers you.">
              {describeTraits(person.traits)}
            </p>
          )}
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
            // The glance strip is where somebody checks what their life is
            // right now, so probation belongs here as well as on the Crime
            // page — it is a state that restricts them, not a footnote.
            if (isOnProbation(world, person.id)) {
              const job = world.employment.get(person.id)
              const occupation = job === undefined ? null : occupationById(job.occupationId)
              return (
                <>
                  <span className="stat-value">{occupation?.title ?? 'no work'}</span>
                  <span className="stat-sub bad">on probation</span>
                </>
              )
            }
            const record = world.service.get(person.id)
            if (record && isServing(world, person.id)) {
              return (
                <>
                  <span className="stat-value">
                    {/* The trade under the name THEY hold it by: the header
                        read "2LT · rifleman", which is the right rank beside
                        an enlisted job title. */}
                    {rankTitle(world, record.branch, record.rank, record.commissioned === true)} ·{' '}
                    {specialtyTitleFor(
                      specialtyFor(world, record.specialtyId),
                      record.commissioned === true,
                    )}
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
          {/* M-ECON §1: YOUR money, not the roof's — and ON HAND, not net
              worth. A chip reading $300,000 to somebody who cannot make
              rent is a lie; the house and the portfolio are on the Bank,
              where there is room to say what they are. */}
          <span className={household && household.savings < 0 ? 'stat-value bad' : 'stat-value'}>
            {formatMoney(moneyOnHand(world, person.id))}
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

      {/* ADR-0021 §3: the framing is a CONDITION of naming real countries,
          and the review found every path that dodged it — the Story feed
          carries news cards ("War broke out between the United States and
          Iran") on the DEFAULT tab, and a player can live a whole life
          without opening the News tab at all. So it sits above the tabs,
          where no path can miss it. */}
      {world.spec.inGameNotice !== null && (
        <p className="world-notice">{world.spec.inGameNotice}</p>
      )}

      <div className="tab-layout">
      <nav className="tab-bar" aria-label="Life sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : undefined}
            aria-current={tab === t.id}
            title={t.label}
            onClick={() => {
              setTab(t.id)
              setConfirming(null)
            }}
          >
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="tab-name">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="tab-panels">
      {tab === 'story' && (
        <div className="feed" ref={feedRef} aria-label="Your story so far">
          {feedItems.length === 0 && (
            <p className="feed-empty">
              Your story starts now. Age up and see what the years bring.
            </p>
          )}
          {feedItems.map((item, index) => {
            const previous = feedItems[index - 1]
            const year = formatYear(world, item.tick as never)
            const showYear = previous === undefined || formatYear(world, previous.tick as never) !== year

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
                    {formatYear(world, familyHomeSince(world, household) ?? household.formedTick)}
                  </span>
                )}
              </dd>
              <dt>Rent</dt>
              <dd>
                {formatMoney(rentFor(home.desirability))} a month
                <span className="muted small"> · the month in full is on the Money tab</span>
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
                <span className="muted small"> · this household since {formatYear(world, household.formedTick)}</span>
              </dd>
            </dl>
          )}
        </div>
      )}

      {tab === 'money' && (
        <div className="panel" aria-label="Money">
          {/* M-ECON §9. Two ways of looking at the same money: the MONTH
              (where it went, household-level) and the BANK (what is held,
              personal). They are different questions, so they are different
              screens rather than one long scroll. */}
          <div className="money-switch">
            {([
              ['month', 'The month'],
              ['bank', 'The bank'],
            ] as const).map(([view, label]) => (
              <button
                key={view}
                type="button"
                className={moneyView === view ? 'money-switch-tab active' : 'money-switch-tab'}
                onClick={() => setMoneyView(view)}
              >
                {label}
              </button>
            ))}
          </div>
          {moneyView === 'bank' ? (
            <Bank world={world} person={person} onAct={onAct} />
          ) : !household ? (
            <p className="feed-empty">No household yet.</p>
          ) : (
            (() => {
              // Every number here is the engine's own: householdLedger is a
              // decomposition of the three functions runFinances spends, and a
              // test holds the parts to the wholes to the cent. Nothing on
              // this tab is computed in the UI.
              if (ledger === null) return null
              const spells = arrearsSpells
              const nameOf = (id: EntityId) => {
                const member = world.people.get(id)
                return member ? (id === person.id ? 'you' : member.givenName) : 'someone'
              }
              const lines: { key: string; label: string; amount: Money }[] = [
                ...ledger.wages.map((e) => ({
                  key: `w${e.personId}`,
                  label: `Wages — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
                ...ledger.servicePay.map((e) => ({
                  key: `s${e.personId}`,
                  label: `Service pay — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
                ...ledger.pensions.map((e) => ({
                  key: `p${e.personId}`,
                  label: `Pension — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
                ...ledger.survivorPay.map((e) => ({
                  key: `v${e.personId}`,
                  label: `Survivor's share — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
                // M-SAFETY §4. The floors, named. A month carried by the
                // state should say so — it is the difference between a
                // quiet month and a month somebody else paid for.
                ...ledger.statePension.map((e) => ({
                  key: `sp${e.personId}`,
                  label: `State pension — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
                ...ledger.support.map((e) => ({
                  key: `su${e.personId}`,
                  label: `Assistance — ${nameOf(e.personId)}`,
                  amount: e.amount,
                })),
              ]
              const mouths = [
                ledger.adults > 0 ? `${ledger.adults} grown` : null,
                ledger.children > 0 ? `${ledger.children} ${ledger.children === 1 ? 'child' : 'children'}` : null,
              ].filter((part): part is string => part !== null)

              return (
                <>
                  <div className={ledger.inArrears ? 'balance behind' : 'balance'}>
                    {/* The household balance is OBLIGATIONS since M-ECON §1
                        — it is at or below zero by construction, so "has
                        -$606,276.09" is the wrong sentence. Behind, it OWES,
                        and the sum is written as a plain positive amount. */}
                    <span className="balance-label">
                      {ledger.inArrears
                        ? age < 18
                          ? 'The family owes'
                          : 'The household owes'
                        : age < 18
                          ? 'The family is square'
                          : 'The household is square'}
                    </span>
                    <span className="balance-value">
                      {formatMoney(Math.abs(ledger.savings) as Money)}
                    </span>
                    <span className="balance-sub">
                      {ledger.inArrears
                        ? 'behind — nothing goes on lifestyle until it is clear'
                        : ledger.net < 0
                          ? `${formatMoney(-ledger.net as Money)} a month more goes out than comes in`
                          : `${formatMoney(ledger.net)} a month is staying put`}
                    </span>
                  </div>

                  <h3 className="panel-heading">The month</h3>
                  <ul className="ledger">
                    {lines.length === 0 && (
                      <li className="ledger-row muted">
                        <span className="ledger-label">Nothing is coming in</span>
                        <span className="ledger-amount">{formatMoney(0 as Money)}</span>
                      </li>
                    )}
                    {lines.map((line) => (
                      <li key={line.key} className="ledger-row in">
                        <span className="ledger-label">{line.label}</span>
                        <span className="ledger-amount">+{formatMoney(line.amount)}</span>
                      </li>
                    ))}
                    <li className="ledger-row subtotal">
                      <span className="ledger-label">Coming in</span>
                      <span className="ledger-amount">{formatMoney(ledger.income)}</span>
                    </li>
                    {ledger.homeless ? (
                      <li className="ledger-row out">
                        <span className="ledger-label">
                          Shelter
                          <span className="muted small"> · no address of your own</span>
                        </span>
                        <span className="ledger-amount">−{formatMoney(ledger.livingCosts)}</span>
                      </li>
                    ) : (
                      <li className="ledger-row out">
                        <span className="ledger-label">
                          Rent{home && <span className="muted small"> · {home.name}</span>}
                        </span>
                        <span className="ledger-amount">−{formatMoney(ledger.rent)}</span>
                      </li>
                    )}
                    <li className={ledger.homeless ? 'ledger-row out hide' : 'ledger-row out'}>
                      <span className="ledger-label">
                        Living costs
                        {mouths.length > 0 && <span className="muted small"> · {mouths.join(', ')}</span>}
                        {ledger.jailed > 0 && (
                          <span className="muted small"> · {ledger.jailed} fed by the county</span>
                        )}
                      </span>
                      <span className="ledger-amount">−{formatMoney(ledger.livingCosts)}</span>
                    </li>
                    <li className="ledger-row out">
                      <span className="ledger-label">
                        Lifestyle
                        <span className="muted small">
                          {' '}· {ledger.inArrears ? 'belt tightened' : 'the life between rent and the bank'}
                        </span>
                      </span>
                      <span className="ledger-amount">
                        {ledger.lifestyle > 0 ? `−${formatMoney(ledger.lifestyle)}` : formatMoney(0 as Money)}
                      </span>
                    </li>
                    {ledger.salesTax > 0 && (
                      <li className="ledger-row out">
                        <span className="ledger-label">
                          Sales tax
                          <span className="muted small"> · on the lifestyle line</span>
                        </span>
                        <span className="ledger-amount">−{formatMoney(ledger.salesTax)}</span>
                      </li>
                    )}
                    <li className="ledger-row subtotal">
                      <span className="ledger-label">Going out</span>
                      <span className="ledger-amount">
                        {formatMoney((ledger.costs + ledger.lifestyle + ledger.salesTax) as Money)}
                      </span>
                    </li>
                    <li className={ledger.net < 0 ? 'ledger-row total short' : 'ledger-row total'}>
                      <span className="ledger-label">Left over</span>
                      <span className="ledger-amount">
                        {ledger.net < 0
                          ? `−${formatMoney(-ledger.net as Money)}`
                          : formatMoney(ledger.net)}
                      </span>
                    </li>
                  </ul>

                  <h3 className="panel-heading">Hard months</h3>
                  {spells.length === 0 ? (
                    <p className="muted small">
                      Nothing on the record for this roof.
                    </p>
                  ) : (
                    <ul className="spell-list">
                      {spells
                        .slice()
                        .reverse()
                        .map((spell) => {
                          const months =
                            (spell.toTick ?? world.tick) - spell.fromTick
                          return (
                            <li key={spell.fromTick}>
                              <span className="job-title">
                                {formatDate(world, spell.fromTick)}
                                {spell.toTick === null
                                  ? ' — still behind'
                                  : ` to ${formatDate(world, spell.toTick)}`}
                              </span>
                              <span className="muted small">
                                {months} {months === 1 ? 'month' : 'months'} behind
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  )}

                  {age >= 18 && (
                    <>
                      <h3 className="panel-heading">Spending</h3>
                      {/* P2: the stance discretionaryFor reads. The active one
                          is the household's current posture; null is the
                          character-driven default. */}
                      <div className="verb-row">
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
                      </div>

                      <h3 className="panel-heading">Streets</h3>
                      <ul className="job-list">
                        {placesOfKind(world, 'neighbourhood')
                          .slice()
                          .sort((a, b) => a.desirability - b.desirability)
                          .map((place) => {
                            const current = place.id === household.placeId
                            // The engine's WHOLE gate (P3 review): moveBar is
                            // the same function lookForPlace answers from, so
                            // a live button and an honest refusal cannot
                            // disagree — affordability was only one of four.
                            const bar = moveBar(world, person.id, place.id, world.tick)
                            return (
                              <li key={place.id} className={current ? 'current' : undefined}>
                                <span className="job-title">{place.name}</span>
                                <span className="muted small">
                                  {formatMoney(rentFor(place.desirability))} a month
                                  {current && ' — home'}
                                  {!current && !canAfford(ledger.income, place.desirability) && ' — out of reach'}
                                </span>
                                {!current && (
                                  <button
                                    type="button"
                                    className="apply"
                                    disabled={busy || bar !== null}
                                    title={bar ?? undefined}
                                    onClick={() => onAct({ verb: 'look-for-place', placeId: place.id })}
                                  >
                                    Look for a place
                                  </button>
                                )}
                              </li>
                            )
                          })}
                      </ul>
                    </>
                  )}
                </>
              )
            })()
          )}
        </div>
      )}

      {tab === 'career' && (
        <div className="panel" aria-label="Career">
          <Career
            world={world}
            person={person}
            busy={busy}
            onApplyJob={onApplyJob}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'cityhall' && (
        <div className="panel" aria-label="City Hall">
          <CityHall
            world={world}
            person={person}
            busy={busy}
            onPetition={() => onAct({ verb: 'petition-expungement' })}
          />
        </div>
      )}

      {tab === 'family' && (
        <div className="panel" aria-label="Family">
          {(() => {
            const tree = familyTreeOf(world, person.id)
            const groups = [
              ['Grandparents', tree.grandparents],
              ['Parents', tree.parents],
              ['Siblings', tree.siblings],
              ['Children', tree.children],
              ['Grandchildren', tree.grandchildren],
            ] as const
            const anyKin = groups.some(([, ids]) => ids.length > 0)
            return (
              <>
                {!anyKin && (
                  <p className="feed-empty">
                    No family on the record — not everyone is born into one.
                  </p>
                )}
                <dl className="facts">
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
                </dl>
                <p className="muted small">
                  Marriage, courtship and friendship live on the People tab.
                </p>
              </>
            )
          })()}
        </div>
      )}

      {tab === 'people' && (
        <div className="panel" aria-label="People">
          {(() => {
            // P3. Everything the engine knows about a tie, in one place: who,
            // how long, how close, and how well matched — plus the P2 verbs
            // beside the person they concern. The engine's own bars supply
            // the refusals, so a disabled button and its reason can never
            // disagree with what the command would actually do.
            const ties = relationshipsOf(world, person.id)
            const byType = (type: Relationship['type']) => ties.filter((tie) => tie.type === type)
            const adult = age >= 18
            const partners = [...byType('spouse'), ...byType('courting')]
            const friends = byType('friend')
              .slice()
              .sort((x, y) => y.strength - x.strength || other(x, person.id) - other(y, person.id))
            const past = byType('former-spouse')
            const proposeBar = proposalBar(world, person.id, world.tick)

            return (
              <>
                <h3 className="panel-heading">
                  {partners.length > 0
                    ? partners[0]?.type === 'spouse'
                      ? 'Married'
                      : 'Courting'
                    : 'Nobody yet'}
                </h3>
                {partners.length === 0 ? (
                  <p className="muted small">
                    {adult
                      ? 'No one at the moment. Courtship starts with a friendship close enough to risk it.'
                      : 'That comes later.'}
                  </p>
                ) : (
                  <ul className="tie-list">
                    {partners.map((tie) => {
                      const otherId = other(tie, person.id)
                      const them = world.people.get(otherId)
                      const married = tie.type === 'spouse'
                      return (
                        <li key={`${tie.a}:${tie.b}`}>
                          <div className="tie-head">
                            <PersonLink world={world} id={otherId} onInspect={onInspect} />
                            <span className="muted small">
                              {(() => {
                                const since = tieSpan(tie.typeSinceTick, world.tick)
                                const known = tieSpan(tie.formedAtTick, world.tick)
                                const word = married ? 'married' : 'courting'
                                if (since === null) return `${word} since before the record began`
                                return known === null
                                  ? `${word} ${since}`
                                  : `${word} ${since} · known ${known}`
                              })()}
                            </span>
                          </div>
                          <div className="tie-gauge">
                            <StrengthMeter strength={tie.strength} />
                            <span className="muted small">
                              {closenessWords(tie.strength)}
                              {them !== undefined && ` · ${compatibilityWords(compatibility(person, them))}`}
                            </span>
                          </div>
                          {tie.familySizeAspiration !== null && (
                            <p className="muted small tie-note">
                              At the wedding you both hoped for {tie.familySizeAspiration}{' '}
                              {tie.familySizeAspiration === 1 ? 'child' : 'children'}.
                            </p>
                          )}
                          {adult && (
                            <div className="verb-row">
                              {married && (
                                <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'tend-marriage' })}>
                                  💐 Make time
                                </button>
                              )}
                              {!married && (
                                <button
                                  type="button"
                                  className="apply"
                                  disabled={busy || proposeBar !== null}
                                  title={proposeBar ?? undefined}
                                  onClick={() => onAct({ verb: 'propose' })}
                                >
                                  💍 Propose
                                </button>
                              )}
                              <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'try-for-child' })}>
                                👶 Try for a child
                              </button>
                              {confirming === 'leave' ? (
                                <button
                                  type="button"
                                  className="apply"
                                  disabled={busy}
                                  onClick={() => {
                                    setConfirming(null)
                                    onAct({ verb: married ? 'walk-out' : 'end-courtship' })
                                  }}
                                >
                                  {married ? '💔 Leave — for certain?' : '🥀 End it — for certain?'}
                                </button>
                              ) : (
                                <button type="button" className="apply" disabled={busy} onClick={() => setConfirming('leave')}>
                                  {married ? '💔 Leave the marriage' : '🥀 End the courtship'}
                                </button>
                              )}
                            </div>
                          )}
                          {!married && proposeBar !== null && adult && (
                            <p className="muted small tie-note">{proposeBar}</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                <h3 className="panel-heading">Friends</h3>
                {friends.length === 0 ? (
                  <p className="muted small">
                    Nobody close right now. Friendships form where lives overlap — a
                    home, a workplace, a street.
                  </p>
                ) : (
                  <ul className="tie-list">
                    {friends.map((tie) => {
                      const friendId = other(tie, person.id)
                      const them = world.people.get(friendId)
                      const courtBar = courtshipBar(world, person.id, friendId, world.tick)
                      return (
                        <li key={`${tie.a}:${tie.b}`}>
                          <div className="tie-head">
                            <PersonLink world={world} id={friendId} onInspect={onInspect} />
                            <span className="muted small">
                              {tieSpan(tie.formedAtTick, world.tick) === null
                                ? 'known since before the record began'
                                : `known ${String(tieSpan(tie.formedAtTick, world.tick))}`}
                              {them !== undefined && ` · ${String(ageAt(them.birthTick, world.tick))}`}
                            </span>
                          </div>
                          <div className="tie-gauge">
                            <StrengthMeter strength={tie.strength} />
                            <span className="muted small">
                              {closenessWords(tie.strength)}
                              {them !== undefined && ` · ${compatibilityWords(compatibility(person, them))}`}
                            </span>
                          </div>
                          <div className="verb-row">
                            <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'spend-time', otherId: friendId })}>
                              ☕ Spend time
                            </button>
                            {adult && (
                              <button
                                type="button"
                                className="apply"
                                disabled={busy || courtBar !== null}
                                title={courtBar ?? undefined}
                                onClick={() => onAct({ verb: 'court', otherId: friendId })}
                              >
                                🌹 Court
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {past.length > 0 && (
                  <>
                    <h3 className="panel-heading">Formerly married</h3>
                    <ul className="tie-list">
                      {past.map((tie) => (
                        <li key={`${tie.a}:${tie.b}`}>
                          <div className="tie-head">
                            <PersonLink world={world} id={other(tie, person.id)} onInspect={onInspect} />
                            <span className="muted small">
                              ended {formatYear(world, tie.endedAtTick ?? tie.typeSinceTick)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
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
                  {formatMoney(annualPay(job.monthlyPay))} a year
                  {world.places.get(job.workplaceId) && (
                    <span className="muted small"> · at {world.places.get(job.workplaceId)?.name}</span>
                  )}
                  <span className="muted small"> · since {formatYear(world, job.startedAtTick)}</span>
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
                {/* P3 — the standing the raise, the warning and the sack are
                    all judged on. The thresholds come from the engine. */}
                <dt>Standing</dt>
                <dd>
                  <span className="tie-gauge">
                    <StrengthMeter strength={job.performance} />
                    <span className="muted small">{standingWords(job.performance)}</span>
                  </span>
                  <p className="muted small tie-note">
                    {job.performance < DISMISSAL_PERFORMANCE
                      ? 'Below this line the job may not keep itself.'
                      : job.performance < WARNING_PERFORMANCE
                        ? 'Keep sliding and the job will not keep itself.'
                        : job.performance < RAISE_MIN_PERFORMANCE
                          ? 'Good enough to keep, not good enough for a raise at the year’s turn.'
                          : 'Good enough that the year’s turn should bring something.'}
                  </p>
                </dd>
              </dl>
            </>
          )}
          {isServing(world, person.id) && (
            <p className="muted">You are serving — see the Service tab.</p>
          )}
          {(() => {
            // P3 — what schooling actually happened. attainment has shaped
            // every hire since M1 and was never on screen.
            const education = world.education.get(person.id)
            if (!education) return null
            const finished = education.level !== 'none'
            return (
              <>
                <h3>Schooling</h3>
                <dl className="facts">
                  <dt>{finished ? LEVEL_WORDS[education.level] : 'no schooling yet'}</dt>
                  <dd>
                    <span className="tie-gauge">
                      <StrengthMeter strength={education.attainment} />
                      <span className="muted small">{attainmentWords(education.attainment)}</span>
                    </span>
                    {education.enrolledIn !== null && education.completesAtTick !== null && (
                      <p className="muted small tie-note">
                        In {LEVEL_WORDS[education.enrolledIn]} — finishes{' '}
                        {formatDate(world, education.completesAtTick)}.
                      </p>
                    )}
                  </dd>
                </dl>
              </>
            )
          })()}
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

      {tab === 'stats' && (
        <div className="panel" aria-label="The town">
          {/* P3. The same D1 measures the observer dashboard shows, inside a
              played life — but bounded to the years this person has actually
              lived, because a life cannot see the century before it. */}
          <h3 className="panel-heading">
            {world.town.name} — {livingPeople(world).length} living
          </h3>
          <p className="muted small">
            The years you have seen. Births, deaths, weddings and courtships
            are the whole town's, not only yours.
          </p>
          <TownStats world={world} sinceYear={Number(formatYear(world, person.birthTick))} maxYears={16} />
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
                  <span className="station-call">{world.spec.gazetteer.newsStation}</span>
                  <span className="station-line">
                    {/* "in this world" earns its keep next to a
                        real-nations preset's notice: without it the
                        masthead's "everything here happened" reads as a
                        contradiction of "every war here is invented". */}
                    {world.town.name} — everything here happened in this world
                  </span>
                </div>
                {/* ADR-0021 §3. A preset that names real countries says so
                    where the wars are actually read, not only in a menu the
                    player saw once before starting. */}
                {world.spec.inGameNotice !== null && (
                  <p className="masthead-notice">{world.spec.inGameNotice}</p>
                )}
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
                            {a.name} and {b.name} — at war since {formatYear(world, war.sinceTick)}
                            {war.warPhase !== null && `, ${war.warPhase}`}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
                {/* THE FRONT PAGE (newsroom spec §3). The feed below is
                    still the archive — the front page is what a station
                    actually shows you when you turn it on. */}
                <FrontPage
                  world={world}
                  items={allNews}
                  openKeys={openArticles}
                  onOpen={(key) =>
                    setOpenArticles((open) => {
                      const next = new Set(open)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }
                />

                <h3>The archive</h3>
                {allNews.length === 0 && (
                  <p className="muted">Nothing yet. {world.spec.gazetteer.newsStation} has a quiet town to report.</p>
                )}
                {allNews.map((item, index) => {
                  const previous = allNews[index - 1]
                  const year = formatYear(world, item.tick)
                  const showYear = previous === undefined || formatYear(world, previous.tick) !== year
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
                          <p className="article-byline">{world.spec.gazetteer.newsStation} — {article.dateline}</p>
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
          {world.service.get(person.id) !== undefined && (
            <nav className="sub-tabs" aria-label="Service sections">
              {SERVICE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={serviceTab === t.id ? 'active' : undefined}
                  aria-current={serviceTab === t.id}
                  onClick={() => setServiceTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}
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
                {serviceTab === 'career' && (
                <dl className="facts">
                  <dt>Branch</dt>
                  <dd>{branchName(world, record.branch)}</dd>
                  <dt>Rank</dt>
                  <dd>{rankTitle(world, record.branch, record.rank, record.commissioned === true)}</dd>
                  <dt>Specialty</dt>
                  <dd>
                    {specialtyTitleFor(
                      specialtyFor(world, record.specialtyId),
                      record.commissioned === true,
                    )}
                  </dd>
                  {record.qualifications.length > 0 && (
                    <>
                      <dt>Qualifications</dt>
                      <dd>{record.qualifications.join(', ')}</dd>
                    </>
                  )}
                  {(() => {
                    // UP-OR-OUT, VISIBLE. The rule ends careers; the player
                    // should never learn it exists on the month it fires.
                    const standing = upOrOutStandingFor(world, person.id)
                    if (!standing) return null
                    const left = standing.monthsAllowed - standing.monthsInGrade
                    return (
                      <>
                        <dt>Time in grade</dt>
                        <dd className={standing.warning ? 'bad' : undefined}>
                          {standing.monthsInGrade} months
                          {standing.warning
                            ? left > 0
                              ? ` — the service stops offering terms at this grade in ${String(left)} month${left === 1 ? '' : 's'}. A promotion board or a school is the way off it.`
                              : ' — past the point the service offers another term at this grade.'
                            : ` of ${String(standing.monthsAllowed)} before the service stops offering terms at this grade`}
                        </dd>
                      </>
                    )
                  })()}
                  <dt>Status</dt>
                  <dd>
                    {record.dischargedAtTick === null ? (
                      // HELD SAYS HELD. Without this the tab went on
                      // claiming "deployed" for years while the player sat
                      // in a cell, with the school and volunteer buttons
                      // still live beside it — the one thing the character
                      // certainly knows, and the only place that could not
                      // learn it was the screen.
                      isCaptive(world, person.id) ? (
                        <span className="bad">
                          held prisoner ·{' '}
                          {String(world.tick - (capturedSince(world, person.id) ?? world.tick))} months
                        </span>
                      ) : isDeployed(world, person.id) ? (
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
                      `discharged ${formatYear(world, record.dischargedAtTick)}${
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
                  <dd>{formatYear(world, record.enlistedAtTick)}</dd>
                  {record.unitId !== null && (
                    <>
                      <dt>Unit</dt>
                      <dd>{unitFor(world, record.unitId)?.name ?? record.unitId}</dd>
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
                        {formatMoney(annualPay(servicePayOf(world, person.id) as never))} a year
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
                )}
                {record.dischargedAtTick === null && serviceTab === 'career' &&
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
                {record.dischargedAtTick === null && serviceTab === 'career' && (
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
                      const realBar = standing.cutoff + standing.filePenalty
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
                  </>
                )}

                {/* SCHOOL HOUSES (owner spec). Branch-incompatible courses
                    are HIDDEN rather than listed with a refusal — a soldier
                    does not read a catalogue of schools his service does not
                    send anyone to. Everything else shows its reason, and
                    every open course shows when the next class starts and
                    whether there is a seat in it. */}
                {record.dischargedAtTick === null && serviceTab === 'schools' && (
                  <>
                    <h3>School Houses</h3>
                    <ul className="job-list">
                      {schoolOptionsFor(world, person.id)
                        .filter((option) => !option.reason.includes('does not send people here'))
                        .map((option) => (
                          <li key={option.id}>
                            <span className="job-title">{option.title}</span>
                            <span className="muted small">
                              {option.open
                                ? `earns ${option.badge} · ${option.courseMonths} month${option.courseMonths === 1 ? '' : 's'} · ` +
                                  (option.monthsUntilClass === 0
                                    ? 'a class starts this month'
                                    : `next class in ${option.monthsUntilClass} month${option.monthsUntilClass === 1 ? '' : 's'}`) +
                                  ` · ${option.seatsLeft} seat${option.seatsLeft === 1 ? '' : 's'} left`
                                : option.reason}
                            </span>
                            {option.open && (
                              <button
                                type="button"
                                className="apply"
                                disabled={busy}
                                onClick={() => onRequestSchool(option.id)}
                              >
                                Request a Seat
                              </button>
                            )}
                          </li>
                        ))}
                    </ul>
                    {(() => {
                      const seat = world.service.get(person.id)
                      if (seat?.schoolId === null || seat?.schoolStartsAtTick === null) return null
                      const school = world.spec.schools.find((sc) => sc.id === seat?.schoolId)
                      if (!school || seat?.schoolStartsAtTick === undefined) return null
                      const away = seat.schoolStartsAtTick - world.tick
                      return (
                        <p className="note small">
                          You are down for {school.title} —{' '}
                          {away > 0
                            ? `class starts in ${String(away)} month${away === 1 ? '' : 's'}`
                            : 'in class now'}
                          .
                        </p>
                      )
                    })()}
                  </>
                )}

                {/* DROP A PACKET (owner spec): its own tab, branch-filtered
                    the same way. */}
                {record.dischargedAtTick === null && serviceTab === 'packet' && (
                  <>
                    <h3>Drop a Packet</h3>
                    <p className="muted small">
                      A packet is a request to attend selection. Selection can be
                      failed, and the file allows two.
                    </p>
                    <ul className="job-list">
                      {/* Branch-incompatible units are hidden, the same as the
                          school houses: a soldier does not read a catalogue of
                          units his service does not select for. */}
                      {unitOptionsFor(world, person.id)
                        .filter((option) => !option.reason.includes('does not feed'))
                        .map((option) => (
                          <li key={option.id}>
                            <span className="job-title">{option.name}</span>
                            <span className="muted small">
                              {option.open
                                ? option.tier === 3
                                  ? 'selection — the one at the top'
                                  : option.tier === 2
                                    ? 'selection — the quiet tier'
                                    : 'selection — it can be failed'
                                : option.reason}
                            </span>
                            {option.open && (
                              <button
                                type="button"
                                className="apply"
                                disabled={busy}
                                onClick={() => onTryUnit(option.id)}
                              >
                                Drop a Packet
                              </button>
                            )}
                          </li>
                        ))}
                    </ul>
                  </>
                )}
                {serviceTab === 'record' && (() => {
                  const decorations = decorationsOf(world, person.id)
                  // Combat badges are badges, wherever their kind sits.
                  const badges = [
                    ...decorationsOf(world, person.id)
                      .filter((award) => award.kind === 'combat-action')
                      .map((award) => award.title),
                    ...badgesOf(world, person.id),
                  ]
                  if (decorations.length === 0) {
                    return <p className="muted small">Nothing on the rack yet.</p>
                  }
                  return (
                    <>
                      <h3>The rack</h3>
                      <RibbonRack world={world} personId={person.id} />
                      {badges.length > 0 && (
                        <>
                          <h3>Badges</h3>
                          <ul className="badge-chips">
                            {badges.map((badge) => (
                              <li key={badge} title={badge}>
                                <BadgeMark badge={badge} />
                                <span>{badge}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <h3>Decorations</h3>
                      <ol className="timeline">
                        {decorations
                          .filter(
                            (award) =>
                              award.kind !== 'qualification-badge' && award.kind !== 'combat-action',
                          )
                          .map((award) => (
                          <li key={`${award.kind}:${award.title}`}>
                            <div className="row">
                              <span className="year">{formatYear(world, award.tick)}</span>
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
                {serviceTab === 'deployments' && <h3>Deployments</h3>}
                {serviceTab === 'deployments' && (tours.length === 0 ? (
                  <p className="muted">None. Service so far has been at home station.</p>
                ) : (
                  <ol className="timeline">
                    {tours.map((tour) => (
                      <li key={tour.tourNumber}>
                        <div className="row">
                          <span className="year">{formatYear(world, tour.startedAtTick)}</span>
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
                              ? ` · came home ${formatYear(world, tour.returnedAtTick)}`
                              : ' · still there'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ))}
              </>
            )
          })()}
        </div>
      )}

      {tab === 'record' && (
        <div className="panel" aria-label="Crime">
          {(() => {
            const record = criminalRecordOf(world, person.id)
            const jailedUntil = record?.jailedUntilTick ?? null
            const inside = jailedUntil !== null && world.tick < jailedUntil
            const monthsLeft = inside ? jailedUntil - world.tick : 0
            const probationUntil = record?.probationUntilTick ?? null
            const onProbation = probationUntil !== null && world.tick < probationUntil
            const probationLeft = onProbation ? probationUntil - world.tick : 0
            const hanging = record?.suspendedMonths ?? 0
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
                {/* ON PROBATION, AND NOWHERE TO SEE IT (owner, playing:
                    "there is no way of telling you are on probation after
                    you get out of jail"). Probation is the rung of the
                    ladder that leaves somebody in their own life, so it
                    was invisible — while quietly restricting enlistment
                    and putting a suspended term over their head that a new
                    offence would impose. A state that changes what happens
                    to you has to be legible. */}
                {!inside && onProbation && (
                  <p className="card news nearby">
                    <span className="card-icon" aria-hidden="true">📋</span>
                    <span className="card-text">
                      On probation — {probationLeft} month{probationLeft === 1 ? '' : 's'} left.
                      {hanging > 0 && ` ${sentenceInWords(hanging)} is hanging over you: another offence
                        while this runs imposes it on top of whatever the new charge costs.`}
                      {' '}The recruiting office will not take you until it is over.
                    </span>
                  </p>
                )}

                {/* THE DOING ONLY. The record of having done it moved to
                    City Hall, which is where a town actually keeps it —
                    this tab used to be both, behind two sub-tabs. */}
                <h3>What you could do</h3>
                <p className="muted small">
                  The town has a courthouse and it works. Every one of these can end in a
                  cell, and what you take is real money out of somebody's real ledger.
                </p>
                {!adult ? (
                  <p className="muted">Not yet eighteen.</p>
                ) : (
                  <ul className="offences">
                    {/* C3 §18. GROUPED, because fifty-nine charges in one
                        list is not a menu — it is a phone book. Each charge
                        appears once, under the first group that claims it. */}
                    {/* C3 §18. GROUPED: fifty-nine charges in one flat list
                        is not a menu, it is a phone book. Each charge lands
                        in the first group that claims it, and anything no
                        group claims still appears rather than vanishing. */}
                    {(() => {
                      const claimed = new Set<string>()
                      const groups = OFFENCE_GROUPS.map((group) => ({
                        title: group.title,
                        offences: OFFENCES.filter((o) => {
                          if (claimed.has(o.id)) return false
                          if (!group.match(o.id, o.grade, o.violent === true)) return false
                          claimed.add(o.id)
                          return true
                        }),
                      })).filter((g) => g.offences.length > 0)
                      const rest = OFFENCES.filter((o) => !claimed.has(o.id))
                      if (rest.length > 0) groups.push({ title: 'Other', offences: rest })
                      return groups.map((group) => (
                        <li key={group.title} className="offence-group">
                          <h4>{group.title}</h4>
                          <ul className="offences">
                            {group.offences.map((offence) => {
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
                        </li>
                      ))
                    })()}
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
                          {record.sinceTick !== null && ` · since ${formatYear(world, record.sinceTick)}`}
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

      </div>
      </div>

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
