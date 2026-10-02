#!/usr/bin/env node
// ── TERM_PRICING Phase 3: tables, RLS, and E3 over HTTP ──────────────────
//
//   node --env-file=.env scripts/term-pricing/probe-live.mjs
//
// Needs the running server on :3000, session-ref.json (john+test, NOT an
// admin) and session-ref-approver.json (john+test2), both live.
//
// WHAT IT PROVES, in order:
//   V  the migrations: both tables, 9 settings with decimals as strings, one
//      admin (John), and a non-admin's DIRECT PostgREST writes refused;
//   E3 non-admin GET says isAdmin false; non-admin PUT is 403 and moves
//      nothing; then, per John's ruling 2026-10-02, a TEMPORARY admin row for
//      john+test2: admin PUT ANCHOR_MARGIN 80% lands, updated_at advances and
//      updated_by is the admin's id; the change reaches every reader; an
//      invalid change is 400 and moves nothing; 90% is restored; the row is
//      DELETED and its removal proven (0 rows, and the PUT is 403 again).
//
// THE TEARDOWN IS IN A finally AND RUNS ON EVERY STOP PATH (Verification 44):
// the temporary admin row is deleted and ANCHOR_MARGIN restored to the seeded
// 90% whatever happened, and the final state is re-read and printed.
//
// `landed` is read from the TABLE, never from a status (Verification 40).
// Every Supabase call goes through `must` (Verification 8).
//
// The screen half of E3 (the 80% visible on the screen) is driven by
// probe-screen.mjs with --flow, between the admin PUT and the restore, so
// this probe pauses on request: --hold <file> waits for that file after the PUT.
//
// UNWIRED: needs a live server and two live sessions, and it writes to live
// configuration (temporarily, by ruling).

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as admin } from '../../src/supabase.js'
import { api, ApiError } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const JOHN = '75425a02-4750-470b-bcdc-fe83d0b01ac2'
const nonAdmin = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))
const tempAdmin = JSON.parse(readFileSync(`${ROOT}session-ref-approver.json`, 'utf8'))
const TEMP_ID = tempAdmin.user.id
const HOLD = process.argv.includes('--hold') ? process.argv[process.argv.indexOf('--hold') + 1] : null

