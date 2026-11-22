// CREATE_FROM_ANY_CONTACT: the route's writes and the door's exemption. PURE.
//
// Derived from the brief's claims (CREATE_FROM_ANY_CONTACT_BRIEF.md), not from
// the code being changed:
//
//   C2/C4 (R4 ruling)  create-test-bed writes NOTHING keyed on the contact. The
//                      contact-keyed `created_test_bed` audit row is retired for
//                      all creators; the bed keeps its own created_from_contact
//                      row naming the contact.
//   C8 (R7)            the door exempts EXACTLY two controls, the contact
//                      screen's create-Opportunity and create-Test-Bed menu
//                      items, by a DECLARED PROPERTY. This file pins that set.
//
// The database half (the function writes nothing on the contact) is proved by
// the post-apply run and by probe-create-from-any-contact.mjs, which read the
// rows; a source scan cannot see a plpgsql body's effect.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, stripJs, kindOf, readCode } from '../lib/strip-comments.mjs'

// TARGETABLE BY ROOT so a calibration can point at a mutated COPY and never
// write to the tree (Verification 44).
const ROOT = process.env.CREATE_FROM_ROOT ?? new URL('../../', import.meta.url).pathname

// ── THE ROUTE ──────────────────────────────────────────────────────────────

function routeBody(src, anchor) {
  const i = src.indexOf(anchor)
  assert.notEqual(i, -1, `${anchor} not found`)
  const next = src.slice(i + anchor.length).search(/app\.(get|post|patch|put|delete)\('/)
  return src.slice(i, next === -1 ? src.length : i + anchor.length + next)
}
const contacts = stripJs(readFileSync(ROOT + 'src/routes/contacts.js', 'utf8'))
const createTestBed = routeBody(contacts, "app.post('/contacts/:id/create-test-bed'")

// Every object literal handed to an audit_log insert in a body, as text.
function auditRows(body) {
  const rows = []
  for (const m of body.matchAll(/from\('audit_log'\)\s*\.insert\(/g)) {
    // From the opening paren to its match, so a multi-row array is one unit.
    let depth = 0, j = m.index + m[0].length - 1
    for (; j < body.length; j++) {
      if (body[j] === '(') depth++
      else if (body[j] === ')' && --depth === 0) break
    }
    const arg = body.slice(m.index + m[0].length, j)
    for (const r of arg.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)) rows.push(r[0])
  }
  return rows
}

test('the audit-row reader finds rows, and finds a contact-keyed one when it is there', () => {
  // Calibrated on synthetic source in both directions, so the assertions below
  // cannot pass on a reader that sees nothing.
  const two = auditRows(`await db.from('audit_log').insert([
      { record_id: contact.id, action: 'x', detail: { a: 1 } },
      { record_id: record.id, action: 'y', detail: { contact_id: contact.id } }
    ])`)
  assert.equal(two.length, 2)
  assert.equal(two.filter((r) => /record_id:\s*contact\.id/.test(r)).length, 1)
  assert.equal(auditRows(`db.from('records').insert({ record_id: contact.id })`).length, 0)
})

test('R4: create-test-bed writes NO audit row keyed on the contact', () => {
  const rows = auditRows(createTestBed)
  assert.ok(rows.length >= 1, 'the route writes an audit row at all (so the next check is not vacuous)')
  const onContact = rows.filter((r) => /record_id:\s*contact\.id/.test(r))
  assert.deepEqual(onContact, [], 'an audit row is keyed on the contact: R4 retired it for all creators')
  assert.doesNotMatch(createTestBed, /'created_test_bed'/, "the retired 'created_test_bed' action is still written")
})

test('R4: the bed keeps its own created_from_contact row, naming the contact', () => {
  const own = auditRows(createTestBed).filter((r) => /record_id:\s*record\.id/.test(r))
  assert.equal(own.length, 1, 'exactly one audit row on the new bed')
  assert.match(own[0], /action:\s*'created_from_contact'/)
  assert.match(own[0], /contact_id:\s*contact\.id/, 'the row names the source contact in its detail')
})

test('R4: create-test-bed issues no write keyed on the contact at all', () => {
  // Wider than audit_log: any .update/.insert/.upsert whose target is the
  // contact's id. The link is the bed's (record_id = the new bed), written by
  // linkContact with the bed's id first.
  assert.doesNotMatch(createTestBed, /\.(update|upsert)\(/, 'the route updates or upserts something')
  assert.match(createTestBed, /linkContact\(db,\s*record\.id,\s*contact\.id/, "the link is written on the new bed's side")
})

// ── THE DOOR ───────────────────────────────────────────────────────────────

const ATTR = 'data-creates-own-record'
const app = readCode(join(ROOT, 'frontend/app.js'), 'js')

test('R7: the door exempts the declared property', () => {
  const sel = app.match(/const NON_ACTION_SELECTOR = \[([\s\S]*?)\]\.join\(/)
  assert.ok(sel, 'NON_ACTION_SELECTOR not found')
  assert.ok(sel[1].includes(`'[${ATTR}]'`), `NON_ACTION_SELECTOR does not exempt [${ATTR}]`)
})

const SCAN = [
  { dir: 'frontend', deep: false, ext: /\.(js|html)$/ },
  { dir: 'frontend-react/src', deep: true, ext: /\.(ts|tsx|js|jsx)$/ },
]
const SKIP = /(^|\/)(__tests__|dist|node_modules)(\/|$)|\.test\.[tj]sx?$/
function files() {
  const out = []
  const walk = (dir, deep, ext) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = join(dir, name)
      if (SKIP.test(rel)) continue
      const st = statSync(join(ROOT, rel))
      if (st.isDirectory()) { if (deep) walk(rel, deep, ext); continue }
      if (ext.test(name)) out.push(rel)
    }
  }
  for (const s of SCAN) walk(s.dir, s.deep, s.ext)
  return out
}
// A declaration is the attribute written on an element, in markup or JSX, or
// set at runtime. Not after `[`, which is the door's own selector naming it.
const DECL = new RegExp(`(?<![\\[\\w-])${ATTR}(?=\\s*=|["']\\s*[,)])`, 'g')
export function declarations(code) {
  const hits = []
  DECL.lastIndex = 0
  for (let m = DECL.exec(code); m; m = DECL.exec(code)) {
    const line = code.slice(0, m.index).split('\n').length
    hits.push({ line, text: code.split('\n')[line - 1].trim().slice(0, 120) })
  }
  return hits
}

test('the declaration scanner reads markup and runtime shapes, and not prose or the selector', () => {
  const js = (s) => stripComments(s, 'js')
  assert.equal(declarations(js(`<button ${ATTR}="opportunity">`)).length, 1, 'a JSX/markup attribute')
  assert.equal(declarations(js(`<button ${ATTR}={'test-bed'}>`)).length, 1, 'a JSX expression')
  assert.equal(declarations(js(`el.setAttribute('${ATTR}', 'x')`)).length, 1, 'setAttribute')
  assert.equal(declarations(js(`// <button ${ATTR}="x">\n/* ${ATTR}= */`)).length, 0, 'comments do not count')
  assert.equal(declarations(js(`'[${ATTR}]',`)).length, 0, "the door's selector is not a declaration")
})

test('R7: EXACTLY two elements declare it: the contact screen\'s create-Test-Bed and create-Opportunity items', () => {
  const scanned = files()
  assert.ok(scanned.some((f) => f.endsWith('app.js')) && scanned.some((f) => f.endsWith('StageActions.tsx')),
    'the scan reached both trees, so a short count is not a short file list')
  const all = []
  for (const f of scanned) {
    for (const h of declarations(readCode(join(ROOT, f), kindOf(f)))) all.push({ file: relative(ROOT, join(ROOT, f)), ...h })
  }
  const named = all.map((h) => `${h.file}:${h.line} ${h.text}`).join('\n  ')
  assert.equal(all.length, 2,
    `the door exempts [${ATTR}] on records the reader does not own, so every element declaring it stays live there. ` +
    `R7 rules EXACTLY the two create-from-contact items; found ${all.length}:\n  ${named}`)
  assert.ok(all.every((h) => h.file === 'frontend-react/src/contact/StageActions.tsx'), `a member moved: ${named}`)
  const tsx = readCode(join(ROOT, 'frontend-react/src/contact/StageActions.tsx'), kindOf('StageActions.tsx'))
  const ids = all.map((h) => {
    // The testid on the same opening tag: the declaration's line and the two
    // either side, which is the tag as this file formats it.
    const lines = tsx.split('\n').slice(h.line - 3, h.line + 2).join('\n')
    return lines.match(/data-testid="(cd-create-[a-z-]+)"/)?.[1]
  })
  assert.deepEqual(ids.sort(), ['cd-create-opportunity', 'cd-create-test-bed'], `the two members are not the two ruled items: ${named}`)
})
