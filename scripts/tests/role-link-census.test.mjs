// ── THE POPULATION OF DECLARED LINKS. AFTER-SAVE STATE C, ruled 2026-11-15 ──
//
// The door exempts `[role="link"]` as navigation (NON_ACTION_SELECTOR in
// frontend/app.js). That is right for the one element that carries it today:
// the key contact's name, which opens the contact, on a contact view that
// applies the door itself.
//
// An exemption keyed on a declared role is only as safe as the population
// declaring it. A second `role="link"` that WRITES something would be
// exempted silently, on every record somebody does not own. So the population
// is held here at its one member, by file and by element, and a new one fails
// this test BY NAME: whoever adds it reads why the door lets it through and
// decides whether that is true of theirs.
//
// Two declaration shapes are counted, because a role can be written in markup
// or set at runtime: the attribute (`role="link"`, `role='link'`,
// `role={'link'}`), and an assignment (`setAttribute('role', 'link')`,
// `.role = 'link'`). Comments are stripped first, so prose about a link,
// this file's included, can neither add to the count nor hide from it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments, kindOf, readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

// The source a browser runs: the classic scripts and markup, and the React
// tree. Tests and built bundles are not source.
const SCAN = [
  { dir: 'frontend', deep: false, ext: /\.(js|html)$/ },
  { dir: 'frontend-react/src', deep: true, ext: /\.(ts|tsx|js|jsx)$/ },
]
const SKIP = /(^|\/)(__tests__|dist|node_modules)(\/|$)/

// Not after `[`, which is a CSS attribute SELECTOR naming the role (the door's
// own exemption is one), and not after `.`, which is the assignment below.
const ROLE_ATTR = /(?<![.[])\brole\s*=\s*(?:"link"|'link'|\{\s*["']link["']\s*\})/g
const ROLE_SET = /setAttribute\(\s*["']role["']\s*,\s*["']link["']\s*\)|\.role\s*=\s*["']link["']/g

export function declaredLinks(code) {
  const hits = []
  for (const re of [ROLE_ATTR, ROLE_SET]) {
    re.lastIndex = 0
    for (let m = re.exec(code); m; m = re.exec(code)) {
      const line = code.slice(0, m.index).split('\n').length
      // The element the role sits on, for the failure message: the opening
      // tag's class, read from the same line.
      const text = code.split('\n')[line - 1]
      hits.push({ line, shape: re === ROLE_ATTR ? 'attribute' : 'assignment', text: text.trim().slice(0, 100) })
    }
  }
  return hits
}

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

test('the scanner reads both declaration shapes, and not prose about them', () => {
  // Calibrated in both directions on synthetic source, so a green census
  // below cannot come from a matcher that sees nothing.
  const js = (s) => stripComments(s, 'js')
  assert.equal(declaredLinks(js('<span role="link" tabIndex={0}>')).length, 1, 'a double-quoted attribute')
  assert.equal(declaredLinks(js("<a role='link'>")).length, 1, 'a single-quoted attribute')
  assert.equal(declaredLinks(js("<b role={'link'}>")).length, 1, 'a JSX expression')
  assert.equal(declaredLinks(js("el.setAttribute('role', 'link')")).length, 1, 'setAttribute')
  assert.equal(declaredLinks(js("el.role = 'link'")).length, 1, 'a property assignment')
  assert.equal(declaredLinks(js('// a role="link" in a comment\n/* el.setAttribute("role","link") */')).length, 0, 'comments do not count')
  assert.equal(declaredLinks(js('<span role="button">')).length, 0, 'another role does not count')
  assert.equal(declaredLinks(js(`el.matches('[role="link"]')`)).length, 0, 'a selector naming the role is not a declaration')
})

test('exactly one element in the source declares role="link": the key contact name', () => {
  const all = []
  const scanned = files()
  assert.ok(scanned.some((f) => f.endsWith('app.js')) && scanned.some((f) => f.endsWith('KeyContacts.tsx')),
    'the scan reached both trees, so a short count is not a short file list')
  for (const f of scanned) {
    for (const h of declaredLinks(readCode(join(ROOT, f), kindOf(f)))) all.push({ file: relative(ROOT, join(ROOT, f)), ...h })
  }
  const named = all.map((h) => `${h.file}:${h.line} (${h.shape}) ${h.text}`).join('\n  ')
  assert.equal(all.length, 1,
    `the door exempts [role="link"] as navigation, so every element declaring it is exempt on records the reader does not own. Expected ONLY the key contact name; found ${all.length}:\n  ${named}\nIf yours navigates and writes nothing, add it here with the reason; if it writes, it must not declare role="link".`)
  assert.equal(all[0].file, 'frontend-react/src/reference/KeyContacts.tsx', `the one member moved: ${named}`)
  assert.match(all[0].text, /className="kc-name"/, `the one member is not the key contact name: ${named}`)
  assert.equal(all[0].shape, 'attribute', 'and it is declared in markup, not assigned at runtime')
})
