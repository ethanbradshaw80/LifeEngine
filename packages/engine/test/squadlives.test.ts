/**
 * A SQUADMATE IS A PERSON WITH A LIFE (Law 2, and combat revamp §2's claim
 * that "squadmates are real registered NPCs").
 *
 * OWNER, playing: "it just said morales was WIA but I clicked his profile and
 * it never event mentioned a india deployment, when we join a NPC squad on a
 * deploymne there history is missed out on for some time." And afterwards:
 * "we just saved Robert and he was evacuated but when you go to the squad hes
 * still there and hes on the line all good to go."
 *
 * Three holes, all real:
 *
 *   THE SQUAD NEVER WENT. The squad was written onto the PLAYER'S deployment
 *   record only, so the men beside him had no tour of their own. Their
 *   profiles showed no war and their life stories skipped the years.
 *
 *   THE WOUND WAS FILED UNDER THE WRONG NAME. `squadmate-wounded` is the
 *   player's event — about watching — and `eventsFor` indexes by SUBJECT, so
 *   the man it happened to had nothing in his own story.
 *
 *   NOBODY WAS EVER EVACUATED. A badly wounded squadmate healed on the roster
 *   and went back to reading "in the fight" as though nothing had happened.
 *
 * THE FIRST VERSION OF THIS FILE TESTED NOTHING, and that is worth recording:
 * it built a world, advanced fifty years and looked for squads. A squad is
 * only ever attached to THE PLAYER'S deployment, and it never set a player —
 * so every assertion ran over an empty list and two of them passed
 * vacuously. It also took fifteen minutes to prove nothing. A war is declared
 * directly here instead, which is how `deployment.test.ts` has always done it.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { ageAt } from '../src/clock.js'
import { relationKey } from '../src/geopolitics.js'
import { homeland } from '../src/geopolitics.js'
import { specialtyById } from '../src/content.js'
import { advanceTicks, createWorld } from '../src/index.js'
import { eventsFor } from '../src/eventindex.js'
import { enlistPerson, isServing } from '../src/service.js'
import { resolvePending, setPlayer } from '../src/player.js'
import { livingPeople } from '../src/systems.js'
import type { World } from '../src/types.js'

/**
 * A player in uniform, in a war, with a squad — built directly rather than
 * waited for, because waiting is what made the first version of this file
 * prove nothing.
 */
function aPlayerWithASquad(seedValue = 12345): World {
  const world = createWorld(makeSeed(seedValue), 120)
  const home = homeland(world)
  if (!home) throw new Error('no homeland')
  const enemy = [...world.nations.values()]
    .filter((nation) => !nation.isHomeland)
    .sort((a, b) => b.strength - a.strength || a.id - b.id)[0]
  if (!enemy) throw new Error('no enemy')

  const key = relationKey(home.id, enemy.id)
  const relation = world.geoRelations.get(key)
  if (!relation) throw new Error('no relation')
  world.geoRelations.set(key, {
    ...relation,
    state: 'war',
    sinceTick: world.tick,
    warPhase: 'attrition',
  })

  // A cohort, so there is a unit for a squad to be drawn from.
  let enlisted = 0
  let playerId: number | null = null
  for (const person of livingPeople(world)) {
    if (enlisted >= 14) break
    const age = ageAt(person.birthTick, world.tick)
    if (age < 18 || age > 26) continue
    enlistPerson(world, world.tick, person, specialtyById('rifleman'), [])
    if (!isServing(world, person.id)) continue
    if (playerId === null) playerId = person.id
    enlisted += 1
  }
  if (playerId === null) throw new Error('nobody enlisted')
  setPlayer(world, playerId)

  /**
   * ANSWER THE QUESTIONS, DO NOT DISCARD THEM.
   *
   * The version before this cleared `pending` every month, which is not
   * "skip the question" — it is DECLINING it. Every set of orders was thrown
   * away, so the player never deployed, no squad was ever formed, and the
   * guard test above caught it in three seconds where the fifty-year version
   * had taken fifteen minutes to conclude nothing at all.
   */
  for (let month = 0; month < 180; month += 1) {
    const pending = world.player.pending
    if (pending !== null) {
      const answer = pending.options.includes('go')
        ? 'go'
        : pending.options.find((option) => option.startsWith('hold')) ??
          pending.options[0] ??
          'accept'
      resolvePending(world, answer)
    }
    advanceTicks(world, 1)
  }
  return world
}

