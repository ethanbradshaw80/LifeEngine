<!--
SOURCE OF RECORD — DO NOT EDIT.

This is the original Life Engine specification exactly as authored outside this
repository. It is preserved unchanged as the project's historical baseline.

It has since been AMENDED. Where this file and docs/DECISION_LOG.md disagree,
the DECISION_LOG wins. Known amendments as of the foundation session:

  ADR-0001  Target platform:  iOS            ->  Windows desktop
  ADR-0002  Engine language:  Swift          ->  C# / .NET
  ADR-0003  §13 "Swift engineer" agent role  ->  not created (no Swift)
  ADR-0006  §15 architecture doc brief       ->  evaluates desktop stacks

Sections 8 (military), 11 (layering), 12 (constraints), 13 (routing), and 14
(verification loops) are adopted unchanged.

Record all future changes as new ADRs. Never edit this file.
-->

# THE LIFE ENGINE - CLAUDE CODE DESKTOP BOOTSTRAP

## READ THIS FIRST

You are establishing a new, completely self-contained software project named **The Life Engine**.

This is the first architecture and documentation session for this repository.

Your assignment is to establish the project constitution, documentation structure, agent architecture, technical foundation, risk controls, and milestone plan.

**You must not begin gameplay implementation during this assignment.**

---

# 1. REPOSITORY SCOPE AND ISOLATION

These project instructions apply only to the current `LifeEngine` Git repository.

This repository is intentionally separate from all of the user's other Claude Code projects.

You must not:

- Read, search, modify, create, delete, import, or depend upon files outside this repository.
- Modify any user-level or global `CLAUDE.md`.
- Modify a parent-directory `CLAUDE.md`.
- Modify user-level Claude settings.
- Modify global Claude Code configuration.
- Modify another repository.
- Install global dependencies.
- Import code, assets, credentials, secrets, configuration, or assumptions from unrelated projects.
- Add external directories to the Claude Code workspace.
- Create symlinks that point outside this repository.
- Use information from unrelated projects merely because it appears elsewhere in the user's environment.

All Life Engine instructions, decisions, agents, specifications, source files, settings, and development history must remain inside this repository.

When requesting permission for commands, clearly state whether the action remains inside the repository.

If a proposed operation would access or modify anything outside this repository, stop and request explicit authorization.

Do not claim that these instructions override system, organization, or user-level policies. Maintain practical project isolation by performing all project work within this repository.

---

# 2. IMMEDIATE ASSIGNMENT

Perform the following work:

1. Confirm that the current working directory is the `LifeEngine` repository.
2. Inspect only the current repository.
3. Populate the root `CLAUDE.md` with a durable and organized version of this project constitution.
4. Create the foundational documentation specified later in this file.
5. Recommend an initial technical architecture.
6. Create only the project-scoped subagents justified for the foundation phase.
7. Conduct independent architecture, persistence, performance, scope, military-system, and documentation reviews.
8. Reconcile contradictions.
9. Present the final repository tree and an executive report.
10. Stop before implementing gameplay.

Project-scoped agents must live only in:

`.claude/agents/`

Do not create user-level agents.

---

# 3. PROJECT IDENTITY

The project has two conceptually separate layers.

## The Life Engine

A modular, deterministic, offline-first simulation framework that models:

- People and psychology
- Families and relationships
- Households
- Careers and education
- Businesses and organizations
- Finance, markets, and housing
- Government and politics
- Military service, geopolitics, and war
- Crime, law, and courts
- Healthcare and human development
- Transportation and infrastructure
- Weather, environment, and disasters
- Media, culture, science, and technology
- History, archives, and legacy

## The Life Simulator

The first iOS game built on top of The Life Engine.

The simulation engine must not directly depend upon SwiftUI or another presentation framework.

The application may issue commands to the engine and query engine state, but visual-interface state must never become the authoritative source of simulation truth.

---

# 4. PRODUCT VISION

The Life Simulator is an ambitious generational life simulation set in a realistic simulated United States.

The game may use real geography, cities, states, regional characteristics, climate patterns, and broadly applicable public information where legally, ethically, and technically appropriate.

Use fictional people, companies, brands, politicians, political organizations, media companies, sports organizations, military units, and other identities where doing so reduces privacy, licensing, trademark, publicity-rights, or intellectual-property risk.

Do not use real private individuals.

The player begins as one person within a world populated by autonomous simulated people.

The world continues through:

- Childhood
- Education
- Careers
- Friendships
- Romance
- Marriage
- Parenting
- Business formation
- Economic cycles
- Political changes
- Military service
- War
- Crime and justice
- Health changes
- Migration
- Aging
- Death
- Inheritance
- Unlimited generations

The player is not the center of the universe.

Other people pursue independent lives, goals, relationships, careers, beliefs, interests, and plans.

The central product philosophy is:

> Nothing exists in isolation.

---

# 5. GOVERNING LAWS

