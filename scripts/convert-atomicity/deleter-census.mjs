// The child-table deleter census, through the ESTATE's stripper.
//
// Phase 0 ran this through a stripper written for the occasion, which was a
// second reader of a concern this repository already owns
// (scripts/lib/strip-comments.mjs, calibrated in both directions by
// scripts/tests/strip-comments.test.mjs and in the gate). The duplicate is
// deleted and this is the re-point. Verification 41's two claims: the file is
// gone, and what replaced it is proven - the estate's stripJs passes all nine
// cases the duplicate was calibrated on, including the URL case the duplicate's
// own first version failed.
import { stripJs } from '../lib/strip-comments.mjs'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import vm from 'vm'

const ROOT = new URL('../../', import.meta.url).pathname
const files = execSync("git ls-files '*.mjs' '*.js'", { cwd: ROOT }).toString().trim().split('\n')
const TABLES = 'opportunity_details|record_revisions|document_details|record_contacts|audit_log|records'
const PATTERN = String.raw`\.from\(['"\`](${TABLES})['"\`]\)[\s\S]{0,120}?\.delete\(`

let parsedOk = 0
const parseFailed = []
const hits = []
for (const f of files) {
  const raw = readFileSync(ROOT + f, 'utf8')
  const stripped = stripJs(raw)
  // Verification 39's second half on the real corpus: a stripper that eats code
  // makes every scan built on it a silent false negative. The stripped source
  // must parse exactly as the raw source does.
  let strippedFails = false, rawFails = false
  try { new vm.Script(stripped, { filename: f }) } catch { strippedFails = true }
  try { new vm.Script(raw, { filename: f }) } catch { rawFails = true }
  if (strippedFails === rawFails) parsedOk++
  else parseFailed.push(f)

  const re = new RegExp(PATTERN, 'g')
  let m
  while ((m = re.exec(stripped))) {
    hits.push(`${f}:${stripped.slice(0, m.index).split('\n').length}  hard delete on ${m[1]}`)
  }
}

console.log(`=== DELETER CENSUS over ${files.length} tracked js/mjs files, estate stripper`)
console.log(`  stripped source parses as the raw source does: ${parsedOk}/${files.length}`)
if (parseFailed.length) { console.log('  STRIPPER ATE CODE IN:'); parseFailed.forEach((f) => console.log('    ' + f)) }
console.log(`  hard deletes found = ${hits.length}`)
hits.sort().forEach((h) => console.log('  ' + h))

// ── CALIBRATION, AND THE CENSUS MUST NOT MATCH ITSELF ──────────────────
//
// TWO FAULTS FIXED HERE AT ONCE, both surfaced by ruling 6's fix landing.
//
// 1. The calibration was anchored on scripts/round7/walk-tb-2e.mjs's delete of
//    opportunity_details. Ruling 6 removed that line, so the known positive
//    vanished and the calibration silently reported FIRED = false. A detector
//    whose anchor can be deleted is a detector that stops being calibrated the
//    day the thing it watches is fixed.
//
// 2. THE CENSUS BEGAN MATCHING ITS OWN SOURCE. Writing the calibration string
//    as a literal put a real-looking deleter into a file the census scans, so
//    it reported two hits on itself. Round 8 met this exact shape and its
//    answer is the one used here: the harness names the string NOWHERE,
//    assembling it from parts, rather than being excused from the scan. An
//    exemption list rots; an absent string cannot.
const q = String.fromCharCode(39)
const piece = (t) => `.from(${q}${t}${q})` + `.delete()`
const synthetic = `await db${piece('opportunity_details')}.eq(${q}record_id${q}, x)`
const prose = `// used to call ${piece('opportunity_details')} here`

const countIn = (src) => { const r = new RegExp(PATTERN, 'g'); let n = 0; while (r.exec(stripJs(src))) n++; return n }

console.log('\n=== CALIBRATION')
console.log(`   a synthetic deleter:               ${countIn(synthetic)}   FIRED  = ${countIn(synthetic) === 1}`)
console.log(`   the same thing inside a comment:   ${countIn(prose)}   SILENT = ${countIn(prose) === 0}`)

// And on a REAL file that still holds one, so the scan is proved against the
// corpus rather than only against a string built for it. record_contacts is
// deleted by src/routes/opportunities.js on purpose: unlinking a key contact.
const realFile = readFileSync(ROOT + 'src/routes/opportunities.js', 'utf8')
const realN = countIn(realFile)
const neutered = realFile.replace(
  new RegExp(`\\.from\\(${q}record_contacts${q}\\)([\\s\\S]{0,120}?)\\.delete\\(`),
  `.from(${q}record_contacts${q})$1.select(`)
console.log(`   src/routes/opportunities.js as written:        ${realN}`)
console.log(`   the same file with one delete turned into a select: ${countIn(neutered)}`)
console.log(`   FIRED = ${realN > 0 && countIn(neutered) === realN - 1}`)

// The census must not see itself. If this file ever contains a matchable
// literal again, this is what says so.
const selfHits = hits.filter((h) => h.startsWith('scripts/convert-atomicity/deleter-census.mjs'))
console.log(`   the census matching its own source: ${selfHits.length}   CLEAN = ${selfHits.length === 0}`)
