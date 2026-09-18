// R11 direction: the approver lines go back to `.sub`'s own 32px, so the three
// read as separate statements again. The stylesheet is served from disk, so
// writing the file is enough; nothing is bundled and nothing restarts.
export default {
  id: 'R11 the approver lines are three paragraphs again',
  file: 'frontend/style.css',
  find: '.tb-stage-approvals .sub { margin-bottom: 4px; }',
  replace: '.tb-stage-approvals .sub { margin-bottom: 32px; }',
  probe: 'scripts/stage-panels/probe-r11.mjs',
  run: 'r11-list',
  expect: ['1240: the approver lines read as one list, tighter inside than outside'],
  restartMs: 0,
  live: async () => ({ servedRule: 'read from frontend/style.css on disk, which is what the server sends' }),
}
