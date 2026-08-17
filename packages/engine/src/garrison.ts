/**
 * PEACETIME THAT CAN HURT YOU, AND PEOPLE WHO ARE YOURS.
 * (MILITARY_DEPTH_PLAN §10.3, §10.5, §10.6.)
 *
 * §10.5's premise, checked before building: nothing in garrison can hurt you
 * today. Deployment has illness, wounds and death; home station has a field
 * exercise that produces a line of flavour text and nothing else. That is why
 * a decade of peace reads as ten identical years — §10.9 names exactly that
 * risk and asks for it to be measured.
 *
 * THREE THINGS, and they are deliberately in one module because they are one
 * mechanism seen from three angles: the years between wars have to be able to
 * cost something.
 *
 *   §10.5 TRAINING ACCIDENTS AND THE DRIVE HOME. A rollover on an exercise, a
 *   range accident, an aircraft mishap — and off-duty vehicle deaths, which
 *   are one of the great quiet killers of peacetime militaries and kill more
 *   soldiers in peace than anything else on this list. It gives a cook, a
 *   clerk or a mechanic a career that can go wrong without pretending they
 *   were in a firefight.
 *
 *   §10.6 OFF-DUTY TROUBLE. `article15.ts` exists and peacetime is when it
 *   should be firing. What feeds it today is thin. Drink, debt, a bad
 *   marriage, a fight outside a bar by the gate — and BOREDOM MODELLED
 *   HONESTLY, because long stretches with nothing happening are when people
 *   get into trouble. That is a real finding and not a joke.
 *
 *   §10.3 COMMAND. Rank is a number and a pay grade; it should mean PEOPLE
 *   ARE YOURS. A named subset of the roster you answer for, whose trouble
 *   becomes your trouble — and when one of them dies, you are the one who
 *   writes the letter.
 *
 * WHAT IS DELIBERATELY NOT HERE: any of this reaching for the player's
 * pending slot except at the one moment that deserves it (the letter). §10.9's
 * honest risk cuts both ways — a peacetime that interrupts every month is
 * worse than one that never does.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { rankTitle } from './service.js'
import { unitKeyOf } from './unitawards.js'
import type { World } from './types.js'

/**
 * §10.3. THE PEOPLE WHO ARE YOURS.
 *
 * Everybody in your unit junior to you, capped at what one person can
 * actually answer for. A squad leader has a squad; a first sergeant has a
 * company and does not know all their names, which is why the cap exists and
 * why it grows with rank rather than being unlimited.
 */
export function subordinatesOf(world: World, personId: EntityId): readonly EntityId[] {
  const own = world.service.get(personId)
  if (own === undefined || own.dischargedAtTick !== null) return []
  // Below E-5 nobody is yours. That is the same line the team leader uses.
  if (own.rank < 5 && own.commissioned !== true) return []
  const key = unitKeyOf(world, personId)
  if (key === null) return []

  const junior: { personId: EntityId; rank: number }[] = []
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (record.personId === personId) continue
    if (unitKeyOf(world, record.personId) !== key) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    if (record.rank >= own.rank && own.commissioned !== true) continue
    junior.push({ personId: record.personId, rank: record.rank })
  }
  // THE SENIOR OF THE JUNIOR FIRST, because that is who you deal with, and a
  // cap that grows with rank: four at sergeant, more at first sergeant.
  junior.sort((a, b) => b.rank - a.rank || a.personId - b.personId)
  const cap = own.commissioned === true ? 12 : Math.min(12, 3 + own.rank)
  return junior.slice(0, cap).map((each) => each.personId)
}

/** Whether this person answers for anybody at all. */
export function holdsCommand(world: World, personId: EntityId): boolean {
  return subordinatesOf(world, personId).length > 0
}

/**
 * §10.6. HOW LITTLE HAS HAPPENED LATELY, 0–1000.
 *
 * BOREDOM MODELLED HONESTLY. Read from the record rather than asserted: months
 * since anything at all was written about this person. A garrison year with a
 * school, an exercise and a promotion in it is not boring; three years of
 * nothing is, and that is when people get into trouble.
 */
export function tediumOf(world: World, personId: EntityId, tick: Tick): number {
  let last = 0
  for (const event of world.events) {
    if (event.subjectId !== personId) continue
    if (event.tick > tick) continue
    if (event.tick > last) last = event.tick
  }
  const quiet = Math.max(0, tick - last)
  // Two years of silence is the top of the scale. Past that it does not get
  // worse; it is already as empty as a life gets.
  return Math.min(1000, Math.floor((quiet * 1_000) / 24)
  )
}

/** What can go wrong on a quiet month, and what it is called on the record. */
const MISHAPS: readonly { readonly id: string; readonly words: string; readonly severity: number }[] = [
  {
    id: 'rollover',
    words: 'a vehicle rollover on a night move, with the truck on its side in a ditch and everybody in the back',
    severity: 620,
  },
  {
    id: 'range',
    words: 'a range accident — a short round, and nobody agreeing afterwards about who called what',
    severity: 540,
  },
  {
    id: 'drop',
    words: 'a bad landing on a jump, in wind that should have scrubbed the lift',
    severity: 480,
  },
  {
    id: 'crush',
    words: 'a load shifting during a lift, and a hand where the load used to be',
    severity: 430,
  },
  {
    id: 'heat',
    words: 'a heat casualty on a road march, found sitting down and talking nonsense',
    severity: 500,
  },
  {
    id: 'aircraft',
    words: 'an aircraft mishap on a training sortie, which is the way this trade actually kills people',
    severity: 780,
  },
]

/** Off duty, on the road home. The great quiet killer of peacetime armies. */
const ROAD_SEVERITY = 700

