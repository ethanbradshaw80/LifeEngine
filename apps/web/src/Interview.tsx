/**
 * THE ROOM (M-CAREER §4).
 *
 * Applying used to be a button and a hidden roll. This is the forty minutes
 * in between: the situation, three ways to play it, and what the room made
 * of it. The offer, if there is one, arrives after — as the same job-offer
 * card the town uses when it comes to you.
 *
 * Every line is the engine's authored copy. The UI picks nothing.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { INTERVIEW_OPTIONS, interviewOutcomeOf, interviewSituation } from '@life-engine/engine'
import type { InterviewApproach } from '@life-engine/engine'

export function InterviewView({
  role,
  variant,
  stretch,
  onChoose,
}: {
  /** The job, by name. */
  readonly role: string
  readonly variant: number
  /** Whether this one is a genuine reach — the tell the player can read. */
  readonly stretch: boolean
  readonly onChoose: (option: string) => void
}): JSX.Element {
  const [answered, setAnswered] = useState<InterviewApproach | null>(null)

  if (answered !== null) {
    // WHAT THE ROOM MADE OF IT, not whether they got the job — the offer is
    // a separate card, and the gap between the two is most of what an
    // interview feels like.
    const outcome = interviewOutcomeOf(answered, true, variant)
    return (
      <div className="work-card">
        <div className="work-top">
          <span className="k">Interview</span>
          <span className="title">{role}</span>
        </div>
        <div className="work-outcome">
          <div className="work-otitle">You said your piece</div>
          <div className="work-otext">{outcome?.text ?? ''}</div>
          <div className="work-ofoot">They will let you know.</div>
          <button type="button" className="apply primary" onClick={() => onChoose(answered)}>
            Leave the room
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="work-card">
      <div className="work-top">
        <span className="k">Interview</span>
        <span className="title">{role}</span>
      </div>
      <div className="work-stakes">
        <span>◆</span>{' '}
        {stretch ? (
          <>
            This one is <b>a reach</b> — above what you have done
          </>
        ) : (
          <>
            This one is <b>within your record</b>
          </>
        )}
      </div>
      <div className="work-scene">{interviewSituation(variant)}</div>
      <div className="work-opts">
        {INTERVIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="work-opt"
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
