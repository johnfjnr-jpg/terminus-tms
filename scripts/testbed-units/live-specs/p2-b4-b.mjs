// Live calibration spec b for probe-p2-b4.mjs: break 1 back in the client, the
// route that does not exist.
export default {
  probe: 'scripts/testbed-units/probe-p2-b4.mjs',
  run: 'p2-b4-b',
  injections: [
    { id: 'break 1 returns: the client calls /api/units/:unitId', file: 'frontend-react/src/testbed/TestBedHost.tsx',
      find: "'PATCH', `/api/test-beds/${bed.id}/units/${unitId}`,",
      replace: "'PATCH', `/api/units/${unitId}`,",
      expect: ['the save goes to the REAL route, PATCH /test-beds/:id/units/:unitId', 'the DATABASE holds the typed serial'] },
  ],
}
