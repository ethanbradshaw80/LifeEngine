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

export function BodyDiagram({ world, personId }: { world: World; personId: EntityId }) {
  const record = world.health.get(personId)
  if (!record || record.ailment === null) return null

  const site = record.ailmentSite
  const mark = site === null ? null : SITE_MARKS[site]
  const colour = severityColour(record.severity)

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
        {mark && (
          <>
            <circle className="wound-halo" cx={mark.x} cy={mark.y} r={mark.r + 4} fill={colour} opacity="0.18" />
            <circle cx={mark.x} cy={mark.y} r={mark.r} fill={colour} opacity="0.85" />
          </>
        )}
      </svg>
      <div className="wound-detail">
        <p className="wound-headline" style={{ color: colour }}>
          {record.ailmentKind === null
            ? record.ailment === 'injury'
              ? 'An injury'
              : 'An illness'
            : String(record.ailmentKind).replace(/-/g, ' ')}
          {site === null ? '' : ` — the ${site}`}
        </p>
        <p className="muted small">{severityWords(record.severity)}</p>
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
