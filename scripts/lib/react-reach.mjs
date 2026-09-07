// ── WHAT A REACT HOST ACTUALLY REACHES ──────────────────────────────────
//
// Round 7 Phase 2. Shared by the accounting test and the swap-readiness
// report, because two walks of the same import graph would agree today and
// drift later (Verification 20).
//
// A module that exists is not a module that renders. The swap asks the second
// question, and only an import walk from the host answers it.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = fileURLToPath(new URL('../../frontend-react/src/', import.meta.url))

const tsFiles = (dir, base = '') => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? tsFiles(dir + e.name + '/', base + e.name + '/')
    : /\.tsx?$/.test(e.name) ? [base + e.name] : [])

/** Every .ts/.tsx under frontend-react/src, keyed by its path relative to src. */
export function reactSources() {
  const out = new Map()
  for (const rel of tsFiles(SRC_ROOT)) {
    if (rel.includes('__tests__')) continue
    out.set(rel, readFileSync(SRC_ROOT + rel, 'utf8'))
  }
  return out
}

function resolveFrom(src, from, spec) {
  if (!spec.startsWith('.')) return null
  const parts = (from.split('/').slice(0, -1).join('/') + '/' + spec).split('/')
  const out = []
  for (const p of parts) { if (p === '.' || p === '') continue; if (p === '..') out.pop(); else out.push(p) }
  const stem = out.join('/')
  for (const ext of ['.tsx', '.ts', '/index.ts', '/index.tsx']) if (src.has(stem + ext)) return stem + ext
  return null
}

/** Transitive closure of relative imports from `entry`. */
export function reachedFrom(src, entry) {
  const seen = new Set()
  const queue = [entry]
  while (queue.length) {
    const f = queue.shift()
    if (!f || seen.has(f) || !src.has(f)) continue
    seen.add(f)
    for (const m of src.get(f).matchAll(/from\s+'([^']+)'/g)) {
      const r = resolveFrom(src, f, m[1])
      if (r) queue.push(r)
    }
  }
  return seen
}

/**
 * EVERY declared module must be reached, not SOME.
 *
 * Written as `some` and killed by its own calibration: re-pointing a host's
 * NotesHistory import at a file that does not exist left the sibling helper
 * still imported, so the capability went on reading `rendered` with its
 * COMPONENT gone. The injection came back silent with ZERO failures, which is
 * Verification 51's signature.
 *
 * `every` is the honest rule rather than merely the strict one: a module a
 * capability declares and the host cannot reach is either dead code or a piece
 * of the capability that is missing, and both are findings.
 */
export function stateOf(modules, src, reached) {
  const present = modules.filter((m) => src.has(m))
  if (!present.length) return 'absent'
  return present.every((m) => reached.has(m)) ? 'rendered' : 'logic-only'
}

/** The capability map, parsed from the accounting test so there is ONE copy. */
export function capabilityMap(accountingSource) {
  const block = accountingSource.slice(accountingSource.indexOf('const CAPABILITIES = {'))
  const caps = {}
  for (const m of block.matchAll(/'?([\w-]+)'?:\s*\{\s*modules:\s*\[([^\]]*)\],\s*names:\s*\[([^\]]*)\]/g)) {
    caps[m[1]] = {
      modules: [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]),
      names: [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]),
    }
  }
  return caps
}
