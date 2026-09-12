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

/**
 * The verdict for one gate run.
 *
 * @param {object} o
 * @param {number} o.stageCount     how many stages the gate defines
 * @param {number} o.failed         stages that ran and failed
 * @param {number} o.skippedRequired stages marked required that did not run
 * @param {number} o.skippedOther   stages that did not run and are not required
 * @param {boolean} o.roundClose    true when this run is gating a round close
 * @returns {{lines: string[], exitCode: number}}
 */
export function gateVerdict({
  stageCount, failed = 0, skippedRequired = 0, skippedOther = 0, roundClose = false,
}) {
  const skipped = skippedRequired + skippedOther
  const ran = stageCount - skipped
  const lines = []

  if (failed) {
    lines.push(`${failed} of ${stageCount} stages FAILED${skipped ? `, ${skipped} NOT RUN` : ''}. Do not merge.`)
    if (skipped) lines.push('Nothing was measured by the skipped stages. They are not findings.')
    return { lines, exitCode: 1 }
  }

  if (!skipped) {
    lines.push(`All ${stageCount} stages passed.`)
    return { lines, exitCode: 0 }
  }

  // Nothing failed, but something did not run. The old summary called this
  // "All N stages passed." It is not that, and the count says so first.
  lines.push(`${ran} of ${stageCount} stages passed, ${skipped} NOT RUN.`)
  lines.push('Nothing was measured by the skipped stages. They are not findings.')

  if (skippedRequired) {
    lines.push(
      `${skippedRequired} REQUIRED stage${skippedRequired === 1 ? '' : 's'} did not run, ` +
      'so this gate is UNANSWERED, not green.')
    if (roundClose) {
      lines.push('A ROUND CLOSE MAY NOT REST ON THIS RUN. Do not close.')
      return { lines, exitCode: 1 }
    }
    lines.push('Valid for an ordinary run. NOT valid for a round close: re-run with --round-close once the stage can run.')
  }
  return { lines, exitCode: 0 }
}
