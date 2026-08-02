/**
 * Serializable world state, and a state hash for determinism testing.
 *
 * Milestone 1 does NOT include save/load — that is Milestone 4. What is
 * required here is that world state CAN be serialized, because it must cross a
 * Web Worker boundary later and because the determinism tests need a stable
 * fingerprint of the whole world.
 *
 * The header carries schemaVersion, simulationVersion, seed, and userId from
 * the very first snapshot ever produced (ADR-0010). userId is "local" until
 * accounts exist at Milestone 6. It costs nothing now and avoids a migration
 * across every existing save later.
 */

import type { Seed, Tick } from '@life-engine/shared'
import type { World } from './types.js'

export const SCHEMA_VERSION = 1
/**
 * Simulation behaviour version.
 *
 * v1 — Milestone 1. Placeholder friendships; partnership was an accident of
 *      shared housing.
 * v11 — M-WOUNDS. Harm is specific: injury kinds and sites picked from the
 *      context (mill, road, convoy, base), illnesses named, permanent marks
 *      in words. Extra draws shift histories from v10.
 * v10 — L4-M4. Deployment and risk: homeland wars send the serving to
 *      theatres; danger computed monthly from the geopolitical state crossed
 *      with specialty exposure; wounds land on the health model; deaths run
 *      through performDeath. Lives differ from v9 wherever the Republic fought.
 * v29 — M-ARMY2. Peacetime rotations (owner direction): between wars the
 *      army still goes places. Six-month postings with allies of the same
 *      bloc, issued as ORDERS (a smaller share of the force than a war
 *      takes) or volunteered for; no enemy, so no combat channel and no
 *      campaign medal — the one hazard is the accident channel of a hard
 *      training tempo, crossed with the trade, and it can wound or rarely
 *      kill. A completed rotation earns standing at the next board. War
 *      recalls everyone home. Also: enlistments and homecomings left the
 *      town news (owner: the wall of cards buried everything else).
 * v28 — M-ARMY2. Career shape and misconduct (owner direction): up-or-out
 *      applies below E-5 only ("a ton of people retire at SGT, SSG"); a
 *      career is thirty years; the office takes volunteers to thirty-
 *      eight; sixty-two is the last year in uniform. And the mistakes at
 *      base arrived: company punishments — careless months produce them,
 *      a severe one can bust a stripe, and a third in five years ends the
 *      career by misconduct discharge, which is also the honest removal
 *      path for the ranks up-or-out no longer touches. Service histories
 *      differ from v27.
 * v27 — M-ARMY2. Enlistment is a modelled pull, not a flat rate: a parent
 *      who served draws the child a little (service-tradition, finally
 *      emitted), and recruiting drives — three months of roughly every
 *      third year, derived from the seed — triple the season's walk-ins
 *      for NPCs and the player's knock alike. And a death in uniform now
 *      CLOSES the service record ('died in service') — left open, a dead
 *      soldier counted against the deployment quota forever. Enlistment
 *      and service histories differ from v26.
 * v26 — M-ARMY2 4b. The founding town is 400 people (was ~100; owner
 *      direction — "300-500 so we have it all mixed"). Same generation
 *      path, bigger cast: a seed now names a different, larger town.
 *      Bands verified at the new size before the move (fertility
 *      2.36-2.48, town grows to ~800-950 by year 150, ~30 serving at
 *      any moment). Worlds ALREADY SAVED keep their own population and
 *      continue identically; only new worlds differ.
 * v25 — P2. A uniform is work: the marriage strain model stops counting a
 *      serving spouse as jobless (monthly idle decay, separation pressure,
 *      and the divorce record's financial-strain factor all read service
 *      now). Military-review fix — the stakes said one thing and the model
 *      did another. Serving couples' histories differ from v24.
 * v24 — P1. The record reads back: both parents carry 'had-child' (a
 *      father was invisible at his own child's birth), and the four
 *      player choices that were recorded but invisible gain feed events
 *      (convalesced / declined-board / kept-heads-down / reconciled).
 *      Six existing events gain Why? mappings; stakes screens speak the
 *      model's real numbers. NPC behaviour unchanged except the father
 *      event; every seed's serialized history differs from v23.
 * v23 — D2. The town must live: partner-seeking with meeting moments,
 *      family-intent marriage timing, family-size aspiration decided and
 *      recorded at the wedding, remarriage after recovery. The measured
 *      collapse (completed fertility 1.29-1.67, courtships 1-2 a decade)
 *      is repaired by modelled decisions — never a birth multiplier
 *      (ADR-0019). Lives differ from v22 for every seed.
 * v22 — C1. Crime and justice: arrears-driven theft moving real money,
 *      arrest, the courthouse, fines and jail months; jail is absence;
 *      criminal records gate hiring and enlistment for ten clean years
 *      and never rewrite history. The second Layer 4 institution.
 * v21 — M-DEPTH3. Workplace incidents name the machine and the shop
 *      ("a crush injury to the hand — the planer at the paper mill");
 *      wedding anniversaries (ten years, silver, golden) mark both feeds.
 * v20 — M-HARM review fixes. The combat moment carries the same fatal tail
 *      as the resolver and keeping down still rolls the month's danger;
 *      valor write-ups are rare (the act stays on the record regardless);
 *      rematch memory fades within a generation instead of ratcheting the
 *      world toward permanent peace; the dead in theatre have their tours
 *      closed and their campaign credit judged; two decoration names that
 *      were verbatim real medals are now invented.
 * v19 — M-HARM. Twenty-two new kinds of harm with their own marks; deaths
 *      name their cause; theatre disease (service-connected); twelve more
 *      contact flavors; the combat-moment decision; valor, meritorious
 *      service and long service decorations; geopolitical flashpoints
 *      drift by decade and rematches damp, so the Republic's wars stop
 *      being one neighbour's fault forever.
 * v18 — M-SPECOPS fix 2. Contact is not casualty: months in theatre roll
 *      combat events at 4x the old rate — took fire, mortars, a device on
 *      the route — into the feed with no wound; only a quarter escalate to
 *      the casualty path (rates preserved). "The Contact Star": combat-
 *      action recognition, once per war, from the recorded contact.
 * v17 — M-SPECOPS fix. Clearing the board cutoff clearly means selected:
 *      150+ points over promotes outright (player and NPC alike); the slot
 *      draw exists only near the line. A soldier at 796 against 510 was
 *      being passed over by a flat lottery, which is not what a cutoff is.
 * v16 — M-SPECOPS. Special schools (badge-granting, capability-named) and
 *      fictional special units with failable selection, duty pay and a
 *      sharper deployment; Service-tab actions (school requests, tryouts,
 *      on-demand volunteering); NPCs school and join units too.
 * v15 — M-SERVICE-PLAY. The career answers to the player: competitive
 *      stripes come only through the board question; schools and
 *      qualifications raise real standing; volunteering for the rotation;
 *      high-year tenure separates the passed-over at term's end; tab verbs
 *      (job applications, walk-in enlistment) resolved in-engine. NPC
 *      careers also differ (up-or-out, slower E-4 lateral).
 * v14 — L4-M5. Awards and veterans: wound recognition strictly from enemy
 *      action, campaign credit from qualifying tours, good conduct from
 *      completed honorable terms, qualification badges; disability pensions
 *      on the service-connected delta; deployment contact rates carry the
 *      threat vector's differences instead of saturating a cap. Combat
 *      outcomes and veteran incomes differ from v13.
 * v13 — M-GAMEDEPTH. Military realism: per-branch US-style rank ladders,
 *      monthly time-in-grade promotions (competitive from the board ranks,
 *      never skipped), grade-based pay table, and service texture — basic
 *      training, occupational school, exercises, qualifications, PCS moves.
 *      Service careers and incomes differ from v12 for every seed.
 * v12 — M-GAMEDEPTH. War pacing: escalation ~5x rarer, de-escalation
 *      stronger, and nations exhausted by a war start nothing new for 10-20
 *      years. Homeland wars become generational. Geo history differs from
 *      v11 for every seed.
 * v9 — L4-M3. Service careers: enlistment, specialties, ranks, terms,
 *      discharge and reenlistment; veterans carry unlocks home. Employment,
 *      income and life courses differ from v8.
 * v8 — L4-M2. Health: ailments with recovery, permanent disability, health-
 *      aware employment and mortality, and most fatal accidents becoming
 *      survivable injuries. Deaths and work histories differ from v7.
 * v7 — L4-M1. The world beyond the town: nations, an explainable conflict
 *      state machine on Stream 9, war phases, aggregate casualties. Serialized
 *      shape gains nations and geoRelations.
 * v6 — M-DEPTH2. Careers progress: annual performance reviews move pay
 *      toward the occupation ceiling; six new occupations and four new
 *      workplaces. Hiring pools and incomes differ from v5 for every seed.
 * v5 — M-SPEND. Discretionary spending: households spend 84-92% of the
 *      surplus above rent and living costs (thrift scales with diligence;
 *      nothing while in arrears). Savings now accumulate at believable
 *      rates, so every seed's balances — and everything money touches —
 *      differ from v4.
 * v4 — M-MONEY. Household finances: wages, rent, living costs, savings,
 *      arrears pressure, estate inheritance. Money now shapes moves, strain
 *      and separations, so every seed's history differs from v3.
 * v3 — M-DEPTH. Births moved to deliverChild() on a fresh RNG stream so a
 *      player-decided birth produces the identical child the automatic path
 *      would have; NPC children therefore differ from v2 for every seed.
 * v2 — Milestone 5. The relationships domain: compatibility-driven friendship,
 *      courtship, marriage, divorce and widowhood, and births that require an
 *      actual partnership. Results differ from v1 for every seed, which is what
 *      a version bump is for (docs/DETERMINISM.md §7).
 */
