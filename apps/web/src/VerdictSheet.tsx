/**
 * The verdict, as its own moment (owner direction).
 *
 * A case used to end with a line in the story feed that scrolled past —
 * the player answered the plea and then had to go looking for what
 * happened. The court's answer is one of the heaviest things in the game
 * and it should arrive as an answer.
 *
 * Every value here is read from the record by courtOutcomeOf. The sheet
 * renders; it does not decide, and it cannot say anything the courthouse
 * did not do.
 */

import type { CourtOutcome, World } from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import { formatYear } from '@life-engine/engine'

function sentenceLine(outcome: CourtOutcome): string {
  if (!outcome.convicted) return 'The charge did not stick.'
  if (outcome.sentenceMonths > 0) {
    const months = outcome.sentenceMonths
    const years = Math.floor(months / 12)
    const rest = months % 12
    const said =
      years > 0
        ? `${String(years)} year${years === 1 ? '' : 's'}${rest > 0 ? ` and ${String(rest)} month${rest === 1 ? '' : 's'}` : ''}`
        : `${String(months)} month${months === 1 ? '' : 's'}`
    return `Sentenced to ${said}.`
  }
  if (outcome.fine > 0) return `Fined ${formatMoney(outcome.fine as never)}.`
  return 'Convicted; the court let it go at that.'
}

export function VerdictSheet({
  world,
  outcome,
  onClose,
}: {
  readonly world: World
  readonly outcome: CourtOutcome
  readonly onClose: () => void
}) {
  const guilty = outcome.convicted
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="The verdict">
      <div className="sheet verdict">
        <p className="muted small">The courthouse · {formatYear(outcome.tick)}</p>
        <h2 className={guilty ? 'verdict-guilty' : 'verdict-clear'}>
          {guilty ? 'Convicted' : 'Not guilty'}
        </h2>

        <dl className="verdict-facts">
          <dt>Charge</dt>
          <dd>
            {outcome.charge}
            {outcome.grade !== null && <span className="muted small"> · {outcome.grade}</span>}
          </dd>

          <dt>The court's answer</dt>
          <dd>{sentenceLine(outcome)}</dd>

          {outcome.releasedAtTick !== null && (
            <>
              <dt>Out in</dt>
              <dd>{formatYear(outcome.releasedAtTick)}</dd>
            </>
          )}

          <dt>Prior convictions</dt>
          <dd>
            {outcome.priors === 0
              ? 'None before this.'
              : `${String(outcome.priors)} on the file before today.`}
          </dd>
        </dl>

        <p className="muted small">
          {guilty
            ? outcome.sentenceMonths > 0
              ? 'A sentence is absence: no work, no wage, and the household carries it without you. The conviction stays on the record for good, and closes doors for ten years.'
              : 'The conviction stays on the record for good, and closes doors for ten years.'
            : 'Nothing goes on the record. The arrest happened, and that is all it was.'}
        </p>

        <div className="sheet-actions">
          <button type="button" className="primary" onClick={onClose}>
            {guilty ? 'Take it' : 'Go home'}
          </button>
        </div>
        {/* The world stayed paused for the plea; it resumes when this closes. */}
        <p className="muted small">{world.town.name} keeps going either way.</p>
      </div>
    </div>
  )
}
