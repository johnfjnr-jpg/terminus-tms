// ── CALIBRATING THE ATTENTION-TOKEN GUARD, BOTH DIRECTIONS ───────────────
//
// R-V7, walk 3. The guard was written after the build and passed on its first
// run, which is the tell rather than the proof (Verification 47). Eight tests
// assert six derived requirements and two bindings, and each gets an injection
// that must make ITS OWN NAMED TEST fail - never the exit code, because a run
// can go red for a reason unrelated to the claim (Verification 51's caveat).
//
// Harness discipline per Verification 44: byte snapshots keyed by FULL PATH,
// snapshot asserted present before any injection, bytes compared after EVERY
// injection with a hard stop on mismatch, an in-flight marker so a killed run
// cannot bless its own wreckage as the next run's baseline, and a final
// reverted run.
//
// UNWIRED: it rewrites the stylesheet while it runs.
// Run: SNAPDIR=.verify/walk3/snap-attention node scripts/walk3/calibrate-attention.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = process.env.SNAPDIR
if (!SNAP) { console.error('REFUSING: SNAPDIR is unset, so there is nowhere to snapshot to.'); process.exit(2) }
const INFLIGHT = `${SNAP}/IN_FLIGHT`
const FILES = ['frontend/style.css', 'scripts/tests/attention-token.test.mjs']
const key = (f) => `${SNAP}/${f.replace(/\//g, '_')}`
const sha = (f) => createHash('sha256').update(readFileSync(`${ROOT}/${f}`)).digest('hex')

mkdirSync(SNAP, { recursive: true })
if (existsSync(INFLIGHT)) {
  console.error(`REFUSING: ${INFLIGHT} exists, so a previous run died mid-injection.`)
  console.error(`Restore from ${SNAP} by hand; otherwise the wreckage is snapshotted as the original.`)
  process.exit(2)
}
for (const f of FILES) {
  writeFileSync(key(f), readFileSync(`${ROOT}/${f}`))
  if (!existsSync(key(f))) { console.error(`snapshot failed for ${f}`); process.exit(2) }
}
const ORIG = Object.fromEntries(FILES.map((f) => [f, sha(f)]))
writeFileSync(INFLIGHT, new Date().toISOString())

