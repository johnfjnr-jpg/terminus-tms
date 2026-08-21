# Round 17A input: business testing findings

**Not a brief.** This is the raw input a Round 17A brief would be written
from. It records what the business reported, what the code actually shows at
each locus, and where the two differ. Nothing here has been built or fixed.

Source: business testing after Round 17 merged (`715c0ad`, 2026-08-21
11:23:24 +0800). Seven issues were reported. **Issue 1, the severe one, is
recorded separately as open item 35 in `DESIGN_PRINCIPLES.md`** and is not
repeated here beyond the cross-references below, which matter because two of
the six turn out to touch it.

**Read the verification status on each item before scoping it.** Three of the
six were reported with a stated cause; **two of those three are wrong about
the mechanism** while being right that the behaviour is broken. Scoping a fix
to the reported cause would miss in both cases.

---

## 2. Increasing a count after a downward correction does not restore a slot

**Reported:** increasing a count after a downward correction does not work and
does not re-open a slot. The correction path handles downward only, and
explicit one-time derivation means nothing creates the restored slot.

**Verified: the first half is right and the second half is wrong, which
changes where the fix goes.**

The correction path is downward-only, as reported.
`src/routes/test-beds.js:689` soft deletes surplus slots when
`l.want < l.have.length`, and the comment at 702 states plainly that raising a
count creates no slots. An upward correction therefore succeeds, writes the
new count to the payload, and logs `unit_count_corrected`, leaving the count
reading 12 against 10 units with nothing on screen reconciling them.

**But derivation is NOT one-time, and the server can already restore the
slot.** `POST /api/test-beds/:id/units/derive` is idempotent by construction:
`test-beds.js:1804` loops `for (let i = have.length; i < want; i++)`, so
called again with the count at 12 and 10 units present it creates exactly the
two missing slots. It even avoids reissuing an index, continuing from
`max(index)` at 1802, so a restored slot is a new slot rather than a
resurrected one.

**What actually blocks it is the client.**
`frontend/test-bed-detail.js:2522` gates the entire derive control behind
`if (!tbUnits.length)`. Once any unit exists the button is never rendered
again, so the only caller of a working idempotent endpoint disappears at the
moment it would first be useful.

**Consequence for scoping.** This is a UI reachability gap, not a missing
server capability. The decision the brief has to take is what the units view
offers once slots exist, not what `derive` should do.

**One ambiguity the brief must resolve first.** "Does not work" may mean the
upward correction is refused, or may mean it applies but restores no slot. The
code says the latter. If the business saw an actual refusal, that is a
different fault and this reading is wrong.

---

## 3. The calendar allows a go-live date before the installation date

**Reported:** Round 15 Phase 1's native `min` is likely applied at render and
stale when the installation date changes in the same session.

**Verified, and the code says so about itself.**
`frontend/test-bed-detail.js:224` computes the bound from `tbPayload`, and the
comment immediately above it, at 220, already records the limitation: "Both
read `tbPayload`, so the bound reflects what is stored rather than what is on
screen. A user editing both in one batch gets no client bound for the pair and
is caught by the server."

So the stale-at-render diagnosis is correct and was a known, deliberate
trade-off rather than an oversight. **The `min` and `max` attributes are
written once into the input tag at 234 to 236 and never recomputed.**

**The part that needs checking before this is scoped**, because it decides
whether this is a cosmetic gap or a real one: the server half was supposed to
catch it. `src/routes/test-beds.js:792` compares the pair on the merged
payload. **Whether that check actually refuses the ordering the business
produced has not been tested here**, and it is the difference between "the
browser let me type it and the server refused" and "the browser let me type it
and it saved". The business reporting that the calendar "allows" it does not
distinguish the two. Establish which before writing the fix.

---

## 4. Cost summaries read zero while values are on screen unsaved

**Reported as a design question rather than a defect. Confirmed as
behaving exactly as built.**

`renderTbCostBreakdown` reads `tbBed.costBreakdown`
(`frontend/test-bed-detail.js:845`), which is server-computed by
`calculateTestBedCost` from the stored payload. Draft values live in
`tbEdits` and are never an input to it. So every figure on the card describes
the last save, and an unsaved rate contributes nothing.

**This is Architecture rule 3 working as intended**, and that is the reason
the question is not trivial. The card shows no figure the server would not
also produce. Computing a preview from drafts in the browser creates a second
computation path over the same inputs, which is precisely what Round 9's
single-evaluator decision exists to prevent, and it would agree today and
drift later.

**So the question is not "should it update live" but "how does a total say
that it is stale".** Recording that framing because the obvious fix is the one
the architecture rules out.

---

## 5. The scoring error banner persists through a stage transition

**Reported as likely stale UI rather than a gate failure. Verified as stale
UI, and the reason is a fix that did not reach a path built later.**

