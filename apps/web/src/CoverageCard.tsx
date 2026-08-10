/**
 * COVERAGE & BENEFITS — a section of the Health tab, not a tab of its own.
 *
 * From the owner's `benefits_insurance_master.md` §8, which is explicit
 * about this: "This is NOT a separate screen — it's a Coverage & Benefits
 * section within the reworked Health tab, sitting alongside the conditions
 * and body diagram."
 *
 * Two cards, matching the mockup: the BA card when the player is a veteran
 * the board has rated, and the civilian insurance card otherwise. Both read
 * everything from `benefits.ts` — the source, the plan shape, the rating,
 * the monthly compensation. Nothing here computes coverage, because a
 * screen that did its own arithmetic would eventually disagree with the
 * account that pays the bills.
 */

import {
  baCompensationFor,
  coverageOf,
  coverageWords,
  disabilityRatingFor,
  inTheBA,
} from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="cov-row">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  )
}

export function CoverageCard({
  world,
  personId,
  busy = false,
  onAct,
}: {
  world: World
  personId: EntityId
  busy?: boolean
  /** Absent when the card is read-only (another person's page). */
  onAct?: (action: { verb: 'file-ba-claim' }) => void
}) {
  const coverage = coverageOf(world, personId, world.tick)
  const veteran = inTheBA(world, personId)
  const rating = disabilityRatingFor(world, personId)
  /**
   * THE DOOR TO THE BOARD (owner: "add an 'apply for BA benefits' button so
   * that you can be rated somewhere by the insurance card"). A discharged
   * veteran who is not enrolled — rated under the threshold, or carrying
   * harm the board has never examined — files here. Enrolment itself stays
   * the engine's: the button asks for a rating, it does not grant one.
   */
  const service = world.service.get(personId)
  const dischargedVeteran = service !== undefined && service.dischargedAtTick !== null
  const canApply = onAct !== undefined && dischargedVeteran && !veteran

  return (
    <section className="cov-card" aria-label="Coverage and benefits">
      <h3>Coverage &amp; benefits</h3>

      {veteran ? (
        <div className="cov ba">
          <div className="cov-hd">
            <span className="nm">The BA — Benefits Administration</span>
            <span className="badge">enrolled</span>
          </div>
          <Row label="Disability rating" value={`${String(rating)}%`} />
          <Row label="Monthly compensation" value={`${formatMoney(baCompensationFor(world, personId, world.tick))}/mo`} />
          <Row label="Service-connected care" value="covered in full" />
          <Row label="Everything else" value={`${String(coverage.coinsurancePerMille / 10)}% your share`} />
          <p className="muted small cov-note">
            The rating is what the board found. It does not lapse, and it can rise if a
            condition worsens.
          </p>
        </div>
      ) : (
        <div className="cov">
          <div className="cov-hd">
            <span className="nm">{coverage.carrier}</span>
            <span className={`badge${coverage.source === 'uninsured' ? ' bad' : ''}`}>
              {coverage.source === 'employer'
                ? 'through work'
                : coverage.source === 'seniorcare'
                  ? 'SeniorCare'
                  : coverage.source === 'publiccare'
                    ? 'PublicCare'
                    : 'no cover'}
            </span>
          </div>
          {coverage.source === 'uninsured' ? (
            <p className="cov-warn">
              {/* THE DANGEROUS EDGE, said plainly. The spec calls being
                  uninsured "a real state, and a dangerous one" — and it is
                  the road into medical debt and the bankruptcy mechanic
                  that already exists in this game. */}
              You pay the whole bill, whatever it is. One bad month is all it takes.
            </p>
          ) : (
            <>
              <Row label="Premium" value={`${formatMoney(coverage.premium)}/mo`} />
              <Row label="Deductible" value={formatMoney(coverage.deductible)} />
              <Row label="Your share after that" value={`${String(coverage.coinsurancePerMille / 10)}%`} />
              <Row label="Most you can pay" value={formatMoney(coverage.outOfPocketMax)} />
            </>
          )}
          <p className="muted small cov-note">{coverageWords(coverage.source)}</p>
          {canApply && (
            <button
              type="button"
              className="apply"
              disabled={busy}
              onClick={() => onAct({ verb: 'file-ba-claim' })}
            >
              🎖 Apply for BA benefits
            </button>
          )}
        </div>
      )}
    </section>
  )
}
