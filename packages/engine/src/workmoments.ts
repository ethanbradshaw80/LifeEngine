/**
 * THE MOMENTS A JOB IS ACTUALLY MADE OF (M-CAREER §3).
 *
 * A career was a wage and a review. The military career next to it has the
 * firefight, the field exercise, the moment the squad is pinned — the things
 * that make a service record a story rather than a payroll line. This is
 * the civilian equivalent: the account nobody wants to run, the mistake
 * nobody saw, the offer from across town, the corner the boss wants cut.
 *
 * THE RAILS ARE THE COMBAT SCENE'S, deliberately: three answers, one of
 * them the reaching one, one the measured one, one the safe one. What is
 * NOT shared is the copy. The owner's rule, from the crime scenes:
 *
 *   every situation line, option label and outcome line is selected from
 *   the real context — never a shared hardcoded string
 *
 * So each moment below carries its own situation, its own three options and
 * its own six outcomes (three answers × well or badly). "Take the lead / Do
 * your part / Pass" belongs to the big assignment and appears nowhere else;
 * the mistake has "Own it / Quietly fix it / Let it slide" and nothing of
 * the assignment's language anywhere in it.
 *
 * Every slot is a POOL, picked by seed, so wording varies between runs
 * without a fact ever mismatching. Nothing is generated.
 *
 * Pure content and pure arithmetic. employment moves the numbers.
 */

import type { Money } from '@life-engine/shared'

/**
 * The three rails. Their WORDS are per-moment; these are the ids that
 * travel on a pending and in a save.
 */
export type WorkChoice = 'lead' | 'steady' | 'pass'

export const WORK_CHOICES: readonly WorkChoice[] = ['lead', 'steady', 'pass']

/** How a moment turned out. The reaching answer is the one that can fail. */
export type WorkResult = 'good' | 'bad'

export interface WorkOption {
  readonly id: WorkChoice
  readonly title: string
  /** "high risk / high reward", "steady", "safe" — the tag on the button. */
  readonly tag: string
  readonly detail: string
}

export interface WorkOutcome {
  readonly title: string
  readonly text: string
  /** The line under it: what it did to the file. */
  readonly foot: string
  /** Performance, -1000..1000. */
  readonly performance: number
  /** A raise, in per-mille of current pay. Zero on most. */
  readonly payPerMille: number
}

export interface WorkMoment {
  readonly id: string
  /** "The Big Assignment" — the card's own name. */
  readonly title: string
  /** The situation, as pools. */
  readonly situation: readonly string[]
  readonly options: readonly [WorkOption, WorkOption, WorkOption]
  /** Six slots: each answer, well or badly. Pools, picked by seed. */
  readonly outcomes: Readonly<Record<WorkChoice, Readonly<Record<WorkResult, readonly WorkOutcome[]>>>>
  /**
   * How likely the reaching answer is to come off, per thousand, before the
   * person's own performance is weighed in. Some moments are winnable and
   * some are mostly a gamble.
   */
  readonly leadChance: number
  /** Only offered at or above this rung. Ethics forks live high up. */
  readonly minRung?: number
}

// ---------------------------------------------------------------------------
// The moments. One authored set each — no line is shared between two.
// ---------------------------------------------------------------------------

