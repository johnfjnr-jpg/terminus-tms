// Live calibration spec A for probe-p4-riders.mjs: the two ids.
export default {
  probe: 'scripts/testbed-core/probe-p4-riders.mjs',
  run: 'p4-riders-a',
  injections: [
    { id: '4.1 the feedback id removed: the proof must redden', file: 'frontend-react/src/testbed/StageTabs.tsx',
      find: '<div id="tb-next-stage-feedback" className="tb-next-stage-feedback"',
      replace: '<div className="tb-next-stage-feedback"',
      expect: ['the itemised blocking list RENDERS, every item'] },
    { id: '4.2 back loses the door-exempt id', file: 'frontend-react/src/testbed/ViewHeader.tsx',
      find: 'id="btn-back-testbeds"', replace: 'id="btn-back"',
      expect: ['on an UNOWNED record the door leaves Back live'] },
  ],
}
