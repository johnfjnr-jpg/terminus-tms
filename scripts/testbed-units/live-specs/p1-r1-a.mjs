// Live calibration spec a for probe-p1-r1.mjs: derive re-wired to opening the tab.
// One injection per spec (CLAUDE.md Verification 51, P3 extension).
export default {
  probe: 'scripts/testbed-units/probe-p1-r1.mjs',
  run: 'p1-r1-a',
  injections: [
    { id: 'R1 regression: showing the install section derives', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: '    onInstallSection: setInstallVisible,\n',
      replace: '    onInstallSection: (v) => { setInstallVisible(v); if (v) void depsRef.current.onDeriveUnits() },\n',
      expect: ['opening the tab sent ZERO non-GET requests, any origin', 'the DATABASE still holds 0 units for the bed'] },
  ],
}