const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
let failures = 0
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}
// Through the estate's throwing client (scripts/api-client.mjs), switching the
// session per call. A status the call did not expect comes back as a FAIL line
// with the status, rather than being thrown past the teardown.
const http = async (session, method, path, body, expect) => {
  process.env.TMS_ACCESS_TOKEN = session.access_token
  try {
    const r = await api(method, path, body, expect ? { expect, because: 'the probe asserts this refusal' } : {})
    return { status: r.status, json: r.data }
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, json: e.body?.got ?? e.body }
    throw e
  }
}
const userClient = (s) => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${s.access_token}` } }, auth: { persistSession: false },
})
const fingerprint = async () => must(await admin.from('term_pricing_settings')
  .select('key, value, updated_at, updated_by').order('key'), 'fingerprint')
const SEEDED_AM = { safesight: '90', air_quality: '90', hemir: '90' }
// jsonb does not keep key order (it reads back hemir, safesight, air_quality),
// so objects are compared with their keys sorted. The first run compared raw
// JSON strings and FAILED on a value that was correct.
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x))
const sameValue = (a, b) => canon(a) === canon(b)

// ── V: the migrations ────────────────────────────────────────────────────
const rows = await fingerprint()
check(rows.length === 9, 'term_pricing_settings holds 9 keys', String(rows.length))
const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
const decimals = [
  ...Object.values(byKey.ANCHOR_MARGIN), ...Object.values(byKey.SHORT_TERM_MARGIN),
  byKey.PROFIT_STEP, byKey.HW_UPFRONT_MARGIN, byKey.MARGIN_FLOOR, ...byKey.VOLUME_BANDS.map((b) => b.discountPct),
]
check(decimals.length > 0 && decimals.every((d) => typeof d === 'string'), 'every decimal is stored as a JSON string', decimals.join(','))
check(JSON.stringify(byKey.TERMS) === '[12,24,36,48,60,72,84,96,120]' && byKey.ANCHOR_TERM === 36, 'TERMS and ANCHOR_TERM as seeded')
const roles0 = must(await admin.from('system_roles').select('user_id, role'), 'system_roles')
check(roles0.length === 1 && roles0[0].user_id === JOHN && roles0[0].role === 'admin', 'system_roles holds exactly one row: John, admin', JSON.stringify(roles0))

const na = userClient(nonAdmin)
const before = JSON.stringify(await fingerprint())
const upd = await na.from('term_pricing_settings').update({ value: '"1"', updated_by: nonAdmin.user.id }).eq('key', 'MARGIN_FLOOR').select('key')
check(!upd.error && (upd.data ?? []).length === 0, 'a non-admin DIRECT update is refused by RLS (zero rows)', upd.error?.message ?? `${(upd.data ?? []).length} rows`)
const ins = await na.from('term_pricing_settings').upsert({ key: 'CURRENCY', value: '"XXX"', updated_by: nonAdmin.user.id }, { onConflict: 'key' }).select('key')
check(!!ins.error || (ins.data ?? []).length === 0, 'a non-admin DIRECT upsert is refused by RLS', ins.error?.message ?? 'no error')
const sr = await na.from('system_roles').insert({ user_id: nonAdmin.user.id, role: 'admin' }).select()
check(!!sr.error, 'a non-admin cannot grant itself admin (no insert policy)', sr.error?.message ?? 'INSERTED')
const seeOthers = must(await na.from('system_roles').select('user_id'), 'system_roles as non-admin')
check(seeOthers.length === 0, 'system_roles is own-row only: the non-admin sees no rows', String(seeOthers.length))
check(JSON.stringify(await fingerprint()) === before, 'and the settings table did not move')

// ── E3 ───────────────────────────────────────────────────────────────────
let inserted = false
try {
  const g = await http(nonAdmin, 'GET', '/term-pricing')
  check(g.status === 200 && g.json?.isAdmin === false && Object.keys(g.json?.settings ?? {}).length === 9,
    'non-admin GET: 200, isAdmin false, 9 settings', `${g.status} isAdmin=${g.json?.isAdmin}`)
  check(g.json?.costs?.safesight?.hwCost === '8000.00' && typeof g.json?.costs?.safesight?.hostingMonthly === 'string',
    'catalog costs arrive as decimal strings', JSON.stringify(g.json?.costs?.safesight))

  const fp1 = JSON.stringify(await fingerprint())
  const p403 = await http(nonAdmin, 'PUT', '/term-pricing/settings', { settings: { ANCHOR_MARGIN: { ...SEEDED_AM, safesight: '80' } } }, 403)
  check(p403.status === 403, 'non-admin PUT: 403', `${p403.status} ${p403.json?.error}`)
  check(JSON.stringify(await fingerprint()) === fp1, 'and nothing moved (fingerprint identical)')

  // The temporary admin row, by ruling. Logged with its id and time.
  must(await admin.from('system_roles').insert({ user_id: TEMP_ID, role: 'admin' }), 'INSERT temp admin')
  inserted = true
  const tmp = must(await admin.from('system_roles').select('user_id, role').eq('user_id', TEMP_ID), 'read temp admin')
  console.log(`INSERTED  system_roles (${TEMP_ID}, admin) at ${new Date().toISOString()}: ${tmp.length} row`)

  const ga = await http(tempAdmin, 'GET', '/term-pricing')
  check(ga.status === 200 && ga.json?.isAdmin === true, 'temporary admin GET: isAdmin true', `${ga.status} ${ga.json?.isAdmin}`)

  const amBefore = (await fingerprint()).find((r) => r.key === 'ANCHOR_MARGIN')
  await new Promise((r) => setTimeout(r, 1100)) // so a same-second write cannot hide an unchanged timestamp
  const put = await http(tempAdmin, 'PUT', '/term-pricing/settings', { settings: { ANCHOR_MARGIN: { ...SEEDED_AM, safesight: '80' } } })
  check(put.status === 200 && put.json?.settings?.ANCHOR_MARGIN?.safesight === '80', 'admin PUT ANCHOR_MARGIN 80%: 200, and the response carries it', String(put.status))
  const amAfter = (await fingerprint()).find((r) => r.key === 'ANCHOR_MARGIN')
  check(amAfter.value.safesight === '80', 'LANDED: the table holds 80% for SafeSight', JSON.stringify(amAfter.value))
  check(Date.parse(amAfter.updated_at) > Date.parse(amBefore.updated_at), 'updated_at ADVANCED', `${amBefore.updated_at} -> ${amAfter.updated_at}`)
  check(amAfter.updated_by === TEMP_ID, "updated_by is the admin's id", `${amAfter.updated_by}`)
  const others = (await fingerprint()).filter((r) => r.key !== 'ANCHOR_MARGIN')
  check(others.every((r) => JSON.stringify(r) === JSON.stringify(JSON.parse(fp1).find((x) => x.key === r.key))), 'no other key moved')

  const gn = await http(nonAdmin, 'GET', '/term-pricing')
  check(gn.json?.settings?.ANCHOR_MARGIN?.safesight === '80', 'the change reaches a non-admin reader', gn.json?.settings?.ANCHOR_MARGIN?.safesight)

  if (HOLD) {
    // Waits for a RELEASE FILE rather than a keypress, so the screen half can
    // be driven by another process. Capped at 10 minutes; the finally restores.
    console.log(`HOLD: ANCHOR_MARGIN is 80%. Run probe-screen.mjs --flow, then create ${HOLD}`)
    const t0 = Date.now()
    while (!existsSync(HOLD)) {
      if (Date.now() - t0 > 600000) throw new Error('hold timed out')
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  const fp2 = JSON.stringify(await fingerprint())
  const bad = await http(tempAdmin, 'PUT', '/term-pricing/settings', { settings: { MARGIN_FLOOR: 25 } }, 400)
  check(bad.status === 400 && /decimal string/.test(bad.json?.error ?? ''), 'admin PUT of a float-shaped number: 400, named', `${bad.status} ${bad.json?.error}`)
  check(JSON.stringify(await fingerprint()) === fp2, 'and nothing moved')

  const restore = await http(tempAdmin, 'PUT', '/term-pricing/settings', { settings: { ANCHOR_MARGIN: SEEDED_AM } })
  const amRestored = (await fingerprint()).find((r) => r.key === 'ANCHOR_MARGIN')
  check(restore.status === 200 && sameValue(amRestored.value, SEEDED_AM), 'restored to the seeded 90% for every product', JSON.stringify(amRestored.value))
} finally {
  // Teardown on every path: restore, then remove the temporary admin row.
  const am = (await fingerprint()).find((r) => r.key === 'ANCHOR_MARGIN')
  if (!sameValue(am.value, SEEDED_AM)) {
    must(await admin.from('term_pricing_settings').update({ value: SEEDED_AM, updated_at: new Date().toISOString() }).eq('key', 'ANCHOR_MARGIN'), 'teardown restore')
    console.log('TEARDOWN restored ANCHOR_MARGIN to 90% with the service key')
  }
  if (inserted) {
    must(await admin.from('system_roles').delete().eq('user_id', TEMP_ID).eq('role', 'admin'), 'DELETE temp admin')
    console.log(`DELETED   system_roles (${TEMP_ID}, admin) at ${new Date().toISOString()}`)
  }
  const gone = must(await admin.from('system_roles').select('user_id').eq('user_id', TEMP_ID), 'prove removal')
  check(gone.length === 0, 'REMOVAL PROVEN: select for the temporary admin returns 0 rows', String(gone.length))
  const all = must(await admin.from('system_roles').select('user_id, role'), 'system_roles after')
  check(all.length === 1 && all[0].user_id === JOHN, 'system_roles is back to exactly one row: John', JSON.stringify(all))
  if (inserted) {
    const after403 = await http(tempAdmin, 'PUT', '/term-pricing/settings', { settings: { MARGIN_FLOOR: '25' } }, 403)
    check(after403.status === 403, 'and the former temporary admin is refused 403 again', String(after403.status))
  }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
  process.exitCode = failures ? 1 : 0
}
