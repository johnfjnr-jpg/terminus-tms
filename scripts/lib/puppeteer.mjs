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
// ── WHERE THE SCRATCH INSTALL LIVES (TERM_QUOTES rider, John 2026-11-20) ────
//
// It was /tmp/tms-probe, and /tmp is swept: check-browser-usable.mjs records
// a sweep that left the directory holding `lib` and `src` and no install, so a
// presence check passed and the browser stages would have SKIPPED. It lives in
// the user's cache now, which nothing sweeps. ONE definition of the path and of
// the recipe that names it, imported by every message that prints it
// (verify-all, check-browser-usable, this loader), so the instruction cannot
// name a path the loader does not accept (probe-loader.test.mjs checks it).
import { homedir } from 'os';
export const SCRATCH_PREFIX = `${homedir()}/.cache/tms-probe`;
export const SCRATCH_PUPPETEER = `${SCRATCH_PREFIX}/node_modules/puppeteer`;
/** The two lines a person types: install, then run `command` with the path set. */
export function scratchRecipe(command) {
  return [`npm i puppeteer --prefix ${SCRATCH_PREFIX}`, `PUPPETEER_PATH=${SCRATCH_PUPPETEER} ${command}`];
}

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
    for (const line of scratchRecipe(`node scripts/${probeName}`)) console.error(`  ${line}`);
    console.error('');
    console.error('That command is exercised rather than asserted: scripts/tests/probe-loader.test.mjs');
    console.error('imports this module and checks the printed path resolves.');
    process.exit(1);
  }
}
