// Live calibration spec C for probe-p4-riders.mjs: what keeps the blocked list
// to ONE record. It is not a clear in StageTabs: TestBedView mounts the host
// with key={navToken ?? bed.data.id}, so every shell navigation remounts it and
// the feedback element is new. Removing the key must make the list follow.
export default {
  probe: 'scripts/testbed-core/probe-p4-riders.mjs',
  run: 'p4-riders-c',
  injections: [
    { id: 'the host is no longer remounted per navigation', file: 'frontend-react/src/testbed/TestBedView.tsx',
      find: 'return <TestBedHost key={navToken ?? bed.data.id} bed={bed.data} />',
      replace: 'return <TestBedHost bed={bed.data} />',
      expect: ['opening ANOTHER Test Bed shows none of this record\'s blocked list'] },
  ],
}
