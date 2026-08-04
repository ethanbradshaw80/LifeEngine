/**
 * The front page (owner's newsroom spec §3).
 *
 * Clicking the station used to open a bare reverse-chronological feed. A
 * station has a front page: a masthead, a ticker of the week's one-liners,
 * a lead story with the weight it deserves, and sections underneath so the
 * war, the courthouse and the town are not one undifferentiated list.
 *
 * WHAT LEADS IS CHOSEN, NOT RANDOM. The heaviest item of the period leads,
 * by a fixed order of gravity — a death outranks a verdict, a verdict
 * outranks a war note — and ties break on recency. The same month always
 * prints the same front page, which is the determinism rule applied to
 * editing rather than to dice.
 */

import type { JSX } from 'react'
import { articleFor, formatYear } from '@life-engine/engine'
import type { NewsItem, World } from '@life-engine/engine'

/** How heavy a story is. The lead is the heaviest thing that happened. */
function gravityOf(item: NewsItem): number {
  if (item.kind === 'died-in-service') return 100
  if (item.kind === 'crime') return 60
  if (item.kind === 'recruiting-drive') return 20
  return 40
}

/** Which section a story belongs under. */
function sectionOf(item: NewsItem): 'war' | 'courts' | 'local' | 'obituaries' {
  if (item.kind === 'died-in-service') return 'obituaries'
  if (item.kind === 'crime') return 'courts'
  if (item.kind === 'recruiting-drive') return 'local'
  return 'war'
}

const SECTION_TITLES: Readonly<Record<string, string>> = {
  war: 'War & Nation',
  courts: 'Crime & Courts',
  local: 'Local',
  obituaries: 'Obituaries',
}

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

export function FrontPage({
  world,
  items,
  onOpen,
  openKeys,
}: {
  readonly world: World
  /** Newest first. */
  readonly items: readonly NewsItem[]
  readonly onOpen: (key: string) => void
  readonly openKeys: ReadonlySet<string>
}): JSX.Element {
  const recent = items.slice(0, 40)
  const lead = [...recent].sort(
    (a, b) => gravityOf(b) - gravityOf(a) || b.tick - a.tick,
  )[0]

  // A KEY PER STORY, and it has to be unique AND stable.
  //
  // It used to be `tick-text`, which collides the month two different houses
  // are robbed — the newsroom words both the same way, so React saw one row
  // twice and opening one article opened both. The occurrence number breaks
  // the tie without making the key positional: a story keeps its identity as
  // newer items arrive above it, which is what keeps an open article open.
  const keys = new Map<NewsItem, string>()
  const seen = new Map<string, number>()
  for (const item of recent) {
    const base = `${String(item.tick)}-${item.text}`
    const nth = seen.get(base) ?? 0
    seen.set(base, nth + 1)
    keys.set(item, nth === 0 ? base : `${base}#${String(nth)}`)
  }

  const leadKey = lead === undefined ? '' : (keys.get(lead) ?? '')
  const leadArticle = lead === undefined ? null : articleFor(world, lead)

  // The ticker: the newest one-liners, whatever they are.
  const ticker = recent.slice(0, 5).map((item) => item.text)

  const sections: readonly ('obituaries' | 'war' | 'courts' | 'local')[] = [
    'obituaries',
    'war',
    'courts',
    'local',
  ]

  return (
    <div className="station-front">
      <div className="mast">
        <span className="mast-logo">{world.spec.gazetteer.newsStation}</span>
        <div className="mast-titles">
          <div className="mast-title">{world.town.name} County News</div>
          <div className="mast-tag">{world.spec.homelandName ?? 'the Republic'}</div>
        </div>
        <div className="mast-date">
          {formatYear(world, world.tick as never)}
          <br />
          Evening Edition
        </div>
      </div>

      {ticker.length > 0 && (
        <div className="ticker">
          <span className="ticker-tag">● LIVE</span>
          <span className="ticker-items">{ticker.join(' — ')}</span>
        </div>
      )}

      {lead !== undefined && leadArticle !== null && (
        <div className="lead-story">
          <div className="lead-kicker">{SECTION_TITLES[sectionOf(lead)]}</div>
          <h1 className="lead-headline">{leadArticle.headline}</h1>
          <p className="lead-lede">{leadArticle.lede}</p>
          {leadArticle.quote !== null && (
            <div className="lead-by">
              “{leadArticle.quote.text}” — <b>{leadArticle.quote.source}</b>
            </div>
          )}
          <button type="button" className="why" onClick={() => onOpen(leadKey)}>
            {openKeys.has(leadKey) ? 'Close' : 'Read the full story'}
          </button>
          {openKeys.has(leadKey) && (
            <div className="card-why article">
              {leadArticle.body.map((paragraph, i) => (
                <p key={`${String(i)}-${paragraph}`}>{paragraph}</p>
              ))}
              {leadArticle.closing !== null && <p>{leadArticle.closing}</p>}
            </div>
          )}
        </div>
      )}

      {sections.map((section) => {
        const inSection = recent.filter((item) => sectionOf(item) === section && item !== lead)
        if (inSection.length === 0) return null
        return (
          <div className="news-section" key={section}>
            <h2>{SECTION_TITLES[section]}</h2>
            {inSection.slice(0, 5).map((item) => {
              const key = keys.get(item) ?? `${String(item.tick)}-${item.text}`
              const article = articleFor(world, item)
              return (
                <div className="story" key={key}>
                  <div className="story-head">{sentence(item.text)}</div>
                  <div className="story-date">
                    {formatYear(world, item.tick)}
                    {article !== null && (
                      <button type="button" className="why" onClick={() => onOpen(key)}>
                        {openKeys.has(key) ? 'Close' : 'Article'}
                      </button>
                    )}
                  </div>
                  {openKeys.has(key) && article !== null && (
                    <div className="card-why article">
                      <p className="article-byline">
                        {world.spec.gazetteer.newsStation} — {article.dateline}
                      </p>
                      <h4 className="article-headline">{article.headline}</h4>
                      <p className="article-lede">{article.lede}</p>
                      {article.body.map((paragraph, i) => (
                        <p key={`${String(i)}-${paragraph}`}>{paragraph}</p>
                      ))}
                      {article.quote !== null && (
                        <p className="article-quote">
                          “{article.quote.text}” — {article.quote.source}
                        </p>
                      )}
                      {article.closing !== null && <p>{article.closing}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
