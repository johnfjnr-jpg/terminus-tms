# Terminus TMS: Project Status

**Last updated:** 3 August 2026. Keep this current as work progresses, it's the fastest way for a new conversation or a new Claude Code session to get oriented without re-reading the full history.

**Read this first, then `DESIGN_PRINCIPLES.md` for the actual architecture.** This document is "where are we and what's next", the design doc is "how does the system work".

---

## What this is

Terminus Technologies (Singapore, pre-revenue) is building a Terminus Management System (TMS), starting with the sales/deal pipeline, intended to grow into the default day-to-day system for the whole company (CRM, deployment, asset management, expenses, timesheets, and more, per `DESIGN_PRINCIPLES.md` Section 1). It's being built deliberately, not bought, on the view that a system genuinely built into company operations is itself worth something at a future sale, not just internal tooling.

Stack: PostgreSQL via Supabase, Node.js/Fastify backend, plain HTML/JS frontend against the Terminus brand tokens, Supabase Auth with Google login, hosted on Render, GitHub Actions CI/CD, built with Claude Code. Repo: `terminus-tms`, separate from the earlier Google Apps Script deal sheet prototype (`Terminus-Deal-Sheet`), which still exists and still works, but is being superseded.

## What's built and confirmed working

- **Generic engine** (Milestone 1): `records`, `record_revisions`, `approvals`, `audit_log`, `roles`, RLS from the first migration, stage-gate enforcement proven end to end on a trivial smoke-test record type.
- **Lead and Opportunity** (Milestone 2): create, convert, move through Discovery to Closing, gate-checked.
- **Test Bed split out as its own record type**, not a variant of Opportunity, found necessary through testing, not planned upfront. Own stage lifecycle (Planning through Closed), own reference code, own contacts/documents.
- **Two real bugs found and fixed through testing**, not caught by inspection: a `google.script.run` Date-serialization issue in an earlier prototype phase, and an ambiguous foreign-key relationship (`opportunity_details` to `records`) once `converted_from_test_bed_id` was added, which broke Opportunity listing until an explicit relationship name was specified in the query.

## Just briefed, not yet tested

Sent to Claude Code, results not yet confirmed:

1. Planning restructured from five sub-stages to four (NDA, Site Assessment, Partnership and Test Bed Agreement, and Compliance and Data Protection/CaDP, which bundles APD and DPIA as two documents required together, not sequential steps)
2. "Review" renamed to "Close out Review"
3. Frontend: Planning should show as one step in the main stage tracker, with its sub-stages in a secondary track beneath it, not flattened into the main line

**Next action: test this once built**, same discipline as every milestone so far, create a Test Bed, move through the sub-stages, confirm CaDP genuinely requires both documents, confirm the tracker UI actually shows the two-level structure, don't commit until confirmed.

## Known placeholders, real values still needed

These exist and work mechanically, but hold fake data. Not blockers to continued building, but don't treat any of them as real:

| Placeholder | Where |
|---|---|
| Chart of authority discount % thresholds and approver emails | `ChartOfAuthority` sheet (still Apps Script era) / `routing_rules` |
| `product_defaults` (unit, mounting, hosting costs for SafeSight, AQ Sensor, HEMIR) | Real numbers not yet supplied |
| `system_defaults.target_profitability_pct` | Not yet supplied |
| Senior-tier approver for Test Bed's Decommissioning → Closed gate | Tier and person not yet decided |

Stage probability defaults ARE real (Discovery 10%, Qualified 20%, Proposal 50%, Evaluation 60%, Negotiation 90%, Closing 100%), not a placeholder.

## Deliberately deferred, not designed yet

- Weekly check-in meetings during Monitoring and Analysis, to stay close to the customer during a Test Bed, possibly automated. Requirement captured, UX intentionally not designed yet.
- Cost carry-over from Test Bed into a converted Opportunity's Deal Sheet, the Deal Sheet module doesn't exist in this build yet, so the carry-over has nowhere to land, only the requirement is documented (Section 8).
- Deal Sheet port from the Apps Script prototype into this system, not started.

## Build order from here

Per `DESIGN_PRINCIPLES.md` Section 9, roughly in this order: Deal Sheet module, extract/confirm the workflow engine is genuinely record-type agnostic before building further, Opportunity value estimation, product capability catalog, then Risk Register/Pilot/Deployment/Asset Management and the rest.

## Working habits that have paid off, worth keeping

- Test every milestone properly before committing, "commit this" from Claude Code is an offer, not proof
- Report bugs with the actual error text/log output, not a description of the symptom, this has consistently led to fast, correct fixes rather than guesswork
- When Claude Code proposes a fix, get the actual before/after confirmed working, not just that it ran without erroring
- Update `DESIGN_PRINCIPLES.md` before briefing a structural change, not after, so the doc stays the source of truth rather than drifting from what's actually built
