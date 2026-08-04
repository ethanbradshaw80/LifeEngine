/**
 * Serializable world state, and a state hash for determinism testing.
 *
 * Milestone 1 does NOT include save/load — that is Milestone 4. What is
 * required here is that world state CAN be serialized, because it must cross a
 * Web Worker boundary later and because the determinism tests need a stable
 * fingerprint of the whole world.
 *
 * The header carries schemaVersion, simulationVersion, seed, and userId from
 * the very first snapshot ever produced (ADR-0010). userId is "local" until
 * accounts exist at Milestone 6. It costs nothing now and avoids a migration
 * across every existing save later.
 */

import type { Seed, Tick } from '@life-engine/shared'
import type { World } from './types.js'

export const SCHEMA_VERSION = 1
/**
 * Simulation behaviour version.
 *
 * v1 — Milestone 1. Placeholder friendships; partnership was an accident of
 *      shared housing.
 * v11 — M-WOUNDS. Harm is specific: injury kinds and sites picked from the
 *      context (mill, road, convoy, base), illnesses named, permanent marks
 *      in words. Extra draws shift histories from v10.
 * v10 — L4-M4. Deployment and risk: homeland wars send the serving to
 *      theatres; danger computed monthly from the geopolitical state crossed
 *      with specialty exposure; wounds land on the health model; deaths run
 *      through performDeath. Lives differ from v9 wherever the Republic fought.
 * v85 — M-CAREER PHASE 5: THE TOWN GOES INTO BUSINESS. Ambitious adults with
 *      capital open one of five trades; it rides the cycle directly, can
 *      fail, and passes to an eldest child. Measured: 58 per cent survive.
 * v84 — M-CAREER PHASES 3-4: JOB HUNTING AND WORKING FOR YOURSELF. Applying
 *      opens an INTERVIEW with three ways to play the room, and the offer
 *      that follows is a card of its own. Five scales of business from
 *      freelance work to a contracting firm, bought with real capital,
 *      riding the cycle directly, able to fail, and passing to an heir.
 * v83 — M-CAREER PHASE 2: THE MOMENTS A JOB IS MADE OF. Ten authored work
 *      moments on the combat scene's three rails — the account nobody wants
 *      to run, the mistake nobody saw, the offer from across town, the
 *      corner the boss wants cut. The player is asked; NPCs answer by
 *      character on the same maths. Every working life diverges from v82.
 * v82 — M-CAREER PHASE 1: CIVILIAN WORK GETS A LADDER. Nine tracks from the
 *      mill floor to the corner office, twenty-nine new rungs, and an
 *      annual REVIEW that is the civilian promotion board — performance and
 *      time in the job, leaned on by the economy, so a boom opens doors a
 *      slump keeps shut. Every seed's working lives diverge from v81.
 * v81 — M-SAFETY: BANKRUPTCY, HOMELESSNESS AND THE FLOORS UNDER A LIFE.
 *      A state pension from 65 scaling with the months actually worked;
 *      unemployment insurance for six months after a LAYOFF; public
 *      assistance as a bare income floor for any adult below it. Insolvency
 *      is resolved at a courthouse — a chapter 13 plan of three to five
 *      years, or a means-tested chapter 7 liquidation — with an automatic
 *      stay while it runs and a credit file that carries it for seven or
 *      ten years and then fades. A household with nowhere cheaper to go
 *      LOSES ITS HOUSING rather than being billed for a house it is not in,
 *      and income buys a room back. The v80 write-off is gone: it was a
 *      hack wearing a recovery path. Every seed's poor lives differ.
 * v80 — ARREARS IS NO LONGER A TRAP. A household two years behind on its
 *      own costs has the debt written off, recorded as an event. Found by
 *      playing: with no state pension, a man who retired with $134,703 by
 *      spent it in eight years and his household then ran to -$606,276 in
 *      arrears with no future month that could ever clear it (Law 7).
 * v79 — MONEY THAT WAS BEING DELETED. Three places still credited the
 *      HOUSEHOLD balance, which since M-ECON §1 is an obligations counter
 *      clamped at or below zero every month: a reenlistment bonus, the
 *      proceeds of every till and forged cheque, and a thief's take from
 *      outside the town. All three were paid and then erased at the next
 *      settle. They now land in the person's own checking, so lives that
 *      re-enlisted for money or stole any of it diverge from v78.
 * v78 — M-ECON PHASES 4-6: A MARKET, DEBT, AND MONTHS THAT GO WRONG. Four
 *      fictional sectors with their own volatility and war-sensitivity; a
 *      brokerage and a tax-advantaged retirement account; dividends and
 *      realized capital gains. Loans, a derived credit score, home
 *      ownership with a mortgage and equity, and default that takes the
 *      house. Financial shocks — a medical bill, a scam, a roof — which the
 *      player answers and NPCs simply meet. Every seed's balances differ.
 * v77 — M-ECON PHASE 3: THE ECONOMY IS WEATHER. A seeded state machine
 *      drifts expansion → peak → recession → depression → recovery over
 *      years; a central bank moves the rate savings earn; prices compound
 *      with inflation and wages move with them; and a downturn LAYS PEOPLE
 *      OFF, which is the first time a job could be lost to anything but
 *      being bad at it. Measured across four centuries: six to nine
 *      recessions and none to two depressions each, market drawdowns of
 *      14-31%, prices four to eight times the base by year 100.
 * v76 — M-ECON PHASE 2: TAX AND INTEREST. Pay is withheld at source on a
 *      progressive schedule, savings earn monthly, spending carries sales
 *      tax, an estate above the exemption is taxed, and every January
 *      settles a return into a refund or a bill. Household income now means
 *      what ARRIVES rather than what is earned — the old reading spent
 *      ninety per cent of a gross surplus and left a forty-year town with a
 *      median adult net worth of $463.
 * v75 — M-ECON PHASE 1: THE POT IS SPLIT. Every person holds their own
 *      checking and savings; the household keeps only its shared
 *      obligations and goes negative when a month is not met. Pay lands
 *      with the earner, obligations are funded pro rata from what each
 *      brings in, a bad month is absorbed by what people have put by, and
 *      an estate passes a PERSON's money rather than a building's. Theft
 *      and fines reach into pockets. Every balance in every seed differs.
 * v74 — M-ECON PHASE 0: PRICES ARE REAL. Salaries move to an annual
 *      scale ($30k labourer to $216k doctor), rents to $1,100-$1,950 a
 *      month, living costs with them. Pay is SHOWN yearly and still paid
 *      monthly. Every wage, rent and balance in every seed differs from v73.
 * v71 — REENLISTMENT IS EARNED, CHOSEN AND PAID FOR. An eligibility code
 *      the service decides (a barred file separates whatever the person
 *      wants), a term the player picks, a bonus when the trade is short,
 *      an option that is not always money, and indefinite service past
 *      senior NCO. Terms are no longer a constant, so every career differs
 *      from v70.
 * v70 — A KILLING WOUND HAS TO BE ONE THAT KILLS, and an officer is
 *      promoted at an officer's pace. The fatal draw used the whole injury
 *      catalogue, so people died of blown-out hearing; and the officer
 *      ladder was walked on the enlisted table's six-month steps, so the
 *      paper printed a twenty-eight-year-old lieutenant colonel. Both
 *      shift every seed with a war or a commission in it.
 * v69 — OFFICERS EXIST (owner, playing: "we have no officer roles... and
 *      we even have a college pipeline"). A separate ladder per branch,
 *      O-grades with their own pay table, and a degree at the recruiting
 *      office is a commission. Anybody with a degree who enlists from here
 *      enters on a different ladder at different pay, so every seed with a
 *      college graduate in uniform differs from v68.
 * v68 — A KILLING RECORDS WHAT KILLED SOMEBODY. A fatal hit used to write
 *      no wound at all — only survivable ones did — so the paper could say
 *      "wounds taken in action" and never what the wound was. It draws and
 *      records one now (inflicting nothing; they are already dead), which
 *      consumes a draw and shifts every seed where anybody was killed.
 * v67 — C3 STEPS 7 AND 8: the victim's side, sealing a record, and plea
 *      bargaining. Being robbed asks the player something; a petition can
 *      seal what the fade would not; and the arraignment carries an offer
 *      whose terms are on the screen, with a real trial penalty behind
 *      refusing it. Weak cases bargain and strong ones do not have to.
 * v66 — C3 STEP 2: VIOLENCE HAS A VICTIM. Every offence used to be a
 *      thing that happened to a household's savings; an assault happens to
 *      a PERSON, who is wounded or killed through the same health and
 *      death systems everything else uses. And the charge follows the
 *      outcome — a death during a felony escalates, which is the
 *      felony-murder road. Measured: 61 assaults, 57 injured, 4 killed
 *      across three fifty-year towns.
 * v65 — C3 STEP 6: THE CONSTABLE AND THE TOWN'S WEATHER. Law enforcement
 *      is a job anybody can hold, it is a scarce public office rather than
 *      an ordinary trade, and the town's constables raise how much crime
 *      is solved. A crime-pressure index computed from arrears, joblessness
 *      and policing leans on every person's own threshold and is printed
 *      once a year. Measured: towns read 77 to 243.
 * v64 — C3 STEP 5: PROBATION RUNS. The rung the ladder needed most: a
 *      monthly supervision pass, a revocation that imposes what was
 *      hanging over somebody, and a new offence while supervised as the
 *      violation that matters. Probation restricts enlistment and does not
 *      touch the job — that is the difference between it and a cell. The
 *      hiring and enlistment gates read the GRADE now rather than a
 *      boolean that switched off on an anniversary.
 * v63 — C3 STEP 4: THE SENTENCING LADDER. The court had two answers, so a
 *      five-time burglar and a first shoplifter landed in the same two
 *      buckets. Seven rungs now — dismissed, fine, community service,
 *      probation, suspended, split, jail — chosen grade by grade from the
 *      C3 doc's own table. A first small offence can end without a
 *      conviction at all; a class B felony and above is still custody.
 * v62 — THE TOWN GOES TO AN ALLY'S WAR (owner, playing). Support tours
 *      were reachable only from the player's own verb, so the played
 *      character was the only person in any world who ever fought beside
 *      an ally. NPCs volunteer now, at a third of the peacetime rotation
 *      rate and under their own small share cap — measured at 7, 38 and 23
 *      tours across three 150-year towns, against zero.
 * v61 — C3 STEP 1: THE CATALOGUE GROWS. Thirty-six new charges, three new
 *      grades (class E, class A, capital), and four new offence fields
 *      (danger, violent, escalatesTo, mandatoryMin) from the owner's C3
 *      doc. NPCs draw from the whole catalogue, weighted like a docket
 *      rather than like the catalogue: measured at 408 offences across
 *      three fifty-year towns, 7% of them felonies, topped by drink and
 *      driving. Every seed's crime differs from v60.
 * v60 — ONE RIBBON PER CONFLICT, and the Bronze Star goes back to being a
 *      combat award (owner, playing). The campaign medal names its own war
 *      instead of tallying them all onto one ribbon, and the merit tier of
 *      the Bronze Star — which arrived at REENLISTMENT on a term average —
 *      is retired. Fewer and different decorations than v59, which moves
 *      the boards that count them.
 * v59 — HISTORY IS COMPRESSED (Law 6, and the owner's lag). Nothing ever
 *      compressed anything: the ledger grew forever, and handing it to the
 *      interface costs more than simulating the month does. MEASURED at
 *      year 2124: 36,134 events, 8,857 records, a 5.9ms tick and an 85.7ms
 *      structured clone. The ordinary texture of people dead a generation
 *      is dropped now — 26,641 events, 5,653 records, a 60ms clone. Lives
 *      stay legible; nothing about a living person is touched.
 * v58 — ACCIDENTS KILL PEOPLE TOO (owner). Measured at v57: four wars,
 *      seventy-two served, ZERO accident deaths — the channel almost never
 *      won the month (four casualties across four wars) and was a fifth as
 *      likely to kill as enemy contact when it did. The operational-tempo
 *      threat is roughly three times what it was, and an accident kills at
 *      the same rate as a firefight, because the vehicle does not care
 *      whose war it is. Now about an eighth of a war's dead.
 * v57 — PEOPLE DIE IN WARS (owner). Measured at the old gates: four
 *      fifteen-year wars, 72 served, 177 contacts, 35 wounded, 7 killed —
 *      a wounded-to-killed ratio near 5:1 where real wars sit closer to
 *      2.5:1. The fatal band starts lower, and the player's own combat
 *      moments stop being the safest place in the war (they needed 940 on
 *      a curve that rarely reaches it, while NPCs died at 720). Now 13
 *      killed of 72, ratio 2.2:1.
 * v56 — A WEAK ENEMY IS STILL A WAR (owner, playing: five years deployed,
 *      "never saw combat one time as a medic, zero pop ups"). The threat
 *      vector scaled down to 0.4x against an outclassed enemy, which made
 *      a tour a posting. Floor raised to 0.7x — measured: twelve five-year
 *      medic tours went from 25 contacts, 11 moments and one empty tour to
 *      39 contacts, 22 moments and none. The ceiling is untouched, so a
 *      stronger enemy is exactly as bad as it was.
 * v55 — A WAR STAYS A WAR (owner, playing: eleven nations declared on
 *      Belarus inside a year). A caller asked its entire bloc in one
 *      month, and every ally that joined got its own war relation which
 *      then ran its own calls to arms. One ally asked per war per month
 *      now, and a ceiling of three counted across every war against the
 *      same enemy. Coalitions differ from v54 in every world that had one.
 * v54 — CRIME STOPS REQUIRING DESPERATION (owner, playing: no court
 *      stories in the paper). The gate wanted arrears to clear it, so a
 *      solvent town committed nothing: fifty years and a hundred and forty
 *      people produced one to three thefts and no other offence at all.
 *      NPCs now draw from the whole offence table, and a small baseline
 *      pressure means ordinary carelessness reaches the courthouse. About
 *      2.6 offences a year in a town of 140, measured.
 * v53 — A RIVAL IS NEVER IN THE HOMELAND'S BLOC (owner, playing). Bloc 0
 *      is the homeland's alliance and it was drawn at random for every
 *      nation that was not an ally, so a quarter of the rivals landed
 *      inside it — and the rotation host filter reads the bloc, which is
 *      how a peacetime posting to North Korea became possible. Alliances
 *      differ from v52 wherever a rival drew bloc 0, and so does every war
 *      that alliance shaped.
 * v52 — ONE AWARD PER DEPLOYMENT (owner). A tour used to close with the
 *      Overseas Service Ribbon and the Expeditionary Medal both, for the
 *      same trip and described almost the same way. A peacetime posting
 *      earns the ribbon; a war earns the medal; each is worn again with its
 *      place named in the citation. Fewer decorations on every serving
 *      record than v51, which moves the boards that count them.
 * v51 — The review pass on aviation: the Air Medal is minted only for the
 *      channel that means they went up (a base attack is a night in a
 *      shelter, not a sortie); the senior parachutist is earnable by NPCs,
 *      not the player alone; an NPC moving to a tier-2 unit starts a new
 *      clock; and Airborne School admits the air guard, which is what makes
 *      the freefall road to that badge exist at all.
 * v50 — SENIOR PARACHUTIST, and the record that makes it possible: a
 *      service record now knows when its soldier joined their unit, and
 *      three years on a jump status earns the badge from the monthly pass.
 *      The extra grants shift seeds wherever anybody wore the tab.
 * v49 — AVIATION (ADR-0026). Two flying trades, a flight school, and the
 *      Nighthawk Squadron. New trades change who takes which job at
 *      enlistment and which civilian career follows, so every seed's
 *      working lives differ from v48 — not only the ones who flew.
 * v48 — CAPTURE (ADR-0025). A bad month against enemy contact can end in
 *      a soldier being taken prisoner instead of wounded — the third thing
 *      a bad day can end in, and the reason the Prisoner of War Medal is
 *      grantable at all. A captive's tour stops running on the calendar.
 *      The extra draw shifts every seed where the Republic fought.
 * v47 — EVERY BRANCH GETS A UNIT (owner's combat plan §1b). The Trident
 *      Detachment, the Guardian Flight, the Vanguard Group and the Grey
 *      Section join the Pathfinders and Ember, so Drop a Packet is never
 *      empty for anybody and each branch has a real chain: entry unit asks
 *      for the badge its road is paved with, the tier above draws from the
 *      unit below. NPC selection rolls against a different unit list, so
 *      every world with a soldier in it differs from v46.
 * v46 — THE AWARDS PACK (owner spec, ADR-0024). Decorations and badges
 *      carry their REAL names; the campaign medal is generic and never
 *      named for a war this engine invented; combat recognition takes its
 *      face from the trade (infantryman, medic, everyone else); and seven
 *      new ribbons grant from events the engine already records. Every
 *      award still grants only from a qualifying event — that rule is what
 *      makes the real names safe.
 * v45 — SCHOOL HOUSES WITH A CALENDAR (owner spec). Schools carry their
 *      REAL names (ADR-0023), a course length, a class cadence and seats.
 *      Asking no longer rolls one-in-three for an instant badge: you take a
 *      seat in the next class on a fixed grid, wait for it, attend, and the
 *      badge is pinned on at graduation — for NPCs as well as the player,
 *      because a calendar only the player sees is a menu, not a school.
 * v44 — COALITIONS (owner spec, ADR-0022). A belligerent that is losing
 *      calls on its allies, and the ones that answer declare against the
 *      same enemy — so a coalition is built out of ordinary pairwise
 *      wars. Alignment now sets standing alliance membership, which the
 *      call needs and ADR-0022 §3 discloses. Wars spread now, so any world
 *      with a long enough war differs from v43.
 * v43 — WAR LENGTH AND DIFFICULTY (owner spec). A war's length is ROLLED
 *      at the outbreak — 2 to 15 years, quick when the sides are
 *      mismatched and a grind when they are even — and that length is a
 *      ceiling weariness can still beat. Nations carry a combat rating
 *      (the preset's, or derived from strength) and the months they have
 *      spent at war; ten years of fighting is worth a point of hard-won
 *      toughness, three at most. The threat a deployed soldier faces now
 *      scales on the GAP between the two sides rather than on the enemy
 *      alone. Every war in every world differs from v42.
 * v42 — W2 review. The campaign decoration is named for the SERVICE, not
 *      for the enemy: with real countries on the map the old
 *      `the ${enemy} Campaign Medal` minted "the Afghanistan Campaign
 *      Medal", the verbatim name of a real United States decoration, onto
 *      a permanent record — and awards are fictional in EVERY preset.
 *      One medal with a device per campaign, which is how they work.
 *      Also: a nation name that carries its own article no longer doubles
 *      it ("the the United Kingdom front") in citations, death records and
 *      headlines.
 * v41 — W1 (resistances 4 and 5). Three events carried DISPLAY NAMES in
 *      their detail — 'joined-unit' and 'dropped-selection' the unit's
 *      name, 'passed-over' the rank's title — and two of them were then
 *      string-matched to enforce the two-drop cap and to count prior
 *      non-selections. A name belongs to a preset's content; matching on
 *      one means renaming a unit silently reopens a closed file. They
 *      carry the unit ID and the ladder INDEX now, and story.ts makes the
 *      words at render time. Saves written before this keep their names:
 *      the renderer falls back to the detail as written, so old stories
 *      read exactly as they did.
 * v40 — P3. The arrears crossing event now names the HOUSEHOLD it happened
 *      to (previously only the person who headed it that month), so the
 *      Money tab can pair fell-behind with back-in-the-black for the right
 *      roof. The review found the old read — by current member — importing
 *      a mover's crossings into their partner's household and rendering a
 *      spell that happened to nobody. No behaviour changes: same draws,
 *      same lives, one more field on two event types.
 * v39 — CENSUS NAMES (owner-supplied). The town drew from 32 male, 32
 *      female and 40 invented family names, so four hundred people meant a
 *      dozen Jameses and everybody a Thorne or a Whitlock. It now draws
 *      from the 1990 US Census — 300 / 500 / 1,000 — WEIGHTED by real
 *      frequency, so a town holds several Smiths and one Kowalczyk. Draw
 *      counts are unchanged (pickWeighted spends one draw like pick did),
 *      so every life plays out exactly as it did; only the names differ.
 * v38 — C2: THE PLAYER AND THE LAW. C1 kept the played life a bystander,
 *      because an off-screen theft would be an unchosen crime on a chosen
 *      timeline. Now the desperation moment the simulation already rolled
 *      is the player's to answer, with both roads real — going without is
 *      recorded as the choice it was. Arrest no longer sentences anyone
 *      off-screen: the courthouse waits for a plea, and pleading guilty
 *      buys a lighter hand at the cost of any chance of acquittal.
 *      A CHARGE SHEET of 22 offences (owner direction), graded the way US
 *      state codes grade them, each with its own clearance rate and its
 *      grade's statutory ceiling. NPC crime is untouched — its desperation
 *      theft keeps C1's own measured sentencing.
 * v37 — WARS GRIND NATIONS DOWN. A country's strength was a constant for
 *      all time, so a nation could bleed for twenty years and finish
 *      exactly as dangerous as it started — and our own soldiers' threat
 *      vector reads that number, so an enemy never wore down whatever the
 *      war cost them. Strength now erodes with a nation's own cumulative
 *      losses (counted off the running total, because a month's toll
 *      floors to zero), never below a floor, and the years of peace
 *      rebuild it toward `baseStrength` — the peacetime weight the
 *      country was generated with, which never moves. Schema v20.
 * v36 — SURVIVOR BENEFITS. A pension no longer dies with the person who
 *      earned it: a widow or widower draws 55% of what their spouse was
 *      owed, for life. Derived from the widowed edge and the service
 *      record — no schema change — and granted on the record at the
 *      death, never as silent income. This became urgent the moment
 *      careers started paying: without it, every service family was
 *      impoverished at exactly the worst moment.
 * v35 — RETIREMENT PAY. A career now ends with money. Twenty years is the
 *      door M-ARMY2's own career shape already put there; a quarter of a
 *      per-cent per month served pays half the final wage at twenty and
 *      three quarters at thirty, for life, and it stacks with any
 *      disability pension because a wounded lifer is owed for both. A
 *      four-year term pays nothing — that is what makes twenty years mean
 *      something — and a career ended at the orderly room ends the claim
 *      with it. Household income moves for every retiring veteran, so
 *      this is an NPC-visible change.
 * v34 — M-ARMY2, military review fixes. A support tour looks its war up by
 *      its own pair instead of the homeland's list, so fighting beside an
 *      ally now actually happens — it used to close on the first tick,
 *      which made the whole feature a one-month bus ride. Field aid no
 *      longer stacks a second death roll on a wound the automatic
 *      resolver already judged (the player's wounds were half again as
 *      lethal as anyone else's, and standing near a player medic was
 *      dangerous); the moment now carries the tail instead. An accident
 *      death is recorded as an accident and earns no combat decoration.
 *      A compounded wound records the NEW injury's kind and site, so the
 *      diagram cannot show last month's.
 * v33 — M-ARMY2. The minutes after a wound (owner direction). A serious
 *      wound now stops the world for the person carrying it: a diagram of
 *      where it landed, how bad it is and what it may leave, and a real
 *      choice — press it, call out, or lie still. A player MEDIC gets the
 *      same moment aimed at a squadmate. The odds come from the severity
 *      the model already rolled; every answer can still lose a grave
 *      wound, and none of them rewrites the peak the body hit, because
 *      that is what lasting damage is judged on. Player-path only, so the
 *      unplayed world is untouched.
 * v32 — M-ARMY2. Unit rosters and an ally's war. A soldier now serves in a
 *      named squad at their posting — derived from (person, base), so no
 *      schema moved and squadmates stay squadmates until someone
 *      transfers — and whoever really holds the rank leads it. And when
 *      the allied country a rotation is posted to goes to war, that is a
 *      moment rather than a bus home (owner: "we should actually be able
 *      to go and deploy over there... so that we can get more combat if
 *      wanted"): the player is asked, an NPC answers with their own roll,
 *      and staying opens a real tour against the ally's enemy under every
 *      casualty rule the Republic's own wars use. The Service tab's
 *      volunteer button offers an ally's war ahead of a quiet posting.
 * v31 — M-ARMY2. Wars kill (owner: "we had a war and I didn't see anybody
 *      die to any combat exposure"). MEASURED first: a 20-year attrition
 *      war with 40 enlisted gave 75-85 contacts, 25 wounded and ZERO dead
 *      on three seeds — the fatal gate wanted a severity roughly a
 *      thousand-to-one draw. It now sits inside the serious band, so the
 *      dead come out of the wounds that were already grave: 2-3
 *      townspeople across a long war, 8-33% of casualties. The player's
 *      combat moments rose from a quarter of contacts to three fifths,
 *      and the routine base questions (school slots, rotation lists)
 *      halved — the noise was crowding out the choices that matter. The
 *      GOLDEN IS UNCHANGED: its 120-tick window holds no war casualty and
 *      no player, so only war and played worlds differ.
 * v30 — M-ARMY2, military review fixes. The rotation accident channel is
 *      computed per ten thousand, so the trade's exposure survives the
 *      integer arithmetic instead of flooring every specialty to the same
 *      risk. A host that goes to war sends its guests home. Twenty years
 *      is a retirement door, and the career ceiling rises with the grade
 *      (E-5 twenty, above that thirty). Company punishments run about
 *      twice as often, so the third-strike discharge is a path a career
 *      can actually meet. The promotion board reads live time in grade.
 * v29 — M-ARMY2. Peacetime rotations (owner direction): between wars the
 *      army still goes places. Six-month postings with allies of the same
 *      bloc, issued as ORDERS (a smaller share of the force than a war
 *      takes) or volunteered for; no enemy, so no combat channel and no
 *      campaign medal — the one hazard is the accident channel of a hard
 *      training tempo, crossed with the trade, and it can wound or rarely
 *      kill. A completed rotation earns standing at the next board. War
 *      recalls everyone home. Also: enlistments and homecomings left the
 *      town news (owner: the wall of cards buried everything else).
 * v28 — M-ARMY2. Career shape and misconduct (owner direction): up-or-out
 *      applies below E-5 only ("a ton of people retire at SGT, SSG"); a
 *      career is thirty years; the office takes volunteers to thirty-
 *      eight; sixty-two is the last year in uniform. And the mistakes at
 *      base arrived: company punishments — careless months produce them,
 *      a severe one can bust a stripe, and a third in five years ends the
 *      career by misconduct discharge, which is also the honest removal
 *      path for the ranks up-or-out no longer touches. Service histories
 *      differ from v27.
 * v27 — M-ARMY2. Enlistment is a modelled pull, not a flat rate: a parent
 *      who served draws the child a little (service-tradition, finally
 *      emitted), and recruiting drives — three months of roughly every
 *      third year, derived from the seed — triple the season's walk-ins
 *      for NPCs and the player's knock alike. And a death in uniform now
 *      CLOSES the service record ('died in service') — left open, a dead
 *      soldier counted against the deployment quota forever. Enlistment
 *      and service histories differ from v26.
 * v26 — M-ARMY2 4b. The founding town is 400 people (was ~100; owner
 *      direction — "300-500 so we have it all mixed"). Same generation
 *      path, bigger cast: a seed now names a different, larger town.
 *      Bands verified at the new size before the move (fertility
 *      2.36-2.48, town grows to ~800-950 by year 150, ~30 serving at
 *      any moment). Worlds ALREADY SAVED keep their own population and
 *      continue identically; only new worlds differ.
 * v25 — P2. A uniform is work: the marriage strain model stops counting a
 *      serving spouse as jobless (monthly idle decay, separation pressure,
 *      and the divorce record's financial-strain factor all read service
 *      now). Military-review fix — the stakes said one thing and the model
 *      did another. Serving couples' histories differ from v24.
 * v24 — P1. The record reads back: both parents carry 'had-child' (a
 *      father was invisible at his own child's birth), and the four
 *      player choices that were recorded but invisible gain feed events
 *      (convalesced / declined-board / kept-heads-down / reconciled).
 *      Six existing events gain Why? mappings; stakes screens speak the
 *      model's real numbers. NPC behaviour unchanged except the father
 *      event; every seed's serialized history differs from v23.
 * v23 — D2. The town must live: partner-seeking with meeting moments,
 *      family-intent marriage timing, family-size aspiration decided and
 *      recorded at the wedding, remarriage after recovery. The measured
 *      collapse (completed fertility 1.29-1.67, courtships 1-2 a decade)
 *      is repaired by modelled decisions — never a birth multiplier
 *      (ADR-0019). Lives differ from v22 for every seed.
 * v22 — C1. Crime and justice: arrears-driven theft moving real money,
 *      arrest, the courthouse, fines and jail months; jail is absence;
 *      criminal records gate hiring and enlistment for ten clean years
 *      and never rewrite history. The second Layer 4 institution.
 * v21 — M-DEPTH3. Workplace incidents name the machine and the shop
 *      ("a crush injury to the hand — the planer at the paper mill");
 *      wedding anniversaries (ten years, silver, golden) mark both feeds.
 * v20 — M-HARM review fixes. The combat moment carries the same fatal tail
 *      as the resolver and keeping down still rolls the month's danger;
 *      valor write-ups are rare (the act stays on the record regardless);
 *      rematch memory fades within a generation instead of ratcheting the
 *      world toward permanent peace; the dead in theatre have their tours
 *      closed and their campaign credit judged; two decoration names that
 *      were verbatim real medals are now invented.
 * v19 — M-HARM. Twenty-two new kinds of harm with their own marks; deaths
 *      name their cause; theatre disease (service-connected); twelve more
 *      contact flavors; the combat-moment decision; valor, meritorious
 *      service and long service decorations; geopolitical flashpoints
 *      drift by decade and rematches damp, so the Republic's wars stop
 *      being one neighbour's fault forever.
 * v18 — M-SPECOPS fix 2. Contact is not casualty: months in theatre roll
 *      combat events at 4x the old rate — took fire, mortars, a device on
 *      the route — into the feed with no wound; only a quarter escalate to
 *      the casualty path (rates preserved). "The Contact Star": combat-
 *      action recognition, once per war, from the recorded contact.
 * v17 — M-SPECOPS fix. Clearing the board cutoff clearly means selected:
 *      150+ points over promotes outright (player and NPC alike); the slot
 *      draw exists only near the line. A soldier at 796 against 510 was
 *      being passed over by a flat lottery, which is not what a cutoff is.
 * v16 — M-SPECOPS. Special schools (badge-granting, capability-named) and
 *      fictional special units with failable selection, duty pay and a
 *      sharper deployment; Service-tab actions (school requests, tryouts,
 *      on-demand volunteering); NPCs school and join units too.
 * v15 — M-SERVICE-PLAY. The career answers to the player: competitive
 *      stripes come only through the board question; schools and
 *      qualifications raise real standing; volunteering for the rotation;
 *      high-year tenure separates the passed-over at term's end; tab verbs
 *      (job applications, walk-in enlistment) resolved in-engine. NPC
 *      careers also differ (up-or-out, slower E-4 lateral).
 * v14 — L4-M5. Awards and veterans: wound recognition strictly from enemy
 *      action, campaign credit from qualifying tours, good conduct from
 *      completed honorable terms, qualification badges; disability pensions
 *      on the service-connected delta; deployment contact rates carry the
 *      threat vector's differences instead of saturating a cap. Combat
 *      outcomes and veteran incomes differ from v13.
 * v13 — M-GAMEDEPTH. Military realism: per-branch US-style rank ladders,
 *      monthly time-in-grade promotions (competitive from the board ranks,
 *      never skipped), grade-based pay table, and service texture — basic
 *      training, occupational school, exercises, qualifications, PCS moves.
 *      Service careers and incomes differ from v12 for every seed.
 * v12 — M-GAMEDEPTH. War pacing: escalation ~5x rarer, de-escalation
 *      stronger, and nations exhausted by a war start nothing new for 10-20
 *      years. Homeland wars become generational. Geo history differs from
 *      v11 for every seed.
 * v9 — L4-M3. Service careers: enlistment, specialties, ranks, terms,
 *      discharge and reenlistment; veterans carry unlocks home. Employment,
 *      income and life courses differ from v8.
 * v8 — L4-M2. Health: ailments with recovery, permanent disability, health-
 *      aware employment and mortality, and most fatal accidents becoming
 *      survivable injuries. Deaths and work histories differ from v7.
 * v7 — L4-M1. The world beyond the town: nations, an explainable conflict
 *      state machine on Stream 9, war phases, aggregate casualties. Serialized
 *      shape gains nations and geoRelations.
 * v6 — M-DEPTH2. Careers progress: annual performance reviews move pay
 *      toward the occupation ceiling; six new occupations and four new
 *      workplaces. Hiring pools and incomes differ from v5 for every seed.
 * v5 — M-SPEND. Discretionary spending: households spend 84-92% of the
 *      surplus above rent and living costs (thrift scales with diligence;
 *      nothing while in arrears). Savings now accumulate at believable
 *      rates, so every seed's balances — and everything money touches —
 *      differ from v4.
 * v4 — M-MONEY. Household finances: wages, rent, living costs, savings,
 *      arrears pressure, estate inheritance. Money now shapes moves, strain
 *      and separations, so every seed's history differs from v3.
 * v3 — M-DEPTH. Births moved to deliverChild() on a fresh RNG stream so a
 *      player-decided birth produces the identical child the automatic path
 *      would have; NPC children therefore differ from v2 for every seed.
 * v2 — Milestone 5. The relationships domain: compatibility-driven friendship,
 *      courtship, marriage, divorce and widowhood, and births that require an
 *      actual partnership. Results differ from v1 for every seed, which is what
 *      a version bump is for (docs/DETERMINISM.md §7).
 */
