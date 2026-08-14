/**
 * EACH TRADE IN ITS OWN WORDS (owner, 2026-08-14: "I don't like how every
 * trade is 'stock the shelfs' either or whatever, every business is
 * different how can a software company 'stock the shelfs' you know what I
 * mean? Each should be unique to each business").
 *
 * THE CLAIMS: every trade in the table has its own vocabulary; no trade is
 * left reading the corner-shop words by accident; a software company never
 * mentions a shelf; and the placeholders in the moments actually resolve —
 * a question shown to a player must never contain a raw {stock}.
 */

import { describe, expect, it } from 'vitest'
import { BUSINESS_KINDS } from '../src/business.js'
import { BUSINESS_MOMENTS } from '../src/moments.js'
import { PLAIN_WORDS, inTradeWords, wordsFor } from '../src/tradewords.js'

describe('every trade speaks for itself', () => {
  it('has its own words, not the corner shop’s', () => {
    /**
     * THE COMPLAINT AS A TEST. One vocabulary was written for a shop and
     * then shown to a dentist, a haulier and a software company.
     */
    // NOT AN EMPTY LOOP. A for-of over a table that turned out to be empty
    // would pass this test while proving nothing — the exact shape that let
    // a units bug through earlier in this build.
    expect(BUSINESS_KINDS.length).toBeGreaterThanOrEqual(20)
    for (const kind of BUSINESS_KINDS) {
      const words = wordsFor(kind.id)
      expect(words, `${kind.id} has no words`).not.toBe(PLAIN_WORDS)
      expect(words.order.length).toBeGreaterThan(3)
      expect(words.store.length).toBeGreaterThan(2)
    }
  })

  it('never tells a software company to stock a shelf', () => {
    const software = wordsFor('software-company')
    const everything = [
      software.stock,
      software.store,
      software.supplier,
      software.order,
      software.clear,
      software.customers,
    ].join(' ')
    expect(everything.toLowerCase()).not.toContain('shelf')
    expect(everything.toLowerCase()).not.toContain('stockroom')
    // And it says something true about what a software business actually
    // holds before it earns anything.
    expect(software.stock).toContain('server')
    expect(software.customers).toBe('subscribers')
  })

  it('gives a filling station tanks and a diner a walk-in', () => {
    expect(wordsFor('filling-station').stock).toBe('fuel')
    expect(wordsFor('filling-station').order.toLowerCase()).toContain('tank')
    expect(wordsFor('diner').stock).toBe('ingredients')
    expect(wordsFor('dental-practice').customers).toBe('patients')
    expect(wordsFor('video-rental').customers).toBe('members')
    expect(wordsFor('contracting-firm').store).toBe('the yard')
  })

  it('falls back to plain words for a trade nobody has written yet', () => {
    // Unfinished rather than wrong: a new trade reads plainly instead of
    // claiming to have shelves.
    expect(wordsFor('a-trade-that-does-not-exist')).toBe(PLAIN_WORDS)
  })
})

describe('the moments read in the trade’s own voice', () => {
  it('resolves every placeholder for every trade', () => {
    /**
     * THE FAILURE THIS GUARDS: a question reaching a player with a raw
     * `{stock}` in it. Cheap to check and impossible to spot by reading,
     * because it only shows on the trades nobody tested.
     */
    for (const kind of BUSINESS_KINDS) {
      for (const moment of BUSINESS_MOMENTS) {
        const said = inTradeWords(moment.question, kind.id)
        expect(said, `${kind.id}/${moment.id} left a placeholder`).not.toMatch(/[{}]/)
        expect(said.length).toBeGreaterThan(20)
      }
    }
  })

  it('says genuinely different things to a garage and a software company', () => {
    const supplierFails = BUSINESS_MOMENTS.find((moment) => moment.id === 'supplier-fails')
    expect(supplierFails).toBeDefined()
    if (!supplierFails) return
    const garage = inTradeWords(supplierFails.question, 'filling-station')
    const software = inTradeWords(supplierFails.question, 'software-company')
    expect(garage).not.toBe(software)
    expect(garage).toContain('fuel')
    expect(software).toContain('servers')
  })
})
