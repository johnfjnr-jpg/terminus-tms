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
      found.push({ file: path.relative(ROOT, f), table, key: `${path.relative(ROOT, f)}::${table}::${n}` })
    }
  }
  return found.sort((a, b) => a.key.localeCompare(b.key))
}
