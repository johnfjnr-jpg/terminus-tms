// Unit calibration spec for Test Bed units Phase 1 (audit R1): a read never writes.
// Run: node scripts/testbed-core/calibrate-unit.mjs scripts/testbed-units/unit-specs/p1-r1.mjs
const TABS = 'frontend-react/src/testbed/StageTabs.tsx'
const LOAD = 'frontend-react/src/testbed/stageLoad.ts'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'p1-r1',
  testFiles: ['src/__tests__/testbed-units-derive.test.tsx', 'src/__tests__/testbed-stage-tabs.test.ts'],
  injections: [
    I('R1 regression at the host: showing the install section derives', TABS,
      '    onInstallSection: setInstallVisible,\n',
      '    onInstallSection: (v) => { setInstallVisible(v); if (v) void depsRef.current.onDeriveUnits() },\n',
      ['opening the Installation tab sends NO write, and derive never fires']),
    I('R1 regression in the loader: opening Installation calls a derive dependency', LOAD,
      '    const isInstall = stage === INSTALL_STAGE\n',
      '    const isInstall = stage === INSTALL_STAGE\n    if (isInstall) (deps as { onDeriveUnits?: () => void }).onDeriveUnits?.()\n',
      ['P7 opening ANY tab derives nothing, Installation and Commissioning included']),
    I('the button no longer derives', TABS,
      'onDerive={deps.onDeriveUnits}',
      'onDerive={async () => {}}',
      ['the BUTTON derives: exactly one derive POST, and the pane shows the units the route returned']),
  ],
}
