/**
 * THE MOMENTS A CHILDHOOD IS ACTUALLY MADE OF (education master §0.5, §7).
 *
 * The school years were a countdown. A child enrolled, thirteen years
 * passed, a diploma appeared — and nothing that happened in between was
 * ever a thing that happened. The military career next to it has the
 * firefight and the board; the job has the account nobody wants to run.
 * This is the equivalent for the decade before either of those exist.
 *
 * THE RAILS ARE THE WORK MOMENT'S, deliberately: three answers, one of
 * them the reaching one, one the measured one, one the safe one. What is
 * NOT shared is the copy. The owner's rule, from the crime scenes:
 *
 *   every situation line, option label and outcome line is selected from
 *   the real context — never a shared hardcoded string
 *
 * So the bully has "Stand up to them / Tell someone / Keep your head
 * down" and the exam has "Sit up all week / Revise what you can / Wing
 * it", and neither borrows a word from the other. Nothing here is
 * generated; every slot is a POOL picked by seed, so wording varies
 * between runs without a fact ever mismatching.
 *
 * A CHILD IS NOT A CAREERIST, and the numbers say so. The reaching answer
 * at eight years old is standing up to somebody twice your size, and what
 * it moves is small: a childhood should not be won or lost in one month.
 * The high-school moments carry more because by then the choices are
 * closer to being the person's own.
 *
 * Pure content and pure arithmetic. `systems.ts` moves the numbers.
 *
 * ONE WARNING FOR WHOEVER WRITES THE NEXT ONE OF THESE: the purity check
 * strips comments but NOT string literals, so authored prose is scanned
 * for banned constructs like any other code. A line here originally read
 * "turn back to the window. The rest of the table..." and tripped the
 * browser-globals rule on `window.` — in a sentence about a child looking
 * out of one. The rule is right and the sentence moved; do not widen the
 * guard to accommodate copy.
 */

/**
 * The three rails. Their WORDS are per-moment; these are the ids that
 * travel on a pending and in a save.
 */
export type SchoolChoice = 'reach' | 'steady' | 'duck'

export const SCHOOL_CHOICES: readonly SchoolChoice[] = ['reach', 'steady', 'duck']

/** How it turned out. The reaching answer is the one that can fail. */
export type SchoolResult = 'good' | 'bad'

/** Which stage of the ladder a moment belongs to. */
export type SchoolStage = 'primary' | 'middle' | 'secondary'

export interface SchoolOption {
  readonly id: SchoolChoice
  readonly title: string
  /** The tag on the button — "brave", "sensible", "safe". */
  readonly tag: string
  readonly detail: string
}

export interface SchoolOutcome {
  readonly title: string
  readonly text: string
  /** The line under it: what it did. */
  readonly foot: string
  /** School performance, -60..60. Small on purpose. */
  readonly attainment: number
  /** Morale, -80..80. */
  readonly wellbeing: number
}

export interface SchoolMoment {
  readonly id: string
  readonly stage: SchoolStage
  readonly title: string
  /** Picked by seed. Every one states the same facts. */
  readonly situations: readonly string[]
  readonly options: readonly [SchoolOption, SchoolOption, SchoolOption]
  readonly outcomes: Readonly<
    Record<SchoolChoice, Readonly<Record<SchoolResult, readonly SchoolOutcome[]>>>
  >
}

// ---------------------------------------------------------------------------
// Elementary. Small people, small stakes, and the first time any of it is
// a choice at all.
// ---------------------------------------------------------------------------

