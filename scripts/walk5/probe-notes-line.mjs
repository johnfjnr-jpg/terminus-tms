// R-W1: THE NOTES HEADER IS ONE LINE, AND IT FITS.
//
// The ruling is precise and so are the assertions: the full line fits INSIDE
// the card at 1440 AND 1240, with NO WRAP and NO CLIP, and the beyond-two-notes
// behaviour stays guarded on all three surfaces.
//
// THREE SEPARATE CLAIMS, ASSERTED SEPARATELY, because each fails differently:
//   - NO WRAP is a relationship between the parts: every one shares a line.
//   - NO CLIP is a relationship with the CARD: nothing crosses its content edge.
//   - FITS is neither of those on its own. A row can be one line by running out
//     of its card, which is what walk 4 found and fixed.
//
// AND THE HIT TEST IS TAKEN AT THE BUTTON'S RIGHT EDGE, because the centre of
// a clipped button is still exposed and reports the button.
//
// ARTEFACT NAMES ARE THIS PROBE'S OWN. Walk 4's notes probe writes
// `o2-notes-*.png`; a copy inheriting those names would overwrite the evidence
// for a finding that has already been fixed.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk5/probe-notes-line.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, freshContact, freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk5/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w5notes'
const db = admin()
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }
const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const seedNotes = async (recordId, n) => {
  const rev = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', recordId).order('revision_number', { ascending: false }).limit(1), 'rev')
  const payload = { ...(rev[0]?.payload ?? {}) }
  payload.notes = Array.from({ length: n }, (_, i) => ({
    text: `seeded note ${n - i}`, at: new Date(Date.now() - i * 60000).toISOString(), by: 'probe',
  }))
  must(await db.from('record_revisions').update({ payload })
    .eq('record_id', recordId).eq('revision_number', rev[0].revision_number), 'seed')
}

