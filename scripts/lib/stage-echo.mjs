// ── A STAGE'S OWN LINES, COPIED ONTO THE GATE'S CONSOLE ──────────────────
//
// GOLDEN_STATUS round, R-GS4, ruled by John 2026-11-15: the golden deals
// per-deal status table and the "pricing may not move" message print on EVERY
// run, and the gate output shows them. The gate prints one summary line per
// stage and buries everything else in the .verify transcript, so without this
// no status reached the person reading the gate at all, PROVISIONAL or
// CONFIRMED.
//
// THE GATE COPIES, IT DOES NOT RECOMPUTE. The block is the stage's own output
// between two marker lines, so there is still one reader of the status: the
// harness. A gate that worked the status out again would be Verification 20's
// second reader, arriving in the instrument everything reports from.
//
// AND A MISSING BLOCK ON A PASSING STAGE FAILS THE STAGE, LOUDLY. A block that
// can go missing without anything objecting is a control that deletes its own
// evidence of use (Verification 12, from the author's side): the gate would go
// on printing a clean summary while showing nobody the status.

/**
 * @param {{ begin: string, end: string }} echo  marker lines, matched whole
 * @param {string} output  the stage's stdout and stderr
 * @param {boolean} ok     whether the stage exited 0
 * @returns {{ ok: boolean, lines: string[] | null, problem: string | null }}
 */
export function stageEcho(echo, output, ok) {
  const all = output.split('\n')
  const b = all.findIndex((l) => l === echo.begin)
  const e = b === -1 ? -1 : all.findIndex((l, i) => i > b && l === echo.end)
  if (b !== -1 && e !== -1) return { ok, lines: all.slice(b, e + 1), problem: null }
  const problem = b === -1
    ? `the stage printed no "${echo.begin}" block`
    : `the stage's "${echo.begin}" block has no "${echo.end}" line`
  // A failing stage is already red, so the missing block is reported and does
  // not change the verdict. A PASSING stage without its block is turned red.
  return { ok: false, lines: null, problem: ok ? `${problem}, so a passing stage is failed: its echo is part of its result` : problem }
}
