/**
 * The save format.
 *
 * A SAVE FORMAT IS A PUBLIC CONTRACT (ADR-0004). Once a real save exists,
 * every change must either be backward compatible or ship with a tested
 * migration. Silent data loss is the worst outcome here — worse than a crash,
 * because a crash gets noticed.
 *
 * The stakes rise with the product stage (`PRODUCT_ROADMAP.md` §8): breaking
 * the format costs nothing today, an apology at closed alpha, and 250 people's
 * progress at closed beta. That ratchet only tightens.
 */

import type { Seed, Tick } from '@life-engine/shared'

/**
 * Current save schema version. Increment on ANY change to the persisted shape,
 * and add a migration in the same commit.
 *
 * v1 — Milestone 1. `{ header, body }`, no checksum. Header carried
 *      schemaVersion, simulationVersion, seed, tick, userId.
 * v2 — Milestone 4. `{ header, world }`. Header gains a checksum for corruption
 *      detection and `savedAtTick`. Body renamed to `world`.
 * v3 — Milestone 5. `world.friendships` becomes `world.relationships`, with a
 *      `type` on every edge ('friend' | 'courting' | 'spouse' | 'former-spouse')
 *      plus `typeSinceTick` and `endedAtTick`.
 * v4 — M-PLAY. `world.player` — who is being played, any pending decision, and
 *      the complete choice log (part of the deterministic record).
 * v5 — M-MONEY. `household.savings` (integer cents). Migrated households get
 *      four months of their own wages — computed from the save's employment
 *      records, not invented.
 * v27 — C3. A criminal record carries probation: when supervision ends,
 *      the term hanging over somebody, and what they still owe a victim.
 *      Each conviction carries the disposition the court chose and whether
 *      it has been sealed. Migrated records are not on probation, owe
 *      nothing, and keep the disposition they can be read as having had —
 *      a term or a fine, which is all the old court could hand down.
 * v26 — A service record carries `unitSinceTick`: when they joined their
 *      unit, which is not when they enlisted. Migrated records get null,
 *      meaning UNKNOWN — the clock starts at the first month after the load
 *      rather than at a date nobody wrote down.
 * v25 — Capture (ADR-0025). A deployment carries `capturedAtTick`. Migrated
 *      tours are set free — nobody in an old save was ever taken, because
 *      no build before this one could take them.
 * v24 — Unit moments. A pending can now be kind 'unit-moment', and the
 *      player log's `choice` for one carries the cutscene it answered
 *      ("losing-one:hold"). No new field and no migration: an old save has
 *      no unit moments in it, which is the truth about that world.
 * v23 — School houses got a calendar: a service record holds the seat it
 *       took and the month that class starts. Older saves held nobody in a
 *       class, so both are null.
 * v22 — War length and difficulty. Nations carry a combat rating (1-10)
 *       and the months they have spent at war; a war carries the length it
 *       was rolled to run. Migrated saves derive ratings from strength and
 *       start their war-months tally at zero — the events are there but the
 *       tally never was, and a country's war history is not worth
 *       inventing.
 * v21 — W1. The header names the WorldSpec preset that made the world.
 *       Every save that predates presets is 'classic', which is what they
 *       all are. The world BODY is untouched, so the checksum does not move.
 * v20 — Nations gain `baseStrength`, the peacetime weight their strength
 *      recovers toward after a war grinds it down. Old saves take their
 *      current strength as the baseline — it has never moved, so that is
 *      the truth of them.
 * v19 — M-ARMY2. Deployments gain `kind` ('combat' | 'rotation') and
 *      `hostId`; the war fields become nullable because a peacetime
 *      rotation answers no war. Every tour on an old save was a war tour —
 *      that is all the system could make — so each migrates to 'combat'
 *      with a null host, keeping its war fields untouched.
 * v18 — P2. `household.spendStance` (null for every old save AND every NPC
 *      household — the character-driven spending formula is the null
 *      behaviour; only a played household ever sets a stance), and service
 *      records gain `priorSpecialtyIds` (empty) + `specialtyChangedAtTick`
 *      (null) — retrain history; nobody retrained before it existed.
 * v17 — D2. `relationship.familySizeAspiration` (null for old saves —
 *      couples decide their plan, on the record, on the first tick after
 *      load; a migration invents nobody's hopes).
 * v16 — C1. `world.criminal` (empty for old saves — nobody's past is
 *      invented; the law simply starts watching now).
 * v15 — M-SPECOPS. Service records gain `unitId` (null — nobody's special
 *      unit membership predates the units).
 * v14 — L4-M5. `world.awards` (empty for old saves — decorations are never
 *      reconstructed after the fact, the Republic simply starts issuing
 *      them now) and service records gain disabilityAtEnlistment /
 *      disabilityAtDischarge (null — never captured, and unknown pays no
 *      pension rather than guessing).
 * v13 — M-GAMEDEPTH. Service records gain `rankSinceTick` (time-in-grade
 *      clock starts at migration — when they made rank was never recorded)
 *      and `qualifications` (empty — none were recorded). Rank indexes are
 *      remapped from the old six-step shared ladder onto the branch ladders.
 * v12 — M-GAMEDEPTH. Nations gain `exhaustedUntilTick` (post-war exhaustion;
 *      null for saves that never recorded one — and for every migrated save,
 *      because the old sim never tracked it).
 * v11 — M-WOUNDS. Health records gain ailmentKind, ailmentSite, marks.
 *      Migrated ailments keep null kinds (unrecorded specifics stay
 *      unrecorded); marks start empty.
 * v10 — L4-M4. `world.deployments` — every tour, open and closed. Migrated
 *      worlds have none: no deployment predates the deployments.
 * v9 — L4-M3. `world.service` — service records, which survive discharge.
 *      Migrated worlds have no serving history: none was recorded.
 * v8 — L4-M2. `world.health` — one record per person: ailment, severity,
 *      permanent disability. Migrated people are well and unmarked.
 * v7 — L4-M1. `world.nations` and `world.geoRelations` — the world beyond
 *      the town, as aggregate statistics with an explainable state machine.
 * v6 — M-LEGACY. `player.lineage` — completed lives played, in order, so a
 *      save remembers the dynasty and not just the current life.
 */
