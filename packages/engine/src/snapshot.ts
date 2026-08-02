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
 * v49 — AVIATION (ADR-0026). Two flying trades, a flight school, and the
 *      Nighthawk Squadron. New trades change who takes which job at
 *      enlistment and which civilian career follows, so every seed's
 *      working lives differ from v48 — not only the ones who flew.
 * v48 — CAPTURE (ADR-0025). A bad month against enemy contact can end in
 *      a soldier being taken prisoner instead of wounded — the third thing
 *      a bad day can end in, and the reason the Prisoner of War Medal is
 *      grantable at all. A captive's tour stops running on the calendar.
 *      The extra draw shifts every seed where the Republic fought.
 * v47 — EVERY BRANCH GETS A UNIT (owner's combat plan §1b). The Trident
 *      Detachment, the Guardian Flight, the Vanguard Group and the Grey
 *      Section join the Pathfinders and Ember, so Drop a Packet is never
 *      empty for anybody and each branch has a real chain: entry unit asks
 *      for the badge its road is paved with, the tier above draws from the
 *      unit below. NPC selection rolls against a different unit list, so
 *      every world with a soldier in it differs from v46.
 * v46 — THE AWARDS PACK (owner spec, ADR-0024). Decorations and badges
 *      carry their REAL names; the campaign medal is generic and never
 *      named for a war this engine invented; combat recognition takes its
 *      face from the trade (infantryman, medic, everyone else); and seven
 *      new ribbons grant from events the engine already records. Every
 *      award still grants only from a qualifying event — that rule is what
 *      makes the real names safe.
 * v45 — SCHOOL HOUSES WITH A CALENDAR (owner spec). Schools carry their
 *      REAL names (ADR-0023), a course length, a class cadence and seats.
 *      Asking no longer rolls one-in-three for an instant badge: you take a
 *      seat in the next class on a fixed grid, wait for it, attend, and the
 *      badge is pinned on at graduation — for NPCs as well as the player,
 *      because a calendar only the player sees is a menu, not a school.
 * v44 — COALITIONS (owner spec, ADR-0022). A belligerent that is losing
 *      calls on its allies, and the ones that answer declare against the
 *      same enemy — so a coalition is built out of ordinary pairwise
 *      wars. Alignment now sets standing alliance membership, which the
 *      call needs and ADR-0022 §3 discloses. Wars spread now, so any world
 *      with a long enough war differs from v43.
 * v43 — WAR LENGTH AND DIFFICULTY (owner spec). A war's length is ROLLED
 *      at the outbreak — 2 to 15 years, quick when the sides are
 *      mismatched and a grind when they are even — and that length is a
 *      ceiling weariness can still beat. Nations carry a combat rating
 *      (the preset's, or derived from strength) and the months they have
 *      spent at war; ten years of fighting is worth a point of hard-won
 *      toughness, three at most. The threat a deployed soldier faces now
 *      scales on the GAP between the two sides rather than on the enemy
 *      alone. Every war in every world differs from v42.
 * v42 — W2 review. The campaign decoration is named for the SERVICE, not
 *      for the enemy: with real countries on the map the old
 *      `the ${enemy} Campaign Medal` minted "the Afghanistan Campaign
 *      Medal", the verbatim name of a real United States decoration, onto
 *      a permanent record — and awards are fictional in EVERY preset.
 *      One medal with a device per campaign, which is how they work.
 *      Also: a nation name that carries its own article no longer doubles
 *      it ("the the United Kingdom front") in citations, death records and
 *      headlines.
 * v41 — W1 (resistances 4 and 5). Three events carried DISPLAY NAMES in
 *      their detail — 'joined-unit' and 'dropped-selection' the unit's
 *      name, 'passed-over' the rank's title — and two of them were then
 *      string-matched to enforce the two-drop cap and to count prior
 *      non-selections. A name belongs to a preset's content; matching on
 *      one means renaming a unit silently reopens a closed file. They
 *      carry the unit ID and the ladder INDEX now, and story.ts makes the
 *      words at render time. Saves written before this keep their names:
 *      the renderer falls back to the detail as written, so old stories
 *      read exactly as they did.
 * v40 — P3. The arrears crossing event now names the HOUSEHOLD it happened
 *      to (previously only the person who headed it that month), so the
 *      Money tab can pair fell-behind with back-in-the-black for the right
 *      roof. The review found the old read — by current member — importing
 *      a mover's crossings into their partner's household and rendering a
 *      spell that happened to nobody. No behaviour changes: same draws,
 *      same lives, one more field on two event types.
 * v39 — CENSUS NAMES (owner-supplied). The town drew from 32 male, 32
 *      female and 40 invented family names, so four hundred people meant a
 *      dozen Jameses and everybody a Thorne or a Whitlock. It now draws
 *      from the 1990 US Census — 300 / 500 / 1,000 — WEIGHTED by real
 *      frequency, so a town holds several Smiths and one Kowalczyk. Draw
 *      counts are unchanged (pickWeighted spends one draw like pick did),
 *      so every life plays out exactly as it did; only the names differ.
 * v38 — C2: THE PLAYER AND THE LAW. C1 kept the played life a bystander,
 *      because an off-screen theft would be an unchosen crime on a chosen
 *      timeline. Now the desperation moment the simulation already rolled
 *      is the player's to answer, with both roads real — going without is
 *      recorded as the choice it was. Arrest no longer sentences anyone
 *      off-screen: the courthouse waits for a plea, and pleading guilty
 *      buys a lighter hand at the cost of any chance of acquittal.
 *      A CHARGE SHEET of 22 offences (owner direction), graded the way US
 *      state codes grade them, each with its own clearance rate and its
 *      grade's statutory ceiling. NPC crime is untouched — its desperation
 *      theft keeps C1's own measured sentencing.
 * v37 — WARS GRIND NATIONS DOWN. A country's strength was a constant for
 *      all time, so a nation could bleed for twenty years and finish
 *      exactly as dangerous as it started — and our own soldiers' threat
 *      vector reads that number, so an enemy never wore down whatever the
 *      war cost them. Strength now erodes with a nation's own cumulative
 *      losses (counted off the running total, because a month's toll
 *      floors to zero), never below a floor, and the years of peace
 *      rebuild it toward `baseStrength` — the peacetime weight the
 *      country was generated with, which never moves. Schema v20.
 * v36 — SURVIVOR BENEFITS. A pension no longer dies with the person who
 *      earned it: a widow or widower draws 55% of what their spouse was
 *      owed, for life. Derived from the widowed edge and the service
 *      record — no schema change — and granted on the record at the
 *      death, never as silent income. This became urgent the moment
 *      careers started paying: without it, every service family was
 *      impoverished at exactly the worst moment.
 * v35 — RETIREMENT PAY. A career now ends with money. Twenty years is the
 *      door M-ARMY2's own career shape already put there; a quarter of a
 *      per-cent per month served pays half the final wage at twenty and
 *      three quarters at thirty, for life, and it stacks with any
 *      disability pension because a wounded lifer is owed for both. A
 *      four-year term pays nothing — that is what makes twenty years mean
 *      something — and a career ended at the orderly room ends the claim
 *      with it. Household income moves for every retiring veteran, so
 *      this is an NPC-visible change.
 * v34 — M-ARMY2, military review fixes. A support tour looks its war up by
 *      its own pair instead of the homeland's list, so fighting beside an
 *      ally now actually happens — it used to close on the first tick,
 *      which made the whole feature a one-month bus ride. Field aid no
 *      longer stacks a second death roll on a wound the automatic
 *      resolver already judged (the player's wounds were half again as
 *      lethal as anyone else's, and standing near a player medic was
 *      dangerous); the moment now carries the tail instead. An accident
 *      death is recorded as an accident and earns no combat decoration.
 *      A compounded wound records the NEW injury's kind and site, so the
 *      diagram cannot show last month's.
 * v33 — M-ARMY2. The minutes after a wound (owner direction). A serious
 *      wound now stops the world for the person carrying it: a diagram of
 *      where it landed, how bad it is and what it may leave, and a real
 *      choice — press it, call out, or lie still. A player MEDIC gets the
 *      same moment aimed at a squadmate. The odds come from the severity
 *      the model already rolled; every answer can still lose a grave
 *      wound, and none of them rewrites the peak the body hit, because
 *      that is what lasting damage is judged on. Player-path only, so the
 *      unplayed world is untouched.
 * v32 — M-ARMY2. Unit rosters and an ally's war. A soldier now serves in a
 *      named squad at their posting — derived from (person, base), so no
 *      schema moved and squadmates stay squadmates until someone
 *      transfers — and whoever really holds the rank leads it. And when
 *      the allied country a rotation is posted to goes to war, that is a
 *      moment rather than a bus home (owner: "we should actually be able
 *      to go and deploy over there... so that we can get more combat if
 *      wanted"): the player is asked, an NPC answers with their own roll,
 *      and staying opens a real tour against the ally's enemy under every
 *      casualty rule the Republic's own wars use. The Service tab's
 *      volunteer button offers an ally's war ahead of a quiet posting.
 * v31 — M-ARMY2. Wars kill (owner: "we had a war and I didn't see anybody
 *      die to any combat exposure"). MEASURED first: a 20-year attrition
 *      war with 40 enlisted gave 75-85 contacts, 25 wounded and ZERO dead
 *      on three seeds — the fatal gate wanted a severity roughly a
 *      thousand-to-one draw. It now sits inside the serious band, so the
 *      dead come out of the wounds that were already grave: 2-3
 *      townspeople across a long war, 8-33% of casualties. The player's
 *      combat moments rose from a quarter of contacts to three fifths,
 *      and the routine base questions (school slots, rotation lists)
 *      halved — the noise was crowding out the choices that matter. The
 *      GOLDEN IS UNCHANGED: its 120-tick window holds no war casualty and
 *      no player, so only war and played worlds differ.
 * v30 — M-ARMY2, military review fixes. The rotation accident channel is
 *      computed per ten thousand, so the trade's exposure survives the
 *      integer arithmetic instead of flooring every specialty to the same
 *      risk. A host that goes to war sends its guests home. Twenty years
 *      is a retirement door, and the career ceiling rises with the grade
 *      (E-5 twenty, above that thirty). Company punishments run about
 *      twice as often, so the third-strike discharge is a path a career
 *      can actually meet. The promotion board reads live time in grade.
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
export const SIMULATION_VERSION = 49

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
