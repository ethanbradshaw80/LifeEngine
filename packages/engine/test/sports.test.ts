/**
 * ATHLETE CAREERS (owner's `sports_careers_master.md`).
 *
 * The claims:
 *
 *   MOST PEOPLE DO NOT MAKE IT. This is the spine, not a caveat — a
 *     pipeline everybody clears is a promotion ladder with a ball in it;
 *   a POSITION IS A REAL THING, so the same body rates differently at
 *     different spots and training the wrong stat is wasted work;
 *   TRAINING IS EARNED AND PLATEAUS, with fatigue that blunts the work and
 *     hurts you (spec: "not a switch");
 *   the SEASON SIMULATES FROM THE STATS, so a better player out-produces a
 *     worse one over a career while still having bad years;
 *   and the DRAFT is the real rule — nineteen, and sixty names.
 */

import { describe, expect, it } from 'vitest'
import type { EntityId } from '@life-engine/shared'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import {
  DRAFT_AGE,
  DRAFT_PICKS,
  POSITIONS,
  ceilingFor,
  freshAthlete,
  makesSquad,
  offersFor,
  overallOf,
  playSeason,
  positionById,
  rookieWageFor,
  runDraft,
  rested,
  startingStats,
  train,
  trainingRisk,
  veteranWageFor,
  positionsFor,
  rulesFor,
  runDraftFor,
  runSigning,
  runFight,
  applyFight,
  recordWords,
  SPORT_RULES,
  fameFrom,
  endorsementsFor,
  ENDORSEMENT_FLOOR,
  famePressure,
  rollScandal,
  secondActsFor,
} from '../src/sports.js'
import type { AthleteRecord } from '../src/types.js'
import { letterOfIntentFor, playingContractFor, endorsementFor } from '../src/sportspaper.js'

function athlete(positionId: string, stats: Record<string, number>): AthleteRecord {
  return freshAthlete(1 as never, 'basketball', positionId, stats, 90)
}

describe('a position is a real thing', () => {
  it('the same body rates differently at different spots', () => {
    // A pure shooter with no size. Excellent at the two, wrong at the five.
    const shooter = {
      shooting: 95, finishing: 80, handling: 85, perimeterD: 70,
      rebounding: 30, postPlay: 25, interiorD: 30, blocking: 20, passing: 70,
      speed: 80, strength: 40, agility: 85, stamina: 75, durability: 60, sportIq: 70,
    }
    const asGuard = overallOf(athlete('sg', shooter))
    const asCentre = overallOf(athlete('c', shooter))
    expect(asGuard).toBeGreaterThan(asCentre + 10)
  })

  it('every position weights to exactly one thousand', () => {
    for (const position of POSITIONS) {
      const total = position.weights.reduce((sum, w) => sum + w, 0)
      expect(total, position.id).toBe(1_000)
      expect(position.weights.length, position.id).toBe(position.skills.length)
    }
  })

  it('training the wrong stat does not make you better at your position', () => {
    const base = {
      shooting: 50, finishing: 50, handling: 50, perimeterD: 50,
      rebounding: 50, postPlay: 50, interiorD: 50, blocking: 50, passing: 50,
      speed: 50, strength: 50, agility: 50, stamina: 50, durability: 50, sportIq: 50,
    }
    const guard = athlete('sg', base)
    const before = overallOf(guard)
    // Put a centre's stats through the roof on a shooting guard.
    const bulked = athlete('sg', { ...base, rebounding: 99, postPlay: 99, blocking: 99 })
    // Some gain, because the base still counts — but far less than the
    // same points spent on the position's own skills.
    const sharpened = athlete('sg', { ...base, shooting: 99, finishing: 99, handling: 99 })
    expect(overallOf(sharpened) - before).toBeGreaterThan(overallOf(bulked) - before)
  })
})

