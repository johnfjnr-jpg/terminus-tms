// Live calibration spec B for probe-p4-riders.mjs: R8, on its own, because
// removing the feedback id (spec A) leaves nothing for this check to see.
export default {
  probe: 'scripts/testbed-core/probe-p4-riders.mjs',
  run: 'p4-riders-b',
  injections: [
    { id: 'R8 a tab change clears the list', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: '<div id="tb-next-stage-feedback" className="tb-next-stage-feedback"',
      replace: '<div key={active} id="tb-next-stage-feedback" className="tb-next-stage-feedback"',
      expect: ['R8: the list SURVIVES a switch to Reference and back'] },
  ],
}
