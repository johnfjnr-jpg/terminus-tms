#!/usr/bin/env node
// ── IS THE BROWSER DEPENDENCY FUNCTIONAL, NOT MERELY PRESENT? ────────────
//
// The fourth instance of the enforcement-gap pattern, and a different shape
// from the other three. Those are controls nothing routes through. This is a
// control that RUNS, finds its dependency absent, and quietly checks nothing.
//
// MEASURED 2026-09-14: after a tmp sweep,
// `/tmp/tms-probe/node_modules/puppeteer` existed as a directory holding
// `lib` and `src` and no install at all. A presence check passes on that.
// `probe-loader.test.mjs` skipped itself, the suite reported 538 passing
// instead of 539 with nothing red, and the gate's browser stage would have
// SKIPPED and fired F6 at the round close.
//
// DIRECTORY PRESENCE IS NOT INSTALLATION. This asks the functional question
// the dependent stages actually need answered: does it LOAD, and does it
// LAUNCH.
import { loadPuppeteer } from './lib/puppeteer.mjs'

const t0 = Date.now()
let puppeteer
try {
  puppeteer = await loadPuppeteer('check-browser-usable')
} catch (e) {
  console.error('FAIL  the browser dependency does not LOAD.')
  console.error(`  ${String(e).split('\n')[0]}`)
  console.error('  A directory is not an install. Reinstall:')
  console.error('    npm i puppeteer --prefix /tmp/tms-probe')
  process.exit(1)
}

try {
  const b = await puppeteer.launch({ headless: 'new' })
  await b.close()
} catch (e) {
  console.error('FAIL  the browser dependency loads but does not LAUNCH.')
  console.error(`  ${String(e).split('\n')[0]}`)
  process.exit(1)
}

console.log(`PASS  the browser dependency loads and launches  ${Date.now() - t0}ms`)
