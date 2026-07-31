# Product Roadmap

**How the game reaches players.** Companion to `MILESTONE_PLAN.md`, which covers how
the software gets built.

Every stage below is gated on **criteria, not dates**. A player count is a size, not a
decision — what matters is what must be true before you invite people, and what you are
trying to learn from them.

---

## 1. Why this document exists

The technical plan is thorough about construction and silent about distribution. That
gap matters more for a web application than it would have for a desktop game: the whole
point of ADR-0009 is that the game is a URL you can send to someone.

It also matters because **players change the engineering constraints.** Once other
people have saves, you can no longer casually change the save format. That ratchet is
the single most important interaction between this document and the technical plan, and
it is covered in §8.

---

## 2. Stages at a glance

| Stage | Players | Gated on | What it tests |
|---|---|---|---|
| **Prototype** | 1 — you | Milestone 2 | Is the simulation interesting at all? |
| **Private showing** | 3–5 people you know | Milestone 5 | Does it make sense to anyone but you? |
| **Closed alpha** | ~25 invited | Milestone 6 | Does it survive real accounts and real usage? |
| **Closed beta** | ~250 invited | Alpha exit criteria | Does it hold interest across generations? |
| **Public beta** | Open registration | Beta exit criteria | Does it survive strangers and scale? |
| **1.0** | Public | Beta exit criteria | Is it a product rather than a project? |

**Private showing** is an addition to the suggested plan. Going from an audience of one
to twenty-five in a single step skips the cheapest feedback you will ever get. Three
people at a kitchen table will find problems that twenty-five strangers will only be
annoyed by.

---

## 3. Prototype — only Ethan plays

**Gate: Milestone 2 complete.** A web page where people age, get jobs, move, and die.

**What you are testing.** The honest one, from `PROJECT_CHARTER.md` §6: *is reading a
simulated person's life story actually interesting?* If it is not interesting to you —
the person who wanted this built — it will not be interesting to anyone.

**Exit criteria.**

- You have advanced a simulation fifty years without getting bored
- At least one generated life surprised you
- You can explain why an event happened, and the explanation is true

**Do not skip past a failure here.** If the simulation is not compelling to its author,
adding players does not fix that. It is a design problem, and it is far cheaper to fix
now than after 250 people have opinions about it.

---

## 4. Private showing — 3 to 5 people you know

**Gate: Milestone 5 complete.** Relationships work; lives have shape.

**Format.** Sit with them, or share a screen. Watch them use it. Do not explain
anything unless they ask — the moment you have to explain something is the moment you
found a design bug.

**What you are testing.** Comprehensibility. You have spent a year inside this system
and cannot see it fresh anymore. They can.

**Exit criteria.**

- Someone who has never seen it can advance a life and describe what happened
- Nobody needed you to explain the core loop
- At least two people asked "what happens if…" — genuine curiosity, not politeness

**Cost: essentially zero.** No accounts needed; they can use your machine or a local
build. This is the highest-value, lowest-cost feedback in the entire roadmap.

---

## 5. Closed alpha — ~25 invited players

**Gate: Milestone 6 complete.** Accounts, cloud saves, security review passed, a
restore from backup actually performed.

**What you are testing.** Whether the *system* works, not whether the game is good. Real
accounts, real browsers, real devices, real save sync, real edge cases.

**Entry criteria — all required.**

- `web-security-reviewer` pass with no must-fix findings
- A backup restore has been performed, not merely configured
- A privacy policy exists and is accurate
- A way for players to report problems
- **A way to delete an account and its data**

**Exit criteria.**

- Two weeks with no data loss and no security incident
- Save sync works across at least three different browsers
- You have received and acted on at least ten pieces of feedback
- Nothing in the crash or error log is unexplained

**Recruiting.** Invite people who will actually tell you it is boring. Friends who want
to be encouraging produce pleasant, useless data.

**Set expectations in writing.** Say plainly: this is alpha, saves may be reset, things
will break. Then honour it — if you say saves may be reset, you may reset them; if you
did not say so, you may not.

