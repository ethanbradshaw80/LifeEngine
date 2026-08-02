/**
 * The town's demographics, in one component (P3).
 *
 * D1 built three measures — yearlyDemographics, partneringFunnel,
 * fertilityCohort — and only the OBSERVER dashboard rendered them. A played
 * life could not see the town it lives in. This is the same panel, used in
 * both places, so the two can never drift apart.
 *
 * Presentation only: every number is read from the engine each render, and
 * the memo is keyed on the world snapshot (review D1-5 — these walk the whole
 * event log and must not recompute per keystroke).
 */

import { useMemo } from 'react'
import { fertilityCohort, partneringFunnel, yearlyDemographics } from '@life-engine/engine'
import type { World } from '@life-engine/engine'

interface Props {
  readonly world: World
  /** Show only years from here on — the years a played life has seen. */
  readonly sinceYear?: number
  /** How many years of table to show at most. */
  readonly maxYears?: number
}

export function TownStats({ world, sinceYear, maxYears = 12 }: Props) {
  const stats = useMemo(
    () => ({
      rows: yearlyDemographics(world),
      funnel: partneringFunnel(world),
      cohort: fertilityCohort(world),
    }),
    [world],
  )

  const { rows, funnel, cohort } = stats
  const inRange = sinceYear === undefined ? rows : rows.filter((r) => r.year >= sinceYear)
  const recent = inRange.slice(-maxYears)
  const fertilityTenths =
    cohort.completedWomen > 0 ? Math.round((cohort.totalChildren * 10) / cohort.completedWomen) : null

  return (
    <>
      {recent.length === 0 ? (
        <p className="muted small">No full year has passed yet.</p>
      ) : (
        <table className="demo-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Pop</th>
              <th>Births</th>
              <th>Deaths</th>
              <th>Weddings</th>
              <th>Courtships</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td>
                <td>{r.population}</td>
                <td>{r.births}</td>
                <td>{r.deaths}</td>
                <td>{r.marriages}</td>
                <td>{r.courtshipsBegun}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">
        Adults 18–45: {funnel.adults} — {funnel.marriedNow} married, {funnel.courtingNow} courting,{' '}
        {funnel.singleNow} single ({funnel.neverPartnered} never partnered).{' '}
        {funnel.formerlyPartneredAlone} widowed or divorced and alone; {funnel.remarriagesEver} remarriages
        ever.
        {cohort.completedWomen > 0 && fertilityTenths !== null && (
          <>
            {' '}
            Completed families: {cohort.completedWomen} women past 42 raised {cohort.totalChildren} children
            (about {Math.floor(fertilityTenths / 10)}.{fertilityTenths % 10} each; {cohort.childlessWomen} had
            none
            {cohort.medianAgeAtMarriage !== null && <>; median age at marriage {cohort.medianAgeAtMarriage}</>}
            ).
          </>
        )}
      </p>
    </>
  )
}