const FIRST_FRIEND: SchoolMoment = {
  id: 'first-friend',
  stage: 'primary',
  title: 'The empty seat',
  situations: [
    'There is a new kid at the back of the room with nobody either side of them, and a spare chair at your table.',
    'Somebody started this week and has eaten lunch alone three days running. There is room where you sit.',
    'The teacher asks who will show the new one where things are. Nobody puts a hand up.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Go and sit with them',
      tag: 'brave',
      detail: 'Cross the room in front of everybody and take the empty chair.',
    },
    {
      id: 'steady',
      title: 'Say hello at break',
      tag: 'sensible',
      detail: 'Not in front of the whole class. Outside, where it is quieter.',
    },
    {
      id: 'duck',
      title: 'Stay where you are',
      tag: 'safe',
      detail: 'Somebody else will. You have a table already.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'A friend',
          text: 'They are funny once they start talking, and it turns out they are frightened of exactly the same teacher you are.',
          foot: 'Something in the week got easier.',
          attainment: 14,
          wellbeing: 55,
        },
        {
          title: 'Two of you now',
          text: 'By the end of the afternoon you have a private joke, which at that age is most of what a friendship is.',
          foot: 'School is a better place to walk into.',
          attainment: 12,
          wellbeing: 60,
        },
      ],
      bad: [
        {
          title: 'They did not want it',
          text: 'They answer in one word and go back to staring at the yard. The rest of the table saw you try.',
          foot: 'A long walk back to your own chair.',
          attainment: -6,
          wellbeing: -35,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Outside, then',
          text: 'It is easier away from thirty pairs of eyes. You walk the same way home as far as the corner.',
          foot: 'A start, without the audience.',
          attainment: 8,
          wellbeing: 32,
        },
      ],
      bad: [
        {
          title: 'Missed them',
          text: 'By break they had found somebody else, and the moment had closed the way those moments do.',
          foot: 'No harm in it. No good either.',
          attainment: 0,
          wellbeing: -8,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Somebody else did',
          text: 'A girl from the front row got there first, and the new one is fine. You watch it happen.',
          foot: 'Nothing changed.',
          attainment: 0,
          wellbeing: -5,
        },
      ],
      bad: [
        {
          title: 'Nobody did',
          text: 'They ate alone again. You noticed, which is the part that stays with you.',
          foot: 'It sits oddly for a few days.',
          attainment: -4,
          wellbeing: -18,
        },
      ],
    },
  },
}

const THE_BULLY: SchoolMoment = {
  id: 'the-bully',
  stage: 'primary',
  title: 'The one who waits by the gate',
  situations: [
    'There is a boy two years above who has decided you are worth his attention, and he is by the gate again.',
    'Your bag was in the bin on Tuesday. Today he is standing where you have to walk past.',
    'It has been three weeks of it now, and everybody has stopped pretending they cannot see.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Stand up to them',
      tag: 'brave',
      detail: 'Face it out. He is bigger, and that is the whole problem with the plan.',
    },
    {
      id: 'steady',
      title: 'Tell someone',
      tag: 'sensible',
      detail: 'A teacher, or the people at home. Let an adult be the size of him.',
    },
    {
      id: 'duck',
      title: 'Keep your head down',
      tag: 'safe',
      detail: 'Go the long way round and wait for him to get bored.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'He blinked',
          text: 'It turns out he had never once been asked to actually do it, and he has no idea what to do when somebody does not move.',
          foot: 'He finds somebody else. You walk through the gate.',
          attainment: 10,
          wellbeing: 65,
        },
      ],
      bad: [
        {
          title: 'He did not',
          text: 'He was bigger, and that was as decisive as it sounded when you thought about it the night before.',
          foot: 'A bad afternoon, and it is not over.',
          attainment: -18,
          wellbeing: -70,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'It got handled',
          text: 'Somebody spoke to somebody. It is awkward for a week and then it simply stops.',
          foot: 'Over, and you did not have to be brave about it.',
          attainment: 12,
          wellbeing: 40,
        },
      ],
      bad: [
        {
          title: 'It got worse first',
          text: 'He knew who told. There is a fortnight of it being sharper before the adults finally close it down.',
          foot: 'Solved, eventually, and expensively.',
          attainment: -8,
          wellbeing: -30,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'He got bored',
          text: 'The long way round adds ten minutes and works. By half term he has forgotten your name.',
          foot: 'Waited it out.',
          attainment: 0,
          wellbeing: 8,
        },
      ],
      bad: [
        {
          title: 'A long year',
          text: 'The long way round becomes the only way you walk, and the thing you learn is that school is somewhere to survive.',
          foot: 'It costs more than the ten minutes.',
          attainment: -22,
          wellbeing: -48,
        },
      ],
    },
  },
}

