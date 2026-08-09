/**
 * ONGOING EFFECTS — M-HEALTH §4.
 *
 * THE BUG THIS MODULE EXISTS FOR (owner, playing): "I just lost my leg in
 * war and I rested and healed right back up and now im 'back on my feet' no
 * past wounds no nothing lol we need this fixed he lost his leg how can he
 * still serve and fight for the country with 1 leg".
 *
 * The first half of that was fixed in `health.ts`: an amputation now always
 * leaves disability instead of rolling for it, and the floor clears the
 * medical bar so the army will not take him back. But a number on a record
 * is still not a life. Before this module, `marks` were read by exactly one
 * caller — `story.ts`, to narrate them. Health was cosmetic.
 *
 * The spec's acceptance bar is the honest one: "if a condition can't be FELT
 * elsewhere in the game, it isn't modeled yet."
 *
 * WHY THE EFFECTS ARE DERIVED, NOT STORED. A stored effect set is a second
 * copy of the truth, and it would drift from the conditions that produced it
 * the first time either side changed (Law 12, and the three-cost-functions
 * problem this project has already hit four times). These are pure functions
 * of the conditions on the record. There is one writer of health state —
 * `health.ts` — and this module never writes.
 */

import type { EntityId } from '@life-engine/shared'
import type { World } from './types.js'

/**
 * WHAT A CONDITION DOES TO A LIFE. Every field is "how much is left",
 * per-mille, EXCEPT the flags — so 1000 is an unimpaired body and the
 * combining rule below is a straightforward minimum.
 */
export interface ConditionEffects {
  /** Walking and running capacity. Below ~600 a person cannot run. */
  readonly mobilityPerMille: number
  /** The hard cap on fitness points this body can ever reach. */
  readonly fitnessCeilingPerMille: number
  /** Chronic pain load, 0-1000. Drags mood and drives painkiller risk. */
  readonly painLoad: number
  /** Heavy physical trades and the combat arms are closed. */
  readonly barsPhysicalWork: boolean
  /** A monthly drag on wellbeing while the condition is carried. */
  readonly wellbeingDrag: number
  /** Needs a prosthetic, chair, cane or aid to function. */
  readonly needsAid: boolean
}

const UNIMPAIRED: ConditionEffects = {
  mobilityPerMille: 1000,
  fitnessCeilingPerMille: 1000,
  painLoad: 0,
  barsPhysicalWork: false,
  wellbeingDrag: 0,
  needsAid: false,
}

/** The threshold below which a body cannot run (M-HEALTH §4, mobility). */
export const CANNOT_RUN_BELOW = 600

/**
 * WHAT EACH IRREVERSIBLE WOUND COSTS, and the site matters as much as the
 * mechanism — losing a leg and losing a hand are both amputations and they
 * are not the same disability. A one-legged man's mobility is wrecked and
 * his fitness ceiling with it; a one-handed man walks fine and still cannot
 * hold a rifle or a roofing hammer.
 *
 * These are deliberately NOT a single severity scale. Collapsing them to one
 * number is what produced a game where a lost leg and a bad scar were the
 * same event with different words.
 */
export function effectsFor(kind: string, site: string | null): ConditionEffects {
  switch (kind) {
    case 'amputation': {
      const lowerLimb = site === 'leg' || site === 'foot'
      return {
        // The UNADAPTED floor. `adaptedEffects` applies what a prosthetic
        // and rehab give back — part of it, never all (§7).
        mobilityPerMille: lowerLimb ? 350 : 900,
        fitnessCeilingPerMille: lowerLimb ? 400 : 700,
        painLoad: 400,
        barsPhysicalWork: true,
        wellbeingDrag: 60,
        needsAid: true,
      }
    }
    case 'spinal-injury':
      return {
        mobilityPerMille: 150,
        fitnessCeilingPerMille: 250,
        painLoad: 600,
        barsPhysicalWork: true,
        wellbeingDrag: 90,
        needsAid: true,
      }
    case 'eye-injury':
      // Sight does not stop you walking. It stops you driving, shooting,
      // and a long list of trades.
      return {
        mobilityPerMille: 900,
        fitnessCeilingPerMille: 850,
        painLoad: 150,
        barsPhysicalWork: true,
        wellbeingDrag: 50,
        needsAid: true,
      }
    default:
      return UNIMPAIRED
  }
}

/** How much of the gap to whole an aid closes. Never all of it. */
const ADAPTATION_RECOVERY_PER_MILLE = 550

