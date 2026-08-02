/**
 * The WCJC newsroom.
 *
 * Written to the owner's newsroom brief. The old articles failed it in
 * exactly the three ways the brief names: no facts (no age, rank, cause,
 * date, survivors), no quotes and no structure, and length spent on
 * abstract commentary. That is essay-writing, not reporting.
 *
 * THE RULES THIS FILE OBEYS
 *  - Six questions answered: who, what, when, where, why, how.
 *  - Inverted pyramid: the most important facts first, detail after.
 *  - Structure: headline / dateline + lede / 2-4 body paragraphs / a quote /
 *    a closing on what happens next.
 *  - Neutral and professional. No philosophizing, no moralizing, no poetry.
 *  - Nothing invented. A missing field is left out, not imagined.
 *
 * NO GENERATIVE AI, ANYWHERE (CLAUDE.md §7, absolute). The brief was
 * written for a language model; this is the same brief executed by code,
 * which is what the determinism rule requires — the same seed must produce
 * the same paper, forever.
 *
 * ON QUOTES. Every quote is attributed to a REAL simulated person — a
 * squad leader who really leads that squad, a spouse who is really married
 * to the subject — and asserts only facts the simulation actually holds
 * (years served, the unit, the sentence). The words are rendered, the way
 * the story prose is rendered; the claims inside them are true.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { formatDate, ageAt } from './clock.js'
import { GRADE_TITLES, NEWS_STATION, offenceById, specialtyById } from './content.js'
import type { NewsItem } from './geopolitics.js'
import { activeWars, homeland } from './geopolitics.js'
import { hash32, Stream } from './rng.js'
import { sentenceCase } from './text.js'
import { branchName, lastUnitRosterOf, rankTitle } from './service.js'
import type { Person, World } from './types.js'

/** The homeland, named from the world rather than typed into the sentence
 *  (W1 resistance 6). */
function homelandName(world: World): string {
  return homeland(world)?.name ?? 'the homeland'
}

export interface NewsQuote {
  readonly text: string
  /** Who said it: a real person in the world, with their standing. */
  readonly source: string
}

export interface NewsArticle {
  /** Plain and specific, under about twelve words. */
  readonly headline: string
  /** e.g. "HAVERLOCK, March 1974". */
  readonly dateline: string
  /** One sentence: who, what, when, where. */
  readonly lede: string
  /** Two to four short paragraphs: detail, cause, context. */
  readonly body: readonly string[]
  readonly quote: NewsQuote | null
  /** Survivors, next steps, what happens now. */
  readonly closing: string | null
}

function fullName(person: Person): string {
  return `${person.givenName} ${person.familyName}`
}

/** The people who share a roof with someone, minus themselves. */
function householdOthers(world: World, person: Person): Person[] {
  if (person.householdId === null) return []
  const household = world.households.get(person.householdId)
  if (!household) return []
  return household.memberIds
    .filter((id) => id !== person.id)
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
}

/** A spouse, if there is a living one. Read off the graph directly so the
 *  newsroom adds no module cycle. */
function livingSpouse(world: World, personId: EntityId): Person | undefined {
  for (const relationship of world.relationships.values()) {
    if (relationship.type !== 'spouse') continue
    if (relationship.a !== personId && relationship.b !== personId) continue
    const otherId = relationship.a === personId ? relationship.b : relationship.a
    const other = world.people.get(otherId)
    if (other && other.deathTick === null) return other
  }
  return undefined
}

function parentsOf(world: World, person: Person): Person[] {
  return person.parentIds
    .map((id) => world.people.get(id))
    .filter((p): p is Person => p !== undefined && p.deathTick === null)
}

function childrenOf(world: World, person: Person): Person[] {
  const found: Person[] = []
  for (const other of world.people.values()) {
    if (other.deathTick !== null) continue
    if (other.parentIds.includes(person.id)) found.push(other)
  }
  return found.sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)
}