const THE_SUBJECT: SchoolMoment = {
  id: 'favourite-subject',
  stage: 'primary',
  title: 'The one lesson you like',
  situations: [
    'There is one hour a week you would not skip, and the teacher has noticed you would not skip it.',
    'You finished the sheet early and asked for another one, which is not a thing you do in any other lesson.',
    'The teacher has left a book on your desk that is two years above where you are meant to be.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Ask for more of it',
      tag: 'keen',
      detail: 'Say out loud, in front of everyone, that you want the harder one.',
    },
    {
      id: 'steady',
      title: 'Take the book home',
      tag: 'quiet',
      detail: 'No announcement. Just read it.',
    },
    {
      id: 'duck',
      title: 'Leave it on the desk',
      tag: 'safe',
      detail: 'Being the kid who likes a subject is its own kind of trouble.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'They gave you more',
          text: 'The teacher has been waiting years for somebody to ask, and produces a whole box of it.',
          foot: 'Something to be good at.',
          attainment: 30,
          wellbeing: 40,
        },
      ],
      bad: [
        {
          title: 'The back row heard',
          text: 'You get the harder work and a nickname to go with it, and only one of those was what you wanted.',
          foot: 'Worth it, probably.',
          attainment: 22,
          wellbeing: -25,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Read it twice',
          text: 'Nobody knows and it does not matter that nobody knows. It is the first thing you have finished because you wanted to.',
          foot: 'A habit starts here.',
          attainment: 24,
          wellbeing: 22,
        },
      ],
      bad: [
        {
          title: 'Too hard, for now',
          text: 'Forty pages in it stops making sense, and there is nobody to ask because you never said you had it.',
          foot: 'It goes back unfinished.',
          attainment: 4,
          wellbeing: -10,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Still the best hour',
          text: 'You do not take the book, but you do not stop liking the lesson either.',
          foot: 'The interest survives the year.',
          attainment: 6,
          wellbeing: 10,
        },
      ],
      bad: [
        {
          title: 'They stopped offering',
          text: 'A teacher only leaves the book on the desk so many times.',
          foot: 'The door was open for a while.',
          attainment: -10,
          wellbeing: -12,
        },
      ],
    },
  },
}

// ---------------------------------------------------------------------------
// Middle. Where other people's opinions arrive and become the weather.
// ---------------------------------------------------------------------------

const THE_CLIQUE: SchoolMoment = {
  id: 'fitting-in',
  stage: 'middle',
  title: 'Who you sit with',
  situations: [
    'The table you have sat at all year has started being unkind about somebody, and they are watching to see whether you join in.',
    'There is a group everybody wants to be in, and the price of the empty chair is being a bit worse than you are.',
    'Somebody you have known since you were six has become the thing to laugh at, and you are standing right there.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Say something',
      tag: 'costly',
      detail: 'Out loud, to their faces, about the person who is not there.',
    },
    {
      id: 'steady',
      title: 'Change the subject',
      tag: 'sensible',
      detail: 'Do not join in and do not make a speech. Just move it along.',
    },
    {
      id: 'duck',
      title: 'Laugh along',
      tag: 'easy',
      detail: 'It is easier, and the chair stays yours.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'It stopped',
          text: 'Two of them were waiting for anybody to go first. It turns out most people at that table did not like it either.',
          foot: 'You keep the chair, and something better than the chair.',
          attainment: 12,
          wellbeing: 60,
        },
      ],
      bad: [
        {
          title: 'The chair went',
          text: 'They close over it like water. By Thursday you are eating somewhere else.',
          foot: 'Right, and lonely with it.',
          attainment: -10,
          wellbeing: -45,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'It passed',
          text: 'You get it onto something else and nobody quite notices you did it on purpose.',
          foot: 'No blood on the floor.',
          attainment: 4,
          wellbeing: 15,
        },
      ],
      bad: [
        {
          title: 'It came back round',
          text: 'It moves off and then straight back, and the second time your silence is the loud thing.',
          foot: 'It sits badly that night.',
          attainment: -4,
          wellbeing: -22,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Nobody remembers',
          text: 'It blows over the way these things do at that age. You keep the table.',
          foot: 'Nothing happened.',
          attainment: 0,
          wellbeing: -6,
        },
      ],
      bad: [
        {
          title: 'They heard you',
          text: 'It gets back to them that you laughed. They had thought you were the one who would not.',
          foot: 'That friendship does not come back.',
          attainment: -8,
          wellbeing: -40,
        },
      ],
    },
  },
}