const BIG_ASSIGNMENT: WorkMoment = {
  id: 'big-assignment',
  title: 'The Big Assignment',
  leadChance: 520,
  situation: [
    'The biggest account the office has landed in years needs somebody to run it, and your manager is asking the room who wants it. Long nights, and the whole floor watching.',
    'There is a job on the board that will either make somebody or bury them, and nobody has put their name against it yet.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Take the lead',
      tag: 'high risk / high reward',
      detail: 'Own it. Land it and you are the obvious next name — miss and it is on you.',
    },
    {
      id: 'steady',
      title: 'Do your part',
      tag: 'steady',
      detail: 'Carry your piece of it well without staking your name on the whole thing.',
    },
    {
      id: 'pass',
      title: 'Pass',
      tag: 'safe',
      detail: 'Not this one. Keep your head down and your hours normal.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You landed it',
          text: 'Six brutal weeks, and it signs. Your manager says your name to the director without you in the room.',
          foot: 'They will remember whose account it was.',
          performance: 120,
          payPerMille: 0,
        },
        {
          title: 'It came off',
          text: 'You ran it end to end and it closed a fortnight early, which nobody in the building expected including you.',
          foot: 'First in line, next time there is a line.',
          performance: 110,
          payPerMille: 20,
        },
      ],
      bad: [
        {
          title: 'It slipped',
          text: 'You reached and it did not close. Nobody says it was your fault; everybody knows whose account it was.',
          foot: 'The promotion cools off — but they remember you tried.',
          performance: -80,
          payPerMille: 0,
        },
        {
          title: 'It came apart',
          text: 'It went wrong in the last fortnight, in a way that was probably nobody’s fault and was definitely on your desk.',
          foot: 'A year of being the person that happened to.',
          performance: -95,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Solid work',
          text: 'You carried your piece well and went home at a decent hour. No glory, no scar.',
          foot: 'Steady as she goes.',
          performance: 35,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Lost in it',
          text: 'Your part went fine and disappeared into somebody else’s win.',
          foot: 'Nobody is going to mention it again.',
          performance: 8,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You sat it out',
          text: 'Somebody else took the account, and worked every weekend of the spring for it.',
          foot: 'You were home. The floor noticed you did not reach for it.',
          performance: -18,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Passed over before it started',
          text: 'Somebody else took it and landed it, and is now spoken about the way you used to be.',
          foot: 'Passed-over reads as passed-over.',
          performance: -35,
          payPerMille: 0,
        },
      ],
    },
  },
}

const THE_MISTAKE: WorkMoment = {
  id: 'the-mistake',
  title: 'The Mistake',
  leadChance: 620,
  situation: [
    'You find it at half past four: a figure you signed off six weeks ago that is wrong, and has been wrong ever since.',
    'It is your error, it is a fortnight old, and so far as you can tell not one person has noticed it.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Own it',
      tag: 'costly / clean',
      detail: 'Take it to your manager yourself, this afternoon, before anybody finds it.',
    },
    {
      id: 'steady',
      title: 'Quietly fix it',
      tag: 'measured',
      detail: 'Correct it, say nothing, and hope the correction is the only thing anybody sees.',
    },
    {
      id: 'pass',
      title: 'Let it slide',
      tag: 'risky',
      detail: 'Leave it. It may never surface at all.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'They took it well',
          text: 'You put it on the desk before anybody asked for it. It costs an afternoon and a fortnight of being careful, and that is all it costs.',
          foot: 'People remember who tells them things.',
          performance: 45,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'They took it badly',
          text: 'You told them and they were not grateful for it. Some managers are not.',
          foot: 'Honest, and marked down for it. It happens.',
          performance: -30,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Fixed, and nobody the wiser',
          text: 'The correction goes in with a fortnight of ordinary corrections and never gets a second look.',
          foot: 'Nothing happened. Which is what you wanted.',
          performance: 12,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'The correction was noticed',
          text: 'Somebody reads the amendment, works backwards from it, and understands exactly what it is.',
          foot: 'Not the error. The quiet.',
          performance: -60,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'It never surfaced',
          text: 'The month closes, the file goes into a cabinet, and nobody opens it again.',
          foot: 'You got away with it, which is not the same as it being fine.',
          performance: -5,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It surfaced',
          text: 'It comes out in the spring, in a meeting, in front of people, with your initials on it.',
          foot: 'The error was small. Six weeks of it not being mentioned was not.',
          performance: -120,
          payPerMille: 0,
        },
      ],
    },
  },
}

