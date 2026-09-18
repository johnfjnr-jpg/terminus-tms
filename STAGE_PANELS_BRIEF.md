# STAGE PANELS: the build brief

Governing docs, read before anything: CLAUDE.md, DESIGN_PRINCIPLES.md,
`TEST_BED_OLD_VS_NEW_AUDIT.md`, and the tms-round-method skill. Where this brief
and CLAUDE.md disagree, CLAUDE.md wins and the disagreement is a finding.

**Evidence base: `STAGE_PANELS_PHASE_0_REPORT.md`** (commit `2a3ec1f`). Its
measured floors, its viewport thresholds and its per-stage configuration table
are what every ruling below rests on, and its three corrections to the scoping
premises stand: the "453px scoring floor" was a rendered HEIGHT, thirds do not
hold at 1240 or 1440, and the documents rule changes Qualification alone.

**Branch:** `stage-panels`, off `main` at `2a3ec1f` (which is `origin/main`
`60db040` plus that report, docs only), by John's ruling at the precondition.

## Rulings of record (John, 2026-09-18)

- **R1. Panel order on every non-terminal stage: Scoring, Terminus Documents,
  Exit Criteria.** The standalone Approvals panel is REMOVED; the approval track
  list renders INSIDE the Exit Criteria panel as its closing section, controls
  intact and behaviour unchanged, and it shows per track the configured approver
  for this Test Bed (the Terminus Commercial, Technical and Legal approver
  fields). If those fields do not exist per record (R8 establishes this), the
  display names the track without an approver. **Row-level merge of approval
  actions into criteria rows is on the list, not this round.**
- **R2. Layout: the estate's min-width column grid** (the `.ref-cards` shape)
  with a **430px column minimum**, so 1240 and 1440 render scoring full width
  with documents and exit criteria paired, and wider displays gain columns with
  no named breakpoints. **Scoring spans the full row width wherever fewer than
  three columns fit.**
- **R3. The Documents panel renders only when the stage has document
  requirements.** Per Phase 0's P0.2 table this changes **Qualification only**,
  removing its placeholder line.
- **R4. Scoring presence.** On the gate-demanding stages (Qualification, Site
  Assessment, Monitoring and Analysis) the card behaves as today. On other
  non-terminal stages it shows ONLY criteria already carrying a score, open for
  re-scoring under R10's per-stage Record scope; **with no scored criteria and no
  recorded measurability, the card does not render.**
- **R5.** The install section stays full width below the panel row on
  Installation and Commissioning.
- **R6.** Closed is unchanged: the closed-record panel, no stage panels.
- **R7. Floors are reading A** (controls never crush): **scoring 414px,
  documents 301px**; exit criteria rows wrap.
- **R8. MEASURE FIRST, and build nothing of it without John's explicit word after
  the report.** The ruling: *a Test Bed with no approvers configured is BLOCKED AT
  QUALIFICATION*. The three approver configurations become Qualification exit
  criteria, so nothing passes to Pre-Site Assessment without Commercial,
  Technical and Legal approvers named.

## Rulings appended after the pilot report (John, 2026-09-18)

Appended at the phase they launch, per build discipline 7's clause, rather than
discovered at the close.

- **R9. The pilot is signed off.**
- **R10. R8 builds as proposed** in the round report's section 2.4: three
  Qualification exit-criteria rules, one per track, each satisfied when its
  payload field is non-empty; unsatisfied wording **"Requires a Commercial
  approver to be named"** and likewise Technical and Legal; and **backstop (a)**,
  the rules repeat at every stage that requires an approval of that track.
  **Configuration rows only**, no route change.
- **R11. The two cosmetic findings are taken at the cosmetic tier.** The
  documents and exit criteria pair gains the estate's card chrome so it matches
  the scoring card, and the approver lines read as one list rather than three
  paragraphs. Before-and-after captures at 1240, 1440 and one wide width.
- **R12. The 2.3 finding is on the list as the proposed NEXT round.** Any
  non-owner may grant every track, and no staff-to-user identity exists:
  identity linkage first, then granter validation. **Not this round.**

**A numbering collision, named rather than resolved by renumbering.** R4 above
and the Phase 0 report both cite "R10's per-stage Record scope", which is
**Round A's R10** (the Test Bed workflow core round), not this round's R10.
A cited number is an identifier and is not reordered (Verification 32), so both
stand and the citations are qualified here instead.

