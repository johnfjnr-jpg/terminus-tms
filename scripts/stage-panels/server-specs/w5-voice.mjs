// The superseded sentence, put back. app.js is served from disk, so writing the
// file is enough: nothing is bundled and nothing restarts.
export default {
  id: 'W5 the message names a second session again',
  file: 'frontend/app.js',
  find: "const STALE_WRITE_MESSAGE = 'This record moved on while you were working. The screen is catching up - your entry is still here; try again in a moment.'",
  replace: "const STALE_WRITE_MESSAGE = 'This record was just changed in another session. The screen is catching up - try again in a moment.'",
  probe: 'scripts/stage-panels/probe-w5-refusal.mjs',
  run: 'w5-voice',
  // Anchored on the SHELL RENDERER's own check, which runs before any write:
  // anchoring it on the save-driven assertion meant this injection also changed
  // what the probe waited for, and the run died before the check was reached.
  expect: ['the shell renderer carries the ruled sentence'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/app.js on disk' }),
}