const ASK_FOR_MORE: WorkMoment = {
  id: 'ask-for-more',
  title: 'Asking for More',
  leadChance: 460,
  situation: [
    'You have been doing the job above yours for most of a year, and nobody has mentioned money.',
    'The review is next week and you know what you are worth, roughly, and it is not what you are being paid.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Name your number',
      tag: 'direct',
      detail: 'Put the figure on the table and say what it is for.',
    },
    {
      id: 'steady',
      title: 'Wait for the review',
      tag: 'patient',
      detail: 'Let the process do it. It is what the process is for.',
    },
    {
      id: 'pass',
      title: 'Say nothing',
      tag: 'safe',
      detail: 'Not this year. There is never a good month for it.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'They said yes',
          text: 'You said the number out loud and did not fill the silence afterwards, and they met most of it.',
          foot: 'Asked, and got.',
          performance: 25,
          payPerMille: 90,
        },
        {
          title: 'They found it',
          text: 'It takes two weeks and a second conversation, and it comes back approved.',
          foot: 'The number moves.',
          performance: 20,
          payPerMille: 70,
        },
      ],
      bad: [
        {
          title: 'They said no',
          text: 'Not this year, they say, and the way they say it makes clear that asking is itself the thing being noted.',
          foot: 'Nothing gained, and a mark against you for wanting it.',
          performance: -40,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'The review found it',
          text: 'It comes through the ordinary channel at the ordinary time, and it is smaller than you would have asked for.',
          foot: 'Less than you wanted, at no cost at all.',
          performance: 10,
          payPerMille: 35,
        },
      ],
      bad: [
        {
          title: 'The review found nothing',
          text: 'The process happens to you for forty minutes and changes nothing.',
          foot: 'A year older on the same money.',
          performance: 0,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You never raised it',
          text: 'You do not bring the number up, and the year passes without the awkwardness.',
          foot: 'Same money. No friction.',
          performance: 0,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Somebody else asked',
          text: 'You find out in the summer what the person doing your job across the corridor is on.',
          foot: 'The gap does not close on its own.',
          performance: -20,
          payPerMille: 0,
        },
      ],
    },
  },
}

const POACHED: WorkMoment = {
  id: 'poached',
  title: 'The Offer',
  leadChance: 560,
  situation: [
    'Somebody from across town rings you at home. They know what you do and roughly what you are paid, and they would like to change the second part.',
    'A competitor has been asking about you. Now one of them is buying you lunch and being very direct about it.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Take it',
      tag: 'a new start',
      detail: 'Hand your notice in. More money, and nobody there knows your worst month.',
    },
    {
      id: 'steady',
      title: 'Use it',
      tag: 'leverage',
      detail: 'Tell your own people about it and see what they find.',
    },
    {
      id: 'pass',
      title: 'Turn it down',
      tag: 'loyal',
      detail: 'You are not for sale this month. Say so and mean it.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You went',
          text: 'Four weeks of notice and a leaving card, and then a desk somewhere that pays better.',
          foot: 'More money. A ladder you are new on.',
          performance: -30,
          payPerMille: 140,
        },
      ],
      bad: [
        {
          title: 'It was not what they said',
          text: 'The job on the other side of the door is not quite the job that was described over lunch.',
          foot: 'More money, and a year finding out what for.',
          performance: -60,
          payPerMille: 90,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'They matched it',
          text: 'You mention it, once, without a threat in it. The counteroffer arrives inside a week.',
          foot: 'The same desk, on the other side’s money.',
          performance: 15,
          payPerMille: 110,
        },
      ],
      bad: [
        {
          title: 'They called it',
          text: '"Then you should probably take it," he says, and goes back to what he was reading.',
          foot: 'Now they know you were looking.',
          performance: -55,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You stayed',
          text: 'You say no on the telephone and do not mention it to anybody at work, which turns out to be the whole trick.',
          foot: 'Nothing changes, and nothing is spoiled.',
          performance: 10,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'You wonder about it',
          text: 'You say no, and think about the number for about eight months.',
          foot: 'Still here. Still on the same money.',
          performance: -10,
          payPerMille: 0,
        },
      ],
    },
  },
}

