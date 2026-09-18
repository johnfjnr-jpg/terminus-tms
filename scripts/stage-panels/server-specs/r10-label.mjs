// R10 direction B: the rows are all in the right places and the LABEL is wrong,
// so the screen reads "Requires commercialAuthority to be set". Both set
// comparisons pass on this; only the label assertion can see it.
import { admin } from '../../fixtures.mjs'
export default {
  id: 'R10 the ruled sentence is not what the label says',
  file: 'scripts/lib/approver-gate-rows.mjs',
  find: 'export const labelFor = (track) => `a ${track} approver to be named`',
  replace: 'export const labelFor = (track) => `${track} approver`',
  probe: 'scripts/stage-panels/probe-r10-invariant.mjs',
  run: 'r10-label',
  expect: ['each approver-named rule carries the ruled sentence as its label'],
  restartMs: 0,
  live: async () => {
    const db = admin()
    const { data, error } = await db.from('stage_gate_rules')
      .select('requirement_detail').eq('record_type', 'test_bed')
      .eq('requirement_type', 'payload_field_required')
    if (error) throw new Error(error.message)
    const labels = new Set(data.map((r) => r.requirement_detail?.label).filter((l) => /approver/.test(l ?? '')))
    return { distinctApproverLabelsLive: [...labels].sort() }
  },
}
