/**
 * Household finances. M-MONEY.
 *
 * One pot per roof. Every month: wages in, rent and living costs out. The
 * balance is the household's savings, and it is allowed to go negative —
 * arrears is a modelled state with consequences, not an error.
 *
 * OWNERSHIP (DOMAIN_MAP §2): this system is the only writer of
 * `household.savings`. Everything else — stakes text, relationship strain,
 * affordability gates — reads it.
 *
 * What money DOES here, so the stakes in every other decision bite:
 *
 *   - A household that cannot cover the month falls behind (event), and
 *     sustained arrears pushes a move somewhere cheaper — asked, if the
 *     player lives there; automatic otherwise.
 *   - Arrears strains a marriage (relationships reads `inArrears`).
 *   - Moving out and moving up are gated on genuinely affording the rent.
 *   - When the last member of a household dies, what is left passes to the
 *     deceased's living children — the first piece of generational legacy.
 *
 * All arithmetic is integer cents (ADR-0008). No floating point anywhere.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { LIVING_COST_ADULT, LIVING_COST_CHILD, rentFor } from './content.js'
import { ageAt } from './clock.js'
import { raisePending } from './player.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { openStream, Stream } from './rng.js'
import type { Household, Person, World } from './types.js'
import { pensionOf, servicePayOf } from './service.js'
import { placesOfKind } from './worldgen.js'

/** Months of arrears before a household is pushed toward cheaper rent. */
const ARREARS_PATIENCE_MONTHS = 4

/** An adult is a full mouth to feed from this age. */
const ADULT_COST_AGE = 16

// ---------------------------------------------------------------------------
// Queries — the read side other systems and the UI use
// ---------------------------------------------------------------------------

export function householdIncome(world: World, household: Household): Money {
  let total = 0
  for (const memberId of household.memberIds) {
    const job = world.employment.get(memberId)
    if (job) total += job.monthlyPay
    // Service pay reaches the same kitchen table (L4-M3), and so does the
    // disability pension a veteran's service left them owed (L4-M5).
    total += servicePayOf(world, memberId)
    total += pensionOf(world, memberId)
  }
  return total as Money
}

/**
 * Move money between two households (C1). Finances is the ONLY writer of
 * household.savings, so crime asks rather than reaching in. Clamped to what
 * the source actually holds above zero; returns the cents that moved.
 */
export function transferBetweenHouseholds(
  world: World,
  tick: Tick,
  fromHouseholdId: EntityId,
  toHouseholdId: EntityId,
  cents: number,
): number {
  if (fromHouseholdId === toHouseholdId) return 0
  const from = world.households.get(fromHouseholdId)
  const to = world.households.get(toHouseholdId)
  if (!from || !to || cents <= 0) return 0
  const moved = Math.min(cents, Math.max(0, from.savings))
  if (moved <= 0) return 0
  world.households.set(from.id, { ...from, savings: (from.savings - moved) as Money })
  world.households.set(to.id, { ...to, savings: (to.savings + moved) as Money })
  noteArrearsCrossing(world, tick, from.id, from.savings)
  noteArrearsCrossing(world, tick, to.id, to.savings)
  return moved
}

/**
 * Charge a household (a court's fine). May push it into arrears — that is
 * the honest cost of a fine a family cannot afford, and the arrears
 * machinery already knows what to do with it.
 */
export function chargeHousehold(world: World, tick: Tick, householdId: EntityId, cents: number): void {
  const household = world.households.get(householdId)
  if (!household || cents <= 0) return
  world.households.set(household.id, { ...household, savings: (household.savings - cents) as Money })
  noteArrearsCrossing(world, tick, household.id, household.savings)
}

/**
 * The fell-behind / back-in-the-black crossing is an invariant of the FIELD,
 * not of runFinances: any writer that moves savings across zero owes the
 * event, or the story shows a fall with no recovery (or the reverse). Every
 * writer in this module calls it with the balance it started from. (The
 * separation split in relationships.ts predates this helper and does not —
 * a known corner, not a rule.)
 */
function noteArrearsCrossing(world: World, tick: Tick, householdId: EntityId, before: Money): void {
  const household = world.households.get(householdId)
  if (!household) return
  const after = household.savings
  if (before >= 0 === after >= 0) return
  const head = eldestMember(world, household)
  if (!head) return
  recordEvent(world, tick, {
    type: after < 0 ? 'fell-behind' : 'back-in-the-black',
    subjectId: head.id,
  })
}

