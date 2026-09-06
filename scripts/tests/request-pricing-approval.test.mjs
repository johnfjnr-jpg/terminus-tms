import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

// ── THE DUAL MODE, TESTED ON THE SHIPPED SOURCE ──────────────────────────
//
// Round 4 Phase 2. `requestPricingApproval` has two callers with opposite
// needs: the vanilla card, which wants its two elements written directly, and
// the React card, which owns them and must not have them written at all.
//
// THE FUNCTION IS EXTRACTED FROM app.js AND EVALUATED, not copied here. A copy
// would be a second reader and would go on passing after the original changed,
// which is the whole family of faults this project keeps recording.
const ROOT = new URL('../../', import.meta.url)
const APP = readFileSync(new URL('frontend/app.js', ROOT), 'utf8')

function extract() {
  const start = APP.indexOf('window.requestPricingApproval = async function')
  assert.ok(start > 0, 'requestPricingApproval is gone from app.js')
  // Walk braces from the first `{` so the end is found rather than guessed.
  const open = APP.indexOf('{', start)
  let depth = 0
  for (let i = open; i < APP.length; i++) {
    if (APP[i] === '{') depth++
    else if (APP[i] === '}') { depth--; if (depth === 0) return APP.slice(start, i + 1) }
  }
  throw new Error('the function never closes')
}

const SRC = extract()

function run({ reporter, apiOk = true, nextStage = 'Proposal' } = {}) {
  const dom = new JSDOM(`<!doctype html><body>
    <p class="pricing-approval-state" id="pricing-approval-state">before</p>
    <button id="btn-request-pricing-approval">Request approval of V2</button>
  </body>`)
  const { window } = dom
  const calls = []
  const ctx = {
    window,
    document: window.document,
    nextStageAfter: () => nextStage,
    currentOppStages: [], currentOppStage: 'Qualification', currentOppDetailId: 'opp-1',
    api: async () => { calls.push('api'); return apiOk ? { ok: true, data: {} } : { ok: false, data: { error: 'the route refused' } } },
    loadOpportunityDetail: async () => { calls.push('reload') },
  }
  // eslint-disable-next-line no-new-func
  const fn = new Function(...Object.keys(ctx), `${SRC}; return window.requestPricingApproval`)
  const impl = fn(...Object.values(ctx))
  return { window, calls, run: (rep) => impl('ver-1', 'V2', rep) }
}

test('the extraction found a real function, not a fragment', () => {
  assert.match(SRC, /^window\.requestPricingApproval = async function \(versionId, label, reporter\)/)
  assert.ok(SRC.trim().endsWith('}'), 'the extracted source does not close')
  assert.ok(SRC.includes('transition-requests'), 'the extracted body does not make the request')
})

test('CALLED BARE it still writes both elements, exactly as the vanilla needs', async () => {
  const h = run()
  const btn = h.window.document.getElementById('btn-request-pricing-approval')
  const state = h.window.document.getElementById('pricing-approval-state')
  const p = h.run(undefined)
  // The start writes happen synchronously, before the await.
  assert.equal(btn.disabled, true, 'the bare call did not disable the button')
  assert.equal(btn.textContent, 'Requesting...')
  assert.equal(state.textContent, '', 'the bare call did not clear the state line')
  await p
  assert.deepEqual(h.calls, ['api', 'reload'])
})

test('and on a refusal the bare call writes the message and releases the button', async () => {
  const h = run({ apiOk: false })
  await h.run(undefined)
  const btn = h.window.document.getElementById('btn-request-pricing-approval')
  const state = h.window.document.getElementById('pricing-approval-state')
  assert.equal(state.textContent, 'the route refused')
  assert.match(state.className, /msg-error/)
  assert.equal(btn.disabled, false)
  assert.equal(btn.textContent, 'Request approval of V2')
})

test('CALLED WITH A REPORTER it writes NOTHING and reports both events', async () => {
  const h = run()
  const events = []
  const btn = h.window.document.getElementById('btn-request-pricing-approval')
  const state = h.window.document.getElementById('pricing-approval-state')
  await h.run({ onStart: () => events.push('start'), onResult: (m, ok) => events.push(['result', m, ok]) })
  assert.deepEqual(events, ['start', ['result', '', true]])
  // NOT ONE WRITE. The button and the line are exactly as the DOM was built.
  assert.equal(btn.disabled, false, 'the reporter call disabled the button anyway')
  assert.equal(btn.textContent, 'Request approval of V2', 'the reporter call relabelled the button')
  assert.equal(state.textContent, 'before', 'the reporter call wrote the state line')
})

test('and a refusal reaches the reporter rather than the DOM', async () => {
  const h = run({ apiOk: false })
  const events = []
  const state = h.window.document.getElementById('pricing-approval-state')
  await h.run({ onStart: () => events.push('start'), onResult: (m, ok) => events.push([m, ok]) })
  assert.deepEqual(events, ['start', ['the route refused', false]])
  assert.equal(state.textContent, 'before', 'a refusal was written into the DOM')
})

test('the final-stage refusal takes the same two paths', async () => {
  const bare = run({ nextStage: null })
  await bare.run(undefined)
  assert.match(bare.window.document.getElementById('pricing-approval-state').textContent,
    /final stage/)

  const reported = run({ nextStage: null })
  const events = []
  await reported.run({ onStart: () => events.push('start'), onResult: (m, ok) => events.push([m, ok]) })
  assert.equal(events.length, 2)
  assert.match(events[1][0], /final stage/)
  assert.equal(events[1][1], false)
  assert.equal(reported.window.document.getElementById('pricing-approval-state').textContent, 'before')
})
