// ── S: SENSOR COUNTS AND UNITS ──────────────────────────────────────────
//
// Round 7 Phase 1b, from the S enumeration.
export interface Unit { id: string, type?: string, revision_number?: number | null }

/**
 * S5: ONE mapping, and its inverse DERIVED rather than maintained.
 *
 * The vanilla builds the reverse with `Object.fromEntries(entries.map(...))`,
 * which is right and is worth keeping that way: two hand-written tables would
 * agree today and drift later. Verification 20, and the test proves them
 * inverse rather than trusting the construction.
 */
export const COUNT_KEY_TO_UNIT_TYPE: Record<string, string> = {
  safesightCameras: 'SafeSight',
  airQualitySensors: 'Air Quality',
  hemirSensors: 'HEMIR',
}

export const COUNT_KEY_FOR_UNIT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNT_KEY_TO_UNIT_TYPE).map(([key, type]) => [type, key]))

export interface Shortfall {
  planned: Array<{ type: string, n: number }>
  total: number
  missing: number
}

/**
 * S2: A COUNT AND ITS UNITS CAN DISAGREE, and this is what names the gap.
 *
 * `missing` is clamped at zero PER TYPE, not on the total: three extra
 * SafeSight units must not cancel out two missing HEMIR ones, because the
 * correction offered is per type.
 */
export function unitShortfall(
  payload: Record<string, unknown>, units: readonly Unit[],
): Shortfall {
  const planned = Object.entries(COUNT_KEY_TO_UNIT_TYPE).map(([key, type]) => ({
    type,
    n: Number(payload[key]) || 0,
  }))
  const total = planned.reduce((t, p) => t + p.n, 0)
  const missing = planned.reduce(
    (t, p) => t + Math.max(0, p.n - units.filter((u) => u.type === p.type).length), 0)
  return { planned, total, missing }
}

/**
 * S4: a count whose units already exist is LOCKED.
 *
 * The vanilla REPLACES the field with a line rather than leaving it present and
 * inert - its own comment calls that the fourth time this project has argued
 * the same thing. A control that cannot be used and looks like it can is worse
 * than one that is not there.
 */
export function countIsLocked(countKey: string, units: readonly Unit[]): boolean {
  const type = COUNT_KEY_TO_UNIT_TYPE[countKey]
  return !!type && units.some((u) => u.type === type)
}

/**
 * S1: the counts are ORDINARY PAYLOAD FIELDS, and the units behind them are a
 * SEPARATE RESOURCE. Two different things with two different write paths, which
 * is why S2's disagreement is possible at all.
 */
export const TB_COUNT_KEYS = Object.keys(COUNT_KEY_TO_UNIT_TYPE)

export const UNITS_ROUTE = (id: string) => `/api/test-beds/${id}/units`

/** S3: derive GENERATES units from the counts. Its own route, not the read. */
export const DERIVE_ROUTE = (id: string) => `/api/test-beds/${id}/units/derive`

/**
 * S7: a unit pane is per TYPE, and the tab-to-type map is DERIVED.
 *
 * The enumeration names `UNIT_TYPE_FOR_TAB_KEY` and does not say what the tab
 * keys are. Position taken, dated 2026-09-07 and recorded as a contract
 * addendum: the tab key IS the count key, so the map is the count map under
 * another name and is not written a second time. Same reasoning as S5.
 */
export const UNIT_TYPE_FOR_TAB_KEY: Record<string, string> = COUNT_KEY_TO_UNIT_TYPE

export function unitsForTab(tabKey: string, units: readonly Unit[]): Unit[] {
  const type = UNIT_TYPE_FOR_TAB_KEY[tabKey]
  if (!type) return []
  return units.filter((u) => u.type === type)
}
