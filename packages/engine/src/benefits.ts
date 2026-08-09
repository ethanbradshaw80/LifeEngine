/**
 * COVERAGE AND BENEFITS — the BA and civilian health insurance.
 *
 * From the owner's `benefits_insurance_master.md`. Two parallel systems that
 * pay for care and provide disability income: a veteran track (the BA —
 * Benefits Administration) and a civilian one, because civilians get hurt
 * and sick too.
 *
 * THE BUG THIS OPENS WITH. `health.ts` has recorded a `granted-pension`
 * event since L4-M5 — the board recognizes a service-connected disability,
 * writes the causal record, prints the monthly figure into the detail — and
 * NOTHING HAS EVER PAID IT. No money moved. A man came home without a leg,
 * was medically discharged, was granted a pension by the simulation, and
 * drew nothing from it for the rest of his life. That is the seventh time in
 * this project a working rule has sat behind a verb that was never wired,
 * and it is the reason a disabling wound read as pure loss.
 *
 * OWNERSHIP (spec §6). This module owns COVERAGE — the source, the plan
 * shape, the disability rating. `finances.ts` owns every cent: it asks this
 * module what is owed and what is covered, and does the moving itself.
 * Nothing here writes an account.
 *
 * DERIVED, NOT STORED. Coverage source, plan parameters and the rating are
 * all computed from state that already exists — the job, the age, the
 * income, the service record, the health record. A stored copy would be a
 * second truth that drifts the first time somebody changes jobs, and this
 * project has paid for that mistake four times over with the cost
 * functions. The only thing that would need storing is year-to-date
 * spending, and v1 is honest about not tracking it (see `outOfPocketFor`).
 *
 * FICTIONAL BY CHARTER (spec §7). The BA, PublicCare and SeniorCare are
 * invented agencies that behave recognizably. No real programme is named.
 */