const THE_TRYOUT: SchoolMoment = {
  id: 'the-tryout',
  stage: 'middle',
  title: 'Tryouts on Thursday',
  situations: [
    'There is a team, or a band, or a club with a hand-written sign, and it takes twelve and thirty want in.',
    'The list has gone up on the corridor wall and there is a pen on a string next to it.',
    'They are picking on Thursday. You have thought about it every day since Monday.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Put your name down',
      tag: 'exposed',
      detail: 'Everybody sees the list. Everybody sees who does not make it.',
    },
    {
      id: 'steady',
      title: 'Go and watch first',
      tag: 'sensible',
      detail: 'See what it is before you promise anybody anything.',
    },
    {
      id: 'duck',
      title: 'Do not bother',
      tag: 'safe',
      detail: 'Thirty for twelve. The maths is the maths.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'You are in',
          text: 'Twelfth of twelve, which counts exactly as much as first of twelve does.',
          foot: 'Somewhere to be, twice a week.',
          attainment: 18,
          wellbeing: 65,
        },
      ],
      bad: [
        {
          title: 'The list went up without you',
          text: 'They read it out. Yours is not on it, and the corridor is very full at that moment.',
          foot: 'It stings for a month.',
          attainment: -6,
          wellbeing: -45,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Went back on Thursday',
          text: 'Watching first turned out to be the right way round: you knew what they wanted by the time it counted.',
          foot: 'In, and less frightened about it.',
          attainment: 14,
          wellbeing: 42,
        },
      ],
      bad: [
        {
          title: 'Watched it fill up',
          text: 'By the time you had seen enough the twelve were picked.',
          foot: 'Next year, maybe.',
          attainment: 0,
          wellbeing: -14,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'No loss',
          text: 'It ran on Thursdays, which is the night you would have hated giving up anyway.',
          foot: 'The week stays yours.',
          attainment: 2,
          wellbeing: 4,
        },
      ],
      bad: [
        {
          title: 'They were short',
          text: 'They took everybody who turned up in the end. All thirty. You hear about it on Friday.',
          foot: 'That one was free and you did not take it.',
          attainment: -6,
          wellbeing: -26,
        },
      ],
    },
  },
}

const THE_STREAK: SchoolMoment = {
  id: 'rebellious-streak',
  stage: 'middle',
  title: 'The dare',
  situations: [
    'They are going to do it whether you come or not, and they have made a point of asking whether you are coming.',
    'It is not exactly stealing and it is not exactly not, and everybody has agreed to call it a laugh.',
    'The window is unlocked, the building is empty, and somebody has said the word "scared" out loud.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Go with them',
      tag: 'reckless',
      detail: 'Whatever happens, happens with everybody else it happens to.',
    },
    {
      id: 'steady',
      title: 'Talk them out of it',
      tag: 'awkward',
      detail: 'Be the one who says it is stupid, in front of the ones who called it a laugh.',
    },
    {
      id: 'duck',
      title: 'Go home',
      tag: 'safe',
      detail: 'Do not argue. Just be somewhere else.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'Nothing happened',
          text: 'It was as stupid and as harmless as it looked, and it is the story for the rest of the term.',
          foot: 'Got away with it.',
          attainment: -8,
          wellbeing: 40,
        },
      ],
      bad: [
        {
          title: 'Caught',
          text: 'Somebody was watching the whole time. There is a phone call home and a long silence at the table.',
          foot: 'On the school’s list now, and on one at home.',
          attainment: -35,
          wellbeing: -55,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'They listened',
          text: 'One of them was looking for a reason not to, and you gave everybody the reason.',
          foot: 'Nobody got caught, because nobody went.',
          attainment: 10,
          wellbeing: 30,
        },
      ],
      bad: [
        {
          title: 'They went anyway',
          text: 'They went, and they remember exactly who tried to stop them.',
          foot: 'Outside it for a while.',
          attainment: 4,
          wellbeing: -28,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Home by six',
          text: 'You hear on Monday what happened. You are glad, in a quiet way, to have heard it rather than been in it.',
          foot: 'Well out of it.',
          attainment: 6,
          wellbeing: 12,
        },
      ],
      bad: [
        {
          title: 'The word stuck',
          text: 'Somebody said "scared" and it followed you into the next year.',
          foot: 'Cheap, and it still costs something.',
          attainment: 0,
          wellbeing: -24,
        },
      ],
    },
  },
}

// ---------------------------------------------------------------------------
// High school. The stakes are real now, and so are the consequences —
// this is the record that college and the recruiter both read.
// ---------------------------------------------------------------------------