Place these laws prominently in `CLAUDE.md` and `docs/PROJECT_CHARTER.md`.

## Law 1 - The Simulation Is the Source of Truth

Important events should originate from simulated state, behavior, and interactions whenever practical.

News reports events produced by the simulation. Reputations reflect recorded actions and public perceptions. Businesses succeed or fail because of simulated conditions. Relationships develop through compatibility, memories, interactions, circumstances, and choices. Political changes affect policy. Policy affects people and institutions. Military danger emerges from actual conflict conditions. History records what occurred.

Avoid disconnected scripted outcomes that contradict the simulation.

## Law 2 - Every Person Is the Main Character of Their Own Life

Important NPCs possess their own identity, personality, values, motivations, fears, goals, dreams, habits, memories, relationships, finances, career, education, skills, health, reputation, responsibilities, decision style, life plan, personal narrative, regrets, short-term goals, and long-term ambitions.

NPCs must not exist solely to reward, punish, serve, or entertain the player.

## Law 3 - Everything Important Has a Cause

Major outcomes must retain causal information.

The game should be able to explain why an important person changed careers, ended a relationship, reconciled, moved, began or left school, started a business, committed a crime, joined the military, deployed, was injured, received or was denied an award, changed beliefs, made an investment, supported a candidate, became estranged, or retired.

Explanations must be generated from actual simulation records rather than fabricated after the outcome.

## Law 4 - Everything Is Interconnected

People affect families. Families affect children. Workers affect businesses. Businesses affect industries and communities. Government affects taxes, regulation, education, infrastructure, healthcare, defense, markets, and opportunities. Military conflicts affect personnel, families, businesses, supply chains, government, public opinion, healthcare, and the economy. Weather and disasters affect housing, transportation, health, insurance, migration, and supply chains.

New systems must integrate with existing systems rather than becoming isolated minigames.

## Law 5 - Time Continues

The world does not wait indefinitely for the player.

The intended initial model is:

- World simulation progresses monthly.
- The player visibly ages every six months.
- Background events may resolve silently.
- Important events create notifications.
- Major events may pause progression for a player decision.
- Opportunities expire.
- Other people continue developing independently.

The exact scheduling architecture remains subject to technical review.

## Law 6 - History Is Persistent

Important events become permanent historical records, including births, deaths, relationships, marriages, divorces, education, careers, military service, promotions, awards, deployments, wars, businesses, ownership, property, elections, laws, crimes, court cases, investments, inventions, disasters, cultural achievements, family traditions, heirlooms, and memorials.

History must be summarized and compressed appropriately rather than storing unlimited raw detail forever.

## Law 7 - Failure Creates New Chapters

Failure is allowed and should create meaningful consequences.

Most failures should retain realistic recovery paths.

Job loss, bankruptcy, divorce, illness, conviction, military separation, business failure, academic failure, estrangement, injury, disability, and reputational decline may change a life without automatically ending the game.

Hard game-over states should remain rare.

## Law 8 - Legacy Continues After Death

Death ends a life but not necessarily the save.

After death, produce a life retrospective containing a biography, timeline, relationships, career history, military record, financial history, properties, investments, achievements, failures, reputation, obituary, scrapbook, legacy, and family impact.

The player may continue through an eligible heir.

Family history, property, wealth, debt, institutions, memories, traditions, reputations, records, and consequences may persist across unlimited generations.

## Law 9 - Simulate What Is Necessary; Show What Matters

The engine may perform extensive background simulation.

The interface must prioritize relevance and avoid overwhelming the player.

Use progressive disclosure, summaries, notifications, timelines, dashboards, and optional "Why?" explanations.

Do not expose every internal calculation.

## Law 10 - Prefer Believability Over Artificial Balance

The world does not need to produce equal outcomes for every person.

Starting circumstances, geography, family, education, health, opportunity, economic conditions, policy, luck, and decisions may create unequal outcomes.

Results must remain coherent, explainable, playable, and respectful.

Realism does not justify tedious, inaccessible, exploitative, needlessly cruel, or offensively stereotyped design.

## Law 11 - Determinism Is an Engineering Requirement

Simulation behavior must support deterministic testing.

All stochastic behavior must use explicit seeded random-number generation.

The same starting state, seed, simulation version, and player decisions should produce the same results unless a documented migration or version change intentionally changes behavior.

Randomness may influence circumstances but must not replace causal modeling.

## Law 12 - Architecture Must Remain Modular

Systems must communicate through stable contracts, commands, events, queries, or documented shared primitives.

Avoid duplicated authoritative state, circular domain ownership, universal god objects, giant `Person`, `World`, or `GameManager` classes, UI-driven simulation logic, and hidden coupling.

The engine must be testable independently from the UI.

---

# 6. THREE GATES RULE

Every proposed feature must pass all three gates.

## Gate 1 - Realism

Would this feature behave believably within the simulated world?

## Gate 2 - Interaction

