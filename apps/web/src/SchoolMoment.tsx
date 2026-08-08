/**
 * A MOMENT AT SCHOOL, as the player meets it (education master §0.5, §7).
 *
 * The same card the work moment uses, because it is the same shape of
 * decision: what is happening, three answers with what each one means
 * HERE, and then what it cost or bought. What differs is the stakes line
 * — a child has no job title, so the line across the top is the stage
 * they are at and how the year has been going.
 *
 * Every line comes from the engine's own authored copy: the situation,
 * the three option labels and the outcome are read from the moment, not
 * composed here. The UI picks nothing.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { schoolOutcomeOf, schoolResultFor, schoolSituationOf } from '@life-engine/engine'
import type { SchoolChoice, SchoolMoment } from '@life-engine/engine'

const TAG_CLASS: Record<string, string> = {
  reach: 'is-bold',
  steady: 'is-measured',
  duck: 'is-safe',
}

export function SchoolMomentView({
  moment,
  variant,
  standing,
  attainment,
  onChoose,
}: {
  readonly moment: SchoolMoment
  /** Which wording, carried from the pending so the outcome follows it. */
  readonly variant: number
  /** "High school · a good student" — the stakes line. */
  readonly standing: string
  readonly attainment: number
  readonly onChoose: (option: string) => void
}): JSX.Element {
  const [answered, setAnswered] = useState<SchoolChoice | null>(null)

  if (answered !== null) {
    // THE ENGINE'S OWN RESULT, not a second guess at it: the same function
    // the world is about to run, on the same numbers.
    const result = schoolResultFor(moment, answered, attainment, variant % 1000)
    const outcome = schoolOutcomeOf(moment, answered, result, variant)
    return (
      <div className="work-card">
        <div className="work-top">
          <span className="k">School</span>
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
        <span className="k">School</span>
        <span className="title">{moment.title}</span>
      </div>
      <div className="work-stakes">
        <span>◆</span> Where you are: <b>{standing}</b>
      </div>
      <div className="work-scene">{schoolSituationOf(moment, variant)}</div>
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
