/**
 * THE INTERVIEW (M-CAREER §4).
 *
 * Applying for a job used to be one hidden roll: you pressed a button and
 * the town either wanted you or did not. The military career has a whole
 * ceremony around joining — the recruiter, the oath, the contract on paper
 * — and civilian work had a coin flip.
 *
 * So there is a room now, and how you sit in it moves the odds. Three
 * approaches, and none of them is simply better: leaning on what you have
 * done wins the job you are ready for and loses the one you are reaching
 * for; being straight about the gap is the honest middle; and wanting it
 * visibly works on somebody who is hiring for keenness and reads badly to
 * somebody hiring for competence.
 *
 * THE SCENE-TEXT RULE applies here as it does to a crime and a work
 * moment: every line is authored for this moment and picked from a seeded
 * pool. Nothing generic, nothing generated.
 *
 * Pure content and pure arithmetic.
 */

/** How you play the room. */
export type InterviewApproach = 'sell' | 'straight' | 'keen'

export const INTERVIEW_APPROACHES: readonly InterviewApproach[] = ['sell', 'straight', 'keen']

export interface InterviewOption {
  readonly id: InterviewApproach
  readonly title: string
  readonly tag: string
  readonly detail: string
}

export const INTERVIEW_OPTIONS: readonly [InterviewOption, InterviewOption, InterviewOption] = [
  {
    id: 'sell',
    title: 'Sell what you have done',
    tag: 'strong hand',
    detail: 'Lead on the record. It carries a job you are ready for and thins out over a reach.',
  },
  {
    id: 'straight',
    title: 'Be straight about the gap',
    tag: 'honest',
    detail: 'Say what you can do and what you cannot. It rarely wins the room and rarely loses it.',
  },
  {
    id: 'keen',
    title: 'Show them you want it',
    tag: 'a gamble',
    detail: 'Keenness carries a stretch and reads thin to somebody hiring for experience.',
  },
]

/** The room, before you have said anything. */
export const INTERVIEW_SITUATIONS: readonly string[] = [
  'Two of them behind a desk, a folder with your name on it, and forty minutes.',
  'It is a small room and a short conversation, and the man asking the questions has read your file twice.',
  'They keep you waiting eleven minutes and then are perfectly pleasant for half an hour.',
]

export interface InterviewOutcome {
  readonly title: string
  readonly text: string
  readonly foot: string
}

/** Six slots: each approach, and whether the room went for it. */
const OUTCOMES: Readonly<
  Record<InterviewApproach, { readonly good: readonly InterviewOutcome[]; readonly bad: readonly InterviewOutcome[] }>
> = {
  sell: {
    good: [
      {
        title: 'They were convinced',
        text: 'You take them through the work you have actually done and let it speak, and by the end they are asking when you could start.',
        foot: 'The record did it.',
      },
      {
        title: 'It carried the room',
        text: 'Twenty minutes of what you have done and one honest answer about what you have not, and the older of the two stops taking notes and just listens.',
        foot: 'They have seen enough.',
      },
    ],
    bad: [
      {
        title: 'It was the wrong room for it',
        text: 'You lead on the record and they keep coming back to the one thing on it you have never done.',
        foot: 'The gap was the whole conversation.',
      },
    ],
  },
  straight: {
    good: [
      {
        title: 'They liked that you said it',
        text: 'You tell them plainly which half of the job you have done before. Nobody in the room pretends otherwise, and it goes well for exactly that reason.',
        foot: 'Honest, and it counted.',
      },
    ],
    bad: [
      {
        title: 'They wanted more than that',
        text: 'You are straight with them and they are perfectly polite about it, and somebody else is less straight and gets the job.',
        foot: 'Honest, and it did not.',
      },
    ],
  },
  keen: {
    good: [
      {
        title: 'They wanted somebody hungry',
        text: 'You make it obvious you want it, and it turns out that is precisely what they were short of.',
        foot: 'Keenness, in a room that was buying it.',
      },
    ],
    bad: [
      {
        title: 'It read thin',
        text: 'You are keen at them for half an hour, and the woman on the left writes one short thing down near the beginning and nothing after it.',
        foot: 'They were hiring for the years, not the appetite.',
      },
    ],
  },
}

/**
 * What an approach is worth, in per-mille added to the base odds.
 *
 * `stretch` is whether this job is a genuine reach — a rung above what they
 * have done, or a big step up in money. It is what makes the three
 * approaches trade places rather than one of them simply being best.
 */
export function approachBonus(approach: InterviewApproach, stretch: boolean): number {
  if (approach === 'sell') return stretch ? -60 : 170
  if (approach === 'keen') return stretch ? 140 : -70
  return 40
}

export function interviewOutcomeOf(
  approach: InterviewApproach,
  hired: boolean,
  variant: number,
): InterviewOutcome | undefined {
  const pool = hired ? OUTCOMES[approach].good : OUTCOMES[approach].bad
  if (pool.length === 0) return undefined
  return pool[Math.abs(variant) % pool.length]
}

export function interviewSituation(variant: number): string {
  return INTERVIEW_SITUATIONS[Math.abs(variant) % INTERVIEW_SITUATIONS.length] ?? ''
}

/** "clerk:412" — the job being interviewed for, and the wording. */
export function encodeInterview(occupationId: string, variant: number): string {
  return `${occupationId}:${String(variant)}`
}

export function decodeInterview(encoded: string | null): {
  occupationId: string
  variant: number
} {
  const parts = (encoded ?? '').split(':')
  const variant = Number.parseInt(parts[1] ?? '0', 10)
  return { occupationId: parts[0] ?? '', variant: Number.isFinite(variant) ? variant : 0 }
}
