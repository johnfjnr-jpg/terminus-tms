// R-O2: THE NOTES HEADER COLLAPSES TO ONE LINE WHERE IT FITS, AND THE
// BEYOND-TWO-NOTES BEHAVIOUR IS GUARDED ON ALL THREE SURFACES.
//
// TWO CLAIMS, AND THE SECOND IS THE ONE THAT TRAVELS. The collapse is a
// per-surface question the ruling says to settle BY MEASUREMENT, so this
// reports the distinct tops rather than asserting a shape it has assumed. The
// range buttons appearing only beyond two notes is a behaviour the shared
// panel owes every caller, so that IS asserted, everywhere it renders.
//
// THE ROW TEST IS AN OVERLAP, not a count of children and not equal tops. A
// count cannot see a wrap: four elements present and one on the next line
// reads exactly like four on one line. Equal tops cannot see a line either,
// once the items on it have different heights - the first version of this
// probe reported WRAPPED on a header that is plainly one line, because a 18px
// title and a 23px button group centred in a 30px row do not share a `top`.
//
// AND ONE LINE IS NOT THE CLAIM ON ITS OWN. A row can be one line by running
// OUT OF ITS CARD, which is A1's recorded defect and what this probe found:
// 34px of spill at 1240, with ADD NOTE clipped against the follow-up card in
// the screenshot while `elementFromPoint` at the button's CENTRE still
// returned the button. Containment is therefore asserted at both widths and
// the hit test is taken at the edge that was clipped.
//
// FIXTURES PER CLAIM. A record with two notes and a record with three are two
// states of one thing, and a probe that qualifies one and reuses it for the
// other measures whatever the first claim left behind.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk4/probe-notes-header.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, freshContact, freshTestBed, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk4/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w4notes'
const db = admin()
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data }

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

// The notes are written straight onto the latest revision: the SHAPE is what
// is under test, and how the rows got there is not part of the claim.
const seedNotes = async (recordId, n) => {
  const rev = must(await db.from('record_revisions').select('revision_number, payload')
    .eq('record_id', recordId).order('revision_number', { ascending: false }).limit(1), 'rev')
  const payload = { ...(rev[0]?.payload ?? {}) }
  payload.notes = Array.from({ length: n }, (_, i) => ({
    text: `seeded note ${n - i}`, at: new Date(Date.now() - i * 60000).toISOString(), by: 'probe',
  }))
  must(await db.from('record_revisions').update({ payload })
    .eq('record_id', recordId).eq('revision_number', rev[0].revision_number), 'seed notes')
}

