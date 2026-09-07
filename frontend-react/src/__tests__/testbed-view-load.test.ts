// ── THE VIEW'S LOAD AND RENDER: the model half ──────────────────────────
//
// Round 7 Phase 2d session 2, from the L/R enumeration.
import { describe, test, expect, vi } from 'vitest'
import {
  createArrivalFlags, notMine, OWNERSHIP_REFUSAL_TEXT, headerOf,
} from '../testbed/viewLoad'

describe('L1/L2: the arrival flags', () => {
  test('L2 a load is NOT an arrival unless something says so', () => {
    const f = createArrivalFlags()
    expect(f.consume(), 'a plain load read as an arrival').toBe(false)
  })

  test('L2 navigate marks it, and exactly one consume sees it', () => {
    const f = createArrivalFlags()
    f.markNavigation()
    expect(f.consume()).toBe(true)
    expect(f.consume(), 'the arrival flag survived being consumed').toBe(false)
  })

  test('L1 THE FLAG IS SPENT EVEN WHEN THE LOAD THEN FAILS', () => {
    // The whole reason it is consumed at the top. A flag cleared only by the
    // renderer survives a failed load, and the NEXT call - a save - reads as
    // an arrival and jumps to Reference.
    const f = createArrivalFlags()
    f.markNavigation()
    const arriving = f.consume()   // the GET is about to fail
    expect(arriving).toBe(true)
    expect(f.consume(), 'a failed load left the arrival flag set for the next save')
      .toBe(false)
  })

  test('R5 the landing stage is read and CLEARED, so a later load cannot inherit it', () => {
    const f = createArrivalFlags()
    f.landOn('Site Assessment')
    expect(f.takeLanding()).toBe('Site Assessment')
    expect(f.takeLanding(), 'an unrelated later load inherited the landing stage')
      .toBeNull()
  })

  test('R6 the landing applies to EVERY stage including the terminal one', () => {
    const f = createArrivalFlags()
    f.landOn('Closed')
    expect(f.takeLanding(), 'the final transition was excepted, which Round 10 Phase 7 removed')
      .toBe('Closed')
  })

  test('the two flags are independent: a landing is not an arrival', () => {
    const f = createArrivalFlags()
    f.landOn('Qualification')
    expect(f.consume()).toBe(false)
    expect(f.takeLanding()).toBe('Qualification')
  })
})

describe('L5: the door', () => {
  test('L5 not-mine needs ALL THREE: an owner, a viewer, and a difference', () => {
    expect(notMine('a', 'b')).toBe(true)
    expect(notMine('a', 'a'), 'the owner was locked out of their own record').toBe(false)
  })

  test('L5 an absent id on either side is NOT not-mine', () => {
    expect(notMine(null, 'b'), 'a record with no owner read as somebody else\'s').toBe(false)
    expect(notMine('a', null), 'a signed-out read locked the record').toBe(false)
    expect(notMine(undefined, undefined)).toBe(false)
  })

  test('L7 the refusal text says view-not-edit, not access-denied', () => {
    expect(OWNERSHIP_REFUSAL_TEXT).toMatch(/You can view it/)
    expect(OWNERSHIP_REFUSAL_TEXT).toMatch(/only its owner can change it/)
  })
})

describe('R1: the header', () => {
  test('R1 name and client organisation, with the name falling back visibly', () => {
    expect(headerOf({ payload: { name: 'Bed A', client_organisation: 'Acme' } }))
      .toEqual({ name: 'Bed A', client: 'Acme' })
    expect(headerOf({ payload: {} })).toEqual({ name: '--', client: '' })
    expect(headerOf({})).toEqual({ name: '--', client: '' })
  })

  test('L4 a failed load reads Not found rather than a stale name', () => {
    expect(headerOf(null)).toEqual({ name: 'Not found', client: '' })
  })
})
