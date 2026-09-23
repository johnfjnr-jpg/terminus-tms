// STEP 1: EVERY EDITABLE CONTROL THAT RENDERS EMPTY WHILE ITS VALUE EXISTS
//
// The defect class, not the instance. A control is SUSPECT when its box is
// empty and the value it represents is not - either stored on the record, or
// produced by the single derivation.
//
// ── THE LEGITIMATE CASE IS PRESERVED, AND IT IS THE HARD HALF ───────────
//
// A genuinely unset optional field showing "not recorded" is CORRECT. So an
// empty box alone is not a finding; it is a finding only when something
// non-empty answers for that control. Two sources of that answer are used,
// and neither is the box itself:
//
//   - FIELD-ROW SURFACES have a display half and an edit half for one value.
//     A non-empty display beside an empty editor is the defect, measured
//     entirely in the DOM.
//   - THE DEAL DRAWERS have no display half any more, so the answer comes
//     from the CALCULATOR, run here on the record's own payload and catalog -
//     the same two calls `useDealForm` makes.
//
// ── WHY THIS DRIVES FIXTURES AND NOT THE BUSINESS'S OWN RECORDS ─────────
//
// The first version picked the most-populated record of each type and read
// ZERO editable controls on every surface at both widths. That is a null
// reading, so it was calibrated (Verification 13), and the funnel said:
//
//     all controls 185   enabled 47   visible 5   both 0
//
// The five visible controls were all read-only and the 47 enabled ones all
// belonged to OTHER views. The page itself said why, in a banner the scan
// never read: READ ONLY, ANOTHER USER'S RECORD.
//
// The session user owns NOTHING - 0 of 18 opportunities, 0 of 17 contacts,
// 0 of 11 test beds - so the ownership door correctly neutralised every write
// control on every detail surface. A census of editable controls run against
// records the session cannot edit measures the door, not the defect.
//
// So the records are CREATED the way the system creates them and then
// populated, which is Verification 47, and the effective figures are derived
// from that same payload.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('dealsheet3/census-blank-controls.mjs')
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { freshOpportunity, freshContact, freshTestBed, tearDown } from '../fixtures.mjs'
import { api } from '../api-client.mjs'
import { catalogToRates } from '../../src/lib/base-costs.js'
import { resolveRates } from '../../src/lib/rate-resolution.js'
import { buildDealInputs } from '../../src/lib/deal-inputs.js'
import { calculateDeal } from '../../src/lib/deal-calculator.js'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/dealsheet3/`
mkdirSync(OUT, { recursive: true })
const TAG = process.env.C_TAG ?? 'ds3census'
// ── CALIBRATION OF THE DISPLAY-HALF BRANCH ────────────────────────────────
//
// The derivation branch proved itself by firing 22 times. The display-half
// branch reached 110 field-row editors and reported nothing, and "reached
// nothing wrong" and "cannot report anything" read identically (Verification
// 13). Under C_CALIBRATE=1 the FIRST populated row of each surface has its
// editor blanked in the DOM after opening, which is precisely the state the
// branch claims to detect. It must then fire, and the healthy run must not.
const CALIBRATE = process.env.C_CALIBRATE === '1'
let injected = 0
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))

// A PAYLOAD THAT LEAVES NOTHING LEGITIMATELY BLANK ON THE DEAL SURFACE.
// Every priced line is populated, so a blank drawer box has no innocent
// explanation available to it.
const DEAL = {
  ssExisting: 20, ssNew: 12, aqm: 4, hemir: 3, duration: 60,
  targetMargin: 30, warrantyPct: 2, recoveryMonths: 24,
  installResp: 'Terminus Contractor - Lump Sum', lumpSumCost: 200000,
  whtPct: 15, gstPct: 9, grossUp: true,
  factoring: { enabled: true, ratePct: 1.2, termMonths: 6, method: 'straight' },
}

let fx, ct, tb
const findings = []
const surfaces = []
// THE FIELD-ROW PASS IS ITSELF CALIBRATED BY THIS COUNTER. If no row ever
// opened, every "0 blank" on a field-row surface is a null reading rather
// than a clean one, and the census says so at the end instead of reporting it.
let rowsOpened = 0
const b = await puppeteer.launch({ headless: 'new' })
try {
  fx = await freshOpportunity(TAG)
  await api('PATCH', `/opportunities/${fx.oppId}`, { payload: DEAL })
  ct = await freshContact(TAG)
  tb = await freshTestBed(TAG)
  console.log(`opportunity ${fx.oppId}\ncontact ${ct.contactId}\ntest bed ${tb.bedId}`)

  // THE EFFECTIVE FIGURES, from the single derivation the form itself uses.
  const catalog = await api('GET', '/base-costs')
  const { rates } = catalogToRates(catalog.data?.products ?? [])
  const resolved = resolveRates(DEAL, rates)
  const result = calculateDeal(buildDealInputs(DEAL, { testBedCost: 0, rates: resolved.rates }))
  const effective = {}
  for (const g of ['hardwareGroup', 'installGroup', 'hostingGroup']) {
    for (const row of result.groups[g]?.rows ?? []) {
      if (row.impliedMarginPct !== null && row.impliedMarginPct !== undefined) {
        effective[`deal-margin-${row.key}`] = row.impliedMarginPct.toFixed(1)
      }
      if (row.rawPrice) {
        effective[`deal-price-${row.key}`] = String(row.rawPrice)
        effective[`deal-hofee-${row.key}`] = String(row.rawPrice)
      }
    }
  }
  console.log(`${Object.keys(effective).length} derived figures available to answer for a blank box`)

  // ── THE THIRD SOURCE OF TRUTH: THE RECORD ITSELF ──────────────────────
  //
  // The derivation answers for the deal drawers and the display half answers
  // for field rows. Neither reaches a control that is neither - the contact
  // surface alone carries 16 directly-editable controls - so a box blank
  // beside a STORED value would have been invisible to both.
  //
  // The id is reduced to a payload key by stripping surface prefixes, and only
  // an EXACT hit counts: a guess that matched loosely would manufacture
  // findings rather than find them.
  const payloadOf = (payload) => (testid) => {
    if (!testid) return undefined
    const parts = testid.split('-')
    for (let i = 0; i < parts.length; i += 1) {
      const key = parts.slice(i).join('-')
      const v = payload?.[key]
      if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') return String(v)
    }
    return undefined
  }

  const SCAN = (viewId) => {
    const root = document.querySelector(viewId)
    if (!root) return { error: `no ${viewId}` }
    const all = [...root.querySelectorAll('input, select, textarea')]
    const out = []
    for (const e of all) {
      if (e.type === 'hidden') continue
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
      const locked = !!(e.disabled || e.readOnly)
      const row = e.closest('.field-row, .ref-field, .deal-field, .terms-field-row, tr')
      const display = row
        ? (row.querySelector('.field-row-display, .ref-field-display, .stmt-display')?.textContent ?? '').trim()
        : ''
      out.push({
        testid: e.getAttribute('data-testid') || e.id || '',
        tag: e.tagName.toLowerCase(), locked,
        value: (e.value ?? '').trim(),
        placeholder: e.getAttribute('placeholder') ?? '',
        label: (e.closest('label')?.textContent
          || (e.id && root.querySelector(`label[for="${CSS.escape(e.id)}"]`)?.textContent)
          || '').trim().slice(0, 40),
        display,
      })
    }
    return { all: all.length, out }
  }

  // THE ROUTE IS READ, NOT GUESSED: `api` answers `{ status, ok, data }` and
  // the list routes answer an array of records carrying `payload`. Asking for
  // `r.payload` on the wrapper would have returned undefined and reported a
  // confident zero (Verification 47).
  const payloadFor = async (path, id) => {
    const r = await api('GET', path)
    const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : [])
    const hit = list.find((x) => x.id === id)
    if (!hit) throw new Error(`${path}: ${id} not in the ${list.length}-row answer`)
    return hit.payload ?? {}
  }
  const contactPayload = await payloadFor('/contacts', ct.contactId)
  const bedPayload = await payloadFor('/test-beds', tb.bedId)
  console.log(`record keys available to answer: contact ${Object.keys(contactPayload).length}, `
    + `test bed ${Object.keys(bedPayload).length}, opportunity ${Object.keys(DEAL).length}`)
  const stored = {
    'opportunity commercials': payloadOf(DEAL),
    'opportunity reference': payloadOf(DEAL),
    'contact detail': payloadOf(contactPayload),
    'test bed reference': payloadOf(bedPayload),
    'test bed commercials': payloadOf(bedPayload),
  }

  const VIEWS = [
    // "Commercials" IS THE PANEL TAB. The opportunity view also carries an
    // approval-TRACK strip whose first tab is "Commercial", and clicking that
    // leaves the Reference panel showing while reporting a tab was found - the
    // census then read 7 editable controls on both tabs and called it clean.
    ['opportunity commercials', '#view-opportunity-detail', `navigate("opportunity-detail","${fx.oppId}")`, 'Commercials'],
    ['opportunity reference', '#view-opportunity-detail', `navigate("opportunity-detail","${fx.oppId}")`, 'Reference'],
    ['contact detail', '#view-contact-detail', `navigate("contact-detail","${ct.contactId}")`, null],
    ['test bed reference', '#view-test-bed-detail', `navigate("test-bed-detail","${tb.bedId}")`, 'Reference'],
    ['test bed commercials', '#view-test-bed-detail', `navigate("test-bed-detail","${tb.bedId}")`, 'Commercials'],
  ]

  const p = await b.newPage()
  p.on('pageerror', (e) => console.log(`  PAGEERROR ${String(e).slice(0, 140)}`))
  await p.evaluateOnNewDocument((k, v) => { localStorage.setItem(k, v) },
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    console.log(`\n══════ ${width} ══════`)
    for (const [name, viewId, go, tab] of VIEWS) {
      await p.setViewport({ width, height: 1200 })
      await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
      await p.evaluate((src) => { (0, eval)(src) }, go)
      await p.waitForFunction(() => !document.querySelector('.wrap.is-loading'), { timeout: 40000 })
      await p.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
      // THE TAB CLICK IS SCOPED TO THE VISIBLE VIEW. Both detail views carry a
      // tab named "Reference" and both are in the DOM at once, so a
      // document-wide find returns the wrong strip (Verification 25).
      if (tab) {
        await p.evaluate((v, t) => {
          const el = [...document.querySelectorAll(`${v} .detail-tab`)]
            .find((x) => x.textContent.trim() === t)
          el?.click()
        }, viewId, tab)
        await p.evaluate(() => new Promise((r) => setTimeout(r, 1500)))
      }
      // THE DRAWERS OPEN, or the statement's editors are not in the DOM to be
      // censused. Expand all is a TOGGLE, so its label is read first.
      if (name === 'opportunity commercials') {
        await p.evaluate(() => {
          const t = document.querySelector('[data-testid="btn-toggle-detail"]')
          if (t && t.getAttribute('aria-expanded') !== 'true') t.click()
          const x = document.querySelector('[data-testid="stmt-expand-all"]')
          if (x && x.textContent.trim() === 'Expand all') x.click()
        })
        await p.evaluate(() => new Promise((r) => setTimeout(r, 1000)))
      }
      // THE RECORD BRANCH IS CALIBRATED THE SAME WAY, because it too had
      // never produced a non-zero reading and a zero from it would have been
      // read as "no control is blank beside a stored value".
      if (CALIBRATE) {
        const keys = Object.keys(
          name.startsWith('opportunity') ? DEAL : name.startsWith('contact') ? contactPayload : bedPayload)
        const hit = await p.evaluate((v, ks) => {
          for (const e of document.querySelectorAll(`${v} input, ${v} select, ${v} textarea`)) {
            if (e.type === 'hidden' || e.disabled || e.readOnly) continue
            if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
            const id = e.getAttribute('data-testid') || e.id || ''
            if (!(e.value ?? '').trim()) continue
            if (ks.some((k) => id.split('-').includes(k) || id.endsWith(k))) { e.value = ''; return id }
          }
          return null
        }, viewId, keys)
        if (hit) { injected += 1; console.log(`    [calibration] blanked ${hit}`) }
      }
      const banner = await p.evaluate((v) =>
        (document.querySelector(`${v} .readonly-banner, ${v} .msg-warning`)?.textContent ?? '').trim().slice(0, 40),
      viewId)
      const scan = await p.evaluate(SCAN, viewId)
      if (scan.error) { console.log(`  ${name}: ${scan.error}`); continue }
      const editable = scan.out.filter((c) => !c.locked)
      const blanks = editable.filter((c) => {
        if (c.value !== '') return false
        const key = c.testid.replace(/^stmt-edit-/, '')
        if (effective[key]) return true
        if (stored[name]?.(key)) return true
        if (c.display && !/^(not recorded|--|-|—|n\/a)$/i.test(c.display)) return true
        return false
      }).map((c) => {
        const key = c.testid.replace(/^stmt-edit-/, '')
        const why = effective[key] ? 'derivation' : (stored[name]?.(key) ? 'record' : 'display half')
        return {
          ...c, width, surface: name, why,
          effective: effective[key] ?? stored[name]?.(key) ?? c.display,
        }
      })
      // ── THE FIELD-ROW PASS, and without it the zeros above mean nothing ──
      //
      // A field row keeps BOTH halves in the document and swaps them with the
      // `hidden` attribute, and `rows.requestOpen` allows exactly ONE open row
      // at a time. So on a closed surface every editor is invisible, the scan
      // above correctly skips all of them, and the display-half branch of this
      // census can never fire - a zero from an instrument that cannot reach
      // one (Verification 13).
      //
      // Each row is therefore opened in turn, its display text read BEFORE the
      // click and its editor read after a yield, because React re-renders
      // asynchronously and a synchronous read after a synchronous click
      // measures the previous frame (Verification 6).
      const fieldRows = await p.evaluate((v) =>
        [...document.querySelectorAll(`${v} .field-row[data-field]`)]
          .filter((r) => r.checkVisibility() && !r.getAttribute('data-readonly'))
          .map((r) => r.getAttribute('data-field')), viewId)
      const rowFindings = []
      let injectedHere = false
      for (const f of fieldRows) {
        const before = await p.evaluate((v, n) => {
          const r = document.querySelector(`${v} .field-row[data-field="${n}"]`)
          const d = r?.querySelector('.field-row-display')
          return {
            text: (d?.textContent ?? '').trim(),
            placeholderShown: !!d?.querySelector('.field-row-placeholder'),
            label: (r?.querySelector('.field-row-label')?.textContent ?? '').trim(),
          }
        }, viewId, f)
        await p.evaluate((v, n) => {
          document.querySelector(`${v} .field-row[data-field="${n}"] .field-row-display`)?.click()
        }, viewId, f)
        await p.evaluate(() => new Promise((r) => setTimeout(r, 150)))
        if (CALIBRATE && before.text && !before.placeholderShown && !injectedHere) {
          const did = await p.evaluate((v, n) => {
            const r = document.querySelector(`${v} .field-row[data-field="${n}"]`)
            const e = [...(r?.querySelectorAll('input, select, textarea') ?? [])]
              .find((x) => x.type !== 'hidden' && x.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
            if (!e || (e.value ?? '') === '') return false
            e.value = ''
            return true
          }, viewId, f)
          if (did) { injectedHere = true; injected += 1 }
        }
        const after = await p.evaluate((v, n) => {
          const r = document.querySelector(`${v} .field-row[data-field="${n}"]`)
          if (!r) return { opened: false }
          const e = [...r.querySelectorAll('input, select, textarea')]
            .find((x) => x.type !== 'hidden' && x.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
          if (!e) return { opened: false }
          return {
            opened: true, value: (e.value ?? '').trim(), tag: e.tagName.toLowerCase(),
            testid: e.getAttribute('data-testid') || e.id || '',
          }
        }, viewId, f)
        await p.keyboard.press('Escape')
        await p.evaluate(() => new Promise((r) => setTimeout(r, 80)))
        rowsOpened += after.opened ? 1 : 0
        // THE DISPLAY HALF IS THE ANSWER. A row whose display renders the
        // placeholder is legitimately unset and is NOT a finding.
        if (after.opened && after.value === '' && before.text && !before.placeholderShown
            && !/^(not recorded|--|-|—|n\/a)$/i.test(before.text)) {
          rowFindings.push({
            testid: after.testid || f, tag: after.tag, value: '', placeholder: '',
            label: before.label, display: before.text, width, surface: name,
            effective: before.text, why: 'display half',
          })
        }
      }
      findings.push(...rowFindings)
      surfaces.push({ name, width, all: scan.all, editable: editable.length,
        blanks: blanks.length + rowFindings.length, rows: fieldRows.length })
      console.log(`  ${name.padEnd(24)} ${String(scan.all).padStart(3)} controls, `
        + `${String(editable.length).padStart(3)} editable, ${String(fieldRows.length).padStart(2)} field rows, `
        + `${blanks.length + rowFindings.length} blank-with-a-value`
        + (banner ? `   [${banner}]` : ''))
      findings.push(...blanks)
    }
  }
} finally {
  await b.close()
  await tearDown(TAG)
}

console.log('\n════ THE CENSUS ════')
const seen = new Map()
for (const f of findings) {
  const k = `${f.surface}|${f.testid}`
  if (!seen.has(k)) seen.set(k, f)
}
if (!seen.size) console.log('  none')
for (const f of seen.values()) {
  console.log(`  ${f.surface.padEnd(24)} ${(f.testid || f.label).padEnd(30)} effective ${String(f.effective).padEnd(12)}`
    + ` box "" placeholder "${f.placeholder}"  [${f.why}]`)
}
writeFileSync(`${OUT}census-${TAG}.json`, JSON.stringify({ surfaces, findings: [...seen.values()] }, null, 2))
console.log(`\n${seen.size} distinct control(s) blank while a value exists`)
if (CALIBRATE) {
  console.log(`\nCALIBRATION: ${injected} editor(s) blanked, `
    + `${findings.filter((f) => f.why === 'display half').length} display-half finding(s) produced`)
}
console.log(`field-row editors actually opened: ${rowsOpened}`
  + (rowsOpened ? '' : '   <-- NO ROW OPENED, so every field-row zero above is a NULL READING'))
