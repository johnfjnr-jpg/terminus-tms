// R-W3: THE KEY CUSTOMER CONTACTS PICKER IS SCOPED, AND THE ROUTE ENFORCES IT.
//
// THE PICKER IS NOT THE CONTROL. A rule enforced only by the list a screen
// happens to render is decoration: this estate's own probes call these routes
// directly, and a superseded route that goes on working is a shape it has
// already been caught by. So the screen and the ROUTE are both measured.
//
// THE REFUSAL IS ASSERTED BY ITS REASON, not by its status. This route already
// answers 4xx for a missing contact_id and for a bad role, so "it refused"
// proves nothing about WHY - the alarm has to say what it fired about.
//
// THE SUCCESS PATH IS READ BACK FROM THE DATABASE. A 201 is not a write.
//
// UNWIRED: needs a browser, a live server and a signed-in session.
import { loadPuppeteer } from '../lib/puppeteer.mjs'
const puppeteer = await loadPuppeteer('walk5/probe-key-contacts.mjs')
import { readFileSync, mkdirSync } from 'node:fs'
import { freshOpportunity, freshContact, tearDown, admin } from '../fixtures.mjs'

const ROOT = '/Users/johnfryatt/terminus-tms'
const OUT = `${ROOT}/.verify/walk5/`
mkdirSync(OUT, { recursive: true })
const S = JSON.parse(readFileSync(`${ROOT}/session-ref.json`, 'utf8'))
const TAG = 'w5kc'
const db = admin()
const must = (r, w) => { if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data }
const checks = []
const check = (ok, what, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`) }

const opp = await freshOpportunity(TAG)
const oppRow = must(await db.from('records').select('id, account_id')
  .eq('id', opp.oppId).maybeSingle(), 'opp')
const accountA = oppRow.account_id
if (!accountA) throw new Error('the fixture opportunity carries no account, so nothing below can be measured')

// A SECOND, DIFFERENT ACCOUNT, taken from the estate rather than invented: the
// column carries a foreign key and would refuse a fabricated id.
const otherAccounts = must(await db.from('records').select('id')
  .eq('record_type', 'account').is('deleted_at', null).neq('id', accountA).limit(1), 'accounts')
if (!otherAccounts.length) throw new Error('only one account exists, so the out-of-account case cannot be built')
const accountB = otherAccounts[0].id

const inside = await freshContact(TAG)
const outside = await freshContact(TAG)
const insideId = inside.contactId ?? inside.id
const outsideId = outside.contactId ?? outside.id

// ── THE LINK IS WRITTEN DIRECTLY, AND THAT IS SAID RATHER THAN HIDDEN ────
// A contact's account is set by `qualify_contact`, which is a whole flow. The
// surface and the route read the STATE - `parent_record_id` - and have no
// opinion on how the record reached it, so the state is built directly. The
// value written is one the system itself produces: a real account id, taken
// from the estate above rather than fabricated.
must(await db.from('records').update({ parent_record_id: accountA }).eq('id', insideId), 'link inside')
must(await db.from('records').update({ parent_record_id: accountB }).eq('id', outsideId), 'link outside')
console.log(`opportunity ${opp.oppId}\n  account A ${accountA}\n  account B ${accountB}`)

const b = await puppeteer.launch({ headless: 'new' })
try {
  const p = await b.newPage()
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' })
  await p.evaluate((k, v) => localStorage.setItem(k, v), 'sb-anvildouaacbhsjytkii-auth-token', JSON.stringify(S))

  for (const width of [1440, 1240]) {
    await p.setViewport({ width, height: 1200 })
    await p.reload({ waitUntil: 'networkidle0' })
    await p.evaluate((id) => navigate('opportunity-detail', id), opp.oppId)
    await p.waitForFunction(() => {
      const v = document.getElementById('view-opportunity-detail')
      return !!v && !v.classList.contains('is-loading')
        && !!v.querySelector('[data-testid="kc-add-contact"]')
    }, { timeout: 25000 })
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    console.log(`\n=== ${width}px ===`)

    const picker = await p.evaluate(() => {
      const v = document.getElementById('view-opportunity-detail')
      const sel = v?.querySelector('[data-testid="kc-add-contact"]')
      return sel ? {
        ids: [...sel.options].map((o) => o.value).filter(Boolean),
        note: !!v?.querySelector('[data-testid="kc-no-account"]'),
      } : null
    })
    check(!!picker && picker.ids.includes(insideId),
      `R-W3 the picker OFFERS the contact in this account at ${width}`)
    check(!!picker && !picker.ids.includes(outsideId),
      `R-W3 and does NOT offer the contact in another account at ${width}`,
      `${picker?.ids.length} contacts offered`)
    check(!!picker && !picker.note,
      `R-W3 and no missing-account note, this opportunity having one at ${width}`)
  }

  // ── THE ROUTE, OVER HTTP, BOTH WAYS ───────────────────────────────────
  const post = (contactId) => p.evaluate(async (oid, cid) => {
    const r = await window.api('POST', `/api/opportunities/${oid}/key-contacts`,
      { contact_id: cid, role_other: 'Probe role' })
    return { ok: r.ok, status: r.status, error: r.data?.error ?? null }
  }, opp.oppId, contactId)

  console.log('\n=== the route ===')
  const good = await post(insideId)
  console.log(`  in-account add:     ${good.status} ${JSON.stringify(good.error)}`)
  check(good.ok, 'R-W3 an IN-ACCOUNT contact is accepted', `status ${good.status}`)

  // READ BACK FROM THE DATABASE. A 2xx is not a write.
  const linked = must(await db.from('record_contacts').select('record_id, contact_id')
    .eq('record_id', opp.oppId).eq('contact_id', insideId), 'link read-back')
  check(linked.length === 1,
    'R-W3 and THE DATABASE holds the link, not only the response',
    `${linked.length} rows`)

  const bad = await post(outsideId)
  console.log(`  out-of-account add: ${bad.status} ${JSON.stringify(bad.error)}`)
  check(!bad.ok && bad.status >= 400 && bad.status < 500,
    'R-W3 an OUT-OF-ACCOUNT contact is refused 4xx', `status ${bad.status}`)
  // THE EXISTING REFUSAL'S OWN WORDS. This route has refused an out-of-account
  // contact since Round 35 with a named 422; a check added during this round
  // was removed once the calibration showed the refusal survived without it.
  // Asserted on the REASON rather than the status, because this handler also
  // answers 4xx for a missing contact_id and for a bad role.
  check(/not linked to this Opportunity's Account/i.test(bad.error ?? ''),
    'R-W3 and the refusal NAMES the reason rather than merely refusing',
    JSON.stringify(bad.error))

  const notLinked = must(await db.from('record_contacts').select('record_id')
    .eq('record_id', opp.oppId).eq('contact_id', outsideId), 'refused read-back')
  check(notLinked.length === 0,
    'R-W3 and nothing was written for the refused contact',
    `${notLinked.length} rows`)
} finally {
  await b.close()
  await tearDown([TAG])
}
const passed = checks.filter(Boolean).length
console.log(`\n${passed}/${checks.length} checks passed`)
process.exit(passed === checks.length ? 0 : 1)
