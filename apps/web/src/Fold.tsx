/**
 * A FOLD — a tappable bubble that opens.
 *
 * OWNER: "keep in mind that most players are mobile, I feel like there a lot
 * of scrolling that we could cut out by adding bubbles and or drop down tab or
 * something where you click and it shows the info."
 *
 * He is right, and it is worst exactly where the game got deepest: the service
 * record is now a rack, a badge list, a wound list and a decoration list, one
 * under the other, and on a phone that is four screens of scrolling before you
 * reach the thing you opened the tab for.
 *
 * WHY `<details>` AND NOT A useState TOGGLE. It needs no JavaScript, no state
 * to keep in sync, and no re-render to open; it is keyboard-operable and
 * screen-reader-labelled for free; and it survives a re-render, which a
 * useState in a list of rows does not. The browser has had this element for
 * years and every hand-rolled accordion in this app would have been worse.
 *
 * THE SUMMARY LINE CARRIES ITS OWN ANSWER where it can — a count, or a phrase
 * — so that a closed fold still tells you whether it is worth opening. A row
 * of shut boxes labelled only "Wounds" is a worse screen than the scrolling
 * it replaced.
 */

import type { ReactElement, ReactNode } from 'react'

export function Fold({
  title,
  count,
  hint,
  tone,
  open = false,
  children,
}: {
  readonly title: string
  /** Shown as a chip. Omit where a count means nothing. */
  readonly count?: number
  /** One line of what is inside, so a shut fold is still informative. */
  readonly hint?: string
  /**
   * HOW THE HINT READS AT A GLANCE.
   *
   * Seventeen schools in one column all look alike when every status line is
   * the same grey. `ok` is the one you can act on, `no` the one you cannot,
   * and the default is neither — so a thumb can find the actionable row
   * without reading all seventeen.
   */
  readonly tone?: 'ok' | 'no'
  /** Open on arrival — for the one thing a screen is usually opened for. */
  readonly open?: boolean
  readonly children: ReactNode
}): ReactElement {
  return (
    <details className="fold" open={open}>
      <summary>
        <span className="fold-title">{title}</span>
        {count !== undefined && <span className="fold-count">{count}</span>}
        {hint !== undefined && hint.length > 0 && (
          <span className={tone === undefined ? 'fold-hint' : `fold-hint ${tone}`}>{hint}</span>
        )}
        <span className="fold-mark" aria-hidden="true" />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}
