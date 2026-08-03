/**
 * Reenlistment, as the owner's spec has it: an eligibility check, a term
 * you choose, a bonus when your trade is short, a real option, an oath, and
 * indefinite status once you are senior enough that the question is silly.
 *
 * WHAT IT REPLACES: a binary stay/leave at a fixed forty-eight months, which
 * asked nothing and offered nothing. The service does not simply take
 * everybody back — reenlistment is EARNED — and when it does want you it
 * competes for you with money, a school, or a promise about where you will
 * live.
 *
 * Everything here is pure: given a record and a specialty it answers the
 * same way every time, and the callers own the writing.
 */

import type { Money } from '@life-engine/shared'
import type { ServiceSpecialty } from './content.js'
import type { ServiceRecord } from './types.js'

/**
 * The RE code — whether the service will have you again.
 *
 *  RE-1  clean file: any term, and the bonus if the trade pays one
 *  RE-3  marginal file: allowed back, but no bonus and a short term only.
 *        A real thing, and the honest middle between yes and no.
 *  RE-4  barred: high-year tenure, a criminal record, or a discipline
 *        history the service has decided against. It is not the player's
 *        choice, which is exactly the point of modelling it.
 */
export type ReCode = 'RE-1' | 'RE-3' | 'RE-4'

export interface Eligibility {
  readonly code: ReCode
  /** Plain words for the screen: why the door is where it is. */
  readonly reason: string
  /** Terms the service will write, in years. Empty on RE-4. */
  readonly terms: readonly number[]
}

/** Below this the file is marginal; below the second, it is barred. */
const MARGINAL_PERFORMANCE = 450
const BARRED_PERFORMANCE = 300

/**
 * Grade at which a career stops being a series of contracts.
 *
 * INDEFINITE (§7). Past this the reenlistment question is not a question:
 * senior NCOs serve on until retirement, high-year tenure, or age. Asking
 * a first sergeant every four years whether he would like to stay in the
 * army is the kind of prompt that teaches a player to stop reading them.
 */
export const INDEFINITE_FROM_GRADE = 7

/**
 * Whether this record has passed into indefinite service. The term-end
 * handler stops raising the question for them.
 */
export function servesIndefinitely(grade: number): boolean {
  return grade >= INDEFINITE_FROM_GRADE
}

/**
 * The RE code, read from signals the world already records: the evaluation,
 * the orderly room, the courthouse, and the clock.
 */
export function reenlistEligibility(
  record: ServiceRecord,
  args: {
    readonly strikes: number
    /** Strikes that end a career outright — the discipline system's own
     *  number, so the two gates cannot drift apart. */
    readonly endsCareerAt: number
    /**
     * What the courthouse says, GRADED.
     *
     * 'bar' is a serious conviction the service will not carry. 'waiver' is
     * a lesser one it will, on its terms. Not the same question the
     * RECRUITING office asks — see reenlistEligibility.
     */
    readonly criminalGate: 'none' | 'waiver' | 'bar'
    readonly hitHighYearTenure: boolean
    readonly age: number
  },
): Eligibility {
  if (args.hitHighYearTenure) {
    return {
      code: 'RE-4',
      reason: 'High-year tenure. The service will not write another contract at this grade.',
      terms: [],
    }
  }
  if (args.age >= 60) {
    return { code: 'RE-4', reason: 'Past the age the service contracts to.', terms: [] }
  }
  // THE SERVICE DECLINES, and the player does not get a vote — but only for
  // a conviction it will genuinely not carry.
  //
  // KEEPING SOMEBODY IS NOT THE SAME QUESTION AS TAKING THEM ON. This reused
  // the RECRUITING office's gate verbatim, and measurement showed the cost:
  // every barred soldier across five towns was barred by the courthouse, and
  // they averaged 540 performance with four decorations at thirty-five. A
  // service that has already trained you, decorated you and knows you does
  // not discard you over a misdemeanour the way it would decline a stranger
  // holding one at the door. A serious conviction still ends it; a lesser
  // one is a waiver, and the choice stays yours.
  if (args.criminalGate === 'bar') {
    return {
      code: 'RE-4',
      reason: 'The record at the courthouse bars another term.',
      terms: [],
    }
  }
  // CONDUCT BARS, A MEDIOCRE EVALUATION DOES NOT. The first version barred
  // on performance alone and shut the door on ordinary soldiers who had
  // simply never been outstanding — which is not how a service that needs
  // people behaves.
  //
  // AND THE DOOR MUST NOT BE STRICTER THAN THE ORDERLY ROOM (owner, playing:
  // "I literally just got kicked out the army after having a great career
  // and I didn't even get the choice"). It barred at TWO strikes while the
  // discipline system itself only ends a career at three — so a soldier the
  // orderly room considered salvageable was quietly refused at the retention
  // desk instead, with no question asked. Measured across five towns: the
  // barred averaged 530 performance and four decorations, which is a better
  // soldier than the average one who leaves normally.
  //
  // The bar is now the same number the discipline system uses. Below it, a
  // conduct history is a WAIVER — the service will still have you, on its
  // terms, and the choice stays yours.
  if (args.strikes >= args.endsCareerAt) {
    return {
      code: 'RE-4',
      reason: 'A discipline history the service has decided against.',
      terms: [],
    }
  }
  if (record.performance < BARRED_PERFORMANCE) {
    return {
      code: 'RE-3',
      reason: 'A weak file: another term is allowed on a waiver, two years only, and no bonus.',
      terms: [2],
    }
  }
  if (
    args.criminalGate === 'waiver' ||
    args.strikes >= 1 ||
    record.performance < MARGINAL_PERFORMANCE
  ) {
    return {
      code: 'RE-3',
      reason: 'A marginal file: another term is allowed, on a waiver. No bonus, and two years only.',
      terms: [2],
    }
  }
  return { code: 'RE-1', reason: 'The file is clean. The service will write any term.', terms: [2, 3, 4, 6] }
}

