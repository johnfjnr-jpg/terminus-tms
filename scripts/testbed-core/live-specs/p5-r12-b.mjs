// Live calibration spec for probe-p5-r12.mjs, ruling R12, direction b: the clear must not happen on a tab change (R8).
//
// ONE INJECTION PER SPEC FILE. calibrate-live.mjs builds every injection in a
// spec into ONE bundle and runs the probe once. Together, the every-render clear
// also emptied the list after the save, so the missing reload clear came back
// SILENT (.verify/tb-core/p5-calibrate-live-r12.txt): the two interact.
export default {
  probe: 'scripts/testbed-core/probe-p5-r12.mjs',
  run: 'p5-r12-b',
  injections: [
    { id: 'R8 the clear runs on every render, so a tab change clears', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: "if (reloadToken && blockedRef.current) blockedRef.current.innerHTML = ''\n  }, [reloadToken])",
      replace: "if (blockedRef.current) blockedRef.current.innerHTML = ''\n  })",
      expect: ['R8: the list is STILL THERE after a switch to Reference and back'] },
  ],
}
