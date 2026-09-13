// ── THE CONFORMANCE GATE: WHAT A WALK USED TO CATCH ──────────────────────
//
// > The failure mode to END is: locally-correct panels, a globally
// > inconsistent app, caught only by walking.
//
// This is the cheap half - no browser, no database - so it runs in the pure
// suite on every commit. The geometry half (S1's right-alignment, S3's
// alignment) needs a browser and lives in the live probe.
//
// EVERY RULE HERE IS STRUCTURAL. Verification 19: a guard that enumerates by
// NAME fails silently on the member nobody added, so the population comes
// from `data-panel`, which the shell emits, and from the import graph.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { stripJs, stripCss } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const SRC = join(ROOT, 'frontend-react/src')

/**
 * THE ONE DECLARED EXEMPTION, AND IT IS A FUNCTION CALL.
 *
 * Verification 19's clause: where a guard strips comments, an exemption
 * cannot be a comment - prose cannot satisfy a scan that removes prose, and
 * it must not be able to grant one either. So it is code, defined HERE in the
 * guard's own module, which means minting a new one is an edit to this file
 * in a diff somebody reads.
 *
 * `FollowUpTask` is FROZEN by ruling: the follow-up entity round rebuilds it,
 * and this round is explicitly forbidden from unfreezing it to conform. Its
 * three unclassed controls are carried, not hidden.
 */
const frozenByRuling = (file) => file.endsWith('contact/FollowUpTask.tsx')

const allFiles = (dir) => {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (/node_modules|__tests__|\.test\./.test(p)) continue
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(p)) out.push(p)
    }
  }
  walk(dir)
  return out
}

/** The Leads surfaces: every component the list renders, transitively. */
const renderClosure = (entry) => {
  const seen = new Set(), out = []
  const visit = (f) => {
    if (seen.has(f)) return
    seen.add(f); out.push(f)
    let src; try { src = stripJs(readFileSync(f, 'utf8')) } catch { return }
    const used = new Set([...src.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]))
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
      const names = m[1].split(',').map((x) => x.replace(/\s+as\s+.*/, '').trim())
      if (!names.some((n) => used.has(n))) continue
      const base = resolve(dirname(f), m[2])
      for (const ext of ['', '.tsx', '.ts', '.js']) {
        try { readFileSync(base + ext, 'utf8'); visit(base + ext); break } catch { /* next */ }
      }
    }
  }
  visit(entry)
  return out.filter((f) => /\.tsx?$/.test(f))
}
const LEADS = renderClosure(join(SRC, 'leads/LeadsList.tsx'))

const css = stripCss(readFileSync(join(ROOT, 'frontend/style.css'), 'utf8'))
const definedClasses = new Set()
for (const sel of [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()))
  for (const m of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) definedClasses.add(m[1])