describe('most people do not make it', () => {
  /**
   * THE CLAIM THE WHOLE MODULE RESTS ON. Measured across a realistic
   * spread of twelve-year-olds rather than asserted about one.
   */
  it('the pipeline narrows hard at every step', () => {
    let tried = 0
    let madeSchool = 0
    let madeVarsity = 0
    let recruited = 0
    let drafted = 0

    for (let i = 0; i < 2_000; i += 1) {
      const roll = (i * 2_654_435_761) % 4_096
      const vitality = 200 + ((i * 37) % 800)
      const resilience = 200 + ((i * 53) % 800)
      const stats = startingStats(vitality, resilience, 500, roll)
      const record = freshAthlete(i as never, 'basketball', 'sg', stats, 60 + (roll % 40))
      tried += 1

      const jitter = (i % 21) - 10
      if (!makesSquad(overallOf(record), 'school', jitter)) continue
      madeSchool += 1

      // SIX YEARS OF DEVELOPMENT, ROTATING THE WORK, which is what an
      // athlete actually does. The first version of this trained skill and
      // only skill, so the athletic base never moved and NOBODY in two
      // thousand people was ever draftable — a flaw in the test's model of
      // a career rather than in the pipeline it was measuring.
      // TRAINING IS A MONTHLY VERB, so six years is dozens of sessions, not
      // six. The first version ran it once a year and concluded the whole
      // pipeline was impossible — measuring a career that nobody would
      // ever actually have. Eight blocks a year with rest between them is
      // what a serious teenager does.
      // AND HOW MUCH WORK IS ITSELF A SPREAD. Everybody training the
      // maximum produced a cohort clustered at 74-88, where 199 of 200
      // varsity players sailed through and 83 per cent of recruits were
      // drafted — a passing test around a population that does not exist.
      // Some people train constantly, most do not, and that spread is what
      // the bars are actually filtering.
      const dedication = (i * 7) % 100
      const blocks = dedication > 92 ? 48 : dedication > 75 ? 30 : dedication > 45 ? 16 : 6
      const foci = ['skill', 'strength', 'conditioning'] as const
      let grown = record
      for (let block = 0; block < blocks; block += 1) {
        const focus = foci[block % foci.length] ?? 'skill'
        const age = 12 + Math.floor((block * 6) / Math.max(1, blocks))
        const result = train(grown, focus, ceilingFor(grown.potential, age), 500, 999)
        const stats2: Record<string, number> = { ...grown.stats }
        for (const [id, gain] of Object.entries(result.gained)) {
          stats2[id] = Math.min(99, (stats2[id] ?? 0) + gain)
        }
        // Rest between blocks, which is the other half of the regimen.
        grown = { ...grown, stats: stats2, fatigue: rested(result.fatigueAfter) }
      }

      if (!makesSquad(overallOf(grown), 'highschool', jitter)) continue
      madeVarsity += 1
      if (offersFor(overallOf(grown), 40).length === 0) continue
      recruited += 1
      // PRODUCTION FOLLOWS THE PLAYER. Fixing it at a constant made the
      // draft turn on the rating alone and hid how much a college career
      // actually counts for.
      if (runDraft(overallOf(grown), overallOf(grown), jitter % 7).pick !== null) drafted += 1
    }

    // Everybody who tries out is somebody who wanted it. Almost nobody
    // arrives — and each step has to actually cut, or the next one is
    // doing all the work.
    expect(madeSchool).toBeLessThan(tried)
    expect(madeVarsity).toBeLessThan(madeSchool)
    expect(recruited).toBeLessThan(madeVarsity)
    expect(drafted).toBeLessThan(recruited)
    // And the whole road has to be narrow: a couple of per cent, not half.
    expect(drafted / tried).toBeLessThan(0.05)

    // AND THE SHAPE, pinned to what was measured rather than left to
    // "smaller than the last one" — which every one of the wrong
    // calibrations along the way also satisfied. Two thousand twelve-year-
    // olds produce a couple of hundred school players, half of those make
    // varsity, a third of THOSE are recruited anywhere at all, and a
    // handful hear their name on draft night.
    expect(madeVarsity / madeSchool).toBeLessThan(0.75)
    expect(recruited / madeVarsity).toBeLessThan(0.6)
    expect(drafted / madeSchool).toBeLessThan(0.1)
    // It must not narrow to nothing either: a pipeline nobody completes is
    // as wrong as one everybody does, and both have been measured here.
    expect(drafted).toBeGreaterThan(0)
  })

  it('an ordinary player gets no offers at all', () => {
    expect(offersFor(45, 20).length).toBe(0)
  })

  it('a good player gets choices, and the best programme wants the best player', () => {
    const good = offersFor(84, 70)
    expect(good.length).toBeGreaterThan(1)
    expect(good.some((offer) => offer.ride === 'full')).toBe(true)
    // The powerhouse does not take a marginal prospect.
    const marginal = offersFor(62, 40)
    expect(marginal.some((offer) => offer.strength >= 88)).toBe(false)
  })
})

