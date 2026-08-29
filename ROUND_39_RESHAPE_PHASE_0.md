# Round 39: the Commercials reshape

## Phase 0, investigation and plan. No code.

Opened 2026-08-29 on `round-39-commercials-reshape`, branched from
`61ac7c4` / tag `controls-complete`.

---

## A sequencing question, first, because it changes what this round is

**The standing queue was "approving surface, then the reshape", stated twice.
The instruction that opened this round was "Open the reshape".**

I have opened the reshape and I am naming the discrepancy rather than resolving
it silently. Three readings, and they are materially different work:

1. **The approving surface is deferred, not dropped.** The reshape runs now; the
   stage-row-becomes-a-status-display work follows it. This is what I have
   assumed.
2. **The approving surface is dropped.** Unlikely, since section 6a of the phase
   opener was scoped in detail two messages ago.
3. **They interleave** - the approval entry point on Commercials is part of the
   reshape, since the reshape rebuilds the panel that carries it.

**Reading 3 has something in it and it is not the whole of the approving
surface.** The reshape must not lose the approval entry point or save-then-
version, which `ROUND_38_PHASE_2_BOUNDARY.md` section 7 already records as
load-bearing. That is a constraint on this round either way.

**Assumed: reading 1.** Correct me and this brief adjusts; nothing below depends
on it except the ordering of the last phase.

---

## What this round is

> **The Deal Sheet sits on a sub-tab of its own, so the number cannot be seen at
> the same time as any input that changes it.**

That sentence is the brief. Everything below traces to it.

**And the shape of the answer is already known**, from the business's own walk of
task 1:

> **Steps 4 to 6 are a loop, and the loop is the product.**
>
> 1-3. Units, mounting, term. Once.
> 4. Look at the margin. Acceptable?
> 5. If not, move something. Almost always discount, occasionally term.
> 6. Back to 4.
> 7. Save, version, reason.

**So this is not "put the five sub-tabs on one page".** A single scrolling page
with all 59 fields removes the sub-tab switches and keeps the density, and it
makes the loop *worse*: the margin and the control that moves it end up further
apart than they are today, not closer.

**It is two things:**

- **Entry that reaches a number quickly.** Three inputs, then a margin.
- **A tight adjust-and-see loop**, with the two or three controls that move
  margin sitting beside the margin itself, and everything else off screen.

---

## What is already decided, and is not reopened here

| | Where |
|---|---|
| Three cards go; **Base cost data, per unit** becomes a read-only reference panel visible during entry, carrying batch labels, effective dates and the same staleness bands as the approval page | `ROUND_38_PHASE_2_BOUNDARY.md` section 7 |
| The approval entry point and save-then-version stay together through the reshape | same, section 7, and `DESIGN_PRINCIPLES.md` |
| Task 3's reading order is deliberately the approval page's block order | `RESHAPE_BASELINE.md` |
| Payment Terms is a section somebody goes to deliberately, never one they scroll past | the task 1 walk |
| Success is measured on switch counts primarily, with the business's ceilings as a check on that measure | `RESHAPE_BASELINE.md` |

---

## Investigations, before any plan is proposed

**I1. Read the prototype first, in full, and cite lines.** Rule 8 and
`CLAUDE.md` build discipline rule 4. `Terminus Ops.dc.html` is in the repository
root, untracked. The reshape is a layout question and the prototype is the only
place a layout was ever specified. **Report where it disagrees with this brief.**
Round 38 Phase 0 found six disagreements and the count was the finding.

**I2. Where does the margin actually appear today, and what is the shortest
possible distance between it and `targetMargin`?** Measured in pixels at 1240,
not asserted. This is the loop's cost expressed as a number, and it is the one
figure this round has to move.

**I3. What does `recompute()` cost?** The loop redraws on every keystroke today.
Before designing a live loop, measure what one recompute-and-render costs with a
realistic payload, and whether the Deal Sheet render is the expensive part. A
loop that stutters is worse than a tab switch.

**I4. What is genuinely on Payment Terms, and how much of it is reachable by a
typical deal?** 28 inputs, 7 selects, 19 buttons. Enumerate them and classify:
never-touched, sometimes, always. The answer decides whether Payment Terms is a
disclosure section or a second screen.

**I5. What breaks if the sub-tab panels stop existing?** `deal-tab-hw`,
`-install`, `-terms`, `-sheet`, `-payment` are addressed by id in
`opportunity-deal.js` and by the tab toggle. Enumerate every reader of those ids
before proposing to remove them. Architecture rule 9: a destructuring or
id-based reader gives no feedback when its target vanishes.

**I6. The three-widths baseline.** Capture tasks 1 and 3 at 1240, 1920 and 3440
on the tab as it stands, per `RESHAPE_BASELINE.md`. **Verification 6 applies:
capture the same unchanged tree twice and confirm the two agree before comparing
anything.** This is the before half and it cannot be taken after the fact.

**I7. Does anything outside Commercials depend on the Deal Sheet being on its
own sub-tab?** The approval page reads the same payload but renders its own
markup. Confirm rather than assume.

---

## Output for Phase 0

1. Each investigation answered, with line citations for I1 and measurements for
   I2, I3, I4 and I6.
2. **The disagreement count between the prototype and this brief**, reported
   before any plan.
3. A proposed phase plan, and not before item 2.
4. **Anything in this brief that Phase 0 finds to be wrong**, stated plainly.
   Round 38's output item 6 has caught a brief's central premise being wrong
   repeatedly, and this brief's central premise - that the loop is the product -
   came from one walk by one person and has not been measured.

**Then stop.**
