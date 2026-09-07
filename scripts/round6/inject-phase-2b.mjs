// Calibration for Round 6 Phase 2b: the re-navigation family, fixed as a CLASS
// across all three registered views. Each injection restores the defect on ONE
// view, so the class fix is shown to be three fixes rather than one that leaked.
//
// Verified-snapshot harness per Verification 44: full-path keys, the snapshot
// asserted to exist and be non-empty BEFORE anything is injected, the restore
// compared byte-for-byte after EVERY injection with a stop on mismatch, and a
// unique-anchor requirement so an injection cannot land twice.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const SNAP = process.argv[2]
if (!SNAP) { console.error('usage: inject-phase-r.mjs <scratch-dir>'); process.exit(2) }
fs.mkdirSync(SNAP, { recursive: true })

const key = (f) => path.join(SNAP, f.replace(/\//g, '_'))

const snapshot = (f) => {
  const src = path.join(ROOT, f)
  const bytes = fs.readFileSync(src)
  if (!bytes.length) { console.error(`REFUSED: ${f} is empty`); process.exit(2) }
  fs.writeFileSync(key(f), bytes)
  const back = fs.readFileSync(key(f))
  if (!back.equals(bytes)) { console.error(`REFUSED: snapshot of ${f} did not round-trip`); process.exit(2) }
  return bytes
}
const restore = (f, original) => {
  fs.writeFileSync(path.join(ROOT, f), original)
  const now = fs.readFileSync(path.join(ROOT, f))
  if (!now.equals(original)) { console.error(`STOP: restore of ${f} did not match`); process.exit(2) }
}

const ACCT = 'frontend-react/src/account/AccountView.tsx'
const APPR = 'frontend-react/src/ApprovalView.tsx'
const MAIN = 'frontend-react/src/main.tsx'

const INJECTIONS = [
  { name: 'ACCOUNT: detailLoaded keyed on [settled] again',
    file: ACCT,
    find: 'useEffect(() => { if (settled) shell.detailLoaded(VIEW) })',
    replace: 'useEffect(() => { if (settled) shell.detailLoaded(VIEW) }, [settled, shell])',
    expect: 'the Account view' },

  { name: 'ACCOUNT: the record stops being re-read',
    file: ACCT,
    find: 'useEffect(() => { if (navToken !== undefined) void refetchAccount() }, [navToken, refetchAccount])',
    replace: 'useEffect(() => { /* cached */ }, [navToken, refetchAccount])',
    expect: 'served a cached Account' },

  { name: 'APPROVAL: detailLoaded keyed on [isPending] again',
    file: APPR,
    find: '  useEffect(() => {\n    if (!isPending) shell.detailLoaded(VIEW)\n  })',
    replace: '  useEffect(() => {\n    if (!isPending) shell.detailLoaded(VIEW)\n  }, [isPending, shell])',
    expect: 'the second navigation never cleared is-loading' },

  { name: 'THE TOKEN STOPS CHANGING, so no view can tell one navigation from the next',
    file: MAIN,
    find: '      const navToken = (navTokens.get(view) ?? 0) + 1\n      navTokens.set(view, navToken)',
    replace: '      const navToken = 1',
    expect: 'register handed out the same token' },
]
const run = () => {
  try {
    execFileSync('npx', ['vitest', 'run',
      'src/__tests__/renavigation-family.test.tsx', 'src/__tests__/contact-view.test.tsx',
      'src/__tests__/shell.test.tsx'],
      { cwd: path.join(ROOT, 'frontend-react'), encoding: 'utf8', stdio: 'pipe' })
    return { failed: 0, out: '' }
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '')
    const m = out.match(/Tests\s+(\d+) failed/)
    return { failed: m ? Number(m[1]) : -1, out }
  }
}

const originals = new Map()
for (const inj of INJECTIONS) if (!originals.has(inj.file)) originals.set(inj.file, snapshot(inj.file))

let detected = 0
for (const inj of INJECTIONS) {
  const original = originals.get(inj.file)
  const text = original.toString('utf8')
  const hits = text.split(inj.find).length - 1
  if (hits !== 1) { console.error(`REFUSED: anchor for "${inj.name}" appears ${hits} times in ${inj.file}, needs exactly 1`); restore(inj.file, original); process.exit(2) }
  fs.writeFileSync(path.join(ROOT, inj.file), text.replace(inj.find, inj.replace))
  const t0 = Date.now()
  const r = run()
  const ms = Date.now() - t0
  const fired = r.failed > 0 && r.out.includes(inj.expect)
  if (fired) detected++
  console.log(`${fired ? 'DETECTED' : 'SILENT  '}  ${inj.name}  (${r.failed} failed, ${ms}ms)`)
  restore(inj.file, original)
}

const final = run()
console.log(`\nreverted run: ${final.failed === 0 ? 'GREEN' : `RED (${final.failed} failed)`}`)
for (const [f, bytes] of originals) {
  const same = fs.readFileSync(path.join(ROOT, f)).equals(bytes)
  console.log(`  ${same ? 'byte-identical' : 'DIFFERS'}  ${f}`)
  if (!same) process.exitCode = 2
}
console.log(`\n${detected}/${INJECTIONS.length} detected`)
if (detected !== INJECTIONS.length) process.exitCode = 1
