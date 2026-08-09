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
import { DEBATE_OPTIONS, decodeSchoolMoment, majorById, schoolMomentById } from '@life-engine/engine'
import {
  contractFor,
  crimeSceneFor,
  decodeInterview,
  decodeWorkMoment,
  decodeSequence,
  beatAt,
  beatAsks,
  engagementRoll,
  followOnFor,
  whoIsDown,
  orientWords,
  consequenceWords,
  afterActionWords,
  hurtInContact,
  deploymentsOf,
  decodeHand,
  decodeHeldSession,
  gamblerOf,
  keyHandFor,
  stakeById,
  isStretchFor,
  occupationById,
  officerRoleById,
  sentenceCase,
  standingWords,
  workMomentById,
  specialtyTitleFor,
  decodeContract,
  decodeCrimeScene,
  offenceById,
  separationFor,
  retirementCertificateFor,
  rankTitle,
  decodeScene,
  ordersSheetFor,
  sceneById,
  unitMomentById,
} from '@life-engine/engine'
import type { PendingDecision, World } from '@life-engine/engine'
import { OrdersSheetView } from './OrdersSheet.js'
import { ServiceContractView } from './ServiceContract.js'
import { CrimeSceneView } from './CrimeScene.js'
import { WorkMomentView } from './WorkMoment.js'
import { KeyHandView } from './KeyHand.js'
import { BlackjackTable } from './BlackjackTable.js'
import { EngagementView } from './Engagement.js'
import { SchoolMomentView } from './SchoolMoment.js'
import { InterviewView } from './Interview.js'
import { RetirementCertificateView, SeparationSheetView } from './SeparationSheet.js'
import { Article15Sheet } from './Article15Sheet.js'
import { Avatar } from './Avatar.js'
import type { EntityId, Money, Tick } from '@life-engine/shared'
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
  'job-offer': {
    accept: '🤝 Accept the offer',
    decline: 'Turn it down',
    // ADR-0034. Not a refusal — the offer stands while you think.
    wait: '⏳ Ask for time to think',
  },
  'move-out': { accept: 'Move out', decline: 'Stay home' },
  courtship: { accept: 'See where it goes', decline: 'Stay friends' },
  marriage: { accept: 'Marry them', decline: 'Not yet' },
  child: { accept: 'Have a child', decline: 'Not now' },
  'move-house': { accept: 'Move', decline: 'Stay put' },
  retirement: { retire: 'Retire', 'keep-working': 'Keep working' },
  separation: { stay: 'Stay and try again', separate: 'Separate' },
  convalesce: { rest: 'Rest and heal', 'push-on': 'Push on' },
  enlist: { accept: 'Enlist', decline: 'Not for me' },
  // Not a medal glyph: a decoration is earned, and this is a job choice.
  commission: { officer: '📜 Take the commission', enlisted: '🪖 Sign as enlisted' },
  // The ids the ENGINE offers. These said 'stay'/'leave' long after the
  // engine moved to reenlist/separate, so the buttons rendered as their raw
  // ids — the player was reading "reenlist" and "separate" as labels.
  reenlist: {
    reenlist: '✍️ Sign on again',
    // ADR-0032. Not "sign on again": at twelve years there is no term to
    // sign for, and the button must not promise one.
    indefinite: '♾️ Go indefinite',
    separate: '🏠 Come home',
    retire: '🎖️ Retire on the pension',
    stay: '✍️ Sign again',
    leave: '🏠 Come home',
  },
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
  'crime-victim': {
    report: 'Report it to the constable',
    'let-it-go': 'Let it go',
    defend: 'Meet them with force',
  },
  trial: {
    'hire-attorney': 'Hire an attorney',
    'public-defender': 'Take the public defender',
    'self-represent': 'Represent yourself',
    'challenge-the-weak-point': 'Challenge the weakest piece',
    'let-it-stand': 'Let it stand',
    'object-hard': 'Object to all of it',
    'take-the-stand': 'Take the stand',
    'let-counsel-argue': 'Let counsel argue it',
    'stay-silent': 'Stay silent',
    'reasonable-doubt': 'Argue reasonable doubt',
    'appeal-for-sympathy': 'Appeal for sympathy',
    'stand-on-the-facts': 'Stand on the facts',
    'hear-it': 'Hear the verdict',
  },
  plea: {
    'plead-guilty': 'Plead guilty',
    'stand-trial': 'Plead not guilty — stand trial',
    'take-plea-deal': 'Take the plea deal',
  },
  'foremans-warning': { 'knuckle-down': 'Knuckle down', shrug: 'Shrug it off' },
  retrain: { keep: 'Keep your trade' },
  // The retention offer. Reclassification sits beside the money because it
  // costs the service the same thing money does — it is what the office
  // offers the person it cannot pay (owner).
  'reenlist-option': {
    bonus: '💵 Take the bonus',
    school: '🎓 A guaranteed school seat',
    stability: '🏠 Two years where you are',
    reclass: '🔧 Retrain into another trade',
  },
  'service-contract': { 'take-the-oath': 'Raise your right hand' },
  'entry-test': { continue: 'See what it opens' },
  // ADR-0037. Signing is acknowledging, not agreeing — the punishment is
  // already imposed. The button must not imply a choice that is not there.
  article15: { acknowledge: 'Sign & acknowledge' },
  // M-ECON §8. The bill happens either way; the choice is whether it comes
  // out of what you have or is carried as a debt at your own rate.
  'money-shock': {
    'pay-now': '💵 Pay it now',
    'pay-over-time': '🧾 Carry it',
  },
  // M-SAFETY §2. Two genuinely different roads: a plan keeps the home and
  // takes years, a liquidation is a fresh start that costs what is not exempt.
  'promotion-offer': { accept: '📈 Take it', decline: 'Stay where you are' },
  bankruptcy: {
    'chapter-13': '📋 File a repayment plan',
    'chapter-7': '⚖️ File for liquidation',
    // Filing is the player's own decision now, so refusing has to be a
    // button rather than the absence of one.
    'ride-it-out': '🤞 Not yet — try to trade out of it',
  },
}

