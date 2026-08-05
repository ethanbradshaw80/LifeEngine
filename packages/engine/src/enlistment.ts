/**
 * THE RECRUITING STATION (M-ENLIST).
 *
 * WHAT THIS REPLACES. Enlisting was one button and one popup: you said yes,
 * and the world picked you a trade. The military career after it is the
 * deepest thing in the simulation — schools, boards, tours, awards, a
 * discharge document — and the door into it was a shrug.
 *
 * THE PIPELINE NOW: choose a service, sit the entry test, choose a job you
 * actually qualify for, sign the paper, report to basic. Or, with a degree,
 * take the other road entirely and commission — which is not "enlisted with
 * better pay" but a different entrance, a different school, a different way
 * of being given a job, and different moments once you have one.
 *
 * ON REAL NAMES. Job CODES and titles are real, on the owner's explicit
 * override. Named UNITS stay fictional in every preset, permanently — that
 * is the line the charter draws (§3), and it is the right one: a code is a
 * job title, a named unit is a body of real people with real casualties and
 * living members. Branch NAMES stay the preset's own, so Classic keeps its
 * fictional services and Real World Mode keeps its real ones.
 *
 * Pure reads and pure arithmetic. service.ts remains the single writer of
 * the service record.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { ageAt } from './clock.js'
import { educationRank, OFFICER_ROLES } from './content.js'
import type { OfficerRole, ServiceBranchSpec, ServiceSpecialty, World } from './types.js'
import { openStream, Stream } from './rng.js'

/** The lowest and highest an entry test can come out. */
export const APTITUDE_MIN = 1
export const APTITUDE_MAX = 99

/**
 * M-ENLIST §4. WHAT THEY BRING TO THE TEST, before the day itself.
 *
 * Read from what the world already knows about them — schooling and the
 * curiosity that got them through it — so the score is about the person
 * rather than a number from nowhere. Pure: no draw, no clock.
 */
export function aptitudeBaseFor(world: World, personId: EntityId): number {
  const person = world.people.get(personId)
  if (!person) return 45
  const level = world.education.get(personId)?.level ?? 'none'
  // Schooling is most of it: 30 at nothing, 70 at a degree.
  const schooling = 30 + educationRank(level) * 10
  // And the head they brought to it, worth up to twenty either way.
  const wit = Math.floor((person.traits.curiosity - 500) / 25)
  return Math.max(10, Math.min(85, schooling + wit))
}

/**
 * M-ENLIST §4. THE TEST ITSELF, 1-99.
 *
 * The base, plus the day they had — a seeded ten either way, because
 * nobody sits the same test twice the same. Deterministic from the seed and
 * the person: the same world always produces the same score, which is what
 * makes the eligible-job list replayable.
 */
export function entryTestScore(world: World, personId: EntityId): number {
  const rng = openStream(world.seed, Stream.Service, personId, 4_100)
  const variance = rng.nextIntInclusive(0, 20) - 10
  return Math.max(APTITUDE_MIN, Math.min(APTITUDE_MAX, aptitudeBaseFor(world, personId) + variance))
}

/** What a score opens, in words, for the result card. */
export function aptitudeWords(score: number): string {
  if (score >= 90) return 'every field the service has, including intelligence'
  if (score >= 75) return 'the technical fields and most of the rest'
  if (score >= 55) return 'the medical and technical trades'
  if (score >= 40) return 'most of the general trades'
  if (score >= 31) return 'the entry trades'
  return 'nothing yet — the recruiter will suggest sitting it again'
}

/** Every job this branch offers, in a stable order: open ones first. */
export function jobsOfBranch(
  specialties: readonly ServiceSpecialty[],
  branchId: string,
): readonly ServiceSpecialty[] {
  return specialties
    .filter((specialty) => specialty.branch === branchId)
    .slice()
    .sort((a, b) => (a.minAptitude ?? 0) - (b.minAptitude ?? 0) || a.id.localeCompare(b.id))
}

/**
 * WHY THIS JOB IS SHUT TO THEM, in plain English, or null when it is open.
 *
 * The `offenceBar` / `jobBar` pattern again: the list and the button read
 * one function, so a greyed row and an honest refusal cannot disagree.
 */
export function mosBar(
  specialty: ServiceSpecialty,
  aptitude: number,
  level: string,
): string | null {
  const needs = specialty.minAptitude ?? 0
  if (aptitude < needs) {
    return `Needs ${String(needs)} — you scored ${String(aptitude)}.`
  }
  const order = ['none', 'primary', 'secondary', 'trade', 'college']
  if (order.indexOf(level) < order.indexOf(specialty.requires)) {
    return specialty.requires === 'college'
      ? 'Needs a degree.'
      : `Needs ${specialty.requires} schooling.`
  }
  return null
}

