// PROBE_TRIAGE R8: every probe or calibrator under scripts/ is a gate stage or
// is in docs/PROBES.md with a disposition, and every disposition that can be
// checked mechanically is true. Replaces scripts/probe-inventory/q1-wiring.mjs.
//
// The checker is pure (scripts/lib/probe-register.mjs), so each failure it
// exists for is injected here on synthetic inputs and must fire BY NAME, and a
// clean input must come back empty (CLAUDE.md build discipline 3: define and
// calibrate the reassuring verdict too).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkRegister, parseRegister, isProbeFile } from '../lib/probe-register.mjs'
import { stripComments } from '../lib/strip-comments.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(relative(ROOT, p))
  }
  return out
}
// What the gate runs, as text: the stage list, the calibrations stage, the
// suites, AND every file those reach by a relative import, transitively. A
// library such as golden-deals/calibration-cases.mjs is run by the gate
// because something it runs imports it, and is named nowhere by path; without
// the closure it reads as "WIRED, and nothing runs it".
const gateText = (files) => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const code = (f) => stripComments(readFileSync(join(ROOT, f), 'utf8'), 'js')
  const seeds = [code('scripts/verify-all.mjs'), code('scripts/run-calibrations.mjs'), ...Object.values(pkg.scripts)].join('\n')
  const onDisk = new Set(files)
  const reached = new Set(files.filter((f) => /\.(mjs|js|cjs)$/.test(f) && new RegExp(`['"\\s]${f.replace(/\./g, '\\.')}['"\\s]`).test(seeds)))
  const queue = [...reached]
  while (queue.length) {
    const f = queue.pop()
    for (const m of code(f).matchAll(/(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const t = relative(ROOT, join(ROOT, f, '..', m[1]))
      if (onDisk.has(t) && !reached.has(t)) { reached.add(t); queue.push(t) }
    }
  }
  return `${seeds}\n${[...reached].map((f) => `'${f}'`).join('\n')}`
}

test('R8: every probe and calibrator under scripts/ is wired, or docs/PROBES.md says why not', () => {
  const files = walk(join(ROOT, 'scripts'))
  const register = readFileSync(join(ROOT, 'docs/PROBES.md'), 'utf8')
  const population = files.filter(isProbeFile)
  assert.ok(population.length > 20, `the population is real (${population.length} probe and calibrator files)`)
  const { rows } = parseRegister(register)
  assert.ok(rows.size >= population.length, `the register is not vacuous: ${rows.size} rows for ${population.length} files`)
  assert.deepEqual(checkRegister({ files, register, gate: gateText(files) }), [])
})

// ── The calibration, on synthetic inputs ───────────────────────────────────

const ok = [
  '| file | disposition | guards | why |',
  '|---|---|---|---|',
  '| `scripts/probe-a.mjs` | WIRED | a | gate stage |',
  '| `scripts/probe-b.mjs` | MANUAL | b | needs a second account, which the gate has not got |',
  '| `scripts/old/probe-c.mjs` | RETIRED | c | superseded by probe-a |',
].join('\n')
const files = ['scripts/probe-a.mjs', 'scripts/probe-b.mjs', 'scripts/lib/x.mjs']
const gate = "cmd: ['node', ['scripts/probe-a.mjs']]"

test('R8 calibration: a clean register reads clean (the reassuring verdict, calibrated)', () => {
  assert.deepEqual(checkRegister({ files, register: ok, gate }), [])
})

test('R8 calibration: an unlisted probe fires, naming it', () => {
  const p = checkRegister({ files: [...files, 'scripts/new/probe-d.mjs'], register: ok, gate })
  assert.ok(p.some((x) => x.startsWith('scripts/new/probe-d.mjs: a probe or calibrator with no row')), p.join('\n'))
})

test('R8 calibration: an unlisted calibrator fires too', () => {
  const p = checkRegister({ files: [...files, 'scripts/calibrate-e.mjs'], register: ok, gate })
  assert.ok(p.some((x) => x.startsWith('scripts/calibrate-e.mjs: a probe or calibrator with no row')), p.join('\n'))
})

test('R8 calibration: a RETIRED file still on disk fires', () => {
  const p = checkRegister({ files: [...files, 'scripts/old/probe-c.mjs'], register: ok, gate })
  assert.ok(p.some((x) => x.startsWith('scripts/old/probe-c.mjs: marked RETIRED')), p.join('\n'))
})

test('R8 calibration: WIRED with nothing in the gate running it fires', () => {
  const p = checkRegister({ files, register: ok, gate: '' })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-a.mjs: listed as WIRED, and nothing in the gate runs it')), p.join('\n'))
})

test('R8 calibration: a gate mention in a COMMENT does not wire it (Verification 39)', () => {
  const commented = stripComments("// cmd: ['node', ['scripts/probe-a.mjs']]\nconst x = 1\n", 'js')
  const p = checkRegister({ files, register: ok, gate: commented })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-a.mjs: listed as WIRED, and nothing')), p.join('\n'))
})

test('R8 calibration: a root probe is not wired by a same-named probe in a subdirectory', () => {
  const p = checkRegister({ files, register: ok, gate: "cmd: ['node', ['scripts/sizing/probe-a.mjs']]" })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-a.mjs: listed as WIRED, and nothing')), p.join('\n'))
})

test('R8 calibration: a probe the gate runs but the register calls MANUAL fires', () => {
  const p = checkRegister({ files, register: ok, gate: gate + "\ncmd: ['node', ['scripts/probe-b.mjs']]" })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-b.mjs: the gate runs it, but docs/PROBES.md says MANUAL')), p.join('\n'))
})

test('R8 calibration: MANUAL with no reason fires', () => {
  const p = checkRegister({ files, register: ok.replace('needs a second account, which the gate has not got', ''), gate })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-b.mjs: MANUAL with no stated reason')), p.join('\n'))
})

test('R8 calibration: a row pointing at a file that does not exist fires (a pointer to nothing)', () => {
  const p = checkRegister({ files: files.filter((f) => f !== 'scripts/probe-b.mjs'), register: ok, gate })
  assert.ok(p.some((x) => x.startsWith('scripts/probe-b.mjs: listed as MANUAL in docs/PROBES.md, and no such file exists')), p.join('\n'))
})

test('R8 calibration: an empty register is not a clean one', () => {
  const p = checkRegister({ files: ['scripts/lib/x.mjs'], register: '', gate })
  assert.ok(p.some((x) => x.includes('no register rows at all')), p.join('\n'))
})
