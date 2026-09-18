// Live calibration for probe-p3-surface.mjs: L3 removed, a locked count rendered
// as an ordinary editable field again.
export default {
  probe: 'scripts/testbed-units/probe-p3-surface.mjs',
  run: 'p3-l3',
  injections: [
    { id: 'L3 removed: the locked count is an ordinary field again', file: 'frontend-react/src/testbed/CommercialsCards.tsx',
      find: 'if (SENSORS.includes(name) && countIsLocked(name, units)) return lockedRow(name, f)',
      replace: 'if (false) return lockedRow(name, f)',
      expect: ['the SafeSight count renders locked, naming the count and where to correct it'] },
  ],
}