const CONFLICT: WorkMoment = {
  id: 'conflict',
  title: 'The Argument',
  leadChance: 480,
  situation: [
    'Your manager has decided something that will not work, and has decided it in a way that suggests the decision is finished.',
    'Somebody has taken a piece of your work into a meeting as their own, and it is not the first time.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Go over their head',
      tag: 'high risk',
      detail: 'Take it to the floor above and let it land where it lands.',
    },
    {
      id: 'steady',
      title: 'Push back',
      tag: 'direct',
      detail: 'Say it to their face, once, in private, and leave it there.',
    },
    {
      id: 'pass',
      title: 'Smooth it over',
      tag: 'safe',
      detail: 'Let it go. It is not the hill, and there will be other hills.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'It went your way',
          text: 'The floor above agrees with you, says so in a room, and the decision reverses.',
          foot: 'Right, and known to be right. Also known to have gone round somebody.',
          performance: 65,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It went badly',
          text: 'The floor above backs their own, which is what floors above are for.',
          foot: 'Right about the decision. Wrong about the room.',
          performance: -110,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'They heard it',
          text: 'You say it once, in private, without an audience for either of you. Two days later it quietly changes.',
          foot: 'The thing you wanted, and nobody lost anything doing it.',
          performance: 45,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'They did not',
          text: 'You say it well and they hear none of it, and now there is a coolness that was not there before.',
          foot: 'Said. Not heard.',
          performance: -35,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You let it go',
          text: 'You say nothing and it turns out fine, which happens more often than anybody admits.',
          foot: 'No friction, no credit.',
          performance: 5,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It happened again',
          text: 'You let it go and it becomes the thing that is allowed to happen to you.',
          foot: 'Quiet, and read as quiet.',
          performance: -30,
          payPerMille: 0,
        },
      ],
    },
  },
}

const CRUNCH: WorkMoment = {
  id: 'crunch',
  title: 'The Crunch',
  leadChance: 640,
  situation: [
    'The deadline moved and the work did not, and the whole floor is staying late until it is done.',
    'It is going to be six weeks of evenings, and everybody has been told so in a tone that was not really asking.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Grind it out',
      tag: 'costly',
      detail: 'Every night and both weekend days. It will be noticed.',
    },
    {
      id: 'steady',
      title: 'Do the hours',
      tag: 'balanced',
      detail: 'Stay when it matters and go home when it does not.',
    },
    {
      id: 'pass',
      title: 'Coast it',
      tag: 'safe',
      detail: 'Leave at five. Nobody is going to die over a deadline.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You carried it',
          text: 'It ships, and everybody knows the shape of whose evenings paid for it.',
          foot: 'Well thought of, and very tired.',
          performance: 100,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It emptied you out',
          text: 'It ships, and you are no use to anybody for a month afterwards.',
          foot: 'The work landed. So did the cost of it.',
          performance: 40,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Enough, and no more',
          text: 'You stay the nights that matter and are at your own table for the ones that do not.',
          foot: 'Nothing given away that did not need giving.',
          performance: 30,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Neither one thing nor the other',
          text: 'You stay late enough to be tired and not late enough to be counted.',
          foot: 'The evenings went and the credit did not come.',
          performance: 5,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You went home',
          text: 'Five o’clock, every day, through the whole of it. The work got done by other people.',
          foot: 'Your evenings are your own. So is the reputation.',
          performance: -45,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It was counted',
          text: 'Somebody keeps a list of who was there, and it is not a written list, which is worse.',
          foot: 'Remembered at the next review.',
          performance: -70,
          payPerMille: 0,
        },
      ],
    },
  },
}

const ETHICS: WorkMoment = {
  id: 'ethics',
  title: 'The Corner',
  minRung: 2,
  leadChance: 600,
  situation: [
    'Your manager wants a number to say something it does not currently say, and has explained why in a way that almost works.',
    'There is a way of writing this up that is not lying, exactly, and everybody in the room knows what it is.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Cut it',
      tag: 'they will owe you',
      detail: 'Write it the way they want it written. It is one number.',
    },
    {
      id: 'steady',
      title: 'Find another way',
      tag: 'awkward',
      detail: 'Give them something true that gets most of what they need.',
    },
    {
      id: 'pass',
      title: 'By the book',
      tag: 'safe / costly',
      detail: 'Write it as it is and let them do what they like with it.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'Nobody ever asked',
          text: 'It goes in, it passes, and your manager is warm with you for a year afterwards.',
          foot: 'They owe you one, and you know something about them now.',
          performance: 70,
          payPerMille: 20,
        },
      ],
      bad: [
        {
          title: 'Somebody asked',
          text: 'It is queried in the autumn, by somebody with no reason to be gentle about it, and it is in your hand.',
          foot: 'It was one number. It is your name on it.',
          performance: -140,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'You threaded it',
          text: 'What you give them is true and does most of the job, and they take it because it is easier than arguing.',
          foot: 'Nothing signed that could not be defended.',
          performance: 40,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'They went elsewhere for the rest',
          text: 'They take what you give them and get the remainder from somebody less careful.',
          foot: 'Clean, and out of the room where it was decided.',
          performance: -25,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You wrote it straight',
          text: 'You write what is true, hand it over, and nothing whatever happens.',
          foot: 'Clean hands. A cool fortnight.',
          performance: -15,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It was remembered',
          text: 'Nothing is said about it at the time. It comes back at the review, wearing different words.',
          foot: 'Right, and marked down for it.',
          performance: -55,
          payPerMille: 0,
        },
      ],
    },
  },
}

