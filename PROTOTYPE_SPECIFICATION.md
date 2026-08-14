# Terminus Ops prototype specification

Source: `Terminus_Ops_dc.html` (Claude Design prototype), 11,391 lines.

**Purpose.** This replaces "use the prototype as reference" as a build instruction.
Every entry below is a real, checked citation, not a paraphrase. Rule 8
(`DESIGN_PRINCIPLES.md`) exists because paraphrased or general instructions
produced wrong builds at least six times before this document existed. Nothing
gets built against a section of the prototype until that section has an entry
here.

**Status key.** ✅ Fully extracted and cited, safe to build/audit against.
🟡 Partially extracted, core facts known, detail work still needed before
building. ⬜ Not yet extracted, do not build against, extract first.

---

## 1. Contact / Account / Lead ✅

The single most-corrected model this session, now stable and matches
`DESIGN_PRINCIPLES.md` Section 2 exactly.

- `leadDraft` shape (the full Contact field set): line 5179
- Creation-mandatory fields (5): `leadMandatoryFields`, line 7529, exactly
  `name, company, industry, email, mobile` (now 6 in the live build, `source`
  added as a deliberate, confirmed departure from the prototype, per business
  decision)
- Qualification-mandatory fields (14): `leadQualifyRequired`, line 5844,
  `name, company, industry, jobRole, email, mobile, address, city, postcode,
  country, region, linkedin, source, summary`
- `contactFromLead()`, lines 7556-7558: confirmed prototype bug, drops city/
  postcode/region when creating the Contact despite validating them.
  **Deliberately not carried forward** — the live build persists them.
- Country → Region auto-fill: line 7526, confirmed wanted, to be built
- Lead detail template: lines 414-540+ (list 414-472, detail overlay 474-540+)
- Contacts list: lines 273-329 (grid header, `+ Create` hover-menu with
  separate Test Bed/Opportunity targets at 305-312, ✕ delete)
- Industry picklist: line 5531, `usedBy` note confirms the 6-char code feeds
  both Test Bed and Opportunity reference numbers
- Account is **not a prototype concept** — it was designed in conversation
  this session (`DESIGN_PRINCIPLES.md` Section 2), not extracted from the
  prototype. The prototype's `company` is a plain string on Contact. Live
  build: `company` stays free text at creation; real Account linkage is a
  separate, later, qualification-gated action (`POST /contacts/:id/link-account`).

## 2. Opportunity — Commercials tab ✅

Fully extracted and built across A1–A5 (deal-calculator.js, opportunity-deal.js).

- Deal Summary matrix: template 1317-1336, data `dealMatrix` 6946-6963
- Hw/Hosting Setup: template 1338-1367, data 6455-6507, 6684
- Installation: template 1369-1420, data 6495-6502, 6677-6708, 6685.
  Installation Responsibility, 4 real values: line 5703 (picklist), 5569-5570
  (usage) — `Client Own Installation Team / Terminus Contractor - Per Unit /
  Terminus Contractor - Lump Sum / Terminus - Reseller Installation`. Found
  wrong in the live build (3 invented labels, missing Reseller Installation)
  and fixed.
- Structural Terms + Deal sheet: template 1476-1544, data 6790-6986. Deal
  sheet (USD) 16-row P&L: 6971-6986. `rollup.rows` confirmed dead code,
  correctly not built.
- Payment Terms + cash flow: template 1544-1700, data 6816-6945. Cash flow
  orientation: months as columns, categories as rows, `cashflow` section
  6719-6755 — built wrong once (rows/columns swapped), fixed.
- `buildLoanSchedule()`: 6331-6354, direct pure-function port, verified
  correct.
- `buildOppDetail()`: 6410-7017, the full calculation core, ported into
  `deal-calculator.js`, verified against the live prototype class executed
  directly in Node (not just read).

## 3. Opportunity — Reference tab ✅

- Template: lines 1130-1330. Reference number strip, Terminus Details /
  Customer Details / Key Dates cards, Executive Summary, Notes.
- Editing model: click-to-edit in place, multiple fields open at once,
  built matching this exactly (`opportunity-reference.js`), confirmed as a
  deliberate choice over a simpler save-triggered form.
- Est. Close Date: dedicated move-form with mandatory reason, own endpoint
  (`POST /opportunities/:id/close-date-move`), separate from the generic
  PATCH since `forecast_close_date` lives on a real column, not payload.
