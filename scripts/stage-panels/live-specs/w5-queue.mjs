// Live calibration: the defect itself, put back into the host.
//
// The queue is bypassed on the note path, so that writer reads the host's
// `record.latest_revision_number` exactly as it did before W5. The pair probe
// must go red on the SAME claim it went red on before the fix.
export default {
  probe: 'scripts/stage-panels/probe-w5-pairs.mjs',
  run: 'w5-queue-injected',
  injections: [
    { id: 'W5 the note write reads the host\'s revision again',
      file: 'frontend-react/src/testbed/TestBedHost.tsx',
      find: `            const r = await queue.write((expected) => shell.api<{ error?: string }>(
              'PATCH', \`/api/test-beds/\${bed.id}\`, {
                payload: {
                  notes: prepend(note(text, shell.currentUserEmail(), new Date().toISOString()), notes),
                },
                expected_revision: expected,
              }))`,
      replace: `            const r = await shell.api<{ error?: string }>(
              'PATCH', \`/api/test-beds/\${bed.id}\`, {
                payload: {
                  notes: prepend(note(text, shell.currentUserEmail(), new Date().toISOString()), notes),
                },
                expected_revision: Number.isInteger(record.latest_revision_number)
                  ? record.latest_revision_number : null,
              })`,
      expect: ['pair 1: BOTH are accepted, neither refused'] },
  ],
}