const MENTOR: WorkMoment = {
  id: 'mentor',
  title: 'The New One',
  leadChance: 700,
  situation: [
    'There is somebody three weeks in who is drowning quietly and has not asked anybody for help.',
    'They have put a junior at the desk beside yours and, so far, given them nothing to do and nobody to ask.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Take them on',
      tag: 'your time',
      detail: 'Make them your problem for six months and turn them into somebody useful.',
    },
    {
      id: 'steady',
      title: 'Answer questions',
      tag: 'measured',
      detail: 'Be the person they can ask, without making it a project.',
    },
    {
      id: 'pass',
      title: 'Your own work',
      tag: 'safe',
      detail: 'You have enough on. Somebody else can do it.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'They turned out well',
          text: 'Six months of your afternoons, and by spring they are good, and everybody knows who taught them.',
          foot: 'Well thought of by people whose opinion carries.',
          performance: 75,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'They left anyway',
          text: 'You put six months into them and they take a job in another town in March.',
          foot: 'The afternoons are gone. So is the junior.',
          performance: -20,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'You were the one they asked',
          text: 'You answer what you are asked and no more, and it turns out to be enough.',
          foot: 'A quiet reputation for being worth asking.',
          performance: 30,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It was not enough',
          text: 'They needed somebody to sit down with them, and what they got was somebody who answered questions.',
          foot: 'No harm. No credit either.',
          performance: 0,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You kept your afternoons',
          text: 'Somebody else picks them up, and your own work is the better for the time.',
          foot: 'Your output is up. Nobody owes you anything.',
          performance: 15,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It was noticed',
          text: 'Nobody says anything about it. It becomes part of what people think you are like.',
          foot: 'Marked, quietly, as the sort who does not.',
          performance: -30,
          payPerMille: 0,
        },
      ],
    },
  },
}

const BACK_TO_SCHOOL: WorkMoment = {
  id: 'back-to-school',
  title: 'Night School',
  leadChance: 580,
  situation: [
    'There is a certificate you could have inside two years, if you gave it two evenings a week and most of your Sundays.',
    'The people getting the jobs above yours all have a qualification you do not, and the college in town runs it at night.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Enrol',
      tag: 'two hard years',
      detail: 'Two evenings a week and the Sundays. It is what the next rung is asking for.',
    },
    {
      id: 'steady',
      title: 'One course',
      tag: 'measured',
      detail: 'Take one and see whether you can carry it alongside the job.',
    },
    {
      id: 'pass',
      title: 'Not now',
      tag: 'safe',
      detail: 'You have a life outside the building. Keep it.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You finished it',
          text: 'Two years of evenings, and a certificate with your name on it that the people above you can read.',
          foot: 'The file is a different file now.',
          performance: 90,
          payPerMille: 30,
        },
      ],
      bad: [
        {
          title: 'You could not carry it',
          text: 'The job took the evenings the course needed, and by the second winter it was one or the other.',
          foot: 'A year of being tired and nothing on the wall for it.',
          performance: -40,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'One, and it counted',
          text: 'One course, finished, in the subject that actually mattered.',
          foot: 'A small thing, and it is on the file.',
          performance: 40,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'One, and it did not',
          text: 'You finish it, and discover it is not the one anybody was asking for.',
          foot: 'A winter of evenings for a line nobody reads.',
          performance: 5,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You kept your evenings',
          text: 'You do not enrol, and you are at your own table every night of a two-year stretch you would not have got back.',
          foot: 'No certificate. A life.',
          performance: 0,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'The gap widened',
          text: 'The people who went are two years further on than you now, and the distance shows.',
          foot: 'Still where you were.',
          performance: -25,
          payPerMille: 0,
        },
      ],
    },
  },
}

