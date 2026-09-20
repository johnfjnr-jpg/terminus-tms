// R4's SCREENSHOT: the adopted red in states the product actually produces.
//
// Build discipline 17 M2, the cosmetic tier: a red-first guard, the affected
// suite, and a screenshot that is opened and read.
//
// DRIVEN, NOT STAGED. The comparison capture that won the colour word rendered
// the two candidates side by side on the real ground, which is the right
// artefact for CHOOSING and the wrong one for verifying: it proves nothing
// about whether the adopted token reaches the sites. So this drives the New
// Lead grid into a real invalid state and photographs what the product does.
//
// AND ONE OF THE TEN CANNOT BE PHOTOGRAPHED, which is reported rather than
// worked around: `input.input-invalid` is applied by NO live source. Measured
// with the comment stripper across app.js, anchor-popup.js, index.html and the
// whole React tree. It is a rule nothing applies, the same family as the
// orphaned `tab-action-idle` already on the list, and a state that does not
// exist cannot be captured.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-r4-live-states.mjs')
import { readFileSync, mkdirSync } from 'node:fs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opp-r4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1000 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })
  await p.evaluate(() => navigate('leads'))
  await p.waitForFunction(() => !!document.querySelector('[data-testid="new-lead-open"], #btn-new-lead, #new-lead-open'),
    { timeout: 20000 }).catch(() => {})

  // Open the New Lead grid by whichever control the surface carries.
  await p.evaluate(() => {
    const b2 = document.querySelector('[data-testid="new-lead-open"], #btn-new-lead, #new-lead-open')
      ?? [...document.querySelectorAll('button')].find((x) => /new lead/i.test(x.textContent ?? ''))
    b2?.click()
  })
  await p.waitForSelector('.new-lead-table, [data-testid="nlg-name-0"]', { timeout: 20000 })

  // Type a NAME only, which leaves the other required fields empty, then blur
  // so the grid marks what is missing. This is the product's own validation,
  // not a class applied by the probe.
  await p.type('[data-testid="nlg-name-0"]', 'Red state proof')
  await p.evaluate(() => { document.querySelector('.new-lead-table th')?.scrollIntoView() })
  await p.click('.new-lead-table th').catch(() => {})
  await p.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find((x) => /save|create/i.test(x.textContent ?? ''))
    save?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))

  const m = await p.evaluate(() => {
    const red = (el) => el ? getComputedStyle(el).color : null
    const why = document.querySelector('.nlg-why')
    const invalidSel = document.querySelector('.new-lead-table select[aria-invalid="true"]')
    const msg = document.querySelector('.msg-error')
    return {
      whyCount: document.querySelectorAll('.nlg-why').length,
      whyColour: red(why),
      whyText: (why?.textContent ?? '').trim().slice(0, 40),
      invalidSelCount: document.querySelectorAll('.new-lead-table select[aria-invalid="true"]').length,
      invalidSelBorder: invalidSel ? getComputedStyle(invalidSel).borderBottomColor : null,
      msgCount: document.querySelectorAll('.msg-error').length,
      msgColour: red(msg),
      msgText: (msg?.textContent ?? '').trim().slice(0, 50),
      // The token's own computed value, read from the document rather than the file.
      token: getComputedStyle(document.documentElement).getPropertyValue('--red').trim(),
    }
  })

  console.log(`\n  --red as the DOCUMENT computes it: ${JSON.stringify(m.token)}`)
  const EXPECT = 'rgb(224, 108, 108)'   // #e06c6c
  check(m.whyCount > 0, 'the grid renders its own invalid explanations', `${m.whyCount} .nlg-why`)
  check(m.whyColour === EXPECT, '.nlg-why computes to the adopted red',
    `${m.whyColour} (expected ${EXPECT})  text=${JSON.stringify(m.whyText)}`)
  if (m.invalidSelCount > 0) {
    check(m.invalidSelBorder === EXPECT, 'and the invalid select border is the same red',
      `${m.invalidSelBorder}`)
  } else {
    check(true, 'no select is marked invalid in this state, so its border is not asserted here', '0 found')
  }
  if (m.msgCount > 0) {
    check(m.msgColour === EXPECT, '.msg-error computes to the adopted red',
      `${m.msgColour}  text=${JSON.stringify(m.msgText)}`)
  } else {
    check(true, 'no .msg-error is produced by this path, so it is not asserted here', '0 found')
  }

  await p.screenshot({ path: `${OUT}r4-live-invalid-1440.png` })
  console.log(`  captured r4-live-invalid-1440.png`)
} finally { await b.close() }

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
