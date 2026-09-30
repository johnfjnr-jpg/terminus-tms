#!/usr/bin/env node
// ── E2's OTHER HALF: THE FAILING CASE, RED ON THE OLD CODE ───────────────
//
// The live probe passes. On its own that proves the arithmetic holds today and
// says nothing about whether it could ever have failed - which is Verification
// 9's whole point, and the reason a green suite on its first run is the tell
// rather than the proof.
//
// So the two engine files are put back to the commit BEFORE the fix, the bundle
// is rebuilt so the panel genuinely computes with them, and the same probe is
// run. It must go RED, and it must go red ON THE LUMP SUM ASSERTION rather than
// merely exiting non-zero: an injection that kills the probe early reports the
// same exit code and proves nothing.
//
// Snapshot keyed on the FULL PATH, asserted present before anything is written,
// an in-flight marker so a killed run cannot bless its own wreckage, restore
// compared byte for byte, the bundle rebuilt again, and a final reverted run.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const SP = process.env.TMS_SCRATCH ?? mkdtempSync(join(tmpdir(), 'tms-e2-'))
const MARKER = `${SP}/E2-IN-FLIGHT`
// The commit that introduced R-TL1 and R-TL1a; its parent is the old code.
const BEFORE = 'ee177d8^'
const FILES = ['src/lib/opex.js', 'src/lib/deal-inputs.js']
const snap = (f) => `${SP}/snap_${f.replace(/\//g, '_')}`

if (existsSync(MARKER)) {
  console.error(`REFUSING: ${MARKER} exists, so a previous run did not restore.`)
  process.exit(3)
}
const original = new Map()
for (const f of FILES) {
  const bytes = readFileSync(`${ROOT}/${f}`)
  original.set(f, bytes)
  writeFileSync(snap(f), bytes)
  if (!existsSync(snap(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
}
writeFileSync(MARKER, FILES.join('\n'))

const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' })
const build = () => { try { sh('npm', ['run', 'build:react']) } catch { /* reported by the probe */ } }
const restore = () => {
  for (const f of FILES) {
    writeFileSync(`${ROOT}/${f}`, original.get(f))
    if (Buffer.compare(readFileSync(`${ROOT}/${f}`), original.get(f)) !== 0) {
      console.error(`RESTORE MISMATCH on ${f}. The marker is left in place deliberately.`)
      process.exit(3)
    }
  }
}
const runProbe = () => {
  const t0 = Date.now()
  try {
    const out = sh('node', ['--env-file=.env', 'scripts/probe-e2-fee-ties-live.mjs'])
    return { code: 0, out, ms: Date.now() - t0 }
  } catch (e) { return { code: e.status ?? -1, out: (e.stdout ?? '') + (e.stderr ?? ''), ms: Date.now() - t0 } }
}

console.log('=== 1. THE OLD CODE ===')
for (const f of FILES) writeFileSync(`${ROOT}/${f}`, sh('git', ['show', `${BEFORE}:${f}`]))
build()
const old = runProbe()
// SCORED ON WHICH ASSERTION FAILED, not on the exit code. A probe that died in
// setup exits non-zero too, and would have proved nothing about the arithmetic.
const lumpLine = (old.out.match(/^\s*(PASS|FAIL)\s+a \$500 fee gives exactly.*$/m) ?? [''])[0].trim()
const firedOnLump = /^FAIL\s+a \$500 fee gives exactly/.test(lumpLine)
console.log(`exit ${old.code}  ${old.ms}ms`)
console.log(`  the lump sum assertion: ${lumpLine || '(NEVER REACHED)'}`)
console.log(`  ${firedOnLump ? 'RED ON THE RIGHT ASSERTION' : '*** did not fail where it must ***'}`)
if (!firedOnLump) console.log(old.out.split('\n').filter((l) => /PASS|FAIL|Error/.test(l)).slice(0, 14).join('\n'))

console.log('\n=== 2. RESTORED ===')
restore()
build()
const now = runProbe()
let identical = true
for (const f of FILES) if (Buffer.compare(readFileSync(`${ROOT}/${f}`), original.get(f)) !== 0) identical = false
console.log(`exit ${now.code}  ${now.ms}ms  ${now.code === 0 ? 'GREEN' : 'NOT GREEN'}   bytes identical: ${identical}`)

unlinkSync(MARKER)
const ok = firedOnLump && now.code === 0 && identical
console.log(`\n${ok ? 'CALIBRATED: red on the old code, green on the fix, files byte-identical.' : 'CALIBRATION FAILED.'}`)
process.exit(ok ? 0 : 1)
