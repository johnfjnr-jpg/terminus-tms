/**
 * Resolve puppeteer for a probe, from wherever it was scratch-installed.
 *
 * ── WHY THIS IS A MODULE AND NOT A BLOCK PASTED SIX TIMES ─────────────────
 *
 * puppeteer is deliberately not a dependency of this repository: it pulls a
 * browser download and CI runs `npm ci` on every push. So every browser probe
 * resolves it from a scratch install and every probe carried its own copy of
 * the resolution.
 *
 * ROUND 41 FIXED ONE COPY AND LEFT THREE BROKEN, which is CLAUDE.md build
 * discipline 6 exactly: a fix built for the files that existed at the time is
 * not a fix for the files beside them. The printed remediation named the
 * package DIRECTORY, and a dynamic import of a directory is
 * ERR_UNSUPPORTED_DIR_IMPORT in ESM, so following the instruction verbatim
 * reproduced the failure it was written to resolve. Three probes were fixed
 * because they were the three being run that afternoon; probe-strip-layout,
 * probe-screen-findings and probe-fact-census were not, and the next person to
 * run one would have hit the identical wall.
 *
 * Rule 37 is why it became a module rather than a fourth paste: the rule is
 * about the EFFECT, and six copies of a block is six places for the effect to
 * come back. There is one now.
 *
 * @param {string} probeName - used only in the failure message
 * @returns {Promise<object>} the puppeteer default export
 */
export async function loadPuppeteer(probeName) {
  const dir = process.env.PUPPETEER_PATH;
  try {
    return (await import(dir ?? 'puppeteer')).default;
  } catch {
    // The one recovery this can perform itself: given a directory, read where
    // its own package.json says the entry point is, and import that. Resolved
    // through `exports` rather than a hardcoded lib path, so it survives a
    // puppeteer version moving its files.
    const { existsSync, readFileSync } = await import('fs');
    if (dir && existsSync(`${dir}/package.json`)) {
      const entry = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')).exports?.['.']?.import;
      if (entry) {
        try {
          return (await import(new URL(entry, `file://${dir}/`).href)).default;
        } catch { /* fall through to the message */ }
      }
    }
    console.error('puppeteer is not available, and it is not a dependency of this repository.');
    console.error('  npm i puppeteer --prefix /tmp/tms-probe');
    console.error(`  PUPPETEER_PATH=/tmp/tms-probe/node_modules/puppeteer node scripts/${probeName}`);
    console.error('');
    console.error('That command is exercised rather than asserted: scripts/tests/probe-loader.test.mjs');
    console.error('imports this module and checks the printed path resolves.');
    process.exit(1);
  }
}
