# Military and War Foundation

**Planning only. No combat simulation is implemented, and none should be.**
This is a Layer 4 domain. See `MILESTONE_PLAN.md`.

The purpose of writing it now, years before it is built, is to fix the boundaries
while they are still cheap to draw — and to record the design decisions that Layers
1–3 must not accidentally foreclose.

---

## 1. Design intent

Military service must be one of the deepest career ecosystems in the simulation,
supporting both long peacetime careers and dangerous wartime service in which injury,
capture, disability, and death are genuine possibilities.

Two failure modes to avoid, in both directions:

- **Glorification** — service as pure heroism, medals as achievements, war as
  spectacle.
- **Reduction to trauma** — service as pure damage, every veteran broken.

Both are false and both are disrespectful. Represent service, camaraderie, pride,
opportunity, training, growth, bureaucracy, boredom, sacrifice, stress, risk, injury,
disability, loss, family strain, transition, lifelong friendship, and legacy — because
all of those are real, and which ones a given person experiences depends on their
circumstances.

---

## 2. The permanent rule

> **War, deployment risk, homeland vulnerability, casualties, operational assignments,
> and campaign eligibility are generated from the simulated geopolitical state — never
> from predetermined country-specific danger ratings.**

**No location has a fixed danger value.** A deployment to a given country during
peacetime might mean logistics, exercises, deterrence, maintenance, and routine base
operations. The same location during a major conflict with a capable neighbour might
mean missile attack, drone attack, sabotage, supply interruption, evacuation, base
attack, or mass-casualty response.

If danger is ever implemented as a lookup table keyed on country, the design has failed.

---

## 3. Fictional world constraint

**Amended 2026-08-02 with milestone W2, exactly as ADR-0020 §3 pre-authorized.
The scope of "fictional" narrowed from *all* countries to *foreign* ones; nothing
else in this section changed, and nothing about foreign theatres has moved.**

All countries **other than the homeland**, and all factions, alliances, conflicts,
named military units and awards, are **fictional and generated**, in every preset,
permanently. See `PROJECT_CHARTER.md` §2 and R-14.

(The first draft of this amendment wrote "all FOREIGN countries, factions, alliances
and conflicts", which let FOREIGN distribute across the whole list and quietly left a
DOMESTIC faction or conflict uncovered. Nothing exploited the gap; the wording above
is what ADR-0020 §3 actually authorized.)

The HOMELAND is defined by the world's preset (ADR-0020): fictional in Classic ("the
Republic"), the United States in American Heartland. Service BRANCHES follow the
homeland — real by NAME only, never with insignia, which are licensed. Named units
never do: a real unit carries real casualty history and living members.

This is not only legal caution. Modelling real wars means either misrepresenting real
events or building a game where real casualties are a mechanic. A generated
geopolitical world lets the system model *how conflicts work* without claiming
anything about any actual war, and it makes every playthrough different. That
argument is about the WARS, which is why it survives the homeland becoming real: the
Republic's wars and the United States' wars in this simulation are equally generated,
against equally invented enemies.

Real US geography may be used for domestic installations. Foreign theatres are
fictional.

---

## 4. Geopolitical state model

The world holds a set of generated countries, each with capability characteristics
(military strength, economy, technology, stability, alliances) and a relationship
state with each other country.

**Relationship states**, roughly ordered by escalation: peace · diplomatic tension ·
sanctions · proxy conflict · border dispute · insurgency · limited operations ·
regional war · major interstate war · coalition war · homeland attack · ceasefire ·
occupation · postwar stabilization.

Transitions are driven by simulated causes — resource competition, alliance
obligations, internal instability, leadership change, escalation from a lower state —
and each transition carries a causal record. **A war must be explainable.**

**Conflict phase** matters as much as conflict existence: opening operations, attrition,
stalemate, offensive, collapse, and stabilization phases produce very different risk
profiles at the same location.

---

## 5. Deriving deployment danger

Danger is computed per assignment from the factors below. This list is the design
contract; the weighting model is deliberately unspecified until implementation.

| Factor | Effect |
|---|---|
| Which countries or factions are fighting | Sets the baseline threat |
| Relative capability of each side | A capable enemy threatens rear areas, not just the front |
| Geography and distance from the front | Primary driver of ground-threat exposure |
| Nearby bases and infrastructure | Concentration attracts targeting |
| Air superiority and air defence | Gates the air and missile threat |
| Missile, drone, artillery, naval, cyber, insurgent, sabotage threats | Each modelled separately — they do not co-vary |
| Supply-line security | Drives convoy exposure and sustainment risk |
| Intelligence quality | Poor intelligence increases surprise |
| Local political stability | Drives insider and insurgent threat |
| Rules of engagement | Constrains both exposure and response |
| Mission type | See §6 |
| Unit type and occupational specialty | See §7 |
| Defensive preparation | Hardening, dispersal, warning systems |
| Medical support | Converts wounds into survivals — or does not |
| Conflict phase | The same place is different in week one and year three |

