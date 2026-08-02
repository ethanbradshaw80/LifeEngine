/**
 * BADGE MARKS — one drawing per badge, no two alike.
 *
 * The rule these obey is the charter's: a real branch may be NAMED and its
 * insignia never reproduced. So none of these is a copy of a real badge —
 * including the SENIORITY marks, which is a line worth stating because the
 * obvious way to draw "senior" is a star above the device, and that is how
 * the real senior badges are built. These use a bar and an arc instead.
 * Each is an invented mark built from the plain object the badge is about —
 * a canopy, a crosshair, an anchor, a torch — which is what makes them
 * legible at a glance and different from each other.
 *
 * Every badge the engine can grant has its own entry. A badge added later
 * without one falls through to a lettered plate, which is ugly on purpose:
 * it should be obvious that a mark is missing.
 */

import type { JSX } from 'react'

const GOLD = '#c9a227'
const STEEL = '#c9c4b4'
const SKY = '#9fb8c8'
const RUST = '#b0704a'
const MOSS = '#7f9a6a'
const BONE = '#e6e0cf'
const RED = '#b6493c'

const OUTLINE = { stroke: 'rgba(0,0,0,0.5)', strokeWidth: 0.8 }

/** A pair of swept wings — the common root of every flight-side mark. */
function Wings({ fill }: { readonly fill: string }): JSX.Element {
  return (
    <g fill={fill} {...OUTLINE}>
      <path d="M44 22 L8 16 Q2 20 8 26 L44 26 Z" />
      <path d="M56 22 L92 16 Q98 20 92 26 L56 26 Z" />
    </g>
  )
}

/** An arc tab, with the name across it. Tabs are worn, so tabs read as words. */
function Tab({ text, fill }: { readonly text: string; readonly fill: string }): JSX.Element {
  return (
    <g>
      <path d="M6 36 Q50 6 94 36 L94 42 Q50 14 6 42 Z" fill={fill} {...OUTLINE} />
      <text
        x="50"
        y="32"
        textAnchor="middle"
        fontSize={text.length > 9 ? 9 : 11}
        fontWeight="800"
        letterSpacing="0.5"
        fill="#17140d"
      >
        {text}
      </text>
    </g>
  )
}

