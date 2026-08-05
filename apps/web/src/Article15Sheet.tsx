/**
 * ADR-0037. THE ARTICLE 15, as paper.
 *
 * Same family and the same `.contract-*` classes as the enlistment
 * contract, the orders sheet and the DD-214 — crest, titlebar, meta, data
 * table, numbered body, acknowledgment, signature blocks, control number.
 * No new look: a service life accumulates documents, and they should read
 * like documents from the same office.
 *
 * This component writes nothing. Every value is built by `article15For`.
 * The crest is an invented device, never a real seal (charter §3).
 */

import { article15For } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import type { EntityId, Tick } from '@life-engine/shared'

interface Props {
  readonly world: World
  readonly personId: EntityId
  readonly disciplineTick: Tick
}

export function Article15Sheet({ world, personId, disciplineTick }: Props) {
  const sheet = article15For(world, personId, disciplineTick)
  if (sheet === undefined) return null

  return (
    <div className="contract">
      <div className="contract-sheet is-article15">
        <div className="contract-crest">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            {/* An invented device: a shield over crossed rules. Not a seal. */}
            <path
              d="M32 6 L54 14 V32 C54 45 43 54 32 58 C21 54 10 45 10 32 V14 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M22 24 L42 40 M42 24 L22 40" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div className="contract-org">{sheet.command}</div>
          <div className="contract-cmd">{sheet.station}</div>
        </div>

        <hr className="contract-rule" />

        <div className="contract-titlebar">
          <div className="contract-title">{sheet.title}</div>
          <div className="contract-no">{sheet.articleNo}</div>
        </div>
        <div className="contract-meta">
          <span>DATE: {sheet.dated}</span>
          <span>Company punishment imposed</span>
        </div>

        <table className="contract-data">
          <tbody>
            <tr>
              <td>
                <span className="lbl">Name</span>
                <span className="val">{sheet.name}</span>
              </td>
              <td>
                <span className="lbl">Grade</span>
                <span className="val">{sheet.grade}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Offense</span>
                <span className="val">{sheet.offence}</span>
              </td>
              <td>
                <span className="lbl">Date of offense</span>
                <span className="val">{sheet.offenceDate}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <ol className="contract-body">
          {sheet.findings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <div className="contract-oath">
          <div className="h">Acknowledgment</div>
          {sheet.acknowledgment}
        </div>

        {sheet.reduced && <div className="contract-stamp">REDUCED</div>}

        <div className="contract-sigs">
          <div className="sigblk">
            <div className="sigline">Member</div>
            <div className="signame">{sheet.memberSignature}</div>
          </div>
          <div className="sigblk">
            <div className="sigline">Imposing commander</div>
            <div className="signame">{sheet.imposedBy}</div>
            <div className="sigrole">Commanding</div>
          </div>
        </div>

        <div className="contract-foot">
          <span>CONTROL NO. {sheet.controlNo}</span>
          <span>DISTRIBUTION: MEMBER · UNIT S1 · RECORD</span>
        </div>
      </div>
    </div>
  )
}
