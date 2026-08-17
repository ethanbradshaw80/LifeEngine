/**
 * SCHOOL — built to the owner's `highschool_tab.html`.
 *
 * Eight phases of education existed with nowhere to look at them (owner:
 * "there is no school UI either"). The mockup is specific about what
 * belongs here and it is more than a record: the GPA as a RING, the
 * moment happening this week shown ON THE TAB rather than only as a
 * popup, a forecast of where the record is heading, and the three things
 * a student can actually do about it.
 *
 * Reads engine state and the engine's own bars. It decides nothing.
 */

import { useState } from 'react'
import type { JSX } from 'react'
import {
  SPORT_RULES,
  positionsFor,
  athleteOf,
  GRADUATE_ADMISSION,
  MERIT_ATTAINMENT,
  accountsOf,
  decodeSchoolMoment,
  dropOutBar,
  enrolmentBar,
  majorById,
  schoolMomentById,
  schoolSituationOf,
  smartsOf,
  wellbeingOf,
} from '@life-engine/engine'
import type { Person, World } from '@life-engine/engine'
import type { Money } from '@life-engine/shared'
import { ROTC_TERMS, rotcBar } from '@life-engine/engine'
import { formatMoney } from '@life-engine/shared'
import type { VerbRequest } from './engine.worker.js'

const LEVEL_WORDS: Record<string, string> = {
  none: 'no schooling',
  primary: 'elementary school',
  middle: 'middle school',
  secondary: 'high school',
  trade: 'trade school',
  college: 'university',
  graduate: 'graduate school',
}

const FUNDING_WORDS: Record<string, string> = {
  self: 'paying their own way',
  merit: 'on a merit scholarship',
  need: 'on need-based assistance',
  rotc: 'on ROTC — a commission owed',
  'gi-bill': 'on the GI Bill',
}

/** Presentation only; the store stays 0-1000 integer. */
function gpaOf(attainment: number): { figure: string; letter: string } {
  const clamped = Math.max(0, Math.min(1000, attainment))
  const points = Math.round((clamped * 40) / 1000) / 10
  const letter =
    points >= 3.5 ? 'A' : points >= 2.5 ? 'B' : points >= 1.5 ? 'C' : points >= 1 ? 'D' : 'F'
  return { figure: points.toFixed(1), letter }
}

/**
 * "Junior year" — which year of the course they are in.
 *
 * The mockup names the year, and a year is something a student knows
 * about themselves. Derived from how far through the enrolment they are
 * rather than stored, because it is a fact about two ticks.
 */
function yearWords(world: World, from: number | null, to: number | null): string | null {
  if (from === null || to === null || to <= from) return null
  const done = Math.max(0, world.tick - from)
  const years = Math.max(1, Math.round((to - from) / 12))
  const year = Math.min(years, Math.floor(done / 12) + 1)
  const names = ['freshman', 'sophomore', 'junior', 'senior']
  return years === 4 ? `${names[year - 1] ?? 'senior'} year` : `year ${String(year)} of ${String(years)}`
}