// A FIXTURE PER CLAIM. The two-note record proves the rungs are absent below
// the threshold; reusing the three-note one would measure whatever the first
// claim left behind.
const opp3 = await freshOpportunity(TAG); await seedNotes(opp3.oppId, 3)
const opp2 = await freshOpportunity(TAG); await seedNotes(opp2.oppId, 2)
const contact = await freshContact(TAG); await seedNotes(contact.contactId ?? contact.id, 5)
const bed = await freshTestBed(TAG); await seedNotes(bed.bedId, 5)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  const open = async (view, id) => {
    await p.evaluate((v, i) => navigate(v, i), view, id)
    await p.waitForFunction(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      return !!v && !v.classList.contains('is-loading')
        && !!document.querySelector('[data-testid="cd-notes"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  const read = (scopeSel) => p.evaluate((sel) => {
    const view = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
    const scope = sel ? document.querySelector(sel) : view
    const card = scope?.querySelector('[data-testid="cd-notes"]')
    if (!card) return { present: false }
    const r = (e) => e.getBoundingClientRect()
    const cs = getComputedStyle(card)
    const contentRight = r(card).right - parseFloat(cs.paddingRight || '0')
    const head = card.querySelector('[data-testid="cd-notes-header-row"]')
    // ── THE PARTS ARE THE LEAVES, NOT THE TOP-LEVEL CHILDREN ─────────────
    //
    // The first version read `head.children`, which on the Panel path is two
    // items: the title and `.panel-actions`. The wrap happens INSIDE
    // `.panel-actions` - the count on one line, the rungs and Add note on the
    // next - so the two top-level children still overlapped vertically and the
    // test reported ONE LINE on a header the screenshot plainly showed
    // wrapped. A container cannot report its own children wrapping.
    //
    // So the parts are every leaf that draws: the title, the count, each rung
    // and Add note, flattened. CLAUDE.md's stats-grid clause, one level down.
    const leaves = (e) => (e.children.length === 0 ? [e] : [...e.children].flatMap(leaves))
    const parts = [...(head?.children ?? [])].flatMap(leaves).filter((e) => r(e).width > 0)
    const rungs = card.querySelector('[data-testid="cd-notes-expand"]')
    const shown = card.querySelector('[data-testid="cd-notes-shown"]')
    const add = card.querySelector('[data-testid="cd-add-note-btn"]')
    const at = (x, y) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return 'nothing'
      return (add && (add.contains(el) || el === add)) ? 'button'
        : `OTHER(${el.getAttribute('data-testid') || el.className || el.tagName})`
    }
    const ab = add ? r(add) : null
    return {
      present: true,
      cardWidth: Math.round(r(card).width),
      headHeight: Math.round(r(head).height),
      partCount: parts.length,
      // NO WRAP, as an overlap: items of different heights on one line do not
      // share a `top`, so equal-tops is the wrong test here.
      // ── ONE LINE IS A SHARED CENTRE, NOT A BARE OVERLAP ────────────────
      //
      // The overlap test passed on a header the screenshot showed wrapped.
      // Measured: "2 of 5" spanned 466..487 and "Notes" 483..501 - two
      // different lines that TOUCH by four pixels, so every top was still
      // above every bottom. An overlap is satisfied by any two boxes that
      // graze each other.
      //
      // Items on one line are vertically centred on it, whatever their
      // heights, so their CENTRES agree. That is the claim, and it separates
      // the two states by 15px here where the overlap separated them by none.
      oneLine: parts.length > 0
        && (Math.max(...parts.map((e) => r(e).top + r(e).height / 2))
          - Math.min(...parts.map((e) => r(e).top + r(e).height / 2))) <= 4,
      centreSpread: parts.length
        ? Math.round(Math.max(...parts.map((e) => r(e).top + r(e).height / 2))
          - Math.min(...parts.map((e) => r(e).top + r(e).height / 2))) : 0,
      // NO CLIP, as a relationship with the card's own content edge.
      overflowPx: parts.length
        ? Math.round(Math.max(...parts.map((e) => r(e).right)) - contentRight) : 0,
      addHit: ab ? `centre=${at(ab.left + ab.width / 2, ab.top + ab.height / 2)} right=${at(ab.right - 2, ab.top + ab.height / 2)}` : 'no Add note',
      countOnLine: !!(shown && head && head.contains(shown)),
      countText: shown ? (shown.textContent ?? '').trim() : null,
      rungLabels: rungs ? [...rungs.children].map((c) => (c.textContent ?? '').trim()) : null,
      // R-W1 removes the secondary ESTATE-WIDE: neither the panel's own slot
      // nor the frozen path's `.label` may carry it.
      secondaryText: (head?.querySelector('.panel-secondary, .label')?.textContent ?? '').trim(),
      anyLatestFirst: /latest first/i.test(card.textContent ?? ''),
    }
  }, scopeSel)

  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1100 })
    await p.reload({ waitUntil: 'networkidle0' })
    console.log(`\n=== ${width}px ===`)

    for (const [label, view, id, scope] of [
      ['opportunity', 'opportunity-detail', opp3.oppId, '#opp-band-root'],
      ['contact', 'contact-detail', contact.contactId ?? contact.id, null],
      ['test bed', 'test-bed-detail', bed.bedId, null],
    ]) {
      await open(view, id)
      const h = await read(scope)
      if (!h.present) { check(false, `R-W1 the notes card renders on the ${label} at ${width}`); continue }
      console.log(`  ${label.padEnd(12)} card ${h.cardWidth}px  row ${h.headHeight}px  parts ${h.partCount}  count ${JSON.stringify(h.countText)}  rungs ${JSON.stringify(h.rungLabels)}`)

      check(h.oneLine,
        `R-W1 the header is ONE LINE on the ${label} at ${width}, no wrap`,
        `centres spread ${h.centreSpread}px, row ${h.headHeight}px`)
      check(h.overflowPx <= 1,
        `R-W1 and it is INSIDE the card on the ${label} at ${width}, no clip`,
        `overflow ${h.overflowPx}px`)
      check(h.addHit === 'centre=button right=button',
        `R-W1 and Add note is not clipped by its neighbour on the ${label} at ${width}`,
        h.addHit)
      check(h.countOnLine && h.countText === '2 of 3' || h.countOnLine && /^\d+ of \d+$/.test(h.countText ?? ''),
        `R-W1 the count is ON the header line on the ${label} at ${width}`,
        JSON.stringify(h.countText))
      check(!/^showing/i.test(h.countText ?? ''),
        `R-W1 and it does not say "Showing" on the ${label} at ${width}`)
      check(JSON.stringify(h.rungLabels) === JSON.stringify(['2', '10', 'All']),
        `R-W1 the rungs read 2 / 10 / All on the ${label} at ${width}`,
        JSON.stringify(h.rungLabels))
      check(h.secondaryText === '' && !h.anyLatestFirst,
        `R-W1 "Latest first" is GONE from the ${label} at ${width}`,
        JSON.stringify(h.secondaryText))
    }

    // The threshold, on its own fixture.
    await open('opportunity-detail', opp2.oppId)
    const two = await read('#opp-band-root')
    check(two.present && two.rungLabels === null,
      `R-W1 at exactly two notes the rungs do NOT render at ${width}`,
      `rungs ${JSON.stringify(two.rungLabels)}`)
    check(two.present && two.countText === null,
      `R-W1 and neither does the count, there being nothing behind the fold at ${width}`,
      JSON.stringify(two.countText))

    await open('opportunity-detail', opp3.oppId)
    await p.evaluate(() => {
      document.querySelector('#opp-band-root [data-testid="cd-notes"]')
        ?.scrollIntoView({ block: 'center' })
    })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await p.screenshot({ path: `${OUT}w1-notes-${width}.png` })
    console.log(`  captured w1-notes-${width}.png`)
  }
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
