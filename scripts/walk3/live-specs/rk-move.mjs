// R-K live direction A: THE MOVE ITSELF, on the served bundle.
//
// ONE INJECTION PER SPEC FILE (Round A ruling R12: calibrate-live builds every
// injection in a spec into one bundle, so two faults in one file can mask each
// other).
//
// This is the claim jsdom cannot hold on its own: the unit suite proves the
// controller opens the next row, and the live probe proves a PERSON pressing
// Enter at 1440 lands with a caret in the next editor on the real screen.
export default {
  probe: 'scripts/walk3/probe-rk-live.mjs',
  run: 'rk-move',
  injections: [
    { id: 'R-K Enter no longer commits and moves',
      file: 'frontend-react/src/field-row/editors.tsx',
      find: '  text: { enter: true, arrows: true },',
      replace: '  text: { enter: false, arrows: true },',
      expect: ['and opened the next field on the panel'] },
  ],
}
