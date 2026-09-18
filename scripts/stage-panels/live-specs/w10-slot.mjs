// W10 undone: the recorded reason goes back under the row, where the person who
// wrote it never looked. Bundled source, so the harness rebuilds.
export default {
  probe: 'scripts/stage-panels/probe-walk2.mjs',
  run: 'w10-slot',
  injections: [
    { id: 'W10 the recorded reason renders under the row again',
      file: 'frontend-react/src/testbed/StagePanel.tsx',
      find: '                : current && (current.comment || current.reason)',
      replace: '                : false && current && (current.comment || current.reason)',
      expect: ['W10: and it renders RIGHT of the score, where it was entered'] },
  ],
}
