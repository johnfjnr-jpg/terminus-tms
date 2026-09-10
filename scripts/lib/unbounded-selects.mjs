// ONE DEFINITION OF "UNBOUNDED SELECT", imported by the guard and by the audit.
//
// Verification 20's remedy: a second reader of the same rule always drifts, and
// two instruments disagreeing about a DEFINITION report a gap that does not
// exist. The door census and the door's own rule did exactly that.
//
// A select is BOUNDED when its chain carries an explicit limit on how much can
// come back: `.range(`, `.limit(`, `.single(`, `.maybeSingle(`, or `head: true`
// (a count returns no rows at all). Anything else takes PostgREST's first 1,000
// and says nothing about having done so.
//
// Comments are stripped first, per Verification 39. This estate writes a great
// deal of prose ABOUT queries - including the documentation of this very bug -
// and a scan reading raw would match the description instead of the code.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { stripJs } from './strip-comments.mjs'

export const ROOT = path.resolve(new URL('../../', import.meta.url).pathname)

// `.from('x').select(...)` through to the end of the statement. This codebase
// writes one query per statement, so a statement boundary is a newline followed
// by a keyword rather than a continuation.
const CHAIN = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(([\s\S]{0,400}?)(?=\n\s*(?:const|let|var|if|for|return|await|\}|$))/g
const BOUND = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|head:\s*true/

// ── TWO WAYS A CHAIN IS BOUNDED BY SOMETHING IT DOES NOT CONTAIN ─────────
//
// Found by the guard failing on its own author's code within the hour of being
// written, which is the calibration nobody plans.
//
// A query handed to `pagedSelect(() => db.from(...).select(...))` carries no
// `.range(` of its own - the helper adds it. Reading the chain alone, that is
// indistinguishable from a genuinely unbounded select, and it is the opposite:
// it is the fixed form.
//
// `unrangedForCalibration` is the deliberate exemption, and it is a CALL rather
// than a comment on purpose. Verification 39: comments are stripped before
// matching here, so a pragma in prose could never work - which is a good
// property, not an obstacle. And Verification 19's clause: an exemption
// enumerates by a DECLARED property, never by a name anyone can mint. The
// function is defined in THIS module, so minting a new exemption means editing
// the guard itself, in a diff somebody reads.
const WRAPPED = /(pagedSelect|pagedSelectIn|unrangedForCalibration)\s*\(\s*(\(\s*\)\s*=>\s*)?$/

/**
 * A deliberately unranged read, for a test that needs to PROVE the cap exists.
 * The counterfactual in the teardown suite reads a supra-cap table with no
 * range and asserts it comes back at exactly 1,000 - which is the whole point,
 * and would be destroyed by bounding it.
 */
export async function unrangedForCalibration(query) {
  return query
}

/** Every file the GATE runs: a stage command, or named by a suite script. */
export function gateRunFiles() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const suiteText = Object.values(pkg.scripts).join(' ')
  const gate = stripJs(readFileSync(path.join(ROOT, 'scripts/verify-all.mjs'), 'utf8'))
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue }
      if (!/\.(mjs|js)$/.test(e.name)) continue
      const base = path.basename(p)
      if (gate.includes(base) || suiteText.includes(base)) out.push(p)
    }
  }
  walk(path.join(ROOT, 'scripts'))
  return out.sort()
}

/**
 * Unbounded selects in the given files, keyed stably so an allowlist can name
 * them: `<relative path>::<table>::<nth occurrence of that table in that file>`.
 */
export function findUnboundedSelects(files = gateRunFiles()) {
  const found = []
  for (const f of files) {
    const src = stripJs(readFileSync(f, 'utf8'))
    const seen = new Map()
    for (const m of src.matchAll(CHAIN)) {
      const table = m[1]
      const n = (seen.get(table) ?? 0)
      seen.set(table, n + 1)
      if (BOUND.test(m[0])) continue
      // Is this chain the argument of a helper that bounds it? Look at what
      // immediately precedes the `.from(`, on the same expression.
      const before = src.slice(Math.max(0, m.index - 60), m.index)
      if (WRAPPED.test(before.replace(/\b(db|admin\(\))\s*$/, ''))) continue
      found.push({ file: path.relative(ROOT, f), table, key: `${path.relative(ROOT, f)}::${table}::${n}` })
    }
  }
  return found.sort((a, b) => a.key.localeCompare(b.key))
}