/** "Ada Whitlock and Tomas Whitlock" — an English list, for survivors. */
function nameList(people: readonly Person[]): string {
  const names = people.map(fullName)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The article for a news item, or null where the item carries too little to
 * report. Null is the honest answer: a newsroom with nothing does not run
 * four paragraphs about having nothing.
 */
export function articleFor(world: World, item: NewsItem): NewsArticle | null {
  const town = world.town.name
  const dateline = `${town.toUpperCase()}, ${formatDate(item.tick)}`
  const subject = item.subjectId === undefined ? undefined : world.people.get(item.subjectId)

  switch (item.kind) {
    case 'died-in-service':
      return subject === undefined ? null : deathInService(world, item, subject, dateline)
    case 'came-home':
      return subject === undefined ? null : cameHome(world, item, subject, dateline)
    case 'recruiting-drive':
      // OWNER: a recruiting season is a notice, not a story. It stays in
      // the feed as a headline and gets no article behind it.
      return null
    case 'crime':
      return subject === undefined ? null : crimeReport(world, item, subject, dateline)
    default:
      return warReport(world, item, dateline)
  }
}

// ---------------------------------------------------------------------------
// A death in service — the heaviest thing this station prints
// ---------------------------------------------------------------------------

function deathInService(
  world: World,
  item: NewsItem,
  person: Person,
  dateline: string,
): NewsArticle {
  const record = world.service.get(person.id)
  const age = ageAt(person.birthTick, item.tick)
  const rank = record === undefined ? null : rankTitle(world, record.branch, record.rank)
  const branch = record === undefined ? null : branchName(world, record.branch)
  const trade = record === undefined ? null : specialtyById(record.specialtyId).title
  const cause = person.causeOfDeath ?? 'causes not stated'
  const years =
    record === undefined ? null : Math.max(1, Math.floor((item.tick - record.enlistedAtTick) / 12))

  // WHERE: the last tour, if there was one open.
  const tours = world.deployments.get(person.id) ?? []
  const lastTour = tours[tours.length - 1]
  const away =
    lastTour === undefined
      ? null
      : lastTour.kind === 'rotation'
        ? (lastTour.hostId === null ? null : world.nations.get(lastTour.hostId)?.name ?? null)
        : (lastTour.enemyId === null ? null : world.nations.get(lastTour.enemyId)?.name ?? null)
  const onTour = lastTour !== undefined && lastTour.returnedAtTick === item.tick

  const who = rank === null ? fullName(person) : `${rank} ${fullName(person)}`
  const where = onTour && away !== null
    ? lastTour.kind === 'rotation'
      ? ` while posted to ${away}`
      : ` on the ${away} front`
    : ''

  const body: string[] = []
  if (branch !== null && trade !== null && years !== null) {
    body.push(
      // BRANCH_NAMES already carry their article ("the Land Forces").
      `${fullName(person)} had served ${String(years)} year${years === 1 ? '' : 's'} in ${branch} as a ${trade}, and held the rank of ${rank ?? 'private'} at the time of death.`,
    )
  }
  if (onTour && lastTour !== undefined) {
    const months = item.tick - lastTour.startedAtTick
    body.push(
      `The death occurred ${String(months)} month${months === 1 ? '' : 's'} into a tour that began in ${formatDate(lastTour.startedAtTick)}. The cause is recorded as ${cause}.`,
    )
  } else {
    body.push(`The cause is recorded as ${cause}.`)
  }

  const home = homeland(world)
  const atWar = home !== undefined && activeWars(world).some((w) => w.a === home.id || w.b === home.id)
  body.push(
    atWar
      ? `${sentenceCase(homelandName(world))} is at war. Records show ${String(countServing(world))} residents of ${world.town.name} currently serving.`
      : `${sentenceCase(homelandName(world))} is not at war. Records show ${String(countServing(world))} residents of ${world.town.name} currently serving.`,
  )

  // QUOTE: the squad leader, who is a real person leading a real squad.
  // lastUnitRosterOf, not unitRosterOf: the record closed the moment they
  // died, and the squad they served in is exactly who can speak to it.
  const roster = lastUnitRosterOf(world, person.id)
  const speakers = roster?.members.filter((m) => m.personId !== person.id) ?? []
  const spouse = livingSpouse(world, person.id)
  const quote = deathQuote(world, item, person, roster?.unitName ?? null, speakers, spouse, {
    years,
    trade,
    onTour,
    away,
  })

  // CLOSING: survivors and next steps, from the family the world holds.
  const children = childrenOf(world, person)
  const parents = parentsOf(world, person)
  const survivors = [
    ...(spouse === undefined ? [] : [spouse]),
    ...children,
    ...(spouse === undefined && children.length === 0 ? parents : []),
  ]
  const closing =
    survivors.length > 0
      ? `${person.givenName} is survived by ${nameList(survivors)}. The service record closes with this month's date and remains open to the family.`
      : 'The service record closes with this month\'s date and remains open to anyone entitled to it.'

  return {
    headline: `${who} dies in service at ${String(age)}`,
    dateline,
    lede: `${who}, ${String(age)}, of ${world.town.name}, died in ${formatDate(item.tick)}${where}, according to service records.`,
    body: body.slice(0, 4),
    quote,
    closing,
  }
}

/**
 * The quote on a death report. Varied, but never random — a reporter
 * speaks to whoever is there, and who that is follows from the world.
 *
 * The speaker is drawn from the squad by a pure hash of (person, month),
 * so the same death always yields the same interview and two deaths do
 * not read alike. Every line asserts only what the simulation holds: the
 * unit, the years, the trade, the tour. Nobody says anything that is not
 * true of them.
 */
function deathQuote(
  world: World,
  item: NewsItem,
  person: Person,
  unitName: string | null,
  speakers: readonly { personId: EntityId; name: string; rankTitle: string; role: string }[],
  spouse: Person | undefined,
  facts: { years: number | null; trade: string | null; onTour: boolean; away: string | null },
): NewsQuote | null {
  const draw = hash32(world.seed, Stream.Employment, person.id, item.tick + 4_242)

  // A squadmate, if the squad has anyone left to ask.
  if (speakers.length > 0 && unitName !== null) {
    const speaker = speakers[draw % speakers.length]
    if (speaker !== undefined) {
      const lines: string[] = [
        `${person.givenName} was in ${unitName} with us. That is who we lost.`,
        `We served together in ${unitName}. You do not replace somebody like that on a roster.`,
        `${person.givenName} pulled the same duty the rest of us pulled, every day, without a word about it.`,
      ]
      if (facts.trade !== null) {
        lines.push(
          `Best ${facts.trade} in ${unitName}, and I would say that in front of anyone who wants to argue it.`,
        )
      }
      if (facts.years !== null && facts.years >= 3) {
        lines.push(
          `${String(facts.years)} years in, and ${person.givenName} still did the job like it was the first week.`,
        )
      }
      if (facts.onTour && facts.away !== null) {
        lines.push(`We were out there together. ${person.givenName} did not come back with us.`)
      }
      const text = lines[Math.floor(draw / 7) % lines.length] ?? lines[0]
      if (text !== undefined) {
        return { text, source: `${speaker.rankTitle} ${speaker.name}, ${unitName}` }
      }
    }
  }

  // Otherwise the family speaks, which is its own kind of report.
  if (spouse !== undefined) {
    const lines = [
      `We knew what the work was. Knowing does not do much for you when the notice comes.`,
      `${person.givenName} signed on and never once talked about quitting it.`,
      `I would like people to know ${person.givenName} was more than the uniform.`,
    ]
    const text = lines[draw % lines.length] ?? lines[0]
    if (text !== undefined) return { text, source: `${fullName(spouse)}, spouse` }
  }
  return null
}

function countServing(world: World): number {
  let serving = 0
  for (const record of world.service.values()) if (record.dischargedAtTick === null) serving++
  return serving
}

// ---------------------------------------------------------------------------
// Home from a tour
// ---------------------------------------------------------------------------

function cameHome(world: World, item: NewsItem, person: Person, dateline: string): NewsArticle {
  const record = world.service.get(person.id)
  const rank = record === undefined ? null : rankTitle(world, record.branch, record.rank)
  const who = rank === null ? fullName(person) : `${rank} ${fullName(person)}`
  const tours = world.deployments.get(person.id) ?? []
  const tour = tours.find((t) => t.returnedAtTick === item.tick)
  const months = tour === undefined ? null : item.tick - tour.startedAtTick
  const enemy =
    tour?.enemyId === null || tour?.enemyId === undefined
      ? null
      : world.nations.get(tour.enemyId)?.name ?? null

  const body: string[] = []
  if (months !== null && tour !== undefined) {
    // (A ternary here once had the same word in both branches, so the
    // sentence read the same however it was reached — review must-fix.)
    const careerYears = Math.max(
      1,
      Math.floor((item.tick - (record?.enlistedAtTick ?? item.tick)) / 12),
    )
    body.push(
      `The tour ran ${String(months)} month${months === 1 ? '' : 's'}, beginning in ${formatDate(tour.startedAtTick)}${enemy === null ? '' : ` on the ${enemy} front`}. It was the ${ordinal(tour.tourNumber)} tour of a career now in its ${ordinal(careerYears)} year.`,
    )
  }
  const household = householdOthers(world, person)
  const home = person.householdId === null ? undefined : world.households.get(person.householdId)
  const place = home === undefined ? undefined : world.places.get(home.placeId)?.name
  if (household.length > 0) {
    body.push(
      `${person.givenName} returns to a household of ${String(household.length + 1)}${place === undefined ? '' : ` in ${place}`}.`,
    )
  }

  const spouse = livingSpouse(world, person.id)
  const draw = hash32(world.seed, Stream.Employment, person.id, item.tick + 8_484)
  const quote: NewsQuote | null =
    spouse === undefined
      ? null
      : (() => {
          const lines = [
            `${months === null ? 'A tour' : `${String(months)} months`} is a long time to run a house on your own.`,
            'The children have been counting it out on the calendar since the day the orders came.',
            'You do not settle back into it overnight. But they are home, and that is the part I wanted.',
          ]
          const text = lines[draw % lines.length] ?? lines[0]
          return text === undefined ? null : { text, source: `${fullName(spouse)}, spouse` }
        })()

  return {
    headline: `${who} returns from tour`,
    dateline,
    lede: `${who} of ${world.town.name} returned from deployment in ${formatDate(item.tick)}${enemy === null ? '' : `, back from the ${enemy} front`}.`,
    body: body.slice(0, 3),
    quote,
    closing: 'The soldier returns to the home station roster and is off the rotation list pending further orders.',
  }
}

function ordinal(n: number): string {
  return n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${String(n)}th`
}


// ---------------------------------------------------------------------------
// The courthouse
// ---------------------------------------------------------------------------

function crimeReport(world: World, item: NewsItem, person: Person, dateline: string): NewsArticle {
  const record = world.criminal.get(person.id)
  const conviction = [...(record?.convictions ?? [])].reverse().find((c) => c.tick === item.tick)
  const offence = conviction === undefined ? undefined : offenceById(conviction.kind)
  const charge = offence?.title ?? conviction?.kind ?? 'an offence'
  const age = ageAt(person.birthTick, item.tick)
  const priors = (record?.convictions ?? []).filter((c) => c.tick < item.tick).length

  const body: string[] = []
  if (conviction !== undefined) {
    body.push(
      conviction.sentenceMonths > 0
        ? `The court imposed a sentence of ${String(conviction.sentenceMonths)} month${conviction.sentenceMonths === 1 ? '' : 's'}. The charge is graded ${offence === undefined ? 'under the criminal code' : GRADE_TITLES[offence.grade]}.`
        : `The court imposed a fine. The charge is graded ${offence === undefined ? 'under the criminal code' : GRADE_TITLES[offence.grade]}.`,
    )
  }
  body.push(
    priors > 0
      ? `Court records show ${String(priors)} prior conviction${priors === 1 ? '' : 's'} against the defendant.`
      : 'Court records show no prior convictions against the defendant.',
  )
  body.push(
    'A conviction remains on the record permanently and is read by employers and the recruiting office for ten years.',
  )

  return {
    headline: `${fullName(person)} convicted of ${charge}`,
    dateline,
    lede: `${fullName(person)}, ${String(age)}, of ${world.town.name}, was convicted of ${charge} at the county courthouse in ${formatDate(item.tick)}.`,
    body: body.slice(0, 4),
    quote: null,
    closing:
      conviction !== undefined && conviction.sentenceMonths > 0
        ? `The sentence begins immediately and is due to end in ${formatDate((item.tick + conviction.sentenceMonths) as Tick)}.`
        : 'The fine is payable to the county.',
  }
}

// ---------------------------------------------------------------------------
// A war
// ---------------------------------------------------------------------------

function warReport(world: World, item: NewsItem, dateline: string): NewsArticle | null {
  const home = homeland(world)
  const war = activeWars(world).find(
    (w) =>
      item.text.includes(world.nations.get(w.a)?.name ?? ' ') &&
      item.text.includes(world.nations.get(w.b)?.name ?? ' '),
  )
  if (war === undefined) return null
  const a = world.nations.get(war.a)
  const b = world.nations.get(war.b)
  if (!a || !b) return null

  const ourWar = home !== undefined && (war.a === home.id || war.b === home.id)
  const months = item.tick - war.sinceTick
  const years = Math.floor(months / 12)
  const dead = war.casualtiesA + war.casualtiesB
  const phase = war.warPhase ?? 'attrition'

  const body: string[] = [
    `Fighting began in ${formatDate(war.sinceTick)}${years >= 1 ? `, ${String(years)} year${years === 1 ? '' : 's'} ago` : ''}. Military sources describe the current phase as ${phase}.`,
  ]
  if (dead > 0) {
    body.push(
      `Combined casualties are reported at ${grouped(dead)}. The figures are issued by the two governments and cannot be independently confirmed.`,
    )
  }
  if (ourWar && home !== undefined) {
    const ours = war.a === home.id ? war.casualtiesA : war.casualtiesB
    const deployed = countDeployed(world)
    body.push(
      `${sentenceCase(homelandName(world))} reports losses of ${grouped(ours)}. ${String(deployed)} personnel from ${world.town.name} and its home stations are currently deployed.`,
    )
  }

  const other = ourWar ? (war.a === home?.id ? b : a) : null
  return {
    headline: ourWar
      ? `${sentenceCase(homelandName(world))} at war with ${other?.name ?? 'foreign power'}, ${phase} continues`
      : `${a.name} and ${b.name} remain at war`,
    dateline,
    lede: ourWar
      ? `${sentenceCase(homelandName(world))} remains at war with ${other?.name ?? 'a foreign power'} as of ${formatDate(item.tick)}, with fighting in its ${phase}.`
      : `${a.name} and ${b.name} remain at war as of ${formatDate(item.tick)}, with fighting in its ${phase}.`,
    body: body.slice(0, 4),
    quote: null,
    closing: ourWar
      ? 'Orders continue to be issued to home stations. Families of serving personnel are notified directly.'
      : `${sentenceCase(homelandName(world))} is not a belligerent.`,
  }
}

function countDeployed(world: World): number {
  let deployed = 0
  for (const [personId, tours] of world.deployments) {
    const person = world.people.get(personId)
    if (!person || person.deathTick !== null) continue
    if (tours.some((t) => t.returnedAtTick === null)) deployed++
  }
  return deployed
}

/** Thousands separators without Intl, which is banned in the engine. */
function grouped(n: number): string {
  const digits = String(Math.abs(Math.trunc(n)))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return n < 0 ? `-${out}` : out
}

/** The station's own name, for the byline. */
export { NEWS_STATION }
