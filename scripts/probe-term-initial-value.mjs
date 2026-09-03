// ── THE FACTORING TERM IS AN INITIAL VALUE, AND STRUCTURE-DEPENDENT ──────
//
// W5, ruled 2026-09-03. Architecture 11's property proven on the field that was
// thought to be breaking it.
//
// THE RULING'S PREMISE WAS CORRECTED BY MEASUREMENT FIRST, and that correction
// is why this probe asserts what it does. The report said the server applied the
// default on EVERY write; measured, it fires only on the TRANSITION into
// enabled with the term absent, so a cleared term already stayed cleared and
// there was no `|| 12` fallback to remove. Removing it would have deleted the
// hybrid default outright.
//
// What was genuinely missing is the structure split. The 2026-08-30 default
// carries the note "Hybrid factoring term. Two-phase follows the recovery
// period"; only the hybrid half had been built. W5 and that note are one rule at
// two structures, which is Verification 23 resolved by reading the existing
// decision rather than taking a second one.
import { freshOpportunity, tearDown } from './fixtures.mjs'
import { api } from './api-client.mjs'

const results = []
const record = (label, pass, detail = '') => {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`)
}
const TAG = process.argv[2] ?? 'R41IV'

const deal = async (tag) => {
  const { oppId } = await freshOpportunity(tag)
  const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data?.latest_revision_number
  const payload = async () => (await api('GET', `/opportunities/${oppId}`)).data?.payload ?? {}
  const patch = async (p) => api('PATCH', `/opportunities/${oppId}`, { payload: p, expected_revision: await rev() })
  return { oppId, payload, patch }
}
const enable = { enabled: true, ratePct: 1.5, method: 'straight' }

// ── 1. A TWO-PHASE DEAL TAKES THE RECOVERY PERIOD AT ENTRY ───────────────
const a = await deal(`${TAG}A`)
await a.patch({ structure: 'twoPhase', recoveryMonths: 30 })
await a.patch({ factoring: enable })
let p = await a.payload()
record('a two-phase deal takes the RECOVERY PERIOD as its initial term',
  p.factoring?.termMonths === 30, `recovery=${p.recoveryMonths} -> term=${p.factoring?.termMonths}`)

// ── 2. A HYBRID DEAL TAKES THE ADMIN DEFAULT ─────────────────────────────
const b = await deal(`${TAG}B`)
await b.patch({ structure: 'hybrid' })
await b.patch({ factoring: enable })
p = await b.payload()
record('a hybrid deal takes the ADMIN DEFAULT of 12',
  p.factoring?.termMonths === 12, `term=${p.factoring?.termMonths}`)

// ── 3. AN OVERRIDE IS NEVER OVERWRITTEN, ON EITHER STRUCTURE ─────────────
for (const [tag, structure, extra] of [['C', 'twoPhase', { recoveryMonths: 30 }], ['D', 'hybrid', {}]]) {
  const d = await deal(`${TAG}${tag}`)
  await d.patch({ structure, ...extra })
  await d.patch({ factoring: { ...enable, termMonths: 7 } })
  const q = await d.payload()
  record(`an override on a ${structure} deal is not overwritten`,
    q.factoring?.termMonths === 7, `term=${q.factoring?.termMonths}`)
}

// ── 4. CLEARED STAYS CLEARED, WHICH IS THE ARCHITECTURE 11 PROPERTY ──────
const e = await deal(`${TAG}E`)
await e.patch({ structure: 'twoPhase', recoveryMonths: 30 })
await e.patch({ factoring: enable })
record('the term starts recorded', (await e.payload()).factoring?.termMonths === 30)
await e.patch({ factoring: { ...enable, termMonths: null } })
p = await e.payload()
record('clearing the term returns NULL, not the default',
  p.factoring?.termMonths === null, `term=${JSON.stringify(p.factoring?.termMonths)}`)
// Saved and read back again: the clear must survive a second write that leaves
// the term alone, which is what "stays cleared" means in practice.
await e.patch({ targetMargin: 31 })
p = await e.payload()
record('and it is STILL cleared after a later unrelated save',
  p.factoring?.termMonths === null, `term=${JSON.stringify(p.factoring?.termMonths)}`)

// ── 5. NOTHING TO FOLLOW MEANS NOTHING WRITTEN ───────────────────────────
// A two-phase deal with no recovery period has no value to take. Writing one
// would be the fallback this whole change exists to avoid.
const f = await deal(`${TAG}F`)
await f.patch({ structure: 'twoPhase' })
const beforeF = await f.payload()
await f.patch({ factoring: enable })
p = await f.payload()
const noRecovery = beforeF.recoveryMonths === undefined || beforeF.recoveryMonths === null
if (!noRecovery) {
  // THE STATE IS UNREACHABLE THIS WAY, and saying so beats passing. Moving to
  // two-phase applies the recovery-period default in the same transition, so a
  // two-phase deal never HAS an absent recovery period at the moment factoring
  // is switched on. The first version of this check `!noRecovery || ...` and
  // reported PASS without testing anything - Verification 14, a comparison
  // reached with nothing on either side.
  console.log(`SKIP  a two-phase deal cannot have an absent recovery period at this point: `
    + `the structure change defaults it to ${beforeF.recoveryMonths}, so the branch is `
    + `unreachable from outside and the term correctly follows it`)
  record('and the term follows that defaulted recovery period',
    p.factoring?.termMonths === beforeF.recoveryMonths,
    `recovery=${beforeF.recoveryMonths} -> term=${JSON.stringify(p.factoring?.termMonths)}`)
} else {
  record('a two-phase deal with no recovery period records no term',
    p.factoring?.termMonths === undefined || p.factoring?.termMonths === null,
    `recovery=absent -> term=${JSON.stringify(p.factoring?.termMonths)}`)
}

await tearDown()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
for (const f2 of failed) console.log(`  FAILED: ${f2.label}`)
process.exit(failed.length ? 1 : 0)
