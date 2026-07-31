/**
 * The player domain: being one person inside the simulation.
 *
 * Design rule: THE PLAYER IS NOT SPECIAL. Their person keeps the same traits,
 * relationships, mortality and records as everyone else, and the world does
 * not revolve around them (charter §2). The only difference is who answers
 * their major decisions — the decision *points* are the same ones the
 * simulation already models, reached by the same rolls. Where an NPC's roll
 * succeeds and the engine decides, the player's roll succeeds and the engine
 * asks.
 *
 * Two consequences worth understanding:
 *
 *  - Opportunities are real. A job offer exists because the employment system
 *    generated one this month, not because a menu was due. Decline it and it
 *    is gone (Law 5: opportunities expire).
 *
 *  - Choices are inputs to the deterministic record. Every answer is appended
 *    to `world.player.log` with its tick; same seed + same answers replays the
 *    same life exactly.
 */

import type { EntityId } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { formatMoney, TICKS_PER_YEAR } from '@life-engine/shared'
import { occupationById } from './content.js'
import { withArticle } from './text.js'
import { householdCosts, householdIncome, inArrears } from './finances.js'
import { activeWars, homeland } from './geopolitics.js'
import { applyConvalescence } from './health.js'
import {
  discharge as dischargeService,
  enlistPerson,
  rankTitle,
  reenlist as reenlistService,
} from './service.js'
import {
  BRANCH_NAMES,
  meetsRequirement,
  SERVICE_TERM_MONTHS,
  servicePay,
  SPECIALTIES,
  specialtyById,
} from './content.js'
import { rentFor } from './content.js'
import { factor, recordDecision } from './records.js'
import { Stream } from './rng.js'
import {
  performSeparation,
  promoteToCourting,
  promoteToSpouse,
  reconcile,
  relationshipBetween,
} from './relationships.js'
import {
  birthEligible,
  deliverChild,
  enrolPlayer,
  hirePerson,
  moveHouse,
  performMoveOut,
  retirePerson,
} from './systems.js'
import type { PendingDecision, PendingKind, Sex, World } from './types.js'

/**
 * Begin playing a living person. Clears any stale pending decision.
 *
 * `asHeir` continues the LINE: the previous (dead) player joins the lineage,
 * so the save remembers every life this dynasty has lived. Picking a fresh
 * unrelated person starts a new story and the old line ends with its last
 * life un-appended — a deliberate asymmetry: lineage records successions,
 * not abandonments.
 */
export function setPlayer(world: World, personId: EntityId | null, asHeir = false): void {
  if (personId !== null) {
    const person = world.people.get(personId)
    if (!person) throw new Error(`No person ${personId} in this world`)
    if (person.deathTick !== null) throw new Error(`${person.givenName} is not alive`)
  }
  if (asHeir && world.player.personId !== null && personId !== null) {
    const previous = world.people.get(world.player.personId)
    if (previous && previous.deathTick !== null) {
      world.player.lineage.push(previous.id)
    }
  }
  world.player.personId = personId
  world.player.pending = null
}

export function playerPerson(world: World) {
  return world.player.personId === null ? undefined : world.people.get(world.player.personId)
}

export function playerIsAlive(world: World): boolean {
  return playerPerson(world)?.deathTick === null
}

/** Living children of the player, oldest first — the heir candidates (Law 8). */
export function heirsOf(world: World, personId: EntityId): EntityId[] {
  const heirs: EntityId[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (person.parentIds.includes(personId)) heirs.push(person.id)
  }
  heirs.sort((a, b) => {
    const pa = world.people.get(a)
    const pb = world.people.get(b)
    return (pa?.birthTick ?? 0) - (pb?.birthTick ?? 0) || a - b
  })
  return heirs
}

// ---------------------------------------------------------------------------
// Custom lives (M-GAMEDEPTH)
// ---------------------------------------------------------------------------

/**
 * A brand-new person the player asks to be born as. Null fields mean "let the
 * world decide" — the engine draws them from its own streams exactly as an
 * automatic birth would.
 */
export interface CustomLifeSpec {
  readonly givenName: string | null
  readonly familyName: string | null
  readonly sex: Sex | null
  readonly motherId: EntityId
}

/**
 * Women who could be handed a newborn this month — the same eligibility the
 * automatic birth roll uses, as a query for the character-creation screen.
 * Sorted by id for determinism.
 */
