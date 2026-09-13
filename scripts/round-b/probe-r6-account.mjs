// ── R6 PROVEN LIVE: a linked contact shows its account name ──────────────
//
// THE COUNTERFACTUAL, stated first per Verification 7. If the fix had not
// landed, every one of the ten live Qualified contacts would read
// "Not linked" - which is exactly what `baseline.json` recorded before any
// change. So this probe compares against a reading taken on the same
// population by a different run, not against an expectation.
//
// Verification 44's lineage clause: these screenshots are named for THIS
// run (`rsc-r6-*`), never the baseline's names. A probe copied from another
// inherits its artefact names and its first run destroys the evidence of
// the defect - which cannot be regenerated without reverting the fix.
//
// Verification 4: captured THROUGH THE ELEMENT, and the capture is checked
// non-empty. A clipped page-coordinate shot photographed pure background in
// this estate and every programmatic check passed on it.
//
// READ-ONLY. It changes nothing.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('probe-r6-account.mjs')
import { readFileSync, mkdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/rsc/`
mkdirSync(OUT, { recursive: true })
const db = admin()
const OWNER = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }

// Build discipline 9's stale-server clause: a probe cannot notice that the
// server is running the code its change replaced, so the check is stated.
try { execFileSync('node', ['scripts/check-dist-fresh.mjs'], { cwd: ROOT, stdio: 'pipe' }) } catch {
  console.error('bundle freshness FAILED'); process.exit(2) }
const started = execFileSync('bash', ['-c',
  "ps -o lstart= -p $(pgrep -f 'src/server.js' | head -1)"], { encoding: 'utf8' }).trim()
const edited = new Date(statSync(`${ROOT}/src/routes/contacts.js`).mtime)
console.log(`  server started ${started}`)
console.log(`  contacts.js edited ${edited.toString()}`)
if (new Date(started) < edited) { console.error('SERVER IS OLDER THAN THE ROUTE. Every probe below would measure the replaced code.'); process.exit(2) }
console.log('  server postdates the route change\n')

const rows = must(await db.from('records')
  .select('id,parent_record_id,reference_code')
  .eq('record_type', 'contact').eq('status', 'Qualified')
  .is('deleted_at', null).order('created_at'), 'contacts')
const linked = rows.filter((r) => r.parent_record_id)
console.log(`  ${rows.length} live Qualified contacts, ${linked.length} carrying a parent_record_id\n`)

let prior = null
try { prior = JSON.parse(readFileSync(`${OUT}baseline.json`, 'utf8')) } catch {}

const browser = await puppeteer.launch({ headless: 'new' })
let named = 0, notLinked = 0, unresolved = 0
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1920, height: 1400 })
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  await page.evaluate((k, v) => localStorage.setItem(k, v),
    'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(OWNER))
  await page.reload({ waitUntil: 'networkidle0' })

  console.log('=== EVERY LIVE QUALIFIED CONTACT ===')
  for (const r of linked) {
    await page.evaluate((id) => navigate('contact-detail', id), r.id)
    // Waits on the ACCOUNT SECTION carrying text, which is the state only
    // the new route can produce - not on the panel, which the old code
    // rendered just as readily.
    await page.waitForFunction(() => {
      const v = document.getElementById('view-contact-detail')
      const s = v?.querySelector('[data-testid="cd-account-status"]')
      return !!s && (s.textContent ?? '').trim().length > 0
    }, { timeout: 25000 })
    const text = await page.evaluate(() =>
      document.querySelector('[data-testid="cd-account-status"]').textContent.trim())
    const verdict = /not linked/i.test(text) ? 'NOT LINKED'
      : /could not be resolved/i.test(text) ? 'UNRESOLVED' : 'NAMED'
    if (verdict === 'NAMED') named++
    else if (verdict === 'NOT LINKED') notLinked++
    else unresolved++
    console.log(`  ${r.reference_code ?? r.id.slice(0, 8)}  ${verdict.padEnd(10)} ${text}`)
  }

  // The screenshot, through the element, checked non-empty.
  const el = await page.$('[data-testid="cd-card-account"]')
  if (!el) { console.error('no account section to photograph'); process.exit(2) }
  const box = await el.boundingBox()
  await el.screenshot({ path: `${OUT}rsc-r6-account-section.png` })
  const bytes = statSync(`${OUT}rsc-r6-account-section.png`).size
  console.log(`\n  section captured ${Math.round(box.width)}x${Math.round(box.height)}, ${bytes} bytes`)
  if (box.width < 100 || box.height < 20 || bytes < 1000) {
    console.error('  the capture is too small to be the section. Not evidence.'); process.exit(2) }

  const full = await page.$('#view-contact-detail')
  await full.screenshot({ path: `${OUT}rsc-r6-screen.png` })
} finally { await browser.close() }

console.log(`\n=== THE CLAIM ===`)
console.log(`  NAMED      ${named}/${linked.length}`)
console.log(`  NOT LINKED ${notLinked}/${linked.length}`)
console.log(`  UNRESOLVED ${unresolved}/${linked.length}`)
if (prior) console.log(`  the BEFORE reading, from baseline.json: "${prior.live?.accountStatus}"`)
console.log(named === linked.length && notLinked === 0
  ? `\n  R6 HOLDS: every linked contact shows its account name.`
  : `\n  R6 FAILS: ${notLinked} still say "Not linked", ${unresolved} would not resolve.`)
process.exit(named === linked.length && notLinked === 0 ? 0 : 1)
