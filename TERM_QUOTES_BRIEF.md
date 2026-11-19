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