// TAP, so a failure names its TEST rather than printing a symbol. Anchoring on
// a message would break the day somebody rewords an assertion; anchoring on the
// name is what lets a verdict say which claim was falsified.
const run = () => {
  const t0 = Date.now()
  let out = ''
  try {
    out = execFileSync('node', ['--test', '--test-reporter=tap',
      'scripts/tests/attention-token.test.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const m = out.match(/^# fail (\d+)/m)
  const failed = [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((x) => x[1].trim())
  // Verification 48: a run with no parseable result has NOT run, and is never
  // scored as "failed, therefore caught".
  return { fail: m ? Number(m[1]) : null, failed, ms: Date.now() - t0, out }
}
const restore = (label) => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, readFileSync(key(f)))
    if (sha(f) !== ORIG[f]) {
      console.error(`\nSTOP: restore of ${f} did not match after "${label}". Snapshot: ${key(f)}`)
      process.exit(3)
    }
  }
}
const edit = (f, from, to) => {
  const p = `${ROOT}/${f}`
  const s = readFileSync(p, 'utf8')
  const n = s.split(from).length - 1
  if (n !== 1) { console.error(`anchor in ${f} occurs ${n} times, must be unique`); process.exit(2) }
  writeFileSync(p, s.replace(from, to))
}
const CSS = 'frontend/style.css'
const setToken = (hex) => edit(CSS, '  --attention:       #EDB45A;', `  --attention:       ${hex};`)

const INJECTIONS = [
  { name: 'the contrast instrument stops discriminating',
    expect: ['R-V7 0: the contrast instrument agrees with the estate\'s published numbers'],
    go: () => edit('scripts/tests/attention-token.test.mjs',
      '  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)\n  return (hi + 0.05) / (lo + 0.05)',
      '  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)\n  return 21') },

  { name: 'the token is not defined at all, so every rule using it is dropped',
    expect: ['R-V7 1: --attention is defined, so no declaration using it is silently dropped'],
    go: () => edit(CSS, '  --attention:       #EDB45A;', '  /* removed */') },

  { name: 'the token is dimmed below WCAG AA for text',
    expect: ['R-V7 2: R1, the badge text clears WCAG AA on both grounds',
      'R-V7 3: R2, the card border clears WCAG 1.4.11 for a non-text indicator'],
    go: () => setToken('#3A3020') },

  // R5 IS THE REQUIREMENT THAT DECIDED THE VALUE. This injection is the estate's
  // OWN EXISTING AMBER, which is legible, passes AA, passes 1.4.11 - and is
  // quieter than the --green it would replace. Every other assertion in the file
  // passes on it, which is exactly why R5 had to be written down.
  { name: 'the token takes the existing --amber, which is quieter than --green',
    expect: ['R-V7 4: R5, it is at least as prominent as the --green it replaced'],
    go: () => setToken('#E0A33E') },

  { name: 'the token drifts to a red hue and starts reading as an error',
    expect: ['R-V7 5: R4, it is not the error colour and not near it'],
    go: () => setToken('#ED725A') },

  { name: 'the unsaved BADGE goes back to the single accent',
    expect: ['R-V7 6: the unsaved cost badge binds to --attention, not --green'],
    go: () => edit(CSS, '  border: 1px solid var(--attention);\n  border-radius: 3px;\n  color: var(--attention);',
      '  border: 1px solid var(--green);\n  border-radius: 3px;\n  color: var(--green);') },

  // THE TWO BINDINGS NEED SEPARATE INJECTIONS. A guard naming only the badge
  // would pass with the card still wearing the accent, and the card border is
  // the half a person sees from across the room.
  { name: 'the unsaved CARD BORDER goes back to the single accent',
    expect: ['R-V7 7: the unsaved cost CARD border binds to --attention, not --green'],
    go: () => edit(CSS, '.tb-cost-card-unsaved {\n  border-color: var(--attention);',
      '.tb-cost-card-unsaved {\n  border-color: var(--green);') },

  // ── THE V23 CLOSURE, ruled 2026-09-19 ────────────────────────────────
  { name: 'one of the ten reverts to the retired token',
    expect: ['R-V7 8: NO site binds --amber any more, and the token is gone',
      'R-V7 9: each of the ten retired sites now binds --attention'],
    go: () => edit(CSS, '.write-refused .label { color: var(--attention); }',
      '.write-refused .label { color: var(--amber, #E0A33E); }') },

  // A SITE CAN DRIFT WITHOUT REACHING FOR THE OLD TOKEN AT ALL, which is the
  // case test 8 alone cannot see: a literal is not a binding.
  { name: 'one of the ten drifts to a bare literal instead',
    expect: ['R-V7 9: each of the ten retired sites now binds --attention'],
    go: () => edit(CSS, '.deal-schedule-off { color: var(--attention); }',
      '.deal-schedule-off { color: #E0A33E; }') },

  { name: 'the retired token is DEFINED again, so it can be reached for',
    expect: ['R-V7 8: NO site binds --amber any more, and the token is gone'],
    go: () => edit(CSS, '  --attention:       #EDB45A;',
      '  --attention:       #EDB45A;\n  --amber: #E0A33E;') },

  // THE COMPLETENESS CHECK IS ITSELF CALIBRATED. A named list fails by silent
  // omission (Verification 19), so the failure that matters is an ELEVENTH
  // site nobody added to the list - not a missing one, which test 9 catches.
  { name: 'an eleventh attention site appears and the list never hears about it',
    expect: ['R-V7 10: and the list is complete, so a new site cannot hide'],
    go: () => edit(CSS, '.cd-qualify-hint {',
      '.cd-unlisted-attention-site { color: var(--attention); }\n.cd-qualify-hint {') },

  // AND THE COMMENT STRIP, which this file depends on more than any other in
  // the estate: style.css keeps five paragraphs of prose about the retired
  // token on purpose. Reading the file RAW must not turn that record into ten
  // false positives (Verification 39).
  { name: 'the scan reads the file RAW, so the prose about --amber satisfies it',
    expect: ['R-V7 8: NO site binds --amber any more, and the token is gone'],
    go: () => edit('scripts/tests/attention-token.test.mjs',
      "const css = readCode(join(here, '..', '..', 'frontend', 'style.css'))",
      "const css = readFileSync(join(here, '..', '..', 'frontend', 'style.css'), 'utf8')") },
]

const base = run()
console.log(`  healthy    fail=${base.fail}  ${base.ms}ms  ${base.fail === 0 ? 'GREEN' : 'NOT GREEN - stopping'}`)
if (base.fail !== 0) { restore('baseline'); rmSync(INFLIGHT); process.exit(2) }

let allFired = true
for (const inj of INJECTIONS) {
  inj.go()
  const r = run()
  const hit = r.fail === null ? [] : inj.expect.filter((e) => r.failed.some((t) => t.includes(e)))
  const fired = hit.length === inj.expect.length
  if (!fired) allFired = false
  console.log(`  ${r.fail === null ? 'NO RESULT' : fired ? 'FIRED    ' : 'SILENT   '} ${String(hit.length)}/${inj.expect.length} named, fail=${r.fail}  ${String(r.ms).padStart(5)}ms  ${inj.name}`)
  for (const t of r.failed) console.log(`               x ${t}`)
  restore(inj.name)
}

const end = run()
rmSync(INFLIGHT)
console.log(`  reverted   fail=${end.fail}  ${end.ms}ms  ${end.fail === 0 ? 'GREEN' : 'NOT GREEN'}`)
for (const f of FILES) console.log(`  ${sha(f) === ORIG[f] ? 'byte-identical' : 'DIFFERS'}  ${f}`)
console.log(`\n${allFired && end.fail === 0 ? 'ALL FIRED on their named tests' : 'NOT all fired'}`)
process.exit(allFired && end.fail === 0 ? 0 : 1)