export const SIMULATION_VERSION = 85

/** Placeholder until accounts arrive at Milestone 6. */
export const LOCAL_USER_ID = 'local'

export interface SnapshotHeader {
  readonly schemaVersion: number
  readonly simulationVersion: number
  readonly seed: Seed
  readonly tick: Tick
  readonly userId: string
}

export interface WorldSnapshot {
  readonly header: SnapshotHeader
  readonly body: unknown
}

/**
 * Convert to plain JSON-safe data. Maps become sorted arrays of entries —
 * sorted, not insertion-ordered, so that two worlds with identical content
 * always serialize identically regardless of the order things were created.
 */
export function toSnapshot(world: World): WorldSnapshot {
  return {
    header: {
      schemaVersion: SCHEMA_VERSION,
      simulationVersion: SIMULATION_VERSION,
      seed: world.seed,
      tick: world.tick,
      userId: LOCAL_USER_ID,
    },
    body: {
      nextEntityId: world.nextEntityId,
      nextEventId: world.nextEventId,
      nextCausalRecordId: world.nextCausalRecordId,
      town: world.town,
      places: [...world.places.values()].sort((a, b) => a.id - b.id),
      people: [...world.people.values()].sort((a, b) => a.id - b.id),
      households: [...world.households.values()].sort((a, b) => a.id - b.id),
      accounts: [...world.accounts.values()].sort((a, b) => a.personId - b.personId),
      // M-SAFETY §2: flattened, because a filing already carries its own
      // personId — the map is rebuilt from it on the way back in.
      businesses: [...world.businesses.values()].sort((a, b) => a.id - b.id),
      bankruptcies: [...world.bankruptcies.values()]
        .flat()
        .sort((a, b) => a.personId - b.personId || a.filedAtTick - b.filedAtTick),
      economy: world.economy,
      sectorPrices: world.sectorPrices,
      education: [...world.education.values()].sort((a, b) => a.personId - b.personId),
      employment: [...world.employment.values()].sort((a, b) => a.personId - b.personId),
      health: [...world.health.values()].sort((a, b) => a.personId - b.personId),
      service: [...world.service.values()].sort((a, b) => a.personId - b.personId),
      deployments: [...world.deployments.entries()]
        .sort(([a], [b]) => a - b)
        .map(([personId, tours]) => ({ personId, tours })),
      awards: [...world.awards.entries()]
        .sort(([a], [b]) => a - b)
        .map(([personId, decorations]) => ({ personId, decorations })),
      criminal: [...world.criminal.values()].sort((a, b) => a.personId - b.personId),
      relationships: [...world.relationships.values()].sort((a, b) => a.a - b.a || a.b - b.b),
      events: world.events,
      causalRecords: world.causalRecords,
      nations: [...world.nations.values()].sort((a, b) => a.id - b.id),
      geoRelations: [...world.geoRelations.values()].sort((a, b) => a.a - b.a || a.b - b.b),
      player: {
        personId: world.player.personId,
        pending: world.player.pending,
        log: world.player.log,
        nextDecisionId: world.player.nextDecisionId,
        lineage: world.player.lineage,
      },
    },
  }
}

/**
 * Deterministic JSON with object keys sorted.
 *
 * JSON.stringify follows insertion order, so two structurally identical
 * objects built in different orders would stringify differently and produce
 * different hashes. Sorting keys removes that.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

export function serialize(world: World): string {
  return canonical(toSnapshot(world))
}

/**
 * A 32-bit fingerprint of the entire world. Two runs of the same seed must
 * produce the same hash at every tick; if they diverge, bisect by tick to find
 * where (docs/DETERMINISM.md §10).
 *
 * FNV-1a, inlined. This is called once per tick by the determinism tests over a
 * serialized world that reaches megabytes, so the per-character cost matters:
 * an earlier version called a helper with rest-arguments per character and made
 * the test suite take minutes instead of seconds. Not a cryptographic hash —
 * it only needs to detect change, which it does well.
 */
export function worldHash(world: World): number {
  const text = serialize(world)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Hex form, for committing golden values and reading in logs. */
export function worldHashHex(world: World): string {
  return worldHash(world).toString(16).padStart(8, '0')
}
