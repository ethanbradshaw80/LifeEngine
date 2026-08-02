/**
 * How WCJC talks (owner's newsroom spec §2 and §4).
 *
 * TWO PROBLEMS THIS SOLVES.
 *
 * The first is sameness: every death printed the same sentence with a
 * different name in it. Determinism is absolute here — the same seed must
 * print the same paper — so "varied" cannot mean random. It means WIDE
 * SEEDED POOLS: pick from ten openers by a hash of seed, subject and tick,
 * and the combinations explode until no two stories read alike.
 *
 * The second is the register. The OWNER'S TONE OVERRIDE amends the
 * newsroom's restraint rule: the paper may be graphic about how people were
 * hurt or killed, and townspeople may swear the way they actually do. Grit
 * is a dial, not a switch — war and crime run hot, obituaries stay warmer —
 * and every pool below has both registers so the same facts can be told
 * either way.
 *
 * THE ONE LINE THE OVERRIDE DOES NOT MOVE, stated here because this is the
 * file somebody will reach for when they want it hotter: no sexual content,
 * and nothing graphic or exploitative involving a child. That holds at
 * every grit level, and there is no dial for it.
 */

import { hash32 } from './rng.js'

/** How hard the paper is allowed to hit. */
export type Grit = 'low' | 'medium' | 'high'

/** The station's default, where a section does not say otherwise. */
export const HOUSE_GRIT: Grit = 'high'

/**
 * §4's dial, per section rather than one switch for the paper.
 *
 * WAR AND CRIME RUN HOT: that is where the override is aimed, and a war
 * report that will not say what a wound did is the sanitising the owner
 * asked to stop.
 *
 * OBITUARIES STAY WARMER, and that is a deliberate difference rather than
 * squeamishness. A death IN SERVICE is a war story and runs at the war's
 * register; an obituary is the page a family reads about somebody who died
 * at home, and the same graphic register there is not grit, it is cruelty
 * to no purpose. The override lifted restraint; it did not ask for that.
 */
export const SECTION_GRIT: Readonly<Record<string, Grit>> = {
  war: 'high',
  courts: 'high',
  'died-in-service': 'high',
  obituaries: 'medium',
  local: 'low',
}

export function gritFor(section: string): Grit {
  return SECTION_GRIT[section] ?? HOUSE_GRIT
}

/**
 * A deterministic pick from a pool. The same seed, subject and tick always
 * land on the same phrase — which is what lets the paper be varied and
 * reproducible at once.
 */
export function pickPhrase<T>(pool: readonly T[], seed: number, salt: number, tick: number): T {
  if (pool.length === 0) throw new RangeError('pickPhrase needs a pool')
  const index = hash32(seed, salt, tick) % pool.length
  const chosen = pool[index]
  if (chosen === undefined) throw new RangeError('pickPhrase fell off its pool')
  return chosen
}

// ---------------------------------------------------------------------------
// Death in service
// ---------------------------------------------------------------------------

/** "{who} was killed…" — the opening clause of a death lede. */
export const DEATH_OPENERS: Readonly<Record<Grit, readonly string[]>> = {
  // EVERY OPENER ENDS AT THE DATE, on purpose: the wound clause is appended
  // after it, and the first draft had templates that trailed off into a
  // second fragment ("... July 1994. 28 years old"), which put the wound
  // after the wrong half of the sentence.
  low: [
    '{who}, {age}, of {town}, died in {when}',
    '{who}, {age}, was killed in {when}',
    'The war took {who}, {age}, of {town}, in {when}',
    '{town} lost {who}, {age}, in {when}',
    '{who} of {town}, {age}, died in {when}',
    'Word reached {town} in {when} that {who}, {age}, had been killed',
  ],
  medium: [
    '{who}, {age}, of {town}, was killed in {when}',
    '{who}, {age}, died in {when}',
    '{town} buried another one in {when} — {who}, {age}',
    'The border war killed {who}, {age}, of {town}, in {when}',
    '{who}, {age}, of {town}, did not come home in {when}',
    'They are bringing {who}, {age}, home; killed in {when}',
  ],
  high: [
    '{who}, {age}, of {town}, bled out in {when}',
    '{who}, {age}, died hard in {when}',
    'The war killed {who}, {age}, of {town}, in {when}',
    '{town} has another body coming home — {who}, {age}, killed in {when}',
    'Nobody could stop the bleeding: {who}, {age}, died in {when}',
    '{who}, {age}, was hit in {when} and did not make it off the road',
  ],
}