export function eligibleJobs(
  specialties: readonly ServiceSpecialty[],
  branchId: string,
  aptitude: number,
  level: string,
): readonly ServiceSpecialty[] {
  return jobsOfBranch(specialties, branchId).filter(
    (specialty) => mosBar(specialty, aptitude, level) === null,
  )
}

// ---------------------------------------------------------------------------
// §5c. The officer road
// ---------------------------------------------------------------------------

/** A commission wants a degree. Everything else about it is tuning. */
export const COMMISSION_MIN_APTITUDE = 55
export const COMMISSION_MAX_AGE = 34

/** Why they cannot commission, or null when they can. */
export function commissionBar(world: World, personId: EntityId, tick: Tick): string | null {
  const person = world.people.get(personId)
  if (!person) return 'Nobody is being played.'
  const level = world.education.get(personId)?.level ?? 'none'
  if (level !== 'college') {
    return 'Requires a four-year degree. The college road is on the Jobs tab.'
  }
  const age = ageAt(person.birthTick, tick)
  if (age > COMMISSION_MAX_AGE) {
    return `The commissioning source takes candidates to ${String(COMMISSION_MAX_AGE)}; you are ${String(age)}.`
  }
  const score = world.service.get(personId)?.aptitude ?? entryTestScore(world, personId)
  if (score < COMMISSION_MIN_APTITUDE) {
    return `A commission wants ${String(COMMISSION_MIN_APTITUDE)} on the entry test — you scored ${String(score)}.`
  }
  return null
}

/** How this branch hands out officer jobs. Absent means assigned by needs. */
export function accessionOf(branch: ServiceBranchSpec): 'community-select' | 'merit-branch' | 'needs-assigned' {
  return branch.officerAccession ?? 'needs-assigned'
}

/** In words, for the screen that is about to do it to them. */
export function accessionWords(accession: string): string {
  if (accession === 'community-select') {
    return 'You choose your community. The competitive ones choose you back.'
  }
  if (accession === 'merit-branch') {
    return 'You list what you want. The service weighs it against what it needs.'
  }
  return 'The service assigns your career field. Rated seats are competed for.'
}

export function officerRolesOf(
  roles: readonly OfficerRole[],
  branchId: string,
): readonly OfficerRole[] {
  return roles.filter((role) => role.branch === branchId)
}

/**
 * §5c. THE MERIT SCORE an assignment is made on — aptitude, schooling and
 * the year's own luck. Seeded, so the same world always branches the same
 * candidate the same way.
 */
export function meritScoreFor(world: World, personId: EntityId, aptitude: number): number {
  const level = world.education.get(personId)?.level ?? 'none'
  const rng = openStream(world.seed, Stream.Service, personId, 4_200)
  return aptitude + educationRank(level) * 5 + rng.nextIntInclusive(0, 30)
}

/**
 * §5c. WHICH JOB THEY ACTUALLY GET, given what they asked for.
 *
 * The three accessions are genuinely different roads, which is the point:
 *
 *   community-select — they get what they picked, unless it is one of the
 *     competitive ones, which runs a selection on top.
 *   merit-branch — they list preferences and the service assigns one,
 *     often but not always the first.
 *   needs-assigned — the service decides, and a rated seat is competed for.
 *
 * Returns the role and whether it was their first choice, so the screen can
 * say so honestly when it was not.
 */
export function assignOfficerRole(
  world: World,
  personId: EntityId,
  branch: ServiceBranchSpec,
  roles: readonly OfficerRole[],
  preferences: readonly string[],
  aptitude: number,
): { role: OfficerRole | undefined; wasFirstChoice: boolean; reason: string } {
  const open = officerRolesOf(roles, branch.id).filter(
    (role) => aptitude >= (role.minAptitude ?? 0),
  )
  if (open.length === 0) return { role: undefined, wasFirstChoice: false, reason: '' }

  const wanted = preferences
    .map((id) => open.find((role) => role.id === id))
    .filter((role): role is OfficerRole => role !== undefined)
  const first = wanted[0]
  const merit = meritScoreFor(world, personId, aptitude)
  const rng = openStream(world.seed, Stream.Service, personId, 4_300)

  const fallback = (): OfficerRole => {
    // Whatever is left, weighted toward what they asked for next.
    const rest = wanted.slice(1)
    return (
      rest[0] ??
      open.filter((role) => role.competitive !== true)[
        rng.nextIntInclusive(0, Math.max(0, open.filter((r) => r.competitive !== true).length - 1))
      ] ??
      open[0]!
    )
  }

  const accession = accessionOf(branch)

  if (accession === 'community-select') {
    if (!first) return { role: fallback(), wasFirstChoice: false, reason: 'You named no community.' }
    if (first.competitive !== true) return { role: first, wasFirstChoice: true, reason: '' }
    // A competitive community selects back.
    if (merit >= 100) return { role: first, wasFirstChoice: true, reason: '' }
    const other = fallback()
    return {
      role: other,
      wasFirstChoice: false,
      reason: `The ${first.title} board did not select you. You were offered ${other.title}.`,
    }
  }

  if (accession === 'merit-branch') {
    // Ranked preferences, assigned on merit. High merit usually gets the
    // first; the rest go down the list.
    if (first && merit >= 95) return { role: first, wasFirstChoice: true, reason: '' }
    const other = fallback()
    return {
      role: other,
      wasFirstChoice: other.id === first?.id,
      reason:
        first && other.id !== first.id
          ? `The service branched you ${other.title}; your first choice, ${first.title}, went to higher-ranked candidates.`
          : '',
    }
  }

  // needs-assigned. A rated seat is competed for; everything else is given.
  if (first?.competitive === true) {
    if (merit >= 105) return { role: first, wasFirstChoice: true, reason: '' }
    const other = fallback()
    return {
      role: other,
      wasFirstChoice: false,
      reason: `The rated board selected others this year. The service assigned you ${other.title}.`,
    }
  }
  const assigned = first && merit >= 85 ? first : fallback()
  return {
    role: assigned,
    wasFirstChoice: assigned.id === first?.id,
    reason:
      first && assigned.id !== first.id
        ? `The service assigned you ${assigned.title} by its own needs.`
        : '',
  }
}