export function householdCosts(world: World, household: Household): Money {
  const place = world.places.get(household.placeId)
  let total = place ? rentFor(place.desirability) : 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    // Jail is absence (C1): the county feeds them, not the kitchen table.
    // Read inline rather than importing crime (finances must not gain a
    // cycle with a module that calls its transfer helper).
    const criminal = world.criminal.get(memberId)
    if (criminal !== undefined && criminal.jailedUntilTick !== null && world.tick < criminal.jailedUntilTick) {
      continue
    }
    total += ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE ? LIVING_COST_ADULT : LIVING_COST_CHILD
  }
  return total as Money
}

/**
 * Discretionary spending: the life between rent and the bank.
 *
 * M-GAME's stat chip exposed what the ledger had been doing quietly: with
 * only rent and living costs modelled, a working couple banked ~80% of its
 * income and a six-year-old's family held $414,605 by 1977. Correct
 * arithmetic, absurd life. People spend most of what clears the basics —
 * on the car, the kitchen, the holidays this simulation does not itemize —
 * and save the rest.
 *
 * The rate is a household trait, not a constant: thriftier households (by
 * average adult diligence) keep more. Range: spend 83.7%–92% of surplus,
 * i.e. save 8–16%. Deterministic, integer arithmetic, no draw — spending
 * habits are character, not luck.
 *
 * A household in arrears spends NOTHING discretionary: families tighten
 * belts, which is also what makes digging out of debt possible at all.
 */
export function discretionaryFor(world: World, household: Household): Money {
  if (household.savings < 0) return 0 as Money

  const income = householdIncome(world, household)
  const basics = householdCosts(world, household)
  const surplus = income - basics
  if (surplus <= 0) return 0 as Money

  let diligenceTotal = 0
  let adults = 0
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    if (ageAt(member.birthTick, world.tick) >= ADULT_COST_AGE) {
      diligenceTotal += member.traits.diligence
      adults++
    }
  }
  const avgDiligence = adults > 0 ? Math.floor(diligenceTotal / adults) : 500
  const spendPerMille = 920 - Math.floor(avgDiligence / 12) // 920 down to 837

  return Math.floor((surplus * spendPerMille) / 1000) as Money
}

/** This month's true change in savings, mirroring runFinances exactly. */
export function monthlyNetOf(world: World, household: Household): Money {
  return (householdIncome(world, household) -
    householdCosts(world, household) -
    discretionaryFor(world, household)) as Money
}

export function inArrears(world: World, householdId: EntityId | null): boolean {
  if (householdId === null) return false
  const household = world.households.get(householdId)
  return household !== undefined && household.savings < 0
}

/**
 * Can this income carry this rent with a margin left to live on? The margin
 * is one adult's living costs — an affordability rule of thumb, not a law of
 * nature, and deliberately a little forgiving.
 */
export function canAfford(income: Money, desirability: number): boolean {
  return income >= rentFor(desirability) + LIVING_COST_ADULT
}

// ---------------------------------------------------------------------------
// The monthly tick
// ---------------------------------------------------------------------------

export function runFinances(world: World, tick: Tick): void {
  // Ascending id order, as everywhere: processing order must be reproducible.
  const households = [...world.households.values()].sort((a, b) => a.id - b.id)

  for (const household of households) {
    if (household.dissolvedTick !== null) continue
    if (household.memberIds.length === 0) continue

    const before = household.savings
    const after = (before + monthlyNetOf(world, household)) as Money

    world.households.set(household.id, { ...household, savings: after })

    // The month it tips over is worth an event; every month it stays down is
    // not. Same on the way back up. Events mark changes, not states.
    noteArrearsCrossing(world, tick, household.id, before)
  }

  pushArrearsHouseholdsToCheaperRent(world, tick)
}

function eldestMember(world: World, household: Household): Person | undefined {
  let eldest: Person | undefined
  for (const memberId of household.memberIds) {
    const member = world.people.get(memberId)
    if (!member || member.deathTick !== null) continue
    if (!eldest || member.birthTick < eldest.birthTick || (member.birthTick === eldest.birthTick && member.id < eldest.id)) {
      eldest = member
    }
  }
  return eldest
}

/**
 * A household deep in arrears moves somewhere cheaper — the classic hard
 * month, made mechanical. "Deep" means the hole exceeds PATIENCE months of
 * the shortfall, so one bad month never uproots a family.
 *
 * If the player lives there, they are asked (the same move-house question,
 * pointed downhill — describePending words it from the stakes). Declining is
 * allowed; the arrears, and this question, will keep coming.
 */
