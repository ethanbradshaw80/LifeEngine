/**
 * THE AFTER-ACTION REPORT (MILITARY_DEPTH_PLAN §5.3).
 *
 * OWNER: "I think the after action report should be how its based upon in
 * real life." So it is a filed document with an author, a date and a dry
 * institutional voice — not a results screen addressed to the player.
 *
 * The claim that matters most is the ASYMMETRY (foundation §8, and the
 * independent review asked for it by name): enemy losses are an ESTIMATE and
 * they appear in the filed record ONLY. At the time the character saw muzzle
 * flashes on a ridge; the report says the position held eight to ten men.
 * The character never knew. The player does.
 */

import { describe, expect, it } from 'vitest'
import { seed as makeSeed } from '@life-engine/shared'
import { advanceTicks, createWorld } from '../src/index.js'
import { afterActionFor, afterActionsFor } from '../src/afteraction.js'
import { unitRosterOf } from '../src/service.js'

function aVeteranOfContact(world: ReturnType<typeof createWorld>) {
  for (const record of world.service.values()) {
    if (afterActionsFor(world, record.personId).length > 0) return record.personId
  }
  return undefined
}

describe('the after-action report', () => {
  it('exists for every contact, and reads like a document', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    const personId = aVeteranOfContact(world)
    expect(personId, 'nobody in this world ever saw contact').toBeDefined()
    if (personId === undefined) return

    const contact = afterActionsFor(world, personId)[0]
    expect(contact).toBeDefined()
    if (contact === undefined) return
    const report = afterActionFor(world, personId, contact)
    expect(report).not.toBeNull()
    if (report === null) return

    expect(report.title).toBe('AFTER-ACTION REVIEW')
    expect(report.unit.length).toBeGreaterThan(0)
    expect(report.signedBy.length).toBeGreaterThan(0)
    // FILED LATER. A report is not written that night.
    expect(report.filed).not.toBe(report.occurred)
  })

  it('states enemy losses as an assessment, and never as a score', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    const personId = aVeteranOfContact(world)
    if (personId === undefined) return
    const contact = afterActionsFor(world, personId)[0]
    if (contact === undefined) return
    const report = afterActionFor(world, personId, contact)
    if (report === null) return

    // Hedged, in the report's own words — "assessed", and a RANGE for strength.
    expect(report.enemyStrength).toContain('assessed')
    expect(report.enemyStrength).toMatch(/\d+-\d+/)
    expect(report.enemyLosses).toContain('assessed')
    // And the contact the CHARACTER lived carries no such number.
    expect(contact.detail ?? '').not.toMatch(/assessed/)
  })

  it('says the same thing for ever, because a filed report is not rewritten', () => {
    // It can be wrong and it is never corrected — so it must at least be
    // stable. Seeded on the event, not on when it happens to be read.
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    const personId = aVeteranOfContact(world)
    if (personId === undefined) return
    const contact = afterActionsFor(world, personId)[0]
    if (contact === undefined) return

    const first = afterActionFor(world, personId, contact)
    advanceTicks(world, 24)
    const later = afterActionFor(world, personId, contact)
    expect(later?.enemyLosses).toBe(first?.enemyLosses)
    expect(later?.enemyStrength).toBe(first?.enemyStrength)
  })

  it('is signed by a real man from the unit, at the rank he really holds', () => {
    /**
     * OWNER, PLAYING: the document came up signed "COL WILLIAMS · Adjutant"
     * at the foot of a squad's report. Two faults in one line. The rank was
     * built as the subject's own PLUS TWO, read off the officer ladder — the
     * rank-ladder trap, where a rank is an index into whichever ladder
     * somebody is on and adding to it means nothing. And the man was invented:
     * a surname borrowed from the roster, welded to a rank nobody held.
     *
     * A report is signed by whoever answers for the unit. So the signature has
     * to be somebody ON the roster, at their OWN rank, in the job they do.
     */
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 50 * 12)
    const personId = aVeteranOfContact(world)
    if (personId === undefined) return
    const contact = afterActionsFor(world, personId)[0]
    if (contact === undefined) return
    const report = afterActionFor(world, personId, contact)
    if (report === null) return

    const roster = unitRosterOf(world, personId)
    if (roster === null || roster.members.length === 0) return
    const senior = roster.members[0]
    if (senior === undefined) return

    // The name on the signature belongs to a person who is really there.
    const surname = senior.name.split(' ').slice(-1)[0] ?? ''
    expect(report.signedBy).toBe(`${senior.rankTitle} ${surname}`.toUpperCase())
    // And the rank is his own, not one manufactured from the subject's.
    expect(report.signedBy.startsWith(senior.rankTitle.toUpperCase())).toBe(true)
    expect(report.signedRole).toBe(senior.role)
  })

  it('refuses to invent one for something that was not a contact', () => {
    const world = createWorld(makeSeed(4242), 300)
    advanceTicks(world, 30 * 12)
    const born = world.events.find((e) => e.type === 'born')
    if (born === undefined) return
    expect(afterActionFor(world, born.subjectId, born)).toBeNull()
  })
})
