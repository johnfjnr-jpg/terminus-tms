/**
 * Unit slots: the shared vocabulary and the one derivation path.
 *
 * Round 17A Phase 3, 2026-08-21. Extracted from src/routes/test-beds.js so
 * that deriving slots has exactly one implementation. Before this, deriving
 * lived only inside POST /units/derive, and making an upward count correction
 * reconcile its slots would have meant a second copy of the same loop. That
 * is the shape Architecture rule 3 exists to prevent, and Round 17's own
 * appendPayloadSeriesEntry is the cautionary case: a helper extracted for
 * exactly this reason, left with one caller while the code it was extracted
 * from kept its copy.
 */

export const UNIT_TYPE_COUNT_KEYS = [
  { type: 'SafeSight', key: 'safesightCameras' },
  { type: 'Air Quality', key: 'airQualitySensors' },
  { type: 'HEMIR', key: 'hemirSensors' },
]

export const VALID_UNIT_STATES = ['Planned', 'Installed', 'Faulty', 'Removed']
export const VALID_STATE_SOURCES = ['Person', 'Platform']

/**
 * Live unit slots for a Test Bed, newest revision's payload flattened onto
 * each one. Soft-deleted slots are excluded, which is load-bearing: see
 * deriveMissingUnitSlots' note on indexes.
 */
export async function loadUnits(db, bedId) {
  const { data: units, error } = await db
    .from('records')
    .select('id, variant, status, created_at, record_revisions(revision_number, payload)')
    .eq('parent_record_id', bedId)
    .eq('record_type', 'unit')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) return { error }
  const shaped = (units ?? []).map(u => {
    const latest = (u.record_revisions ?? []).sort((a, b) => b.revision_number - a.revision_number)[0]
    const p = latest?.payload ?? {}
    return {
      id: u.id, type: u.variant, state: u.status,
      index: p.unitIndex ?? null, serialNumber: p.serialNumber ?? null,
      latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      stateSource: p.stateSource ?? null, created_at: u.created_at,
    }
  })
  shaped.sort((a, b) => a.type.localeCompare(b.type) || (a.index ?? 0) - (b.index ?? 0))
  return { units: shaped }
}

/**
 * Creates whatever slots the counts imply and do not yet exist. Idempotent:
 * running it twice creates nothing the second time.
 *
 * INDEXES ARE REISSUED AFTER A REMOVAL, and that is the decided outcome
 * rather than an accident (Round 17A Phase 3). The previous comment here
 * claimed the opposite - "a slot is never reissued after a removal" - and was
 * false the day it was written, because `next` is computed from loadUnits,
 * which excludes soft-deleted rows, so max(index) never sees a removed slot.
 * Measured: reduce three slots to two, raise it back, and the new slot is
 * index 3 again, alongside a soft-deleted index 3.
 *
 * REISSUE IS THE RIGHT ANSWER HERE, for a reason that depends on a guard
 * elsewhere. A count correction removes surplus slots ONLY while they are
 * still Planned, highest index first, and refuses outright if any slot it
 * would remove is Installed, Faulty or Removed. So a soft-deleted slot is
 * always one that never held a device, and reissuing its number cannot
 * overwrite the history of anything physical. Removing from the top also
 * means live indexes for a type are always exactly 1..N, which is the
 * property the units table displays and the one asserted in the suite.
 *
 * The alternative, never reissuing, would show #1 to #10, #13, #14 on a Test
 * Bed the business calls a twelve-unit site, which reads as missing data.
 *
 * WHAT THIS LEAVES FOR ROUND 18: a soft-deleted slot and a live slot can
 * share an index, so a History pane keyed on index alone would be ambiguous.
 * It should key on the unit's record id, which is unique regardless.
 */
export async function deriveMissingUnitSlots(db, bedId, counts, ownerId) {
  const { units: existing, error: listErr } = await loadUnits(db, bedId)
  if (listErr) return { error: listErr }

  const created = []
  for (const { type, key } of UNIT_TYPE_COUNT_KEYS) {
    const want = Number(counts[key]) || 0
    const have = existing.filter(u => u.type === type)
    let next = have.reduce((m, u) => Math.max(m, Number(u.index) || 0), 0)
    for (let i = have.length; i < want; i++) {
      next += 1
      const { data: unit, error: insErr } = await db
        .from('records')
        .insert({
          record_type: 'unit', parent_record_id: bedId,
          variant: type,
          // Planned is why a slot can exist before a serial does.
          status: 'Planned',
          owner_id: ownerId,
        })
        .select('id').single()
      if (insErr) return { error: insErr }
      const { error: revIns } = await db.from('record_revisions').insert({
        record_id: unit.id, revision_number: 1,
        payload: { unitIndex: next, stateSource: 'Person' },
        created_by: ownerId,
      })
      if (revIns) return { error: revIns }
      created.push({ id: unit.id, type, index: next })
    }
  }
  return { created }
}
