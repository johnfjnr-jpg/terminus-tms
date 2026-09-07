// ── ROUND 6 PHASE 0 ITEM 2.2: THE CONTACT FIELD CENSUS, SECOND INSTRUMENT ──
//
// Verification 49: a census of a rendered surface is taken on a surface that
// has INITIALISED, COMPUTED and BEEN EXERCISED, and its coverage is asserted
// against a second instrument rather than assumed.
//
//   initialised - the view is navigated to and past its is-loading flag, not
//                 merely present in the markup. contact-detail's rows do not
//                 exist until renderContactDetail has run.
//   computed    - #cd-contact-rows and #cd-address-rows are built by innerHTML,
//                 so every row id below exists only after that.
//   exercised   - a row is opened, because the edit-half ids and the open-state
//                 classes do not exist on a still surface.
//
// AND EXACT AGREEMENT IS A TELL, NOT A RESULT. The source instrument reads the
// CD_* constants; this reads the DOM. They should agree on the FIELD SET and
// differ on everything the source cannot see.
import { readFileSync } from 'node:fs'
import { loadPuppeteer } from '../lib/puppeteer.mjs'
import { freshOpportunity, tearDown } from '../fixtures.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const R = []
const check = (n, p, d = '') => R.push({ n, p: !!p, d: String(d).slice(0, 220) })
const puppeteer = await loadPuppeteer('census-contact')
let browser = null
const { contactId } = await freshOpportunity('R6CENSUS')

// ── INSTRUMENT ONE: the source, parsed from the real file ────────────────
const src = readFileSync(ROOT + 'frontend/contact-detail.js', 'utf8')
const block = (name) => {
  const i = src.indexOf('const ' + name)
  const j = src.indexOf('\n]', i)
  return src.slice(i, j < 0 ? src.indexOf('\n', i) : j + 2)
}
const parse = (blk) => [...blk.matchAll(/\{\s*key:\s*'([^']+)',\s*label:\s*'([^']+)'([^}]*)\}/g)]
  .map((m) => ({ key: m[1], label: m[2], editor: /options:/.test(m[3]) ? 'select' : 'text' }))
//
// TWO FIELDS ARE DECLARED `static` RATHER THAN GUESSED, and that correction
// came from this probe. `name` and `summary` are not rendered by cdFieldRow at
// all: they are static markup in index.html, populated by id. The source
// instrument therefore CANNOT see their editor kind, and the Phase 0 report
// recorded both as `text` by assuming the row renderer. Measured, summary is a
// TEXTAREA. Saying `static` is the honest reading - the source knows the field
// exists and does not know how it is edited - and it makes the DOM the only
// instrument that can answer, which is the whole reason for a second one.
const SOURCE = [
  { key: 'name', label: 'Name', editor: 'static' },
  ...parse(block('CD_CONTACT_FIELDS')),
  ...parse(block('CD_COLUMN_FIELDS')).map((f) => ({ ...f, editor: 'lookup' })),
  { key: 'source', label: 'Source', editor: 'select' },
  ...parse(block('CD_ADDRESS_FIELDS')),
  { key: 'summary', label: 'Summary', editor: 'static' },
]

