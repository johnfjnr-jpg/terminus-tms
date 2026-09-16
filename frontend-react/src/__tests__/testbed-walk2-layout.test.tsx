// ── WALK 2: THE FIVE MOVES, ASSERTED ────────────────────────────────────
//
// The geometry lives in `scripts/testbed-walk2/probe-walk2.mjs`, which
// measures baselines and gaps in a real browser. jsdom has no layout engine,
// so nothing here claims a pixel.
//
// WHAT THIS FILE IS FOR is the half a browser probe is the wrong instrument
// for: STRUCTURE. Which element contains which, and how many of each render.
// Those are the claims that rot silently when a later round moves something
// back, and they are the ones the light path's own close named as what stops
// "just look at it" becoming the method.
//
// EXACTLY ONE, NEVER AT LEAST ONE. Three of the five items are MOVES, and a
// move is two claims: the thing is in its new place AND gone from its old
// one. This estate has shipped the duplicate that skipping the second one
// produces, and the business found it.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TestBedHost } from '../testbed/TestBedHost'
import { ShellProvider } from '../ShellContext'
import { shellServices } from './fixtures'
import type { ShellServices } from '../shell-services'
import { STAGE_NAMES } from '../testbed/tabModel'

let host: HTMLElement
let root: Root

const BED = {
  id: 'tb-w2', status: 'Qualification', owner_id: 'user-1',
  latest_revision_number: 1,
  payload: { name: 'A bed', client_organisation: 'Acme Marine', summary: 'A summary.' },
}

// Shaped by what each ROUTE answers, not by what this file would prefer: the
// stage list is an array of {stage_name, sort_order}, and history answers an
// OBJECT. Verification 47.
const api = (async (_m: string, path: string) => {
  if (path.startsWith('/api/stage-definitions')) {
    return { ok: true, status: 200,
      data: STAGE_NAMES.map((stage_name, i) => ({ stage_name, sort_order: i + 1 })) }
  }
  if (path.endsWith('/history')) return { ok: true, status: 200, data: { entries: [] } }
  if (path.endsWith('/lifecycle-documents')) {
    return { ok: true, status: 200, data: { total: 0, produced: 0, groups: [] } }
  }
  if (path.startsWith('/api/test-beds/tb-w2')) return { ok: true, status: 200, data: BED }
  return { ok: true, status: 200, data: [] }
}) as ShellServices['api']

const mount = async (over: Partial<ShellServices> = {}) => {
  await act(async () => {
    root.render(
      <ShellProvider services={shellServices({ api, ...over })}>
        <TestBedHost bed={BED} />
      </ShellProvider>)
  })
  // The Next Stage action does not render until the stage list has ARRIVED, so
  // this waits on the state that fetch produces rather than on a tick count.
  // The counterfactual is the unloaded surface, which has no such element.
  for (let i = 0; i < 40 && !q('tb-next-stage-btn'); i++) {
    await act(async () => { await Promise.resolve() })
  }
  // AND THE WAIT IS ASSERTED, not merely performed. A bounded flush that gives
  // up silently and lets the next line dereference a null is what makes
  // `testbed-view-nav.test.tsx` fail half the time it is run on its own -
  // measured this round, at the tree BEFORE it, and reported rather than fixed.
  expect(q('tb-next-stage-btn'),
    'the surface never finished loading, so every assertion below is vacuous')
    .toBeTruthy()
}

const q = (t: string) => host.querySelector(`[data-testid="${t}"]`)
const all = (t: string) => host.querySelectorAll(`[data-testid="${t}"]`)

beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('W1: the account name is on the title line', () => {
  test('the client line is a SIBLING of the title, not a line under it', async () => {
    await mount()
    const title = q('tb-header-title')
    expect(title, 'the title block is gone').toBeTruthy()
    expect(title!.contains(q('tb-detail-name')!),
      'the name left the title block').toBe(true)
    expect(title!.contains(q('tb-detail-client')!),
      'the client is no longer in the title block, so it cannot share its line').toBe(true)
  })

  test('the client keeps the smaller grey treatment it already had', async () => {
    await mount()
    // `.sub` is the estate's muted 14px. The claim is that moving the element
    // did not cost it that dress - Verification 7's treatment axis, where a
    // control kept its position and lost its class.
    expect([...q('tb-detail-client')!.classList].sort())
      .toEqual(['sub', 'tb-header-client'])
  })

  test('and the element SURVIVES an empty client, so the row cannot change shape', async () => {
    // The reason this element exists at all, recorded when the header was
    // built: the title must not move between a record with an account and one
    // without. Re-asserted here because W1 changed what it sits beside.
    await act(async () => {
      root.render(
        <ShellProvider services={shellServices({ api })}>
          <TestBedHost bed={{ ...BED, payload: { name: 'A bed' } }} />
        </ShellProvider>)
    })
    expect(q('tb-detail-client'), 'the client element vanished when empty').toBeTruthy()
    expect(q('tb-detail-client')!.textContent).toBe('')
  })
})