/**
 * M-ENLIST §5b. WHICH MOMENTS THIS PERSON CAN MEET.
 *
 * The job's own pool, or the branch's flavour where a job has none. This is
 * what stops a corpsman being handed a door breach and a sailor being
 * handed a street firefight.
 */
export function sceneTagsFor(
  specialty: ServiceSpecialty | undefined,
  role: OfficerRole | undefined,
  branch: ServiceBranchSpec | undefined,
): readonly string[] {
  if (role !== undefined && role.sceneTags.length > 0) return role.sceneTags
  if (specialty?.sceneTags !== undefined && specialty.sceneTags.length > 0) return specialty.sceneTags
  const flavor = branch?.combatFlavor ?? 'ground'
  if (flavor === 'sea') return ['sea_general_quarters', 'sea_fire_aboard', 'sea_manoverboard']
  if (flavor === 'air') return ['air_flightline_fire', 'base_defense', 'work_maint_fault']
  return ['combat_firefight', 'combat_patrol_ied', 'base_defense']
}

// ---------------------------------------------------------------------------
// §7. The recruiting station — what is on the wall before you sign anything.
// ---------------------------------------------------------------------------

/** One job on the recruiter's board. */
export interface StationJob {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly field: string
  readonly needsScore: number
  readonly needsSchooling: string
  /** Why this person could not take it TODAY, or null. Schooling only. */
  readonly bar: string | null
}

/** One service on the recruiter's board. */
export interface StationBranch {
  readonly id: string
  readonly name: string
  readonly accession: string
  readonly accessionWords: string
  readonly jobs: readonly StationJob[]
  readonly officerRoles: readonly { id: string; code: string; title: string; needsScore: number }[]
}

/**
 * M-ENLIST §7. THE BOARD ON THE RECRUITER'S WALL.
 *
 * Everything a person could see before they walk in: the three services,
 * what each one calls its jobs, what each job wants on the test, and what
 * an officer road looks like there.
 *
 * IT DOES NOT SHOW THEIR SCORE, and that is deliberate rather than an
 * oversight. They have not sat the test yet. What it CAN say honestly is
 * the schooling bar, because a person knows whether they have a degree —
 * so a job that needs one is greyed here, and a job that needs a 75 just
 * says it needs a 75.
 */
export function recruitingStationFor(world: World, personId: EntityId): readonly StationBranch[] {
  const level = world.education.get(personId)?.level ?? 'none'
  const order = ['none', 'primary', 'secondary', 'trade', 'college']
  return world.spec.branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    accession: accessionOf(branch),
    accessionWords: accessionWords(accessionOf(branch)),
    jobs: jobsOfBranch(world.spec.specialties, branch.id).map((specialty) => ({
      id: specialty.id,
      code: specialty.code ?? '',
      title: specialty.title,
      field: specialty.field ?? '',
      needsScore: specialty.minAptitude ?? 0,
      needsSchooling: specialty.requires,
      bar:
        order.indexOf(level) < order.indexOf(specialty.requires)
          ? specialty.requires === 'college'
            ? 'Needs a degree.'
            : `Needs ${specialty.requires} schooling.`
          : null,
    })),
    officerRoles: officerRolesOf(OFFICER_ROLES, branch.id).map((role) => ({
      id: role.id,
      code: role.code,
      title: role.title,
      needsScore: role.minAptitude ?? 0,
    })),
  }))
}
