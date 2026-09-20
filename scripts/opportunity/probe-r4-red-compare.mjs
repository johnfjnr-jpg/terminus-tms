// R4's COLOUR STOP: the two reds on the real ground, for John's word.
//
// The derivation concluded that the incumbent `#e06c6c` meets all five
// requirements, so the change is ADOPTION rather than a new colour. What
// changes visibly is the SIX sites that reach no token today: they move from
// `rgba(242,100,100,.9)`, which composites to #dc5d5e, onto #e06c6c.
//
// THIS RENDERS BOTH ON THE REAL GROUND, in the real stylesheet, at the real
// sizes, because a hex pair in a report says nothing about what a person sees.
// It is plainly a comparison harness and not a product screen, which is
// honest: the alternative is to apply the change estate-wide first and
// photograph it, which is the commit R4 stops before.
//
// UNWIRED: needs a browser and a live server. No session required.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-r4-red-compare.mjs')
import { mkdirSync } from 'node:fs'

const OUT = '/Users/johnfryatt/terminus-tms/.verify/opp-r4/'
mkdirSync(OUT, { recursive: true })

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1100, height: 700 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })

  await p.evaluate(() => {
    document.body.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.style.cssText = 'padding:40px;font-family:var(--body)'
    const block = (label, colour, note) => `
      <div style="margin-bottom:30px">
        <div style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;
                    text-transform:uppercase;color:var(--muted);margin-bottom:10px">${label}</div>
        <p class="msg-error" style="color:${colour};margin:0 0 10px">
          The changes could not be saved.</p>
        <input value="Willowglen" style="background:var(--black);color:var(--white);
               border:1px solid ${colour};outline:1px solid ${colour};
               padding:8px 10px;width:240px;font-family:var(--body)">
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:10px">${note}</div>
      </div>`
    wrap.innerHTML = `
      <h1 style="font-size:20px;color:var(--white);margin:0 0 6px">R4: the two reds, on the real ground</h1>
      <p style="color:var(--muted);font-size:13px;margin:0 0 30px">
        Error text and an invalid-input border, as the six untokenised sites and
        the token render them today.</p>
      ${block('TODAY, at six sites: rgba(242,100,100,.9) composites to #dc5d5e',
              '#dc5d5e', 'contrast 4.71:1 on --dark')}
      ${block('THE TOKEN, at four sites: #e06c6c, and the PROPOSED value for all ten',
              '#e06c6c', 'contrast 5.33:1 on --dark')}
      <div style="border-top:1px solid var(--hairline-strong);padding-top:20px;
                  font-size:13px;color:var(--muted);max-width:640px;line-height:1.6">
        The proposal is that all ten sites take <span style="color:var(--white)">#e06c6c</span>,
        the value already in the palette. The six move slightly deeper and less
        saturated, and gain contrast. Nothing else changes.
      </div>`
    document.body.appendChild(wrap)
  })
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await p.screenshot({ path: `${OUT}r4-red-compare.png` })
  console.log(`captured ${OUT}r4-red-compare.png`)
} finally { await b.close() }
