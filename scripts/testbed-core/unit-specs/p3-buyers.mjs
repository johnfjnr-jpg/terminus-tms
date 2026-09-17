// Unit calibration spec for Round A Phase 3, the client buyer rows.
const BUYERS = 'frontend-react/src/testbed/buyers.ts'
const ROWS = 'frontend-react/src/testbed/BuyerLinks.tsx'
const HOST = 'frontend-react/src/testbed/TestBedHost.tsx'
const SEAM = 'frontend-react/src/shell-services.ts'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'p3-buyers',
  testFiles: ['src/__tests__/testbed-buyers.test.tsx'],
  injections: [
    I('the old body key', BUYERS,
      'const r = await deps.post({ role, contact_id: contactId })', 'const r = await deps.post({ role, contactId } as never)',
      ['fires POST /buyer-contacts with { role, contact_id }']),
    I('the door removed from linkBuyer', BUYERS,
      '  if (!deps.canEdit()) return { sent: false, error: null }\n', '',
      ['a choice sends NOTHING']),
    // The empty-choice guard in linkBuyer was REMOVED after this spec's first
    // run found it and the row's guard each SILENT alone: redundant. The row's
    // stays, and its injection below must now fire.
    I('the empty-choice guard removed from the row', ROWS,
      '                  if (!contactId) return\n', '',
      ['an empty choice sends nothing']),
    I('the refusal loses the server\'s words', BUYERS,
      "error: r.ok ? null : (r.error ?? 'Failed to link contact.')", "error: r.ok ? null : 'Failed to link contact.'",
      ['a contact of another Account (422)', 'a deleted contact (404)']),
    I('a linked role still offers a select', ROWS,
      '        if (linked) {', '        if (false && linked) {',
      ['READ-ONLY with the contact\'s name']),
    I('no record reload after a link', HOST,
      'if (r.sent && !r.error) await load()', 'if (r.sent && !r.error) { /* no reload */ }',
      ['READ-ONLY with the contact\'s name']),
    I('the message renders under the wrong role', ROWS,
      'setErrors((x) => ({ ...x, [role]: msg }))', "setErrors((x) => ({ ...x, ['Client Commercial Buyer']: msg }))",
      ['a contact of another Account (422)', 'a deleted contact (404)']),
    I('every contact offered, not the Account\'s own', HOST,
      '.filter((c) => c.parent_record_id === accountId)', '.filter(() => true)',
      ['never another Account\'s']),
    I('the role string shown instead of the vanilla label', ROWS,
      'const label = CLIENT_BUYER_ROLE_LABELS[role] ?? role', 'const label = role',
      ['every role offers exactly']),
    I('the select stays live during its write', ROWS,
      'disabled={!!busy[role]}', 'disabled={false}',
      ['disabled while its own write is in flight']),
    I('"+ New" loses the Account', HOST,
      'shell.openInlineBuyerContact(bed.id, buyerAccountId, role)', "shell.openInlineBuyerContact(bed.id, '', role)",
      ['it opens the seam with this bed']),
    I('the door removed from "+ New"', HOST,
      '        if (!shell.canEditFields()) return\n', '',
      ['"+ New" does not open the modal']),
    I('the seam opens the modal as another record type', SEAM,
      "fn('test_bed', recordId, accountId, role)", "fn('opportunity', recordId, accountId, role)",
      ['the seam calls the shell\'s modal as a TEST BED']),
    I('the seam claims a modal it does not have', SEAM,
      "    if (typeof fn !== 'function') return false\n", "    if (typeof fn !== 'function') return true\n",
      ['not silently ignored']),
    I('no Account is not said', ROWS,
      '  if (!accountId) {', '  if (false) {',
      ['says so, and offers nothing']),
  ],
}
