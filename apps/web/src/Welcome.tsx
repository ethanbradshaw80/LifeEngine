/**
 * The first-run explainer, and the help sheet behind the "?" button.
 *
 * The game explains nothing anywhere else, by design — the interface stays
 * quiet (Law 9). That puts the whole burden of orientation here, once. Keep
 * it three ideas long: what this is, how time works, and that everything has
 * a reason. A new player who reads nothing else must still leave knowing the
 * world pauses for their decisions.
 */

interface Props {
  readonly onLiveALife: () => void
  readonly onWatch: () => void
  /** The town's own name (W1): the explainer must not know a preset's
   *  content. Falls back only when there is no world to ask yet. */
  readonly townName?: string
}

export function Welcome({ onLiveALife, onWatch, townName }: Props) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="sheet">
        <h2>A small town, running on its own</h2>

        <ul className="welcome-points">
          <li>
            <strong>Everyone in {townName ?? 'this town'} lives their own life.</strong> They grow
            up, work, marry, argue, save money, fall behind, grow old and die —
            whether you are watching or not.
          </li>
          <li>
            <strong>You can live one of those lives.</strong> Time only moves
            when you advance it, and the world stops to ask you the decisions
            that belong to you: what to do at eighteen, a job offer, a marriage,
            a failing one.
          </li>
          <li>
            <strong>Everything keeps a reason.</strong> Click “Why?” on almost
            anything that happened and the game answers from records made at
            the moment — never invented afterwards. When your life ends, your
            children can carry the story on.
          </li>
        </ul>

        <div className="sheet-actions">
          <button type="button" className="primary" onClick={onLiveALife}>
            Live a life
          </button>
          <button type="button" onClick={onWatch}>
            Just watch the town
          </button>
        </div>

        <p className="muted small">
          Your world saves itself in this browser as you play. The “?” up top
          brings this back.
        </p>
      </div>
    </div>
  )
}
