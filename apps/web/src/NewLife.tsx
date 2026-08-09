/**
 * THE FRONT DOOR (owner's `newgame_and_birth_master.md`,
 * `newgame_and_birth.html`).
 *
 * Title → intake → certificate of live birth → the life feed. The engine
 * view is not deleted, it is DEMOTED to a developer entry, because the
 * spec is right that it is invaluable for testing and is not a game start.
 *
 * THE AESTHETIC IS THE MOCKUP'S OWN AND DELIBERATELY NOT THE APP'S. Every
 * other screen in this game is a phone; these four are a registry of vital
 * records — brass, serif, an embossed seal. That is a considered contrast
 * rather than an oversight: the front door and the bookend are documents
 * about a life, and the rest of the game is the life happening. They carry
 * their own tokens rather than the app's for exactly that reason.
 */

import { useState } from 'react'
import type { ReactElement } from 'react'

export type NewLifeStage = 'title' | 'intake' | 'certificate'

export interface LifeChoices {
  readonly givenName: string
  readonly familyName: string
  readonly sex: 'male' | 'female'
  readonly town: string
  readonly station: number | null
  readonly seedCode: string
}

/** Period-appropriate, and only ever a suggestion — the dice, not a rule. */
const GIVEN_MALE = ['Gary', 'Raymond', 'Walter', 'Dennis', 'Marvin', 'Clifford', 'Roy', 'Leonard']
const GIVEN_FEMALE = ['Winifred', 'Doris', 'Marlene', 'Eunice', 'Beverly', 'Loretta', 'Joan', 'Hazel']
const FAMILIES = ['Lewis', 'Hartley', 'Brackenwell', 'Calver', 'Thorne', 'Ashcombe', 'Merriweather']

function pick<T>(list: readonly T[], n: number): T {
  return list[Math.abs(n) % list.length] as T
}

export function TitleScreen({
  hasSave,
  activeLine,
  onNewLife,
  onContinue,
  onPastLives,
  onEngine,
}: {
  readonly hasSave: boolean
  readonly activeLine: string | null
  readonly onNewLife: () => void
  readonly onContinue: () => void
  readonly onPastLives: () => void
  readonly onEngine: () => void
}): ReactElement {
  return (
    <div className="reg page front">
      <div className="kicker">A simulated world · its own history since 1970</div>
      <h1 className="reg-title">
        The Life
        <br />
        <em>Simulator</em>
      </h1>
      <div className="rule-c" />
      <p className="tag">
        The countries are real. The history is this world&rsquo;s own. The life is yours.
      </p>

      <div className="index">
        <button type="button" className="idx first" onClick={onNewLife}>
          <span className="ti">Begin a new life</span>
          <span className="lead" />
          <span className="no">I</span>
        </button>
        {/* CONTINUE ONLY WHEN THERE IS SOMETHING TO CONTINUE. A dead button
            on the first screen is a worse first impression than no button. */}
        {hasSave && (
          <button type="button" className="idx" onClick={onContinue}>
            <span className="ti">
              Continue{activeLine !== null && <span className="sub"> — {activeLine}</span>}
            </span>
            <span className="lead" />
            <span className="no">II</span>
          </button>
        )}
        <button type="button" className="idx" onClick={onPastLives}>
          <span className="ti">Past lives</span>
          <span className="lead" />
          <span className="no">{hasSave ? 'III' : 'II'}</span>
        </button>
      </div>
      {/* THE ENGINE VIEW, DEMOTED RATHER THAN DELETED. It is a dev tool and
          it is invaluable; it is simply not the front door. */}
      <div className="reg-foot">
        Developer ·{' '}
        <button type="button" className="linky" onClick={onEngine}>
          open the engine / world view
        </button>
      </div>
    </div>
  )
}

