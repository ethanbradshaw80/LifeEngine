/**
 * The wound diagram (M-ARMY2, owner direction).
 *
 * A body, with the injury marked where the simulation actually put it. Every
 * value here is read from the HealthRecord the engine already keeps —
 * ailmentSite, ailmentKind, severity, marks — so the picture cannot say
 * anything the record does not (Law 9: show what matters, invent nothing).
 *
 * Deliberately plain: a diagram, not a wound photograph. It exists so a
 * player can see where they were hit and how bad it is, not for spectacle.
 */

import { effectsOf, CANNOT_RUN_BELOW } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'

/** Where each site sits on the figure, in the SVG's own coordinates. */
const SITE_MARKS: Record<string, { x: number; y: number; r: number }> = {
  head: { x: 50, y: 15, r: 9 },
  chest: { x: 50, y: 44, r: 12 },
  back: { x: 50, y: 52, r: 11 },
  shoulder: { x: 33, y: 34, r: 8 },
  arm: { x: 26, y: 55, r: 8 },
  hand: { x: 21, y: 76, r: 6 },
  leg: { x: 41, y: 100, r: 10 },
  foot: { x: 40, y: 137, r: 6 },
}

function severityWords(severity: number): string {
  if (severity >= 850) return 'grave'
  if (severity >= 720) return 'serious'
  if (severity >= 600) return 'bad'
  if (severity >= 300) return 'healing'
  return 'nearly mended'
}

function severityColour(severity: number): string {
  if (severity >= 850) return '#c0392b'
  if (severity >= 720) return '#d35400'
  if (severity >= 600) return '#c58a1a'
  return '#7f8c8d'
}

/**
 * WHAT THE BODY IS DOING TO THE LIFE, in the words the mockup asks for
 * ("How it's affecting your life right now").
 *
 * Every line is READ from `effectsOf` rather than written for a screen. A
 * sentence the simulation cannot back is a sentence that will eventually be
 * wrong — and this panel exists precisely because the game used to tell a
 * man he was back on his feet while missing a leg.
 */
function lifeEffectLines(world: World, personId: EntityId): readonly string[] {
  const effects = effectsOf(world, personId)
  const lines: string[] = []
  if (effects.mobilityPerMille < CANNOT_RUN_BELOW) {
    lines.push('You cannot run. Anything that needs a sprint is off the table.')
  } else if (effects.mobilityPerMille < 950) {
    lines.push('You walk well enough, but distance and stairs tell on you.')
  }
  if (effects.barsPhysicalWork) {
    lines.push('The trades are closed to you — labouring, carpentry, the sites.')
  }
  if (effects.fitnessCeilingPerMille < 1000) {
    lines.push(
      `However hard you train, your condition tops out around ${String(Math.floor(effects.fitnessCeilingPerMille / 10))}% of what it was.`,
    )
  }
  if (effects.painLoad >= 300) {
    lines.push('Chronic pain drags at your energy and your mood on the bad days.')
  } else if (effects.painLoad > 0) {
    lines.push('It aches when the weather turns.')
  }
  if (effects.needsAid) lines.push('You get around with an aid.')
  return lines
}

export function BodyDiagram({ world, personId }: { world: World; personId: EntityId }) {
  const record = world.health.get(personId)
  /**
   * THE DIAGRAM OUTLIVES THE WOUND (owner, playing: "I just lost my leg in
   * war and I rested and healed right back up... no past wounds no nothing").
   *
   * This used to return null the moment `ailment === null`, so the picture
   * showed only what was CURRENTLY hurting. An amputee whose stump had
   * healed had no active ailment — and therefore no diagram at all, no
   * marks, nothing. The body forgot the single most important thing that had
   * ever happened to it, on exactly the screen built to remember.
   */
  if (!record) return null
  const permanent = record.permanent
  if (record.ailment === null && permanent.length === 0) return null

  const site = record.ailmentSite
  const mark = site === null ? null : SITE_MARKS[site]
  const colour = record.ailment === null ? '#c0392b' : severityColour(record.severity)
  const effectLines = lifeEffectLines(world, personId)

  return (
    <div className="wound-diagram">
      <svg viewBox="0 0 100 150" role="img" aria-label={`Injury to the ${site ?? 'body'}`}>
        {/* The figure: head, torso, arms, legs. Neutral and schematic. */}
        <g className="figure" fill="none" strokeWidth="2" strokeLinecap="round">
          <circle cx="50" cy="15" r="9" />
          <path d="M50 24 L50 78" />
          <path d="M50 34 L30 55 L22 74" />
          <path d="M50 34 L70 55 L78 74" />
          <path d="M50 78 L40 110 L38 136" />
          <path d="M50 78 L60 110 L62 136" />
        </g>
        {/* PERMANENT FIRST, and always — these are the marks the body keeps.
            Drawn as an open ring rather than a filled dot so a wound that
            has healed into a disability does not read as a fresh one. */}
        {permanent.map((condition) => {
          const spot = condition.site === null ? null : SITE_MARKS[condition.site]
          if (!spot) return null
          return (
            <circle
              key={`${condition.kind}-${String(condition.site)}-${String(condition.sinceTick)}`}
              cx={spot.x}
              cy={spot.y}
              r={spot.r}
              fill="none"
              stroke="#c0392b"
              strokeWidth="2.5"
              opacity="0.9"
            />
          )
        })}
        {mark && record.ailment !== null && (
          <>
            <circle className="wound-halo" cx={mark.x} cy={mark.y} r={mark.r + 4} fill={colour} opacity="0.18" />
            <circle cx={mark.x} cy={mark.y} r={mark.r} fill={colour} opacity="0.85" />
          </>
        )}
      </svg>
      <div className="wound-detail">
        {/* WHAT IS WRONG, and the healed-but-permanent case has to lead —
            otherwise a man with no active ailment fell through this chain
            and was labelled "An illness", which is how the screen ends up
            lying about the thing it exists to report. */}
        {record.ailment !== null ? (
          <>
            <p className="wound-headline" style={{ color: colour }}>
              {record.ailmentKind === null
                ? record.ailment === 'injury'
                  ? 'An injury'
                  : 'An illness'
                : String(record.ailmentKind).replace(/-/g, ' ')}
              {site === null ? '' : ` — the ${site}`}
            </p>
            <p className="muted small">{severityWords(record.severity)}</p>
          </>
        ) : (
          <p className="wound-headline" style={{ color: colour }}>
            {permanent
              .map(
                (condition) =>
                  `${String(condition.kind).replace(/-/g, ' ')}${condition.site === null ? '' : ` — the ${condition.site}`}`,
              )
              .join('; ')}
          </p>
        )}
        {permanent.length > 0 && (
          <p className="muted small">
            {permanent.every((c) => (c.adaptedAtTick ?? null) !== null)
              ? 'permanent · fitted'
              : 'permanent'}
          </p>
        )}
        {/* HOW IT IS AFFECTING YOUR LIFE RIGHT NOW (the mockup's own
            heading). Read from the effects taxonomy, never written here. */}
        {effectLines.length > 0 && (
          <ul className="wound-effects">
            {effectLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {record.marks.length > 0 && (
          <ul className="wound-marks">
            {record.marks.map((m) => (
              <li key={m} className="muted small">
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