try {
  const S = JSON.parse(readFileSync(ROOT + 'session-ref.json', 'utf8'))
  browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
  page.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`) })
  await page.setViewport({ width: 1600, height: 1000 })
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))
  await page.reload({ waitUntil: 'networkidle0' })
  if (await page.evaluate(() => !document.getElementById('view-auth')?.classList.contains('hidden'))) {
    throw new Error('NOT SIGNED IN')
  }

  const settle = () => page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))))

  // ── INITIALISED ────────────────────────────────────────────────────────
  await page.evaluate((id) => navigate('contact-detail', id), contactId)
  await page.waitForFunction(() => {
    const v = document.getElementById('view-contact-detail')
    return v && !v.classList.contains('hidden') && !v.classList.contains('is-loading')
      && document.querySelectorAll('#cd-contact-rows [data-key]').length > 0
  }, { timeout: 30000 })
  await settle()

  const still = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('#view-contact-detail [id]')].map((e) => e.id),
    keys: [...document.querySelectorAll('#view-contact-detail [data-key]')].map((e) => e.dataset.key),
  }))
  check('1. the view initialised and COMPUTED its rows',
    still.keys.length > 0, `${still.keys.length} data-key rows`)

  // ── EXERCISED ──────────────────────────────────────────────────────────
  await page.evaluate(() => window.openCdField('email', true))
  await settle()
  const exercised = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('#view-contact-detail [id]')].map((e) => e.id),
    openEditors: [...document.querySelectorAll('#view-contact-detail .ref-field-edit')]
      .filter((e) => !e.classList.contains('hidden')).map((e) => e.id),
  }))
  check('2. exercising the surface OPENS an editor, so the still census was partial',
    exercised.openEditors.length === 1 && exercised.openEditors[0] === 'cd-edit-email',
    `open: ${exercised.openEditors.join(', ') || 'none'}`)

  // ── THE TWO INSTRUMENTS, RECONCILED ────────────────────────────────────
  const domKeys = [...new Set(still.keys)].sort()
  const srcKeys = SOURCE.map((f) => f.key).sort()
  check('3. the DOM carries a row for every field the source declares',
    srcKeys.every((k) => domKeys.includes(k)),
    `missing from DOM: ${srcKeys.filter((k) => !domKeys.includes(k)).join(', ') || 'none'}`)
  check('4. and the DOM carries no field the source does not declare',
    domKeys.every((k) => srcKeys.includes(k)),
    `in DOM only: ${domKeys.filter((k) => !srcKeys.includes(k)).join(', ') || 'none'}`)
  check('5. the counts agree', domKeys.length === srcKeys.length,
    `dom=${domKeys.length} source=${srcKeys.length}`)

  // EXACT AGREEMENT ON IDS WOULD BE THE TELL. A surface that has run carries
  // ids the source file cannot contain, because the row renderers build them.
  const builtIds = exercised.ids.filter((id) => /^cd-(display|edit|input)-/.test(id))
  check('6. the exercised surface carries BUILT ids the source cannot contain',
    builtIds.length > srcKeys.length,
    `${builtIds.length} built ids against ${srcKeys.length} declared fields`)

  // ── THE EDITOR KINDS, FROM THE DOM ─────────────────────────────────────
  const kinds = await page.evaluate(() => {
    const out = {}
    for (const row of document.querySelectorAll('#view-contact-detail [data-key]')) {
      const k = row.dataset.key
      const sel = row.querySelector('select')
      const inp = row.querySelector('input, textarea')
      out[k] = sel
        ? (sel.querySelector('option[value]:not([value=""])')?.value ?? '') ===
          (sel.querySelector('option[value]:not([value=""])')?.textContent ?? '')
          ? 'select' : 'lookup'
        : inp ? inp.tagName.toLowerCase() : 'none'
    }
    return out
  })
  const srcKind = Object.fromEntries(SOURCE.map((f) => [f.key, f.editor]))
  const norm = (k) => (k === 'input' ? 'text' : k)
  const disagree = Object.keys(kinds)
    .filter((k) => srcKind[k] !== 'static')
    .filter((k) => norm(kinds[k]) !== srcKind[k])
  check('7. the editor kind agrees field by field, where the source can see it',
    disagree.length === 0,
    disagree.map((k) => `${k}: dom=${kinds[k]} source=${srcKind[k]}`).join('; ') || 'all agree')
  // AND THE TWO THE SOURCE CANNOT SEE ARE ANSWERED BY THE DOM ALONE.
  const statics = Object.keys(srcKind).filter((k) => srcKind[k] === 'static')
  check('7b. the static-markup fields resolve, and summary is a TEXTAREA',
    statics.length === 2 && norm(kinds.name) === 'text' && kinds.summary === 'textarea',
    `name=${kinds.name} summary=${kinds.summary}`)
  check('8. and INDUSTRY is the lookup kind, value an id and label a name',
    kinds.industry === 'lookup', `industry reads ${kinds.industry}`)

  // ── THE CRITERION HAS A SHAPE: label[for] and aria targets ─────────────
  const pointed = await page.evaluate(() => {
    const t = new Set()
    for (const l of document.querySelectorAll('#view-contact-detail label[for]')) t.add(l.htmlFor)
    for (const a of document.querySelectorAll('#view-contact-detail [aria-labelledby],'
      + ' #view-contact-detail [aria-controls], #view-contact-detail [aria-describedby]')) {
      for (const at of ['aria-labelledby', 'aria-controls', 'aria-describedby']) {
        const v = a.getAttribute(at); if (v) v.split(/\s+/).forEach((x) => t.add(x))
      }
    }
    return [...t]
  })
  const dangling = pointed.filter((id) => !exercised.ids.includes(id))
  check('9. every label[for] and aria target resolves to an element that exists',
    dangling.length === 0, `pointed at ${pointed.length}, dangling: ${dangling.join(', ') || 'none'}`)

  check('99. no page errors and no 5xx', errs.length === 0, errs.join(' | '))

  console.log('\nSOURCE INSTRUMENT:', srcKeys.length, 'fields -', srcKeys.join(', '))
  console.log('DOM INSTRUMENT:   ', domKeys.length, 'fields -', domKeys.join(', '))
  console.log('EDITOR KINDS:     ', JSON.stringify(kinds))
  console.log('label[for]/aria targets:', pointed.length)
} finally {
  if (browser) await browser.close()
  await tearDown()
}

const pass = R.filter((r) => r.p).length
for (const r of R) console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  ' + r.d : ''}`)
console.log(`\n${pass}/${R.length} checks passed`)
process.exit(pass === R.length ? 0 : 1)
