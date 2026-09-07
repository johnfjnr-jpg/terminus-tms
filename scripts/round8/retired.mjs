// ── THE TWO CLAIMS A RETIREMENT MAKES ───────────────────────────────────
//
// A retirement is two claims and the second almost never gets an assertion
// (Verification 7): the file is GONE, and nothing still points at it.
//
// Comments are STRIPPED for claim two (Verification 39), because prose naming
// a retired file is a record rather than a dependency - and this estate keeps
// a lot of it deliberately.
//
// THE THIRD CLAUSE, added Round 8 Phase 2: a COMMENTED SCRIPT TAG naming a
// deleted file fails claim two even though it is prose. The estate's own rule,
// recorded in index.html about the Reference tab: "A commented tag naming a
// deleted file is worse than none: it reads as an escape route somebody might
// reach for." A revert instruction pointing at nothing is worse than no
// instruction, so it is a coupling rather than a comment.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { readCode } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url)

const walk = (dir) => {
  let out = []
  for (const e of readdirSync(new URL(dir + '/', ROOT), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) out = out.concat(walk(rel))
    else if (/\.(js|mjs|ts|tsx|css|html)$/.test(e.name)) out.push(rel)
  }
  return out
}
const kindOf = (f) => f.endsWith('.css') ? 'css' : f.endsWith('.html') ? 'html' : 'js'

export function retirementClaims(file, { allowProseIn = [] } = {}) {
  const base = file.split('/').pop()
  const claims = { file, gone: !existsSync(new URL(file, ROOT)), codeRefs: [], commentedTag: [] }

  for (const f of ['frontend', 'frontend-react/src', 'src', 'scripts'].flatMap(walk)) {
    let code, raw
    try {
      code = readCode(new URL(f, ROOT), kindOf(f))
      raw = readFileSync(new URL(f, ROOT), 'utf8')
    } catch { continue }
    if (code.includes(base) && !allowProseIn.includes(f)) claims.codeRefs.push(f)
    // The third clause: a script tag naming the file, live OR commented.
    if (new RegExp(`<script[^>]*src=["']/${base}["']`).test(raw)) claims.commentedTag.push(f)
  }
  return claims
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2]
  if (!target) { console.error('usage: retired.mjs <path>'); process.exit(2) }
  const c = retirementClaims(target)
  console.log(`CLAIM 1  the file is gone:        ${c.gone ? 'YES' : 'NO'}`)
  console.log(`CLAIM 2a nothing in CODE names it: ${c.codeRefs.length === 0 ? 'YES' : 'NO'}`)
  for (const f of c.codeRefs) console.log(`           ${f}`)
  console.log(`CLAIM 2b no script tag names it:   ${c.commentedTag.length === 0 ? 'YES' : 'NO'}`)
  for (const f of c.commentedTag) console.log(`           ${f}  <- a tag naming a deleted file`)
  const ok = c.gone && !c.codeRefs.length && !c.commentedTag.length
  console.log(`\n${ok ? 'RETIRED' : 'NOT RETIRED'}`)
  process.exit(ok ? 0 : 1)
}