## STEP 2: the R8 measurement (read-only, reported before any build commit)

- Do per-record Terminus approver fields exist on Test Beds today? Where are they
  configured (record fields, staff directory, elsewhere), and what do live
  records carry?
- What does the approval-grant route check now: can any authenticated user grant
  any track, or is the granter validated against configuration? Measured both
  directions on an owned tagged fixture, each read back from the database.
- Dirty data: live Test Beds past Qualification with any approver field missing
  or empty, **counts only**.
- Proposed in the report: the three Qualification gate rules, their criteria-row
  wording when unsatisfied, the backstop for a track whose approver field is
  emptied after Qualification, and whether enforcement needs route changes or
  configuration only.

## STEP 3: the pilot, proven on Pre-Site Assessment

**Built as ONE MECHANISM.** The grid, the scoring derivation, the documents
condition, the approvals relocation and the approver-name display are structural
and reach every stage. **The pilot is where proof happens, not a stage fork.**

Guard tests, red first on the current tree, each proven to fail before the
change: the full-width stack as the failing layout claim; the standalone
approvals panel as the failing R1 claim; the Qualification documents placeholder
as the failing R3 claim; the scoring card hidden on a stage with scored criteria
as the failing R4 claim.

Live proof on an owned tagged record at **1440 AND 1240**, Pre-Site Assessment,
the record carrying Qualification scores: panel order and widths from the DOM;
scoring full width showing the scored criteria; documents and exit criteria
paired at 530/430; approval tracks inside the criteria panel with approver names
where configured; a re-score recorded through the real control and read back with
its stage stamp; the NDA row still confirmable; an approval still grantable from
the relocated list, read back from the database. Screenshots at both widths,
opened and read.

Then a walk of the other six non-terminal stages at 1440: layout holds, documents
exactly per the P0.2 table, scoring per R4, Closed unchanged, with screenshots
for Qualification and Installation and Commissioning.

Unit and live calibrations both directions, each injection fired on its named
test with sources restored byte-identical, and the full pre-commit suites on
every commit. Nothing merges and nothing pushes.

## Walk findings W1 to W5 (John's walk-through, 2026-09-18)

Appended at the phase they launch, per build discipline 7's clause. John's
wording is quoted; anything after a quote is this round's disposition.

- **W1. Save/Discard bar out of sight on long pages.** *"estate-wide, on the
  list, not this round."* Recorded and queued; nothing is built for it here.
- **W2. Dates.** *"dd/mm/yyyy is the DISPLAY STANDARD OF RECORD for dates,
  estate-wide. This round fixes dates rendered by this round's files; the
  remainder is a named hygiene item with the standard cited."*
- **W3. Commercials locked-count value misaligned with its label.** *"fixed this
  round. The lock sentence's treatment awaits John's ruling and changes nothing
  until then."* **The ruling arrived during the round and is recorded below.**
- **W4. Scoring row.** *"the reason field moves beside the score, using the full
  row width R2 provides."*
- **W5.** *"The 'changed in another session' message appeared once to a solo user
  and did not reproduce: bounded investigation below."*

**W5's non-reproduction is part of the finding, not a footnote.** It occurred
ONCE, it cleared on reload, and **it did not reproduce on John's deliberate
retry.** So the investigation is a READ of the code path, timeboxed as such, and
not a reproduction hunt: an intermittent that will not reproduce is exactly the
condition where hunting it costs a round and reading it costs an hour.

### W3 RULING (John, 2026-09-18)

**Supersedes the Test Bed units round's L3 presentation.** Recorded here, and
`TEST_BED_UNITS_BRIEF.md`'s L3 entry carries a pointer to it so the two briefs
cannot disagree silently.

- The locked-count sentence, *"Locked: N units exist. Correct it on the
  Installation and Commissioning tab."*, is **REMOVED** from the Commercials
  count rows.
- **The lock itself remains and must be VISIBLE**: the locked count renders in
  the estate's disabled treatment, visibly not an editable field, with its value
  aligned on its label's line per W3's alignment fix.
- The server's 400 refusal with its full sentence is **unchanged** and remains
  the backstop.
- The Installation tab's lock summary line, *"2 counts locked: units exist.
  ..."*, **remains**, and is now the one place on screen naming the destination.
- The L3 guard tests assert the ruled state: locked treatment present, sentence
  absent, **red-first on the current tree**, where the sentence being present is
  now the failing claim.