export const SIMULATION_VERSION = 29

/** Placeholder until accounts arrive at Milestone 6. */
export const LOCAL_USER_ID = 'local'

export interface SnapshotHeader {
  readonly schemaVersion: number
  readonly simulationVersion: number
  readonly seed: Seed
  readonly tick: Tick
  readonly userId: string
}

export interface WorldSnapshot {
  readonly header: SnapshotHeader
  readonly body: unknown
}

/**
 * Convert to plain JSON-safe data. Maps become sorted arrays of entries —
 * sorted, not insertion-ordered, so that two worlds with identical content
 * always serialize identically regardless of the order things were created.
 */
export function toSnapshot(world: World): WorldSnapshot {
  return {
    header: {
      schemaVersion: SCHEMA_VERSION,
      simulationVersion: SIMULATION_VERSION,
      seed: world.seed,
      tick: world.tick,
      userId: LOCAL_USER_ID,
    },
    body: {
      nextEntityId: world.nextEntityId,
      nextEventId: world.nextEventId,
      nextCausalRecordId: world.nextCausalRecordId,
      town: world.town,
      places: [...world.places.values()].sort((a, b) => a.id - b.id),
      people: [...world.people.values()].sort((a, b) => a.id - b.id),
      households: [...world.households.values()].sort((a, b) => a.id - b.id),
      education: [...world.education.values()].sort((a, b) => a.personId - b.personId),
      employment: [...world.employment.values()].sort((a, b) => a.personId - b.personId),
      health: [...world.health.values()].sort((a, b) => a.personId - b.personId),
      service: [...world.service.values()].sort((a, b) => a.personId - b.personId),
      deployments: [...world.deployments.entries()]
        .sort(([a], [b]) => a - b)
        .map(([personId, tours]) => ({ personId, tours })),
      awards: [...world.awards.entries()]
        .sort(([a], [b]) => a - b)
        .map(([personId, decorations]) => ({ personId, decorations })),
      criminal: [...world.criminal.values()].sort((a, b) => a.personId - b.personId),
      relationships: [...world.relationships.values()].sort((a, b) => a.a - b.a || a.b - b.b),
      events: world.events,
      causalRecords: world.causalRecords,
      nations: [...world.nations.values()].sort((a, b) => a.id - b.id),
      geoRelations: [...world.geoRelations.values()].sort((a, b) => a.a - b.a || a.b - b.b),
      player: {
        personId: world.player.personId,
        pending: world.player.pending,
        log: world.player.log,
        nextDecisionId: world.player.nextDecisionId,
        lineage: world.player.lineage,
      },
    },
  }
}

/**
 * Deterministic JSON with object keys sorted.
 *
 * JSON.stringify follows insertion order, so two structurally identical
 * objects built in different orders would stringify differently and produce
 * different hashes. Sorting keys removes that.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

export function serialize(world: World): string {
  return canonical(toSnapshot(world))
}

/**
 * A 32-bit fingerprint of the entire world. Two runs of the same seed must
 * produce the same hash at every tick; if they diverge, bisect by tick to find
 * where (docs/DETERMINISM.md §10).
 *
 * FNV-1a, inlined. This is called once per tick by the determinism tests over a
 * serialized world that reaches megabytes, so the per-character cost matters:
 * an earlier version called a helper with rest-arguments per character and made
 * the test suite take minutes instead of seconds. Not a cryptographic hash —
 * it only needs to detect change, which it does well.
 */
export function worldHash(world: World): number {
  const text = serialize(world)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Hex form, for committing golden values and reading in logs. */
export function worldHashHex(world: World): string {
  return worldHash(world).toString(16).padStart(8, '0')
}
