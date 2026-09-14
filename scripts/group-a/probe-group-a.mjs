// Group A, LIGHT PATH. Screenshots of each changed screen at 1440, both modes
// for A3/A6, plus the two INTERACTIONS confirmed live: the note still saves
// (A2) and Create still opens and creates (A5). No injection calibration -
// measured before changing anything, A2's control already opened when closed
// and COMMITTED when open, so the save path did not move, only the label.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-group-a.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'
import { api } from '../api-client.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/group-a/`
mkdirSync(OUT, { recursive: true })
const MARK = 'GROUPA'
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const db = admin()
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const checks = []
const check = (ok, what) => { checks.push({ ok, what }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`) }
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('BUNDLE STALE'); process.exit(2) }

const industry = (await api('GET', '/industries')).data[0]
const mk = async (s) => (await api('POST', '/contacts', {
  name: `${MARK} ${s}`, company: `${MARK} Co`, jobRole: 'Engineer',
  email: `${s}@example.com`, mobile: '+60123456789', industry_id: industry.id,
  source: 'Web', address: '1 Fixture Street', city: 'Singapore', postcode: '018956',
  country: 'Singapore', region: 'APAC', summary: 'A Group A fixture.',
})).data?.id
const leadId = await mk('Lead')
// A1's rungs render only when there is something to expand TO - correctly, a
// lead with two notes has nothing behind the fold. So the fixture is given
// FOUR, or the assertion could not fire at all and a green would mean nothing.
await api('PATCH', `/contacts/${leadId}`, {
  payload: {
    notes: [1, 2, 3, 4].map((n) => ({
      text: `${MARK} seeded note ${n}`, by: 'fixture@example.com',
      at: `2026-09-0${n}T00:00:00.000Z`,
    })),
  },
})
const contactId = await mk('Contact')
const acct = must(await db.from('records').select('id').eq('record_type', 'account')
  .is('deleted_at', null).limit(1), 'acct')[0]
must(await db.from('records').update({ status: 'Qualified', parent_record_id: acct.id })
  .eq('id', contactId), 'promote')
console.log(`lead ${leadId}\ncontact ${contactId}\n`)

const browser = await puppeteer.launch({ headless: 'new' })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1300 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })

  const openDetail = async (id, name) => {
    await page.evaluate((r) => navigate('contact-detail', r), id)
    await page.waitForFunction((n) => {
      const v = document.getElementById('view-contact-detail')
      return !!v && v.querySelector('[data-testid="cd-lead-name"]')?.textContent === n
        && v.querySelectorAll('.lead-complete-cell').length > 0
    }, { timeout: 25000 }, name)
    await new Promise((r) => setTimeout(r, 1200))
  }
  // SCOPED TO THE VISIBLE VIEW. This app keeps every view in the DOM, so a
  // document-wide selector answers for whatever is resident rather than for
  // the screen under test - the first run read the HIDDEN leads view's
  // follow-up card, rect top 0, and reported the row broken.
  const sameRow = (a, b, c) => page.evaluate((x, y, z) => {
    const v = document.getElementById('view-contact-detail')
    const t = (s) => v.querySelector(`[data-testid="${s}"]`)?.getBoundingClientRect()
    const [A, B, C] = [t(x), t(y), t(z)]
    if (!A || !B || !C) return { ok: false, why: 'one of the three is missing' }
    const tops = [A.top, B.top, C.top]
    return { ok: Math.max(...tops) - Math.min(...tops) < 24, tops: tops.map(Math.round) }
  }, a, b, c)

  await openDetail(contactId, `${MARK} Contact`)
  const cRow = await sameRow('cd-card-summary', 'cd-card-notes', 'cd-card-followup')
  const cT = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    return {
      eyebrow: v.querySelector('[data-testid="cd-title"]')?.textContent?.trim() ?? null,
      firstCard: v.querySelector('[data-testid="cd-card-contact"] .panel-title')?.textContent?.trim() ?? null,
      summaryRowLabel: v.querySelector('[data-testid="cd-card-summary"] .field-row-label')?.textContent ?? null,
      rungsInHeader: !!v.querySelector('.panel-actions [data-testid="cd-notes-expand"], [data-testid="cd-notes-header-row"] [data-testid="cd-notes-expand"]'),
    }
  })
  console.log(`  contact: ${JSON.stringify({ ...cRow, ...cT })}`)
  check(cRow.ok === true, `A3 CONTACT: Summary / Notes / Follow-up on ONE row (tops ${JSON.stringify(cRow.tops)})`)
  check(!!cT.eyebrow && !!cT.firstCard && cT.eyebrow.toLowerCase() !== cT.firstCard.toLowerCase(),
    `A6 CONTACT: eyebrow "${cT.eyebrow}" no longer repeats card "${cT.firstCard}"`)
  check(!cT.summaryRowLabel, 'A6: the Summary row no longer repeats its own panel title')
  // And the column it would have reserved is GONE, not merely blank: a blank
  // label still holding 170px is what squeezed the text to 88px.
  const sumW = await page.evaluate(() => {
    const v = document.getElementById('view-contact-detail')
    const card = v.querySelector('[data-testid="cd-card-summary"]')
    const lab = card.querySelector('.field-row-label')
    const val = card.querySelector('.field-row-value, .field-row-display, .field-row > :last-child')
    return {
      labelW: lab ? Math.round(lab.getBoundingClientRect().width) : null,
      valueW: val ? Math.round(val.getBoundingClientRect().width) : null,
      cardW: Math.round(card.getBoundingClientRect().width),
    }
  })
  console.log(`  A6 summary widths: ${JSON.stringify(sumW)}`)
  check(sumW.labelW === 0, `A6: the empty label reserves NO column (${sumW.labelW}px)`)
  check(sumW.valueW !== null && sumW.valueW > sumW.cardW * 0.6,
    `A6: so the summary text gets the card's width (${sumW.valueW} of ${sumW.cardW})`)
  await page.screenshot({ path: `${OUT}contact-1440.png`, fullPage: false })

  await openDetail(leadId, `${MARK} Lead`)
  const lRow = await sameRow('cd-card-summary', 'cd-card-notes', 'cd-card-followup')
  const lEye = await page.evaluate(() => document.querySelector('[data-testid="cd-title"]')?.textContent?.trim() ?? null)
  check(lRow.ok === true, `A3 LEAD: the same one row (tops ${JSON.stringify(lRow.tops)})`)
  check(lEye === 'Lead details', `LEAD UNCHANGED: the eyebrow still reads "${lEye}"`)
  await page.screenshot({ path: `${OUT}lead-detail-1440.png`, fullPage: false })

  await page.evaluate(() => navigate('leads'))
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"]`), { timeout: 25000 }, leadId)
  await new Promise((r) => setTimeout(r, 1200))
  const a1 = await page.evaluate((id) => {
    const card = document.querySelector(`[data-testid="lead-card-${id}"]`)
    const add = card.querySelector('[data-testid="cd-add-note-btn"]')
    // THE HEADER THAT CONTAINS IT, not the first header in the card. The first
    // run asked `.panel-head` and got the SUMMARY panel's head, which of course
    // does not contain the note control.
    const hdr = add?.closest('.panel-head, [data-testid="cd-notes-header-row"]') ?? null
    const rungs = card.querySelector('[data-testid="cd-notes-expand"]')
    return {
      addLabel: add?.textContent ?? null,
      addInHeader: !!hdr,
      rungsWithIt: !!rungs && !!hdr && hdr.contains(rungs),
    }
  }, leadId)
  check(a1.addLabel === 'Add note', `A2: the control reads "${a1.addLabel}" when closed`)
  check(a1.addInHeader === true, 'A1: the note control sits on the NOTES header line')
  check(a1.rungsWithIt === true, 'A1: and the Latest 2 / Last 10 / All rungs are on that same line')
  // ONE LINE, asserted as a ROW rather than as membership. A count of children
  // cannot see a wrap, and the first build wrapped the secondary onto a second
  // line and clipped Add note at the column edge while every membership check
  // passed (CLAUDE.md's stats-grid clause).
  const a1row = await page.evaluate((id) => {
    const add = document.querySelector(`[data-testid="lead-card-${id}"] [data-testid="cd-add-note-btn"]`)
    const hdr = add.closest('.panel-head')
    const kids = [...hdr.children].map((e) => e.getBoundingClientRect())
    const hr = hdr.getBoundingClientRect()
    return {
      tops: kids.map((r) => Math.round(r.top)),
      oneRow: Math.max(...kids.map((r) => r.top)) - Math.min(...kids.map((r) => r.top)) < 6,
      addRight: Math.round(add.getBoundingClientRect().right),
      headerRight: Math.round(hr.right),
    }
  }, leadId)
  console.log(`  A1 header: ${JSON.stringify(a1row)}`)
  check(a1row.oneRow === true, `A1: every header item shares ONE row (tops ${JSON.stringify(a1row.tops)})`)
  check(a1row.addRight <= a1row.headerRight + 1,
    `A1: and Add note is not clipped at the column edge (${a1row.addRight} vs ${a1row.headerRight})`)
  await page.screenshot({ path: `${OUT}lead-card-1440.png`, fullPage: false })

  const preClick = await page.evaluate((id) => {
    const b = document.querySelector(`[data-testid="lead-card-${id}"] [data-testid="cd-add-note-btn"]`)
    if (!b) return { why: 'no button' }
    const r = b.getBoundingClientRect()
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2)
    const at = document.elementFromPoint(cx, cy)
    return {
      rect: [Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height)],
      disabled: b.disabled,
      atPoint: at ? `${at.tagName}.${at.className}`.slice(0, 60) : null,
      isTheButton: at === b || b.contains(at),
    }
  }, leadId)
  console.log(`  A2 pre-click: ${JSON.stringify(preClick)}`)
  await page.click(`[data-testid="lead-card-${leadId}"] [data-testid="cd-add-note-btn"]`)
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-card-${id}"] [data-testid="cd-new-note-input"]`), { timeout: 10000 }, leadId)
  const openLabel = await page.evaluate((id) => document.querySelector(`[data-testid="lead-card-${id}"] [data-testid="cd-add-note-btn"]`)?.textContent, leadId)
  check(openLabel === 'Save', `A2: and reads "${openLabel}" once the field is open`)
  await page.screenshot({ path: `${OUT}lead-card-addnote-1440.png`, fullPage: false })
  await page.type(`[data-testid="lead-card-${leadId}"] [data-testid="cd-new-note-input"]`, 'Group A note')
  await page.click(`[data-testid="lead-card-${leadId}"] [data-testid="cd-add-note-btn"]`)
  await new Promise((r) => setTimeout(r, 2500))
  const notes = (must(await db.from('record_revisions').select('payload,revision_number')
    .eq('record_id', leadId).order('revision_number', { ascending: false }).limit(1), 'n')[0]?.payload?.notes) ?? []
  check(notes.some((n) => (n.text ?? '').includes('Group A note')),
    `A2: THE NOTE STILL SAVES ("${(notes[0]?.text ?? '').slice(0, 40)}")`)

  await page.click(`[data-testid="lead-qualify-${leadId}"]`)
  await page.waitForFunction((id) => !!document.querySelector(`[data-testid="lead-incomplete-${id}"]`), { timeout: 15000 }, leadId)
  await new Promise((r) => setTimeout(r, 900))
  const a4 = await page.evaluate((id) => {
    const body = document.querySelector(`[data-testid="lead-card-${id}"] .lead-card-body`)
    const sheet = document.querySelector(`[data-testid="lead-incomplete-${id}"]`)
    return { bodyBottom: Math.round(body.getBoundingClientRect().bottom), sheetTop: Math.round(sheet.getBoundingClientRect().top) }
  }, leadId)
  check(a4.sheetTop >= a4.bodyBottom - 4, `A4: the completion sheet opens BELOW the card body (body ${a4.bodyBottom}, sheet ${a4.sheetTop})`)
  await page.screenshot({ path: `${OUT}lead-card-qualify-1440.png`, fullPage: false })

  await page.evaluate(() => navigate('contacts'))
  await page.waitForFunction(() => document.querySelectorAll('.contact-create-trigger').length > 0, { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 1200))
  const openCount = () => page.evaluate(() => [...document.querySelectorAll('.contact-create-dropdown')].filter((d) => !d.classList.contains('hidden')).length)
  const b4 = await openCount()
  await page.hover('.contact-create-trigger')
  await new Promise((r) => setTimeout(r, 700))
  const afterHover = await openCount()
  check(b4 === 0 && afterHover === 0, `A5: HOVER no longer opens it (${b4} -> ${afterHover})`)
  await page.click('.contact-create-trigger')
  await new Promise((r) => setTimeout(r, 600))
  const afterClick = await openCount()
  check(afterClick === 1, `A5: CLICK opens exactly one menu (${afterClick})`)
  await page.screenshot({ path: `${OUT}contacts-list-menu-1440.png`, fullPage: false })
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))
  check((await openCount()) === 0, 'A5: and Escape closes it')

  await page.evaluate((id) => window.createFromContact(id, 'test-bed'), contactId)
  const dlg = await page.waitForFunction(() => {
    const m = document.getElementById('new-test-bed-modal')
    return !!m && !m.classList.contains('hidden')
  }, { timeout: 15000 }).then(() => true).catch(() => false)
  check(dlg, 'A5: the shared dialogue still opens from the list')
  await page.evaluate(() => {
    const i = document.getElementById('new-test-bed-name')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(i, 'GROUPA Bed From List')
    i.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.click('#new-test-bed-save')
  await new Promise((r) => setTimeout(r, 3000))
  const beds = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', 'GROUPA Bed From List%'), 'beds')
  check(beds.length > 0, `A5: and it STILL CREATES (${beds.length} Test Bed found)`)
} finally {
  await browser.close()
  const found = must(await db.from('record_revisions').select('record_id,payload')
    .ilike('payload->>name', `${MARK}%`), 'find')
  const ids = [...new Set(found.map((r) => r.record_id))]
  for (const r of ids) {
    must(await db.from('records').update({ deleted_at: new Date().toISOString() }).eq('id', r).is('deleted_at', null), 'soft')
  }
  const left = must(await db.from('records').select('id,deleted_at').in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']), 're')
  console.log(`\nteardown: ${left.length} found, ${left.filter((r) => !r.deleted_at).length} still live`)
}
const bad = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - bad.length}/${checks.length} pass`)
process.exit(bad.length ? 1 : 0)