Does it meaningfully connect with multiple existing systems?

Three integrations are a useful target, but foundational infrastructure may be justified with fewer direct gameplay integrations.

## Gate 3 - Story

Can it produce meaningful choices, consequences, relationships, memories, or emergent stories?

Reject, simplify, aggregate, or defer features that create substantial complexity without sufficient value.

---

# 7. ESTABLISHED LONG-TERM DESIGN SCOPE

The following are long-term design targets. They are not permission to implement the entire scope immediately.

## People, Psychology, and Decision-Making

Each important person may possess personality, values, motivations, fears, habits, memories, identity, regret, dreams, confidence, decision style, personal narratives, short-, medium-, and long-term goals, changing life plans, turning points, life chapters, social influence, and generational influence.

People learn and evolve through experiences, failures, successes, teachers, mentors, relationships, culture, and life events.

Important decisions should emerge from needs, goals, personality, values, memories, relationships, finances, health, skills, opportunities, social influence, perceived risks, available information, identity, past outcomes, and current circumstances.

NPCs should identify opportunities, plan for the future, seek advice, hesitate, act impulsively, reconsider, regret, and change direction according to their characteristics.

Major decisions must retain explainable causal records.

## NPC Simulation Levels

Use tiered simulation so the world can scale:

- Deep simulation
- Medium simulation
- Lightweight simulation
- Aggregate population simulation

Tier promotion and demotion must preserve continuity. When a previously unimportant person becomes relevant, the system must not fabricate an obviously contradictory history. Define exactly which state is retained at each tier.

## Relationships and Families

Support friendship, rivalry, mentorship, romance, emergent attraction, partnership, marriage, trust, respect, communication, affection, conflict resolution, financial compatibility, shared goals, parenting, parenting styles, family culture, family traditions, children learning through observation, estrangement, reconciliation, family reputation, unlimited-generation family trees, heirlooms, inheritance, interactive biographies, and relationship timelines.

Children are influenced rather than directly controlled.

Friends and relatives continue their own lives and may drift away, reconnect, recommend employment, provide support, become business partners, or remain connected across generations.

## Memory

Memories may be affected by emotional intensity, importance, recency, frequency, personality, relationship, reinforcement, contradiction, trauma, and major life impact.

Memories influence later decisions and relationships.

Design memory compression, summaries, retrieval, decay, contradiction, and reinforcement deliberately.

## Education and Skills

Support childhood learning, schools, trade schools, colleges, universities, apprenticeships, certifications, self-directed learning, employer training, military education, professional licensing, hierarchical skills, transferable experience, career reinvention, knowledge compounding, and mentorship.

Experience should transfer logically. Military logistics may accelerate supply-chain development. Mechanical experience may help engineering or maintenance careers. Programming experience may help software and AI careers.

People may reinvent themselves at any age.

## Careers and Employment

Support applications, qualifications, hiring, interviews, compensation, workplace relationships, performance, promotions, discipline, layoffs, resignation, retirement, career changes, professional reputation, occupational requirements, labor-market conditions, licensing, networking, and workplace culture.

Every profession should eventually feel mechanically distinct without requiring a completely separate engine.

## Businesses and Organizations

Businesses may possess culture, employees, leadership, financials, reputation, competitors, suppliers, customers, assets, liabilities, products or services, strategy, ownership, and history.

Long-term concepts include startups, family businesses, corporate dynasties, mergers, acquisitions, bankruptcy, IPOs, industry evolution, business biographies, succession, labor needs, supply disruption, innovation, and market competition.

## Economy and Personal Finance

Support economic cycles, inflation, interest rates, employment conditions, supply chains, housing markets, banking, checking, savings, credit, credit history, debt, loans, mortgages, insurance, taxes, retirement accounts, investments, stock markets, financial statements, IPOs, investor behavior, market psychology, generational wealth, bankruptcy, and financial literacy.

The stock market should connect to simulated businesses, investors, policy, economic conditions, and public information rather than arbitrary price movement.

## Housing and Persistent Places

Important places persist and accumulate history.

Potential systems include renting, ownership, mortgages, renovations, appreciation, depreciation, neighborhood change, property damage, insurance, memories attached to places, family homes, businesses, schools, military installations, hospitals, cemeteries, and memorials.

---

# 8. MILITARY, WAR, DEPLOYMENT, AND VETERAN LIFE

Military service must be one of the deepest career ecosystems in the simulation.

It must support both long peacetime careers and dangerous wartime service in which injury, capture, disability, or death are genuine possibilities.

Do not treat every deployment as equally dangerous.

## Military Career Structure

Potential systems include:

