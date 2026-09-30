// G1 calibration: the extended composer guard fires on an inline label in EACH
// newly-walked tree, and is silent on the healthy tree. Verification 9 and 44.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const ROOT = process.cwd()
const SP = process.env.TMS_SCRATCH ?? mkdtempSync(join(tmpdir(), 'tms-g1-'))
const MARKER = `${SP}/G1-IN-FLIGHT`
const FILES = [`${ROOT}/frontend/app.js`, `${ROOT}/frontend-react/src/versions/model.ts`]
const snap = (f) => `${SP}/snap_${f.slice(1).replace(/\//g, '_')}`

if (existsSync(MARKER)) { console.error('REFUSING: a previous run did not restore'); process.exit(3) }
const orig = new Map()
for (const f of FILES) { const b = readFileSync(f); orig.set(f, b); writeFileSync(snap(f), b)
  if (!existsSync(snap(f))) { console.error('no snapshot'); process.exit(3) } }
writeFileSync(MARKER, FILES.join('\n'))

const restore = () => { for (const f of FILES) { writeFileSync(f, orig.get(f))
  if (Buffer.compare(readFileSync(f), orig.get(f)) !== 0) { console.error(`RESTORE MISMATCH ${f}`); process.exit(3) } } }
const run = () => { const t0 = Date.now()
  try { const out = execFileSync('node', ['--test', 'scripts/tests/version-label-composer.test.mjs'],
    { cwd: ROOT, encoding: 'utf8' }); return { code: 0, out, ms: Date.now() - t0 } }
  catch (e) { return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - t0 } } }

console.log('=== 0. HEALTHY ===')
const h = run()
console.log(`exit ${h.code}  ${h.ms}ms  ${h.code === 0 ? 'GREEN' : '*** NOT GREEN ***'}`)
if (h.code !== 0) { restore(); unlinkSync(MARKER); console.log(h.out.slice(0, 600)); process.exit(3) }

const CASES = [
  { name: 'frontend/app.js: an inline "V" + major',
    file: `${ROOT}/frontend/app.js`,
    anchor: 'function oppMoney(n) {',
    put: 'function zzInjected(v) { return \'V\' + v.major }\nfunction oppMoney(n) {',
    expect: (o) => /frontend\/app\.js:\d+\s+string concatenation/.test(o) },
  { name: 'frontend-react/src: an inline template label',
    file: `${ROOT}/frontend-react/src/versions/model.ts`,
    anchor: 'export function issueView(',
    put: 'export function zzInjected(v: DealVersion): string { return `V${v.major}` }\nexport function issueView(',
    expect: (o) => /frontend-react\/src\/versions\/model\.ts:\d+\s+a template literal on the major/.test(o) },
]

let all = true
for (const [i, c] of CASES.entries()) {
  const src = orig.get(c.file).toString('utf8')
  const hits = src.split(c.anchor).length - 1
  if (hits !== 1) { restore(); unlinkSync(MARKER); console.error(`anchor x${hits}`); process.exit(3) }
  writeFileSync(c.file, src.replace(c.anchor, c.put))
  const r = run()
  const fired = c.expect(r.out)
  if (!fired) all = false
  console.log(`\n=== ${i + 1}. ${c.name} ===`)
  console.log(`exit ${r.code}  ${r.ms}ms  ${fired ? 'FIRED, and NAMED THE FILE' : '*** DID NOT FIRE ***'}`)
  const named = (r.out.match(/^\s+(frontend|src)\/\S+:\d+.*$/gm) ?? []).slice(0, 3)
  for (const l of named) console.log(`   ${l.trim()}`)
  if (!fired) console.log(r.out.slice(0, 700))
  restore()
}

console.log('\n=== FINAL REVERTED RUN ===')
const rev = run()
let same = true
for (const f of FILES) if (Buffer.compare(readFileSync(f), orig.get(f)) !== 0) same = false
console.log(`exit ${rev.code}  ${rev.ms}ms  ${rev.code === 0 ? 'GREEN' : 'NOT GREEN'}   bytes identical: ${same}`)
unlinkSync(MARKER)
console.log(`\n${all && rev.code === 0 && same ? `CALIBRATED: ${CASES.length} of ${CASES.length} fired.` : 'CALIBRATION FAILED.'}`)
process.exit(all && rev.code === 0 && same ? 0 : 1)
