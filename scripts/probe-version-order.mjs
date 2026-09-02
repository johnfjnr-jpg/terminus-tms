// ── CAN (major, minor) ORDER DISAGREE WITH revision_number ORDER? ──────────
//
// Round 41. issuedProposal ordered two VERSIONS by the OPPORTUNITY's revision
// number. This probe constructs the state where the two orders disagree, before
// any fix, so the fix is calibrated against a case that actually occurs rather
// than asserted against one that cannot.
//
// THE MECHANISM: issuing sets major = highestIssued + 1, minor = 0, and NEVER
// touches revision_number. A version keeps the revision it was created at. So a
// draft created at the same revision as the version that was later issued
// compares EQUAL on revision_number while (major, minor) says it is stranded.
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { api } from './api-client.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'
import { issuedProposal } from '../src/lib/transition-requests.js'

const results = []
const record = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

// Same shape as the other probes: the tag comes from argv so a gate run and a
// hand run cannot collide on the fixture's contact email.
const TAG = process.argv[2] ?? 'R41ORDER'
const { oppId } = await freshOpportunity(`${TAG}ORD`)
// `latest_revision_number` is the normalised key from the X3 handshake work.
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
const versions = async () => admin().from('deal_sheet_versions')
  .select('id, major, minor, status, revision_number, inputs').eq('record_id', oppId)
  .order('major', { ascending: true }).order('minor', { ascending: true })
  .then(r => { if (r.error) throw r.error; return r.data })

// Through the same functions the tab and the submit route use, never a
// hardcoded set: the route requires exactly the keys the catalog produced.
const LIVE_RATES = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const priced = (inputs) => frozenRates(resolveRates(inputs, LIVE_RATES))
const BASE = { targetMargin: 30 }

const r0 = await rev()
const mk = async (inputs, reason) => (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
  { inputs, rates: priced(inputs), reason, expected_revision: await rev() })).data

const v1 = await mk(BASE, 'first draft')
const v2 = await mk({ ...BASE, targetMargin: 31 }, 'second draft')
const rAfterSaves = await rev()
record('taking a version does not move the record',
  rAfterSaves === r0, `revision ${r0} -> ${rAfterSaves}`)

const beforeIssue = await versions()
record('two drafts share one revision_number',
  beforeIssue.length === 2 && beforeIssue[0].revision_number === beforeIssue[1].revision_number,
  beforeIssue.map(v => `V${v.major}.${v.minor}@rev${v.revision_number}`).join(' '))

// Issue the LATEST draft, per the issue-target rule. V0.1 is left stranded.
const issue = (await api('POST', `/deal-sheet-versions/${v2.id}/issue`, {})).data
record('the latest draft issues', issue?.status === 'issued',
  `V${issue?.major}.${issue?.minor}`)

const after = await versions()
const stranded = after.find(v => v.status === 'draft')
const live = after.find(v => v.status === 'issued')
record('the stranded draft survives with a LOWER major',
  stranded?.major < live?.major,
  `draft V${stranded?.major}.${stranded?.minor} vs issued V${live?.major}.${live?.minor}`)

// ── THE DISAGREEMENT, MEASURED ────────────────────────────────────────────
const byRevision = stranded?.revision_number >= live?.revision_number
const byVersion = stranded?.major === live?.major
record('THE TWO ORDERS DISAGREE on this record',
  byRevision !== byVersion,
  `revision_number says later=${byRevision}, (major,minor) says later=${byVersion}`)

// ── WHAT issuedProposal DOES WITH IT ──────────────────────────────────────
//
// The record is first brought into line with the ISSUED price, so the pricing
// comparison passes and the later-draft check is the thing being measured.
// Without this the probe would exercise the refusal above it and report a
// failure that says nothing about version ordering.
await api('PATCH', `/opportunities/${oppId}`,
  { payload: { targetMargin: 31 }, expected_revision: await rev() })

const { data: revRow } = await admin().from('record_revisions').select('payload')
  .eq('record_id', oppId).order('revision_number', { ascending: false }).limit(1)
const verdict = issuedProposal(after, revRow[0].payload)
console.log(`\n  issuedProposal -> ok=${verdict.ok}  ${verdict.reason ?? ''}`)

// ── THE SECOND HALF OF THE CLAIM, MEASURED ────────────────────────────────
//
// Verification 26: "it demands a draft the issue route refuses" is a separate
// claim from "it demands a draft", and it needs its own evidence. Asking the
// issue route directly rather than inferring it from the stranded rule.
let strandedRefusal = null
try {
  await api('POST', `/deal-sheet-versions/${stranded.id}/issue`, {})
} catch (e) { strandedRefusal = e.body?.error ?? String(e) }
record('the issue route REFUSES the stranded draft',
  /drafted before|not the next version/.test(strandedRefusal ?? ''),
  strandedRefusal ?? '(it was accepted, so there is no dead end)')

record('a stranded draft does NOT block the transition',
  verdict.ok === true,
  verdict.ok ? '' : 'it demands a draft be issued that the issue route refuses as stranded')

// ── THE OTHER DIRECTION, or the fix passes by never blocking anything ─────
//
// A draft saved AFTER the issue is V1.1: same major as V1.0, so it IS newer and
// must still block. Verification 9 - a detector never shown firing is an
// assertion. And unlike the stranded one, this draft is genuinely issuable, so
// the instruction the refusal gives can actually be followed.
const fresh = await mk({ ...BASE, targetMargin: 32 }, 'a draft AFTER the issue')
const afterFresh = await versions()
const freshRow = afterFresh.find((v) => v.id === fresh.id)
record('a draft saved after the issue shares the issued major',
  freshRow?.major === live?.major,
  `V${freshRow?.major}.${freshRow?.minor} against issued V${live?.major}.${live?.minor}`)

const blocked = issuedProposal(afterFresh, revRow[0].payload)
record('a genuinely newer draft STILL blocks the transition',
  blocked.ok === false && /draft version that has not been issued/.test(blocked.reason ?? ''),
  blocked.ok ? 'it passed, so the check no longer fires at all' : 'refused, as it must')

// And the instruction it gives is one the system will accept.
let freshRefusal = null
try {
  await api('POST', `/deal-sheet-versions/${fresh.id}/issue`, {})
} catch (e) { freshRefusal = e.body?.error ?? String(e) }
record('and THAT draft is one the issue route accepts',
  freshRefusal === null,
  freshRefusal ?? 'no dead end: the refusal names an act that works')

await tearDown()
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f of failed) console.log(`  FAILED: ${f.name}`)
process.exit(failed.length ? 1 : 0)