import type { EntityId, Money, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { PENSION_CENTS_PER_POINT, PENSION_THRESHOLD } from './content.js'
import { atTodaysPrices } from './economy.js'
import type { World } from './types.js'

/** Where somebody's care is paid from. */
export type CoverageSource =
  | 'ba'
  | 'employer'
  | 'seniorcare'
  | 'publiccare'
  | 'uninsured'

/** The shape of a plan, in per-mille and integer cents. */
export interface Coverage {
  readonly source: CoverageSource
  /** What the carrier is called, for a screen. */
  readonly carrier: string
  /** Paid every month, integer cents at today's prices. */
  readonly premium: Money
  /** Paid in full by the patient before the plan starts sharing. */
  readonly deductible: Money
  /** The patient's share AFTER the deductible, per mille. */
  readonly coinsurancePerMille: number
  /** The ceiling on what a year can cost the patient. */
  readonly outOfPocketMax: Money
}

/** The age SeniorCare starts, unprompted (spec §2). */
export const SENIORCARE_AGE = 65

/**
 * Income below which PublicCare takes over, base-year cents per month.
 * Deliberately near the assistance floor — this is the programme for people
 * who are not earning, not a general subsidy.
 */
export const PUBLICCARE_INCOME_CEILING = 140_000 as Money

/**
 * IS THIS A VETERAN THE BA WOULD ENROL?
 *
 * The same threshold the pension board already uses, so the card a player
 * reads and the money they draw cannot disagree about whether they qualify.
 */
export function inTheBA(world: World, personId: EntityId): boolean {
  const record = world.health.get(personId)
  if (record === undefined || record.serviceDisability < PENSION_THRESHOLD) return false
  const service = world.service.get(personId)
  return service !== undefined && service.dischargedAtTick !== null
}

/**
 * THE DISABILITY RATING, 0–100, as a percentage the way a real board states
 * it — the underlying store is 0–1000 and every screen in the mockup shows a
 * percent.
 */
export function disabilityRatingFor(world: World, personId: EntityId): number {
  const record = world.health.get(personId)
  if (record === undefined) return 0
  return Math.min(100, Math.floor(record.serviceDisability / 10))
}

/**
 * WHAT THE BA PAYS THIS MONTH, integer cents at today's prices.
 *
 * A READ, NOT A SECOND PAYMENT — and this correction is the whole story of
 * this function. It was first written believing the compensation was never
 * paid at all, because `health.ts` records a `granted-pension` event with
 * the monthly figure in its detail and nothing nearby moves any money. That
 * was wrong: `service.ts`'s `pensionValueOf` has been adding
 * `serviceDisability * PENSION_CENTS_PER_POINT` to the service pension all
 * along, and `personalIncome` has been summing it.
 *
 * Wiring a second payment here double-paid every disabled veteran in the
 * world. The itemized-ledger test caught it in one run — the trio that has
 * now drifted apart FIVE times is exactly what that test exists for.
 *
 * So this reports the disability share of the pension for the BA card to
 * display, and `finances.ts` remains the only thing that pays it. The
 * dependent scaling is display-only for the same reason: the money is the
 * service pension's, not this module's to inflate.
 */
export function baCompensationFor(world: World, personId: EntityId, tick: Tick): Money {
  if (!inTheBA(world, personId)) return 0 as Money
  const record = world.health.get(personId)
  if (record === undefined) return 0 as Money

  const base = record.serviceDisability * PENSION_CENTS_PER_POINT
  // A DEPENDENT IS A PERSON UNDER THIS ROOF WHO IS NOT EARNING. Counted from
  // the household rather than from a marriage record, so a man raising his
  // sister's children is not told they do not count.
  const person = world.people.get(personId)
  let dependents = 0
  if (person?.householdId !== null && person !== undefined) {
    const household = world.households.get(person.householdId)
    for (const memberId of household?.memberIds ?? []) {
      if (memberId === personId) continue
      const member = world.people.get(memberId)
      if (member === undefined || member.deathTick !== null) continue
      if (ageAt(member.birthTick, tick) < 18 || !world.employment.has(memberId)) dependents += 1
    }
  }
  // An eighth per dependent, capped — generous enough to matter, bounded so
  // a large household is not a living.
  // NOT SCALED INTO THE PAYMENT. `dependents` shapes what the card SAYS
  // about who the money supports; the sum itself must equal what the
  // service pension actually pays, or the screen and the bank disagree.
  void dependents
  return atTodaysPrices(world, base as Money) as Money
}

/**
 * WHAT THIS PERSON EARNS, for the means test only.
 *
 * READ INLINE rather than by importing `finances.ts`, and deliberately:
 * finances imports THIS module to pay the compensation, so the edge back
 * would close a cycle and the import ratchet would refuse it — correctly.
 * The means test wants wages, which is a lookup, not the full income
 * picture that `personalIncome` assembles.
 */
function personalIncomeForMeansTest(world: World, personId: EntityId): number {
  return world.employment.get(personId)?.monthlyPay ?? 0
}

/**
 * WHERE THIS PERSON'S CARE IS PAID FROM.
 *
 * Ordered by what actually takes precedence in a life: a service-connected
 * veteran has the BA whatever else is true; age takes over at 65; a job
 * carries a plan; poverty falls to PublicCare; and the gap between those is
 * a real and dangerous state rather than an error (spec §2).
 */
export function coverageOf(world: World, personId: EntityId, tick: Tick): Coverage {
  const person = world.people.get(personId)
  const age = person === undefined ? 0 : ageAt(person.birthTick, tick)

  if (inTheBA(world, personId)) {
    return {
      source: 'ba',
      carrier: 'the BA',
      premium: 0 as Money,
      deductible: 0 as Money,
      // Service-connected care is ~free; this is the share on everything
      // else a veteran walks in with.
      coinsurancePerMille: 100,
      outOfPocketMax: atTodaysPrices(world, 150_000 as Money) as Money,
    }
  }

  if (age >= SENIORCARE_AGE) {
    return {
      source: 'seniorcare',
      carrier: 'SeniorCare',
      premium: atTodaysPrices(world, 17_000 as Money) as Money,
      deductible: atTodaysPrices(world, 25_000 as Money) as Money,
      coinsurancePerMille: 200,
      outOfPocketMax: atTodaysPrices(world, 500_000 as Money) as Money,
    }
  }

  const job = world.employment.get(personId)
  if (job !== undefined) {
    // BETTER JOBS CARRY BETTER PLANS (spec §2) — this is what makes a career
    // matter for health rather than only for money.
    const good = job.monthlyPay >= 400_000
    return {
      source: 'employer',
      carrier: good ? 'Meridian Health' : 'Cornerstone Mutual',
      premium: atTodaysPrices(world, (good ? 22_000 : 31_000) as Money) as Money,
      deductible: atTodaysPrices(world, (good ? 60_000 : 180_000) as Money) as Money,
      coinsurancePerMille: good ? 150 : 300,
      outOfPocketMax: atTodaysPrices(world, (good ? 400_000 : 900_000) as Money) as Money,
    }
  }

  // PUBLICCARE, ON THE STRENGTH OF WHAT YOU EARN (spec §2). Checked after
  // the job because somebody working a low wage may still qualify, and
  // before uninsured because the programme exists precisely to catch them.
  /**
   * AND IT IS NOT AUTOMATIC — this is where the uninsured gap comes from.
   *
   * The first draft tested income alone, and a test written against it
   * caught the mistake immediately: everybody jobless earns zero, zero is
   * below any ceiling, so EVERY unemployed person was quietly covered and
   * nobody in the world was ever uninsured. That deletes the state the spec
   * calls "a real state, and a dangerous one" — and with it the whole
   * uninsured-major-event-to-medical-debt road into the bankruptcy
   * mechanic that already exists.
   *
   * So the programme catches the people it is actually for: minors, and
   * households with nothing behind them. A working-age adult between jobs
   * who still has savings does NOT qualify — they are the gap, exactly as
   * the spec describes it ("not-quite-qualifying"), and getting hurt in it
   * is how lives get wrecked.
   */
  const earned = personalIncomeForMeansTest(world, personId)
  const household =
    person?.householdId === null || person === undefined
      ? undefined
      : world.households.get(person.householdId)
  const destitute = (household?.savings ?? 0) <= 0
  if (earned <= atTodaysPrices(world, PUBLICCARE_INCOME_CEILING) && (age < 18 || destitute)) {
    return {
      source: 'publiccare',
      carrier: 'PublicCare',
      premium: 0 as Money,
      deductible: 0 as Money,
      coinsurancePerMille: 50,
      outOfPocketMax: atTodaysPrices(world, 80_000 as Money) as Money,
    }
  }

  return {
    source: 'uninsured',
    carrier: 'nobody',
    premium: 0 as Money,
    deductible: 0 as Money,
    coinsurancePerMille: 1000,
    outOfPocketMax: atTodaysPrices(world, 100_000_000 as Money) as Money,
  }
}

/**
 * WHAT A PIECE OF CARE COSTS THIS PERSON — the shared resolver (spec §3).
 *
 * Every care action in the game runs through this one function, so the price
 * a screen previews and the price an account is debited cannot disagree.
 *
 * SERVICE-CONNECTED CARE IS FREE at the BA, which is the whole point of the
 * veteran track and the reason the amputee's prosthetic comes back at zero.
 *
 * V1 IS HONEST ABOUT THE YEAR. A real plan tracks a deductible and an
 * out-of-pocket maximum across a plan year, and that needs stored per-person
 * year-to-date state. This applies both PER EPISODE instead. The shape a
 * player feels is right — you pay the first slice, then a share, and never
 * more than the ceiling — but somebody with many small episodes pays their
 * deductible more often than they should. Annual tracking is a stored field
 * and a migration, and it is the next thing this module needs.
 */
export function outOfPocketFor(
  world: World,
  personId: EntityId,
  careCost: Money,
  serviceConnected: boolean,
  tick: Tick,
): Money {
  if (careCost <= 0) return 0 as Money
  const coverage = coverageOf(world, personId, tick)
  if (coverage.source === 'ba' && serviceConnected) return 0 as Money

  const beforeSharing = Math.min(careCost, coverage.deductible)
  const shared = Math.max(0, careCost - beforeSharing)
  const patientShare = Math.floor((shared * coverage.coinsurancePerMille) / 1000)
  const total = beforeSharing + patientShare
  return Math.min(total, coverage.outOfPocketMax) as Money
}

/** In words, for the coverage card. */
export function coverageWords(source: CoverageSource): string {
  switch (source) {
    case 'ba':
      return 'Service-connected care is covered in full.'
    case 'seniorcare':
      return 'SeniorCare, from sixty-five on.'
    case 'employer':
      return 'Through work — and it ends when the job does.'
    case 'publiccare':
      return 'PublicCare, on the strength of what you earn.'
    default:
      return 'Nothing. You pay the whole bill, whatever it is.'
  }
}