const RECOGNITION: WorkMoment = {
  id: 'recognition',
  title: 'The Nomination',
  minRung: 1,
  leadChance: 500,
  situation: [
    'Your name has gone forward for the thing they give out at the end of the year, and you have been asked whether you want to say a few words.',
    'They are giving somebody the award in December and, for the first time, one of the names on the list is yours.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Make the case',
      tag: 'bold',
      detail: 'Stand up and say what the year was actually worth.',
    },
    {
      id: 'steady',
      title: 'Say thank you',
      tag: 'measured',
      detail: 'A short one. Name the people who did the work with you.',
    },
    {
      id: 'pass',
      title: 'Decline it',
      tag: 'quiet',
      detail: 'Ask them to give it to somebody who would enjoy it more.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You won it',
          text: 'You stand up and say the year out loud, and it is the right room for it.',
          foot: 'On the record, in front of everybody who matters.',
          performance: 110,
          payPerMille: 40,
        },
      ],
      bad: [
        {
          title: 'It read badly',
          text: 'You make the case, and the room decides you are the sort of person who makes the case.',
          foot: 'The award went elsewhere.',
          performance: -50,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Thirty seconds, well spent',
          text: 'You keep it short and name three people who deserved naming, and the room likes you for it.',
          foot: 'Awarded, and liked.',
          performance: 70,
          payPerMille: 25,
        },
      ],
      bad: [
        {
          title: 'It went to somebody else',
          text: 'You say your thank-you, and the envelope has another name in it.',
          foot: 'Nominated. Which is something.',
          performance: 20,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'You let it pass',
          text: 'You ask them to give it elsewhere, and the person who gets it never learns why.',
          foot: 'Nothing on the file. Nothing lost either.',
          performance: 0,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It read as false modesty',
          text: 'Turning it down is itself a thing people have opinions about, it turns out.',
          foot: 'Read as a gesture rather than a preference.',
          performance: -25,
          payPerMille: 0,
        },
      ],
    },
  },
}

/**
 * THE SENIOR MOMENTS (careers overhaul, phase 3).
 *
 * Ten moments existed and only two of them looked at the rung, so a
 * vice-president ran into the same big assignment and the same mistake as
 * the clerk two floors down. The texture stopped where the ladder got
 * interesting.
 *
 * What changes high up is not that the work is harder — it is that the
 * decisions are ABOUT OTHER PEOPLE. A clerk's bad month costs a clerk; a
 * director's costs forty of them. That is the whole difference and it is
 * what these three are made of.
 */
const THE_CUT: WorkMoment = {
  id: 'the-cut',
  title: 'The List',
  minRung: 4,
  leadChance: 480,
  situation: [
    'The number they want out of your division is not a number, it is about eleven people, and you know all of their names.',
    'Finance has sent the target down twice now. The second time it came with a date on it.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Fight the number',
      tag: 'high risk / high reward',
      detail: 'Go back up with a plan that keeps them and makes the savings somewhere else. You will be spending your own credit.',
    },
    {
      id: 'steady',
      title: 'Cut where it costs least',
      tag: 'steady',
      detail: 'Do it properly. The vacancies first, the newest last, and you tell them yourself.',
    },
    {
      id: 'pass',
      title: 'Let the office run it',
      tag: 'safe / cold',
      detail: 'Sign what you are given. It is above you and it will happen either way.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You kept eight of them',
          text: 'Two floors of savings nobody had looked at, and a plan detailed enough that arguing with it took more energy than agreeing. Eight names came off the list.',
          foot: 'The division knows exactly who did that.',
          performance: 70,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'The number was never the point',
          text: 'It was a decision made before it reached you, and you spent a great deal of credit discovering that. The eleven went anyway.',
          foot: 'Read as not understanding the business.',
          performance: -60,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Done properly',
          text: 'You told them yourself, one at a time, and none of them heard it from a letter. It was a bad week and it was not a shambles.',
          foot: 'Steady hands, on the record.',
          performance: 30,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'It went round the building anyway',
          text: 'Somebody talked before you had finished the conversations, and four people found out in the wrong order.',
          foot: 'Handled, but not well.',
          performance: -20,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'Off your desk',
          text: 'It was run to the letter and none of it came back to you. The division noticed that too.',
          foot: 'Nothing on the file either way.',
          performance: 0,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'They wanted to hear it from you',
          text: 'A form letter and a door code that stopped working at eleven. The ones who stayed took a long time to look at you the same way.',
          foot: 'The floor went quiet for a month.',
          performance: -35,
          payPerMille: 0,
        },
      ],
    },
  },
}

