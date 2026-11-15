// ── WHAT A GATE RUN MEANS, AS ONE FUNCTION ───────────────────────────────
//
// F6 from the LEADS close, 2026-09-11. The gate printed `All 22 stages
// passed.` on a run where the door stage had SKIPPED for want of a browser:
// 21 PASS and 1 SKIP, summarised as all passing.
//
// That is a false green inside the instrument the whole estate quotes at
// itself, and it was caught only because a closing instruction happened to
// name the stage. The stage's own source already carried the ruling its
// summary contradicted:
//
//   A SKIP is valid for a working gate run on a machine with no browser. It
//   is UNANSWERED at a round close. A round that closes on a SKIP here has
//   measured nothing about the door.
//
// ── WHY THE FIX IS TWO THINGS AND NOT ONE ────────────────────────────────
//
// The obvious fix - fail on any SKIP - would break a deliberate decision
// recorded in verify-all.mjs: puppeteer is not a dependency, and "a gate that
// goes red for a missing optional tool is a gate people learn to ignore".
// That reasoning still holds. So the two concerns are separated:
//
//   THE SUMMARY never claims every stage passed when one did not run. That
//   is true of every run, on every machine, and costs nobody anything.
//
//   THE ROUND-CLOSE MODE fails on a skipped REQUIRED stage. A close is the
//   one moment the ruling above is about, and it is opt-in so an ordinary
//   run on a laptop with no browser still behaves as it always has.
//
// Lives in its own module so it can be exercised without running a
// seventeen-minute gate. The gate is the caller, not the definition.

// ── SUPERSEDED, 2026-11-15, GATE HYGIENE G1. Ruled by John ─────────────────
//
// THE TWO-CONCERN SPLIT ABOVE IS SUPERSEDED, AND ITS REASONING IS LEFT
// STANDING ON PURPOSE. F6 held that a gate going red for a missing optional
// tool "is a gate people learn to ignore", so a skip printed honestly and
// still exited 0, and only an opt-in `--round-close` run made a skipped
// REQUIRED stage fatal.
//
// THE PREMISE THAT FAILED: that an honest summary line is enough. The exit
// code is what every caller reads - a script, a hook, a person scanning for
// green - and it said 0 on a run that had measured less than it claimed. And
// "required" was a property of ONE stage, so every other stage's skip could
// never be fatal. Measured on 2026-11-15: PUPPETEER_PATH unset read "24 of 26
// stages passed, 2 NOT RUN ... UNANSWERED, not green" and exited 0.
//
// AND A SECOND KIND OF HOLE THE SPLIT NEVER SAW: a stage that RUNS, skips
// part of itself, and exits 0. The term initial-value probe printed a SKIP
// line on every gate run, including one that summarised "All 26 stages
// passed.". Nothing read it.
//
// THE RULE NOW, and it is one rule: A STAGE THAT DID NOT RUN TO A PASS OR
// FAIL RESULT IS A FAILED GATE. Not run (no browser, a pre-stage failed) and
// skipped inside (a SKIP line, a node `skipped`/`todo` count, a vitest
// `skipped`/`todo` count) are both red, and both are NAMED. `--round-close`
// is accepted and changes nothing: every run is held to that standard now.

/**
 * What a stage's own output says it did NOT measure, though it exited 0.
 *
 * @param {string} output the stage's captured stdout and stderr
 * @returns {string[]} one entry per hole, empty when the stage measured all of itself
 */
export function skipsInside(output) {
  const holes = []
  // node:test's summary, `ℹ skipped 2` / `ℹ todo 1`, and its TAP form.
  for (const m of output.matchAll(/^(?:ℹ|#) (skipped|todo) (\d+)$/gm)) {
    if (Number(m[2]) > 0) holes.push(`node:test ${m[1]} ${m[2]}`)
  }
  // vitest's summary: `Tests  35 passed | 2 skipped (37)`, and `todo`.
  for (const m of output.matchAll(/^\s*Tests\s+.*?\b(\d+) (skipped|todo)\b/gm)) {
    if (Number(m[1]) > 0) holes.push(`vitest ${m[2]} ${m[1]}`)
  }
  // A probe's own skip line, which is how this estate's probes say it. At a
  // line start and followed by whitespace, so `SKIPPED` in prose or a word
  // mid-line cannot satisfy it.
  for (const m of output.matchAll(/^SKIP\s+(.*)$/gm)) holes.push(`SKIP ${m[1].trim().slice(0, 140)}`)
  return holes
}

/**
 * The verdict for one gate run.
 *
 * @param {object} o
 * @param {number} o.stageCount  how many stages the gate defines
 * @param {number} o.failed      stages that ran and failed
 * @param {{name: string, why: string}[]} o.notRun  stages that did not run
 * @param {{name: string, holes: string[]}[]} o.skippedInside  stages that exited 0 having skipped part of themselves
 * @param {boolean} o.roundClose accepted, and no longer changes anything
 * @returns {{lines: string[], exitCode: number}}
 */
export function gateVerdict({ stageCount, failed = 0, notRun = [], skippedInside = [], roundClose = false }) {
  const lines = []
  const bad = failed + notRun.length + skippedInside.length
  if (!bad) {
    lines.push(`All ${stageCount} stages passed.`)
  } else {
    const parts = [failed && `${failed} FAILED`, notRun.length && `${notRun.length} NOT RUN`,
      skippedInside.length && `${skippedInside.length} SKIPPED INSIDE`].filter(Boolean)
    lines.push(`${stageCount - bad} of ${stageCount} stages passed; ${parts.join(', ')}. Do not merge.`)
    for (const s of notRun) lines.push(`  NOT RUN         ${s.name}: ${s.why}`)
    for (const s of skippedInside) for (const h of s.holes) lines.push(`  SKIPPED INSIDE  ${s.name}: ${h}`)
    if (notRun.length || skippedInside.length) {
      lines.push('A stage that did not run, or skipped part of itself, measured less than this gate claims. That is a red gate, not a pass with a footnote.')
    }
  }
  if (roundClose) lines.push('--round-close is accepted and changes nothing: every run is held to that standard.')
  return { lines, exitCode: bad ? 1 : 0 }
}