/**
 * PEACETIME, RUN.
 *
 * Home station only — anybody deployed has the war's own machinery and does
 * not need a second one. The rates are deliberately small per month, because
 * they compound over a twenty-year career and a career is what this is for.
 */
export function runGarrison(
  world: World,
  tick: Tick,
  hurt: (personId: EntityId, severity: number, context: string, mishap: string) => void,
): void {
  for (const record of [...world.service.values()].sort((a, b) => a.personId - b.personId)) {
    if (record.dischargedAtTick !== null) continue
    const person = world.people.get(record.personId)
    if (person === undefined || person.deathTick !== null) continue
    // Deployed people are the war's business.
    const tours = world.deployments.get(record.personId) ?? []
    if (tours.some((tour) => tour.returnedAtTick === null)) continue

    const rng = openStream(world.seed, Stream.Service, record.personId, tick + 91_000)

    /**
     * §10.5 THE TRAINING ACCIDENT. About one man in three hundred a month
     * has something go wrong on an exercise, which over a twenty-year career
     * is most of a unit having been in something at some point — which is
     * true of a real unit and is the point.
     */
    if (rng.chance(3, 1_000)) {
      const mishap = rng.pick(MISHAPS)
      {
        recordEvent(world, tick, {
          type: 'training-accident',
          subjectId: record.personId,
          detail: mishap.words,
        })
        hurt(record.personId, mishap.severity, 'training', mishap.id)
      }
      continue
    }

    /**
     * §10.5 THE DRIVE HOME. Off duty, on a road, at the end of a long week.
     * It is not heroic and it is not in a war, and it is how a great many
     * soldiers actually die in peacetime.
     */
    if (rng.chance(1, 1_000)) {
      recordEvent(world, tick, {
        type: 'off-duty-accident',
        subjectId: record.personId,
        detail: 'a car on the road back to post, late, on a Sunday night',
      })
      hurt(record.personId, ROAD_SEVERITY, 'off-duty', 'road')
      continue
    }

    /**
     * §10.6 OFF-DUTY TROUBLE, and boredom is an input rather than a joke.
     * The tedium read is what makes a quiet posting dangerous to a career:
     * nothing to do, a bar by the gate, and a Monday morning.
     */
    const tedium = tediumOf(world, record.personId, tick)
    const bored = 2 + Math.floor(tedium / 120)
    if (rng.chance(bored, 1_000)) {
      const flavour =
        tedium > 600
          ? 'a fight outside a bar by the gate, on the third quiet weekend in a row'
          : rng.chance(1, 2)
            ? 'drink, and a Monday morning that went badly'
            : 'money trouble that came to the orderly room'
      recordEvent(world, tick, {
        type: 'off-duty-trouble',
        subjectId: record.personId,
        detail: flavour,
      })
      recordDecision(world, tick, {
        subjectId: record.personId,
        decision: 'discipline',
        significance: 'notable',
        inputs: [factor('own-choice', 600), factor('idle-posting', tedium)],
        chosen: flavour,
        rejected: [],
        streamId: Stream.Service,
      })

      /**
       * §10.3 AND IT LANDS ON WHOEVER ANSWERS FOR HIM. "Their problems become
       * yours" is not flavour if it is on the record of the man above him —
       * which is what the unit's grade then reads.
       */
      const above = superiorOf(world, record.personId)
      if (above !== null) {
        recordEvent(world, tick, {
          type: 'answered-for-one-of-yours',
          subjectId: above,
          otherId: record.personId,
          detail: flavour,
        })
      }
    }
  }
}

/** Whoever answers for this person — the junior-most senior in their unit. */
export function superiorOf(world: World, personId: EntityId): EntityId | null {
  const own = world.service.get(personId)
  if (own === undefined || own.dischargedAtTick !== null) return null
  const key = unitKeyOf(world, personId)
  if (key === null) return null
  let best: { personId: EntityId; rank: number } | null = null
  for (const record of world.service.values()) {
    if (record.dischargedAtTick !== null) continue
    if (record.personId === personId) continue
    if (unitKeyOf(world, record.personId) !== key) continue
    if (world.people.get(record.personId)?.deathTick !== null) continue
    if (record.rank <= own.rank) continue
    // The man immediately above, not the most senior in the building.
    if (best === null || record.rank < best.rank) best = { personId: record.personId, rank: record.rank }
  }
  return best?.personId ?? null
}

/**
 * §10.3. THE LETTER.
 *
 * "When one of yours dies, you are the one who writes the letter. That is the
 * moment the whole system is for, and it is impossible without §9.0."
 *
 * Written as a document, to a named family, about a named person. The engine
 * records that it was written; the words are composed on read like every other
 * document in the game.
 */
export function letterFor(
  world: World,
  writerId: EntityId,
  deadId: EntityId,
): readonly string[] | null {
  const writer = world.people.get(writerId)
  const dead = world.people.get(deadId)
  if (writer === undefined || dead === undefined || dead.deathTick === null) return null
  const theirs = world.service.get(deadId)
  const mine = world.service.get(writerId)
  const rank =
    theirs === undefined
      ? ''
      : `${rankTitle(world, theirs.branch, theirs.rank, theirs.commissioned === true)} `
  const signature =
    mine === undefined
      ? `${writer.givenName} ${writer.familyName}`
      : `${rankTitle(world, mine.branch, mine.rank, mine.commissioned === true)} ${writer.givenName} ${writer.familyName}`

  return [
    `I am writing to you about ${rank}${dead.givenName} ${dead.familyName}, who served under me.`,
    `He was one of mine. I knew him, and I am not going to tell you he was a good soldier and leave it there, because you know better than I do what he was.`,
    `Whatever the official letter tells you, I want you to know that the people he worked beside were with him, and that he was not alone.`,
    `If there is anything I can answer for you, I will answer it honestly.`,
    signature,
  ]
}
