/**
 * THE DD-214 (Form RA-214) and the retirement certificate.
 *
 * The last two documents of a service life. Same rule as the orders and the
 * contract: every value comes from the engine, the component writes nothing.
 * The crest and the seal are invented devices, never a real emblem
 * (charter §3).
 *
 * Blocks with nothing in them do not print. A career with no awards, no
 * schools and no tours produces a thin sheet — which is the honest result,
 * and the reason a full one is worth something.
 */

import type { JSX } from 'react'
import type { RetirementCertificate, SeparationRecord } from '@life-engine/engine'

/** The stamp's colour follows the character of service. */
function stampClass(character: SeparationRecord['character']): string {
  if (character === 'UNDER OTHER THAN HONORABLE') return 'is-adverse'
  if (character === 'GENERAL') return 'is-general'
  return 'is-honorable'
}

function Block({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  if (lines.length === 0) return null
  return (
    <div className="dd-block">
      <span className="lbl">{label}</span>
      <span className="dd-list">{lines.join(' · ')}</span>
    </div>
  )
}

export function SeparationSheetView({
  sheet,
  children,
}: {
  readonly sheet: SeparationRecord
  readonly children?: JSX.Element | readonly JSX.Element[]
}): JSX.Element {
  return (
    <div className="dd">
      <div className="dd-sheet">
        <div className="dd-crest">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1" />
            <path
              d="M32 14 l3.6 11 11.6 0 -9.4 6.9 3.6 11 -9.4-6.9 -9.4 6.9 3.6-11 -9.4-6.9 11.6 0 z"
              fill="currentColor"
            />
          </svg>
          <div className="dd-org">{sheet.command}</div>
          <div className="dd-cmd">Certificate of Release or Discharge from Active Service</div>
        </div>

        <hr className="dd-rule" />
        <div className="dd-titlebar">
          <span className="dd-title">FORM RA-214 · SEPARATION RECORD</span>
          <span className="dd-no">NO. {sheet.contractNo}</span>
        </div>

        <table className="dd-data">
          <tbody>
            <tr>
              <td style={{ width: '58%' }}>
                <span className="lbl">Name</span>
                <span className="val">{sheet.name}</span>
              </td>
              <td>
                <span className="lbl">Grade at Separation</span>
                <span className="val">{sheet.grade}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Branch</span>
                <span className="val">{sheet.branch}</span>
              </td>
              <td>
                <span className="lbl">Primary Specialty</span>
                <span className="val">{sheet.specialty}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Entered Active Service</span>
                <span className="val">{sheet.enteredService}</span>
              </td>
              <td>
                <span className="lbl">Separated</span>
                <span className="val">{sheet.separated}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Total Active Service</span>
                <span className="val">{sheet.totalService}</span>
              </td>
              <td>
                <span className="lbl">Character of Service</span>
                <span className="val">{sheet.character}</span>
              </td>
            </tr>
            <tr>
              <td>
                <span className="lbl">Reason &amp; Authority</span>
                <span className="val">{sheet.reason}</span>
              </td>
              <td>
                <span className="lbl">Reentry Code</span>
                <span className="val">{sheet.reentryCode}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <Block label="Decorations, Medals, Badges & Awards" lines={sheet.awards} />
        <Block label="Military Education" lines={sheet.schools} />
        <Block label="Campaigns & Service Abroad" lines={sheet.tours} />
        {sheet.remarks !== '' && <Block label="Remarks" lines={[sheet.remarks]} />}

        <div className={`dd-stamp ${stampClass(sheet.character)}`}>
          {sheet.character === 'UNDER OTHER THAN HONORABLE' ? 'Other than honorable' : sheet.character}
        </div>

        <div className="dd-foot">
          <span>CONTROL NO. {sheet.controlNo}</span>
          <span>DISTRIBUTION: MEMBER · RECORD</span>
        </div>
      </div>
      {children}
    </div>
  )
}

export function RetirementCertificateView({
  certificate,
  children,
}: {
  readonly certificate: RetirementCertificate
  readonly children?: JSX.Element | readonly JSX.Element[]
}): JSX.Element {
  return (
    <div className="retire">
      <div className="retire-cert">
        <div className="retire-frame">
          <svg className="retire-seal" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="none" stroke="#8a6d22" strokeWidth="2" />
            <circle cx="32" cy="32" r="23" fill="none" stroke="#b28e35" strokeWidth="1" />
            <path
              d="M32 13 l4 12 12.5 0 -10 7.4 3.8 12 -10.3-7.4 -10.3 7.4 3.8-12 -10-7.4 12.5 0 z"
              fill="#b28e35"
            />
          </svg>
          <div className="retire-org">{certificate.command}</div>
          <h1>Certificate of Retirement</h1>
          <div className="retire-sub">In grateful recognition of a career of faithful service</div>

          <div className="retire-pre">This is to certify that</div>
          <div className="retire-name">{certificate.name}</div>

          <p className="retire-body">
            is hereby retired from <b>{certificate.branch}</b> on this day,{' '}
            <b>{certificate.date}</b>, having served <b>{certificate.years}</b> with honor, courage,
            and unfailing devotion.
          </p>
          <p className="retire-body">
            A grateful nation records its thanks for a lifetime of service, and wishes its soldier
            peace and long life in the years now earned.
          </p>

          <div className="retire-flourish">✦ ✦ ✦</div>

          <div className="retire-sigs">
            <div className="sigblk">
              <div className="sigline">The Commanding General</div>
              <div className="signame">{certificate.signedBy}</div>
            </div>
            <div className="sigblk">
              <div className="sigline">Adjutant</div>
              <div className="signame">{certificate.adjutant}</div>
            </div>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
