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
import { factor, recordDecision, recordEvent } from './records.js'
import { hash32, openStream, Stream } from './rng.js'
import type { Rng } from './rng.js'
import type { GeoRelation, GeoState, Nation, World } from './types.js'
import type { Alignment } from './realnations.js'

// --- Tunables ---------------------------------------------------------------

/**
 * Safety ceiling on the nation count, not a target: the preset's list IS the
 * map (ADR-0021 let a preset ship twenty-one). Relations are pairwise, so
 * the monthly cost is O(n²) — 12 nations is 78 pairs, 21 is 231, and this
 * cap keeps a careless preset from making the tick loop quadratic in
 * something nobody measured.
 */
const MAX_FOREIGN_NATIONS = 32
/** Alliance blocs. Membership dampens war within a bloc, feeds rivalry across. */
const BLOC_COUNT = 3

/**
 * Which alliance bloc a nation stands in.
 *
 * Bloc 0 is the homeland's. An ally stands in it (ADR-0022 §3 — the call to
 * arms needs standing alliances). A RIVAL NEVER DOES: the rotation host
 * filter reads the bloc, so a rival inside bloc 0 is a peacetime posting to
 * a country the homeland is not friendly with, which is what the owner
 * found himself doing in North Korea. A neutral may be non-aligned or in
 * somebody else's bloc, but the homeland's alliance is not a coin flip.
 */
function blocFor(
  alignment: Alignment | null | undefined,
  nonAligned: boolean,
  drawn: number,
): number | null {
  if (alignment === 'ally') return 0
  if (nonAligned) return null
  if (drawn !== 0) return drawn
  // The draw landed on the homeland's bloc. An ally would have kept it; a
  // rival cannot have it, and a neutral has not earned it either.
  return alignment === undefined || alignment === null ? drawn : 1
}


// --- War length and difficulty (owner spec, 2026-08-02) --------------------

/** Shortest and longest a war is ever meant to run, in years. */
const MIN_WAR_YEARS = 2
const MAX_WAR_YEARS = 15
/** Rating gap at or above which one side simply outclasses the other. */
const MISMATCH_GAP = 5
/** Rating gap at or below which the two are evenly matched. */
const EVEN_GAP = 1
/** Months of war that earn a point of hard-won experience, and its cap. */
const MONTHS_PER_EXPERIENCE = 120
const MAX_EXPERIENCE = 3

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
    name: world.spec.homelandName,
    isHomeland: true,
    strength: homeStrength,
    baseStrength: homeStrength,
    economy: 850 + rng.nextInt(0, 120),
    stability: 800 + rng.nextInt(0, 150),
    bloc: 0,
    combatRating: ratingFor(null, homeStrength),
    warMonths: 0,
    exhaustedUntilTick: null,
  })

  // The preset's list IS the map: one nation per entry, in order, no
  // repeats. A name on a permanent record must identify one country.
  const foreignCount = Math.min(MAX_FOREIGN_NATIONS, world.spec.foreignNations.length)
  for (let i = 0; i < foreignCount; i++) {
    const id = allocate(world)
    const entry = world.spec.foreignNations[i]
    const name = entry?.name ?? `Nation ${String(i)}`
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
      //
      // AN 'ally' STANDS IN THE HOMELAND'S BLOC — a standing alliance, and
      // yes, permanent (ADR-0022 §3). This went back and forth: a review
      // removed it because ADR-0021 §4 called an alignment a mere starting
      // position and a permanent alliance is more than that, and it was
      // right to, because nothing then needed alliances. The call to arms
      // does — "a nation can only be called to arms by an ally" — so the
      // owner's spec supersedes and the ADR says so out loud. The draw
      // still happens for everyone, so the stream is unchanged.
      // A RIVAL IS NEVER IN THE HOMELAND'S BLOC (owner, playing: "we can go
      // on peacetime rotation to countries we are not friendly with — I am
      // deployed to North Korea"). Bloc 0 was drawn at random for everyone
      // who was not an ally, so a quarter of the rivals landed inside the
      // homeland's own alliance and became valid hosts for a peacetime
      // posting. The draw still happens for every nation so the stream is
      // unchanged; what changes is where a rival is allowed to land.
      bloc: blocFor(entry?.alignment, rng.chance(1, 4), rng.nextInt(0, BLOC_COUNT)),
      combatRating: ratingFor(entry?.combatRating ?? null, strength),
      warMonths: 0,
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
      // Drawn for every pair, always, so the stream does not depend on the
      // preset's opinions.
      const grudge = !sameBloc && rng.chance(1, 7)
      world.geoRelations.set(relationKey(a.id, b.id), {
        a: a.id,
        b: b.id,
        state: startingState(world, a, b, grudge),
        sinceTick: world.tick,
        warPhase: null,
        casualtiesA: 0,
        casualtiesB: 0,
        plannedWarMonths: null,
      })
    }
  }
}


