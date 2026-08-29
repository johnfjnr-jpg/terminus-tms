// Round 7 Phase 1, section 1.2 - reference-number atomicity and the
// 999 -> 1000 boundary. Runs under `npm run test:db`.
//
// These tests MUST hit a real database. The counter lives in Postgres,
// not JS: src/lib/reference-number.js only forwards to the
// issue_reference_number RPC, which does
//   insert ... on conflict (prefix) do update
//     set current_value = current_value + 1 returning current_value
// Testing the JS wrapper alone would prove nothing about atomicity.
//
// Every counter key here is derived from a per-run runTag, so these
// tests never touch a real counter and the "no gaps" assertion is
// measuring only this run's own traffic. reference_number_counters rows
// are never deleted - see Fixtures.teardown().

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { adminClient, newRunTag , retryOnClockSkew } from '../verify-harness.mjs'

let db, runTag
const COUNTRY = 'ZZT' // reserved-looking, not a real country in use

// The counter key the RPC builds is `${country}-${industry}` when no
// scheme is given, so a unique industry segment gives a unique counter.
const industryFor = (suffix) => `${runTag}${suffix}`.toUpperCase()

// Raw call. Only the two tests that assert scheme SEMANTICS use this
// directly, because those tests are about the null/'industry'/'account'
// keyspaces and cannot be namespaced away without testing nothing.
const issue = async (industry, scheme) => {
  const args = { p_country_code: COUNTRY, p_industry_code: industry }
  if (scheme !== undefined) args.p_scheme = scheme
  const { data, error } = await db.rpc('issue_reference_number', args)
  if (error) throw new Error(`issue_reference_number failed: ${error.message}`)
  return data
}

// Default for every test that just needs A counter rather than a
// specific keyspace. p_scheme = 'harness' puts the row at
// `harness:ZZT-<runTag><suffix>`, its own keyspace: filterable by a
// single prefix, structurally unable to collide with a real counter, and
// never confusable with one by eye. Nothing is deleted, so the
// Milestone 4 rule is untouched.
const HARNESS_SCHEME = 'harness'
const issueHarness = (industry) => issue(industry, HARNESS_SCHEME)
const harnessPrefix = (industry) => `${HARNESS_SCHEME}:${COUNTRY}-${industry}`

// 'TT-ZZT-<industry>-<number>' -> '<number>'
const numberPart = (ref) => ref.slice(ref.lastIndexOf('-') + 1)

before(() => { db = adminClient(); runTag = newRunTag() })

after(() => {
  // Deliberately empty of counter cleanup. Deleting a
  // reference_number_counters row is what caused the Milestone 4
  // collision, so these rows stay.
  //
  // They do accumulate, roughly one per counter-using test per run, and
  // that is an accepted cost, not a claim that they vanish. What keeps
  // them harmless is the keyspace: everything issued via issueHarness()
  // lands under the 'harness:' scheme prefix and can be listed or
  // reasoned about with a single filter. The two scheme-semantics tests
  // below are the deliberate exception - they must exercise the
  // unprefixed and 'account:' keyspaces to test them at all - and they
  // remain identifiable by the reserved ZZT country code.
})

test('999 to 1000 boundary: padding grows, nothing truncates', async () => {
  const industry = industryFor('B')
  const prefix = harnessPrefix(industry)

  // Seed the counter to 997 so the next four issues are 998..1001.
  // The RPC increments an existing row, so 997 -> 998 on first call.
  // Wrapped because this exact insert is where PGRST303 has landed twice. The
  // retry fires only on that code and announces itself; see retryOnClockSkew.
  const { error: seedErr } = await retryOnClockSkew('seed counter to 997', () =>
    db.from('reference_number_counters').insert({ prefix, current_value: 997 }))
  assert.equal(seedErr, null, `seeding the counter failed: ${seedErr?.message}`)

  const refs = []
  for (let i = 0; i < 4; i++) refs.push(await issueHarness(industry))
  const nums = refs.map(numberPart)

  assert.deepEqual(nums, ['998', '999', '1000', '1001'])

  // The specific regression this guards: migration
  // 20260814000001_fix_reference_number_1000_truncation.sql. lpad() to
  // width 3 would have cut 1000 back to three characters.
  assert.equal(nums[1].length, 3, '999 must stay zero-padded to 3 characters')
  assert.equal(nums[2].length, 4, '1000 must be 4 characters, not truncated to 3')
  assert.equal(nums[3].length, 4)

  // And the full reference string is still well formed either side.
  assert.equal(refs[1], `TT-${COUNTRY}-${industry}-999`)
  assert.equal(refs[2], `TT-${COUNTRY}-${industry}-1000`)
})