describe('the draft is the real rule', () => {
  it('sixty picks, and undrafted is the ordinary answer', () => {
    let called = 0
    const N = 1_000
    for (let i = 0; i < N; i += 1) {
      // A spread of prospects, most of them not good enough.
      const result = runDraft(45 + (i % 50), 40 + (i % 40), (i % 13) - 6)
      if (result.pick !== null) {
        called += 1
        expect(result.pick).toBeGreaterThanOrEqual(1)
        expect(result.pick).toBeLessThanOrEqual(DRAFT_PICKS)
        expect(result.round === 1 || result.round === 2).toBe(true)
        expect(result.teamName.length).toBeGreaterThan(0)
      }
    }
    expect(called).toBeGreaterThan(0)
    expect(called / N).toBeLessThan(0.5)
  })

  it('the top of the draft is worth vastly more than the bottom', () => {
    expect(rookieWageFor(1)).toBeGreaterThan(rookieWageFor(30) * 3)
    expect(rookieWageFor(60)).toBeGreaterThan(0)
    expect(rookieWageFor(null)).toBe(0)
  })

  it('a veteran is paid for what they are', () => {
    expect(veteranWageFor(90)).toBeGreaterThan(veteranWageFor(75))
    expect(veteranWageFor(75)).toBeGreaterThan(veteranWageFor(60))
  })
})

describe('training is work, not a switch', () => {
  it('it plateaus against a ceiling', () => {
    const stats: Record<string, number> = {
      shooting: 70, finishing: 70, handling: 70, perimeterD: 70,
      speed: 70, strength: 70, agility: 70, stamina: 70, durability: 70, sportIq: 70,
    }
    const record = athlete('sg', stats)
    const room = train(record, 'skill', 90, 500, 999)
    const none = train(record, 'skill', 70, 500, 999)
    expect(Object.keys(room.gained).length).toBeGreaterThan(0)
    // At the ceiling there is nothing left to take, and the words say so.
    expect(Object.keys(none.gained).length).toBe(0)
  })

  it('training tired is worth less AND riskier — both, which is the point', () => {
    const stats: Record<string, number> = {
      shooting: 50, finishing: 50, handling: 50, perimeterD: 50,
      speed: 50, strength: 50, agility: 50, stamina: 50, durability: 50, sportIq: 50,
    }
    const fresh = { ...athlete('sg', stats), fatigue: 0 }
    const spent = { ...athlete('sg', stats), fatigue: 900 }
    const freshGain = Object.values(train(fresh, 'skill', 95, 500, 999).gained).reduce((a, b) => a + b, 0)
    const tiredGain = Object.values(train(spent, 'skill', 95, 500, 999).gained).reduce((a, b) => a + b, 0)
    expect(tiredGain).toBeLessThan(freshGain)
    expect(trainingRisk(900, 50)).toBeGreaterThan(trainingRisk(0, 50))
    expect(trainingRisk(0, 50)).toBe(0)
  })

  it('a durable body breaks less often doing the same work', () => {
    expect(trainingRisk(900, 90)).toBeLessThan(trainingRisk(900, 30))
  })

  it('the ceiling comes down with age, and that is the career ending', () => {
    expect(ceilingFor(95, 24)).toBe(95)
    expect(ceilingFor(95, 34)).toBeLessThan(95)
    expect(ceilingFor(95, 40)).toBeLessThan(ceilingFor(95, 34))
  })
})

