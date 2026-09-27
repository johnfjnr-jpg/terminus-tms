// ── THE ONE VERSION LABEL ────────────────────────────────────────────────
//
// P6, John's walk 2026-09-27, asked for labels "from the ONE version-label
// source". Measured at Phase 0, there was no one source: the same rule was
// implemented FOUR times, identically, as an inline ternary.
//
//     frontend-react/src/versions/model.ts:48   `versionLabel()`, "W2's label"
//     src/lib/approval-page.js:862              inline
//     src/lib/approval-page.js:928              inline, the baseline label
//     src/lib/version-approval.js:304           inline
//
// All four agreed, which is Verification 20's benign end and is not a reason
// to keep four. Adding a fifth for the Working Version field would have made
// the ruling's own sentence false, so this is the one and the others call it.
//
// IT LIVES IN `src/lib` BECAUSE BOTH SIDES CAN REACH IT. The server imports it
// directly and the React tree already reaches into this directory
// (`useFieldWidth.tsx` imports `../../../src/lib/field-formats.js`), so one
// module serves every caller rather than one per runtime.

/**
 * W2's label. V0.n keeps its minor; a whole major drops it.
 *
 * @param {{ major: number, minor: number }} v
 * @returns {string}
 */
export function versionLabel(v) {
  if (!v || !Number.isInteger(v.major)) return null;
  if (v.major === 0) return `V0.${v.minor}`;
  return v.minor === 0 ? `V${v.major}` : `V${v.major}.${v.minor}`;
}

/**
 * ── P6: THE WORKING VERSION'S GRAMMAR, JOHN'S WORDS ──────────────────────
 *
 * Three states, and the label is always the one above:
 *
 *   latest version issued, record edited since, no draft saved
 *       <label> - Under Edit - Not saved
 *   draft saved, unchanged since
 *       <label>
 *   draft saved, edited since
 *       <label> - Under Edit
 *
 * PURE, AND THAT IS THE POINT. The decision is which sentence the record is
 * in, and it is testable without a browser, a server or a render. The caller
 * supplies the two facts the supersession machinery already answers.
 *
 * @param {object} a
 * @param {{ major: number, minor: number } | null} a.version
 *   The draft if one is saved, otherwise the latest issued version.
 * @param {boolean} a.draftSaved  Whether that version is a saved draft.
 * @param {boolean} a.editedSince Whether the record has moved since it.
 * @returns {string | null} null when there is no version to name at all.
 */
export function workingVersionLabel({ version, draftSaved, editedSince }) {
  const label = versionLabel(version);
  if (!label) return null;
  if (!draftSaved) return editedSince ? `${label} - Under Edit - Not saved` : label;
  return editedSince ? `${label} - Under Edit` : label;
}
