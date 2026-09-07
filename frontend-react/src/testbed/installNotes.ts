// ── N: INSTALL NOTES ────────────────────────────────────────────────────
//
// N1, recorded because the name suggests otherwise: the install SECTION has no
// fields of its own. `TB_INSTALL_FIELDS` is an empty array in the vanilla, so
// the section is a composition of the installer row, the tech team row and
// these notes.
//
// N2: a payload list, NEWEST FIRST, written whole through the record PATCH -
// the same read-modify-write shape as the use cases, with the same revision
// precondition doing the work.
export interface InstallNote { text: string, at: string, by: string, stage?: string }

/** N3: a blank note is not written at all. Returns the WHOLE new list, or null. */
export function addInstallNote(
  existing: readonly InstallNote[] | undefined,
  text: string, by: string, at: string, stage?: string,
): InstallNote[] | null {
  const t = String(text ?? '').trim()
  if (!t) return null
  const list = Array.isArray(existing) ? existing : []
  // N4: when, who, and the stage it was written at.
  return [{ text: t, at, by, ...(stage ? { stage } : {}) }, ...list]
}
