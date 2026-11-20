TERM_QUOTES_BRIEF.md
ROUND: TERM_QUOTES  |  PHASE 0 (read-only)  |  base: origin/main 40c4c09
Consolidated 2026-11-19: original brief (2026-11-18) + addendum + amendment
(John's rulings 2026-11-19). This text supersedes any partial paste.

SETUP
- Confirm origin/main = 40c4c09 by ls-remote. If it differs, STOP and
  report; do not branch.
- Branch term-quotes off 40c4c09. First commit = this brief verbatim as
  TERM_QUOTES_BRIEF.md. ls-remote base-equality check again at merge time.
- Phase 0 is READ-ONLY: no code changes, no migrations, no DB writes, no
  deletions, no settings edits. Any reprice experiment runs in memory
  through the pure engine only.
- Run the full gate once on the untouched base (NordVPN off) and record the
  result per stage as the round's baseline.

PURPOSE
Verify by measurement the premises behind the design positions below before
the build is designed. Report each as CONFIRMED / FALSIFIED / NEEDS RULING
with evidence. Do not design or build.

RULINGS OF RECORD (John, 2026-11-19)
 R-TQ1 The term quote is the DEFAULT pricing method on opportunities.
 R-TQ2 A saved draft quote REPRICES on the current ladder and settings when
       reopened. Only a submitted version holds its stored settings and
       frozen figures.
 R-TQ3 Deal discount and below-floor margin are SIGNALS on the approval
       page. No new tracks, no new approvers, authorisation model unchanged.
 R-TQ4 Switching pricing method mid-deal is allowed through a new version,
       which re-arms the gate; refused while a version awaits approval.
 R-TQ5 PRINCIPLE: no backward-compatibility code for pricing records
       created before this round. All TMS data is test data.
 R-TQ6 Commercials (cost-up) REMAINS a pricing method on opportunities for
       ground-up pricing. The term quote is the default.

POSITIONS
 P1 CONFIRMED by ruling: one version sequence per opportunity; each version
    carries kind (term_quote | commercials); new opportunities default to
    term_quote; headline from the current version.
 P2 Two tabs on the opportunity. Term quote first and default, mounting the
    existing Term Pricing component in bound mode (inputs in, onChange out,
    save via the version seam); Commercials retained. The tab not matching
    the current version's kind is read-only with a line naming the method
    in use. Standalone Term Pricing screen unchanged (saves nothing).
    Arrangement subject to an approved mockup.
 P3 A submitted quote stores inputs + a settings snapshot BY VALUE
    (ladder rows used, bands, floor, compare term, CPI, WHT/GST rates,
    factoring rate; cost batches by id only if immutable); submission
    freezes frozen_figures as Commercials does. Drafts reprice live
    (R-TQ2) and need a "settings changed since saved" signal.
 P4 CONFIRMED by ruling: reuse deal_sheet_versions with a kind column;
    per-kind server-validated writable keys.
 P5 No new approval tracks; signals per R-TQ3.
 P6 Headline = Base TCV; Final TCV only when CPI Locked, labelled as such;
    passed-through factoring counts in Base TCV; one "unpriced" definition
    (CONTRACT_VALUE).
 P7 Closed Won lock and won-version rule apply to both kinds.

INVESTIGATIONS
 0-1 APPROVAL REGRESSION FIRST. Reproduce probe-decision-feedback's failure
     on the approval banners' double-click guard using the refreshed
     approver account. Classify: product regression, test defect, or
     environment. Read the ordered sequence of events, not a pass rate.
     Evidence: DOM state, network requests, which click is refused and why.
     No fix in Phase 0.
 0-2 deal_sheet_versions census of USE: every route, trigger, RLS policy,
     version-guard allowlist entry, frozen_figures writer, approval page
     reader, Closed Won derivation, version-label composer, Working Version
     field, pricingChanged, gate suite and golden-deal harness that reads
     or writes it. Table: site | file:line | reads/writes |
     shape-dependent Y/N | disposition: needs a kind branch, or can stay
     Commercials-only, with reason.
 0-3 TCV readers: every site that reads a deal's headline value or contract
     value (header, stat strip, pipeline, approval page, CONTRACT_VALUE's
     unpriced definition). Table: site | field read | would it read a
     term_quote correctly.
 0-4 Term engine settings inventory (docs/pricing-spec.md v2.0 as the
     reference): every setting the engine reads (price ladders per product,
     volume bands, floor, compare term, CPI, WHT/GST rates, factoring rate,
     cost batches, target margin). For each: storage location, admin
     editable Y/N, versioned/immutable Y/N. Prove snapshot sufficiency in
     memory: price an example, capture the snapshot, mutate a copy of the
     live settings, reprice from the snapshot, assert byte-identical
     figures. Calibrate: inject one omitted setting and show the check goes
     red. Also measure what "settings changed since saved" detection needs
     for drafts (snapshot compare vs settings timestamps).
 0-5 Term Pricing component structure: which state is local, which derives
     from props, what bound mode would require without forking. Note the
     form/version seam decision of record.
 0-6 Opportunity tab shell: how tabs register; available width for the
     term screen at 1240 / 1440 / 1920 (measured, for the mockup).
     Re-measure the price card's List TCV / Deal discount / Discount value
     at seven-digit deals (currently 13px vs 16px elsewhere) at those
     widths.
 0-7 Approval page: how it renders stored figures and runs today's engine
     as a check for Commercials; what a term_quote kind needs to render the
     same way; where the R-TQ3 signals would sit; what the page needs to
     show when the method differs between the last approved version and
     the version under review.
 0-8 Lock sites: every place that refuses pricing edits after Closed Won or
     while a version awaits approval. Confirm whether the standalone Term
     Pricing screen or its routes could write to an opportunity today.
 0-9 Queued probes: state what probe-screen --tabs and --capex currently
     point at and what this round's screens would replace.
 0-10 WIPE IMPACT. Measure, do not execute:
      - counts: opportunities, deal_sheet_versions by status, approvals
        rows, frozen_figures rows, Closed Won opportunities.
      - what blocks a delete: immutability trigger, FKs, RLS, cascades.
      - which gate stages, probes, golden deals and fixtures read LIVE
        database records vs their own fixtures. Name each dependent test.
      - TT-SGP-LOGIST-001 (John ruled KEEP 2026-09-29): what a wipe does
        to it.
      - the smallest safe wipe shape: versions only, or whole test
        opportunities, and why.
      Report a proposed wipe as a data change for John's approval. Do NOT
      apply it.

STOP
Write the Phase 0 report: baseline gate result, 0-1 classification, each
investigation's table, then P1 to P7 each marked CONFIRMED / FALSIFIED /
NEEDS RULING with the evidence line, then the 0-10 wipe proposal. List any
premise in this brief that measurement contradicts. Then STOP for John's
rulings on the wipe and any NEEDS RULING items. No mockup, no build, no
push. Write the report verbatim to REPORT_FOR_CHAT.md and the OneDrive TMS
Test log per convention.

---

## Rulings on Phase 0 (John, 2026-11-20), appended verbatim at the phase they launch

TERM_QUOTES rulings on Phase 0 (John's wipe answer: Option 1, no wipe)

W   No wipe. kind defaults to 'commercials'; all 31 live versions are Commercials-shaped. A record with no pricingMethod key reads as Commercials. Record in DESIGN_PRINCIPLES: TT-SGP-LOGIST-001 KEEP as ordinary test data (John, 2026-09-29).

0-1 Accepted: TEST DEFECT, not a regression. Repoint probe-decision-feedback to the per-track rule (told second click, one POST, one row) as a queued item, not this round.

P1  Confirmed: one version sequence, kind per version, numbering kind-blind. "Headline from the current version" is withdrawn; see P6.
    Every reader that hands a version row to an engine or to pricingChanged must filter or branch by kind. Census 0-2's "latest-row readers" are the named list; each gets a test with a term_quote row as the newest row.

P2  Two tabs, bound mode as proposed in 0-5: lift the 28 inputs into one value object with optional { value, onChange }. Standalone is unchanged and saves nothing.
    The draft inputs live in the RECORD payload under a new key termQuote. A second key, pricingMethod ('term_quote' | 'commercials'), is stamped 'term_quote' at creation of new opportunities (R-TQ1). Both keys join the PATCH allowlist and the Closed Won key set (rename COMMERCIALS_OWNED_KEYS to PRICING_OWNED_KEYS).
    The version card takes a second seam implementation for term quotes. The seam stays the interface; nothing reaches into the view.
    No view work before the mockup (prototypes/term-quote-tab.html), which follows separately. The 148px narrower pane is the mockup's problem, not the build's.

P3  Accepted as measured. A term_quote version's rates column holds the seven settings and each product's costs BY VALUE. CPI, WHT, GST and factoring live in inputs. Batch ids are not relied on; no change to the batch immutability trigger.
    rates_have_cost_basis branches by kind: term_quote requires the full params snapshot.
    Drafts reprice on today's params when reopened (R-TQ2). "Settings changed since saved" = deep compare of the stored snapshot against today's buildParams, never a timestamp.
    Submission freezes figures through a term branch in buildFrozenFigures.

P4  Confirmed. kind column, check ('commercials','term_quote'), default 'commercials'. kind joins the immutable() guarded list. insert_deal_sheet_version gains p_kind default 'commercials'. Verify verify-harness createVersion against the branched CHECK (the census flag).

P5  Confirmed. Discount signal and floor flag sit in the approval page's ask block. No tracks, no approvers, no gate change.

P6  Headline source, both methods: the record's working inputs for its pricingMethod, repriced live. Commercials is unchanged (calculateDeal over the payload). Term is priceQuote over termQuote with today's params, reporting Base TCV. At Closed Won the headline is the won version's frozen figure, either kind.
    Cents become dollars in ONE adapter before contractValueOf. A term quote with zero units reads unpriced ('--').

P7  Closed Won lock, both kinds, at the database: a trigger refusing INSERT on deal_sheet_versions (and UPDATE of a draft) for a record whose status is Closed Won. The route maps it to 409 with the existing Closed Won wording.
    The R-TQ4 refusal "while a version awaits approval" is WITHDRAWN. It contradicts the decision of record that version approval does not freeze the record. A method switch is allowed. The next submitted major of either kind supersedes the open review and re-arms the gate (close_superseded_reviews, as today). pricingChanged answers "changed" whenever kinds differ, before comparing keys.

0-7 Accepted: when the last approved version and the version under review differ in kind, the approval page drops the bridge and shows both headline figures side by side with "Pricing method changed: the previous approval does not carry over."

RIDER  Move the scratch puppeteer out of /tmp (~/.cache/tms-probe), with the gate's printed recipe updated to match.

GOLDENS (fixture params only; never write live settings)
TQ-1  New opportunity, term quote, SafeSight 60 units, 120 months, OPEX, no CPI, no discount, no factoring: headline Base TCV 3,414,000.00 (monthly 28,450.00).
TQ-2  Same quote saved as a draft, then fixture ladder 120 moved to 510.00: draft reopens at 3,482,280.00 (band fees 510.00 / 484.50 / 459.00, monthly 29,019.00) with "settings changed since saved".
TQ-3  Same quote submitted at 500.00, then the ladder moved: the version and approval page still read 3,414,000.00.
TQ-4  Closed Won record: a direct version insert of either kind is refused at the database.
Existing goldens (G1 to G5 and the T, LG series) unchanged.

SEQUENCE  Spec v2.1 first. Then the migration (kind, CHECK branch, guard list, p_kind, Closed Won trigger) drafted in full with rollback, and STOP for my review; John applies it before any gate run. Then tests fail first in their own commit, engine/routes, calibration (each FIRES), STOP for the mockup, view, probes from the click, sweep, full gate, merge --no-ff, merged gate, ls-remote, "ready for John's push".

## Migration review, round 1 (John, 2026-11-20), appended verbatim at the phase it launches

TERM_QUOTES migration review, round 1 (not approved yet; revise and re-stop)

M1  Tighten the commercials branch of deal_sheet_versions_rates_have_cost_basis the same way as the term branch (coalesce(..., false)). Move verify-harness createVersion and the two version-atomicity tests to a real cost basis. Keep the constraint NOT VALID.
M2  insert_deal_sheet_version drop-and-recreate: restate the original's SECURITY mode, search_path and every GRANT/REVOKE exactly as 20260829000002 (and any later migration touching it) left them. List each one in the report against its source line. End the migration with: notify pgrst, 'reload schema';
M3  Rollback must be ONE self-contained file pasteable into the Supabase SQL Editor. Generate the restored definitions from their source files with a script, and add a pure test asserting the generated text matches the sources byte for byte. Same refusal if any term_quote row exists. Restore grants and end with the notify as in M2.
M4  Accepted: draft kind immutable; rates.params as the snapshot; PT423.
M5  Add to the tests-fail-first commit: a test that fails if stage_definitions has no stage named 'Closed Won' (the trigger's and WON_STAGE's dependency).
M6  In the stop report, paste BOTH files in full (migration and rollback), then STOP. Nothing applied.

## Build review rulings (John, 2026-11-20), appended verbatim at the phase they launch

TERM_QUOTES build review: rulings on the four decisions

D1  Keep the PT423 message discriminator. Record in DESIGN_PRINCIPLES 8a that M4 was accepted on a false premise and re-accepted on the facts: two meanings share PT423, told apart by the exact message, held by term-quotes-db (e) and the code-only wrong-pass injection. Revisit only if a third PT423 meaning appears.
D2  R-TP1 confirmed as: the term engine imports nothing. Add a pure test naming the only modules allowed to import src/lib/term-pricing.js (term-quote.js, the standalone view, and any others found today, listed). A new importer fails it. Calibrate: an extra import FIRES.
D3  Scope the rollback's refusal to term_quote versions on LIVE records (records.deleted_at is null). Before dropping, it raises a NOTICE with the count of soft-deleted fixture rows it will relabel. Change the generator, regenerate, keep the pin test green, and calibrate: a live term row refuses, a fixture-only population proceeds (rolled back).
D4  For the mockup: two term versions get a "what changed" table (units per product, term, deal discount, payment basis, CPI mode, then Base TCV before and after) in place of a bridge. Build it with the view.
Q   Queue: make scripts/verify-all.mjs safe to import (no top-level execution unless run directly).
Calibrators inject into a temporary copy except where the claim needs the served tree (HTTP); say which in each report.
Then STOP. The mockup follows.

## Mockup approved; the view, cash flow and probes (John, 2026-11-20), appended verbatim at the phase they launch

TERM_QUOTES: mockup APPROVED by John, 2026-11-20. prototypes/term-quote-tab.html (six artboards). Commit it first if John has not.

Build the view to the mockup. Departures from it are reported with a reason, never silent.

V1  Tab order: Reference | Term quote | Commercials | Assessment | stage tabs. The landing tab stays Reference.
V2  Both pricing tabs open with the Pricing method selector (Term quote | Commercials). It writes pricingMethod. The inactive tab shows only: "Not in use. This deal is priced by Term quote." (or "...by Commercials.") with the switching note from artboard 3.
V3  The Term quote tab: version card at the top (the second seam implementation; Save version, Submit V<x.y> as V<n>.0 for approval), then the three steps in bound mode, with no admin settings editors. Units, term table with Monthly and Base TCV for this deal, price breakdown by product and band, then deal adjustment beside the price card, as in artboard 1 at 1240.
V4  Reopened draft (artboard 2): an amber status banner under the version card when the stored snapshot differs from today's params. It shows the saved Base TCV, today's, the difference, and "What moved": a plain-words list of the changed settings (e.g. "the SafeSight price ladder at 120 months, 500.00 to 510.00"; costs, bands and floor likewise), at most three, then "and N more". It is built from a key-by-key diff of the snapshot, in src/lib/term-quote.js, with unit tests including a three-plus case.
V5  Approval page: the term ask (artboard 4), D4's "what changed" table (units per product, term, deal discount, payment basis, CPI, Base TCV and margin before and after, unchanged rows greyed), and the method-changed block (artboard 5) with the real Commercials contract net.
V6  Closed Won (artboard 6): selector and inputs disabled, the won banner in the refusal's exact words, the won version's frozen figures, no save or submit.

CASH FLOW (John, 2026-11-20)
CF4 FIRST: report what the term engine's cash flow already returns. If any of CF2's four figures needs new engine arithmetic, STOP and say which one, before building it.
CF1  The Term quote tab's Payment terms step carries the standalone screen's PO factoring section and cash flow unchanged, in bound mode. Their inputs are part of termQuote and of the version's inputs.
CF2  The approval page's term ask gains a frozen "Cash flow" card: peak funding need (lowest cumulative cash, and its month), the month cumulative cash turns positive (or "not within the term"), total factoring cost, and Pass through / Absorb. Built in buildFrozenFigures' term branch, frozen at submission, never recomputed on the page.
CF3  The "what changed" table adds a row for peak funding need and one for PO factoring (on/off, advance).

PROBES from the click, as the signed-in non-admin user:
- mount; inputs in and onChange out; save and submit through the seam;
- the inactive tab's line; method switch; the Closed Won lock;
- the approval page's term ask, what-changed table and Cash flow card;
- factoring on: the tab's cash flow renders and equals the standalone screen's for the same inputs;
- the reopened-draft banner, proven with a TAGGED FIXTURE draft whose stored snapshot differs from today's (seeded by the service role). Never write live settings.

THEN: overlap sweep 1240..1920 step 40 (the Term quote tab in each state, Payment terms with factoring on included), the full gate with the PUPPETEER_PATH recipe, merge --no-ff, the merged gate, ls-remote re-check, and "ready for John's push". Captures at 1240 and 1920 opened and read.