**Danger is a vector, not a scalar.** A logistics hub may have high missile exposure
and near-zero small-arms exposure. Collapsing that into one number destroys exactly
the distinctions this system exists to model.

---

## 6. Theatre and mission modelling

Every deployment defines: theatre and operating area · mission and strategic
objective · unit and command relationship · enemy, friendly, and coalition forces ·
threat environment (the §5 vector) · supply conditions · medical support ·
communications reliability · expected and actual duration · operational tempo · rules
of engagement.

**Mission types.** Ground combat · air defence · logistics · transportation ·
intelligence · aviation · cyber · medical · base security · convoy operations ·
humanitarian relief · evacuation · peacekeeping · deterrence · training allied forces ·
maritime operations · disaster response · occupation · stabilization · search and
rescue · maintenance · procurement · sustainment.

Note how many of these carry little or no combat exposure. That is accurate and
important — most military work is not combat, and a simulation that treats deployment
as synonymous with fighting would be badly wrong about what service is like.

---

## 7. Occupational exposure

> **Infantry, ammunition, aviation, maintenance, medical, intelligence, cyber,
> logistics, transportation, and administrative personnel deployed to the same country
> must not receive the same experience.**

Each occupational specialty carries an exposure profile: which threat vectors it is
subject to, how often it leaves a secured area, what it does day to day, what skills
it develops, and what it can transfer to civilian work.

This single distinction does more to make military careers feel real than any combat
model. Two characters, same war, same country, same year, radically different lives —
and both authentic.

---

## 8. Combat and operational resolution

**Possible outcomes.** No direct exposure · indirect fire · drone or missile attack ·
convoy attack · aircraft incident · naval engagement · ground combat · cyber
disruption · base attack · injury · illness · psychological trauma · permanent
disability · missing in action · capture · rescue · death.

Non-combat outcomes — accident, illness, vehicle mishap — must be represented. They
are a real and substantial share of military casualties, and omitting them would
misrepresent service.

### Death must be traceable

**Character death in service is a genuine possibility.** It must never be an
unexplained hidden roll.

Death results from a traceable combination of: assignment, location, mission, threat
environment, enemy capability, friendly preparation, equipment, leadership,
intelligence, training, decisions, and medical response — plus seeded uncertainty
within an explainable resolution model.

The causal record must let the player later understand why. Compare
`CAUSAL_RECORDS.md` §6 — the outcome is Defining and permanent.

### Asymmetric information

**The character does not know what the player later learns.** A soldier does not know
the intelligence assessment that routed their convoy. During the event, the character
acts on what they could plausibly know. Afterwards, in the historical record, the
player may see the full chain.

This asymmetry is the whole emotional weight of the system. Preserve it carefully.

---

## 9. Scale and consequences

**Wars do not revolve around the player.** A character may serve an entire conflict
without witnessing a decisive engagement. That is both realistic and, done well, more
affecting than the alternative.

The broader simulation may model: military and civilian casualties · mobilization ·
Reserve and Guard activation · recruiting and retention shifts · expanded-service
policy where the setting supports it · defence spending · equipment shortages ·
production increases · fuel and commodity prices · supply-chain disruption · refugees ·
infrastructure damage · public opinion · elections · protests · media coverage ·
alliances · sanctions · recession · reconstruction · returning veterans · long-term
regional instability.

This is where Law 4 pays off: a war that the player's character never sees still moves
their spouse's job, their town's economy, and their child's opportunities.

---

## 10. Career structure

Branches and components (active, Reserve, Guard) · enlistment contracts · ROTC and
academies · officer, warrant, and direct-commission pathways · prior-service entry ·
medical and background eligibility · aptitude testing · career-field selection ·
initial and occupational training · unit assignments and duty stations · permanent
change of station · overseas and temporary duty · deployments, rotations, exercises ·
schools and qualifications · evaluations and promotions · reenlistment and retention ·
awards · badges and skill identifiers · disciplinary action · medical profiles ·
injury, disability, separation, retirement · veteran transition · complete service
records · generational military history.

Careers must support anything from a single enlistment to several decades, with
multiple duty stations, specialty changes, leadership roles, instructor and recruiting
duty, staff and joint assignments, promotion non-selection, demotion, commissioning,
medical retirement, and recall.

**Every career produces a persistent service record.** That record is the artifact a
descendant finds three generations later.

---

## 11. Awards and decorations

**Awards are earned from documented service events, never granted as progression
rewards.**

