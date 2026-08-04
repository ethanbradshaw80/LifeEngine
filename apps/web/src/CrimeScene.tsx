/**
 * THE CRIME SCENE.
 *
 * The moment the "Do it" button never had. The engine rolls the room and
 * says what it looks like; this draws the tell, the three answers, and the
 * banner whose colour is the one piece of information the player is meant
 * to read before choosing.
 *
 * Every word comes from the engine — the component writes nothing.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import { crimeOutcomeFor } from '@life-engine/engine'
import type { CrimeChoice, CrimeScene, Offence } from '@life-engine/engine'

const DANGER_CLASS: Record<CrimeScene['danger'], string> = {
  quiet: 'is-quiet',
  occupied: 'is-occupied',
  hot: 'is-hot',
}

/**
 * Two stages in one dialog, exactly as the owner's reference draws it: the
 * room and its three answers, then what the answer cost. The outcome is
 * computed by the ENGINE's own pure function, so what the player reads here
 * is the same thing the world is about to do — not a UI-side guess at it.
 */
export function CrimeSceneView({
  scene,
  offence,
  title,
  variant,
  onChoose,
}: {
  readonly scene: CrimeScene
  readonly offence: Offence
  /** The offence, by name. */
  readonly title: string
  /**
   * Which wording out of the scene's pools. Carried from the pending so the
   * outcome follows on from the sentence the player actually read.
   */
  readonly variant: number
  readonly onChoose: (option: string) => void
}): JSX.Element {
  const [answered, setAnswered] = useState<CrimeChoice | null>(null)

  if (answered !== null) {
    const outcome = crimeOutcomeFor(scene.danger, answered, offence, variant)
    const tone =
      outcome.kind === 'clean' ? 'win' : outcome.kind === 'bailed' ? 'warn' : 'bad'
    return (
      <div className="crime-card">
        <div className="crime-top">
          <span className="k">Crime</span>
          <span className="crime-title">{title}</span>
        </div>
        <div className="crime-outcome">
          <div className={`otitle ${tone}`}>{outcome.title}</div>
          <p className="otext">{outcome.text}</p>
          <div className="ofoot">{outcome.consequence}</div>
          <button type="button" className="crime-again" onClick={() => onChoose(answered)}>
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="crime-card">
      <div className="crime-top">
        <span className="k">Crime</span>
        <span className="crime-title">{title}</span>
      </div>

      <div className={`crime-danger ${DANGER_CLASS[scene.danger]}`}>
        <span className="dot" />
        <span>{scene.label} — read the room</span>
      </div>

      <p className="crime-scene-text">{scene.tell}</p>

      <div className="crime-opts">
        {scene.options.map((option) => (
          <button key={option.id} type="button" className="crime-opt" onClick={() => setAnswered(option.id)}>
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
