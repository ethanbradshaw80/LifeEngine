/**
 * Geopolitics: the world beyond the town. L4-M1.
 *
 * A dozen fictional nations plus the homeland, each a bundle of STATISTICS —
 * strength, economy, stability, casualties as numbers. No individual foreign
 * person is ever simulated (LAYER4_PLAN §3, the aggregate rule, grounded in
 * the measured O(n²) tick cost). The player experiences this world as news;
 * later layers will experience it as orders.
 *
 * THE PERMANENT RULE (MILITARY_AND_WAR_FOUNDATION §2): nothing here stores a
 * danger value per country. Relations and conflict state are what exist;
 * danger will be COMPUTED from them at L4-M4, per assignment, as a vector.
 *
 * Every transition writes a causal record — a war must be explainable
 * (Law 3 at planetary scale). Nations are entities with ids, so the existing
 * event and causal-record machinery serves unchanged; person queries never
 * see them because nothing links a nation id to a person's history.
 *
 * All randomness on Stream.Geopolitics — reserved as stream 9 in Milestone 1
 * for exactly this day. Pair draws are keyed on a stable pair number so one
 * border's luck never perturbs another's.
 */

import type { EntityId, Tick } from '@life-engine/shared'
import { NATION_NAMES } from './content.js'
import { factor, recordDecision, recordEvent } from './records.js'
import { hash32, openStream, Stream } from './rng.js'
import type { GeoRelation, GeoState, Nation, World } from './types.js'

// --- Tunables ---------------------------------------------------------------

/** Foreign nations generated at world creation, plus the homeland. */
const FOREIGN_NATION_COUNT = 12
/** Alliance blocs. Membership dampens war within a bloc, feeds rivalry across. */
const BLOC_COUNT = 3

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function homeland(world: World): Nation | undefined {
  for (const nation of world.nations.values()) {
    if (nation.isHomeland) return nation
  }
  return undefined
}

export function relationKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export function relationBetween(world: World, a: EntityId, b: EntityId): GeoRelation | undefined {
  return world.geoRelations.get(relationKey(a, b))
}

/** Active wars, sorted for determinism. */
export function activeWars(world: World): GeoRelation[] {
  const wars: GeoRelation[] = []
  for (const relation of world.geoRelations.values()) {
    if (relation.state === 'war') wars.push(relation)
  }
  wars.sort((x, y) => x.a - y.a || x.b - y.b)
  return wars
}