export function School({
  world,
  person,
  busy,
  onAct,
}: {
  readonly world: World
  readonly person: Person
  readonly busy: boolean
  readonly onAct: (action: VerbRequest) => void
}): JSX.Element {
  const [picking, setPicking] = useState(false)
  const athlete = athleteOf(world, person.id)
  const record = world.education.get(person.id)
  if (record === undefined) return <p className="muted">No school record.</p>

  const age = Math.floor((world.tick - person.birthTick) / 12)
  const report = gpaOf(record.attainment)
  const field = majorById(record.major)
  const loan = accountsOf(world, person.id).loans.find((l) => l.kind === 'student')
  const enrolBar = enrolmentBar(world, person, world.tick)
  const leaveBar = dropOutBar(world, person.id)
  const year = yearWords(world, record.enrolledAtTick, record.completesAtTick)
  // The street they live on names the school. Guarded rather than coerced:
  // a person between households has no placeId and the town's name is the
  // honest fallback.
  const household = person.householdId === null ? undefined : world.households.get(person.householdId)
  const place = household === undefined ? undefined : world.places.get(household.placeId)

  /**
   * WHICH KIND OF SCHOOL THIS IS (owner, playing: "i'm in college now and
   * it literally just showing the UI for high school").
   *
   * The tab was built to `highschool_tab.html` and then shown at every
   * level, so an undergraduate read "Public school", "junior year",
   * "College admission odds" and a note about their parents' choice of
   * primary school. Every one of those is a fact about a childhood.
   *
   * A university is not a school with a different name: nobody is
   * privately or state schooled there, the year is a year of a COURSE,
   * what is ahead is graduate work rather than admission, and the money
   * is the story instead of a footnote.
   */
  const at = record.enrolledIn ?? record.level
  const higher = at === 'college' || at === 'trade' || at === 'graduate'

  /**
   * SCHOOL IS OVER FOR MOST ADULTS (playtest, Jack Baldwin: "clicking
   * School at age 55 rendered... '2.0 GPA — C average · high school,'
   * complete with 'College admission odds: Narrow'... and 'Study / Join a
   * team' action buttons").
   *
   * `at` falls back from what they are enrolled in to what they ATTAINED,
   * and nothing ever asked whether they were enrolled at all — so a
   * fifty-five-year-old veteran was shown his teenage report card as if it
   * were live, admission odds for a college he was never going to sit, and
   * a button to join a school team. Stale childhood state, never re-gated
   * by age: exactly what the review called it.
   *
   * An adult out of school gets a TRANSCRIPT — what they finished, what it
   * was like, the loan if it still follows them — and the door to go back
   * (night school is a real path; the enrol bar decides, not the age).
   */
  const levelWords = (l: string): string => l === 'college' ? 'College' : l === 'graduate' ? 'Graduate school' : l === 'trade' ? 'Trade school' : l === 'highschool' ? 'High school' : l === 'primary' ? 'Primary school' : l.charAt(0).toUpperCase() + l.slice(1)
  if (record.enrolledIn === null && age >= 19) {
    const attained =
      record.level === 'none'
        ? 'No schooling on record'
        : record.level === 'college' || record.level === 'graduate'
          ? `${levelWords(record.level)} — ${field?.title ?? 'no major on file'}`
          : levelWords(record.level)
    return (
      <div className="school">
        <div className="school-head">
          <div className="k">Education</div>
          <div className="school-title">{attained}</div>
          <div className="muted small">
            Finished. The record stands — a {report.figure} GPA, {report.letter} average.
          </div>
        </div>
        {loan !== undefined && (
          <section className="school-card">
            <h3>Student loan</h3>
            <p>
              {formatMoney(loan.balance)} still owed.{' '}
              {loan.balance > 0 ? 'This one is not cleared by bankruptcy.' : ''}
            </p>
          </section>
        )}
        {enrolBar === null ? (
          <section className="school-card">
            <h3>Going back</h3>
            <p className="muted small">
              The door is open — a course fits around a working life, and the money is the story.
            </p>
            <div className="verb-row">
              <button
                type="button"
                className="apply primary"
                disabled={busy}
                onClick={() => onAct({ verb: 're-enrol', level: 'college' })}
              >
                University
              </button>
              <button
                type="button"
                className="apply"
                disabled={busy}
                onClick={() => onAct({ verb: 're-enrol', level: 'trade' })}
              >
                Trade school
              </button>
            </div>
          </section>
        ) : (
          <p className="muted small">{enrolBar}</p>
        )}
      </div>
    )
  }

  const smarts = smartsOf(world, person.id)
  const wellbeing = wellbeingOf(world, person.id)
  const studying = (world.habits.get(person.id)?.active ?? []).some((h) => h.kind === 'study')
  const social = (world.habits.get(person.id)?.active ?? []).some((h) => h.kind === 'social')

  // The moment happening THIS WEEK, shown on the tab as the mockup does.
  const pending = world.player.pending
  const liveMoment =
    pending?.kind === 'school-moment' && pending.personId === person.id
      ? schoolMomentById(decodeSchoolMoment(pending.occupationId).momentId)
      : undefined
  const variant =
    pending?.kind === 'school-moment' ? decodeSchoolMoment(pending.occupationId).variant : 0

  // The ring. 0-1000 mapped onto a circumference, drawn not stored.
  const RADIUS = 29
  const CIRC = Math.round(2 * 3.14159 * RADIUS)
  const filled = Math.round((Math.max(0, Math.min(1000, record.attainment)) * CIRC) / 1000)

  return (
    <div className="school">
      {/* THE SPORTS PICKER, where the player already is rather than on a
          tab they have not opened. Same verb the Sports tab fires — one
          way to try out, reachable from two places. */}
      {picking && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="Join a team">
          <div className="sheet">
            <h3>Try out for a team</h3>
            <p className="muted small">
              Most people who try out are cut. Pick a sport and a position — what you train and what
              a scout reads both depend on it.
            </p>
            {SPORT_RULES.map((rules) => (
              <section key={rules.sport} className="sp-sport">
                <div className="sp-sport-hd">
                  <span className="nm">{rules.title}</span>
                  <span className="sub">
                    {rules.draftPicks === 0
                      ? rules.proRoute
                      : `turns pro at ${String(rules.proAge)}`}
                  </span>
                </div>
                <div className="sp-positions">
                  {positionsFor(rules.sport).map((position) => (
                    <button
                      key={position.id}
                      type="button"
                      className="apply"
                      disabled={busy}
                      onClick={() => {
                        onAct({ verb: 'try-out', sport: rules.sport, positionId: position.id })
                        setPicking(false)
                      }}
                    >
                      {position.short}
                    </button>
                  ))}
                </div>
              </section>
            ))}
            <div className="sheet-actions">
              <button type="button" onClick={() => setPicking(false)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="school-hd">
        <div className="school-k">Education · Age {age}</div>
        <div className="school-name">
          {higher
            ? at === 'trade'
              ? 'The trade school'
              : at === 'graduate'
                ? 'Graduate school'
                : 'The university'
            : `${place?.name ?? 'the town'} school`}
        </div>
        <div className="school-sub">
          {higher ? (
            <>
              {field === undefined ? 'Field not yet chosen' : `Reading ${field.title}`}
              {year !== null && ` · ${year}`}
            </>
          ) : (
            <>
              {record.schooling === 'private' ? 'Private school' : 'Public school'}
              {year !== null && ` · ${year}`}
            </>
          )}
        </div>
      </div>

      <section className="school-card school-top">
        <div className="school-gpa">
          <svg viewBox="0 0 72 72" role="img" aria-label="Grade average">
            <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="7" />
            <circle
              cx="36"
              cy="36"
              r={RADIUS}
              fill="none"
              stroke="var(--purple)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${String(filled)} ${String(CIRC)}`}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <span className="school-gpa-n">
            <b className="tabular">{report.figure}</b>
            <s>GPA</s>
          </span>
        </div>
        <div className="school-info">
          <div className="yr">{year ?? LEVEL_WORDS[record.enrolledIn ?? record.level]}</div>
          <div className="tr">
            {report.letter} average · {LEVEL_WORDS[at] ?? at}
          </div>
          {record.attainment >= MERIT_ATTAINMENT && <span className="school-chip">{higher ? 'With distinction' : 'Honors track'}</span>}
        </div>
      </section>

      {liveMoment !== undefined && (
        <section className="school-card">
          <h3>This week at school</h3>
          <p className="school-scene">{schoolSituationOf(liveMoment, variant)}</p>
          <div className="school-opts">
            {liveMoment.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="school-opt"
                disabled={busy}
                onClick={() => onAct({ verb: 'answer', choice: option.id } as never)}
              >
                <span className="h">{option.title}</span>
                <span className="tag">{option.tag}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="school-card">
        <h3>Where this is heading</h3>
        {higher ? (
          <>
            {at === 'college' && (
              <div className="school-row">
                <span className="l">Graduate school</span>
                <span className={record.attainment >= GRADUATE_ADMISSION ? 'v good' : 'v warn'}>
                  {record.attainment >= GRADUATE_ADMISSION
                    ? 'Within reach'
                    : 'Wants a stronger record'}
                </span>
              </div>
            )}
            <div className="school-row">
              <span className="l">What it is costing</span>
              <span className={loan === undefined ? 'v good' : 'v warn'}>
                {loan === undefined
                  ? record.funding === undefined || record.funding === 'self'
                    ? 'Paid as you go'
                    : 'Covered'
                  : formatMoney(loan.balance as Money)}
              </span>
            </div>
            <div className="school-row">
              <span className="l">Careers it opens</span>
              <span className="v">
                {field === undefined ? 'pick a field' : `work wanting ${field.title}`}
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="school-row">
              <span className="l">College admission odds</span>
              <span
                className={
                  record.attainment >= 700 ? 'v good' : record.attainment >= 520 ? 'v' : 'v warn'
                }
              >
                {record.attainment >= 700 ? 'Strong' : record.attainment >= 520 ? 'Fair' : 'Narrow'}
              </span>
            </div>
            <div className="school-row">
              <span className="l">Merit scholarship</span>
              <span className={record.attainment >= MERIT_ATTAINMENT ? 'v good' : 'v warn'}>
                {record.attainment >= MERIT_ATTAINMENT
                  ? 'On track'
                  : record.attainment >= MERIT_ATTAINMENT - 120
                    ? 'Within reach'
                    : 'Out of reach'}
              </span>
            </div>
          </>
        )}
        <div className="school-row">
          <span className="l">Smarts</span>
          <span className={smarts >= 650 ? 'v good' : 'v'}>
            {smarts >= 650 ? 'rising' : smarts >= 450 ? 'steady' : 'behind'}
          </span>
        </div>
        <div className="school-row">
          <span className="l">Wellbeing</span>
          <span className={wellbeing >= 650 ? 'v good' : 'v warn'}>
            {wellbeing >= 650 ? 'good' : wellbeing >= 450 ? 'a little frayed' : 'struggling'}
          </span>
        </div>
      </section>

      <section className="school-card">
        <h3>What you do about it</h3>
        <div className="school-acts">
          <button
            type="button"
            className={studying ? 'school-act on' : 'school-act'}
            disabled={busy}
            onClick={() => onAct({ verb: 'habit', kind: 'study', keep: !studying })}
          >
            <span className="ic">📖</span>
            {studying ? 'Studying' : 'Study'}
          </button>
          {/* JOIN A CLUB MEANS JOIN A TEAM (owner, playing: "when you click
              join a club it should prompt you with the sports popup to pick
              which sports you want to do").

              He is right and this button was lying. It was the SOCIAL
              HABIT toggle wearing a football icon — clicking it made you
              see more of your friends and had nothing whatever to do with
              sport, while the actual tryout sat on a different tab a
              player had no reason to look at. */}
          <button
            type="button"
            className={athlete === undefined ? 'school-act' : 'school-act on'}
            disabled={busy}
            onClick={() => setPicking(athlete === undefined)}
          >
            <span className="ic">🏈</span>
            {athlete === undefined ? 'Join a team' : 'On a team'}
          </button>
          <button
            type="button"
            className={social ? 'school-act on' : 'school-act'}
            disabled={busy}
            onClick={() => onAct({ verb: 'habit', kind: 'social', keep: !social })}
          >
            <span className="ic">🎭</span>
            {social ? 'Seeing people' : 'See people'}
          </button>
        </div>
        <p className="note small">
          {higher ? (
            <>
              Your marks here are built out of diligence, curiosity and choices like these — and
              they decide what comes after, not what came before.
            </>
          ) : (
            <>
              Your GPA has been building since elementary out of diligence, curiosity and choices
              like these. It is what decides your options at eighteen.
              {record.schooling !== undefined &&
                ` ${record.schooling === 'private' ? 'Private' : 'Public'} school here was your parents' call, set by what they could afford.`}
            </>
          )}
        </p>
      </section>

      {loan !== undefined && (
        <section className="school-card">
          <h3>What it cost</h3>
          <dl className="facts">
            <dt>Student debt</dt>
            <dd>
              <b className="tabular">{formatMoney(loan.balance as Money)}</b>
              <span className="muted small"> · {formatMoney(loan.monthlyPayment as Money)}/mo</span>
            </dd>
            {record.funding !== undefined && (
              <>
                <dt>Paying</dt>
                <dd>{FUNDING_WORDS[record.funding] ?? record.funding}</dd>
              </>
            )}
          </dl>
          {/**
            * THE ROTC BARGAIN, OFFERED RATHER THAN IMPOSED.
            *
            * OWNER: "when I joined college it automatically made me do rotc no
            * option this shouldnt be the way there should be a little button
            * that says join ROTC in the education tab to where you click it
            * and it tells you what that entails."
            *
            * He was right on both counts. A die roll was committing his
            * character to four years in uniform without a word — `fundingFor`
            * no longer rolls for the player at all — and the answer is an
            * offer with the terms stated BEFORE the pen, not silence.
            *
            * The bar pattern: this button appears only when `rotcBar` says the
            * door is open, so a button that is offered always works. When it
            * is shut, the reason is shown instead of a dead control.
            */}
          {(() => {
            const bar = rotcBar(world, person.id)
            const offered = record.enrolledIn === 'college'
            if (!offered) return null
            return (
              <div className="rotc-offer">
                <h4>The service will pay for this</h4>
                <p className="muted small">{ROTC_TERMS}</p>
                {bar === null ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAct({ verb: 'join-rotc' } as never)}
                  >
                    Sign for ROTC
                  </button>
                ) : (
                  <p className="muted small">{bar}</p>
                )}
              </div>
            )
          })()}
          <p className="muted small">
            {record.enrolledIn === null
              ? 'Repaying. This one is not cleared by bankruptcy.'
              : 'Payments wait until the course ends. Interest does not.'}
          </p>
        </section>
      )}

      {enrolBar === null && (
        <section className="school-card">
          <h3>Going further</h3>
          <div className="verb-row">
            <button
              type="button"
              className="apply primary"
              disabled={busy}
              onClick={() => onAct({ verb: 're-enrol', level: 'college' })}
            >
              University
            </button>
            <button
              type="button"
              className="apply"
              disabled={busy}
              onClick={() => onAct({ verb: 're-enrol', level: 'trade' })}
            >
              Trade school
            </button>
          </div>
        </section>
      )}

      {leaveBar === null && (
        <section className="school-card">
          <h3>Leaving</h3>
          <p className="muted small">
            No qualification, and the fees already run up still stand. You can come back — the
            level you hold is yours.
          </p>
          <button
            type="button"
            className="apply"
            disabled={busy}
            onClick={() => onAct({ verb: 'drop-out' })}
          >
            Leave the course
          </button>
        </section>
      )}
    </div>
  )
}
