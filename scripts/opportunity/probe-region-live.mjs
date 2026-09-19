// THE REGION, PROVEN LIVE: R2 (the title), R6 (the headline row) and part A
// (the record band) at 1440 and 1240.
//
// EVERY MEASUREMENT PRECEDES EVERY CAPTURE, and the captures are of the PAGE.
// `.is-loading > *` is `visibility: hidden`, which PRESERVES LAYOUT, so a wait
// on rendered text or on a bounding box is satisfied while the view is still
// covered. The class is the only honest signal. This cost three runs of
// screenshots reading "Loading the record..." under green assertions.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('opportunity/probe-region-live.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, tearDown, admin } from '../fixtures.mjs'

const TAG = 'opp-region'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/opp-region/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const RECORDS = process.argv.slice(2)
if (RECORDS.length < 2) { console.error('give at least two opportunity ids'); process.exit(2) }

const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const b = await puppeteer.launch({ headless: 'new' })
try {
  for (const width of [1440, 1240]) {
    for (const id of RECORDS) {
      const p = await b.newPage()
      const errors = []
      p.on('pageerror', (e) => errors.push(String(e).slice(0, 120)))
      await p.setViewport({ width, height: 1100 })
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
      await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
      await p.reload({ waitUntil: 'networkidle0' })
      await p.evaluate((r) => navigate('opportunity-detail', r), id)
      // ── THE WAIT MUST NOT DEPEND ON THE THING UNDER TEST ────────────────
      //
      // This waited on the BAND being present, and a calibration injection
      // that stopped the band rendering therefore killed the probe AT THE
      // WAIT, twenty lines before the assertion about the band. The run went
      // red and the harness scored it, correctly, as red on NO named
      // assertion: the check the injection was written for had never been
      // reached, in that run or any other.
      //
      // So readiness is now the tab row, which is static markup the record
      // load does not create, plus the loading class, which is the only
      // honest signal that the record has arrived. Both are true whether or
      // not the band renders, so the band's absence becomes a FAILED CHECK
      // rather than a dead probe.
      await p.waitForFunction(() => {
        const v = document.getElementById('view-opportunity-detail')
        const company = document.getElementById('detail-company')
        return !!v && !v.classList.contains('is-loading')
          && !!company && (company.textContent ?? '').trim().length > 0
      }, { timeout: 25000 })

      const m = await p.evaluate(() => {
        const q = (s) => document.querySelector(s)
        const h1 = document.getElementById('ref-display-name')
        const band = q('[data-testid="opp-top-row"]')
        const strip = document.getElementById('opp-headline')
        const tabs = document.getElementById('opp-detail-tabs')
        const chev = document.getElementById('opp-chevron-wrap')
        const cells = [...strip.children]
        const rect = (e) => e ? e.getBoundingClientRect() : null
        return {
          title: (h1?.textContent ?? '').trim(),
          titleBox: h1 ? Math.round(rect(h1).height) : -1,
          stripRows: [...new Set(cells.map((c) => Math.round(rect(c).top)))].length,
          stripCells: cells.length,
          stripH: Math.round(rect(strip).height),
          // NULL-SAFE, so a missing band is a FAILED CHECK rather than a
          // TypeError inside evaluate that kills the run before any check.
          bandPresent: !!band,
          bandTop: band ? Math.round(rect(band).top + window.scrollY) : -1,
          chevBottom: Math.round(rect(chev).bottom + window.scrollY),
          tabsTop: Math.round(rect(tabs).top + window.scrollY),
          // SCOPED TO THE BAND. `cd-card-followup` is the Contact's own testid
          // and the Contact view is resident in this document, so a
          // document-wide lookup answered `true` for it even in a calibration
          // run where the band did not render at all. The verdict was right
          // because `bandPresent` gates it, and the DETAIL LINE was a lie.
          cards: {
            summary: !!band?.querySelector('[data-testid="opp-card-summary"]'),
            notes: !!band?.querySelector('[data-testid="opp-card-notes"]'),
            followUp: !!band?.querySelector('[data-testid="cd-card-followup"]'),
          },
          // A MOVE IS TWO CLAIMS: it arrived here AND it is gone from there.
          //
          // SCOPED TO THIS RECORD'S VIEW, and not to the document. The first
          // version counted `document.querySelectorAll` and read FOUR, which
          // looked like a duplicate and was not: this app keeps every screen
          // resident, so the Contact and Test Bed views each contributed one
          // from their own hidden subtree. A document-wide selector answers
          // for whatever is in the DOM rather than for the thing under test,
          // and it cannot read as empty - it returns a plausible wrong number.
          //
          // The retired `#ref-vanilla` block is excluded by name because it is
          // markup that renders nothing and is already carried as its own
          // item; counting it here would make this assertion fail for a reason
          // that has nothing to do with the move.
          summaryRowsOnThisSurface: [...document.querySelectorAll(
            '#view-opportunity-detail [data-key="summary"]')]
            .filter((e) => !e.closest('#ref-vanilla')).length,
          summaryRowIsInBand: !!document.querySelector(
            '[data-testid="opp-top-row"] [data-key="summary"]'),
          deadButtons: ['ref-save-all', 'ref-cancel-all', 'ref-edit-name', 'ref-input-name']
            .filter((x) => document.getElementById(x)),
          // NOTE ENTRIES, not note CONTROLS. The first selector was
          // `[data-testid^="cd-note"]`, which also matches `cd-notes-list-*`,
          // `cd-notes-show-*` and `cd-add-note-btn`, so it read non-zero on a
          // record carrying no notes at all and the gate below never fired.
          // The trailing hyphen is the whole fix: entries are `cd-note-0`,
          // `cd-note-1`, and the container is `cd-notes-list-<id>`.
          noteRows: q('[data-testid="opp-card-notes"]')
            ?.querySelectorAll('[data-testid^="cd-note-"]').length ?? 0,
          // ── THE DOOR, ON A SURFACE THAT JUST GAINED WRITE CONTROLS ──────
          // The band is PORTALLED, so it is a child of the React tree and a
          // child of vanilla markup in the DOM. Whether the read-only door
          // reaches it is a question about the DOM, and the answer was not
          // obvious enough to assume.
          notMine: !!document.getElementById('view-opportunity-detail')
            ?.classList.contains('is-not-mine'),
          // ── SCOPED TO THE BAND, NEVER document.getElementById ───────────
          //
          // The first version of these three checks used getElementById and
          // failed four ways, all of them the probe. This app keeps EVERY
          // screen resident, so `cd-followUpDate` exists on the Contact view
          // too and `input-summary` exists inside the retired `#ref-vanilla`
          // block. getElementById returns the FIRST in document order, which
          // was somebody else's element every time - and it reported an OWNED
          // record's live controls as disabled, which reads as a product
          // defect rather than as a selector fault.
          //
          // The estate has this written down twice: once as "a probe about a
          // THING scopes its selector to that thing's own element", and once
          // in ReferencePanel's own comment about two elements sharing an id.
          // Matching on id OR data-testid because these components carry both.
          writeControls: ['input-summary', 'cd-add-note-btn', 'cd-followUpDate',
            'cd-followUpDescription', 'cd-followup-save']
            .map((id) => {
              const e = band?.querySelector(`#${id}, [data-testid="${id}"]`)
              return { id, present: !!e, disabled: !!e?.disabled }
            }),
          // A DOOR MUST NEVER KILL THE WAY OUT. These only READ.
          readAffordances: ['cd-notes-show-10', 'cd-notes-show-all']
            .map((id) => {
              const e = band?.querySelector(`#${id}, [data-testid="${id}"]`)
              return { id, present: !!e, disabled: !!e?.disabled }
            }),
        }
      })

      console.log(`\n=== ${width}px  record ${id.slice(0, 8)} ===`)
      check(m.title.length > 0 && m.title !== '--', 'R2 the record TITLE renders', JSON.stringify(m.title))
      check(m.titleBox > 20, 'R2 and it is a real heading rather than a 4px sliver', `${m.titleBox}px tall`)
      check(m.stripRows === 1, 'R6 the six headline figures share ONE row',
        `${m.stripCells} cells, ${m.stripRows} row(s), strip ${m.stripH}px`)
      check(m.bandPresent && m.cards.summary && m.cards.notes && m.cards.followUp,
        'part A all three band cards render',
        `band=${m.bandPresent} ${JSON.stringify(m.cards)}`)
      check(m.bandTop >= m.chevBottom && m.bandTop < m.tabsTop,
        'part A the band sits BELOW the chevron and ABOVE the tabs',
        `chevron ends ${m.chevBottom}, band ${m.bandTop}, tabs ${m.tabsTop}`)
      check(m.summaryRowsOnThisSurface === 1 && m.summaryRowIsInBand,
        'part A exactly ONE summary row on this surface, and it is in the BAND, so it MOVED rather than duplicating',
        `${m.summaryRowsOnThisSurface} on the surface, inBand=${m.summaryRowIsInBand}`)
      check(m.deadButtons.length === 0, 'R2 the dead save bar and name editor are gone',
        m.deadButtons.length ? m.deadButtons.join(', ') : 'none present')
      check(errors.length === 0, 'no page errors on this record', errors.join(' | ') || 'none')

      // THE DOOR, BOTH DIRECTIONS. These records belong to another user, so
      // every write control the band added must be dead and every read
      // affordance must survive. The OWNED case is proven at the end of the
      // run on a fixture, because an assertion that controls are disabled
      // passes just as well on a surface that never enables them.
      const present = m.writeControls.filter((c) => c.present)
      check(present.length === m.writeControls.length,
        'the band renders all five write controls, so the door claim is not vacuous',
        `${present.length}/${m.writeControls.length}`)
      if (m.notMine) {
        check(present.every((c) => c.disabled),
          'the DOOR reaches the portalled band: every write control is neutralised on an unowned record',
          JSON.stringify(m.writeControls.filter((c) => !c.disabled).map((c) => c.id)))
        // THE RANGE BUTTONS ONLY EXIST WHEN THERE ARE NOTES TO RANGE OVER,
        // which is correct and which the first version of this check did not
        // allow for: it demanded them on a record carrying none and failed
        // for a reason that had nothing to do with the door. A wait or an
        // assertion that can never be satisfied because the product correctly
        // moved on reads exactly like a defect.
        //
        // So the claim is gated on the card HAVING notes, and the gate itself
        // is asserted, because an assertion inside `if (something.length)` is
        // a silent skip wearing a pass.
        if (m.noteRows > 0) {
          check(m.readAffordances.every((c) => c.present && !c.disabled),
            'and the door leaves the WAY TO READ intact, so an unowned record stays readable',
            JSON.stringify(m.readAffordances))
        } else {
          check(m.cards.notes, 'the notes card renders its empty state, so there is nothing to range over',
            `${m.noteRows} note rows`)
        }
      }

      await p.screenshot({ path: `${OUT}region-${width}-${id.slice(0, 8)}.png` })
      console.log(`  captured region-${width}-${id.slice(0, 8)}.png`)
      await p.close()
    }
  }
  // ── THE OWNED CASE, WHICH IS WHAT GIVES THE DISABLED ONES MEANING ───────
  //
  // Every live opportunity in this estate belongs to another user, so a run
  // over real records can only ever see the door SHUT. A probe that has never
  // seen these controls enabled cannot tell a working door from a band that
  // renders dead controls for everybody.
  const owned = await freshOpportunity(TAG)
  try {
    const p = await b.newPage()
    await p.setViewport({ width: 1440, height: 1100 })
    await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
    await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((r) => navigate('opportunity-detail', r), owned.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return !!v && !v.classList.contains('is-loading') && !!document.querySelector('[data-testid="opp-top-row"]')
    }, { timeout: 25000 })
    const o = await p.evaluate(() => ({
      notMine: !!document.getElementById('view-opportunity-detail')?.classList.contains('is-not-mine'),
      live: ['input-summary', 'cd-add-note-btn', 'cd-followUpDate', 'cd-followUpDescription']
        .map((id) => {
          const band = document.querySelector('[data-testid="opp-top-row"]')
          const e = band?.querySelector(`#${id}, [data-testid="${id}"]`)
          return { id, present: !!e, disabled: !!e?.disabled }
        }),
    }))
    console.log(`\n=== 1440px  OWNED fixture ${owned.oppId.slice(0, 8)} ===`)
    check(!o.notMine, 'the fixture is owned by this user, so the door should be OPEN', `is-not-mine=${o.notMine}`)
    check(o.live.every((c) => c.present && !c.disabled),
      'and the same band controls are LIVE, so "disabled" above was the door and not the band',
      JSON.stringify(o.live.filter((c) => c.disabled).map((c) => c.id)))
    await p.screenshot({ path: `${OUT}region-1440-owned.png` })
    console.log('  captured region-1440-owned.png')

    // ── AND THE BAND ACTUALLY WRITES, READ BACK FROM THE DATABASE ────────
    //
    // The band is a new CALLER of an existing route. Rendering it correctly
    // and neutralising it correctly are both true of a band that saves
    // nothing, so the last claim is that a person using it changes the record.
    //
    // REAL KEYBOARD EVENTS, never a synthetic `.value` write: React's
    // per-input value tracker dedupes an assignment once the component has
    // persisted, so the DOM would show the text while the component's state
    // never received it, and the card would correctly refuse to save.
    const band = '[data-testid="opp-top-row"]'
    const NOTE = `band write proof ${Date.now()}`
    // THE NOTE BOX BY ITS OWN NAME. The first version typed into
    // `${band} textarea`, which matches the SUMMARY textarea first, because
    // the band holds two. The note went into the summary draft, nothing was
    // saved, and the failure read as "the band does not write" rather than as
    // "the probe typed somewhere else". `cd-add-note-btn` is BOTH the opener
    // and the save, so it is clicked twice on purpose.
    await p.click(`${band} [data-testid="cd-add-note-btn"]`)
    await p.waitForSelector(`${band} [data-testid="cd-new-note-input"]`, { timeout: 8000 })
    await p.type(`${band} [data-testid="cd-new-note-input"]`, NOTE)
    await p.click(`${band} [data-testid="cd-note-input-wrap"] [data-testid="cd-add-note-btn"]`)
    // ONE INTERACTION, THEN YIELD, THEN ASSERT. A synchronous read after a
    // synchronous dispatch measures the previous frame.
    await p.waitForFunction((sel, text) => {
      const c = document.querySelector(sel)
      return !!c && (c.textContent ?? '').includes(text)
    }, { timeout: 12000 }, band, NOTE).catch(() => {})

    // THE FIELD IS dd/mm/yyyy, which the first run got wrong: `12/01/2026` was
    // typed meaning 1 December and stored, correctly, as 12 January. The
    // product was right and the EXPECTATION was wrong, which is the good half
    // of a hand-typed constant being caught.
    const FU_DESC = `band follow-up ${Date.now()}`
    await p.type(`${band} [data-testid="cd-followUpDate"]`, '01/12/2026')
    await p.type(`${band} [data-testid="cd-followUpDescription"]`, FU_DESC)
    await p.click(`${band} [data-testid="cd-followup-save"]`)
    await new Promise((r) => setTimeout(r, 2500))

    // READ BACK FROM THE AUTHORITY, never from the screen that just claimed it.
    const db = admin()
    const rev = await db.from('record_revisions').select('revision_number, payload')
      .eq('record_id', owned.oppId).order('revision_number', { ascending: false }).limit(1)
    if (rev.error) throw new Error(`read back: ${rev.error.message}`)
    const pay = rev.data[0]?.payload ?? {}
    const savedNotes = Array.isArray(pay.notes) ? pay.notes : []
    check(savedNotes.some((n) => String(n?.text ?? '').includes(NOTE)),
      'part A a note typed into the BAND is in the database',
      `${savedNotes.length} notes on the record`)
    check(pay.followUpDescription === FU_DESC && pay.followUpDate === '2026-12-01',
      'part A the follow-up typed into the BAND is in the database',
      `date=${JSON.stringify(pay.followUpDate)} desc=${JSON.stringify(pay.followUpDescription)}`)
    await p.close()
  } finally { await tearDown(TAG) }
} finally { await b.close() }

const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
