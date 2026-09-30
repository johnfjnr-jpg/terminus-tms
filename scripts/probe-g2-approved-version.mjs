// ── G2: A PROMOTED MAJOR IS "AWAITING APPROVAL", NOT "THE APPROVED VERSION" ─
//
// R-L4a's claim, driven end to end rather than reasoned about.
//
// Phase 0 measured that `issued_major` is the highest major whose STATUS is
// `issued`, and that status is written by PROMOTION: no approval track enters
// it. So the field labelled "Approved version" could name a version nobody had
// signed. This proves it no longer does, and that the promoted version is still
// VISIBLE in its own right rather than having been hidden.
//
// BOTH DIRECTIONS. A field that always reads "None" would pass the first half
// and be useless, so the second half signs the version and watches it appear.
//
// UNWIRED: needs a live server and a session.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { approvedVersionOf, issuedMajor } from '../src/lib/opportunity-headline.js'
import { linkApprovalsToVersions, VERSION_SCOPE } from '../src/lib/version-approval.js'
import { versionLabel } from '../src/lib/version-label.js'

const TAG = 'G2APPROVED'
const checks = []
const check = (ok, what, detail = '') => {
  checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`)
}

const { oppId } = await freshOpportunity(TAG)
const headline = async () => (await api('GET', `/opportunities/${oppId}`)).data
const rev = async () => (await headline())?.latest_revision_number
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const mk = async (inputs, reason) => (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs, rates: frozenRates(resolveRates(inputs, LIVE)), reason, expected_revision: await rev() })).data

// ── 1. WHAT SETS issued_major, MEASURED RATHER THAN READ ────────────────
const draft = await mk({ targetMargin: 30 }, 'the draft')
const before = await headline()
check(before.issued_major === null || before.issued_major === undefined,
  'a draft alone sets no issued_major', `issued_major=${before.issued_major}`)

const promoted = (await api('POST', `/deal-sheet-versions/${draft.id}/issue`, {})).data
const after = await headline()
check(after.issued_major === promoted.major,
  'PROMOTION alone sets issued_major, with no approval anywhere',
  `promoted ${versionLabel(promoted)}, issued_major=${after.issued_major}`)

// ── 2. AND THE APPROVED VERSION FIELD DOES NOT FOLLOW IT ────────────────
check(after.approved_version === null,
  'the Approved version field reads NOTHING for a promoted-but-unsigned major',
  `approved_version=${JSON.stringify(after.approved_version)}`)
check(after.working_version && /V\d+\.\d+/.test(after.working_version),
  'and the Working version still names it, carrying its minor',
  `working_version=${JSON.stringify(after.working_version)}`)

// ── 3. THE VERSION IS STILL VISIBLE, AS AWAITING APPROVAL ───────────────
//
// R-L4a hides nothing: it stops the HEADLINE claiming approval. The version
// itself must still be there, in its own state, or the change has lost a fact
// rather than corrected one.
const { data: rows } = await admin().from('deal_sheet_versions')
  .select('major, minor, status').eq('record_id', oppId)
const promotedRow = rows.find((r) => r.status === 'issued')
check(!!promotedRow, 'the promoted version is still present and still `issued` in the DB',
  promotedRow ? `V${promotedRow.major}.${promotedRow.minor}/${promotedRow.status}` : 'missing')

// ── 4. THE OTHER DIRECTION: SIGN IT, AND THE FIELD NAMES IT ─────────────
//
// Computed through the SAME derivation the route calls, with approvals built
// the way the system builds them: an approval is linked to a version through
// the request that froze it (`linkApprovalsToVersions`), never by a revision
// coincidence, which is the join a previous round had to correct.
const db = admin()
const { data: vRules } = await db.from('stage_gate_rules')
  .select('requirement_detail').eq('record_type', 'opportunity')
  .eq('requirement_type', 'approval_obtained')
const tracks = [...new Set((vRules ?? [])
  .filter((r) => (r.requirement_detail?.scope ?? '') === VERSION_SCOPE)
  .map((r) => r.requirement_detail?.track).filter((t) => typeof t === 'string' && t.length))]
check(tracks.length > 0, 'the record type has version-scoped tracks to satisfy', tracks.join(', '))

const { data: full } = await db.from('deal_sheet_versions')
  .select('id, major, minor, status, revision_number, inputs').eq('record_id', oppId)
const latestRev = await rev()
const payload = (await headline())?.payload ?? {}

const none = approvedVersionOf({ versions: full, approvals: [], latestRevision: latestRev, tracks, payload })
check(none === null, 'with nothing signed, the derivation reports no approved version')

const signed = tracks.map((t) => ({
  track: t, decision: 'approved', revision_number: promoted.revision_number,
  approver_id: 'someone', decided_at: '2026-09-30T00:00:00Z',
  request_id: 'req-1',
}))
const linked = linkApprovalsToVersions(signed, [{ id: 'req-1', frozen_version_id: promoted.id }])
const got = approvedVersionOf({ versions: full, approvals: linked, latestRevision: latestRev, tracks, payload })
check(!!got, 'with EVERY track signed, the derivation names a version')
check(got && versionLabel(got) === versionLabel(promoted),
  'and it is the one that was signed, with its stored minor',
  got ? versionLabel(got) : 'null')

// ── 5. PARTIAL IS NOT APPROVED, on the same fixture ─────────────────────
if (tracks.length > 1) {
  const partial = linkApprovalsToVersions(signed.slice(0, tracks.length - 1),
    [{ id: 'req-1', frozen_version_id: promoted.id }])
  const p = approvedVersionOf({ versions: full, approvals: partial, latestRevision: latestRev, tracks, payload })
  check(p === null, `${tracks.length - 1} of ${tracks.length} tracks signed is NOT approved`)
} else {
  check(false, 'only one track exists, so the partial case could not be driven',
    'reported rather than silently skipped')
}

console.log(`\n  issuedMajor() on the same rows: ${issuedMajor(full)}   (promotion)`)
console.log(`  approvedVersionOf() unsigned:   ${none}   (approval)`)

await tearDown(TAG)
const pass = checks.filter(Boolean).length
console.log(`\n${pass}/${checks.length} G2 checks passed`)
process.exitCode = pass === checks.length ? 0 : 1