---

## 6. Closed beta — ~250 invited players

**Gate: alpha exit criteria met.**

**What you are testing.** Retention across generations, and whether procedural lives
stay interesting — R-15, the risk hardest to mitigate through architecture and the one
most likely to determine whether this is actually fun.

**Entry criteria.**

- Alpha exit criteria met
- Save migrations tested against real alpha saves, not fixtures
- Basic analytics in place (§9) — you cannot learn from 250 players by reading emails
- A feedback channel that scales past your inbox

**Exit criteria.**

- A meaningful share of players reach a second generation
- Median session is long enough to suggest engagement rather than curiosity
- No unresolved data-loss reports
- You know why people stop playing — this is the single most valuable thing beta produces

**The hard truth to prepare for.** Most people invited to a beta never play it. That is
normal and is not a verdict on the game. Judge by the behaviour of people who *did*
play, not by the invite-to-signup ratio.

---

## 7. Public beta and 1.0

### Public beta — open registration

**New problems, none of them simulation problems:** anyone can sign up, hosting cost
becomes real and variable, abuse and spam accounts appear, and support volume stops
being answerable one email at a time.

**Entry criteria.** Beta exit criteria met · rate limiting and abuse controls verified ·
hosting cost per user measured and affordable at 10× current load · a documented plan
for what happens if it gets unexpectedly popular.

That last one is not optimism. A single post landing well can multiply traffic
overnight, and the failure mode is a hosting bill you did not agree to.

### 1.0

1.0 means **"I am willing to support this,"** not "I ran out of features."

**Entry criteria.** Public beta stable for a sustained period · save format stable
across at least two migrations · you can keep it running at current scale without
resenting it.

The suggested 1.0 scope — marketing, subscription, analytics, Discord, feedback system —
is four operational commitments and one technical one. Each is addressed below.

---

## 8. The save-compatibility ratchet

**The most important thing in this document.**

| Stage | What breaking the save format costs |
|---|---|
| Prototype | Nothing. Delete and regenerate. |
| Private showing | Nothing. |
| Closed alpha | An apology, if you set expectations up front. |
| Closed beta | 250 people lose progress. Most do not come back. |
| Public beta | Reputational damage you cannot undo. |
| 1.0 | Unacceptable. |

**Consequence:** migration discipline stops being good practice and becomes an
obligation at closed alpha. `MILESTONE_PLAN.md` M4 builds migration infrastructure
before Milestone 6 for exactly this reason — the ordering is deliberate, not incidental.

**Practical rule.** From closed alpha onward, every schema change ships with a migration
tested against a real save exported from the previous stage. Not a fixture. A real one.

---

## 9. Analytics — useful and narrow

You need to know why people stop playing. You do not need to know everything they do.

**Worth measuring.** Where players stop in their first session · how many reach a second
generation · which features are never used · error and crash rates · save sizes and tick
times in the wild.

**Not worth collecting.** Anything identifying an individual beyond the account that
already exists · detailed behavioural profiles · anything you cannot state plainly in
the privacy policy · anything you have no specific plan to act on.

**Rules.**

- Whatever is collected must be disclosed in the privacy policy, in plain language
- Prefer aggregate counts to per-player event streams
- **Consent where required.** Privacy law varies by jurisdiction and changes; verify
  current obligations against a real source before public beta rather than relying on
  this document or any AI's recollection
- Analytics is user data. R-21 applies to it in full

The cheapest useful analytics is often a single question asked at the right moment:
*"you stopped playing — mind saying why?"*

---

## 10. Community and support — the ongoing cost

**Discord and a feedback system are permanent staff obligations, not features.** They
are the parts of this roadmap most likely to consume the 10 hours a week that were
supposed to go into building the game.

**Before opening a Discord, decide:**

- Who moderates it, and when they sleep
- What the rules are, written down before they are needed
- What happens when nobody has answered a question for three days

