// ── INTER-DATE BOUNDS ────────────────────────────────────────────────────
//
// Round 7 Phase 1a. The vanilla recomputes native min/max on both date inputs
// IN PLACE, from their EFFECTIVE values, because "re-rendering the row would
// throw away an open edit".
//
// Here the bounds are derived rather than written, and the row re-renders
// freely: a React descriptor carries `min`/`max` as data (A4), so the open
// editor keeps its draft through the controller and there is nothing to throw
// away. The vanilla's in-place mutation exists to work around a constraint the
// component does not have.
export interface Bounds { min?: string, max?: string }

/** Today as an ISO date, injectable so a test is not a hostage to the clock. */
export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10)

/**
 * The install date is never in the past, and never after a set go-live date.
 * The go-live date is never before the install date, nor before today.
 *
 * Both read the EFFECTIVE value - the draft if there is one, else stored - so
 * the bounds follow what the person is typing rather than what is saved.
 */
export function dateBounds(install: string, goLive: string, today = todayIso()): {
  estimatedInstallationDate: Bounds
  estGoLiveDate: Bounds
} {
  return {
    estimatedInstallationDate: {
      min: today,
      // Absent rather than empty: an unset go-live imposes no ceiling, and an
      // empty string as `max` is a bound nobody can satisfy.
      ...(goLive ? { max: goLive } : {}),
    },
    estGoLiveDate: {
      min: install && install > today ? install : today,
    },
  }
}
