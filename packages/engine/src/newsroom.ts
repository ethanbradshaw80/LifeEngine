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
import { describeAilment } from './wounds.js'
import {
  CASUALTY_CLAUSES,
  CRIME_OPENERS,
  DEATH_OPENERS,
  DEATH_QUOTES,
  gritFor,
  pickPhrase,
  WAR_OPENERS,
  WOUND_CLAUSES,
} from './newsvoice.js'
import { GRADE_TITLES, isFelony, offenceById } from './content.js'
import type { NewsItem } from './geopolitics.js'
import { officeById, PARTIES } from './government.js'
import { activeWars, homeland } from './geopolitics.js'
import { hash32, Stream } from './rng.js'
import { bareName, sentenceCase, sentenceInWords, withArticle } from './text.js'
import { branchName, lastUnitRosterOf, rankTitle } from './service.js'
import type { Person, World } from './types.js'
import { specialtyFor } from './worldspec.js'

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
  const dateline = `${town.toUpperCase()}, ${formatDate(world, item.tick)}`
  const subject = item.subjectId === undefined ? undefined : world.people.get(item.subjectId)

  switch (item.kind) {
    case 'died-in-service':
      return subject === undefined ? null : deathInService(world, item, subject, dateline)
    case 'recruiting-drive':
      // OWNER: a recruiting season is a notice, not a story. It stays in
      // the feed as a headline and gets no article behind it.
      return null
    case 'election': {
      if (subject === undefined) return null
      const office = officeById(item.detail ?? '')
      if (office === undefined) return null
      const name = fullName(subject)
      // The party from the same deterministic mapping the ballot itself
      // uses — always answerable, even decades after the term ended.
      const partyName = PARTIES[Math.abs(subject.id) % PARTIES.length]?.name
      const age = ageAt(subject.birthTick, item.tick)
      return {
        headline: item.text.toUpperCase(),
        dateline,
        lede: `${name}, ${String(age)}, was sworn in this week as ${office.title}${partyName === undefined ? '' : `, standing for the ${partyName}`}.`,
        body: [
          `The count settled it and the courthouse steps did the rest: the ${office.level} seat changes hands, and the town gets the government it voted for. The office runs a ${String(office.termYears)}-year term.`,
          `What gets done with the term is the part no paper can print in advance. The record — every vote taken, every purse opened — accrues in the public file, where this desk will be reading it.`,
        ],
        quote: null,
        closing: `The seat is held until the term runs out, or the town says otherwise.`,
      }
    }
    case 'crime':
      return subject === undefined ? null : crimeReport(world, item, subject, dateline)
    default:
      return warReport(world, item, dateline)
  }
}

// ---------------------------------------------------------------------------
// A death in service — the heaviest thing this station prints
// ---------------------------------------------------------------------------

/**
 * The wound that killed somebody, in the words the record already holds.
 *
 * OWNER'S SPEC §1: the engine records the specific facts and the article
 * was not reading them. `causeOfDeath` is a summary — "wounds taken in
 * action" — while the health record knows it was a gunshot to the shoulder
 * and the ledger knows the convoy was ambushed. Nothing here is invented;
 * it is the same facts, read one level deeper.
 */
function woundWords(world: World, personId: EntityId, tick: Tick): string | null {
  // THE EVENT, NOT THE HEALTH RECORD. A dead person's health record no
  // longer carries the ailment that killed them — that is the record of
  // the living — but the wound event does, and it was written with the
  // wound's own description in it.
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event) continue
    if (tick - event.tick > 2) break
    if (event.subjectId !== personId) continue
    if (event.type !== 'wounded-in-action' && event.type !== 'was-injured') continue
    const described = (event.detail ?? '').split(':')[1]
    if (described !== undefined && described !== '') return described
  }
  const health = world.health.get(personId)
  if (health?.ailment != null) {
    return describeAilment(health.ailment, health.ailmentKind, health.ailmentSite)
  }
  return null
}

/** How the month's contact went, from the contact event's own flavour. */
function contactWords(world: World, personId: EntityId, tick: Tick): string | null {
  for (let i = world.events.length - 1; i >= 0; i--) {
    const event = world.events[i]
    if (!event) continue
    if (tick - event.tick > 2) break
    if (event.subjectId !== personId) continue
    if (event.type === 'saw-combat' && event.detail !== null) {
      // The flavour is already a sentence fragment about what happened.
      return event.detail.charAt(0).toLowerCase() + event.detail.slice(1)
    }
  }
  return null
}