**A specific consideration for this project.** The design includes war, casualties,
military service, mental illness, addiction, crime, and inequality. A community around
it will discuss those topics, and some participants will have lived them. That needs
moderation norms set deliberately in advance — the same care Law 10 demands of the
simulation applies to the space around it.

**A lighter alternative worth considering.** A simple in-app feedback form plus a
public changelog delivers most of the value of a community for a fraction of the
ongoing cost. Discord is a good choice when there is a community to serve; it is a poor
choice as a way to create one.

---

## 11. Monetization — an open question, not a decision

**Recorded as ADR-0015, status `Proposed`. Do not treat subscription as settled.**

A subscription is not a feature. It is an ongoing commitment involving payment
processing, refunds and chargebacks, sales tax or VAT obligations that vary by
jurisdiction, terms of service, and — most significantly — **an obligation to keep the
service running for as long as people are paying.**

It also sits in tension with `PROJECT_CHARTER.md` §5, which rejects "microtransactions
or live-service" on the grounds that they distort design away from believability. A
subscription is not microtransactions, but the pressure it creates — to add retention
mechanics, to keep players logging in — is precisely the pressure that non-goal exists
to resist.

**Options, unranked and undecided.**

| Option | Trade |
|---|---|
| **Free, no monetization** | Simplest. You absorb hosting cost. No obligations. Sustainable only while costs stay small. |
| **Free with optional support** | Donations or a tip jar. No entitlement created, no tax complexity at small scale. Rarely covers costs. |
| **One-time purchase** | No recurring obligation, no live-service pressure. Fits the charter best. |
| **Subscription** | Predictable revenue; heaviest obligation; strongest pull toward retention mechanics. |

**Recommendation: decide this at public beta, not before**, and decide it with real
hosting-cost data from the closed beta rather than an estimate. Anything decided now is
a guess about a business that does not exist yet.

**Verify before committing to anything.** Payment processor fees, tax registration
thresholds, and the obligations that attach to recurring billing all vary by
jurisdiction and change over time. This document is not a source for any of that.

---

## 12. Marketing — realistic for one person

**What works for a project like this:** showing the thing itself. A generated life story
that is genuinely surprising is better marketing than any description of the systems
that produced it.

**Sustainable at 10 hours a week.** A devlog you actually maintain · posting interesting
generated lives · a public changelog · communities where simulation-game players
already are.

**Not sustainable.** Paid advertising with no revenue · a content schedule competing
with development time · anything requiring daily presence.

**Timing.** Meaningful marketing starts at public beta. Before that, an audience you
cannot yet serve is a liability — interest generated a year early is interest that has
evaporated by the time you can use it.

---

## 13. Honest timing

| Stage | Earliest realistic |
|---|---|
| Prototype | ~3–4 months in |
| Private showing | ~9–12 months in |
| Closed alpha | ~12–18 months in |
| Closed beta | Meaningfully later |
| Public beta / 1.0 | Not usefully estimable from here |

These follow from `MILESTONE_PLAN.md` at ~10 hours a week. Summing the individual
milestone estimates gives a more optimistic answer; the figures above deliberately do
not, because solo projects slip and estimates made before writing a line of code are
the least reliable ones you will ever produce.

**The stages beyond closed alpha are not estimable and should not be scheduled.** What
you learn from the first 25 players will change what the later stages should even be.

---

## 14. What this does not change

The technical plan stands. Nothing here reorders a milestone or adds engineering scope
before Milestone 6.

Two additions to how existing work is done:

1. **Migration discipline becomes an obligation at closed alpha** (§8), which is why M4
   builds it before M6 needs it.
2. **Analytics and account deletion are alpha entry criteria**, not 1.0 features. Both
   are far cheaper to build before there are users than after.

The three Critical risks in `RISK_REGISTER.md` — scope, resources, motivation — apply to
this document too. A roadmap with six stages is not a commitment to reach stage six.
Each stage is a satisfying place to stop, in exactly the way each layer is.