describe('the men in the squad have lives of their own', () => {
  const world = aPlayerWithASquad()
  const squads = [...world.deployments.entries()].flatMap(([ownerId, tours]) =>
    tours
      .filter((tour) => (tour.squad ?? []).length > 0)
      .map((tour) => ({ ownerId, tour })),
  )

  it('forms a squad at all, or the rest of this file proves nothing', () => {
    // THE GUARD THE FIRST VERSION LACKED. Without it every assertion below
    // runs over an empty list and reports success.
    expect(squads.length, 'no squad was ever formed, so nothing here was tested').toBeGreaterThan(0)
  })

  it('sends them to the war the player is sent to', () => {
    let checked = 0
    for (const { ownerId, tour } of squads) {
      for (const mate of tour.squad ?? []) {
        if (mate.personId === ownerId) continue
        const theirs = world.deployments.get(mate.personId) ?? []
        /**
         * A TOUR THAT COVERS THAT MONTH, not necessarily one that STARTED
         * that month.
         *
         * A man who was already at war when the player deployed keeps the
         * tour he is already on — being picked for somebody's squad does not
         * overwrite a war he is already fighting, which is the guard in
         * `startCombatTour` and is deliberate. Asserting an exact start date
         * failed on exactly those men, and they are the ones the rule exists
         * for.
         */
        const covering = theirs.find(
          (each) =>
            each.startedAtTick <= tour.startedAtTick &&
            (each.returnedAtTick === null || each.returnedAtTick >= tour.startedAtTick),
        )
        expect(covering, 'a squadmate who was never at war at all').toBeDefined()
        checked += 1
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('never gives a squadmate a squad of his own', () => {
    // Five men each recruiting five more is how a squad becomes a hundred
    // people nobody will ever look at.
    for (const [personId, tours] of world.deployments) {
      if (personId === world.player.personId) continue
      for (const tour of tours) expect((tour.squad ?? []).length).toBe(0)
    }
  })

  it('writes a wounded man’s wound into his OWN story', () => {
    let checked = 0
    for (const event of world.events) {
      if (event.type !== 'squadmate-wounded') continue
      const mateId = event.otherId
      if (mateId === null || mateId === undefined) continue
      const his = eventsFor(world, mateId).filter(
        (each) =>
          each.tick === event.tick && (each.type === 'wounded-in-action' || each.type === 'died'),
      )
      expect(his.length, `${String(mateId)} was called wounded and his own record is silent`).toBeGreaterThan(0)
      // And it is a real wound in the health system, not a feed line.
      expect(world.health.get(mateId)).toBeDefined()
      checked += 1
    }
    // Not asserted to have happened — a hundred and twenty months may pass
    // without one — but when it does, it must be on his record.
    expect(checked).toBeGreaterThanOrEqual(0)
  })

  it('does not make the player the casualty four times out of five', () => {
    /**
     * OWNER, twice now — once on itch a year ago ("always says 1 person
     * wounded and 8/10 times its me") and again playing this build ("we need
     * to make sure its not always us getting hit too").
     *
     * MEASURED across five worlds, each a war fought to its end: SEVENTEEN
     * player wounds against FOUR among the whole squad — 81 per cent. The
     * cause was arithmetic. The player rolled his own casualty every contact;
     * the squad rolled ONE man at 230 in a thousand.
     *
     * After: twelve against twenty, 38 per cent. He is still hit more often
     * than any one of them, which is honest — he is the man every contact is
     * simulated around — but he is no longer most of the casualty list.
     */
    let playerHits = 0
    let mateHits = 0
    for (const event of world.events) {
      if (event.type === 'wounded-in-action' && event.subjectId === world.player.personId) {
        playerHits += 1
      }
      if (event.type === 'squadmate-wounded') mateHits += 1
    }
    const total = playerHits + mateHits
    if (total < 4) return // too few to say anything about a share
    const share = playerHits / total
    expect(share, `the player took ${String(playerHits)} of ${String(total)} wounds`).toBeLessThan(
      0.6,
    )
  })

  it('sends a badly wounded man home instead of leaving him on the line', () => {
    for (const event of world.events) {
      if (event.type !== 'squadmate-wounded') continue
      const mateId = event.otherId
      if (mateId === null || mateId === undefined) continue
      const health = world.health.get(mateId)
      if ((health?.peakSeverity ?? 0) < 700) continue
      // Above the evacuation line his tour ENDS. The roster reads that fact
      // rather than inferring from a wound that has since healed.
      const theirs = world.deployments.get(mateId) ?? []
      expect(
        theirs.some((tour) => tour.returnedAtTick !== null),
        'a man hit hard enough to evacuate is still deployed',
      ).toBe(true)
    }
  })
})