const opp2 = await freshOpportunity(TAG); await seedNotes(opp2.oppId, 2)
const opp5 = await freshOpportunity(TAG); await seedNotes(opp5.oppId, 5)
const contact = await freshContact(TAG);  await seedNotes(contact.contactId ?? contact.id, 5)
const bed = await freshTestBed(TAG);      await seedNotes(bed.bedId, 5)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const openAt = async (p, view, id) => {
    await p.evaluate((v, i) => navigate(v, i), view, id)
    await p.waitForFunction(() => {
      const v = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
      return !!v && !v.classList.contains('is-loading') && !!document.querySelector('[data-testid="cd-notes"], [data-testid="opp-card-notes"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }

  // SCOPED TO ONE CARD. The leads list renders a notes card PER LEAD, so a
  // query across the visible view answers for whichever card is first in the
  // document rather than for the one under test. Verification 25's too-wide
  // population, which returns a plausible number belonging to somebody else.
  const readHeader = (p, scopeSel = null) => p.evaluate((sel) => {
    const view = [...document.querySelectorAll('[id^="view-"]')].find((x) => !x.classList.contains('hidden'))
    const scope = sel ? view?.querySelector(sel) : view
    const card = scope?.querySelector('[data-testid="cd-notes"]')
    if (!card) return { present: false }
    const r = (e) => e.getBoundingClientRect()
    const head = card.querySelector('[data-testid="cd-notes-header-row"]')
    const parts = [...(head?.children ?? [])].filter((e) => r(e).width > 0)
    const rungs = card.querySelector('[data-testid="cd-notes-expand"]')
    // ── ONE LINE IS AN OVERLAP, NOT AN EQUAL TOP ───────────────────────
    //
    // The first version compared rounded `top` values and reported WRAPPED on
    // a header that is plainly one line: the title is 18px tall and the action
    // group 23px, both vertically centred in a 30px row, so their tops differ
    // by three pixels and neither is below the other.
    //
    // Equal tops is the right test for cells of one height, which is what
    // CLAUDE.md's stats-grid clause was about. For items of DIFFERENT heights
    // on one line the claim is that their vertical spans overlap: the lowest
    // top sits above the highest bottom.
    const tops = parts.map((e) => r(e).top)
    const bottoms = parts.map((e) => r(e).bottom)
    return {
      present: true,
      width: Math.round(r(card).width),
      headHeight: Math.round(r(head).height),
      oneLine: parts.length > 0 && Math.max(...tops) < Math.min(...bottoms),
      span: parts.length ? `${Math.round(Math.min(...tops))}..${Math.round(Math.max(...bottoms))}` : '-',
      partCount: parts.length,
      // Would "Latest first" fit beside what is already there? A1 drops it
      // when the rungs appear, and this reports whether that is still needed
      // rather than assuming it.
      usedWidth: parts.reduce((s, e) => s + r(e).width, 0),
      partList: parts.map((e) => `${e.className || e.tagName.toLowerCase()}@${Math.round(r(e).top)} ${Math.round(r(e).width)}px "${(e.textContent || '').trim().slice(0, 28)}"`),
      // ── ONE LINE IS NOT THE WHOLE CLAIM; IT MUST FIT THE CARD ──────────
      //
      // A row can report one line by OVERFLOWING its container, which is the
      // failure a sum of part widths against the card's border box cannot see.
      // The honest measure is the relationship CLAUDE.md asks for: the last
      // part's right edge against the card's own CONTENT edge, padding removed.
      // A1's OWN MEASURE, re-run rather than restated. Its recorded evidence
      // for the header overrunning its column was `elementFromPoint` over Add
      // note returning the FOLLOW-UP card's title. Overflow in pixels says the
      // row is too wide; this says whether a person can still press the button,
      // which is the thing that was actually wrong.
      addNoteHit: (() => {
        const b = card.querySelector('[data-testid="cd-add-note-btn"]')
          || card.querySelector('[data-testid="cd-notes-add"]')
        if (!b) return 'no Add note control found'
        const bb = r(b)
        // AT THE RIGHT EDGE, not the centre. The centre of a clipped button is
        // still exposed, so a centre hit reports the button while the far side
        // of it sits under the next card. A1's own wording is "clipped at the
        // column edge", and the edge is where the measure has to be taken.
        const y = bb.top + bb.height / 2
        const at = (x) => {
          const el = document.elementFromPoint(x, y)
          if (!el) return 'nothing'
          return (b.contains(el) || el === b)
            ? 'button' : `OTHER(${el.getAttribute('data-testid') || el.className || el.tagName})`
        }
        return `centre=${at(bb.left + bb.width / 2)} rightEdge=${at(bb.right - 2)}`
      })(),
      overflowPx: (() => {
        if (!parts.length) return 0
        const cs = getComputedStyle(card)
        const contentRight = r(card).right - parseFloat(cs.paddingRight || '0')
        return Math.round(Math.max(...parts.map((e) => r(e).right)) - contentRight)
      })(),
      rungsPresent: !!rungs,
      rungIds: rungs ? [...rungs.children].map((c) => c.getAttribute('data-testid')) : [],
    }
  }, scopeSel)

  for (const width of [1440, 1240]) {
    const p = await b.newPage()
    await p.setViewport({ width, height: 1100 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    console.log(`\n=== ${width}px ===`)

    // THE LEAD CARD IS MEASURED BECAUSE THE RULING NAMES IT. R-O2: "the lead
    // card's recorded exception stands unless remeasurement shows the collapsed
    // line fits there now". It is the OTHER `Panel` consumer, it is where A1
    // was measured, and it is on a list rather than a detail view.
    const leadId = contact.contactId ?? contact.id
    for (const [label, view, id, scope] of [
      ['opportunity', 'opportunity-detail', opp5.oppId, null],
      ['contact', 'contact-detail', leadId, null],
      ['test bed', 'test-bed-detail', bed.bedId, null],
      ['lead card', 'leads', null, `[data-testid="lead-card-${leadId}"]`],
    ]) {
      if (view === 'leads') {
        await p.evaluate(() => navigate('leads'))
        await p.waitForFunction((s) => !!document.querySelector(`${s} [data-testid="cd-notes"]`),
          { timeout: 25000 }, scope).catch(() => {})
        await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      } else {
        await openAt(p, view, id)
      }
      const h = await readHeader(p, scope)
      if (!h.present) { console.log(`  ${label.padEnd(12)} no notes card on this surface`); continue }
      console.log(`  ${label.padEnd(12)} card ${String(h.width).padStart(4)}px  parts ${h.partCount}  row ${h.headHeight}px  span ${h.span}  ${h.oneLine ? 'ONE LINE' : 'WRAPPED'}`)
      // R-O2's own words: collapsed to one line WHERE MEASURED TO FIT. The
      // measurement is reported per surface and per width rather than asserted
      // into a shape, because whether it fits is what the ruling defers to.
      const SECONDARY = 89   // "Latest first" at this font, measured in Phase 0
      console.log(`      used ${Math.round(h.usedWidth)}px of ${h.width}px; adding "Latest first" would need ${Math.round(h.usedWidth) + SECONDARY + 10}px -> ${Math.round(h.usedWidth) + SECONDARY + 10 <= h.width ? 'WOULD FIT' : 'would NOT fit, so A1 stands'}`)
      for (const p of h.partList) console.log(`        part ${p}`)
      console.log(`      overflow past the card's content edge: ${h.overflowPx}px  ${h.overflowPx > 1 ? '<-- SPILLING' : 'contained'}`)
      console.log(`      A1's measure, what is under Add note: ${h.addNoteHit}`)
      // ASSERTED, not merely printed. Whether the row takes one line or two is
      // a per-width measurement the ruling defers to; staying inside the card
      // is a requirement at every width.
      check(h.overflowPx <= 1,
        `R-O2 the notes header stays inside its card on the ${label} at ${width}`,
        `overflow ${h.overflowPx}px`)
      check(h.addNoteHit === 'centre=button rightEdge=button',
        `R-O2 and Add note is not clipped by its neighbour on the ${label} at ${width}`,
        h.addNoteHit)
      // THE BEHAVIOUR CLAIM, asserted on every surface: beyond two notes the
      // range buttons are there.
      check(h.rungsPresent && h.rungIds.length === 3,
        `R-O2 beyond two notes the range buttons render on the ${label}`,
        `${h.rungIds.length} rungs: ${JSON.stringify(h.rungIds)}`)
    }

    // AND THE OTHER HALF OF THE BEHAVIOUR: at two notes there are none. A
    // separate fixture, because the five-note record cannot also be the
    // two-note one.
    await openAt(p, 'opportunity-detail', opp2.oppId)
    const two = await readHeader(p)
    check(two.present && !two.rungsPresent,
      'R-O2 and at exactly two notes the range buttons do NOT render',
      `rungs present: ${two.rungsPresent}`)

    await openAt(p, 'opportunity-detail', opp5.oppId)
    await p.screenshot({ path: `${OUT}o2-notes-${width}.png` })
    console.log(`  captured o2-notes-${width}.png`)
    await p.close()
  }
} finally { await b.close(); await tearDown(TAG) }

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