- Person fields (Terminus Lead, Commercial/Technical/Legal Authority,
  Account): prototype expects Contact dropdowns with inline "create new
  contact". Built as free text at the time (`opportunity-reference.js`
  lines 8-9, self-disclosed gap) since Contact didn't exist yet. **Now a
  closable gap** — Contact/Account exists, this swap has not yet been done.

## 4. Opportunity — Documents tab ✅ (deliberately minimal)

- Template: lines 1770-1778. Flat template-link list, sourced from a
  centrally-maintained Admin document library.
- Live build: honest empty state, no template data source exists. Correctly
  scoped as out, not a silent gap.

## 5. Opportunity — Stage & Approvals tab ✅

- Template: lines 1780-1816+, data 6368-6396. 3-column table (Stage / Exit
  criteria / Approvers), dot states, 0.55 opacity for upcoming rows.
- Prototype hardcodes `canApprove = true` as a testing stub — **not** ported.
  Live build gates real clickability off actual stage/role logic via a new
  `GET /records/:id/stage-approvals` endpoint combining `stage_definitions` +
  `stage_gate_rules` + `approvals`.

## 6. Test Bed 🟡 — real gap, extract before building/auditing further

Never received a full citation-based extraction this session. What's known:

- List view: lines 591-660+, a dashboard with two matrix breakdowns
  ("by status, by region", "by industry, by region"), hover tooltips showing
  drill-down items, a live/degraded/in-progress count badge. Not yet fully
  read past line 660.
- Detail view entry/exit: line 721 (`closeTestbed`, "← Back to Test Beds")
- Sub-stage / document model: `testbedStage`, line 5297, 5 sub-stages
  (through "Monitoring and Analysis" at ss4, "Review and Completion" at ss5),
  each with its own docs/criteria/approvals list — this is a genuinely
  different, richer per-substage document-gate model than Opportunity's flat
  Stage & Approvals table, confirmed already diverges in the live build
  (flagged during the B3 audit, never reconciled)
- Full field/mandatory-field list: `testbeds` picklist entry, line 5736,
  extensive — Terminus Lead, Test Bed Duration (defaults to 3 months per the
  Partnership Agreement), Test Bed Tech Team, Initial Lead, Commercial/
  Technical/Legal Contact, Test Bed Documents, more not yet transcribed
- Document templates specific to Test Bed: lines 5459, 5461
  ("Partnership and Test Bed Agreement", "Test Bed Review Document")
- Region, Site Ownership, Installation Environment, Installer picklists:
  lines 5547, 5600, 5606, 5611, all "Used by Test Beds →"
- Unassign reasons: line 9270 (Warranty Swap, Reallocated to Demo/Test Bed,
  Failed/Faulty, Decommissioned) — asset-management-adjacent, may belong to
  Section 8's deferred Asset Management work instead

**Next step, not done here:** a dedicated extraction pass on lines 591-1130
(list + detail template) and 5736-5780 (full field list), same discipline as
the Commercials A1-A5 passes, before any further Test Bed work.

## 7. Admin ⬜ — out of v1 scope, not extracted

Referenced only where it feeds in-scope modules (Industry picklist codes,
document template library). The full multi-tab Admin module (Data Objects,
Picklists, Workflows, Contractors, and more per earlier CLAUDE.md notes) is
listed in `DESIGN_PRINCIPLES.md`'s Deferred scope section. Do not extract
until it's actually queued to build.

## 8. Contractor Management, HR/timesheets, full Documents module ⬜

Confirmed out of v1 scope (`DESIGN_PRINCIPLES.md` Deferred scope). Not
extracted. Exists in the prototype but deliberately not read in detail —
extracting now would be wasted effort against a moving target until these
are actually queued.

---

## How to use this document

1. Before building or auditing any screen, check its status above.
2. ✅ means build directly against the citations here — they're checked, not
   assumed.
3. 🟡 or ⬜ means stop and extract that section first, same method as
   Sections 1-5: read the actual template and data lines, cite them, write
   a plain-language spec of the real layout/field/validation decisions,
   *then* build.
4. Update this document the moment a new section is extracted. An
   unwritten decision is, for practical purposes, a decision Claude Code
   doesn't have.
