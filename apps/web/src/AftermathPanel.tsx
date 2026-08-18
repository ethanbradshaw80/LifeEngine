/**
 * WHAT THE WAR LEFT (MILITARY_DEPTH_PLAN §5.2, §6, §7).
 *
 * OWNER: "did you not do all the UI's for step 3 and 4?" The aftermath model
 * ran and had no screen anywhere. Three things it knows that a player never
 * saw:
 *
 *   §7 WHAT IT DID TO THEM, AND WHO IT WAS ABOUT. Driven by named people —
 *   the ones who did not come back — never by "was deployed". And it recedes,
 *   because Law 7 says recovery is real and this is not a permanent debuff.
 *
 *   §5.2 WHETHER THIS TRADE COUNTS AT ALL. Almost nobody has a number, and
 *   the honest line for the rest is better than one: fire is collective.
 *
 *   §6 WHAT YOU AND EACH MAN HAVE BEEN THROUGH. Months are the smallest
 *   input; what builds it is contacts survived together, him being hit, you
 *   being hit and him staying, and burying somebody you both knew.
 *
 * Presentation only: every fact is read on render.
 */

import type { ReactElement } from 'react'
import { aftermathOf, attributionFor, LASTING_AT, warBondWith } from '@life-engine/engine'
import type { EntityId, Tick } from '@life-engine/shared'
import type { World } from '@life-engine/engine'

export function AftermathPanel({
  world,
  personId,
  onInspect,
}: {
  readonly world: World
  readonly personId: EntityId
  readonly onInspect: (id: EntityId) => void
}): ReactElement | null {
  const mark = aftermathOf(world, personId, world.tick)
  const attribution = attributionFor(world, personId, world.tick)

  // THE SQUADS THIS PERSON HAS STOOD IN, so the bond can be read per man.
  const tours = world.deployments.get(personId) ?? []
  const mates = new Map<EntityId, Tick>()
  for (const tour of tours) {
    for (const mate of tour.squad ?? []) {
      if (mate.personId === personId) continue
      const since = mates.get(mate.personId)
      if (since === undefined || mate.sinceTick < since) mates.set(mate.personId, mate.sinceTick)
    }
  }

  // Nothing to say about somebody who never went. Better silence than a
  // panel of zeroes.
  if (mark.causes.length === 0 && mates.size === 0 && attribution.words.length === 0) return null

  return (
    <div className="tour-squad">
      <h4>What it left</h4>

      {/* §7. THE BURDEN, AND WHO IT IS ABOUT. */}
      <div className="sq-row">
        <span className="sq-ic" aria-hidden="true">
          🌑
        </span>
        <div>
          <div className="nm">
            {mark.lasting
              ? 'Something that has not gone away'
              : mark.burden > LASTING_AT / 2
                ? 'It sits heavier some months than others'
                : 'Carrying it about as well as anybody does'}
          </div>
          <div className="sub">
            {mark.causes.length === 0
              ? 'Nothing in the record points anywhere in particular.'
              : `It is about ${mark.causes.slice(0, 4).join(', ')}${
                  mark.causes.length > 4 ? `, and ${String(mark.causes.length - 4)} more` : ''
                }.`}
          </div>
          {mark.lasting && (
            <div className="sub">
              This is a thing a doctor would put a name to. It can be treated, and it does get
              further away — a man twenty years home is mostly not the man who came back.
            </div>
          )}
        </div>
        <span
          className={`sq-state ${mark.lasting ? 's-bad' : mark.burden > LASTING_AT / 2 ? 's-warn' : 's-ok'}`}
        >
          {Math.round(mark.burden / 10)}
        </span>
      </div>

      {/* §5.2. NO LIFETIME COUNTER TO FARM. */}
      {attribution.words.length > 0 && (
        <>
          <h4>What you can and cannot know</h4>
          <div className="sq-row">
            <span className="sq-ic" aria-hidden="true">
              🎯
            </span>
            <div>
              <div className="nm">
                {attribution.confirmed === null
                  ? 'Nobody here counts'
                  : `${String(attribution.confirmed)} confirmed`}
              </div>
              <div className="sub">{attribution.words}</div>
            </div>
          </div>
        </>
      )}

      {/* §6. BOND IS EARNED, NOT WAITED OUT — and it says what earned it. */}
      {mates.size > 0 && (
        <>
          <h4>The people you stood with · {mates.size}</h4>
          {[...mates.entries()]
            .map(([id, since]) => ({ id, bond: warBondWith(world, personId, id, since, world.tick) }))
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
                        : bond.reasons.join(' · ')}
                    </div>
                  </div>
                  <span className={`sq-state ${bond.strength >= 600 ? 's-ok' : 's-warn'}`}>
                    {Math.round(bond.strength / 10)}
                  </span>
                </div>
              )
            })}
          <p className="muted small">
            Months are the smallest part of this. What builds it is coming through a bad
            afternoon together, him being hit, you being hit and him staying — and burying
            somebody you both knew.
          </p>
        </>
      )}
    </div>
  )
}