function pushArrearsHouseholdsToCheaperRent(world: World, tick: Tick): void {
  const neighbourhoods = placesOfKind(world, 'neighbourhood')
  if (neighbourhoods.length === 0) return

  const households = [...world.households.values()].sort((a, b) => a.id - b.id)
  for (const household of households) {
    if (household.dissolvedTick !== null || household.savings >= 0) continue

    const income = householdIncome(world, household)
    const costs = householdCosts(world, household)
    const monthlyShortfall = costs - income
    if (monthlyShortfall <= 0) continue // income now covers the month; digging out
    if (-household.savings < monthlyShortfall * ARREARS_PATIENCE_MONTHS) continue

    const current = world.places.get(household.placeId)
    if (!current) continue
    const cheaper = neighbourhoods
      .filter((p) => p.desirability < current.desirability - 60)
      .sort((a, b) => a.desirability - b.desirability)
    const target = cheaper[0]
    if (!target) continue // already at the bottom of town; nothing to sell but time

    const head = eldestMember(world, household)
    if (!head) continue

    const playerId = world.player.personId
    if (playerId !== null && household.memberIds.includes(playerId)) {
      raisePending(world, {
        tick,
        kind: 'move-house',
        personId: playerId,
        otherId: null,
        occupationId: null,
        workplaceId: null,
        monthlyPay: null,
        placeId: target.id,
        options: ['accept', 'decline'],
      })
      continue
    }

    world.households.set(household.id, { ...household, placeId: target.id })
    recordEvent(world, tick, { type: 'moved-house', subjectId: head.id, placeId: target.id })
    recordDecision(world, tick, {
      subjectId: head.id,
      decision: 'move',
      significance: 'major',
      inputs: [
        factor('in-arrears', Math.min(1000, Math.floor(-household.savings / 1000))),
        factor('cheaper-rent', current.desirability - target.desirability),
      ],
      chosen: `moved to ${target.name} to make ends meet`,
      rejected: [`to stay in ${current.name}`],
      streamId: Stream.Economy,
    })
  }
}

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

/**
 * Called by mortality when a death empties a household. Whatever the pot held
 * passes to the deceased's living children, split equally, eldest taking the
 * remainder cent. Debts die with the household: a negative estate passes
 * nothing rather than billing the children — grief is not a ledger.
 *
 * This is the first piece of generational legacy: a family that saved leaves
 * its children genuinely better off, and the record says where it came from.
 */
export function distributeEstate(world: World, tick: Tick, deceased: Person, household: Household): void {
  if (household.savings <= 0) return

  const heirs: Person[] = []
  for (const person of world.people.values()) {
    if (person.deathTick !== null) continue
    if (person.parentIds.includes(deceased.id)) heirs.push(person)
  }
  if (heirs.length === 0) return
  heirs.sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

  const share = Math.floor(household.savings / heirs.length)
  let remainder = household.savings - share * heirs.length

  for (const heir of heirs) {
    const amount = (share + remainder) as Money
    remainder = 0
    if (amount <= 0) continue
    if (heir.householdId === null) continue
    const heirHousehold = world.households.get(heir.householdId)
    if (!heirHousehold) continue

    world.households.set(heirHousehold.id, {
      ...heirHousehold,
      savings: (heirHousehold.savings + amount) as Money,
    })
    // An inheritance that lifts a household out of arrears is the recovery
    // the timeline owes a reader (the crossing invariant above).
    noteArrearsCrossing(world, tick, heirHousehold.id, heirHousehold.savings)
    recordEvent(world, tick, {
      type: 'inherited',
      subjectId: heir.id,
      otherId: deceased.id,
      detail: String(amount),
    })
  }

  // The estate has been passed on; the emptied household keeps nothing.
  world.households.set(household.id, { ...household, savings: 0 as Money })
}

/** Deterministic starting savings for a founding household: some months of
 *  wages, varied by the worldgen stream so households start unequal (Law 10). */
export function foundingSavings(world: World, household: Household): Money {
  const income = householdIncome(world, household)
  const rng = openStream(world.seed, Stream.Economy, household.id, 0)
  const months = rng.nextIntInclusive(1, 9)
  const base = income > 0 ? income * months : rng.nextIntInclusive(20_000, 220_000)
  return base as Money
}