- U.S. military service branches
- Active-duty, Reserve, and National Guard components
- Recruiting and enlistment contracts
- ROTC and service academies
- Officer candidate, warrant-officer, and direct-commission pathways
- Prior-service entry
- Medical and background eligibility
- Aptitude testing
- Career-field selection
- Initial-entry and occupational training
- Unit assignments and duty stations
- Permanent-change-of-station moves
- Overseas assignments and temporary duty
- Deployments, rotations, and exercises
- Schools and qualifications
- Evaluations and promotions
- Reenlistment and retention decisions
- Awards, decorations, service medals, campaign medals, and unit awards
- Badges, tabs, qualifications, and skill identifiers
- Disciplinary actions and medical profiles
- Injuries, disability, separation, and retirement
- Veteran transition and benefits
- Complete service records
- Generational military history

## Dynamic Geopolitical and War System

Military risk must be generated by the simulated geopolitical state of the world.

Countries may experience peace, diplomatic tension, sanctions, proxy conflict, border disputes, insurgency, limited military operations, regional war, major interstate war, coalition warfare, homeland attack, ceasefire, occupation, and postwar stabilization.

The danger of an assignment or deployment must depend on:

- Which countries or factions are fighting
- The capabilities of each side
- Geography and distance from the front
- Nearby bases and infrastructure
- Air superiority and air defense
- Missile, drone, artillery, naval, cyber, terrorist, insurgent, and sabotage threats
- Supply-line security
- Intelligence quality
- Local political stability
- Rules of engagement
- Mission type
- Unit type
- Occupational specialty
- Defensive preparation
- Medical support
- Current phase of the conflict

A location must not possess one permanently fixed danger rating.

A deployment to Kuwait during peacetime might primarily involve logistics, exercises, deterrence, maintenance, and routine base operations.

The same location during a major conflict with a nearby state might face missile attacks, drone attacks, sabotage, supply interruptions, evacuation, base attacks, mass-casualty incidents, or direct combat-support requirements.

A war involving a highly capable enemy may threaten regional bases, ships, aircraft, satellites, communications, logistics networks, power infrastructure, cyber systems, and parts of the United States.

Permanent rule:

> War, deployment risk, homeland vulnerability, military casualties, operational assignments, and campaign eligibility must be generated from the simulated geopolitical state rather than predetermined country-specific danger ratings.

## Theater and Mission Modeling

Each deployment or wartime assignment should define:

- Theater, country, base, ship, installation, or operating area
- Mission and strategic objective
- Unit and command relationship
- Enemy, friendly, and coalition forces
- Threat environment
- Supply conditions
- Medical support
- Communications reliability
- Expected and actual duration
- Operational tempo
- Rules of engagement

Possible missions include ground combat, air defense, logistics, transportation, intelligence, aviation, cyber operations, medical support, base security, convoy operations, humanitarian relief, evacuation, peacekeeping, deterrence, training allied forces, maritime operations, disaster response, occupation, stabilization, search and rescue, maintenance, procurement, and sustainment.

A service member's occupation and assigned unit must materially affect what they experience.

Infantry, ammunition, aviation, maintenance, medical, intelligence, cyber, logistics, transportation, and administrative personnel deployed to the same country should not receive identical experiences.

## Combat and Operational Risk

Combat must be consequential, explainable, and grounded in simulated circumstances.

Possible outcomes include no direct combat exposure, indirect-fire exposure, drone or missile attack, convoy attack, aircraft incident, naval engagement, ground combat, cyber disruption, base attack, injury, illness, psychological trauma, permanent disability, missing-in-action status, capture, rescue, and death.

Character death during military service must be a real possibility.

Death must not occur through a simple unexplained hidden roll. It must result from a traceable combination of assignment, location, mission, threat environment, enemy capability, friendly preparation, equipment, leadership, intelligence, training, decisions, medical response, and seeded uncertainty within an explainable resolution model.

The player should eventually be able to understand why an injury or death occurred, while the character should not receive unrealistic omniscient information during the event.

## Scale and Consequences of War

Wars do not revolve around the player.

The broader simulation may model military and civilian casualties, mobilization, Reserve and National Guard activation, recruiting and retention changes, draft or expanded-service policy if supported by the setting, defense spending, equipment shortages, production increases, fuel and commodity prices, supply-chain disruption, refugees, infrastructure damage, public opinion, elections, protests, media coverage, alliances, sanctions, recession, reconstruction, veterans returning home, and long-term regional instability.

The player may participate in a conflict without personally witnessing its decisive battles.

## Long Military Careers

Support careers lasting several years or several decades.

A service member may experience multiple duty stations, several deployments, changes in occupational specialty, leadership positions, instructor assignments, recruiting duty, staff assignments, special-duty assignments, joint assignments, overseas tours, promotions, promotion non-selection, demotion, reenlistment, commissioning, retirement, medical retirement, separation, and recall where appropriate.

Career progression must produce a persistent service record.

## Awards, Decorations, Badges, and Ribbon Racks

Awards must be earned from documented service events.

Potential categories include achievement, commendation, meritorious-service and valor decorations; good-conduct recognition; campaign, expeditionary, overseas-service, deployment, and humanitarian recognition; unit awards; qualification, occupational, combat, aviation, and marksmanship badges; school badges and tabs; wound recognition; and prisoner-of-war recognition.