const THE_BOARD: WorkMoment = {
  id: 'the-board',
  title: 'The Board Meeting',
  minRung: 5,
  leadChance: 520,
  situation: [
    'Twenty minutes, eleven people who have already read it, and one of them has been waiting all quarter to ask you something.',
    'The papers went out on Friday. By Monday two directors had opinions about page four, and page four is yours.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Ask them for the money',
      tag: 'high risk / high reward',
      detail: 'Take the meeting somewhere it was not going: the plan you have been sitting on, and the budget it needs.',
    },
    {
      id: 'steady',
      title: 'Present what you came with',
      tag: 'steady',
      detail: 'The numbers, the context, the risks. Answer page four honestly and sit down.',
    },
    {
      id: 'pass',
      title: 'Keep it short',
      tag: 'safe',
      detail: 'Nobody was ever hurt by a twelve-minute item. Give them the headline and let the meeting move on.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'They funded it in the room',
          text: 'You had the numbers for the question before it was asked, which is the only trick there is. It was approved before lunch.',
          foot: 'You are now somebody the board listens to.',
          performance: 85,
          payPerMille: 40,
        },
      ],
      bad: [
        {
          title: 'Not the meeting for it',
          text: 'The chair let you finish, which was worse than being stopped. It was noted for consideration, which is where things go.',
          foot: 'Ambitious, and out of step.',
          performance: -55,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Straight answers',
          text: 'Page four turned out to be exactly what you said it was, and you said so without decorating it. The room settled.',
          foot: 'Reliable in front of the board.',
          performance: 40,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Page four had a hole in it',
          text: 'The question you did not have an answer for was the obvious one, and eleven people watched you not have it.',
          foot: 'A bad twenty minutes with a long memory.',
          performance: -45,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'Twelve minutes',
          text: 'In, out, nothing on fire. The board had a long agenda and you were not the difficult part of it.',
          foot: 'Nobody remembers a short item.',
          performance: 0,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Read as having nothing to say',
          text: 'A headline and a shrug, in a room where everybody else came with a plan. It was noticed, quietly.',
          foot: 'Present, and not much else.',
          performance: -25,
          payPerMille: 0,
        },
      ],
    },
  },
}

const THE_SUCCESSION: WorkMoment = {
  id: 'the-succession',
  title: 'The Succession',
  minRung: 5,
  leadChance: 440,
  situation: [
    'The chief executive is leaving in eighteen months and everybody in the building has started counting who is left.',
    'You were asked, over a very long lunch, whether you had thought about the top job. It was not an idle question and it was not an offer.',
  ],
  options: [
    {
      id: 'lead',
      title: 'Run for it',
      tag: 'high risk / high reward',
      detail: 'Say yes, plainly, and start behaving like the answer. There is no quiet way to do this.',
    },
    {
      id: 'steady',
      title: 'Make yourself useful',
      tag: 'steady',
      detail: 'Do not campaign. Take the hard pieces of the transition and let that be the argument.',
    },
    {
      id: 'pass',
      title: 'Back somebody else',
      tag: 'safe / final',
      detail: 'Put your weight behind the obvious candidate. It ends your own chance and it buys you their gratitude.',
    },
  ],
  outcomes: {
    lead: {
      good: [
        {
          title: 'You are the front runner',
          text: 'It turns out the building had been waiting for somebody to want it out loud. Two of the other names withdrew inside a month.',
          foot: 'The board has your name at the top of a short list.',
          performance: 110,
          payPerMille: 60,
        },
      ],
      bad: [
        {
          title: 'Too early and too loud',
          text: 'Wanting it was never the disqualifier; letting the whole floor see you want it was. The lunch was not repeated.',
          foot: 'Marked as having got ahead of yourself.',
          performance: -80,
          payPerMille: 0,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'The work made the case',
          text: 'You took the two pieces nobody wanted and neither of them broke. When the list was drawn up you were on it without ever having asked.',
          foot: 'In contention, on the record rather than the campaign.',
          performance: 60,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'Useful is not the same as next',
          text: 'You did the hard parts of a transition beautifully, and that is exactly how you were described afterwards.',
          foot: 'Valued. Not considered.',
          performance: 10,
          payPerMille: 0,
        },
      ],
    },
    pass: {
      good: [
        {
          title: 'Kingmaker',
          text: 'You delivered three votes that were not going their way, and they know precisely what it cost you.',
          // A FAVOUR IS NOT A FILE. What this buys is somebody's goodwill,
          // which is real and is not an evaluation — and passing is never
          // free here, because it is read as passing. Taking yourself out
          // of a succession is exactly that, however well you do it.
          foot: 'Owed a favour by whoever runs this place next. Out of the running.',
          performance: 10,
          payPerMille: 0,
        },
      ],
      bad: [
        {
          title: 'You backed the wrong one',
          text: 'They did not get it, and the one who did spent a year working out where everybody had stood.',
          foot: 'On the wrong side of a decision that lasts.',
          performance: -50,
          payPerMille: 0,
        },
      ],
    },
  },
}