const MARKS: Record<string, JSX.Element> = {
  // --- Jump status: a canopy, and what is added for time on it. ------------
  parachutist: (
    <g>
      <Wings fill={STEEL} />
      <path d="M50 6 Q60 6 62 15 L38 15 Q40 6 50 6 Z" fill={BONE} {...OUTLINE} />
      <path d="M40 15 L48 24 M60 15 L52 24" stroke="#2b2b2b" strokeWidth="1.2" fill="none" />
      <circle cx="50" cy="26" r="2.6" fill={BONE} {...OUTLINE} />
    </g>
  ),
  'senior parachutist': (
    <g>
      <Wings fill={STEEL} />
      <path d="M50 10 Q60 10 62 18 L38 18 Q40 10 50 10 Z" fill={BONE} {...OUTLINE} />
      <path d="M40 18 L48 26 M60 18 L52 26" stroke="#2b2b2b" strokeWidth="1.2" fill="none" />
      <rect x="34" y="31" width="32" height="3.4" rx="1.7" fill={GOLD} {...OUTLINE} />
      <circle cx="50" cy="32.7" r="3" fill={GOLD} {...OUTLINE} />
    </g>
  ),
  jumpmaster: (
    <g>
      <Wings fill={STEEL} />
      <path d="M50 12 Q59 12 61 19 L39 19 Q41 12 50 12 Z" fill={BONE} {...OUTLINE} />
      <path d="M50 2 L52 7 L57 7 L53 10 L55 15 L50 12 L45 15 L47 10 L43 7 L48 7 Z" fill={GOLD} {...OUTLINE} />
      <path d="M34 10 Q50 -2 66 10" fill="none" stroke={GOLD} strokeWidth="2" />
    </g>
  ),
  'military freefall': (
    <g>
      <Wings fill={SKY} />
      {/* A figure in the arch position — freefall, not canopy. */}
      <circle cx="50" cy="9" r="3.2" fill={BONE} {...OUTLINE} />
      <path d="M50 12 L50 20 M50 14 L41 10 M50 14 L59 10 M50 20 L44 26 M50 20 L56 26" stroke={BONE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  ),
  'air assault': (
    <g>
      <Wings fill={MOSS} />
      {/* Rotors over a fuselage. */}
      <rect x="26" y="9" width="48" height="2.4" rx="1.2" fill={BONE} {...OUTLINE} />
      <path d="M42 13 Q50 10 58 13 L62 20 L38 20 Z" fill={BONE} {...OUTLINE} />
      <path d="M50 11 L50 13" stroke="#2b2b2b" strokeWidth="1.4" />
    </g>
  ),
  // --- Flight trades. ------------------------------------------------------
  'aviator wings': (
    <g>
      <Wings fill={SKY} />
      <path d="M50 6 L60 10 L60 20 Q60 27 50 30 Q40 27 40 20 L40 10 Z" fill={BONE} {...OUTLINE} />
      <path d="M50 12 L53 20 L50 26 L47 20 Z" fill="#2b2b2b" />
    </g>
  ),
  'senior aviator': (
    <g>
      <Wings fill={SKY} />
      <path d="M50 10 L59 13 L59 22 Q59 28 50 31 Q41 28 41 22 L41 13 Z" fill={BONE} {...OUTLINE} />
      <path d="M50 15 L53 22 L50 27 L47 22 Z" fill="#2b2b2b" />
      <path d="M30 34 Q50 40 70 34" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  'aircrew wings': (
    <g>
      <Wings fill={STEEL} />
      <circle cx="50" cy="18" r="9" fill={BONE} {...OUTLINE} />
      <circle cx="50" cy="18" r="3.4" fill="#2b2b2b" />
    </g>
  ),
  // --- Water, and the ships on it. ----------------------------------------
  'combat diver': (
    <g>
      {/* A helmet: dome, faceplate, air line. */}
      <path d="M32 30 Q32 8 50 8 Q68 8 68 30 Z" fill={SKY} {...OUTLINE} />
      <ellipse cx="50" cy="21" rx="9" ry="7" fill="#16202a" {...OUTLINE} />
      <path d="M44 21 Q50 17 56 21" stroke={BONE} strokeWidth="1.4" fill="none" />
      <rect x="30" y="30" width="40" height="5" rx="2" fill={STEEL} {...OUTLINE} />
      <path d="M68 14 Q80 12 84 22" stroke={STEEL} strokeWidth="2.4" fill="none" />
    </g>
  ),
  'seamanship rating': (
    <g stroke="rgba(0,0,0,0.5)" strokeWidth="0.8">
      {/* An anchor. */}
      <circle cx="50" cy="7" r="4" fill="none" stroke={STEEL} strokeWidth="3" />
      <path d="M50 11 L50 36" stroke={STEEL} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M36 15 L64 15" stroke={STEEL} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 26 Q34 38 50 38 Q66 38 70 26" fill="none" stroke={STEEL} strokeWidth="3.4" strokeLinecap="round" />
    </g>
  ),
  // --- Marksmanship. -------------------------------------------------------
  'sniper qualified': (
    <g>
      <circle cx="50" cy="22" r="15" fill="none" stroke={MOSS} strokeWidth="3" />
      <path d="M50 3 L50 41 M31 22 L69 22" stroke={MOSS} strokeWidth="2" />
      <circle cx="50" cy="22" r="3" fill={RED} {...OUTLINE} />
      <path d="M36 8 L44 16 M64 8 L56 16" stroke={MOSS} strokeWidth="2" />
    </g>
  ),
  'expert marksman': (
    <g>
      <circle cx="50" cy="20" r="14" fill={BONE} {...OUTLINE} />
      <circle cx="50" cy="20" r="9" fill={RUST} {...OUTLINE} />
      <circle cx="50" cy="20" r="4" fill={RED} {...OUTLINE} />
      <rect x="28" y="34" width="44" height="6" rx="2" fill={STEEL} {...OUTLINE} />
    </g>
  ),
  // --- The trades. ---------------------------------------------------------
  'master driver': (
    <g>
      <circle cx="50" cy="20" r="15" fill="none" stroke={STEEL} strokeWidth="5" />
      <circle cx="50" cy="20" r="4" fill={STEEL} {...OUTLINE} />
      <path d="M50 16 L50 6 M46 23 L38 31 M54 23 L62 31" stroke={STEEL} strokeWidth="3" strokeLinecap="round" />
      <rect x="30" y="36" width="40" height="5" rx="2" fill={GOLD} {...OUTLINE} />
    </g>
  ),
  'master mechanic': (
    <g fill={STEEL} {...OUTLINE}>
      {/* A gear and a spanner across it. */}
      <path d="M50 6 L55 9 L61 8 L63 14 L68 18 L65 23 L66 29 L60 31 L56 36 L50 34 L44 36 L40 31 L34 29 L35 23 L32 18 L37 14 L39 8 L45 9 Z" />
      <circle cx="50" cy="21" r="6" fill="#1b1b1b" stroke="none" />
      <path d="M74 8 L84 18 L80 22 L70 12 Z" fill={GOLD} />
    </g>
  ),
  'senior signals rating': (
    <g fill="none" stroke={SKY} strokeWidth="2.6" strokeLinecap="round">
      {/* A mast throwing arcs. */}
      <path d="M50 38 L50 12" />
      <path d="M42 38 L58 38" />
      <circle cx="50" cy="9" r="3" fill={SKY} />
      <path d="M60 6 Q68 14 60 22" />
      <path d="M68 2 Q80 14 68 26" />
      <path d="M40 6 Q32 14 40 22" />
      <path d="M32 2 Q20 14 32 26" />
    </g>
  ),
  // --- Medicine. -----------------------------------------------------------
  'field trauma certification': (
    <g>
      <rect x="34" y="6" width="32" height="32" rx="4" fill={BONE} {...OUTLINE} />
      <path d="M46 11 L54 11 L54 18 L61 18 L61 26 L54 26 L54 33 L46 33 L46 26 L39 26 L39 18 L46 18 Z" fill={RED} {...OUTLINE} />
    </g>
  ),
  'combat medic': (
    <g>
      <path d="M50 4 Q66 10 66 22 Q66 34 50 40 Q34 34 34 22 Q34 10 50 4 Z" fill={MOSS} {...OUTLINE} />
      <path d="M47 11 L53 11 L53 19 L61 19 L61 25 L53 25 L53 33 L47 33 L47 25 L39 25 L39 19 L47 19 Z" fill={BONE} {...OUTLINE} />
    </g>
  ),
  // --- The loud trades. ----------------------------------------------------
  'explosive ordnance disposal': (
    <g>
      {/* A shell, nose down, with the fins up. */}
      <path d="M50 40 Q40 30 40 20 Q40 10 50 4 Q60 10 60 20 Q60 30 50 40 Z" fill={STEEL} {...OUTLINE} />
      <path d="M40 12 L30 6 L34 16 Z" fill={RUST} {...OUTLINE} />
      <path d="M60 12 L70 6 L66 16 Z" fill={RUST} {...OUTLINE} />
      <path d="M50 14 L54 22 L50 30 L46 22 Z" fill={RED} {...OUTLINE} />
    </g>
  ),
  pathfinder: (
    <g>
      {/* A torch — the people who mark the ground for everyone behind. */}
      <path d="M50 4 Q57 12 53 18 Q60 16 58 24 Q56 32 50 32 Q44 32 42 24 Q40 16 47 18 Q43 12 50 4 Z" fill={GOLD} {...OUTLINE} />
      <rect x="46" y="31" width="8" height="10" rx="2" fill={RUST} {...OUTLINE} />
      <path d="M36 40 L64 40" stroke={RUST} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  'small-unit leader': (
    <g fill={GOLD} {...OUTLINE}>
      {/* Chevrons. The mark of the man who is responsible for the others. */}
      <path d="M22 34 L50 18 L78 34 L78 40 L50 24 L22 40 Z" />
      <path d="M22 22 L50 6 L78 22 L78 28 L50 12 L22 28 Z" />
    </g>
  ),
  // --- Combat badges. Earned by being shot at, once, ever. -----------------
  'the Combat Infantryman Badge': (
    <g>
      {/* A rifle on a wreath — the oldest shape there is for this. */}
      <path d="M18 30 Q50 44 82 30" fill="none" stroke={MOSS} strokeWidth="4" strokeLinecap="round" />
      <rect x="20" y="18" width="60" height="4" rx="2" fill={STEEL} {...OUTLINE} />
      <path d="M30 22 L36 22 L34 27 L32 27 Z" fill={STEEL} {...OUTLINE} />
      <path d="M66 16 L78 16 L78 20 L66 20 Z" fill={STEEL} {...OUTLINE} />
      <rect x="24" y="14" width="6" height="4" rx="1" fill={STEEL} {...OUTLINE} />
    </g>
  ),
  'the Combat Action Badge': (
    <g>
      {/* A bayonet and a grenade, crossed — the trades that are not rifles. */}
      <path d="M20 34 L62 10" stroke={STEEL} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M62 10 L70 6 L66 16 Z" fill={STEEL} {...OUTLINE} />
      <circle cx="34" cy="16" r="8" fill={MOSS} {...OUTLINE} />
      <rect x="31" y="5" width="6" height="5" rx="1.5" fill={STEEL} {...OUTLINE} />
      <path d="M18 34 Q50 44 82 34" fill="none" stroke={MOSS} strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  'the Combat Medical Badge': (
    <g>
      {/* A cross on a stretcher rail. */}
      <path d="M18 32 Q50 42 82 32" fill="none" stroke={MOSS} strokeWidth="4" strokeLinecap="round" />
      <path d="M46 6 L54 6 L54 14 L62 14 L62 21 L54 21 L54 29 L46 29 L46 21 L38 21 L38 14 L46 14 Z" fill={BONE} {...OUTLINE} />
      <path d="M50 10 L50 25 M43 17.5 L57 17.5" stroke={RED} strokeWidth="2" />
    </g>
  ),
  // --- The tabs. Words, because a tab is a word. ---------------------------
  ranger: <Tab text="RANGER" fill={GOLD} />,
  'special forces': <Tab text="SPECIAL FORCES" fill={MOSS} />,
  'mountain warfare': <Tab text="MOUNTAIN" fill={SKY} />,
  'SERE qualified': <Tab text="SERE" fill={STEEL} />,
}

export function BadgeMark({ badge }: { readonly badge: string }): JSX.Element {
  const mark = MARKS[badge]
  return (
    <svg viewBox="0 0 100 44" className="badge-mark" role="img" aria-label={badge}>
      {mark ?? (
        <g>
          <rect x="18" y="8" width="64" height="28" rx="3" fill="#4a4a4a" {...OUTLINE} />
          <text x="50" y="27" textAnchor="middle" fontSize="10" fontWeight="700" fill={BONE}>
            {badge.slice(0, 8).toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  )
}