/**
 * The decisions that DRAW THEIR OWN BUTTONS — a discharge sheet, a
 * certificate, a contract, a crime scene, a set of orders. Their answers
 * never pass through optionLabel, so the label table owes them nothing.
 * Exported for the test that checks every other kind has words on it.
 */
/**
 * How the year has been going, in the words a report card would use.
 * Its own scale rather than the job's: "well regarded" is a thing said
 * about an employee and not about a fourteen-year-old.
 */
function schoolStandingWords(attainment: number): string {
  if (attainment >= 800) return 'top of the class'
  if (attainment >= 650) return 'a good year so far'
  if (attainment >= 450) return 'getting by'
  if (attainment >= 300) return 'struggling'
  return 'in trouble'
}

export const KINDS_WITH_THEIR_OWN_BUTTONS: readonly string[] = [
  'crime-scene',
  'work-moment',
  'key-hand',
  'blackjack-hand',
  'school-moment',
  'interview',
  'separation-record',
  'retirement-certificate',
  'service-contract',
  'deployment-order',
]

/**
 * The words on a button. Exported so a test can play whole lives and catch
 * an option that falls through to its raw engine id — which is how
 * "pay-now / pay-over-time" reached a real screen.
 */
export function optionLabel(world: World, pending: PendingDecision, option: string): string {
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
  // THE DEBATE NAMES ITS OWN ANSWERS, from the engine's authored content
  // rather than a second copy kept here — adding a rail never needs a
  // label added alongside it.
  if (pending.kind === 'debate') {
    const rail = DEBATE_OPTIONS.find((o) => o.id === option)
    if (rail !== undefined) return rail.title
  }
  if (pending.kind === 'school-choice') {
    if (option === 'private') return 'Private school'
    if (option === 'public') return 'The state school'
  }
  // A FIELD OF STUDY names its own buttons from the catalogue, so adding
  // a major never needs a label added here to go with it.
  if (pending.kind === 'major') {
    const major = majorById(option)
    if (major !== undefined) return `Study ${major.title}`
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
  // M-ENLIST §1/§5c. A branch id and an officer role id are both ids; the
  // button says what the thing is called.
  if (pending.kind === 'branch-choice') {
    const branch = world.spec.branches.find((b) => b.id === option)
    if (branch) return sentenceCase(branch.name)
  }
  if (pending.kind === 'officer-preference') {
    const role = officerRoleById(option)
    if (role) return `${role.code} · ${sentenceCase(role.title)}`
  }
  // Specialty ids become their titles (also fixes the long-standing raw-id
  // labels on the enlistment specialty menu).
  // "3yr" is the engine's id for a term; it is not a label.
  if (pending.kind === 'reenlist-term' && option.endsWith('yr')) {
    return `${option.replace('yr', '')} more years`
  }
  if (pending.kind === 'specialty' || (pending.kind === 'retrain' && option !== 'keep')) {
    const specialty = world.spec.specialties.find((sp) => sp.id === option)
    if (specialty) {
      // THE SAME NAME THE STAKES USED. The stakes listed "infantry officer"
      // and the button under it said "rifleman" — one dialog naming one
      // trade two ways, on the screen where the player picks it.
      const commissioned =
        pending.kind === 'specialty'
          ? (pending.occupationId ?? '').endsWith(':officer')
          : world.service.get(pending.personId)?.commissioned === true
      const title = specialtyTitleFor(specialty, commissioned)
      if (pending.kind === 'retrain') return `Retrain as ${title}`
      // M-ENLIST §2: the code is half of what a job IS called.
      return specialty.code === undefined ? title : `${specialty.code} · ${sentenceCase(title)}`
    }
  }
  return OPTION_LABELS[pending.kind]?.[option] ?? option
}

/** "SSG Delacroix — squad leader", from the id the option carries. */
function oathLabel(world: World, option: string): string {
  const id = Number(option.slice(3))
  const person = world.people.get(id as never)
  const record = world.service.get(id as never)
  if (!person) return 'Take the oath'
  const rank = record ? `${rankTitle(world, record.branch, record.rank, record.commissioned === true)} ` : ''
  return `${rank}${person.familyName}`
}

interface PromptProps {
  readonly world: World
  readonly pending: PendingDecision
  readonly onChoose: (choice: string) => void
}

export function DecisionPrompt({ world, pending, onChoose }: PromptProps) {
  // §6. WHO IS SWEARING YOU IN, once it has been picked.
  //
  // Found by playing: the contract named the drawn adjutant while the button
  // the player pressed named a real sergeant, so the paper and the ceremony
  // disagreed about who was standing there. The name is chosen FIRST now and
  // the document is redrawn with it, which is also the right order — you
  // sign in front of somebody, not before knowing who.
  const [oathBy, setOathBy] = useState<number | null>(null)

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

  // THE INTERVIEW. The forty minutes the old button skipped over.
  if (pending.kind === 'interview') {
    const state = decodeInterview(pending.occupationId)
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-label="An interview">
        <InterviewView
          role={occupationById(state.occupationId).title}
          variant={state.variant}
          stretch={isStretchFor(world, pending.personId, state.occupationId)}
          onChoose={onChoose}
        />
      </div>
    )
  }

  // A MOMENT AT SCHOOL. The same card as work, its own copy throughout,
  // and a stakes line a child actually has: the stage and the year so far.
  if (pending.kind === 'school-moment') {
    const state = decodeSchoolMoment(pending.occupationId)
    const moment = schoolMomentById(state.momentId)
    const record = world.education.get(pending.personId)
    if (moment && record) {
      const stage =
        record.enrolledIn === 'primary'
          ? 'Elementary'
          : record.enrolledIn === 'middle'
            ? 'Middle school'
            : 'High school'
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="A moment at school">
          <SchoolMomentView
            moment={moment}
            variant={state.variant}
            attainment={record.attainment}
            standing={`${stage} · ${schoolStandingWords(record.attainment)}`}
            onChoose={onChoose}
          />
        </div>
      )
    }
  }

  // A MOMENT AT WORK. Same rails as the crime scene, entirely its own copy.
  if (pending.kind === 'work-moment') {
    const state = decodeWorkMoment(pending.occupationId)
    const moment = workMomentById(state.momentId)
    const job = world.employment.get(pending.personId)
    if (moment && job) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="A moment at work">
          <WorkMomentView
            moment={moment}
            variant={state.variant}
            performance={job.performance}
            standing={`${occupationById(job.occupationId).title} · ${standingWords(job.performance)}`}
            onChoose={onChoose}
          />
        </div>
      )
    }
  }

  // AN ENGAGEMENT, BEAT BY BEAT (combat revamp §3). The decision beats
  // fall through to the existing scene sheet — that atom works and the
  // spec says to keep it. Everything else is read-and-continue, which is
  // what turns a popup into a sequence.
  if (pending.kind === 'combat-moment') {
    const seq = decodeSequence(pending.occupationId)
    const { sceneId, threat } = decodeScene(pending.occupationId)
    const beat = beatAt(seq.beats, seq.step)

    // THE FOLLOW-ON NAMES THE MAN, which is the whole reason the beat
    // exists. It reads `whoIsDown` from the SAME seed the resolver does,
    // so the question and the answer are about the same person — two
    // draws would put one name in the question and another in the
    // outcome, and nothing feels more arbitrary than that.
    if (beat === 'followon') {
      const tour = deploymentsOf(world, pending.personId).find((t) => t.returnedAtTick === null)
      const squad = tour?.squad ?? []
      const living = squad.filter((m) => world.people.get(m.personId)?.deathTick === null)
      const roll = engagementRoll(world, pending.tick, pending.personId, squad.length)
      const down = whoIsDown(living, roll)
      if (down !== null) {
        const record = world.service.get(pending.personId)
        const isLeader = (record?.rank ?? 0) >= 4 || record?.commissioned === true
        const follow = followOnFor(down.nickname, isLeader)
        return (
          <div className="overlay" role="dialog" aria-modal="true" aria-label="Somebody is down">
            <div className="sheet">
              <EngagementView
                beat="followon"
                step={seq.step}
                total={seq.beats.length}
                threat={threat}
                situation={follow.tell}
                labels={follow.labels}
                onChoose={(c) => onChoose(c)}
                onContinue={() => onChoose('hold')}
              />
            </div>
          </div>
        )
      }
    }

    if (!beatAsks(beat)) {
      const scene = sceneById(sceneId)
      const record = world.service.get(pending.personId)
      const tour = deploymentsOf(world, pending.personId).find((t) => t.returnedAtTick === null)
      const squad = tour?.squad ?? []
      const lost = squad.filter((m) => world.people.get(m.personId)?.deathTick !== null).length
      // DID THIS CONTACT HURT THEM? The after-action used to answer zero
      // no matter what, which is how a player was told nobody was hurt in
      // the engagement that killed him.
      const wasHurt = hurtInContact(world.events, pending.personId, pending.tick)
      const situation =
        beat === 'contact'
          ? (scene?.tell[threat] ?? 'Contact.')
          : beat === 'orient'
            ? orientWords(threat, record?.performance ?? 500, squad.some((m) => m.role === 'radio'))
            : beat === 'consequence'
              ? // THE CHOICE THEY MADE AND WHETHER IT WENT WELL, both read
                // rather than assumed. This hard-coded 'hold' and 'true',
                // so it congratulated a player on a careful answer they
                // had not given while they were bleeding from one they
                // had.
                consequenceWords(seq.choice ?? 'hold', !wasHurt, threat)
              : afterActionWords(threat, lost, wasHurt ? 1 : 0)
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Contact">
          <div className="sheet">
            <EngagementView
              beat={beat}
              step={seq.step}
              total={seq.beats.length}
              threat={threat}
              situation={situation}
              labels={null}
              onChoose={() => onChoose('hold')}
              onContinue={() => onChoose('hold')}
            />
          </div>
        </div>
      )
    }
  }

  // A BIG POT MID-SESSION. The night is already dealt; this is the player
  // reading it and choosing (casino spec §2).
  if (pending.kind === 'key-hand') {
    const record = gamblerOf(world, pending.personId)
    const hand = keyHandFor(world, pending.tick, pending.personId, record.hoursPlayed, record.pokerSkill)
    const held = decodeHeldSession(pending.occupationId)
    const stake = held === null ? undefined : stakeById(held.stakeId)
    if (hand && stake) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="A key hand">
          <KeyHandView
            hand={hand}
            buyIn={stake.buyIn}
            chips={record.chips}
            onChoose={onChoose}
          />
        </div>
      )
    }
  }

  // A HAND OF BLACKJACK, with cards on the table. The engine dealt them;
  // this reads them back and sends a choice.
  if (pending.kind === 'blackjack-hand') {
    const hand = decodeHand(pending.occupationId)
    if (hand !== null) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Blackjack">
          <BlackjackTable
            hand={hand}
            chips={gamblerOf(world, pending.personId).chips}
            options={pending.options}
            onChoose={onChoose}
          />
        </div>
      )
    }
  }

  // THE CRIME, AS IT HAPPENS. The room is already rolled; this is the
  // player reading it. Nothing has moved yet — the answer is what does it.
  if (pending.kind === 'crime-scene') {
    const state = decodeCrimeScene(pending.occupationId)
    const offence = offenceById(state.offenceId)
    if (offence) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="A crime">
          <CrimeSceneView
            variant={state.variant}
            scene={crimeSceneFor(offence, state.danger, state.variant)}
            offence={offence}
            title={offence.title}
            onChoose={onChoose}
          />
        </div>
      )
    }
  }

  // ADR-0037. THE ARTICLE 15. Signing is not agreeing — the punishment is
  // already imposed by the time this reaches the screen — so there is one
  // button and it says so.
  if (pending.kind === 'article15') {
    return (
      <div className="overlay" role="dialog" aria-modal="true" aria-label="Record of nonjudicial punishment">
        <Article15Sheet
          world={world}
          personId={pending.personId}
          disciplineTick={Number(pending.occupationId ?? 0) as Tick}
        />
        <div className="dd-actions">
          <button type="button" onClick={() => onChoose(pending.options[0] ?? 'acknowledge')}>
            Sign &amp; acknowledge
          </button>
        </div>
      </div>
    )
  }

  // THE LAST TWO DOCUMENTS. A career ends with paperwork, and the sheet is
  // a summary of the whole of it — which is what makes it feel earned: it
  // is literally everything they did.
  if (pending.kind === 'separation-record') {
    const sheet = separationFor(world, pending.personId)
    if (sheet) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Separation record">
          <SeparationSheetView sheet={sheet}>
            <div className="dd-actions">
              <button type="button" onClick={() => onChoose(pending.options[0] ?? 'acknowledge')}>
                Acknowledge — Out-Process
              </button>
            </div>
          </SeparationSheetView>
        </div>
      )
    }
  }

  if (pending.kind === 'retirement-certificate') {
    const certificate = retirementCertificateFor(world, pending.personId)
    if (certificate) {
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Certificate of retirement">
          <RetirementCertificateView certificate={certificate}>
            <div className="retire-actions">
              <button type="button" onClick={() => onChoose(pending.options[0] ?? 'accept')}>
                Accept with Honor
              </button>
            </div>
          </RetirementCertificateView>
        </div>
      )
    }
  }

  // §6b/§6c. A CONTRACT IS PAPER TOO, and for the same reason orders are:
  // the oath is the largest moment in a service life that used to arrive in
  // the same grey box as "move house?".
  if (pending.kind === 'service-contract') {
    const state = decodeContract(pending.occupationId)
    const contract = contractFor(
      world,
      pending.tick,
      pending.personId,
      state.code === 'enlist' ? 'enlistment' : 'reenlistment',
      {
        termYears: state.termYears,
        option: state.option,
        bonus: state.bonus as Money,
        administratorId: oathBy as EntityId | null,
      },
    )
    if (contract) {
      // §6. THE CEREMONY. Where the unit has people senior to you, the
      // buttons ARE those people — the document is on screen and you choose
      // who swears you in, rather than answering that in a separate box.
      const byPerson = pending.options.filter((o) => o.startsWith('by-'))
      return (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="A contract">
          <ServiceContractView contract={contract}>
            {byPerson.length === 0 ? (
              <div className="contract-actions">
                <button type="button" onClick={() => onChoose(pending.options[0] ?? 'take-the-oath')}>
                  Raise Your Right Hand — Take the Oath
                </button>
              </div>
            ) : oathBy === null ? (
              <div className="contract-ceremony">
                <p className="muted small">Who administers the oath?</p>
                <div className="contract-actions">
                  {byPerson.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOathBy(Number(option.slice(3)))}
                    >
                      {oathLabel(world, option)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="contract-ceremony">
                <p className="muted small">
                  {oathLabel(world, `by-${String(oathBy)}`)} will administer it.
                </p>
                <div className="contract-actions">
                  <button type="button" onClick={() => onChoose(`by-${String(oathBy)}`)}>
                    Raise Your Right Hand — Take the Oath
                  </button>
                  <button type="button" className="ghost" onClick={() => setOathBy(null)}>
                    Someone else
                  </button>
                </div>
              </div>
            )}
          </ServiceContractView>
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