Categories: personal decorations (achievement, commendation, meritorious service,
valor) · good conduct · campaign, expeditionary, overseas-service, deployment, and
humanitarian recognition · unit awards · qualification, occupational, combat, aviation,
and marksmanship badges · school badges and tabs · wound recognition · prisoner-of-war
recognition.

**Every award record retains:** award type · date · the qualifying event (a reference
to the actual simulated event, not a description) · issuing authority · citation ·
service-record entry · uniform display position · devices or additional-award indicators.

### Eligibility is strict

- **Wound recognition** (Purple Heart or legally safe equivalent) requires a qualifying
  wound or death *resulting from enemy action*. Nothing else. This must be enforced
  in code and tested, not left to the resolution model.
- **Campaign and expeditionary recognition** requires qualifying service — location,
  dates, mission, conflict, and duration all checked against the eligibility rule.
- **Valor decorations** require a documented qualifying action with a causal record.

Long careers naturally produce larger ribbon racks, but **a rack must reflect actual
qualifying service, never cosmetic leveling.** Uniform display follows documented
precedence and placement rules.

Insignia, patches, medals, and uniform elements are **original fictional artwork**.
Preserve authentic structure, progression, and meaning — the visual storytelling of a
rack is the point — without reproducing real designs.

---

## 12. Schools and qualifications

Attendance depends on branch, occupation, rank, unit requirements, performance,
physical and medical eligibility, seat availability, career goals, leadership
recommendation, and operational need.

Schools affect skills, assignments, promotion competitiveness, unit role, pay,
reputation, deployment responsibilities, uniform appearance, and civilian
employability.

**Schools must teach something that changes the simulation.** A school that only adds
an icon is a collectible, and Gate 2 rejects it.

---

## 13. Units and unit history

Units maintain persistent histories: formation, lineage, missions, duty locations,
campaigns, deployments, commanders, honours, unit awards, casualties, traditions,
major incidents, and former members.

This enables one of the strongest generational moments the design offers: a character
discovers that a great-grandparent served in the same unit, at the same installation,
or in the same campaign. **The unit history must be real simulation data for this to
land** — it cannot be generated at the moment of discovery, or it will contradict
something.

---

## 14. Family consequences

Service may affect marriage, parenting, friendships, household finances, housing,
education, health, mental health, child development, relocation, caregiving, family
planning, divorce risk, relationship strength, and community ties.

**Deployment must not automatically damage relationships.** Effects depend on
communication, trust, duration, prior relationship condition, family support,
operational conditions, personality, coping, and finances. Some relationships are
strengthened by service. Modelling only the damage would be both inaccurate and
disrespectful.

---

## 15. Veteran life

Service remains part of identity after separation: civilian employment · transferable
skills · education benefits · disability · healthcare · retirement pay · Reserve
obligations · reunions · veteran organizations · military friendships · leadership
identity · transition difficulty · family adjustment · public service · political
activity · entrepreneurship · memorial participation · survivor guilt · pride · grief ·
long-term health consequences.

Veteran status must produce **varied** outcomes across characters. If every simulated
veteran has the same arc, the model is wrong.

---

## 16. Explainability requirements

Every major military outcome retains a causal record: why this assignment, why this
deployment, why the tour was dangerous or quiet, why combat occurred, why an injury or
death happened, why an award was granted or denied, why a promotion was won or missed,
why a school was attended, why the character was retained, separated, or retired.

Military events emerge from the simulated world, conflict, unit, mission, and person.
**No scripted encounters.**

---

## 17. What Layers 1–3 must not foreclose

The reason this document exists now. When building earlier layers, preserve:

| Requirement | Why |
|---|---|
| Person records support extensive typed history | Service records are large and structured |
| Causal records support Defining permanence | Awards and casualties are permanent |
| The relationship graph supports non-kin persistent bonds | Unit friendships last decades |
| Places support institutional history | Installations and units accumulate lineage |
| Health supports permanent disability, not just illness | Service-connected disability is lifelong |
| Geography supports foreign locations | Deployments are overseas |
| The event system supports world-level events affecting many people at once | Wars are not per-person events |

None of these require building anything now. They require **not painting into a corner**
— which is exactly what a foundation phase is for.

---

## 18. Scope warning

Honestly: this document describes a system as large as everything in Layers 1–3
combined. It is the deepest single domain in the design.

It sits in Layer 4 for a sound reason — it depends on people, relationships, health,
careers, geography, families, and history all working first. A military system built on
a nonexistent person model would simulate nothing.

If this is the part of the project you most want to build, the fastest route to it is
still finishing Layers 1–3. But see `MILESTONE_PLAN.md`'s closing note: if motivation
requires pulling a thin slice of service forward earlier, that trade is available and
is a legitimate choice, not a failure of discipline.
