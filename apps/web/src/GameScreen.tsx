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
import type { ReactElement } from 'react'
import {
  businessOf,
  disciplineOf,
  fitnessOf,
  habitMaturity,
  habitMonths,
  healthStatOf,
  keepsHabit,
  looksOf,
  sentenceInWords,
  smartsOf,
  STATS_FROM_AGE,
  wellbeingCausesOf,
  wellbeingOf,
} from '@life-engine/engine'
import { FrontPage } from './FrontPage.js'
import { RealEstate } from './RealEstate.js'
import { BusinessTab } from './BusinessTab.js'
import { JobsTab } from './JobsTab.js'
import { heldSkills, standingOf } from '@life-engine/engine'
import { CityHall } from './CityHall.js'
import { Legacy } from './Legacy.js'
import { BadgeMark } from './BadgeMark.js'
import {
  activeWars,
  ageAt,
  arrearsHistoryOf,
  childrenIdsOf,
  compatibility,
  courtshipBar,
  proposalBar,
  decorationsOf,
  evaluationsOf,
  afterActionFor,
  afterActionsFor,
  unitAwardsFor,
  markWords,
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
  businessDrawOf,
  walletAccountsOf,
  moneyMonthFor,
  monthAheadFor,
  personalMonthlyNet,
  partnerOf,
  newsSince,
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
  arrearsOf,
  boardStandingFor,
  eventsFor,
  netWorthOf,
  branchSpecFor,
  extraDutyBar,
  walletOf,
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
  flagStatus,
  schoolOptionsFor,
  servicePayOf,
  accountsOf,
  annualPay,
  moneyOnHand,
  specialtyFor,
  specialtyTitleFor,
  unitFor,
  unitOptionsFor,
  isOnProbation,
} from '@life-engine/engine'
import type { EventType, Person, Relationship, World } from '@life-engine/engine'
import {
  articleFor,
  criminalRecordOf,
  GRADE_TITLES,
  OFFENCES,
  offenceBar,
} from '@life-engine/engine'
import type { EntityId, Money } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import { Avatar } from './Avatar.js'
import { TownStats } from './TownStats.js'
import { RecruitingStationView } from './RecruitingStation.js'
import { Bank } from './Bank.js'
import { Market } from './Market.js'
import { Casino } from './Casino.js'
import { TourPanel } from './TourPanel.js'
import { BodyDiagram } from './BodyDiagram.js'
import { CoverageCard } from './CoverageCard.js'
import { Sports } from './Sports.js'
import { School } from './School.js'
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
  endowed: '🏛️',
  'built-home': '🏗️',
  'trust-settled': '🏦',
  'trust-paid': '💐',
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
type ServiceTab = 'career' | 'schools' | 'packet' | 'deployments' | 'reports' | 'record'

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
  { id: 'reports', label: 'Reports' },
  { id: 'record', label: 'Record' },
]

type Tab =
  | 'story'
  | 'home'
  | 'money'
  | 'property'
  | 'market'
  | 'school'
  | 'family'
  | 'people'
  | 'career'
  | 'business'
  | 'jobs'
  | 'news'
  | 'stats'
  | 'service'
  | 'health'
  | 'record'
  | 'cityhall'
  | 'casino'
  | 'sports'

// Icon and name are separate so the rail can drop to icons alone when the
// screen is too narrow to carry both.
/**
 * THE RAIL, ORDERED THE WAY A LIFE IS READ (owner, playing: "the home
 * section is really our stats tab now it looks like — fix up the UI to be
 * better and navigable with all the updates").
 *
 * Two things were wrong. 'Home' had quietly become the personal dashboard —
 * the stats panel, the character sheet, the activities — while still being
 * called Home and sitting behind a house icon. And the tab whose id is
 * literally `stats` is the TOWN dashboard, which meant the two most
 * confusable screens in the game were named after each other.
 *
 * So: 'You' is where you look at yourself, 'Town' is where you look at
 * everybody else, and the order runs from the closest thing to a life —
 * the story of it — outward to the institutions around it.
 */
/**
 * SEVEN DOORS OVER EIGHTEEN ROOMS (playtest, Jack Baldwin: "18 top-level
 * nav items force scrolling on a standard viewport... several are also
 * functionally duplicated", with the exact grouping proposed in §6 of the
 * review — adopted as written).
 *
 * DELIBERATELY A LAYER, NOT A REWRITE. Every Tab id, every piece of panel
 * content and every `tab === '...'` conditional below is untouched; the
 * groups exist only in the rail. The reviewer's own observation made the
 * case: Career and Service already prove the sub-tab pattern works in this
 * codebase, so the fix is to use it, not to invent a new one.
 */
const GROUPS: readonly { id: string; icon: string; label: string; tabs: readonly Tab[] }[] = [
  { id: 'g-story', icon: '📖', label: 'Story', tabs: ['story'] },
  { id: 'g-you', icon: '📊', label: 'You', tabs: ['home', 'health', 'school'] },
  { id: 'g-money', icon: '💰', label: 'Money', tabs: ['money', 'market', 'casino', 'property'] },
  { id: 'g-work', icon: '💼', label: 'Work', tabs: ['jobs', 'career'] },
  /**
   * BUSINESS STANDS ON THE RAIL IN ITS OWN RIGHT (owner, playing:
   * "put the business tab on the main Rail under work").
   *
   * It was a sub-tab of Work, which made it a footnote to having a job —
   * and the whole point of the module is that past a certain size the
   * business IS the job (ADR-0046). Directly under Work, because that is
   * where he asked for it and because the two belong next to each other.
   */
  { id: 'g-business', icon: '🏪', label: 'Business', tabs: ['business'] },
  { id: 'g-people', icon: '👪', label: 'People', tabs: ['family', 'people'] },
  { id: 'g-service', icon: '🪖', label: 'Service', tabs: ['service'] },
  { id: 'g-news', icon: '📰', label: 'News', tabs: ['news'] },
  { id: 'g-town', icon: '🏙️', label: 'Town', tabs: ['record', 'cityhall', 'stats', 'sports'] },
]

const TABS: readonly { id: Tab; icon: string; label: string }[] = [
  { id: 'story', icon: '📖', label: 'Story' },
  { id: 'home', icon: '📊', label: 'You' },
  { id: 'money', icon: '💰', label: 'Money' },
  { id: 'market', icon: '📉', label: 'Market' },
  { id: 'casino', icon: '🎰', label: 'Casino' },
  { id: 'sports', icon: '🏅', label: 'Sports' },
  { id: 'property', icon: '🏘️', label: 'Property' },
  { id: 'school', icon: '🎓', label: 'School' },
  { id: 'jobs', icon: '💼', label: 'Jobs' },
  { id: 'career', icon: '📈', label: 'Career' },
  { id: 'business', icon: '🏪', label: 'Business' },
  { id: 'family', icon: '👪', label: 'Family' },
  { id: 'people', icon: '💞', label: 'People' },
  { id: 'health', icon: '🩺', label: 'Health' },
  { id: 'service', icon: '🪖', label: 'Service' },
  { id: 'record', icon: '⚖️', label: 'Crime' },
  { id: 'cityhall', icon: '🏛️', label: 'City Hall' },
  { id: 'news', icon: '📰', label: 'News' },
  { id: 'stats', icon: '🏙️', label: 'Town' },
]


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
  readonly onExtraDuty: () => void
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

/** Schooling, judged the way a school report would put it. */
/**
 * THE SAME NUMBER, SAID THE WAY A SCHOOL SAYS IT (education master §2).
 *
 * `attainment` is stored 0-1000 and always will be — integer state, one
 * scale, no floats in the save. This is presentation only: a 0.0-4.0
 * figure and the letter beside it, because "612" means nothing to
 * somebody looking at their own report card and "3.1, B" means the whole
 * thing at a glance.
 *
 * The rounding is deliberate. 1000 maps to 4.0 and the letters sit on the
 * ordinary boundaries, so a player who has ever seen a report card can
 * read this one without being taught the scale.
 */
