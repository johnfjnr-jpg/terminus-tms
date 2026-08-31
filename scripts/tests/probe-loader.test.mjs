// The shared puppeteer resolver, and the path it PRINTS.
//
// CLAUDE.md Verification 25's corollary: a recovery path that has never been
// exercised is a plan. The message this module prints is an instruction to a
// human, and the previous version of it did not work - it named the package
// directory, which is ERR_UNSUPPORTED_DIR_IMPORT in ESM, so following it
// verbatim reproduced the failure it was written to resolve. It had sat
// committed and unrun since it was written.
//
// So the printed command is now under test rather than under review.
//
// SKIPS RATHER THAN FAILS when puppeteer is not installed anywhere, because it
// deliberately is not a dependency of this repository and CI runs `npm ci`. A
// skip says "not measured here"; a pass would say "measured and fine", which
// would be the false green this file exists to prevent.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { readCode } from '../lib/strip-comments.mjs'

const SCRATCH = '/tmp/tms-probe/node_modules/puppeteer'

test('the path the failure message prints is the path the loader accepts', { skip: !existsSync(`${SCRATCH}/package.json`) && 'puppeteer is not scratch-installed' }, async () => {
  // The exact value the message tells a person to set. Read from the module's
  // own source rather than retyped, so the two cannot drift: a test asserting a
  // hand-copied string would pass while the message said something else.
  const src = readFileSync(new URL('../lib/puppeteer.mjs', import.meta.url), 'utf8')
  const printed = src.match(/PUPPETEER_PATH=(\S+)/)[1]
  assert.equal(printed, SCRATCH, 'the message names a path this test does not check')

  const before = process.env.PUPPETEER_PATH
  process.env.PUPPETEER_PATH = printed
  try {
    const p = await loadPuppeteer('probe-loader.test.mjs')
    assert.equal(typeof p.launch, 'function', 'resolved something that is not puppeteer')
  } finally {
    if (before === undefined) delete process.env.PUPPETEER_PATH
    else process.env.PUPPETEER_PATH = before
  }
})

test('every browser probe resolves puppeteer through the one helper', () => {
  // Build discipline 6, made mechanical. Round 41 fixed three of six copies of
  // an identical broken block and left three, because the three fixed were the
  // three being run that afternoon. A count would not catch the next one; this
  // asserts that no probe carries its own resolution at all.
  const dir = new URL('../', import.meta.url).pathname
  const probes = readdirSync(dir).filter((f) => f.startsWith('probe-') && f.endsWith('.mjs'))
  assert.ok(probes.length >= 6, `population check: found ${probes.length} probes`)
  const browserProbes = []
  for (const f of probes) {
    const code = readCode(new URL(`../${f}`, import.meta.url))
    // Read through the stripper, Verification 39: three of these files discuss
    // puppeteer resolution at length in their comments, and a raw scan for
    // 'puppeteer' would call every one of them a browser probe.
    if (!/puppeteer/i.test(code)) continue
    browserProbes.push(f)
    assert.ok(code.includes("loadPuppeteer("), `${f} does not use the shared loader`)
    assert.ok(!/let puppeteer\b/.test(code), `${f} still carries its own resolution block`)
    assert.ok(!/await import\(process\.env\.PUPPETEER_PATH/.test(code), `${f} still resolves PUPPETEER_PATH itself`)
  }
  assert.ok(browserProbes.length >= 6, `population check: only ${browserProbes.length} browser probes found, so this test may not be reaching them`)
})
