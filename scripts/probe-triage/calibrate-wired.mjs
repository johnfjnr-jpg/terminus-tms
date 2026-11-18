#!/usr/bin/env node
// ── PROBE_TRIAGE: CALIBRATE EVERY PROBE THE ROUND WIRED INTO THE GATE ──────
//
//   PUPPETEER_PATH=... node --env-file=.env scripts/probe-triage/calibrate-wired.mjs [--only=ID,ID]
//
// The brief: "Every WIRED probe calibrated: inject the fault it guards, show
// it fail by name, restore byte-identical, reverted run green." One injection
// per claim a stage was wired for, each read by the NAME of the check it must
// fail (Verification 9: a red run is not a calibration until it says which
// assertion went red), then a final reverted run of every stage touched.
//
// It injects into the SERVED tree, because these probes measure the running
// server and the served bundle: that is the only place their faults live. So
// the harness discipline is Verification 44's in full:
//   - every file it will touch is snapshotted, keyed by its full path, and the
//     snapshot is asserted to exist before anything is injected;
//   - an in-flight marker is written first and refused on the next run;
//   - after every injection the bytes are restored and COMPARED, and a
//     mismatch stops dead, leaving the marker;
//   - every stop path restores from the snapshot bytes before it stops;
//   - a src/ change waits for the --watch server's CHILD to be replaced and
//     answer again (rule 9: read ps by parent pid), never a fixed delay;
//   - a frontend-react/src change rebuilds the bundle, and the bundle's bytes
//     are snapshotted and put back, not rebuilt, on the way out.
//
// NOT A GATE STAGE, BY CONSTRUCTION: it mutates the served tree. Run when one
// of the stages it calibrates changes, and record the result.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = join(tmpdir(), 'tms-calibrate-wired')
const MARKER = join(SNAP, 'IN_FLIGHT')
const DIST = 'frontend-react/dist/terminus-react.js'
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')

const N = (cmd) => ['node', ['--env-file=.env', ...cmd]]
const LIVE = N(['scripts/term-pricing/probe-live.mjs'])
const OVERLAP = N(['scripts/term-pricing/probe-overlap.mjs', '--only=tp'])

