/**
 * THE ORDERS SHEET.
 *
 * A tour is the largest thing that happens to a serving person, and it used
 * to begin with a sentence. This is the paper: who you are, where you are
 * going, when you have to be there, and who signed it.
 *
 * Every value comes from the engine's `ordersSheetFor` — the component
 * writes nothing. The crest is an invented device, not a real seal: the
 * charter lets a branch be named and never lets its insignia be drawn.
 */

import type { JSX } from 'react'
import type { OrdersSheet as Sheet } from '@life-engine/engine'

export function OrdersSheetView({
  sheet,
  children,
}: {
  readonly sheet: Sheet
  readonly children?: JSX.Element | readonly JSX.Element[]
}): JSX.Element {
  return (
    <div className="orders">
      <div className="orders-sheet">
        <div className="orders-crest">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="#1b1a16" strokeWidth="2" />
            <circle cx="32" cy="32" r="24" fill="none" stroke="#1b1a16" strokeWidth="1" />
            <path
              d="M32 14 l3.6 11 11.6 0 -9.4 6.9 3.6 11 -9.4-6.9 -9.4 6.9 3.6-11 -9.4-6.9 11.6 0 z"
              fill="#1b1a16"
            />
          </svg>
          <div className="orders-cmd">{sheet.command}</div>
        </div>

        <hr className="orders-rule" />
        <div className="orders-titlebar">
          <span className="orders-title">{sheet.title}</span>
          <span className="orders-no">ORDERS NO. {sheet.ordersNo}</span>
        </div>
        <div className="orders-meta">
          <span>DATE ISSUED: {sheet.issued}</span>
          <span>{sheet.variantLine}</span>
        </div>

        <table className="orders-data">
          <tbody>
            <tr>
              <td>
                <span className="lbl">Name</span>
                <span className="val">{sheet.name}</span>
              </td>
              <td>
                <span className="lbl">Grade / Rank</span>
                <span className="val">{sheet.rank}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Specialty</span>
                <span className="val">{sheet.specialty}</span>
              </td>
              <td>
                <span className="lbl">Present Unit</span>
                <span className="val">{sheet.unit}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Assigned To</span>
                <span className="val">{sheet.assignedTo}</span>
              </td>
              <td>
                <span className="lbl">Tour Length</span>
                <span className="val">{sheet.tourMonths} months</span>
              </td>
            </tr>
          </tbody>
        </table>

        <ol className="orders-body">
          <li>
            {sheet.variant === 'rotation' ? (
              <>
                You are ordered to a peacetime rotation with{' '}
                <span className="em">{sheet.enemy}</span>, in support of the alliance.
              </>
            ) : (
              <>
                You are ordered to active deployment in support of operations against{' '}
                <span className="em">{sheet.enemy}</span> on <span className="em">{sheet.frontName}</span>.
              </>
            )}
          </li>
          <li>
            You will <span className="nlt">REPORT NOT LATER THAN {sheet.reportBy}</span> to your port of
            embarkation for movement to theatre.
          </li>
          <li>
            Duration of this tour is <span className="em">{sheet.tourText}</span>, subject to the needs of
            the service and extension by competent authority.
          </li>
          {sheet.carriesAwolWarning && (
            <li>
              Failure to report as ordered constitutes absence without leave and is punishable under the
              Code of Military Justice.
            </li>
          )}
          <li>Authority: {sheet.authority}.</li>
        </ol>

        <div className="orders-stamp">
          Report
          <br />
          NLT
          <small>{sheet.reportByShort}</small>
        </div>

        <hr className="orders-thin" />
        <div className="orders-sig">
          <div className="by">By order of the Commanding General</div>
          <div className="name">{sheet.signedBy}</div>
          <div className="role">{sheet.signedRole}</div>
        </div>
        <div className="orders-foot">
          <span>CONTROL NO. {sheet.controlNo}</span>
          <span>DISTRIBUTION: MEMBER · UNIT S1 · RECORD</span>
        </div>
      </div>
      {children}
    </div>
  )
}