export const SCHEMA_VERSION = 50

/** The oldest schema this build can still load. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1

/**
 * Placeholder owner until accounts arrive at Milestone 6 (ADR-0010).
 *
 * Every save carries a userId from the very first one ever written. It costs
 * nothing now and turns "add accounts" from a migration across every existing
 * save into an additive change.
 */
export const LOCAL_USER_ID = 'local'

export interface SaveHeader {
  readonly schemaVersion: number
  /** Which simulation behaviour produced this save. See DETERMINISM.md §7. */
  readonly simulationVersion: number
  readonly seed: Seed
  readonly tick: Tick
  readonly savedAtTick: Tick
  readonly userId: string
  /**
   * Which WorldSpec preset made this world (W1). Recorded HERE rather than
   * in the engine's snapshot because the preset is an INPUT to the world the
   * way the seed is, and because the engine's fingerprint should describe the
   * town rather than the recipe. Saves written before presets existed carry
   * no value and load as 'classic', which is what they are.
   */
  readonly presetId: string
  /** Covers the serialized world. Detects corruption, not tampering. */
  readonly checksum: string
}

export interface SaveFile {
  readonly header: SaveHeader
  /** Plain JSON-safe world state. Shape owned by the engine's snapshot. */
  readonly world: unknown
}

/** A save that has been read but not yet validated. Never trust its shape. */
export type UnknownSave = unknown

export class SaveError extends Error {
  constructor(
    message: string,
    readonly kind:
      | 'not-an-object'
      | 'missing-field'
      | 'bad-type'
      | 'checksum-mismatch'
      | 'too-old'
      | 'from-the-future'
      | 'migration-failed',
  ) {
    super(message)
    this.name = 'SaveError'
  }
}
