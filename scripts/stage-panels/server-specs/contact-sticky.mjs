// The Contact header stops sticking, which is the state the measurement found.
export default {
  id: 'the Contact header scrolls away again',
  file: 'frontend/style.css',
  find: '.cd-header {\n  position: sticky;\n  top: 0;\n  z-index: 3;\n  background: var(--dark);\n  padding-bottom: 6px;\n}',
  replace: '.cd-header {\n  padding-bottom: 6px;\n}',
  probe: 'scripts/stage-panels/probe-contact-visibility.mjs',
  run: 'contact-sticky',
  expect: ['THE ANSWER: Save and Discard are on screen at full scroll'],
  restartMs: 0,
  live: async () => ({ servedFrom: 'frontend/style.css on disk' }),
}
