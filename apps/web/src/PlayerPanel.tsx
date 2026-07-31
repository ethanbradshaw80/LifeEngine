/**
 * Everything specific to LIVING a life rather than watching the town:
 * the character picker, the decision prompt, and the retrospective.
 *
 * All of it renders engine state. The prompt text comes from the engine's
 * describePending — the same facts as the records — and the retrospective is
 * lifeStory, the exact text the tests assert on. This file owns no simulation
 * state at all (ADR-0012).
 */

import {
  ageAt,
  describePending,
  fullName,
  heirsOf,
  lifeStory,
  livingPeople,
  personSummary,
} from '@life-engine/engine'
import type { PendingDecision, World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'

// ---------------------------------------------------------------------------
// Character picker
// ---------------------------------------------------------------------------

interface PickerProps {
  readonly world: World
  readonly onPlay: (personId: EntityId) => void
  readonly onCancel: () => void
}

export function CharacterPicker({ world, onPlay, onCancel }: PickerProps) {
  // Young people make the best starts: the education fork, first jobs, and
  // leaving home are all still ahead of them. Sorted youngest last so the
  // person with the most life remaining is easy to find.
  const candidates = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) <= 25)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a life">
      <div className="sheet">
        <h2>Choose a life</h2>
        <p className="muted small">
          You become this person. The world will pause whenever a decision is
          theirs to make — everyone else keeps living on their own.
        </p>
        {candidates.length === 0 ? (
          <p className="muted">Nobody under 26 is alive. Advance time or start a new world.</p>
        ) : (
          <ul className="picker">
            {candidates.map((person) => (
              <li key={person.id}>
                <button type="button" onClick={() => onPlay(person.id)}>
                  {personSummary(world, person.id)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="sheet-actions">
          <button type="button" onClick={onCancel}>
            Keep watching
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The decision prompt
// ---------------------------------------------------------------------------

/** Plain-words labels for the engine's option ids, per decision kind. */
const OPTION_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  education: { college: 'Go to college', trade: 'Trade school', work: 'Go straight to work' },
  'job-offer': { accept: 'Take the job', decline: 'Turn it down' },
  'move-out': { accept: 'Move out', decline: 'Stay home' },
  courtship: { accept: 'See where it goes', decline: 'Stay friends' },
  marriage: { accept: 'Marry them', decline: 'Not yet' },
}

function optionLabel(kind: string, option: string): string {
  return OPTION_LABELS[kind]?.[option] ?? option
}

interface PromptProps {
  readonly world: World
  readonly pending: PendingDecision
  readonly onChoose: (choice: string) => void
}

export function DecisionPrompt({ world, pending, onChoose }: PromptProps) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A decision">
      <div className="sheet">
        <p className="muted small">The world is paused. This one is yours.</p>
        <h2>{describePending(world, pending)}</h2>
        <div className="sheet-actions">
          {pending.options.map((option) => (
            <button
              key={option}
              type="button"
              className={option === pending.options[0] ? 'primary' : ''}
              onClick={() => onChoose(option)}
            >
              {optionLabel(pending.kind, option)}
            </button>
          ))}
        </div>
        <p className="muted small">
          Declined chances are gone — the world moves on, like it does for
          everyone else in it.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The retrospective
// ---------------------------------------------------------------------------

interface RetrospectiveProps {
  readonly world: World
  readonly personId: EntityId
  readonly onPlayHeir: (heirId: EntityId) => void
  readonly onWatch: () => void
}

export function Retrospective({ world, personId, onPlayHeir, onWatch }: RetrospectiveProps) {
  const person = world.people.get(personId)
  const heirs = heirsOf(world, personId)

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A life, remembered">
      <div className="sheet wide">
        <h2>{person ? `${fullName(person)}'s life` : 'A life'}</h2>
        {/* Law 8: the retrospective is generated from the records of the life
            actually lived — the same lifeStory the tests hold to account. */}
        <pre className="story">{lifeStory(world, personId)}</pre>

        {heirs.length > 0 ? (
          <>
            <h3>The story continues</h3>
            <p className="muted small">
              Take up the life of one of {person ? `${fullName(person)}'s` : 'their'} children —
              same town, same family, same history.
            </p>
            <ul className="picker">
              {heirs.map((heirId) => (
                <li key={heirId}>
                  <button type="button" onClick={() => onPlayHeir(heirId)}>
                    {personSummary(world, heirId)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No living children carry the name on.</p>
        )}

        <div className="sheet-actions">
          <button type="button" onClick={onWatch}>
            Watch the town
          </button>
        </div>
      </div>
    </div>
  )
}