/**
 * Where a pair starts on the ladder.
 *
 * THIS IS THE ONLY THING AN ALIGNMENT DOES. It describes how a country
 * stands TO THE HOMELAND (ADR-0021 §4), so it decides the homeland's own
 * pairs and leaves every other pair to the model — the label "rival" says
 * how Washington sees Moscow, not how Paris sees Beijing. And it decides
 * only the FIRST RUNG: it touches no bloc, no escalation pressure and no
 * later state, the ladder starts moving on tick one, and a rival can be at
 * peace within a decade or a war can start with an ally.
 */
function startingState(world: World, a: Nation, b: Nation, grudge: boolean): GeoState {
  const drawn: GeoState = grudge ? 'tension' : 'peace'
  if (!a.isHomeland && !b.isHomeland) return drawn
  const other = a.isHomeland ? b : a
  const alignment =
    world.spec.foreignNations.find((nation) => nation.name === other.name)?.alignment ?? null
  if (alignment === 'ally') return 'peace'
  if (alignment === 'rival') return 'tension'
  return drawn
}


/**
 * A nation's combat rating, 1-10 (owner spec). The preset's number if it has
 * one; otherwise derived from the strength this world generated, so an
 * invented country is rated by the only thing that describes it.
 */
function ratingFor(fromSpec: number | null, strength: number): number {
  if (fromSpec !== null) return Math.max(1, Math.min(10, Math.floor(fromSpec)))
  // 150-900 generated strength maps across the 1-10 band.
  return Math.max(1, Math.min(10, Math.round(strength / 95)))
}

/**
 * What a country has learned from fighting: a point per decade of war, three
 * at most (owner spec). Counted from months actually spent at war, so it is
 * earned rather than assigned, and a record can explain it.
 */
export function warExperienceOf(nation: Nation): number {
  return Math.min(MAX_EXPERIENCE, Math.floor(nation.warMonths / MONTHS_PER_EXPERIENCE))
}

/**
 * How hard this country is to fight, all in: its rating plus what its wars
 * taught it. 1-13. This is the number the danger model reads.
 */
export function combatPowerOf(nation: Nation): number {
  return nation.combatRating + warExperienceOf(nation)
}

/**
 * How long a war is going to run, rolled the month it breaks out.
 *
 * The shape is the owner's: mismatched sides finish quickly, evenly matched
 * ones grind. It is a ceiling rather than a schedule — weariness still ends
 * a bloodbath early, and a coalition can push a war past it.
 */
