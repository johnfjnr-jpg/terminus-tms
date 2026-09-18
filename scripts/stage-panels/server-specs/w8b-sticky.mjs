// W8b undone: the bar stops sticking, which is the state W1 recorded twice.
export default {
  id: 'W8b the save bar stops following the page',
  file: 'frontend/style.css',
  find: '  position: sticky;\n  bottom: 0;\n  z-index: 3;\n  background: var(--dark);\n}',
  replace: '}',
  probe: 'scripts/stage-panels/probe-w8b.mjs',
  run: 'w8b-sticky',
  expect: ['Test Bed: with the page scrolled into its middle, the bar is still ON SCREEN'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/style.css on disk' }),
}