`recordTbScores` writes the failure into `tb-save-feedback`
(`frontend/test-bed-detail.js:1664`). `clearTbSaveFeedback()` has exactly four
callers: `setTbScore` at 1501, `openTbField` at 2131, `saveTbFields` at 2202,
and cancel-all at 2330. **The transition path is not among them.**
`window.attemptTransition` (`frontend/app.js:1036`) clears its own feedback
element at 1038 and, on success, calls `loadTestBedDetail(id)`, which never
touches `tb-save-feedback`. The banner therefore survives both the transition
and the reload.

**This is the same defect as a fix already in the file.** The comment at
`test-bed-detail.js:2118` records a 2026-08-15 fix for a stale
`tb-save-feedback` persisting into an unrelated field open. That fix added the
clear to `openTbField` and stopped there. The transition path was not a
caller then. **Build discipline rule 6, confirmed for the fourth time: a fix
built for the paths that existed is not a fix for the path built after it.**

**Scope it as a sweep, not as a line.** The question is which state changes
should clear the save banner, answered once, rather than adding a fifth
caller and waiting for the sixth path.

---

## 6. Merge the Total Cost line into the Cost summary panel

**Reported as a change request, not a defect. It reverses a decision that is
recorded with its reasoning, which is the thing to carry into the brief rather
than discover during it.**

`frontend/test-bed-detail.js:923` states that Total Cost deliberately does not
move into the summary card: Round 8 Phase 3 put it above the detail
specifically to keep it visible without scrolling at the wider viewports, and
pulling it into the grid would push it back down behind the rate panels.

**That reasoning rests on a measurement that has since been shown to have
inverted.** Verification rule 15 was promoted from exactly this figure: Round
8 recorded Total Cost 306px below the fold at 1920 and seven rounds
re-measured at 1920 because that is where the number was first taken. Round 15
Phase 0 measured it at every width and found the gap closed to 78px at 1920,
gone at 1080, and **343px at 1240, worse than it had ever been recorded**.

**So the objection to merging may no longer hold, and may hold more strongly
at a width nobody checked.** Neither is known. This needs a before-and-after
at 1240, 1920 and 3440 per Verification rule 10, and the criterion written as
the condition rather than as a number at one viewport.

**And it is a move, so it is two claims** (Verification rule 7): the total
appears in the card, and the total is gone from above it. Assert exactly one
rendered instance, not at least one. Round 10 Phase 2 shipped the duplicate
that this rule exists to prevent, and it was the first fault in this project
to reach anyone outside it.

---

## 7. Units save on blur while the rest of the app uses the batched Save bar

**Flagged by the business for discussion, not for build. It is also, on the
code, the most direct route into open item 35, which changes its priority.**

`onTbUnitFieldChange` (`frontend/test-bed-detail.js:2478`) is bound to the
`change` event at 2573 and issues `PATCH
/api/test-beds/:id/units/:unitId` immediately, one request per field per blur.
Every other editable surface in this application collects drafts in `tbEdits`
and writes them through the Save bar.

**The consistency question is the reported one. The concurrency question is
the one nobody asked.** The handler is `async` and is attached as a plain
event listener, so the browser does not await it, and there is no in-flight
guard anywhere in it. **Tabbing quickly through the fields of one unit row
issues overlapping PATCHes to the same record**, and the unit PATCH path
resolves its revision number by the same unguarded read-then-insert as
everything else (`src/routes/test-beds.js:1860` reads, `1869` inserts).

**That is open item 35 reachable without a double click, on the newest
surface in the system, by ordinary typing.** Every other route into that race
needs two overlapping user actions. This one needs one user moving normally
through a row.

**Cross-reference.** Item 35 also names units as the most exposed member of
the affected set for a second and independent reason: Round 17 made them the
first record type two people edit, and `records_update` blocks the second
person on the `record_revisions` insert with an opaque 500 (open item 32).
**Three separate faults meet on this one write path.** Whatever the brief
decides about batching, it should decide it knowing that.

---

## Cross-cutting notes for whoever writes the brief

**Two of the six are reported with a cause that the code contradicts.** Issue
2 blames one-time derivation when derivation is idempotent and the client gate
is the blocker. Issue 7 is framed as a consistency preference when it is also
a concurrency exposure. Both were found by reading the code at the named
locus rather than by accepting the description, which is what
`PROTOTYPE_SPECIFICATION.md` extraction discipline asks for and applies just
as well to a bug report.

**Nothing in this document has been reproduced against a running system.**
Every claim here is read out of the source and is cited by file and line so it
can be checked. Issue 3 in particular carries an explicitly unresolved
question about whether the server refuses the bad date pair, and that question
should be settled by exercising it, not by reading `test-beds.js:792` harder.

**Issues 2, 5 and 7 are defects. Issues 4 and 6 are decisions.** Issue 3 is
one or the other depending on the unresolved server question. Mixing the two
kinds in one phase has produced trouble before, since a decision needs the
business in the room and a defect does not.
