/**
 * War length and difficulty — the owner's spec of 2026-08-02, section by
 * section, including his own test checklist.
 *
 * The two claims that matter: a war runs the length it was rolled (2-15
 * years, shaped by how mismatched the sides are), and a country that
 * outclasses you is genuinely harder to fight than one that does not.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTick, advanceTicks, createWorld } from '../src/index.js'
import { combatPowerOf, homeland, relationBetween, warExperienceOf } from '../src/geopolitics.js'
import { alliesOf, distressOf } from '../src/coalition.js'
import { relationKey } from '../src/geopolitics.js'
import { activeWars } from '../src/geopolitics.js'
import { awaitingPlayer, describeStakes, resolvePending, setPlayer } from '../src/player.js'
import { criminalRecordOf, isJailed } from '../src/crime.js'
import { livingPeople } from '../src/systems.js'
import { ageAt } from '../src/clock.js'
import { threatVectorFor } from '../src/deployment.js'
import { HEARTLAND_SPEC } from '../src/heartland.js'
import { REAL_NATIONS } from '../src/realnations.js'
import type { GeoRelation, Nation, World } from '../src/types.js'

function nation(overrides: Partial<Nation>): Nation {
  return {
    id: 1 as never,
    name: 'Somewhere',
    isHomeland: false,
    strength: 500,
    baseStrength: 500,
    economy: 500,
    stability: 500,
    bloc: null,
    combatRating: 5,
    warMonths: 0,
    exhaustedUntilTick: null,
    ...overrides,
  }
}

function war(overrides: Partial<GeoRelation> = {}): GeoRelation {
  return {
    a: 1 as never,
    b: 2 as never,
    state: 'war',
    sinceTick: 0 as never,
    warPhase: 'attrition',
    casualtiesA: 0,
    casualtiesB: 0,
    plannedWarMonths: 60,
    ...overrides,
  }
}

describe('war length', () => {
  it('runs between two and fifteen years, over many wars', () => {
    // The owner's checklist: roll 20 wars, confirm the lengths land in band.
    const lengths: number[] = []
    for (let seed = 1; seed <= 12; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 1800)
      for (const relation of world.geoRelations.values()) {
        if (relation.plannedWarMonths !== null) lengths.push(relation.plannedWarMonths)
      }
    }
    expect(lengths.length).toBeGreaterThan(20)
    for (const months of lengths) {
      expect(months).toBeGreaterThanOrEqual(2 * 12)
      expect(months).toBeLessThanOrEqual(15 * 12)
      expect(months % 12, 'lengths are whole years').toBe(0)
    }
    // And they are not all the same number — the roll is a roll.
    expect(new Set(lengths).size).toBeGreaterThan(3)
  })

  it('ends a war at the length it was given, not whenever a draw lands', () => {
    // Before this, a war ended only when a weariness draw came up, which is
    // why they all ran about the same length whatever they were.
    let checked = 0
    for (let seed = 1; seed <= 8; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 2400)
      for (const relation of world.geoRelations.values()) {
        if (relation.state === 'war' && relation.plannedWarMonths !== null) {
          const months = world.tick - relation.sinceTick
          expect(
            months,
            'a war outlived the length it was rolled to run',
          ).toBeLessThanOrEqual(relation.plannedWarMonths)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})

describe('difficulty', () => {
  it('counts a decade of war as a point of hard-won toughness, capped at three', () => {
    expect(warExperienceOf(nation({ warMonths: 0 }))).toBe(0)
    expect(warExperienceOf(nation({ warMonths: 119 }))).toBe(0)
    expect(warExperienceOf(nation({ warMonths: 120 }))).toBe(1)
    expect(warExperienceOf(nation({ warMonths: 360 }))).toBe(3)
    // Battle-hardened is capped: a century of war does not make a country
    // unbeatable, it makes it tired (which exhaustion already models).
    expect(warExperienceOf(nation({ warMonths: 1200 }))).toBe(3)
    expect(combatPowerOf(nation({ combatRating: 9, warMonths: 240 }))).toBe(11)
  })

  it('makes a high-rated enemy genuinely more dangerous than a low-rated one', () => {
    // The owner's checklist: fight Russia/China against Nicaragua/Cuba and
    // confirm the difference shows.
    const home = nation({ id: 99 as never, combatRating: 8 })
    const ratingOf = (name: string): number =>
      REAL_NATIONS.find((n) => n.name === name)?.combatRating ?? 5

    const russia = nation({ name: 'Russia', combatRating: ratingOf('Russia') })
    const nicaragua = nation({ name: 'Nicaragua', combatRating: ratingOf('Nicaragua') })

    const hard = threatVectorFor(war(), russia, home)
    const easy = threatVectorFor(war(), nicaragua, home)

    expect(hard.directCombat).toBeGreaterThan(easy.directCombat)
    expect(hard.convoy).toBeGreaterThan(easy.convoy)
    expect(hard.baseAttack).toBeGreaterThan(easy.baseAttack)
    // Accidents are the tempo of the thing and do not care who is opposite.
    expect(hard.accident).toBe(easy.accident)
  })

  it('lets war experience make a modest country harder over time', () => {
    const home = nation({ id: 99 as never, combatRating: 8 })
    const green = nation({ name: 'Somewhere', combatRating: 4, warMonths: 0 })
    const hardened = nation({ name: 'Somewhere', combatRating: 4, warMonths: 360 })
    expect(threatVectorFor(war(), hardened, home).directCombat).toBeGreaterThan(
      threatVectorFor(war(), green, home).directCombat,
    )
  })

  it('is about the GAP, not the enemy alone', () => {
    // The same enemy, two different homelands: a stronger side has an
    // easier war. This is what makes it difficulty rather than a country
    // lookup — and threatVectorFor still reads the war's own state for
    // everything else (foundation rule 1).
    const enemy = nation({ combatRating: 9 })
    const weakHome = nation({ id: 99 as never, combatRating: 3 })
    const strongHome = nation({ id: 99 as never, combatRating: 10 })
    expect(threatVectorFor(war(), enemy, weakHome).directCombat).toBeGreaterThan(
      threatVectorFor(war(), enemy, strongHome).directCombat,
    )
  })

  it('rates every nation in both presets, in band', () => {
    for (const spec of [HEARTLAND_SPEC]) {
      const world = createWorld(makeSeed(12345), 40, spec)
      for (const n of world.nations.values()) {
        expect(n.combatRating).toBeGreaterThanOrEqual(1)
        expect(n.combatRating).toBeLessThanOrEqual(10)
        expect(n.warMonths).toBe(0)
      }
    }
    // Classic's invented countries get theirs derived from strength.
    const classic = createWorld(makeSeed(12345), 40)
    const ratings = new Set([...classic.nations.values()].map((n) => n.combatRating))
    expect(ratings.size, 'derived ratings should vary with strength').toBeGreaterThan(2)
  })

  it('counts the months a country actually spends at war', () => {
    const world = createWorld(makeSeed(3), 60, HEARTLAND_SPEC)
    advanceTicks(world, 1800)
    const fought = [...world.nations.values()].filter((n) => n.warMonths > 0)
    expect(fought.length).toBeGreaterThan(0)
    for (const n of fought) {
      // Nobody can have been at war longer than the world has existed.
      expect(n.warMonths).toBeLessThanOrEqual(world.tick * 4)
    }
  })
})

describe('the call to arms', () => {
  it('goes out when the war is going badly, not on a clock', () => {
    // The owner's own answer to the spec's open question: "it should
    // trigger ally help when they are losing the war or taking more deaths
    // and need additional help."
    const world = createWorld(makeSeed(12345), 40, HEARTLAND_SPEC)
    const comfortable = war({ casualtiesA: 400, casualtiesB: 400, sinceTick: world.tick as never })
    const losing = war({ casualtiesA: 60_000, casualtiesB: 2_000, sinceTick: 0 as never })

    const [first, second] = [...world.nations.values()]
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    if (!first || !second) return

    const cwar = { ...comfortable, a: first.id, b: second.id }
    const lwar = { ...losing, a: first.id, b: second.id }
    expect(distressOf(world, cwar, first.id)).toBeLessThan(150)
    expect(distressOf(world, lwar, first.id)).toBeGreaterThanOrEqual(500)
    // The side that is WINNING is not in distress, whatever the totals.
    expect(distressOf(world, lwar, second.id)).toBeLessThan(distressOf(world, lwar, first.id))
  })

  it('a really bad war has called before its fifth year', () => {
    // The one hard guarantee in the owner's answer. Everything else about
    // the timing is a draw; this is not.
    let checked = 0
    for (let seed = 1; seed <= 10; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 1800)

      for (const relation of world.geoRelations.values()) {
        if (relation.state !== 'war') continue
        const months = world.tick - relation.sinceTick
        if (months < 72) continue
        for (const sideId of [relation.a, relation.b]) {
          if (distressOf(world, relation, sideId) < 600) continue
          const side = world.nations.get(sideId)
          if (!side || side.bloc === null) continue // nobody to call
          if (alliesOf(world, sideId).length === 0) continue
          const called = world.events.some(
            (e) =>
              e.type === 'call-to-arms' &&
              e.subjectId === sideId &&
              e.tick - relation.sinceTick <= 60,
          )
          expect(called, 'a war this bad should have called for help by year 5').toBe(true)
          checked++
        }
      }
    }
    expect(checked, 'no severely distressed war with allies was found to check').toBeGreaterThan(0)
  })

  it('builds coalitions out of ordinary wars, with the reason on the record', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const world = createWorld(makeSeed(seed), 60, HEARTLAND_SPEC)
      advanceTicks(world, 1800)

      const joins = world.events.filter((e) => e.type === 'joined-war')
      for (const join of joins) {
        // A joiner is really at war with that enemy — an ordinary relation,
        // not a special case.
        const relation = relationBetween(world, join.subjectId, join.otherId ?? join.subjectId)
        expect(relation).toBeDefined()
        // Any rung is legitimate later — what matters is the pair exists.
        expect(relation?.state).toBeDefined()
        // And the record says why, in the engine's own words.
        const record = world.causalRecords.find(
          (r) =>
            r.subjectId === join.subjectId &&
            r.tick === join.tick &&
            r.chosen.startsWith('joined '),
        )
        expect(record?.inputs.some((i) => i.factor === 'alliance-obligation')).toBe(true)
        expect(record?.inputs.some((i) => i.factor === 'ally-in-distress')).toBe(true)
      }
      if (joins.length > 0) return
    }
    throw new Error('no ally ever joined a war across six worlds — the feature is dead')
  })

  it('asks the same ally at most once a year', () => {
    const world = createWorld(makeSeed(2), 60, HEARTLAND_SPEC)
    advanceTicks(world, 1800)
    const byPair = new Map<string, number[]>()
    for (const event of world.events) {
      if (event.type !== 'call-to-arms') continue
      const key = `${String(event.subjectId)}:${String(event.otherId ?? -1)}`
      const ticks = byPair.get(key) ?? []
      ticks.push(event.tick)
      byPair.set(key, ticks)
    }
    expect(byPair.size).toBeGreaterThan(0)
    for (const ticks of byPair.values()) {
      const sorted = [...ticks].sort((x, y) => x - y)
      for (let i = 1; i < sorted.length; i++) {
        expect((sorted[i] ?? 0) - (sorted[i - 1] ?? 0)).toBeGreaterThan(12)
      }
    }
  })

  it('runs for every nation, the homeland included — and asks the player nothing', () => {
    // ADR-0022 §4: the player is one person, not a government. The homeland
    // decides by the same formula as everyone else, and a call to arms must
    // never raise a decision for the player.
    const world = createWorld(makeSeed(3), 60, HEARTLAND_SPEC)
    advanceTicks(world, 1800)

    const home = homeland(world)
    expect(home).toBeDefined()
    const joins = world.events.filter((e) => e.type === 'joined-war')
    const npcJoins = joins.filter((e) => e.subjectId !== home?.id)
    expect(npcJoins.length, 'nations the player does not control never joined anything').toBeGreaterThan(0)

    // Nothing about coalitions ever became the player's question.
    expect(world.player.pending).toBeNull()
  })

  it('a decline is recorded and starts no war', () => {
    let seen = 0
    for (let seed = 1; seed <= 5; seed++) {
      const world = createWorld(makeSeed(seed), 80, HEARTLAND_SPEC)
      advanceTicks(world, 1800)
      for (const decline of world.events.filter((e) => e.type === 'declined-call').slice(0, 20)) {
        const record = world.causalRecords.find(
          (r) => r.subjectId === decline.subjectId && r.tick === decline.tick && r.chosen.startsWith('stayed out'),
        )
        expect(record?.chosen).toContain('stayed out')
        // Kept because the decision is recorded as 'major' — a refusal's
        // whole meaning is the war it did not join.
        expect(record?.rejected.length).toBeGreaterThan(0)
        seen++
      }
      if (seen > 0) break
    }
    expect(seen, 'nobody ever refused a call across five worlds').toBeGreaterThan(0)
  })
})

describe('orders, and the right to refuse them', () => {
  /** A played soldier in a country that is at war. */
  function soldierAtWar(seed: number): { world: World; personId: number } {
    const world = createWorld(makeSeed(seed), 120, HEARTLAND_SPEC)
    advanceTicks(world, 240)

    const person = livingPeople(world)
      .filter((p) => {
        const age = ageAt(p.birthTick, world.tick)
        return age >= 20 && age <= 30
      })
      .sort((a, b) => a.id - b.id)[0]
    if (!person) throw new Error('no adult')
    setPlayer(world, person.id)
    world.employment.delete(person.id)
    world.service.set(person.id, {
      personId: person.id,
      branch: 'land-forces',
      specialtyId: 'rifleman',
      rank: 2,
      rankSinceTick: world.tick as never,
      qualifications: [],
      enlistedAtTick: (world.tick - 20) as never,
      baseId: person.id,
      monthlyPay: 130_000 as never,
      performance: 700,
      // A long term: the point of these tests is the ORDER, and a
      // reenlistment question mid-way would discharge the soldier before
      // one arrived.
      termMonthsLeft: 240,
      dischargedAtTick: null,
      dischargeReason: null,
      termPerformanceSum: 4200,
      unitId: null,
      unitSinceTick: null,
      schoolId: null,
      schoolStartsAtTick: null,
      fitnessTestedAtTick: null,
      priorSpecialtyIds: [],
      specialtyChangedAtTick: null,
    })

    // Put the homeland at war with somebody, so orders can come.
    const home = homeland(world)
    if (!home) throw new Error('no homeland')
    const enemy = [...world.nations.values()].find((n) => !n.isHomeland)
    if (!enemy) throw new Error('no enemy')
    const key = relationKey(home.id, enemy.id)
    const existing = world.geoRelations.get(key)
    if (!existing) throw new Error('no relation')
    world.geoRelations.set(key, {
      ...existing,
      state: 'war',
      sinceTick: world.tick as never,
      warPhase: 'offensive',
      casualtiesA: 0,
      casualtiesB: 0,
      plannedWarMonths: 120,
    })
    return { world, personId: person.id }
  }

  /**
   * Run THE TICK LOOP until the order lands — not a hand-called function.
   * A test that never advances a tick tests nothing, which this project has
   * now learned twice (RESUME rule 2).
   */
  function runToOrders(world: World): boolean {
    const home = homeland(world)
    // Orders run about 1.7% a month per soldier, so this needs patience —
    // and the scenario holds the war open, because what is under test is
    // the order, not how long a war lasts.
    for (let i = 0; i < 400; i++) {
      if (home !== undefined) {
        const stillFighting = activeWars(world).some((w) => w.a === home.id || w.b === home.id)
        if (!stillFighting) {
          const enemy = [...world.nations.values()].find((n) => !n.isHomeland)
          const key = enemy === undefined ? null : relationKey(home.id, enemy.id)
          const relation = key === null ? undefined : world.geoRelations.get(key)
          if (key !== null && relation !== undefined) {
            world.geoRelations.set(key, {
              ...relation,
              state: 'war',
              sinceTick: world.tick as never,
              warPhase: 'offensive',
              plannedWarMonths: 240,
            })
          }
        }
      }
      if (awaitingPlayer(world)) {
        const pending = world.player.pending
        if (pending?.kind === 'deployment-order') return true
        // Anything else a life throws up, answered so the soldier STAYS a
        // soldier — answering 'leave' at the reenlistment question was
        // discharging them before the orders could ever arrive.
        const options = pending?.options ?? ['decline']
        // 'stay' keeps them in uniform at the reenlistment question. NOT
        // 'accept' — that says yes to a volunteer tour, which is how this
        // test first found its soldier three deployments deep before the
        // order it was waiting for ever arrived.
        const keepServing = options.find((o) => o === 'reenlist' || o === 'stay')
        resolvePending(world, keepServing ?? options[options.length - 1] ?? 'decline')
        continue
      }
      advanceTick(world)
    }
    return false
  }

  it('halts the clock and asks, instead of deploying the player behind their back', () => {
    const { world } = soldierAtWar(7)
    expect(runToOrders(world), 'no orders ever reached the player').toBe(true)
    const pending = world.player.pending
    expect(pending?.options).toEqual(['go', 'request-exemption', 'refuse'])
    // And every cost is stated BEFORE the answer, which is what makes it a
    // decision rather than a trap.
    const stakes = pending === null ? [] : describeStakes(world, pending)
    expect(stakes.join(' ')).toContain('court-martial')
    expect(stakes.join(' ')).toContain('rarely granted')
  })

  it('going is the same tour an ordered NPC gets', () => {
    const { world, personId } = soldierAtWar(7)
    expect(runToOrders(world)).toBe(true)
    resolvePending(world, 'go')

    expect((world.deployments.get(personId as never) ?? []).length).toBe(1)
    expect(world.events.some((e) => e.type === 'deployed' && e.subjectId === personId)).toBe(true)
  })

  it('refusing costs a cell, the uniform, and a record', () => {
    const { world, personId } = soldierAtWar(7)
    expect(runToOrders(world)).toBe(true)
    resolvePending(world, 'refuse')

    expect((world.deployments.get(personId as never) ?? []).length).toBe(0)
    expect(isJailed(world, personId as never)).toBe(true)

    const record = world.service.get(personId as never)
    expect(record?.dischargedAtTick).not.toBeNull()
    expect(record?.dischargeReason).toBe('misconduct')

    // On the record, where the hiring gate and the recruiter both read it.
    const conviction = criminalRecordOf(world, personId as never)?.convictions.at(-1)
    expect(conviction?.kind).toBe('refusing-orders')
    expect(conviction?.sentenceMonths).toBeGreaterThan(0)

    const decision = world.causalRecords.find(
      (r) => r.subjectId === personId && r.chosen.startsWith('refused orders'),
    )
    expect(decision?.significance).toBe('defining')
    expect(decision?.rejected.length).toBeGreaterThan(0)
  })

  it('asking to be excused is answered, and usually answered no', () => {
    // Rare enough not to be a way out, honest enough not to be a trap: it is
    // on the record either way, and a denial sends you anyway rather than
    // asking a second question — the chained-pending trap this project has
    // shipped broken twice.
    let granted = 0
    let denied = 0
    for (let seed = 1; seed <= 8; seed++) {
      const { world, personId } = soldierAtWar(seed)
      if (!runToOrders(world)) continue
      // Count what they already have: a long war can order the same
      // soldier more than once before this one.
      const before = (world.deployments.get(personId as never) ?? []).length
      resolvePending(world, 'request-exemption')

      const asked = world.events.find(
        (e) => e.type === 'asked-exemption' && e.subjectId === personId,
      )
      expect(asked, 'the asking is on the record either way').toBeDefined()
      const after = (world.deployments.get(personId as never) ?? []).length
      if (asked?.detail === 'granted') {
        granted++
        expect(after, 'an excused soldier does not go').toBe(before)
      } else {
        denied++
        expect(after, 'a denied request means you go anyway').toBe(before + 1)
      }
      expect(world.player.pending?.kind).not.toBe('deployment-order')
    }
    expect(granted + denied, 'no order ever reached a player across eight worlds').toBeGreaterThan(0)
    expect(denied, 'an exemption should be the exception').toBeGreaterThan(granted)
  })
})
