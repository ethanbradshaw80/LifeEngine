/**
 * Everything specific to LIVING a life rather than watching the town:
 * the character picker, the decision prompt, and the retrospective.
 *
 * All of it renders engine state. The prompt text comes from the engine's
 * describePending — the same facts as the records — and the retrospective is
 * lifeStory, the exact text the tests assert on. This file owns no simulation
 * state at all (ADR-0012).
 */

import { useState } from 'react'
import { BodyDiagram } from './BodyDiagram.js'
import {
  ageAt,
  describePending,
  describeStakes,
  fullName,
  heirsOf,
  legacySummaryOf,
  lifeStory,
  lineageOf,
  livingPeople,
  motherCandidates,
  partnerOf,
  personSummary,
} from '@life-engine/engine'
import { decodeScene, ordersSheetFor, sceneById, unitMomentById } from '@life-engine/engine'
import type { PendingDecision, World } from '@life-engine/engine'
import { OrdersSheetView } from './OrdersSheet.js'
import { Avatar } from './Avatar.js'
import type { EntityId } from '@life-engine/shared'
import { formatMoney } from '@life-engine/shared'
import type { CreateLifeSpec } from './engine.worker.js'

// ---------------------------------------------------------------------------
// Character picker
// ---------------------------------------------------------------------------

interface PickerProps {
  readonly world: World
  readonly onPlay: (personId: EntityId) => void
  /** Be born: a brand-new person, delivered to an existing family. */
  readonly onCreate: (spec: CreateLifeSpec) => void
  readonly onCancel: () => void
}

