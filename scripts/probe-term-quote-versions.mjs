// TERM_QUOTES: the routes that price and version a term quote on an
// opportunity, exercised from OUTSIDE over HTTP as the signed-in user
// (Verification 40), on the SUCCESS paths and on each refusal, with the
// record's version fingerprint around every refused write ("a 2xx is not a
// write", and neither is a 4xx a refusal until nothing moved).
//
// The claims, each the one a calibration injection removes:
//   C1  creation stamps the method: nothing chosen is term_quote, a choice
//       stands, an unknown value is 400 (R-TQ1, spec 14.1)
//   C2  PATCH takes termQuote and pricingMethod and validates the method
//   C3  the headline is the term quote priced on TODAY's settings (P6)
//   C4  a term version: kind term_quote, the server's snapshot of today's
//       params BY VALUE, the quote as inputs (P3, P4)
//   C5  the same quote again is "no change"; a quote the engine refuses is
//       400 in the engine's words
//   C6  a Commercials version on a term record is refused, nothing written
//   C7  submission freezes the term figures; the approval page reads them
//   C8  restore says which kind the inputs are
//   C9  Closed Won: a version of either kind is 409 in the ruled wording
//       (PT423 through sendWriteError); a termQuote change is 409
//
// Fixtures: the record through freshOpportunity (choosing term_quote, the way
// the route lets a creator), versions through the routes. The win is an admin
// stage write, declared: the surface reads the status, and nothing about how
// the record arrived there (Verification 47's clause). Teardown by tag.
// Settings are READ, never written (the goldens' rule).
import { readFileSync } from 'node:fs'
import { api, ApiError } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readTermState } from '../src/lib/term-params.js'
import { termQuoteValue, settingsChanged } from '../src/lib/term-quote.js'
import { payloadsDiffer } from '../src/lib/payload-diff.js'
import { CLOSED_WON_PRICING_REFUSAL } from '../src/lib/pricing-keys.js'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const TAG = process.argv[2] ?? 'tqv'
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const svc = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const tryApi = async (m, p, b) => {
  try { return { status: 200, ...(await api(m, p, b)) } } catch (e) { if (e instanceof ApiError) return { status: e.status, data: e.body }; throw e }
}
const QUOTE = { units: { safesight: 60 }, termMonths: 120, paymentStructure: 'opex' }

// Refuse to run against a database without the migration: every kind check
// below would otherwise fail for the wrong reason (an unknown column).
{
  const { error } = await svc.from('deal_sheet_versions').select('kind').limit(1)
  if (error) { console.log(`STOP: migration 20261120000001 is not applied (${error.message})`); process.exit(3) }
}
const today = await readTermState(svc)
const expected = termQuoteValue(QUOTE, today.params)
if (expected.refusal) { console.log(`STOP: today's settings cannot price the probe's quote (${expected.refusal.message})`); process.exit(3) }

