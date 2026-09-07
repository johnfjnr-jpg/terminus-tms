// ── U: THE USE-CASE WHOLE-LIST READ-MODIFY-WRITE ────────────────────────
//
// U2: this rebuilds the whole array in the browser, so the record PATCH's
// revision precondition is the only thing that makes it safe.
//
// U3, THE CONCURRENT SHAPE: two people adding at the same time both read
// ["a"] and both write a two-element list. Without the precondition the second
// silently overwrites the first and one use case is LOST; with it the second is
// refused and can re-read.
//
// U4, AND THE LIMIT: remove-by-index is only correct against the list it was
// rendered from. The precondition catches the RECORD having moved; it does not
// make the index right. Recorded rather than fixed, because fixing it means
// identifying a use case by something other than its position, which is a data
// change rather than a migration.
const list = (useCases: readonly string[] | undefined): string[] =>
  Array.isArray(useCases) ? [...useCases] : []

/** Returns the whole new array, or null when there is nothing to add. */
export function addUseCase(useCases: readonly string[] | undefined, text: string): string[] | null {
  const t = text.trim()
  if (!t) return null
  return [...list(useCases), t]
}

export function removeUseCase(useCases: readonly string[] | undefined, index: number): string[] {
  return list(useCases).filter((_, i) => i !== index)
}