export function CharacterPicker({ world, onPlay, onCreate, onCancel }: PickerProps) {
  // Which way in: born as someone new (the BitLife way), or take over a
  // townsperson mid-life. Pure interface state.
  const [mode, setMode] = useState<'born' | 'possess'>('born')
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [sex, setSex] = useState<'female' | 'male' | ''>('')
  const [motherSel, setMotherSel] = useState<'random' | string>('random')

  // Young people make the best starts: the education fork, first jobs, and
  // leaving home are all still ahead of them. Sorted youngest last so the
  // person with the most life remaining is easy to find.
  const candidates = livingPeople(world)
    .filter((p) => ageAt(p.birthTick, world.tick) <= 25)
    .sort((a, b) => a.birthTick - b.birthTick || a.id - b.id)

  // Families that could take a newborn this month — the same eligibility the
  // simulation's own birth roll uses, so no impossible household is offered.
  const mothers = motherCandidates(world)

  function submitBirth(random: boolean) {
    if (mothers.length === 0) return
    const chosen =
      !random && motherSel !== 'random'
        ? Number(motherSel)
        : mothers[Math.floor(Math.random() * mothers.length)]
    if (chosen === undefined) return
    onCreate(
      random
        ? { givenName: null, familyName: null, sex: null, motherId: chosen }
        : {
            givenName: givenName.trim().length > 0 ? givenName.trim() : null,
            familyName: familyName.trim().length > 0 ? familyName.trim() : null,
            sex: sex === '' ? null : sex,
            motherId: chosen,
          },
    )
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a life">
      <div className="sheet">
        <h2>Choose a life</h2>
        <div className="mode-row">
          <button
            type="button"
            className={mode === 'born' ? 'active' : ''}
            onClick={() => setMode('born')}
          >
            Be born
          </button>
          <button
            type="button"
            className={mode === 'possess' ? 'active' : ''}
            onClick={() => setMode('possess')}
          >
            Take over a life
          </button>
        </div>

        {mode === 'born' && (
          <>
            <p className="muted small">
              A brand-new person, born this month to a family in town. Leave
              anything blank and the world decides it.
            </p>
            {mothers.length === 0 ? (
              <p className="muted">
                No family can take a newborn just now. Advance time a little,
                or take over a life instead.
              </p>
            ) : (
              <div className="birth-form">
                <label>
                  First name
                  <input
                    type="text"
                    value={givenName}
                    maxLength={24}
                    placeholder="blank for a surprise"
                    onChange={(e) => setGivenName(e.target.value)}
                  />
                </label>
                <label>
                  Family name
                  <input
                    type="text"
                    value={familyName}
                    maxLength={24}
                    placeholder="blank to take the family's"
                    onChange={(e) => setFamilyName(e.target.value)}
                  />
                </label>
                <span className="birth-label">Sex</span>
                <div className="mode-row">
                  <button type="button" className={sex === 'female' ? 'active' : ''} onClick={() => setSex('female')}>
                    Girl
                  </button>
                  <button type="button" className={sex === 'male' ? 'active' : ''} onClick={() => setSex('male')}>
                    Boy
                  </button>
                  <button type="button" className={sex === '' ? 'active' : ''} onClick={() => setSex('')}>
                    Surprise
                  </button>
                </div>
                <label>
                  Family
                  <select value={motherSel} onChange={(e) => setMotherSel(e.target.value)}>
                    <option value="random">A random family</option>
                    {mothers.map((id) => {
                      const mother = world.people.get(id)
                      const partnerId = partnerOf(world, id)
                      const partner = partnerId === null ? undefined : world.people.get(partnerId)
                      if (!mother) return null
                      return (
                        <option key={id} value={String(id)}>
                          {fullName(mother)}
                          {partner ? ` & ${fullName(partner)}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <div className="sheet-actions">
                  <button type="button" className="primary" onClick={() => submitBirth(false)}>
                    Be born
                  </button>
                  <button type="button" onClick={() => submitBirth(true)}>
                    Random newborn
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {mode === 'possess' && (
          <>
            <p className="muted small">
              You become this person. The world will pause whenever a decision is
              theirs to make — everyone else keeps living on their own.
            </p>
            {candidates.length === 0 ? (
              <p className="muted">Nobody under 26 is alive. Advance time or start a new world.</p>
            ) : (
              <ul className="picker">
                {candidates.map((person) => (
                  <li key={person.id}>
                    <button type="button" onClick={() => onPlay(person.id)}>
                      {personSummary(world, person.id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="sheet-actions">
          <button type="button" onClick={onCancel}>
            Keep watching
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The decision prompt
// ---------------------------------------------------------------------------

/** Plain-words labels for the engine's option ids, per decision kind. */
const OPTION_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  education: { college: 'Go to college', trade: 'Trade school', work: 'Go straight to work', enlist: 'Enlist' },
  'job-offer': { accept: 'Take the job', decline: 'Turn it down' },
  'move-out': { accept: 'Move out', decline: 'Stay home' },
  courtship: { accept: 'See where it goes', decline: 'Stay friends' },
  marriage: { accept: 'Marry them', decline: 'Not yet' },
  child: { accept: 'Have a child', decline: 'Not now' },
  'move-house': { accept: 'Move', decline: 'Stay put' },
  retirement: { retire: 'Retire', 'keep-working': 'Keep working' },
  separation: { stay: 'Stay and try again', separate: 'Separate' },
  convalesce: { rest: 'Rest and heal', 'push-on': 'Push on' },
  enlist: { accept: 'Enlist', decline: 'Not for me' },
  reenlist: { stay: 'Sign again', leave: 'Come home' },
  // ADR-0022 §5. The three answers to an order, in the order of what
  // they cost: nothing, a little, and a career.
  'deployment-order': {
    go: '🛫 Go',
    'request-exemption': '📝 Ask to be excused',
    refuse: '🚫 Refuse the order',
  },
  'promotion-board': { 'put-in': 'Put your name in', pass: 'Let it go by' },
  'attend-school': { attend: 'Take the slot', pass: 'Pass' },
  'volunteer-deploy': { accept: 'Volunteer', decline: 'Wait for orders' },
  'support-deployment': { 'stay-and-fight': 'Stay and fight', 'go-home': 'Go home' },
  desperation: { 'take-it': 'Take it', 'go-without': 'Go without' },
  plea: { 'plead-guilty': 'Plead guilty', 'stand-trial': 'Stand trial' },
  'first-aid': {
    'press-the-wound': 'Press the wound',
    'call-for-help': 'Call out for help',
    'lie-still': 'Lie still',
  },
  'treat-casualty': {
    'work-the-wound': 'Work the wound here',
    'drag-them-out': 'Drag them to cover',
    'call-the-evac': 'Call the evacuation',
  },
  'combat-moment': { 'lead-the-break': 'Lead the break', 'keep-heads-down': 'Keep down' },
  'foremans-warning': { 'knuckle-down': 'Knuckle down', shrug: 'Shrug it off' },
  retrain: { keep: 'Keep your trade' },
}

function optionLabel(world: World, pending: PendingDecision, option: string): string {
  // P2: move pendings carry the whole candidate list as 'to-<placeId>'
  // options, and 'accept' is the engine's own pick — both label with the
  // street's name so the buttons read as destinations, not verbs.
  if (option.startsWith('to-')) {
    const place = world.places.get(Number(option.slice(3)) as EntityId)
    if (place) return `Move to ${place.name}`
  }
  if (
    (pending.kind === 'move-out' || pending.kind === 'move-house') &&
    option === 'accept' &&
    pending.placeId !== null
  ) {
    const place = world.places.get(pending.placeId)
    if (place) return `Move to ${place.name}`
  }
  // A combat scene names its three answers in its own words — "charge the
  // position" is not "drive through it" — while the spectrum underneath is
  // always push, hold, cover (owner's combat plan §2).
  if (pending.kind === 'combat-moment') {
    const { sceneId } = decodeScene(pending.occupationId)
    const scene = sceneById(sceneId)
    if (scene && (option === 'push' || option === 'hold' || option === 'cover')) {
      return scene.labels[option]
    }
  }
  // A unit moment names its three in its own words too — and it is NOT a
  // firefight, so its labels are commitments and aftermath, never fire.
  if (pending.kind === 'unit-moment') {
    const raw = pending.occupationId ?? ''
    const cut = raw.indexOf(':')
    const moment = unitMomentById(cut === -1 ? raw : raw.slice(0, cut))
    if (moment && (option === 'push' || option === 'hold' || option === 'cover')) {
      return moment.labels[option]
    }
  }
  // Specialty ids become their titles (also fixes the long-standing raw-id
  // labels on the enlistment specialty menu).
  if (pending.kind === 'specialty' || (pending.kind === 'retrain' && option !== 'keep')) {
    const specialty = world.spec.specialties.find((sp) => sp.id === option)
    if (specialty) return pending.kind === 'retrain' ? `Retrain as ${specialty.title}` : specialty.title
  }
  return OPTION_LABELS[pending.kind]?.[option] ?? option
}

interface PromptProps {
  readonly world: World
  readonly pending: PendingDecision
  readonly onChoose: (choice: string) => void
}

export function DecisionPrompt({ world, pending, onChoose }: PromptProps) {
  // The stakes come from the engine — the same facts the records will cite.
  const stakes = describeStakes(world, pending)

  // ORDERS ARE PAPER. A tour is the largest thing that happens to a serving
  // person and it used to arrive as one sentence in the same box every
  // other decision uses. This one gets the sheet: the engine writes every
  // field, the component only sets it.
  if (pending.kind === 'deployment-order') {
    const variant =
      pending.occupationId === 'voluntary'
        ? 'voluntary'
        : pending.occupationId === 'rotation'
          ? 'rotation'
          : 'involuntary'
    const sheet = ordersSheetFor(world, pending.tick, pending.personId, variant, pending.otherId)
    if (sheet) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Orders">
          <OrdersSheetView sheet={sheet}>
            <div className="orders-actions">
              {pending.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === 'go' ? 'primary' : option === 'refuse' ? 'ghost' : ''}
                  onClick={() => onChoose(option)}
                >
                  {option === 'go'
                    ? 'Acknowledge — Report for Duty'
                    : option === 'request-exemption'
                      ? 'Request Exemption'
                      : 'Refuse the Orders'}
                </button>
              ))}
            </div>
          </OrdersSheetView>
        </div>
      )
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A decision">
      <div className="sheet">
        <p className="muted small">The world is paused. This one is yours.</p>
        {pending.otherId !== null && world.people.get(pending.otherId) && (
          <div className="prompt-face">
            <Avatar world={world} person={world.people.get(pending.otherId)!} size={56} />
          </div>
        )}
        <h2>{describePending(world, pending)}</h2>
        {/* The wound, on a body, where the simulation actually put it. */}
        {(pending.kind === 'first-aid' || pending.kind === 'treat-casualty') && (
          <BodyDiagram
            world={world}
            personId={pending.kind === 'first-aid' ? pending.personId : (pending.otherId ?? pending.personId)}
          />
        )}
        {stakes.length > 0 && (
          <ul className="stakes">
            {stakes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <div className="sheet-actions">
          {pending.options.map((option) => (
            <button
              key={option}
              type="button"
              className={option === pending.options[0] ? 'primary' : ''}
              onClick={() => onChoose(option)}
            >
              {optionLabel(world, pending, option)}
            </button>
          ))}
        </div>
        <p className="muted small">
          Declined chances are gone — the world moves on, like it does for
          everyone else in it.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The retrospective
// ---------------------------------------------------------------------------

interface RetrospectiveProps {
  readonly world: World
  readonly personId: EntityId
  readonly onPlayHeir: (heirId: EntityId) => void
  readonly onWatch: () => void
}

export function Retrospective({ world, personId, onPlayHeir, onWatch }: RetrospectiveProps) {
  const person = world.people.get(personId)
  const heirs = heirsOf(world, personId)
  const legacy = legacySummaryOf(world, personId)
  // lineageOf includes the current (just-finished) life at the end.
  const lifeNumber = lineageOf(world).length

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="A life, remembered">
      <div className="sheet wide">
        <h2>{person ? `${fullName(person)}'s life` : 'A life'}</h2>
        {lifeNumber > 1 && (
          <p className="muted small">
            The {lifeNumber === 2 ? 'second' : lifeNumber === 3 ? 'third' : `${lifeNumber}th`} life
            of this line.
          </p>
        )}
        <div className="legacy-row">
          {legacy.childCount > 0 && (
            <span>
              {legacy.childCount} {legacy.childCount === 1 ? 'child' : 'children'}
            </span>
          )}
          {legacy.grandchildCount > 0 && <span>{legacy.grandchildCount} grandchildren</span>}
          {legacy.inherited > 0 && <span>inherited {formatMoney(legacy.inherited)}</span>}
          {legacy.leftToHeirs > 0 && <span>left {formatMoney(legacy.leftToHeirs)}</span>}
        </div>
        {/* Law 8: the retrospective is generated from the records of the life
            actually lived — the same lifeStory the tests hold to account. */}
        <pre className="story">{lifeStory(world, personId)}</pre>

        {heirs.length > 0 ? (
          <>
            <h3>The story continues</h3>
            <p className="muted small">
              Take up the life of one of {person ? `${fullName(person)}'s` : 'their'} children —
              same town, same family, same history.
            </p>
            <ul className="picker">
              {heirs.map((heirId) => (
                <li key={heirId}>
                  <button type="button" onClick={() => onPlayHeir(heirId)}>
                    {personSummary(world, heirId)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No living children carry the name on.</p>
        )}

        <div className="sheet-actions">
          <button type="button" onClick={onWatch}>
            Watch the town
          </button>
        </div>
      </div>
    </div>
  )
}