export function motherCandidates(world: World): EntityId[] {
  const candidates: EntityId[] = []
  for (const person of world.people.values()) {
    if (birthEligible(world, world.tick, person) !== null) candidates.push(person.id)
  }
  candidates.sort((a, b) => a - b)
  return candidates
}

/**
 * Bring a custom life into the world: a newborn of an existing eligible
 * couple, then begin playing it from age 0.
 *
 * DETERMINISM: the spec is a PLAYER INPUT. It is appended to player.log as a
 * 'custom-birth' entry (never a live pending question), so seed + log still
 * replays the world byte for byte. Name and sex come from the spec where
 * given; traits always come from the child's own id stream — who the child
 * turns out to be is still the world's answer.
 *
 * Returns the child's id, or null if the couple cannot have a child (the
 * same test the automatic path applies — no household the simulation would
 * refuse gets one by menu).
 */
export function createCustomLife(world: World, spec: CustomLifeSpec): EntityId | null {
  const mother = world.people.get(spec.motherId)
  if (!mother) return null
  const partnerId = birthEligible(world, world.tick, mother)
  if (partnerId === null) return null

  // Player-typed text: trimmed, pipes stripped (the log separator), empty
  // treated as "let the world decide".
  const cleanName = spec.givenName?.trim().replace(/\|/g, '') ?? ''
  const cleanFamily = spec.familyName?.trim().replace(/\|/g, '') ?? ''

  const childId = deliverChild(world, world.tick, spec.motherId, partnerId, {
    ...(cleanName.length > 0 ? { givenName: cleanName } : {}),
    ...(cleanFamily.length > 0 ? { familyName: cleanFamily } : {}),
    ...(spec.sex !== null ? { sex: spec.sex } : {}),
  })
  if (childId === null) return null

  world.player.log.push({
    decisionId: world.player.nextDecisionId,
    tick: world.tick,
    kind: 'custom-birth',
    choice: `${cleanName}|${cleanFamily}|${spec.sex ?? ''}|${String(spec.motherId)}`,
  })
  world.player.nextDecisionId += 1

  setPlayer(world, childId)
  return childId
}

/** Called by systems at a player choice point. Halts the clock. */
export function raisePending(
  world: World,
  spec: Omit<PendingDecision, 'id'>,
): void {
  if (world.player.pending !== null) return // one question at a time
  world.player.pending = { ...spec, id: world.player.nextDecisionId }
  world.player.nextDecisionId += 1
}

/** True while the world is halted awaiting the player. */
export function awaitingPlayer(world: World): boolean {
  return world.player.pending !== null
}

/**
 * Answer the pending decision. Applies the effect through the same code the
 * automatic path uses, records the choice in the log, and releases the clock.
 *
 * Every applied effect writes a causal record whose first factor is
 * 'own-choice' — so a life story honestly distinguishes "chose to" from
 * "the circumstances decided" (Law 3).
 */
