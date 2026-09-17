// Live calibration spec for probe-p3-buyers.mjs.
export default {
  probe: 'scripts/testbed-core/probe-p3-buyers.mjs',
  run: 'p3-buyers',
  injections: [
    { id: 'contract: the body loses contact_id', file: 'frontend-react/src/testbed/buyers.ts',
      find: 'const r = await deps.post({ role, contact_id: contactId })',
      replace: 'const r = await deps.post({ role, contactId } as never)',
      expect: ['the choice fired POST /buyer-contacts with { role, contact_id }, accepted', 'the DATABASE holds the link'] },
    { id: 'door: linkBuyer no longer asks', file: 'frontend-react/src/testbed/buyers.ts',
      find: '  if (!deps.canEdit()) return { sent: false, error: null }\n',
      replace: '',
      expect: ['a forced change sends NOTHING'] },
    { id: 'layout: the message beside the controls again (the defect this phase fixed)', file: 'frontend-react/src/testbed/BuyerLinks.tsx',
      find: '<div className="tb-buyer-slot">',
      replace: "<div style={{ display: 'contents' }}>",
      expect: ['the message sits BELOW the controls'] },
  ],
}
