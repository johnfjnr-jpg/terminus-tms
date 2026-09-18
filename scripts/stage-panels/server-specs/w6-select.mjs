// W6 undone: the select goes back to a fixed 118px for a 54px option, which is
// what left the reason beside it squeezed.
export default {
  id: 'W6 the select is a fixed width again',
  file: 'frontend/style.css',
  find: '.tb-score-select {\n  flex: 0 0 auto;\n  width: auto;\n  min-width: 0;\n}',
  replace: '.tb-score-select {\n  flex: 0 0 auto;\n  width: 118px;\n  min-width: 118px;\n}',
  probe: 'scripts/stage-panels/probe-walk2.mjs',
  run: 'w6-select',
  expect: ['W6: the select is sized to its content plus a chevron'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/style.css on disk' }),
}
