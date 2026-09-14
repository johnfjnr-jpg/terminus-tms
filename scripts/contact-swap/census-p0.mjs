// Phase 0 pointer census. Anchors assembled from parts so the instrument
// cannot match its own source (Verification 39's Round 8 clause).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
// V20: the estate has ONE definition of comment stripping and ten suites
// import it. My own first attempt only removed `//` at LINE START, so a
// trailing comment survived and the calibration caught it. Importing the
// shared one rather than keeping a second reader.
import { stripComments, kindOf } from '../lib/strip-comments.mjs'

const SELF = 'census-p0.mjs'
const ROOTS = ['frontend', 'frontend-react/src', 'scripts', 'src']
const CODE = /\.(mjs|js|ts|tsx|html|json)$/

function walk(d, out = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist|coverage/.test(p)) walk(p, out) }
    else if (CODE.test(e.name)) out.push(p)
  }
  return out
}
const files = ROOTS.flatMap((r) => { try { statSync(r); return walk(r) } catch { return [] } })
              .filter((f) => !f.endsWith(SELF))

// Anchors assembled from parts.
const A = {
  viewId:   'view-' + 'contact' + '-detail',
  navId:    "'contact" + "-detail'",
  loadFn:   'load' + 'ContactDetail',
  host:     'Contact' + 'Host',
  panel:    'Contact' + 'Panel',
  view:     'Contact' + 'View',
  retView:  'set' + 'ContactReturnView',
}

console.log(`files scanned: ${files.length}  (self excluded by name)`)
console.log('')
console.log('anchor'.padEnd(24) + 'raw'.padStart(6) + 'inCode'.padStart(8) + '   files in code')
for (const [name, anchor] of Object.entries(A)) {
  const raw = [], code = []
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    if (s.includes(anchor)) {
      raw.push(f)
      // JSON carries no comments, so raw IS code there. The shared stripper
      // RAISES on an unknown kind rather than returning the input silently
      // (V12's author-side clause), so the case is named rather than caught.
      const code_s = f.endsWith('.json') ? s : stripComments(s, kindOf(f))
      if (code_s.includes(anchor)) code.push(f)
    }
  }
  console.log(`${name.padEnd(24)}${String(raw.length).padStart(6)}${String(code.length).padStart(8)}`)
  for (const f of code) console.log(`      ${f}`)
}

// CALIBRATION, both directions (V39 second half, not optional).
console.log('\n=== CALIBRATION ===')
const probe = 'const x = 1; // ' + A.host + '\n/* ' + A.host + ' */\nconst y = "' + A.host + '"'
const stripped = stripComments(probe, 'js')
const survived = (stripped.match(new RegExp(A.host, 'g')) || []).length
console.log(`  comment fails to satisfy : ${survived === 1 ? 'PASS' : 'FAIL'}  (${survived} of 3 survive; only the string literal should)`)
const url = stripComments(`const u = 'https://example.com/x'`, 'js')
console.log(`  a URL is not a comment   : ${url.includes('example.com') ? 'PASS' : 'FAIL'}`)
const real = readFileSync('frontend-react/src/contact/ContactHost.tsx', 'utf8')
const rs = stripComments(real, 'js')
console.log(`  stripped source still parses: ${rs.includes('export function') && rs.includes('return') ? 'PASS' : 'FAIL'}`)
console.log(`  stripped kept real code     : ${(rs.length / real.length * 100).toFixed(0)}% of bytes retained`)
