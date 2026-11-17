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

## Phase 0 sign-off (John, 2026-11-17), appended verbatim at the phase it launches

PHASE 0 SIGN-OFF: FROZEN_FIGURES

Phase 0 ACCEPTED. The correction is recorded: versions DID freeze
rates.batches (6,357 of 6,375); the approval page's Array.isArray
reader was blind to the object shape; H3 had no test.

JOHN RULES:
1. R-FF1: freeze at SUBMISSION, in the issue route, by the server, in
   the same UPDATE as the relabel. The stored figures are produced by
   the SAME builder the approval page uses (buildApprovalPage and the
   calculateDeal output it reads), so stored equals what the page
   would have shown at that moment; prove it on a fixture.
2. R-FF5: the trigger as drafted (set once on the relabel, service
   role only, required on issue, refused on drafts). ADD: prove an
   INSERT cannot create a row already 'issued' or carrying
   frozen_figures, as owner and as service role. Two database tests
   per path, fingerprinted before and after. version-guard names
   frozen_figures EXEMPT with the drafted reason.
3. R-FF4: the terminal Won raise derives and freezes the latest
   APPROVED version into frozen_version_id (Architecture 12). The
   headline of a Closed Won record reads that version's
   frozen_figures, labelled as the won version's. No won version:
   live figures with "No approved version was won; these are today's
   figures."
   PLUS: PRICING edits to a Closed Won record are REFUSED, server and
   client, with a sentence ("This deal is Closed Won; its pricing is
   the won version's and cannot change."). Non-pricing fields stay
   editable. The refusal must reach the person (Commercials factoring
   B1 lesson): prove it from the click.
4. R-FF6: NO backfill. Legacy versions re-derive and carry the head
   line as proposed.
5. R-FF2 wording as proposed, both sentences.
6. LIVE RECORDS: John confirms all 19 live Opportunities are test data.
7. R-FF3 rescoped: fix the approval page's batches reader for the
   object shape, and give H3 its first test, calibrated.
DECISIONS OF RECORD: record frozen_figures as the rule-6 exception to
Architecture 2; supersede COMMERCIALS FACTORING decision 4 (option a)
with its reasoning left visible.
RIDER as proposed (state-dump reads the current batch per product).

Proceed through the build. Migration: draft in supabase/migrations,
John applies it before the push wrapped in begin/commit, as last time.
Stop for sign-off after the build is proved, before Phase 3.

## Migration applied, and the post-apply order (John, 2026-11-17), appended verbatim

MIGRATION 20261117000002 APPLIED by John, wrapped in begin/commit;
ledger row recorded by hand. Confirm the column, both triggers and the
raise function's definition match the file.

ORDER:
1. Run the FULL database suite and all HTTP probes first. They passed
   before the triggers existed. If any fixture or probe creates a
   version already 'issued', or updates one, it now fails: FIX THE
   FIXTURE (born draft, submitted through the route or the service
   role with figures). Never loosen a trigger. Report each fixture
   changed and why.
2. Run probe-frozen-figures-db.mjs, then calibrate it as planned: drop
   the INSERT trigger's issued branch, the service-role check, the
   owner check, and the Closed Won derivation; each must fire its named
   claim; restore byte-identical; reverted run green. Calibration edits
   to database functions run in a transaction you roll back, never
   left applied.
3. R-FF1 over HTTP on a fixture: submit, read frozen_figures, the
   approval page renders them, today's engine agrees.

QUEUED, add to the list: the headline TCV ($227,138) vs Commercials
contract net ($270,587) disagreement on a fixture, measured in its own
round; PRICING_KEY_LABELS lagging six pricing keys.

Then the sign-off report. Stop before Phase 3.

## Calibration result and build sign-off (John, 2026-11-17), appended verbatim at the phase it launches

CALIBRATION RUN by John in the SQL editor, wrapped begin/rollback:
DEF 3/3 match the file; column jsonb; both triggers present;
INJ 5/5 FIRED; REV 5/5 REFUSED (R-FF4 froze V1 425e27bb as expected).
Post-run check: deal_sheet_versions_immutable still holds the service
and owner guards (both true). Record this result verbatim in the brief.

BUILD SIGN-OFF: FROZEN_FIGURES. Build ACCEPTED.
Tear down ffsqlcal and show zero residue.

Proceed to PHASE 3:
- DESIGN_PRINCIPLES: frozen_figures as the rule-6 audit-snapshot
  exception to Architecture 2; supersede COMMERCIALS FACTORING
  decision 4 (option a) with its reasoning left visible; record that a
  database guard is calibrated by SQL in one rolled-back block, because
  PostgREST cannot observe a rolled-back function (this round's
  finding); record the engine-id caveat (commit = HEAD at server start;
  the calculator sha256 pins the code).
- CURRENT_STATE regenerated (now with base_cost_batches).
- Full gate, all 27 stages, none skipped.
- Merge to main, report "ready for John's push" with the SHA.
Stop there. Do not push.

Recorded at the close of the build: ffsqlcal torn down, zero live records
carrying the tag (the same scan read 5 for a known live name).