export function isAtWar(world: World, nationId: EntityId): boolean {
  return activeWars(world).some((war) => war.a === nationId || war.b === nationId)
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Called once from createWorld. Deterministic from the world seed. */
export function generateNations(world: World): void {
  const rng = openStream(world.seed, Stream.Geopolitics, 0, 0)

  // The homeland: the nation the town lives in. Stands in for the game's
  // US-like setting without naming a real state (fictional-world constraint);
  // strong, stable, and — like everyone else — not exempt from history.
  const homeId = allocate(world)
  const homeStrength = 900 + rng.nextInt(0, 80)
  world.nations.set(homeId, {
    id: homeId,
    name: 'the Republic',
    isHomeland: true,
    strength: homeStrength,
    baseStrength: homeStrength,
    economy: 850 + rng.nextInt(0, 120),
    stability: 800 + rng.nextInt(0, 150),
    bloc: 0,
    exhaustedUntilTick: null,
  })

  for (let i = 0; i < FOREIGN_NATION_COUNT; i++) {
    const id = allocate(world)
    const name = NATION_NAMES[i % NATION_NAMES.length] ?? `Nation ${String(i)}`
    const strength = rng.nextBellInt(150, 900)
    world.nations.set(id, {
      id,
      name,
      isHomeland: false,
      strength,
      baseStrength: strength,
      economy: rng.nextBellInt(150, 900),
      stability: rng.nextBellInt(200, 950),
      // Bloc 0 is the homeland's; some nations are non-aligned (null).
      bloc: rng.chance(1, 4) ? null : rng.nextInt(0, BLOC_COUNT),
      exhaustedUntilTick: null,
    })
  }

  // Every pair starts somewhere believable: mostly peace, a few old grudges.
  const nations = [...world.nations.values()].sort((x, y) => x.id - y.id)
  for (let i = 0; i < nations.length; i++) {
    for (let j = i + 1; j < nations.length; j++) {
      const a = nations[i]
      const b = nations[j]
      if (!a || !b) continue
      const sameBloc = a.bloc !== null && a.bloc === b.bloc
      const grudge = !sameBloc && rng.chance(1, 7)
      world.geoRelations.set(relationKey(a.id, b.id), {
        a: a.id,
        b: b.id,
        state: grudge ? 'tension' : 'peace',
        sinceTick: world.tick,
        warPhase: null,
        casualtiesA: 0,
        casualtiesB: 0,
      })
    }
  }
}

function allocate(world: World): EntityId {
  const id = world.nextEntityId as EntityId
  world.nextEntityId += 1
  return id
}

// ---------------------------------------------------------------------------
// The monthly world tick
// ---------------------------------------------------------------------------

/**
 * Escalation ladder for L4-M1. A deliberate subset of the foundation §4 list;
 * proxy conflict, insurgency, occupation and the rest arrive with the
 * milestones that need them. Order matters: it is the ladder.
 */
const LADDER: readonly GeoState[] = ['peace', 'tension', 'sanctions', 'skirmish', 'war']

/** No war reduces a country to nothing; there is always a floor. */
const WAR_STRENGTH_FLOOR = 120
/** Aggregate losses that cost one point of national strength. */
const STRENGTH_PER_LOSS = 260
/** Months of peace to rebuild one point toward the peacetime baseline. */
const STRENGTH_RECOVERY_MONTHS = 6

/**
 * The years build back what the war took — toward the country's own
 * peacetime weight, never past it, and only while it is fighting nobody.
 * Rebuilding is slower than ruin, which is the honest shape of it.
 */
function recoverStrength(world: World, tick: Tick): void {
  if (tick % STRENGTH_RECOVERY_MONTHS !== 0) return
  const fighting = new Set<EntityId>()
  for (const relation of world.geoRelations.values()) {
    if (relation.state !== 'war') continue
    fighting.add(relation.a)
    fighting.add(relation.b)
  }
  const ids = [...world.nations.keys()].sort((x, y) => x - y)
  for (const id of ids) {
    const nation = world.nations.get(id)
    if (!nation || fighting.has(id)) continue
    if (nation.strength >= nation.baseStrength) continue
    world.nations.set(id, { ...nation, strength: nation.strength + 1 })
  }
}

export function runGeopolitics(world: World, tick: Tick): void {
  recoverStrength(world, tick)
  const relations = [...world.geoRelations.values()].sort((x, y) => x.a - y.a || x.b - y.b)

  for (const relation of relations) {
    const a = world.nations.get(relation.a)
    const b = world.nations.get(relation.b)
    if (!a || !b) continue

    // One stream per pair per month: pair key folds both ids so one border's
    // draws never shift another's (the derived-stream principle).
    const rng = openStream(world.seed, Stream.Geopolitics, relation.a * 4096 + relation.b, tick)

    if (relation.state === 'war') {
      resolveWarMonth(world, tick, relation, a, b, rng)
      continue
    }

    if (relation.state === 'ceasefire') {
      // Ceasefires cool into peace, or occasionally reignite while raw.
      const months = tick - relation.sinceTick
      if (months > 18 && rng.chance(60 + months, 2_400)) {
        transition(world, tick, relation, 'peace', [
          factor('war-weariness', 400),
          factor('long-peace', Math.min(600, months)),
        ], `peace restored between ${a.name} and ${b.name}`)
      } else if (months < 10 && rng.chanceInTenThousand(25)) {
        transition(world, tick, relation, 'war', [
          factor('old-grudge', 700),
        ], `fighting resumed between ${a.name} and ${b.name}`, 'opening')
      }
      continue
    }

    // Peacetime ladder. Escalation pressure is modelled, not arbitrary:
    // instability at home, bloc rivalry, and economic gap all push; shared
    // blocs and general prosperity pull the other way.
    const sameBloc = a.bloc !== null && a.bloc === b.bloc
    const instability = 2000 - a.stability - b.stability // 0..2000, high is bad
    const rivalry = !sameBloc && a.bloc !== null && b.bloc !== null ? 220 : 0
    const economicGap = Math.abs(a.economy - b.economy)

    const stepIndex = LADDER.indexOf(relation.state)

    // WHICH border runs hot drifts on a decade scale (owner: "we only get
    // into wars with Osmark" — static bloc rivalry made one neighbour the
    // world's only quarrel, forever). Zero-mean before the clamps (the >0
    // gate and the 400 cap bend it slightly either way at the margins), so
    // the overall pace of war stays roughly tuned; deterministic from the
    // pair and the decade — a fact about the era, not a die roll.
    const flashpoint =
      (hash32(relation.a * 100_003 + relation.b * 7 + Math.floor(tick / 120) * 31) % 181) - 90

    // And a pair that has already buried its dead escalates reluctantly —
    // but memory FADES (review: a permanent −120 was a one-way ratchet
    // toward a world of permanent peace, which is not what history does).
    // Full weight for a decade after the pair's last turn of state, gone
    // within a generation.
    const foughtBefore = relation.casualtiesA + relation.casualtiesB > 0
    const rematchDamping = foughtBefore
      ? Math.max(0, 120 - Math.floor((tick - relation.sinceTick) / 12) * 6)
      : 0

    const escalationPressure =
      Math.floor(instability / 12) +
      rivalry +
      Math.floor(economicGap / 6) +
      flashpoint -
      (sameBloc ? 300 : 0) -
      rematchDamping

    // A nation that just fought a war starts nothing new for a decade or two.
    // Exhaustion suppresses the escalation branch entirely, which also lets a
    // still-heated pair fall through to de-escalation and cool off.
    const exhausted =
      (a.exhaustedUntilTick !== null && tick < a.exhaustedUntilTick) ||
      (b.exhaustedUntilTick !== null && tick < b.exhaustedUntilTick)

    // Escalate one rung, rarely; further rungs are likelier once on the ladder.
    // First tuning produced 20 concurrent wars by year 20 — a world on fire.
    // Second tuning (600k base) still gave the homeland a war roughly every
    // eight years — "wars literally every year" as news. These denominators
    // put a ratchet pair's full peace-to-war climb at ~3 centuries, which
    // lands homeland wars at a few per century: generational, not routine.
    if (stepIndex >= 0 && stepIndex < LADDER.length - 1 && escalationPressure > 0 && !exhausted) {
      const odds = 4 + stepIndex * 14
      if (rng.chance(Math.min(escalationPressure, 400), Math.floor(2_000_000 / odds))) {
        const next = LADDER[stepIndex + 1]
        if (next) {
          const inputs = [
            ...(rivalry > 0 ? [factor('bloc-rivalry', rivalry)] : []),
            ...(instability > 900 ? [factor('internal-instability', Math.floor(instability / 2))] : []),
            ...(economicGap > 250 ? [factor('resource-competition', economicGap)] : []),
            ...(flashpoint > 45 ? [factor('regional-flashpoint', flashpoint * 8)] : []),
          ]
          transition(
            world, tick, relation, next,
            inputs.length > 0 ? inputs : [factor('old-grudge', 300)],
            next === 'war'
              ? `war broke out between ${a.name} and ${b.name}`
              : describeStep(next, a.name, b.name),
            next === 'war' ? 'opening' : null,
          )
        }
      }
      continue
    }

    // De-escalation: calm is the default direction of history here.
    if (stepIndex > 0 && rng.chance(60 + (sameBloc ? 60 : 0), 3_000)) {
      const previous = LADDER[stepIndex - 1]
      if (previous) {
        transition(world, tick, relation, previous, [
          factor('long-peace', tick - relation.sinceTick),
        ], describeStep(previous, a.name, b.name))
      }
    }
  }
}

/** War months: phases turn, casualties accumulate as numbers, and wars END. */
function resolveWarMonth(
  world: World,
  tick: Tick,
  relation: GeoRelation,
  a: Nation,
  b: Nation,
  rng: ReturnType<typeof openStream>,
): void {
  const months = tick - relation.sinceTick

  // Phase wheel: opening → attrition ⇄ offensive → stalemate, by duration and draw.
  let phase = relation.warPhase ?? 'opening'
  if (phase === 'opening' && months >= 4) phase = 'attrition'
  else if (phase === 'attrition' && rng.chance(1, 14)) phase = 'offensive'
  else if (phase === 'offensive' && rng.chance(1, 6)) phase = 'stalemate'
  else if (phase === 'stalemate' && rng.chance(1, 10)) phase = 'attrition'

  // Casualties: aggregate numbers, scaled by opposing strength and phase.
  // (The aggregate rule in action — this is the entire foreign population model.)
  const intensity = phase === 'opening' || phase === 'offensive' ? 3 : phase === 'attrition' ? 2 : 1
  const lossesA = Math.floor((b.strength * intensity * (8 + rng.nextInt(0, 8))) / 60)
  const lossesB = Math.floor((a.strength * intensity * (8 + rng.nextInt(0, 8))) / 60)

  const updated: GeoRelation = {
    ...relation,
    warPhase: phase,
    casualtiesA: relation.casualtiesA + lossesA,
    casualtiesB: relation.casualtiesB + lossesB,
  }
  world.geoRelations.set(relationKey(relation.a, relation.b), updated)

  // A war grinds the countries fighting it. Strength used to be a fixed
  // number for all time, so a nation could bleed for twenty years and end
  // it exactly as dangerous as it began — and the threat vector our own
  // soldiers face reads that number, so an enemy never wore down no
  // matter what the war cost them. It erodes with their OWN losses now,
  // slowly, and the peace builds it back (recoverStrength, below).
  // Counted off the RUNNING total, not the month: a month's losses divided
  // by the cost of a point floors to zero and a war would grind nobody
  // down at all. This asks how many whole points the cumulative toll has
  // crossed since last month, so nothing is lost to integer truncation.
  const crossed = (before: number, after: number): number =>
    Math.floor(after / STRENGTH_PER_LOSS) - Math.floor(before / STRENGTH_PER_LOSS)
  const wornA = crossed(relation.casualtiesA, updated.casualtiesA)
  const wornB = crossed(relation.casualtiesB, updated.casualtiesB)
  if (wornA > 0) {
    world.nations.set(a.id, { ...a, strength: Math.max(WAR_STRENGTH_FLOOR, a.strength - wornA) })
  }
  if (wornB > 0) {
    world.nations.set(b.id, { ...b, strength: Math.max(WAR_STRENGTH_FLOOR, b.strength - wornB) })
  }

  // Wars end: weariness grows with duration and losses, and one-sided
  // punishment forces the issue sooner.
  const totalLosses = updated.casualtiesA + updated.casualtiesB
  const asymmetry = Math.abs(updated.casualtiesA - updated.casualtiesB)
  const weariness = months * 3 + Math.floor(totalLosses / 900) + Math.floor(asymmetry / 500)
  if (months > 6 && rng.chance(Math.min(weariness, 900), 18_000)) {
    transition(world, tick, updated, 'ceasefire', [
      factor('war-weariness', Math.min(1000, weariness)),
      factor('heavy-casualties', Math.min(1000, Math.floor(totalLosses / 120))),
    ], `ceasefire between ${a.name} and ${b.name}`)

    // Both nations come home exhausted: 10-20 years before either starts a
    // new escalation, longer the more worn down the war left them. No draw —
    // exhaustion follows from the recorded weariness, so it is explainable.
    const restUntil = (tick + 120 + Math.min(120, weariness)) as Tick
    world.nations.set(a.id, { ...a, exhaustedUntilTick: restUntil })
    world.nations.set(b.id, { ...b, exhaustedUntilTick: restUntil })
  }
}

function describeStep(state: GeoState, aName: string, bName: string): string {
  switch (state) {
    case 'tension':
      return `relations soured between ${aName} and ${bName}`
    case 'sanctions':
      return `${aName} and ${bName} traded sanctions`
    case 'skirmish':
      return `border clashes between ${aName} and ${bName}`
    case 'peace':
      return `relations warmed between ${aName} and ${bName}`
    default:
      return `${aName} and ${bName}`
  }
}

const EVENT_BY_STATE: Record<GeoState, 'war-began' | 'ceasefire' | 'peace-restored' | 'tensions-shifted'> = {
  war: 'war-began',
  ceasefire: 'ceasefire',
  peace: 'peace-restored',
  tension: 'tensions-shifted',
  sanctions: 'tensions-shifted',
  skirmish: 'tensions-shifted',
}

function transition(
  world: World,
  tick: Tick,
  relation: GeoRelation,
  next: GeoState,
  inputs: ReturnType<typeof factor>[],
  headline: string,
  warPhase: GeoRelation['warPhase'] = null,
): void {
  world.geoRelations.set(relationKey(relation.a, relation.b), {
    ...relation,
    state: next,
    sinceTick: tick,
    warPhase,
    // Casualty counts persist through ceasefire into the record; a NEW war
    // starts its own count.
    casualtiesA: next === 'war' && relation.state !== 'war' ? 0 : relation.casualtiesA,
    casualtiesB: next === 'war' && relation.state !== 'war' ? 0 : relation.casualtiesB,
  })

  recordEvent(world, tick, {
    type: EVENT_BY_STATE[next],
    subjectId: relation.a,
    otherId: relation.b,
    detail: headline,
  })
  recordDecision(world, tick, {
    subjectId: relation.a,
    decision: 'geopolitics',
    significance: next === 'war' || next === 'ceasefire' ? 'defining' : 'notable',
    inputs,
    chosen: headline,
    rejected: [],
    streamId: Stream.Geopolitics,
  })
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface NewsItem {
  readonly tick: Tick
  readonly text: string
  /** Homeland involvement, for the feed to emphasize. */
  readonly nearby: boolean
}

/**
 * The world's news since a given tick, newest last. Only the changes worth a
 * townsperson's attention: wars, ceasefires, peace — plus every shift that
 * involves the homeland, because that one is never far away.
 */
export function newsSince(world: World, sinceTick: Tick): NewsItem[] {
  const home = homeland(world)
  const items: NewsItem[] = []
  for (const event of world.events) {
    if (event.tick < sinceTick) continue
    if (
      event.type !== 'war-began' &&
      event.type !== 'ceasefire' &&
      event.type !== 'peace-restored' &&
      event.type !== 'tensions-shifted'
    ) {
      continue
    }
    const nearby = home !== undefined && (event.subjectId === home.id || event.otherId === home.id)
    if (event.type === 'tensions-shifted' && !nearby) continue // foreign squabbles are not news here
    items.push({ tick: event.tick, text: event.detail ?? 'events abroad', nearby })
  }
  return items
}
