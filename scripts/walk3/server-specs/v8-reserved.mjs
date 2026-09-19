// V8's defect, injected: space reserved on the rows that render NO reason.
//
// Asymmetry is the whole of the finding. A gap added to EVERY row is a spacing
// decision and the probe rightly ignores it; a gap added only where the line is
// absent is a row holding space for something it is not showing, and that is
// what must be caught.
//
// `:has()` is how a stylesheet expresses "a head with no reason in it", and it
// is what makes this injectable without touching the component.
export default {
  id: 'V8 rows without a reason reserve space for one',
  file: 'frontend/style.css',
  find: '.tb-score-quieted {',
  replace: '.tb-score-head:not(:has(.tb-score-current)) { padding-bottom: 18px; }\n.tb-score-quieted {',
  probe: 'scripts/walk3/probe-v8.mjs',
  run: 'v8-reserved',
  // Anchored on the HEAD check. It first named the internal-spacing check and
  // came back SILENT: padding inside the head moves the head's bottom AND the
  // question below it by the same amount, so every gap BETWEEN the row's parts
  // is unchanged. The silence named a shape the instrument could not see, which
  // is what a calibration is for (Verification 51).
  expect: ['V8: and no row reserves space inside its head for a reason it is not showing'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/style.css on disk' }),
}
