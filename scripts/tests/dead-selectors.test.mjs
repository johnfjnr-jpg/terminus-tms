import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { stripComments } from '../lib/strip-comments.mjs'

// ── A STYLESHEET RULE WHOSE SELECTOR CAN MATCH NOTHING IN ANY STATE ──────
//
// John's ruling 2026-09-26, from A4's root cause. `#deal-section-2 .deal-field`
// stacked a label above its control; R-SZ2 retired `#deal-section-2` as an
// element and the selector has matched nothing since, so the panel read
// "LUMP SUM COST250000". AN ORPHANED FIX IS WORSE THAN NO FIX, because its
// reasoning sits in the file looking as though it is in force.
//
// Verification 41: when a surface is retired, grep for everything that POINTS
// at it. The retirement listed the ids the RENDER carries and never swept the
// stylesheet, and nothing in the gate could see the difference.
//
// ── WHY THIS IS A SOURCE CHECK AND `probe-dead-selectors` STAYS ADVISORY ──
//
// The runtime probe answers "did this rule match during this run", and its own
// header says that is not the same as dead: a rule for a state the run never
// visited is alive and unreached. Measured 2026-09-26 it named 507 selectors,
// including `#deal-factoring-fields .deal-field` and `#deal-opex-table`, both
// of which are live and were simply not in the states it walked. A gate built
// on it would be red on hundreds of false positives, or would need an
// exemption list, and an exemption list rots.
//
// THIS CHECK IS SOUND IN THE OTHER DIRECTION. If a class or id appears in the
// stylesheet and in NO MARKUP ANYWHERE, no state can render it, so it cannot
// match in any state. That is a conservative subset of the ruling: everything
// it names is genuinely dead, and it needs no browser and no state walk.

const ROOT = new URL('../../', import.meta.url)
const css = stripComments(readFileSync(new URL('frontend/style.css', ROOT), 'utf8'), 'css')

/** Every markup source that can put a class or an id on an element. */
const SRC_DIRS = ['frontend-react/src', 'frontend', 'src']
const SRC_EXT = ['.tsx', '.ts', '.js', '.mjs', '.html']
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue
    const p = `${dir}/${e}`
    if (statSync(p).isDirectory()) walk(p, out)
    else if (SRC_EXT.some((x) => e.endsWith(x)) && !e.endsWith('style.css')) out.push(p)
  }
  return out
}
const files = SRC_DIRS.flatMap((d) => walk(new URL(d, ROOT).pathname))
/* THE MARKUP IS READ WITH COMMENTS STRIPPED TOO (Verification 39). This file's
   own prose names `#deal-section-2` and `.ys-row`, and a scan that counted
   that as markup would be satisfied by a sentence about the thing. */
const markup = files.map((f) => {
  const src = readFileSync(f, 'utf8')
  const kind = f.endsWith('.html') ? 'html' : 'js'
  try { return stripComments(src, kind) } catch { return src }
}).join('\n')

const TOKEN = /(?:^|[\s,>+~(])([.#])([A-Za-z_][\w-]*)/g
const seen = new Map()
for (const block of css.split('}')) {
  const sel = block.slice(block.lastIndexOf('{') === -1 ? 0 : 0, block.indexOf('{'))
  if (!sel || sel.includes('@')) continue
  for (const m of sel.matchAll(TOKEN)) {
    const token = m[2]
    if (!seen.has(token)) seen.set(token, sel.trim().split('\n').pop().trim())
  }
}

/* ── THE BASELINE, AND IT IS A SHRINK-ONLY RATCHET ───────────────────────
   Measured 2026-09-26: 56 tokens are in the stylesheet and in no markup at
   all. They are PRE-EXISTING and none is a named finding of this round, so
   they are queued rather than purged in passing: deleting 56 class families in
   a round about adjacency is the kind of sweep that hides a mistake.

   THE RATCHET IS THE QUEUE, mechanically rather than by promise, and it is the
   shape this estate already uses for unbounded selects: the list MAY ONLY
   SHRINK. A new dead selector is red, which is the fault A4 came from, and an
   entry that comes back to life must leave the list, so it cannot rot into a
   set of excuses (Verification 19). */
const KNOWN_DEAD = [
  'card-col-head',
  'card-ref',
  'deal-pair-col',
  'deal-section--pair',
  'doc-form-row',
  'doc-group-header-row',
  'doc-group-name',
  'doc-group-note',
  'doc-inline-form',
  'doc-link',
  'field-suffix',
  'inline-form',
  'kc-act',
  'kc-head',
  'kc-hist',
  'kc-legend',
  'kc-role',
  'kc-role-tag',
  'kc-role-tag--typed',
  'kc-when',
  'lead-address-cell',
  'lead-address-panel',
  'lead-card-col-title',
  'lead-card-summary-body',
  'lead-complete-actions',
  'lead-summary-edit',
  'opp-assess-defn-l',
  'ot-left',
  'ot-right',
  'ot-sub',
  'pg-card-wide',
  'queue-track--approved',
  'queue-track--rejected',
  'ref-cards-wide',
  'ref-field-label-edit',
  'ref-notes-stage',
  'rg-stage',
  'sa-head',
  'status-ok',
  'status-pending',
  'stmt-grand',
  'tb-count-correct',
  'tb-header-notes-toggle',
  'tb-score-anchor--nowording',
  'tb-score-anchor-n',
  'tb-score-anchor-text',
  'tb-score-anchor-ver',
  'tb-score-anchors',
  'tb-sensor-grid',
  'tb-sensor-name',
  'tb-sensor-note',
  'tb-sensor-panel',
  'tb-sensor-state',
  'tb-sensors-head',
  'tb-unit-feedback',
  'tphase-label',
]

test('no NEW stylesheet selector names a class or id that no markup renders', () => {
  const dead = []
  for (const [token, sel] of seen) {
    // A token is alive if any markup source mentions it at all.
    if (markup.includes(token)) continue
    if (KNOWN_DEAD.includes(token)) continue
    dead.push(`${token}  (first seen in: ${sel.slice(0, 60)})`)
  }
  assert.deepEqual(dead, [],
    `${dead.length} stylesheet token(s) appear in NO markup, so they cannot match in any state:\n  `
    + dead.join('\n  '))
})

test('the ratchet only shrinks: no known-dead token has come back to life', () => {
  const revived = KNOWN_DEAD.filter((t) => markup.includes(t))
  assert.deepEqual(revived, [],
    `${revived.length} token(s) on the known-dead list are rendered again and must leave it: `
    + revived.join(', '))
})

test('the known-dead list holds no token the stylesheet has stopped naming', () => {
  const gone = KNOWN_DEAD.filter((t) => !seen.has(t))
  assert.deepEqual(gone, [],
    `${gone.length} token(s) on the list are no longer in the stylesheet, so the list is stale: `
    + gone.join(', '))
})

test('the check can see a dead token, so a clean result means something', () => {
  // Verification 9: an invariant not proven capable of failing is not evidence.
  const probe = new Map([['zz-token-that-no-markup-has', '.zz-token-that-no-markup-has']])
  const dead = [...probe].filter(([t]) => !markup.includes(t))
  assert.equal(dead.length, 1, 'the detector cannot see a token that is absent from all markup')
})
