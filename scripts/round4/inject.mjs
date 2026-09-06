// ── ROUND 4 PHASE 2 ITEM 6: THE INJECTION SWEEP ─────────────────────────
//
// Verification 44 as extended: the harness verifies its own SNAPSHOT before
// injecting anything, and its own RESTORE after EVERY injection, stopping dead
// on a mismatch. Keys are full paths with separators replaced, because this
// repository mirrors basenames across src/lib and src/routes on purpose.
//
// Node, not a shell: zsh does not word-split an unquoted variable, and that is
// how the Phase 4 harness silently snapshotted nothing.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('../../', import.meta.url).pathname
const SNAP = process.env.SNAP
mkdirSync(SNAP, { recursive: true })
const key = (rel) => SNAP + '/' + rel.replaceAll('/', '_')

// ── THE INJECTIONS ────────────────────────────────────────────────────────
// Each names the CLAIM it falsifies, so a silent one names an unasserted claim
// (Verification 51) rather than reading as a harness problem.
const INJECTIONS = [
  { name: 'reporter mode writes the DOM anyway',
    claim: 'called with a reporter, requestPricingApproval writes no DOM',
    file: 'frontend/app.js',
    from: "    if (reporter) { reporter.onStart(); return }",
    to:   "    if (reporter) { reporter.onStart() }" },

  { name: 'reporter mode swallows the failure',
    claim: 'a failure reaches the reporter rather than the state line',
    file: 'frontend/app.js',
    from: "    if (reporter) { reporter.onResult(message, false); return }",
    to:   "    if (reporter) { return }" },

  { name: 'bare mode stops relabelling the button',
    claim: 'called bare, requestPricingApproval still drives the two ids as it did',
    file: 'frontend/app.js',
    from: "    if (btn) { btn.disabled = true; btn.textContent = 'Requesting...' }",
    to:   "    if (btn) { btn.disabled = true }" },

  { name: 'the vanilla card tag is restored, so the swap is undone',
    claim: 'THE REACT VERSION CARD IS THE LIVE ONE',
    file: 'frontend/index.html',
    from: "<!-- ── SUPERSEDED BY THE REACT VERSION CARD. Round 4, Phase 2 ─────────",
    to:   "<script type=\"module\" src=\"/opportunity-deal-versions.js\"></script>\n<!-- ── SUPERSEDED BY THE REACT VERSION CARD. Round 4, Phase 2 ─────────" },

  { name: 'the card\'s mount container is removed',
    claim: 'the React card has a container to mount into',
    file: 'frontend/index.html',
    from: 'id="deal-version-root"',
    to:   'id="deal-version-root-GONE"' },

  { name: 'the revert target markup is removed',
    claim: 'the card\'s revert target markup survives',
    file: 'frontend/index.html',
    from: 'id="deal-version-vanilla"',
    to:   'id="deal-version-vanilla-GONE"' },

  { name: 'the bundle stops registering the card',
    claim: 'the shell global surface is exactly the four registered names',
    file: 'frontend-react/src/main.tsx',
    from: "window.initOpportunityDealVersions = function (",
    to:   "window.initOpportunityDealVersionsXX = function (" },

  { name: 'the card reaches around the seam into the React form',
    claim: 'the card consumes a seam rather than reaching for a form',
    file: 'frontend-react/src/versions/VersionCardHost.tsx',
    from: "import { useCallback, useEffect, useRef, useState } from 'react'",
    to:   "import { useCallback, useEffect, useRef, useState } from 'react'\nconst useDealForm = () => null\nvoid useDealForm",
    expect: 'DETECTED' },

  // ── VERIFICATION 39, CALIBRATED IN BOTH DIRECTIONS ─────────────────────
  // The same forbidden name as a COMMENT must NOT satisfy the scan. A silent
  // verdict here is the pass: it proves the scan reads stripped source, and
  // that prose cannot supply a green reading.
  { name: 'the forbidden name appears only in a COMMENT (expected silent)',
    claim: 'the seam scan reads stripped source, so prose cannot satisfy it',
    file: 'frontend-react/src/versions/VersionCardHost.tsx',
    from: "import { useCallback, useEffect, useRef, useState } from 'react'",
    to:   "import { useCallback, useEffect, useRef, useState } from 'react'\n// useDealForm readDealPayload DealPanel are what this must never import",
    expect: 'SILENT' },

  { name: 'the freeze runs BEFORE the reconciliation refusal',
    claim: 'scheduleReconciliation runs before freezeCurrentState',
    file: 'frontend-react/src/versions/VersionCardHost.tsx',
    from: "seam.freezeCurrentState()",
    to:   "await seam.freezeCurrentState()" },
]

