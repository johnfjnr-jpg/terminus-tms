// R-O7 + R-O8: THE PER-UNIT HOSTING FEE, DRIVEN LIVE AND READ BACK.
//
// The pure suite proves the arithmetic and the react suite proves the card.
// Neither can prove the claim the ruling actually made, which is that the
// override FLOWS: "flowing through rawTotalPrice so contract totals, cash
// flow, tax, achieved margin and the approval version bridge inherit".
//
// SO THE MEASURE IS A MOVEMENT, NOT A VALUE. Every headline figure is read
// before the override and after it, and the claim is that they MOVED. A
// probe asserting "contract net is $X" would pass on a screen that ignores
// the override and happens to show a plausible number.
//
// AND THE SCREEN IS NOT THE AUTHORITY. The fee is read back out of the
// database after the save, because a card that recalculates and a record that
// does not is the defect this is most likely to have.
//
// THE FEE IS TYPED WITH REAL KEYBOARD EVENTS. A synthetic `.value` write is
// deduped by React's own value tracker once the input has persisted across a
// render: the DOM shows the text, the component's state never receives it, and
// a probe reading `el.value` back reports the box as filled while the card
// refuses to recalculate.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-hosting-override.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4hofee'
const db = admin()
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const DEAL = {
  structure: 'twoPhase', invoicing: 'annual', duration: 36, targetMargin: 30,
  ssExisting: 40, ssNew: 25, aqm: 12, hemir: 8,
  installResp: 'Client Own Installation Team',
}
// ABOVE COST ON PURPOSE, AND THE FIRST VALUE WAS NOT. At $55 the probe read a
// margin of -263.6% and that was CORRECT: SafeSight hosting costs $200 a unit
// a month here, so $55 is a price far under cost and the card said so. The
// arithmetic was right and the fixture was wrong, which is the good way round.
//
// $400 against a $200 cost is a 50% margin, comfortably above the 30% target,
// so "the fee is being priced rather than the target" is a claim the number
// can actually carry. The below-cost case keeps its own test in `cost.test.mjs`,
// where a negative margin is asserted rather than stumbled into.
const FEE = '400'