describe('W3: Next Stage is on the tab line', () => {
  test('the button renders INSIDE the tab strip', async () => {
    await mount()
    expect(q('tb-detail-tabs')!.contains(q('tb-next-stage-btn')!),
      'Next Stage is outside the tab strip, which is where it was').toBe(true)
  })

  test('exactly one renders', async () => {
    await mount()
    expect(all('tb-next-stage-btn').length).toBe(1)
  })

  test('the feedback slot stays BELOW the row and does not travel with it', async () => {
    // Its own note says why: it is long free text, and inline in the row it
    // pushed the buttons off-screen at 1920.
    await mount()
    expect(q('tb-detail-tabs')!.contains(q('tb-next-stage-feedback')!),
      'the feedback moved into the tab row with the button').toBe(false)
  })
})

describe('W4: the redundant block is gone and the name row is not', () => {
  test('the TEST BED eyebrow and its header block no longer render', async () => {
    await mount()
    expect(q('tb-eyebrow'), 'the TEST BED eyebrow is still on the panel').toBeNull()
    expect(q('tb-header'), 'the panel header block is still there').toBeNull()
  })

  test('the NAME ROW SURVIVES, in Terminus Details', async () => {
    // THE CLAIM THAT MATTERS. Removing the block and deleting the row look
    // identical on screen and are not the same thing: that row is the only
    // place a Test Bed's name can be edited after creation.
    await mount()
    const row = q('display-name')
    expect(row, 'the name row is gone, so the name cannot be edited at all').toBeTruthy()
    expect(q('tb-card-terminus')!.contains(row!),
      'the name row is not in Terminus Details').toBe(true)
  })

  test('exactly one name row renders, so the move left no copy behind', async () => {
    await mount()
    expect(all('display-name').length).toBe(1)
  })

  test('it leads the card rather than trailing it', async () => {
    await mount()
    const keys = [...q('tb-card-terminus')!.querySelectorAll('[data-key]')]
      .map((e) => e.getAttribute('data-key'))
    expect(keys[0]).toBe('name')
    expect(keys).toEqual(['name', 'terminusLead', 'commercialAuthority',
      'technicalAuthority', 'terminusLegalOwner', 'region', 'country'])
  })
})

describe('W5: Convert to Opportunity is beside the title', () => {
  test('the trigger renders inside the header row', async () => {
    await mount()
    expect(q('tb-header-row')!.contains(q('tb-convert-trigger')!),
      'the convert trigger is not in the header row').toBe(true)
  })

  test('exactly one trigger renders, so it is a move and not a second copy', async () => {
    await mount()
    expect(all('tb-convert-trigger').length).toBe(1)
  })

  test('and it still OPENS THE FORM from its new place', async () => {
    // Clicked, not assumed. The browser probe proves the same thing against a
    // real pointer; this proves the wiring survived the change of parent.
    await mount()
    expect(q('tb-convert-form-wrap')).toBeNull()
    await act(async () => { (q('tb-convert-trigger') as HTMLElement).click() })
    expect(q('tb-convert-form-wrap'),
      'the trigger moved and stopped opening its form').toBeTruthy()
  })
})

describe('the blast radius: what must REMAIN', () => {
  test('every card still renders, by name', async () => {
    // Verification 7: a replacement asserts what was already there is still
    // there. Four things moved on this surface in one round, and a screenshot
    // of any one of them cannot show what stopped rendering elsewhere.
    await mount()
    expect([...host.querySelectorAll('[data-testid^="tb-card-"]')]
      .map((e) => e.getAttribute('data-testid')).sort())
      .toEqual(['tb-card-customer', 'tb-card-dates', 'tb-card-notes',
        'tb-card-score', 'tb-card-site', 'tb-card-summary', 'tb-card-terminus'])
  })

  test('the Summary and Notes band is intact and unduplicated', async () => {
    await mount()
    expect(all('tb-top-row').length).toBe(1)
    expect(all('tb-card-summary').length).toBe(1)
    expect(all('tb-card-notes').length).toBe(1)
    expect(all('display-summary').length).toBe(1)
    expect(q('tb-top-row')!.contains(q('tb-card-summary')!)).toBe(true)
    expect(q('tb-top-row')!.contains(q('tb-card-notes')!)).toBe(true)
  })

  test('the read-only banner slot survives the header rearrangement', async () => {
    await mount()
    expect(q('tb-readonly-banner'), 'the banner slot went with the header change')
      .toBeTruthy()
  })
})
