# Player Experience Audit — where the game decides for the player

**Status: audited, 2026-08-01 (owner direction).** New simulation
institutions are PAUSED after C1. The finding in one sentence: the
simulation is far richer than the play — 19 decision surfaces exist, the
military tab is the only complete goal→choice→consequence loop, and five of
seven domains are watch-and-wait for a played life. The redesign principle
is the codebase's own established pattern, applied everywhere: **the
simulation stays authoritative; choices are raised at moments the
simulation already models, resolved through the same shared functions the
auto path uses** (hirePerson / enrolPlayer / promoteToCourting /
promoteToSpouse / performSeparation / deliverChild / enlistPerson), or
initiated by player verbs that log-before-roll with honest refusal reasons
(the applyForJob pattern, player.ts:212-279).

## What exists (the 19 + 7)

Pendings (clock halts): education fork, job offer, better job, move-out,
move-house up/down, child, retirement, courtship, marriage, separation,
convalesce, recruiter enlist, specialty, promotion board, service school
slot, volunteer-deploy, reenlist, combat moment. Verbs: apply-for-job,
walk-in enlist, request school, unit tryout, train fitness, volunteer
rotation, custom birth. The Service tab is the standard: verbs, visible
board standing, refusal reasons in words (GameScreen.tsx:660-855).

## Agency deficit, ranked (worst first)

1. **Crime** — zero player surface by design; C2's desperation pending +
   plea question already specced (CRIME_PLAN.md), the modelled moments and
   salted streams already exist. Cheapest big win.
2. **Finances** — most-watched number, no verbs: spending is a trait
   formula (finances.ts:134-174), move destinations are engine-picked
   (`rng.pick`, systems.ts:568/608), no move can be initiated, Home-tab
   ledger doesn't reconcile with the money chip (no lifestyle line).
3. **Relationships** — cannot befriend, court, propose, separate, tend, or
   try for a child; every moment is an engine-timed veto. Courtships
   cannot even END (event exists in schema, emitted nowhere).
4. **Education** — one fork at 18, closed forever (`hasAnswered`,
   systems.ts:191) while NPCs keep rolling to 24; no adult study.
5. **Health** — convalesce asks once per ailment at ≥500 only; stance
   unchangeable; worsening silent.
6. **Careers** — Apply exists; cannot quit, ask for a raise, pick a
   workplace; dismissal arrives with no warning moment; performance
   invisible.
7. **Military** — near complete; residuals: request discharge (honest
   refusal at minimum), specialty change at reenlistment.

## The redesign — three milestones plus C2

### P1 — The record reads back (explanations; smallest, first)

Every choice visible, every "Why?" answerable. From the audit's C-list:
- Why? mappings missing in EVENT_EXPLAINED_BY (records.ts:105-126):
  enlisted, discharged, deployed, wounded-in-action, started-school,
  reenlisted.
- Choices recorded but invisible (no event): convalesce stance, board
  pass, combat keep-down, reconcile. Add feed events (SIMULATION_VERSION
  bump, shape-only behavior).
- A father never sees his child born ('had-child' subject=mother only;
  eventsFor misses him). Fix visibility.
- Stakes screens gain the modelled facts they omit: education (pay ranges
  per tier, course length), courtship/marriage (compatibility, strength),
  child (monthly cost vs net), separation (the named strains), convalesce
  (severity, mark risk), specialty (civilian unlocks).
- Home tab ledger reconciles to the cent (add the lifestyle-spend line).
- Colliding questions: asked-class pendings defer 1-2 months instead of
  silently dropping (promotion board's log-driven retry is the template,
  service.ts:698-704; raisePending currently drops, player.ts:545).

### P2 — The verbs (initiate what the sim already models)

All log-before-roll with honest refusals, resolved through existing shared
functions; every verb records own-choice:
- Relationships: court <friend> (gates: couldCourt + strength),
  propose (gates: 540/14mo), separate (allowed always; record carries
  own-choice without inventing drift), tend-the-marriage (cooldown,
  smaller reconcile effect), spend-time-with <friend>, try-for-child
  (birthEligible gates it; conception stays a draw), end-courtship (also
  gives the sim its missing courtship-ended path).
- Careers: quit, ask-for-a-raise (rolls against modelled performance +
  headroom), apply-at-<workplace>, the foreman's-warning pending at the
  modelled dismissal threshold.
- Education: re-enrol 18-24 (same window NPCs already get), through
  enrolPlayer.
- Finances: household stance (thrifty/normal/loose) read by
  discretionaryFor; look-for-a-place-in-<neighbourhood> verb; move
  pendings present the (already deterministic) candidate list, not one
  pick.
- Health: convalesce stance repeatable monthly while ailing.
- Military: request-discharge (honest refusal during term/stop-loss),
  retrain question at reenlistment.
- Crime C2 lands here or immediately after (its own milestone below).

### P3 — The surfaces (hold everything to the Service-tab standard)

- Relationships tab: people with strength/duration/compatibility + the P2
  verbs. (Queries exist: relationshipsOf, compatibility, partnerOf.)
- Finances tab: full monthly ledger (wages, service pay, pension, rent,
  living, lifestyle, net), arrears history, affordable-streets browser.
- Education/skills view incl. visible job performance.
- Record view (convictions, sentences, what still gates — feeds C2).
- Traits sheet in words ("diligent, restless") so Why? texts land.
- Stats tab surfacing D1 demographics in-game.

### C2 — the player and the law (unchanged spec, folded into this arc)

Desperation pending with both roads real, the plea question, months served
on-screen, the record following into applications. CRIME_PLAN.md:52-55.

## Ordering note

D2 (DEMOGRAPHICS_AUDIT.md) precedes P2: partner-seeking gives relationships
their initiating moments — building court/propose verbs against today's
starved pipeline would ship verbs with nobody to use them on.

Every P-milestone: twin-world tests (played choice = auto path byte-exact),
architecture-reviewer on decision logic, scope-risk-reviewer if a milestone
grows past this page.
