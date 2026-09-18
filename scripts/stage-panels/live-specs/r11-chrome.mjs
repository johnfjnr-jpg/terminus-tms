// R11 direction: the exit criteria panel loses the estate's card class, which
// is the state the screenshots found and the one the pairing created.
//
// calibrate-live rather than calibrate-server, because this source is BUNDLED:
// writing the file changes nothing a browser sees until the bundle is rebuilt,
// and that harness rebuilds and proves the bundle moved before it measures.
export default {
  probe: 'scripts/stage-panels/probe-r11.mjs',
  run: 'r11-chrome',
  injections: [
    { id: 'R11 the exit criteria panel stops wearing the estate card',
      file: 'frontend-react/src/testbed/StagePanel.tsx',
      find: '    <div className="pg-card" data-testid="tb-stage-exit-criteria-list" data-stage={stage}>',
      replace: '    <div data-testid="tb-stage-exit-criteria-list" data-stage={stage}>',
      expect: ['1240: the exit criteria panel wears the same chrome as the scoring card'] },
  ],
}
