// ── THE NOTES HISTORY, ONE WRITER ────────────────────────────────────────
//
// Round 6 Phase 2b. N4: field edits, the park note and a manual note all land
// in ONE list, so they go through one function rather than three places that
// each build `[note, ...existing]` and agree today.
//
// The vanilla's shared core is `addContactNote` in app.js, a ten-line PATCH
// wrapper. It is NOT reached through the seam: N4 is a claim about the LIST,
// not about the helper, and the seam exists to contain couplings rather than
// to collect them. One path here, three callers.
export interface Note {
  text: string
  at: string
  by: string
}

/** A note, authored. `at` is passed in so a test is not a hostage to the clock. */
export const note = (text: string, by: string, at: string): Note => ({ text, at, by })

/** LATEST FIRST, and never truncated. N1. */
export const prepend = (n: Note, existing: readonly Note[] | undefined): Note[] =>
  [n, ...(existing ?? [])]

/** P3: the park note's exact sentence. */
export const parkNoteText = (dateIso: string, reason: string, formatted?: string): string =>
  `Contact parked. Follow up on ${formatted ?? dateIso}. ${reason}`
