#!/usr/bin/env node
// ── TERM PRICING SETTINGS: THE LIVE RLS AND ROUTE REFUSALS ───────────────
//
//   node --env-file=.env scripts/term-pricing/probe-live.mjs
//
// A gate stage (PROBE_TRIAGE R5, John 2026-11-18). Needs the running server
// on :3000 and session-ref.json (john+test, NOT an admin). Nothing else.
//
// WHAT IT PROVES, against the live database and the live route:
//   L1 every decimal setting is stored as a JSON string (docs/pricing-spec.md:
//      no floats for money);
//   L2 system_roles holds exactly one row, John's admin;
//   L3 a non-admin's DIRECT PostgREST update of a setting is refused by RLS;
//   L4 a non-admin's DIRECT upsert of a setting is refused by RLS;
//   L5 a non-admin cannot grant itself admin, refused BY RLS (42501), not by
//      a duplicate key;
//   L6 a non-admin cannot rewrite an existing system_roles row;
//   L7 system_roles is own-row only: the non-admin sees no rows;
//   L8 the route GET answers isAdmin false;
//   L9 the settings, bands and price-ladder PUTs answer 403 with the ADMIN
//      sentence, not the database's, so the route's own check refused them.
//
// ── WHY NO ATTEMPT CAN CHANGE CONFIGURATION, EVEN IF RLS IS BROKEN ───────
//
// Every attempted write carries the row's CURRENT value, read immediately
// before. A write that wrongly lands therefore moves only updated_at and
// updated_by, which is exactly what the fingerprint watches: it is how a
// break is DETECTED, not a risk the probe takes. And if one does move, the
// finally block puts the prior rows back byte for byte with the service key,
// re-reads them, and the run fails naming both the break and the restore.
//
// The self-grant (L5) inserts a row that ALREADY EXISTS (John's), so a broken
// insert policy meets the primary key and writes nothing. That is also why the
// assertion names the RLS error code: a 23505 would be a refusal for the
// wrong reason (CLAUDE.md Verification 14).
//
// ── WHAT WAS CUT, AND WHERE IT IS PROVED INSTEAD ─────────────────────────
//
// The 2026-10-02 version inserted a TEMPORARY system_roles admin row for a
// second account and PUT a changed ANCHOR_MARGIN, then restored a HARDCODED
// seeded value, not the value it read. ANCHOR_MARGIN no longer exists, so it
// could not run. Ruled out (R5): no admin grant, ever. The admin SUCCESS path
// is proved against the route in scripts/tests/term-pricing-route.test.mjs.
//
// `landed` is read from the table, never from a status (Verification 40).
// Every Supabase call that must succeed goes through `must` (Verification 8).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as admin } from '../../src/supabase.js'
import { api, ApiError } from '../api-client.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const JOHN = '75425a02-4750-470b-bcdc-fe83d0b01ac2'
const nonAdmin = JSON.parse(readFileSync(`${ROOT}session-ref.json`, 'utf8'))

const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
let failures = 0
const check = (ok, claim, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${claim}${detail ? `  [${detail}]` : ''}`)
}
const http = async (method, path, body, expect) => {
  process.env.TMS_ACCESS_TOKEN = nonAdmin.access_token
  try {
    const r = await api(method, path, body, expect ? { expect, because: 'the probe asserts this refusal' } : {})
    return { status: r.status, json: r.data }
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, json: e.body?.got ?? e.body }
    throw e
  }
}
const na = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${nonAdmin.access_token}` } }, auth: { persistSession: false },
})
// Bounded (no-unbounded-select.test.mjs). The settings table's key is a check
// constraint of about ten names, and system_roles holds one row; L2 asserts
// that, so a table that ever grew near the bound would fail L2 first.
const readSettings = async () => must(await admin.from('term_pricing_settings')
  .select('key, value, updated_at, updated_by').order('key').range(0, 199), 'settings')
const readRoles = async () => must(await admin.from('system_roles').select('*').order('user_id').range(0, 199), 'system_roles')
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x))

const settings0 = await readSettings()
const roles0 = await readRoles()
const fp0 = canon(settings0), roleFp0 = canon(roles0)
const moved = async () => canon(await readSettings()) !== fp0 || canon(await readRoles()) !== roleFp0

