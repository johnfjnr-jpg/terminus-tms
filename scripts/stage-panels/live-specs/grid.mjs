// Live calibration for the pilot probe, direction A: the COLUMN COUNT.
//
// ONE INJECTION PER SPEC FILE (Round A ruling R12's reason: calibrate-live
// builds every injection in a spec into one bundle, so two faults in one file
// can mask each other).
//
// This is the claim jsdom cannot hold. Without the grid class the three panels
// stack at the row's full width, so the pair stops measuring 530 and 530 at
// 1440 and stops sitting on one line. The unit suite sees only that the class
// is gone; the widths are what a person sees.
export default {
  probe: 'scripts/stage-panels/probe-pilot.mjs',
  run: 'calib-grid',
  injections: [
    { id: 'R2 the row is not a grid', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: '<div className="tb-stage-panels-row" data-testid="tb-stage-panels-row">',
      replace: '<div className="" data-testid="tb-stage-panels-row">',
      expect: ['1440: the pair measures 530 and 530 as the split predicts'] },
  ],
}
