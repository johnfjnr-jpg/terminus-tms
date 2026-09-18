# Stage panels: the close-out

Model: Claude Opus 5 (1M context).
Branch `stage-panels`, off `main` at `2a3ec1f` (`origin/main` `60db040` plus the
Phase 0 report, docs only). Nothing merged, nothing pushed.

**Amended at the W5 close**, so it covers the twelve rulings R1 to R12, the walk
findings W1 to W5, and the three supersessions this round recorded: the units
round's L3 presentation, R7's date width, and the stale-write sentence.

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
- **W1 is not built**, and neither is anything for the Opportunity's own write
  path (section 6, item 7).
- **Seven probes are UNWIRED**, recorded here rather than left silent
  (Verification 9's rot clause): `probe-pilot`, `probe-r10`, `probe-r11`,
  `probe-w34`, `probe-w5`, `probe-w5-pairs` and `probe-w5-refusal` are not gate
  stages. They need a browser, a live server and a fixture, which is the
  estate's existing reason for its other probes being unwired, and nothing
  schedules them. What IS in the gate: `INVARIANT 1b` and the record queue's
  seven tests, which run under `test:db` and the React suite.

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
| `ec28b74` | the close-out |
| `5f3cace` | walk findings W1 to W5, and the W3 ruling |
| `75935ba` | the W5 probe that made the server half evidence |
| `a7e017f` | W2, W3 and W4, the in-scope fixes |
| `42e16de` | the W5, 3.5 and W2 rulings |
| `f1811cd` | W5: the write queue, the honest voice, the reload dispatch |
| `cf80c67` | W5: both directions proven, and the guard the calibration killed |

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

## 4. The walk: W1 to W5, and what they cost

John's walk-through produced five findings. Three were fixed in scope, one is
queued, and W5 turned out to be a defect class rather than a one-off.

| finding | disposition | commit |
|---|---|---|
| W1, the Save/Discard bar out of sight on long pages | queued, estate-wide, not this round | `5f3cace` records it |
| W2, dd/mm/yyyy as the display standard of record | fixed, and wider than it looked: section 4.1 | `a7e017f` |
| W3, the locked count misaligned | fixed to John's ruling: the sentence removed, the lock made visible | `a7e017f` |
| W4, the reason beside the score | fixed, 580px of a 1046px row, save path proven unchanged | `a7e017f` |
| W5, the "changed in another session" message | a defect class, fixed BOTH ways per the ruling | `f1811cd`, `cf80c67` |

### 4.1 W2 reached further than "this round's files", and that is recorded

Censused before touching anything: **no date site in the estate bypasses
`src/lib/format-dates.js`**, and the only `toLocaleString` hits are currency. So
the hygiene item W2 anticipated is EMPTY, and the one thing between this round's
dates and the standard was the YEAR WIDTH in that single module.

This round's files therefore could not be fixed in isolation. Widening the year
there is the only mechanism and it reaches every routed site by construction.
**Ruled and recorded: the four-digit year stands and supersedes R7's WIDTH rule
(`DD/MM/YY`, 2026-09-12). R7's grain, absence and unparseable-value rules are
untouched**, and the brief says so in those words so the supersession cannot be
read wider than it is.

Six assertions encoded the old width and were re-pointed. Two read the hour by
fixed offset (`slice(9, 11)`), which was a second reader of the format's own
width and began comparing a year's last two digits against an hour.

### 4.2 W3 superseded the units round's L3 presentation

The sentence is gone from the Commercials rows; the lock remains and is visible
in the estate's `data-readonly` treatment; the server's 400 is untouched as the
backstop; and the Installation tab's summary line is now the one place naming
the destination.

**The misalignment was not a spacing value.** The locked row was a `.ref-field`
while every neighbour on that card is a `.field-row`: two row shapes in one
card. Measured after: the value sits at +182px from its label against +182px on
an editable neighbour, dimmed at 0.5 alpha against its full white.

`TEST_BED_UNITS_BRIEF.md` carries the pointer in its audit table AND at its L3
entry, so the two briefs cannot disagree silently (Verification 23).

### 4.3 W5 was a defect class, and it is now reproducible

**What W5 actually was.** Every writer sent `expected_revision` read from the
host's `record.latest_revision_number`, whose value only moves when `load()`
RESOLVES and React re-renders. Two writes issued before that both carried the
same number and the second was refused. Driving John's own pairs with both
clicks in one task, before the fix:

```
Save changes then Add note      [200, 409], both expecting revision 3
tick a criterion then Add note  [200, 409]
Record scores then tick         score 201, tick 409 expecting revision 6
```

**In every case the second write was LOST**, and on the note paths with no
message at all, because a 409 there reloads and returns false. It did not
reproduce on a deliberate retry because a retry is one write, not two.

**The fix.** `frontend-react/src/shared/recordQueue.ts` serialises a record's
own writes and supplies the revision from the LAST ACCEPTED RESPONSE. Every
route that advances a revision already returns the new number, so the queue
never needs a reload to know where the record is; the reload remains, and
remains necessary, for the record's STATE. A 409 clears the held number so the
host's reload is what re-arms it.

**Both hosts, because ContactHost was measured rather than assumed.** It has
four revision-advancing writers and three read the same stale closure. Its
follow-up save is the sharper case: it sent no precondition at all, so it always
succeeded and always left the held number behind, arming the next writer to be
refused. It now carries one.

**The voice, superseded for the second time.** "In another session" names a
second editor the server never established. What a 409 establishes is that the
screen is behind. Verification 29: the premise failed rather than the preference
changing.

**3.5.** `reloadAfterStaleWrite` dispatched to the Opportunity loader on all
three surfaces, so on a Test Bed the one control the message offered was
`GET /api/opportunities/<test bed id>`. It now dispatches on the kind the
surface passes; an absent kind keeps the old behaviour, so the Opportunity's own
callers are unchanged by construction.

### 4.4 The evidence, and what each instrument establishes

| claim | instrument | result |
|---|---|---|
| the pairs land both writes | `probe-w5-pairs.mjs` | **2/9 before, 9/9 after** |
| a real second editor is still refused, with the new voice | `probe-w5-refusal.mjs` | 12/12 |
| the queue's own properties | `record-queue.test.ts`, 7 injections | 7/7 fired |
| the queue bypassed in the host | `live-specs/w5-queue.mjs` | fired, `[409, 200]` returned |
| the sentence reverted | `server-specs/w5-voice.mjs` | fired |
| the dispatch reverted | `server-specs/w5-reload.mjs` | fired |
| W3, W4, W2 on screen | `probe-w34.mjs` at 1440 | 14/14 |
| the server refuses two writes on one revision | `probe-w5.mjs` | 5/5 |

**Three of those instruments were wrong first, and each fault is recorded at its
site** rather than quietly fixed: a wait that read the string under test, so the
injection that changed the string killed the probe before its assertion and
reported SILENT; a step label that stopped updating, so a timeout named the
wrong step; and a `!el?.hidden` field that read TRUE for an element that does
not exist.

**And the calibration killed a guard written in the same hour**: a rejection
handler on `chain.then` that can never run, because the next line already
swallows every rejection. Its injection came back SILENT while the other six
fired.

## 4b. Walk 2: W6 to W10, and two riders

A second walk on the scoring surface. Five findings, all built, plus two riders
after sign-off.

| finding | what | commit |
|---|---|---|
| W6 | the select sized to its content; the reason one line, right of it | `7b7570f` |
| W7 | Escape reverts the field, on the score control and the reason box | `7b7570f` |
| W8a | and releases the awaiting-reason lock, because the lock is derived from the drafts | `7b7570f` |
| W8b | the shared edit bar is sticky (W1, promoted by ruling) | `7b7570f` |
| W9 | the awaiting-reason state reads as ONE state | `7b7570f` |
| W10 | the recorded reason renders where it was written | `7b7570f` |
| rider | the Contact's own header sticks, because it has no shared bar | `92c3d61` |
| rider | the two actions wear the estate's treatment again | `9e2d13f` |

**2/11 before, 11/11 after**, plus 7/7 for the sticky bar and 6/6 for the
buttons. Nine injections across walk 2, all firing on their named tests.

### 4b.1 W7 WAS A GAP, NOT A REGRESSION, and the archaeology is the finding

Ruling **A3** (John, Leads round Phase 0, **2026-09-11**, built in `daa90af`)
already says Escape reverts the focused field to its last saved value. It lives
in the FIELD ROW. `git log -S "Escape"` on `StagePanel.tsx` returns **nothing**:
this card's bespoke controls never had it. **Nothing was killed and no guard was
missing** - build discipline 5's second answer.

**The finding is in the ruling's own wording.** A3 is recorded as covering *"all
four surfaces the row serves"*, which is a claim about the **ROW** phrased as a
claim about the **SURFACE**. Every bespoke control on those surfaces was outside
it and nothing said so. Corrected at
`MIGRATION_FIELD_ROW_CONTRACT.md` in `b2f5e18`, with the finding kept rather
than the sentence quietly rewritten. Verification 19's shape.

### 4b.2 The Contact visibility check: the answer was NO

Measured before anything was written, on a 40-note record at 1440x900 with a
dirty field, scrolled to the end: **Save and Discard sat at top -2762 in a 900px
viewport**, 2861px of scroll away. So the ruling's NO branch applied.

`.cd-header` is now sticky and the controls read **top 51**. **On the header,
not the row inside it**: sticky on `.cd-header-row` changed nothing, because a
sticky element cannot leave its parent's box and its parent is a short block at
the top of the page. Measured with the row sticky, the controls still read -2768.

### 4b.3 What the screenshots caught that the measurements passed

Three, all this round's own and all fixed here: a highlight tint that ran 500px
down an expanded row; `SHOW HISTORY (2)Hide definitions` touching after the
reorder; and, from walk 1, the two white buttons.

### 4b.4 A calibration silence that found a missing claim

The injection making Escape fire on EVERY key broke nothing: every test drove
the reason box through React's `onChange`, so not one pressed an ordinary key at
it. **A handler reverting the draft on every keystroke would have shipped.** The
claim is now asserted and the injection re-anchored on the test it actually
falsifies.

---

## 5. The finding that is not this round's to fix

**Any signed-in non-owner may grant every approval track on any Test Bed, and
there is no identity to check a name against.** Measured on a fixture whose
three authorities were all one named person: the owner was refused 403, a
non-owner who is not the named authority was accepted 201, and the same person
then granted the other two tracks, 201 each.

`terminus_staff` has no `user_id`, so the approver fields are staff NAMES with
nothing linking them to `auth.users`. **R10 makes the gate ask whether a name is
recorded, which is all the data can currently support.** It does not make that
person the approver.

Proposed as the next round, in this order: identity linkage first, then granter
validation. Reproducible from `scripts/stage-panels/measure-r8.mjs`.

---

## 6. Carried

1. **R12**, section 5 above.
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
6. **W1**, the Save/Discard bar out of sight on long pages. Estate-wide, John's
   ruling, nothing built.
7. **The Opportunity surface has not been given the queue.** Its own writer
   (`oppPatch`) already re-reads and retries once, which is a different and
   older remedy for the same hazard, and it was out of this round's scope.
   Whether it should share `recordQueue` is a real question and not one this
   round measured.
8. **`scripts/tests/teardown-scoping.test.mjs` failed once mid-round with
   `TypeError: terminated` at 123,467ms**, against a passing 61,318ms in
   isolation immediately after. A transport termination on a heavy paging test
   rather than a defect in it; recorded with both durations per Verification 48
   rather than retried into silence.

---

## 7. Promotions PROPOSED, not landed

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

**(P3) A PRECONDITION IS SOURCED FROM THE LAST ACCEPTED RESPONSE, NEVER FROM
RENDERED STATE.** Measured twice now, on different surfaces and a year apart in
the code: the unit queue in the Test Bed units round, and W5's record queue
across two hosts here.

> When a request carries a PRECONDITION - `expected_revision`, an ETag, a
> version, a sequence number - that value comes from what the authority last
> ANSWERED, not from what the screen last rendered. Rendered state moves when a
> reload resolves and a framework re-renders, which is strictly later than the
> next click.
>
> **The check, at the moment you write a precondition into a request: ask what
> happens if two of these are issued before the first one's refresh lands.** If
> the answer is that both carry the same value, one of them is going to be
> refused and the person will be told something the system does not know.

**WHY VERIFICATION 47'S LAYER CLAUSE DOES NOT ALREADY COVER IT, checked before
proposing.** That clause says: when the claim is about what one call passes to
the next, TEST the thing that holds the value rather than the screen that
displays it. It is advice about where to point a test, and this round obeyed it -
the queue's own tests are at the queue. **This is a rule about where the value
must LIVE in the product**, which 47 says nothing about: a surface can satisfy 47
completely, with its tests aimed at exactly the right layer, and still source its
preconditions from a render.

Nearest neighbour is Architecture 12, a definer function DERIVES and does not
ACCEPT, with the twist that this is the client side of the same idea: the server
must not trust the caller's claim, and the caller must not trust its own screen.

**Not proposed, and recorded as an instance under rules that already cover it:**
the R11 list measure compared lines of text against bordered rows whose boxes
touch at 0px, so the honest fix read as a failure. That is Verification 33, a
measure aimed at the wrong thing, and Verification 47's remedy, take the
threshold from the requirement. Neither needs changing; the instance is in the
commit message.

---

## 8. The exit gate

Answered point by point in the report delivered with this document, after the
full merge gate has been run on this exact tree and its result stated.

Nothing merges and nothing pushes until John says so.
