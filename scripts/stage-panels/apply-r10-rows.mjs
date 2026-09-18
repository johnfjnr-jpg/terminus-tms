// ── R10: APPLY THE APPROVER-NAMED GATE ROWS, THROUGH POSTGREST ───────────
//
// The canonical record of this configuration is
// supabase/migrations/20260918000001_approvers_named_before_advancing.sql. This
// session reaches Postgres only through PostgREST (build discipline 14), so it
// cannot run that file: it derives the SAME rows the same way and inserts them
// here, and the migration is what a rebuild runs.
//
// TWO WRITERS OF ONE CONFIGURATION IS THE RISK (Verification 20), and it is not
// answered by care. It is answered by scripts/tests/config-invariants.test.mjs,
// which asserts the live rows against the derivation, so a disagreement between
// this script, that file and the database is a red test rather than a silence.
//
// Idempotent in the same shape as the migration: a row already present is not
// inserted again, because a duplicated gate rule is invisible on screen while
// doubling a requirement.
//
// UNWIRED. Run: node --env-file=.env scripts/stage-panels/apply-r10-rows.mjs [--dry]
import { admin } from '../fixtures.mjs'
import { approverRuleRows, APPROVER_LABEL } from '../lib/approver-gate-rows.mjs'

const db = admin()
const must = ({ data, error }, w) => { if (error) throw new Error(`${w}: ${error.message}`); return data }
const DRY = process.argv.includes('--dry')

const rules = must(await db.from('stage_gate_rules')
  .select('from_stage,to_stage,requirement_type,requirement_detail')
  .eq('record_type', 'test_bed'), 'rules')
const stages = must(await db.from('stage_definitions')
  .select('stage_name,sort_order').eq('record_type', 'test_bed')
  .order('sort_order', { ascending: true }), 'stages')

const wanted = approverRuleRows(rules, stages.map((s) => s.stage_name))
console.log(`derived ${wanted.length} rows (${wanted.filter((r) => r.why === 'ruling').length} ruled, ${wanted.filter((r) => r.why === 'backstop').length} backstop)`)

const present = (row) => rules.some((r) => r.requirement_type === 'payload_field_required'
  && r.from_stage === row.from_stage && r.to_stage === row.to_stage
  && r.requirement_detail?.field === row.field
  && r.requirement_detail?.label === row.label)

const missing = wanted.filter((r) => !present(r))
console.log(`already present: ${wanted.length - missing.length}; to insert: ${missing.length}`)
for (const r of missing) console.log(`  + ${r.from_stage} -> ${r.to_stage}  ${r.field}  "${r.label}"`)

if (DRY) { console.log('\n--dry: nothing written'); process.exit(0) }

if (missing.length) {
  must(await db.from('stage_gate_rules').insert(missing.map((r) => ({
    record_type: 'test_bed', variant: null,
    from_stage: r.from_stage, to_stage: r.to_stage,
    requirement_type: 'payload_field_required',
    requirement_detail: { field: r.field, label: r.label },
  }))).select('id'), 'insert')
}

// ── THE SAME THREE CHECKS THE MIGRATION'S do $$ BLOCK MAKES ──────────────
//
// Re-read from the database rather than reasoning from what was just sent: an
// unchecked write looks like it worked (Architecture 8), and `must` throws, but
// what is being claimed here is the STATE rather than the call.
const after = must(await db.from('stage_gate_rules')
  .select('from_stage,to_stage,requirement_type,requirement_detail')
  .eq('record_type', 'test_bed'), 'after')

const fieldRules = after.filter((r) => r.requirement_type === 'payload_field_required'
  && APPROVER_LABEL.test(r.requirement_detail?.label ?? ''))
const approvals = after.filter((r) => r.requirement_type === 'approval_obtained')

const qual = fieldRules.filter((r) => r.from_stage === 'Qualification')
if (qual.length !== 3) throw new Error(`expected 3 Qualification approver rules, found ${qual.length}`)

const missingBeside = approvals.filter((a) => !fieldRules.some((x) =>
  x.from_stage === a.from_stage && x.to_stage === a.to_stage
  && x.requirement_detail.label === `a ${a.requirement_detail?.track} approver to be named`))
if (missingBeside.length) throw new Error(`${missingBeside.length} approval rule(s) have no approver-named rule beside them`)

const orphaned = fieldRules.filter((x) => !(x.from_stage === 'Qualification' && x.requirement_detail.field === 'terminusLegalOwner')
  && !approvals.some((a) => a.from_stage === x.from_stage && a.to_stage === x.to_stage
    && `a ${a.requirement_detail?.track} approver to be named` === x.requirement_detail.label))
if (orphaned.length) throw new Error(`${orphaned.length} approver-named rule(s) sit at a stage that demands no such decision`)

const pairs = new Set(approvals.map((a) => `${a.from_stage}|${a.to_stage}|${a.requirement_detail?.track}`)).size
if (fieldRules.length !== pairs + 1) {
  throw new Error(`${fieldRules.length} approver-named rules against ${pairs} approval pairs plus the Qualification Legal rule`)
}
console.log(`\nlive: ${fieldRules.length} approver-named rules, ${pairs} approval pairs, 3 at Qualification; all three checks pass`)
