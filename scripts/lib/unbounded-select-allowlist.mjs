// THE MEASURED ALLOWLIST OF UNBOUNDED SELECTS, AND IT IS SHRINK-ONLY.
//
// Every entry is a select in code the gate runs that takes PostgREST's first
// 1,000 rows and says nothing about having done so. They are recorded rather
// than fixed because Phase 0 measured the shape statically, and clearing an
// instance needs its real result set, which is execution rather than scanning.
//
// THE CEILING BELOW MAY ONLY EVER BE LOWERED. A new unbounded select fails the
// guard because its key is not here; adding the key to make it pass then breaks
// the ceiling. That is the shrink-only mechanism, and it is deliberate that
// raising the ceiling is a separate, visible edit somebody has to justify.
//
// When an instance is CLEARED - bounded, or proven unable to exceed the cap -
// remove its key AND lower the ceiling. A stale key fails the guard too, so the
// list cannot drift from the tree in either direction.

export const CEILING = 41

export const ALLOWED = [
  'scripts/probe-pricing-approval.mjs::approvals::0',
  'scripts/probe-pricing-approval.mjs::track_approvers::0',
  'scripts/probe-review-closes.mjs::approvals::0',
  'scripts/probe-review-closes.mjs::track_approvers::0',
  'scripts/probe-stage-probability.mjs::records::2',
  'scripts/probe-stage-probability.mjs::stage_probability_defaults::0',
  'scripts/probe-version-order.mjs::deal_sheet_versions::0',
  'scripts/probe-zero-track-transition.mjs::transition_requests::0',
  'scripts/tests/config-invariants.test.mjs::approval_tracks::0',
  'scripts/tests/config-invariants.test.mjs::contact_roles::0',
  'scripts/tests/config-invariants.test.mjs::contact_stances::0',
  'scripts/tests/config-invariants.test.mjs::record_revisions::0',
  'scripts/tests/config-invariants.test.mjs::records::0',
  'scripts/tests/config-invariants.test.mjs::records::1',
  'scripts/tests/config-invariants.test.mjs::scoring_anchors::0',
  'scripts/tests/config-invariants.test.mjs::scoring_criteria::0',
  'scripts/tests/config-invariants.test.mjs::stage_definitions::0',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::0',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::1',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::2',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::3',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::4',
  'scripts/tests/config-invariants.test.mjs::stage_gate_rules::5',
  'scripts/tests/config-invariants.test.mjs::stage_reference_docs::0',
  'scripts/tests/contact-links.test.mjs::contact_roles::0',
  'scripts/tests/contact-links.test.mjs::record_contact_stances::0',
  'scripts/tests/contact-links.test.mjs::record_contacts::0',
  'scripts/tests/contact-links.test.mjs::records::0',
  'scripts/tests/gates.test.mjs::approvals::0',
  'scripts/tests/gates.test.mjs::approvals::2',
  'scripts/tests/gates.test.mjs::stage_definitions::0',
  'scripts/tests/gates.test.mjs::stage_gate_rules::0',
  'scripts/tests/record-revision.test.mjs::record_revisions::0',
  'scripts/tests/reference-number.test.mjs::reference_number_counters::0',
  'scripts/tests/teardown-scoping.test.mjs::records::0',
  'scripts/tests/teardown-scoping.test.mjs::records::1',
  'scripts/tests/teardown-scoping.test.mjs::records::2',
  'scripts/tests/teardown-scoping.test.mjs::records::3',
  'scripts/tests/unit-slots.test.mjs::records::0',
  'scripts/tests/version-atomicity.test.mjs::deal_sheet_versions::0',
  'scripts/tests/version-atomicity.test.mjs::deal_sheet_versions::2',
]