/**
 * The selective reenlistment bonus — the needs of the service, in money.
 *
 * A trade that is SHORT pays; an overmanned one pays little or nothing, and
 * that asymmetry is the whole point. `boardCutoffOffset` already carries
 * it: a negative offset means the promotion board is lenient because the
 * trade cannot fill its slots, which is exactly the trade that would be
 * paying to keep people.
 *
 * Zones follow the real shape too — the money targets mid-career retention
 * and stops entirely once somebody is close enough to a pension that they
 * are not going anywhere.
 */
export function srbFor(
  specialty: ServiceSpecialty,
  yearsServed: number,
  termYears: number,
  monthlyPay: Money,
): Money {
  // Zone A under six years, B to ten, C to fourteen, nothing after.
  const zone = yearsServed < 6 ? 10 : yearsServed < 10 ? 6 : yearsServed < 14 ? 3 : 0
  if (zone === 0) return 0 as Money

  // A short trade has a NEGATIVE cutoff offset. Nothing is owed to a trade
  // with people queuing for it.
  const shortfall = Math.max(0, -specialty.boardCutoffOffset)
  if (shortfall === 0) return 0 as Money

  const demand = Math.min(20, Math.floor(shortfall / 2))
  const raw = Math.floor((monthlyPay * termYears * zone * demand) / 100)
  // Capped: a bonus is a year or two of pay, never a fortune.
  return Math.min(raw, monthlyPay * 24) as Money
}

/** What a reenlistment can offer instead of the cash. */
export type ReenlistmentOption = 'bonus' | 'school' | 'stability' | 'reclass'

/**
 * Which options this contract carries.
 *
 * A marginal file gets the term and nothing else — which is what a waiver
 * means. A clean file with no bonus still gets the choices that cost the
 * service nothing but a promise.
 *
 * RECLASSIFICATION IS ONE OF THEM (owner, playing: "I don't think we should
 * be able to change jobs every single time we reenlist, it should be an
 * option that the retention offer gives during the bonus process"). He is
 * right, and it was the wrong shape twice over: a trade you can walk away
 * from every four years is not a trade, and reclassification really is a
 * retention TOOL — the thing the office offers the man it cannot pay. So it
 * competes with the money now. You can have the bonus or you can have the
 * new job; wanting both is what the choice is for.
 */
export function optionsFor(code: ReCode, bonus: Money): readonly ReenlistmentOption[] {
  if (code !== 'RE-1') return []
  return bonus > 0
    ? ['bonus', 'school', 'stability', 'reclass']
    : ['school', 'stability', 'reclass']
}

/** Months of no involuntary orders bought by the stability option. */
export const STABILITY_MONTHS = 24
