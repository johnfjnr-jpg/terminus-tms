// ── THE NO-FREEZE GUARANTEE RESTS ON ONE FIELD. PROVE IT ──────────────────
//
// Internal review item 4, ruled: test the no-freeze behaviour directly rather
// than inferring it from the trigger's text.
//
// The whole guarantee is `refuse_write_while_frozen`'s `and kind = 'transition'`
// clause. A version approval is collected on a `kind='review'` request, which
// the clause does not match, so the record stays editable while sign-off is
// gathered. That is one word in one WHERE clause carrying a model.
//
// So it is exercised in BOTH directions on the same record: a review request
// leaves the record writable, and flipping that one field to 'transition'
// brings the freeze back. The second half is the calibration - without it, a
// record that was never frozen for some unrelated reason would read as a pass.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api, ApiError } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}

const TAG = process.argv[2] ?? 'R41NOFREEZE'
const { oppId } = await freshOpportunity(`${TAG}NF`)

const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const write = async () => {
  try {
    await api('PATCH', `/opportunities/${oppId}`,
      { payload: { targetMargin: 30 + Math.floor((await rev()) % 7) }, expected_revision: await rev() })
    return { ok: true }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    return { ok: false, status: e.status, error: e.body?.error ?? '' }
  }
}

// A baseline, so "writable" is shown to be true before anything is raised
// rather than assumed from the absence of a refusal.
record('the record is writable to begin with', (await write()).ok)

// ── A PRICING APPROVAL: the real version-gate shape ──────────────────────
//
// This raised a bare `kind='review'` with no version, which stopped being a
// thing the route accepts: a review IS a pricing approval, held against an
// issued major version, and one without a version would collect nothing.
//
// Set up as the real feature rather than as a synthetic review, which also
// makes the no-freeze claim a claim about something a person actually does.
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const INPUTS = { targetMargin: 30 }
const draft = (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs: INPUTS, rates: frozenRates(resolveRates(INPUTS, LIVE)),
    reason: 'no-freeze probe', expected_revision: await rev() })).data
const issued = (await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})).data
// Pricing approval applies from Proposal onward, where the version gate is.
await admin().from('records').update({ status: 'Proposal' }).eq('id', oppId)

const review = (await api('POST', `/records/${oppId}/transition-requests`,
  { to_stage: 'Evaluation', kind: 'review', version_id: issued.id })).data
record('a pricing-approval request opens', review?.status === 'open' && review?.kind === 'review',
  `kind=${review?.kind} status=${review?.status} version=V${issued?.major}`)

const underReview = await write()
record('THE RECORD STAYS EDITABLE while a review request is open',
  underReview.ok,
  underReview.ok ? 'the write landed' : `refused ${underReview.status}: ${underReview.error.slice(0, 60)}`)

// ── THE CALIBRATION: one field, flipped ─────────────────────────────────
//
// Nothing else changes. If the record is still writable now, the guarantee
// above was not being carried by `kind` and the probe proved nothing.
const { error: flipErr } = await admin().from('transition_requests')
  .update({ kind: 'transition' }).eq('id', review.id)
if (flipErr) record('the calibration could flip the kind', false, flipErr.message)

const asTransition = await write()
record('flipping kind to "transition" BRINGS THE FREEZE BACK',
  !asTransition.ok && /frozen/i.test(asTransition.error),
  asTransition.ok ? 'the record is still writable, so kind is not what carries the guarantee'
    : `refused ${asTransition.status}: ${asTransition.error.slice(0, 60)}`)

// And back, so the direction is shown to be reversible rather than one-way.
await admin().from('transition_requests').update({ kind: 'review' }).eq('id', review.id)
const backToReview = await write()
record('and flipping it back to "review" releases it again', backToReview.ok,
  backToReview.ok ? 'the write landed again' : `still refused: ${backToReview.error.slice(0, 60)}`)

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.label}`)
process.exit(failed.length ? 1 : 0)
