// ── THE META-CHECK, CALIBRATED THREE WAYS ────────────────────────────────
//
//   1. It FAILS on a deliberately unwired control.
//   2. It PASSES when everything is wired.
//   3. It FAILS CLOSED on an INDETERMINATE case - one where it cannot tell.
//
// (3) is the one that matters. A check that passes when unsure is the exact
// silent failure mode this round exists to remove, and a meta-check with
// that hole would rebuild the fault one level up.
//
// Plus the ROUTING guard, both ways, since that is the load-bearing build.
//
// Verification 44: snapshot by full path, verify it exists, restore and
// compare bytes, refuse a non-unique anchor.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = join(process.env.TMPDIR ?? '/tmp', 'enforce-cal')
mkdirSync(SNAP, { recursive: true })

const snap = (f) => {
  const b = readFileSync(join(ROOT, f))
  const p = join(SNAP, f.replaceAll('/', '_'))
  writeFileSync(p, b)
  if (!existsSync(p)) { console.error(`no snapshot for ${f}`); process.exit(2) }
  return b
}
const restore = (f, b) => {
  writeFileSync(join(ROOT, f), b)
  if (!readFileSync(join(ROOT, f)).equals(b)) { console.error(`RESTORE MISMATCH ${f}`); process.exit(2) }
}
// THE EXIT CODE, NOT A PARSED COUNT. The first version matched `# fail N`,
// which is the format for a MULTI-FILE run; a single file prints `ℹ fail N`.
// It read 0 failures on two runs that had genuinely failed, while the
// companion assertion about the message passed - a contradiction in the
// output that was the only sign.
//
// Verification 16's corollary: prefer the coarsest signal that cannot be
// misread. An exit code has one meaning; a line format is a second thing to
// be right about, and it is invisible when wrong because a zero looks like
// success.
const runMeta = () => {
  let out = '', status = 0
  try {
    out = execFileSync('node', ['--test', '--env-file-if-exists=.env',
      'scripts/tests/enforcement.test.mjs'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
  } catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}`; status = e.status ?? 1 }
  return { out, status, fails: status }
}

let ok = true
const say = (pass, what, detail) => { if (!pass) ok = false
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${what}${detail ? `   ${detail}` : ''}`) }

console.log('=== 2. IT PASSES WHEN EVERYTHING IS WIRED ===')
{
  const r = runMeta()
  say(r.fails === 0, 'clean tree: the meta-check is green', `${r.fails} failures`)
}

console.log('\n=== 1. IT FAILS ON A DELIBERATELY UNWIRED CONTROL ===')
{
  const F = 'scripts/verify-all.mjs'
  const orig = snap(F)
  try {
    const src = orig.toString('utf8')
    const anchor = "cmd: ['node', ['scripts/check-state-fresh.mjs']],"
    if (src.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(2) }
    // Unwire it exactly as it was before this round: the file still exists,
    // nothing runs it.
    writeFileSync(join(ROOT, F), src.replace(anchor, "cmd: ['node', ['scripts/NOTHING-RUNS-THIS.mjs']],"))
    const r = runMeta()
    say(r.fails > 0, 'unwiring check-state-fresh turns the meta-check RED', `${r.fails} failures`)
    say(/check-state-fresh/.test(r.out), 'and it NAMES the control that is not enforced')
  } finally { restore(F, orig); console.log('      restored, byte-identical') }
}

console.log('\n=== 3. IT FAILS CLOSED ON AN INDETERMINATE CASE ===')
{
  // Make a registry entry's own question UNANSWERABLE: the file it reads is
  // gone, so `readCode` throws. A check that swallowed that and passed would
  // be the silent failure mode. It must report INDETERMINATE and fail.
  const F = 'scripts/lib/edit.mjs'
  const from = join(ROOT, F), to = join(SNAP, 'edit.mjs.moved')
  renameSync(from, to)
  try {
    const r = runMeta()
    say(r.fails > 0, 'an unanswerable control question turns it RED', `${r.fails} failures`)
    say(/INDETERMINATE/.test(r.out), 'and it says INDETERMINATE rather than passing on "could not tell"')
  } finally {
    renameSync(to, from)
    console.log('      restored')
  }
}

console.log('\n=== 4. THE ROUTING GUARD, BOTH WAYS ===')
{
  const guard = () => {
    try { execFileSync('node', ['scripts/hooks/journal-guard.mjs'], { cwd: ROOT, stdio: 'pipe' }); return 0 }
    catch (e) { return e.status ?? 1 }
  }
  say(guard() === 0, 'clean tree: the routing guard passes')

  const F = 'scripts/enforcement/census.mjs'
  const orig = snap(F)
  try {
    // A HAND EDIT. Not through the tool, exactly like the two that produced
    // a false commit message.
    writeFileSync(join(ROOT, F), orig.toString('utf8') + '\n// hand edit, unrouted\n')
    execFileSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'pipe' })
    say(guard() === 1, 'an UNROUTED hand edit is refused')
  } finally {
    restore(F, orig)
    execFileSync('git', ['add', '-A'], { cwd: ROOT, stdio: 'pipe' })
    console.log('      restored, byte-identical')
  }
  say(guard() === 0, 'and the tree is clean again afterwards')
}

const final = runMeta()
console.log(`\n  reverted: meta-check ${final.fails} failures`)
console.log(`\n  ${ok && final.fails === 0 ? 'ALL FOUR CLAIMS HOLD.' : '*** A CLAIM FAILED. ***'}`)
process.exit(ok && final.fails === 0 ? 0 : 1)
