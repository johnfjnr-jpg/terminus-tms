/**
 * THE STAGE GATE'S FIELD RULES, IN ONE PLACE. Round 6 Phase 1.
 *
 * ── WHY THIS MODULE EXISTS, and it is a Verification 20 instance rather than
 * ── tidiness ──────────────────────────────────────────────────────────────
 *
 * `computeBlocking` decides whether a field satisfies a `payload_field_required`
 * rule, and the Contact screen decides whether a blocked field has since been
 * filled in so it can drop the tint. Those are the same question, and until
 * this module they were two answers: `refreshCdBlockedFields` in
 * `frontend/contact-detail.js` carried its own copy, with a comment saying it
 * used "the exact same rule". That phrase is the one `CLAUDE.md` names as
 * marking an unproven equality.
 *
 * Measured at Round 6 Phase 0 they DID agree, which is the benign end of the
 * shape and not a reason to keep two: the server's evaluator has since grown
 * `min_length` and `entry_stage_at_or_after` clauses that the client's copy
 * knows nothing about, and it agrees today only because no contact rule
 * carries either.
 *
 * ── WHY IT IS IN src/lib RATHER THAN THE ROUTE ────────────────────────────
 *
 * It lived in `src/routes/transitions.js`, which imports the database client
 * and the whole route surface, so no browser and no bundle could read it. This
 * directory is served at `/lib` and is imported directly by the React tree, so
 * putting the definition here is what makes "one definition, two readers"
 * possible at all. `transitions.js` re-exports both names, so its existing
 * importers are unchanged.
 */

/**
 * Fields a `payload_field_required` rule may name that are REAL COLUMNS on
 * `records` rather than payload keys, so the gate reads the record row instead
 * of the revision payload.
 *
 * EVERY CALLER'S SELECT LIST IS BUILT FROM THIS SET, deliberately. Round 11
 * Phase 5 added `installer_account_id` and the gate blocked unsatisfiably until
 * the two callers' hardcoded select lists were updated too: the row simply did
 * not carry the column, so `record[field]` was undefined and the requirement
 * could never be met.
 */
export const RECORD_COLUMN_FIELDS = new Set([
  'parent_record_id',
  'industry_id',
  'installer_account_id',
]);

/** The select every `computeBlocking` caller must use. Derived, never retyped. */
export const GATE_RECORD_SELECT =
  ['id', 'record_type', 'status', 'variant', ...RECORD_COLUMN_FIELDS].join(', ');

/**
 * The base test a `payload_field_required` rule applies: present and non-empty.
 *
 * `false`, `0`, `'0'`, `{}` and `[]` all PASS, measured against the real
 * evaluator in Round 11 Phase 0. A series clause is what makes an empty array
 * fail, and it is the rule's business rather than this predicate's.
 *
 * @param {unknown} value the stored value, from the payload or the record row
 * @returns {boolean} true when the field satisfies the base requirement
 */
export function gateFieldIsPresent(value) {
  return !(value === undefined || value === null || value === '');
}

/**
 * Where a gate rule's field is read from, for a given record.
 *
 * The two readers differ in WHAT they hold - the server has the record row and
 * the revision payload, the screen has its loaded record and its draft - so
 * this takes both and applies the one rule about which side to look at.
 *
 * @param {string} field the rule's `requirement_detail.field`
 * @param {Record<string, unknown>} record the record row
 * @param {Record<string, unknown>} payload the revision payload
 */
export function gateFieldValue(field, record, payload) {
  return RECORD_COLUMN_FIELDS.has(field) ? record?.[field] : payload?.[field];
}
