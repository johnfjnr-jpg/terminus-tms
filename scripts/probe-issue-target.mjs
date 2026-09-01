// The issue target, through the full sequence the walk hit. Round 41.
//
// Ruled: the target is the latest draft created AFTER the most recent issue.
// A draft older than the last issued version is never a target, and when no
// newer draft exists there is nothing to issue.
//
// THE PREMISE, CONFIRMED BY MEASUREMENT RATHER THAN ASSUMED: a save does not
// create a draft. PATCH /opportunities/:id never touches deal_sheet_versions, so
// moving the record past an issued version leaves nothing to issue. That is why
// the control can legitimately be empty, and this probe asserts it directly.
import { api, ApiError } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const results = []
const record = (label, pass, detail) => {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}  ${detail}`)
}

const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (i) => frozenRates(resolveRates(i, LIVE))
const { oppId } = await freshOpportunity('issue-target')
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data.latest_revision_number
const versions = async () => (await api('GET', `/opportunities/${oppId}/deal-sheet-versions`)).data ?? []
const takeVersion = async (margin, reason) => {
  const base = (await api('GET', `/opportunities/${oppId}`)).data.payload
  const inputs = { ...base, targetMargin: margin, duration: 36, lumpSumCost: 0 }
  return (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs, reason, rates: priced(inputs), expected_revision: await rev() })).data
}
const issue = async (id) => (await api('POST', `/deal-sheet-versions/${id}/issue`, {})).data
const tryIssue = async (id) => {
  try { return { status: 200, data: await issue(id) } }
  catch (e) { if (!(e instanceof ApiError)) throw e; return { status: e.status, data: e.body } }
}

// ── 1. A SAVE DOES NOT CREATE A DRAFT ────────────────────────────────────
const before = (await versions()).length
await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 29 }, expected_revision: await rev() })
record('1. a SAVE moves the revision and creates no draft',
  (await versions()).length === before,
  `versions ${before} -> ${(await versions()).length}, record now at revision ${await rev()}`)

// ── 2. Build the walk's shape: two drafts, issue the later one ───────────
const stranded = await takeVersion(28, 'stranded draft')
await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 27 }, expected_revision: await rev() })
const second = await takeVersion(27, 'second draft')
const v1 = await issue(second.id)
record('2. the newer of two drafts issues', v1.status === 'issued',
  `V${v1.major} issued; V${stranded.major}.${stranded.minor} left as a draft`)

// ── 3. THE STRANDED DRAFT IS NOT A TARGET ────────────────────────────────
const refused = await tryIssue(stranded.id)
record('3. the stranded draft is REFUSED, not offered', refused.status === 409,
  `-> ${refused.status} ${JSON.stringify((refused.data?.error ?? '').slice(0, 74))}`)
record('3b. and the refusal says to restore it, not to retry',
  /Restore it/.test(refused.data?.error ?? ''), 'names the act that would work')

// ── 4. MOVE THE RECORD PAST THE ISSUE: nothing to issue ──────────────────
await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 26 }, expected_revision: await rev() })
const vs = await versions()
const highestIssued = vs.find((v) => v.status === 'issued')?.major ?? 0
const target = vs.find((v) => v.status === 'draft' && v.major === highestIssued)
record('4. with the record moved on, there is NO issue target',
  target === undefined,
  `highest issued V${highestIssued}; drafts present: ${vs.filter(v => v.status === 'draft').map(v => `V${v.major}.${v.minor}`).join(', ') || 'none'}`)

// ── 5. SAVING A VERSION CREATES THE TARGET, and it is V<issued>.1 ────────
const fresh = await takeVersion(26, 'current pricing')
record('5. saving a version creates the target, numbered after the issue',
  fresh.status === 'draft' && fresh.major === highestIssued,
  `V${fresh.major}.${fresh.minor}, which the control offers as "Issue V${fresh.major}.${fresh.minor} as V${highestIssued + 1}"`)

// ── 6. AND IT ISSUES, as the next major ──────────────────────────────────
const v2 = await issue(fresh.id)
record('6. it issues as the next major', v2.status === 'issued' && v2.major === highestIssued + 1,
  `V${v2.major}, and the stranded V${stranded.major}.${stranded.minor} is still a draft and still not a target`)

const { removed } = await tearDown()
record('teardown', true, `${removed.length} soft-deleted, re-queried 0 live`)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { for (const f of failed) console.log(`  FAILED: ${f.label}`); process.exit(1) }
