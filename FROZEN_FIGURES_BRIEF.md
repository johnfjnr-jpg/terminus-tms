ROUND: FROZEN_FIGURES (option c). Brief, John 2026-11-17.
First commit: this brief verbatim. Branch frozen-figures off origin
main 488f779 (confirm by ls-remote; STOP if different).

WHY: an approver must always see the figures they signed. Today a
version stores inputs and rates, and the approval page re-derives every
figure through TODAY's engine (approval-page.js:846-849); no version
froze rates.batches, so the cost-basis block names today's catalog;
Opportunities price from the live catalog, so 2 Closed Won test deals
moved with the 2026-11-17 batch (e5f8f1de contract net 1,530,016 ->
1,439,956). DESIGN_PRINCIPLES "COMMERCIALS FACTORING" decision 4 names
the first real approval as the moment option (a) stops being safe.

PROPOSED RULINGS (Phase 0 tests each; John rules after):
R-FF1 At approval (the Approve pricing event, which is also issue
      today), the version stores its COMPUTED FIGURES: every figure the
      approval page and the deal sheet show, plus the engine output
      they come from, plus an engine identifier (commit SHA or spec
      version) and the batch ids the rates came from.
R-FF2 The approval page and any view of an approved version render the
      STORED figures. Re-derivation through today's engine runs as a
      CHECK only: if any figure differs, the page shows a plain line
      beside it ("Today's engine prices this at X; the approved figure
      stands") and never substitutes. Wording to John in Phase 0.
R-FF3 The cost-basis block names and dates the version's frozen batch
      ids, never today's catalog.
R-FF4 A Closed Won Opportunity shows the figures of its won version;
      catalog and engine changes do not move them. Phase 0 establishes
      how Closed Won relates to versions today and proposes the link.
R-FF5 Stored figures fall under the existing version immutability
      trigger and version-guard allowlist; prove a write is refused
      for user and service role.
R-FF6 Existing versions (6,359; 3,792 issued; all test data): propose
      backfill (figures computed now, labelled "backfilled <date>,
      engine <id>") or leave legacy versions re-deriving with a label.
      Measure both. No bulk write before John rules.
RIDER: CURRENT_STATE reads base_cost_batches, so a catalog batch
      appears in the configuration changelog (the 2026-11-17 batch is
      the first case).

PHASE 0 (read-only, STOP for rulings):
1. Every place an approved version's figures are shown or read; which
   re-derive today.
2. The version table shape, the immutability trigger and allowlist,
   and the smallest storage that serves R-FF1 (jsonb snapshot vs
   columns). Draft migration in the report only.
3. Closed Won: what links an Opportunity to a version; what a Closed
   Won deal shows today; what R-FF4 changes; whether a Closed Won
   deal stays editable.
4. R-FF6 measured: what a backfill would store for SMARTC-003 v2.0
   (expect finance cost 258,976 under today's engine, not the 258,493
   it was approved on) and why that matters for the label.
5. Goldens: confirm none moves (they price through the engine, not
   stored versions).
6. Conflicts with any decision of record, each with a recommendation.

STOP conditions: any CONFIRMED golden moves; any route can write stored
figures after approval; any live non-test record found.
Do not push.
