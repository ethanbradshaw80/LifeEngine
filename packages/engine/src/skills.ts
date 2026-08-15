/**
 * WHAT A PERSON IS ACTUALLY GOOD AT (owner's `JOBS_CAREERS.md`, 2026-08-14).
 *
 * The jobs spec gates every promotion in all seventy-five paths on skills —
 * "Leadership (4), Business Management (3)" — and the engine had nothing of
 * the kind. A career was one number, `performance`, drifting on diligence,
 * which meant a chef and a cybersecurity analyst climbed by exactly the same
 * arithmetic and the only difference between them was the words on the
 * screen.
 *
 * A SKILL IS WHAT THE WORK LEFT BEHIND. You do not choose them and you
 * cannot buy them: they come from the months you spent doing something, at
 * the rate that work teaches. Ten years behind a bar leaves Customer Service
 * where ten years of welding leaves Technical Knowledge, and when the
 * welder applies to manage the bar, the register says what he can and cannot
 * do. That is the whole point of them — they make a CAREER a history rather
 * than a number, and they make changing trades cost something real.
 *
 * OWNER'S RULING (2026-08-14): the full system, for the whole town, not the
 * player alone. Every person is the main character of their own life
 * (Law 2), and a promotion rule that binds only the player is a penalty
 * wearing a rule's clothes.
 *
 * STORED IN THOUSANDTHS. Levels run 0-5 in the spec and grow by fractions
 * of a level a month — 0.5, 1.2 — which is exactly the arithmetic integer
 * money was invented to avoid. A skill is 0..5000 here; level 3 is 3000.
 *
 * Pure content and arithmetic. `systems.ts` owns employment and grows these
 * from the work; nothing else writes them.
 */

/**
 * THE EIGHTEEN, taken from the owner's own tables rather than invented.
 *
 * Extracted from every "Key Skills" gate and every "Skill Growth" line in
 * `JOBS_CAREERS.md` — the two places the spec actually names a skill. Words
 * that appear only in job TITLES ("Operations Director", "Security
 * Analyst", "Technical Writing") are deliberately NOT here: they are the
 * names of jobs, and reading them as skills would have invented five that
 * the spec never asks for.
 */
export type SkillId =
  | 'accounting'
  | 'attention-to-detail'
  | 'business-management'
  | 'communication'
  | 'creativity'
  | 'customer-service'
  | 'data-analysis'
  | 'leadership'
  | 'medical-knowledge'
  | 'negotiation'
  | 'organization'
  | 'physical-work'
  | 'problem-solving'
  | 'programming'
  | 'sales'
  | 'strategic-planning'
  | 'teamwork'
  | 'technical-knowledge'

export interface Skill {
  readonly id: SkillId
  /** What the screen calls it. */
  readonly label: string
  /** One line on what having it means, for the detail panel. */
  readonly blurb: string
}

export const SKILLS: readonly Skill[] = [
  { id: 'accounting', label: 'Accounting', blurb: 'Books that balance, and knowing when they do not.' },
  { id: 'attention-to-detail', label: 'Attention to Detail', blurb: 'Catching the thing everybody else read past.' },
  { id: 'business-management', label: 'Business Management', blurb: 'Running the place, not just working in it.' },
  { id: 'communication', label: 'Communication', blurb: 'Making yourself understood, and meaning it.' },
  { id: 'creativity', label: 'Creativity', blurb: 'Coming up with the thing that was not there before.' },
  { id: 'customer-service', label: 'Customer Service', blurb: 'The patience for people on their worst day.' },
  { id: 'data-analysis', label: 'Data Analysis', blurb: 'Finding what the numbers are actually saying.' },
  { id: 'leadership', label: 'Leadership', blurb: 'People doing it because you asked, not because they must.' },
  { id: 'medical-knowledge', label: 'Medical Knowledge', blurb: 'Bodies, and what goes wrong with them.' },
  { id: 'negotiation', label: 'Negotiation', blurb: 'Leaving the room with more than you walked in with.' },
  { id: 'organization', label: 'Organization', blurb: 'Keeping a hundred moving things where they belong.' },
  { id: 'physical-work', label: 'Physical Work', blurb: 'A body that can do a day of it and come back tomorrow.' },
  { id: 'problem-solving', label: 'Problem Solving', blurb: 'Working out the thing nobody has a procedure for.' },
  { id: 'programming', label: 'Programming', blurb: 'Making a machine do what it was not doing before.' },
  { id: 'sales', label: 'Sales', blurb: 'Closing, which is a different craft from talking.' },
  { id: 'strategic-planning', label: 'Strategic Planning', blurb: 'Seeing three years out and acting on it.' },
  { id: 'teamwork', label: 'Teamwork', blurb: 'Being the one people want beside them.' },
  { id: 'technical-knowledge', label: 'Technical Knowledge', blurb: 'How the thing works, down to the parts.' },
]

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((skill) => skill.id === id)
}

/** A full level, in thousandths. Level 5 — the spec's ceiling — is 5000. */
export const SKILL_LEVEL = 1000
export const SKILL_MAX = 5 * SKILL_LEVEL

