// ── CALIBRATION: R6 + R2, one injection per claim ────────────────────────
//
// Verification 9: an assertion not proven capable of failing is not
// evidence. Verification 9's LEADS clause: read WHICH assertion failed, not
// whether the run failed - an injection that kills the probe early reports
// FIRED while the check it was written for is never reached.
//
// Verification 44's harness clauses, all of them:
//   - snapshot the actual bytes, keyed by FULL PATH (src/lib and src/routes
//     mirror names in this estate on purpose);
//   - assert the snapshot exists BEFORE injecting anything;
//   - compare restored bytes after EVERY injection and stop dead;
//   - an in-flight marker, so a killed run cannot bless its own wreckage
//     as the next run's baseline;
//   - a final "reverted" full run. It has been the sole witness four times.
//
// Verification 51: a SILENT injection is a finding, not a pass. And its
// caveat - before a silence names an unasserted claim, confirm the matcher
// could have seen the failure. This harness prints the failure count beside
// every verdict for exactly that reason.
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'r6r2-calib')
const FLIGHT = join(SNAP, 'IN_FLIGHT')

const FILES = [
  'frontend-react/src/leads/AccountSection.tsx',
  'frontend-react/src/contact/ContactPanel.tsx',
]
const key = (f) => f.replaceAll('/', '_')

// ── the in-flight refusal ────────────────────────────────────────────────
if (existsSync(FLIGHT)) {
  console.error(`REFUSING: a previous run was killed mid-injection.`)
  console.error(`Restore from ${SNAP} by hand, then delete ${FLIGHT}.`)
  process.exit(2)
}
mkdirSync(SNAP, { recursive: true })

const original = new Map()
for (const f of FILES) {
  const bytes = readFileSync(join(ROOT, f))
  const at = join(SNAP, key(f))
  writeFileSync(at, bytes)
  if (!existsSync(at)) { console.error(`no snapshot for ${f}`); process.exit(2) }
  original.set(f, bytes)
}
console.log(`snapshotted ${FILES.length} files by full path, all present\n`)

const INJECTIONS = [
  { name: 'R6-1 a linked contact shows its ACCOUNT NAME on the bespoke screen',
    why: 'the live defect exactly: the screen holds an account and does not pass it',
    file: 'frontend-react/src/contact/ContactPanel.tsx',
    from: '        account={account}', to: '        account={null}' },

  { name: 'R6-2 and does NOT say "Not linked" - V14: the pair, not the half',
    why: 'the name shown AND a stale absence beside it',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '        ? <div className="panel-value" data-testid={statusTestid ?? `${testid}-name`}>{account.name}</div>',
    to:   '        ? <div className="panel-value" data-testid={statusTestid ?? `${testid}-name`}>{account.name} Not linked</div>' },

  { name: 'R6-3 a contact whose account will NOT resolve says so, naming the id',
    why: 'unresolved collapsed back into absent, which is the defect wearing a friendlier face',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '              Linked, and the account could not be resolved ({parentRecordId.slice(0, 8)})',
    to:   '              Not linked' },

  { name: 'R6-4 "Not linked" is said where linking is OFFERED, and only there',
    why: 'the render rule loses its second half, taking the link panel with it',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '  if (!parentRecordId && !children && !actions) return null',
    to:   '  if (!parentRecordId) return null' },

  { name: 'R6-5 the section carries THE SAME FRAME its sibling cards carry',
    why: 'the defect that shipped: the shell swap took the card frame with it',
    file: 'frontend-react/src/contact/ContactPanel.tsx',
    from: '        framed\n', to: '' },

  { name: 'R2-1 a LEAD with nothing on offer renders no section at all',
    why: 'the empty card returns for every lead',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '  if (!parentRecordId && !children && !actions) return null',
    to:   '  if (false) return null' },

  { name: 'R2-2 an UNLINKED record on the linking screen KEEPS its link control',
    why: 'the body slot is dropped, so the control has nowhere to render',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '      {children}\n    </Panel>', to: '    </Panel>' },

  { name: 'R2-3 the section is ONE component, so both hosts carry the panel registry mark',
    why: 'the structural registry name drifts, and the conformance gate reads it',
    file: 'frontend-react/src/leads/AccountSection.tsx',
    from: '<Panel name="account" title="Account"', to: '<Panel name="acct" title="Account"' },
]

const run = () => {
  const started = Date.now()
  let out = ''
  try {
    out = execFileSync('npm', ['run', 'test:react'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  const ms = Date.now() - started
  const m = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(out)
  return { out, ms, failed: m ? Number(m[1] ?? 0) : null, passed: m ? Number(m[2]) : null }
}

const restore = () => {
  for (const f of FILES) writeFileSync(join(ROOT, f), original.get(f))
  for (const f of FILES) {
    if (!readFileSync(join(ROOT, f)).equals(original.get(f))) {
      console.error(`RESTORE MISMATCH on ${f}. Stopping rather than compounding.`)
      process.exit(2)
    }
  }
}

// ── the healthy baseline, so a SILENT verdict can be read at all ─────────
const base = run()
if (base.failed !== 0 || base.passed === null) {
  console.error(`baseline is not green (${base.failed} failed). Nothing below would mean anything.`)
  process.exit(2)
}
console.log(`baseline: ${base.passed} passed, 0 failed, ${base.ms}ms\n`)

writeFileSync(FLIGHT, 'injecting')
let silent = 0
for (const inj of INJECTIONS) {
  const path = join(ROOT, inj.file)
  const src = readFileSync(path, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) {
    console.error(`ANCHOR NOT UNIQUE (${hits}) for "${inj.name}". Refusing to guess.`)
    restore(); rmSync(FLIGHT); process.exit(2)
  }
  writeFileSync(path, src.replace(inj.from, inj.to))
  const r = run()

  // ANCHORED ON THE TEST NAME, never the exit code. An injection that kills
  // the run some other way goes red and proves nothing about this claim.
  const fired = new RegExp(`[×✗x]\\s+${inj.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`).test(r.out)
    || r.out.includes(`> ${inj.name}`)
  restore()

  const verdict = fired ? 'FIRED ' : 'SILENT'
  if (!fired) silent++
  console.log(`${verdict}  ${inj.name}`)
  console.log(`        ${inj.why}`)
  console.log(`        ${r.failed} failed / ${r.passed} passed, ${r.ms}ms\n`)
}

const final = run()
rmSync(FLIGHT)
console.log(`reverted run: ${final.failed} failed, ${final.passed} passed, ${final.ms}ms`)
if (final.failed !== 0) { console.error('THE REVERTED RUN IS NOT GREEN. The harness damaged the tree.'); process.exit(2) }
for (const f of FILES) {
  if (!readFileSync(join(ROOT, f)).equals(original.get(f))) { console.error(`byte mismatch: ${f}`); process.exit(2) }
}
console.log(`all ${FILES.length} files byte-identical to their snapshots`)
console.log(`\n${INJECTIONS.length - silent}/${INJECTIONS.length} fired, ${silent} silent`)
process.exit(silent ? 1 : 0)