A Purple Heart or legally safe equivalent must only be awarded when qualifying wound or death criteria resulting from enemy action are satisfied.

Campaign, expeditionary, overseas-service, and deployment recognition must depend upon qualifying service, location, dates, mission, conflict, and eligibility rules.

Every award should retain:

- Award type
- Date
- Qualifying event
- Issuing authority
- Citation or explanation
- Service-record entry
- Uniform-display position
- Devices or additional-award indicators

Long careers should naturally create larger ribbon racks, but the rack must reflect actual qualifying service rather than cosmetic leveling.

Distinguish among personal decorations, service medals, campaign medals, unit awards, badges, tabs, qualifications, and foreign or coalition recognition.

Uniform display must follow documented precedence and placement rules.

Use original fictional artwork or legally safe equivalents where real insignia, patches, seals, medals, or uniform elements create avoidable licensing or intellectual-property concerns. Preserve authentic structure, progression, meaning, and visual storytelling.

## Military Schools and Qualifications

School attendance should depend upon branch, occupation, rank, unit requirements, performance, physical and medical eligibility, available seats, career goals, leadership recommendations, and operational needs.

Schools and qualifications may affect skills, assignments, promotion competitiveness, unit role, pay, reputation, deployment responsibilities, uniform appearance, and civilian employment.

Schools must teach useful skills and influence the career. They must not be meaningless collectible icons.

## Units and Military History

Units maintain persistent histories containing formation, lineage, missions, duty locations, campaigns, deployments, commanders, honors, unit awards, casualties, traditions, major incidents, and former members.

A character or descendant may later discover that a relative served in the same unit, installation, ship, squadron, or campaign.

## Family and Relationship Consequences

Military service may affect marriage, parenting, friendships, household finances, housing, education, health, mental health, child development, relocation, caregiving, family planning, divorce risk, relationship strength, and community ties.

Deployment must not automatically damage relationships. Effects depend upon communication, trust, duration, existing relationship conditions, family support, operational conditions, personality, coping, and finances.

## Veteran Life

Military service remains part of a character's identity and history after separation.

Veteran life may involve civilian employment, transferable skills, education, benefits, disability, healthcare, retirement pay, Reserve obligations, reunions, veteran organizations, military friendships, leadership identity, transition difficulty, family adjustment, public service, political activity, entrepreneurship, memorial participation, survivor guilt, pride, grief, and long-term health consequences.

Do not portray military service as purely glorious or purely harmful.

Represent service, camaraderie, pride, opportunity, training, growth, bureaucracy, sacrifice, stress, risk, injury, disability, loss, family strain, transition, lifelong friendship, and legacy.

## Military Explainability

Every major military outcome must retain a causal record, including why the character received an assignment, deployed, faced a dangerous or relatively safe tour, entered combat, was injured or killed, received or was denied an award, was promoted or passed over, attended a school, or was retained, separated, or retired.

Military events must emerge from the simulated world, conflict, unit, mission, and person rather than isolated scripted encounters.

---

# 9. OTHER LONG-TERM DOMAINS

## Crime, Law, and Justice

Support opportunity and motivation for crime, victims, witnesses, evidence, investigations, police careers, prosecutors, defense attorneys, judges, juries, plea negotiations, trials, sentencing, appeals, probation, corrections, rehabilitation, criminal records, reentry, white-collar crime, cybercrime, corruption, organized crime, and financial crime.

Outcomes must derive from evidence, law, representation, institutional behavior, resources, decisions, and process rather than arbitrary conviction percentages.

Prison should be a continuing life chapter rather than an automatic end.

## Government and Politics

Support local, state, and federal government; elections; candidates; legally safe fictional parties or political organizations; voting; campaigns; public opinion; budgets; taxes; regulation; infrastructure; education, healthcare, housing, environmental, public-safety, and defense policy; public employment; lobbying; journalism; elected office; policy consequences; foreign relations; alliances; sanctions; and war authorization or equivalent processes where appropriate.

Government must affect the simulated world rather than existing as decoration.

## Healthcare and Human Development

Support childhood, adolescence, adulthood, aging, preventive care, acute illness, chronic conditions, disability, mental health, pregnancy, rehabilitation, health insurance, healthcare employment, caregiving, end-of-life care, and mortality.

Health mechanics must avoid presenting themselves as medical advice or reducing complex conditions to offensive stereotypes.

## Transportation and Infrastructure

Support walking, cycling, cars, motorcycles, public transit, rail, aviation, ferries, ride services, freight, logistics, commutes, traffic, infrastructure quality, vehicle ownership, maintenance, travel, geographic accessibility, and supply-chain effects.

Transportation must connect employment, housing, relationships, military movement, trade, emergency response, and quality of life.

## Weather, Environment, and Disasters