const THE_EXAM: SchoolMoment = {
  id: 'the-exam',
  stage: 'secondary',
  title: 'The exam that counts',
  situations: [
    'This is the one that goes on the transcript, and there are eleven days left.',
    'Everything else this year has been practice. This is the paper that gets read by people who have never met you.',
    'Eleven days, one paper, and it decides more than any single hour ought to.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Sit up all week',
      tag: 'all in',
      detail: 'Every night until it is done. Everything else waits.',
    },
    {
      id: 'steady',
      title: 'Revise what you can',
      tag: 'sensible',
      detail: 'An hour a night and a decent sleep before it.',
    },
    {
      id: 'duck',
      title: 'Wing it',
      tag: 'risky',
      detail: 'You have sat in the lessons all year. That is either enough or it is not.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'It paid',
          text: 'Two of the questions were the ones you sat up over on the Wednesday, and you knew them cold.',
          foot: 'That goes on the record where people can see it.',
          attainment: 55,
          wellbeing: 35,
        },
      ],
      bad: [
        {
          title: 'Burned out',
          text: 'By the morning of it you had not slept properly in a week, and the paper was harder than the tiredness could carry.',
          foot: 'All that work, and a middling grade.',
          attainment: 6,
          wellbeing: -50,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Solid',
          text: 'Not brilliant, not a disaster. You walked out knowing roughly what you had got, which is its own kind of comfort.',
          foot: 'A respectable line on the transcript.',
          attainment: 30,
          wellbeing: 20,
        },
      ],
      bad: [
        {
          title: 'The wrong hour',
          text: 'You revised well and the paper asked about the one week you had skimmed.',
          foot: 'Bad luck, and it counts the same as bad work.',
          attainment: -12,
          wellbeing: -30,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Got away with it',
          text: 'It turned out you had been listening all year after all.',
          foot: 'Fine. And you know exactly how close that was.',
          attainment: 12,
          wellbeing: 25,
        },
      ],
      bad: [
        {
          title: 'It showed',
          text: 'Forty minutes in you ran out of things you actually knew, and there was an hour left.',
          foot: 'That one stays on the transcript.',
          attainment: -50,
          wellbeing: -45,
        },
      ],
    },
  },
}

const THE_MENTOR: SchoolMoment = {
  id: 'the-mentor',
  stage: 'secondary',
  title: 'The teacher who noticed',
  situations: [
    'One of them has asked you to stay behind, and it does not appear to be about anything you have done wrong.',
    'There is a teacher who has started writing more on your work than anybody writes on anybody’s work.',
    'They want to talk about what happens after this, which nobody has asked you about before.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Tell them what you want',
      tag: 'open',
      detail: 'Say the thing out loud to an adult who might be able to do something about it.',
    },
    {
      id: 'steady',
      title: 'Hear them out',
      tag: 'sensible',
      detail: 'Listen properly. Do not promise anything yet.',
    },
    {
      id: 'duck',
      title: 'Say you have to go',
      tag: 'safe',
      detail: 'It is easier not to have that conversation at all.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'They opened a door',
          text: 'They knew somebody, or knew a form, or knew the one thing you would have needed a year to find out on your own.',
          foot: 'The path after school looks different now.',
          attainment: 60,
          wellbeing: 55,
        },
      ],
      bad: [
        {
          title: 'They could not help',
          text: 'They meant it kindly and there was simply nothing they could do about the part that was in the way.',
          foot: 'At least somebody knew to ask.',
          attainment: 14,
          wellbeing: -15,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Worth staying for',
          text: 'Most of it you had half worked out. One piece of it you had not, and that piece mattered.',
          foot: 'Better informed than you were at four o’clock.',
          attainment: 32,
          wellbeing: 28,
        },
      ],
      bad: [
        {
          title: 'Nothing new',
          text: 'They were kind and it was twenty minutes of things you already knew.',
          foot: 'No harm done.',
          attainment: 6,
          wellbeing: 2,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Another time',
          text: 'They caught you again a fortnight later and you did stay, which is the same conversation two weeks late.',
          foot: 'Got there in the end.',
          attainment: 16,
          wellbeing: 8,
        },
      ],
      bad: [
        {
          title: 'They stopped asking',
          text: 'A teacher with two hundred names only chases one of them so far.',
          foot: 'That was the door, and it was open for a term.',
          attainment: -20,
          wellbeing: -22,
        },
      ],
    },
  },
}