/** What somebody holds. Absent means never worked at it, which is zero. */
export type SkillSheet = Readonly<Partial<Record<SkillId, number>>>

/** What they have of one skill, in thousandths. */
export function skillOf(sheet: SkillSheet | undefined, id: SkillId): number {
  return sheet?.[id] ?? 0
}

/** The whole level, 0-5, the way the spec and the screen both talk. */
export function levelOf(sheet: SkillSheet | undefined, id: SkillId): number {
  return Math.floor(skillOf(sheet, id) / SKILL_LEVEL)
}

/** What a job asks for before it will have you. */
export interface SkillGate {
  readonly skill: SkillId
  /** A whole level, 1-5, exactly as the owner's tables write it. */
  readonly level: number
}

/** Every gate this sheet fails, in the spec's own order. Empty means in. */
export function gatesFailed(
  sheet: SkillSheet | undefined,
  gates: readonly SkillGate[],
): readonly SkillGate[] {
  return gates.filter((gate) => levelOf(sheet, gate.skill) < gate.level)
}

export function meetsGates(sheet: SkillSheet | undefined, gates: readonly SkillGate[]): boolean {
  return gatesFailed(sheet, gates).length === 0
}

/** What a month of this work teaches, per the path's own table. */
export interface SkillGrowth {
  readonly skill: SkillId
  /**
   * Levels per month in thousandths — the spec's "0.5" is 500.
   *
   * Written in thousandths rather than as a decimal for the same reason
   * money is in cents: a rate of 0.7 applied a thousand times over a long
   * life must not drift, and floating point drifts.
   */
  readonly perMonth: number
}

/**
 * A MONTH AT THE WORK.
 *
 * Returns a new sheet; nothing is mutated. Capped at the ceiling, because a
 * skill that grew for ever would make the gates meaningless after a decade
 * and every long career identical.
 *
 * THE ONE SUBTLETY: growth SLOWS as the skill approaches the top. The
 * spec's raw rates take a skill from nothing to mastery in well under a
 * year, which would make every gate in all seventy-five paths a formality
 * that the experience requirement alone actually enforced. The last level
 * costs roughly four times what the first did, so a master really is
 * somebody who stayed — which is what the tables are trying to say.
 */
export function afterAMonth(sheet: SkillSheet, growth: readonly SkillGrowth[]): SkillSheet {
  if (growth.length === 0) return sheet
  const next: Partial<Record<SkillId, number>> = { ...sheet }
  for (const { skill, perMonth } of growth) {
    if (perMonth <= 0) continue
    const held = next[skill] ?? 0
    if (held >= SKILL_MAX) continue
    next[skill] = Math.min(SKILL_MAX, held + earnedThisMonth(held, perMonth))
  }
  return next
}

/**
 * WHAT A MONTH ADDS AT THIS STANDING, in thousandths.
 *
 * Full rate for the first level, then sharply less: the fifth level of
 * anything is the better part of a decade, not ten months.
 *
 * THE CURVE WAS MEASURED, NOT GUESSED. A gentler first attempt reached
 * mastery in 23 months at a middling rate, which still left every skill
 * gate in the spec a formality. At these figures a middling rate (0.5)
 * reaches "capable" in about eighteen months and mastery in roughly eight
 * years, a specialist's headline skill (1.2) masters in about three and a
 * half, and a slow one (0.3) takes thirteen. That spread is the point: the
 * experience gate binds on the middle rungs and the SKILL gate binds at the
 * top, so the two constraints do different work.
 *
 * Integer division throughout, and a floor of one so a rate that rounds to
 * nothing still moves — a skill that can never advance is worse than none.
 */
export function earnedThisMonth(held: number, perMonth: number): number {
  const level = Math.floor(held / SKILL_LEVEL)
  const slowing = level === 0 ? 1000 : level === 1 ? 400 : level === 2 ? 180 : level === 3 ? 80 : 40
  return Math.max(1, Math.floor((perMonth * slowing) / 1000))
}

/** How they read on a screen: a word for a level, rather than a bare number. */
export function standingOf(level: number): string {
  if (level >= 5) return 'expert'
  if (level >= 4) return 'strong'
  if (level >= 3) return 'capable'
  if (level >= 2) return 'competent'
  if (level >= 1) return 'novice'
  return 'none'
}

/**
 * EVERYTHING THEY HAVE, sorted for a screen: best first, and never the
 * eighteen zeroes of somebody who has not worked yet.
 */
export function heldSkills(
  sheet: SkillSheet | undefined,
): readonly { readonly skill: Skill; readonly thousandths: number; readonly level: number }[] {
  if (sheet === undefined) return []
  return SKILLS.filter((skill) => (sheet[skill.id] ?? 0) > 0)
    .map((skill) => ({
      skill,
      thousandths: sheet[skill.id] ?? 0,
      level: Math.floor((sheet[skill.id] ?? 0) / SKILL_LEVEL),
    }))
    .sort((a, b) => b.thousandths - a.thousandths || (a.skill.id < b.skill.id ? -1 : 1))
}
