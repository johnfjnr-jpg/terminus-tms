// ── R-K CALIBRATION SPEC: commit and move, both directions ───────────────
//
// One injection per clause of the ruling and per position taken, each scored
// by WHICH NAMED TEST failed. The two absence claims in the file - that no
// keystroke fires a record-wide save - are NOT injectable from here, because
// neither the row nor an editor holds a save to break; their positive
// companion is `and the bar CAN save`, which is what makes the zeros
// measurements rather than readings of a dead harness.
const ED = 'frontend-react/src/field-row/editors.tsx'
const ROW = 'frontend-react/src/field-row/FieldRow.tsx'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'rk-keyboard',
  testFiles: ['src/__tests__/field-row-keyboard.test.tsx', 'src/__tests__/field-row.test.tsx',
    'src/__tests__/field-row-editors.test.tsx'],
  injections: [
    I('Enter does not commit a text field', ED,
      '  text: { enter: true, arrows: true },', '  text: { enter: false, arrows: true },',
      ['Enter closes this row and opens the next field\'s editor']),
    I('the arrows do not move', ED,
      '  text: { enter: true, arrows: true },', '  text: { enter: true, arrows: false },',
      ['ArrowDown commits and moves down', 'ArrowUp commits and moves up']),
    I('the move DISCARDS instead of committing', ROW,
      '            rows.close(field.name)\n            if (next) rows.requestOpen(next)',
      '            rows.discard(field.name); rows.close(field.name)\n            if (next) rows.requestOpen(next)',
      ['the draft SURVIVES the move, and the bar still counts it']),
    // ── THE EXPECTATION THIS INJECTION CORRECTED ────────────────────────
    //
    // It was written expecting the ORDINARY move to fail, and that was wrong:
    // when the next row takes focus, the row it left BLURS, and the blur
    // handler closes it anyway. The explicit close is therefore load-bearing
    // only at a BOUNDARY, where there is no next editor to pull focus away -
    // which is precisely the two tests that did fail.
    //
    // Kept rather than deleted as redundant, and the reason is at the site: a
    // move whose focus fails to land leaves relatedTarget null, and the blur
    // handler deliberately does NOT close on a blur to nothing. The explicit
    // close is what makes the commit independent of focus landing.
    I('the move does not close the field it left', ROW,
      '            rows.close(field.name)\n            if (next) rows.requestOpen(next)',
      '            if (next) rows.requestOpen(next)',
      ['Enter at the last field commits and closes',
        'ArrowUp at the first field commits and closes']),
    I('the direction is ignored, every move goes down', ROW,
      'const next = neighbourInPanel(focusRef.current, field.name, delta)',
      'const next = neighbourInPanel(focusRef.current, field.name, 1)',
      ['ArrowUp commits and moves up']),
    I('a read-only row is a destination', ROW,
      '.field-row[data-field]:not([data-readonly])', '.field-row[data-field]',
      ['the move SKIPS the read-only row']),
    I('the panel scope is dropped for the whole document', ROW,
      '  const panel = from?.closest(PANEL)\n  if (!panel) return null',
      '  const panel = from ? document : null\n  if (!panel) return null',
      ['Enter is inert where no panel is declared', 'ArrowDown is inert where no panel is declared']),
    I('the order stops being the panel\'s own', ROW,
      '  const i = names.indexOf(name)', '  names.reverse()\n  const i = names.indexOf(name)',
      ['ArrowDown follows what is on screen, not the descriptor array']),
    I('Enter is taken from the textarea', ED,
      '  textarea: { enter: false, arrows: false },', '  textarea: { enter: true, arrows: false },',
      ['Enter in a TEXTAREA stays a newline and does not move']),
    I('the arrows are taken from the select', ED,
      '  select: { enter: true, arrows: false },', '  select: { enter: true, arrows: true },',
      ['arrows in a SELECT stay the option choice and do not move']),
    I('the arrows are taken from the date input', ED,
      '  date: { enter: true, arrows: false },', '  date: { enter: true, arrows: true },',
      ['arrows in a DATE input stay the segment step and do not move']),
    I('the new handler swallows Escape', ED,
      "    if (e.key === 'Escape') { e.preventDefault(); onRequestClose(); return }\n", '',
      ['Escape reverts and closes, and does not move']),
    I('a modified key is treated as a move', ED,
      '    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return\n', '',
      ['a modified Enter or arrow does not move']),
    I('the select loses Enter as well as the arrows', ED,
      '  select: { enter: true, arrows: false },', '  select: { enter: false, arrows: false },',
      ['Enter in a SELECT still commits and moves']),
  ],
}
