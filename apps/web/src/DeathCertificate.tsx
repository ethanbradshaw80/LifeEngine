/**
 * THE BOOKEND (owner's `newgame_and_birth_master.md` §6b,
 * `newgame_and_birth.html` screen 4).
 *
 * The Certificate of Death mirrors the Certificate of Live Birth — same
 * registry number, same seal, same hand — and that is the whole idea. A
 * life opened on a document and it closes on the matching one.
 *
 * THE CAUSE IS DRAWN CAUSALLY FROM THE LIFE (spec: "with cause of death
 * drawn causally from the life"), never invented here: the engine already
 * records a cause on every death, and this prints it. A screen that made
 * up an ending would undo Law 3 at the one moment it matters most.
 */

import type { ReactElement } from 'react'

export interface DeathRow {
  readonly role: string
  readonly name: string
  readonly meta: string
  /** The person behind the row, when the line can be continued through them. */
  readonly personId?: number
}

export function DeathCertificate({
  registryNo,
  name,
  ageWords,
  dateWords,
  placeWords,
  cause,
  obituary,
  survivedBy,
  onContinueAs,
  serviceLine,
  lifeLines,
  epitaph,
  onClose,
}: {
  readonly registryNo: string
  readonly name: string
  readonly ageWords: string
  readonly dateWords: string
  readonly placeWords: string
  readonly cause: string
  readonly obituary: string
  readonly survivedBy: readonly DeathRow[]
  /**
   * CONTINUE THROUGH AN HEIR (Law 8, and the playtest's own request: the
   * death screen "already has the data (surviving children, ages); wire
   * 'continue as Eric Baldwin, 64' into the title-screen flow"). Absent
   * when the viewer is only reading a past life.
   */
  readonly onContinueAs?: (personId: number) => void
  readonly serviceLine: string | null
  /**
   * THE LIFE, SUMMARIZED (live player, on itch: "the death certificate
   * doesn't list any achievements or summary of that persons life at all,
   * very dull"). Law 8 has owed this since Layer 3: career, service,
   * decorations, family, the shape of what actually happened — assembled
   * from the records, never invented. Label/value rows in the document's
   * own register.
   */
  readonly lifeLines?: readonly { readonly label: string; readonly value: string }[]
  readonly epitaph: string
  readonly onClose: () => void
}): ReactElement {
  return (
    <div className="reg cert">
      <div className="cert-in mourn">
        <div className="cert-head">
          <div className="k">Registry of Vital Records · this world</div>
          <div className="t">Certificate of Death</div>
          {/* THE SAME NUMBER AS THE BIRTH. That is what makes it a bookend
              rather than a second document about a stranger. */}
          <div className="rn">No. {registryNo}</div>
        </div>
        <div className="cert-rule" />

        <div className="vital">
          <div className="v">
            <span className="sc">Name</span>
            <div className="d">
              <em>{name}</em>
            </div>
          </div>
          <div className="v">
            <span className="sc">Age at death</span>
            <div className="d">{ageWords}</div>
          </div>
        </div>
        <div className="vital second">
          <div className="v">
            <span className="sc">Date of death</span>
            <div className="d">{dateWords}</div>
          </div>
          <div className="v">
            <span className="sc">Place</span>
            <div className="d">{placeWords}</div>
          </div>
        </div>
        <div className="vital second">
          <div className="v">
            <span className="sc">Cause of death</span>
            {/* NEVER INVENTED HERE — the engine recorded it when it
                happened, and Law 3 says the record explains itself. */}
            <div className="d">{cause}</div>
          </div>
        </div>

        <div className="cert-rule" />
        <p className="hh">{obituary}</p>

        {(lifeLines ?? []).length > 0 && (
          <>
            <div className="sc parentage">The life</div>
            <div className="par">
              {(lifeLines ?? []).map((row) => (
                <div key={row.label} className="row">
                  <span className="role">{row.label}</span>
                  <span className="nm">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {serviceLine !== null && (
          <>
            <div className="sc parentage">Service</div>
            <p className="hh">{serviceLine}</p>
          </>
        )}

        {survivedBy.length > 0 && (
          <>
            <div className="sc parentage">Survived by</div>
            <div className="par">
              {survivedBy.map((row) => (
                <div key={`${row.role}-${row.name}`} className="row">
                  <span className="role">{row.role}</span>
                  <span className="nm">{row.name}</span>
                  <span className="mt">{row.meta}</span>
                  {/* THE LINE GOES ON. Death ends a life, not the save —
                      the family, the money, the debts and the name pass
                      down, and the world does not restart for anybody. */}
                  {onContinueAs !== undefined && row.personId !== undefined && (
                    <button
                      type="button"
                      className="dc-heir"
                      onClick={() => onContinueAs(row.personId as number)}
                    >
                      Continue as {row.name.split(' ')[0]}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <p className="epitaph">{epitaph}</p>

        <svg className="seal" width="92" height="92" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <path id="dArcTop" d="M14,50 a36,36 0 0 1 72,0" fill="none" />
            <path id="dArcBot" d="M16,54 a34,34 0 0 0 68,0" fill="none" />
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#8f7538" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="39" fill="none" stroke="#5c4c26" strokeWidth="0.8" />
          <g fill="#b7934f" fontSize="7.2" letterSpacing="1.6">
            <text>
              <textPath href="#dArcTop" startOffset="6%">
                REGISTRY · VITAL RECORDS
              </textPath>
            </text>
            <text>
              <textPath href="#dArcBot" startOffset="26%">
                CLOSED
              </textPath>
            </text>
          </g>
          <text x="50" y="57" textAnchor="middle" fontSize="18" fill="#9c473f">
            ✝
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

        <button type="button" className="stamp begin" onClick={onClose}>
          To the past lives →
        </button>
      </div>
    </div>
  )
}

/**
 * PAST LIVES (spec §6). The record of everybody you have played to the
 * end, newest first.
 *
 * A LIFE IS NEVER SILENTLY DELETED (spec §12.3: "kept, never silently
 * deleted"). Starting a new life while one is active archives the old one
 * here rather than overwriting it.
 */
export interface PastLife {
  readonly registryNo: string
  readonly name: string
  readonly years: string
  readonly headline: string
}

export function PastLives({
  lives,
  onBack,
}: {
  readonly lives: readonly PastLife[]
  readonly onBack: () => void
}): ReactElement {
  return (
    <div className="reg page pad">
      <div className="orn">
        <span className="ln" />❦<span className="ln r" />
      </div>
      <div className="formhdr">
        <div>
          <div className="sc">Registry of Vital Records</div>
          <div className="h-serif">Past Lives</div>
        </div>
        <div className="no">LEDGER</div>
      </div>

      {lives.length === 0 ? (
        <p className="lede">
          Nothing here yet. This fills as lives end — and every one of them stays.
        </p>
      ) : (
        <div className="par past">
          {lives.map((life) => (
            <div key={life.registryNo} className="row">
              <span className="role">{life.years}</span>
              <span className="nm">{life.name}</span>
              <span className="mt">{life.headline}</span>
            </div>
          ))}
        </div>
      )}

      <div className="reg-btns">
        <button type="button" className="linky" onClick={onBack}>
          ← back
        </button>
      </div>
    </div>
  )
}
