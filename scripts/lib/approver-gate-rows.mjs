// ── THE R10 DERIVATION, IN ONE PLACE ────────────────────────────────────
//
// "A Test Bed does not advance without its approvers named" is two sets:
//
//   the RULING     all three tracks at Qualification, so nothing leaves
//                  Qualification unnamed.
//   the BACKSTOP   wherever an `approval_obtained` rule already demands a
//                  track's decision, that stage also demands the track's
//                  approver be named.
//
// ONE DEFINITION, TWO READERS: the apply script writes from it and
// scripts/tests/config-invariants.test.mjs asserts the live rows against it.
// The migration expresses the same derivation in SQL, and the invariant is what
// catches the two disagreeing (Verification 20).
export const TRACK_FIELD = {
  Commercial: 'commercialAuthority',
  Technical: 'technicalAuthority',
  Legal: 'terminusLegalOwner',
}

/** The label IS the ruled sentence: computeBlocking renders `Requires ${label}`. */
export const labelFor = (track) => `a ${track} approver to be named`

/** Matches any approver-named label, for reading the live configuration back. */
export const APPROVER_LABEL = /^a (Commercial|Technical|Legal) approver to be named$/

/**
 * @param {Array<{from_stage: string, to_stage: string, requirement_type: string, requirement_detail: any}>} rules
 *   every `stage_gate_rules` row for the record type
 * @param {string[]} stageNames stage names in sort order
 * @returns {Array<{from_stage: string, to_stage: string, track: string, field: string, label: string, why: string}>}
 */
export function approverRuleRows(rules, stageNames) {
  const qualIdx = stageNames.indexOf('Qualification')
  const next = qualIdx >= 0 ? stageNames[qualIdx + 1] : undefined
  if (!next) throw new Error('Qualification has no next stage, so the ruled rows have no destination')

  const out = new Map()
  const add = (from_stage, to_stage, track, why) => {
    const key = `${from_stage}|${to_stage}|${track}`
    if (!out.has(key)) out.set(key, { from_stage, to_stage, track, field: TRACK_FIELD[track], label: labelFor(track), why })
  }
  for (const track of Object.keys(TRACK_FIELD)) add('Qualification', next, track, 'ruling')
  for (const r of rules) {
    if (r.requirement_type !== 'approval_obtained') continue
    const track = r.requirement_detail?.track
    if (!TRACK_FIELD[track]) throw new Error(`approval rule names an unknown track: ${track}`)
    add(r.from_stage, r.to_stage, track, 'backstop')
  }
  return [...out.values()]
}
