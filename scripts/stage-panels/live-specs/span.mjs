// Live calibration for the pilot probe, direction B: the SPAN.
//
// R2's second half is that scoring takes the whole row until a third 430px
// column fits at 1686px. The rule that does it is one stylesheet line, and
// nothing in the React tree mentions it: remove it and the scoring card
// becomes an ordinary column, which no unit test can see.
export default {
  probe: 'scripts/stage-panels/probe-pilot.mjs',
  run: 'calib-span',
  // Nothing here is bundled, so the bundle cannot move. The harness checks the
  // premise instead: that the server reads this directory from disk, with
  // no-store, so the bytes this injection writes are the bytes served.
  servedFromDisk: 'frontend',
  injections: [
    { id: 'R2 scoring stops spanning the row', file: 'frontend/style.css',
      find: '.tb-stage-panels-row > [data-testid="tb-stage-scoring-card"] { grid-column: 1 / -1; }',
      replace: '.tb-stage-panels-row > [data-testid="tb-stage-scoring-card"] { grid-column: auto; }',
      expect: ['1440: scoring spans the whole row'] },
  ],
}