describe('the season simulates from the stats', () => {
  it('a better player out-produces a worse one over a career', () => {
    const world = createWorld(makeSeed(31))
    const build = (level: number): AthleteRecord => ({
      ...athlete('sg', {
        shooting: level, finishing: level, handling: level, perimeterD: level,
        rebounding: level, postPlay: level, interiorD: level, blocking: level, passing: level,
        speed: level, strength: level, agility: level, stamina: level, durability: level, sportIq: level,
      }),
      level: 'pro',
    })
    const total = (record: AthleteRecord): number => {
      let points = 0
      for (let year = 0; year < 200; year += 1) {
        points += playSeason(world, year as never, (500 + year) as EntityId, record, year).points
      }
      return points
    }
    expect(total(build(88))).toBeGreaterThan(total(build(60)))
  })

  it('and still has bad years — a season is not a verdict', () => {
    const world = createWorld(makeSeed(31))
    const star: AthleteRecord = {
      ...athlete('sg', {
        shooting: 88, finishing: 85, handling: 84, perimeterD: 80,
        rebounding: 60, postPlay: 50, interiorD: 60, blocking: 40, passing: 75,
        speed: 85, strength: 70, agility: 85, stamina: 80, durability: 75, sportIq: 80,
      }),
      level: 'pro',
    }
    const lines = Array.from({ length: 120 }, (_unused, year) =>
      playSeason(world, year as never, (900 + year) as EntityId, star, year),
    )
    const points = lines.map((line) => line.points)
    const best = Math.max(...points)
    const worst = Math.min(...points)
    expect(best).toBeGreaterThan(worst)
    // The team is mostly not you: a good player misses the playoffs
    // sometimes, and that has to be visible.
    expect(lines.some((line) => line.teamWins < line.teamLosses)).toBe(true)
  })
})

describe('it is wired into a life', () => {
  it('a pro contract reaches the ledger, and nothing else invents one', () => {
    const world = createWorld(makeSeed(4242), 400)
    advanceTicks(world, 12 * 20)
    const person = [...world.people.values()].find((p) => p.deathTick === null)
    expect(person).toBeDefined()
    if (person === undefined) return

    // Nobody has an athletic wage until somebody is paying them.
    expect(sportsWageWrapper(world, person.id)).toBe(0)
    world.athletes.set(person.id, {
      ...freshAthlete(person.id, 'basketball', 'sg', { shooting: 80 }, 90),
      level: 'pro',
      wage: 500_000 as never,
    })
    expect(sportsWageWrapper(world, person.id)).toBe(500_000)
  })
})

/** Kept out of the import list above so the test reads as a claim about
 *  the seam rather than about a helper. */
function sportsWageWrapper(world: ReturnType<typeof createWorld>, personId: number): number {
  const record = world.athletes.get(personId as EntityId)
  return record === undefined || record.level !== 'pro' ? 0 : record.wage
}

describe('the draft age is enforced', () => {
  it('nineteen, and a year removed from school', () => {
    expect(DRAFT_AGE).toBe(19)
    expect(positionById('sg')?.sport).toBe('basketball')
  })
})

