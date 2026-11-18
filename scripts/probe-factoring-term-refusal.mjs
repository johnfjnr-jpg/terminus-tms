#!/usr/bin/env node
// ── COMMERCIALS_FACTORING R-CF2, OVER HTTP (Verification 40) ────────────────
//
//   node --env-file=.env scripts/probe-factoring-term-refusal.mjs
//
// The Opportunity PATCH route gained a refusal: a factoring term must end
// inside the contract, refused ONLY when the save CHANGES the duration, the
// factoring term or the switch (John 2026-11-16, narrowed). This exercises it
// from outside, as the signed-in user, on the SUCCESS path as well as the
// refusal, and reads back what LANDED rather than trusting a status.
//
// THE OVER-LIMIT RECORD IS BUILT DIRECTLY, AND SAYS SO (Verification 47's
// clause). After this change the route cannot produce a term past its contract,
// which is the point; the legacy state (TT-SGP-SMARTC-003's 36 on 36) is
// appended through the database's own `append_record_revision`, the function
// every write path calls, as the same user. The route reads only the stored
// payload, never how it got there.
//
// WIRED by PROBE_TRIAGE (R2, John 2026-11-18): a gate stage. Needs a live
// server and a session.
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { readFileSync } from 'node:fs'

const USER = JSON.parse(readFileSync(new URL('../session-ref.json', import.meta.url).pathname, 'utf8')).user?.id
const SENTENCE = (n, T) => `The factoring term must be a whole number of months from 1 to ${n}, so every repayment falls inside the ${T}-month contract.`
const results = []
const check = (label, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`) }
const rev = async (id) => (await api('GET', `/records/${id}/pulse`)).data.revision_number
const stored = async (id) => (await api('GET', `/opportunities/${id}`)).data?.payload ?? {}
const patch = (id, payload, expected, opts) => api('PATCH', `/opportunities/${id}`, { payload, expected_revision: expected }, opts)
const FX = (termMonths, enabled = true) => ({ enabled, ratePct: 2, termMonths, method: 'straight' })

const opp = await freshOpportunity('cftermref')
try {
  // The success path first: a valid facility saves, and lands.
  let r = await rev(opp.oppId)
  await patch(opp.oppId, { duration: 36, factoring: FX(12) }, r)
  let p = await stored(opp.oppId)
  check('a 12-month facility on a 36-month contract saves, and lands', p.duration === 36 && p.factoring?.termMonths === 12, JSON.stringify(p.factoring))

  r = await rev(opp.oppId)
  await patch(opp.oppId, { factoring: FX(35) }, r)
  check('35 months, the longest inside 36, saves', (await stored(opp.oppId)).factoring?.termMonths === 35)

  // Refused: the term changed past the limit.
  r = await rev(opp.oppId)
  let res = await patch(opp.oppId, { factoring: FX(36) }, r, { expect: 400, because: 'a 36-month term cannot end inside a 36-month contract' })
  check('a term CHANGED to 36 on a 36-month contract is refused, in the term screen\'s words', res.data?.error === SENTENCE(35, 36), res.data?.error)
  check('and nothing landed', (await stored(opp.oppId)).factoring?.termMonths === 35 && (await rev(opp.oppId)) === r)

  // Refused: the contract shortened under the term.
  res = await patch(opp.oppId, { duration: 24 }, r, { expect: 400, because: 'a 24-month contract cannot hold a 35-month term' })
  check('a contract SHORTENED under the term is refused', res.data?.error === SENTENCE(23, 24), res.data?.error)

  // Refused: switching factoring on with a term past the end.
  r = await rev(opp.oppId)
  await patch(opp.oppId, { factoring: FX(40, false) }, r)
  check('with factoring OFF a long term is not a facility, so it saves', (await stored(opp.oppId)).factoring?.termMonths === 40)
  r = await rev(opp.oppId)
  res = await patch(opp.oppId, { factoring: FX(40, true) }, r, { expect: 400, because: 'switching on a facility that runs past the contract' })
  check('switching factoring ON with a term past the end is refused', res.data?.error === SENTENCE(35, 36), res.data?.error)

  // The legacy state, built directly (see the header), then saved on OTHER fields.
  const { error } = await admin().rpc('append_record_revision', {
    p_record_id: opp.oppId, p_patch: { duration: 36, factoring: FX(36) }, p_created_by: USER, p_remove: [], p_expected_revision: null,
  })
  check('the legacy over-limit state is built (36 on 36, as TT-SGP-SMARTC-003)', !error, error?.message)
  r = await rev(opp.oppId)
  res = await patch(opp.oppId, { targetMargin: 41 }, r)
  p = await stored(opp.oppId)
  check('R-CF2 narrowed: the over-limit record stays SAVEABLE on another field', res.status === 200 && p.targetMargin === 41 && p.factoring?.termMonths === 36, `status ${res.status}`)
  r = await rev(opp.oppId)
  res = await patch(opp.oppId, { duration: 36, factoring: FX(36), targetMargin: 42 }, r)
  check('and on a client-style save that RESENDS the unchanged duration and facility', res.status === 200 && (await stored(opp.oppId)).targetMargin === 42, `status ${res.status}`)
} finally {
  await tearDown('cftermref')
}
const failed = results.filter((x) => !x).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
