// 3.5 undone: the reload control goes back to the Opportunity loader for every
// surface, which is the state the walk's second finding names.
export default {
  id: '3.5 the reload control ignores the surface again',
  file: 'frontend/app.js',
  find: '  await (STALE_RELOADERS[kind] ?? STALE_RELOADERS.opportunity)(recordId)',
  replace: '  await STALE_RELOADERS.opportunity(recordId)',
  probe: 'scripts/stage-panels/probe-w5-refusal.mjs',
  run: 'w5-reload',
  expect: ['3.5: reloadAfterStaleWrite brings back the TEST BED, not an Opportunity'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/app.js on disk' }),
}
