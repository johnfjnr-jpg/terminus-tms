# The UI STANDARDS - LEADS round: brief

Governing docs: `CLAUDE.md`, the `tms-round-method` skill, and
**`INTERACTION_STANDARDS.md`, read in full first**. That document is the
existing, actively-maintained standards document, good through Round 29,
2026-08-24. **This round CONTINUES it. It does not replace it.**

Also read: `UI_STANDARDS_BRIEF.md` and `UI_STANDARDS_PHASE_0_REPORT.md`,
the immediately preceding round, whose measurements this round builds on.

## Standing verification

- **Live DOM plus screenshot** after a rebuild, `check-dist-fresh.mjs`
  first, at **1240 / 1920 / 3440**.
- **ASSERT RELATIONSHIPS BETWEEN ELEMENTS, NEVER A PROPERTY OF ONE** (V4
  as extended: a CSS mechanism is not a layout outcome).
- **The door both ways.** The **hook runs all suites.**

## THE GOVERNING PRINCIPLE (John-ruled, design of record)

> ## ACTION GOES WITH ITS SCOPE.
>
> **A control sits with the thing it acts on.**

- **Record-scoped actions** - advance the record, save all its fields -
  live on the **record's action bar** (`INTERACTION_STANDARDS` Section 6).
- **Panel-scoped actions** - save this Summary, these Notes - live on
  **that panel's header line, right-aligned** (S1).

**These are ONE principle at two scopes, not two standards.** S1 and
Section 6 are both expressions of it. **A future surface applies it by
asking what the action acts on.**

## THE PANEL STANDARD (S1 to S5, the panel-scope expression)

- **S1** - panel-scoped save/action controls on the header line,
  right-aligned.
- **S2** - panel header: title left, secondary label beside it, actions
  right, **one line**.
- **S3** - input aligns to the header's column.
- **S4** - Save disabled until dirty, enables on change; Discard reverts
  the unsaved edit.
- **S5** - every control carries an estate class; no browser defaults;
  **one button treatment**. Retires **F3**, including `--red` and
  `--amber`, **defined at their current literal values**.

## MODALS (John-ruled)

**A modal is a DISTINCT shape.** Its actions sit in a **FOOTER row** -
the established dialogue convention, GOV.UK and APG, which this document
already cites - **not the header line.**

**Named explicitly so it is not a silent S1 violation.**

**Modal dismissal is already governed by Section 5. Conform to it, do not
reinvent it.**

## Scope (John-ruled)

- The principle and the panel standard apply to the **LEADS CARD** this
  round.
- **Other surfaces** - Section 9's divergent Opportunity, Test Bed and
  Accounts bars - **converge to the principle as later rounds touch
  them. Not now.**
- **Frozen surfaces** (Lead Detail, the follow-up panel) conform when
  next worked, **via optional props, structurally untouched**.

## ENFORCEMENT: what makes this a standard rather than a document

1. **New shared components** - `Panel`, `PanelHeader`, `SaveControl` -
   that enforce the principle and S1 to S5. **Every Leads panel routes
   through them, so a panel CANNOT place its action wrongly.** The
   previous round measured **no shared component of any kind** and
   **three competing CSS shells**; building the components is the durable
   fix, not conforming the shells.
2. **A CONFORMANCE GATE TEST** that fails if a Leads panel does not route
   through the shared components or obey the principle. **This is the
   direct answer to "caught only by walking."**
3. **A STALENESS CHECK** that flags when `INTERACTION_STANDARDS.md` has
   drifted from the code. **The document lapsed after 2026-08-26 and John
   found it by checking a date. The machine should flag it, not him.**

## DOCUMENT: continuing Section 9's stalled convergence

- **Add the governing principle as a new governing section.**
- **Fold the Leads-era decisions into the document IN ITS OWN STYLE** -
  source, file, line, rationale: the panel standard, the modal shape, and
  **reconcile with existing Sections 4, 5 and 6.**

## Phase 0: measurement only, read-only

1. **Read `INTERACTION_STANDARDS` fully.** Which existing sections (4, 5,
   6, 9) already govern Leads-card behaviour, and where the Leads card
   **conforms or diverges**.
2. **Test every Leads-card action control against the principle**: what
   does it act on, where does it sit, is that correct under "action goes
   with its scope"? The previous Phase 0 found **five save placements**;
   re-confirm them against the principle.
3. **The shared-component gap** (confirmed: none exist) and what the
   three components need.
4. **The three-consumer and frozen constraints**: `NotesHistory`,
   `FollowUpTask` frozen, `LeadFieldInput` touching the New Lead grid.
5. **The full F3 and undefined-var inventory** on the Leads card.
6. **How the conformance gate test and the staleness check would work
   mechanically.**

Stop with the Phase 0 report. **Nothing pushes.**

## CARRIED, recorded and NOT scoped here

**A MIGRATION-CONFORMANCE PASS over `INTERACTION_STANDARDS` Sections 6 to
11's surfaces**: Test Bed, Opportunity Reference and Assessment,
Accounts, stage progression, the chevron hover.

**John reports "a whole host of issues from the migration" on those
surfaces.** Sections 6 to 11 are **read from source with a file and line
per claim**, so if the migration drifted the code, **the document now
describes behaviour that no longer exists** - the same rot found on
Leads, one layer deeper.

**This needs a WALK of each surface against the document, then
convergence: a multi-round effort AFTER Leads is standardised.** Carried
explicitly so it is not lost.