export function resolvePending(world: World, choice: string): void {
  const pending = world.player.pending
  if (!pending) throw new Error('No decision is pending')
  if (!pending.options.includes(choice)) {
    throw new Error(`"${choice}" is not one of: ${pending.options.join(', ')}`)
  }

  const person = world.people.get(pending.personId)
  if (!person || person.deathTick !== null) {
    // The person died in the same tick the question was raised. The question
    // is moot; log the answer so replay stays exact, and move on.
    commit(world, pending, choice)
    return
  }

  switch (pending.kind) {
    case 'education': {
      if (choice === 'college' || choice === 'trade') {
        enrolPlayer(world, pending.tick, person, choice)
        recordDecision(world, pending.tick, {
          subjectId: person.id,
          decision: 'employment-change',
          significance: 'major',
          inputs: [factor('own-choice', 1000), factor('reached-adulthood', 400)],
          chosen: choice === 'college' ? 'went to college' : 'entered trade school',
          rejected: choice === 'college' ? ['trade school', 'going straight to work'] : ['college', 'going straight to work'],
          streamId: Stream.Education,
        })
      }
      // 'work' needs no action — the employment system will offer jobs.
      // 'enlist' is applied by the follow-up specialty question below.
      break
    }

    case 'job-offer': {
      if (choice === 'accept' && pending.occupationId && pending.workplaceId !== null && pending.monthlyPay !== null) {
        const occupation = occupationById(pending.occupationId)
        hirePerson(world, pending.tick, person, occupation, pending.workplaceId, pending.monthlyPay, [
          factor('own-choice', 1000),
          factor('higher-pay', Math.floor(pending.monthlyPay / 1000)),
        ])
      }
      break
    }

    case 'move-out': {
      if (choice === 'accept' && pending.placeId !== null) {
        performMoveOut(world, pending.tick, person, pending.placeId, [factor('own-choice', 1000)])
      }
      break
    }

    case 'courtship': {
      if (choice === 'accept' && pending.otherId !== null) {
        const tie = relationshipBetween(world, person.id, pending.otherId)
        if (tie && tie.type === 'friend') {
          promoteToCourting(world, pending.tick, tie, [factor('own-choice', 1000)])
        }
      }
      break
    }

    case 'marriage': {
      if (choice === 'accept' && pending.otherId !== null) {
        const tie = relationshipBetween(world, person.id, pending.otherId)
        if (tie && tie.type === 'courting') {
          promoteToSpouse(world, pending.tick, tie, [factor('own-choice', 1000)])
        }
      }
      break
    }

    case 'child': {
      if (choice === 'accept' && pending.otherId !== null) {
        // deliverChild expects the mother first; the player may be either parent.
        const other = world.people.get(pending.otherId)
        if (other) {
          const motherId = person.sex === 'female' ? person.id : pending.otherId
          const fatherId = person.sex === 'female' ? pending.otherId : person.id
          void other
          deliverChild(world, pending.tick, motherId, fatherId)
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'household-formation',
            significance: 'defining',
            inputs: [factor('own-choice', 1000), factor('wanted-family', 800)],
            chosen: 'grew the family',
            rejected: ['not yet'],
            streamId: Stream.LifeEventTiming,
          })
        }
      }
      break
    }

    case 'move-house': {
      if (choice === 'accept' && pending.placeId !== null) {
        moveHouse(world, pending.tick, person, pending.placeId, [factor('own-choice', 1000)])
      }
      break
    }

    case 'retirement': {
      if (choice === 'retire') {
        retirePerson(world, pending.tick, person, [
          factor('own-choice', 1000),
          factor('old-age', 500),
        ])
      }
      // 'keep-working' needs no action; the question returns next birthday.
      break
    }

    case 'separation': {
      const tie =
        pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie && tie.type === 'spouse') {
        if (choice === 'separate') {
          performSeparation(world, pending.tick, tie, [factor('own-choice', 1000)])
        } else {
          reconcile(world, pending.tick, tie)
        }
      }
      break
    }

    case 'convalesce': {
      applyConvalescence(world, pending.tick, person.id, choice === 'rest')
      recordDecision(world, pending.tick, {
        subjectId: person.id,
        decision: 'convalescence',
        significance: 'notable',
        inputs: [
          factor('own-choice', 1000),
          factor('frailty', world.health.get(person.id)?.severity ?? 500),
        ],
        chosen: choice === 'rest' ? 'took time to heal' : 'worked through it',
        rejected: [choice === 'rest' ? 'to push on' : 'to rest'],
        streamId: Stream.Health,
      })
      break
    }

    case 'enlist': {
      // Accepting the door does not put on the uniform yet: the SPECIALTY
      // choice follows, raised after this one commits (see below).
      break
    }

    case 'specialty': {
      const specialty = SPECIALTIES.find((sp) => sp.id === choice)
      if (specialty) {
        enlistPerson(world, pending.tick, person, specialty, [factor('own-choice', 1000)])
      }
      break
    }

    case 'custom-birth': {
      // Never a live question: createCustomLife writes the log entry itself.
      // Reaching here means a corrupted pending — refuse loudly.
      throw new Error('custom-birth is a log entry, not a live decision')
    }

    case 'reenlist': {
      const record = world.service.get(person.id)
      if (record && record.dischargedAtTick === null) {
        if (choice === 'stay') {
          reenlistService(world, pending.tick, person)
          recordDecision(world, pending.tick, {
            subjectId: person.id,
            decision: 'enlistment',
            significance: 'major',
            inputs: [factor('own-choice', 1000), factor('steady-pay', Math.floor(record.monthlyPay / 1000))],
            chosen: 'signed for another term',
            rejected: ['to leave the service'],
            streamId: Stream.Employment,
          })
        } else {
          dischargeService(world, pending.tick, person, record, 'end of term', [
            factor('own-choice', 1000),
            factor('term-ended', 600),
          ])
        }
      }
      break
    }

    default: {
      const never: never = pending.kind
      throw new Error(`Unhandled decision kind ${String(never)}`)
    }
  }

  commit(world, pending, choice)

  // Follow-up questions: an accepted enlistment immediately asks WHICH
  // uniform. Raised after commit so the pending slot is free again.
  if (pending.kind === 'enlist' && choice === 'accept') {
    askSpecialty(world, pending.tick, person.id)
  }
  if (pending.kind === 'education' && choice === 'enlist') {
    askSpecialty(world, pending.tick, person.id)
  }
}