const ids = []
try {
  // ── C1 ────────────────────────────────────────────────────────────────
  const term = await freshOpportunity(`${TAG}-t`, { pricingMethod: null })
  ids.push(term.oppId)
  const comm = await freshOpportunity(`${TAG}-c`, { pricingMethod: 'commercials' })
  ids.push(comm.oppId)
  const payloadOf = async (id) => (await api('GET', `/opportunities/${id}`)).data
  check('C1: an opportunity created with no method chosen is term_quote', (await payloadOf(term.oppId)).payload?.pricingMethod === 'term_quote')
  check('C1: a creator\'s choice of commercials stands', (await payloadOf(comm.oppId)).payload?.pricingMethod === 'commercials')
  const contactId = comm.contactId
  const bogus = contactId ? await tryApi('POST', `/contacts/${contactId}/create-opportunity`, { name: `${TAG} bogus`, pricingMethod: 'cost-up' }) : { status: 'no contact' }
  check('C1: an unknown method is refused, never coerced', bogus.status === 400 && /pricingMethod must be one of/.test(bogus.data?.error ?? ''), `${bogus.status} ${bogus.data?.error ?? ''}`)

  // ── C2, C3 ────────────────────────────────────────────────────────────
  const rev = async (id) => (await payloadOf(id)).latest_revision_number
  const badMethod = await tryApi('PATCH', `/opportunities/${term.oppId}`, { payload: { pricingMethod: 'cost-up' }, expected_revision: await rev(term.oppId) })
  check('C2: PATCH refuses an unknown pricingMethod', badMethod.status === 400, `${badMethod.status}`)
  const put = await tryApi('PATCH', `/opportunities/${term.oppId}`, { payload: { termQuote: QUOTE }, expected_revision: await rev(term.oppId) })
  check('C2: PATCH takes termQuote', put.status === 200, `${put.status} ${put.data?.error ?? ''}`)
  const head = await payloadOf(term.oppId)
  check('C3: the headline is the quote\'s Base TCV on today\'s settings', head.total_contract_value === expected.tcv && expected.tcv > 0,
    `route ${head.total_contract_value}, engine on today's settings ${expected.tcv}`)

  // ── C4, C5 ────────────────────────────────────────────────────────────
  const fp = async (id) => JSON.stringify(must(await svc.from('deal_sheet_versions').select('id, kind, status, major, minor').eq('record_id', id).order('created_at').range(0, 199), 'fp'))
  const take = (id, body) => tryApi('POST', `/opportunities/${id}/deal-sheet-versions`, body)
  const v = await take(term.oppId, { kind: 'term_quote', inputs: QUOTE, reason: `${TAG} first term version`, expected_revision: await rev(term.oppId) })
  check('C4: a term version is taken', v.status === 201 && v.data?.kind === 'term_quote', `${v.status} ${v.data?.error ?? ''}`)
  const row = v.data?.id ? must(await svc.from('deal_sheet_versions').select('*').eq('id', v.data.id).single(), 'row') : null
  // jsonb stores keys in its own order, so equality is BY VALUE: the deep
  // compare that is the definition of "settings changed" (spec 14.5).
  check('C4: its settings are today\'s, by value, derived by the server', !!row?.rates?.params && settingsChanged(row.rates.params, today.params) === false)
  check('C4: its inputs are the quote', !!row?.inputs && !payloadsDiffer({ q: row.inputs }, { q: QUOTE }))

  let before = await fp(term.oppId)
  const again = await take(term.oppId, { kind: 'term_quote', inputs: QUOTE, reason: `${TAG} again`, expected_revision: await rev(term.oppId) })
  check('C5: the same quote again is "no change", nothing written', again.status === 409 && /No change since V/.test(again.data?.error ?? '') && before === await fp(term.oppId), `${again.status} ${again.data?.error ?? ''}`)
  const none = await take(term.oppId, { kind: 'term_quote', inputs: { ...QUOTE, units: { safesight: 0 } }, reason: `${TAG} no units`, expected_revision: await rev(term.oppId) })
  check('C5: a quote with no units is refused in the engine\'s words, nothing written', none.status === 400 && /Enter at least one unit/.test(none.data?.error ?? '') && before === await fp(term.oppId), `${none.status} ${none.data?.error ?? ''}`)

  // ── C6 ────────────────────────────────────────────────────────────────
  before = await fp(term.oppId)
  const wrong = await take(term.oppId, { inputs: { ssNew: 10, targetMargin: 30 }, rates: { rates: { ssUnitCost: 1 } }, reason: `${TAG} commercials on a term record`, expected_revision: await rev(term.oppId) })
  check('C6: a Commercials version on a term record is refused, nothing written', wrong.status === 409 && /priced by Term quote/.test(wrong.data?.error ?? '') && before === await fp(term.oppId), `${wrong.status} ${wrong.data?.error ?? ''}`)

  // ── C7, C8 ────────────────────────────────────────────────────────────
  const issued = v.data?.id ? await tryApi('POST', `/deal-sheet-versions/${v.data.id}/issue`, {}) : { status: 'no version' }
  const after = v.data?.id ? must(await svc.from('deal_sheet_versions').select('status, frozen_figures').eq('id', v.data.id).single(), 'issued row') : null
  check('C7: the term version is submitted', issued.status === 200 && after?.status === 'issued', `${issued.status} ${issued.data?.error ?? ''}`)
  check('C7: it froze the quote\'s figures', after?.frozen_figures?.kind === 'term_quote' && after?.frozen_figures?.page?.ask?.baseTcv === expected.tcv,
    `${after?.frozen_figures?.kind} ${after?.frozen_figures?.page?.ask?.baseTcv}`)
  const page = await tryApi('GET', `/opportunities/${term.oppId}/approval-page`)
  check('C7: the approval page reads the frozen Base TCV', page.data?.ask?.kind === 'term_quote' && page.data?.ask?.baseTcv === expected.tcv && page.data?.frozen?.state === 'frozen',
    `${page.status} ${page.data?.ask?.kind} ${page.data?.ask?.baseTcv} ${page.data?.frozen?.state}`)
  const restored = v.data?.id ? await tryApi('POST', `/deal-sheet-versions/${v.data.id}/restore`, {}) : {}
  check('C8: restore says the inputs are a term quote', restored.data?.kind === 'term_quote' && !!restored.data?.inputs && !payloadsDiffer({ q: restored.data.inputs }, { q: QUOTE }))

  // ── C9 ────────────────────────────────────────────────────────────────
  must(await svc.from('records').update({ status: 'Closed Won' }).eq('id', term.oppId).select('id').single(), 'the win (admin stage write)')
  must(await svc.from('records').update({ status: 'Closed Won' }).eq('id', comm.oppId).select('id').single(), 'the win (admin stage write)')
  before = await fp(term.oppId)
  const wonTerm = await take(term.oppId, { kind: 'term_quote', inputs: { ...QUOTE, termMonths: 60 }, reason: `${TAG} after the win`, expected_revision: await rev(term.oppId) })
  check('C9: a term version on a Closed Won record is 409 in the ruled wording, nothing written', wonTerm.status === 409 && wonTerm.data?.error === CLOSED_WON_PRICING_REFUSAL && before === await fp(term.oppId), `${wonTerm.status} ${wonTerm.data?.error ?? ''}`)
  const commPayload = (await payloadOf(comm.oppId)).payload
  const commBefore = await fp(comm.oppId)
  // Real frozen rates, built the way the Commercials screen builds them, so the
  // route's own checks pass and the refusal is the database's (Verification 14).
  const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
  const commInputs = { ...commPayload, ssNew: 10, duration: 36, targetMargin: 30 }
  const wonComm = await take(comm.oppId, { inputs: commInputs, rates: frozenRates(resolveRates(commInputs, LIVE)), reason: `${TAG} commercials after the win`, expected_revision: await rev(comm.oppId) })
  check('C9: a Commercials version on a Closed Won record is 409 in the ruled wording, nothing written', wonComm.status === 409 && wonComm.data?.error === CLOSED_WON_PRICING_REFUSAL && commBefore === await fp(comm.oppId), `${wonComm.status} ${wonComm.data?.error ?? ''}`)
  const wonPatch = await tryApi('PATCH', `/opportunities/${term.oppId}`, { payload: { termQuote: { ...QUOTE, termMonths: 60 } }, expected_revision: await rev(term.oppId) })
  check('C9: a termQuote change on a Closed Won record is 409 in the ruled wording', wonPatch.status === 409 && wonPatch.data?.error === CLOSED_WON_PRICING_REFUSAL, `${wonPatch.status} ${wonPatch.data?.error ?? ''}`)
} finally {
  await tearDown(`${TAG}-t`)
  await tearDown(`${TAG}-c`)
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
