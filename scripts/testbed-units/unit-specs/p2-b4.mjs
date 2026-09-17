// Unit calibration spec for Test Bed units Phase 2 (audit B4): each of the three
// breaks reinjected on its own, each reddening the test that names it.
const HOST = 'frontend-react/src/testbed/TestBedHost.tsx'
const PANE = 'frontend-react/src/testbed/UnitsPane.tsx'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'p2-b4',
  testFiles: ['src/__tests__/testbed-units-save.test.tsx'],
  injections: [
    I('break 1: the client calls /api/units/:unitId again', HOST,
      "'PATCH', `/api/test-beds/${bed.id}/units/${unitId}`,",
      "'PATCH', `/api/units/${unitId}`,",
      ['blurring a typed serial PATCHes /test-beds/:id/units/:unitId with a FLAT serialNumber']),
    I('break 2: the body is wrapped in payload again', HOST,
      '{ [field]: value, expected_revision: expectedRevision }',
      '{ payload: { [field]: value }, expected_revision: expectedRevision }',
      ['blurring a typed serial PATCHes /test-beds/:id/units/:unitId with a FLAT serialNumber']),
    I('break 3: the field is named serial again', PANE,
      "queues.current.write(u.id, 'serialNumber', e.target.value)",
      "queues.current.write(u.id, 'serial', e.target.value)",
      ['blurring a typed serial PATCHes /test-beds/:id/units/:unitId with a FLAT serialNumber']),
    I('break 3, the read half: the row prefills from a key nobody has', PANE,
      'defaultValue={String(u.serialNumber ?? \'\')}',
      "defaultValue={String((u as { serial?: string }).serial ?? '')}",
      ['the row PREFILLS from serialNumber, the key the route returns']),
  ],
}