const FILES = [...new Set(INJECTIONS.map((i) => i.file))]

// ── SNAPSHOT, THEN PROVE THE SNAPSHOT EXISTS ─────────────────────────────
const original = new Map()
for (const rel of FILES) {
  const src = ROOT + rel
  if (!existsSync(src)) throw new Error(`SNAPSHOT: ${rel} does not exist`)
  const bytes = readFileSync(src)
  writeFileSync(key(rel), bytes)
  original.set(rel, bytes)
}
for (const rel of FILES) {
  const k = key(rel)
  if (!existsSync(k)) throw new Error(`SNAPSHOT NOT WRITTEN for ${rel}`)
  const n = statSync(k).size
  if (n !== original.get(rel).length) throw new Error(`SNAPSHOT SIZE MISMATCH for ${rel}`)
  console.log(`snapshot verified  ${rel}  ${n}B  -> ${k.split('/').pop()}`)
}
if (new Set(FILES.map(key)).size !== FILES.length) throw new Error('SNAPSHOT KEY COLLISION')
console.log('')

const restore = (rel) => {
  writeFileSync(ROOT + rel, readFileSync(key(rel)))
  const now = readFileSync(ROOT + rel)
  if (!now.equals(original.get(rel))) throw new Error(`RESTORE MISMATCH on ${rel} - STOPPING`)
}

const gate = () => {
  try {
    const out = execSync('npm test 2>&1 && npm run test:react 2>&1',
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    return { green: true, out }
  } catch (e) { return { green: false, out: (e.stdout ?? '') + (e.stderr ?? '') } }
}

const failLines = (out) => {
  const lines = out.split('\n').filter((l) =>
    /^not ok |✗|FAIL |AssertionError|failing tests|# fail [1-9]|Tests {2}\d+ failed/.test(l))
  return [...new Set(lines.map((l) => l.trim().slice(0, 110)))].slice(0, 4)
}

console.log('BASELINE')
const base = gate()
console.log('  ' + (base.green ? 'GREEN' : '*** NOT GREEN, so nothing below means anything ***'))
if (!base.green) { console.log(failLines(base.out).join('\n')); process.exit(1) }
console.log('')

const results = []
for (const inj of INJECTIONS) {
  const rel = inj.file
  const src = readFileSync(ROOT + rel, 'utf8')
  const hits = src.split(inj.from).length - 1
  if (hits !== 1) {
    results.push({ ...inj, verdict: hits === 0 ? 'ANCHOR NOT FOUND' : `ANCHOR NOT UNIQUE (${hits})`, lines: [] })
    restore(rel)
    continue
  }
  writeFileSync(ROOT + rel, src.replace(inj.from, inj.to))
  const r = gate()
  const lines = failLines(r.out)
  const verdict = r.green ? 'SILENT' : 'DETECTED'
  results.push({ ...inj, verdict, lines, asExpected: verdict === (inj.expect ?? 'DETECTED') })
  restore(rel)
}

console.log('FINAL REVERTED RUN')
const final = gate()
console.log('  ' + (final.green ? 'GREEN' : '*** REVERTED RUN NOT GREEN ***'))
if (!final.green) console.log(failLines(final.out).join('\n'))
for (const rel of FILES) {
  const now = readFileSync(ROOT + rel)
  console.log(`  ${now.equals(original.get(rel)) ? 'identical' : '*** DIFFERS ***'}  ${rel}`)
}

console.log('\n── SWEEP ──────────────────────────────────────────────────────')
for (const r of results) {
  console.log(`\n${r.verdict.padEnd(18)}${r.expect === 'SILENT' ? '(silent expected) ' : ''}${r.name}`)
  console.log(`  claim   ${r.claim}`)
  if (r.lines.length) console.log('  fired   ' + r.lines.join('\n          '))
}
const silent = results.filter((r) => !r.asExpected)
console.log(`\n${results.length - silent.length}/${results.length} behaved as expected`)
if (silent.length) {
  console.log('\nSILENT OR UNANCHORED - each names a claim with no detector (Verification 51):')
  for (const s of silent) console.log(`  ${s.verdict}: ${s.claim}`)
}