Support regional climate, seasons, weather, floods, tornadoes, hurricanes, wildfires, earthquakes, blizzards, heat waves, drought, infrastructure damage, insurance effects, health effects, displacement, government and military response where applicable, community recovery, and economic consequences.

Weather is not merely cosmetic.

## Media, Culture, and Public Life

Support local and national news, financial media, journalism, television, podcasts, online media, social media, reputation, public opinion, misinformation as a simulated social phenomenon, music, film, books, games, theater, celebrities, sports, athletes, teams, leagues, records, hobbies, religion, secular beliefs, philosophy, community organizations, regional culture, migration, and cultural diffusion.

Media reports should originate from simulation events. Media organizations may frame, prioritize, investigate, misunderstand, or distort events according to their incentives, standards, knowledge, and audiences.

## Science and Technology

Support research, innovation, adoption, automation, medical advances, industrial change, communication and transportation technology, military technology, new industries, occupational displacement, education requirements, regulation, and cultural consequences.

Technology should evolve gradually and remain compatible with the selected historical or near-future setting.

## History, Archives, and Legacy

Support event journals, personal timelines, family archives, business histories, military-unit histories, political histories, court records, property histories, cultural records, memorials, cemeteries, biographies, obituaries, scrapbooks, heirlooms, world archives, legacy scores, legacy traits, and legacy recognition.

Legacy traits should affect reputation, expectations, identity, relationships, and opportunities rather than providing arbitrary stat bonuses.

Important objects and places may preserve memories and history.

---

# 10. DIFFICULTY AND SAVE FILES

The intended difficulty settings are:

- Easy
- Normal
- Hard
- Realistic, as the default

Difficulty must not merely multiply costs or failure chances.

It may alter assistance, information availability, institutional tolerance, recovery support, economic pressure, simulation strictness, player guidance, and consequence severity where appropriate.

Support multiple independent save files.

Save files require:

- Explicit schema versions
- Simulation-version metadata
- Seed information
- Migration support
- Validation
- Corruption detection
- Recovery planning
- Backward-compatibility policy

---

# 11. DEVELOPMENT STRATEGY

Design the complete long-term vision but implement it in layers.

## Layer 1 - Core Simulation

- Deterministic time
- Seeded randomness
- Identity
- Basic person state
- Events
- Causal records
- Save and load
- Tests

## Layer 2 - Living World

- Relationships
- Education
- Employment
- Household finances
- Housing
- Basic businesses
- Geographic movement

## Layer 3 - Generational Systems

- Families
- Children
- Aging
- Death
- Inheritance
- Heirs
- Archives
- Legacy

## Layer 4 - Deep Institutional Simulation

- Economy and markets
- Government and politics
- Healthcare
- Military and war
- Crime and justice
- Media
- Transportation

## Layer 5 - Expansion

- Greater geographic depth
- Additional careers
- Cultural systems
- Sports and entertainment
- Technology
- Advanced history
- Modding or scenario support if justified

Do not create hundreds of placeholder source files.

Do not implement broad systems before dependencies and authoritative data ownership are defined.

Prefer small vertical milestones that produce executable, inspectable, and testable results.

---

# 12. ENGINEERING CONSTRAINTS

- Ordinary gameplay must work offline.
- Runtime generative AI must not be required.
- A cloud account must not be required for the basic simulation.
- Simulation logic must be testable without UI.
- Use seeded deterministic randomness.
- Retain causal records for important outcomes.
- Create stable domain boundaries.
- Version persistence explicitly.
- Test save migrations.
- Do not silently lose data.
- Do not duplicate authoritative truth.
- Do not create a giant global singleton.
- Do not add dependencies without documented justification.
- Do not select frameworks merely because they are fashionable.
- Do not prematurely create microservices.
- Do not design speculative multiplayer infrastructure.
- Do not add an online backend unless an approved feature requires one.
- Do not copy copyrighted assets into the project.
- Do not use real private-person data.
- Do not commit secrets.
- Do not delete or weaken tests merely to obtain passing results.
- Do not suppress warnings without justification.
- Do not perform large uncontrolled rewrites.
- Do not change public contracts without migration or compatibility notes.
- Update documentation when architecture changes.
- Meaningful behavioral changes require tests.
- Avoid irreversible choices during the foundation phase.
- Favor clarity over cleverness.
- Favor profiling evidence over speculative optimization.

---

# 13. AGENT ORCHESTRATION AND MODEL ROUTING

Use specialized subagents when specialization, independent review, parallel research, or context isolation creates a real benefit.

Do not spawn agents for trivial work.

The lead agent owns final integration, architectural consistency, conflict resolution, scope control, and final reporting.

Every delegated task should define:

- Agent role
- Bounded assignment
- Inputs
- Allowed tools
- Expected output
- Acceptance criteria
- Selected model
- Why that model is sufficient

Potential project-scoped roles include:

- Architecture reviewer
- Simulation designer
- Swift engineer
- Persistence reviewer
- Performance reviewer
- Test reviewer
- Documentation reviewer
- Military-system reviewer
- Scope and risk reviewer

Do not create every possible agent during this session.

Create only agents clearly useful to the foundation phase or first milestones.

## Model Routing

Use the least expensive model that can reliably perform each delegated task.

### Haiku or Equivalent Lightweight Model

Prefer for repository inventory, formatting, simple documentation checks, narrow classification, repetitive validation, straightforward file discovery, and mechanical transformations.

Do not use it for ambiguous architecture or difficult cross-system reasoning.

### Sonnet or Equivalent General Engineering Model

Prefer for standard implementation, routine refactoring, unit and integration tests, normal debugging, documentation based on established decisions, isolated component review, and most ordinary engineering.

### Opus or Equivalent Advanced Reasoning Model

Prefer for architecture, cross-domain design, difficult debugging, persistence strategy, performance architecture, high-impact refactors, simulation consistency, military and geopolitical system architecture, resolving conflicting proposals, and reviewing difficult-to-reverse decisions.

### Fable or Equivalent Long-Horizon Model

Use only when sustained autonomy, unusually large context, repository-wide investigation, or extended multi-stage coordination provides a clear advantage.

Do not automatically use the largest model because a task is important.

Use `inherit` only when the lead model is appropriate for the delegated task.

If a named model is unavailable, select the nearest available capability class and report the substitution.

## Parallel Work

Parallelize independent read-only investigations when useful.

Do not allow parallel agents to edit the same files.

Assign explicit file or module ownership before parallel modification.

Do not parallelize work that depends upon an unresolved shared decision.

## Independent Review

A subagent that did not author the work must review high-impact changes involving simulation scheduling, deterministic randomness, core person state, decision logic, memory, relationship graphs, economy calculations, military and war resolution, persistence, save migration, generational transitions, performance-critical code, shared domain interfaces, and major refactors.

Agents must not recursively spawn unlimited agents.

---

# 14. CONTROLLED VERIFICATION LOOPS

Use bounded engineering loops rather than blind repeated attempts.

Standard loop:

1. Read the relevant specification.
2. Inspect the existing implementation.
3. Define the narrow intended change.
4. Implement the smallest coherent change.
5. Build or compile.
6. Run applicable tests.
7. Analyze failures.
8. Correct root causes.
9. Rerun validation.
10. Review the final diff.
11. Update documentation.
12. Stop when acceptance criteria are satisfied.

Every loop must have a defined objective, explicit acceptance criteria, a bounded iteration or resource limit, an escalation rule, and final verification.

Never run an unbounded loop, continue making random changes without learning, delete tests to obtain a green result, weaken requirements without approval, fabricate test execution, hide remaining failures, claim success without evidence, or use scheduled polling as a substitute for a verification loop.

When progress stalls, report the failure observed, evidence collected, attempts made, likely causes, and recommended next action.

---

# 15. REQUIRED FOUNDATIONAL DOCUMENTS

Create and populate the following:

## `README.md`

Include project overview, current phase, repository structure, development workflow, and an explicit statement that gameplay implementation has not begun.

## `docs/PROJECT_CHARTER.md`

Include purpose, vision, governing laws, scope, non-goals, Three Gates, success criteria, and product risks.

## `docs/DESIGN_INDEX.md`

Create a numbered and domain-grouped index of all major design specifications eventually required.

For each entry include purpose, dependencies, status, priority, and whether it is required before the first prototype.

Include a dedicated military, war, deployment-risk, awards, uniform, unit-history, and veteran-life document group.

## `docs/TECHNICAL_INDEX.md`

Include planned specifications for architecture, domain ownership, simulation clock, event scheduling, deterministic randomness, person state, decision engine, memory, relationship graph, persistence, save migrations, testing, performance, observability, debugging, UI integration, data generation, versioning, accessibility, localization, security, privacy, build and release, geopolitical simulation, conflict resolution, military assignments, award eligibility, and historical compression.

## `docs/ARCHITECTURE_PROPOSAL.md`

Compare credible approaches for an offline-first iOS game.

At minimum evaluate:

- Native Swift simulation engine with SwiftUI application
- Swift application with a deliberately portable simulation core
- A credible cross-platform engine option

Discuss determinism, performance, testing, persistence, developer complexity, iOS integration, long-term portability, tooling, and risks.

Recommend one initial stack and identify which choices are reversible.

Do not choose a complex architecture merely to accommodate the entire final vision immediately.

## `docs/DOMAIN_MAP.md`

Define major domains, authoritative data ownership, allowed communication patterns, events, commands, queries, shared identifiers, shared value types, rules preventing circular dependencies, and rules preventing duplicated truth.

## `docs/SIMULATION_LEVELS.md`

Define deep, medium, lightweight, and aggregate tiers; promotion and demotion triggers; state retained at each tier; history-synthesis restrictions; continuity requirements; performance expectations; and testing strategy.