// ── A FIXTURE PER WIDTH, AND THE REASON IS A FAILURE THIS PROBE HAD ─────
//
// The first version used one opportunity for both widths. The 1440 pass SAVES
// the override, so the 1240 pass reopened a record whose mode was already
// `perUnit`: "the override starts OFF" went red and the wait for the fee box
// timed out, which reads as the switch having stopped working.
//
// Nothing was broken. An earlier claim had consumed the fixture, which is the
// shape CLAUDE.md records under "a wait that can never be satisfied because
// the product correctly moved on", with its own remedy: where two claims need
// one fixture in different states, give each its own. It costs one record.
const opps = {}
for (const w of [1440, 1240]) {
  opps[w] = await freshOpportunity(TAG)
  console.log(`opportunity for ${w}: ${opps[w].oppId}`)
}

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.setViewport({ width: 1440, height: 1200 })
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await p.reload({ waitUntil: 'networkidle0' })

  let opp = opps[1440]
  const openOpp = async () => {
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      const c = document.getElementById('detail-company')
      return !!v && !v.classList.contains('is-loading') && !!c && (c.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
  }
  const writeDeal = async () => {
    await openOpp()
    const wrote = await p.evaluate(async (id, payload) => {
      const r = await window.oppPatch(id, { payload })
      return { ok: r.ok, status: r.status, error: r.data?.error ?? null }
    }, opp.oppId, DEAL)
    if (!wrote.ok) throw new Error(`the fixture write was refused with ${wrote.status}: ${wrote.error}`)
    console.log(`wrote the deal on ${opp.oppId}: ${wrote.status}`)
  }

  const openCommercials = async () => {
    // A FULL RELOAD: `DealPanel` seeds its UI state once, so a re-navigate
    // leaves the form holding whatever it was first given.
    await p.reload({ waitUntil: 'networkidle0' })
    await openOpp()
    await p.evaluate(() => {
      const t = [...document.querySelectorAll('#opp-detail-tabs .detail-tab')]
        .find((x) => /commercial/i.test(x.textContent ?? ''))
      t?.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      return !!panel && !!panel.querySelector('[data-testid="deal-hosting-price-mode"]')
    }, { timeout: 25000 })
    // ── THE PRICING CARDS LIVE BEHIND THE DISCLOSURE ────────────────────
    //
    // `Show detail` reveals the aside the cards sit in. Without opening it the
    // fee box IS in the DOM and reads its text perfectly, and `page.click`
    // fails with "Node is either not clickable or not an Element" - which is
    // Verification 4's own sentence arriving in a probe: presence is not
    // visibility, and every text assertion above would have passed on it.
    await p.evaluate(() => {
      const t = document.getElementById('btn-toggle-detail')
      if (t && t.getAttribute('aria-expanded') !== 'true') t.click()
    })
    await p.waitForFunction(() => {
      const t = document.getElementById('btn-toggle-detail')
      return t?.getAttribute('aria-expanded') === 'true'
    }, { timeout: 15000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  // Every headline the ruling names, read from the live panel rather than the
  // retired duplicate block.
  const headline = () => p.evaluate(() => {
    const panel = document.getElementById('opp-tab-commercial')
    const pick = (id) => [...(panel?.querySelectorAll(`[data-testid="${id}"]`) ?? [])]
      .find((e) => !e.closest('#deal-form-vanilla'))
    const txt = (id) => (pick(id)?.textContent ?? '').trim()
    const cash = [...(panel?.querySelectorAll('[data-testid^="cf-"]') ?? [])]
      .filter((e) => !e.closest('#deal-form-vanilla')).slice(0, 4).map((e) => e.textContent?.trim())
    return {
      achievedMargin: txt('deal-achieved-margin'),
      contractNet: txt('deal-contract-net'),
      totalCost: txt('deal-total-cost'),
      hostingTotalPrice: txt('pg-total-price-ho'),
      feeMarginSs: txt('pg-fee-margin-hoSs'),
      help: txt('deal-hosting-fee-help'),
      switchOn: pick('deal-hosting-price-mode')?.getAttribute('aria-checked') ?? null,
      cash,
    }
  })

  for (const width of [1440, 1240]) {
    opp = opps[width]
    await p.setViewport({ width, height: 1200 })
    await writeDeal()
    await openCommercials()
    console.log(`\n=== ${width}px ===`)

    const before = await headline()
    console.log(`  before: margin=${before.achievedMargin} net=${before.contractNet} hosting=${before.hostingTotalPrice} switch=${before.switchOn}`)
    check(before.switchOn === 'false', `R-O7 the override starts OFF at ${width}`)

    // ── TURN IT ON, AND TYPE A FEE THE WAY A PERSON WOULD ────────────────
    await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const sw = [...panel.querySelectorAll('[data-testid="deal-hosting-price-mode"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      sw.click()
    })
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      return [...panel.querySelectorAll('[data-testid="deal-hofee-hoSs"]')]
        .some((e) => !e.closest('#deal-form-vanilla'))
    }, { timeout: 15000 })

    const feeSel = '#opp-tab-commercial [data-testid="deal-hofee-hoSs"]'
    await p.click(feeSel)
    await p.type(feeSel, FEE, { delay: 20 })
    // ONE INTERACTION, THEN YIELD, THEN ASSERT. React re-renders
    // asynchronously, so a read in the same synchronous evaluation as the
    // typing measures the previous frame.
    await p.waitForFunction(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const el = [...panel.querySelectorAll('[data-testid="pg-fee-margin-hoSs"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      return !!el && (el.textContent ?? '').trim() !== '--'
    }, { timeout: 15000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

    const after = await headline()
    console.log(`  after:  margin=${after.achievedMargin} net=${after.contractNet} hosting=${after.hostingTotalPrice} feeMargin=${after.feeMarginSs}`)

    check(after.switchOn === 'true', `R-O7 the switch reads ON after the click at ${width}`)
    // 65 SafeSight units, hosting cost from the catalog. The MARGIN is the
    // claim rather than a figure: a fee of 55 a unit against a hosting cost
    // well under that must imply a margin far above the 30% target.
    check(/^\d+\.\d%$/.test(after.feeMarginSs),
      `R-O7 the % Margin column shows a derived percentage at ${width}`, after.feeMarginSs)
    check(parseFloat(after.feeMarginSs) > 30,
      `R-O7 and the fee earns MORE than the 30% target, so it is the fee being priced and not the target`,
      after.feeMarginSs)

    // ── THE FLOW. Every one of these must MOVE. ──────────────────────────
    check(after.hostingTotalPrice !== before.hostingTotalPrice,
      `R-O7 the hosting total price moved at ${width}`,
      `${before.hostingTotalPrice} -> ${after.hostingTotalPrice}`)
    check(after.contractNet !== before.contractNet,
      `R-O7 CONTRACT NET inherited the override at ${width}`,
      `${before.contractNet} -> ${after.contractNet}`)
    check(after.achievedMargin !== before.achievedMargin,
      `R-O7 ACHIEVED MARGIN inherited it at ${width}`,
      `${before.achievedMargin} -> ${after.achievedMargin}`)
    check(JSON.stringify(after.cash) !== JSON.stringify(before.cash),
      `R-O7 and the CASH FLOW inherited it at ${width}`)

    // R-O8's display half, on the same screen.
    check(/warranty-inclusive/i.test(after.help),
      `R-O8 the panel says an overridden fee is warranty-inclusive at ${width}`)
    const sheet = await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const rows = [...(panel?.querySelectorAll('[data-testid^="dm-row-"]') ?? [])]
        .filter((e) => !e.closest('#deal-form-vanilla'))
      return rows.map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim())
    })
    check(sheet.some((r) => /^Warranty provision, at cost/.test(r)),
      `R-O8 the warranty provision is its own deal sheet line at ${width}`,
      sheet.find((r) => /Warranty/.test(r))?.slice(0, 60) ?? '(no warranty row)')
    check(!sheet.some((r) => /Hardware and warranty cost/.test(r)),
      `R-O8 and the folded row is gone at ${width}`)

    // ── MEASURE FIRST, CAPTURE SECOND ────────────────────────────────────
    await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const el = [...panel.querySelectorAll('[data-testid="pg-head-fee"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      el?.closest('.pg-card')?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const inView = await p.evaluate(() => {
      const panel = document.getElementById('opp-tab-commercial')
      const el = [...panel.querySelectorAll('[data-testid="pg-head-fee"]')]
        .find((e) => !e.closest('#deal-form-vanilla'))
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    check(inView, `R-O7 the fee table is inside the captured region at ${width}`)
    await p.screenshot({ path: `${OUT}o7-override-${width}.png` })
    console.log(`  captured o7-override-${width}.png`)

    // ── SAVE, AND READ THE RECORD BACK ───────────────────────────────────
    if (width === 1440) {
      const saved = await p.evaluate(async () => {
        const btn = document.getElementById('btn-save-deal')
        if (!btn) return { clicked: false, reason: 'no save button' }
        if (btn.disabled) return { clicked: false, reason: 'the save button is disabled, so nothing was dirty' }
        btn.click()
        return { clicked: true }
      })
      check(saved.clicked, 'R-O7 the override raised a save', saved.reason ?? '')
      await p.waitForFunction(() => {
        const btn = document.getElementById('btn-save-deal')
        return !!btn && btn.disabled
      }, { timeout: 20000 }).catch(() => {})

      const rev = must(await db.from('record_revisions').select('revision_number, payload')
        .eq('record_id', opp.oppId).order('revision_number', { ascending: false }).limit(1), 'revision')
      const stored = rev[0]?.payload ?? {}
      console.log(`\n  read back, revision ${rev[0]?.revision_number}:`)
      console.log(`    hostingPriceMode = ${JSON.stringify(stored.hostingPriceMode)}`)
      console.log(`    hostingUnitFees  = ${JSON.stringify(stored.hostingUnitFees)}`)
      check(stored.hostingPriceMode === 'perUnit',
        'R-O7 THE DATABASE holds the override mode, not only the screen',
        JSON.stringify(stored.hostingPriceMode))
      check(Number(stored.hostingUnitFees?.hoSs) === Number(FEE),
        'R-O7 and the fee itself, under its own type key',
        JSON.stringify(stored.hostingUnitFees))
      check(stored.hostingUnitFees && !('hoAqm' in stored.hostingUnitFees),
        'R-O7 and a type nobody priced is ABSENT rather than zero',
        JSON.stringify(Object.keys(stored.hostingUnitFees ?? {})))
    }
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