function rollWarMonths(a: Nation, b: Nation, rng: Rng): number {
  const gap = Math.abs(combatPowerOf(a) - combatPowerOf(b))
  const [low, high] =
    gap >= MISMATCH_GAP ? [MIN_WAR_YEARS, 6] : gap <= EVEN_GAP ? [8, MAX_WAR_YEARS] : [MIN_WAR_YEARS, MAX_WAR_YEARS]
  return rng.nextIntInclusive(low, high) * 12
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
        transition(
          world, tick, relation, 'war',
          [factor('old-grudge', 700)],
          `fighting resumed between ${a.name} and ${b.name}`,
          'opening',
          rollWarMonths(a, b, rng),
        )
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
            next === 'war' ? rollWarMonths(a, b, rng) : null,
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
  // ONE WRITE PER NATION. Time under arms is what a country learns from
  // (owner spec) and it is counted for both sides every month, whoever is
  // winning — but the erosion below writes the same records, and two
  // separate `set` calls off the same stale object would have the second
  // silently discard the first.
  world.nations.set(a.id, {
    ...a,
    warMonths: a.warMonths + 1,
    strength: wornA > 0 ? Math.max(WAR_STRENGTH_FLOOR, a.strength - wornA) : a.strength,
  })
  world.nations.set(b.id, {
    ...b,
    warMonths: b.warMonths + 1,
    strength: wornB > 0 ? Math.max(WAR_STRENGTH_FLOOR, b.strength - wornB) : b.strength,
  })

  // Wars end: weariness grows with duration and losses, and one-sided
  // punishment forces the issue sooner.
  const totalLosses = updated.casualtiesA + updated.casualtiesB
  const asymmetry = Math.abs(updated.casualtiesA - updated.casualtiesB)
  const weariness = months * 3 + Math.floor(totalLosses / 900) + Math.floor(asymmetry / 500)
  // The rolled length is a CEILING (owner spec): a war that reaches the
  // length it was always going to run stops, and weariness can still stop
  // one sooner. Before this, a war ended only when a draw happened to land,
  // which is why they all ran about twelve years whatever they were.
  const ranItsCourse = updated.plannedWarMonths !== null && months >= updated.plannedWarMonths
  if (months > 6 && (ranItsCourse || rng.chance(Math.min(weariness, 900), 18_000))) {
    transition(world, tick, updated, 'ceasefire', [
      factor('war-weariness', Math.min(1000, weariness)),
      factor('heavy-casualties', Math.min(1000, Math.floor(totalLosses / 120))),
    ], `ceasefire between ${a.name} and ${b.name}`)

    // Both nations come home exhausted: 10-20 years before either starts a
    // new escalation, longer the more worn down the war left them. No draw —
    // exhaustion follows from the recorded weariness, so it is explainable.
    const restUntil = (tick + 120 + Math.min(120, weariness)) as Tick
    // Off the CURRENT record, not the one captured at the top of the month —
    // this month's war service and erosion are already written.
    const nowA = world.nations.get(a.id) ?? a
    const nowB = world.nations.get(b.id) ?? b
    world.nations.set(a.id, { ...nowA, exhaustedUntilTick: restUntil })
    world.nations.set(b.id, { ...nowB, exhaustedUntilTick: restUntil })
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
  plannedWarMonths: number | null = null,
): void {
  const startsWar = next === 'war' && relation.state !== 'war'
  world.geoRelations.set(relationKey(relation.a, relation.b), {
    ...relation,
    state: next,
    sinceTick: tick,
    warPhase,
    // Casualty counts persist through ceasefire into the record; a NEW war
    // starts its own count.
    casualtiesA: startsWar ? 0 : relation.casualtiesA,
    casualtiesB: startsWar ? 0 : relation.casualtiesB,
    // How long this one was always going to run (owner spec). Rolled once,
    // at the outbreak, and kept — a war's length is a fact about that war,
    // not a die thrown every month until one comes up.
    plannedWarMonths: startsWar ? plannedWarMonths : relation.plannedWarMonths,
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

// The ARTICLES that used to live here moved to newsroom.ts, where they are
// written to the owner's newsroom brief: headline, dateline, lede, body, a
// quote from a real person, and a closing on what happens next. What stood
// here before was essay-writing rather than reporting, which the brief
// names exactly: no facts, no quotes, no structure, and the length spent
// on abstract commentary.

export interface NewsItem {
  readonly tick: Tick
  readonly text: string
  /** Homeland involvement, for the feed to emphasize. */
  readonly nearby: boolean
  /**
   * The person the item is about, where it is about a person. The newsroom
   * looks them up rather than parsing the headline back apart — a reporter
   * works from the file, not from somebody else's copy.
   */
  readonly subjectId?: EntityId
  /** The kind of story, so the newsroom picks the right template. */
  readonly kind?:
    | 'war'
    | 'diplomacy'
    | 'died-in-service'
    | 'recruiting-drive'
    | 'crime'
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
      event.type !== 'tensions-shifted' &&
      event.type !== 'call-to-arms' &&
      event.type !== 'joined-war' &&
      event.type !== 'declined-call'
    ) {
      continue
    }
    const nearby = home !== undefined && (event.subjectId === home.id || event.otherId === home.id)
    if (event.type === 'tensions-shifted' && !nearby) continue // foreign squabbles are not news here
    // Coalition traffic is heavy — allies ask each other constantly in a
    // busy century. It is news in THIS town only when this country is one
    // of the two, which is also the only time it can end with somebody's
    // son being sent (ADR-0022).
    if (
      (event.type === 'call-to-arms' || event.type === 'declined-call' || event.type === 'joined-war') &&
      !nearby
    ) {
      continue
    }
    items.push({ tick: event.tick, text: event.detail ?? 'events abroad', nearby })
  }
  return items
}