// Each case: the file(s) changed, the command, and the CHECK NAME it must fail.
const CASES = [
  { id: 'live-route', stage: 'HTTP term pricing settings RLS probe', run: LIVE,
    why: 'the settings route lets a non-admin through to the write',
    edits: [['src/routes/term-pricing.js',
      "    if (!state.isAdmin) {\n      return reply.code(403).send({ error: 'Only an admin can change term pricing settings.' })\n    }\n\n    const patch = request.body?.settings",
      '    const patch = request.body?.settings']],
    expect: /^FAIL {2}L9a non-admin settings PUT: 403 with the admin sentence/m },
  // The RLS half cannot be broken from here without a migration, so the fault
  // is simulated where the probe meets it: the call is sent with the service
  // key, which is what PostgREST sees when a policy lets everything through.
  // Every simulated write carries the row's CURRENT value, updated_by and
  // updated_at, so a landed write is byte-identical (the fingerprint shows it).
  { id: 'live-rls-update', stage: 'HTTP term pricing settings RLS probe', run: LIVE,
    why: 'RLS lets a non-admin update a setting',
    edits: [['scripts/term-pricing/probe-live.mjs',
      "const upd = await na.from('term_pricing_settings')\n    .update({ value: floor.value, updated_by: nonAdmin.user.id, updated_at: new Date().toISOString() })",
      "const upd = await admin.from('term_pricing_settings')\n    .update({ value: floor.value, updated_by: floor.updated_by, updated_at: floor.updated_at })"]],
    expect: /^FAIL {2}L3 a non-admin DIRECT update is refused by RLS/m },
  { id: 'live-rls-grant', stage: 'HTTP term pricing settings RLS probe', run: LIVE,
    why: 'RLS lets a non-admin insert a system_roles row (meets the key instead)',
    edits: [['scripts/term-pricing/probe-live.mjs', "const sr = await na.from('system_roles')", "const sr = await admin.from('system_roles')"]],
    expect: /^FAIL {2}L5 a non-admin cannot grant admin: refused BY RLS \(42501\)/m },
  { id: 'live-rls-read', stage: 'HTTP term pricing settings RLS probe', run: LIVE,
    why: 'system_roles readable beyond the own row',
    edits: [['scripts/term-pricing/probe-live.mjs', "const seeOthers = must(await na.from('system_roles')", "const seeOthers = must(await admin.from('system_roles')"]],
    expect: /^FAIL {2}L7 system_roles is own-row only/m },
  { id: 'ff-engine', stage: 'HTTP frozen figures probe', run: N(['scripts/probe-frozen-figures-db.mjs']),
    why: 'the frozen figures do not name the engine that produced them',
    edits: [['src/routes/deal-sheet-versions.js', 'const frozenFigures = buildFrozenFigures(ctx.pageArgs(submitted), ENGINE_ID)',
      "const frozenFigures = { ...buildFrozenFigures(ctx.pageArgs(submitted), ENGINE_ID), engine: { commit: 'injected' } }"]],
    expect: /^FAIL {2}R-FF1/m },
  { id: 'cf-term', stage: 'HTTP factoring term refusal probe', run: N(['scripts/probe-factoring-term-refusal.mjs']),
    why: 'a factoring term equal to the contract is accepted',
    edits: [['src/lib/system-defaults.js', '  if (n <= T - 1) return null;', '  if (n <= T) return null;']],
    expect: /^FAIL {2}a term CHANGED to 36 on a 36-month contract is refused/m },
  { id: 'won-server', stage: 'browser closed-won pricing', run: N(['scripts/probe-closed-won-pricing-click.mjs']),
    why: 'the server stops refusing a Closed Won pricing change',
    edits: [['src/lib/pricing-keys.js', '  if (status !== WON_STAGE) return null\n  return changedPricingKeys', '  if (status !== WON_STAGE || true) return null\n  return changedPricingKeys']],
    expect: /^FAIL {2}\(c\) a pricing PATCH is refused 409/m },
  { id: 'cv-unpriced', stage: 'browser unpriced contract value', run: N(['scripts/probe-unpriced-contract-value-click.mjs']),
    why: 'an unpriced deal shows $0 in the stats cell',
    edits: [['frontend-react/src/deal/panelParts.tsx', "contractValueOf(result?.totals?.contractNet) === null ? UNPRICED : money0(", "contractValueOf(result?.totals?.contractNet) === null ? '$0' : money0("]],
    expect: /^FAIL {2}\(2\) the stats cell reads "--"/m },
  { id: 'ladder-card', stage: 'browser term pricing ladder', run: N(['scripts/term-pricing/probe-ladder.mjs']),
    why: 'the price card shows Base TCV where List TCV belongs',
    edits: [['frontend-react/src/term-pricing/TermPricingView.tsx', 'data-testid="tp-p-list">{money(p0.dealDiscount.listTcvCents)}', 'data-testid="tp-p-list">{money(p0.tcvNetCents)}']],
    expect: /FAIL.*A: the price card's list tcv is frame A's/ },
  // R3's own calibration: the overprint, reintroduced.
  { id: 'overlap-overprint', stage: 'term pricing layout guard', run: OVERLAP,
    why: 'R3 reverted: the price card figures back at a fixed 16px',
    edits: [['frontend/style.css', '.tp-price-grid.tp-price-grid3 .tp-v { font-size: var(--tp-pg-fig, 16px); }', '.tp-price-grid.tp-price-grid3 .tp-v { font-size: 16px; }']],
    expect: /^FAIL {2}pricing .* at 1920: nothing overprints anything[\s\S]*?x "Deal discount"/m },
  { id: 'overlap-margin-grid', stage: 'term pricing layout guard', run: OVERLAP,
    why: 'the margin grid squeezed into its column again',
    edits: [['frontend/style.css', '.tp-pl-cols > * { flex: 1 1 440px; }', '.tp-pl-cols > * { flex: 1 1 440px; min-width: 0; }']],
    expect: /^FAIL {2}.* at 1440: no grid or flex item narrower than its content[\s\S]*?(tp-bands-check|tp-pl-editor): \d+px, content needs/m },
  { id: 'overlap-factoring', stage: 'term pricing layout guard', run: OVERLAP,
    why: 'the factoring figures pulled up over the fields',
    edits: [['frontend/style.css', '.tp-pl-cols > * { flex: 1 1 440px; }', '.tp-pl-cols > * { flex: 1 1 440px; }\n[data-testid="tp-fx-figs"] { margin-top: -60px; }']],
    expect: /^FAIL {2}payment terms \S+ factoring-on \S+ at \d+: nothing overprints anything/m },
  // The detector half of R4: without the scroller rule the cash flow grid is
  // its parent's need again. Calibrates that the rule is what keeps it green.
  { id: 'overlap-scroller-rule', stage: 'term pricing layout guard', run: OVERLAP,
    why: 'shrunkBelowContent counts a declared scroller as its parent\'s need again',
    edits: [['scripts/lib/ink-overlap.mjs', '      if (/^(auto|scroll)$/.test(cs.overflowX)) continue\n', ''],
      ['scripts/lib/ink-overlap.mjs', '      const release = holdScrollers(e)\n', '      const release = () => {}\n']],
    expect: /^FAIL {2}payment terms .*: no grid or flex item narrower than its content[\s\S]*?content needs/m },
  { id: 'cal-shards', stage: 'calibrations', run: ['node', ['scripts/run-calibrations.mjs']],
    why: 'the shards stop covering the injection list',
    edits: [['scripts/term-pricing/calibrate.mjs', 'INJECTIONS.filter((_, n) => n % SHARD.k === SHARD.i)', 'INJECTIONS.filter((_, n) => n % SHARD.k === 0)']],
    expect: /^FAIL {2}term pricing shards do not cover the list exactly once/m },
  { id: 'cal-served-tree', stage: 'calibrations', run: ['node', ['scripts/run-calibrations.mjs']],
    why: 'a calibrator writes into the served tree',
    edits: [['scripts/run-calibrations.mjs', '  const after = treeHash()', "  ;(await import('node:fs')).writeFileSync(join(ROOT, 'scripts', '.calibration-touch.tmp'), 'x')\n  const after = treeHash()"]],
    cleanup: ['scripts/.calibration-touch.tmp'],
    expect: /^FAIL {2}THE SERVED TREE CHANGED during calibration/m },
  { id: 'register', stage: 'pure suite (probe-register.test.mjs)', run: ['node', ['--test', 'scripts/tests/probe-register.test.mjs']],
    why: 'a new probe with no register row',
    create: ['scripts/probe-zz-unregistered.mjs', '// a probe nobody wired or registered\n'],
    expect: /scripts\/probe-zz-unregistered\.mjs: a probe or calibrator with no row/ },
]