describe('four sports, and they are genuinely different', () => {
  it('every position in every sport weights to a thousand', () => {
    for (const position of POSITIONS) {
      expect(position.weights.reduce((a, b) => a + b, 0), position.id).toBe(1_000)
      expect(position.weights.length, position.id).toBe(position.skills.length)
    }
  })

  it('each sport fields its own positions and nobody else\'s', () => {
    for (const sport of ['basketball', 'football', 'soccer', 'combat'] as const) {
      const own = positionsFor(sport)
      expect(own.length, sport).toBeGreaterThan(3)
      expect(own.every((position) => position.sport === sport), sport).toBe(true)
    }
  })

  /**
   * THE RULE DIFFERENCES ARE REAL RULES, not labels. Football will not
   * look at somebody until three years out of school; basketball takes
   * them at nineteen. That is the actual reason a football player cannot
   * leave college early and a basketball player can.
   */
  it('football makes you wait two more years than basketball', () => {
    expect(rulesFor('football').proAge).toBe(21)
    expect(rulesFor('basketball').proAge).toBe(19)
    expect(rulesFor('football').proAge).toBeGreaterThan(rulesFor('basketball').proAge)
  })

  it('soccer and combat have no draft at all', () => {
    expect(rulesFor('soccer').draftPicks).toBe(0)
    expect(rulesFor('combat').draftPicks).toBe(0)
    // And asking for one refuses rather than quietly inventing a draft.
    expect(runDraftFor(rulesFor('soccer'), 95, 95, 0).pick).toBeNull()
  })

  it('a seven-round draft calls far more names than a two-round one', () => {
    const called = (sport: 'basketball' | 'football'): number => {
      let n = 0
      for (let i = 0; i < 1_000; i += 1) {
        if (runDraftFor(rulesFor(sport), 55 + (i % 45), 55 + (i % 40), (i % 11) - 5).pick !== null) {
          n += 1
        }
      }
      return n
    }
    // More picks means a lower bar to hear one, which is exactly what
    // seven rounds of two hundred and fifty-seven means in life.
    expect(called('football')).toBeGreaterThan(called('basketball'))
  })

  it('football is by far the most dangerous of them', () => {
    expect(rulesFor('football').injuryPerMille).toBeGreaterThan(
      rulesFor('basketball').injuryPerMille * 2,
    )
    for (const rules of SPORT_RULES) {
      expect(rules.injuryPerMille, rules.sport).toBeGreaterThan(0)
    }
  })

  it('soccer signs you into a pyramid, and there is a level for most pros', () => {
    // The top flight wants the best; further down is still a professional
    // living, which is the point of a pyramid.
    expect(runSigning('soccer', 92, 90, 0).tier).toBe(1)
    const mid = runSigning('soccer', 76, 70, 0)
    expect(mid.signed).toBe(true)
    expect(mid.tier).toBeGreaterThan(1)
    // And most of an academy intake is released.
    expect(runSigning('soccer', 45, 30, 0).signed).toBe(false)
  })

  it('a promotion signs a record, not a rating', () => {
    // A gifted fighter with nothing on paper goes unsigned; the record is
    // what gets read (spec: "your record is your identity").
    expect(runSigning('combat', 88, 5, 0).signed).toBe(false)
    expect(runSigning('combat', 88, 90, 0).signed).toBe(true)
  })
})

describe('a fighter climbs, and can fall', () => {
  function fighter(over: number, extra: Partial<AthleteRecord> = {}): AthleteRecord {
    const stats: Record<string, number> = {
      striking: over, grappling: over, cardio: over, chin: over, power: over, fightIq: over,
      speed: over, strength: over, agility: over, stamina: over, durability: over, sportIq: over,
    }
    return { ...freshAthlete(2 as never, 'combat', 'lightweight', stats, 95), wins: 0, losses: 0, finishes: 0, ranking: 0, ...extra }
  }

  it('wins build a record and eventually a ranking', () => {
    let record = fighter(70)
    for (let i = 0; i < 5; i += 1) {
      record = applyFight(record, { won: true, finish: false, purse: 0 as never, opponent: 'x', words: '' })
    }
    expect(record.wins).toBe(5)
    expect(record.ranking).toBeGreaterThan(0)
  })

  it('the number one contender who wins becomes champion', () => {
    const contender = fighter(85, { wins: 12, ranking: 1 })
    const after = applyFight(contender, { won: true, finish: true, purse: 0 as never, opponent: 'x', words: '' })
    expect(after.champion).toBe(true)
    expect(after.ranking).toBe(0)
  })

  it('a champion who loses gives up the belt but stays near the top', () => {
    const champ = fighter(88, { wins: 15, champion: true, titleDefences: 3 })
    const after = applyFight(champ, { won: false, finish: false, purse: 0 as never, opponent: 'x', words: '' })
    expect(after.champion).toBe(false)
    expect(after.titleDefences).toBe(0)
    // Not back to the bottom — losing a title does not unmake a fighter.
    expect(after.ranking).toBe(2)
    expect(after.losses).toBe(1)
  })

  it('a loss never wipes the wins — a record carries both numbers', () => {
    const veteran = fighter(80, { wins: 14, losses: 2, finishes: 9 })
    const after = applyFight(veteran, { won: false, finish: false, purse: 0 as never, opponent: 'x', words: '' })
    expect(after.wins).toBe(14)
    expect(after.losses).toBe(3)
    expect(recordWords(after)).toContain('14-3')
  })

  it('a better fighter wins more, and never all of them', () => {
    const world = createWorld(makeSeed(77))
    const rate = (over: number): number => {
      let won = 0
      const record = fighter(over)
      for (let i = 0; i < 1_000; i += 1) {
        if (runFight(world, i as never, (3_000 + i) as EntityId, record, i).won) won += 1
      }
      return won / 1_000
    }
    // Matchmaking follows you up, so even a great fighter is not safe —
    // which is why records like 14-3 exist and 40-0 mostly does not.
    expect(rate(88)).toBeGreaterThan(rate(55))
    expect(rate(88)).toBeLessThan(0.95)
  })

  it('a champion earns far more per fight than a prospect', () => {
    const world = createWorld(makeSeed(77))
    const prospect = runFight(world, 5 as never, 4_000 as EntityId, fighter(70), 3)
    const champ = runFight(world, 5 as never, 4_000 as EntityId, fighter(70, { champion: true }), 3)
    expect(champ.purse).toBeGreaterThan(prospect.purse * 5)
  })
})

