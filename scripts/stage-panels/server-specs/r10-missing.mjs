// R10 direction A: a stage demands a decision and no approver-named rule sits
// beside it. Injected by narrowing the derivation, which is what a later round
// adding an approval rule and forgetting the field rule would look like.
import { admin } from '../../fixtures.mjs'
export default {
  id: 'R10 the backstop stops reaching Decommissioning',
  file: 'scripts/lib/approver-gate-rows.mjs',
  find: "    if (r.requirement_type !== 'approval_obtained') continue",
  replace: "    if (r.requirement_type !== 'approval_obtained' || r.from_stage === 'Decommissioning') continue",
  probe: 'scripts/stage-panels/probe-r10-invariant.mjs',
  run: 'r10-missing',
  expect: ['every approval rule has its approver-named rule beside it'],
  // No server is involved, so there is nothing to restart and nothing to
  // reload. `live` reports the live row count either way, which is what proves
  // the injection changed the DERIVATION and not the configuration.
  restartMs: 0,
  live: async () => {
    const db = admin()
    const { data, error } = await db.from('stage_gate_rules')
      .select('from_stage,requirement_detail').eq('record_type', 'test_bed')
      .eq('requirement_type', 'payload_field_required')
    if (error) throw new Error(error.message)
    return { approverNamedRowsLive: data.filter((r) => /approver to be named/.test(r.requirement_detail?.label ?? '')).length }
  },
}
