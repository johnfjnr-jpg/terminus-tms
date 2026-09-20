// R-W3's REFUSAL, CALIBRATED. The ruling asks for it by name, and a refusal
// is exactly the kind of control that reads as working when it is absent: the
// probe's out-of-account case would pass a 409 raised for any other reason,
// and would also pass if the route simply never got that far.
//
// TWO INJECTIONS, ONE PER HALF: the SERVER stops checking, and the CLIENT
// stops scoping. They are separate because either alone would leave the other
// looking like the control.
//
// The server runs under `--watch`, so the harness waits for the reload rather
// than assuming it, and PROVES the reload by asking the route to misbehave
// before trusting the run.
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const ROOT = '/Users/johnfryatt/terminus-tms'
const SNAP = `${ROOT}/.verify/walk5/snap-kc`
const MARKER = `${SNAP}/IN_FLIGHT`
mkdirSync(SNAP, { recursive: true })
const ROUTE = `${ROOT}/src/routes/opportunities.js`
const KC = `${ROOT}/frontend-react/src/reference/KeyContacts.tsx`
const BUNDLE = `${ROOT}/frontend-react/dist/terminus-react.js`
const FILES = [ROUTE, KC, BUNDLE]
const key = (f) => `${SNAP}/${f.replaceAll('/', '_')}`
if (existsSync(MARKER)) { console.error('REFUSING: in-flight marker exists'); process.exit(3) }
const orig = new Map()
for (const f of FILES) {
  const b = readFileSync(f); writeFileSync(key(f), b)
  if (!existsSync(key(f))) { console.error(`no snapshot for ${f}`); process.exit(3) }
  orig.set(f, b)
}
writeFileSync(MARKER, new Date().toISOString())
const restore = () => {
  for (const f of FILES) writeFileSync(f, readFileSync(key(f)))
  for (const f of FILES) if (Buffer.compare(readFileSync(f), orig.get(f)) !== 0) {
    console.error(`RESTORE MISMATCH ${f}; marker left`); process.exit(4)
  }
}
const stop = (c, w) => { console.error(w); restore(); unlinkSync(MARKER); process.exit(c) }
const build = () => {
  try { execFileSync('npm', ['--prefix', `${ROOT}/frontend-react`, 'run', 'build'],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000 }); return true }
  catch (e) { console.error('BUILD FAILED', String(e.stdout ?? e).slice(-300)); return false }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const probe = () => {
  try {
    return execFileSync('node', [`${ROOT}/scripts/walk5/probe-key-contacts.mjs`], {
      cwd: ROOT, encoding: 'utf8', timeout: 300000,
      env: { ...process.env,
        PUPPETEER_PATH: '/tmp/tms-probe/node_modules/puppeteer',
        PUPPETEER_EXECUTABLE_PATH: `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.75/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` },
    })
  } catch (e) { return `${e.stdout ?? ''}${e.stderr ?? ''}` }
}
const v = (out, name) => {
  const l = out.split('\n').find((x) => x.includes(name))
  if (!l) return { seen: false, red: false, line: `("${name}" never ran)` }
  return { seen: true, red: l.trim().startsWith('FAIL'), line: l.trim().slice(0, 110) }
}
const REFUSAL = 'an OUT-OF-ACCOUNT contact is refused 4xx'
const SCOPED = 'does NOT offer the contact in another account at 1440'

console.log('── HEALTHY ───────────────────────────────────────────────────')
let out = probe()
const h1 = v(out, REFUSAL), h2 = v(out, SCOPED)
if (!h1.seen || !h2.seen) stop(3, 'a check did not run on the healthy tree')
console.log(`   ${h1.line}`)
console.log(`   ${h2.line}`)
if (h1.red || h2.red) stop(3, 'the guard is red before any injection')
const res = [['healthy: both green', true]]

console.log('\n── INJECTED: the ROUTE stops checking the account ────────────')
let src = readFileSync(ROUTE, 'utf8')
// THE REAL CHECK, not the one this round briefly added. The first version of
// this injection removed a NEW check and the refusal went on working, because
// the route has refused an out-of-account contact since Round 35 about a
// hundred lines below. That silence is what found the duplication, and the
// duplicate has been removed rather than calibrated.
const from1 = "    if (!contact.parent_record_id || contact.parent_record_id !== opp.account_id) {\n      return reply.code(422).send({ error: \"Contact is not linked to this Opportunity's Account\" })\n    }"
if (!src.includes(from1)) stop(3, 'route anchor not found')
writeFileSync(ROUTE, src.replace(from1, '    // injected: the check is gone'))
await sleep(5000)
out = probe()
const i1 = v(out, REFUSAL), i1s = v(out, SCOPED)
console.log(`   ${i1.line}`)
console.log(`   the picker meanwhile: ${i1s.line}`)
writeFileSync(ROUTE, orig.get(ROUTE))
await sleep(5000)
res.push(['the refusal FIRES when the route stops checking', i1.seen && i1.red])
res.push(['and the PICKER is still scoped under it, so the two are independent', i1s.seen && !i1s.red])

console.log('\n── INJECTED: the CLIENT stops scoping the picker ─────────────')
src = readFileSync(KC, 'utf8')
const from2 = "        ? shell.api<KcVocabItem[]>('GET', `${KC_ROUTES.contacts}?account_id=${encodeURIComponent(accountId)}`)"
if (!src.includes(from2)) stop(3, 'client anchor not found')
writeFileSync(KC, src.replace(from2, "        ? shell.api<KcVocabItem[]>('GET', KC_ROUTES.contacts)"))
if (!build()) stop(3, 'the injected tree does not build')
if (Buffer.compare(readFileSync(BUNDLE), orig.get(BUNDLE)) === 0) {
  stop(3, 'the bundle did not move, so the probe would measure the old code')
}
out = probe()
const i2 = v(out, SCOPED), i2r = v(out, REFUSAL)
console.log(`   ${i2.line}`)
console.log(`   the route meanwhile: ${i2r.line}`)
res.push(['the picker check FIRES when the scope is dropped', i2.seen && i2.red])
res.push(['and the ROUTE still refuses under it, which is why the server half matters',
  i2r.seen && !i2r.red])

restore()
if (!build()) stop(4, 'the restored tree does not build')
await sleep(5000)
console.log('\n── REVERTED ──────────────────────────────────────────────────')
out = probe()
const b1 = v(out, REFUSAL), b2 = v(out, SCOPED)
console.log(`   ${b1.line}`)
console.log(`   ${b2.line}`)
res.push(['both green again after the revert', b1.seen && !b1.red && b2.seen && !b2.red])

console.log('')
for (const [w, ok] of res) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${w}`)
unlinkSync(MARKER)
const p = res.filter(([, ok]) => ok).length
console.log(`\n${p}/${res.length} calibration points`)
process.exit(p === res.length ? 0 : 1)