/**
 * The unadapted wound, then the aid applied.
 *
 * KEPT SEPARATE so the raw severity of an injury and what medicine can do
 * about it never get confused for one another — §7 is explicit that
 * adaptation "partially restores function, NEVER FULLY", and the never is
 * the whole point. A prosthetic gives a man his day back; it does not give
 * him the leg. `barsPhysicalWork` therefore survives adaptation: a roofer's
 * job is not reopened by a good socket.
 */
function adaptedEffects(kind: string, site: string | null, adapted: boolean): ConditionEffects {
  const raw = effectsFor(kind, site)
  if (!adapted) return raw
  const closed = (value: number): number =>
    value + Math.floor(((1000 - value) * ADAPTATION_RECOVERY_PER_MILLE) / 1000)
  return {
    ...raw,
    mobilityPerMille: closed(raw.mobilityPerMille),
    fitnessCeilingPerMille: closed(raw.fitnessCeilingPerMille),
    // Pain eases with a proper fit, but phantom pain is phantom pain.
    painLoad: Math.floor((raw.painLoad * 600) / 1000),
    wellbeingDrag: Math.floor((raw.wellbeingDrag * 600) / 1000),
    // NOT REOPENED. The trades want a whole body, and an aid is not one.
    barsPhysicalWork: raw.barsPhysicalWork,
    needsAid: raw.needsAid,
  }
}

/**
 * EVERYTHING THIS BODY CARRIES, combined.
 *
 * CONDITIONS STACK (§1) — a man with one leg and one eye is worse off than
 * either alone. Capacities take the WORST of the set rather than summing,
 * because two bad knees do not make you half a person; pain and mood DO
 * accumulate, because carrying two hurts more than carrying one.
 */
export function effectsOf(world: World, personId: EntityId): ConditionEffects {
  const record = world.health.get(personId)
  if (record === undefined || record.permanent.length === 0) return UNIMPAIRED

  let combined = UNIMPAIRED
  for (const condition of record.permanent) {
    const one = adaptedEffects(
      condition.kind,
      condition.site,
      (condition.adaptedAtTick ?? null) !== null,
    )
    combined = {
      mobilityPerMille: Math.min(combined.mobilityPerMille, one.mobilityPerMille),
      fitnessCeilingPerMille: Math.min(
        combined.fitnessCeilingPerMille,
        one.fitnessCeilingPerMille,
      ),
      painLoad: Math.min(1000, combined.painLoad + one.painLoad),
      barsPhysicalWork: combined.barsPhysicalWork || one.barsPhysicalWork,
      wellbeingDrag: Math.min(300, combined.wellbeingDrag + one.wellbeingDrag),
      needsAid: combined.needsAid || one.needsAid,
    }
  }
  return combined
}

/** Can this body still run? The plainest question the taxonomy answers. */
export function canRun(world: World, personId: EntityId): boolean {
  return effectsOf(world, personId).mobilityPerMille >= CANNOT_RUN_BELOW
}

/**
 * THE WORK THAT NEEDS A WHOLE BODY (M-HEALTH §4, job restrictions — "an
 * amputee can't be a line infantryman or a roofer").
 *
 * A LIST RATHER THAN A FLAG ON `Occupation`, and deliberately: adding a
 * field to the occupation table would mean every one of the ninety-odd
 * entries had to be judged and kept in step forever, and the ones that
 * matter here are the trades. This is the town's manual work, by id, taken
 * from the occupation table as it actually reads.
 *
 * MILITARY SERVICE IS NOT IN THIS LIST because it is already handled, and
 * better: `service.ts` refuses at `MEDICAL_LIMIT` (400 disability), which
 * the irreversible-wound floor of 450 clears deliberately. A one-legged man
 * cannot enlist and is medically discharged if serving — that is the
 * pension board's rule, not a job filter, and it belongs where it is.
 */
const PHYSICAL_WORK: ReadonlySet<string> = new Set([
  'labourer',
  'millhand',
  'carpenter',
  'machinist',
  'electrician',
  'cook',
  'apprentice',
  'master-tradesman',
  'site-foreman',
  'contractor',
  'foreman',
  'lead-hand',
  'constable',
])

/**
 * Is this work closed to this body?
 *
 * The bar pattern, as everywhere in this project: ONE function answers both
 * the greyed control and the refusal, so a screen cannot offer what the
 * simulation would reject.
 */
export function barredFromWork(world: World, personId: EntityId, occupationId: string): boolean {
  if (!PHYSICAL_WORK.has(occupationId)) return false
  return effectsOf(world, personId).barsPhysicalWork
}
