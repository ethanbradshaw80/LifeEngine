/**
 * WHAT THE WAR LEFT (MILITARY_DEPTH_PLAN §5.2, §7).
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
 * pushed the record itself down the screen. §7 says outright that lasting
 * injury "routes into systems that already exist: wellbeing, the medical
 * board, and the benefits claim path" — so the burden belongs with HEALTH,
 * where a player goes to ask how their character is doing.
 *
 * AND ONE PANEL IS GONE ENTIRELY. "The men you stood with" listed the squad
 * again, with a bond score against each name, on the very tab that already
 * shows the squad and its history — the same men, twice, one list with a
 * number on it (owner: "Lets just remove 'the men you stood with'"). §6's bond
 * still does its work where it always did, inside the engine, deciding what a
 * loss costs; it did not need a scoreboard.
 */

import type { ReactElement } from 'react'
import { aftermathOf, attributionFor, LASTING_AT } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'
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
 * §5.2 — WHAT CAN HONESTLY BE KNOWN, beside the tours.
 *
 * For almost everybody this is not a number at all, and the line it prints
 * instead is the point: "fire is collective and nobody here counts."
 */
export function WhatYouCanKnow({
  world,
  personId,
}: {
  readonly world: World
  readonly personId: EntityId
}): ReactElement | null {
  const attribution = attributionFor(world, personId, world.tick)
  if (attribution.words.length === 0) return null

  return (
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
  )
}
