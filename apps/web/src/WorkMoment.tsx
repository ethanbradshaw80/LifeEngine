/**
 * A MOMENT AT WORK, as the player meets it (M-CAREER §3).
 *
 * The owner's mockup, and the same shape the crime scene uses: a card with
 * the job's standing across the top, the situation, three answers with what
 * each one means HERE, and then what it cost or bought.
 *
 * Every line comes from the engine's own authored copy — the situation, the
 * three option labels and the outcome are all read from the moment, not
 * composed here. The UI picks nothing.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { outcomeOf, situationOf, workResultFor } from '@life-engine/engine'
import type { WorkChoice, WorkMoment } from '@life-engine/engine'

const TAG_CLASS: Record<string, string> = {
  lead: 'is-bold',
  steady: 'is-measured',
  pass: 'is-safe',
}

export function WorkMomentView({
  moment,
  variant,
  standing,
  performance,
  onChoose,
}: {
  readonly moment: WorkMoment
  /** Which wording, carried from the pending so the outcome follows it. */
  readonly variant: number
  /** "Senior Associate · well regarded" — the stakes line. */
  readonly standing: string
  readonly performance: number
  readonly onChoose: (option: string) => void
}): JSX.Element {
  const [answered, setAnswered] = useState<WorkChoice | null>(null)

  if (answered !== null) {
    // THE ENGINE'S OWN RESULT, not a second guess at it: the same function
    // the world is about to run, on the same numbers.
    const result = workResultFor(moment, answered, performance, variant % 1000)
    const outcome = outcomeOf(moment, answered, result, variant)
    return (
      <div className="work-card">
        <div className="work-top">
          <span className="k">Work</span>
          <span className="title">{moment.title}</span>
        </div>
        <div className="work-outcome">
          <div className={result === 'good' ? 'work-otitle win' : 'work-otitle bad'}>
            {outcome?.title ?? ''}
          </div>
          <div className="work-otext">{outcome?.text ?? ''}</div>
          <div className="work-ofoot">{outcome?.foot ?? ''}</div>
          <button type="button" className="apply primary" onClick={() => onChoose(answered)}>
            Back to it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="work-card">
      <div className="work-top">
        <span className="k">Work</span>
        <span className="title">{moment.title}</span>
      </div>
      <div className="work-stakes">
        <span>◆</span> Your standing: <b>{standing}</b>
      </div>
      <div className="work-scene">{situationOf(moment, variant)}</div>
      <div className="work-opts">
        {moment.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`work-opt ${TAG_CLASS[option.id] ?? ''}`}
            onClick={() => setAnswered(option.id)}
          >
            <span className="h">
              {option.title}
              <span className="tag">{option.tag}</span>
            </span>
            <span className="d">{option.detail}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