export function IntakeScreen({
  onBorn,
  onBack,
}: {
  readonly onBorn: (choices: LifeChoices) => void
  readonly onBack: () => void
}): ReactElement {
  const [given, setGiven] = useState('Gary')
  const [family, setFamily] = useState('Lewis')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [town, setTown] = useState('Anywhere')
  const [advanced, setAdvanced] = useState(false)
  const [station, setStation] = useState<number | null>(null)
  const [seedCode, setSeedCode] = useState('')

  function surpriseMe(): void {
    // THE DICE ARE A SUGGESTION, not a seed. Rolling a name here must not
    // decide the life — the life's seed is its own field, and conflating
    // the two would make "leave it to chance" quietly un-shareable.
    const n = Math.floor(Math.random() * 100_000)
    const male = n % 2 === 0
    setSex(male ? 'male' : 'female')
    setGiven(pick(male ? GIVEN_MALE : GIVEN_FEMALE, n))
    setFamily(pick(FAMILIES, Math.floor(n / 7)))
    setTown('Anywhere')
  }

  return (
    <div className="reg page pad">
      <div className="orn">
        <span className="ln" />❦<span className="ln r" />
      </div>
      <div className="formhdr">
        <div>
          <div className="sc">Registry of Vital Records</div>
          <div className="h-serif">A New Life</div>
        </div>
        <div className="no">FORM I·A</div>
      </div>
      <p className="lede">A few particulars. The rest is settled at birth — as it is for everyone.</p>

      <div className="grid2">
        <label className="fld">
          <span className="sc">Given name</span>
          <input className="blank" value={given} onChange={(e) => setGiven(e.target.value)} />
        </label>
        <label className="fld">
          <span className="sc">Family name</span>
          <input className="blank" value={family} onChange={(e) => setFamily(e.target.value)} />
        </label>
      </div>
      <div className="grid2">
        <div className="fld">
          <span className="sc">Sex</span>
          <div className="pick">
            <button
              type="button"
              className={sex === 'male' ? 'on' : ''}
              onClick={() => setSex('male')}
            >
              Male
            </button>
            <button
              type="button"
              className={sex === 'female' ? 'on' : ''}
              onClick={() => setSex('female')}
            >
              Female
            </button>
          </div>
        </div>
        <label className="fld">
          <span className="sc">Town</span>
          <input className="blank" value={town} onChange={(e) => setTown(e.target.value)} />
        </label>
      </div>

      <button type="button" className="chance" onClick={surpriseMe}>
        ⚅ Leave it to chance
      </button>

      {/* SCHEDULE B — the depth, folded away. The spec's §12.2: "BitLife-
          light by default, Advanced for depth. Fast in, depth optional." */}
      <div className="sched">
        <button type="button" className="bar" onClick={() => setAdvanced(!advanced)}>
          <span className="l">Schedule B · Advanced</span>
          <span className="r">{advanced ? 'hide' : 'optional'}</span>
        </button>
        {advanced && (
          <div className="in">
            <div className="fld">
              <span className="sc">Station in life</span>
              <input
                type="range"
                min={0}
                max={1000}
                step={10}
                value={station ?? 500}
                onChange={(e) => setStation(Number(e.target.value))}
              />
              <div className="scLabs">
                <span>hard-up</span>
                <span>comfortable</span>
                <span>silver spoon</span>
              </div>
              {station === null && (
                <span className="hint">Left alone, it is rolled — as it is for everyone.</span>
              )}
            </div>
            <label className="fld">
              <span className="sc">Seed — to share or replay a life</span>
              <input
                className="blank mono-in"
                placeholder="4471·GARY·LEWIS"
                value={seedCode}
                onChange={(e) => setSeedCode(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className="reg-btns">
        <button type="button" className="linky" onClick={onBack}>
          ← back
        </button>
        <button
          type="button"
          className="stamp"
          onClick={() => onBorn({ givenName: given, familyName: family, sex, town, station, seedCode })}
        >
          Record the birth →
        </button>
      </div>
    </div>
  )
}

/** One line of the parentage block. */
export interface CertRow {
  readonly role: string
  readonly name: string
  readonly meta: string
}

export function BirthCertificate({
  registryNo,
  childName,
  sex,
  dateWords,
  placeWords,
  rows,
  householdWords,
  onBegin,
}: {
  readonly registryNo: string
  readonly childName: string
  readonly sex: string
  readonly dateWords: string
  readonly placeWords: string
  readonly rows: readonly CertRow[]
  readonly householdWords: string
  readonly onBegin: () => void
}): ReactElement {
  return (
    <div className="reg cert">
      <div className="cert-in">
        <div className="cert-head">
          <div className="k">Registry of Vital Records · this world</div>
          <div className="t">Certificate of Live Birth</div>
          <div className="rn">No. {registryNo}</div>
        </div>
        <div className="cert-rule" />

        <div className="vital">
          <div className="v">
            <span className="sc">Name of child</span>
            <div className="d">
              <em>{childName}</em>
            </div>
          </div>
          <div className="v">
            <span className="sc">Sex</span>
            <div className="d">{sex}</div>
          </div>
        </div>
        <div className="vital second">
          <div className="v">
            <span className="sc">Date of birth</span>
            <div className="d">{dateWords}</div>
          </div>
          <div className="v">
            <span className="sc">Place of birth</span>
            <div className="d">{placeWords}</div>
          </div>
        </div>

        <div className="cert-rule" />
        <div className="sc parentage">Parentage &amp; issue</div>
        <div className="par">
          {rows.map((row) => (
            <div key={`${row.role}-${row.name}`} className="row">
              <span className="role">{row.role}</span>
              <span className="nm">{row.name}</span>
              <span className="mt">{row.meta}</span>
            </div>
          ))}
        </div>
        <p className="hh">
          <b>Household —</b> {householdWords}
        </p>

        {/* An invented seal. No real registry, agency or state is depicted
            (charter §3) — it is this world's own office. */}
        <svg className="seal" width="92" height="92" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <path id="arcTop" d="M14,50 a36,36 0 0 1 72,0" fill="none" />
            <path id="arcBot" d="M16,54 a34,34 0 0 0 68,0" fill="none" />
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#8f7538" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="39" fill="none" stroke="#5c4c26" strokeWidth="0.8" />
          <g fill="#b7934f" fontSize="7.2" letterSpacing="1.6">
            <text>
              <textPath href="#arcTop" startOffset="6%">
                REGISTRY · VITAL RECORDS
              </textPath>
            </text>
            <text>
              <textPath href="#arcBot" startOffset="22%">
                THIS WORLD
              </textPath>
            </text>
          </g>
          <text x="50" y="57" textAnchor="middle" fontSize="20" fill="#c9a662">
            ✶
          </text>
        </svg>

        <div className="signrow">
          <div className="sig">
            <div className="ln" />
            <span className="sc">Registrar</span>
          </div>
          <div className="recorded">
            <span className="sc">Recorded</span>
            <div className="when">{dateWords}</div>
          </div>
        </div>

        <button type="button" className="stamp begin" onClick={onBegin}>
          Begin life →
        </button>
      </div>
    </div>
  )
}