try {
  // ── L1, L2: what is there ────────────────────────────────────────────────
  check(settings0.length > 0, 'the settings table is readable and not empty', String(settings0.length))
  const byKey = Object.fromEntries(settings0.map((r) => [r.key, r.value]))
  const decimals = [
    byKey.HW_UPFRONT_MARGIN, byKey.MARGIN_FLOOR,
    ...Object.values(byKey.VOLUME_BANDS_BY_PRODUCT ?? {}).flatMap((list) => list.map((b) => b.discountPct)),
    ...Object.values(byKey.PRICE_LADDER_BY_PRODUCT ?? {}).flatMap((m) => Object.values(m)),
  ]
  check(decimals.length > 2 && decimals.every((d) => typeof d === 'string'),
    'L1 every decimal setting is stored as a JSON string', `${decimals.length} values`)
  check(roles0.length === 1 && roles0[0].user_id === JOHN && roles0[0].role === 'admin',
    'L2 system_roles holds exactly one row: John, admin', `${roles0.length} rows`)
  check(!roles0.some((r) => r.user_id === nonAdmin.user.id), 'and the probe account is not an admin')

  // ── L3 to L7: direct PostgREST writes as the non-admin, each a no-op on value
  const floor = settings0.find((r) => r.key === 'MARGIN_FLOOR')
  const upd = await na.from('term_pricing_settings')
    .update({ value: floor.value, updated_by: nonAdmin.user.id, updated_at: new Date().toISOString() })
    .eq('key', 'MARGIN_FLOOR').select('key')
  check(!upd.error && (upd.data ?? []).length === 0 && !(await moved()),
    'L3 a non-admin DIRECT update is refused by RLS (zero rows, fingerprint unchanged)',
    upd.error?.message ?? `${(upd.data ?? []).length} rows`)

  const cur = settings0.find((r) => r.key === 'CURRENCY')
  const ups = await na.from('term_pricing_settings')
    .upsert({ key: 'CURRENCY', value: cur.value, updated_by: nonAdmin.user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select('key')
  check((!!ups.error || (ups.data ?? []).length === 0) && !(await moved()),
    'L4 a non-admin DIRECT upsert is refused by RLS (fingerprint unchanged)', ups.error?.code ?? 'no error')

  const sr = await na.from('system_roles').insert({ user_id: JOHN, role: 'admin' }).select()
  check(sr.error?.code === '42501', 'L5 a non-admin cannot grant admin: refused BY RLS (42501), not by the key',
    sr.error ? `${sr.error.code} ${sr.error.message}` : 'INSERTED')

  const sru = await na.from('system_roles').update({ role: 'admin' }).eq('user_id', JOHN).select()
  check(!sru.error && (sru.data ?? []).length === 0 && !(await moved()),
    'L6 a non-admin cannot rewrite a system_roles row (zero rows)', sru.error?.message ?? `${(sru.data ?? []).length} rows`)

  const seeOthers = must(await na.from('system_roles').select('user_id').limit(50), 'system_roles as non-admin')
  check(seeOthers.length === 0, 'L7 system_roles is own-row only: the non-admin sees no rows', String(seeOthers.length))

  // ── L8, L9: the route ────────────────────────────────────────────────────
  const g = await http('GET', '/term-pricing')
  check(g.status === 200 && g.json?.isAdmin === false, 'L8 non-admin GET: 200, isAdmin false', `${g.status} isAdmin=${g.json?.isAdmin}`)

  const ADMIN_SENTENCE = 'Only an admin can change term pricing settings.'
  const p1 = await http('PUT', '/term-pricing/settings', { settings: { MARGIN_FLOOR: floor.value } }, 403)
  check(p1.status === 403 && p1.json?.error === ADMIN_SENTENCE && !(await moved()),
    'L9a non-admin settings PUT: 403 with the admin sentence, nothing moved', `${p1.status} ${p1.json?.error}`)
  const [product, bands] = Object.entries(byKey.VOLUME_BANDS_BY_PRODUCT ?? {})[0] ?? []
  const p2 = await http('PUT', `/term-pricing/bands/${product}`, { bands }, 403)
  check(!!product && p2.status === 403 && p2.json?.error === ADMIN_SENTENCE && !(await moved()),
    'L9b non-admin bands PUT: 403 with the admin sentence, nothing moved', `${product} ${p2.status} ${p2.json?.error}`)
  const [lp, prices] = Object.entries(byKey.PRICE_LADDER_BY_PRODUCT ?? {})[0] ?? []
  const p3 = await http('PUT', `/term-pricing/price-ladder/${lp}`, { prices }, 403)
  check(!!lp && p3.status === 403 && p3.json?.error === ADMIN_SENTENCE && !(await moved()),
    'L9c non-admin price-ladder PUT: 403 with the admin sentence, nothing moved', `${lp} ${p3.status} ${p3.json?.error}`)
} finally {
  // ── THE RESTORE, on every path ───────────────────────────────────────────
  if (canon(await readSettings()) !== fp0) {
    for (const r of settings0) {
      must(await admin.from('term_pricing_settings').update({ value: r.value, updated_at: r.updated_at, updated_by: r.updated_by }).eq('key', r.key), `restore ${r.key}`)
    }
    const back = canon(await readSettings()) === fp0
    check(false, `A WRITE LANDED on term_pricing_settings; restored with the service key: ${back ? 'byte-identical' : 'RESTORE DID NOT MATCH'}`)
  }
  const rolesNow = await readRoles()
  if (canon(rolesNow) !== roleFp0) {
    for (const r of rolesNow) if (!roles0.some((o) => canon(o) === canon(r))) must(await admin.from('system_roles').delete().eq('user_id', r.user_id).eq('role', r.role), 'remove landed role')
    check(false, `A WRITE LANDED on system_roles; removed: ${canon(await readRoles()) === roleFp0 ? 'byte-identical' : 'RESTORE DID NOT MATCH'}`)
  }
  check(!(await moved()), 'the settings and system_roles fingerprints end identical to the start')
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS')
  process.exitCode = failures ? 1 : 0
}
