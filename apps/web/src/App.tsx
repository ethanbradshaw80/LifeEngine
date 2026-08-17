import { useMemo, useState } from 'react'
import {
  advanceTicks,
  ageAt,
  createWorld,
  decorationsOf,
  formatDate,
  fullName,
  isServing,
  livingPeople,
  netWorthOf,
  PRESETS,
  personSummary,
  rankTitle,
  timelineFor,
  worldHashHex,
  courtOutcomeOf,
} from '@life-engine/engine'
import { formatMoney, seed as makeSeed } from '@life-engine/shared'
import type { EntityId } from '@life-engine/shared'
import { TownStats } from './TownStats.js'
import { PersonDetail } from './PersonDetail.js'
import { CharacterPicker, DecisionPrompt, Retrospective } from './PlayerPanel.js'
import { VerdictSheet } from './VerdictSheet.js'
import { Welcome } from './Welcome.js'
import { BirthCertificate, IntakeScreen, TitleScreen } from './NewLife.js'
import { DeathCertificate, PastLives } from './DeathCertificate.js'
import type { PastLife } from './DeathCertificate.js'
import { planBirth, registryNoFor, seedFromName, seedFromRegistryNo } from '@life-engine/engine'
import type { FamilySpec } from '@life-engine/engine'
import type { LifeChoices } from './NewLife.js'
import { GameScreen } from './GameScreen.js'
import { useWorld } from './useWorld.js'

/**
 * CROSS-ENVIRONMENT DETERMINISM CHECK.
 *
 * The same fingerprint committed in packages/engine/test/determinism.test.ts,
 * which runs under Node. Recomputing it here proves the simulation produces
 * byte-identical results in a real browser too.
 *
 * It is the only check that catches a banned Math.sin/cos/pow reaching engine
 * code: ECMAScript leaves those functions' precision implementation-defined, so
 * a simulation can reproduce perfectly under Node and still diverge in a
 * browser. KEEP THIS IN STEP WITH THE TEST.
 */
const GOLDEN_SEED = 12345
const GOLDEN_TICKS = 120
const GOLDEN_HASH_HEX = '7a054f73'

type Filter = 'living' | 'working' | 'children' | 'dead'

