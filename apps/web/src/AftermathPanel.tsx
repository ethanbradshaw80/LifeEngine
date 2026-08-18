/**
 * WHAT THE WAR LEFT (MILITARY_DEPTH_PLAN §5.2, §6, §7).
 *
 * OWNER, on the first version: "record is all messed the wordings doesnt make
 * sense and I think this knowledge should be somewhere else." Right on both.
 *
 * THE WORDING. It joined named people and things that happened to you into a
 * single comma list — "It is about Roy Dillard, the day you were hit, being
 * held" — which is two different kinds of grammar in one sentence. The engine
 * hands them over separately now and each gets its own sentence.
 *
 * THE PLACEMENT. The Record is the SERVICE record: awards, badges, discharge,
 * the paperwork a descendant finds. Opening it with a psychological panel
 * pushed the record itself down the screen and read as though the game had
 * lost the plot. §7 says outright that lasting injury "routes into systems
 * that already exist: wellbeing, the medical board, and the benefits claim
 * path" — so the burden belongs with HEALTH, where a player goes to ask how
 * their character is doing. The bonds and the attribution belong with the
 * DEPLOYMENTS, because they are facts about tours and the men on them.
 *
 * So this file exports two small panels rather than one big one, and each
 * goes where its subject already lives.
 */

import type { ReactElement } from 'react'
import { aftermathOf, attributionFor, LASTING_AT, warBondWith } from '@life-engine/engine'
import type { EntityId, Tick } from '@life-engine/shared'
import type { World } from '@life-engine/engine'

/** "A, B and C" — an English list, not a comma-separated field. */
function inWords(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] ?? ''
  const head = items.slice(0, -1).join(', ')
  return `${head} and ${items[items.length - 1] ?? ''}`
}

/**
 * §7 — WHAT IT DID TO THEM, on the health screen where it belongs.
 *
 * Never a bare number: the point of §7 is that it is about WHO, and that
 * recovery is real (Law 7). Both of those are sentences, not a gauge.
 */
export function WhatItLeft({
  world,
  personId,
}: {
  readonly world: World
  readonly personId: EntityId
}): ReactElement | null {
  const mark = aftermathOf(world, personId, world.tick)
  // Nothing to say about somebody the war never touched. Silence beats a
  // panel of zeroes claiming they are coping well with nothing.
  if (mark.causes.length === 0) return null

  const heading = mark.lasting
    ? 'Something from the service has not gone away'
    : mark.burden > LASTING_AT / 2
      ? 'Some months sit heavier than others'
      : 'Carrying the service about as well as anybody does'

  return (
    <div className="tour-squad">
      <h4>What the service left</h4>
      <div className="sq-row">
        <span className="sq-ic" aria-hidden="true">
          🌑
        </span>
        <div>
          <div className="nm">{heading}</div>
          {mark.lost.length > 0 && (
            <div className="sub">
              {mark.lost.length === 1
                ? `${inWords(mark.lost)} did not come home.`
                : `${String(mark.lost.length)} of the men served beside did not come home: ${inWords(mark.lost.slice(0, 5))}${mark.lost.length > 5 ? ', among others' : ''}.`}
            </div>
          )}
          {mark.own.length > 0 && (
            <div className="sub">
              {/* "And" only when something came before it. Without the guard
                  a man who lost nobody read "And you were hit once." as his
                  first line, which is a sentence with nothing to join. */}
              {`${mark.lost.length > 0 ? 'And ' : ''}${inWords(mark.own)}.`.replace(
                /^(\w)/,
                (first) => first.toUpperCase(),
              )}
            </div>
          )}
          {mark.lasting && (
            <div className="sub">
              This is a thing a doctor would put a name to, and it can be treated. It also gets
              further away on its own — a man twenty years home is mostly not the man who came
              back.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * §6 and §5.2 — the men, and what can honestly be known, beside the tours.
 */
export function TheMenYouStoodWith({
  world,
  personId,
  onInspect,
}: {
  readonly world: World
  readonly personId: EntityId
  readonly onInspect: (id: EntityId) => void
}): ReactElement | null {
  const attribution = attributionFor(world, personId, world.tick)

  const tours = world.deployments.get(personId) ?? []
  const mates = new Map<EntityId, Tick>()
  for (const tour of tours) {
    for (const mate of tour.squad ?? []) {
      if (mate.personId === personId) continue
      const since = mates.get(mate.personId)
      if (since === undefined || mate.sinceTick < since) mates.set(mate.personId, mate.sinceTick)
    }
  }
  if (mates.size === 0 && attribution.words.length === 0) return null

  return (
    <>
      {mates.size > 0 && (
        <div className="tour-squad">
          <h4>The men you stood with · {mates.size}</h4>
          <p className="muted small">
            Months are the smallest part of this. What builds it is coming through a bad
            afternoon together, him being hit, you being hit and him staying — and burying
            somebody you both knew.
          </p>
          {[...mates.entries()]
            .map(([id, since]) => ({
              id,
              bond: warBondWith(world, personId, id, since, world.tick),
            }))
            .sort((a, b) => b.bond.strength - a.bond.strength)
            .slice(0, 8)
            .map(({ id, bond }) => {
              const them = world.people.get(id)
              if (them === undefined) return null
              const dead = them.deathTick !== null
              return (
                <div key={id} className={dead ? 'sq-row gone' : 'sq-row'}>
                  <span className="sq-ic" aria-hidden="true">
                    {dead ? '🕯️' : bond.strength >= 600 ? '🤝' : '🪖'}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="link nm"
                      onClick={() => {
                        onInspect(id)
                      }}
                    >
                      {them.givenName} {them.familyName}
                    </button>
                    <div className="sub">
                      {bond.reasons.length === 0
                        ? 'You were in the same squad, and that was all it ever was.'
                        : `${inWords(bond.reasons)}.`}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {attribution.words.length > 0 && (
        <div className="tour-squad">
          <h4>What you can and cannot know</h4>
          <div className="sq-row">
            <span className="sq-ic" aria-hidden="true">
              🎯
            </span>
            <div>
              <div className="nm">
                {attribution.confirmed === null
                  ? 'Nobody in this trade counts'
                  : `${String(attribution.confirmed)} confirmed`}
              </div>
              <div className="sub">{attribution.words}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
