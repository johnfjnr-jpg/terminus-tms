# Stage panels: the close-out

Model: Claude Opus 5 (1M context).
Branch `stage-panels`, off `main` at `2a3ec1f` (`origin/main` `60db040` plus the
Phase 0 report, docs only). Nothing merged, nothing pushed.

---

## 1. What is NOT built, first

- **R12 is not built and must not be.** Any signed-in non-owner can still grant
  every approval track on any Test Bed. It is section 4 below, and it is the
  proposed next round.
- **The migration is written and has NOT been applied as a migration.** The rows
  are live because `scripts/stage-panels/apply-r10-rows.mjs` inserted them
  through PostgREST, which is the only route to Postgres this session has. The
  file is what a rebuild runs, its inserts are guarded, and applying it later is
  a no-op that still runs its self-check. **Its ledger row is a separate
  statement after that apply**, per Architecture 10 as corrected.
- **Three probes are UNWIRED**, recorded here rather than left silent
  (Verification 9's rot clause): `probe-pilot.mjs`, `probe-r10.mjs` and
  `probe-r11.mjs` are not gate stages. They need a browser, a live server and a
  fixture, which is the estate's existing reason for its other probes being
  unwired, and nothing schedules them. The invariant they would otherwise
  protect is in the gate: `INVARIANT 1b` runs under `test:db`.

---

## 2. Landed, per ruling, with the commit

Twelve rulings. Counted against commits rather than read: every ruling that
calls for a build has one, and the two that are dispositions say so.

| ruling | what | commit |
|---|---|---|
| R1 | order scoring, documents, exit criteria; approvals relocated inside the criteria panel with approver names | `6ed5365`, and `c6afc2a` for the control being intact |
| R2 | the estate's column grid at a 430px minimum, scoring spanning until a third column fits | `6ed5365` |
| R3 | documents only where the stage has them | `6ed5365` |
| R4 | scoring follows the gate, then the criteria already scored | `6ed5365` |
| R5 | install section full width below the row | inherited, measured in `74ba097`'s probe at 1076/1076 |
| R6 | Closed unchanged | inherited, measured: no panel row at all |
| R7 | floors, scoring 414 and documents 301 | the grid is sized from them; measured at all three widths |
| R8 | measure first, build nothing without the word | `2011a04` (the instrument), `3722682` (the report) |
| R9 | the pilot is signed off | a disposition, recorded in `efce9a8` |
| R10 | the approver-named gate rows | `6deb948` |
| R11 | the pair wears the estate's card, the approver lines read as one list | `9cc2fe1` |
| R12 | the grant-route finding is the proposed next round | a disposition, not built, recorded in `efce9a8` |

**Commits on the branch, in order:**

| commit | what |
|---|---|
| `a531d7a` | the brief, rulings R1 to R8 |
| `6ed5365` | the pilot: the ruled row as one mechanism |
| `c6afc2a` | the approve control sends the decision the route requires |
| `74ba097` | the pilot's live probe and its calibrations |
| `2011a04` | the R8 measurement's own instrument |
| `3722682` | the round report |
| `efce9a8` | rulings R9 to R12 appended at the phase they launch |
| `6deb948` | R10, the approver-named gate rows |
| `9cc2fe1` | R11, the cosmetics |
| `2406747` | CURRENT_STATE regenerated |

Full pre-commit suites on every commit: pure, react, typecheck, database.

---

## 3. The evidence, per claim

**The pilot.** 44/44 live at 1440 and 1240 on an owned tagged Test Bed. The pair
measured 530/530 at 1440 and 430/430 at 1240, asserted as a RELATIONSHIP (equal
`y`, below scoring, each above the 301px floor) rather than as a CSS property.
Documents rendered exactly per the configuration table on all eight stages. A
re-score, an NDA confirmation and an approval all still landed and were read back
from the database. Nine unit injections and two live injections, every one fired
on its named check, sources restored byte-identical.

**R10, both directions, read twice each.** On a fixture at Qualification with no
approver named: the transition refused, naming all three in the ruled wording,
and the panel showed three unsatisfied rows. Named: the refusal list lost exactly
those three, 17 blocking to 14, the panel's own count fell 17 to 14, and the
route still ASKED all three at `met: true` rather than having dropped them. 12/12,
screenshots opened.

**The panel and the enforcement were read separately on purpose.** Verification
43's whole family is a display that agrees with itself and disagrees with the
gate, so "the row says so" and "the transition refuses" are two claims here.

**INVARIANT 1 fired on its own before its number was touched**, reading
"Expected 45, found 64". That is how the figure was re-taken, which is what its
own comment requires.

**INVARIANT 1b is two tests rather than one.** Calibrated first as a single test,
both injections fired on the same test name, and a verdict that cannot tell two
claims apart is one detector wearing two labels. Split, each injection now fires
on its own named test with exactly one failing check.

**Dirty data re-measured AFTER the rows landed**, not predicted: 0 of 8 live Test
Beds past Qualification carry a newly-unsatisfied earlier-stage criterion, with
the same predicate shown reaching 19 against an empty payload, so the zero is a
measurement rather than a silence.

**R11 before and after, same instrument, three widths.** Before is the negative
control at 3/12; after is 12/12. The three checks that pass in both are the ones
proving the scoring card is ON SCREEN, because a hidden element still reports a
computed border and without them the chrome comparison would have passed against
a card nobody can see.

---

## 4. The finding that is not this round's to fix

**Any signed-in non-owner may grant every approval track on any Test Bed, and
there is no identity to check a name against.** Measured on a fixture whose three
authorities were all one named person: the owner was refused 403, a non-owner who
is not the named authority was accepted 201, and the same person then granted the
other two tracks, 201 each. Three approvals, one person, none of them the named
approver.

`terminus_staff` has no `user_id`, so the approver fields are staff NAMES with
nothing linking them to `auth.users`, and `track_approvers` holds no `test_bed`
row. **R10 makes the gate ask whether a name is recorded, which is all the data
can currently support.** It does not and cannot make that person the approver.

Proposed as the next round, in this order: identity linkage first, then granter
validation. Reproducible from `scripts/stage-panels/measure-r8.mjs`.

---

## 5. Carried

1. **R12**, section 4 above.
2. **Row-level merge of approval actions into criteria rows.** R1's own deferral,
   unchanged.
3. **NEW, found by opening this round's captures: two primary actions on the Test
   Bed screen render as white browser defaults on the dark screen.** `Next Stage`
   is `<button type="button" data-testid="tb-next-stage-btn">` with no class
   (`StageTabs.tsx`), and `Convert to Opportunity` reads the same way in the 1920
   capture. The vanilla's own button carried `class="btn-sm btn-primary"`
   (`54001c5^:frontend/index.html:900`), so this is a class lost in the React
   swap rather than a choice. **Not built**: this round's cosmetic tier was ruled
   as two named items, and a third is scope. It is Verification 7's recorded
   instance repeating, and it is one line each.
4. **The R10 migration's ledger row**, when the file is applied.
5. **The estate now has four calibration harnesses.** This round used three of
   them and needed all three for real reasons: bundled source needs a rebuild,
   stylesheet source does not, and a `node --test` invariant needs neither. They
   share their whole discipline and differ only in what proves the injection
   reached the thing being measured. Worth one round's consolidation, not worth
   doing in passing.

---

## 6. Promotions PROPOSED, not landed

**(P1) Verification 9, the calibration clause: ONE CLAIM PER TEST, BECAUSE THE
RUNNER NAMES THE TEST AND NOT THE ASSERTION.**

Rule 9 already says a calibration reads WHICH assertion failed rather than
whether the run failed, and prescribes anchoring on the test name. **That is not
sufficient when one test carries two claims.** Measured here: `INVARIANT 1b`
asserted both the set correspondence and the label wording, and two unrelated
injections - the backstop failing to reach a stage, and the ruled sentence
replaced - both reported

    FIRED  "every approval rule has its approver-named rule beside it"

because `node --test` names the test. Both verdicts were true and neither
discriminated. Split into two tests, each injection fires on its own name with
exactly one failing check.

**The check: before anchoring a calibration on a test name, ask what ELSE that
test asserts.** If a different injection would produce the same verdict, the test
is two tests.

**(P2) Verification 51's caveat, one line added: A PROBE SHARED BETWEEN HARNESSES
ANSWERS TO EVERY HARNESS'S RUN LABEL.**

51's caveat says a SILENT verdict with a non-zero failure count means the matcher
missed. This is the neighbouring case with a zero count and a specific cause:
`probe-r11.mjs` required `TBSP_RUN`, `calibrate-server` sets `TBUNITS_RUN`, so
the probe exited 2 before running anything and the harness scored it SILENT. The
output carried no check lines at all, which is the tell.

**The check: a probe run by more than one harness reads every label those
harnesses set**, and a harness that scores a run with no parseable result stops
rather than scoring it, which `calibrate-server` does not yet do and
`calibrate-unit` does.

**Not proposed, and recorded as an instance under rules that already cover it:**
the R11 list measure compared lines of text against bordered rows whose boxes
touch at 0px, so the honest fix read as a failure. That is Verification 33, a
measure aimed at the wrong thing, and Verification 47's remedy, take the
threshold from the requirement. Neither needs changing; the instance is in the
commit message.

---

## 7. The exit gate

Answered point by point in the report delivered with this document, after the
full merge gate has been run on this exact tree and its result stated.

Nothing merges and nothing pushes until John says so.
