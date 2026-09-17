// Live calibration spec for probe-p5-r12.mjs, ruling R12, direction a: the clear must happen on the host reload after a save.
//
// ONE INJECTION PER SPEC FILE. calibrate-live.mjs builds every injection in a
// spec into ONE bundle and runs the probe once. Together, the every-render clear
// also emptied the list after the save, so the missing reload clear came back
// SILENT (.verify/tb-core/p5-calibrate-live-r12.txt): the two interact.
export default {
  probe: 'scripts/testbed-core/probe-p5-r12.mjs',
  run: 'p5-r12-a',
  injections: [
    { id: 'R12 the host reload no longer clears the list', file: 'frontend-react/src/testbed/TestBedHost.tsx',
      find: '    setReloads((n) => n + 1)\n', replace: '',
      expect: ['R12: after the host reload the list is GONE, the element remains with its id, and the view never left'] },
  ],
}
