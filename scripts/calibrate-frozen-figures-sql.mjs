#!/usr/bin/env node
// ── FROZEN_FIGURES: CALIBRATION OF THE DATABASE GUARDS, AS ONE ROLLED-BACK BLOCK
//
//   node --env-file=.env scripts/calibrate-frozen-figures-sql.mjs [tag]
//     -> builds a tagged fixture through the routes, then writes
//        .scratch/ff-calibration.sql for John to paste into the dashboard.
//   node --env-file=.env scripts/calibrate-frozen-figures-sql.mjs --teardown [tag]
//     -> tears the fixture down afterwards.
//
// WHY SQL AND NOT THE PROBE. John's ruling: calibration edits to database
// functions run in a transaction that is rolled back, never left applied. The
// probe reaches Postgres through PostgREST, where every request is its own
// connection and transaction, so NO probe request can see a function changed
// inside an uncommitted transaction. The only way to honour the ruling is to
// perform the probe's writes INSIDE that transaction.
//
// WHAT IT DOES. One DO block. For each of four injections: replace the function
// with the APPLIED MIGRATION's text minus one guard (each removal anchored, and
// refused if the anchor is not unique), perform the probe check's exact write
// AS THE PROBE'S ROLE, record FIRED if the write now goes through, and roll the
// injection back. Then the same four writes against the real functions, each
// expected REFUSED (the "reverted" run). THE BLOCK ENDS BY RAISING AN EXCEPTION
// CARRYING EVERY VERDICT, so all of it rolls back by construction: nothing can
// be left applied, whether or not it is wrapped in begin/rollback (build
// discipline 14(a): a construct that cannot carry the error).
//
// The function texts are DERIVED from the migration file, never retyped, so the
// injected functions differ from the applied ones by exactly the removed guard.
// Not parse-checked here (rule 14).
import { readFileSync, writeFileSync } from 'node:fs'
import { api } from './api-client.mjs'
import { freshOpportunity, tearDown, admin } from './fixtures.mjs'
import { catalogToRates } from '../src/lib/base-costs.js'
import { resolveRates, frozenRates } from '../src/lib/rate-resolution.js'

const args = process.argv.slice(2)
const TAG = args.find((a) => !a.startsWith('--')) ?? 'ffsqlcal'
if (args.includes('--teardown')) { await tearDown(TAG); console.log(`torn down ${TAG}`); process.exit(0) }

const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const MIG = readFileSync('supabase/migrations/20261117000002_versions_freeze_their_figures.sql', 'utf8')
const fnText = (name, end) => {
  const a = MIG.indexOf(`create or replace function public.${name}(`)
  const b = MIG.indexOf(end, a)
  if (a < 0 || b < 0) throw new Error(`function ${name} not found`)
  return MIG.slice(a, b + end.length)
}
const without = (text, anchor, replacement = '') => {
  const n = text.split(anchor).length - 1
  if (n !== 1) throw new Error(`anchor appears ${n} times: ${anchor.slice(0, 60)}`)
  return text.replace(anchor, replacement)
}
const BORN = fnText('deal_sheet_versions_born_draft', '\n$$;')
const IMMUT = fnText('deal_sheet_versions_immutable', '\n$$;')
const RAISE = fnText('raise_transition_request', '\nend $$;')
for (const t of [BORN, IMMUT, RAISE]) if (t.includes('$inj$')) throw new Error('dollar tag clash')

const INJ = {
  issued: without(BORN, `if NEW.status is distinct from 'draft' or NEW.frozen_figures is not null then`, `if NEW.frozen_figures is not null then`),
  service: without(IMMUT, `  if current_user <> 'service_role' then
    raise exception 'deal_sheet_versions: only the server may freeze figures (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;
`),
  owner: without(IMMUT, `  select r.owner_id into v_owner from public.records r where r.id = NEW.record_id;
  if NEW.issued_by is distinct from v_owner then
    raise exception 'deal_sheet_versions: only the record''s owner may submit its version (id %)', OLD.id
      using errcode = 'insufficient_privilege';
  end if;
`),
  derive: without(RAISE, RAISE.slice(RAISE.indexOf(`  if p_to_stage = 'Closed Won' then`), RAISE.indexOf(`  end if;\n`, RAISE.indexOf(`  if p_to_stage = 'Closed Won' then`)) + `  end if;\n`.length)),
}

