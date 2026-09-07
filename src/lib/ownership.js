// ── THE OWNERSHIP DOOR'S ONE DERIVATION ─────────────────────────────────
//
// Round 8 Phase 1, ruled by John 2026-09-07: the door reads `owner_id` against
// the session DIRECTLY. No CSS class, no writer a swap can retire out from
// under it.
//
// THE GROUND, and it is a measured one rather than a preference. Round 7's
// swap retired the load path that wrote `is-not-mine`, and `CAN_EDIT_BY_VIEW`
// read that class: the banner rendered correctly from the record while the
// door stayed open, so every row on somebody else's record was editable. **The
// failure mode is silent and security-shaped**, and the migration hit it once
// for real.
//
// `is-not-mine` SURVIVES as presentation - it is the treatment that makes an
// unowned record non-interactive, and dimming alone was measured insufficient.
// What changes is that nothing DECIDES from it.
//
// ONE DEFINITION, read by the shell through index.html's module block and by
// the React tree through a relative import. Verification 20: two readers of one
// value always drift, and the door is where a drift is a defect with teeth.

/**
 * Whether this record belongs to somebody else.
 *
 * ALL THREE are required, and the absent-id cases fail OPEN deliberately: with
 * nobody signed in, or a record carrying no owner, the question cannot be
 * answered - and answering it "yes" would lock a record nobody owns.
 *
 * NOT A SECURITY BOUNDARY. RLS is the boundary. This stops a person doing work
 * that will be refused; it does not stop anybody who means to.
 */
export function notMine(ownerId, viewerId) {
  return !!ownerId && !!viewerId && ownerId !== viewerId
}

/** The door's answer. `notMine` inverted, named for what the caller asks. */
export function canEditRecord(ownerId, viewerId) {
  return !notMine(ownerId, viewerId)
}

/**
 * ── THE VIEW OWNER REGISTER ─────────────────────────────────────────────
 *
 * Whoever loads a record says who owns it; the door asks here. It lives in this
 * module rather than in `app.js` so it can be tested directly - an injection
 * that stopped it overwriting came back SILENT with zero failures precisely
 * because nothing outside a browser could reach it.
 *
 * SET OVERWRITES. A view that loads a second record must not answer with the
 * first record's owner, which is the re-navigation defect this estate has
 * measured on three surfaces.
 */
export function createViewOwners() {
  const owners = new Map()
  return {
    set(view, ownerId) { owners.set(view, ownerId ?? null) },
    clear(view) { owners.delete(view) },
    /** Null for a view that has never reported, which fails OPEN at the door. */
    get(view) { return owners.has(view) ? owners.get(view) : null },
    canEdit(view, viewerId) { return canEditRecord(this.get(view), viewerId) },
  }
}
