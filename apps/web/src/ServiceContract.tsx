/**
 * THE SERVICE CONTRACT.
 *
 * One document, two variants — the day you sign and every day you sign
 * again. Same family as the orders sheet, and the same rule: every value
 * comes from the engine's `contractFor`, the component writes nothing. The
 * crest is an invented device, never a real seal (charter §3).
 *
 * Lines that have nothing to say do not print. A contract with no bonus
 * shows no bonus line rather than a proud $0, which is how a real form
 * behaves and how the owner's reference HTML draws it.
 */

import type { JSX } from 'react'
import { formatMoney } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import type { ServiceContract } from '@life-engine/engine'



export function ServiceContractView({
  contract,
  children,
}: {
  readonly contract: ServiceContract
  readonly children?: JSX.Element | readonly JSX.Element[]
}): JSX.Element {
  const reenlistment = contract.variant === 'reenlistment'
  return (
    <div className="contract">
      <div className={`contract-sheet ${reenlistment ? 'is-reenlistment' : 'is-enlistment'}`}>
        <div className="contract-crest">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1" />
            <path
              d="M32 14 l3.6 11 11.6 0 -9.4 6.9 3.6 11 -9.4-6.9 -9.4 6.9 3.6-11 -9.4-6.9 11.6 0 z"
              fill="currentColor"
            />
          </svg>
          <div className="contract-org">{contract.command}</div>
          <div className="contract-cmd">{contract.station}</div>
        </div>

        <hr className="contract-rule" />
        <div className="contract-titlebar">
          <span className="contract-title">{contract.title}</span>
          <span className="contract-no">
            {contract.form} · NO. {contract.contractNo}
          </span>
        </div>
        <div className="contract-meta">
          <span>DATE: {contract.dated}</span>
          <span>{contract.headline}</span>
        </div>

        <table className="contract-data">
          <tbody>
            <tr>
              <td>
                <span className="lbl">Name</span>
                <span className="val">{contract.name}</span>
              </td>
              <td>
                <span className="lbl">{reenlistment ? 'Grade' : 'Entry Grade'}</span>
                <span className="val">{contract.grade}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Assigned Specialty</span>
                <span className="val">{contract.specialty}</span>
              </td>
              <td>
                <span className="lbl">Station</span>
                <span className="val">{contract.station}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Term</span>
                <span className="val">{contract.termYears} years</span>
              </td>
              <td>
                <span className="lbl">Effective</span>
                <span className="val">{contract.from}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <ol className="contract-body">
          <li>
            {contract.undertaking}{' '}
            <span className="em">{contract.branch}</span> for a term of{' '}
            <span className="em">{contract.termText}</span>, from {contract.from} to {contract.to}.
          </li>
          {contract.option !== null && (
            <li>
              Elected option: <span className="em">{contract.option}</span>
            </li>
          )}
          {contract.bonus > 0 && (
            <li>
              {/* MONEY IS INTEGER CENTS (ADR-0008). Printing the raw number
                  put a $1,123,200 reenlistment bonus on a sergeant's
                  contract — a hundred times the $11,232 it actually was,
                  and the option screen one prompt earlier had it right. */}
              Bonus: <span className="contract-money">{formatMoney(contract.bonus as Money)}</span>,
              paid on execution of this contract.
            </li>
          )}
          <li>
            This{' '}
            {contract.commissioned ? 'agreement' : reenlistment ? 'reenlistment' : 'enlistment'} is
            executed voluntarily, and is subject to the needs of the service.
          </li>
        </ol>

        <div className="contract-oath">
          <div className="h">{contract.oathHeading}</div>
          {contract.oath}
        </div>

        <div className="contract-stamp">
          {contract.stamp}
          <small>TERM</small>
        </div>

        <div className="contract-sigs">
          <div className="sigblk">
            <div className="sigline">{contract.signatureLabel}</div>
            <div className="signame">{contract.signedBy}</div>
          </div>
          <div className="sigblk">
            <div className="sigline">Administered by</div>
            <div className="signame">{contract.administeredBy}</div>
            <div className="sigrole">{contract.administeredTitle}</div>
          </div>
        </div>
        <div className="contract-foot">
          <span>CONTROL NO. {contract.controlNo}</span>
          <span>DISTRIBUTION: MEMBER · UNIT S1 · RECORD</span>
        </div>
      </div>
      {children}
    </div>
  )
}