/** The specialty menu: every branch role this person's schooling admits. */
function askSpecialty(world: World, tick: PendingDecision['tick'], personId: EntityId): void {
  const person = world.people.get(personId)
  if (!person) return
  const education = world.education.get(personId)
  const level = education?.level ?? 'none'
  const options = SPECIALTIES.filter((sp) => meetsRequirement(level, sp.requires)).map((sp) => sp.id)
  if (options.length === 0) return
  raisePending(world, {
    tick,
    kind: 'specialty',
    personId,
    otherId: null,
    occupationId: null,
    workplaceId: null,
    monthlyPay: null,
    placeId: null,
    options,
  })
}

function commit(world: World, pending: PendingDecision, choice: string): void {
  world.player.log.push({
    decisionId: pending.id,
    tick: pending.tick,
    kind: pending.kind,
    choice,
  })
  world.player.pending = null
}

/** Has the player already answered a decision of this kind? */
export function hasAnswered(world: World, kind: PendingKind): boolean {
  return world.player.log.some((entry) => entry.kind === kind)
}

/**
 * Human-readable prompt for a pending decision. Lives in the engine so the
 * text comes from the same facts as the records — the UI renders, it does not
 * author.
 */
export function describePending(world: World, pending: PendingDecision): string {
  const person = world.people.get(pending.personId)
  const other = pending.otherId === null ? null : world.people.get(pending.otherId)
  const age = person ? ageAt(person.birthTick, pending.tick) : 0

  switch (pending.kind) {
    case 'education':
      return `You are ${age} and finished with secondary school. What next?`
    case 'job-offer': {
      const role = pending.occupationId
        ? withArticle(occupationById(pending.occupationId).title)
        : 'a job'
      const where = pending.workplaceId === null ? '' : ` at ${world.places.get(pending.workplaceId)?.name ?? 'a workplace'}`
      return `There is an opening for ${role}${where}. Take it?`
    }
    case 'move-out': {
      const where = pending.placeId === null ? 'town' : (world.places.get(pending.placeId)?.name ?? 'town')
      return `You could afford a place of your own in ${where}. Move out?`
    }
    case 'courtship':
      return `You and ${other ? `${other.givenName} ${other.familyName}` : 'someone'} have grown close. See where it goes?`
    case 'marriage':
      return `Marry ${other ? `${other.givenName} ${other.familyName}` : 'your partner'}?`
    case 'child':
      return `You and ${other ? other.givenName : 'your partner'} could grow the family. Have a child?`
    case 'move-house': {
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const household = person?.householdId == null ? undefined : world.households.get(person.householdId)
      const current = household ? world.places.get(household.placeId) : undefined
      const where = target?.name ?? 'a better street'
      // The same decision kind serves moving up and moving down; which one
      // this is shows in the words, and the stakes carry the numbers.
      if (target && current && target.desirability < current.desirability) {
        return `Money is short. Move to ${where}, where the rent is cheaper?`
      }
      return `A place in ${where} is within reach. Move the household?`
    }
    case 'retirement':
      return `You are ${age}. Retire, or keep working?`
    case 'separation':
      return `Things with ${other ? other.givenName : 'your spouse'} have grown distant. What do you do?`
    case 'convalesce': {
      const record = world.health.get(pending.personId)
      const what = record?.ailment === 'injury' ? 'The injury is serious' : 'The illness is serious'
      return `${what}. How do you carry it?`
    }
    case 'enlist':
      return 'A recruiter for the Republic has your name. Enlist?'
    case 'specialty':
      return 'Which uniform? Your schooling opens these doors.'
    case 'custom-birth':
      return 'A new life begins.' // log-only; never shown as a question
    case 'reenlist': {
      const record = world.service.get(pending.personId)
      const title = record ? rankTitle(record.branch, record.rank) : 'soldier'
      return `Your term is up, ${title}. Sign for another four years?`
    }
    default: {
      const never: never = pending.kind
      return String(never)
    }
  }
}

