// Live calibration for probe-p3-surface.mjs: R8 removed, the installer list open
// with no search. One injection per spec.
export default {
  probe: 'scripts/testbed-units/probe-p3-surface.mjs',
  run: 'p3-r8',
  injections: [
    { id: 'R8 removed: the list renders with no search term', file: 'frontend-react/src/testbed/InstallSection.tsx',
      find: '                {!term.trim()\n                  ? null\n                  : matchAccounts(p.accounts, term).length',
      replace: '                {matchAccounts(p.accounts, term).length',
      expect: ['the installer list is CLOSED until somebody types'] },
  ],
}
