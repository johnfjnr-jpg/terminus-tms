// ── TQ_RESTORE G1 to G3: ONE LEAVE GUARD, BOTH PRICING TABS ──────────────
//
// Rulings G1 to G3 (John, 2026-11-25), spec v2.2 section 14.9. One registry of
// dirty sources, asked by navigate() and by beforeunload; the Commercials
// form, the Term quote tab and the assessment drafts registered; the one
// existing dialogue. Triggers: navigating to ANOTHER record, and closing or
// reloading. A tab switch, a method switch, or a list view keeps the edits.
//
// THE CODE RUN IS app.js's OWN, extracted by name and executed (not matched as
// text: Verification 39). Every name the extracted code reaches that is not
// supplied resolves to an inert stub, so navigate() runs end to end and what
// is measured is which of the supplied services it called.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const APP = readFileSync(new URL('../../frontend/app.js', import.meta.url), 'utf8')

// RED FIRST: the hook refuses a red suite, so every test here is a todo until
// the build commit removes this marker. Each test still RUNS; a todo failure
// prints as todo.
const RED_FIRST = { todo: 'TQ_RESTORE red first: built in the guard commit' }

const block = (startText, what) => {
  const start = APP.indexOf(startText)
  assert.ok(start >= 0, `${what} is not in app.js`)
  const open = APP.indexOf('{', start)
  let depth = 0
  for (let i = open; i < APP.length; i++) {
    if (APP[i] === '{') depth++
    else if (APP[i] === '}') { depth--; if (depth === 0) return APP.slice(start, i + 1) }
  }
  throw new Error(`${what} never closes`)
}

const stub = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? [][Symbol.iterator] : k === 'then' ? undefined : stub),
  apply: () => stub,
})

function load({ assessDirty = [], currentOppDetailId = 'opp-a' } = {}) {
  const src = [
    APP.slice(APP.indexOf('const dirtySources = new Map()'), APP.indexOf('\n', APP.indexOf('const dirtySources = new Map()'))),
    block('window.tmsRegisterDirtySource = function', 'the registry'),
    block('function dirtySourceNames(', 'dirtySourceNames'),
    block('function leaveDiscards(', 'leaveDiscards'),
    block('function navigate(', 'navigate'),
    `${block("window.addEventListener('beforeunload'", 'the beforeunload listener')})`,
  ].join('\n')
  const prompts = []
  const listeners = {}
  const hidden = []
  const ctx = {
    window: { addEventListener: (n, f) => { listeners[n] = f } },
    currentOppDetailId,
    oppAssessDirtyKeys: () => assessDirty,
    oppAssessDraft: {}, oppAssessReason: {}, oppAssessAnswer: {},
    openDiscardConfirm: (cb) => { prompts.push(cb) },
    ALL_VIEWS: ['opportunity-detail'],
    document: { getElementById: () => ({ classList: { add: (c) => hidden.push(c), remove: () => {}, contains: () => false } }), querySelectorAll: () => [], querySelector: () => null },
  }
  const scope = new Proxy(ctx, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : (k in globalThis ? globalThis[k] : stub)),
  })
  // eslint-disable-next-line no-new-func
  const out = new Function('scope', `with (scope) { return (function () { ${src}; return { navigate, leaveDiscards, dirtySourceNames, register: window.tmsRegisterDirtySource } })() }`)(scope)
  return { ...out, prompts, listeners, hidden }
}
const unload = (g) => { const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, returnValue: undefined }; g.listeners.beforeunload(e); return e.defaultPrevented }

test('G1: a source registers, reports dirty through its own function, and unregisters', RED_FIRST, () => {
  const g = load()
  let dirty = false
  const off = g.register('term_quote', () => dirty)
  assert.deepEqual(g.dirtySourceNames(), [])
  dirty = true
  assert.deepEqual(g.dirtySourceNames(), ['term_quote'])
  off()
  assert.deepEqual(g.dirtySourceNames(), [], 'unregistered, and still asked')
})

test('G1: re-registering a name replaces it, and the OLD unregister does not remove the new one', RED_FIRST, () => {
  const g = load()
  const offOld = g.register('commercials', () => true)
  g.register('commercials', () => false)
  offOld()
  g.register('commercials', () => true)
  assert.deepEqual(g.dirtySourceNames(), ['commercials'])
})

test('G1: the assessment drafts are a registered source, unchanged', RED_FIRST, () => {
  assert.deepEqual(load({ assessDirty: ['assessCommBudgetConfirmed'] }).dirtySourceNames(), ['assessment'])
})

for (const name of ['commercials', 'term_quote']) {
  test(`G2: ${name} dirty, navigating to ANOTHER record asks the one dialogue and moves nothing`, RED_FIRST, () => {
    const g = load()
    g.register(name, () => true)
    g.navigate('opportunity-detail', 'opp-b')
    assert.equal(g.prompts.length, 1, 'no prompt: the dirty source was not asked')
    assert.deepEqual(g.hidden, [], 'the screen moved before the person answered')
  })

  test(`G2: ${name} dirty, Discard then navigates, and does not ask twice`, RED_FIRST, () => {
    const g = load()
    g.register(name, () => true)
    g.navigate('opportunity-detail', 'opp-b')
    g.prompts[0]()
    assert.equal(g.prompts.length, 1, 'the confirmed navigation asked again')
    assert.ok(g.hidden.includes('hidden'), 'Discard did not navigate')
  })

  test(`G2: ${name} dirty, the SAME record and a list view do not ask`, RED_FIRST, () => {
    const g = load()
    g.register(name, () => true)
    assert.equal(g.leaveDiscards('opportunity-detail', 'opp-a'), false)
    assert.equal(g.leaveDiscards('leads', undefined), false)
    assert.equal(g.leaveDiscards('opportunity-detail', 'opp-b'), true)
  })

  test(`G2: ${name} dirty, closing or reloading the browser is prevented`, RED_FIRST, () => {
    const g = load()
    let dirty = true
    g.register(name, () => dirty)
    assert.equal(unload(g), true)
    dirty = false
    assert.equal(unload(g), false, 'a clean page was still held')
  })
}

test('nothing dirty: navigating to another record does not ask', RED_FIRST, () => {
  const g = load()
  g.register('commercials', () => false)
  g.register('term_quote', () => false)
  g.navigate('opportunity-detail', 'opp-b')
  assert.equal(g.prompts.length, 0)
})

test('a source whose function throws reads as clean, never as a stuck page', RED_FIRST, () => {
  const g = load()
  g.register('term_quote', () => { throw new Error('unmounted') })
  assert.deepEqual(g.dirtySourceNames(), [])
})
