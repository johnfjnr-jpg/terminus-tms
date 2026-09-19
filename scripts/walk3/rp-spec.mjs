// ── R-P CALIBRATION: the two prompts are gone, and the third stays ───────
//
// Build discipline 17 M4: this phase extends a mechanism already calibrated in
// this round, so it injects only its NEW claims. The three are that linking
// does not ask, that parking does not ask, and that park's CANCEL still does -
// the last being the one a careless removal would take with it.
const LINK = 'frontend-react/src/contact/LinkAccountPanel.tsx'
const PARK = 'frontend-react/src/contact/ParkForm.tsx'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'rp-prompts',
  testFiles: ['src/__tests__/contact-link-account.test.tsx',
    'src/__tests__/contact-capabilities.test.tsx'],
  injections: [
    // Each injection RESTORES the prompt this phase removed, which is the
    // honest direction: the claim is an absence, so the fault to inject is the
    // thing being absent.
    // ── THE FIRST DRAFT OF THIS INJECTION WAS A NO-OP AND CAME BACK SILENT,
    // which is what found the vacuous assertion behind it. The prop is gone, so
    // the only route a prompt can now take is the shared SEAM - which is both
    // the realistic way somebody would reintroduce it and the thing the test
    // had to be taught to count.
    I('the link prompt comes back, through the shared seam', LINK,
      '    if (inFlight.current) return\n    void doLink(body)',
      '    if (inFlight.current) return\n    shell.confirmDiscard(() => { void doLink(body) }); return\n    void doLink(body)',
      ['R-P: a dirty surface is NOT asked to discard, because linking loses nothing']),

    I('the park save prompt comes back', PARK,
      '    onSave(date, reason.trim())\n  }\n\n  return (',
      '    onConfirmDiscard(() => { onSave(date, reason.trim()) })\n  }\n\n  return (',
      ['R-P: parking does NOT threaten a discard, because it loses nothing']),

    // THE ONE THAT MATTERS MOST. Removing the save-path dialogue is one line
    // away from removing the CANCEL one too, and nothing else in the suite
    // would notice: the form still closes, the record is untouched, and the
    // person simply loses the date and reason they typed without being asked.
    I('the CANCEL prompt is removed along with it', PARK,
      '    if (!dirty) { onCancel(); return }\n    onConfirmDiscard(() => { onCancel() })',
      '    onCancel()',
      ['R-P: but CANCEL still asks, because the form\'s own fields really are lost']),
  ],
}