## `docs/DETERMINISM.md`

Define seed strategy, random-stream ownership, ordering guarantees, stable identifiers, simulation-version behavior, replay expectations, floating-point concerns, test strategy, and debugging strategy.

## `docs/CAUSAL_RECORDS.md`

Define how the engine records why major outcomes occurred without retaining unlimited raw reasoning.

Distinguish among source facts, decision inputs, selected action, rejected alternatives when necessary, outcome, explanation projection, and historical summary.

## `docs/MILITARY_AND_WAR_FOUNDATION.md`

Define design and technical boundaries for geopolitical state, conflict state, deployment danger, theater state, military assignments, mission types, unit types, occupational exposure, combat and operational hazards, injury, death, casualty records, awards, Purple Heart or equivalent eligibility, campaign eligibility, schools, qualifications, ribbon racks, unit histories, family consequences, veteran transition, and explainability.

Explicitly document that location risk changes with the geopolitical and operational situation.

This document is planning only. Do not implement combat simulation yet.

## `docs/MILESTONE_PLAN.md`

Create small vertical milestones with objective, deliverable, dependencies, tests, exit criteria, risks, and explicit out-of-scope items.

The first proposed executable milestone should be approximately:

> Generate a deterministic small town, simulate approximately 100 people for 120 monthly ticks, and produce inspectable causal and historical records for a deliberately limited subset of friendships, education, employment, income, household formation, moves, births, deaths, and major decisions without a graphical interface.

Narrow this milestone further if necessary.

Do not silently broaden it.

Military and war systems should not be part of the first executable milestone except as documented future domains.

## `docs/DECISION_LOG.md`

Create an ADR-style format containing status, context, options, decision, rationale, consequences, reversibility, and review trigger.

Record the initial decisions made during the foundation phase.

## `docs/RISK_REGISTER.md`

Include at least:

- Scope explosion
- CPU cost
- Memory growth
- Save-file growth
- Causal-record growth
- Historical-data growth
- NPC continuity
- Emergent-system instability
- Circular dependencies
- Testing explosion
- UI information overload
- Legal and IP concerns
- Sensitive-topic representation
- War and casualty representation
- Content repetition
- Long-term migration burden
- AI-generated code inconsistency
- Insufficient development resources
- Unrealistic expectations about population scale

Rank likelihood and impact.

## `docs/CLAUDE_RULES.md`

Create a readable expansion of the AI-development rules.

The root `CLAUDE.md` remains the controlling project constitution.

## `.gitignore`

Add appropriate entries for the recommended stack and local tooling.

Do not ignore required documentation, project-scoped agent definitions, architecture decisions, or tests.

---

# 16. INITIAL PROJECT AGENTS

After completing the architecture proposal, create only the project agents justified by the selected workflow.

Each agent definition must:

- Live in `.claude/agents/`
- Have a specific description
- Use the least expensive capable model
- Restrict tools where possible
- Include repository-isolation rules
- Require evidence-based reporting
- Distinguish assumptions from verified findings
- Prohibit independent scope expansion
- Return a structured report

Potential foundation agents include:

- `architecture-reviewer`
- `persistence-reviewer`
- `performance-reviewer`
- `scope-risk-reviewer`
- `documentation-reviewer`

Create a military-specific reviewer only if it adds clear value during documentation review.

Do not configure autonomous or unbounded recursive agent behavior.

---

# 17. CURRENT ASSIGNMENT WORKFLOW

Follow this sequence:

1. Confirm the current working directory is the `LifeEngine` repository.
2. Inspect only this repository.
3. Populate `CLAUDE.md`.
4. Create the foundational documents.
5. Use subagents for independent architecture, persistence, performance, military-scope, and risk analysis where beneficial.
6. Route each subagent to the least expensive capable model.
7. Record which model was used and why.
8. Reconcile conflicting recommendations.
9. Run an independent architecture and documentation consistency review.
10. Correct contradictions and incomplete sections.
11. Show the final repository tree.
12. Provide the required final report.
13. Stop.

---

# 18. REQUIRED FINAL REPORT

Report:

- Files created
- Files changed
- Agents created
- Models selected for delegated tasks
- Architecture recommendation
- Decisions recorded
- First proposed executable milestone
- Most serious technical risks
- Irreversible decisions avoided
- Open questions requiring user approval
- Validation performed
- Confirmation that no gameplay was implemented
- Confirmation that no files outside the repository were modified

Do not initialize an application framework, package dependencies, Xcode project, database, or gameplay source architecture during this assignment unless an existing repository already requires inspection.

The repository is currently in its documentation and architecture phase.

Be skeptical and technically honest.

Do not flatter the concept.

Identify contradictions, excessive scope, unrealistic population assumptions, performance dangers, and systems that require aggregation or simplification.

The objective is not to make the project appear impressive.

The objective is to give it a disciplined foundation with a realistic chance of eventually being implemented.