const THE_PARTY: SchoolMoment = {
  id: 'the-party',
  stage: 'secondary',
  title: 'Saturday night',
  situations: [
    'Somebody’s parents are away, half the year is going, and there is a paper on Monday.',
    'You have been asked, properly, by name, which has not happened much. It is the night before the mock.',
    'Everybody is going. There is also the small matter of the thing due first thing.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Go, and stay late',
      tag: 'reckless',
      detail: 'The paper is on Monday and you are seventeen exactly once.',
    },
    {
      id: 'steady',
      title: 'Go for an hour',
      tag: 'balanced',
      detail: 'Show your face, leave before it turns, be up in the morning.',
    },
    {
      id: 'duck',
      title: 'Stay in',
      tag: 'dull',
      detail: 'Everybody will be talking about it on Monday and you will not have been there.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'Worth it',
          text: 'It was the good kind of night, the sort people still bring up years later, and the paper survived it.',
          foot: 'Tired, and not sorry.',
          attainment: -18,
          wellbeing: 70,
        },
      ],
      bad: [
        {
          title: 'Monday came anyway',
          text: 'The night was fine. The paper at nine the next morning was not, and there is no version of the story where it was.',
          foot: 'It shows on the record.',
          attainment: -48,
          wellbeing: 10,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'Both, somehow',
          text: 'You were there for the part everybody talks about and asleep before the part nobody wanted to be in.',
          foot: 'Rare, that.',
          attainment: 10,
          wellbeing: 45,
        },
      ],
      bad: [
        {
          title: 'An hour was the wrong hour',
          text: 'You left just before it got good and got home too wound up to sleep anyway.',
          foot: 'Neither one thing nor the other.',
          attainment: -8,
          wellbeing: -18,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'Ready on Monday',
          text: 'You were the only person in the room who had slept, and it was extremely obvious which one of you had.',
          foot: 'The paper went well.',
          attainment: 36,
          wellbeing: -10,
        },
      ],
      bad: [
        {
          title: 'Missed it',
          text: 'The paper went fine. It went fine for the people who were at the party too.',
          foot: 'You hear about it all week.',
          attainment: 20,
          wellbeing: -35,
        },
      ],
    },
  },
}

const THE_JOB: SchoolMoment = {
  id: 'saturday-job',
  stage: 'secondary',
  title: 'The Saturday job',
  situations: [
    'There is work going at the weekend. It is real money, and it is every Saturday.',
    'They need somebody Saturdays and Sunday mornings, and they have asked whether you want it.',
    'It pays, which nothing else in your life currently does, and it costs the only two days you have.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Take all the hours',
      tag: 'hard',
      detail: 'Both days, every week. The money is the point.',
    },
    {
      id: 'steady',
      title: 'Take the Saturday',
      tag: 'balanced',
      detail: 'One day. Keep the other one for the work that is not paid.',
    },
    {
      id: 'duck',
      title: 'Turn it down',
      tag: 'safe',
      detail: 'School is the job for now.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'Money of your own',
          text: 'It is the first time anything in your life has been bought with something you earned, and it changes how you stand.',
          foot: 'Tired every Monday. Worth it.',
          attainment: -14,
          wellbeing: 50,
        },
      ],
      bad: [
        {
          title: 'Something had to give',
          text: 'Two days a week is two days a week, and the work that does not pay is the work that slipped.',
          foot: 'The grades know about it.',
          attainment: -42,
          wellbeing: 20,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'One day was right',
          text: 'Enough money to matter, enough Sunday left to do the reading.',
          foot: 'Both, and neither suffered.',
          attainment: 8,
          wellbeing: 35,
        },
      ],
      bad: [
        {
          title: 'They wanted both',
          text: 'One day was not what they were after and they gave it to somebody who would do two.',
          foot: 'No job, and a wasted fortnight.',
          attainment: 0,
          wellbeing: -20,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'The right call',
          text: 'It was the year that counted and you spent it on the thing that counted.',
          foot: 'It shows in the spring.',
          attainment: 26,
          wellbeing: 5,
        },
      ],
      bad: [
        {
          title: 'Broke, and no better for it',
          text: 'You did not take the job and you did not use the time either.',
          foot: 'Neither the money nor the marks.',
          attainment: -10,
          wellbeing: -25,
        },
      ],
    },
  },
}

