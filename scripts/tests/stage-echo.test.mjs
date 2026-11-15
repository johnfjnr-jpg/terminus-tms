// R-GS4, GOLDEN_STATUS round, ruled by John 2026-11-15: the golden deals
// per-deal status table and the "pricing may not move" message print on every
// run, and the gate shows them. Derived from the ruling, not from the helper:
// a block present is copied; a block missing on a PASSING stage fails it; a
// block missing on a failing stage leaves it failing and says so.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { stageEcho } from '../lib/stage-echo.mjs'
import { STAGES } from '../verify-all.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const ECHO = { begin: 'GOLDEN STATUS', end: 'END GOLDEN STATUS' }
const BLOCK = ['GOLDEN STATUS', '  G1  906  PROVISIONAL  -', 'END GOLDEN STATUS']

test('a passing stage with its block: the block is copied whole and the stage stays green', () => {
  const r = stageEcho(ECHO, ['noise', ...BLOCK, 'PASS: 13 checks'].join('\n'), true)
  assert.equal(r.ok, true)
  assert.deepEqual(r.lines, BLOCK)
  assert.equal(r.problem, null)
})

test('a PASSING stage with no block is FAILED, and the reason names the marker', () => {
  const r = stageEcho(ECHO, 'PASS: 13 checks', true)
  assert.equal(r.ok, false)
  assert.equal(r.lines, null)
  assert.match(r.problem, /no "GOLDEN STATUS" block.*passing stage is failed/)
})

test('a block with no end marker is not a block, and fails a passing stage', () => {
  const r = stageEcho(ECHO, ['GOLDEN STATUS', '  G1 ...', 'PASS'].join('\n'), true)
  assert.equal(r.ok, false)
  assert.match(r.problem, /has no "END GOLDEN STATUS" line/)
})

test('an end marker BEFORE the begin marker does not count', () => {
  const r = stageEcho(ECHO, ['END GOLDEN STATUS', 'GOLDEN STATUS', 'x'].join('\n'), true)
  assert.equal(r.ok, false)
})

test('a marker inside a longer line does not count: markers are whole lines', () => {
  const r = stageEcho(ECHO, ['the GOLDEN STATUS block', 'END GOLDEN STATUS'].join('\n'), true)
  assert.equal(r.ok, false)
})

test('a FAILING stage with its block: still failing, block still copied (it prints on red too)', () => {
  const r = stageEcho(ECHO, BLOCK.join('\n'), false)
  assert.equal(r.ok, false)
  assert.deepEqual(r.lines, BLOCK)
})

test('a failing stage without its block stays failing and says the block is missing', () => {
  const r = stageEcho(ECHO, 'boom', false)
  assert.equal(r.ok, false)
  assert.match(r.problem, /no "GOLDEN STATUS" block/)
  assert.doesNotMatch(r.problem, /passing stage/)
})

test('the golden deals gate stage declares exactly these markers', () => {
  const s = STAGES.filter((x) => x.name === 'golden deals')
  assert.equal(s.length, 1, 'exactly one golden deals stage')
  assert.deepEqual(s[0].echo, ECHO)
})

test('the REAL harness prints the block, with one row per deal and the R-GS4 message inside it', () => {
  const run = spawnSync('node', ['scripts/golden-deals-check'], { cwd: ROOT, encoding: 'utf8' })
  const r = stageEcho(ECHO, `${run.stdout}${run.stderr}`, run.status === 0)
  assert.ok(r.lines, r.problem ?? 'no block')
  const body = r.lines.join('\n')
  for (const id of ['G1', 'G2', 'G3', 'G4', 'G5']) assert.match(body, new RegExp(`^  ${id} +\\d+ +(PROVISIONAL|CONFIRMED) `, 'm'))
  assert.match(body, /PRICING MAY NOT MOVE WITHOUT THIS SUITE GOING RED/)
})