### W5, 3.5 and W2 RULINGS (John, 2026-09-18)

- **W5: BOTH, this round.** The record's own writes **serialise through one
  queue holding the revision the last ACCEPTED write returned**; and the stale
  message gains the honest voice:

  > This record moved on while you were working. The screen is catching up -
  > your entry is still here; try again in a moment.

  **Because the system knows the screen is behind, not who moved it.** The old
  sentence named a second session, which is a fact the server never established.

- **3.5:** `reloadAfterStaleWrite` **dispatches to the loader of the surface
  that rendered it**, fixed this round, all three surfaces. It called the
  Opportunity loader unconditionally, so the one control the message offered
  could not work on a Test Bed or a Contact.

- **W2: the estate-wide four-digit year STANDS**, recorded here as superseding
  **R7's width rule** (`DD/MM/YY`, ruled 2026-09-12). R7's **grain** rule (a
  date site uses `formatDate`, a timestamp site `formatTimestamp`, and a
  timestamp shown at date grain stays date grain), its **absence** rule (the
  formatter returns `''` and each call site keeps its own fallback) and its
  **unparseable-value** rule (returned as it stands) are **untouched**.

## Walk 2 findings W6 to W10, the scoring surface (John, 2026-09-18)

Appended at the phase they launch. John's wording is quoted; anything after a
quote is this phase's disposition.

**The merge is HELD.** The previously issued close sequence - buttons, P3,
merge, gate on the merged tree - runs only after this phase is signed off.

- **W6. The scoring row's sizing.** *"the score select sized to its content (an
  integer plus the chevron); the reason renders as ONE line, growing to two only
  when the text needs it; the reason field starts right of the select with a
  clear gap."*
- **W7. Escape to revert.** *"Escape exits the field and restores the prior
  value."* **Archaeology first**: the prior ruling and its implementation are
  found and reported before anything is built, including whether it ever covered
  this field, and if it regressed, which change killed it and why no guard
  caught it.
- **W8a. The awaiting-reason lock must have a way out.** *"a person in the
  awaiting-reason state with a BLANK reason has a visible way out: Escape (W7)
  reverts the draft and releases the lock; the lock never traps a person who
  changed their mind."*
- **W8b. W1 PROMOTED INTO THIS PHASE BY RULING**, because *"it has now cost John
  twice."* *"the Save/Discard bar is position: sticky at the viewport bottom
  whenever a change exists, estate-wide as the edit-bar pattern, proven on the
  Test Bed and one other surface at 1440 with a long page."*
- **W9. The awaiting-reason state reads as ONE state.** *"the blocking criterion
  visibly highlighted, the quieted criteria carrying one shared line naming the
  block, the green note and per-row noise consolidated."* Screenshot before and
  after.
- **W10. The recorded reason.** *"the recorded reason renders right of the
  score, where it was entered, on every criterion with a reason; the history
  disclosure unchanged."*

**W1 is no longer a queued estate-wide item.** It was recorded at the first walk
as *"estate-wide, on the list, not this round"*, and this ruling supersedes that
scoping: a finding that costs the same person twice is not waiting for a round of
its own.

## Walk 2 sign-off and the final riders (John, 2026-09-18)

- **The walk-2 phase is SIGNED OFF.** W6 to W10 stand as built.
- **A3's contract wording is corrected** in `MIGRATION_FIELD_ROW_CONTRACT.md`:
  the ruling is **row-scoped**, bespoke controls are outside it, and both are
  now named. The correction is recorded as a finding rather than a tidy-up,
  because the wording is what made the gap invisible.
- **The Contact visibility check.** On a long Contact record with a dirty field
  at 1440: are the header Save and Discard on screen at full scroll?
  - **If NO**, they get the visibility treatment - a sticky header row or
    equivalent - red-first, live-proven, screenshot read.
  - **If YES**, the measurement is recorded here and nothing changes.
- **The two buttons.** `Next Stage` and `Convert to Opportunity` gain the
  estate's primary treatment, at the cosmetic tier, with a red-first guard on
  the missing class and a screenshot at 1440 opened and read.
- **Then the released merge sequence**: P3 onto `main`, the close-out and
  `CURRENT_STATE.md` updated, `--no-ff` merge, the full gate on the merged
  tree, and a stop for the word. **Nothing pushes.**