const THE_CRUNCH: SchoolMoment = {
  id: 'the-crunch',
  stage: 'secondary',
  title: 'What happens after this',
  situations: [
    'The forms are due, everybody is asking, and you are supposed to have an answer about the rest of your life.',
    'There is a deadline on a piece of paper that decides which doors are open in September.',
    'Everybody in the year has started saying what they are doing next, and some of them are making it up.',
  ],
  options: [
    {
      id: 'reach',
      title: 'Aim high',
      tag: 'ambitious',
      detail: 'Put in for the one you probably will not get.',
    },
    {
      id: 'steady',
      title: 'Apply where you fit',
      tag: 'sensible',
      detail: 'Somewhere that will take you, and that you would actually go to.',
    },
    {
      id: 'duck',
      title: 'Leave it',
      tag: 'risky',
      detail: 'Decide later. The forms will still be there.',
    },
  ],
  outcomes: {
    reach: {
      good: [
        {
          title: 'They said yes',
          text: 'The one you probably would not get turns out to have been the one that wanted somebody exactly like you.',
          foot: 'That changes what September looks like.',
          attainment: 65,
          wellbeing: 70,
        },
      ],
      bad: [
        {
          title: 'They said no',
          text: 'A short letter, politely worded, and everybody in the house had already told the neighbours.',
          foot: 'The other doors are still open.',
          attainment: 10,
          wellbeing: -50,
        },
      ],
    },
    steady: {
      good: [
        {
          title: 'A place',
          text: 'Not the one on the poster. A real one, that will have you, that you would be glad to go to.',
          foot: 'Settled, and no drama.',
          attainment: 34,
          wellbeing: 40,
        },
      ],
      bad: [
        {
          title: 'Even that was tight',
          text: 'The place you were sure of took longer to answer than it should have, and the waiting was its own thing.',
          foot: 'In, eventually.',
          attainment: 16,
          wellbeing: -12,
        },
      ],
    },
    duck: {
      good: [
        {
          title: 'No hurry',
          text: 'You did not fill anything in, and it turns out that not everybody has to decide at seventeen.',
          foot: 'The fork at eighteen is still yours to take.',
          attainment: 0,
          wellbeing: 12,
        },
      ],
      bad: [
        {
          title: 'The deadline went',
          text: 'It was on a piece of paper and then it was in the past, and the doors it opened closed with it.',
          foot: 'Fewer choices in September than there were in March.',
          attainment: -38,
          wellbeing: -40,
        },
      ],
    },
  },
}

export const SCHOOL_MOMENTS: readonly SchoolMoment[] = [
  FIRST_FRIEND,
  THE_BULLY,
  THE_SUBJECT,
  THE_CLIQUE,
  THE_TRYOUT,
  THE_STREAK,
  THE_EXAM,
  THE_MENTOR,
  THE_PARTY,
  THE_JOB,
  THE_CRUNCH,
]

export function schoolMomentById(id: string): SchoolMoment | undefined {
  return SCHOOL_MOMENTS.find((moment) => moment.id === id)
}

/** The moments that belong to the stage a child is currently in. */
export function schoolMomentsFor(stage: SchoolStage): readonly SchoolMoment[] {
  return SCHOOL_MOMENTS.filter((moment) => moment.stage === stage)
}

export function schoolSituationOf(moment: SchoolMoment, variant: number): string {
  const pool = moment.situations
  return pool[variant % pool.length] ?? pool[0] ?? ''
}

export function schoolOutcomeOf(
  moment: SchoolMoment,
  choice: SchoolChoice,
  result: SchoolResult,
  variant: number,
): SchoolOutcome | undefined {
  const pool = moment.outcomes[choice][result]
  return pool[variant % pool.length] ?? pool[0]
}

/**
 * WHETHER THE REACHING ANSWER LANDED.
 *
 * Weighted by how the child is doing at school, because a strong record is
 * exactly what makes the brave answer survivable — the kid who has been
 * doing the work can afford the week of sitting up, and the one who has
 * not cannot. The measured answer nearly always works and the safe one
 * mostly does; only `reach` is a real gamble, which is what makes it one.
 */
export function schoolResultFor(
  moment: SchoolMoment,
  choice: SchoolChoice,
  attainment: number,
  roll: number,
): SchoolResult {
  const odds = choice === 'reach' ? 300 + Math.floor(attainment / 2) : choice === 'steady' ? 760 : 700
  void moment
  return roll % 1000 < odds ? 'good' : 'bad'
}

export function encodeSchoolMoment(momentId: string, variant: number): string {
  return `${momentId}:${String(variant)}`
}

export function decodeSchoolMoment(encoded: string | null): {
  momentId: string
  variant: number
} {
  const [momentId, variant] = (encoded ?? ':').split(':')
  return { momentId: momentId ?? '', variant: Number(variant ?? '0') || 0 }
}