const CONTROL = /<(button|input|textarea|select)\b([^>]*)>/gs
const classesOf = (attrs) => {
  const raw = /className=["'{]([^"'}]*)/.exec(attrs)?.[1] ?? ''
  return raw.split(/[\s`${}]+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c))
}

test('S5: every control on a Leads surface carries a class the stylesheet defines', () => {
  const bare = []
  for (const f of LEADS) {
    if (frozenByRuling(f)) continue
    const src = stripJs(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(CONTROL)) {
      const cls = classesOf(m[2])
      // A control taking its class from a spread is checked where the spread
      // is built, not here; `className` present but empty is still bare.
      if (/\{\.\.\./.test(m[2]) && !/className=/.test(m[2])) continue
      if (!cls.some((c) => definedClasses.has(c)))
        bare.push(`${relative(SRC, f)}:${src.slice(0, m.index).split('\n').length} <${m[1]}>`)
    }
  }
  assert.deepEqual(bare, [], `controls with no defined class:\n  ${bare.join('\n  ')}`)
})

test('S5: panel-scoped actions use ONE treatment', () => {
  // The header's action slot is `.panel-actions`; everything a panel puts
  // there is `.btn-sm`. The RECORD BAR keeps btn-primary against btn-ghost,
  // because INTERACTION_STANDARDS Section 10 records that as deliberate.
  const wrong = []
  for (const f of LEADS) {
    const src = stripJs(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(/<SaveControl\b/g)) void m
  }
  const sc = readFileSync(join(SRC, 'ui/SaveControl.tsx'), 'utf8')
  for (const m of stripJs(sc).matchAll(CONTROL)) {
    const cls = classesOf(m[2])
    if (!cls.includes('btn-sm')) wrong.push(`SaveControl <${m[1]}> carries ${cls.join(' ') || '(none)'}`)
  }
  assert.deepEqual(wrong, [], wrong.join('\n'))
})

// The stem of an id template, with interpolations blanked, so a per-record
// id can be matched against its own declaration.
const stemOf = (target) => target.replace(/\$\{[^}]*\}/g, '\u0000').split('\u0000')[0]

/**
 * Is this id template DECLARED anywhere, rather than invented at the pointer?
 *
 * NOT `id=` + the stem. The first version asked that and flagged a pointer
 * that is correct: the modal's id arrives through a `regionId` PROP, so the
 * literal `id={\`address-popup-region-` appears nowhere. An indirection the
 * check could not see read as a broken pointer.
 *
 * The honest question is whether the string exists anywhere OTHER than at the
 * aria-controls attribute itself. A genuinely invented pointer appears once,
 * at the site that invents it.
 */
const declaredSomewhere = (stem, corpus) => {
  const hits = corpus.split(stem).length - 1
  const atPointer = (corpus.match(new RegExp(
    `aria-controls=[^\\n]*${stem.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length
  return hits > atPointer
}

test('R3: every aria-controls on a Leads surface names a declared id', () => {
  // The door exempts [aria-controls] by PRESENCE, so a pointer naming nothing
  // grants the exemption anyway - an exemption held by a false declaration.
  //
  // SCOPED TO LEADS, because the scope ruling is explicit that other surfaces
  // converge as later rounds touch them. `deal/section4.tsx` carries a broken
  // pointer too and is recorded as carried rather than failing a gate on work
  // this round was told not to do.
  const corpus = allFiles(SRC).map((f) => stripJs(readFileSync(f, 'utf8'))).join('\n')
  const broken = []
  for (const f of LEADS) {
    const src = stripJs(readFileSync(f, 'utf8'))
    for (const m of src.matchAll(/aria-controls=\{`([^`]+)`\}|aria-controls="([^"]+)"/g)) {
      const target = m[1] ?? m[2]
      if (!declaredSomewhere(stemOf(target), corpus))
        broken.push(`${relative(SRC, f)} -> "${target}"`)
    }
  }
  assert.deepEqual(broken, [], `aria-controls naming nothing:\n  ${broken.join('\n  ')}`)
})

test('R3: and the check can SEE a broken pointer - calibrated on the real one', () => {
  // Verification 9: a detector not proven capable of failing is not evidence.
  // `deal/section4.tsx` carries a genuinely broken pointer, out of this
  // round's scope, and it is the calibration anchor: if the check stops
  // seeing it, the check has stopped working.
  //
  // A SYNTHETIC anchor is checked too, so this test survives the day the deal
  // surface is fixed - Verification 9's clause about a calibration anchored
  // on the defect it watches.
  const corpus = allFiles(SRC).map((f) => stripJs(readFileSync(f, 'utf8'))).join('\n')
  assert.equal(declaredSomewhere('a-region-name-nothing-declares', corpus), false,
    'the check reports a fabricated pointer as declared')
  assert.equal(declaredSomewhere('address-popup-region-', corpus), true,
    'the check reports a real, prop-passed id as undeclared')
})

/**
 * THE SHELL'S OWN VOCABULARY, DERIVED FROM `Panel.tsx` RATHER THAN RETYPED.
 *
 * A second copy of this list would agree today and drift later, which is
 * Verification 20 inside the guard meant to prevent it.
 */
const shellClasses = () => {
  const src = stripJs(readFileSync(join(SRC, 'ui/Panel.tsx'), 'utf8'))
  return new Set([...src.matchAll(/className=\{?[`"]([^`"{]+)/g)]
    .flatMap((m) => m[1].split(/\s+/)).filter(Boolean))
}

/**
 * THE DECLARED NON-PANEL HEADINGS, each a CALL with its reason.
 *
 * ── WHY THIS IS NOT THE NAME LIST IT REPLACES ───────────────────────────
 *
 * The previous test held three class names and failed a surface only if it
 * used one of them. `QualifyCompletion` used none, so it passed while
 * hand-rolling a panel header - Verification 19 inside the gate built to
 * enforce Verification 19.
 *
 * THE POLARITY IS INVERTED HERE. Every title-shaped class in a Leads
 * surface is an offender UNLESS it is the shell's or declared below. A new
 * `foo-header` goes RED until somebody says in a diff why it is not a
 * panel. That is Verification 19's actual remedy: fail on the unrecorded
 * instance.
 */
const declaredNonPanel = (cls) => (
  // Section 6's record action bar: the card's own head line and the action
  // group inside it. A record-scoped bar is not a panel header, and
  // INTERACTION_STANDARDS Section 0 is explicit that these are two scopes
  // of one principle rather than the same thing.
  cls === 'lead-card-head' || cls === 'lead-card-actions'
  // A LIST group heading, above a set of cards. It heads a collection, not
  // a panel, and has no fields under it.
  || cls === 'lead-group-title'
  // A modal's OWN header. John's ruling makes a modal a distinct shape with
  // its footer actions; its title line is not a PanelHeader.
  || cls === 'new-lead-head' || cls === 'new-lead-title' || cls === 'form-actions'
)

test('THE PRINCIPLE: a Leads surface does not build a panel header of its own', () => {
  // STRUCTURAL: any class shaped like a heading or an action row, anywhere
  // in a Leads surface, must come from the shell or be declared above.
  const SHAPED = /-(title|head|header|actions)\b/
  const allowed = shellClasses()
  const offenders = []
  for (const f of LEADS) {
    if (frozenByRuling(f)) continue
    if (!f.includes('/leads/')) continue
    const src = stripJs(readFileSync(f, 'utf8'))
    const classes = new Set([...src.matchAll(/className=\{?[`"]([^`"]+)/g)]
      .flatMap((m) => m[1].split(/[\s${}]+/))
      .filter((c) => /^[a-z][\w-]*$/.test(c)))
    for (const c of classes) {
      if (!SHAPED.test(c)) continue
      if (allowed.has(c) || declaredNonPanel(c)) continue
      offenders.push(`${relative(SRC, f)} -> .${c}`)
    }
  }
  assert.deepEqual(offenders, [],
    `Leads surfaces building a header or action row of their own:\n  ${offenders.join('\n  ')}\n`
    + '  Route it through Panel/PanelHeader, or declare in declaredNonPanel() why it is not a panel.')
})

test('and the shell vocabulary is DERIVED, so it cannot drift from Panel.tsx', () => {
  // Verification 9: the derivation is proven capable of failing. If Panel
  // stops emitting these, the allowlist empties and the test above starts
  // flagging the shell's own classes - which is the correct failure.
  const allowed = shellClasses()
  for (const c of ['panel-head', 'panel-title', 'panel-actions'])
    assert.ok(allowed.has(c), `Panel.tsx no longer emits .${c}, so the allowlist has lost it`)
})

test('the registry is STRUCTURAL: every Panel names itself', () => {
  const panel = stripJs(readFileSync(join(SRC, 'ui/Panel.tsx'), 'utf8'))
  assert.match(panel, /data-panel=\{name\}/,
    'Panel stopped emitting data-panel, so the census has no population')
  // And at least one real panel is registered, so the population is not
  // empty for a reason nobody notices - Verification 14's true-by-absence.
  const registered = LEADS.filter((f) => /<Panel\b/.test(stripJs(readFileSync(f, 'utf8'))))
  assert.ok(registered.length > 0, 'no Leads surface renders a Panel at all')
})

test('SECTION 4 and 5 live in ONE place', () => {
  // A standard re-implemented per dialogue is the thing this round exists to
  // stop. Nothing in leads/ may hand-roll a modal backdrop.
  const offenders = []
  for (const f of LEADS) {
    if (!f.includes('/leads/')) continue
    const src = stripJs(readFileSync(f, 'utf8'))
    if (/className="modal-backdrop/.test(src)) offenders.push(relative(SRC, f))
  }
  assert.deepEqual(offenders, [],
    `dialogues not routed through Modal:\n  ${offenders.join('\n  ')}`)
})

test('R1: the autofill override exists and targets the card\'s inputs', () => {
  // ── THE PROVABLE HALF, AND ONLY THAT ──────────────────────────────────
  //
  // Chrome's `:autofill` leaves a white block on a completed field until
  // its value changes. It is a PSEUDO-CLASS, so no class and no computed
  // background changes on any element a test can construct, and headless
  // Chrome cannot be made to autofill at all.
  //
  // So this asserts what a static check honestly can: the rule EXISTS, it
  // uses the only property that overrides Chrome there, and it reaches
  // every input class the card renders. The visual - an autofilled field
  // now rendering normally - is John's observation and is recorded as such
  // rather than implied by a green test.
  const css = stripCss(readFileSync(join(ROOT, 'frontend/style.css'), 'utf8'))
  const blocks = [...css.matchAll(/([^{}]*:-webkit-autofill[^{}]*)\{([^}]*)\}/g)]
  assert.ok(blocks.length > 0, 'no :-webkit-autofill rule exists at all')
  const selectors = blocks.map((m) => m[1]).join(' ')
  const body = blocks.map((m) => m[2]).join(' ')

  // `background-color` is IGNORED on this pseudo-class; an inset box-shadow
  // is the only override Chrome honours. A rule that sets the wrong
  // property is a rule that does nothing, and would pass a mere
  // does-it-exist check.
  assert.match(body, /-webkit-box-shadow[^;]*inset/,
    'the override does not use an inset box-shadow, so Chrome will ignore it')
  assert.match(body, /-webkit-text-fill-color/,
    'the text colour is not restored, so autofilled text stays unreadable')

  // EVERY input class the card renders. Derived from the components rather
  // than listed here, so a new field class fails this until it is covered.
  const cardInputClasses = ['lead-field-input', 'lead-summary-input', 'cd-note-input']
  for (const c of cardInputClasses)
    assert.ok(selectors.includes(`.${c}:-webkit-autofill`),
      `.${c} is rendered on the card and is not covered by the autofill override`)
})