const sel = CASES.filter((c) => !only || only.includes(c.id))
const touched = [...new Set(sel.flatMap((c) => (c.edits ?? []).map(([f]) => f)))]
const needsBuild = sel.some((c) => (c.edits ?? []).some(([f]) => f.startsWith('frontend-react/src/')))
if (needsBuild) touched.push(DIST)
const key = (f) => join(SNAP, f.replace(/\//g, '__'))
const read = (f) => readFileSync(join(ROOT, f))

// ── the --watch server's child, read by PARENT pid (CLAUDE.md rule 9) ──────
const watchParent = () => {
  const ps = execFileSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' })
  const line = ps.split('\n').find((l) => /node .*--watch src\/server\.js/.test(l))
  if (!line) throw new Error('no `node --watch src/server.js` is running')
  return line.trim().split(/\s+/)[0]
}
const child = () => { try { return execFileSync('pgrep', ['-P', watchParent()], { encoding: 'utf8' }).trim() } catch { return '' } }
const reachable = () => spawnSync('node', ['--env-file=.env', 'scripts/check-reachable.mjs'], { cwd: ROOT, encoding: 'utf8' }).status === 0
async function awaitRestart(before) {
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const now = child()
    if (now && now !== before && reachable()) return now
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`the server child did not restart within 60s (still ${child() || 'none'})`)
}
const build = () => {
  const r = spawnSync('npm', ['run', 'build:react'], { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`bundle build failed:\n${r.stdout}\n${r.stderr}`)
}

let armed = false
const restoreAll = () => {
  const bad = []
  for (const f of touched) {
    writeFileSync(join(ROOT, f), readFileSync(key(f)))
    if (!read(f).equals(readFileSync(key(f)))) bad.push(f)
  }
  for (const c of sel) for (const f of [...(c.cleanup ?? []), ...(c.create ? [c.create[0]] : [])]) if (existsSync(join(ROOT, f))) unlinkSync(join(ROOT, f))
  return bad
}
const stop = (msg) => {
  if (armed) {
    const bad = restoreAll()
    if (bad.length) { console.error(`STOP: ${msg}\nRESTORE DID NOT MATCH for ${bad.join(', ')}; marker LEFT at ${MARKER}; snapshots in ${SNAP}`); process.exit(3) }
    rmSync(MARKER, { force: true })
  }
  console.error(`STOP: ${msg}${armed ? '\nAll files restored from their snapshots and byte-identical.' : ''}`)
  process.exit(2)
}

function runStage(c) {
  const t0 = Date.now()
  const [bin, args] = c.run
  const r = spawnSync(bin, args, { cwd: ROOT, encoding: 'utf8', env: process.env, maxBuffer: 64 * 1024 * 1024 })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, ms: Date.now() - t0 }
}

// ── snapshot, then arm ─────────────────────────────────────────────────────
if (existsSync(MARKER)) { console.error(`REFUSED: ${MARKER} exists; a previous run did not finish its restore. Restore from ${SNAP}, compare, delete the marker.`); process.exit(3) }
mkdirSync(SNAP, { recursive: true })
for (const f of touched) {
  writeFileSync(key(f), read(f))
  if (!existsSync(key(f)) || !readFileSync(key(f)).equals(read(f))) { console.error(`STOP: snapshot of ${f} missing or different`); process.exit(2) }
}
for (const c of sel) for (const [f, find] of c.edits ?? []) {
  const n = read(f).toString('utf8').split(find).length - 1
  if (n !== 1) { console.error(`STOP: ${c.id}: anchor found ${n} times in ${f}`); process.exit(2) }
}
writeFileSync(MARKER, new Date().toISOString())
armed = true

const results = []
try {
  for (const c of sel) {
    const srcTouched = (c.edits ?? []).some(([f]) => f.startsWith('src/'))
    const feTouched = (c.edits ?? []).some(([f]) => f.startsWith('frontend-react/src/'))
    const before = srcTouched ? child() : null
    for (const [f, find, put] of c.edits ?? []) {
      const was = read(f).toString('utf8')
      writeFileSync(join(ROOT, f), was.replace(find, put))
      if (read(f).toString('utf8') === was) stop(`${c.id}: the injection into ${f} did not land`)
    }
    if (c.create) writeFileSync(join(ROOT, c.create[0]), c.create[1])
    if (feTouched) build()
    if (srcTouched) await awaitRestart(before)

    const r = runStage(c)
    const fired = r.code !== 0 && c.expect.test(r.out)
    results.push({ ...c, fired, code: r.code, ms: r.ms })
    const named = (r.out.match(c.expect)?.[0] ?? '').split('\n')[0].slice(0, 140)
    console.log(`${fired ? 'FIRED ' : 'SILENT'}  ${c.id.padEnd(22)} exit ${r.code} ${r.ms}ms  ${c.why}${fired ? `\n        ${named}` : ''}`)
    if (!fired) writeFileSync(join(SNAP, `${c.id}.out.txt`), r.out)

    const restartFrom = srcTouched ? child() : null
    const bad = restoreAll()
    if (bad.length) stop(`${c.id}: not byte-identical after restore: ${bad.join(', ')}`)
    if (srcTouched) await awaitRestart(restartFrom)
  }
} catch (e) {
  stop(`harness error: ${e.stack}`)
}

// ── the final reverted run: every stage touched, on the restored tree ──────
const identical = touched.every((f) => read(f).equals(readFileSync(key(f))))
rmSync(MARKER, { force: true })
armed = false
console.log(`\nrestored: ${touched.length} files byte-identical to their snapshots: ${identical}`)
const stages = [...new Map(sel.map((c) => [c.run.join(' '), c])).values()]
let revertedGreen = true
for (const c of stages) {
  const r = runStage(c)
  if (r.code !== 0) { revertedGreen = false; writeFileSync(join(SNAP, `reverted-${c.id}.out.txt`), r.out) }
  console.log(`REVERTED ${r.code === 0 ? 'GREEN' : 'RED  '}  ${c.stage}  exit ${r.code} ${r.ms}ms`)
}
const fired = results.filter((r) => r.fired).length
console.log(`\n${fired}/${results.length} FIRED; reverted ${revertedGreen ? 'green' : 'NOT green'}; files byte-identical: ${identical}`)
process.exitCode = fired === results.length && revertedGreen && identical ? 0 : 1
