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
/**
 * THE WINDOW, AND WHY THE PARSE IS NOW IN TWO STEPS.
 *
 * The old CHAIN pattern required a terminator WITHIN the window for the
 * chain to match AT ALL. Past it the whole match failed and the select was
 * silently not counted - which reads as FEWER unbounded selects, i.e. as
 * progress. Measured: six lines of ordinary comment took the total from 40
 * to 39 with no code changed, and TWO genuinely unbounded selects were
 * invisible in the tree, neither of them in the allowlist because the
 * scanner had never found them. The drift detector that caught the previous
 * instance could not have caught those.
 *
 * A guard that cannot see what it is scanning must FAIL LOUD, never report
 * clean. So:
 *
 *   1. Find chain STARTS with NO window. `.from('x').select(` is
 *      unambiguous and needs no terminator to be recognised.
 *   2. THEN bound the body BY CONTINUATION rather than by guessing where the
 *      next statement begins. A PostgREST chain continues only via
 *      `.method(`, so it ends at the first non-blank line that does not
 *      start with a dot. That is a property of the thing being parsed rather
 *      than a heuristic about the code around it, and it has no window to
 *      exceed - which removed all four of the chains the terminator
 *      heuristic could not bound, without editing one of them.
 *   3. The WINDOW SURVIVES AS A BACKSTOP. If a chain body somehow runs past
 *      it, the chain is UNPARSEABLE and is raised BY NAME - never dropped.
 *
 * Widening the window was rejected: 13 chains already sit at 60-100% of it,
 * so any new number has its own cliff one edit away. And stripping comments
 * first is ALREADY done and cannot help - `stripJs` replaces comments with
 * SPACES to preserve line numbers, so they still consume the window.
 */
const WINDOW = 2000
const START = /\.from\(\s*['"`]([\w.]+)['"`]\s*\)\s*\n?\s*\.select\(/g

const lineOf = (src, index) => src.slice(0, index).split('\n').length

/**
 * The chain body: the remainder of the line the chain starts on, plus every
 * following line that CONTINUES the chain with a dot. Blank lines are
 * skipped rather than ending the chain, because `stripJs` turns a comment
 * between two chained calls into exactly that - and ending there would drop
 * a `.range()` on the far side and report a bounded chain as unbounded.
 *
 * Returns null when the body runs past the window, which is the backstop
 * condition the caller raises on.
 */
function chainBody(src, from) {
  const lines = src.slice(from).split('\n')
  let body = lines[0]
  for (let i = 1; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '') { body += '\n' + lines[i]; continue }
    if (!t.startsWith('.')) break
    body += '\n' + lines[i]
    if (body.length > WINDOW) return null
  }
  return body.length > WINDOW ? null : body
}

/**
 * Every chain start, classified. Returns BOTH the unbounded findings and the
 * chains that could not be bounded, so no caller can receive a short list
 * and read it as clean.
 */
export function findChains(files = gateRunFiles()) {
  const found = []
  const unparseable = []
  for (const f of files) {
    const src = stripJs(readFileSync(f, 'utf8'))
    const rel = path.relative(ROOT, f)
    const seen = new Map()
    for (const m of src.matchAll(START)) {
      const table = m[1]
      const n = seen.get(table) ?? 0
      seen.set(table, n + 1)
      const key = `${rel}::${table}::${n}`
      // STEP 2: bound the body by CONTINUATION, or raise. Never drop.
      const tail = chainBody(src, m.index)
      if (tail === null) {
        unparseable.push({ file: rel, table, key, line: lineOf(src, m.index), distance: null })
        continue
      }
      const body = tail
      if (BOUND.test(body)) continue
      // Is this chain the argument of a helper that bounds it? Look at what
      // immediately precedes the `.from(`, on the same expression.
      const before = src.slice(Math.max(0, m.index - 60), m.index)
      if (WRAPPED.test(before.replace(/\b(db|admin\(\))\s*$/, ''))) continue
      found.push({ file: rel, table, key })
    }
  }
  found.sort((a, b) => a.key.localeCompare(b.key))
  unparseable.sort((a, b) => a.key.localeCompare(b.key))
  return { found, unparseable }
}

/**
 * Unbounded selects in the given files, keyed stably so an allowlist can name
 * them: `<relative path>::<table>::<nth occurrence of that table in that file>`.
 *
 * RAISES if any chain could not be bounded. A caller receiving a list has a
 * guarantee that the list is complete; that guarantee is the whole point.
 */
export function findUnboundedSelects(files = gateRunFiles()) {
  const { found, unparseable } = findChains(files)
  if (unparseable.length) {
    const detail = unparseable.map((u) =>
      `  ${u.file}:${u.line}  .from('${u.table}').select(  - terminator `
      + `chain body exceeds the ${WINDOW}-character backstop`)
      .join('\n')
    throw new Error(
      `the unbounded-select scanner found ${unparseable.length} select chain(s) it could NOT `
      + `bound, and refuses to report a count that silently omits them:\n${detail}\n\n`
      + `Each is a select the guard cannot classify, and a count that omits them would be a `
      + `false clean. Break the chain up, or teach \`chainBody\` the shape it did not expect. `
      + `Do NOT simply widen the backstop: that relocates the blind spot rather than removing it.`)
  }
  return found
}