/**
 * The STAKES of a pending decision: short factual lines the player should see
 * before answering. Everything here is read from world state — the same facts
 * the records will cite — never invented for drama. An empty array is honest
 * when there is nothing more to say.
 */
export function describeStakes(world: World, pending: PendingDecision): string[] {
  const person = world.people.get(pending.personId)
  if (!person) return []
  const other = pending.otherId === null ? undefined : world.people.get(pending.otherId)
  const lines: string[] = []

  switch (pending.kind) {
    case 'education': {
      lines.push('College opens the best-paid work: teaching, engineering, accountancy.')
      lines.push('Trade school is two years, not four, and leads to solid skilled work.')
      lines.push('Working now means wages immediately, and the education question is closed.')
      break
    }
    case 'job-offer': {
      if (pending.monthlyPay !== null) {
        const current = world.employment.get(person.id)
        if (current) {
          const diff = pending.monthlyPay - current.monthlyPay
          lines.push(`You earn ${formatMoney(current.monthlyPay)} a month now; this pays ${formatMoney(pending.monthlyPay)}.`)
          if (diff < 0) lines.push('That is a pay cut.')
        } else {
          lines.push(`It pays ${formatMoney(pending.monthlyPay)} a month. You have no wages today.`)
        }
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const shortfall = householdCosts(world, household) - householdIncome(world, household)
        if (household.savings < 0) {
          lines.push(`The household is ${formatMoney(-household.savings as never)} behind.`)
        } else if (shortfall > 0) {
          lines.push(`The household runs ${formatMoney(shortfall as never)} short each month right now.`)
        }
      }
      break
    }
    case 'move-out': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const others = household.memberIds.filter((id) => id !== person.id).length
        lines.push(`You live with ${others} ${others === 1 ? 'person' : 'people'} now.`)
      }
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const job = world.employment.get(person.id)
      if (target && job) {
        lines.push(`Rent in ${target.name} is ${formatMoney(rentFor(target.desirability))} a month against your ${formatMoney(job.monthlyPay)}.`)
      }
      break
    }
    case 'courtship': {
      if (other) {
        const otherAge = ageAt(other.birthTick, pending.tick)
        const job = world.employment.get(other.id)
        lines.push(`${other.givenName} is ${otherAge}${job ? ' and working' : ''}.`)
        lines.push('Courting closes the door on other courtships while it lasts.')
      }
      break
    }
    case 'marriage': {
      const tie = pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie) {
        const years = Math.floor((pending.tick - tie.typeSinceTick) / TICKS_PER_YEAR)
        lines.push(years >= 1 ? `You have been courting ${String(years)} year${years === 1 ? '' : 's'}.` : 'The courtship is young.')
      }
      break
    }
    case 'child': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        const children = household.memberIds.filter((id) =>
          world.people.get(id)?.parentIds.includes(person.id),
        ).length
        lines.push(children === 0 ? 'It would be your first.' : `You have ${children} at home already.`)
        if (inArrears(world, household.id)) {
          lines.push('The household is already behind on money.')
        }
      }
      break
    }
    case 'move-house': {
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      const target = pending.placeId === null ? undefined : world.places.get(pending.placeId)
      const current = household ? world.places.get(household.placeId) : undefined
      if (current && target && household) {
        const rentNow = rentFor(current.desirability)
        const rentThen = rentFor(target.desirability)
        if (target.desirability > current.desirability) {
          lines.push(`${target.name} is a better street than ${current.name}.`)
          lines.push(`Rent rises from ${formatMoney(rentNow)} to ${formatMoney(rentThen)} a month.`)
        } else {
          lines.push(`Rent falls from ${formatMoney(rentNow)} to ${formatMoney(rentThen)} a month.`)
          if (household.savings < 0) {
            lines.push(`The household is ${formatMoney(-household.savings as never)} behind; staying digs deeper.`)
          }
        }
        if (household.memberIds.length > 1) {
          lines.push(`The whole household of ${household.memberIds.length} moves with you.`)
        }
      }
      break
    }
    case 'retirement': {
      const job = world.employment.get(person.id)
      if (job) {
        lines.push(`Retiring ends your ${formatMoney(job.monthlyPay)} a month.`)
        const started = job.startedAtTick
        const years = Math.floor((pending.tick - started) / TICKS_PER_YEAR)
        if (years >= 1) lines.push(`You have held this job ${String(years)} year${years === 1 ? '' : 's'}.`)
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household) {
        lines.push(
          household.savings > 0
            ? `The household has ${formatMoney(household.savings)} put by.`
            : 'There is nothing put by.',
        )
        // The number that actually decides this: how long the money lasts.
        const annualBasics = householdCosts(world, household) * 12
        if (household.savings > 0 && annualBasics > 0) {
          const years = Math.floor(household.savings / annualBasics)
          lines.push(
            years >= 1
              ? `At today's costs that carries the household about ${String(years)} year${years === 1 ? '' : 's'}.`
              : 'At today\'s costs that is less than a year.',
          )
        }
      }
      lines.push('You can keep working as long as you live; the question returns each birthday.')
      break
    }
    case 'separation': {
      const tie = pending.otherId === null ? undefined : relationshipBetween(world, person.id, pending.otherId)
      if (tie) {
        const years = Math.floor((pending.tick - tie.formedAtTick) / TICKS_PER_YEAR)
        if (years >= 1) lines.push(`You have been together ${String(years)} years.`)
      }
      const household = person.householdId === null ? undefined : world.households.get(person.householdId)
      if (household && other) {
        const children = household.memberIds.filter((id) => {
          const member = world.people.get(id)
          return member ? member.parentIds.includes(person.id) && member.parentIds.includes(other.id) : false
        }).length
        if (children > 0) lines.push(`${children} ${children === 1 ? 'child lives' : 'children live'} at home. One of you moves out; they stay.`)
      }
      lines.push('Staying is a real attempt — it restores some closeness, but the strains remain.')
      break
    }
    case 'enlist': {
      lines.push(`A term is ${String(SERVICE_TERM_MONTHS / 12)} years. Pay starts around ${formatMoney(servicePay('land-forces', 0))} a month, and rises with rank.`)
      lines.push('Service ends any civilian job; a specialty can open doors when you come home.')
      const wars = activeWars(world)
      const home = homeland(world)
      if (home && wars.some((w) => w.a === home.id || w.b === home.id)) {
        lines.push('The Republic is at war. Service now will not be quiet.')
      } else if (wars.length > 0) {
        lines.push(`There is war abroad — ${String(wars.length)} conflict${wars.length === 1 ? '' : 's'} in the news. The Republic is not in them today.`)
      }
      break
    }

    case 'specialty': {
      for (const id of pending.options) {
        const sp = SPECIALTIES.find((x) => x.id === id)
        if (!sp) continue
        const risky = sp.exposure.directCombat >= 500 || sp.exposure.convoy >= 500
        lines.push(`${sp.title} (${BRANCH_NAMES[sp.branch]}): ${String(sp.schoolMonths)} months' school after basic${risky ? ' — the sharp end, if it ever comes to that' : ''}${sp.civilianUnlocks.length > 0 ? ' — a trade you keep' : ''}.`)
      }
      break
    }

    case 'reenlist': {
      const record = world.service.get(pending.personId)
      if (record) {
        const years = Math.floor((pending.tick - record.enlistedAtTick) / TICKS_PER_YEAR)
        lines.push(`${String(years)} year${years === 1 ? '' : 's'} served; ${rankTitle(record.branch, record.rank)}, ${formatMoney(record.monthlyPay)} a month.`)
        lines.push(`Leaving keeps the record${specialtyById(record.specialtyId).civilianUnlocks.length > 0 ? ' and the trade' : ''}; staying is four more years.`)
      }
      break
    }

    case 'convalesce': {
      const record = world.health.get(pending.personId)
      if (record) {
        lines.push('Resting heals faster but the work will slip.')
        lines.push('Pushing on keeps the job sharp and the body slow to mend — and mending badly can leave a lasting mark.')
        const job = world.employment.get(person.id)
        if (job) lines.push(`You are working as ${withArticle(occupationById(job.occupationId).title)}.`)
      }
      break
    }

    default:
      break
  }
  return lines
}