function deathInService(
  world: World,
  item: NewsItem,
  person: Person,
  dateline: string,
): NewsArticle {
  const record = world.service.get(person.id)
  const age = ageAt(person.birthTick, item.tick)
  const rank = record === undefined ? null : rankTitle(world, record.branch, record.rank, record.commissioned === true)
  const branch = record === undefined ? null : branchName(world, record.branch)
  const trade = record === undefined ? null : specialtyFor(world, record.specialtyId).title
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
  // OWNER'S SPEC §1 and §2: the specific wound, the specific circumstance,
  // and an opener chosen from a wide seeded pool so two deaths in one town
  // do not read as the same sentence with the names swapped.
  // WHAT ACTUALLY KILLED THEM decides how this is written. The pools are
  // written for a war death, and a person in uniform can die of anything
  // anybody else dies of — the paper does not carry those any more, but an
  // article asked for one directly must not put "hit and did not make it
  // off the road" over a body that says sudden illness.
  const killedByTheWar =
    cause.includes('wounds taken in action') ||
    cause.includes('accident') ||
    cause.includes('captivity')
  const wound = woundWords(world, person.id, item.tick)
  const how = contactWords(world, person.id, item.tick)
  const grit = gritFor('died-in-service')
  const opener = killedByTheWar
    ? pickPhrase(DEATH_OPENERS[grit], world.seed, person.id * 31, item.tick)
    : '{who}, {age}, of {town}, died in {when}'
  const woundClause =
    wound === null || !killedByTheWar
      ? null
      : pickPhrase(WOUND_CLAUSES[grit], world.seed, person.id * 37, item.tick)
  const where = onTour && away !== null
    ? lastTour.kind === 'rotation'
      ? ` while posted to ${away}`
      : ` on the ${bareName(away)} front`
    : ''

  const body: string[] = []
  if (branch !== null && trade !== null && years !== null) {
    body.push(
      // BRANCH_NAMES already carry their article ("the Land Forces").
      `${fullName(person)} had served ${String(years)} year${years === 1 ? '' : 's'} in ${branch} as ${withArticle(trade)}, and held the rank of ${rank ?? 'private'} at the time of death.`,
    )
  }
  // OWNER'S SPEC §1: what the month's contact actually was, in the words
  // the ledger already holds.
  if (how !== null) {
    body.push(`${how.charAt(0).toUpperCase()}${how.slice(1)}.`)
  }
  if (onTour && lastTour !== undefined) {
    const months = item.tick - lastTour.startedAtTick
    body.push(
      `The death occurred ${String(months)} month${months === 1 ? '' : 's'} into a tour that began in ${formatDate(world, lastTour.startedAtTick)}. The cause is recorded as ${cause}.`,
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
    // The headline names the thing that happened, not the fact of a death:
    // "killed in a convoy ambush" is a story and "dies in service" is a
    // form. The detail is read, so it is only ever as specific as the
    // record actually is.
    headline:
      // The front is the where; the contact's own words are a sentence of
      // their own in the body, because the flavours the engine records are
      // a mix of clauses and noun phrases and splicing them into a headline
      // cannot be made to read right for both.
      killedByTheWar
        ? `${who} killed${where === '' ? ' in service' : where}`
        : `${who} dies at ${String(age)}`,
    dateline,
    // ORDER MATTERS: opener, then WHERE, then the wound. The high-grit
    // wound clauses carry their own tail ("gone before the medic got a hand
    // on it"), and putting the front after that stranded it mid-sentence.
    lede: `${opener
      .replace('{who}', who)
      .replace('{age}', String(age))
      .replace('{town}', world.town.name)
      .replace('{when}', formatDate(world, item.tick))}${where}${
      woundClause === null ? '' : `, ${woundClause.replace('{wound}', wound ?? 'wounds')}`
    }.`,
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
        // OWNER'S TONE OVERRIDE (§4): the paper stops sanitising, and a
        // shaken squadmate is allowed to sound like one. The graphic pool
        // is folded in beside the restrained lines rather than replacing
        // them, so the same seed still produces variety across a war.
        ...DEATH_QUOTES[gritFor('died-in-service')],
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
    // WHAT THE COURT ACTUALLY DID. C3 gave the bench seven answers between a
    // fine and a term, and this line still knew about two of them — it read
    // "imposed a fine" for a man put on probation. And a sentence reads in
    // years and months, not a count of months (owner).
    const disposition = conviction.disposition ?? (conviction.sentenceMonths > 0 ? 'jail' : 'fine')
    const did =
      disposition === 'probation'
        ? 'placed the defendant on probation'
        : disposition === 'suspended'
          ? 'imposed a suspended sentence'
          : disposition === 'split'
            ? `imposed ${sentenceInWords(conviction.sentenceMonths)} in custody with probation to follow`
            : disposition === 'service'
              ? 'imposed a fine and community service'
              : conviction.sentenceMonths > 0
                ? `imposed a sentence of ${sentenceInWords(conviction.sentenceMonths)}`
                : 'imposed a fine'
    body.push(
      `The court ${did}. The charge is graded ${offence === undefined ? 'under the criminal code' : GRADE_TITLES[offence.grade]}.`,
    )
  }
  body.push(
    priors > 0
      ? `Court records show ${String(priors)} prior conviction${priors === 1 ? '' : 's'} against the defendant.`
      : 'Court records show no prior convictions against the defendant.',
  )
  // THE GATE THIS CONVICTION ACTUALLY CARRIES (owner, reading the paper).
  // This line predated C3 and said every conviction gates for ten years,
  // which stopped being true when the gate was graded: a misdemeanor is
  // read for three, a felony for ten and counted for twenty-five, and a
  // violent felony is never not read. Printing the old rule was the paper
  // stating a law the county no longer has.
  if (offence !== undefined) {
    const violentFelony = offence.violent === true && isFelony(offence.grade)
    body.push(
      offence.grade === 'capital' || violentFelony
        ? 'A conviction of this kind is read by employers and the recruiting office for the rest of a life, and cannot be sealed.'
        : isFelony(offence.grade)
          ? 'A felony conviction bars hiring and enlistment for ten years, counts against an application for twenty-five, and never leaves the record.'
          : 'A misdemeanor conviction bars hiring and enlistment for three years and counts against an application for eight. It never leaves the record.',
    )
  }

  const grit = gritFor('courts')
  const opener = pickPhrase(CRIME_OPENERS[grit], world.seed, person.id * 53, item.tick)

  return {
    headline: `${fullName(person)} convicted of ${charge}`,
    dateline,
    lede: `${opener
      .replace('{who}', fullName(person))
      .replace('{age}', String(age))
      .replace('{town}', world.town.name)
      .replace('{charge}', charge)
      .replace('{when}', formatDate(world, item.tick))}.`,
    body: body.slice(0, 4),
    quote: null,
    closing:
      conviction !== undefined && conviction.sentenceMonths > 0
        ? `The sentence begins immediately and is due to end in ${formatDate(world, (item.tick + conviction.sentenceMonths) as Tick)}.`
        : 'The fine is payable to the county.',
  }
}

// ---------------------------------------------------------------------------
// A war
// ---------------------------------------------------------------------------

function warReport(world: World, item: NewsItem, dateline: string): NewsArticle | null {
  const home = homeland(world)
  // Both belligerents must be NAMED in the headline for this to be that
  // war's article. A nation the world no longer has cannot match — which
  // is why this is not `?? ''`: an empty needle matches every string, and
  // one missing nation would make every war look like this one.
  const war = activeWars(world).find((w) => {
    const a = world.nations.get(w.a)?.name
    const b = world.nations.get(w.b)?.name
    return a !== undefined && b !== undefined && item.text.includes(a) && item.text.includes(b)
  })
  if (war === undefined) return null
  const a = world.nations.get(war.a)
  const b = world.nations.get(war.b)
  if (!a || !b) return null

  const ourWar = home !== undefined && (war.a === home.id || war.b === home.id)
  const months = item.tick - war.sinceTick
  const years = Math.floor(months / 12)
  const dead = war.casualtiesA + war.casualtiesB
  const phase = war.warPhase ?? 'attrition'

  const grit = gritFor('war')
  const opener = pickPhrase(WAR_OPENERS[grit], world.seed, war.a * 71 + war.b, item.tick)
  const body: string[] = [
    `Fighting began in ${formatDate(world, war.sinceTick)}${years >= 1 ? `, ${String(years)} year${years === 1 ? '' : 's'} ago` : ''}. Military sources describe the current phase as ${phase}.`,
  ]
  if (dead > 0) {
    const toll = pickPhrase(CASUALTY_CLAUSES[grit], world.seed, war.a * 73 + war.b, item.tick)
    body.push(`${sentenceCase(toll.replace('{n}', String(dead)))}.`)
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
      : `${sentenceCase(a.name)} and ${b.name} remain at war`,
    dateline,
    // The pools carry the register; the facts stay exactly where they were.
    lede: `${opener
      .replace('{a}', ourWar ? sentenceCase(homelandName(world)) : a.name)
      .replace('{b}', ourWar ? (other?.name ?? 'a foreign power') : b.name)
      // The phase is the body's first sentence already; repeating it here
      // made every lede end in the same tacked-on clause, which is the
      // sameness these pools exist to kill.
      .replace('{when}', formatDate(world, item.tick))}.`,
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

