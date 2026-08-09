/**
 * AN ENGAGEMENT, PLAYED OUT IN BEATS (owner's
 * `combat_tours_revamp.html` — the star of the mockup).
 *
 * The engine has run sequences since phase 3; this is the screen that
 * plays them. Without it a contact still resolved through the one-shot
 * scene sheet, which means the whole sequence model was invisible — and an
 * invisible model is indistinguishable from not having built it.
 *
 * The shape: a header saying where in the sequence this is, the situation,
 * and — only on a decision beat — the three answers. Everything else is
 * read and continue, because a consequence you have to acknowledge lands
 * differently from one that scrolls past.
 */

import type { ReactElement } from 'react'
import type { BeatKind, SceneChoice, Threat } from '@life-engine/engine'

const THREAT_WORDS: Readonly<Record<Threat, string>> = {
  light: 'contact',
  heavy: 'under fire',
  overrun: 'in danger of being overrun',
}

const BEAT_TITLES: Readonly<Record<BeatKind, string>> = {
  contact: 'Contact',
  orient: 'What you can see',
  decision: 'Your call',
  consequence: 'What it did',
  followon: 'And now this',
  after: 'After action',
}

export function EngagementView({
  beat,
  step,
  total,
  threat,
  situation,
  labels,
  onChoose,
  onContinue,
}: {
  readonly beat: BeatKind
  readonly step: number
  readonly total: number
  readonly threat: Threat
  readonly situation: string
  /** Present only on a beat that asks something. */
  readonly labels: Readonly<Record<SceneChoice, string>> | null
  readonly onChoose: (choice: SceneChoice) => void
  readonly onContinue: () => void
}): ReactElement {
  return (
    <div className="eng">
      <div className="eng-hd">
        <div className="k">{THREAT_WORDS[threat]}</div>
        <div className="t">{BEAT_TITLES[beat]}</div>
        {/* WHERE IN THE SEQUENCE. A player who cannot tell whether this is
            the middle or the end is reading popups again. */}
        <div className="eng-pips">
          {Array.from({ length: total }, (_unused, i) => (
            <span key={i} className={i < step ? 'done' : i === step ? 'on' : ''} />
          ))}
        </div>
      </div>

      <p className={`eng-sit t-${threat}`}>{situation}</p>

      {labels === null ? (
        <button type="button" className="eng-go" onClick={onContinue}>
          {beat === 'after' ? 'Close it out' : 'Go on'}
        </button>
      ) : (
        <div className="eng-opts">
          {(['push', 'hold', 'cover'] as const).map((choice) => (
            <button key={choice} type="button" className={`eng-opt ${choice}`} onClick={() => onChoose(choice)}>
              {labels[choice]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