export const WORK_MOMENTS: readonly WorkMoment[] = [
  BIG_ASSIGNMENT,
  THE_MISTAKE,
  ASK_FOR_MORE,
  POACHED,
  CONFLICT,
  CRUNCH,
  ETHICS,
  MENTOR,
  BACK_TO_SCHOOL,
  RECOGNITION,
  THE_CUT,
  THE_BOARD,
  THE_SUCCESSION,
]

export function workMomentById(id: string): WorkMoment | undefined {
  return WORK_MOMENTS.find((moment) => moment.id === id)
}

/** The moments open to somebody standing on this rung. */
export function momentsFor(rung: number): readonly WorkMoment[] {
  return WORK_MOMENTS.filter((moment) => rung >= (moment.minRung ?? 0))
}

/** One line out of a pool, by seed. Deterministic and total. */
function fromPool<T>(pool: readonly T[], pick: number): T | undefined {
  if (pool.length === 0) return undefined
  return pool[Math.abs(pick) % pool.length]
}

export function situationOf(moment: WorkMoment, variant: number): string {
  return fromPool(moment.situation, variant) ?? ''
}

/**
 * Whether the reaching answer comes off.
 *
 * The moment's own odds, moved by how well they are already thought of —
 * somebody the floor trusts is genuinely more likely to land the account.
 * The measured answer nearly always works; the safe one nearly always
 * costs a little, which is what makes the three a real choice.
 */
export function workResultFor(
  moment: WorkMoment,
  choice: WorkChoice,
  performance: number,
  roll: number,
): WorkResult {
  const standing = Math.floor((performance - 500) / 4)
  const odds =
    choice === 'lead'
      ? moment.leadChance + standing
      : choice === 'steady'
        ? 780 + standing
        : 640 + standing
  return roll < Math.max(50, Math.min(970, odds)) ? 'good' : 'bad'
}

export function outcomeOf(
  moment: WorkMoment,
  choice: WorkChoice,
  result: WorkResult,
  variant: number,
): WorkOutcome | undefined {
  return fromPool(moment.outcomes[choice][result], variant)
}

/** What a raise of this many per-mille comes to, in whole cents. */
export function raiseFrom(pay: Money, perMille: number): Money {
  if (perMille <= 0) return 0 as Money
  return Math.floor((pay * perMille) / 1000) as Money
}

/** "big-assignment:2" — what the pending carries. */
export function encodeWorkMoment(momentId: string, variant: number): string {
  return `${momentId}:${String(variant)}`
}

export function decodeWorkMoment(encoded: string | null): { momentId: string; variant: number } {
  const parts = (encoded ?? '').split(':')
  const variant = Number.parseInt(parts[1] ?? '0', 10)
  return { momentId: parts[0] ?? '', variant: Number.isFinite(variant) ? variant : 0 }
}
