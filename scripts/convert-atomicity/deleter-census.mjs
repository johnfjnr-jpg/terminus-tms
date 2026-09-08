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

// Calibrated on a real file, both directions, per Verification 9.
const known = readFileSync(ROOT + 'scripts/round7/walk-tb-2e.mjs', 'utf8')
const count = (s) => { const r = new RegExp(PATTERN, 'g'); let n = 0; while (r.exec(stripJs(s))) n++; return n }
const commented = known.replace(
  "await admin().from('opportunity_details').delete().eq('record_id', convertedOppId)",
  "// await admin().from('opportunity_details').delete().eq('record_id', convertedOppId)")
console.log(`  CALIBRATION on the real file: as written ${count(known)}, with that call commented out ${count(commented)}`)
console.log(`  FIRED = ${count(known) === count(commented) + 1}`)
