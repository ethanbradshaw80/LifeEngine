/**
 * THE SQUAD (owner's `combat_tours_revamp.md` §2).
 *
 * You deploy embedded in a fireteam of people with names, and they persist
 * across the tour and across tours if they live. Losing one is a permanent
 * story beat.
 *
 * THEY ARE THEIR OWN PEOPLE, and the spec is emphatic about it: "these are
 * generated SERVICE NPCs, not your hometown. When you deploy, the squad is
 * spun up as its own set of soldiers — it will not usually be people from
 * the player's town or existing social graph, because that's not how
 * deployments work."
 *
 * So they are REGISTERED PEOPLE — real entries in `world.people`, with
 * traits and a service record — rather than decorative names on a screen.
 * That is the difference between a squadmate and a label, and it is what
 * makes the acceptance criterion possible: "their death notifies their own
 * kin". A name on a card has no kin.
 *
 * WHAT THAT COSTS, stated plainly: every squad adds real people to the
 * world, and the world already carries several hundred. The squad is
 * therefore SMALL, spun up once per tour, and its members are marked so
 * the demographic passes can tell them from the town — they are not
 * competing for the town's jobs or houses and should never appear in its
 * marriage market.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { openStream, Stream } from './rng.js'
import type { Person, SquadMember, World } from './types.js'

/** How many people stand next to you. A fireteam, not a company. */
export const SQUAD_SIZE = 5

/**
 * ROLES INSIDE THE TEAM, and they are not cosmetic: the spec's §2 says
 * "your rank sets your stake in them", and a team leader is the person
 * whose decisions spend the others.
 */
export type SquadRole = 'leader' | 'rifleman' | 'automatic-rifleman' | 'medic' | 'radio'

const ROLES: readonly SquadRole[] = ['leader', 'rifleman', 'automatic-rifleman', 'medic', 'radio']

export const ROLE_TITLES: Readonly<Record<SquadRole, string>> = {
  leader: 'team leader',
  rifleman: 'rifleman',
  'automatic-rifleman': 'automatic rifleman',
  medic: 'medic',
  radio: 'radio operator',
}

/**
 * WHAT EACH OF THEM IS LIKE.
 *
 * Competence is drawn and it matters — a squad is not five identical
 * soldiers, and the difference between the man who is good at this and
 * the one who is nineteen and frightened is most of what a squad IS.
 */
export interface SquadSpec {
  readonly role: SquadRole
  readonly competence: number
  readonly nickname: string
}

/**
 * NICKNAMES, because that is how people in a squad are actually referred
 * to and a roster of surnames reads like a spreadsheet. Fictional.
 */
const NICKNAMES: readonly string[] = [
  'Doc', 'Tex', 'Preacher', 'Ghost', 'Ponytail', 'Smitty', 'Bulldog', 'Sparks',
  'Cowboy', 'Pockets', 'Halo', 'Tiny', 'Ace', 'Padre', 'Slim', 'Bones',
]

export function squadSpecsFor(
  world: World,
  tick: Tick,
  ownerId: EntityId,
  tourNumber: number,
): readonly SquadSpec[] {
  const rng = openStream(world.seed, Stream.CombatResolution, ownerId * 53 + tourNumber, tick + 7_100)
  const specs: SquadSpec[] = []
  const used = new Set<string>()
  for (let i = 0; i < SQUAD_SIZE; i += 1) {
    const role = ROLES[i % ROLES.length] ?? 'rifleman'
    let nickname = NICKNAMES[rng.nextIntInclusive(0, NICKNAMES.length - 1)] ?? 'Smitty'
    // Two men called Doc in one team is a bug, not colour.
    let guard = 0
    while (used.has(nickname) && guard < 20) {
      nickname = NICKNAMES[rng.nextIntInclusive(0, NICKNAMES.length - 1)] ?? 'Smitty'
      guard += 1
    }
    used.add(nickname)
    specs.push({
      role,
      // A team leader is not picked at random from the same pool: they are
      // usually the one who has done this longest.
      competence:
        role === 'leader'
          ? rng.nextIntInclusive(520, 900)
          : rng.nextIntInclusive(240, 820),
      nickname,
    })
  }
  return specs
}

/**
 * WHO IS STILL STANDING.
 *
 * A squad is stored on the tour rather than globally, because a squad is a
 * fact about a deployment: the same player on their third tour is standing
 * next to different people, and some of the ones from the first tour are
 * dead.
 */
export function livingSquad(members: readonly SquadMember[], world: World): readonly SquadMember[] {
  return members.filter((member) => {
    const person = world.people.get(member.personId)
    return person !== undefined && person.deathTick === null
  })
}

export function squadMemberOf(
  members: readonly SquadMember[],
  personId: EntityId,
): SquadMember | undefined {
  return members.find((member) => member.personId === personId)
}

/**
 * WHO GETS HIT WHEN SOMEBODY HAS TO.
 *
 * Weighted AGAINST competence rather than flat: the man who is good at
 * this survives things that kill the man who is not, and that is both true
 * and the reason a squad's losses are not random — you lose the nineteen-
 * year-old first, and everybody knows it while it is happening.
 *
 * Returns null when nobody is left, which the caller must handle: a squad
 * can be wiped, and pretending otherwise would put a floor under the worst
 * thing that can happen.
 */
export function pickCasualty(
  members: readonly SquadMember[],
  world: World,
  roll: number,
): SquadMember | null {
  const living = livingSquad(members, world)
  if (living.length === 0) return null
  const weights = living.map((member) => Math.max(40, 1_000 - member.competence))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let draw = roll % Math.max(1, total)
  for (let i = 0; i < living.length; i += 1) {
    const weight = weights[i] ?? 0
    if (draw < weight) return living[i] ?? null
    draw -= weight
  }
  return living[living.length - 1] ?? null
}

/**
 * HOW WELL SOMEBODY KNOWS THEM, 0-1000.
 *
 * Months standing next to each other, and it is what makes a loss cost
 * anything. A man who joined the team last month is a name; the one you
 * have been with for two tours is not, and the model should not pretend
 * those are the same event.
 */
export function bondWith(member: SquadMember, tick: Tick): number {
  const months = Math.max(0, tick - member.sinceTick)
  return Math.min(1_000, months * 28)
}

export function bondWords(bond: number): string {
  if (bond >= 700) return 'you have been together a long time'
  if (bond >= 380) return 'you know him'
  if (bond >= 120) return 'you are getting to know him'
  return 'he is new'
}

/**
 * THE LINE A SCREEN SHOWS FOR ONE OF THEM.
 *
 * Built here rather than in the component for the reason every other
 * document in this project is: a screen that composes its own description
 * eventually says something the world does not.
 */
export function squadLineFor(
  member: SquadMember,
  person: Person | undefined,
  tick: Tick,
): string {
  const name = person === undefined ? member.nickname : `${person.familyName}`
  const dead = person === undefined || person.deathTick !== null
  if (dead) return `${name} "${member.nickname}" — killed`
  return `${name} "${member.nickname}" · ${ROLE_TITLES[member.role as SquadRole] ?? member.role} · ${bondWords(bondWith(member, tick))}`
}
