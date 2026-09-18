// Live calibration spec b for probe-p1-r1.mjs: the button no longer derives.
export default {
  probe: 'scripts/testbed-units/probe-p1-r1.mjs',
  run: 'p1-r1-b',
  injections: [
    { id: 'the button no longer derives', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: 'onDerive={deps.onDeriveUnits}',
      replace: 'onDerive={async () => {}}',
      expect: ['the click sent exactly ONE derive POST, answered 200', 'the DATABASE now holds 3 units (SafeSight 2 + Air Quality 1)'] },
  ],
}