/** How the wound is told. `{wound}` is read from the record. */
export const WOUND_CLAUSES: Readonly<Record<Grit, readonly string[]>> = {
  low: ['of {wound}', 'of {wound} taken in action', 'after taking {wound}'],
  medium: ['of {wound}', 'from {wound}', 'after {wound} that could not be treated'],
  high: [
    'of {wound} that opened an artery',
    'of {wound}; gone before the medic got a hand on it',
    'of {wound} nobody could pack fast enough',
    'of {wound}, and it took minutes',
  ],
}

/** Where and how it happened. `{how}` is the contact channel's own words. */
export const CIRCUMSTANCE_CLAUSES: readonly string[] = [
  // The contact flavour the engine records is a SCENE — "sappers in the
  // wire at midnight" — not a clause. Connectors have to be prepositional
  // or the sentence reads as though the dead man did the killing, which is
  // exactly what the first draft printed.
  'during {how}',
  'in {how}',
  'amid {how}',
]

/** What a shaken squadmate says. High grit lets them talk like people. */
export const DEATH_QUOTES: Readonly<Record<Grit, readonly string[]>> = {
  low: [
    'They pulled the same duty the rest of us pulled, every day, without a word about it.',
    'You could put them anywhere and stop worrying about it.',
    'There is not much to say. They were good at this and now they are gone.',
  ],
  medium: [
    'One minute it is an ordinary road and the next there is blood everywhere.',
    'The best of us, and it did not matter.',
    'You think about it every time you get back in a truck.',
  ],
  high: [
    'One second there is a halt being called, next second there is blood all over the seat and nobody is talking.',
    'That is how fast it goes out here. Does not matter how good you are.',
    'We got them out and they were already gone. I had my hands right on it.',
    'Nobody tells you how much of it there is.',
  ],
}

// ---------------------------------------------------------------------------
// Crime and the courthouse
// ---------------------------------------------------------------------------

export const CRIME_OPENERS: Readonly<Record<Grit, readonly string[]>> = {
  low: [
    '{who}, {age}, was convicted in {when} of {charge}',
    'A {town} jury convicted {who}, {age}, of {charge} {when}',
    '{who} of {town} was convicted in {when} of {charge}',
  ],
  medium: [
    '{who}, {age}, of {town}, was convicted of {charge} in {when}',
    'The county convicted {who}, {age}, of {charge} {when}',
    '{who} will serve time for {charge}, a jury decided in {when}',
  ],
  high: [
    '{who}, {age}, is going away for {charge}',
    'A jury took the county side in {when} and {who}, {age}, is going down for {charge}',
    'It took a jury one afternoon to end {who}, {age}, on a {charge} charge',
  ],
}

export const COURT_QUOTES: Readonly<Record<Grit, readonly string[]>> = {
  low: [
    'The court heard the evidence and reached its verdict.',
    'This is what the process is for.',
  ],
  medium: [
    'People here knew it was coming. Everybody did.',
    'It is a small town. There is nowhere to put a thing like that.',
  ],
  high: [
    'Everybody in this town knew. Nobody said a damn word until it was too late.',
    'You live next to somebody twenty years and then you read that in the paper.',
  ],
}

// ---------------------------------------------------------------------------
// The ticker
// ---------------------------------------------------------------------------

/** The kicker over the lead story, by what the story is. */
export const KICKERS: Readonly<Record<string, string>> = {
  'died-in-service': 'Breaking · The Front',
  crime: 'Courthouse',
  war: 'War & Nation',
  local: 'Local',
}

// ---------------------------------------------------------------------------
// The war
// ---------------------------------------------------------------------------

/** How a war report opens. `{a}`/`{b}` are the belligerents. */
export const WAR_OPENERS: Readonly<Record<Grit, readonly string[]>> = {
  low: [
    '{a} and {b} remain at war as of {when}',
    'The war between {a} and {b} continued through {when}',
    'Fighting between {a} and {b} went on into {when}',
  ],
  medium: [
    '{a} and {b} were still at it in {when}',
    'The war with {b} ground into {when}',
    'Another month of it: {a} and {b}, {when}',
  ],
  high: [
    '{a} and {b} spent {when} killing each other',
    'The war with {b} is still eating people in {when}',
    'Nothing moved in {when} except the casualty lists',
    '{when}, and the war with {b} has not finished with anybody yet',
  ],
}

/** What the dead are called, by register. */
export const CASUALTY_CLAUSES: Readonly<Record<Grit, readonly string[]>> = {
  low: ['{n} are recorded dead on both sides'],
  medium: ['{n} dead between them so far', 'the count stands at {n} dead'],
  high: [
    '{n} bodies between them and no ground to show for it',
    '{n} dead, and the line is where it was',
    '{n} killed so far, most of them somebody\u2019s twenty-year-old',
  ],
}