// ── THE FIXTURE, THROUGH THE ROUTES ──────────────────────────────────────
const db = admin()
const session = JSON.parse(readFileSync('session-ref.json', 'utf8'))
const OWNER = session.user.id
const LIVE = catalogToRates((await api('GET', '/base-costs')).data?.products ?? []).rates
const { oppId } = await freshOpportunity(TAG)
const rev = async () => (await api('GET', `/opportunities/${oppId}`)).data.latest_revision_number
await api('PATCH', `/opportunities/${oppId}`, { payload: { ssNew: 10, duration: 36, targetMargin: 30 }, expected_revision: await rev() })
const take = async (reason) => {
  const inputs = (await api('GET', `/opportunities/${oppId}`)).data.payload
  return (await api('POST', `/opportunities/${oppId}/deal-sheet-versions`,
    { inputs, reason, rates: frozenRates(resolveRates(inputs, LIVE)), expected_revision: await rev() })).data
}
const v1 = await take('sql calibration V1')
await api('POST', `/deal-sheet-versions/${v1.id}/issue`, {})
await api('PATCH', `/opportunities/${oppId}`, { payload: { targetMargin: 31 }, expected_revision: await rev() })
const d2 = await take('sql calibration V2 draft')
const stranger = must(await db.from('records').select('owner_id').neq('owner_id', OWNER).not('owner_id', 'is', null).limit(1).single(), 'stranger').owner_id
const rec = must(await db.from('records').select('record_type, status').eq('id', oppId).single(), 'record')
// The approval of V1: an ADMIN WRITE, declared (one account cannot approve its
// own request). Live until teardown; the raise reads only that it exists.
must(await db.from('transition_requests').insert({
  record_id: oppId, record_type: rec.record_type, from_stage: rec.status, to_stage: rec.status, kind: 'review',
  status: 'approved', frozen_revision: (await db.from('deal_sheet_versions').select('revision_number').eq('id', v1.id).single()).data.revision_number,
  frozen_version_id: v1.id, requested_by: OWNER, closed_by: stranger, closed_at: new Date().toISOString(),
  close_reason: `${TAG}: V1 approved, admin fixture for the SQL calibration`,
}).select('id').single(), 'approved request')
const v1row = must(await db.from('deal_sheet_versions').select('status, frozen_figures').eq('id', v1.id).single(), 'v1')
if (v1row.status !== 'issued' || !v1row.frozen_figures) throw new Error('fixture V1 did not submit with figures')

// ── THE SQL ──────────────────────────────────────────────────────────────
const q = (s) => `'${s}'`
const asOwner = `set local role authenticated;
      perform set_config('request.jwt.claim.sub', ${q(OWNER)}, true);
      perform set_config('request.jwt.claims', json_build_object('sub', ${q(OWNER)}, 'role', 'authenticated')::text, true);`
const asService = `set local role service_role;`
const ATT = {
  issued_owner: `insert into public.deal_sheet_versions (record_id, major, minor, status, reason, inputs, rates, sections, revision_number, created_by, issued_by, issued_at)
        select record_id, 9, 0, 'issued', 'forged', inputs, rates, sections, revision_number, created_by, ${q(OWNER)}, now() from public.deal_sheet_versions where id = ${q(v1.id)};`,
  issued_service: `insert into public.deal_sheet_versions (record_id, major, minor, status, reason, inputs, rates, sections, revision_number, created_by, issued_by, issued_at)
        select record_id, 9, 1, 'issued', 'forged', inputs, rates, sections, revision_number, created_by, ${q(OWNER)}, now() from public.deal_sheet_versions where id = ${q(v1.id)};`,
  service: `update public.deal_sheet_versions set status = 'issued', major = major + 1, minor = 0, issued_by = ${q(OWNER)}, issued_at = now(),
        frozen_figures = (select frozen_figures from public.deal_sheet_versions where id = ${q(v1.id)}) where id = ${q(d2.id)};
      get diagnostics n = row_count; if n <> 1 then raise exception 'updated % rows', n; end if;`,
  owner: `update public.deal_sheet_versions set status = 'issued', major = major + 1, minor = 0, issued_by = ${q(stranger)}, issued_at = now(),
        frozen_figures = (select frozen_figures from public.deal_sheet_versions where id = ${q(v1.id)}) where id = ${q(d2.id)};
      get diagnostics n = row_count; if n <> 1 then raise exception 'updated % rows', n; end if;`,
  derive: `select frozen_version_id into fv from public.raise_transition_request(${q(oppId)}, 'Closed Won', 'transition', ${q(d2.id)});
      if fv is distinct from ${q(d2.id)} then raise exception 'froze % (V1 is ${v1.id})', fv; end if;`,
}
// [label, injection key or null, role, attempt]. With an injection, success is
// FIRED. Without one (the reverted run), the attempt must be REFUSED, and for
// the derivation that means it froze V1 rather than the draft it was handed.
const CASES = [
  ['insert a row already issued, OWNER', 'issued', asOwner, ATT.issued_owner],
  ['insert a row already issued, SERVICE ROLE', 'issued', asService, ATT.issued_service],
  ['submit with figures the OWNER supplies (not the server)', 'service', asOwner, ATT.service],
  ['the SERVICE ROLE submits for someone who does not own the record', 'owner', asService, ATT.owner],
  ['R-FF4: it froze the APPROVED V1, not the draft it was handed', 'derive', asOwner, ATT.derive],
]
const block = (label, inj, role, attempt) => `
  -- ${inj ? `INJECTION (${inj})` : 'REVERTED'}: ${label}
  begin
    ${inj ? `execute $inj$${INJ[inj]}$inj$;` : ''}
    begin
      ${role}
      ${attempt}
      reset role;
      v := ${q(inj ? 'FIRED' : 'NOT REFUSED (the guard is missing)')};
    exception when others then
      v := ${inj ? `'SILENT: ' || sqlerrm` : `'REFUSED: ' || left(sqlerrm, 90)`};
    end;
    raise exception 'VERDICT:%', v;
  exception when others then
    if sqlerrm like 'VERDICT:%' then out := out || E'\\n' || ${q(`${inj ? 'INJ' : 'REV'}  ${label.replaceAll("'", "''")}  -> `)} || substr(sqlerrm, 9);
    else out := out || E'\\n' || ${q(`${inj ? 'INJ' : 'REV'}  ${label.replaceAll("'", "''")}  -> HARNESS ERROR: `)} || sqlerrm; end if;
  end;`