test('low numbers are zero-padded to three characters', async () => {
  const industry = industryFor('P')
  const first = await issueHarness(industry)
  assert.equal(numberPart(first), '001', 'a fresh counter must start at 001, not 1')
})

test('atomicity: 50 genuinely concurrent issues, no duplicates and no gaps', async () => {
  const industry = industryFor('C')
  const N = 50

  // Promise.all so the calls genuinely overlap. A sequential loop would
  // pass even if the RPC were not atomic at all, which is the whole
  // point of this test.
  const refs = await Promise.all(Array.from({ length: N }, () => issueHarness(industry)))
  const nums = refs.map(r => Number(numberPart(r)))

  const unique = new Set(nums)
  assert.equal(unique.size, N, `expected ${N} distinct numbers, got ${unique.size} - duplicates issued`)

  const sorted = [...nums].sort((a, b) => a - b)
  assert.equal(sorted[0], 1, 'a fresh counter must start at 1')
  assert.equal(sorted[N - 1], N, `expected the highest to be ${N}, got ${sorted[N - 1]} - gaps in the sequence`)
  for (let i = 0; i < N; i++) {
    assert.equal(sorted[i], i + 1, `gap or duplicate at position ${i}: got ${sorted[i]}`)
  }
})

test('namespace isolation: two schemes advance independent sequences', async () => {
  const industry = industryFor('N')

  // Same country and same segment string, different scheme. Round 5
  // introduced p_scheme precisely so an Account Number and a record
  // reference code cannot share a sequence when their segments collide.
  const industryFirst = await issue(industry, null)
  const accountFirst = await issue(industry, 'account')

  assert.equal(numberPart(industryFirst), '001')
  assert.equal(numberPart(accountFirst), '001',
    'the account scheme must start its own sequence, not continue the industry one')

  const industrySecond = await issue(industry, null)
  assert.equal(numberPart(industrySecond), '002',
    'the industry sequence must be unaffected by the account scheme issuing in between')

  // The scheme is an internal counter-key concern only; it must never
  // leak into the visible reference string.
  assert.equal(accountFirst, `TT-${COUNTRY}-${industry}-001`)
})

test('backwards compatibility: null and "industry" resolve to the same counter', async () => {
  const industry = industryFor('L')

  // This is the guarantee migration 20260817000000 was written to
  // preserve: every pre-existing key was unprefixed, so the default must
  // keep resolving to that same row rather than starting a new sequence.
  const viaNull = await issue(industry, null)
  const viaOmitted = await issue(industry)
  const viaIndustry = await issue(industry, 'industry')

  assert.deepEqual(
    [numberPart(viaNull), numberPart(viaOmitted), numberPart(viaIndustry)],
    ['001', '002', '003'],
    'null, omitted and "industry" must all advance one shared counter'
  )

  // And confirm directly that only the unprefixed key exists for it.
  const { data, error } = await db.from('reference_number_counters')
    .select('prefix, current_value')
    .in('prefix', [`${COUNTRY}-${industry}`, `industry:${COUNTRY}-${industry}`])
  assert.equal(error, null)
  assert.equal(data.length, 1, 'exactly one counter row should exist for this key')
  assert.equal(data[0].prefix, `${COUNTRY}-${industry}`)
  assert.equal(data[0].current_value, 3)
})