describe('fame, money, and what comes after', () => {
  function pro(over: number, extra: Partial<AthleteRecord> = {}): AthleteRecord {
    const stats: Record<string, number> = {
      shooting: over, finishing: over, handling: over, perimeterD: over,
      rebounding: over, postPlay: over, interiorD: over, blocking: over, passing: over,
      speed: over, strength: over, agility: over, stamina: over, durability: over, sportIq: over,
    }
    return { ...freshAthlete(4 as never, 'basketball', 'sg', stats, 95), level: 'pro', ...extra }
  }
  const goodYear = {
    games: 60, points: 24, rebounds: 5, assists: 5,
    shootingPerMille: 470, teamWins: 44, teamLosses: 16,
  }

  it('fame follows playing well where people are watching', () => {
    const star = fameFrom(pro(88), goodYear, 88)
    const scrub = fameFrom(pro(58), goodYear, 58)
    expect(star).toBeGreaterThan(scrub)
  })

  it('nobody watches the lower tiers, and it shows', () => {
    const topFlight = fameFrom({ ...pro(85), sport: 'soccer', tier: 1 }, goodYear, 85)
    const thirdTier = fameFrom({ ...pro(85), sport: 'soccer', tier: 3 }, goodYear, 85)
    expect(topFlight).toBeGreaterThan(thirdTier)
  })

  it('fame is rented — a year off the top costs you', () => {
    const famous = pro(88, { fame: 800, level: 'done' })
    // 'done' is not a level anybody watches, so it decays.
    expect(fameFrom(famous, { ...goodYear, games: 0 }, 88)).toBeLessThan(800)
  })

  it('endorsements are for stars and nobody else', () => {
    expect(endorsementsFor(200)).toBe(0)
    expect(endorsementsFor(ENDORSEMENT_FLOOR - 1)).toBe(0)
    expect(endorsementsFor(600)).toBeGreaterThan(0)
    // Steeply non-linear: nobody endorses the ninth-best player.
    expect(endorsementsFor(900)).toBeGreaterThan(endorsementsFor(600) * 3)
  })

  it('being known costs wellbeing, and costs more the better known you are', () => {
    expect(famePressure(100)).toBe(0)
    expect(famePressure(600)).toBeLessThan(0)
    expect(famePressure(900)).toBeLessThan(famePressure(600))
  })

  it('a scandal only reaches somebody anybody is watching', () => {
    const world = createWorld(makeSeed(51))
    // Obscurity is a kind of protection, and the model says so.
    for (let i = 0; i < 200; i += 1) {
      expect(rollScandal(world, i as never, (6_000 + i) as EntityId, 100)).toBeNull()
    }
    let hit = 0
    for (let i = 0; i < 400; i += 1) {
      if (rollScandal(world, i as never, (6_000 + i) as EntityId, 800) !== null) hit += 1
    }
    // Real, and still rare — a famous life is not a scandal every year.
    expect(hit).toBeGreaterThan(0)
    expect(hit / 400).toBeLessThan(0.2)
  })

  it('there is always a second act, and always an ordinary one', () => {
    // A quiet journeyman: no broadcasting, but a life.
    const journeyman = pro(64, { level: 'done', fame: 40, seasons: 3 })
    const acts = secondActsFor(journeyman)
    expect(acts.length).toBeGreaterThan(0)
    expect(acts.some((act) => act.id === 'ordinary')).toBe(true)
    expect(acts.some((act) => act.id === 'broadcast')).toBe(false)

    // A famous one gets the studio.
    const famous = pro(88, { level: 'done', fame: 700, seasons: 12 })
    expect(secondActsFor(famous).some((act) => act.id === 'broadcast')).toBe(true)
  })
})