// ── THE DEFINITIONS, BY TEXT: John's "confirm the column, both triggers and
// the raise function's definition match the file". prosrc holds a function's
// body exactly as stored, i.e. the text between its dollar quotes in the file.
const bodyOf = (t) => t.slice(t.indexOf('$$') + 2, t.lastIndexOf('$$'))
for (const t of [BORN, IMMUT, RAISE]) if (bodyOf(t).includes('$exp$')) throw new Error('dollar tag clash')
// Pinned to the exact SIGNATURE: by name alone, a surviving older overload
// would make the subquery return two rows and abort the whole block.
const defCheck = (fn, text, sig) => `
  if (select prosrc from pg_proc where oid = 'public.${fn}(${sig})'::regprocedure) = $exp$${bodyOf(text)}$exp$
    then out := out || E'\\n' || 'DEF  ${fn} body matches the file';
    else out := out || E'\\n' || 'DEF  ${fn} body DIFFERS from the file'; end if;`
const defs = `${defCheck('deal_sheet_versions_born_draft', BORN, '')}${defCheck('deal_sheet_versions_immutable', IMMUT, '')}${defCheck('raise_transition_request', RAISE, 'uuid,text,text,uuid')}
  out := out || E'\\n' || 'DEF  column frozen_figures: ' || coalesce((select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'deal_sheet_versions' and column_name = 'frozen_figures'), 'ABSENT');
  out := out || E'\\n' || 'DEF  triggers: ' || coalesce((select string_agg(t.tgname || ' -> ' || p.proname, ', ' order by t.tgname)
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.deal_sheet_versions'::regclass and not t.tgisinternal
      and t.tgname in ('deal_sheet_versions_immutable_trg', 'deal_sheet_versions_born_draft_trg')), 'NONE');`
const sql = `-- FROZEN_FIGURES calibration of the database guards. GENERATED by
-- scripts/calibrate-frozen-figures-sql.mjs for fixture ${TAG} (record ${oppId}).
-- Paste into the Supabase SQL editor and run. IT ALWAYS ENDS IN AN ERROR whose
-- message is the result: that error is what rolls every injection back.
do $cal$
declare
  v text; n integer; fv uuid; out text := 'CALIBRATION RESULT (everything rolled back):';
begin
${defs}
${CASES.map(([l, i, r, a]) => block(l, i, r, a)).join('\n')}
${CASES.map(([l, , r, a]) => block(l, null, r, a)).join('\n')}
  raise exception '%', out;
end
$cal$;
`
writeFileSync('.scratch/ff-calibration.sql', sql)
console.log(`fixture ${TAG}: record ${oppId}, V1 ${v1.id} (issued, with figures), draft ${d2.id}`)
console.log(`wrote .scratch/ff-calibration.sql (${sql.length} bytes). Tear down after John runs it:`)
console.log(`  node --env-file=.env scripts/calibrate-frozen-figures-sql.mjs --teardown ${TAG}`)