export function gpaOf(attainment: number): { figure: string; letter: string } {
  const clamped = Math.max(0, Math.min(1000, attainment))
  const points = Math.round((clamped * 40) / 1000) / 10
  const letter =
    points >= 3.5 ? 'A' : points >= 2.5 ? 'B' : points >= 1.5 ? 'C' : points >= 1 ? 'D' : 'F'
  return { figure: points.toFixed(1), letter }
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

export function GameScreen({ world, person, busy, onAdvance, onStop, onInspect, onRequestEnlist, onRequestSchool, onTryUnit, onRequestDeploy, onFitnessTest, onExtraDuty, onAct, notice }: Props) {
  const [openWhy, setOpenWhy] = useState<ReadonlySet<number>>(new Set())
  // Which news articles are open. Keyed by tick+headline: news items have no
  // id of their own because they are derived from events, not stored.
  const [openArticles, setOpenArticles] = useState<ReadonlySet<string>>(new Set())
  const [tab, setTab] = useState<Tab>('story')
  /**
   * THE QUIET STRETCHES, ACKNOWLEDGED (owner: "even if nothing happens it
   * should show the month and say so... I think the only time months
   * should be shown is when the player advances by the month tho").
   *
   * A feed that skips silently from March 1974 to March 1975 reads like a
   * broken screen, not a quiet year. So every press of an age button that
   * produces NOTHING visible leaves one marker at the granularity of the
   * press — a month line for a month step, a year line for a year step.
   *
   * INTERFACE STATE, deliberately. "Nothing happened" is a fact about what
   * the player witnessed between two presses, not about the world — the
   * engine records what happened, and no record IS the record. Session
   * scoped: reloading a save rebuilds the story from the world, which
   * cannot and should not know how somebody paced their way through it.
   */
  const [quietSpans, setQuietSpans] = useState<readonly { tick: number; months: number }[]>([])
  const pendingAdvance = useRef<{ from: number; months: number } | null>(null)

  // Which room the player was last in, per door. Interface state only.
  const lastInGroup = useRef<Record<string, Tab>>({})
  useEffect(() => {
    const group = GROUPS.find((g) => g.tabs.includes(tab))
    if (group) lastInGroup.current[group.id] = tab
  }, [tab])
  const [moneyView, setMoneyView] = useState<'month' | 'bank' | 'legacy'>('month')
  /**
   * AND THE SERVICE TAB OPENS ON THE TOUR WHEN THERE IS ONE.
   *
   * It defaulted to `career` always, so a player mid-deployment who DID
   * think to open Service still landed on their promotion points rather
   * than on the thing currently happening to them. A lazy initializer
   * rather than an effect: this is the opening state of a screen, not a
   * reaction to one, and it stays wherever the player moves it afterwards.
   */
  const [serviceTab, setServiceTab] = useState<ServiceTab>(() => {
    const id = world.player.personId
    if (id === null) return 'career'
    return deploymentsOf(world, id).some((t) => t.returnedAtTick === null)
      ? 'deployments'
      : 'career'
  })
  // Which past tour's roster is open on the Deployments list. Interface
  // state only — the rosters themselves live on the deployment records.
  const [openTourHistory, setOpenTourHistory] = useState<number | null>(null)
  // Which filed after-action review is open, by the tick of the contact it
  // reports on. Interface state only — the report is derived from the event.
  const [openReport, setOpenReport] = useState<number | null>(null)
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
      // THE STORY IS A LIFE, NOT A PAPER (owner: "we don't need the news of
      // the mayor and shit to be in the actual feed on 'story'"). Elections
      // and civic items belong on the News tab, which has a whole desk for
      // them — the personal feed keeps only the news that reaches into a
      // life from outside: wars, call-ups, the things a family actually
      // stops dinner to talk about. The player's OWN swearing-in still
      // appears here, because that arrives through their personal timeline,
      // not the wire.
      ...newsSince(world, person.birthTick).filter((item) => item.kind !== 'election'),
      ...serviceNewsSince(world, person.birthTick, person.id),
    ]
    const merged: (
      | { kind: 'life'; tick: number; entry: (typeof entries)[number] }
      | { kind: 'news'; tick: number; text: string; nearby: boolean }
      | { kind: 'quiet'; tick: number; months: number }
    )[] = []
    for (const entry of entries) merged.push({ kind: 'life', tick: entry.tick, entry })
    for (const item of news) merged.push({ kind: 'news', tick: item.tick, text: item.text, nearby: item.nearby })
    // THE QUIET LINES, threaded where their presses landed — month-worded
    // for a month step, year-worded for a year step. The only time the
    // feed speaks in months is when the player walked in months.
    for (const span of quietSpans) merged.push({ kind: 'quiet', tick: span.tick, months: span.months })
    merged.sort((x, y) => x.tick - y.tick)
    return merged
  }, [world, person.birthTick, person.id, entries, quietSpans])

  // A finished press with nothing to show leaves its marker.
  useEffect(() => {
    const pending = pendingAdvance.current
    if (pending === null) return
    if (world.tick < pending.from + pending.months) return // still advancing
    pendingAdvance.current = null
    const landed = feedItems.some(
      (item) => item.tick > pending.from && item.tick <= world.tick,
    )
    if (!landed) {
      setQuietSpans((spans) => [...spans, { tick: world.tick, months: pending.months }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.tick])

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
            // PROBATION IS A MODIFIER, NOT A STATUS (owner, playing: "if
            // you get put on probation it says 'No job' on the main screen
            // — it just puts probation under no job").
            //
            // This block used to RETURN, and it sat above the service one,
            // so a serving soldier on probation was shown as "no work" —
            // it read the civilian employment map, found nothing, and
            // reported that as the truth about a person in uniform. What
            // probation is, is a restriction on whatever somebody is
            // already doing, so it is a line UNDER the real status now.
            const onProbation = isOnProbation(world, person.id)
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
                  <span className={isDeployed(world, person.id) || onProbation ? 'stat-sub bad' : 'stat-sub'}>
                    {formatMoney(record.monthlyPay)}/mo · {isDeployed(world, person.id) ? 'deployed' : 'serving'}
                    {onProbation ? ' · on probation' : ''}
                  </span>
                </>
              )
            }
            return (
              <>
                <span className="stat-value">
                  {job
                    ? `${occupationById(job.occupationId).title}`
                    : age < 18
                      ? 'growing up'
                      : 'none'}
                </span>
                {job ? (
                  <span className={onProbation ? 'stat-sub bad' : 'stat-sub'}>
                    {formatMoney(job.monthlyPay)}/mo{onProbation ? ' · on probation' : ''}
                  </span>
                ) : (
                  onProbation && <span className="stat-sub bad">on probation</span>
                )}
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
              where there is room to say what they are.

              H0: a CHILD'S chip says "Family money", so it reads the
              family's — the head parent's wallet, where the station money
              and the wages actually live. A newborn reading $0.00 while
              the label said "family" was the pot speaking from the grave. */}
          <span className={household && arrearsOf(world, household) > 0 ? 'stat-value bad' : 'stat-value'}>
            {formatMoney(
              moneyOnHand(
                world,
                age < 18
                  ? (person.parentIds
                      .map((id) => world.people.get(id))
                      .filter((p) => p !== undefined && p.deathTick === null && p.householdId === person.householdId)
                      .sort((a, b) => a!.birthTick - b!.birthTick || a!.id - b!.id)[0]?.id ?? person.id)
                  : person.id,
              ),
            )}
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
          {/* THE FULL NAME, HOWEVER LONG (live player: "the name of the
              area where I lived was just cut off"). The chip row ellipsizes
              by design, but the place a person lives is not a detail — it
              wraps instead, and the hover title carries it for the cases
              where even two lines are tight. */}
          <span className="stat-value stat-value-wrap" title={home?.name ?? undefined}>
            {home?.name ?? '—'}
          </span>
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
        {GROUPS.map((g) => {
          const active = g.tabs.includes(tab)
          return (
            <button
              key={g.id}
              type="button"
              className={active ? 'active' : undefined}
              aria-current={active}
              title={g.label}
              onClick={() => {
                // Return to wherever the player last was inside this group,
                // or its first room — a door that forgot which room you
                // were in would make every switch cost a second click.
                setTab(lastInGroup.current[g.id] ?? g.tabs[0] ?? 'story')
                setConfirming(null)
              }}
            >
              <span className="tab-icon" aria-hidden="true">{g.icon}</span>
              <span className="tab-name">{g.label}</span>
            </button>
          )
        })}
      </nav>
      {(() => {
        const group = GROUPS.find((g) => g.tabs.includes(tab))
        if (!group || group.tabs.length < 2) return null
        return (
          <nav className="tab-bar tab-bar-sub" aria-label={`${group.label} sections`}>
            {group.tabs.map((id) => {
              const t = TABS.find((entry) => entry.id === id)
              if (!t) return null
              return (
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
              )
            })}
          </nav>
        )
      })()}

      <div className="tab-panels">
      {tab === 'story' && (
        <div className="feed" ref={feedRef} aria-label="Your story so far">
          {/* THE YEAR JUST GONE (playtest idea #11: "a 'State of the
              Union'-style yearly wrap card... using data that's already
              tracked"). Everything here is read from the feed the tab
              already builds — the wrap invents nothing, it gathers. Net
              worth is stated as it stands rather than as a delta, because
              the engine stores no year-ago snapshot and a made-up
              comparison would be worse than none. */}
          {(() => {
            const since = world.tick - 12
            const yearMine = feedItems.filter(
              (item) => item.tick >= since && item.kind === 'life',
            )
            const yearWorld = feedItems.filter(
              (item) => item.tick >= since && item.kind === 'news',
            )
            if (yearMine.length === 0 && yearWorld.length === 0) return null
            const age = ageAt(person.birthTick, world.tick)
            const worth = netWorthOf(world, person.id)
            return (
              <section className="year-wrap" aria-label="The year just gone">
                <div className="yw-hd">
                  <span className="yw-title">The year just gone</span>
                  <span className="yw-meta">
                    {formatYear(world, Math.max(0, since) as never)} · turned {age}
                  </span>
                </div>
                <ul className="yw-lines">
                  {yearMine.slice(-4).map((item) =>
                    item.kind === 'life' ? (
                      <li key={`yw-${item.tick}-${item.entry.eventId}`}>{item.entry.text}</li>
                    ) : null,
                  )}
                  {yearMine.length === 0 && (
                    <li className="muted">A quiet year, and quiet years count too.</li>
                  )}
                  {yearWorld.length > 0 && (
                    <li className="yw-world">
                      Meanwhile: {yearWorld[yearWorld.length - 1]?.kind === 'news' ? (yearWorld[yearWorld.length - 1] as { text: string }).text : ''}
                    </li>
                  )}
                </ul>
                <div className="yw-foot">
                  Standing worth {formatMoney(worth)}
                  {yearMine.length > 4 && ` · and ${String(yearMine.length - 4)} more moments in the story below`}
                </div>
              </section>
            )
          })()}
          {feedItems.length === 0 && (
            <p className="feed-empty">
              Your story starts now. Age up and see what the years bring.
            </p>
          )}
          {feedItems.map((item, index) => {
            const previous = feedItems[index - 1]
            const year = formatYear(world, item.tick as never)
            const showYear = previous === undefined || formatYear(world, previous.tick as never) !== year

            if (item.kind === 'quiet') {
              // THE SAME CARD AS ANYTHING ELSE (owner: "show the nothing
              // happened like you would show if something did so that they
              // match in size"). A quiet month is still a month of the
              // life — it gets the year header, the icon, the card. Only
              // the colour says it was quiet.
              return (
                <div key={`quiet-${item.tick}-${item.months}`}>
                  {showYear && <div className="feed-year">{year}</div>}
                  <div className="card quiet">
                    <span className="card-icon" aria-hidden="true">
                      💤
                    </span>
                    <span className="card-text">
                      {item.months <= 1
                        ? `${formatDate(world, item.tick as never)} — nothing happened this month.`
                        : 'A quiet year. Nothing worth writing down.'}
                    </span>
                  </div>
                </div>
              )
            }

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
        <div className="panel" aria-label="You">
          {/* THE TOUR YOU ARE ON, FIRST (owner, playing: "did we finish
              Combat tours revamp? I just played and I feel like I didn't get
              the experience I described").

              He was right, and none of it was missing — it was BURIED. The
              whole tour dashboard, the squad roster, who is still standing,
              how long is left: all of it existed and all of it lived two
              clicks down, inside the Service tab's `deployments` sub-tab,
              which defaults to `career`. A player on a deployment had no
              reason to go looking there and so never saw any of it.

              A deployment is the most important thing happening in a life
              while it is happening. It goes at the top of the dashboard,
              and it disappears the moment the tour ends. */}
          {(() => {
            if (person === undefined) return null
            const running = deploymentsOf(world, person.id).find((t) => t.returnedAtTick === null)
            return running === undefined ? null : (
              <TourPanel world={world} tour={running} onInspect={onInspect} />
            )
          })()}
          {/* THE STATS PANEL (owner's player_stats_spec.md §5). At the top
              of Home rather than in a twelfth tab, because it is the
              player's dashboard and it should be the first thing on it.

              Everything here is real modelled state. Wellbeing is stored
              and remembers; fitness is the body, and it belongs to the
              person from twelve whether or not they ever enlist; health,
              looks, smarts and discipline are computed on read from state
              other systems own. Nothing on this panel is decoration. */}
          {(() => {
            const age = person === undefined ? 0 : ageAt(person.birthTick, world.tick)
            if (person === undefined) return null
            // Display is 0–100. Fitness lives on its own 0–300 scale
            // because that IS the promotion-points scale — see stats.ts.
            const pct = (value: number, max = 1000): number =>
              Math.max(0, Math.min(100, Math.round((value / max) * 100)))
            const bars: readonly {
              readonly key: string
              readonly label: string
              readonly value: number
              readonly tone: string
            }[] = [
              {
                key: 'health',
                label: 'Health',
                value: pct(healthStatOf(world, person.id, world.tick)),
                tone: 'health',
              },
              {
                key: 'fitness',
                label: 'Fitness',
                value: pct(fitnessOf(world, person.id), 300),
                tone: 'fit',
              },
              {
                key: 'wellbeing',
                label: 'Wellbeing',
                value: pct(wellbeingOf(world, person.id)),
                tone: 'well',
              },
              {
                key: 'smarts',
                label: 'Smarts',
                value: pct(smartsOf(world, person.id)),
                tone: 'smart',
              },
              {
                key: 'looks',
                label: 'Looks',
                value: pct(looksOf(world, person.id, world.tick)),
                tone: 'looks',
              },
              {
                key: 'discipline',
                label: 'Discipline',
                value: pct(disciplineOf(world, person.id, world.tick)),
                tone: 'disc',
              },
            ]
            const causes = wellbeingCausesOf(world, person.id, world.tick)
            /**
             * EVERY TRAIT SAYS SOMETHING NOW (owner: "is there a way to
             * actually see your traits and stats and stuff I dont see it").
             *
             * It only spoke for the EXTREMES — above 700 or below 300 — so an
             * ordinary person, which is most people, opened this panel and
             * found no character section at all. The middle is a real answer
             * and gets real words; still words rather than numbers, because a
             * trait fixed at birth is who somebody IS and printing 412/1000
             * invites grinding a thing that cannot be ground (spec §7).
             */
            const word = (trait: number, high: string, low: string): string =>
              trait >= 700 ? `Highly ${high}` : trait <= 300 ? low : `Fairly ${high}`
            // CHARACTER IS SHOWN IN WORDS, NOT NUMBERS (spec §7). A trait
            // fixed at birth is who somebody IS; printing it as 412/1000
            // invites the player to grind a thing that cannot be ground.
            const chips = [
              word(person.traits.ambition, 'ambitious', 'Unhurried'),
              word(person.traits.resilience, 'resilient', 'Easily knocked'),
              word(person.traits.sociability, 'sociable', 'Keeps to themselves'),
              word(person.traits.curiosity, 'curious', 'Incurious'),
              word(person.traits.diligence, 'diligent', 'Casual about work'),
            ]

            return (
              <section className="stats-panel">
                <div className="stats-group">Condition</div>
                {bars.slice(0, 3).map((bar) => (
                  <div className="stat-row" key={bar.key}>
                    <div className="stat-top">
                      <span className="stat-name">{bar.label}</span>
                      <span className="stat-num">{bar.value}</span>
                    </div>
                    <div className="stat-bar">
                      <i className={`f-${bar.tone}`} style={{ width: `${String(bar.value)}%` }} />
                    </div>
                    {bar.key === 'wellbeing' && causes.length > 0 && (
                      <ul className="stat-why">
                        {causes.slice(0, 4).map((cause) => (
                          <li key={`${String(cause.tick)}-${cause.words}`}>
                            <span className={cause.delta >= 0 ? 'up' : 'dn'}>
                              {cause.delta >= 0 ? '+' : ''}
                              {cause.delta}
                            </span>
                            {cause.words}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                <div className="stats-group">Ability</div>
                {bars.slice(3).map((bar) => (
                  <div className="stat-row" key={bar.key}>
                    <div className="stat-top">
                      <span className="stat-name">{bar.label}</span>
                      <span className="stat-num">{bar.value}</span>
                    </div>
                    <div className="stat-bar">
                      <i className={`f-${bar.tone}`} style={{ width: `${String(bar.value)}%` }} />
                    </div>
                  </div>
                ))}
                {/*
                  WHAT THE WORK LEFT BEHIND (jobs revamp). Skills existed in
                  the engine and appeared NOWHERE — the Jobs screen could say
                  "you are novice" against a requirement, and there was no
                  page anywhere that simply listed what somebody was good at.
                */}
                {(() => {
                  const held = heldSkills(world.skills.get(person.id))
                  if (held.length === 0) return null
                  return (
                    <>
                      <div className="stats-group">What you are good at · earned by doing it</div>
                      {held.map((entry) => (
                        <div className="stat-row" key={entry.skill.id}>
                          <div className="stat-top">
                            <span className="stat-name" title={entry.skill.blurb}>
                              {entry.skill.label}
                            </span>
                            <span className="stat-num">
                              {standingOf(entry.level)} · {String(entry.level)}/5
                            </span>
                          </div>
                          <div className="stat-bar">
                            <i
                              className="f-smart"
                              style={{ width: `${String(Math.round((entry.thousandths / 5000) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </>
                  )
                })()}
                {chips.length > 0 && (
                  <>
                    <div className="stats-group">Character · who you are</div>
                    <div className="stat-chips">
                      {chips.map((chip) => (
                        <span className="stat-chip" key={chip}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {age >= STATS_FROM_AGE && (
                  <>
                    <div className="stats-group">Invest in yourself</div>
                    <div className="stat-acts">
                      {(
                        [
                          ['training', '🏃', 'Train', 'The body climbs over months.'],
                          ['study', '📚', 'Study', 'Smarts, slowly. Never lost.'],
                          ['social', '🍻', 'See people', 'Wellbeing, a little at a time.'],
                        ] as const
                      ).map(([kind, icon, label, blurb]) => {
                        const kept = keepsHabit(world, person.id, kind)
                        const months = habitMonths(world, person.id, kind, world.tick)
                        return (
                          <button
                            type="button"
                            key={kind}
                            className={`stat-act${kept ? ' on' : ''}`}
                            disabled={busy}
                            onClick={() => onAct({ verb: 'habit', kind, keep: !kept })}
                          >
                            <span className="act-top">
                              <span className="act-ic">{icon}</span>
                              <span className="act-t">{label}</span>
                            </span>
                            <span className="act-d">
                              {kept
                                ? `Keeping it up — ${String(months)} month${months === 1 ? '' : 's'}. Tap to stop.`
                                : blurb}
                            </span>
                            {/* HOW FAR IN THEY ARE, because the ceiling is
                                EARNED over three years and a screen that
                                did not say so would make the whole rework
                                invisible — the player would flip it on,
                                see nothing move, and conclude it was
                                broken rather than slow. */}
                            {kept && kind === 'training' && (
                              <>
                                <span className="act-bar">
                                  <i
                                    style={{
                                      width: `${String(Math.floor(habitMaturity(months) / 10))}%`,
                                    }}
                                  />
                                </span>
                                <span className="act-note">
                                  {habitMaturity(months) >= 1_000
                                    ? 'Fully conditioned. This is what the years bought.'
                                    : 'Still building. A body takes about three years to become what training makes it.'}
                                </span>
                              </>
                            )}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        className="stat-act"
                        disabled={busy}
                        onClick={() => onAct({ verb: 'doctor' })}
                      >
                        <span className="act-top">
                          <span className="act-ic">🩺</span>
                          <span className="act-t">See a doctor</span>
                        </span>
                        <span className="act-d">Takes the edge off. $120.</span>
                      </button>
                    </div>
                  </>
                )}
                {age >= STATS_FROM_AGE && (
                  <p className="stats-note">
                    These are not instant boosts. Training sets a habit that shifts the body over
                    months, and every change is recorded with a reason. Age, injuries and your
                    nature shape how far it goes.
                  </p>
                )}
              </section>
            )
          })()}
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

      {/* PROPERTY, ON ITS OWN (owner, playing: "property needs to be removed
          from the bank tab and actually be its own tab to where we can buy
          and sell the houses and see all the houses we own").

          It was a sub-tab of Money, which was fine while a person could own
          exactly one home. Owning several is a different thing to look at —
          a portfolio, not a line item. */}
      {tab === 'school' && (
        <div className="panel" aria-label="School">
          {/* EIGHT PHASES OF EDUCATION HAD NO HOME (owner, playing: "there
              is no school UI either"). The record, the report card, the
              field, who is paying, what it cost and the way out. */}
          <School
            world={world}
            person={person}
            busy={busy}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'market' && (
        <div className="panel" aria-label="Market">
          {/* THE MARKET IS ITS OWN TAB, not a row inside the bank. The
              owner's complaint about property was the same shape — a thing
              you can hold several of, buy, sell and look into does not fit
              as a line item under Loans. */}
          <Market
            world={world}
            holdings={accountsOf(world, person.id).holdings}
            /**
             * THE WALLET, NOT THE PERSONAL FILE (H0). Same disagreement the
             * Bank had: `buyShares` spends from the wallet, so a screen that
             * sizes the button off the raw record tells a married spouse
             * they have nothing to invest while the family has millions.
             */
            cash={walletAccountsOf(world, person.id).savings}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'casino' && (
        <div className="panel" aria-label="Casino">
          <Casino
            world={world}
            person={person}
            busy={busy}
            wallet={walletOf(world, person.id)}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'sports' && (
        <div className="panel" aria-label="Sports">
          <Sports
            world={world}
            person={person}
            busy={busy}
            age={ageAt(person.birthTick, world.tick)}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'business' && (
        <div className="panel" aria-label="Business">
          {/* ITS OWN DOOR (owner: "business is supposed to be its own tab
              now we discussed this"). The staff, the share register, the
              rivals and the ways to grow were living inside Career's
              business sub-tab; the owner's own business-tab-main.html puts
              them behind a tab of their own with a dashboard on top, and
              running a firm is not a chapter of an employment history. */}
          <BusinessTab
            world={world}
            person={person}
            business={businessOf(world, person.id)}
            busy={busy}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'property' && (
        <div className="panel" aria-label="Property">
          <RealEstate
            world={world}
            personId={person.id}
            cash={moneyOnHand(world, person.id)}
            hasLease={person.householdId !== null && world.leases.has(person.householdId)}
            onAct={onAct}
          />
        </div>
      )}

      {tab === 'money' && (
        <div className="panel" aria-label="Money">
          {/* M-ECON §9. Two ways of looking at the same money: the MONTH
              (where it went, household-level) and the BANK (what is held,
              personal). They are different questions, so they are different
              screens rather than one long scroll. */}
          {/*
            LEGACY IS ITS OWN DESTINATION (owner: "Both the trust and giving
            cards live behind Money → 'The bank', which is a genuinely easy
            thing to miss").

            He is right, and burying them was the wrong call: they were below
            the accounts, the itemised worth and the debts on a scrolling
            card, so the two things a wealthy player most wants to DO with
            money were the last things on the screen. They are a third view
            now, named for what they are.
          */}
          <div className="money-switch">
            {([
              ['month', 'The month'],
              ['bank', 'The bank'],
              ['legacy', 'Legacy'],
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
          {moneyView === 'legacy' ? (
            <Legacy world={world} person={person} onAct={onAct} />
          ) : moneyView === 'bank' ? (
            <Bank world={world} person={person} onAct={onAct} />
          ) : !household ? (
            /**
             * A MONTH WITHOUT A HOUSEHOLD IS STILL A MONTH.
             *
             * OWNER: "money is still not working on my window" — and this was
             * the other half of it. The engine was fixed to pay people who
             * have no household (`settleTheUnhoused`) and to report their
             * month (`monthAheadFor`), and then this screen refused to ask,
             * printing "No household yet." over a sergeant first class on
             * $738 a month.
             *
             * A man in barracks has no lease and no household ledger, so the
             * full statement below genuinely does not apply. What he does
             * have is pay in, keep out, and a wallet — and every line of it
             * named, which is what he asked for in the first place.
             */
            (() => {
              const mine = monthAheadFor(world, person.id)
              // Already the player's own: `recordMoney` only logs movements
              // that land in the player's wallet.
              const lines = moneyMonthFor(world, world.tick)
              return (
                <>
                  <dl className="facts">
                    <dt>Pay</dt>
                    <dd>{formatMoney(mine.earned)}</dd>
                    <dt>Tax withheld</dt>
                    <dd>{formatMoney(mine.withheld)}</dd>
                    <dt>Living costs</dt>
                    <dd>{formatMoney(mine.costs)}</dd>
                    <dt>Left over</dt>
                    <dd>{formatMoney(mine.net)}</dd>
                    <dt>In hand</dt>
                    <dd>{formatMoney(moneyOnHand(world, person.id))}</dd>
                  </dl>
                  <p className="muted small">
                    You are in quarters — no rent, no household books. The
                    service provides the roof.
                  </p>
                  {lines.length > 0 && (
                    <>
                      <h4>This month, line by line</h4>
                      <dl className="facts">
                        {lines.map((entry, i) => (
                          <Fragment key={`${entry.label}-${String(i)}`}>
                            <dt>{entry.label}</dt>
                            <dd>{formatMoney(entry.amount)}</dd>
                          </Fragment>
                        ))}
                      </dl>
                    </>
                  )}
                </>
              )
            })()
          ) : (
            (() => {
              // Every number here is the engine's own: householdLedger is a
              // decomposition of the three functions runFinances spends, and a
              // test holds the parts to the wholes to the cent. Nothing on
              // this tab is computed in the UI.
              if (ledger === null) return null
              const spells = arrearsSpells
              /**
               * YOUR MONTH, ITEMISED BY THE ENGINE. `monthAheadFor` is the
               * single answer to "what does this month do to my money" —
               * the same one the +/- chip reads and the same one a test
               * holds against the tick itself.
               *
               * The household ledger that used to feed this card is gone
               * from it: it described the BUILDING (every earner under the
               * roof, every mouth under it) while the heading said "you".
               */
              const month = monthAheadFor(world, person.id)
              /**
               * WHO IS UNDER THIS ROOF BUT NOT ON THIS BILL. A jailed member
               * eats at the county's expense, so they drop out of the mouths
               * — which is right, and reads as an error unless the card says
               * whose absence it is.
               */
              const awayInJail = (household?.memberIds ?? [])
                .filter((id) => {
                  const record = world.criminal.get(id)
                  return (
                    record !== undefined &&
                    record.jailedUntilTick !== null &&
                    world.tick < record.jailedUntilTick
                  )
                })
                .map((id) => (id === person.id ? 'you' : (world.people.get(id)?.givenName ?? 'someone')))
              /**
               * LAST MONTH'S ACTUAL MOVEMENTS. The tick has already advanced
               * past the month being reported, so this reads the one before —
               * the month the player just watched happen.
               */
              const statement = moneyMonthFor(world, (world.tick - 1) as never)
              const statementNet = statement.reduce((sum, entry) => sum + entry.amount, 0)

              /**
               * EVERY WAY MONEY COMES IN, NOT THE THREE THIS CARD KNEW ABOUT
               * (owner: "I just did 40k in a month and my screen only shows we
               * had 5.6k left over the money and said I made 7,177 in wages
               * and nothing else to justify making 50k we need this screen to
               * be accurate").
               *
               * TWO BUGS, and the second is worse than the missing money.
               *
               * The card built its lines from the household ledger — wages,
               * service pay, pensions, survivor's shares, assistance — and
               * NOTHING else. Interest on savings and rent from tenanted
               * property were not lines it could draw, so a man whose savings
               * and deeds earned him thirty thousand saw a wage and a
               * shortfall he could not explain.
               *
               * And it picked out his lines with `key.endsWith(String(id))` —
               * a STRING SUFFIX MATCH ON A NUMBER. Player 7 matched `w7`, and
               * also `w17`, `w27` and `w107`; player 17 matched `w117`. Whose
               * wages showed up on your statement depended on the person ids
               * the world happened to allocate.
               *
               * `monthAheadFor` is the engine's own itemisation and the same
               * function the +/- chip reads, so the statement, the chip and
               * the tick cannot tell three different stories.
               */
              const mine: { key: string; label: string; amount: Money }[] = []
              if (month.earned > 0) {
                /**
                 * THE TAX IS A NOTE ON THE WAGE, NOT A ROW OF ITS OWN.
                 *
                 * It used to be its own outgoing line, which was RIGHT when
                 * the income lines above it were gross — a reviewer once
                 * reconciled a payslip with the tax hidden and reasonably
                 * suspected a phantom salary. The lines are net now, so a
                 * second row read as the tax coming off twice.
                 */
                mine.push({
                  key: 'earned',
                  label:
                    month.withheld > 0
                      ? `Wages and pay — after ${formatMoney(month.withheld)} tax`
                      : 'Wages and pay',
                  amount: month.earned,
                })
              }
              if (month.draw > 0) {
                mine.push({ key: 'draw', label: 'Drawn from the business', amount: month.draw })
              }
              if (month.rent > 0) {
                mine.push({ key: 'rent', label: 'Rent from your property', amount: month.rent })
              }
              if (month.interest > 0) {
                mine.push({ key: 'interest', label: 'Interest on your savings', amount: month.interest })
              }
              const comingIn = mine.reduce((sum, line) => sum + line.amount, 0) as Money
              /**
               * YOUR MONTH, NOT THE BUILDING'S (owner, playing at twenty:
               * "Living costs · 8 grown, 3 children ... we are single with no
               * kids and there no way we are living with this many people ...
               * I am 20 years old it should just matter how much money I
               * have, we talked about this the finances need to be of your
               * own. This is a LIFE SIM").
               *
               * He is right and the card was incoherent: income was filtered
               * to HIM while every cost below it was the whole roof's, and
               * the old comment here admitted the two "were never meant to
               * subtract to each other". A twenty-year-old at his parents'
               * saw eleven mouths and a bill for all of them.
               *
               * MEASURED, so the counts are not the bug: households are clean
               * — zero phantom members across a 46-household town, whose
               * largest genuinely holds ten. Those eleven people are real.
               * They are just not HIS eleven, and under H0 a grown child at
               * home pays for himself and carries none of the rent.
               *
               * `monthAheadFor` is the same function the +/- chip reads, so
               * this card and that number cannot disagree.
               */
              const mouths = [
                month.adults > 0 ? `${month.adults} grown` : null,
                month.children > 0 ? `${month.children} ${month.children === 1 ? 'child' : 'children'}` : null,
              ].filter((part): part is string => part !== null)

              return (
                <>
                  <div className={ledger.inArrears ? 'balance behind' : 'balance'}>
                    {/* M-MONEY2. YOUR MONEY, AND YOUR PARTNER'S — not the
                        roof's (owner: "It should show just your money, if
                        you have a wife then your wife's money"). The roof's
                        obligations are still shown, underneath, where they
                        belong: they are a fact about the building. */}
                    <span className="balance-label">
                      {age < 18 ? 'The family has' : 'You have'}
                    </span>
                    <span className="balance-value">
                      {formatMoney(moneyOnHand(world, person.id))}
                    </span>
                    <span className="balance-sub">
                      {(() => {
                        // The partner's own money, on its own line — one
                        // purse, two people, and both of them can see it.
                        const partnerId = partnerOf(world, person.id)
                        const partner = partnerId === null ? undefined : world.people.get(partnerId)
                        const theirs =
                          partner === undefined ? null : moneyOnHand(world, partner.id)
                        /**
                         * WHAT THE BUSINESS PAYS THEM IS INCOME (owner:
                         * "You still need to count the income we draw from
                         * the company as income").
                         *
                         * Added here rather than inside `personalMonthlyNet`
                         * on purpose: that function feeds the household
                         * pass, which CREDITS what it reports, and the draw
                         * has already been paid. Counting it there would
                         * pay it twice.
                         */
                        const draw = businessDrawOf(world, person.id)
                        const mine = (personalMonthlyNet(world, person.id) + draw) as Money
                        return (
                          <>
                            {/*
                              ONE PURSE, SAID ONCE (owner: "i hate how we
                              include other peoples money").

                              H0 keeps a married couple's liquid money as a
                              single shared balance, so this line printed the
                              SAME figure again under a partner's name — two
                              identical numbers reading as if the household
                              held twice what it does. Where the purse is
                              shared it now says so; only genuinely separate
                              money gets its own figure.
                            */}
                            {partner !== undefined && theirs !== null && (
                              <>
                                {theirs === moneyOnHand(world, person.id)
                                  ? `shared with ${partner.givenName}`
                                  : `${partner.givenName} has ${formatMoney(theirs)}`}
                                <br />
                              </>
                            )}
                            {mine < 0
                              ? `${formatMoney(-mine as Money)} a month more goes out than comes in`
                              : `${formatMoney(mine)} a month is staying put`}
                            {draw > 0 && (
                              <>
                                <br />
                                {formatMoney(draw)} of that is drawn from the business
                              </>
                            )}
                            {ledger.inArrears && (
                              <>
                                <br />
                                <span className="bad">
                                  The roof owes {formatMoney(Math.abs(ledger.savings) as Money)} —
                                  nothing goes on lifestyle until it is clear
                                </span>
                              </>
                            )}
                          </>
                        )
                      })()}
                    </span>
                  </div>

                  {/*
                    WHAT ACTUALLY HAPPENED, LINE BY LINE (owner: "the month
                    should show every single income and spending of that money
                    with labels so we know what acutally caused it").

                    The card below this is a FORECAST — what a recurring month
                    looks like — and by construction it cannot explain the
                    months that most need explaining: the one where a business
                    sold, a house was bought, a licence was sat. This is the
                    statement. Every movement of this person's money, in the
                    order it happened, with the cause the engine recorded at
                    the moment it moved.
                  */}
                  <h3 className="panel-heading">What happened last month</h3>
                  {statement.length === 0 ? (
                    <p className="muted small">
                      Nothing moved. The month ahead is below.
                    </p>
                  ) : (
                    <ul className="ledger">
                      {statement.map((entry, at) => (
                        <li
                          key={`${String(entry.tick)}-${String(at)}`}
                          className={entry.amount >= 0 ? 'ledger-row in' : 'ledger-row out'}
                        >
                          <span className="ledger-label">{entry.label}</span>
                          <span className="ledger-amount">
                            {entry.amount >= 0
                              ? `+${formatMoney(entry.amount)}`
                              : `−${formatMoney(-entry.amount as Money)}`}
                          </span>
                        </li>
                      ))}
                      <li
                        className={
                          statementNet < 0 ? 'ledger-row total short' : 'ledger-row total'
                        }
                      >
                        <span className="ledger-label">What it came to</span>
                        <span className="ledger-amount">
                          {statementNet < 0
                            ? `−${formatMoney(-statementNet as Money)}`
                            : formatMoney(statementNet as Money)}
                        </span>
                      </li>
                    </ul>
                  )}

                  <h3 className="panel-heading">A month like this one</h3>
                  <ul className="ledger">
                    {mine.length === 0 && (
                      <li className="ledger-row muted">
                        <span className="ledger-label">Nothing is coming in</span>
                        <span className="ledger-amount">{formatMoney(0 as Money)}</span>
                      </li>
                    )}
                    {mine.map((line) => (
                      <li key={line.key} className="ledger-row in">
                        <span className="ledger-label">{line.label}</span>
                        <span className="ledger-amount">+{formatMoney(line.amount)}</span>
                      </li>
                    ))}
                    {/* THE ROW THAT MAKES THE ARITHMETIC VISIBLE (playtest:
                        "sum of pension lines ≈ $18,815/mo vs. displayed
                        'Coming in' $16,510.95, an unexplained ~$2,300 gap").
                        Nothing was unexplained — the lines are gross, the
                        total is net, and the engine has carried
                        `taxWithheld` on this very ledger precisely so the
                        itemisation sums. The UI never rendered it, so the
                        reviewer reconciled a payslip with its tax line
                        hidden and reasonably suspected a phantom salary. */}
                    <li className="ledger-row subtotal">
                      <span className="ledger-label">Coming in — you</span>
                      <span className="ledger-amount">{formatMoney(comingIn)}</span>
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
                        <span className="ledger-amount">−{formatMoney(month.rentShare)}</span>
                      </li>
                    )}
                    <li className={ledger.homeless ? 'ledger-row out hide' : 'ledger-row out'}>
                      <span className="ledger-label">
                        Living costs
                        {mouths.length > 0 && <span className="muted small"> · {mouths.join(', ')}</span>}
                        {/* NAME WHO IS MISSING, AND WHY (owner: "'1 grown'
                            because Bill is 'fed by the county' — he's in
                            jail. Coherent, but the card doesn't say that's
                            why the household shrank"). A married player
                            reading "1 grown" needs to know their spouse is
                            not absent from the maths by accident. */}
                        {ledger.jailed > 0 && (
                          <span className="muted small">
                            {' '}·{' '}
                            {awayInJail.length > 0
                              ? `${awayInJail.join(' and ')} ${awayInJail.length === 1 ? 'is' : 'are'} in the county jail, and fed there`
                              : `${ledger.jailed} fed by the county`}
                          </span>
                        )}
                      </span>
                      <span className="ledger-amount">−{formatMoney(month.living)}</span>
                    </li>
                    {/* SCHOOL FEES ARE NOT "LIVING COSTS" (owner: eight times
                        the rent for one adult and two kids). The number was
                        right and half of it was private school — a line that
                        does not say so cannot be checked by the person
                        paying it. */}
                    {month.tuition > 0 && (
                      <li className="ledger-row out">
                        <span className="ledger-label">
                          School fees
                          <span className="muted small"> · private schooling</span>
                        </span>
                        <span className="ledger-amount">−{formatMoney(month.tuition)}</span>
                      </li>
                    )}
                    <li className="ledger-row out">
                      <span className="ledger-label">
                        {/* SAY WHAT THE CHARGE IS (owner: "a random Lifestyle
                            · the life between rent and the bank which doesnt
                            even say what the charge really is but its always
                            super high"). It is a SHARE of whatever is left
                            after the bills — which is exactly why it rises
                            with income and looked arbitrary. The line says so
                            now, and shows the share it actually took. */}
                        Day-to-day living
                        <span className="muted small">
                          {' '}·{' '}
                          {ledger.inArrears
                            ? 'belt tightened — nothing spare while behind'
                            : `food, clothes, the car, a night out — ${String(
                                Math.round(
                                  (month.lifestyle * 100) /
                                    Math.max(1, month.earned - month.costs),
                                ),
                              )}% of what's left after the bills`}
                        </span>
                      </span>
                      <span className="ledger-amount">
                        {month.lifestyle > 0 ? `−${formatMoney(month.lifestyle)}` : formatMoney(0 as Money)}
                      </span>
                    </li>
                    {/* The sales tax rides inside the day-to-day line now —
                        it is charged ON that spending, and two rows for one
                        decision made the card longer without making it
                        clearer. */}
                    <li className="ledger-row subtotal">
                      <span className="ledger-label">Going out — you</span>
                      <span className="ledger-amount">
                        {formatMoney((month.costs + month.lifestyle) as Money)}
                      </span>
                    </li>
                    <li className={month.net < 0 ? 'ledger-row total short' : 'ledger-row total'}>
                      {/* AND NOW IT SUBTRACTS. The old note here admitted the
                          card's own arithmetic did not work — "what comes IN
                          is yours, what goes OUT is the building's, and these
                          two figures were never meant to subtract to each
                          other". Both sides are this person's now, so the
                          bottom line is the top line minus the middle. */}
                      <span className="ledger-label">Left over — you</span>
                      <span className="ledger-amount">
                        {month.net < 0
                          ? `−${formatMoney(-month.net as Money)}`
                          : formatMoney(month.net)}
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

                      {/* THE STREETS LIST IS GONE (owner, playing: "we
                          need to remove the streets as well since we have a
                          full real estate system now").

                          It let you "look for a place" in a NEIGHBOURHOOD and
                          priced it off that street's average rent — the
                          abstract housing model the property market replaced.
                          Keeping it was the same mistake the bank's old Home
                          section was: two ways to get a roof that disagree,
                          one picking a postcode and one picking an actual
                          door with a price, a condition and an owner.

                          Households still MOVE — the engine goes on seating
                          people and NPCs go on relocating. What is gone is
                          the player choosing a street instead of a house.
                          Property is the way in. */}
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
            onAct={onAct}
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

      {/* THE OWNER'S JOBS & CAREERS SCREEN (his `jobs-ui.html`), which
          supersedes the flat list that used to live here: ladders rather
          than a wall of one-off titles, and every shut door says why. */}
      {tab === 'jobs' && (
        /* IN A PANEL, like every other tab. Without it the screen renders
           but cannot be SCROLLED (owner: "You cant scroll on it or anything
           tho") — `.panel` is what gives a tab its scrolling box, and a
           long list of ladders overflows it immediately. */
        <div className="panel" aria-label="Jobs">
          <JobsTab world={world} onAct={onAct} busy={busy} />
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
          {/* THE FLAG, WHERE IT CAN BE SEEN (owner: "is there a way to
              tell if you are flagged?"). It was readable only as a refusal
              on a school card, while it silently also stopped promotion,
              held reenlistment and suspended medals — the player could
              watch three things not happen and never learn they were the
              same thing. */}
          {(() => {
            const flag = flagStatus(world, person.id, world.tick)
            if (!flag.flagged) return null
            const months = flag.liftsAtTick === null ? null : flag.liftsAtTick - world.tick
            return (
              <div className="flag-banner" role="status">
                <div className="flag-head">Flagged</div>
                <div className="flag-why">{flag.words}</div>
                <div className="flag-what">
                  No school, no promotion, no reenlistment and no decoration while it stands.
                </div>
                <div className="flag-when">
                  {months === null
                    ? 'It lifts when you pass the fitness test — not on a date.'
                    : months <= 0
                      ? 'It lifts this month.'
                      : `It lifts in ${String(months)} month${months === 1 ? '' : 's'}.`}
                </div>
              </div>
            )
          })()}
          {(() => {
            const record = world.service.get(person.id)
            // THE OFFICE IS OPEN TO A VETERAN TOO, and it was not.
            //
            // This read `if (!record)` — the recruiting station appeared
            // only for somebody who had NEVER served. The RE-code work
            // made coming back a real thing in the engine and there was
            // still no door on the screen, which is the third time in this
            // module that a rule has worked and the way to reach it has
            // not existed (the GI Bill measured at zero people for the
            // same reason, and re-enlistment itself had two bolted doors).
            //
            // `enlistmentBar` already answers for both cases — it names
            // the RE code when the papers refuse — so the wall explains
            // itself without this having to know why.
            /**
             * A DISCHARGE IS NOT AN ERASURE (owner, playing: "when you get
             * out the army the service tab doesn't show your stats or
             * anything afterwards, just the enlist screen").
             *
             * This returned the recruiting station for anybody not
             * currently serving — so the day a career ended, the branch,
             * the rank held, the years, the specialty, every deployment,
             * every award and the discharge itself all vanished from the
             * screen, replaced by an invitation to start again. Twenty
             * years of a life, gone the month it finished.
             *
             * Somebody who NEVER served gets the station alone, because
             * there is nothing else to show them. A veteran gets the
             * station AND their record, because both are true: the door is
             * open to them (the RE-code work made coming back real) and
             * what they already did still happened.
             */
            if (!record) {
              // M-ENLIST §7. The wall, not a bare refusal — see
              // RecruitingStation.tsx for why one button was not enough.
              return (
                <RecruitingStationView
                  world={world}
                  personId={person.id}
                  bar={enlistmentBar(world, person, world.tick)}
                  busy={busy}
                  onEnlist={onRequestEnlist}
                />
              )
            }
            const discharged = record.dischargedAtTick !== null
            const tours = deploymentsOf(world, person.id)
            // The one that is still open, if any — a tour you are ON is a
            // different screen from a list of tours you have done.
            const currentTour = tours.find((tour) => tour.returnedAtTick === null)
            const unlocks = veteranUnlocks(world, person.id)
            return (
              <>
                {/* THE RECORD LEADS (playtest: the default view "should
                    reflect prior service for anyone with an existing record
                    instead of always pitching fresh enlistment"). The door
                    used to come first, on the theory it was the actionable
                    thing — but for most veterans it is not actionable at
                    all: a medical discharge is RE-4 and the recruiter will
                    not process them. A pitch above a record it contradicts
                    read as a bug, because it was one. Now the record is the
                    screen, and the door appears under it only when the
                    recruiter would actually open it; a barred veteran gets
                    the refusal as one quiet line instead of a storefront. */}
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
                  {/* THE NUMBER THE COMMANDER READS (owner, with a
                      screenshot: "It doesn't show you the promotion
                      points"). The screen quoted the bar — standing 520 —
                      while the soldier's own standing appeared nowhere on
                      it. A bar without your number against it is a rule
                      you can only fail. */}
                  <dt>Standing</dt>
                  <dd>
                    {record.performance}
                    <span className="muted small"> · what the appointment and the boards read</span>
                  </dd>
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
                      {/**
                        * THE UNIT'S HONOURS, BESIDE THE UNIT (owner: "I dont
                        * see any unit awards on the career tab with the
                        * unit").
                        *
                        * They were on the Reports tab, which is where the
                        * annual evaluation lives — but a unit award belongs
                        * next to the unit that earned it, which is here. Each
                        * says by which right it is worn, because that
                        * distinction is the entire mechanic: present during
                        * the cited period and it is yours for life; arrive
                        * after and it comes off when you post out.
                        */}
                      {(() => {
                        const worn = unitAwardsFor(world, person.id)
                        if (worn.length === 0) return null
                        return (
                          <>
                            <dt>Unit awards</dt>
                            <dd>
                              {worn.map((award) => (
                                <div key={`${award.title}-${String(award.year)}`}>
                                  {award.title} ({award.year})
                                  <span className="muted small">
                                    {award.permanent
                                      ? ' · you were there'
                                      : ' · your unit’s, worn while you serve in it'}
                                  </span>
                                </div>
                              ))}
                            </dd>
                          </>
                        )
                      })()}
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
                {discharged && serviceTab === 'career' && (
                  enlistmentBar(world, person, world.tick) === null ? (
                    <RecruitingStationView
                      world={world}
                      personId={person.id}
                      bar={null}
                      busy={busy}
                      onEnlist={onRequestEnlist}
                    />
                  ) : (
                    <p className="muted small">
                      The recruiter's door: {enlistmentBar(world, person, world.tick)}
                    </p>
                  )
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
                      {/* THE PATH BEHIND THE BAR. Every schoolhouse card
                          lists "Standing meets the bar" and until now there
                          was nothing a player could DO about it — the only
                          things that raised standing were graduating a
                          school (which needs standing), finishing a
                          deployment, and one moment that happens once. */}
                      {(() => {
                        const bar = extraDutyBar(world)
                        return (
                          <button
                            type="button"
                            className={keepsHabit(world, person.id, 'duty') ? 'apply on' : 'apply'}
                            disabled={busy || bar !== null}
                            title={
                              bar ??
                              (keepsHabit(world, person.id, 'duty')
                                ? 'Put the load down. The standing it built decays back over time.'
                                : 'Take up the details nobody wants. Works on your standing every month you keep it up; the hours come out of your life.')
                            }
                            onClick={onExtraDuty}
                          >
                            {keepsHabit(world, person.id, 'duty')
                              ? '🎖 Carrying the extra load'
                              : '🎖 Pick up extra duty'}
                          </button>
                        )
                      })()}
                      <button type="button" className="apply" disabled={busy} onClick={() => onAct({ verb: 'request-discharge' })}>
                        📜 Request discharge
                      </button>
                    </div>
                    {(() => {
                      const standing = boardStandingFor(world, person.id)
                      if (!standing) {
                        /**
                         * A JUNIOR'S NEXT STEP, STATED (owner, playing: "I
                         * am a SPC and I am not getting promoted to CPL at
                         * all... everything"). Below the board ranks
                         * `boardStandingFor` is rightly null — but the
                         * screen then said NOTHING, so the one rank whose
                         * rule is unusual (CPL: a lateral appointment on
                         * standing alone, not a board, not badges) was
                         * also the one rank with no explanation anywhere.
                         * An invisible gate reads as a broken game.
                         */
                        const svc = world.service.get(person.id)
                        if (!svc || svc.dischargedAtTick !== null || svc.commissioned === true) return null
                        const spec = branchSpecFor(world, svc.branch)
                        const next = spec.ranks[svc.rank + 1]
                        if (next === undefined) return null
                        const lateral = (spec.grades[svc.rank + 1] ?? 0) === (spec.grades[svc.rank] ?? 0)
                        return (
                          <p className="muted small">
                            {lateral
                              ? `${next} is a lateral appointment — the commander names a specialist who stands out. Your standing is ${String(svc.performance)} against the 520 that keeps you in the running; the further past it, the sooner the call. Schools and badges start counting at the SGT board.`
                              : `${next} comes with time in grade and standing above 300 — yours is ${String(svc.performance)}.`}
                          </p>
                        )
                      }
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
                    <h3>The Schoolhouse</h3>
                    {/* M-SCHOOL §6, from the owner's mockup. Grouped by what
                        kind of course it is, because "promotion education"
                        and "a selection you can fail" are different things
                        with different stakes, and a flat list said neither.
                        Each card carries what it grants, how hard it is, how
                        scarce the seat is, which gates are met, and what this
                        soldier has already tried here. */}
                    {(() => {
                      // ONLY THE COURSES THAT ARE ACTUALLY YOURS (owner:
                      // "you should only see schools that you are eligible
                      // for, not every school there is").
                      //
                      // Hidden: another service's schools, and another
                      // trade's. Those are facts about who this soldier is
                      // and no amount of work changes them, so listing them
                      // with a refusal is a catalogue of other people's
                      // careers.
                      //
                      // STILL SHOWN, deliberately: the ones held up by
                      // something that can move — standing not there yet, a
                      // rank still to make, a full class, a flag. Those are
                      // the ones worth working toward, and the owner's own
                      // mockup shows exactly that card ("Not yet — raise
                      // your standing to earn a seat").
                      const all = schoolOptionsFor(world, person.id).filter(
                        (option) => option.onYourList,
                      )
                      const groups: readonly {
                        readonly key: 'pme' | 'skill' | 'selection'
                        readonly heading: string
                      }[] = [
                        { key: 'pme', heading: 'Promotion · Professional Military Education' },
                        { key: 'skill', heading: 'Skill Schools' },
                        { key: 'selection', heading: 'Selection' },
                      ]
                      const dots = (filled: number, tone: string): ReactElement => (
                        <span className="sch-dots">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <i key={n} className={n <= filled ? tone : ''} />
                          ))}
                        </span>
                      )
                      return groups.map(({ key, heading }) => {
                        const courses = all.filter((option) => option.category === key)
                        if (courses.length === 0) return null
                        return (
                          <section key={key} className="sch-group">
                            <h4 className="sch-cat">{heading}</h4>
                            {courses.map((option) => (
                              <article key={option.id} className="sch-card">
                                <div className="sch-head">
                                  <div>
                                    <div className="sch-name">{option.title}</div>
                                    <div className="sch-grants">
                                      {option.gatesGrade !== null
                                        ? `Required to make E-${option.gatesGrade}`
                                        : `Earns the ${option.badge} badge`}
                                    </div>
                                  </div>
                                </div>
                                <div className="sch-meters">
                                  <span>Difficulty {dots(option.difficultyDots, 'hard')}</span>
                                  <span>Seat {dots(option.scarcityDots, 'scarce')}</span>
                                  <span className="sch-dur">
                                    {option.courseMonths} month{option.courseMonths === 1 ? '' : 's'}
                                  </span>
                                </div>
                                <ul className="sch-reqs">
                                  {option.requirements.map((req) => (
                                    <li key={req.words} className={req.met ? 'ok' : 'no'}>
                                      <span className="ck">{req.met ? '✓' : '✕'}</span>
                                      {req.words}
                                    </li>
                                  ))}
                                </ul>
                                <div className={`sch-status ${option.attempts.graduated ? 'done' : option.open ? 'eligible' : 'locked'}`}>
                                  <span>
                                    {option.attempts.graduated
                                      ? 'Graduated — the badge is yours.'
                                      : option.open
                                        ? option.monthsUntilClass === 0
                                          ? `A class starts this month · ${option.seatsLeft} seat${option.seatsLeft === 1 ? '' : 's'} left`
                                          : `Eligible · next class in ${option.monthsUntilClass} month${option.monthsUntilClass === 1 ? '' : 's'} · ${option.seatsLeft} seat${option.seatsLeft === 1 ? '' : 's'}`
                                        : option.reason}
                                  </span>
                                  {option.open && !option.attempts.graduated && (
                                    <button
                                      type="button"
                                      className="apply"
                                      disabled={busy}
                                      onClick={() => onRequestSchool(option.id)}
                                    >
                                      Request a seat
                                    </button>
                                  )}
                                </div>
                                {(option.attempts.failed > 0 || option.attempts.injured > 0) && (
                                  <div className="sch-hist">
                                    {option.attempts.failed > 0 && (
                                      <>
                                        Washed out {option.attempts.failed} time
                                        {option.attempts.failed === 1 ? '' : 's'}.{' '}
                                      </>
                                    )}
                                    {option.attempts.injured > 0 && (
                                      <>
                                        Dropped hurt {option.attempts.injured} time
                                        {option.attempts.injured === 1 ? '' : 's'} — no attempt lost.{' '}
                                      </>
                                    )}
                                    {option.attempts.left > 0
                                      ? `${option.attempts.left} attempt${option.attempts.left === 1 ? '' : 's'} left.`
                                      : 'No attempts left.'}
                                  </div>
                                )}
                              </article>
                            ))}
                          </section>
                        )
                      })
                    })()}
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
                {serviceTab === 'reports' && (() => {
                  /**
                   * THE ANNUAL EVALUATION, READ BACK (owner: "we also need the
                   * UI for the evaluation").
                   *
                   * A stack of reports somebody senior wrote about you is the
                   * thing that actually decides a career, and until this
                   * screen existed the player could feel it moving without
                   * ever seeing it. Newest first, because the last report is
                   * the one that matters to the next board — and every one of
                   * them names the man who signed it, since the whole point
                   * is that a person had an opinion rather than a stat
                   * drifting.
                   */
                  const reports = [...evaluationsOf(world, person.id)].reverse()
                  /**
                   * AND THE AFTER-ACTION REVIEWS (owner, playing: "I just got
                   * into combat and got no after action report UI").
                   *
                   * The report was built and filed and nothing ever read it
                   * back — the documented failure shape where code exists but
                   * never runs. Worse, this tab returned EARLY when there were
                   * no annual reports, and annual reports begin at sergeant:
                   * a private who had just been shot at was told "no annual
                   * reports yet" on the one screen his contact was filed to.
                   * Both halves are read here now, and the tab is only empty
                   * when both are.
                   */
                  const contacts = afterActionsFor(world, person.id)
                  if (reports.length === 0 && contacts.length === 0) {
                    const record = world.service.get(person.id)
                    return (
                      <p className="feed-empty">
                        {record === undefined
                          ? 'No service record.'
                          : 'Nothing on file yet. Annual reports begin at sergeant; an after-action review is filed after every contact.'}
                      </p>
                    )
                  }
                  return (
                    <div className="tour-squad">
                      {reports.length > 0 && <h4>Annual reports · {reports.length}</h4>}
                      {reports.map((report) => {
                        const rater = report.raterId === null
                          ? undefined
                          : world.people.get(report.raterId)
                        const theirs = report.raterId === null
                          ? undefined
                          : world.service.get(report.raterId)
                        return (
                          <div key={String(report.tick)} className="sq-row">
                            <span className="sq-ic" aria-hidden="true">📋</span>
                            <div>
                              <div className="nm">
                                {formatYear(world, report.tick)} · {markWords(report.mark)}
                              </div>
                              <div className="sub">
                                {rater === undefined ? (
                                  'unsigned'
                                ) : (
                                  <>
                                    signed by{' '}
                                    <button
                                      type="button"
                                      className="link"
                                      onClick={() => { onInspect(rater.id) }}
                                    >
                                      {theirs === undefined
                                        ? ''
                                        : `${rankTitle(world, theirs.branch, theirs.rank, theirs.commissioned === true)} `}
                                      {rater.givenName} {rater.familyName}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className="sq-state s-ok">{Math.round(report.mark / 10)}</span>
                          </div>
                        )
                      })}
                      {reports.length > 0 && (
                        <p className="muted small">
                          Reports begin at sergeant and are written by whoever
                          outranks you in your unit. The man who writes them
                          changes when you move.
                        </p>
                      )}
                      {contacts.length > 0 && (
                        <>
                          <h4>After-action reviews · {contacts.length}</h4>
                          {contacts.map((contact, at) => {
                            const filed = afterActionFor(world, person.id, contact)
                            if (filed === null) return null
                            const open = openReport === contact.tick
                            return (
                              <div key={`${String(contact.tick)}-${String(at)}`} className="sq-row aar-row">
                                <span className="sq-ic" aria-hidden="true">🗒️</span>
                                <div className="aar-body">
                                  <div className="nm">
                                    {formatYear(world, contact.tick)} · {filed.place}
                                  </div>
                                  <div className="sub">
                                    {filed.unit} · filed {filed.filed}
                                  </div>
                                  {/**
                                    * THE DOCUMENT ITSELF, opened rather than
                                    * summarized. The asymmetry is the whole
                                    * point (§5.3): at the time your character
                                    * saw muzzle flashes on a ridge, and the
                                    * record — written eleven days later, by
                                    * somebody else, from what was known then —
                                    * says how many men were up there. He never
                                    * knew. You do. So the enemy assessment is
                                    * shown HERE and nowhere else, in the dry
                                    * institutional voice a real one is written
                                    * in, hedged, and never corrected later.
                                    */}
                                  {open && (
                                    <div className="aar-doc">
                                      <div className="aar-head">{filed.title}</div>
                                      <dl>
                                        <dt>Unit</dt>
                                        <dd>{filed.unit}</dd>
                                        <dt>Command</dt>
                                        <dd>{filed.command}</dd>
                                        {filed.operation !== null && (
                                          <>
                                            <dt>Operation</dt>
                                            <dd>{filed.operation}</dd>
                                          </>
                                        )}
                                        <dt>Occurred</dt>
                                        <dd>{filed.occurred}</dd>
                                        <dt>Filed</dt>
                                        <dd>{filed.filed}</dd>
                                        <dt>Location</dt>
                                        <dd>{filed.place}</dd>
                                      </dl>
                                      <div className="aar-sec">1. Mission</div>
                                      <p className="aar-line">{filed.mission}</p>
                                      <div className="aar-sec">2. Sequence of events</div>
                                      {filed.sequence.map((line) => (
                                        <p key={line} className="aar-line aar-seq">
                                          {line}
                                        </p>
                                      ))}
                                      <div className="aar-sec">3. Enemy</div>
                                      <p className="aar-line">{filed.enemyStrength}</p>
                                      <p className="aar-line">{filed.enemyLosses}</p>
                                      <div className="aar-sec">4. Friendly</div>
                                      <p className="aar-line">{filed.friendly}</p>
                                      {filed.casualties.map((line) => (
                                        <p key={line} className="aar-line aar-seq">
                                          {line}
                                        </p>
                                      ))}
                                      <div className="aar-sec">5. Recommendations</div>
                                      <p className="aar-line">{filed.recommendations}</p>
                                      <p className="aar-sign">
                                        {filed.signedBy}
                                        <span className="sub"> · {filed.signedRole}</span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="apply tour-history-btn"
                                  onClick={() => {
                                    setOpenReport(open ? null : contact.tick)
                                  }}
                                >
                                  {open ? 'Close' : 'Read'}
                                </button>
                              </div>
                            )
                          })}
                          <p className="muted small">
                            An after-action review is written for the record, not
                            for you. What it says about the enemy is an
                            assessment made at the time — it can be wrong, and it
                            is never corrected.
                          </p>
                        </>
                      )}
                      {/* THE UNIT'S HONOURS LIVE ON THE CAREER TAB, beside the
                          unit that earned them, and nowhere else — owner: "we
                          have this is three different spots". They were here
                          too, and on the personal rack, which is the one place
                          a unit award must never be. */}
                    </div>
                  )
                })()}
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
                      {(() => {
                        /**
                         * THE WOUNDS, ON THE RECORD (spec 3d's UI half: a
                         * service record that lists what the service cost
                         * the body). Read from the events the wounds
                         * themselves wrote — dated, named, and marked
                         * permanent where the condition is. A DD-214 that
                         * lists the medals and not the wounds is half a
                         * record.
                         */
                        const woundLines = eventsFor(world, person.id)
                          .filter((e) => e.type === 'wounded-in-action')
                          .slice(-8)
                        const permanent = world.health.get(person.id)?.permanent ?? []
                        if (woundLines.length === 0 && permanent.length === 0) return null
                        return (
                          <>
                            <h3>Wounds</h3>
                            <ol className="timeline">
                              {woundLines.map((e) => (
                                <li key={e.id}>
                                  <div className="row">
                                    <span className="year">{formatYear(world, e.tick as never)}</span>
                                    <span className="what">
                                      {(e.detail ?? '').split(':')[1] ?? 'wounds taken in action'}
                                      {(e.detail ?? '').startsWith('serious') ? ' · serious' : ''}
                                    </span>
                                  </div>
                                </li>
                              ))}
                              {permanent.map((c) => (
                                <li key={`${c.kind}-${String(c.sinceTick)}`}>
                                  <div className="row">
                                    <span className="year">{formatYear(world, c.sinceTick as never)}</span>
                                    <span className="what bad">
                                      {String(c.kind).replace(/-/g, ' ')}
                                      {c.site ? ` — the ${c.site}` : ''} · permanent
                                      {(c.adaptedAtTick ?? null) !== null ? ' · fitted with an aid' : ''}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </>
                        )
                      })()}
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
                {/* THE TOUR YOU ARE ON, before the history of the ones
                    you are not. A dashboard for a deployment that is
                    happening now is a different thing from a list of
                    deployments that happened. */}
                {serviceTab === 'deployments' && currentTour !== undefined && (
                  <TourPanel world={world} tour={currentTour} onInspect={onInspect} />
                )}
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
                          <button
                            type="button"
                            className="apply tour-history-btn"
                            onClick={() =>
                              setOpenTourHistory(
                                openTourHistory === tour.tourNumber ? null : tour.tourNumber,
                              )
                            }
                          >
                            {openTourHistory === tour.tourNumber ? 'Close' : 'History'}
                          </button>
                        </div>
                        {/* THE PEOPLE YOU WERE THERE WITH (owner: "there
                            should be a 'history' button and it shows your
                            squad and the guys you were there with,
                            including the ones that died"). The rosters
                            were always on the deployment records — the
                            squad persists, spec §2, "squadmates are real
                            registered NPCs" — but only the CURRENT tour
                            ever showed its people. A finished tour showed
                            a date and an enemy, as if you had gone alone.
                            The dead stay on the list, which is the
                            game's oldest rule about squads. */}
                        {openTourHistory === tour.tourNumber && (
                          <div className="tour-squad tour-squad-past">
                            {(tour.squad ?? []).length === 0 ? (
                              <p className="muted small">
                                No roster survives from this tour.
                              </p>
                            ) : (
                              (tour.squad ?? []).map((member) => {
                                const them = world.people.get(member.personId)
                                if (them === undefined) return null
                                const over = tour.returnedAtTick ?? world.tick
                                const fellHere =
                                  them.deathTick !== null &&
                                  them.deathTick >= tour.startedAtTick &&
                                  them.deathTick <= over
                                const diedSince = them.deathTick !== null && !fellHere
                                const state = fellHere ? 'kia' : diedSince ? 'kia' : 'ok'
                                const words = fellHere
                                  ? `KIA · ${formatYear(world, them.deathTick ?? over)}`
                                  : diedSince
                                    ? `died ${formatYear(world, them.deathTick ?? world.tick)}`
                                    : `${String(ageAt(them.birthTick, world.tick))} now`
                                return (
                                  <div
                                    key={member.personId}
                                    className={fellHere ? 'sq-row gone' : 'sq-row'}
                                  >
                                    <span className="sq-ic" aria-hidden="true">
                                      {member.role === 'medic'
                                        ? '💊'
                                        : member.role === 'radio'
                                          ? '📻'
                                          : member.role === 'leader'
                                            ? '🎖️'
                                            : '🪖'}
                                    </span>
                                    <div>
                                      {/**
                                        * CLICKABLE HERE TOO (owner: "not
                                        * clickable in the history of the
                                        * deployment").
                                        *
                                        * The live tour panel opens these men
                                        * and this list did not, which is the
                                        * worse of the two places to lose it:
                                        * the history is where you go to
                                        * remember somebody, and the ones who
                                        * were killed are ONLY here.
                                        */}
                                      <button
                                        type="button"
                                        className="link nm"
                                        onClick={() => { onInspect(member.personId) }}
                                      >
                                        {member.nickname.length > 0
                                          ? `${them.givenName} "${member.nickname}" ${them.familyName}`
                                          : `${them.givenName} ${them.familyName}`}
                                      </button>
                                      <div className="sub">
                                        {member.role.replace(/-/g, ' ')}
                                        {(() => {
                                          // Rank, trade and where he was from
                                          // — the same line the live panel
                                          // gives, so a man you lost reads as
                                          // a person rather than a callsign.
                                          const rec = world.service.get(member.personId)
                                          if (rec === undefined) return null
                                          return ` · ${rankTitle(world, rec.branch, rec.rank, rec.commissioned === true)}${
                                            them.fromAway === undefined ? '' : ` · from ${them.fromAway}`
                                          }`
                                        })()}
                                      </div>
                                    </div>
                                    <span className={`sq-state s-${state}`}>
                                      <i className={`sq-dot d-${state}`} aria-hidden="true" />
                                      {words}
                                    </span>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
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
          {/* THE HUB (owner's `health_tab_1.html` and
              `benefits_insurance_master.md` §8: the reworked Health tab is
              "the single hub — conditions + body diagram AND a Coverage &
              Benefits section").

              All three pieces already existed and none of them were here.
              The body diagram lived only inside the wound overlay, so a
              player could not go and LOOK at their own body; the coverage
              resolver and the BA rating had nowhere to render at all. A
              modelled system nobody can see is one the player is entitled
              to think is missing — which is exactly what happened with the
              tours dashboard. */}
          <BodyDiagram world={world} personId={person.id} />
          <CoverageCard world={world} personId={person.id} busy={busy} onAct={onAct} />
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
        <button type="button" disabled={busy} onClick={() => { setTab('story'); pendingAdvance.current = { from: world.tick, months: 1 }; onAdvance(1) }}>
          + month
        </button>
        <button type="button" className="age-up" disabled={busy} onClick={() => { setTab('story'); pendingAdvance.current = { from: world.tick, months: 12 }; onAdvance(12) }}>
          {busy ? '…' : 'Age a year'}
        </button>
        {/* NO FIVE-YEAR SKIP (owner: "remove the +5 year option"). Five
            years at a press outran everything the game asks a player to
            notice — boards, schools, children, whole deployments resolved
            unseen. A month and a year are the two speeds a life reads at. */}
      </footer>
    </div>
  )
}
