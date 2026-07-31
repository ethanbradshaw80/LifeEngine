/**
 * Deterministic portraits. Presentation only — lives in the app, never the
 * engine, and derives everything from person state, so the same person always
 * wears the same face on every machine (the visual cousin of the golden-seed
 * rule). No RNG: hashes of the entity id pick from small palettes.
 *
 * Style: flat geometric — a head, hair, shoulders. Deliberately simple; the
 * game's richness is in the stories, and a too-detailed avatar would promise
 * visual depth the simulation does not model.
 */

import { ageAt } from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'

const SKIN = ['#f2c9a0', '#eab98b', '#d9a066', '#c68642', '#a06a3c', '#8d5524', '#f4d3b3']
const HAIR = ['#2f2321', '#4a3325', '#6b4a2f', '#8c5f3b', '#a8834f', '#5b5b5b', '#1f1f2e', '#7b3f2a']
const SHIRT = ['#4a6d8c', '#6d8c4a', '#8c4a5e', '#7a5c8c', '#8c6f4a', '#4a8c7d', '#5e6d8c', '#8c8c4a']
const ELDER_HAIR = ['#cfcfcf', '#bdbdbd', '#e8e2d5']

/** Small integer hash, stable forever — changing it changes every face. */
function hash(id: number, salt: number): number {
  let h = (id * 2654435761 + salt * 97) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b) >>> 0
  return h >>> 0
}

function pick<T>(items: readonly T[], id: number, salt: number): T {
  const item = items[hash(id, salt) % items.length]
  return item as T
}

interface Props {
  readonly world: World
  readonly person: Person
  readonly size?: number
}

export function Avatar({ world, person, size = 64 }: Props) {
  const age = ageAt(person.birthTick, person.deathTick ?? world.tick)
  const dead = person.deathTick !== null

  const skin = pick(SKIN, person.id, 1)
  const hair = age >= 62 ? pick(ELDER_HAIR, person.id, 2) : pick(HAIR, person.id, 2)
  const shirt = pick(SHIRT, person.id, 3)
  const longHair = person.sex === 'female' ? hash(person.id, 4) % 4 !== 0 : hash(person.id, 4) % 8 === 0
  const child = age < 15

  // Children: smaller head, higher in frame. Elders keep their face; only the
  // hair says the years. The dead are greyscale — history, not presence.
  const headR = child ? 15 : 17
  const cy = child ? 26 : 24

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={`${person.givenName} ${person.familyName}`}
      style={dead ? { filter: 'grayscale(1)', opacity: 0.75 } : undefined}
    >
      <circle cx="32" cy="32" r="31" fill={shirt} opacity="0.18" />
      {/* shoulders */}
      <path d={`M 12 64 Q 32 ${child ? 48 : 44} 52 64 Z`} fill={shirt} />
      {/* head */}
      <circle cx="32" cy={cy} r={headR} fill={skin} />
      {/* hair cap */}
      <path
        d={`M ${32 - headR} ${cy - 2} A ${headR} ${headR} 0 0 1 ${32 + headR} ${cy - 2} L ${32 + headR} ${cy - headR / 3} A ${headR} ${headR} 0 0 0 ${32 - headR} ${cy - headR / 3} Z`}
        fill={hair}
      />
      {longHair && (
        <path
          d={`M ${32 - headR} ${cy - 4} Q ${32 - headR - 4} ${cy + 14} ${32 - headR + 3} ${cy + 18} L ${32 - headR + 5} ${cy} Z
              M ${32 + headR} ${cy - 4} Q ${32 + headR + 4} ${cy + 14} ${32 + headR - 3} ${cy + 18} L ${32 + headR - 5} ${cy} Z`}
          fill={hair}
        />
      )}
      {/* eyes */}
      <circle cx={32 - 6} cy={cy + 1} r="1.7" fill="#2b2b2b" />
      <circle cx={32 + 6} cy={cy + 1} r="1.7" fill="#2b2b2b" />
      {/* mouth: a quiet line; the feed carries the emotion */}
      <path
        d={`M ${32 - 4} ${cy + 8} Q 32 ${cy + 10} ${32 + 4} ${cy + 8}`}
        stroke="#2b2b2b"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
