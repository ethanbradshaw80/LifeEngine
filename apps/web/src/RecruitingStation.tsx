/**
 * M-ENLIST §7. THE RECRUITER'S WALL.
 *
 * The Service tab used to say "No service record." and offer one button.
 * That is a true sentence and a useless screen: the biggest single decision
 * in the game was made blind, and a player who signed up found out what the
 * job was afterwards.
 *
 * This is what a person could actually see before walking in — three
 * services, what each calls its jobs, what each job wants on the test, and
 * what the officer road looks like there. It shows no score, because they
 * have not sat the test. It DOES grey the jobs their schooling shuts,
 * because a person knows whether they have a degree.
 */

import { useState } from 'react'
import { recruitingStationFor, sentenceCase } from '@life-engine/engine'
import type { World } from '@life-engine/engine'
import type { EntityId } from '@life-engine/shared'

interface Props {
  readonly world: World
  readonly personId: EntityId
  readonly bar: string | null
  readonly busy: boolean
  readonly onEnlist: () => void
}

export function RecruitingStationView({ world, personId, bar, busy, onEnlist }: Props) {
  const branches = recruitingStationFor(world, personId)
  const [openBranch, setOpenBranch] = useState<string | null>(branches[0]?.id ?? null)
  const shown = branches.find((branch) => branch.id === openBranch)

  return (
    <div className="recruiting-station">
      <p className="muted small">
        No service record. This is what the services are offering — the test comes after you
        walk in, and what it opens is between you and the recruiter.
      </p>

      <nav className="sub-tabs" aria-label="Services">
        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            className={openBranch === branch.id ? 'active' : undefined}
            aria-current={openBranch === branch.id}
            onClick={() => setOpenBranch(branch.id)}
          >
            {sentenceCase(branch.name)}
          </button>
        ))}
      </nav>

      {shown !== undefined && (
        <>
          <table className="job-board">
            <caption className="muted small">Enlisted trades</caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Trade</th>
                <th scope="col">Test</th>
                <th scope="col">Schooling</th>
              </tr>
            </thead>
            <tbody>
              {shown.jobs.map((job) => (
                <tr key={job.id} className={job.bar === null ? undefined : 'locked'}>
                  <td className="mono">{job.code}</td>
                  <td>
                    {sentenceCase(job.title)}
                    {job.bar !== null && <span className="muted small"> — {job.bar}</span>}
                  </td>
                  <td>{job.needsScore > 0 ? job.needsScore : '—'}</td>
                  <td className="muted small">
                    {job.needsSchooling === 'none' ? 'Any' : sentenceCase(job.needsSchooling)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {shown.officerRoles.length > 0 && (
            <>
              <p className="muted small">
                <strong>Commissioning:</strong> {shown.accessionWords}
              </p>
              <table className="job-board">
                <caption className="muted small">Officer roles</caption>
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Role</th>
                    <th scope="col">Test</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.officerRoles.map((role) => (
                    <tr key={role.id}>
                      <td className="mono">{role.code}</td>
                      <td>{sentenceCase(role.title)}</td>
                      <td>{role.needsScore > 0 ? role.needsScore : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {bar === null ? (
        <>
          <p className="muted small">The recruiting office is open, and you qualify.</p>
          <button type="button" className="enlist-now" disabled={busy} onClick={onEnlist}>
            🪖 Enlist
          </button>
        </>
      ) : (
        <p className="muted small">{bar}</p>
      )}
    </div>
  )
}
