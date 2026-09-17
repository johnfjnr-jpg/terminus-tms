// Live calibration spec for probe-p3-addenda.mjs, addendum (a).
export default {
  probe: 'scripts/testbed-core/probe-p3-addenda.mjs',
  run: 'p3-addenda',
  injections: [
    { id: 'the run continues past the real refusal', file: 'frontend-react/src/testbed/scoring.ts',
      find: "    if (!r.ok) return { recorded, failed: { key: c.criterion_key, error: r.error ?? 'unknown error' }, refused: false }",
      replace: '    if (!r.ok) continue',
      expect: ['the SERVER accepted the first and refused the second; the third was never sent', 'the DATABASE holds nothing for'] },
  ],
}