export function App() {
  const {
    world,
    status,
    message,
    lastElapsedMs,
    saveState,
    advance,
    newWorld,
    play,
    createLife,
    applyJob,
    requestEnlist,
    requestSchool,
    tryUnit,
    requestDeploy,
    fitnessTest,
    extraDuty,
    beBorn,
    act,
    choose,
    discardSave,
  } = useWorld(GOLDEN_SEED)
  const [selected, setSelected] = useState<EntityId | null>(null)
  const [filter, setFilter] = useState<Filter>('living')
  const [seedInput, setSeedInput] = useState(String(GOLDEN_SEED))
  // Whether the character picker is open. Pure interface state — what the user
  // is looking at, not a fact about the world.
  const [picking, setPicking] = useState(false)
  // First-run explainer. Seen-ness is a UI preference, not simulation state,
  // so localStorage is the right home for it — the engine never knows.
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('life-sim:welcomed') === null
    } catch {
      return false
    }
  })
  const [confirmingNewWorld, setConfirmingNewWorld] = useState(false)
  /**
   * THE FRONT DOOR (owner's `newgame_and_birth_master.md`).
   *
   * The app used to boot straight into the engine / world-generation view.
   * That is a dev tool, not a game start — the spec's own words — so the
   * boot surface is now the Title screen and the engine view is DEMOTED
   * rather than deleted, because it is invaluable for testing.
   *
   * Interface state only. The engine never knows which screen is up.
   */
  const [front, setFront] = useState<'title' | 'intake' | 'certificate' | 'past' | 'engine'>('title')
  const [lifeChoices, setLifeChoices] = useState<LifeChoices | null>(null)
  /**
   * THE LEDGER OF ENDED LIVES (spec §6, §12.3).
   *
   * localStorage rather than the world, and deliberately: past lives are a
   * fact about the PLAYER, not about any one simulation. A ledger stored
   * inside a world would vanish the moment a new world was generated,
   * which is exactly the "silently deleted" the spec refuses.
   */
  const [pastLives, setPastLives] = useState<PastLife[]>(() => {
    try {
      const raw = window.localStorage.getItem('life-sim:past-lives')
      return raw === null ? [] : (JSON.parse(raw) as PastLife[])
    } catch {
      return []
    }
  })

  function archive(life: PastLife): void {
    setPastLives((current) => {
      // Never twice. A life that is already in the ledger stays as it was.
      if (current.some((entry) => entry.registryNo === life.registryNo)) return current
      const next = [life, ...current].slice(0, 60)
      try {
        window.localStorage.setItem('life-sim:past-lives', JSON.stringify(next))
      } catch {
        /* private mode: the ledger simply does not persist */
      }
      return next
    })
  }
  // A person being read in an overlay while the game screen is up. Interface
  // state only — closing it changes nothing in the world.
  const [inspecting, setInspecting] = useState<EntityId | null>(null)
  // The month a plea was answered, so the verdict can be read back and shown
  // as its own moment. Interface state: the case is already on the record.
  const [verdictTick, setVerdictTick] = useState<number | null>(null)
  /**
   * WHOSE DEATH HAS BEEN SEEN. The certificate must render the moment the
   * player dies, wherever they were — and then never again for the same
   * life once it is closed. Keyed by person id rather than a boolean so a
   * new life (a different id) gets its own ending, and an heir's death is
   * not swallowed by their parent's.
   */
  const [mournedId, setMournedId] = useState<EntityId | null>(null)
  const busy = status === 'working' || status === 'starting'
  const verdict =
    world !== null && verdictTick !== null && world.player.personId !== null
      ? courtOutcomeOf(world, world.player.personId, verdictTick as never)
      : null

  function dismissWelcome(): void {
    setShowWelcome(false)
    try {
      window.localStorage.setItem('life-sim:welcomed', '1')
    } catch {
      /* private mode: the sheet simply shows again next visit */
    }
  }

  // Everything below reads the player FROM THE WORLD. The interface never
  // keeps its own idea of who is being played (ADR-0012).
  const playerId = world?.player.personId ?? null
  const playerPerson = playerId === null ? undefined : world?.people.get(playerId)
  const pending = world?.player.pending ?? null
  const playerDead = playerPerson !== undefined && playerPerson.deathTick !== null

  const determinismOk = useMemo(() => {
    const check = createWorld(makeSeed(GOLDEN_SEED))
    advanceTicks(check, GOLDEN_TICKS)
    return worldHashHex(check) === GOLDEN_HASH_HEX
  }, [])

  // Recomputed whenever the worker sends a new world snapshot.
  const { people, deadCount } = useMemo(() => {
    if (!world) return { people: [], deadCount: 0 }
    const living = livingPeople(world)
    const dead = [...world.people.values()].filter((p) => p.deathTick !== null)

    const shown =
      filter === 'dead'
        ? dead
        : filter === 'working'
          ? // The uniform IS the work (owner: the Working tab showed only
            // civilian jobs, so every serving soldier looked idle). A
            // serving person holds no employment record BY DESIGN — the
            // service system owns their working life.
            living.filter((p) => world.employment.has(p.id) || isServing(world, p.id))
          : filter === 'children'
            ? living.filter((p) => ageAt(p.birthTick, world.tick) < 18)
            : living

    return { people: shown, deadCount: dead.length }
  }, [world, filter])

  const selectedStillKnown = selected !== null && world !== null && world.people.has(selected)

  // Null means "whatever this world is" — the picker follows the loaded save
  // until the player chooses otherwise (military review, ADR-0021 §3).
  /**
   * EVERY NEW WORLD IS AMERICAN HEARTLAND (owner, releasing: "lock that
   * option and just have it to where you can only play the american
   * heartland"). Classic stays in the ENGINE — the golden determinism
   * test runs on it and old saves live in it — but it is no longer a
   * door a player can walk through by accident.
   */
  const chosenPreset = 'american-heartland'

  function applySeed() {
    const value = Number.parseInt(seedInput, 10)
    if (!Number.isInteger(value)) return
    setSelected(null)
    newWorld(value, chosenPreset)
  }

  // No world: either still starting, or a load failed.
  //
  // The recovery controls matter more than they look. A damaged save is
  // correctly refused, but without a way out the player is left staring at an
  // error with a dead app and no button to press. Found by deliberately
  // corrupting a save and reloading — reasoning about it would not have caught
  // it, because the failure only appears when there is no world to render.
  if (!world) {
    const failed = status === 'error'
    return (
      <div className="app">
        <header className="topbar">
          <h1>The Life Simulator</h1>
        </header>

        {failed ? (
          <>
            <p className="banner bad">{message ?? 'The saved game could not be opened.'}</p>
            <section className="controls">
              <button type="button" className="primary" onClick={() => newWorld(GOLDEN_SEED)}>
                Start a new world
              </button>
              <button type="button" onClick={discardSave}>
                Delete the damaged save
              </button>
            </section>
            <p className="pad muted small">
              Starting a new world leaves the damaged save untouched, in case a
              later version of the game can read it.
            </p>
          </>
        ) : (
          <p className="pad muted">Starting the simulation…</p>
        )}
      </div>
    )
  }

  /**
   * THE BOOKEND, AHEAD OF EVERY OTHER SCREEN (owner, playing: "I just died
   * and didn't get the death screen").
   *
   * This branch used to sit BELOW the front door, so it only rendered when
   * `front === 'engine'` — which is why the playtest saw the certificate
   * only after pressing "Continue" (the press set front to engine), and why
   * hiding Continue for the dead made the certificate unreachable
   * altogether. A death is the one moment the interface must not route
   * around: it renders here, wherever the player was standing, and the
   * `mournedId` guard is what lets the close button actually leave.
   */
  if (playerPerson && playerDead && world !== null && mournedId !== playerPerson.id) {
    const years = Math.max(
      0,
      Math.floor(((playerPerson.deathTick ?? world.tick) - playerPerson.birthTick) / 12),
    )
    const registryNo = registryNoFor(
      playerPerson.id,
      playerPerson.givenName,
      playerPerson.familyName,
    )
    const fullName = `${playerPerson.givenName} ${playerPerson.familyName}`
    return (
      <DeathCertificate
        registryNo={registryNo}
        name={fullName}
        ageWords={`${String(years)} years`}
        dateWords={String(1970 + Math.floor((playerPerson.deathTick ?? world.tick) / 12))}
        placeWords="this world"
        // NEVER INVENTED HERE. The engine recorded a cause when it
        // happened; Law 3 says the record explains itself.
        cause={playerPerson.causeOfDeath ?? 'natural causes'}
        obituary={`${fullName} lived ${String(years)} years in a world that went on without asking, and went on after.`}
        survivedBy={[...world.people.values()]
          .filter((p) => p.deathTick === null && p.parentIds.includes(playerPerson.id))
          .slice(0, 6)
          .map((p) => ({
            role: 'Child',
            name: `${p.givenName} ${p.familyName}`,
            meta: `${String(Math.floor((world.tick - p.birthTick) / 12))}`,
            personId: p.id,
          }))}
        // LAW 8, FINALLY A BUTTON. The engine's play() has carried an heir
        // flag all along; the world, the household, the inheritance were
        // ready, and the only exit from a death was the archive. Continuing
        // archives the ended life exactly as closing does — the ledger
        // records the parent either way — and hands the same running world
        // to the child.
        onContinueAs={(heirId) => {
          archive({
            registryNo,
            name: fullName,
            years: String(years),
            headline: playerPerson.causeOfDeath ?? 'a life',
          })
          setMournedId(playerPerson.id)
          play(heirId, true)
          setFront('engine')
        }}
        // EVERY LINE BELOW IS A RECORD, NOT A SENTENCE SOMEBODY WROTE.
        // Law 8's retrospective, assembled at the moment of death from what
        // the simulation actually kept — awards with their years, the rank
        // actually held, the children actually raised. A certificate that
        // said less was the player's complaint; one that said MORE than the
        // records could back would be worse.
        lifeLines={(() => {
          const lines: { label: string; value: string }[] = []
          const svc = world.service.get(playerPerson.id)
          if (svc !== undefined) {
            const grade = rankTitle(world, svc.branch, svc.rank, svc.commissioned === true)
            const years = Math.max(
              1,
              Math.floor(((svc.dischargedAtTick ?? world.tick) - svc.enlistedAtTick) / 12),
            )
            lines.push({ label: 'Service', value: `${grade} · ${String(years)} years` })
          }
          const job = world.employment.get(playerPerson.id)
          if (job !== undefined) {
            lines.push({ label: 'Work', value: personSummary(world, playerPerson.id) })
          }
          const education = world.education.get(playerPerson.id)
          if (education !== undefined && education.level !== 'none') {
            lines.push({ label: 'Education', value: String(education.level).replace(/-/g, ' ') })
          }
          const decorations = decorationsOf(world, playerPerson.id)
          if (decorations.length > 0) {
            lines.push({
              label: 'Decorations',
              value: decorations
                .slice(0, 4)
                .map((a) => (a.count > 1 ? `${a.title} ×${String(a.count)}` : a.title))
                .join(' · '),
            })
          }
          const children = [...world.people.values()].filter((p) =>
            p.parentIds.includes(playerPerson.id),
          ).length
          if (children > 0) {
            lines.push({ label: 'Family', value: `${String(children)} ${children === 1 ? 'child' : 'children'}` })
          }
          const worth = netWorthOf(world, playerPerson.id)
          lines.push({
            label: 'Estate',
            value: worth > 0 ? formatMoney(worth) : 'debts and belongings',
          })
          // THE MOMENTS THE YEARS KEPT (spec Phase 4's second half): a few
          // lines of the life itself, quoted from the timeline the story
          // tab already writes — most recent last, the way a life reads.
          const moments = timelineFor(world, playerPerson.id)
          const kept = moments.slice(-4)
          for (const entry of kept) {
            lines.push({ label: entry.year ?? '·', value: entry.text })
          }
          return lines
        })()}
        serviceLine={
          world.service.get(playerPerson.id) === undefined
            ? null
            : 'Served. The record is in the file, and the file is longer than this page.'
        }
        epitaph="The countries were real. The history was this world's own. The life was theirs."
        onClose={() => {
          archive({
            registryNo,
            name: fullName,
            years: String(years),
            headline: playerPerson.causeOfDeath ?? 'a life',
          })
          setMournedId(playerPerson.id)
          setFront('past')
        }}
      />
    )
  }


  // THE FRONT DOOR, ahead of everything. A player who is mid-life goes
  // straight to their life; everybody else sees a game rather than a
  // simulation console.
  if (front !== 'engine' && !(playerPerson && !playerDead)) {
    if (front === 'title') {
      return (
        <TitleScreen
          /* A DEAD CHARACTER IS NOT A CONTINUE TARGET (playtest: after the
             Certificate of Death, the title screen still offered "Continue —
             Jack Baldwin"). The check asked only whether a player EXISTED,
             and a dead one does. Their ending lives under Past lives, which
             is the door built for it; a new life begins in the same running
             world through "Begin a new life". */
          hasSave={playerPerson !== undefined && !playerDead}
          activeLine={
            playerPerson === undefined || world === null || playerDead
              ? null
              : `${playerPerson.givenName} ${playerPerson.familyName}`
          }
          onNewLife={() => setFront('intake')}
          onContinue={() => setFront('engine')}
          onPastLives={() => setFront('past')}
          onEngine={() => setFront('engine')}
        />
      )
    }
    if (front === 'past') {
      return <PastLives lives={pastLives} onBack={() => setFront('title')} />
    }
    if (front === 'intake') {
      return (
        <IntakeScreen
          townName={world?.town.name ?? 'Haverlock'}
          onBack={() => setFront('title')}
          onBorn={(choices) => {
            setLifeChoices(choices)
            setFront('certificate')
          }}
        />
      )
    }
    if (front === 'certificate' && lifeChoices !== null) {
      const plan =
        world === null
          ? null
          : planBirth(
              world,
              {
                givenName: lifeChoices.givenName,
                familyName: lifeChoices.familyName,
                sex: lifeChoices.sex,
                placeId: null,
                station: lifeChoices.station,
                birthTick: null,
              },
              seedFromRegistryNo(lifeChoices.seedCode) ??
                seedFromName(lifeChoices.givenName, lifeChoices.familyName),
            )
      if (plan !== null) {
        return (
          <BirthCertificate
            registryNo={plan.registryNo}
            childName={`${plan.givenName} ${plan.familyName}`}
            sex={plan.sex === 'male' ? 'Male' : 'Female'}
            dateWords={String(1970 + Math.floor(plan.birthTick / 12))}
            placeWords={lifeChoices.town}
            rows={plan.family.map((member: FamilySpec) => ({
              role:
                member.relation === 'sibling'
                  ? member.older
                    ? 'Elder'
                    : 'Younger'
                  : member.relation === 'father'
                    ? 'Father'
                    : 'Mother',
              name:
                member.maidenName === null
                  ? `${member.givenName} ${member.familyName}`
                  : `${member.givenName} ${member.familyName} (née ${member.maidenName})`,
              meta: `${String(member.ageYears)}${member.relation === 'father' ? ' · carries the name' : ''}`,
            }))}
            householdWords={plan.householdWords}
            onBegin={() => {
              // THE BIRTH IS REGISTERED HERE, which is the difference
              // between a certificate that names a family and a family
              // that exists. Until this call the father on the document
              // was nobody.
              beBorn(
                plan.givenName,
                plan.familyName,
                plan.sex,
                lifeChoices.station,
                seedFromRegistryNo(plan.registryNo) ?? 0,
              )
              setFront('engine')
            }}
          />
        )
      }
    }
    // A state with nothing to show falls back to the title rather than a
    // blank screen — the front door must never be a dead end.
    return (
      <TitleScreen
        hasSave={false}
        activeLine={null}
        onNewLife={() => setFront('intake')}
        onContinue={() => setFront('engine')}
        onPastLives={() => setFront('engine')}
        onEngine={() => setFront('engine')}
      />
    )
  }

  if (playerPerson && !playerDead) {
    return (
      <div className="game-root">
        <GameScreen
          world={world}
          person={playerPerson}
          busy={busy}
          onAdvance={advance}
          onStop={() => play(null)}
          onInspect={setInspecting}
          onApplyJob={applyJob}
          onRequestEnlist={requestEnlist}
          onRequestSchool={requestSchool}
          onTryUnit={tryUnit}
          onRequestDeploy={requestDeploy}
          onFitnessTest={fitnessTest}
          onExtraDuty={extraDuty}
          onAct={act}
          notice={message}
        />

        {pending !== null && !busy && (
          <DecisionPrompt
            world={world}
            pending={pending}
            onChoose={(answer) => {
              // A plea is answered and the court sits in the same tick, so
              // remember the month to read the verdict back from.
              if (pending.kind === 'plea') setVerdictTick(pending.tick)
              choose(answer)
            }}
          />
        )}

        {verdict !== null && !busy && (
          <VerdictSheet world={world} outcome={verdict} onClose={() => setVerdictTick(null)} />
        )}

        {inspecting !== null && world.people.has(inspecting) && (
          <div className="overlay" role="dialog" aria-modal="true" aria-label="About this person">
            <div className="sheet wide">
              <PersonDetail world={world} personId={inspecting} onSelect={setInspecting} />
              <div className="sheet-actions">
                <button type="button" onClick={() => setInspecting(null)}>
                  Back to your life
                </button>
              </div>
            </div>
          </div>
        )}

        {showWelcome && !busy && (
          <Welcome onLiveALife={dismissWelcome} onWatch={dismissWelcome} />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>The Life Simulator</h1>
          <p className="date">
            {world.town.name} · {formatDate(world, world.tick)}
          </p>
        </div>
        {playerPerson && (
          <button
            type="button"
            className={playerDead ? 'player-chip dead' : 'player-chip'}
            onClick={() => setSelected(playerPerson.id)}
            title="Show my life"
          >
            ▶ {fullName(playerPerson)}
            {!playerDead && `, ${ageAt(playerPerson.birthTick, world.tick)}`}
          </button>
        )}
        <button
          type="button"
          className="help"
          title="What is this?"
          aria-label="What is this?"
          onClick={() => setShowWelcome(true)}
        >
          ?
        </button>
        <div className="stats">
          <span>
            <strong>{livingPeople(world).length}</strong> living
          </span>
          <span>
            <strong>{deadCount}</strong> died
          </span>
          <span>
            <strong>{world.causalRecords.length}</strong> decisions explained
          </span>
        </div>
      </header>

      <section className="controls" aria-label="Time controls">
        <button type="button" disabled={busy} onClick={() => advance(1)}>
          + 1 month
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => advance(12)}>
          + 1 year
        </button>
        <button type="button" disabled={busy} onClick={() => advance(60)}>
          + 5 years
        </button>
        <button type="button" disabled={busy} onClick={() => advance(600)}>
          + 50 years
        </button>

        <span className="spacer" />

        {playerId === null ? (
          <button type="button" className="primary" disabled={busy} onClick={() => setPicking(true)}>
            Live a life
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => play(null)}>
            Stop playing
          </button>
        )}
        <span className="savestate" title="The world saves itself in this browser">
          {saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
        <label className="seed">
          Seed
          <input
            value={seedInput}
            inputMode="numeric"
            onChange={(e) => setSeedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setConfirmingNewWorld(true)
            }}
          />
        </label>
        {/* W2 — which world to build. The preset is chosen HERE and never
            again: it is fixed for a world's whole life, because place ids
            lead person ids lead trait streams, so the same seed under two
            presets is two different towns. */}
        {/* THE SETTING IS FIXED. This was a selector, and its default was
            Classic — so a player who never touched it released themselves
            into the fictional Republic. One world ships; the line stays as
            information rather than a choice. */}
        <label className="preset">
          Setting
          <span className="preset-fixed">
            {PRESETS.find((preset) => preset.id === chosenPreset)?.name ?? 'American Heartland'}
          </span>
        </label>
        {/* The preset's own words. For a real homeland this is the
            alternate-history framing WORLD_MODES_PLAN.md requires. */}
        <p className="preset-note muted small">
          {PRESETS.find((preset) => preset.id === chosenPreset)?.description ?? ''}
        </p>

        {confirmingNewWorld ? (
          <span className="confirm">
            Replace this world and its history with a new {
              PRESETS.find((preset) => preset.id === chosenPreset)?.name ?? 'Classic'
            } one?
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => {
                setConfirmingNewWorld(false)
                applySeed()
              }}
            >
              Yes, start over
            </button>
            <button type="button" onClick={() => setConfirmingNewWorld(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={() => setConfirmingNewWorld(true)}>
            New world
          </button>
        )}
      </section>

      {busy && (
        <p className="banner working">
          Simulating… the page stays responsive because the engine runs on a
          background thread.
        </p>
      )}
      {message !== null && !busy && (
        <p className={status === 'error' ? 'banner bad' : 'banner notice'}>
          {message}
          {status === 'error' && (
            <button type="button" className="link" onClick={discardSave}>
              delete the saved game
            </button>
          )}
        </p>
      )}

      <details className="panel demographics" aria-label="Town demographics">
        <summary>📊 Demographics — {livingPeople(world).length} living</summary>
        <TownStats world={world} />
      </details>

      <div className="columns">
        <section className="list" aria-label="People">
          <div className="filters" role="tablist">
            {(['living', 'working', 'children', 'dead'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {people.length === 0 ? (
            <p className="muted pad">Nobody yet.</p>
          ) : (
            <ul>
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className={selected === person.id ? 'selected' : ''}
                    onClick={() => setSelected(person.id)}
                  >
                    {person.id === playerId ? '▶ ' : ''}
                    {personSummary(world, person.id)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="Person detail">
          {selectedStillKnown && selected !== null ? (
            <PersonDetail world={world} personId={selected} onSelect={setSelected} />
          ) : (
            <div className="empty">
              <p>Pick anyone on the left to read their life so far.</p>
              <p className="muted small">
                The town only moves when you advance time. Add a year, watch
                what changes, and click “Why?” on anything that surprises you —
                or press <strong>Live a life</strong> and make the decisions
                yourself.
              </p>
            </div>
          )}
        </section>
      </div>

      {showWelcome && !busy && (
        <Welcome
          townName={world.town.name}
          onLiveALife={() => {
            dismissWelcome()
            setPicking(true)
          }}
          onWatch={dismissWelcome}
        />
      )}

      {picking && !busy && (
        <CharacterPicker
          world={world}
          onPlay={(id) => {
            setPicking(false)
            setSelected(id)
            play(id)
          }}
          onCreate={(spec) => {
            setPicking(false)
            createLife(spec)
          }}
          onCancel={() => setPicking(false)}
        />
      )}

      {pending !== null && !busy && (
        <DecisionPrompt world={world} pending={pending} onChoose={choose} />
      )}

      {playerDead && playerId !== null && !busy && (
        <Retrospective
          world={world}
          personId={playerId}
          onPlayHeir={(heirId) => {
            setSelected(heirId)
            play(heirId, true)
          }}
          onWatch={() => play(null)}
        />
      )}

      <footer>
        <span className={determinismOk ? 'check ok' : 'check bad'}>
          {determinismOk
            ? `Determinism verified in this browser (${GOLDEN_HASH_HEX})`
            : 'DETERMINISM CHECK FAILED — this browser disagrees with Node'}
        </span>
        <span className="muted small">
          {playerId === null ? 'Watching the town' : 'Living a life'} · engine on a
          worker thread · saves in this browser
          {lastElapsedMs !== null && ` · last step ${lastElapsedMs.toFixed(0)} ms`}
        </span>
      </footer>
    </div>
  )
}