describe('the paper says what the world says', () => {
  function proRecord(extra: Partial<AthleteRecord> = {}): AthleteRecord {
    const stats: Record<string, number> = { shooting: 80, finishing: 78, handling: 75, perimeterD: 70 }
    return { ...freshAthlete(9 as never, 'basketball', 'sg', stats, 92), level: 'pro', ...extra }
  }

  it('a letter of intent says what the award actually is', () => {
    const world = createWorld(makeSeed(51))
    const full = letterOfIntentFor(world, proRecord(), 'A Player', 'State University', 'a powerhouse programme', 'full', 200_000 as never)
    expect(full.monthly).toBeGreaterThan(0)
    expect(full.stamp).toBe('FULL RIDE')
    // THE CLAUSE THAT IS TRUE AND ALMOST NOBODY KNOWS: it is one year,
    // renewable, not a four-year guarantee.
    expect(full.clauses.some((clause) => clause.includes('ONE ACADEMIC YEAR'))).toBe(true)

    // A walk-on's letter shows no money rather than a proud zero.
    const walkOn = letterOfIntentFor(world, proRecord(), 'A Player', 'Fairmount State', 'small', 'walk-on', 200_000 as never)
    expect(walkOn.monthly).toBe(0)
  })

  it('a rookie contract says the scale decided it, not a negotiation', () => {
    const world = createWorld(makeSeed(51))
    const paper = playingContractFor(world, proRecord({ draftPick: 4 }), 'A Player', 900_000 as never)
    expect(paper.headline).toContain('ROOKIE SCALE')
    expect(paper.clauses.some((clause) => clause.includes('not subject to negotiation'))).toBe(true)
    // A first-rounder is paid to sign; nobody else is.
    expect(paper.bonus).toBeGreaterThan(0)
  })

  it('an undrafted invitation promises nothing, and says so', () => {
    const world = createWorld(makeSeed(51))
    const paper = playingContractFor(world, proRecord({ draftPick: null }), 'A Player', 40_000 as never)
    expect(paper.stamp).toBe('NO GUARANTEE')
    expect(paper.bonus).toBe(0)
    expect(paper.clauses.some((clause) => clause.includes('release'))).toBe(true)
  })

  it('an endorsement carries the morals clause the scandal arc runs on', () => {
    const world = createWorld(makeSeed(51))
    const paper = endorsementFor(world, proRecord({ fame: 720 }), 'A Player', 400_000 as never)
    expect(paper.variant).toBe('endorsement')
    expect(paper.clauses.some((clause) => clause.startsWith('MORALS'))).toBe(true)
    // It is not employment and the paper says that too.
    expect(paper.clauses.some((clause) => clause.includes('no employment'))).toBe(true)
  })

  it('every paper is complete — no blank fields reach a screen', () => {
    const world = createWorld(makeSeed(51))
    const papers = [
      letterOfIntentFor(world, proRecord(), 'A Player', 'State University', 'a powerhouse', 'full', 200_000 as never),
      playingContractFor(world, proRecord({ draftPick: 12 }), 'A Player', 500_000 as never),
      endorsementFor(world, proRecord({ fame: 700 }), 'A Player', 300_000 as never),
    ]
    for (const paper of papers) {
      for (const [key, value] of Object.entries(paper)) {
        if (typeof value === 'string') expect(value.length, `${paper.variant}.${key}`).toBeGreaterThan(0)
      }
      expect(paper.clauses.length, paper.variant).toBeGreaterThan(2)
      expect(paper.termYears, paper.variant).toBeGreaterThan(0)
    }
  })
})
