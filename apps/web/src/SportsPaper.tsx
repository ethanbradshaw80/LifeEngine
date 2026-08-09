/**
 * THE PAPER AN ATHLETE SIGNS (owner: "make a contract UI how we did for
 * deployments and stuff so that its realistic — college offers along with
 * endorsement deals and stuff").
 *
 * Deliberately the same component shape as `ServiceContractView`: a sheet,
 * a crest, a data table, numbered clauses, a stamp and a signature block.
 * A player who has enlisted in this game already knows how to read this.
 *
 * THE COMPONENT COMPUTES NOTHING. Every value comes from the engine's
 * builders, which is what makes it impossible for the paper to say
 * something the world does not.
 */

import type { JSX } from 'react'
import { formatMoney } from '@life-engine/shared'
import type { Money } from '@life-engine/shared'
import type { SportsPaper } from '@life-engine/engine'

export function SportsPaperView({
  paper,
  children,
}: {
  readonly paper: SportsPaper
  readonly children?: JSX.Element | readonly JSX.Element[]
}): JSX.Element {
  return (
    <div className="contract">
      <div className={`contract-sheet is-${paper.variant}`}>
        <div className="contract-crest">
          {/* AN INVENTED DEVICE, never a real seal or logo (charter §3).
              Three marks for the three kinds of paper, so a letter of
              intent does not arrive wearing a brand's crest. */}
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1" />
            {paper.variant === 'letter' ? (
              <path d="M32 17 L46 25 L32 33 L18 25 Z M22 29 v9 a10 6 0 0 0 20 0 v-9" fill="none" stroke="currentColor" strokeWidth="2" />
            ) : paper.variant === 'endorsement' ? (
              <path d="M22 24 h20 v16 h-20 z M26 24 v-4 h12 v4" fill="none" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M32 15 l3.6 11 11.6 0 -9.4 6.9 3.6 11 -9.4-6.9 -9.4 6.9 3.6-11 -9.4-6.9 11.6 0 z" fill="currentColor" />
            )}
          </svg>
          <div className="contract-org">{paper.issuer}</div>
          <div className="contract-cmd">{paper.issuerSub}</div>
        </div>

        <hr className="contract-rule" />
        <div className="contract-titlebar">
          <span className="contract-title">{paper.title}</span>
          <span className="contract-no">
            {paper.form} · NO. {paper.documentNo}
          </span>
        </div>
        <div className="contract-meta">
          <span>DATE: {paper.dated}</span>
          <span>{paper.headline}</span>
        </div>

        <table className="contract-data">
          <tbody>
            <tr>
              <td>
                <span className="lbl">Name</span>
                <span className="val">{paper.name}</span>
              </td>
              <td>
                <span className="lbl">Position</span>
                <span className="val">{paper.role}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Term</span>
                <span className="val">{paper.termYears} years</span>
              </td>
              <td>
                <span className="lbl">Effective</span>
                <span className="val">{paper.from}</span>
              </td>
            </tr>
            {/* LINES WITH NOTHING TO SAY DO NOT PRINT. A walk-on's letter
                shows no money rather than a proud $0. */}
            {paper.monthly > 0 && (
              <tr>
                <td>
                  <span className="lbl">
                    {paper.variant === 'letter' ? 'Aid, per month' : 'Compensation'}
                  </span>
                  <span className="val">{formatMoney(paper.monthly)} / mo</span>
                </td>
                <td>
                  <span className="lbl">Annual</span>
                  <span className="val">{formatMoney((paper.monthly * 12) as Money)}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <ol className="contract-body">
          {paper.clauses.map((clause) => (
            <li key={clause.slice(0, 40)}>{clause}</li>
          ))}
          {paper.bonus > 0 && (
            <li>
              {paper.variant === 'endorsement' ? 'Signing fee' : 'Signing bonus'}:{' '}
              <span className="contract-money">{formatMoney(paper.bonus)}</span>, paid on execution.
            </li>
          )}
        </ol>

        <div className="contract-oath">
          <div className="h">UNDERTAKING</div>
          {paper.undertaking}
        </div>

        <div className="contract-stamp">
          {paper.stamp}
          <small>{paper.stampNote}</small>
        </div>

        <div className="contract-sigs">
          <div className="sig">
            <span className="line" />
            <span className="who">{paper.signerTitle}</span>
          </div>
          <div className="sig">
            <span className="line" />
            <span className="who">{paper.witness}</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
