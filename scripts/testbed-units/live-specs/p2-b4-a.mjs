// Live calibration spec a for probe-p2-b4.mjs: the R3 refusal removed from the
// server. One injection per spec. The dev server runs under `node --watch`, so
// writing the route file restarts it; the harness's own bundle rebuild takes
// seconds, which is the settling time before the probe runs.
export default {
  probe: 'scripts/testbed-units/probe-p2-b4.mjs',
  run: 'p2-b4-a',
  injections: [
    { id: 'R3 removed: an unreadable body is answered 200 again', file: 'src/routes/test-beds.js',
      find: "    if (!Object.keys(unitPatch).length && !('state' in body)) {",
      replace: "    if (false && !Object.keys(unitPatch).length && !('state' in body)) {",
      expect: ['a wrapped body is REFUSED 400, not answered 200', 'and no revision is appended for it'] },
  ],
}
