# Terminus Management System: Design Principles

**Status:** Living document. Extend this as the system grows, don't let it drift out of sync with what's actually built.

**Vision:** This starts as a deal sheet with approval workflow. It is being built to become the default system employees use to manage their day-to-day work, supporting best management practice broadly (including but not limited to ISO 9001 aligned process discipline: traceability, controlled approval, documented decisions, audit history).

---

## 1. What this system owns, and what it doesn't

**Decision (deliberate, not default):** Customer, Contact, and Opportunity/Pipeline management are built natively into TMS, not bought as a separate CRM. Rationale, stated by the business: pre-trading, no legacy CRM to migrate away from, and a TMS genuinely built into company operations is considered to add value to the business as an asset in its own right, not just as internal tooling, relevant at a future sale. This is a considered trade against faster time-to-value from an off-the-shelf CRM, revisit only if the build genuinely stalls the sales motion, not on a whim.

Because this system is being built partly as a business asset, build discipline matters more here than it would for a purely internal tool: a rushed, half-working native CRM is worth less at sale than a smaller, reliable one. Prefer shipping the generic engine solidly before adding surface area.

This system is still a **workflow, approval, and record-of-decision layer** for everything else. Some categories remain clear integrate-not-build candidates, revisit each under the same lens (does owning it add real asset value, or just cost time) rather than assuming the CRM decision extends automatically to all of them.

| Already handled elsewhere, integrate rather than rebuild | This system owns |
|---|---|
| Calendar and scheduling → Google Calendar | Customer, Contact, Opportunity, Pipeline (built natively, see above) |
| File storage → Google Drive | Structured workflow states for any record type |
| Email and messaging → Gmail | Approval routing (chart of authority style, tiered) |
| Support ticketing → likely still buy/integrate (Zendesk, Freshdesk), revisit later | Immutable audit trail of who did what, when |
| Documentation/knowledge base → likely still buy/integrate (Confluence, Notion), revisit later | Versioned record history (no silent overwrites) |
| Reporting/BI → likely still integrate a BI tool against this system's own database | Role-based permissions per record type |
| | Cross-module search and "my open items" views |

When a future module needs a document, it stores a Google Drive file ID and links to it, it does not build its own file storage. When it needs to notify someone, it goes through one shared notification service, it does not send email itself. This is not just a principle, it's a concrete requirement confirmed in the Test Bed's Planning documents (NDA, Site Assessment, and the rest), each one links out to its actual file in Google Drive rather than the system trying to store or render the document itself.

---

## 2. Data model: generic by default

Every business object in this system, a lead, an opportunity, a deal sheet, a nonconformity report, a corrective action, a controlled document, anything added later, is a **record**. Records do not get their own bespoke tables. They get a `record_type` and a JSON payload.

### Lead, Contact, and Account, before the sales journey proper begins

**Contact (`record_type = 'contact'`) is a single record type for a person, from first, incomplete capture through full qualification and beyond. There is no separate `lead` record type, and no conversion between "Lead" and "Contact."** "Lead" is a stage, `Unqualified`, on the same Contact record, not a different kind of thing. This is deliberate, not an oversight: the earlier model, described below in the Opportunity section, tried a mutable `type` field to let one record represent two different kinds of thing and was found to be wrong. A Contact that starts sparse and fills in over time is one kind of thing throughout, just at different points of completeness, so there's nothing to correct here, ordinary stage progression is the right mechanism, the same one Opportunity's own stages already use.

**Account (`record_type = 'account'`) is its own record type, the company a Contact belongs to.** Multiple Contacts can belong to one Account, and the system must support viewing all Contacts that belong to a given Account, a roll-up view, not just per-Contact records with no way to see the group. Country, for the reference-code generator (Section 9), lives on the Account, not duplicated onto every Contact.

**Account holds a primary address, typically the head office, but individual Contacts can carry their own address and legal entity name, separate from the Account's.** Confirmed real cases this needs to handle: procurement documents needing a different site address than the head office, and contacts at the same Account genuinely belonging to different legal entities, e.g. MegaCorp Singapore Pte Ltd versus MegaCorp US Inc, both still rolling up under one MegaCorp Account. Address and legal entity are per-Contact fields, optional overrides of the Account's own, not a separate Site or Legal Entity record type, that would be more structure than this actually needs, a Contact-level override is enough to represent it.

**Contact stages:** `Unqualified` (created with a deliberately minimal, mandatory field set, see below) → `Qualified` (gated, see below) → **`Parked`**, a side branch, not a dead end: if sales judges a Contact not viable right now, it moves to Parked with a mandatory follow-up date, rather than being discarded. A Parked Contact can return to `Unqualified` or move straight to `Qualified` once follow-up happens.

**Mandatory fields at creation (`Unqualified`):** Name, Company (free text, see below), Industry, Email, Mobile, Source (Web, Email Inquiry, Referral, Direct Outreach, Marketing Campaign). Six fields, a deliberately small set capturing what's realistically known at first contact, not the full Contact record.

**Qualification gate, `Unqualified` → `Qualified`:** enforced by `stage_gate_rules`, checking 14 fields, a broader set than creation requires, not just the 6 above: Name, Company, Industry, Job Role, Email, Mobile, Address, City, Postcode, Country, Region, LinkedIn, Source, Summary. **"Company" here means the real Account link (`parent_record_id`) is set**, not that the free-text company field has a value, confirmed directly against the live `stage_gate_rules` row rather than assumed. **Budget, timescale, and intent are explicitly not system-checked**, that's a sales judgement call, not a data-completeness check, and this system has no opinion on it.

**Company is free text at creation, deliberately decoupled from the real Account link.** A salesperson types the company name as plain text when first logging a Contact, fast, no friction, no dropdown, no "is this an existing Account or a new one" decision forced at the moment of capture. The real Account link is a separate, later action, `POST /contacts/:id/link-account`, reached from the Contact's detail page, search existing Accounts by name or create a new one. The free-text company value is never overwritten by linking, it stays visible as the original, as-typed value; once linked, the Account's own name becomes the authoritative display everywhere Company shows (list views, the qualification gate's blocking message), the free-text value remains in its own field as historical context. This reconciliation step, not the free-text field, is what the qualification gate actually requires.

**Contacts can be deleted**, not just Parked, for entries that are genuinely time-wasting or outside Terminus's space entirely, distinct from Parked, which is for real interest that isn't viable yet. **Contacts sitting in `Unqualified` for over a year should be flagged for review**, an automated nudge, not a hard block, surfaced the same way any other "needs attention" view works in this system, not a new mechanism.

**A Contact can be linked to more than one Opportunity or Test Bed over time**, the same person becoming a buyer again a year later, or being a buyer on a Test Bed and a separate Opportunity simultaneously, is expected, not an edge case. This means Contact attachment is **not** a `parent_record_id` relationship, that field means exclusive single-parent ownership (a Deal Sheet has exactly one Opportunity), and a reusable Contact doesn't fit that shape. Contact-to-Opportunity/Test Bed is a genuine many-to-many link, a join table (`record_id`, `contact_id`, `role`, e.g. commercial buyer, technical buyer, end user, IT/Security, procurement), not the generic parent-child pattern used elsewhere. **This corrects what this section previously said about Contacts**, "linked via `parent_record_id`" assumed exclusive ownership that doesn't hold once Contacts are reusable.

**A Contact becoming a buyer on a new Opportunity or Test Bed seeds that new record's reference data**, name, Account, industry, address, and legal entity, from the Contact and its Account, rather than that data being retyped as free text. Where the Contact carries its own address or legal entity override, that takes precedence over the Account's own, the whole point of allowing the override is that it's the more specific, more correct value for this particular relationship. (The Reference tab, built before this model was written down, currently uses free text for person fields for exactly this reason, no Contact existed to link to yet, tracked as a known, deliberate gap until this is built.)

### Sales journey, the first concrete flow through this model

```
Contact (record_type = 'contact', see above for its own stages,
  mandatory fields, and qualification gate)
  → once Qualified, used to create either:
      Opportunity, the standard commercial sales path, or
      Test Bed, an R&D engagement with a client
    This is a genuine cross-record-type action, the Contact isn't
    consumed or converted, it stays a Contact and can be reused, the
    new Opportunity or Test Bed is a new record, seeded from the
    Contact and Account's data, and linked back via the many-to-many
    Contact link above.

Opportunity (record_type = 'opportunity', the anchor object)
  Always commercial. There is no R&D variant of Opportunity, and no
  `type` field, an earlier version of this document had Opportunity
  carrying a mutable R&D/Commercial type with Test Bed as one of its
  states, that model has been deliberately replaced. Test Bed and
  Opportunity are two different kinds of thing, not one thing with
  two labels, see below.
  owner_id: the sales person. Owns the Opportunity end to end,
    responsible for progressing it through the stage gates, collating
    required documents, and requesting approvals. This is the
    existing `owner_id` field on `records`, not a new mechanism.
  stage (= this record type's status field, defined in
    `stage_definitions`): Discovery → Qualified → Proposal →
    Evaluation → Negotiation → Closing (Quotation renamed to Proposal,
    Evaluation added, see Section 5 for what happens at each stage and
    what gates each transition)
  → Contacts link here via the many-to-many mechanism above, added
    incrementally as the relationship deepens, not all upfront:
    commercial buyer, end user, technical buyer, IT/Security,
    procurement, and others, one Contact can hold more than one role
    across different records
  → Documents attach here as the buying journey progresses, extensible,
    not a fixed list:
      - Deal Sheet (a UI concept over the Opportunity's own payload,
        NOT record_type = 'deal', corrected below - Round 5 end-of-
        round documentation pass, 2026-08-17), actively developed and
        revised through Discovery, Qualified, and Proposal; effectively
        frozen once the proposal is submitted (see Section 5)
      - Risk Register (record_type = 'risk_register')
      - NDA, PDPA assessment, Data Protection Impact Assessment
      - Pilot (record_type = 'pilot'), the pre-rollout phase, typically
        during Discovery, a child record of the Opportunity, not a
        separate top-level concept
  → closes (Won) →


Deployment (record_type = 'deployment', child of Opportunity)
  Possibly phased. Own stage progression: Planned → In Progress →
  Commissioned → Handed Over.
  → Asset (record_type = 'asset', child of Deployment)
    SafeSight(TM) and AQ Sensor units, see Section 6.
    → Component (record_type = 'component', child of Asset)
  → handover →
Support (ongoing)

Test Bed (record_type = 'test_bed', its own top-level anchor, NOT a
  child of Opportunity, NOT a variant of it)
  R&D engagement with a client, cost to the business, no client
  billing. Has its own owner_id, its own Contacts, its own Documents,
  and its own reference code (Section 9), because it genuinely is
  its own thing, not because the schema forces it to look that way.
  stage (defined in `stage_definitions` for record_type = 'test_bed',
    no variant needed, there is only one Test Bed lifecycle), **flat,
    no sub-stage layer, corrected this session, see below**:
    Qualification → Pre-Site Assessment → Site Assessment →
    Installation and Commissioning → Monitoring and Analysis →
    Review and Completion → Decommissioning → Closed, full
    detail in Section 8.
  **Closed here does not mean the same thing Closed/Closing means for
  Opportunity.** For Opportunity, Closed/Closing is a signed commercial
  contract, the *start* of deployment and site activity, work begins.
  For Test Bed, Closed is the *end* of all site activity for that
  engagement, decommissioning has finished, nothing further happens on
  site. Same word, opposite direction, do not conflate them when
  building gate logic or reporting against either.
  → can convert to Opportunity, at any point in its lifecycle, not
    only at Decommissioning. This is a genuine cross-record-type
conversion, exactly the same mechanism as Contact → Opportunity, a
    `conversion_criteria` row with from_record_type = 'test_bed',
    to_record_type = 'opportunity'. A brand new Opportunity record is
    created, referencing the Test Bed it came from
    (`converted_from_test_bed_id`), the Test Bed record itself is not
    mutated in place, it stays as the historical record of the R&D
    work that led here. The Test Bed's accumulated cost (Section 8's
    costing formula) is carried across and attached to the new
    Opportunity's eventual Deal Sheet as a cost line, the same
    treatment Pilot cost already gets, since it is a real cost of
    winning this deal, not something to lose track of on conversion.
```

Nothing here is a special case. Neither Opportunity nor Test Bed is more fundamental than the other, they're both records like any other, one happens to be the `parent_record_id` for sales documents, the other for R&D documents. The same generic workflow engine that moves an Opportunity through its own stages, a Test Bed through its own entirely different ones, or a Deployment through Commissioning also drives document-level approval tracks (the `approvals`/`stage_gate_rules` mechanism, Section 5), it has no idea what any of them mean. (**Corrected, Round 5 end-of-round documentation pass, 2026-08-17**: this sentence previously used "a Deal Sheet moving through Draft → Submitted → Approved" as its illustrative example. Deal Sheet has no record of its own and no status field to move through those states, see the correction below - the underlying point about one generic engine serving every record type still holds, it just can no longer be illustrated with a record type that doesn't exist.)

**This system will grow well beyond sales, expenses, timesheets, and whatever comes after that, and the model needs to hold for those without rework.** A concrete check, not just an assertion: an Expense claim is `record_type = 'expense'`, no `parent_record_id` (it doesn't belong to an Opportunity), one required approval track (Manager) via a single `stage_gate_rules` row, submitted by the employee who owns it. A Timesheet is the same shape, `record_type = 'timesheet'`, its own approval track, its own payload. Neither needs a new table, a new approval mechanism, or a new audit log, they're both just new rows in `stage_gate_rules` and a new payload shape, exactly the "new modules extend, they don't fork" rule already states. If a future module ever *does* need something the current schema can't express, that's the signal to revisit the generic model itself, not to bolt on a one-off exception for that module alone.

| Table | Purpose |
|---|---|
| `records` | `id`, `record_type`, `parent_record_id` (nullable, e.g. a Contact's parent is its Account **- corrected, Round 5 end-of-round documentation pass, 2026-08-17: this example previously named a Deal Sheet's parent, which doesn't exist as a real record, see below**), `status`, `owner_id`, `created_at`, `updated_at`, `industry_id` (nullable, references `industries`, a real FK needing referential integrity, not a payload key, added when Contact/Account were built but generic to any record type), `deleted_at` (nullable, soft delete, see below) |
| `industries` | `id`, `name`, `short_code` (6 characters, matches Section 9's reference-code format). Small, admin-managed reference data, same category as `approval_tracks`, not a business object with its own lifecycle. Select-only RLS for authenticated users, no write policy yet, admin-edited directly for now, same deliberate deferral as `stage_gate_rules` config (Build Order item 8). Standalone table, not folded into Contact or Account, so Section 7's future Taxonomy can extend it with `classification` and `use_case` tables referencing `industry_id`, rather than needing a second, disconnected industry concept. |

**Soft delete, `deleted_at`:** the correct way to let a record stop appearing in normal views without violating Section 1's own immutable-audit-trail and no-silent-overwrites principles. A `deleted_at` timestamp, hidden from default list views and roll-ups, `record_revisions` and `audit_log` stay completely untouched, nothing is ever actually removed. First used for Contact (letting genuinely time-wasting or out-of-space entries stop cluttering the working list, distinct from `Parked`, which is for real interest that isn't viable yet), but the column lives on the generic `records` table, any future record type gets this for free, no new migration, no cascading deletes, no new DELETE RLS policies needed.
| `record_revisions` | `record_id`, `revision_number`, `payload` (JSON, shape depends on `record_type`), `created_by`, `created_at`. Immutable once written. |
| `approval_tracks` | `track_name` (Legal, Commercial, Sales, Technical, Finance, or whatever gets added later), admin-defined, not hardcoded in application code |
| `approvals` | `record_id`, `revision_number`, `track` (references `approval_tracks`), `tier` (nullable, only tracks with escalation logic like Commercial use this), `approver_id`, `decision` (a tick box: approved / rejected), `comment` (free text, expected especially when rejected), `decided_at` (timestamp) |
| `audit_log` | `record_id`, `record_type`, `action`, `actor_id`, `timestamp`, `detail` |
| `roles` | `user_id`, `record_id` (nullable, set for instance-specific assignments like "Technical approver on *this* Opportunity"; null for type-wide defaults), `record_type` (nullable, `null` means the role applies globally, across every record type, e.g. `admin`, rather than one specific type), `track` (which `approval_tracks` entry this person can approve for), `role` (`owner` / `reviewer` / `approver` / `viewer` / `admin`) |
| `system_roles` | `user_id`, `role` (`admin`, extensible for future system-wide roles). Deliberately separate from `roles`, `roles` grants permission over a specific record or record type, `system_roles` grants permission over the system's own configuration, who can edit `stage_gate_rules`, `stage_definitions`, `product_defaults`, and similar, not any one record. Confirmed: `admin` is a single general permission, no finer-grained tiers needed yet. |
| `routing_rules` | `record_type`, `track`, `condition` (e.g. discount % band), `required_tier`, computes *which tier within a track* is needed, only relevant for tracks with escalation logic (Commercial today). Tracks without escalation (Legal, Technical) just use a direct `roles` nomination, no tier needed. |
| `stage_definitions` | `record_type` (`opportunity`, `test_bed`, extensible), `variant` (nullable, most record types don't need one), `stage_name`, `sort_order`, `phase` (nullable, groups several fine-grained stages under one recognisable higher-level name for reporting and UI, where a record type actually needs that, most don't and should leave this null). Defines the valid, ordered stage list for that record type. **This exists because a real bug was found in testing**: Opportunity and Test Bed were originally modelled as one record type with a mutable `type` field and a shared stage list, both assumptions were wrong, they're genuinely separate record types (Section 2) with genuinely separate stage lists, Opportunity's Discovery through Closing, Test Bed's own flat 8-stage list, Qualification through Closed (Section 8, corrected this session, see below, a two-level stage/sub-stage structure was considered and deliberately not carried forward, `phase` grouping remains available on the table for any future record type that genuinely needs it). This table is what makes each record type's stage list data-driven rather than hardcoded. |
| `stage_gate_rules` | `record_type`, `variant` (nullable, most record types don't need one, kept generic in case a future record type does), `from_stage`, `to_stage`, `requirement_type` (`document_status`, `approval_obtained`, `child_record_status` **not yet implemented, confirmed no code branch exists, `transitions.js` audited directly, Milestone 2, a row using this type is a silent no-op today**, `payload_field_required`, `contact_role_linked` **built, Milestone 3**: checks a `record_contacts` row exists for the record and a named role, and that the linked Contact's own `parent_record_id` matches the record's `account_id`. Generic, one branch in the same gate loop, not special-cased per record type. First used for Test Bed's Qualification exit, Client Commercial/Technical/Legal Buyer, deliberately title-cased to stay distinct from the pre-existing lowercase `'commercial buyer'` default role already in use elsewhere), `requirement_detail` (JSON, e.g. `{track: 'Legal'}` for an approval requirement, `{field: 'followUpDate'}` for a field-completeness requirement, `{role: 'Client Commercial Buyer'}` for a `contact_role_linked` requirement). A gate can have any number of `approval_obtained` rows, one per required track, admin-configurable, not fixed at two. **All** required tracks must reach `decision = approved` before the transition is allowed, and there is no required order between them, they can be requested and completed in parallel. `from_stage`/`to_stage` values must be valid entries in `stage_definitions` for that record's `record_type` (and `variant`, if it has one). **`payload_field_required` checks a named field is present and non-empty**, read from the current revision's payload for most fields, but from the `records` row directly for the two fields that are real columns rather than payload keys (`parent_record_id`, `industry_id`), the transition endpoint knows which is which. Used for Contact's Parked follow-up date and its Qualification gate (Section 2).
| `stage_reference_docs` | `record_type`, `stage_name`, `document_name`, admin-editable, **built, Milestone 4**. Deliberately separate from `stage_gate_rules`, purely informational content, "what documents are relevant at this stage," with zero gating semantics, nothing in `transitions.js` reads it, confirmed by direct diff. Built after a real bug: an earlier instruction conflated "read-only reference content" with "same pattern as Opportunity's deliberately-empty Documents tab," and the only mechanism that existed to surface per-stage document content was `stage_gate_rules` itself, which returned nothing for any stage without a gating rule, silently, for every Test Bed, until traced and caught. **General rule going forward: informational, non-gating content gets its own table, never layered onto `stage_gate_rules` "just for display," since that table's rows carry real enforcement semantics elsewhere and reusing it for display risks silently gating something never meant to block anything.**
| **Invariant, found and closed the hard way**: `POST /api/records/:id/transition` **must reject every `to_stage` when a record type has zero `stage_definitions` rows**, not treat an empty list as "anything goes." A record type with no seeded stage list previously let its status be set to literally anything, unvalidated, this was found when a Lead's real status was accidentally corrupted while regression-testing the Contact migration, corrected immediately and the incident logged to `audit_log` rather than erased. **Any new record type must have real `stage_definitions` rows before its transitions will work at all**, this is now a hard requirement, not a nice-to-have, worth remembering when Build Order's later items (Risk Register, Pilot, Deployment, and beyond) get built. |
| `conversion_criteria` | `from_record_type` (`contact`, `test_bed`), `to_record_type` (`opportunity` or `test_bed`, a Contact can convert to either), `condition`, same data-driven pattern as `stage_gate_rules`, kept separate since converting *between* record types is a different action than progressing *within* one. **Not** used for Lead-to-Contact, that's a stage transition on one record, not a conversion, see Section 2's Lead/Contact/Account subsection. |
| `record_contacts` | `record_id` (the Opportunity or Test Bed), `contact_id`, `role` (commercial buyer, end user, technical buyer, IT/Security, procurement, and others). Many-to-many, not `parent_record_id`, since one Contact can hold roles across more than one Opportunity or Test Bed over time, see Section 2. |
| `stage_probability_defaults` | `record_type` (`opportunity`), `stage`, `default_probability_pct`. Admin-editable, same data-driven pattern as the rest. Sales leadership can retune what "normal" looks like per stage without a code change. Opportunity-only, Test Bed has no probability concept, it isn't a sales pipeline. |
| `product_defaults` | **Never built - confirmed by grep across the whole codebase, zero references anywhere (found live, Round 5 Phase 6, corrected in this end-of-round documentation pass, 2026-08-17).** Originally intended as a row-based table (`product_type`: `SafeSight`, `AQ Sensor`, `HEMIR`, extensible; `unit_cost`; `mount_cost_new`/`mount_cost_existing`, nullable; `hosting_cost_default`), so a future product would be a new row, not a schema change. **The real, live cost engine doesn't use a shared defaults table at all**: unit/mounting/hosting/warranty rates (`ssUnitCost`, `aqUnitCost`, `hemirUnitCost`, and the rest) are plain, directly click-to-edit fields living in the Opportunity's own `record_revisions.payload` (Commercials tab, `frontend/opportunity-deal.js`) and, identically shaped, in Test Bed's own payload (`TB_COST_FIELDS`, `frontend/test-bed-detail.js`), computed via the shared `src/lib/deal-calculator.js` engine's three-group structure (`hardwareGroup`/`installGroup`/`hostingGroup`). Per-product extensibility (the original goal, HEMIR in particular) is achieved instead by adding new payload fields per product, confirmed already working live for HEMIR. Section 6 below still describes the original, unbuilt `product_defaults`-driven flow and has not been reconciled to match - a materially larger rewrite than this pass, flagged, not undertaken here. **Round 36 Phase 1, 2026-08-27: the catalog this row describes now exists, as `base_cost_batches`, though not under this name or this shape** - see the Base Cost Data entry in Deferred scope for what was built and why a batch is per product. **One claim here is corrected by that round:** "per-product extensibility is achieved by adding new payload fields per product" was measured at 445 hardcoded SafeSight/AQ/HEMIR references across seven files, in the calculator, both routes, both detail scripts and the markup. A fourth product is a code change whatever the catalog looks like, so the row-based shape buys admin maintenance rather than extensibility, and saying otherwise repeats the claim this same row already records as never having been true. |
| `system_defaults` | `key`, `value`. Singleton admin-configurable values, first entry `target_profitability_pct`. Generic key/value shape so future one-off settings don't each need their own table. |

**Corrected, Round 5 end-of-round documentation pass, 2026-08-17.** This paragraph previously read "A Deal Sheet is `record_type = 'deal'` with `parent_record_id` pointing at its Opportunity," describing it as its own persisted child record, the same pattern Deployment/Asset/Component genuinely use. Confirmed live during Round 5 Phase 6 (see that phase's own write-up further below) that this was never built: `record_type = 'deal'` appears nowhere in the schema or codebase, confirmed by grep.

**What actually exists:** a Deal Sheet is the Commercials tab on the Opportunity itself, a UI concept, not a separate record. Every input it reads and writes, SafeSight/AQ Sensor/HEMIR unit counts and unit costs, margin overrides, payment structure, installation responsibility, milestones, and so on, lives directly in the Opportunity's own `record_revisions.payload`, the same revision the Reference tab and every other Opportunity field already share, not a second document's payload. The calculation itself (`src/lib/deal-calculator.js`, called both from `src/routes/deals.js` server-side on submit and from `frontend/opportunity-deal.js` client-side for live preview) is loaded straight off that one payload via `loadDealInputsFromOpportunity()`, never from a separate record. The submitted/approved snapshot behaviour described in Section 5 (frozen once the proposal is submitted) is real, but it is a snapshot of the Opportunity's own Commercials payload at that moment, not of a distinct Deal Sheet row - there is nothing else to snapshot.

This also means the `product_defaults` table referenced above and in Section 6 was never built either, see that table's own corrected entry above for what the real engine reads instead. Section 6's own value-estimation description still describes this unbuilt `product_defaults`-driven flow and has not been reconciled to match reality here - a materially larger rewrite than this pass, flagged plainly, not undertaken now.

**Promoted fields on Opportunity, same exception as serial number and reference code:** `probability_pct` and `forecast_close_date` are real, indexed columns on the Opportunity record, not buried in the JSON payload, since pipeline forecast reporting (weighted and unweighted) will sum, filter, and group by both constantly. Parsing JSON for every report query would be the wrong trade-off here. Opportunity age and days-since-last-update need no new storage at all, both are just `today minus created_at` and `today minus updated_at`, computed at display time from fields the generic `records` table already has.

**Probability behaviour:** when an Opportunity's stage changes, `probability_pct` auto-populates from `stage_probability_defaults` for the new stage. Between stage changes, it's freely editable, a deliberate override for that specific Opportunity (a sales person's read that this one's better or worse odds than the stage average). The *next* stage change resets it to the new stage's default again, overrides don't silently persist forever and quietly stop reflecting what's actually normal for that stage.

**Probability governance:** only the Opportunity owner or a user holding `commercial_approver` on that specific Opportunity may change `probability_pct`. If the new value differs from the current stage default, a justification (free text, required, not optional) must be entered before the change saves, explaining why this Opportunity is being called better or worse odds than normal for its stage. The change, old value, new value, who made it, and the justification, is written to `audit_log` like any other action. In the UI, a probability that differs from its stage default is visually distinguished from one that matches it (a stronger border and an explicit "differs from stage default" label, not a new accent color, the brand system reserves its single accent for live states, not for flagging overrides).

**Pipeline forecast reporting (to build later, once Opportunity and probability exist):** unweighted pipeline = sum of deal value across open opportunities. Weighted pipeline = sum of (deal value × probability_pct) across open opportunities. Both need deal value, which lives directly in the Opportunity's own current `record_revisions.payload` today (the Commercials tab's own fields, not a separate Deal Sheet child record - **corrected, Round 5 end-of-round documentation pass, 2026-08-17**, see above), so this report can read the Opportunity's own current revision directly, no join to a separate document needed.

---

## 3. Non-negotiable rules

These apply to every module, present and future. If a new feature can't be built without breaking one of these, the feature needs rethinking, not the rule.

1. **Server-side recomputation.** Any calculated figure a decision gets made on (a Deal Sheet's margin, a corrective action's due date) is recomputed and verified server-side at submission time. Never trust client-submitted numbers for something an approval rests on.
2. **Immutable approved snapshots.** Once a record is approved, that revision is frozen. Further edits create a new revision, never an overwrite. History is permanent.
3. **Data-driven process rules, not hardcoded.** Chart of authority thresholds (`routing_rules`), stage-gate requirements (`stage_gate_rules`), and Contact-to-Opportunity conversion criteria (`conversion_criteria`) all live in the database, not in application code. Changing who approves what, what's required to progress a stage, or when a Contact qualifies, is a data edit, not a deploy. This is not a one-time setup, it stays open: a new required document, a new approval track, or an additional criterion for an existing gate is always just a new row in `stage_gate_rules`, added whenever the business needs it, months or years from now, not a schema change or a redeploy.
4. **One audit trail, one shape.** Every record type logs to the same `audit_log` table in the same format. A future compliance or audit view queries one table, not one per module.
5. **New modules extend, they don't fork.** Adding a new record type means adding a payload shape and, if needed, new routing rules, not duplicating the workflow, approval, or audit machinery.
6. **Forecasted revenue and cash flow are computed, not stored.** Pipeline forecasts (weighted and unweighted), cash flow projections, anything derived from current inputs, are calculated server-side at the moment they're requested, from whatever `product_defaults`, probability, and Deal Sheet figures are true right now. They are never written to a persistent field that could quietly drift out of sync with the inputs it was calculated from. The one deliberate exception is the audit snapshot: outputs are frozen and stored specifically at submission and at approval, per rule 2, so there is proof of what a decision-maker actually saw at that moment. That is a point-in-time record for audit purposes, not a live cache, and it should never be read back as if it were the current forecast.
7. **List views are card rows, not dense tables, from the first draft.** Every record list (Leads, Opportunities, and anything added later, including Commercials sub-tabs that list rows of data) uses the `.record-card` / `.record-list` pattern in `frontend/style.css`: a bordered card per row, primary label plus status on line one, secondary context (company, source, etc.) pushed to a dimmed mono second line rather than a separate column, stats anchored right. Where a column header earns its keep (Opportunities' Stage/Probability/Age/Close), header and rows share one `.record-grid-head` / `.record-grid-row` grid template so the right-hand tracks are fixed px widths, never bare `1fr`. This is a first-pass requirement, not a follow-up visual polish task, apply it when a screen is built, not after.
8. **Extract from the prototype before building, don't compare after.** `Terminus_Ops_dc.html` encodes real, deliberate product decisions, layout, grouping, orientation, what's conditional, what recalculates live versus needs an explicit save, worked out through real usage, not just visual style. A general instruction to "use the prototype as reference" is not sufficient and has already caused rework twice: the Leads/Opportunities list views were first built as plain tables with no card structure, and the Commercials cash flow table was first built with months as rows instead of the prototype's actual layout, months as column headers, categories as rows (`buildOppDetail`'s `cashflow` section, `Terminus_Ops_dc.html` lines 6719 to 6755). Before building any screen or component with a prototype equivalent, find and read its actual rendering logic first, cite the section and line numbers, and write a short plain-language spec of the real layout and interaction decisions, not just code, as its own step before implementation begins. Treat this the same as the deal-calculator extraction, which worked precisely because it cited exact lines and verified against them, not because it was told to "use the prototype as reference" in general.

    **This rule is forward-looking only as written, "before building," and that gap is real, not theoretical.** A third occurrence surfaced it directly: the Leads screen, built before Contact/Account existed, still carried direct-to-Opportunity/Test-Bed convert buttons and detail-page text describing a Lead-to-Contact conversion, "qualifying creates the contact and closes the lead," neither matching the model actually confirmed and built in Section 2. Nothing in this rule as written prompts a check of already-built screens against the prototype, or against later decisions that supersede assumptions those screens were built on, it only fires when explicitly invoked for something new. **Any existing screen not yet through a cited extraction pass is not considered finished, regardless of how long it's been shipped or how many times it's been visually confirmed correct.** A visual confirmation (a screenshot looking right) checks styling, it does not check whether the underlying data model or workflow the screen assumes is still the current one. Periodically, and whenever a data-model decision changes (as Contact/Account's did), audit already-built screens against both the prototype's actual rendering logic and the current state of this document, not just against each other.
9. **Never infer a record's state, or the success or safety of a cleanup step, from an error message's content or a status code, query the actual field.** This governs more than teardown scripts: any time a claim gets made that a row was deleted, is safe to leave, or is in some other state, that claim rests on directly querying the field that proves it (`deleted_at`, `status`, an affected-row count), not on the plausible-sounding story an adjacent error or response code seems to tell. Real-interaction verification (real Supabase sessions, real routes, real fixtures) is this project's standard, and that means fixture cleanup is a real database operation with real failure modes, not a formality to fire-and-forget, and a status code is a claim about one specific operation, not a proof about the row's overall state. **Found the hard way (2026-08-13):** a verification script reused a real, non-fixture Contact (John Wong) as its test subject rather than a disposable one, linked it to a throwaway test Account, then a later script's teardown ran a plain `.delete()` against that Account's `records` row without checking the result. The delete was silently blocked by a foreign-key constraint, since John Wong's own `parent_record_id` still referenced it, but the same teardown's unguarded deletes against `record_revisions` and `audit_log` for that Account succeeded first, since nothing else referenced those rows. The net result: a real Contact left pointing at an orphaned, revision-less Account, `--` in the UI where a real link should have been, indistinguishable from a genuine qualification-gate bypass until traced through `audit_log` by hand. **Found the hard way again (2026-08-14), same root cause in a narrower form:** a Puppeteer verification session tried to hard-delete a throwaway test Account after a run, got a foreign-key constraint error naming a still-linked contact, and from that error's content alone concluded the contact (and so the Account) must already be soft-deleted, reporting the leftover row as "harmless, invisible in normal lists" without ever querying its `deleted_at`. It was `null`, a live, undeleted row, and because this schema's read policy on `records` is team-wide, not owner-scoped (`supabase/migrations/20260812000004_team_wide_read.sql`), it was visible in the real Account picker to every user in the org, not confined to the test session that created it. The user caught it by asking for direct confirmation before accepting "harmless." Three things follow, all required, not just one: (a) a teardown script checks every delete's returned `error` (or affected-row count for an `.update()`) and throws or logs loudly on any failure, it does not print a fixture ID as "torn down" without confirming the row is actually gone; (b) verification scripts create their own uniquely-tagged, disposable fixtures (matching the `runTag = Date.now()` pattern already used throughout this project's verification scripts) rather than reusing a real, already-existing record as a convenient test subject, precisely because a real record can end up on the wrong end of some other script's foreign-key relationship in a way a fresh fixture never will; (c) when a delete is blocked or skipped for any reason, its target's actual current state gets queried and reported before any claim of "already handled" or "harmless" is made, an error's wording is a hint to investigate, never a substitute for checking the row.
10. **Every note entry, anywhere in the app, displays as timestamp, then author, then note text, in that order.** This is the `.ref-notes-row` / `.ref-notes-when` / `.ref-notes-text` pattern (`style.css`) already shared by Contact/Lead detail's Notes History, the Leads list card's own notes, and Opportunity's Reference tab Notes - a genuinely reused convention, not three separate implementations that happen to look similar, so a change to the order belongs in that shared CSS/markup pattern, not patched per screen. Audited 2026-08-14: all three current locations already comply, confirmed by reading each one's actual template rather than assuming from the shared class names. New note displays, whenever built, extend this pattern rather than inventing their own ordering.

11. **Where a behaviour has to hold for every call site, make it the default and make the exception declare itself.** Round 12 Phase 1 (2026-08-20). `loadTestBedDetail` reset the Test Bed detail page's open tab on every call, and twelve of its thirteen call sites are in-app saves rather than navigations, so every save ejected the operator back to Reference from whatever panel they were working in. Round 8 Phase 1 recorded six of those paths and left them for a product decision; Round 11 added four more without the question being reopened; Round 10 Phase 6 fixed the transition path alone. The business reported two, which are simply the two they happened to try.

    The obvious repair is to pass "do not reset" from each save. That repair is wrong in a specific, repeatable way: it is complete only for the call sites that exist when it is written, and the next round's new save inherits the old fault silently, which is the same shape as build-discipline rule 6 in `CLAUDE.md`, now at four confirmed instances. The repair taken instead inverts the default. Preserving the tab is what happens unless something explicitly declares a fresh arrival, and exactly one place declares it: `navigate()`. A save added in a later round is correct without its author knowing this decision was ever made, and a new arrival path is a single visible line rather than a silent omission.

    **The test for whether this applies: ask what a new call site gets if its author knows nothing about the rule.** If the answer is the broken behaviour, the default is the wrong way round. Two costs, both accepted and stated rather than discovered later. A genuinely new arrival that forgets to declare itself keeps the previous record's tab, which is visible and minor, where the old failure was invisible and constant. And the flag has to be consumed where nothing can skip it: consuming it in the renderer leaves it set when the load's own GET fails early, so the next save reads as an arrival, which is the original fault reintroduced through its own fix. Proven by injecting that variant and watching a save after a failed navigation jump to Reference, then reverting.

---

## 4. Honest scope note

Software that supports traceability, controlled approval, and documented decisions is a *foundation* for ISO 9001 and similar management-practice frameworks. It is not certification by itself, certification is an organisational commitment (procedures, internal audits, management review) that this system can support with evidence, not replace. Worth keeping that distinction explicit as the system grows, so it's never mistaken for the whole job.

---

## 5. Sales opportunity stage gates in detail

> **PARTIALLY SUPERSEDED, 2026-08-22, by `OPPORTUNITY_DESIGN.md` v1.1.**
> The six-stage model below (Discovery, Qualified, Proposal, Evaluation,
> Negotiation, Closing) is replaced by four working stages and two
> terminal states. Read `OPPORTUNITY_DESIGN.md` before building any
> Opportunity stage gate. The reasoning below is retained rather than
> deleted because three of its statements still govern.
>
> **What still stands, unchanged:**
>
> - **Approvals have no required order between tracks.** All required
>   tracks must be satisfied, in parallel, whoever is ready first. An
>   earlier draft of `OPPORTUNITY_DESIGN.md` proposed an ordered
>   sequence at Negotiating and that proposal has been withdrawn.
>   Ordering is not expressible in `stage_gate_rules`, and more
>   importantly it was a decision taken here and should not have been
>   reversed silently.
> - **Every new or revised commercial document requires approval before
>   being sent**, as a document-level gate rather than an
>   Opportunity-stage gate. This is a standing control and it is at risk:
>   the four-stage compression turns Evaluation and Negotiation into one
>   stage whose approvals fire on exit, which would let a re-priced
>   proposal reach a client unapproved. Recorded as an unresolved gap in
>   `OPPORTUNITY_DESIGN.md`.
> - **The Deal Sheet freezes when the proposal is approved for
>   submission**, which is the natural application of the immutable
>   approved snapshot principle. The transition it was named against,
>   Proposal to Evaluation, no longer exists. The principle stands and
>   the transition needs renaming.
>
> **What has been confirmed since:**
>
> - **Bid/No Bid is an approval at the gate into Proposal.** This
>   section flagged that placement as an assumption for confirmation.
>   The business confirmed it on 2026-08-22. What a rejection means,
>   block versus auto-close, remains undecided.
>
> **What is still true and still broken:** `routing_rules` was flagged
> empty in the Milestone 2 audit below. It holds **0 rows today**,
> confirmed at commit `dd7459a`. The tiered Commercial escalation
> described in this section, and still described on the
> `approval_tracks.Commercial` row, has never worked. Opportunity is the
> record type it was designed for.

**This section describes Opportunity, Discovery through Closing.** Test Bed is a genuinely separate record type with its own lifecycle, Planning through Closed, see Section 8. The gate mechanics below (configurable tracks, no required order) apply equally to both, this is one engine used by two different record types, not two engines.

**Every stage gate has a configurable set of required approvals, not a fixed number:**

Legal, Commercial, Sales, Technical, Finance, or whatever gets defined later, admins set which tracks a given gate requires via `stage_gate_rules` and `approval_tracks`, this is not hardcoded to two. **All** required tracks must be satisfied before the transition is allowed, and **there is no required order between them**, they're requested and can be completed in parallel, whoever's needed can approve whenever they're ready, not queued behind each other.

Each individual approval is a tick box (`decision = approved` or `rejected`), timestamped (`decided_at`), with a comment field, expected in particular when an approver rejects, so the person who owns the record knows what to fix.

For the two tracks already concretely needed, Commercial (Sales/line management, escalating tier based on conditions like discount %, via `routing_rules`) and Technical (a Technical Authority nominated per-opportunity, e.g. the CTO, via `roles`), the mechanics work as described below, this is the *current* concrete requirement, not a ceiling on how many tracks a gate can have. **Flagged, Milestone 2 audit, this session, not yet verified either way:** `routing_rules` was found completely empty, for every record type, while checking Test Bed's own gate. If Opportunity's Commercial track genuinely depends on live `routing_rules` rows to compute its escalation tier, it cannot currently be doing what this paragraph describes. This needs checking directly against Opportunity's own gate-check code before assuming it still works, don't take this paragraph's word for it, it was written before the empty table was discovered.

**What gates each transition:**

| Transition | Requirement |
|---|---|
| Discovery or Qualified → Proposal | Terms & Conditions confirmed (the basis the eventual contract will sit under, must exist before a formal proposal is produced, checked regardless of which of the two stages it was confirmed in). A Bid/No-Bid decision, approved, is also required here, to confirm continued investment before proposal effort begins. Approval required from Commercial and Technical tracks (more can be added, e.g. Legal, without changing how the engine works). |
| Proposal → Evaluation ("Proposal Submitted") | The proposal itself (built on the Deal Sheet) must be approved across all required tracks before it can be sent. The Deal Sheet is effectively frozen at this point, this is the natural point the "immutable approved snapshot" principle applies to it. |
| Within Evaluation | The client may request clarifications, which can produce new documents or revisions to commercial documents. **Every** new or updated commercial document requires approval before being sent, this is a document-level gate (the document's own `Draft → Approved → Sent` progression), not an Opportunity-stage gate, same `stage_gate_rules` engine, just scoped to `record_type = 'deal'` or whichever document type, rather than to the Opportunity itself. |
| Evaluation → Negotiation, and through Negotiation | Commercial issues (T&Cs, pricing) get resolved here. Same configurable-track approval requirement applies to whatever gets agreed. |
| → Closing | Standard required-track approval, as above. |

**Assumption flagged for confirmation, not decided unilaterally:** the Bid/No-Bid gate is placed at Qualified → Proposal, since that's the point real sales and technical effort starts getting invested in a formal proposal. If it's meant to sit at a different point (e.g. right after Discovery, before Qualification effort itself), that's a one-line change to `stage_gate_rules`, not a schema change, but worth confirming rather than assuming.

---

## 6. Opportunity value estimation, before a Deal Sheet exists

> **UNBUILT, AND THE GAP IS A CONTROL GAP RATHER THAN A DOCUMENTATION
> GAP. Recorded 2026-08-22.**
>
> Everything below assumes `product_defaults` and `system_defaults`
> supply unit, mounting and hosting costs. **Neither table exists.** The
> Deferred scope entry for Base Cost Data in this document says so
> directly: the cost lines are a stopgap, held as freely editable
> payload fields on the Opportunity record itself, which
> `SALESPERSON_WRITABLE_KEYS` confirms.
>
> **The consequence is not that this section is out of date.** It is
> that every Opportunity carries its own private cost basis and nothing
> compares them. Two deals priced in the same week can use different
> hardware costs, and the Commercial approval is computed against
> whatever the salesperson typed. The Round 17A Phase 6 rule guarantees
> one calculation path. It does not guarantee one set of inputs.
>
> This matters more from the moment Bid/No Bid and the Proposal gate
> make Commercial approval load-bearing on Opportunity.
>
> **Not scheduled, and not a reason to stop.** Recorded so that the next
> person to reach for this section knows they are reading a design for
> something unbuilt, and so the gap is owned rather than rediscovered.
> Reconciling it is the first thing any commercial-model work has to do.

The sales owner shouldn't need a completed Deal Sheet just to see a ballpark contract value early in the sales cycle. At the Opportunity level, they enter four numbers only:

- Total SafeSight(TM) units
- Total AQ Sensor units
- How many of those SafeSight units need new infrastructure mounting (the rest are assumed existing infrastructure)
- Contract term length (months)

Everything else comes from `product_defaults` and `system_defaults`, computed automatically:

```
hardware cost = (SafeSight units x SafeSight unit cost)
              + (AQ Sensor units x AQ Sensor unit cost)
              + (new mount count x SafeSight mount cost, new infrastructure)
              + ((SafeSight units - new mount count) x SafeSight mount cost, existing infrastructure)
              + (AQ Sensor units x AQ Sensor mount cost)

hosting cost (monthly) = (SafeSight units x SafeSight hosting default)
                        + (AQ Sensor units x AQ Sensor hosting default)

total cost = hardware cost + (hosting cost monthly x contract term months)

estimated contract value = total cost / (1 - target_profitability_pct / 100)
```

This is still an order-of-magnitude estimate, no payment structure, no factoring, those still need a real Deal Sheet, but it now covers the full lifetime cost of the deal (hardware plus hosting over the term), not just hardware. When a Deal Sheet is created under an Opportunity, it inherits the Opportunity's unit counts, term length, and the current `product_defaults`, unit cost, mounting cost, and hosting cost, as its starting inputs, then the sales owner refines specific numbers from there, actual quotes, negotiated rates, and so on, exactly as the standalone calculator already works today.

**`hosting_cost_default` is a known, deliberate placeholder.** It's a flat monthly rate per unit, the same simple model as unit and mounting cost. The real hosting cost will likely depend on which features a client actually uses and their data retention policy, a more accurate, usage-based model that hasn't been designed yet. Don't build that model speculatively now, since it isn't figured out, but don't let the flat-rate placeholder get treated as a permanent design decision either, it's a stand-in until the real pricing logic exists.

**HEMIR, and any future product, extends this for free.** Because `product_defaults` is row-based rather than hardcoded SafeSight/AQ Sensor columns, adding HEMIR later means inserting a new row with its own unit, mounting, and hosting costs, not a schema change or new code path.

**Deal Sheet installation cost flexibility:** the likely use of a third-party installation contractor means the Deal Sheet needs to handle two different pricing realities, a per-unit mounting cost (the existing `mount_cost_new` / `mount_cost_existing` model), or a single fixed lump sum quoted by a contractor for the whole installation job. This should be a choice on the Deal Sheet itself, `installation_cost_model = 'per_unit' | 'contractor_lump_sum'`, where selecting lump sum replaces the calculated installation total with a single entered figure, rather than trying to force a contractor's flat quote into a per-unit rate that doesn't actually reflect how they priced it.

### Test bed and pilot costing

Two different activities, the same underlying cost formula. **Test Bed** (`record_type = 'test_bed'`) is its own top-level record, an R&D engagement, pure cost, no revenue. **Pilot** (`record_type = 'pilot'`) is the pre-rollout phase inside an Opportunity, typically during Discovery, a precursor to the wider sale. Both compute cost identically, against their own smaller unit counts and their own duration, not the eventual full deployment's numbers:

```
cost = (as the Section 6 formula above, using this record's own unit counts,
        typically far fewer than a full rollout)
     + (hosting cost, using this record's own unit counts) x its own duration (months)
```

For a **Test Bed**, this is the number that answers "what is this costing the business", a pure cost with no revenue, useful for R&D budget tracking. It has its own client organisation directly, per Section 8, no revenue attached, and no Opportunity involved unless and until it converts to one.

For a **Pilot**, this cost isn't just informational, it's a real cost of winning that specific Opportunity, and needs to reduce its Deal Sheet's actual profitability, not sit off to the side as a separate, invisible number. Concretely:

- The Commercial Opportunity (or its Deal Sheet) carries a `requires_pilot` flag, and if true, links to the Pilot child record that holds its own unit counts and duration.
- The Deal Sheet's profitability calculation adds `pilot cost` as an explicit cost line, reducing net profit and margin for that deal, alongside the existing hardware and hosting costs already modelled there.
- The Deal Sheet's cash flow should reflect the pilot's cost landing *before* the main deployment's cash flow begins, since the pilot genuinely happens earlier in the sales cycle (during Discovery, per Section 8), it is not spent at the same time as the rest of the deal.

## 7. Product capability catalog, use case selection, and performance tracking

Terminus's functional capabilities, what a deployment or test bed actually *does*, are organised as a catalog, not hardcoded into a screen or a document. This is deliberately built on the same generic records engine as everything else, not a separate product-catalog subsystem, for the same reason Expense and Timesheet were used earlier to validate the model holds outside sales: it gives the catalog draft, review, and published workflow (a use case shouldn't be quotable to a client until it's actually been reviewed, these are measurable, specific commercial claims) and a full audit trail (who changed a success criterion's target, and when) for free.

**Capability** (`record_type = 'capability'`), e.g. People Intelligence, Vehicle Intelligence, Perimeter and Boundary Intelligence, Object Presence and Compliance Detection, Airspace and Counter-UAS Intelligence, Environmental and Infrastructure Condition Monitoring, Evidence, Analytics and Resource Optimisation (cross-cutting, flagged `is_cross_cutting`), and Integration Requirements (APIs). This list is a starting point, not a fixed set, a new Capability is a new record, not a code change.

**Use Case** (`record_type = 'use_case'`, `parent_record_id` = its Capability), e.g. Multi-Modal Vehicle Classification under Vehicle Intelligence. Payload holds:
- `objective`, what the capability is meant to achieve and why it matters to the client
- `problem_addressed`, the gap or limitation this closes
- `availability_status`: `available` | `in_development` | `roadmap`, so a sales conversation never proposes something as ready when it isn't, or can knowingly position something as a roadmap item

**Success Criterion** (`record_type = 'success_criterion'`, `parent_record_id` = its Use Case), one record per measurable outcome (e.g. "Vehicle classification accuracy 95% or higher across all vehicle classes, in all conditions"), kept individually addressable rather than bundled into one text block, specifically so a single criterion can be measured against on its own later, not just referenced as part of an undifferentiated list.

### Selecting use cases for an Opportunity, Test Bed, Pilot, or Deployment

A plain relational join, `record_use_cases`: `record_id` (the Opportunity, Test Bed, Pilot, or Deployment), `use_case_id`, `selected_by`, `selected_at`. This is not itself a generic record with its own workflow, a selection is a fact, not something that needs approving in its own right, not everything belongs on the full engine.

### Auto-generating the client-facing scope document

The actual sales-facing goal: a sales person selects use cases for an Opportunity, and the system compiles their objectives, problem statements, and success criteria into a document automatically, rather than someone retyping them by hand. Two things worth building deliberately, not assuming:

- The compiled document should be its own record (`record_type = 'solution_scope'`, child of the Opportunity), snapshotted at generation time, per the immutable-snapshot principle already established (rule 2). If the catalog's wording or a success criterion's target changes later, a document already sent to a client should still show exactly what was sent, not silently update to reflect today's catalog.
- Generating the document is a rendering step over the current selection, the underlying data lives in `record_use_cases`, the generated artifact is a frozen copy of what that produced at that moment, not a live view.

### Tracking test bed and deployment performance against success criteria

This is why success criteria are their own addressable records rather than a paragraph of text: a `performance_result` record (`record_type = 'performance_result'`, `parent_record_id` = the Test Bed, Pilot, or Deployment being measured) references a specific `success_criterion_id` and holds the actual measured value, who measured it, and when. Over time, this answers "how close are we to actually meeting this specific claim, across every test bed that's tried it", a genuine capability-maturity view, not just a sales promise nobody ever verified.

## 8. Deployment types and asset tracking

Camera (SafeSight(TM)) and sensor (AQ Sensor) deployments trace back to three scenarios. Two of them, Pilot and Commercial Deployment, are children of an Opportunity. The third, Test Bed, is not, it's its own top-level record type, per the decision in Section 2:

| Scenario | Billing | Anchor | Notes |
|---|---|---|---|
| Test Bed | Cost to business, no client billing | `record_type = 'test_bed'`, top-level, its own record, not a child of Opportunity | Terminus-funded R&D engagement with a client, gathers real-world data for model development. Has its own Contacts, Documents, and reference code, same as Opportunity does. |
| Pilot | Tied to a commercial Opportunity | Child of Opportunity | Typically occurs during Discovery stage, short-term, precursor to a wider sale |
| Commercial Deployment | Revenue-generating, post-close | Child of Opportunity | Created when Opportunity reaches Closed/Won, rollout may be phased |

**Test Bed has its own stage lifecycle**, defined in `stage_definitions` for `record_type = 'test_bed'` (no variant needed, there is only one Test Bed lifecycle). **Flat, 8 stages, no sub-stage layer, corrected this session:**

1. Qualification
2. Pre-Site Assessment, gated by NDA reviewed
3. Site Assessment, gated by Site Assessment Report, Compliance and Data Protection, and Partnership and Test Bed Agreement, reviewed together, not sequentially
4. Installation and Commissioning, gated by Site Installation Document
5. Monitoring and Analysis, gated by Test Bed Review Document
6. Review and Completion, gated by Test Bed Review Document, the final customer meeting, going through the success criteria and driving next actions, including the decision on whether this converts to an Opportunity
7. Decommissioning
8. Closed

**Correction, replacing what this section previously said.** The prior version of this document described Planning as four sequential sub-stages (NDA, Site Assessment, Partnership and Test Bed Agreement, Compliance and Data Protection) under one grouped stage, with explicit UI guidance to show them as a secondary track beneath a single "Planning" step in the tracker, and called this "found in testing." That characterisation was checked against the actual sequence of work on this project: Opportunity was built first, specifically to develop the commercial calculations, and Test Bed had not yet been built or tested at the time this section was written. The four-sub-stage structure was intent recorded at documentation time, not a finding from testing a working Test Bed. It has been superseded by direct, line-cited extraction from the Claude Design prototype (`PROTOTYPE_SPECIFICATION.md` Section 6), confirmed against the real stage/sub-stage data structure, which showed the two-level split does nothing structurally the flat list doesn't already do equally well, docs, criteria, and approvals attach at the same level either way, and Opportunity already uses a single flat stage list with no equivalent second layer. The two-level structure had been built with an eye to future flexibility; that flexibility is being deliberately traded away here in favour of consistency with the rest of the system. If genuinely finer staging inside a phase is needed later, it can be added as new flat stages at that point, the same as any other stage addition.

Each stage above is gated the same way any other transition is, `stage_gate_rules` requiring the named document(s) reviewed before moving to the next, no new mechanism, just rows in the same table. **Document requirements per stage are already configurable, this needs no new mechanism**: `stage_gate_rules` is admin-editable data, not hardcoded logic, so a Test Bed in a jurisdiction that needs an extra document is a new row, or a different `variant` value if the whole set needs to vary by location, the same table either way. **Documents and exit criteria per stage are informational only, they do not gate stage transition.** Only two things gate a Test Bed's stage transitions: configurable mandatory payload fields (e.g. Qualification's exit requires Duration, Estimated Installation Date, and Est Go Live Date) and configurable mandatory contact-role relationships (e.g. Qualification's exit also requires Client Commercial, Technical, and Legal Buyer each linked via `record_contacts` and validated against the Test Bed's own linked Account). A future backlog item may add real document-approval workflow tracking, not built now, since the Documents tab today is a deliberately honest empty state with no real document data source behind it, tracking approval status against nothing would not be trustworthy.

**Noted for later, not designed yet**: regular check-in meetings with the client during Monitoring and Analysis, weekly cadence suggested, the goal being to stay close to the customer, ideally with some automation around scheduling or reminders. How this actually gets organised in the UX is a separate conversation, deliberately deferred, not something to build speculatively now.

**SUPERSEDED IN FULL, Round 9 Phase 5.2, 2026-08-19. The paragraph below is kept verbatim because it was asserted here for three milestones and a reader who remembers it needs to see it struck rather than silently absent. What is actually configured now follows it.**

> **The final transition, Decommissioning to Closed, is gated more heavily than the rest of the lifecycle**, since closing out an R&D engagement is a bigger decision than moving between working stages. It is *designed* to require, via the same `stage_gate_rules` engine used everywhere else: every stage-gate document from the lifecycle actually reviewed (`child_record_status` requirements) and a senior-tier sign-off (`approval_obtained` with a higher tier than earlier approvals in the lifecycle, via `routing_rules`). **Corrected, Milestone 2 audit, this session:** the design is right, the claim that it was "the same mechanism already used elsewhere" was wrong, checked directly against `transitions.js`. `child_record_status` has no code branch at all, a `stage_gate_rules` row using it is a silent no-op today, confirmed live, it never blocks a transition. **That sentence is itself now superseded and is left standing only so the correction is legible, Round 9 Phase 2, 2026-08-19: Round 7 Phase 3.2 built the branch**, as a fifth branch in the same generic rule loop, and `scripts/tests/gates.test.mjs` now asserts it blocking, having deliberately inverted the assertion that had documented the hole. **The same paragraph is wrong on its other half too.** It describes this transition as requiring every lifecycle document reviewed via `child_record_status` requirements; Round 7 Phase 3.2 deleted those three rules from the live database and from `supabase/seeds/003_test_bed.sql` in the same change, because they named child record types (`nda`, `pdpa_assessment`, `dpia`) that do not exist and cannot be created, so they were unsatisfiable under every reading. Building the branch without removing them would have made Decommissioning to Closed impossible to complete. So as of Round 9 the only rule on this transition is the `Senior` approval, which Round 9 Phase 5.1 removes in turn. **Recorded because of how it was found, not only because it was wrong:** it surfaced in Round 9 Phase 0 as a disagreement between this document and the generated `CURRENT_STATE.md`, which is the exact case that file exists to expose. This document was right about what was intended and stale about what exists, and nothing in the two intervening rounds had cause to re-read this paragraph. `routing_rules` is not missing a Test Bed tier, it is **completely empty, for every record type**, including whatever Opportunity's own approval gating is supposed to use, this needs verifying separately, do not assume Opportunity's side works just because it's older. Neither is fixed here, both are real, open implementation gaps, not documentation gaps, tracked in `TESTBED_BUILD_BRIEF.md`.

**What is actually configured, measured from the live database at the close of Round 9 Phase 5, not intended:** the final transition, Decommissioning to Closed, requires the **Site Decommissioning Report** approved, plus **Technical, Commercial and Legal** approvals, every one of them `scope: "stage"`. That is the **identical** gate to Review and Completion to Decommissioning, and to Monitoring and Analysis to Review and Completion apart from the latter's extra criterion and second document. **So the claim that the final transition is gated more heavily than the rest of the lifecycle is no longer true, and this is the first round in which the intent and the configuration can be reconciled at all.** The `approval_obtained {"track": "Senior"}` rule was deleted from the live database and from `supabase/seeds/003_test_bed.sql` in the same change, and no rule anywhere in any record type now names the `Senior` track, confirmed by direct query over all 54 `stage_gate_rules` rows.

**Three things worth stating precisely, because each corrects something this section previously implied.**

**1. `Senior` was a real track, not a phantom.** Round 9 Phase 0 was asked to check whether it was a string no approval could ever be recorded against, which would have made the only heavier-gate mechanism the design described a fiction. It was not. `approval_tracks` holds a genuine `Senior` row, described as "Senior-tier sign-off, required for Test Bed closure. Tier to be defined when routing_rules is built." The rule genuinely blocked, and the track was genuinely tickable once a record reached Decommissioning. Zero approvals were ever recorded against it, but that is a fact about a lifecycle no record had completed, not about the mechanism.

**2. The tier half is what was never backed, and it is now referenced by nothing.** `routing_rules` has held zero rows since the schema was created, in every record type, so the escalation this section described, computing *which* tier within a track is required, never had data behind it. The `approval_obtained` branch only ever asked whether an approved decision existed for a track; it has no concept of tier at all. **With the Senior rule gone, `routing_rules` is now referenced by nothing anywhere in the system**: no gate rule, no route, no frontend path. It is an empty table with no consumer, and it should be treated as unbuilt design rather than as configuration awaiting rows.

**3. The `Senior` row stays in `approval_tracks`, deliberately, now unreferenced.** `approval_tracks` is an admin-managed vocabulary, and deleting a row from it to tidy up after removing its only consumer would discard a business decision rather than a dead reference. The tier concept may return, and if it does, the track it attaches to is already named. `Finance` sits in the same position and always has, referenced by no rule in any record type. **The general point: an unreferenced vocabulary row is not the same thing as dead data, and the automated invariant added in Round 9 Phase 7 is deliberately written in one direction only, that no rule may name a track absent from `approval_tracks`, never the reverse.**

**Closed here means the end of all site activity for this Test Bed, decommissioning complete, nothing further happens on site.** This is the opposite direction to what Closed/Closing means for Opportunity, where it marks a signed contract and the start of deployment and site activity. Same word, deliberately different meaning per record type, do not conflate the two when building gate logic or reporting.

**Test Bed can convert to Opportunity at any point in its lifecycle, not only at Decommissioning. Confirmed in scope for this build.** This is a genuine cross-record-type conversion, the same mechanism as Contact to Opportunity, a `conversion_criteria` row with `from_record_type = 'test_bed'`, `to_record_type = 'opportunity'`. A new Opportunity record is created, referencing the Test Bed it came from (`converted_from_test_bed_id`), the Test Bed record itself is not mutated in place, it remains the historical record of the R&D work. The Test Bed's accumulated cost carries across and attaches to the new Opportunity's eventual Deal Sheet as a cost line, the same treatment Pilot cost already gets, a real cost of winning this deal, not something to lose on conversion. The reference code carries over unchanged on conversion, not redrawn, see Section 9.

A Test Bed or Pilot record carries its own unit counts (SafeSight, AQ Sensor, and later HEMIR) and its own duration in months, independent of whatever the eventual full deployment's numbers turn out to be, proving the technology with 5 units for 2 months is a different, smaller thing than the 200-unit rollout it might lead to. Cost is computed the same way as the Opportunity-level estimate in Section 6, against these smaller numbers, see the test bed and pilot costing subsection there for how a Pilot's cost feeds into the Deal Sheet's profitability specifically.

### Assets and components

A deployed unit is `record_type = 'asset'`, child of a **Deployment** record (not directly of the Opportunity, see the corrected hierarchy in Section 2), with a `product_type` field (SafeSight, AQ Sensor, future products) rather than hardcoding a camera-specific type. Its physical components, sensor, onboard compute chip, others, are their own records with `parent_record_id` pointing at the asset. This reuses the same parent-child pattern as Opportunity → Deal Sheet, no new mechanism needed, a genuine validation that the generic model holds up outside the sales domain.

**Exception to "generic payload, no dedicated columns":** serial number needs to be a real, indexed, unique database column, not buried in JSON. It will be queried constantly (warranty lookups, component tracing) and uniqueness must be enforced by the database, not by convention. The same likely applies to the reference code below. Generic-by-default is the rule, not a religion, fields with real integrity or performance requirements get real columns.

Each asset also needs: latitude/longitude at deployment, date of manufacture, and a full history log (manufacture, shipment, installation, relocation, service events, warranty claims), the existing `audit_log` table covers this if asset lifecycle events are logged there like any other action.

### Stage gates (supersedes the earlier "document-gates-deployment" idea)

A camera cannot go live until prerequisite documents reach the right status, an NDA signed before any unit is placed on site, and for test beds, a PDPA assessment and Data Protection Impact Assessment completed. An Opportunity can't move from Negotiation to Closing without its Deal Sheet approved. A Contact doesn't convert to an Opportunity without meeting defined criteria. These are all the same underlying need, expressed generically as `stage_gate_rules` and `conversion_criteria` in the schema above, one configurable engine, not a hand-built check per rule, and not something rebuilt narrowly for cameras and then rebuilt again for the next thing that needs a gate.

### Reference code

**Superseded by Section 9 below.** This paragraph described an earlier format, `CCC-Type-Application-NNN`, left over from an earlier draft and never reconciled with Section 9's `TT-CCC-INDUST-XXX`, which is the format actually confirmed against the live prototype and current build. Section 9 is authoritative, this paragraph is kept only so the correction is visible rather than silently deleted.

## 9. Reference codes

Every Opportunity and Test Bed gets exactly one, once-only, internal reference code, assigned automatically at creation, never reassigned, never edited by a user.

**Format:** `TT-CCC-INDUST-XXX`

- `TT`: fixed prefix.
- `CCC`: country code, derived automatically from the customer's country field on the record, not a separate manual selection.
- `INDUST`: 6-character industry short code, matching the Industry picklist (Taxonomy, Section 7), admin-configurable there, not hardcoded here.
- `XXX`: incremental counter within each country-industry group, starting at 3 digits (`001`), never resets, grows past 999 by adding digits (`0999` → `1000`) rather than wrapping or resetting.

**The counter is shared across Opportunities and Test Beds within the same country-industry group, but more importantly, the code itself is a single, persistent identity, not just a shared numbering pool.** Test Bed can convert to Opportunity (Section 8's Close out Review decision) and Opportunity can have an associated Test Bed or pilot. When that conversion happens, **the reference code carries over unchanged**, it is not redrawn. The same real-world engagement keeps the same reference for its whole lifecycle, across a type change, exactly the way `stage_gate_rules` already carries the Test Bed to Opportunity conversion as one mechanism, not two (Section 10, Build order, item 5).

**Built and verified.** Was flagged not yet built during the Reference tab
(B1) build, where the strip correctly showed "Not yet generated" rather
than a fabricated code, matching Rule 8's discipline. Now built as
`reference_number_counters`, a counter table keyed by `(country_code,
industry_code)`, incremented atomically via `INSERT ... ON CONFLICT ... DO
UPDATE ... RETURNING` inside a `SECURITY DEFINER` function
(`issue_reference_number()`), not a client-side or naive read-then-write
counter. Confirmed atomic under real concurrency (25 genuinely concurrent
calls through a real signed-in user's client, zero duplicates, contiguous
sequence).

**Real bug found and fixed during boundary testing, not by the initial
build.** The first version silently truncated every reference from 1000
upward: Postgres's `lpad(string, length, fill)` doesn't only pad short
strings, it also truncates strings already longer than the target length,
so `lpad('1000', 3, '0')` returned `'100'`, not `'1000'`, directly
violating this section's own "grows past 999 by adding digits rather than
wrapping or resetting" rule. Not caught by the original 1-25 concurrency
test, only surfaced when the 999→1000 boundary was tested explicitly.
Fixed in a follow-up migration, confirmed 999→1000→1001 correct, and
confirmed the fix didn't affect the atomic increment itself, a separate
re-test of the transactional core after the formatting fix, not assumed
safe because the fix "only touched formatting". Same discipline as the
`stage_definitions` invariant elsewhere in this document, real bugs get
recorded here, not silently fixed and forgotten.

**Known, unresolved, added to Deferred scope below**: a rare, unreproduced
"JWT issued in the future" rejection was observed once from Supabase's own
auth/API layer during testing, not from anything in this project's code.
Investigated (ruled out local clock skew, ruled out project code, 200
further attempts across 8 rounds produced zero recurrence). Cause
unconfirmed, cannot be ruled out as something a real production user could
also hit, since the validation layer involved is the same one any real
caller's JWT passes through. Not fixed, since it isn't reliably
reproducible, a defensive retry is the likely eventual fix if it's ever
seen in production.

### Account Number, a second numbering scheme on the same generator

**Built, Round 4 Phase 2, 2026-08-17.** A separate, per-Account identifier,
distinct from the `TT-CCC-INDUST-XXX` reference code above (that one is
Opportunity/Test Bed only, keyed by industry - Account has no industry
concept of its own the way a sales engagement does).

**Format:** `TT-{country code}-{name prefix}-{number}`, e.g.
`TT-GBR-WILLOWGLEN-001`. Same visible shape as the reference code
(3-letter country, a second segment, a counter starting at 3 digits and
growing past 999 by adding digits, never resetting or reusing), because it
reuses the exact same `issue_reference_number()` atomic core, not a second
implementation.

**Sanitisation rule for the name prefix**, confirmed against worked
examples before building: strip everything except letters and digits (all
punctuation and whitespace), uppercase what's left, take the first 10
characters.
- `"Willowglen Pte Ltd"` → `WILLOWGLEN`
- `"AT&T"` → `ATT`
- `"O'Brien's Ltd"` → `OBRIENSLTD`

Implemented as `sanitizeAccountNamePrefix()` /
`issueAccountNumber(db, countryCode, accountName)` in
`src/lib/reference-number.js`, alongside the original
`issueReferenceNumber()`.

**Namespaced internally so it can never share or collide with the
industry-code keyspace, confirmed with a real exact-match test, not just
reasoned about.** Investigated before building (Round 4 Phase 1): a
company whose sanitised name happens to exactly equal a real, live
industry `short_code` (e.g. an Account literally named "Smartc", which
sanitises to `SMARTC`, the real Smart Cities industry code) would, without
a fix, draw from and advance the *same* counter row as that country's real
Smart-City Opportunity/Test Bed reference numbers - not a coincidence, a
genuinely shared, interleaved sequence, since both would resolve to the
identical `reference_number_counters.prefix` value (`GBR-SMARTC`).
`issue_reference_number()` gained a third parameter, `p_scheme`
(`supabase/migrations/20260817000000_reference_number_scheme_namespace.sql`),
which folds a discriminator into the counter table's own key only, never
into the returned string: `NULL`/`'industry'` (the default) reproduces the
exact unprefixed key every pre-existing caller already used, required for
continuity with already-issued reference codes, not a stylistic choice;
any other value (`'account'`, the only other scheme that exists today) gets
a namespaced key (`account:GBR-SMARTC`) that cannot coincide with the
industry keyspace by construction, not by naming-convention luck. Verified
live: an Account literally named `"Smartc"` in GBR issued
`TT-GBR-SMARTC-001` (its own sequence, starting at 1) while a real GBR
Smart-City reference code issued immediately after correctly continued the
real industry sequence unaffected (5→6) - confirmed by querying both
counter rows directly before and after, not inferred from the returned
strings alone.

**A real bug found and fixed while proving backward compatibility, not by
the initial build.** The first version of the `p_scheme` migration used
`create or replace function` to add the third parameter directly to the
existing two-argument function. This does not do what it looks like it
does: Postgres only replaces a function via `CREATE OR REPLACE` when the
parameter *types* match exactly; adding a parameter creates a second,
additional overload instead, leaving the original two-argument function
live alongside it. The very next real two-argument call (the exact shape
every existing Opportunity/Test Bed creation path already uses) then
failed outright - PostgREST could not choose between the two candidate
functions, confirmed live via a direct RPC call returning `null` with
Postgres's own "could not choose the best candidate function" error. This
would have broken every real Opportunity and Test Bed creation the moment
it shipped, not a theoretical risk. Fixed by explicitly dropping the stale
two-argument overload
(`20260817000001_fix_reference_number_overload_ambiguity.sql`), leaving
exactly one `issue_reference_number` function. Re-verified after the fix:
a real two-argument call for an already-live prefix (`GBR-AIRPRT`)
correctly continued that prefix's real sequence (15→16), not reset to 1 -
the specific failure mode this whole `p_scheme` change was built to avoid
introducing.

### Account Details panel

**Built, Round 4 Phase 3, 2026-08-17.** New fields on Account, following
the same generic records/payload pattern used everywhere else: Account
Number (system-generated per the scheme above, never user-entered), Account
Name (only required field), Terminus Lead (Account-level relationship,
"the person who manages the account," sourced from `terminus_staff`,
deliberately distinct from the per-engagement Terminus Lead field that
already exists on Test Bed/Opportunity - same label, two different
relationships, not shared), Billing Address and Shipping Address (each the
same structured shape as Contact's own Address panel: line 1/2, city,
postcode, country, region - not a single free-text block), Website URL,
Created Date (system-populated), and Parent Account (optional, single
level, a genuine link to another Account, not an overload of
`parent_record_id`).

**Parent Account is a new, dedicated `parent_account_id` column**
(`supabase/migrations/20260817000002_account_parent_account_id.sql`), a
nullable self-referencing FK on `records`. Deliberately not built on
`parent_record_id`: that column already has one exclusive, established
meaning (Contact → Account) and overloading it with a second meaning
(Account → Account) would make the column ambiguous to read back -
precedent for "new relationship gets its own column" already set by
`account_id` on test_bed/opportunity.

**Circular-reference guard is application-layer, not a DB constraint** -
a two-node cycle (A's parent is B, B's parent is A) can't be expressed as
a single-row CHECK/FK. `validateParentAccountId()` in
`src/routes/accounts.js` rejects self-reference and the direct A↔B case by
checking the candidate parent's own `parent_account_id` before writing;
only accepts a real, non-deleted Account (`record_type = 'account'`,
`deleted_at is null`). Deeper cycles (A→B→C→A) are out of scope, matching
the brief's "single level only."

**Billing/Shipping default from Contact, one-time copy not a live
sync.** On first Account creation from a Contact, both Billing and
Shipping pre-fill from that Contact's own Address fields as two
independent field sets (not a shared reference) - editing one afterward
never touches the other, verified directly: created an Account from a
Contact with a real address (`10 Real Street, Manchester`), confirmed
both Billing and Shipping pre-filled identically from it, then edited
Shipping only (`99 Different Warehouse Rd, Glasgow`) and confirmed
Billing was unchanged both in the DOM before save and in the saved
server-side payload after it.

**Account Number generation on account creation is lazy on
`billingCountry`,** matching the scheme's `{country code}` requirement -
an Account created without a billing country yet (e.g. a bare
name-only link from Contact, the pre-existing create path) gets its
Account Number issued later, the first time a billing country becomes
available via PATCH, not blocked or defaulted. Log-and-continue on
failure (`request.log.error`, doesn't block the write), matching the
existing `issueReferenceNumber` convention in `contacts.js`.

**Precisely what triggers it, confirmed by test not just description.**
The check in `PATCH /accounts/:id` is `!record.reference_code &&
mergedPayload.billingCountry` - evaluated per-request against the merged
payload (existing revision + this PATCH's own keys), not a DB trigger
reacting to a column change. In practice this fires on the first PATCH
that supplies a billing country on a record with no number yet, but the
condition itself would also re-fire on a later, unrelated PATCH if an
earlier generation attempt had silently failed (log-and-continue means
that's possible, however unlikely). Verified live: created an Account
with only `name` (no address at all - the only field mandatory at
creation per the brief) and confirmed `reference_code` was genuinely
`null`, both in the API response and by a direct DB read - not merely
absent from a UI rendering. PATCHed in a Billing Address with country for
the first time and confirmed `TT-GBR-R4P3LAZYCO-001` was issued at that
point, not before. Then PATCHed `billingCountry` from United Kingdom to
Germany on the same record and confirmed `reference_code` stayed
`TT-GBR-R4P3LAZYCO-001` unchanged even though `billingCountry` genuinely
updated to `"Germany"` in the payload - immutable once issued, matching
every other reference code in this system, and confirmed by test, not
just by reading the `!record.reference_code` guard and assuming it does
what it looks like it does (the exact mistake the `CREATE OR REPLACE`
bug above was a reminder not to repeat). A further unrelated PATCH
afterward left the number unchanged too.

**Billing Country over Shipping Country, deliberately, flagged here
because it wasn't flagged at build time.** The brief gives Billing and
Shipping Address the identical structured shape, so nothing in the brief
picks one over the other for the country code - this was a build-time
judgment call made without writing down the reasoning at the time, which
should have been surfaced then rather than left implicit. The
reasoning: Billing Address is the invoicing/legal address of record for
the company itself, the closest analogue to "what jurisdiction is this
Account," consistent with how Opportunity/Test Bed's own reference code
ties to the engagement's own country. Shipping Address is an
operational/delivery detail that can legitimately differ from the
entity's registered address and doesn't represent the Account's own
identity the way Billing does.

**A real bug found and fixed while extending `accounts.js`, not part of
the original build.** `PATCH /accounts/:id` fetched the existing
`record_revisions` row to merge new payload keys into it, but never
checked the fetch for an error - a failed fetch would silently proceed
with `undefined` and overwrite the Account's entire payload down to just
the PATCH's own keys. This file was outside the scope of the earlier
documented unchecked-Supabase-error scan (which covered only
`test-beds.js`, `contacts.js`, `deals.js`). Fixed by adding the same
explicit error check already used elsewhere in the codebase.

**A single-quote/XSS-adjacent bug caught before testing, not after.**
The Parent Account search result renderer originally embedded the
Account name directly inside a single-quoted inline `onclick` argument
(`onclick="selectAccountDetailsParent('${id}', '${escHtml(name)}')"`).
`escHtml()` only escapes `& < > "` - not `'` - so a real Account name
containing an apostrophe (the brief's own worked example, `"O'Brien's
Ltd"`) would break the JS string. Fixed by switching to
`data-account-id`/`data-account-name` attributes read via
`element.dataset` in the click handler, an already-established pattern
elsewhere in this codebase.

**Verified live**, real API/DB checks, not inferred from status codes:
Account created from a Contact correctly issued
`TT-GBR-R4P3ACCOUN-001` (name prefix `R4P3ACCOUN`, sanitised and
truncated to 10 characters per the existing rule); a non-existent parent
ID was rejected (`"Parent Account must be a real, non-deleted Account"`);
a real, non-deleted Account was accepted as parent; a soft-deleted
Account was rejected as parent with the same message; a direct A↔B cycle
attempt was rejected (`"...direct circular reference"`); a genuinely
non-cyclic parent reassignment on the same Account still succeeded; a
self-reference attempt was rejected separately
(`"Parent Account cannot be the account itself"`).

### Account Details panel triggered at Lead qualification

**Built, Round 4 Phase 4, 2026-08-17.** Extends Round 3 Phase 1's
auto-opened reconciliation panel (`attemptContactQualifyFromDetail`,
`frontend/contact-detail.js`), which already auto-opens the search-and-
link panel the instant a Qualify attempt is blocked on
`parent_record_id`. This phase branches that same auto-open on whether
the Contact's free-text Company matches a real Account: no match opens
the full Account Details panel from Phase 3 directly (pre-filled Account
Name from the Company text, Billing/Shipping from the Contact's own
address, same as the panel's existing manual create-new path); a match
leaves Round 3's behaviour untouched, the lightweight search-and-link
panel.

**One match definition, not two.** The "does this match" check
(`findAccountMatches()`) is the exact same case-insensitive substring
filter the manual search results (`renderCdLinkResults`) already used,
refactored into a shared function rather than re-implemented for this
new caller - avoids the two definitions silently drifting apart (e.g. one
being fixed for an edge case later and the other not).

**Verified live**, real browser/API test, not inferred: qualified a Lead
whose Company (`"R4P4 Brand New Co ..."`) matched no real Account -
confirmed the full Account Details panel opened (not the lightweight
panel), Account Name pre-filled from the Company text, and Billing
pre-filled from the Contact's own address (`7 New Street, Leeds`).
Qualified a second Lead whose Company exactly matched a real, pre-
existing Account - confirmed the lightweight link panel opened instead
(not the full panel), pre-filled search text matching the Company/Account
name, with a real Link button present in the results, exactly Round 3's
existing behaviour. Qualified a third Lead whose Company text partially
matched two real Accounts at once (seeded `"...Pte Ltd"` and
`"...Holdings"` sharing a common prefix) - confirmed the `hasMatch` check
(`findAccountMatches(company).length > 0`) correctly treats any non-zero
match count as "match," not just exactly one: the lightweight panel
opened with both Accounts rendered as separate Link options, not a
fall-through to the full create panel that would have recreated the
duplicate-Account risk this whole reconciliation panel exists to
prevent.

**A test-script timing bug caught while gathering this evidence, not a
product bug.** The first test run captured page state on a fixed
500 ms delay after the Qualify click, too short for the real async chain
(`transition` POST, then - inside `openAccountDetailsModal` - a
terminus-staff fetch) to finish; the capture landed mid-flight, with the
name field set but the modal still hidden, looking exactly like the
panel had failed to open. A direct call to `openAccountDetailsModal` in
isolation completed correctly, isolating the fault to the test's fixed
delay. Fixed by polling for the actual completion condition
(`page.waitForFunction` on the modal's own hidden class) instead of
guessing a delay - the same class of mistake as Phase 4's evidence-
gathering itself exists to prevent, just caught here in the test harness
rather than the product.

### New Lead modal, lightweight Company autocomplete

**Built, Round 4 Phase 5, 2026-08-17.** The New Lead modal's Company
field (`frontend/index.html`) suggests existing Account names as the
user types, confirmed scope "lightweight only" - nothing is resolved,
linked, or created at fast-entry time, real Account resolution still
only happens at qualification (Phase 4). Does not reverse the earlier
"no friction at fast entry" decision (Company has been plain free text
since 2026-08-13).

**Implemented as a native HTML `<datalist>`, not a custom dropdown,**
deliberately: `<input id="contact-company" list="contact-company-list">`
plus `<datalist id="contact-company-list">`, populated with one
`<option>` per real Account name in `populateContactFormPickers()`
(`frontend/app.js`), which already runs every time the modal opens.
Chosen specifically because a native datalist suggests without ever
being capable of resolving anything - selecting a suggestion just fills
the text value, no id, no onchange side effect - which is exactly the
brief's own "stays genuinely free text underneath" requirement, for
free, rather than something a custom dropdown (like the Account Details
panel's own Parent Account search) would have to be deliberately built
not to do. Reuses `accountsCache` as-is, already fresh on every Leads
page load - no new fetch, no new search endpoint, same "reuse the
existing mechanism" precedent as Contact detail's own Account search.

**Verified live**, real browser + API: opened the New Lead modal and
confirmed the `list` attribute correctly references the `<datalist>`
and it's populated with real Account names (not empty, not stale).
Typed a distinctive fragment from the *middle* of a real seeded Account
name (not the prefix, to rule out a coincidental prefix-only match) and
confirmed that Account's full name is present as a datalist option -
the actual mechanism a browser's native suggestion popup reads from.
Native datalist-popup rendering itself is standard out-of-the-box
browser behaviour once `<input list>` points at a populated
`<datalist>`, and isn't screenshot-verifiable in headless Chrome (it
renders in the browser's native popup layer, outside normal page
compositing) - what this app is responsible for, and what was verified,
is that the option list is correctly wired and populated. Confirmed the
field is still a genuine plain-text input (typed value comes back
exactly as typed, no transformation). Submitted the New Lead form with a
Company value matching no real Account at all and confirmed the Lead
was still created successfully, both client-side (modal closed, no
error) and server-side (the Lead exists with that exact Company text,
`parent_record_id` still null) - no new requirement introduced, exactly
today's existing behaviour.

## 10. Build order

1. **Contact, Account, and Opportunity** (minimal): just enough to create a Contact and Account, an Opportunity (with `stage`, no `type` field, Opportunity is always commercial), and attach records to it, this is the anchor everything else needs, build it before the Deal Sheet needs somewhere to attach. **Rework needed on what's already built**: the first Opportunity milestone was built against an earlier model where `type` mutated between R&D and Commercial on the same record, and Contacts were assumed to attach via exclusive `parent_record_id` ownership. Both are superseded, Opportunity drops `type` entirely, Test Bed becomes its own record type (below), not a variant, and Contact attachment becomes the many-to-many `record_contacts` join table (Section 2), not `parent_record_id`. The stage transition and gate-checking logic itself doesn't need to change, only the type field, the conversion endpoint, and the Contact-attachment mechanism do.
2. **Test Bed** (minimal): its own top-level record type, own `stage_definitions`, flat 8-stage list, Qualification through Closed, own Contacts and Documents, same pattern as Opportunity, not a child of it. Build alongside Opportunity, since a Contact can convert to either. Confirmed in scope for this build: Test Bed to Opportunity conversion via `conversion_criteria`, at any point in the lifecycle, not only at Decommissioning.
3. **Deal sheet**: `record_type = 'deal'`, `parent_record_id` = the Opportunity it belongs to. Full workflow, chart-of-authority routing, cash flow and P&L calculation, as already built.
4. Once stable: extract the workflow/approval/audit engine to confirm it's genuinely record-type agnostic, before building the next document type (Risk Register, Pilot, Contacts). If extracting it is hard, the generic model wasn't generic enough, fix that before adding more record types on top of it.
5. **Stage gate rules engine** (`stage_gate_rules`, `conversion_criteria`): build this once, generically, as soon as a second real gating need shows up (NDA-before-deployment is the first concrete case), rather than hand-coding that one check and generalising later. This now also carries the Test Bed to Opportunity conversion, the same mechanism as Contact to Opportunity, not a new one.
6. **Opportunity value estimation** (`product_defaults`, `system_defaults`, `stage_probability_defaults`): build once the Opportunity exists and before the Deal Sheet needs to inherit from it, per Section 6.
7. **Product capability catalog** (`capability`, `use_case`, `success_criterion`, `record_use_cases`, per Section 7): build once Opportunity exists, sales needs to select use cases fairly early in the cycle, before the auto-generated scope document and performance tracking pieces that depend on it.
8. **Admin configuration screen** for `stage_gate_rules` (which documents and approval tracks a stage requires): a real module, not a quick addition, since it needs a proper UI for adding/removing requirements per record type and stage, not just direct table edits. Deliberately not urgent, editing `stage_gate_rules` directly (via Supabase's own editor) is fine until this reaches the front of the queue. Requires a global `admin` role, a `roles` row with `record_type = null` (applies to every record type, not one), distinct from the per-record roles like Technical Approver.
9. Subsequent modules (Risk Register, Pilot, Deployment, then Asset Management and component tracking, then the rest of the build-not-buy list) plug into the existing engine rather than rebuilding it.

## Deferred scope

Explicitly deferred, not forgotten, not a section number of its own since this is a running list, not a build phase. Add to it as new deferrals come up rather than letting them live only in conversation.

- **A catalog change silently re-prices every live deal, and nobody is told.
  Raised 2026-08-29, Round 38. PHASE 3, on the list the day it was created.**

  The record holds no rates, so a live deal sheet prices against the current
  catalog. That is the right default and it is invisible: no revision, no audit
  entry, no notice. Full reasoning in the "Where a field belongs" section at the
  end of this file. The control is that the system knows which deals moved, by
  how much, and tells their owners.

- **`state-dump.mjs` covers no version and no approval detail, so a table
  central to approvals is invisible in `CURRENT_STATE.md`. Raised 2026-08-29.
  SCHEDULED, not open-ended.**

  Measured: `grep -ac deal_sheet_versions scripts/state-dump.mjs` returns 0, with
  the search calibrated by confirming the generator does print row content for
  tables it covers. So `deal_sheet_versions` and its new `revision_number`
  column, the two constraints added in Round 38, and the version-to-approval
  link do not appear at all.

  **Why it is not a defect and is still a problem.** The generator was written
  before versions existed and records what it was told to record, so nothing is
  wrong with it. But `CURRENT_STATE.md` is how the next session orients, it is
  uploaded into chat, and a session reading it would conclude the system has
  approvals keyed to revisions and nothing else. Approval is now OF A VERSION,
  and the object that carries that is the one the file cannot see.

  **The trigger, so this does not become permanent.** Closed before the next
  round that touches approvals, versions, or the Commercials approval page,
  whichever comes first. That round cannot honestly reconcile its own
  `CURRENT_STATE.md` diff without it, which is the forcing function rather than
  a date nobody is holding.

  **Scope when it is done:** a `deal_sheet_versions` section printing counts by
  status, how many carry a `revision_number` and how many do not, and the count
  whose named revision is the record's current one. Counts only, never a
  reference code or a name, per the file's own rules. The wider gap the
  2026-08-28 entry records - eleven configuration sections and no vocabulary
  tables - is a bigger job and stays separate.

- **The staff dropdowns constrain input but create no reference: the payload
  holds a name as text. Raised 2026-08-22 while scoping Bid Review routing
  for Opportunity. ANSWERED the same day by direct query.**

  The 2026-08-16 entry in this section records the Terminus staff
  directory: a small `terminus_staff` reference table holding name and
  title, seeded with the seven real staff names by migration, `GET`-only,
  no admin UI, replacing the free-text Terminus Lead and
  Commercial/Technical/Legal Authority fields with dropdowns. **All of that
  was settled. What the selection stores was recorded nowhere**, and it
  decides whether approval routing can ever key off these fields, which is
  why it was asked: the Opportunity model puts a Sales Lead approval at
  three stages and a Bid Review approval at the gate into Proposal, and
  `routing_rules` holds zero rows.

  **The answer is text.** Three independent lines agree, and no line
  dissents.

  1. **The stored values.** Across live and soft-deleted Opportunity and
     Test Bed records, 1,388 readings of the four staff keys returned
     **zero UUIDs and 48 name strings**, every one an exact match for a
     `terminus_staff.name`. Measured 2026-08-22.
  2. **The write path.** Every dropdown is built as
     `terminusStaffCache.map(s => s.name)` and rendered
     `<option value="${s.name}">`. The option value is the name.
     `opportunity-reference.js:271`, `test-bed-detail.js:404`,
     `account-detail.js:92`, `contact-detail.js:278`.
  3. **The code already said so.** `src/routes/opportunities.js:162`
     records that the fields were free text until 2026-08-16 and are now
     "a dropdown sourced from terminus_staff, still written through this
     same PATCH/payload-merge path either way, just constrained to a
     controlled option list client-side".

  **A note on how this was measured, because the obvious method fails.**
  All three live Opportunity records have these keys **absent from the
  payload entirely**, not null. A query against live Opportunities alone
  compares nothing to nothing and returns an answer shaped exactly like
  "not a UUID". The reading came from soft-deleted Opportunities and from
  live Test Beds, and no conclusion was drawn from the live Opportunity
  rows. This is Verification 14 in its natural habitat.

  **Two things the query surfaced that were not being asked about.**

  - **There is no server-side validation.** `terminus_staff` is referenced
    zero times in `test-beds.js` and `accounts.js`, and once in
    `opportunities.js`, in a comment. The controlled option list is a
    client-side affordance, so any string can be written into `lead`
    through the ordinary PATCH path. The dropdown is not an integrity
    control and nothing else is acting as one.
  - **The directory feeds three record types, not two.** Every document
    describing this change says Test Bed and Opportunity. `Account`
    carries its own `terminusLead` as a `staffField`, populated from the
    same list through the shared Account Details panel that Contact hosts,
    and one live Account holds a name in it.

  **The consequences, now that the answer is known.** A staff member
  leaving, or a spelling correction in `terminus_staff`, leaves every
  historical record pointing at a string that no longer resolves to
  anyone. Nothing can be counted per person reliably. And **Bid Review
  cannot route to a person** without either a reference column or a
  resolve-by-name step that the rename case defeats.

  **Not a defect, and not scheduled.** For display and for constrained
  entry a name string is adequate, which is presumably why it was built
  that way. It becomes load-bearing only when something routes off it.
  Recorded here so the round that builds routing meets this note rather
  than the consequence.

  **Score attribution is NOT affected and is sound.** A score entry's
  author is written server-side from the authenticated session and never
  accepted from the client, settled in Round 11. Who recorded a score and
  who is named as Sales Lead on the record are two different attributions,
  and only the second is in question here.

- **JWT "issued in the future" rejection, rare and unreproduced.** Observed once during Milestone 1 reference-number testing (2026-08-14), from Supabase's own auth/API layer, not from project code. Investigated, local clock skew ruled out, project code ruled out, 200 further attempts across 8 rounds produced zero recurrence. Cause unconfirmed. Cannot rule out a real production user hitting the same rejection, since the validation layer involved is the one any real caller's JWT passes through. Not fixed, not reliably reproducible. A defensive retry on this specific error is the likely fix if it's ever seen in production traffic.

- **`john+test@terminustechnologies.io` shared test account password was reset during Milestone 3** to obtain a real session token for HTTP-level testing, service-role access can't mint one directly. The prior password is not recorded and cannot be recovered. If this account is ever used for manual, interactive testing outside a Claude Code session, it will need a fresh sign-in. Going forward, prefer ephemeral test users created and torn down within a session over mutating this shared fixture.

- **`NOT VALID` on a `CHECK` constraint does not exempt existing rows from future writes, confirmed the hard way, Milestone 3.** It only skips the initial validation scan when the constraint is added. Every subsequent `INSERT` or `UPDATE`, including one that doesn't touch the constrained column at all, is checked against the full row image and will fail if the row doesn't satisfy the constraint. A batch of legacy Test Bed records became silently edit-locked, including for soft-delete, until the constraint was amended to add a `deleted_at IS NOT NULL` escape. Worth remembering generally: a `NOT VALID` constraint added against existing non-conforming data is not a "grandfather these rows in" mechanism, it only defers the validation scan, it does not create a permanent exemption. Any future constraint added the same way against live data needs an explicit decision about what happens the next time one of those rows is touched, not just an assumption that `NOT VALID` handles it.

- **Reference number counters must never be deleted while a soft-deleted record still holds a code from that counter, confirmed by a real collision, Milestone 4.** During earlier test cleanup, a `GBR-SMARTC` counter row was deleted as part of tearing down test fixtures, while a soft-deleted record still permanently held `TT-GBR-SMARTC-001`, since reference codes are never reused, even after deletion (Section 9). The counter then restarted at 1 on next use and collided with the already-claimed code, a real Postgres unique-constraint violation, caught live during Milestone 4 testing. Not fixed, since fixing it properly means deciding how counters and soft-deleted-but-claimed codes should interact going forward, a real design question, not a quick patch. In the meantime: test cleanup should soft-delete test records and leave their counters alone, never delete a `reference_number_counters` row as part of teardown.

- **Unchecked Supabase query errors are a real, recurring pattern in this codebase, not an isolated bug, confirmed by a dedicated scan, Milestone 5.** The Test Bed to Opportunity conversion's duplicate-conversion check was found silently broken, an ambiguous foreign-key embed (`records!inner(...)` where `opportunity_details` has two FKs to `records`) failed with a PostgREST error that was never checked, so a genuine second conversion succeeded before this was caught, by testing, not by reading the code. A follow-up scan of `test-beds.js`, `contacts.js`, and `deals.js` found roughly 20 more call sites with the same shape, most degrading harmlessly to an honest blank, consistent with this codebase's existing convention, but 5 confirmed as genuinely dangerous, two of them (`PATCH /test-beds/:id`, `PATCH /contacts/:id`) capable of **silently wiping every field on a real record down to just whatever a single save submitted**, with no error shown to the user. All 5 confirmed sites are now fixed, each proven not just by inspection but by forcing a real failure (a temporary, reverted permission revoke on `record_revisions`) and confirming the endpoint now rejects the save with a real error instead of succeeding with data loss. **General rule going forward: always destructure and check `error` from a Supabase query before trusting `data`, especially before using a fetched row as the base to merge new fields into. An unchecked error is not "no result", it's "we don't know", and treating the two as equivalent is how silent data loss and silent security bypasses both happen.** Given how many instances turned up in one bounded scan, a dedicated pass across the rest of the codebase, beyond the files checked here, is worth scheduling, not assumed complete just because these 5 are fixed.

- **`NOT VALID` and soft-delete do not exempt existing rows from `UNIQUE` constraints either, same family of lesson as the `CHECK` constraint finding above, confirmed again, Milestone 5.** Replacing the dropped `reference_code` uniqueness guarantee with a compound `UNIQUE (reference_code, record_type)` constraint failed on first attempt, two soft-deleted Opportunities from testing still held the same code, and a unique index does not ignore soft-deleted rows by default. Resolved by clearing the accidental duplicate's code before reapplying, a genuine data cleanup, not a workaround. Worth remembering alongside the earlier `CHECK` constraint lesson: neither `NOT VALID` nor `deleted_at` being set makes a row invisible to a constraint unless the constraint is explicitly written to account for it.

- **A `FOREIGN KEY` constraint was temporarily dropped and restored as `NOT VALID` to allow a full business-data reset while `audit_log` kept its original history, 2026-08-15.** `audit_log.record_id` referenced `records(id)` with `ON DELETE RESTRICT`; hard-deleting every business record while `audit_log`'s own historical rows still pointed at those now-deleted originals would have violated the constraint outright, blocking the reset entirely. Resolved by dropping the FK, performing the full deletion, then re-adding the identical constraint (same `ON DELETE RESTRICT`) as `NOT VALID`, so it only skips the initial scan against the now-orphaned historical rows rather than exempting them permanently. Restoration confirmed as real enforcement, not just presence, by a genuine rejected insert against a fabricated invalid `record_id` afterward. Same family of lesson as the two `NOT VALID` entries above: it only ever defers the initial validation scan, existing rows are exempt from that one scan, not from anything going forward.

- **Base Cost Data**: a real admin-maintained rate catalog (hardware/installation/hosting cost lines). Currently a stopgap: the ten cost lines are freely-editable payload fields on the Opportunity itself, gated only by a route-level `SALESPERSON_WRITABLE_KEYS` allowlist, not a real permission model or a maintained master table. **Related finding, 2026-08-15, see the real-use testing pass below:** the currency these costs display in was found to be a single hardcoded-GBP function, corrected to USD, but a real per-record currency field is the same undesigned gap as this entry, not a separate one.

  **BUILT, Round 36 Phase 1, 2026-08-27, as `base_cost_batches`.** The paragraph above is kept verbatim because it stood for twenty rounds and a reader who remembers it needs to see it struck rather than silently absent. Two of its claims were wrong, and Round 36 Phase 0 measured both.

  **"The ten cost lines are freely-editable payload fields on the Opportunity" was never true.** They are not in `SALESPERSON_WRITABLE_KEYS` and never have been: `git log -S` over `routes/opportunities.js` returns exactly one commit, `9389690`, the commit that created the allowlist, where the names appear only in the comment saying they are rejected. Nothing wrote them either, so they were not read-only-after-creation, they were **never written at all**. An Opportunity's revision 1 is `{name, company_name, customerLead}`, and all four live Opportunities carried zero rate keys while the Commercials tab displayed `$0` for arithmetic on absent inputs. **This document contradicted itself on the point**: the Deal Sheet section already recorded, correctly, that "Opportunity's rate fields are locked read-only after creation" while "Test Bed's own rate fields stay freely editable through the ordinary PATCH allowlist". The sentence above is the wrong half of that pair. **The control gap it describes is real and it is on Test Bed**, where ten of 39 hand-typed rate values across eight live records disagreed with the catalog the business supplied, including a hosting rate entered at 2000 against a catalog 200.

  **`effective_from`, not an `active` flag. The business's decision, Round 36.** Current is the latest batch for a product whose `effective_from` has passed. The reasoning is the business's own reason for wanting batches at all, retracing through previous pricing: a flag holds only the present, so it cannot answer "which batch was current in March", because the history is destroyed the moment the flag moves. **One consequence, confirmed as intended: a future-dated batch is not current, so entering next quarter's prices does not reprice today's deals.**

  **No `active` column, and that is a deliberate departure from `closed_lost_reasons` and `contact_roles`.** Those carry `active` to separate two things a vocabulary must do at once, stop offering a row in a picker while keeping an existing citation resolving. Nothing picks a batch, so half of what the flag is for is unreachable. And a flag would be a second answer to "which batch is current", competing with the date, which Architecture rule 3 forbids for the reason that a second path agreeing today will disagree later. Retirement here is a later batch superseding an earlier one, which is what `effective_from` already says.

  **A batch is per product, not per catalog.** Confirmed with the business: a manufacturing run is per product and runs arrive at different times. So the row is the batch, there is no shared batch metadata, and the header-plus-lines shape (`scoring_scales`/`scoring_scale_levels`) was costed and rejected because its only advantage, stopping three product lines disagreeing about metadata they share, does not apply.

  **What keeps a superseded batch unchanged, stated precisely rather than assumed stronger than it is.** Select-only RLS, the Round 35 precedent: a select policy and no insert, update or delete policy, so deny-by-default refuses every write, and every API route runs under the user's JWT. **It does not bind the Supabase editor**, which connects as the table owner, bypasses RLS, and is the only maintenance path this build has. Verified both directions in Phase 1: the application's `UPDATE` leaves `unit_cost` at 8000 and returns zero rows, while the same statement as owner moves it to 8001 and returns one. **Note the refusal returns success with an empty result set, not an error code**, which is the Verification 8 shape, so the discriminator is the row count and not the error. The stronger form, a trigger raising on `UPDATE`/`DELETE` of a row whose `effective_from` has passed, would bind the owner too. **Not built, deliberately**: it would also stop an admin correcting a typo in a batch that went live this morning, and nothing points at a batch yet. **Pricing versions are the round where a citation starts to exist, and that is the round to put the trade to the business.**

  **A pricing version is the deal's inputs plus the batch, not the batch alone. Recorded here in Round 36 rather than left for the round that meets it.** A batch carries the four catalog costs. The deal carries per-line margin overrides, the warranty percentage, bid and proposal currency, and FX contingency. **A version that points only at a batch is not reproducible**, because the same batch under different margins produces a different price, and margin movement across a deal's life is the thing the versions exist to make visible. So the frozen record has to capture both, and the catalog's job is only to be pointed at, immutably, by the half that is shared.

  **The warranty percentage is not a catalog field and stays a deal field.** `warranty_units = ceil(total units x pct)`, priced at the mix average across all products, so it is not a rate on any product and there is nowhere in a per-product batch for it to live. It is already a per-deal payload key (`warrantyPct`) editable on Structural Terms. **Separately, the built default of 2 disagrees with the prototype's worked example of 10**, and the same average-cost treatment is what makes the provision meaningless on a mixed deal once HEMIR's real cost is 12.5x SafeSight's: 20 SafeSight plus one HEMIR provisions its single warranty unit at $12,381, which is 1.5x over for SafeSight and 8.1x under for HEMIR. Harmless while every rate was zero. Both are live questions the moment the catalog supplies real figures.

  **No currency column, and that closes the related finding above rather than deferring it again.** Bid Currency ("the currency our costs are held in") is a Structural Terms field on the deal, and `calculateDeal()` contains no currency handling at all. A column here would be written once and read by nothing, which is the defect this table exists to stop repeating. USD is implicit until conversion is designed.

  **AN OPTIONAL PRECONDITION IS UNPROTECTED BY DEFAULT. Round 38, after 6a shipped.** `p_expected_revision` was optional, so one writer sent it and ten did not, and any writer that omits it can still blindly overwrite a record that moved. **The census:** 11 call sites, 1 sending a revision. Six are genuinely additive (score entries, assessment reviews, note prepends, the server-recomputed deal snapshot), four were whole-form writes whose screens had not been wired, one was the Commercials tab.

  **The parameter is now REQUIRED, and omitting it throws.** A caller must state which of three things it is: a revision number, `APPEND_ONLY` for an additive write that must not fail because an unrelated key moved, or `CLIENT_UNWIRED` for a screen not yet sending one. **`CLIENT_UNWIRED` is named debt rather than silence**: it is greppable, so a gap cannot hide as an absence.

  **A THROW ONLY FIRES ON A PATH THAT RUNS, AND THIS REPOSITORY HAS WRITERS NO TEST CAN REACH.** One call site was left without a precondition during this change and the database suite still passed 69/69, because nothing it runs touches `PATCH /test-beds/:id` - every Test Bed and every Account belongs to a different owner, so those routes answer 403 before reaching the write. **It would have thrown the first time the business opened a Test Bed.** So the guarantee is made by a SOURCE SCAN in the pure suite: every `appendRecordRevision` call is checked for a precondition token whether or not any test can reach it. Calibrated by removing one and watching the scan name the file and line.

  **ALL THREE READ-THEN-WRITE CONTROLS ARE GONE.** Contract Duration, Customer Lead and Initial Lead each GET the record, compared one field against its page-load value, and refused the save if it had moved. Two concurrency mechanisms of different shapes is worse than either alone, and these were the weaker: read-then-write rather than compare-and-swap, one key wide while every other field merged unchecked. The Reference tab and the Test Bed detail form now send the revision they loaded, and the per-field checks are deleted. **One mechanism remains.**

  **THE MIGRATION INCIDENT IS NOW A STANDING CHECK, not a note.** A test scans every migration for `create or replace function` with differing parameter counts and no explicit `drop function`, which is exactly the shape that produced PGRST203 and took every caller down. Calibrated by injecting a synthetic two-signature function and watching it fire, and by confirming the scan does find `append_record_revision`'s own two signatures and passes only because the drop is present.

  **"ANNOUNCES ITSELF" WAS TRUE OF THE CODE AND FALSE OF THE SYSTEM.** The clock-skew retry wrote to stderr, and CI runs `npm test` only and never the database suite, so nothing read it. The count is now asserted against a budget of 2 at the end of the database run and printed on every run, pass or fail. **Raise the budget only from a measurement.**

  **ADDING jsdom BROKE CI FOR ONE COMMIT.** The workflow deliberately ran `npm test` with no install, and its comment recorded that installing nothing was the proof the pure suite needed no setup. The wiring harness imports jsdom, so a clean checkout failed. Found by running the suite in an empty directory rather than by reasoning about it. `npm ci` is added and the property it replaced is recorded rather than quietly dropped.

  **PER-TAB FIELD OWNERSHIP, AND A RECORD-LEVEL FRESHNESS PRECONDITION. Round 38, conditions 5a and 6a, 2026-08-28. They ship together because the first makes the second necessary.**

  **5a. What the Commercials tab sends was an EXCLUSION list** - everything `readPayload()` produced, minus ten rate keys. An exclusion list is silent about anything new: a key added to `readPayload()` is owned by default and reaches the record unless somebody remembers to exclude it, which is the same everything-is-included-until-guarded shape the dirty flag had. It is now an OWNERSHIP list of 22 keys. **Owned fields are always present, null when blank**, so a cleared box actually clears the stored value rather than leaving the previous one behind through the merge. **Unowned fields are never in the payload, edited or not.**

  **6a. THE TWO FACTS, reported before building.**

  **Does the record carry a usable precondition?** Two candidates. `records.updated_at`, a trigger-maintained timestamp, and `record_revisions.revision_number`, a monotonic integer. **The integer wins**: it is allocated inside the advisory lock `append_record_revision` already takes, it is on the table being merged rather than a different one, and comparing integers has no precision question.

  **What did the existing duration re-check do?** If the box was never edited on this tab, `duration` was deleted from the payload so the merge left the record's value. If it was edited, the client GET the record, compared one field against its value at page load, and refused the whole save if it had moved. **Three of these exist, not one**: Contract Duration here, Customer Lead on the Reference tab, Initial Lead on Test Bed. All are read-then-write rather than compare-and-swap, and each covers ONE key while every other key merges last-writer-wins unchecked, which `append_record_revision`'s own comment had already deferred as a separate concern.

  **What replaced it.** `append_record_revision` gained an optional `p_expected_revision`, checked **inside its existing `pg_advisory_xact_lock`**, so it is a genuine compare-and-swap. A stale write raises SQLSTATE `PT409`, the route answers 409, and the screen shows *"This record changed since the screen loaded. It is now at revision 3, the screen holds revision 2. Reload before saving."* Verified by moving the record from another writer mid-edit: refused, nothing merged, and the other writer's value survived. **The duration special case is deleted in the same change**, replaced by something wider (every key) and stronger (inside the lock).

  **`create or replace function` DOES NOT REPLACE A FUNCTION WHEN YOU ADD A DEFAULTED PARAMETER. It overloads it.** Postgres identifies a function by argument types, so adding `p_expected_revision integer default null` created a second function and left the four-argument original in place. Both then matched every existing call and PostgREST refused to guess: `PGRST203 Could not choose the best candidate function`. **Every caller in the system broke the moment that migration applied**, which is worse than the problem it was fixing. Found by calling the four-argument form immediately afterwards rather than by assuming replace meant replace, and dropped explicitly by argument list in the next migration.

  **`40001` IS THE WRONG SQLSTATE FOR "REJECT THIS WRITE".** It is `serialization_failure`, which the pooler and PostgREST treat as a retryable transaction fault, so the call did not return a 409 - it returned a dropped connection, seen from the client as `TypeError: fetch failed`, reproducibly. `PTnnn` is the form PostgREST maps to HTTP status `nnn`. Verified by calling it, not by trusting the mapping.

  **CLOCK SKEW: ACCEPTED, WITH A MITIGATION THAT ANNOUNCES ITSELF. Second occurrence, Rounds 36 and 38.** `PGRST303 JWT issued at future` is not this machine's clock and not the service key, which is an opaque key carrying no `iat` of its own. The JWT is minted server-side and its `iat` arrives fractionally ahead of the database node's clock, so the skew is between two Supabase components and nothing here can correct it. **So this is an explicit decision to accept the cause and remove the symptom**: `retryOnClockSkew()` retries **only** `PGRST303`, at most once, and **writes every retry to stderr** so the frequency stays visible rather than becoming invisible infrastructure. What it buys is the property the suite needs, that red means a real failure.

  **FIXTURE HYGIENE: CREATING A FIXTURE AND ASSERTING WHAT IT CONTAINS ARE ONE OPERATION. Second occurrence, Rounds 37 and 38.** Both faults were a probe inheriting state and assuming it had not: a stale `walk-ids.json` naming a record already carrying eight versions, and an edit-it-back check reading a correct answer as a failure because the box already held 7. **The fix is not a better assertion in one test.** `freshOpportunity()` returns only after confirming the record is at revision 1, holds none of the ten Commercials keys and carries no versions; `loadFixture()` re-verifies against the database rather than trusting the file. The assertion was shown firing against a deliberately dirtied record.

  **A jsdom harness now covers the wiring, scoped to dirty, save and version.** Two of the last three defects on this tab were wiring rather than logic and neither was visible to a suite of pure functions. Calibrated by reverting the harness to the OLD event-flag mechanism, which fails four of its ten tests including the exact change-on-blur regression.

  **THE DEFAULTS CONSTANT IS INTERIM, NOT FINISHED.** `NUMERIC_DEFAULTS` consolidates literals that were duplicated across five files; it is a single point of definition, not a configuration mechanism. **It is the placeholder for the configurable system-setup defaults that will replace it**, and a value there is still a decision made in code rather than by the business.

  **The blank-box placeholder is a user-visible change to the primary commercial surface, taken inside an implementation step, and is with the business for review.** It is not to be extended to other fields until they have looked at it.

  **REPRESENTATIONAL VARIANCE IN AN APPEND-ONLY STORE IS ABSORBED AT THE READ BOUNDARY, NOT CORRECTED BY REWRITING THE STORE. Round 38, before the Phase 2 reshape, 2026-08-28. The business's principle, and the round's most reusable sentence.**

  **What was measured**, paged over all 17,618 `record_revisions`: **159** of the twelve writable numeric keys hold a numeric STRING against 241 holding a number. Distinct values `"4" "6" "12" "12.75" "18" "24" "36"`; **zero** hold an empty string; all 159 would survive `::numeric`; 16 sit in a current revision and 143 in superseded ones. **Nothing casts them in SQL today**: zero `::numeric`, `::int` or `::float` and zero `payload->>` in any migration or route, so every read is JavaScript and the reporting hazard is prospective.

  **Two writers, and only one was live.** `duration`, 49 of them, from `opportunity-reference.js`: `performGenericRefSave` assigned an input's raw `.value`, always a string, and Contract Duration is a Reference tab field, so **every save from that tab wrote `"36"` while the other tab wrote `36`**. The other eleven keys sit on ONE soft-deleted record, values `"4"` and `"12.75"`, and no file in the repository contains `12.75`, so no shipping path produced them. **"Normalise going forward" would have normalised nothing** until that writer was found.

  **NO BACKFILL WAS RUN, and that is the principle rather than a cost decision.** `record_revisions` is append-only and its value as an audit trail is the guarantee that nothing rewrites it. Rewrite it once for a good reason and it becomes a convention rather than a guarantee, and no later reader can verify which rows were touched. Being reachable as the table owner is not permission. So the variance is absorbed by `toNumberOrNull()` in `src/lib/numeric-payload.js`, which every reader now goes through, and it is permanently harmless.

  **null is the stored representation of "not set". `''` is accepted at the input boundary only and normalised before it is written.** `(payload->>'k')::numeric` returns NULL for a JSON null and **errors** on an empty string with invalid input syntax for numeric, and the weighted and unweighted pipeline forecasting this build is heading toward will cast in SQL. An empty string turns a blank margin into a query that throws, found months later at the reporting layer, which is the late-discovery shape this project has already paid for repeatedly. **A blank box clears the stored value, deliberately.**

  **A BLANK NUMERIC IS null, NEVER 0, AND THE CALCULATOR BRANCHES ON THE ABSENCE EXPLICITLY.** `num()` returned 0 for a blank input since the Commercials tab's first commit, and three separate defects have had that coercion underneath them. Both `null` and `''` coerce to 0 in JavaScript arithmetic, so neither sentinel protects the calculator on its own: **percentages take the configured default, counts and `lumpSumCost` take 0, and the substitution is never written back**. The defaults are consolidated into `NUMERIC_DEFAULTS` rather than the five copies of `warrantyPct = 2` and three of `targetMargin = 30` Round 36 measured. On screen a blank box shows the default as its **placeholder**, so it reads as what it is pricing at rather than as zero.

  **The test that matters is that a null `targetMargin` prices at the default and not at zero**, asserted through the real calculator: absent gives $114,286 on an $80,000 cost, explicit zero gives $80,000, and the two must differ. Both defects were injected and the right assertions fired.

  **DIRTY STATE IS A COMPARISON, NOT AN EVENT.** The tab set a boolean from an `input`/`change` listener on the whole panel, which gave it two properties that were defects rather than details: every control inside the panel marked the tab dirty whether or not it changed the deal, and each exception needed its own guard **per event type**. Round 37 guarded the version reason box on `input`; a textarea also fires `change` **on blur**, and the blur that mattered was the click that used the reason. Now `dealFormDirty` is derived from the form's writable payload against the payload as last saved, and **the reason box needs no guard at all**, which is the proof the cause is gone rather than the symptom. Absent, null and `''` compare as one state, or every record would open dirty; a stored `"36"` compares equal to a form's `36`, which is what stops all 159 unmigrated values opening their records dirty.

  **The write-side guard refuses rather than coerces.** `PATCH /opportunities/:id` rejects any of the twelve keys carrying anything but a number or null, naming the key and what it received. Coercing at the boundary would make the server quietly accept a shape it is documenting as wrong and the caller would never learn.

  **TAKING A VERSION SAVES THE RECORD FIRST. Round 38 Phase 1, 2026-08-28, the business's decision.** Round 37 shipped a Deal Sheet that renders through `recompute()` from `readPayload()`, so it shows unsaved input, and a version taken from it captured that unsaved input. Measured by intercepting the POST: the body carried `ssExisting: 77` while the record held no `ssExisting` at all and stood at revision 12.

  **The business's reasoning is the one they gave for wanting versions at all**, "traceability of calculations used in proposals": a version citing figures the record never held is a traceability record that cannot be checked against anything. Keeping saving and versioning separate is cleaner as code and permits exactly the disagreement versions exist to prevent. The cost is one extra write, and save-then-version becomes one act.

  **Only when there is something to save.** A version taken with nothing dirty writes no revision, because the record already holds what the screen shows, and an empty revision every time somebody versioned twice would be history nobody made. The two cases say which happened: "Pricing saved, and V0.1 taken from it" against "Saved V0.2. The pricing was already saved."

  **THE GUARANTEE IS ABOUT KEYS THE RECORD HOLDS, and the exception is worth stating.** `readPayload()` coerces a blank numeric box to 0, and `saveDeal()` omits a key the record has never held, so a version says `duration: 0` where the record says nothing. Measured across eight writable keys: seven agree exactly, `duration` is the one, and its version value is 0. That is the same "a zero and a missing value are indistinguishable" shape this project has now met on the Commercials tab three times.

  **A GUARD THAT COVERED `input` AND NOT `change` PRODUCED A SPURIOUS WRITE THE MOMENT A DIRTY FLAG STARTED MEANING SOMETHING.** Round 37 stopped the version reason box from marking the tab dirty, correctly, on `input`. A textarea also fires `change` **on blur**, and the blur that matters is the one caused by clicking Save version. So typing the reason was ignored and the click that used it marked the tab dirty a moment before `saveVersion` read the flag.

  **Harmless for a round.** Nothing read the flag at that instant, so the tab simply offered a save nobody needed. Phase 1 made a dirty flag mean "write a revision first", and the same unchanged path produced a revision on every version taken from an otherwise-clean screen. **Architecture rule 8 exactly: an unchanged path meeting a new demand, with no regression and no failing test, because nothing was broken until the new demand arrived.** Found by the button reading clean while the feedback said a save had happened, which is the kind of disagreement only a probe that reports both can surface.

  **A version taken before this fix exists, and what follows is what was OBSERVED, separated from what was inferred. Corrected Round 38 Phase 1 after the first write of this entry stated an inference as a finding.**

  **Observed:** one row in `deal_sheet_versions`, V1, status issued, reason "testing", `created_by_email` and `issued_by_email` both `john@terminustechnologies.io`, `created_by` a uuid that is not the test account this session signs in as, on a record whose `deleted_at` is null. Its `inputs` match that record's latest revision on all seven writable keys the record holds; `duration` is the eighth and shows the 0-against-absent gap above.

  **Inferred, and wrong:** that this was "the business's own" data on a "live" Opportunity, and that whoever took it "saved before versioning by discipline". None of that was observable. A different account is not a different person, `deleted_at is null` is not "live business data" (the system holds test data only), and the agreement between version and record has at least three explanations - saved before, saved after, or nothing dirty at the time - of which discipline is only one. **The reason on the row is the word "testing", and that was read and narrated past.**

  **The rule this cost:** report what was observed and mark an inference as an inference. A provenance story is the easiest thing to write and the hardest to check, and this is the second time in two rounds the same habit produced a confident sentence with nothing behind it.

  **AQ SENSOR AND HEMIR NEW-INFRASTRUCTURE INSTALLATION: A DEFERRED CASE, NOT AN UNCONFIRMED DEFAULT. Round 37 Phase 5, 2026-08-27, decided by the business.** Four unit inputs stay. The catalog holds an existing and a new installation figure for all three products; the Commercials tab has two rows for SafeSight and one each for AQ Sensor and HEMIR, so their new-infrastructure figures, $1,000 and $10,000, reach no row and are not consumed.

  **The business's reasoning, recorded as theirs:** the difference may be real and they do not yet know, so it is designed for in the DATA rather than in the SCREEN. The catalog carrying both figures for all three products is the expensive half and it is already right. Two more unit boxes that would read zero on almost every deal is the shape Round 30 spent a round removing, and the same shape the value-column question was rejected on twice.

  **This is a deferral with a known cost, not a gap nobody noticed**, and the screen says so: the rows read "AQ Sensor, existing infra" and "HEMIR, existing infra", and a basis line beside the table names the batch and states plainly that their new-infrastructure rates have no row. **The labelling is what makes the deferral visible rather than silent**, which is the reason it stays.

  **THE FOUR-FIGURE STRIP AND THE DEAL SHEET ARE TWO DIFFERENT FACTS, NOT TWO PRESENTATIONS OF ONE, and the reason is a multiplication.** The Hw/Hosting card totals hosting PER MONTH; the strip and the Deal Summary matrix carry it over the TERM. Measured on one deal at 36 months: the hosting card reads $12,500 and the matrix's hosting column reads $450,000. So a reader comparing the two is not seeing a discrepancy, they are seeing a month against a contract. **Removing the strip would remove the only place the term is visible on this tab**, which makes it a Payment Terms question rather than a Deal Sheet one.

  **SECTIONS ARE DECLARED, NOT DERIVED FROM THE PAYLOAD'S KEYS, and Round 37 Phase 5 exercised that across a real gap for the first time.** Two versions on one deal: one carrying six sections with no payment keys in its payload at all, one carrying eight with the payment keys present and blank.

  | | payload has a payment key | sections lists payment |
  |---|---|---|
  | taken before Payment Terms existed | no | **no** |
  | taken after, left blank | yes, empty values | **yes** |

  **A reader deriving sections from the keys would call both "no payment structure".** Declared, the version answers which: the structure was blank, or there was no structure to fill. That is the business's own refinement and it is the difference between an incomplete record and a record of what was complete at the time.

  **A DECLARED POLICY IS NOT AN ENFORCEMENT: RLS DOES NOT BIND BYPASSRLS, AND THE SERVICE ROLE HAS IT. Round 37 Phase 4, 2026-08-27.** Round 37 Phase 3 scoped the version update policy to `using (status = 'draft')` and reported it as the immutability rule. It refuses the application and nothing else. Measured by attempting the write and watching it land, rather than by reading the policy:

  | | as the application | as the service role |
  |---|---|---|
  | update an issued version | 0 rows, unchanged | **1 row, reason overwritten** |
  | edit a cited batch | n/a | **1 row, 8000 to 7777** |

  **So a `USING (false)` policy would have passed review and refused nothing.** That is the third direction this project has reached the same sentence from: a rationale written beside a call is not a guard, a recorded decision is not a record of what happened, and now a declared policy is not an enforcement.

  **TRIGGERS FIRE FOR EVERY ROLE, BYPASSRLS INCLUDED**, which is why the enforcement moved there and why one mechanism now covers both tables.

  **The hard part is that issuing is itself an update to the row it freezes.** A draft is mutable, an issued version is not, and the relabel changes status and number in the same statement, so the trigger cannot simply refuse updates to rows that end up issued: it has to allow exactly that transition and nothing else. Legal is draft to issued, major + 1, minor 0, issuer set; everything that makes the version a record of a price must be identical on both sides. Verified as the service role: the relabel is allowed and the row is immutable immediately after, while five illegal variants are each refused for their own reason - same major, non-zero minor, altered inputs, altered batch pointer, rewritten reason.

  **The batch trigger is scoped to CITED batches only.** The foreign key already refuses the delete and binds the owner; the trigger adds the edit, which is the worse case, because a deleted batch is obvious and a batch quietly changed from 8000 to 7777 leaves every version citing it describing a price that was never quoted. An uncited batch stays editable in the Supabase editor, verified, because that is the only maintenance path this build has and a typo caught before anything cites it must still be fixable.

  **No delete trigger, deliberately.** The application already cannot delete, measured at zero rows. A delete trigger would bind the owner, and "immutable once issued" is a rule about ALTERATION - a version that says one thing must never quietly say another. Making issued rows undeletable by anyone would make a fixture or a genuine mistake permanent with no path short of dropping the trigger.

  **A guard is complete only for the columns that existed when it was written.** `created_by_email` was added one migration after the trigger listed every column the relabel must preserve, so for one migration the relabel could rewrite the author and nothing would have failed. Caught by re-reading the guard against the new column. The Architecture rule 9 shape at its smallest.

  **NOTHING IN THE SYSTEM REPRESENTS A PROPOSAL, so the one-to-one link is recorded as absent rather than invented.** Measured: zero `record_type = 'proposal'` rows, no proposal table, and `document_kind` in use is `terminus` and `customer` only. **"Proposal" exists solely as an Opportunity stage name.** An issued version is already uniquely identified and immutable, so a future `proposal.version_id` foreign key is a one-line addition when a proposal exists to hold it.

  **The author is stored as text beside the uuid**, the convention assessment entries and Notes History already use, because `auth.users` is not exposed through PostgREST and a list rendered from uuids can show a version's number, status, reason and timestamp and not who took it.

  **On the reason field's size, the measurement does not settle it and the choice stands on reasoning.** Live assessment reasons run 1 to 192 characters with a median of 42 across 4,371 entries, and this round's own version reasons ran 43 to 62. That is not a wide enough separation to justify a different control on evidence. Three rows is chosen because it INVITES a paragraph where the one-line control invites a sentence, and the business asked for the thinking rather than a label.

  **THE PROPOSAL-GATE FREEZE IS SUPERSEDED BY MANUAL SAVE. Round 37 Phase 3, 2026-08-27, confirmed with the business.** This document recorded that the Deal Sheet freezes at the Proposal gate, automatically, as an application of the immutable-approved-snapshot principle. Round 20 Phase 0 found the transition it was named against no longer exists and recorded the freeze point as needing renaming. **It is not renamed, it is replaced.** A version somebody chose to take is a better record than one the system took on their behalf, and it carries the one thing an automatic freeze never could: the reason. **The superseded reasoning is left standing above rather than deleted**, because a reader who remembers the freeze needs to see it struck.

  **The supersession is documentation, not a conversion, because the Deal Sheet never existed as an artefact.** Round 37 Phase 0 measured it: zero `record_type = 'deal'` rows against 330 opportunity rows, nothing named freeze or frozen anywhere in `src/`, and the only snapshot path unreachable from the UI since Round 3 Phase 4. There was nothing to migrate.

  **A VERSION IS THE DEAL'S INPUTS PLUS THE BATCH, and the table holds all three parts.** `inputs` is the whole payload as jsonb, so it grows for free as tabs land; `rates` holds the resolved catalog figures as they were read; `batch_id` points at the row they came from. **Both the values and the pointer, deliberately**: the pointer alone is not enough because the table owner can still edit a batch through the Supabase editor, and the values alone would lose which batch was used, which is the retracing the batches exist for.

  **`sections` records what existed when the version was taken**, so a V0.2 taken today and a V1 taken after Payment Terms lands are distinguishable in shape. Without it nobody reading the older one can tell whether the payment structure was blank or absent, which is the difference between an incomplete record and a record of what was complete at the time.

  **THE USING (false) POLICY WAS NOT THE RIGHT ENFORCEMENT, and this is the round that could tell.** Round 36 Phase 1 left it unbuilt because a policy on a table nothing points at proves nothing. With the pointer built, two enforcements matter and neither is a blanket refusal:

  - **An issued version cannot be changed by the application.** The update policy is scoped `using (status = 'draft')`. Measured: the same statement affects **0 rows against an issued version and 1 against a draft**, and the issued reason is unchanged afterwards. `USING (false)` would have frozen drafts too and made the relabel impossible, and issuing IS a relabel.
  - **A batch cannot be deleted while a version cites it.** `batch_id` is a foreign key with `ON DELETE RESTRICT`, which **binds the table owner**, unlike every RLS policy in this schema. Measured as the owner: **23503, zero rows deleted, batch still present**. Calibrated the other way, an unreferenced batch deletes cleanly, so the restriction is about the reference and not about the table.

  **That second one is the first constraint in this build that protects Base Cost Data from the Supabase editor, and it exists only because something now points at it.** Neither stops an owner EDITING a batch in place, which is why `rates` stores the resolved values beside the pointer.

  **The refusal shape is worth carrying: an RLS-refused UPDATE returns success with zero rows, not an error.** The issue route checks the row count for exactly that reason. Same Verification 8 shape as Round 36 Phase 1 found on `base_cost_batches`.

  **Restore refuses-or-discards rather than forcing a save, and reuses Round 28's dialogue.** Restore overwrites current pricing, which is what makes it useful in a negotiation and what makes unsaved work a real risk. The existing mechanism is `openDiscardConfirm`, whose own words are "discard unsaved changes" - exactly what restoring does to them. **Forcing a save would be a third pattern AND would write a revision the user never asked for at the moment they are trying to go back.** Verified: with unsaved units the dialogue appears, and discarding then restores.

  **The reason is a three-row textarea, not the one-line-growing control the assessment panel uses.** That control is right for a sentence explaining one score. A version reason explains what changed across a whole sheet and why, which the business called "the thinking about why things have been adjusted", so three rows at rest says a paragraph is expected without forcing one. **It is also the only editable control on an otherwise read-only tab**, and it deliberately does not mark the tab dirty: a typed reason enabling Save Changes would offer to save the pricing at the moment someone is describing it.

  **The Deal Sheet becomes a sub-tab, read-only, and the waterfall MOVES into it rather than being copied. Round 37 Phase 2, 2026-08-27.** Before this it was a block titled "Deal sheet" living on the Structural Terms sub-tab, computed live and editable around. It is now the fifth sub-tab, presenting the inputs that produce the price: unit counts, the catalog rates with their batch, every per-line margin with whether it is the target or an override, the term, the installation responsibility, the warranty percentage, both currencies, the contingency and the tax adjustments.

  **Read-only is load-bearing, not a staging decision.** One place to edit a number, and a version taken from what was reviewed rather than from what might have been changed while reviewing. Verified as zero editable controls in the panel at all three widths.

  **THE MOVE WAS ASSERTED AS TWO CLAIMS AND COUNTED AT EXACTLY ONE.** Round 10 Phase 2 moved Summary, verified it appeared in its new place, and shipped a duplicate the business found. So: one `.deal-sheet` instance on the page, present inside `#deal-tab-sheet`, absent from `#deal-tab-terms`, and Structural Terms still rendering its own content.

  **The business's reading complaint was measured before it was designed against.** Their words on the prototype: "Deal Summary panel is too wide, you need to be able to keep the line label and the amount in view." Quantified on that panel as the whitespace between the end of a row's label text and the start of its amount: **628px at 1240, 1308px at 1920, 2828px at 3440**, because its label column is `minmax(150px,1fr)` and absorbs every extra pixel. The Deal Sheet holds a constant **389px at all three**.

  **Two layouts were measured and rejected, and the second is the one worth recording.** `minmax(360px, 460px)` reads correctly at 460 but is the same family as the defect being fixed, since a track that can stretch will. `column-width: 460px` was **worse than the starting point**: CSS columns DISTRIBUTE the available width among however many columns fit rather than capping it, so at 1240 the container's 876px became one 876px column and the gap went to **805px**. Fixed `repeat(auto-fit, 460px)` tracks hold the cap at every width. **The lesson is that a cap expressed as a maximum is not a cap**, and the only way to tell was to measure the same quantity again after changing the layout.

  **Card order is a layout decision here, not cosmetics.** Four cards against three 460px tracks at 1920 means one wraps whatever the order; what the order decides is whether the stranded row holds the 12-row Margins block or the 5-row Units block. Ordered tallest-first so the short one wraps.

  **On duplicating the four-figure strip, measured rather than asserted.** The strip above the sub-tab row (Contract Net, Achieved Margin, Total Deal Cost, Finance Cost) stays visible on all five sub-tabs. The Deal Sheet's four input cards repeat **none** of those figures. The moved waterfall restates Contract Net once, plus its own deliberate reconciliation line. **At zero tax four waterfall rows showed one figure and looked like duplication; at 10% WHT and 8% GST they separated to two**, which is the two-mixes lesson applied to a layout question: rows that coincide at one input are not the same quantity. So the Deal Sheet complements the strip and replaces nothing.

  **The installation rates reached no reader, and the business found it on first use. Round 37 Phase 1, 2026-08-27.** Round 36 mapped the catalog's unit and hosting figures onto the deal and left the four installation figures out **deliberately**, recording the omission in a comment in `src/lib/base-costs.js`, in the Phase 2 report and in the round's close-out. The consequence, unrecorded at the time, is that selecting "Terminus Contractor - Per Unit" priced installation at **$0 on every deal**. Measured before the fix at two mixes: $0 against $96,500 by hand, and $0 against $295,000, with the total not moving when the units did.

  **What makes this worth recording is not the omission but the gap between how it was recorded and what it did.** The round wrote "two of the twelve catalog figures have nowhere to land", which reads as an incompleteness. What it actually was is a live pricing defect on a screen the business prices deals on, and no sentence in that round said so. **An unwired input is not a missing feature when something downstream already multiplies by it.** The check that would have caught it, reading the boxes and multiplying by hand, was run on hardware and hosting and not on installation, which is the same shape as Verification 18: the instrument was pointed at the parts that worked.

  **AQ Sensor and HEMIR take the existing-infrastructure figure, and the rows say so.** The catalog holds an existing and a new figure for all three products; the tab has two rows for SafeSight and one each for the others. So the mapping must choose, and the choice is stated on the screen, in labels reading "AQ Sensor, existing infra" and "HEMIR, existing infra", matching the convention the SafeSight rows already use. **A basis line beside the table names the batch and says plainly that the new-infrastructure rates for those two products reach no row.** Their figures, $1,000 and $10,000, remain unconsumed. That is the Installation tab's decision: whether a deal records infrastructure per product or only for SafeSight.

  **ALL TEN COST KEYS HAVE A CONTROL AND NONE IS EDITABLE, which is the correct end state rather than a gap.** Six are hidden readonly inputs, four are visible readonly inputs in the installation table, and `ssExisting` next to them is neither, which is the calibration. They exist so `populateForm` has somewhere to display a rate and the note lines can read it back. **They are still in the payload's shape and still refused by `SALESPERSON_WRITABLE_KEYS`**, and the strip in `pickSalespersonWritable` is now load-bearing for all ten rather than six: `readPayload` puts live catalog figures on every one, so without it a save would write a per-deal cost basis back into the record and the server would refuse the whole PATCH. Verified by intercepting the PATCH: 21 keys sent, zero rate keys, calibrated against a body carrying two. **Whether the ten keys should remain in the payload shape at all is a real question and not a defect** - nothing writes them, nothing may write them, and the catalog now supplies what they would have held.

  **bidCurrency is the currency the CATALOG is held in, not the deal's. Settled Round 36 Phase 3.** The Structural Terms field describes itself as "the currency our costs are held in", and proposalCurrency is the customer-facing one. That reading dissolves the question Phase 2 raised rather than deferring it: a USD catalog under a USD bidCurrency is not a mismatch, and the non-USD case, a catalog genuinely held in another currency plus the FX contingency uplift, is a Structural Terms decision rather than a Commercials one. The notice Phase 2 added stays, because it is still the honest thing to show if the two ever disagree, but it is reporting a Structural Terms condition rather than an unanswered question.

  **Round 20's control gap was closed before it opened, and that is a different claim from fixing it.** Round 20 recorded that each Opportunity carries its own cost basis, so two deals priced in the same week could use different hardware costs with nothing comparing them. Round 36 Phase 0 measured the live data: all four Opportunities carried **zero** rate keys, the ten keys had been refused by `SALESPERSON_WRITABLE_KEYS` since the allowlist was written, and an Opportunity's revision 1 is `{name, company_name, customerLead}`. **Nothing had ever written a rate, so the divergence could not have occurred on this record type.** The catalog closes the gap rather than repairing damage. **The divergence is real on TEST BED**, where the same rates are writable and typed by hand: ten of 39 values across eight live records disagree with the catalog, including a hosting rate at 2000 against a catalog 200. That is unaddressed and is the natural next target.

  **A COUNT OF ZERO FROM A SEARCH THAT FOUND NOTHING IS NOT A CLEAN RESULT, AND IT IS WORST INSIDE A GUARD.** Recorded Round 36 because the round's own checks kept arriving at this shape. `CURRENT_STATE.md`'s own generator already carries the canonical instance (two NUL bytes make plain `grep` return nothing, indistinguishable from a true absence). The Round 36 instances were all in checks written to prevent a *different* fault: a "no rate keys were sent" assertion over an intercepted PATCH body, which would have printed the same reassuring "(none)" over a body full of them; a teardown scan whose zero would have looked identical whether the fixtures were gone or the scan never matched; and a `reference_number_counters` count that returned exactly 1000 because that is PostgREST's default page size, not because there are 1000 rows (there are 1845). **The remedy is a step, not a caution: every absence check runs a second time against a state known to contain the thing.** The PATCH check was re-run against a fabricated body carrying `ssUnitCost`; the teardown scan was re-run for "Willowglen" and returned 165 against 0 for a nonsense tag; the counter was re-counted with an exact count. **A guard that has never been shown firing is a guard in name only, and the passing case is the one you will see.**

  **What immutability actually rests on, corrected. Round 36 Phase 2.** The Phase 1 sign-off put it as "only the service role can write, and the service role is what every route uses, so immutability is a property of the fetching route rather than of the table". **Measured, the middle clause is not true of this codebase and the conclusion changes with it.** `supabaseAdmin` is referenced in exactly one file, `src/supabase.js`, which defines it; **zero routes import it**, and its own usage log says so ("M1 API route uses: NONE"). Every route builds its client through `createUserClient(request.jwt)` and runs as the authenticated user, so a select-only policy refuses a route the same way it refuses anything else, and a future endpoint written against this table would get 42501 rather than quietly working.

  **So immutability IS a property of the table, and the residual risk is narrower and worth naming exactly:** it holds for as long as no route reaches for `supabaseAdmin`, which bypasses RLS entirely. The codebase already defends that with a convention rather than a mechanism, the service-role usage log in `src/supabase.js` requiring an entry explaining why the user-scoped client is insufficient. **The `record_contacts` precedent the sign-off cites is a real one and a different mechanism**: that table was writable because its policies permitted the write, not because a route escalated. Both failure modes are worth watching and they are not the same one.

  **Not fixed here, correctly.** A `USING (false)` policy on a table nothing points at proves nothing, and the round that builds pricing versions is where a citation exists to verify it against.

  **Open, and carried into Phase 2: the catalog does not fit the screen.** The business supplied three products with four figures each. The Commercials tab has three unit rates, four install rates and three hosting rates, and splits existing from new infrastructure **for SafeSight only**. AQ Sensor and HEMIR each get one install rate and one unit count, so two of the twelve figures have nowhere to land and the single AQ/HEMIR install row is ambiguous between them. The catalog carries both figures for all three products deliberately, per the brief's instruction that its shape must not assume the split away.
- **Contractor Management**: the full module (ISO 9001:2015 Clause 8.4 profile, evaluation & selection, requirements, performance, lifecycle & approvals) is prototype-only, nothing built.
- **Full seven-tab Admin**: only Data Objects/Picklists/Workflows exist in minimal form. General, Taxonomy, Users, Base Costs (see above) are all unbuilt. **Round 36 Phase 1: Base Costs now exists as data and still has no screen.** `base_cost_batches` is maintained in the Supabase editor, the same deferral `industries`, `terminus_staff`, `stage_gate_rules`, `closed_lost_reasons` and the Round 35 contact vocabularies already carry. The unbuilt thing is the Admin tab, not the catalog.
- **Documents module**: a richer, template-tracked version (shared template library, per-record completion status, document location tracking). The current Opportunity Documents tab is a deliberate, honest empty state, not a stand-in for this.
- **Tab/Enter field navigation and unsaved-changes-on-navigate warnings**: system-wide, not screen-specific. Sized comparable to the Contact detail view itself, not a quick add-on - no `<form>` elements exist anywhere in the app today (Enter currently does nothing in any input), and unsaved-changes detection needs a generic dirty-state registry wired into every editable screen and into `navigate()` centrally. **Specification written** (`INTERACTION_STANDARDS.md`, sourced from the GOV.UK Design System's error-summary pattern and the WAI-ARIA Authoring Practices Guide), so this item has a concrete target to build against when it's picked up, not just a size estimate. **Two narrow, reactive fixes landed against this gap during real-use testing (2026-08-15), not the general solution described above.** First: zero `tabindex` existed anywhere in the app, confirmed live, real cause of Tab jumping from a normal field straight to an action button (Convert to Opportunity on Test Bed, Link to Account on Opportunity). Fixed on both of those two Reference tabs specifically, with real keyboard-walkthrough evidence. Second: a related but separate gap, `loadContactDetail()` reloading unconditionally and silently discarding in-progress edits, found live via a real data-loss report (a LinkedIn field cleared by linking an Account). Fixed at the 4 confirmed call sites in `contact-detail.js` (`linkCdAccount`, `attemptContactUnqualifyFromDetail`, `onCdAddNoteClick`, `saveCdParkForm`), reusing the existing `openDiscardConfirm()` modal pattern. **Neither fix is the generic solution this item still describes.** Both are per-screen patches proven correct where they were applied, Test Bed and Opportunity's Reference tabs for the first, Contact's detail view for the second. Other editable screens (e.g. Test Bed's own Site Details tab) have not been checked for either gap and should not be assumed clean just because these two were found and fixed elsewhere.
- **`mailto:` link on displayed email addresses**: every email shown across Leads/Contacts/detail pages is plain text today, not a clickable `mailto:` link. Backlog only (2026-08-14), not built.

- **Top-level `const` names collided across two files sharing one script scope, confirmed the hard way, real-use testing pass, 2026-08-15.** `test-bed-detail.js` declared `const SUMMARY_FIELD`, an identical name already existed in `opportunity-reference.js`. Both load as classic `<script>` tags, no module scoping, so this threw a fatal `SyntaxError` on every page load, silently breaking the entire Test Bed detail panel, caught only because it was tested live, not by any automated check. Fixed by renaming to `TB_SUMMARY_FIELD`. **General rule going forward: before adding a new top-level `const`/`let`/`function` name in any frontend file, check whether that exact name already exists in another file that loads in the same page**, this codebase has no module bundler enforcing isolation, a name collision is a silent, total page failure, not a warning.

- **A CSS class was shared between two unrelated features, found and avoided before it caused a regression, real-use testing pass, 2026-08-15.** Building the Contacts List's new row-action popup, `.contact-manage-panel` was found already in use by the Leads list's unrelated read-only history panel. Repurposing that shared class for the new popup would have silently changed Leads' behaviour too. Avoided by giving the new popup its own class, `.contact-row-menu`, rather than reusing the existing one. **General rule: check whether a CSS class name is already used elsewhere in the app before repurposing it for new behaviour on a different screen**, a shared class name is an implicit, undocumented coupling between two features that may have nothing to do with each other.

- **A second real-use testing pass, 2026-08-15, found six separate issues on Test Bed's Reference tab and Opportunity's Duration handling, all real, all confirmed against live data or a real reproduction, not inferred.** Summarised together since they came from one testing session:

  1. `summary` was missing from `TEST_BED_WRITABLE_KEYS`, added when the field was built during the Reference tab rebuild but never added to the allowlist. Every Summary save was silently rejected. Fixed.
  2. `tb-save-feedback`'s error text was never cleared except by a fresh save attempt, so a resolved, past error kept reappearing every time an unrelated field was opened, making a one-time failure look like a persistent, unfixable one, and forcing Cancel as the only apparent way out. Fixed, cleared on Cancel and on opening any new field.
  3. **Real data-integrity finding, not hypothetical:** `estimatedInstallationDate`, `estGoLiveDate`, and `testBedDuration` had zero format validation, client or server. A real, live Test Bed (`TT-SGP-MANUFI-001`) had genuinely saved `estGoLiveDate: "affdsd01/01/25"` and `testBedDuration: "as"` through completely normal use, no rejection anywhere. Corrected to real values confirmed directly with the business (Est. Go Live 2027-02-15, Duration 3 months) once the fix below made a real save possible again. **Scan found the same gap on Opportunity's Key Dates card too** (`actualClose`, `estGoLive`, `actualGoLive`, `duration`), not just the two fields originally reported, confirming the "check whether a gap is wider than the one instance reported" discipline this document has needed repeatedly. All 7 fields fixed with real client (native date/number inputs) and server-side validation (`src/lib/field-validation.js`, real 400 rejection on garbage values, confirmed against direct API calls bypassing the client entirely). **Test Bed's Site Details numeric fields (camera/sensor counts, per-unit costs) have client-side `type="number"` but were not confirmed to have the same server-side rejection, flagged, not fixed in this pass.**
  4. **`formatCost()` was a single hardcoded-GBP function**, not backed by any real currency field anywhere in the schema, used in 4 places across Test Bed and Opportunity. Changed to USD, matching the prototype's own "Hardware Costs (USD/Unit)" convention and this document's existing Deal sheet (USD) references. **A real per-record currency field remains undesigned**, this is a hardcoded convention, not a schema-backed decision, related to the existing Base Cost Data entry above, both are the same underlying gap, a real admin-maintained rate/currency model that doesn't exist yet.
  5. **A genuine data-integrity risk found by accident, not by design, while testing item 3 above:** Opportunity's Reference tab (`duration`, Key Dates card) and Commercial tab (`duration`, Deal Sheet, feeds `calculateContractTotals` and `buildCashFlowModel` directly) are the same real value, legitimately editable from two places, but the Commercial tab saved its entire form as one blind snapshot sourced from whatever was in the DOM, which could be stale if Duration changed elsewhere in the same session without a reload. Reproduced live: edit Duration on the Reference tab, then save anything on the Commercial tab without reloading, and the earlier edit was silently reverted, with no audit trail. **Not a shared-key bug, the shared key is correct, these two screens genuinely edit the same concept.** Fixed by adding a freshness check to the Commercial tab's save: untouched Duration is now excluded from its payload entirely rather than resubmitted from stale DOM state; a genuine edit fetches the current server value first and only proceeds if it still matches what the tab loaded with; a real conflict (both screens edited it since either one last loaded) is refused outright with a message to reload, never silently resolved either way. All three paths, untouched-preserved, genuine-edit-with-audit-trail, and genuine-conflict-refused, verified with real revision-history evidence, including confirming a refused save genuinely never reaches the database. **General pattern worth remembering: any screen that saves its entire form as one snapshot, rather than only the fields the user actually touched, risks silently overwriting something edited elsewhere since that screen last loaded. This was fixed for Duration specifically, other fields on the Commercial tab's same whole-form save were not audited for the same risk and should not be assumed safe.**
  6. `TT-SGP-MANUFI-001`'s corrupted values were corrected as a real, deliberate revision once the validation fix made a genuine save possible, not a silent database edit bypassing the normal save path.

- **App-wide layout fix, 2026-08-15: content was centered rather than anchored to the sidebar, and the gap grew unboundedly with viewport width.** `.wrap`'s `margin: 0 auto` centered every screen's content in whatever space remained after the sidebar, rather than anchoring it, confirmed by direct measurement to leave over 1,150px of dead space either side of the content on a 3440px display, versus the prototype's own consistent, tight gap from the sidebar edge. A related bug compounded it: `.wrap`'s padding was a percentage calculated against the wrong containing block (`.app-content-scroll`, which grows with viewport, not `.wrap`'s own capped width), so usable content area actually shrank relative to wasted space as screens got wider, the opposite of what padding should do. **Fixed by replacing `margin: 0 auto` with a fixed `margin: 0 0 0 24px` and the percentage padding with a fixed `padding-left: 62px`, consolidated into the shared `.wrap` rule rather than duplicated per view.** Verified with real `getBoundingClientRect()` measurement across all 8 views at 1240px, 1920px, and 3440px, landing on an identical, flat 86px gap from the sidebar at every width and every screen, zero growth with viewport. **A genuine, unrelated bug found as a side effect of the consolidation**: Contact detail had been silently inconsistent with every other view the whole time, a flat 62px gap (an accident of never having had its own margin rule, `margin: 0 auto` resolving to 0 when its `max-width: none` filled the container) versus every other screen's viewport-dependent gap. Now resolved to the same 86px as everywhere else, a real fix, not assumed away as a side effect.

- **A third real-use testing pass, 2026-08-15, found one real repeat-gap and shipped one new feature.**

  1. **The note-text wrap-alignment issue was flagged in the very first feedback pass of this project and was never actually fixed**, confirmed by direct CSS inspection and git history, not assumed. A wrapped note's second line fell back to the row's own edge rather than aligning under the first line's actual text start. Fixed by rebuilding `.ref-notes-row` as a flex row with the timestamp/author as a `flex-shrink: 0` item and the note text as its own flex box, verified with real `getClientRects()` measurement across all wrapped lines of a real note. Since `.ref-notes-row` is shared CSS, used identically by Test Bed, Opportunity, and Contact notes, the fix applied app-wide the moment it landed, not just on the screen it was reported from. **Worth naming the process gap, not just the CSS one: an item flagged in an early feedback pass sat unfixed for the rest of the day without anyone tracking that it was still open, until it was reported a second time as if new.** Feedback items that don't get an explicit fix-or-defer decision recorded somewhere are easy to lose this way.

  2. **New: a linked-records count and pre-creation warning, Contacts list only** (Leads was explicitly excluded, since Test Beds/Opportunities can only be created from a Contact, not a Lead, so a count there wouldn't mean anything). Counts records where the specific Contact has a `record_contacts` row, matched on `(record_id, contact_id)` only, **deliberately not filtered by role string**, a real gap found during scoping: creation-time links are written with role `'commercial buyer'` (lowercase, `linkContact()`), while the later buyer-assignment UI uses capitalized role names (`'Client Commercial Buyer'` etc.), a genuinely different value for what is conceptually the same kind of link. **Any future query counting or filtering `record_contacts` by role needs to know these two naming conventions coexist and don't match each other as strings.** Clicking a non-zero count opens a shared list of the linked records by name, each clickable to its own detail page via the existing `navigate(view, id)` mechanism, deliberately not a filtered list view, which doesn't exist yet and wasn't built for this, the same small list component is reused for the pre-creation warning (creating a second Test Bed/Opportunity for a Contact who already has one shows the existing one by name, does not block creation, matches this session's earlier decision to always inform rather than block where the underlying action is legitimate). Built as a genuine third dialog, `#linked-records-modal`, not a repurposing of the existing discard-confirm or delete-confirm modals, consistent with why the delete-confirm dialog was built separately from the discard dialog earlier in this project.

  3. **The `record_contacts` ambiguous-FK risk (the same shape that caused a real bug in Milestone 5) was checked for proactively this time, before shipping, not found after.** The new Contacts-list query explicitly named `records!record_contacts_record_id_fkey`, since `record_contacts` has two foreign keys to `records`, an unqualified embed would have been ambiguous. Worth noting as a positive confirmation that the general rule recorded from Milestone 5 is actually being applied in new code, not just a historical lesson.

  4. **Known, flagged, not fixed: Test Beds are named after their linked Account** (`accountName ?? 'New Test Bed'` at creation), so multiple Test Beds under the same Account display with identical names in any list, including the new linked-records modal. Pre-existing behaviour, not caused by this feature, but this feature makes the ambiguity more visible, a list meant to help distinguish between records that all show the same name is only partly doing its job. Needs a real decision, not a quick fix, e.g. distinguishing by creation date or region, or letting users name Test Beds explicitly at creation rather than always inheriting the Account name. **Fixed, Round 5 Phase 2, 2026-08-17, see the dedicated write-up below - this note is kept as the historical record of when the gap was first found, not deleted.**

- **Round 2 build brief, Phase 7, 2026-08-15: Owner/Authority duplication resolved, and a genuine data-model gap found underneath it.** Building Test Bed's 3-panel Reference tab rebuild surfaced two independently-built, unreconciled field sets both answering "who's internally responsible": `commercialAuthority`/`technicalAuthority` (Reference tab, prototype-accurate, holding real data) and `terminusCommercialOwner`/`terminusTechnicalOwner`/`terminusLegalOwner` (Site Details, built later, empty on the one real record). **Resolved: Terminus Details now reads Commercial/Technical Authority from the original, data-holding fields, Legal Authority from the relabeled Owner field (the only place a Legal concept existed for Test Bed at all), and the two now-orphaned Owner fields were removed entirely, not left as dead duplicates**, confirmed via a full-codebase grep before deletion that nothing else referenced them. Real data confirmed intact after the rename, the live Test Bed's actual Commercial/Technical Authority values survived unchanged. **General lesson, same family as the `record_contacts` role-string mismatch below: two people (or two sessions) can build correct-looking, independently-tested solutions to the same underlying question without either being aware the other exists, when nothing defines the concept as one thing with one canonical field set.** A `Terminus_Role_Definitions.docx` reference table was produced recording every role field, where it's used, and its actual (versus assumed) connection to workflow gating, with honest confidence flags on anything not independently build-verified.

- **Known gap, found during Phase 7, not fixed: Test Bed's save flow writes no per-field Notes History entries at all**, unlike Contact and Opportunity, which log an entry on every meaningful field change. Not a regression, a pre-existing characteristic that only surfaced because Phase 7 went looking for historical "Owner"-referencing notes and found the category doesn't exist for this record type. Worth deciding whether Test Bed should be brought in line with the other two record types, since an audit trail that exists on two record types and not a third is the kind of asymmetry that causes real confusion later, e.g. "why can't I see who changed the Estimated Go Live date" on a Test Bed when the same question is answerable on an Opportunity.

- **Confirmed design, not yet built: a structured, catalog-backed buyer-role model for client-side contacts, replacing the current mix of hardcoded fields and free text.** Prompted by a real product question, whether Test Bed and Opportunity need the flexibility to track a fuller buying committee (large council or enterprise deployments can genuinely involve eight or more distinct roles: economic buyer, procurement, technical evaluator, legal, data protection officer, IT/security, finance, and for public sector specifically, an elected member or cabinet sponsor for anything above a spend threshold), while a Test Bed pilot typically only needs one or two. Confirmed three-tier model:

  1. **Mandatory core**: Commercial, Legal, Technical, always the same three, always sourced from a controlled vocabulary, never free text, since these gate stage transitions (already true for Test Bed's Qualification exit) and must be reliably queryable. **Building this for Opportunity too closes the long-standing, already-documented inconsistency** where Test Bed's client-buyer roles are real, validated relationships and Opportunity's equivalent fields are still plain free text.
  2. **Additional roles**: selected from an admin-curated catalog, a new table (`record_type`, `role_name`, sort order), same governance pattern already used for `industries` and `stage_definitions`, admin-only, deliberate additions, not something salespeople extend themselves mid-deal. Seed list drawn from real council/enterprise buying-committee patterns: Economic Buyer, Champion, Procurement, Technical Evaluator, Data Protection Officer, IT/Security, Finance, Elected Member/Cabinet Sponsor. Informational by default, not gating anything, though a future decision could add gating to a specific catalog role if a real need shows up.
  3. **Escape valve**: free text, typed directly on the specific deal when nothing in the catalog fits. **Confirmed: still a real, structured `record_contacts` relationship, clickable through to the actual Contact, just with an unconstrained role name** rather than a lighter, disconnected note. Accepted, deliberate trade-off: escape-valve roles won't be reliably groupable or countable across different deals, since spelling won't be consistent, the same category of limitation already documented for the `record_contacts` role-string mismatch elsewhere in this file, not a new kind of problem, an accepted instance of an already-known one.

  Not scoped or built. Real work when picked up: the `buyer_role_types` table and its admin surface, migrating Opportunity's existing free-text buyer fields onto the new model, and the three-tier selection UI (mandatory dropdown, catalog picker, free-text fallback) on both Test Bed and Opportunity.

- **Client Buyer linking, 2026-08-16: batch-save added without changing the underlying atomic-link design.** Investigated first, per-role immediate linking (one "Link" click per field, rather than the batch-edit-then-Save pattern used everywhere else) was confirmed deliberate, not drift: `contact_role_linked` gates a real stage transition, the code groups this explicitly with three other similarly-atomic actions (Sensors, Use Cases, Install Notes), and `POST /test-beds/:id/buyer-contacts` is inherently single-role-per-call with unambiguous per-field validation. **Rather than rebuild the endpoint or accept the friction, a shared Save action was added on top of the unchanged endpoint**: fires the existing single-role call once per dropdown with a selection, reports success/failure per field, so one invalid selection doesn't block or obscure the others that succeeded. Kept the atomicity the investigation correctly identified as worth preserving, removed only the repeated-click friction.

- **Terminus staff directory, 2026-08-16: a real, small reference table, same governance pattern as `industries`/`stage_definitions`.** Free-text Terminus Lead and Commercial/Technical/Legal Authority fields replaced with a dropdown sourced from a new `terminus_staff` table (name, title), seeded with the 7 real staff names via migration, `GET`-only API, no admin UI, same explicit "edited directly via Supabase's editor for now" deferral already used for `industries`. **Two known-wrong values on the live Test Bed** (`commercialAuthority`/`technicalAuthority` holding client-side names, "Boon Sain"/"Ryan Wan", mistakenly entered into Terminus-only fields) were confirmed as test data, not real production values, and cleared deliberately as part of this change, logged to `audit_log` with the reasoning, not silently dropped.

  **A real, previously-invisible bug found and fixed as a side effect**: `refFieldRow` (Opportunity's field-rendering function) was missing the leading blank `<option>` that Test Bed's equivalent already had. An unset field's edit-mode dropdown would silently pre-select the alphabetically-first option rather than showing genuinely blank, read-only display was always correct so this was invisible until someone actually opened the field to edit it, a real risk of accidentally assigning a value by clicking Save without touching the field. Fixed for all fields using `refFieldRow`, confirmed by checking every field routed through it, not just the 4 new staff dropdowns, and this incidentally fixed the identical latent bug already present on Opportunity Type.

- **Opportunity Reference tab, 2026-08-16: Account folded into Customer Details, and a real gap in Phase 7's own "confirmed" sign-off surfaced along the way.** Account, previously a standalone panel with a dedicated "Link to Account" button, now renders as Customer Details' first field row, same `.ref-field-display`/`.ref-field-edit` click-to-edit shape as every other field on the tab, no new interaction model. The existing search-existing/create-new Account mechanism was preserved unchanged, confirmed genuinely isolated from any shared code path (unlike the `refFieldRow` case above) before the fold, so no hidden regression risk existed here.

  **Building this exposed that Test Bed's own 3-panel Reference tab, built in Phase 7 and marked complete, does not actually achieve a single row.** Key Dates wraps to its own second row on Test Bed at every tested width, confirmed live, unchanged. Phase 7's original verification checked card width capping (correct, 420px) and label/value clipping (none), but never checked row-alignment, the literal thing "three panels in a single row" means, so this was recorded as fully confirmed when it was only partially verified. **Not fixed here** (out of scope for Opportunity-specific work, Test Bed's CSS deliberately untouched), left open, tracked here rather than silently rediscovered later. **General lesson: a phase's "confirmed" status is only as good as what its test evidence actually checked, not what the phase's stated goal claimed. Verification should be checked against the specific claim being signed off, not assumed complete because related things were tested.**

  Opportunity's own single-row fix required a real width-cap value, not copied from Test Bed's 420px. **Two independent causes found before landing on a correct number**, both confirmed by direct measurement, not assumed: `.wrap`'s `padding-right: 5%` resolves against its containing block's width, not its own capped width, making available content width non-monotonic across viewports (narrowest at 1240px, not at the narrowest tested viewport, counter to intuition); and CSS Grid's `auto-fit` sizes prospective tracks at the `minmax()` maximum when it's a definite length, not the minimum, so a cap even a fraction of a pixel too generous silently drops a column rather than degrading gracefully. Final value (284px) computed against the genuinely tightest real case with a safety margin, not tuned by trial and error against one viewport and hoped to hold at the others.

  **Superseded the same night, Round 3.** Opportunity's Account field was made read-only and inherited (matching Test Bed exactly), removing the interactive linking panel that made real names truncate to 2-3 lines at the narrow 284px cap. The page then received the same `max-width: none` wide-layout treatment Contact detail already has, and the panel cap reverted to Test Bed's 420px. The 284px value above was correct for the goal it was given at the time, it just turned out that goal, forcing three panels into a still-1240px-capped page, was itself the wrong target. Left here as the historical record of a real, well-reasoned fix that got overtaken by a better architectural decision, not deleted.

- **Round 3, 2026-08-16: Account architecture completed, Opportunity brought to parity with Test Bed, and a genuine process failure caught and corrected mid-round.**

  1. **Account architecture finished.** Lead's standalone Account panel removed. At qualification, the existing search-existing/create-new Account reconciliation panel (already built, reused directly, not rebuilt) now auto-opens whenever `parent_record_id` is among Qualify's blocking fields, pre-filled from the typed Company text, resolved as part of qualifying rather than a separate step afterward. Contact Details' "Company" row now displays "Account", the real linked relationship, not the old free-text field. **This is now the second documented exception to the error-summary pattern in `INTERACTION_STANDARDS.md`** (Park was the first): qualification's real-time field highlighting stays as-is, but Account specifically gets an auto-opened action panel, since resolving it requires a genuine reconciliation step, not just data entry, the same reasoning that made Park an exception in the first place.

  2. **Opportunity's Account made read-only and inherited, matching Test Bed exactly**, removing the interactive linking panel built and twice fixed earlier the same night (the dirty-edit guard, the row-click-to-commit simplification), both now moot since there's nothing left to click. Prompted by a direct product question: why does Test Bed treat Account as a fixed, inherited fact while Opportunity treats it as independently re-linkable, when both already auto-populate `account_id` from the originating Contact at creation. Resolved in favour of consistency, one Account decision, made once, at conversion, not a separately-editable relationship on every downstream record. Known, accepted trade-off: no escape valve if a Contact's Account link was wrong or missing before an Opportunity was created from it, same accepted risk Test Bed already carries.

  3. **Opportunity brought to parity with several Test Bed and Contact patterns already proven this build**: Opportunity Name made editable (was static text with no save path at all). Buyer Roles (Technical/Commercial/Legal/IT-Security) became real Contact-search dropdowns, filtered to Contacts linked to the Opportunity's own Account, direct port of Test Bed's Client Buyer mechanism, confirmed small scope, not the full mandatory-core/admin-catalog/escape-valve design discussed earlier the same night, that stays separate, unscoped future work. Est. Close Date's separate "Edit" link and always-present form removed; it's a plain field in the generic click-to-edit flow now, with the mandatory-reason dialogue and Est. Close Date Moves counter still firing automatically on a real detected change at save time. **That dialogue's first version was missing the full Park-style focus trap**, caught and fixed to match `INTERACTION_STANDARDS.md` Section 4 precisely (single Escape owner, attached/detached per open cycle, Tab cycling confined to the dialogue's own three elements), not a narrower, dialogue-specific version. **Verified empirically, not just reasoned about, that cancelling this dialogue does not discard an unrelated dirty field edited in the same session** (the exact bug class found and fixed multiple times earlier this build), proven by dirtying two fields, cancelling, and confirming both survived, then genuinely re-saving both to confirm the surviving state wasn't inert leftover DOM.

  4. **Commercials tab, two real rendering bugs found and fixed, one deliberately not applied elsewhere.** The Deal Summary matrix's value columns, ported verbatim from the prototype's literal pixel widths, genuinely overflowed ("Installation (USD)" spilling into "Total (USD)", confirmed by `scrollWidth` exceeding `clientWidth`), fixed by widening the columns. The Hw/Hosting Setup cards had the identical unbounded-`1fr` construct already found and fixed on `.ref-cards`, capped the same way. **The cap-and-`justify-content:start` technique was deliberately not applied to the matrix's label column**, considered and rejected: it would have detached right-aligned values from their own box border, a worse result than the gap it would have "fixed." Worth recording as a real instance of a proven pattern correctly not being reused just because it worked elsewhere.

  5. **Numeric field validation: built too broadly on the first pass, corrected after direct confirmation.** All numeric fields on the Commercials tab were initially made integer-only in one blanket pass. This broke the factoring rate's own default (1.5%, non-integer) immediately, confirmed live, a real bug caught by the blanket rule's own side effect. **Corrected scope, confirmed explicitly, field by field, not assumed**: percentage/rate fields (`targetMargin`, `warrantyPct`, `whtPct`, `gstPct`, `factoring.ratePct`, all 11 `marginOverrides.*` fields, and later `lumpSumCost` and milestone USD amounts once currency precision was also confirmed needed) now allow non-negative values to 2 decimal places. Genuine counts (unit counts, month counts) stayed integer-only. **General lesson: applying one blanket rule "across the board" to a UI with genuinely different field types (counts vs. rates vs. currency) needs the categories confirmed explicitly before building, not assumed from a single instruction's literal wording**, especially when real financial precision is at stake.

  6. **Submit Deal removed after a genuine dependency check**, confirmed no `stage_gate_rules` row references it, nothing reads its audit action, no transition or approval routing was ever wired to it. Backend endpoint left untouched, in place for whenever a real submit/approval workflow gets designed.

  7. **A genuine process failure, worth recording precisely, not glossed over.** "Round 3 is closed" was declared twice, once after the Commercials tab work, once after the currency-precision follow-up, while 2 of the brief's 6 phases (the Installation tab's per-unit pricing table, and the new Structural Terms currency fields) had never been built, tested, or even mentioned. Caught only because the phase count was checked explicitly against the original brief rather than trusting the closing language. **This is the same failure shape as Phase 7's row-alignment gap** (a "confirmed" status not actually matching what was verified), just one level up, a **round-level** completeness claim rather than a single test's coverage claim. Once caught, both missing phases were built properly: the Installation tab's Cost/Price columns were a genuine wiring gap, not a missing calculation, the same cost/price engine already driving the Hw/Hosting cards was already computing correct totals, just never rendered into this one table's rows. Structural Terms' new Currency card was built alongside a full, deliberate 3-card restructure (matching a real, pre-existing gap between the live flat layout and the prototype's actual 3-card structure), a scope decision explicitly raised and confirmed before building rather than assumed. **General lesson: "done" or "closed" language should be checked against the actual original scope (the brief's own phase list, a milestone's own stated requirements) before being said, not asserted from a sense that the recent work felt substantial.** A large amount of real, correct work does not by itself confirm completeness against a checklist that was never re-read.

- **Round 5 Phase 1, 2026-08-17: modal sticky headers.** New Lead and Account Details (the only two dialogues using `.modal-panel-wide`, confirmed by a full grep of every frontend file, not assumed) both lost their title row entirely once scrolled, `.modal-panel-wide` is itself the scroll container, and the header was just its first, unpinned child. Fixed with one shared class, `.modal-header-sticky` (`frontend/style.css`), applied to both dialogues' header rows - `position: sticky; top: 0` with an opaque background and a hairline separator. Verified live, real before/after screenshots and DOM measurement: scrolled each dialogue to its genuine bottom (confirmed via `scrollTop`/`scrollHeight`, not assumed from a fixed scroll amount) and measured the header's offset from the panel's own top edge at rest versus after scrolling - identical both times (25px, matching the panel's own padding), proving it's genuinely pinned rather than coincidentally positioned. Checked explicitly whether the fix's scope should extend further: the other 5 `.modal-backdrop` dialogues (`cd-park-form`, `ref-closedate-form`, `discard-confirm-modal`, `confirm-delete-modal`, `linked-records-modal`) all use plain `.modal-panel`, which has no `max-height`/`overflow-y` of its own anywhere in `style.css`, and are all short enough (2-6 fields) that none need scrolling - `linked-records-modal`'s own internal scroll region (`#linked-records-list`) is scoped to a sibling below the header, not a wrapper around it, so it can't carry the header away either. Confirmed this fix's scope is genuinely limited to the two dialogues it was built for.

- **Round 5 Phase 2, 2026-08-17: Test Bed duplicate-naming bug, closes the Round 2 Phase 7 gap above.** Every Test Bed created from a Contact inherited the identical, unsuffixed linked Account name (`accountName ?? 'New Test Bed'`), so "Add Another" created a second Test Bed indistinguishable by name from the first, confirmed as a real, now-common problem rather than a theoretical one now that repeat creation is an easy, one-click action. **Investigated before building, per the brief's own instruction:** considered the brief's two suggested approaches, appending a sequence number versus requiring/prompting a name at creation. Checked whether Test Bed's `name` field has any editable UI today (the natural "fix it after" escape valve) and confirmed it does not - unlike Opportunity's own equivalent field, made editable in Round 3, Test Bed's `name` is server-writable (`TEST_BED_WRITABLE_KEYS`) but carries no edit affordance anywhere, so a name chosen badly (or skipped) at creation could not be corrected later the way Opportunity's could. **Wording corrected, Round 10 Phase 0, 2026-08-19: this entry originally said `name` was "never rendered anywhere in `test-bed-detail.js`'s field set", and the Round 10 brief repeated it as "never rendered". The accurate statement is rendered read-only with no edit affordance.** `name` IS rendered, as a plain `<h1 id="tb-detail-name">` set via `textContent` (`app.js`), confirmed live in the browser: no `onclick`, no `tabindex`, and no `.ref-field[data-key="name"]`, `tb-display-name` or `tb-input-name` exists anywhere in the DOM. What is absent from every field array is the click-to-edit control, not the display. The reasoning above is unaffected, there is still no escape valve, but the distinction matters to anything that has to update the name on screen, because the header element already exists and is the thing to update rather than something to build. This ruled out a lightweight, skippable name prompt as a safe choice and left automatic sequencing as the only option that guarantees a distinguishing name unconditionally, also the better fit with this build's repeated "no friction at fast entry" precedent (free-text Company, autocomplete-only Lead entry, and so on) - a name-prompt modal would have added a real interruption to what is today a single click. **Built**: `POST /contacts/:id/create-test-bed` (`src/routes/contacts.js`) now counts existing non-deleted Test Beds under the same Account before naming a new one - the first keeps the clean, unsuffixed Account name, each subsequent one gets `" (N)"` appended. Deliberately a plain count-then-suffix, not the atomic `TT-` reference-number generator: this is a display-only label with no uniqueness constraint anywhere, unlike `reference_code`, so a rare race between two simultaneous creates producing the same suffix is a cosmetic possibility, not a data-integrity risk, and doesn't justify that mechanism's heavier atomic-counter machinery. "Add Another" renamed to "Add New" (`frontend/app.js`), the brief's own explicit instruction, done alongside the fix since "Add Another" implied "another one just like it," exactly the behaviour being corrected. **Verified live**, real API and real browser click-through, not inferred: created 3 Test Beds in sequence for one Contact/Account via the real endpoint, confirmed names `"R5P2 Account ..."`, `"R5P2 Account ... (2)"`, `"R5P2 Account ... (3)"` - all genuinely distinct. Separately, drove the real UI path (`window.onContactCreateClick`, the actual "+ Create" entry point) for a second creation on the same Contact, confirmed the linked-records modal's proceed button now reads "Add New," clicked it for real, and confirmed via a fresh server-side fetch that exactly 2 Test Beds existed under that Account afterward with genuinely distinct names. **Noted, not fixed, out of this phase's scope**: Opportunity's own creation path (`POST /contacts/:id/create-opportunity`) has the identical unsuffixed-Account-name pattern, but wasn't in this phase's brief and, unlike Test Bed, already has a real escape valve since Opportunity Name is editable post-creation (Round 3) - the same risk, but a materially different consequence if left unfixed, not silently expanded into scope here.

- **Round 5 Phase 3, 2026-08-17: Account linking button label, and a new view-only "Show Account Details."** Two changes to Contact detail's Account card (`frontend/index.html`, `frontend/contact-detail.js`), both from that phase's own brief: (1) `cd-btn-link-account`'s label now reflects the real state, "Link to Account" while unlinked, "Change Account" once something is - previously a fixed string regardless of state, describing an action ("link") that no longer matched what clicking it would actually do once an Account already existed. (2) A new "Show Account Details" button, visible only once linked, opens the same Account Details panel Round 4 built for creation, this time populated with the real, currently-saved values of the linked Account (`GET /accounts/:id`, not the Contact's own cached `accountsCache` entry, which only carries the name) and switched into a genuine view-only mode via a new `setAccountDetailsMode()` helper - every field disabled, Save hidden, Cancel relabelled "Close," Parent Account shown as a resolved fact rather than a search box. Both modes render through the exact same DOM/fields, not a second template, so they can't structurally drift apart; `openAccountDetailsModal` (the Round 4 create path) now explicitly resets to create-mode on every open, so no view-mode leftover state (disabled fields, hidden Save) can bleed into a later create flow, confirmed by real test - opened view mode, closed it, then drove the real create-new-Account flow and confirmed every field was genuinely re-enabled, Save visible, and the heading/Cancel label back to their create-mode text.

  **A real, severe pre-existing bug found and fixed while building this, not part of the phase's own brief.** `validateParentAccountId()` (`src/routes/accounts.js`, Round 4 Phase 3) checked `parent.parent_account_id === accountId` for the direct A↔B cycle guard. At Account **creation** (`POST /accounts`), `accountId` is `null` - the new record has no id yet - so this check silently evaluated `null === null` and returned `true` whenever the chosen Parent Account had no parent of its own, the single most common case, rejecting every normal Parent-Account-at-creation attempt with a false "direct circular reference" error. Round 4's own test evidence never caught this because every Parent Account test it ran used `PATCH` on an already-existing Account (a real, non-null `accountId`), never `POST /accounts` with `parent_account_id` set directly at creation - a real gap in that round's coverage, not a regression introduced since. The existing code comment claiming this was "harmless, `parent_account_id` can never equal an id that doesn't exist yet" was correct for every other case but hadn't accounted for `null === null` specifically. Fixed by guarding the check on `accountId` being truthy, confirmed live both ways: a Parent Account with no parent of its own is now correctly accepted at creation, and a real A↔B cycle attempted via `PATCH` on two already-existing Accounts is still correctly rejected, unchanged.

  **Verified live**, real browser + API, not inferred: unlinked state shows "Link to Account" with Show Account Details hidden; linking a real Account switches the label to "Change Account" and reveals Show Account Details. Clicking it opened a modal showing the exact real values of that specific Account - name, Account Number (`reference_code`), Website URL, genuinely distinct Billing and Shipping addresses, and a real linked Parent Account - confirmed by seeding a target Account with unique values in every section plus an unrelated decoy Account, then confirming the decoy's name appeared nowhere in the rendered view. Every field confirmed genuinely disabled, Save hidden, Cancel reading "Close." Escape closed the view and returned focus to the Show Account Details button that opened it, matching `INTERACTION_STANDARDS.md` Section 4's own focus-return requirement.

  **Given the bug's severity, one further precise test before sign-off**: drove the real UI end to end for the exact previously-broken case - a genuinely new Account, created via the real Account Details create form (not a direct API call), with a real, existing Parent Account selected through the actual search field and click, where that parent itself has no parent of its own. Saved for real via the Save button, confirmed no error in the UI, then verified directly against the database (not inferred from the UI's silence) that the new Account's `parent_account_id` column held the exact, correct Parent Account id, `record_type` was `account`, `deleted_at` was `null`, and the payload name matched what was typed - the fix confirmed at the data layer, not just "the UI didn't complain."

- **Round 5 Phase 4, 2026-08-17: Test Bed's own Key Dates validation, mirroring Round 3 Phase 3's identical Opportunity fix.** Investigated first, per the brief: Test Bed's `TB_DATE_FIELDS` (`frontend/test-bed-detail.js`) is only ever `estimatedInstallationDate`, `estGoLiveDate`, and `testBedDuration` - unlike Opportunity, which has both estimate fields (`estClose`/`estGoLive`, restricted) and actual fields (`actualClose`/`actualGoLive`, deliberately not restricted, since they record something that already happened), Test Bed has no "actual" counterpart date at all. Both existing date fields are estimates, so both get the identical past-date restriction, nothing needed excluding. Confirmed `testBedDuration` still had zero negative/fractional guard and no `.no-spinner` treatment - the earlier 2026-08-15 real-use-testing fix (`DESIGN_PRINCIPLES.md`, the "second real-use testing pass" entry above) only gave these fields *format* validation (rejecting a garbled non-date/non-number string), never the separate *past-date*/*non-negative-integer* restrictions Round 3 Phase 3 later built for Opportunity - a genuinely different, later fix that was never carried over to Test Bed, exactly as the brief described.

  **Built, mirroring the existing Opportunity mechanism exactly, not a second implementation**: `isNotPastIsoDate`/`isValidNonNegativeInteger` (`src/lib/field-validation.js`, already shared, built for Opportunity) are now also called from `PATCH /test-beds/:id` (`src/routes/test-beds.js`) for `estimatedInstallationDate`/`estGoLiveDate` and `testBedDuration` respectively, replacing the old permissive `isValidNumber` check on Duration. Client-side, `tbFieldRow()` (`frontend/test-bed-detail.js`) gained the identical `noPast`/`integer` option handling `refFieldRow()` already had for Opportunity - a `min` attribute set to today's date on restricted date inputs, and `min="0" step="1" class="no-spinner"` (the already-shared CSS class) on Duration. A real, easy-to-miss gap caught while wiring this in: the render call site building `TB_DATE_FIELDS`'s row (`renderReferenceTab`) explicitly constructed its own `opts` object rather than spreading the field definition, so it would have silently dropped `noPast`/`integer` even with everything else correctly built - fixed by passing them through explicitly.

  **Verified live**, both server (direct API, bypassing the browser entirely) and client (real browser field attributes): a past `estimatedInstallationDate` and a past `estGoLiveDate` were each rejected server-side with an explicit error, a future date for the same field was accepted; a negative and a fractional `testBedDuration` were each rejected server-side, a valid non-negative integer was accepted and confirmed persisted via a fresh fetch. In the real browser, both date inputs carried `min` set to the current date, and the Duration input carried `min="0"`, `step="1"`, and the `.no-spinner` class.

- **Round 5 Phase 5, 2026-08-17: Test Bed Reference page consolidation, the largest layout change this round.** Site Details' entire former tab (`frontend/index.html`'s `#tb-tab-site-details`) folded directly onto the Reference tab, per a real mockup (`round5_reference_layout_mockup.png`, provided mid-phase after the brief referenced one that hadn't actually been shared yet - flagged and confirmed before building rather than guessed at, a rough panel-grouping reference, not literal positions, per its own caption). A real scope gap was raised and confirmed with the business before building: the mockup's own Site Details panel only lists 5 fields (Site Ownership, Installation Environment, # SafeSight, # Air Quality, # HEMIR), narrower than the existing tab's full content (also Site Address, City, Installer, Test Bed Tech Team, Install Notes, and a generated Sensors list). **Confirmed: nothing is dropped** - all of it stays together in the one consolidated Site Details card. The only fields genuinely relocating out are `estCostPerUnit`/`indicativeCost`, to Phase 6's Commercials tab, which replaces them with real, itemized calculated totals rather than plain typed numbers - removed from this panel's rendering now (not carried forward as a dead duplicate ahead of Phase 6), kept as writable payload keys server-side since Phase 6 is the very next phase in this round, not a schema change.

  **Layout mechanism: one shared `.ref-cards` grid, not a bespoke two-row layout.** All 6 cards (Terminus Details, Customer Details, Key Dates, Site Details, Use Cases, Exit Criteria) live in the same `.ref-cards` container, reusing the exact existing `auto-fit`/`minmax(280px, 420px)` reflow already proven on Contact detail and Opportunity's Reference tab - zero new grid CSS. Key Dates stays immediately after Customer Details (it already was, unchanged); Site Details, Use Cases, and Exit Criteria continue the same row as width allows and wrap naturally at narrower viewports. **A real, previously-hidden gap found and fixed while wiring this**: `#view-test-bed-detail` had never received the wide-layout treatment (`max-width: none; padding-right: 62px`) Contact detail and Opportunity detail both already have - without this fix, the page stayed capped at `.wrap`'s base 1240px regardless of actual viewport width, which would have made "extend available screen width if needed" (the brief's own words) structurally impossible: six cards would just stack into more rows inside a fixed-width box at every screen size, never using a wide monitor's real extra space. Fixed with the identical rule those two pages already use.

  **Exit Criteria: reuses the real gate-check logic, never a second computation path, and never performs the transition itself.** The brief's own instruction taken literally: `computeBlocking()` was extracted, unchanged, from `POST /records/:id/transition` (`src/routes/transitions.js`) into its own exported function, called by both the real (mutating) transition endpoint and a new read-only `GET /records/:id/exit-criteria` (`src/routes/records.js`), which looks up the record's current stage's next stage via `stage_definitions.sort_order` and returns the exact same `blocking[]` a real transition attempt to that next stage would - without ever writing to `records.status`. Confirmed live that this is genuinely read-only: calling it repeatedly never changed a Test Bed's real stage. This is now the one and only gate-checking implementation in the codebase, not a third one - `GET /records/:id/stage-approvals` (built earlier for the now-being-removed Stage & Approvals tab) already re-derives its own separate plain-language criteria text independently, left untouched here since Phase 7 removes its only caller, not something to fix retroactively as part of this phase.

  **The "N fields open, M changed" banner: investigated first, confirmed the real trigger before touching it.** Read `updateTbSaveBar()` as it stood: the bar - including, unlike Opportunity's own equivalent, a fully clickable Save button - appeared the instant *any* field was opened, gated on `Object.keys(tbEdits).length`, not on any real change. Confirmed live before fixing: opening a field and leaving it untouched already showed a clickable "Save changes" button, the opposite of "opening a field... should have zero visible effect." Fixed by gating the whole bar's visibility on `dirtyCount` instead, and removed the count-text banner entirely (both the DOM element and the string it populated) - scoped to this page specifically, per the brief; Opportunity's Reference tab keeps its existing, different behaviour (bar shows on open, only its own Save button is dirty-gated) unless a future round asks for the same treatment there.

  **Verified live**, real API and real browser: `GET /records/:id/exit-criteria` on a fresh Test Bed at Qualification returned all 6 real outstanding requirements (3 buyer-role links, `testBedDuration`, `estimatedInstallationDate`, `estGoLiveDate`) with correct `from_stage`/`to_stage`, confirmed the Test Bed's actual status was unchanged afterward (genuinely read-only). Fixing 3 of those 6 fields via a real PATCH shrank the live list to exactly the remaining 3, confirmed by a second real call, not assumed from the fix alone. The real, mutating transition endpoint was re-tested after the `computeBlocking()` extraction and still correctly blocked with the identical reasons the read-only endpoint reported, a direct regression check, not just an inspection of the diff. In the real browser: the "Site Details" tab is gone from the tab bar, its former panel div no longer exists, and all 6 consolidated cards render with real content, including Install Notes and the Sensors list, both confirmed still present, not dropped. Opening a field with no edit left the save bar hidden and confirmed `tb-save-count` no longer exists in the DOM at all; a genuine edit made the bar appear with just Cancel/Save, no count text. Screenshots captured at 1240px (chevron strip labels visibly crowd the widest stage names here, confirmed via a direct before/after CSS-neutralising test to be pre-existing at this width regardless of this phase's own layout fix, not a regression it introduced, and out of this phase's scope to fix, the chevron strip is explicitly unchanged per Phase 7's own brief), 1920px (2 clean rows of 3 cards), and 3440px (all 6 cards fit a single row, confirming the wide-layout fix genuinely extends usable width, not just removes a cap with nothing to fill it).

  **Sign-off follow-up, same day**: asked to prove Cancel/Save still work exactly as before once the bar's own visibility trigger changed, and that removing `tb-save-count` was genuinely safe. Confirmed both explicitly, not just re-asserted: the fix touched only `updateTbSaveBar()`'s visibility condition, `tb-cancel-all`/`tb-save-all`'s click handlers and the functions they call were untouched, verified by re-reading them unchanged and by a real test - opened a field, typed a change, clicked Cancel, confirmed the field reverted and the change was never persisted server-side; repeated with Save and confirmed it *was* persisted. A full-codebase grep for `tb-save-count` afterward found exactly one remaining reference, the comment explaining its own removal - nothing else in the app ever read it.

- **Round 5 Phase 6, 2026-08-17: Test Bed Commercials tab, cost-only, reusing Opportunity's proven cost engine, replacing the old Site Details tab slot.** Confirmed scope: Test Bed is "cost to the business, no client billing" (Section 8), so unlike Opportunity's own Commercials tab there is no price or margin concept anywhere here, only cost, supporting a real go/no-go decision.

  **A real discrepancy found while investigating what "reuse the existing engine" actually meant, worth recording precisely.** This section's own Deal Sheet description (`record_type = 'deal'`, `parent_record_id` pointing at its Opportunity) does not match the actual live implementation: `loadDealInputsFromOpportunity()` (`src/routes/deals.js`) reads every Commercials-tab input, including the "Base Cost Data" rate fields (`ssUnitCost`/`aqUnitCost`/`hemirUnitCost`, install and hosting per-unit rates), directly off the **Opportunity's own** `record_revisions.payload` - there is no separate `record_type = 'deal'` row anywhere in the live schema or codebase, confirmed by grep, "Deal Sheet" is a UI concept over Opportunity's own payload fields, not a persisted child record. Deliberately not fixed mid-phase, per instruction - flagged here to be corrected properly in this round's own end-of-round documentation pass instead, alongside everything else, not mid-phase. **Fixed, Round 5 end-of-round documentation pass, 2026-08-17 - see Section 2's own corrected entries (the diagram bullet, the standalone Deal Sheet paragraph, the `product_defaults` table row, and the pipeline-forecast paragraph), this note is kept as the historical record of when the gap was first found, not deleted.** It directly shaped this phase regardless: the brief's "same logic computing Hardware/Hosting/Installation costs from Base Cost Data" names the real, currently-built three-group structure (`deal-calculator.js`'s `hardwareGroup`/`installGroup`/`hostingGroup`), not this section's older, unbuilt formula (which instead folds mount cost directly into "hardware cost" via a `product_defaults` table that was also never built - confirmed by grep, zero references anywhere). The real, live engine was the one to mirror.

  **Built**: `calculateTestBedCost()` (`src/lib/deal-calculator.js`) reuses `calculateHardwareAndWarranty()` and `buildCostGroup()` completely unchanged - the exact functions Opportunity's own `calculateDeal()` uses - stopping at cost, never calling `priceFromCost()`. Callers only ever read `*Cost`/`rawCost`/`rawTotalCost` fields; `buildCostGroup()` still computes a `rawPrice` internally as an unavoidable side effect of being shared with the priced Opportunity path, but nothing in the Test Bed code path reads it, confirmed by grep across `test-bed-detail.js` and `test-beds.js` - the only occurrence of the word "Price" in either file is the comment explaining this. Test Bed's own Installation group is 3 lines (SafeSight/AQ/HEMIR), not Opportunity's 4 - Test Bed's unit-count fields never carried Opportunity's existing-vs-new-infrastructure split, so a 3-line group is the genuinely correct shape for what this record type actually tracks, not a simplified copy of Opportunity's.

  **A deliberate, flagged departure from Opportunity's own convention**: Opportunity's rate fields are locked read-only after creation (a stopgap-on-a-stopgap, pending a real admin-maintained Base Cost Data table that doesn't exist yet). Test Bed's own rate fields (`ssUnitCost`, `aqUnitCost`, `hemirUnitCost`, `ssInstallCost`, `aqInstallCost`, `hemirInstallCost`, `ssHostingCost`, `aqHostingCost`, `hemirHostingCost`, `warrantyPct`) stay freely editable through the ordinary PATCH allowlist instead, via the exact same click-to-edit batch-save mechanism the Reference tab already uses (`TB_COST_FIELDS` folded into `TB_ALL_EDITABLE_FIELDS`, no new interaction pattern) - a genuinely new build with nothing historical to protect, so there was no reason to replicate a lock whose only stated purpose was protecting Opportunity's own already-live data.

  **`accumulated_cost` and `indicativeCost` are now server-computed, not client-writable** - removed from `TEST_BED_WRITABLE_KEYS` entirely, a direct client PATCH naming either is now rejected the same as any unrecognised field. `PATCH /test-beds/:id` recomputes both, via the one `buildTestBedCostBreakdown()` helper, on **every** save that touches the merged payload, not just ones that edit a rate field directly - a Reference-tab save (a unit count, Duration) affects the real cost exactly as much as a Commercials-tab save does, so both must keep these two fields genuinely current. Both fields always mirror the identical computed total now, not two independently-typed numbers that could drift apart (the brief's own "not separate, manually-implied numbers"). `GET /test-beds/:id` also live-recomputes the full itemized breakdown on every fetch (`costBreakdown`, never persisted itself), so the detail page's own display is never more than one PATCH away from stale even if the persisted mirror somehow lagged.

  **Verified live**, real API and real browser, an independently-written computation, not copied from the implementation, same standard as every other calculation verification this build has used: seeded real unit counts (5 SafeSight, 3 AQ, 2 HEMIR), real rates, 5% warranty, and a 6-month duration; hand-computed hardware ($9,900 including 1 warranty unit), installation ($1,390), hosting ($160/month × 6 = $960), total $12,250 - every line and the total matched the server's real response exactly. Confirmed `accumulated_cost`/`indicativeCost` both persisted as that exact total and stayed identical to each other; confirmed a direct client PATCH naming either field is now rejected outright; confirmed the Test Beds list view (a separate query, reading the stored payload directly) shows the same real computed figure. In the real browser: "Commercials" occupies the old Site Details tab-bar slot (position 2, right after Reference); the itemized breakdown renders with the correct real numbers; a rate field opens, accepts a real edit, and saves through the identical Reference-tab mechanism, confirmed by checking the saved value server-side (stored as the string the DOM's own `<input type="number">` produces, matching this codebase's already-established convention of accepting both string and number payload shapes for numeric fields, not a new pattern); confirmed no "price" or "margin" figure or label appears anywhere in the itemized breakdown or the rate-field labels (only occurrence of either word on the whole tab is the panel's own explanatory subtitle stating their deliberate absence).

- **Round 5 Phase 7, 2026-08-17: Test Bed tab bar restructured to 8 workflow-stage tabs, the single largest architectural change this round.** Final tab bar, confirmed intentional despite the real visual density the brief itself flagged: Reference, Commercials, then Qualification through Closed, 10 tabs total. The chevron strip stays exactly as it was, unchanged, a separate status indicator existing alongside the new tab bar, not replaced by it.

  **Investigated first, per the brief, before building.** `GET /records/:id/stage-approvals` (`src/routes/records.js`) already returns every stage's own criteria and approval tracks in one call, genuinely stage-scoped already - no backend change needed there, only a new *single-stage* rendering path client-side. `GET /test-beds/:id/document-requirements` (`src/routes/test-beds.js`) was the real gap: hardcoded throughout to `bed.status`, the record's own actual current stage - correct for the old single Documents tab ("wherever this Test Bed actually is"), wrong for 8 tabs that must each show a specific NAMED stage's own Documents regardless of where the record really is. Generalized with an optional `?stage=<name>` query param, defaulting to `bed.status` when omitted (a strict superset of the old behaviour, not a breaking change) - `reference_docs` keyed by `stage_name = targetStage`, `completable_documents` computed for `targetStage`'s own exit gate (`targetStage` -> whatever follows it), same phase-fallback logic, now driven by `targetStage`'s own index rather than the record's real one.

  **Architecture: one shared panel, not 8 static ones.** All 8 stage buttons (`data-tb-tab="stage-<Stage Name>"`) reveal the same physical `#tb-tab-stage-detail` panel; `switchTbTab` (`frontend/app.js`) special-cases any tab id starting `stage-` and calls `loadTbStageDetailTab(stageName)` to repopulate it on demand - not 8x the DOM, not 8x the eager network calls on every page load for content only one of which is ever visible at a time. Approvals reuses `buildStageApprovalRowHtml`, extracted from the existing all-stages renderer (`renderStageApprovalsRows`, still used unchanged by Opportunity's own Stage & Approvals tab) so a single stage's row is built from the exact same markup function, not a second copy of it.

  **Two real races found by testing, not assumed safe, both fixed with the same load-token discipline already established elsewhere in this codebase (`contactsLoadToken`):**
  1. Clicking through the 8 tabs quickly left two `loadTbStageDetailTab` calls in flight at once; an older, slower response resolving after a newer one silently overwrote the shared panel with the wrong stage's data - confirmed live as a genuine "one tab behind" symptom (Site Assessment's tab showing Qualification's approval row), not corrupted data. Fixed with `tbStageTabLoadToken`, checked before every DOM write in both the documents renderer and the approvals renderer, not just once at the end.
  2. `renderTestBedDetail`'s own initial load sequence does two real, awaited network round-trips *after* the page and its tab bar are already visible and clickable, before its own unconditional `switchTbTab('reference')` call runs. A real click on a stage tab in that window got silently reverted back to Reference moments later when that default-to-Reference call finally executed - confirmed live, the stage tab's content had genuinely loaded correctly in the background, but the panel stayed hidden and Reference stayed shown. Fixed with `tbUserPickedTab`, set by the real click handler and checked before the auto-switch; reset to `false` at the start of every fresh `loadTestBedDetail` call, so a genuinely new navigation (or the pre-existing, unchanged save-triggered reload behaviour) still defaults to Reference exactly as before - this only protects a click that happens to race ahead of that same load's own completion. **Both races were only found because a properly-sequenced test (waiting for genuine completion signals, not fixed delays or the static HTML's own already-`active` default class) was used to gather evidence, not because either was hit by chance** - the same "verify what a fixed delay actually proves" discipline this round's own Phase 4/5 evidence-gathering already required.

  **Stage transition relocated, functionality preserved, not redesigned.** `renderTransitionSection`/`#tb-transition-section` (the one real, working "advance to the next stage" UI) lived on the old Approvals tab, the only tab it belonged to. Removing that tab without giving it a new home would have silently removed the only working transition trigger in the app. Relocated to sit always-visible above the tab bar, the same "page-level, not tab-scoped" pattern the save bar already established - deliberately not redesigned or duplicated into all 8 stage tabs, since it's a record-level action, not stage-specific content. **A genuinely useful investigation finding for Phase 8, surfaced here rather than acted on**: the chevron strip (`renderChevronStrip`) has no click handler at all, confirmed by direct inspection - it is purely a visual status indicator today, contrary to what Phase 8's own brief text assumes ("clicking ahead on the chevron attempts the real stage transition"). The only real transition-triggering UI in the app is this relocated section. Phase 8 needs to reconcile its own premise against this before deciding what a "Next Stage" button should actually be relative to.

  **New: the record's real current stage is now marked on the tab bar itself, not just the chevron.** `markTbCurrentStageTab()` adds a small dot (`.sa-dot`, the same element and green already used by the chevron and the Approvals rows for "current" - not a new accent colour, this app's own rule reserves the brand accent for live states) to whichever of the 8 stage-tab buttons matches `bed.status`, independent of `.active` (which tab is currently *open*, unrelated to which one represents the real stage) - confirmed live that the dot stays on the record's real current stage even after clicking into a completely different tab to look around, not tied to selection.

  **Verified live**, real API and real browser: all 8 stages' `document-requirements?stage=X` calls returned their own correct, mutually distinguishable reference docs, matched against the real seeded data (DESIGN_PRINCIPLES.md Section 8's own per-stage document table) - Pre-Site Assessment showing only NDA, Site Assessment showing exactly its 3 real documents, and so on, none bleeding into another stage's list. `stage-approvals` confirmed unaffected by the `buildStageApprovalRowHtml` extraction. In the real browser, cycling through all 8 tabs (with a properly-sequenced wait for genuine completion, not a fixed delay) showed each one's own heading, reference docs, and approval row matching exactly, with zero cross-contamination - confirmed only after finding and fixing the two races above, not before. The current-stage dot was confirmed present on exactly one tab and to survive navigating to a different tab. The relocated Stage Transition section was confirmed to still work exactly as before. Screenshots taken of the full 10-tab bar and an open stage tab, both confirming the flagged visual density renders legibly, not overflowing or unreadable.

- **Round 5 Phase 8, 2026-08-17: "Next Stage" button - confirmed a genuinely new entry point, not a restoration.** Phase 7's own investigation flagged that the chevron strip's premise in this brief ("clicking ahead on the chevron attempts the real stage transition") didn't match what the code actually does. Before building anything, checked `git log`/`git show` directly, not assumed: every commit in this repo's entire history that ever touched the word "chevron" in `app.js`/`style.css`/`index.html` (three total) was inspected in full - the commit that *introduced* `renderChevronStrip` (replacing an earlier two-level tracker that also had no click handler), a sizing-only fix for Test Bed's 8-item list, and a pure CSS contrast fix. None ever added or removed a click handler. Separately traced `window.attemptTransition` to its own origin commit, which predates the chevron entirely - it was wired to a dedicated button from birth, never to a chevron item. **Confirmed: this was never built, not a regression silently lost during a later refactor** - the same category of documentation-vs-reality gap as several others already found this build (the Deal Sheet record-type mismatch, Round 4/5's various stale-note corrections), not a bug to fix.

  **Built accordingly**: a new "Next Stage" button positioned at the top of the chevron (`frontend/index.html`, a "Workflow stage" header row above `#tb-chevron-strip`), wired (`wireTbNextStageButton`, `frontend/app.js`, called on every render since the real next stage depends on the record's current status) to call `window.attemptTransition` completely unchanged - the identical function the existing, Phase-7-relocated "Stage transition" section's own "Move to X" button already uses, not a second implementation of the gate-check or the transition call. `sectionId` stays `'tb-transition-section'` (required for `attemptTransition`'s own success-path branch to reload as a Test Bed, not an Opportunity), but `feedbackId` is this button's own (`tb-next-stage-feedback`) - a real, deliberate choice: a blocking rejection triggered from the top of the page shows immediately at the point of the click, not only in the section below, which could be scrolled out of view at that moment. Disabled with "Final stage" text when `stages[currentIdx + 1]` doesn't exist, mirroring exactly what the existing section already does for the same condition.

  **Verified live**, real browser + API, not inferred: on a fresh Test Bed with none of Qualification's 6 real requirements met, clicking the new button showed the identical blocking list `GET /records/:id/exit-criteria` independently confirmed, written into its own feedback area only - the existing section's feedback area, checked directly, was untouched, and the record's real status was confirmed unchanged. On a second Test Bed with every real requirement genuinely satisfied (3 buyer-role links, all 3 date/duration fields), clicking the same button produced a real, persisted transition, Qualification to Pre-Site Assessment, confirmed both in the reloaded UI and by a direct server-side fetch. At the final stage (Closed), the button was confirmed disabled with "Final stage" text. A direct regression check confirmed the existing bottom "Move to X" button still works exactly as before and writes only to its own feedback area, unaffected by the new button's addition - two independent entry points, one real mechanism, exactly as scoped.

- **Round 5 Phase 9, 2026-08-17: inline qualified Contact creation from Buyer Role dropdowns, shared by Test Bed and Opportunity.** Caught before this phase started, not after: a "Round 5 fully built" claim was made prematurely, checked directly against `ROUND5_BUILD_BRIEF.md`'s own phase list (10 phases, only 8 reported), the same **round-level** version of Round 3's own documented process failure (a "done" claim not actually checked against the brief's own scope). Corrected immediately, not glossed over.

  **Built as pure orchestration, no new backend endpoint.** `window.openInlineBuyerContactModal`/`saveInlineBuyerContact` (`frontend/app.js`, shared - one implementation, matching the brief's own "confirmed scope, both Test Bed and Opportunity," not two independently-built copies) chain four already-proven, existing endpoints in sequence: `POST /contacts` (all 14 `leadQualifyRequired` fields collected in one call except Company, deliberately auto-derived from the record's own known linked Account rather than asked of the user redundantly), `POST /contacts/:id/link-account` (the real Account link, satisfying the qualification gate's actual "Company" requirement), `POST /records/:id/transition` to `Qualified` (the exact same real gate check every other Qualified transition in this app goes through - "being selected as a buyer implies qualification" taken literally, not a shortcut that just marks the row qualified), then the record type's own `buyer-contacts` endpoint. A new "+ New" button sits beside each role's existing "Link" button/dropdown (`renderTbBuyerRows`/`renderRefBuyerRows`), a direct port between the two files, not two independent implementations of the trigger either.

  **A real, deliberate design choice: partial-failure states are surfaced honestly, not silently retried or hidden.** Since this chains four separate writes, any one of the later three failing after the Contact already exists (e.g. qualification genuinely blocked, or a rare late failure linking the buyer role) reports exactly what succeeded and what didn't, pointing the user at the real Contact record to finish resolving it directly, rather than either silently abandoning a half-created Contact with no explanation or naively retrying and risking a duplicate.

  **Verified live**, real browser + API, not inferred, for both record types: the new "+ New" trigger confirmed present on both Test Bed's and Opportunity's Buyer Role dropdowns. Submitting the modal with every field empty was genuinely rejected (client-side hint), and separately confirmed the mandatory fields are real, not just a client-side gate, by design (the actual enforcement is the same server-side `Qualified` transition check that would reject a genuinely incomplete Contact regardless of what the client sent). Filling in a complete, real Contact and saving: confirmed the modal closed and the original screen (Test Bed and, separately, Opportunity) reloaded showing the new Contact as the linked buyer for the exact role that triggered creation - then confirmed server-side, independently of the UI, that the new Contact genuinely exists, has `status = 'Qualified'` (not fabricated), is linked to the correct Account (`parent_record_id` matching), and is linked via `record_contacts` to the correct role on the correct record - four separate real facts, not one status code trusted for all of them.

- **Round 5 Phase 10, 2026-08-17: Accounts as a first-class module, the final phase this round.** Confirmed genuinely new scope before building, per the brief: no Account list or detail screen existed anywhere - Round 4 built the full field set (Account Number, Terminus Lead, Website URL, Billing/Shipping Address, Parent Account) but only as an all-at-once creation/view modal reachable from Contact's own Link-to-Account picker, never as its own standalone area.

  **Zero backend changes needed, confirmed by direct investigation, not assumed.** `src/routes/accounts.js` already exposed every endpoint this phase needed - `GET /accounts` (list), `POST /accounts` (create, full field set), `GET /accounts/:id` (single record plus resolved `parent` name and a `contacts` roll-up array), `PATCH /accounts/:id` (edit, including the same `validateParentAccountId` circular-reference guard the Round 5 Phase 3 bug fix already covers) - all proven working since Round 4. This phase is entirely new frontend.

  **A deliberate architectural choice: a genuine click-to-edit detail page, not a reuse of Round 4's modal.** The brief's own field list matches Round 4's "Account Details" modal (`contact-detail.js`'s `openAccountDetailsModal`) almost exactly, but that modal is an all-at-once create/view form, not this app's established per-record detail-page pattern every other record type (Contact, Test Bed, Opportunity) already uses. Built `frontend/account-detail.js` instead, following `test-bed-detail.js`'s own `tbFieldRow`/`openTbField`/`discardTbField`/batched-Save-bar mechanism (the simpler of the two established variants - Test Bed's plain payload merge, not Contact's own Notes-History-on-save variant, since Account has no equivalent notes concept in its payload). New nav item ("Accounts," `frontend/index.html`), registered in `ALL_VIEWS`/`navigate()` (`frontend/app.js`) as `accounts`/`account-detail`, same dispatch mechanism every other view already uses.

  **List view reuses the existing `.record-grid-head`/`.record-grid-row` pattern outright** - the same 3-column grid Opportunities' own list already uses (rule 7 in this document's own UI-craft memory: card/grid structure from the first pass, not a table-plus-colour stopgap), no new CSS. **Creation stays deliberately minimal**, a single-field (Account Name only) prompt (`#new-account-modal`), matching the "only Account Name is mandatory" rule Round 4 already established and the same "create minimal, flesh out on the detail page" precedent Test Bed/Opportunity's own creation flows already follow - everything else (Terminus Lead, Website URL, Billing/Shipping, Parent Account) is filled in via click-to-edit immediately afterward on the new record's own detail page, not duplicated a second time in the creation prompt.

  **Parent Account is handled as its own immediate-save action, not folded into the batched field editor** - `parent_account_id` is a real `records` column, not a payload key (same distinction Contact's `industry_id` and Test Bed/Opportunity's buyer-contact links already make), so `renderAcctParentRow`/`linkAcctParent` (`account-detail.js`) mirror Test Bed's own `renderTbBuyerRows`/`linkTbBuyer` pattern: a search box over the already-fetched `accountsCache` (case-insensitive substring match, same as Contact's own Link-to-Account search), self-exclusion added (an existing Account has a real id it could otherwise be mistakenly linked to itself), and a real `PATCH` fired the moment a result is clicked, re-rendering immediately from the fresh server response rather than assuming the local click succeeded.

  **Linked Contacts roll-up is read-only**, sourced directly from `GET /accounts/:id`'s own already-existing `contacts` array (no new endpoint), satisfying the brief's "review capability" - each row navigates to that Contact's own detail page.

  **Verified live**, real browser + API, not inferred: created a new Account directly from the new Accounts area (via `#btn-new-account`, not through a Contact) and confirmed it landed on its own real detail page showing the correct name, confirmed server-side the record genuinely exists. Confirmed it appears correctly in the Accounts list. Edited it through click-to-edit (Website URL, Billing City, and a real Parent Account link to a second, independently-created Account) and confirmed each change shows correctly on screen immediately after Save. Confirmed every change persisted server-side via a direct API re-fetch, and separately confirmed persistence survives a genuine full page reload (not just an in-memory re-render) - all three fields still correct after reload. **Regression-checked against the existing pickers**, per the brief: confirmed the new Account is still correctly selectable and linkable from Contact's own Link-to-Account picker (the only *live* Account-linking picker in the app - confirmed by direct grep that Opportunity's own `POST /opportunities/:id/link-account` was removed entirely in an earlier round and Test Bed never had one; both inherit their Account read-only from the origin Contact at creation time instead, already covered by Phase 9's own test evidence, not a separate picker this phase needed to re-test), and confirmed the resulting link persisted server-side (`parent_record_id` matching). No regressions found.

- **"2 legacy Lead pointers" note, flagged after Round 4, formally closed here, Round 5 end-of-round documentation pass, 2026-08-17.** The underlying finding (Milestone 3: 2 then-live Test Bed records had `parent_record_id` set to a superseded, pre-`record_contacts` Lead-conversion pointer, the reason `account_id` was built as its own dedicated column rather than reusing `parent_record_id`) was already correctly written up as historical, not current, in `PROTOTYPE_SPECIFICATION.md`'s Account-link section and re-confirmed once, live, during Round 4 Phase 1 (zero `record_type = 'lead'` rows, zero Test Bed rows with `parent_record_id` set). What was actually still outstanding was narrower than the data itself: that closure had never been logged in *this* document, `DESIGN_PRINCIPLES.md`'s own Deferred scope list, the single running ledger this build otherwise uses for every other finding's full lifecycle, so a reader relying on this document alone would have had no way to know that Section 2's other corrections above and this note describe the same, already-resolved history.

  **Re-verified live, fresh, right now, not just quoted from the old write-ups**: queried the current `records` table directly (service-role client, bypassing RLS) for every row with `parent_record_id` set, 99 rows today. **Every single one is `record_type = 'contact'`**, each pointing at a real Account, the correct, current Contact→Account link this document's own Section 2 describes (`POST /contacts/:id/link-account`), not a stray or superseded reference. Separately confirmed zero `record_type = 'lead'` rows exist. No legacy pointer, of any kind, exists in live data today. Closed, not just re-described.

- **Retroactive documentation, 2026-08-16 (dated to match the change itself, written up during Round 6 Phase 1, 2026-08-17): Contacts list's linked-record count switched from a click-to-open modal to a hover preview.** Found as a real documentation gap while investigating Round 6 Phase 1 - a genuine architectural change that was never recorded anywhere in this document, only in a code comment (`frontend/style.css`, `.contact-count-hover`). Before this change, clicking a non-zero Test Bed/Opportunity count on a Contact's row opened `#linked-records-modal` (Round 5's own "third real-use testing pass" entry above, `renderLinkedRecordsList`), the same shared dialog still used today for the pre-creation warning. That click-to-open interaction was replaced, for the Contacts list count specifically, with `renderContactCountHover`/`renderContactCountPopup` (`frontend/app.js`), a small `position: absolute` box that opens on `mouseenter`/`mouseleave` rather than a click, closer to a native tooltip than a dialog. The listener pair sits on the wrapper (`.contact-count-hover`), not the label alone, deliberately - moving the pointer from the label down into the popup itself must never register as leaving, the same reasoning `.tb-matrix-hover` below independently arrived at for its own, separately-built hover popup. `#linked-records-modal` itself was not removed or changed by this - it's still the correct mechanism for the pre-creation warning, which genuinely needs a real dialog (Cancel/proceed choice), not a hover preview. Only the Contacts list's own count display switched mechanisms.

- **Round 6 Phase 1, 2026-08-17: Contacts hover popup wraps long names to multiple lines, investigated and fixed - a never-fixed gap, not a regression.** The brief's own premise, that single-line truncation had been "explicitly built and confirmed for this popup earlier in this build," was checked directly rather than assumed, per this build's own investigate-first discipline, and found not to hold.

  **Investigated first, confirmed via three independent checks, not one.** (1) `git log -p --all -S "linked-record-row"` against `frontend/style.css`: only one commit in this repo's entire history ever touched this class (the third real-use testing pass, 2026-08-15, adding it fresh with no truncation properties at all) - everything built since is uncommitted working-tree state (confirmed via `git status`), so git history alone couldn't settle this, the current file also had to be read directly. (2) The current stylesheet: `.linked-record-row` had zero `white-space`/`overflow`/`text-overflow` styling, in either of its two real callers - the Contacts count's own hover popup (`.contact-count-popup`) and a second, separately-built hover popup, the Test Bed list's region/status matrix (`.tb-matrix-popup`, `renderTbMatrixCell`), which shares the exact same row-rendering shape and the exact same gap, confirming this was never solved for any hover popup in this app, not something that broke on this one specifically. (3) `DESIGN_PRINCIPLES.md` itself had zero mentions of "hover" anywhere before this entry, meaning the hover-popup mechanism (see the retroactive entry immediately above) was never documented as built, let alone as having received a truncation fix. **What the brief's memory was likely tracking**: a real, established single-line-truncation convention does exist in this app, `.record-card-title`/`.record-card-meta` (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`), used on Leads/Opportunities list-card rows - genuinely built and working, just never applied to this popup's row class.

  **Reproduced live before fixing**, not just reasoned about: a real Contact linked to two real, long-named Test Beds, hovered via a real Puppeteer session, confirmed the popup stayed clamped at its own `min-width` (180px, no `max-width` existed to give the ellipsis anything to truncate against) while the name text wrapped across multiple lines - measured row heights of 76.5px and 96px against an expected single-line height of roughly 20px, the concrete, measured version of the visually-reported "3 lines" symptom.

  **Fixed by applying the same established pattern, not inventing a new one.** `.linked-record-row` gained the identical `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` triple `.record-card-title` already uses, plus a `max-width: 280px` added to both `.contact-count-popup` and `.tb-matrix-popup` (the two real containers using this row class) - `white-space: nowrap` alone only stops wrapping, it doesn't create anything for `text-overflow` to truncate against without a genuine width limit on the box itself, which neither popup had. One shared class fix covers both real callers, not two separate patches, since both were the same underlying gap.

  **Verified live**, real browser + API, not inferred: re-ran the identical Puppeteer reproduction against the fixed code, a real Contact linked to two real long-named Test Beds (names exceeding the popup's own `max-width`). **A first verification pass gave a false negative**, worth recording since it's a real methodology lesson, not just a result: checking `span.scrollWidth > span.clientWidth` on the inner `<span>` to confirm truncation always returned `0 > 0`, because a plain `display: inline` span's `scrollWidth`/`clientWidth` are meaningless, always `0`, regardless of overflow - the check has to run on the block-level `.linked-record-row` itself, which correctly reports its true (untruncated) content width against its clipped visible width. Re-verified on the row: `scrollWidth` (484px) genuinely exceeds `clientWidth` (268px) for a long name, confirming the ellipsis is doing real work, not just present with nothing to truncate. Height was also checked against a real empirical baseline rather than an assumed value - a synthetic short-name row measured 37.5px at this exact `padding: 8px 10px`/`font-size: 13px`/line-height combination, and both long-name rows in the live popup matched that same 37.5px exactly, not the 76.5px/96px wrapped heights found during investigation (roughly 2x and 2.5x the single-line baseline, consistent with the original 2-3-line wrap). Confirmed visually via screenshot that the longer name ends in a real ellipsis, not a hard cut-off. Separately hovered a Test Bed list matrix cell with a real long-named Test Bed and confirmed `.tb-matrix-popup` truncates identically (same 37.5px height, same genuine `scrollWidth > clientWidth` truncation), same fix, same result, not assumed to carry over untested just because the CSS is shared.

- **Round 6 Phase 2, 2026-08-17: Test Bed Customer Details panel widened, buyer-role dropdown saves directly, inline-creation dialogue wording made role-agnostic.** Four confirmed changes, all to `test-bed-detail.js`'s Client Buyer rows and the shared inline-Contact-creation modal (Round 5 Phase 9), Test Bed only, not Opportunity's own equivalent, unchanged deliberately, this phase's own brief scoped it to Test Bed specifically.

  **A departure worth surfacing plainly, not silently built around**: the brief's own precedent for "click a result to commit, no separate confirm click," Opportunity's Account picker, no longer exists in that form - checked directly (`opportunity-reference.js`), Opportunity's Account field became read-only and inherited from the source Contact back in Round 3 ("this used to be a real Link-to-Account picker, Milestone 6, removed entirely when that capability was deliberately taken away"). No native `<select onchange>`-saves-immediately pattern exists anywhere else in this app to copy syntactically either, confirmed by grep. The requested behaviour itself is unambiguous regardless, selecting a Contact from the dropdown should save with no further click, so this was built directly against that requirement rather than against a precedent that no longer exists, not blocked on it.

  **Panel width**: Customer Details now spans 2 of the Reference tab's own `.ref-cards` grid tracks (`.pg-card-wide`, `grid-column: span 2`), rather than a one-off fixed width or raising the shared 420px cap for all 6 cards on the tab - only this one card genuinely needed the room (its buyer-role dropdown plus "+ New" button), the other 5 were never reported as truncated and stay at their existing width. Confirmed live at 1240px, 1920px, and 3440px: the card holds steady at 856px (2 × 420px track + gap) at every tested width, the dropdown and button both render at full width with zero overflow past the card's own edge, not just "less truncated."

  **Buyer-role dropdown saves directly**: the standalone "Link" button removed from `renderTbBuyerRows` (`test-bed-detail.js`), replaced with `onchange="linkTbBuyer(role)"` directly on the `<select>` - `linkTbBuyer` itself needed no changes, it already read the select's own value and no-opped on an empty selection, both exactly right for firing on every `onchange`, not just a deliberate click.

  **Inline-creation dialogue**: `openInlineBuyerContactModal` (`app.js`) no longer interpolates the triggering role into the heading (`New ${role}` → a fixed `'New Contact'`), and the Save button's static label changed from "Create and link" to "Save" (`frontend/index.html`) - the button's own loading-state text (`'Creating...'`) needed no change, since it already reads the button's live text at click time rather than a hardcoded string. The subtitle line already carried no role-specific wording, confirmed by reading the modal's full HTML before assuming there was nothing else to change.

  **Verified live**, real browser + API, not inferred: measured the Customer Details card and its dropdown/button at all 3 required widths, confirmed 856px card width and zero overflow at every one, not just visually plausible. Confirmed only one button ("+ New") remains on the buyer row, no "Link" button anywhere. Selected a real, already-qualified Contact from the dropdown and confirmed it saved immediately with no further click, both in the UI (the row switched to its linked, read-only display) and server-side (`buyer_contacts` genuinely shows the selected Contact linked to the correct role). Opened the inline-creation dialogue from two different buyer roles in the same session (Client Technical Buyer, then Client Legal Buyer) and confirmed the heading read the fixed "New Contact" both times, not stuck on a stale role from the first open, and confirmed the Save button reads "Save."

- **Round 6 Phase 3, 2026-08-17: Test Bed Reference tab reorganization, the largest change this round.** Five confirmed relocations across `test-bed-detail.js`, `app.js`, `frontend/index.html`, and `src/routes/records.js`. The Reference tab's own `.ref-cards` grid is genuinely down from 6 cards to 4 (Terminus Details, Customer Details, Key Dates, Site Details); the old comment block explaining Round 5 Phase 5's own 6-card layout was kept, not deleted, with a superseding note appended, same discipline as every other correction this build.

  **Sensor counts relocated to Commercials** (`TB_SENSOR_COUNT_FIELDS`, a new array split out of `TB_SITE_FIELDS`, still folded into `TB_ALL_EDITABLE_FIELDS` so the existing `wireTbFieldInputs()`/batched-save mechanism covers it for free): a new "Unit Counts" `.pg-card` on the Commercials tab, first in that grid, ahead of the cost-rate cards it feeds. The generated Sensors list itself (`renderTbSensors`) stays on Site Details, deliberately - it's a read-only display of these counts, not the counts themselves, "anything not otherwise relocated" per the brief, and it already reads the same `tbPayload` keys regardless of which tab edits them.

  **Site Details trimmed to its remaining 4 fields** (Site Ownership, Installation Environment, Site Address, City) plus the Sensors list, sitting next to Key Dates in the grid's own row - "positioned under Key Dates" is satisfied by DOM order in the existing auto-fit `.ref-cards` layout, no new CSS needed, the same reflow mechanism already proven for this page.

  **Installer/Test Bed Tech Team/Install Notes moved to the Installation and Commissioning stage tab specifically** (`#tb-stage-install-section`), not a generic panel - a real, deliberate architectural choice made while investigating how to do this safely: these fields are now rendered **once**, at page load (`renderTbInstallSection`, called from `initTestBedDetailPanel` alongside every other one-time render), inside a static container that starts `hidden` and is purely visibility-toggled by `loadTbStageDetailTab` (`stageName !== 'Installation and Commissioning'`), never torn down and rebuilt on every stage-tab switch the way Documents/Approvals/Exit Criteria are. This was checked deliberately, not assumed safe: the shared stage-detail panel's Documents/Approvals sections already get a wholesale `innerHTML` replace on every tab switch, and putting editable fields through that same mechanism would have meant switching to a different stage tab mid-edit silently discarded the in-progress draft with no warning, the same class of risk `INTERACTION_STANDARDS.md`'s own "third case" already documents. Rendering once and only toggling visibility (the same pattern the Reference/Commercials tabs themselves already use for their own always-present content) avoids the risk entirely rather than adding a warning on top of it.

  **Exit Criteria relocated off Reference entirely, onto each of the 8 stage tabs**, showing that specific stage's own outstanding requirements, not just the record's real current stage - `GET /records/:id/exit-criteria` (`src/routes/records.js`) gained an optional `?stage=` override, defaulting to `record.status` when omitted (reproducing the exact original behaviour for any caller that doesn't pass it), the identical generalization shape Round 5 Phase 7 already established for `document-requirements?stage=`. The underlying field/approval/document checks inside `computeBlocking()` were confirmed unchanged and don't need to be: they already run against the record's real, current payload and revision regardless of which stage is requested, only which `stage_gate_rules` rows get looked up changes. `renderTbExitCriteria()` renamed to `renderTbStageExitCriteria(stageName)`, called from `loadTbStageDetailTab` with that tab's own stage, into a new `tb-stage-exit-criteria-list` container on the shared stage-detail panel.

  **Use Cases repositioned to sit with Summary**, same render function (`renderTbUseCases`) unchanged, just called from `renderTbReference()` now instead of the removed `renderTbSiteDetails()` call site, and moved out of the `.ref-cards` grid entirely into the same plain `pg-card-title` + content shape Summary/Notes already use below it, not a bordered grid card.

  **Verified live**, real browser + API, not inferred, all 5 items: confirmed Site Details renders exactly its remaining 4 fields plus the Sensors list, nothing dropped, positioned next to Key Dates. Confirmed the Commercials tab's new Unit Counts card, set a real SafeSight count (4) and unit cost (USD 500), saved, and confirmed both the client-rendered cost breakdown and a direct server-side re-fetch agreed on the same real, independently-computed hardware line total (4 × 500 = USD 2,000) - no regression to Phase 6's cost math. Confirmed the Installation and Commissioning tab shows Installer/Tech Team/Install Notes and every other stage tab correctly hides that section; edited Installer through the real batched-save flow and confirmed it persisted both immediately and after a genuine full page reload, re-navigating to the same stage tab. Confirmed Use Cases is no longer inside `.ref-cards` and renders in DOM order after Summary and before Notes. **Exit Criteria required a second verification pass**, worth recording: the first attempt waited for the criteria container to be merely non-empty after each tab click, which resolved instantly on the *previous* tab's stale content (the shared panel isn't cleared before the new stage's fetch resolves), the same wrong-completion-signal mistake already flagged elsewhere this build - fixed by waiting for content that genuinely names each stage's own distinct requirement instead. Re-verified against 3 real, different stages on the same fresh Test Bed: Qualification showed its own real 6 unmet requirements (buyer roles, dates, duration), Site Assessment correctly showed "Nothing outstanding" (confirmed against a direct query that zero `stage_gate_rules` rows exist for that transition, not a display bug), and Decommissioning showed its own genuinely different real requirement (an unmet Senior approval) - cross-checked against direct server calls with `?stage=Qualification` and `?stage=Decommissioning`, not just the DOM.

- **Round 6 Phase 4, 2026-08-17: Accounts page, Parent Account row spacing - a real structural bug, not a spacing tweak.** Investigated before fixing: the reported symptom (readonly value sitting directly against a button that wrapped across 2-3 lines) traced to `.ref-field`'s own CSS only ever accounting for 2 flex children (a label plus one value column) - `renderAcctParentRow` (`account-detail.js`, Round 5 Phase 10) put the readonly value and its action button as two *separate* direct children, a 3-item flex row `.ref-field` was never designed for, `.ref-field-display`'s own `flex:1` claiming the row's remaining width and leaving the button to compete for whatever was left.

  **Two fixes, both needed, confirmed live rather than assumed sufficient alone.** (1) The row itself: value and button now wrapped together in one column, stacked vertically rather than side-by-side - the same "readonly status text above its own action button" shape `contact-detail.js`'s Account card already uses (`cd-account-status` above `cd-btn-link-account`), not a new pattern. (2) The deeper root cause: Account detail's own `.ref-cards` was never given the `minmax(280px, 420px)` width cap Contact detail, Test Bed, and Opportunity's own Reference-style pages all already have (confirmed by grep, no `#view-account-detail` override existed anywhere) - it was still free to shrink to the shared floor (280px), and stacking alone wasn't enough at that width, the value column was too narrow even for the button on its own line. Added the identical cap every other page already uses, not a new value invented for this one.

  **Verified live**, real browser, before/after screenshots at 1240px, 1600px, and 1920px, both states. Before: confirmed the reported bug directly, "None" visually touching a 3-line-wrapped "LINK / PARENT / ACCOUNT" button, measured button height 42px (wrapped) at the narrowest width. After: card holds at a steady 420px at every tested width (not stretched to fill leftover space, `justify-content: start` still doing its job), button renders at a single-line height (14px, confirmed via direct measurement, not just visual impression) in both the unlinked state ("None" / "Link Parent Account") and the linked state ("Change", tested against a real Account with a real Parent Account link, showing the correct linked name above it, not a placeholder).

- **Test Bed list's region/status matrix contradicts a documented "don't build this" decision, found during Round 6 Phase 1's investigation, 2026-08-17, not acted on since it was outside that phase's own scope.** `PROTOTYPE_SPECIFICATION.md` Section 6 records a confirmed business decision, made during the original Test Bed build: "don't build the matrices or fabricate the missing columns... Live build: sortable flat table only, no matrix breakdowns," specifically because the underlying data (Open tickets, Issue, live/degraded/in-progress status) doesn't exist anywhere in this system. Confirmed live, by direct code reading, that a matrix (`.tb-matrix`, `renderTbMatrix`/`renderTbMatrixCell`, `frontend/app.js`) is nonetheless built and genuinely wired into the live Test Bed list today, by-stage-by-region and by-industry-by-region breakdowns with a real hover-preview popup - not dead code, not a leftover fragment, a real, currently-shipping feature. Whether this was built after that documented decision as a deliberate, later reversal that was never written back into `PROTOTYPE_SPECIFICATION.md`, or built by a session that didn't check the existing decision first, is not yet determined - flagged here as a genuine, unresolved discrepancy between a documented decision and what's actually shipped, for whoever investigates it next, not decided unilaterally in the course of an unrelated phase (Round 6 Phase 1 only needed this component as one of two real callers of a shared CSS class being fixed for truncation, not a reason to adjudicate whether it should exist).

- **General principle, confirmed twice independently in the same round, worth being its own standing entry rather than sitting inside two separate phase write-ups: a verification check can be technically true and still prove nothing.** Round 6 Phase 1's first truncation check read `span.scrollWidth > span.clientWidth` on an inline `<span>`, always `0 > 0`, because an inline element's scroll/client width are meaningless regardless of real overflow, the check ran without error and reported success while proving nothing about the actual claim. Round 6 Phase 3's first Exit Criteria check waited for the criteria container to be merely non-empty after a stage-tab click, which resolved instantly against the *previous* tab's stale content still sitting in the shared, not-yet-cleared panel, again technically passing while verifying the wrong thing entirely. Both were caught before being reported, not after, by the same discipline: re-checking what the passing signal actually corresponded to, not just that it fired. **The general rule this confirms, and the reason it's recorded here rather than left as two isolated incidents:** a test needs to verify the specific claim being made, not a proxy that happens to move in the same direction, "the element exists," "the container has content," "no error was thrown" are all real signals but none of them are the same as "this shows the correct, current, real value." When writing verification for anything genuinely new (inline elements, shared/reused DOM containers, anything with asynchronous or stale-state timing), ask explicitly what a false pass would look like and confirm the check would actually fail in that case, not just that it currently succeeds.

- **Parked, investigated but not scoped: Adobe Acrobat Sign integration for real document status, 2026-08-17.** Real product question, not yet acted on, deliberately deferred until the stage approvals workflow itself is settled, since that's what the integration would ultimately attach to. Directly addresses an already-documented gap, Documents tabs are deliberately minimal today with no real tracking behind them (Section 4 and Section 6), specifically because nothing existed to honestly track against. Adobe Acrobat Sign (the current name, formerly Adobe Sign) closes that gap:

  - **Webhooks, not polling, is the right mechanism**: Adobe pushes a real-time HTTPS POST to a registered URL on agreement events (viewed, signed, declined, completed), rather than TMS needing to repeatedly ask for status. Polling exists as a fallback in Adobe's own API but adds latency and unnecessary calls.
  - **Register webhooks per-agreement via the API, not through the Adobe UI.** A UI-level webhook fires for every agreement across the whole Adobe account, not just ones TMS created, requiring extra filtering logic to separate relevant events from noise. Per-agreement registration avoids this entirely.
  - **Natural attachment point**: each `stage_reference_docs` entry (currently just a name, "NDA," "Site Assessment Report") could carry a real Adobe agreement ID once sent for signature, with the webhook handler updating that document's real status as events arrive.
  - **Real constraints to confirm before scoping**: webhooks require an Adobe Acrobat Sign account with the API enabled, not available on every tier, worth confirming Terminus's actual plan supports it. A genuine public backend endpoint is needed for Adobe to call, with its own auth/verification. Webhook payloads are capped at 10MB and will silently trim large attachments, the signed PDF itself should be pulled via the Agreements API after a completion event, not relied on inside the webhook payload.

  Not scoped or built. Real work when picked up: the webhook receiver endpoint, the `stage_reference_docs` schema extension to carry an agreement ID and live status, and deciding whether document completion should feed into `stage_gate_rules` as a real gate (a genuine architectural decision, not just a wiring task, given documents are currently deliberately informational-only per that same section).


- **A migration that deletes or rewrites seeded data must reconcile the corresponding seed file in the same change, since seeds re-run and win, found in the Round 7 Phase 0 audit, 2026-08-18.** Migration `20260815000000_test_bed_flat_stages.sql` hard-deleted two `(from_stage, to_stage)` pairs of `stage_gate_rules` as orphaned data when the flat 8-stage Test Bed model replaced the old 9-stage one: `('NDA','Site Assessment')` and `('Compliance and Data Protection','Installation and Commissioning')`. `supabase/seeds/003_test_bed.sql` still carried the six `INSERT`s for those rows. Every insert in that file is guarded by `WHERE NOT EXISTS` on its own exact row, which is normally what makes a seed safely re-runnable, but here the migration's own delete is precisely what made those guards pass again, so the guard actively worked against the migration rather than protecting it. `scripts/seed.js` applies every `.sql` file in `supabase/seeds/` on `npm run db:seed`, a routine documented command, so any fresh environment rebuilt from this repo ended up with six resurrected rules naming stages that do not exist: live held 10 `test_bed` rules, a fresh seed produced 16. **Not a live break when found, and worth recording why, since the reasoning is the reusable part:** the resurrected rows were unreachable, every `stage_gate_rules` read site either filters `.eq('from_stage', ...)` on a live stage or, in `records.js`, fetches unfiltered and then matches against `stage_definitions`, which a dead `from_stage` never satisfies. The real exposure was latent, not present: naming any future stage `Compliance and Data Protection` would have silently activated five document gates at once. Fixed by deleting the six dead `INSERT`s outright, rather than commenting them out, with a non-executable note at the top of the seed pointing back at the migration. **General rule going forward: a seed file is executable state, not documentation. Superseded rows get deleted from it, with the explanation kept as a comment or in git history, never left as commented-out or still-live SQL in a file that gets run. And whenever a migration removes or rewrites data that a seed also creates, treat reconciling that seed as part of the same change, not as follow-up work.** The reciprocal check belongs in the automated suite, not in review discipline alone, tracked in `ROUND7_BUILD_BRIEF.md` Phase 1 section 1.3: no `stage_gate_rules` row may name a `from_stage` or `to_stage` absent from `stage_definitions` for its `record_type`, asserted across every record type, the sibling of the existing invariant that a transition must reject every `to_stage` when a record type has zero `stage_definitions` rows.

- **Never compare `jsonb` via `::text`, it silently defeats idempotency guards, found by running Phase 0's own evidence check, Round 7, 2026-08-18.** Every `WHERE NOT EXISTS` guard in `supabase/seeds/003_test_bed.sql` compared `requirement_detail::text` against a string literal. `requirement_detail` is `jsonb`, and Postgres normalises `jsonb` key order on storage, so a row seeded as `{"record_type": "nda", "status": "approved"}` is stored and returned as `{"status": "approved", "record_type": "nda"}`. The text comparison therefore never matched, the guard always passed, and every single re-run of `npm run db:seed` inserted another copy of all three `child_record_status` rules. Only the single-key `{"track": "Senior"}` rule was safe, and purely by luck, a one-key object having no key order to normalise. `001_smoke_test.sql` had always done this correctly (`requirement_detail = '{"track": "Internal"}'`), so the two seeds disagreed on the pattern and only the wrong one was multi-key. **Found the hard way, and worth recording exactly how:** this was not caught by reading the file, it was caught by actually running `npm run db:seed` against a real database as Phase 0's required evidence and then querying the row count, which came back 13 instead of the asserted 10. The corrected evidence line, written one commit earlier specifically because the original assertion was too weak to detect an extra row, is what failed and exposed it. The three duplicate rows were identified by `created_at`, deleted by id, and each delete confirmed gone by re-query rather than inferred from the delete's return, per Rule 9. **General rule: compare `jsonb` to `jsonb`, never to `text`. A `::text` cast on either side of a `jsonb` comparison is a bug unless the intent is genuinely to compare serialised form, which it almost never is.** Beyond the cast itself, the reusable lesson is that an idempotency guard is a claim that has to be tested by running the thing twice, not assumed from the presence of a `NOT EXISTS` clause, and that a seed file being re-runnable is exactly the kind of property that looks obviously true on inspection and is cheap to actually prove.

- **`jsonb` is never compared inside a query anywhere in this application today, and that is precisely what makes the seed's `::text` fault structurally impossible in app code, confirmed by a dedicated sweep, Round 7, 2026-08-18.** Following the `003_test_bed.sql` guard bug above, `src/` and `frontend/` were swept for the same shape and contain zero instances: no `::text`, no `->>`, no `JSON.stringify` in a query, and no `.eq()`/`.filter()`/`.match()` against any of the five `jsonb` columns in the schema (`records.payload`, `approvals.detail`, `routing_rules.condition`, `stage_gate_rules.requirement_detail`, `conversion_criteria.condition`). The established pattern throughout is: select the `jsonb` column whole, then read its keys in JavaScript. Every `.eq()` in the codebase filters on a scalar column. **The reason this is worth recording as an invariant rather than a passing observation is the failure mode if it is ever broken.** A `jsonb` comparison pushed down into a query does not fail loudly, it returns **zero rows**, which every call site here treats as a legitimate empty result: no gate rules, no criteria, nothing outstanding. That is the same silence that let the seed duplicate rows on every run for weeks, and in a gate-evaluation path it reads as "this transition is unblocked" rather than as an error. **`src/routes/records.js:120` is the specific place to watch.** It deliberately fetches every `stage_gate_rules` row for a record type with no `from_stage` filter and narrows in JavaScript afterwards, matching against `stage_definitions`. That is the natural target of any future performance pass, since pushing the filter into the query is the obvious optimisation, and it is also the one rule set whose columns include `jsonb`. Narrowing on `from_stage` alone is safe, it is a scalar. Narrowing on `requirement_detail` is not, and must use `jsonb`-to-`jsonb` comparison or the containment operator, never a `::text` cast. If that endpoint is ever optimised, the orphaned-rule and gate-evaluation assertions in the automated suite are what should be relied on to prove it still returns the same rows, not inspection.

- **The documented `probability_pct` reset had never fired once since the mechanism was written, and the surrounding governance in Section 2 was never built at all, found Round 7, 2026-08-18.** Section 2 states that an Opportunity's `probability_pct` auto-populates from `stage_probability_defaults` on every stage change, so that a manual override cannot silently persist past the stage it was reasoned about. The code in `transitions.js` looked like it did this. It did not. The query fetching the default omitted `.maybeSingle()`, so it resolved to an **array**: `if (probDefault)` was truthy even for zero rows, `probDefault.default_probability_pct` was always `undefined`, and the resulting `.update({ probability_pct: undefined })` was dropped on serialisation and matched no rows. **Confirmed live before fixing: 0 rows affected, no error raised, stored value unchanged.** The mechanism was inert from the day it was written. `contacts.js` and `test-beds.js` both call the same table with `.maybeSingle()` correctly, so the intended pattern was never in doubt - only this one site omitted it. **The near-miss worth recording is the diagnostic, not the bug:** the code did check the update's affected-row count and logged a warning on every single transition, but the warning read `"probability_pct reset affected no rows - missing opportunity_details row?"`, blaming a data-integrity problem that did not exist while the real cause sat two lines above. That is the same misdiagnosis class as the `stage_definitions` 400 fixed in the same round: a check that fires correctly and explains itself wrongly is not much better than no check, because it spends the reader's attention in the wrong place. **Governance status, investigated at the same time and unbuilt in every part.** Section 2 further specifies that only the Opportunity owner or a holder of `commercial_approver` on that Opportunity may change `probability_pct`; that any value differing from the stage default requires a mandatory free-text justification before saving; that the change, old value, new value, actor and justification are written to `audit_log`; and that the UI visually distinguishes an overridden probability. None of it exists. `commercial_approver` appears nowhere in `src/`, `frontend/` or `supabase/`, and the `roles` table is empty, so the role has no data behind it either. `justification` appears nowhere. `audit_log` records a `transition` action carrying `{from, to, revision}` and no probability information at all, confirmed against a real transition. The frontend reads `probability_pct` in three places and writes it in none, so there is currently no override path in the product for that governance to govern - which is why the gap has stayed invisible. **The general rule this is the second instance of: a document describing a control is not evidence the control exists.** `child_record_status` was the first (a seeded gate rule silently ignored by a loop with no branch for it). Both were found by reading the code against the document rather than the document alone, and both had been asserted as working in this file for months. When a control matters, the assertion belongs in the automated suite, where it either passes or fails, not in prose. **Extended, Round 7 Phase 3.3, 2026-08-18: the same root cause governs approval identity, and it is recorded here rather than as a second entry because it is one gap, not two.** There is no role infrastructure at all - the `roles` table is empty and no route anywhere checks one - so approval tracks are unenforced in exactly the way `probability_pct` is. Any authenticated user may record a decision on any track: Legal, Commercial, Technical, Senior. **Confirmed as a deliberate business decision, not an oversight**: there is currently one user, and he must be able to tick every track himself to progress a stage, so role-based approval is a later round and no permission check is to be built before then. The `approvals` unique constraint is `(record_id, revision_number, track, approver_id)`, so different tracks are naturally different rows and this works today with no change. **What IS enforced is worth stating precisely, because it is the half that survives:** the `approvals_insert` RLS policy is `with check (auth.uid() = approver_id)`, so an approval cannot be forged in another person's name - attribution is real and reliable. What is absent is entitlement: nothing establishes that the person who ticked Legal was ever authorised to tick Legal. **Stated plainly for the avoidance of doubt: until enforcement exists, an approval in this system proves that a tick happened and who made it, not that the entitled person made it. That is documented approval, not controlled approval in an ISO 9001 sense**, and any audit or certification claim resting on these records needs to say so rather than let the presence of an `approvals` table imply otherwise. `approver_id` continues to be recorded on every approval specifically so that the missing half can be added later without losing the history in between.

- **The Opportunity pipeline has no won/lost/open concept at all, and the five `variant = 'R&D'` stages are confirmed gone, both checked live Round 7, 2026-08-18.** `stage_definitions` holds exactly six Opportunity rows, all `variant = null`: Discovery, Qualified, Proposal, Evaluation, Negotiation, Closing. **Zero `variant = 'R&D'` rows survive.** They were seeded in `20260802000001_stage_definitions.sql` (Planning, Deployment, Monitoring and Analysis, Review, Decommissioning) and deleted by `20260803000000_test_bed.sql` when R&D became Test Bed rather than an Opportunity variant. Worth recording that this one is clean where the Phase 0 case was not: both the seed and the delete live in migrations, so a fresh environment converges on the same six rows rather than resurrecting the old list - the `003_test_bed.sql` fault was specifically a *seed file* re-running against a migration's delete, not migrations disagreeing with each other. **Separately and more consequentially, nothing anywhere expresses whether a deal is open, won or lost.** No `Closed - Won`, no `Closed - Lost`, no terminal-stage flag, no open-pipeline filter: `grep` across `src/`, `frontend/` and `supabase/` returns no such concept in code or schema, and the transition endpoint special-cases no stage. The last stage is `Closing`, which names an activity rather than an outcome, and reaching it fires nothing. Two consequences follow directly, and both bear on Section 2's forecast arithmetic. A dead deal is never marked dead, so it keeps whatever weighting its last stage gave it **indefinitely**, and since `probability_pct` only ever moves to the next stage's default, **weighted pipeline can only ever increase** - there is no path by which a deal leaves it. And `Negotiation` at 90% or `Closing` at 100% is exactly where an abandoned deal is most likely to sit, so the distortion is largest precisely where the numbers are relied on most. Recorded as a structural gap in the forecast model, not a missing feature request.

- **`Closed - Won` as a terminal Opportunity state at 100%, and as the trigger for creating the Deployment child record. Recorded on instruction, 2026-08-18; the underlying trigger predates Round 7 at Section 8's Commercial Deployment row.** Attribution stated precisely rather than left as an unqualified "confirmed decision", because the three parts of this entry do not rest on the same evidence and a later reader should not have to guess which is which. **(a) Predates Round 7**: Section 8's own table already read "Commercial Deployment | Revenue-generating, post-close | Child of Opportunity | Created when Opportunity reaches Closed/Won, rollout may be phased", with `Deployment (record_type = 'deployment', child of Opportunity)` and `closes (Won)` both already in Section 2's sales-journey model. The Closed-Won-triggers-Deployment concept is long-standing documented design, not new here. **(b) Verified directly against live data and code, Round 7**: that the current terminal stage is named `Closing` and carries the 100% default; that no `Closed - Lost` exists anywhere in code or schema; that `record_type = 'deployment'` does not exist, every "Deployment" in the codebase being the Test Bed stage renamed to `Installation and Commissioning` by `20260803000003_document_details.sql`; and that nothing fires on reaching `Closing` today. **(c) Recorded on instruction, not independently verified**: the restructuring itself - renaming `Closing` to `Closed - Won` at 100%, adding `Closed - Lost` at 0%, both terminal and both excluded from open pipeline. That part came into this document as a stated business decision relayed during the Round 7 session; no confirmation with the business is citable from within this project's own records, and none was sought at the time. Treat (c) as intent to confirm before it is built on, not as settled fact. This is a decision recorded ahead of any build so the intent is not reconstructed later from whatever gets implemented. Four facts about the system as it stands today, all verified: (a) the current terminal stage is named **`Closing`**, an activity rather than an outcome, and it carries the 100% default - so today's model already counts a deal at full value while it is still unsigned and losable; (b) **no `Closed - Lost` exists**, so a dead deal holds its last weighting indefinitely and weighted pipeline can only increase, per the entry above; (c) **`record_type = 'deployment'` does not exist** - every occurrence of "Deployment" in this codebase is the *Test Bed* stage of that name, renamed to `Installation and Commissioning` by `20260803000003_document_details.sql`, and it is easy to mistake one for the other when searching; (d) **nothing fires on reaching `Closing` today** - no hook, no child-record creation, no special-casing anywhere in the transition path. **Agreed shape, noted deliberately without designing or building it: replace `Closing` with `Closed - Won` (100%) and add `Closed - Lost` (0%), both terminal, both excluded from open pipeline, with the Deployment build as separate later work.** This is **candidate scope only and explicitly not Round 7**. It is recorded at this level of detail because it touches three things that are already live and would otherwise be reasoned about in isolation: the stage list, the probability defaults now that the reset actually fires, and the forecast arithmetic in Section 2.

- **Renaming a stage means updating four tables and five columns, and the newest one fails silently, standing rule added Round 7, 2026-08-18.** A stage name is not stored once. It is duplicated as a plain string across `stage_definitions.stage_name`, `stage_gate_rules.from_stage`, `stage_gate_rules.to_stage`, `records.status`, and, since Round 7 Phase 3.1, `approvals.stage`. None of these is a foreign key, so nothing in the database prevents any of them drifting out of step with the others. **`supabase/migrations/20260803000003_document_details.sql` is the working template**: it renamed the Test Bed stage `Deployment` to `Installation and Commissioning` and already had to update the first three by hand, one statement each, in a single migration. Any future rename must do the same and add `approvals.stage`. **The failure mode is worth stating precisely, because it is not the one people expect.** An orphaned stage string does not raise an error, fail a constraint, or appear in a log. It simply stops matching. For `stage_gate_rules` the consequence is a rule that quietly never fires, which is how six dead rows sat in a seed file for weeks (Round 7 Phase 0). For `approvals.stage` the consequence is the opposite and worse: a stage-scoped gate that **was** satisfied becomes blocked, with the approval still visibly present and correct in the approvals list, and nothing anywhere explaining why the transition is now refused. A reader would reasonably conclude the gate logic is broken rather than that a string no longer matches. Both directions are covered by the automated invariant in `scripts/tests/gates.test.mjs`, which asserts across **every** record type that no `stage_gate_rules.from_stage`, `stage_gate_rules.to_stage` or non-null `approvals.stage` names a stage absent from `stage_definitions`. That assertion is the reason this stays a standing rule rather than a hope: it was proven to catch a real injected orphan, naming the exact row, before being relied on. A null `approvals.stage` is legitimate and excluded - it means an approval issued before the column existed, which cannot satisfy a stage-scoped rule by design.

- **Decommissioning to Closed now has no document requirement at all, gated by the Senior approval alone, Round 7 Phase 3.2, 2026-08-18.** Recorded so this is not rediscovered later as an unexplained gap. That transition previously carried three `child_record_status` rules requiring an NDA, a PDPA assessment and a DPIA to be approved. They never worked: `transitions.js` had no branch for `child_record_status`, so the rule loop fell through and they blocked nothing. When Phase 3.2 came to build that branch, the rules turned out to be **unsatisfiable under every reading**, not merely unenforced. They named a child `record_type` of `nda`, `pdpa_assessment` and `dpia`. No such record types exist or can be created: this system stores documents as `record_type = 'document'` discriminated by `records.variant`, and the canonical vocabulary is `stage_reference_docs.document_name` - NDA, Site Assessment Report, Compliance and Data Protection, Partnership and Test Bed Agreement, Site Installation Document, Test Bed Review Document - which contains no PDPA Assessment or DPIA at all. Building the branch without removing them would have converted a transition that worked into one **no Test Bed could ever complete**, and the symptom would have been misleading: the Senior approval would sit visibly present and correct while the transition was refused. **Confirmed with the business: all three dropped as redundant**, since the earlier gates already prove those documents were reviewed. They were deleted from the live database and from `supabase/seeds/003_test_bed.sql` in the same change, per the standing rule above. **The gap is deliberate and temporary: Phase 4 adds a Decommissioning Report requirement to this transition.** Until it does, the only thing standing between a Test Bed and Closed is one Senior approval, which is less than the design in Section 8 describes, and is a known state rather than an oversight.

- **`document_type` is validated only as non-empty, but the hazard is API-only, corrected Round 7 Phase 3.2.** `POST /test-beds/:id/complete-document` accepts any non-blank string and writes it straight to `records.variant`, with no constraint, enum or foreign key anywhere in the schema. A typo'd `"NDAA"` was accepted with a `201` and created a real, approved document matching no rule. **That was done by direct API call, and no operator path reaches it.** The UI is effectively a pick-list: `submitDocumentForm(bedId, documentType)` is called from a row rendered out of `completable_documents`, which the server computes as `rules.map(r => ({ document: r.requirement_detail.document, ... }))` - the name handed to the button comes literally from the gate rule that will match it, so the round trip is self-consistent by construction. **This is meaningfully better than the `approvals.stage` orphan class, not worse**, and an earlier version of this entry had it the wrong way round: `approvals.stage` can drift through an ordinary stage rename, whereas this needs someone bypassing the product to call the endpoint directly. Recorded as a known API-surface gap, not a live operational risk, and not a candidate for the same invariant treatment on the same urgency.

- **`stage_reference_docs` and `stage_gate_rules` both hold document names as free strings with nothing aligning them, Round 7 Phase 3.2.** `reference_docs` (what the user is told to go and fetch for a stage) reads `stage_reference_docs.document_name`; `completable_documents` (what the gate will actually accept) reads `stage_gate_rules.requirement_detail.document`. They are independent sources and no constraint ties them together. On drift the gate still works correctly, because the completable list is derived from the rules themselves - it is the *informational* list that misleads, telling someone to obtain a document under a name the gate does not require.

- **A document gate must use `document_status`; `child_record_status` is for children with no completion UI. Round 7 Phase 4, recorded here because nobody reads a migration to configure a gate.** The two requirement types look interchangeable for documents and are not, and the difference is an operator affordance rather than a matter of style. `GET /test-beds/:id/document-requirements` builds `completable_documents` - the list that renders the "Confirm" button a user actually clicks to mark a document approved - by filtering on `requirement_type = 'document_status'` specifically, at both of its call sites in `test-beds.js`. **A `child_record_status` rule naming a document will therefore block its transition perfectly correctly and offer the operator no way to satisfy it from inside the product.** The gate would be right and the product would be stuck, which is a worse failure than a gate that is simply wrong, because everything looks configured. So: a gate on a document uses `document_status` with `{"document": "<name>", "status": "<status>"}`, where the name is exactly a `stage_reference_docs.document_name` value, no case folding anywhere in the path. `child_record_status` is the generic mechanism, matching `{"record_type": ..., "variant": ..., "status": ...}` on a child record of any type, with `variant` applied only when the rule supplies one.

- **`child_record_status` has no possible consumer today, and that is expected rather than a loose end, Round 7 Phase 3.2/4.** Zero rules use it, and none can usefully be written yet. The live record types are `account`, `contact`, `document`, `opportunity` and `test_bed`. Accounts, contacts and opportunities are not children of a gated record in a way any stage gate needs, and for `document` - the one child type that does exist - `document_status` is strictly better, because it carries the operator affordance described above. **The branch was still worth building and must not be tidied away.** It was built in Phase 3.2 because the mechanism was already referenced by seeded configuration and by Section 8, and a `requirement_type` that silently does nothing is the more dangerous state: three such rules sat in the seed for weeks looking like an enforced gate. It becomes useful the moment a child record type without its own completion UI exists - Pilot, Deployment or a Risk Register are the concrete candidates already discussed - at which point a gate can require one at a given status with no new code. Stated plainly so a future session neither wonders why an unused branch exists nor removes it as dead code: it is unused **on purpose and temporarily**, and its cost is one branch in one loop, covered by four tests.

- **Standing rule for verifying layout work, recorded Round 7 after the same class of mistake produced three separate false passes.** Layout is the one area of this project where an automated check has repeatedly reported success on genuinely broken output. The three instances are cited below because the rule is only credible with them attached; each was found by a different route and none was found by the check that was supposed to catch it.

  **1. Overflow: measure the container, not the body.** A flex or grid row clips its own children internally and never widens the document, so `document.body.scrollWidth > window.innerWidth` stays `false` while content is being cut off. Assert `container.scrollWidth > container.clientWidth`, and separately check each child's `getBoundingClientRect().right` against the container's own right edge. **Found the hard way, Round 7 Phase 6:** the Test Bed tab row carried 10 stage tabs plus a relocated action group, and at 1920px "Save changes" was cut off the right-hand edge entirely. The verification asserted `bodyScrollsX: false` and passed, because the row clipped internally exactly as flex is specified to do. The break was visible immediately in the screenshot.

  **2. Squeeze: that a region exists is not that it is usable.** A width and a visibility flag say nothing about whether text inside is readable. Assert a **minimum usable width** for the region, and derive a line count from measured element height divided by an **empirically measured** single-line baseline - measure a real one-line instance in the same context, never assume a value from font-size and line-height. **Found the hard way, Round 7 Phase 5:** the new header digest reported `visible: true`, `noteCount: 2` and the correct note text at every width, and all of that was accurate. At 1240px it was also 155px wide with every note wrapped to four ragged lines, because the adjacent name column had taken the slack. Every assertion passed; the result was worse than the empty space it replaced.

  **3. Element type: run the check on a block-level element, never an inline span.** A `display: inline` element's `scrollWidth` and `clientWidth` are both meaningless and typically `0`, so an overflow comparison on one always returns `0 > 0` - false, regardless of the truth. **Found the hard way, Round 6 Phase 1:** truncation was checked on the inner `<span>` and reported no truncation; re-run on the block-level `.linked-record-row` it correctly showed `scrollWidth` 484px against `clientWidth` 268px. That pass also established the empirical-baseline habit in rule 2, measuring a real single-line row at 37.5px rather than computing an expected height.

  **4. Take the screenshot and look at it. This is the primary check for layout work, not a fallback.** Both Round 7 failures above were caught this way and by nothing else; in each case the numeric assertions had already passed. A structural assertion answers a question you thought to ask, and layout breaks in ways nobody thought to ask about. Generating a screenshot and not opening it is not evidence - the file existing proves nothing, and saying "screenshots taken" while relying on the measurements is the failure mode this rule exists to prevent.

- **Removing the Test Bed warranty required passing `0` explicitly; omitting the key would have changed nothing, Round 7 Phase 8.** Recorded because the obvious reading of "a Test Bed has no warranty, so drop the field" is wrong here, and the brief's own explanation - that live records carried a stale non-zero `warrantyPct` inherited from Round 5 Phase 6's 5% test value - did not match production. **Checked before writing: no live Test Bed has ever STORED a `warrantyPct` at all.** All five were `null`. Every one of them was nonetheless computing a 2% warranty, because `buildTestBedCostBreakdown` in `test-beds.js` carried a `... : 2` fallback for the absent case. **And deleting that fallback alone would still have changed nothing**, because `calculateHardwareAndWarranty` in `deal-calculator.js` declares its own parameter default of `warrantyPct = 2`, which applies whenever the key is absent. Two independent defaults of the same value, in different files, either of which silently reinstates the warranty. Only an explicit `warrantyPct: 0` passed into the engine actually zeroes it - which is exactly what the Phase 1 test `calculateHardwareAndWarranty: an explicit 0 suppresses the default of 2` was written to pin, months before the change was built. **The general shape worth carrying: a default expressed in more than one place cannot be removed by deleting one of them, and "the field is gone from the UI" says nothing about what the calculation receives.** The reliable move is to pass the value you want explicitly and assert the resulting figure, not to remove the input and assume absence means zero. Note also that a stale `warrantyPct` surviving in an old `record_revisions` payload, or arriving in a restored dataset, is now genuinely unread: the mapping function hardcodes `0` and never reads the payload key, so finding `warrantyPct: 5` in history does not mean it is live.

- **A gate could be satisfied by an approval that did not apply to the record's real state, caused by a single unchecked query error, found and fixed in Round 7 step 3.0, 2026-08-18.** This is recorded as its own entry rather than folded into the unchecked-error rule above, because it is the only instance found anywhere in this codebase where an unchecked error caused a **fail-open** rather than a fail-closed, and because a gate that opens when it should not is a different category of problem from one that blocks when it should not. **The mechanism, precisely.** `transitions.js` resolved the record's current revision with `const { data: revRow } = await db.from('record_revisions')...`, destructuring `data` without `error`. On any transient failure of that query - a permission fault, a dropped connection, a PostgREST error - `revRow` is `null`, so `const currentRevision = revRow?.revision_number ?? 1` silently falls back to **1**. The `approval_obtained` branch then matched approvals on `revision_number = 1`. If a stale approval existed at revision 1 while the record had genuinely moved on to a much later revision, that approval satisfied the gate, and **the transition proceeded on the strength of a decision that did not apply to the record's real current state**. Nothing errored, nothing logged, and the response was a normal success. The narrow saving grace was that `revPayload` is `undefined` in the same failure, so any `payload_field_required` rule on the same transition still blocked - meaning the fail-open was only ever reachable on a gate whose requirements were approvals-only, which is exactly the shape of a commercial sign-off gate. **Confirmed latent, not live, at the time it was found**: the database held zero `decision = 'approved'` rows, so no record could reach the condition. That is a fact about that day's data, not a property of the code, and Round 7 Phase 3.1 was about to start writing real approvals in earnest - which is why 3.0 was deliberately sequenced **before** 3.1 rather than merely before 3.2, so the window closed before anything could enter it. **Stage-scoping does not remove this, and 3.1 must not be read as having fixed it.** A rule carrying `scope: "stage"` (Round 7 Phase 3.1) matches on `approvals.stage` and never consults `currentRevision` at all, so Test Bed stage gates are structurally immune. **Revision-scoped rules still match on `revision_number`, and those are the consequential ones**: Deal Sheet and Opportunity commercial approvals keep `scope: "revision"` by design, and an absent `scope` defaults to `revision` for continuity, so every pre-existing rule is revision-scoped too. The exposure therefore survived 3.1 on precisely the approvals that carry commercial authority, which is the reason it had to be closed in 3.0 or not at all. **The fix**: the query now destructures `error` and returns it, so an unchecked failure surfaces as a real 500 and **the transition is refused rather than silently decided**. An unchecked error is not "no result", it is "we do not know", and the whole class of bug here is code that treats those two as the same thing at the exact moment it is making a gate decision. Proven by forcing the failure for real - a temporary, reverted `REVOKE SELECT` on `record_revisions` returned `500 permission denied for table record_revisions` where the pre-fix code would have carried on with `currentRevision = 1`.

- **Every in-app reload returns the user to the Reference tab, whichever tab they were actually working on, found Round 8 Phase 1, 2026-08-18, pre-existing and deliberately not touched by that phase's fix.** `loadTestBedDetail()` sets `tbUserPickedTab = false` as its first statement, carrying the comment "a genuinely fresh load", and `renderTestBedDetail()` then runs `if (!tbUserPickedTab) switchTbTab('reference')`. That is correct for a genuinely fresh navigation into a record. It is **not** obviously correct for the six in-file call sites that re-enter the same function mid-session - adding a note, saving fields, linking a buyer, completing a document, adding a use case, adding an install note - because each of those is a user already working somewhere specific, not arriving fresh. Concretely: edit a Hardware Cost Rate on Commercials, trigger any of those six paths, and the tab silently switches to Reference. **Confirmed by direct test, clicking the real tab button so `tbUserPickedTab` was genuinely set**, ruling out the flag simply never having been raised: the tab still reverted, because the reload resets it before the render reads it. **The edit itself is safe** - Round 8 Phase 1 fixed the separate defect where a reload destroyed an open field's content, and the typed value now survives intact with its dirty state correct. What does not survive is the user's place: the value is preserved on a panel they are no longer looking at, and keyboard focus lands on `BODY` because the input it belonged to is now hidden. **Deliberately left alone, flagged for a real decision rather than fixed in passing**, since the right answer is a product judgement and not obvious. It is a choice between three positions, all defensible: treat every reload as fresh (today's behaviour, simple, occasionally rude); preserve the open tab across in-app reloads while still resetting on genuine navigation (probably what a user expects, needs the two cases distinguished at the call site rather than inside `loadTestBedDetail`); or stop reloading the whole record for narrow mutations at all and update just the affected panel, which is the largest change and the one that removes the underlying cause rather than compensating for it.

- **The Test Bed detail page has a whole-page vertical density limit that no individual panel can solve, quantified Round 8 Phase 3, 2026-08-18.** Recorded as its own entry because it was found while fixing something else, is not a defect in the panel that surfaced it, and will otherwise be rediscovered by whichever phase next tries to bring a figure above the fold. **The measurements**, taken at realistic monitor heights rather than a flat 1000px: the header block consumes 0-336px, the chevron strip a further 96px, the tab row another 96px, and the Commercials input-rate panels 379px, so **907px of a 1080px viewport is consumed before the Itemized Cost section begins at all**. At 1240x900 the input panels alone end at y=996, already 96px past the fold. **The consequence, stated plainly: at 1240x900 nothing in the Itemized Cost section can be visible without scrolling, whatever its internal layout.** Round 8 Phase 3 laid the three cost sections side by side (collapsing the breakdown from 745px to 368px) and then moved Total Cost above them rather than beneath - two genuine improvements that together moved the figure up more than 600px - and 3440x1440 now shows it comfortably, but 1920x1080 still clips it by roughly 20px and 1240x900 remains ~250px short. **Updated after Round 8 Phase 5 actually ran, 2026-08-18: the gap did not close, it grew, and the header was never the lever.** Two corrections to what this entry first said. First, the header block is **191px**, not 336px - the 336px figure measured from the page top to the chevron and included the margin and the "Workflow stage" title, which are not the header. Second, and more importantly, this entry speculated that Round 8 Phase 5's header rework "may recover most of this as a side effect". **It did the opposite, by design and knowingly.** Phase 5 moved Summary and Notes out of a middle column beside the name and stacked them beneath it. Side by side, the header cost `max(name 130, digest 191) = 191px`; stacked, it costs name + summary + notes, measured at **346px**. Total Cost moved from y=1054 to **y=1210**, so against a real ~950px viewport the shortfall went from 151px to **306px**. That was the correct outcome for that phase, whose brief asked for the repositioning on its own merits, and the visibility criterion attached to it was an addition rather than part of its scope - but it means **no part of this gap is owed by the header, and nothing about it should be expected from further work there.** **The real levers, none of them in the header:** the 145px band of margin, "Workflow stage" title and chevron strip between header and tabs; the 96px tab row; and the 379px block of input-rate panels, the largest single consumer on the Commercials tab. Recovering the 306px needs a deliberate pass at page furniture and the input panels, and should be scoped as its own work rather than attached to whatever phase happens to be nearby - which is exactly how it became attached to Phase 5 and then failed there. The remaining option, equally legitimate, is to accept that a go/no-go figure sits one scroll down at laptop resolutions and stop treating it as a defect. **Worth deciding deliberately rather than absorbing**, since the alternative is each future phase independently discovering that it cannot lift its own figure above the fold and either giving up quietly or trimming a few pixels from its own panel in a way that does not generalise. Also worth noting for whoever tests this: a headless viewport of 1080px has no browser chrome, so a real 1920x1080 monitor has roughly 950px of usable height and is meaningfully worse than these figures suggest, not better. **Updated Round 15 Phase 4, 2026-08-20: still open, and now measured at both widths for the first time.** Seven rounds re-measured this at 1920 because that is where Round 8 first took the number, and Round 15 Phase 0 found the criterion had inverted underneath them. At 1920 the gap had closed by 228px, to 78px, through changes made for other reasons: Round 13's sticky tab row cut the tab band from 96px to 82px, and the Reference grid work packed the rate panels three across instead of stacking. **Nobody attacked this item and it shrank anyway. And it is now worse at 1240 than it was ever recorded at 1920.** Round 15 Phase 4 added a Cost summary card and moved the `Hosting x N months` row into it, which lifted Total Cost by 53px at every width: **1240x800, 1143px to 1090px, 343px below the fold to 290px; 1920x950, 1028px to 975px, 78px to 25px; 3440x1440, 794px to 740px and above the fold throughout.** **The item is left OPEN.** 53px is the moved row and nothing else; the panel is worth having on its own terms and does not touch what sits above Total Cost. **The levers, unchanged and none of them in the header:** the page header, the workflow stage strip, the two tab rows, and the four input-rate panels, which remain the largest single consumer. This is the eighth round the item has been carried and the first with a full measurement at both widths, which is the thing that was actually missing: a criterion pinned to one viewport stops describing what it was written about, and this one had migrated to the narrower width while everyone kept checking the wider one.

- **A fix built for the pages that existed at the time is not a fix for the pages built after it. Named as its own standing entry, Round 8, 2026-08-18, after a third confirmed instance.** This shape has now produced a real, shipped defect three separate times, in three different rounds, and each time it was found by someone reporting a symptom rather than by anything in the build catching it. It is recorded here for the same reason the false-verification-signal principle was after Round 6: it is easy to see once named and nearly invisible while it is only a sentence inside three unrelated phase write-ups. **The three instances.** (1) **Round 5 Phase 4**: Opportunity's Contract Duration got a non-negative-integer fix in Round 3 Phase 3; Test Bed's own Duration field, the same shape on a different record type, never received it. (2) **Round 8 Phase 2**: spinner-arrow suppression was written in Round 3 Phase 4 as a deliberately blanket rule, scoped `#opp-tab-commercial`; Test Bed's Commercials tab was built two rounds later as `#tb-tab-commercials` and sat outside that selector, so nine cost-rate fields showed spinner arrows from the day they were built. (3) **Round 8 Phase 6**: Contact, Test Bed and Opportunity detail each override `.wrap`'s 1240px `max-width`; Account detail, built later in Round 5 Phase 10, never got the override, so its three panels could only ever render 2+1 no matter how wide the monitor. **The common shape, stated so it can be recognised early:** a fix is applied thoroughly and correctly across every surface that exists on the day it is written, often *deliberately* as a blanket or shared mechanism precisely to avoid per-instance drift - and then a new surface is added later that the blanket does not reach, because the selector, the field list or the override was enumerated at a moment when that surface did not exist. **The blanket mechanism is not the problem and should not be abandoned**; scoping is what made all three fixes correct in the first place. The problem is that adding a new page, tab or record type is silently also a decision about every existing scoped rule, and nothing currently forces that question to be asked. **Two practical consequences.** When building a genuinely new surface, explicitly check what scoped rules and shared field lists already exist for its siblings and decide, in writing, whether each applies - Round 8 Phase 6 was a one-line omission that took three rounds to surface. And when fixing an instance of this, fix the class rather than the report: Phase 2 was reported as one field on one panel and was actually nine fields across three panels, so the reported symptom understated it by a factor of three. **Where the automated suite can help, it should**: an assertion that every `input[type="number"]` inside a cost panel is spinner-suppressed, or that every detail view carries the wide-layout override, is the kind of check that catches this class on the day the new surface is added rather than rounds later.

- **Rounds 5 to 7 were built without the governing documents having been read, established at the start of Round 9, 2026-08-19.** `CLAUDE.md` names four documents to read first, every session: this file, `PROTOTYPE_SPECIFICATION.md`, `INTERACTION_STANDARDS.md`, and the current and previous round briefs. Only `CLAUDE.md` itself was loaded automatically at session start. The other three were first read part way through Round 8, immediately before its Phase 1. **Rounds 5, 6 and 7 were therefore built against the briefs alone, with no access to the reasoning, the prototype citations or the interaction specification.** Recorded because it reframes a run of findings that were previously read as isolated build mistakes. Rule 8 exists because "use the prototype as reference" without line numbers produced wrong builds repeatedly; Round 7 Phase 5 asserted twice, as a hard blocker, something contradicted by code it had not consulted; and the recurring pattern of a documented decision being rediscovered rather than looked up is the expected consequence of the reference material not being in the room. **The corrective is mechanical, not a resolution to try harder.** A document that must be read every session and is not loaded every session is not a governing document, it is a hope. `CURRENT_STATE.md` closes the factual half of this gap by being uploaded into the session deliberately; the three hand-written documents still depend on being opened, and this entry is the argument for making that an explicit first step of every round rather than an assumption.

- **Round 7's "exactly 7 rules" check lived in prose and was never encoded, so the count went unverified for two rounds, found Round 9 Phase 0, 2026-08-19.** `ROUND7_BUILD_BRIEF.md` Phase 0 required confirming that exactly 7 `test_bed` `stage_gate_rules` rows existed after the seed reconciliation, and that figure was later amended in the same document to account for Phase 3.2's deletions, with a note that it was "a checkpoint for this phase, not a constant". Both the check and its amendment were written as prose. **Neither was ever turned into an assertion.** A repository-wide search across every `.mjs`, `.js`, `.yml` and `.json` file found no rule-count assertion anywhere: the automated suite has never checked how many gate rules exist. Round 9 Phase 0 measured the real figure directly and found **10**, a number that no document in the repository states. Nothing was broken by this, and the 10 is legitimate, but for two rounds the count was carried in three documents and verified in none. **This is a specific instance of the standing rule that when a control matters, the assertion belongs in the suite where it passes or fails, not in prose**, and it is worth recording separately because the failure mode here is quieter than that rule's usual one: the check was not skipped, it was performed, reported honestly, and then left somewhere that cannot re-run. A number written into a brief is a measurement of one moment. Only an assertion is a check. Round 9 Phase 7 creates that assertion, which is a slightly larger piece of work than "update the seed count assertion" implies, because there is nothing to update.

- **The verification harness accumulates a permanent `record_type` per run, the same shape as the counter-accumulation finding and not yet fixed, quantified Round 9 Phase 0, 2026-08-19.** `scripts/tests/gates.test.mjs` mints a synthetic `record_type` of `harness_<runTag>` for each run, so every `npm run test:db` adds a new value to the `records` table's type namespace permanently. As of Round 9 Phase 0 there are **61 distinct `harness_*` record types holding 715 soft-deleted rows**, against 27 live business records in the whole database. **Teardown is working correctly**: zero harness rows are live, and no synthetic type appears in `stage_gate_rules`, so fixture rules and approvals are genuinely deleted. The residue is the soft-deleted records themselves, which teardown deliberately does not hard delete, and the type names they carry. **This is the identical shape to the counter finding already recorded above, and that correction is the reason it is worth naming.** Round 7's brief originally claimed a unique per-run key kept fixtures "from accumulating meaningfully", and that was corrected during the build to state plainly that uniqueness prevents collision, not accumulation, and that the two are not the same property. The fix chosen there was a separate keyspace, issuing harness counters through `p_scheme: 'harness'` so they land under one listable prefix. **`record_type` has no equivalent namespace**, so the same correction was never applied to the second place the same fault lives. **The practical cost today is legibility, not correctness.** Listed one line each in `CURRENT_STATE.md` these types occupied 624 lines of a 950 line file and would have made every round-on-round diff unreadable, which is why the generator aggregates them into a single line while still reporting the distinct-type count and listing individually any type still holding a live row. **Deliberately not fixed in Round 9**, which touches neither the harness nor the test suite's fixture strategy. Recorded so that whoever does pick it up knows it is a known instance of an already-understood fault rather than a new discovery, and knows that aggregating it in a report is a presentation decision, not a remedy.

- **Three Test Bed document decisions superseded by the business, and the naming of one artefact settled at its third attempt, Round 9 Phase 2, 2026-08-19.** All three were reasoned about deliberately in an earlier round, so each is recorded with the superseded reasoning left visible rather than quietly overwritten.

  **1. The shared living Test Bed Review Document is gone.** Round 7 Phase 4 recorded a deliberate and genuinely subtle decision: transitions 5 and 6 shared **one** living document, the Test Bed Review Document, and the document requirement was placed on transition 5 **only**, on the reasoning that transition 6 should be released by approval ticks made at that moment rather than by a persistent document that had not changed since the previous gate. **That entire piece of reasoning is now void.** Confirmed with the business: Monitoring and Analysis produces **Test Bed Performance** and **Review Meeting Minutes**, Review and Completion produces **Test Bed Close Out Report**, and both stages gate on their own documents. The replacement is simpler and removes a subtlety a future reader would otherwise have had to reconstruct from two tables that do not reference each other. **Worth keeping the superseded version visible** because it was not a mistake: it was a correct response to a genuine problem (how do you gate a transition on a document that does not change), and the business simply answered the question a different way.

  **2. Test Bed Performance and Review Meeting Minutes are living documents, and no new mechanism was built for them.** Confirmed with the business: each is a single document updated over the life of the stage, not one record per meeting. The gate requires it to be current and reviewed at the point of transition. That is exactly the shape the existing document mechanism already supports, one child record per document name with an updatable URL, so nothing was built. Recorded so a future round does not read "living document" as a gap and build a versioning mechanism the business never asked for.

  **3. Site Decommissioning Report, at the third naming of the same artefact.** The decommissioning document has now been called three things: **Decommissioning Report** (Round 7 Phase 4), **Site Installation Document on Decommissioning** (`PROTOTYPE_SPECIFICATION.md` Section 6's extracted table), and now **Site Decommissioning Report**. The third is authoritative. `PROTOTYPE_SPECIFICATION.md` Section 6 has been annotated rather than rewritten, since that document records what the prototype does and the prototype genuinely did carry the old name. **Site Installation Document is untouched on Installation and Commissioning**, which is its correct home and which gates transition 4; only the Decommissioning instance was superseded. **This is the case rule 3 of Round 9 exists for**: a document name is written identically in `stage_gate_rules.requirement_detail.document`, `stage_reference_docs.document_name` and the seed, with nothing in the schema aligning them, so three names for one artefact is not a documentation untidiness, it is three chances to configure a gate that can never be satisfied.

  **Also superseded, but recorded here only as a decision, with the consequential rewrite deliberately left to Round 9 Phase 5.2:** the senior-tier sign-off on Decommissioning to Closed is replaced by Technical, Commercial and Legal, the same three tracks as the two preceding transitions. Section 8's claim that the final transition is "gated more heavily than the rest of the lifecycle" becomes untrue at that point, and `routing_rules` becomes referenced by nothing anywhere in the system. That paragraph is rewritten when the rows actually exist, not in advance of them.

- **The Test Bed document catalogue lives entirely in migrations, not in any seed, established Round 9 Phase 2, 2026-08-19.** Recorded because the Round 9 brief instructed reconciling `supabase/seeds/003_test_bed.sql` alongside the live database when changing the catalogue, per the standing rule that a migration changing seeded data must reconcile the seed in the same change. **That seed contains no `stage_reference_docs` rows at all.** All 8 original rows came from migration `20260815000005_stage_reference_docs.sql`, and `003_test_bed.sql`'s only remaining content is the single `Senior` gate rule. **The standing rule was correctly cited and did not apply**, and the distinction matters in both directions: the rule exists because seeds re-run and win, so where there is no seed row there is nothing to resurrect, and **adding one would have been actively harmful** by creating a second home for the same data with a genuine chance of the two drifting. The general shape worth carrying: before reconciling a seed, check that the data is actually in it. "Reconcile the seed" is a remedy for a specific mechanism, not a ritual to perform on every data change.

- **Two migrations were applied to the live database without being recorded in the migration ledger, found Round 9 Phase 2, 2026-08-19.** Running `npm run db:push` to apply this round's catalogue migration also applied `20260818000000_approval_stage_scope.sql` and `20260818000001_gate_config_transitions_1_2.sql`, both from Round 7, whose effects were already present in the database. The Supabase CLI believed them pending because `supabase_migrations.schema_migrations` did not carry them, which means Round 7 applied their SQL by some direct route rather than through `db push`. **No damage, and the reason is worth stating precisely: both were written idempotently.** The first uses `add column if not exists` and `create index if not exists`; the second guards all three of its `INSERT`s with `where not exists`. Verified after the push by direct query: `stage_gate_rules` still holds 26 rows, 10 of them `test_bed`, with zero duplicates, matching the Phase 0 baseline exactly. **The hazard this came close to is real.** Had either migration been written with a plain unguarded `INSERT`, which is an entirely normal way to write a migration whose ledger entry is supposed to guarantee single execution, this push would have silently duplicated the Qualification and Pre-Site Assessment gate rules, and a duplicated gate rule is invisible in the UI while doubling a requirement. **Two things follow.** Data-writing migrations should be written idempotently regardless of the ledger, because the ledger is a second system that can disagree with the schema. And the ledger and the schema can drift apart without any symptom, so `npx supabase migration list` is worth checking when local and remote history might have diverged, rather than assuming a clean `db push` implies a clean ledger. The ledger and the local migration directory are now in sync at 37 entries.

- **The transition endpoint enforces no stage adjacency, so any record can jump to any stage of its own type entirely ungated, found Round 9 Phase 4, 2026-08-19.** `POST /records/:id/transition` validates that `to_stage` appears in `stage_definitions` for the record's type and variant, and nothing further. It does not compare `sort_order`, and there is no adjacency check anywhere in the file. `computeBlocking` is then called with `(from_stage = record.status, to_stage = requested)`, and gate rules are keyed on exactly that pair. **The consequence is that skipping a stage does not bypass its gates so much as land in a configuration where no gates exist at all.** For `test_bed` today there are 8 stages, so 56 ordered stage pairs, of which 5 carry rules and **51 carry none**. `Qualification` to `Closed` is one of the 51 and would be permitted outright. **Found by accident and worth recording as such:** the first Phase 4 walkthrough used the mutating transition endpoint as a read probe, so it transitioned the moment a gate cleared, and it silently skipped `Site Assessment` because transition 2 had not completed. That skip is now permanently visible in `audit_log` as `Pre-Site Assessment -> Installation and Commissioning`, a two-stage jump with no gate evaluation, and it is the clearest possible evidence of the hole. **Deliberately not fixed in Round 9 Phase 4, which is a configuration phase and changes no code.** It matters most for Round 9 Phase 8's audit-trail coherence check, which will read that entry, and for the product generally: an operator or any API caller can move a record anywhere in its lifecycle. Whether adjacency should be enforced at all is a real product question rather than an obvious yes, since a legitimate backward correction (a record advanced by mistake) also runs through this endpoint and would be refused by a naive forward-only check. What is not defensible is the current state, where the absence of a check is silent and undocumented.

- **A stage-scoped approval for a track already approved at an earlier stage is refused while the revision has not moved, found Round 9 Phase 4, 2026-08-19.** The `approvals` unique constraint is `(record_id, revision_number, track, approver_id)`. It was written in Milestone 1, before approvals had any concept of stage, and **Round 7 Phase 3.1 added `approvals.stage` without revisiting it.** So a Test Bed that needs a Commercial approval at Pre-Site Assessment, having already had one at Qualification, is refused with `409 An approval decision from you already exists for this revision and track` unless some field edit has advanced the revision in between. Reproduced directly against the live endpoint, not inferred from the schema. **This is a genuine workflow blocker rather than a cosmetic one**, because the same track legitimately approves at several consecutive stages: Round 9's configuration has Commercial gating transitions 1, 2, 3 and 4. During the Phase 4 walkthrough it fired twice and had to be worked around by making a real field edit to advance the revision, which is plausible operator behaviour but in no way guaranteed. **The narrow fix is to add `stage` to the constraint**, `(record_id, revision_number, track, approver_id, stage)`, which is consistent with what Round 7 Phase 3.1 made approvals mean and keeps `revision_number` recorded exactly as constraint 1 of that phase requires. Deliberately not applied in Phase 4, a configuration phase, and flagged before Phase 8 drives the full lifecycle through the browser, where the same 409 will appear as an unexplained failure to tick a box.

- **The missing adjacency check was surfaced by a fault in the verification method, not by any check that was running, Round 9 Phase 4A, 2026-08-19.** Recorded separately from the defect itself because how it was found is the more useful half. Phase 4's first walkthrough used the **mutating** transition endpoint as a read probe, measuring the blocking list by attempting the transition. That endpoint performs the transition the moment it stops being blocked, so the record advanced on its own; a gate then failed, the record sat at a stage the script did not expect, and the next probe requested a stage two ahead. **It succeeded**, because gate rules are keyed on the `(from_stage, to_stage)` pair and a two-stage jump matches no pair at all. **Nothing that was supposed to be watching noticed.** The automated suite passed, every gate rule was correctly configured and correctly evaluated, the orphaned-rule invariant passed, and the walkthrough's own per-step assertion was satisfied at each step it checked. The hole is not in any rule; it is in the space between the rules, and every check in place was a check *on* rules. **Three things worth carrying.** First, the standing verification rule that a probe must not be the thing it probes: a read-only endpoint existed for exactly this (`GET /records/:id/exit-criteria`) and using the mutating one instead was a straightforward mistake, made because it returned the same `blocking[]` and looked equivalent. Second, **a broken harness is a source of findings and should be read before it is fixed.** The instinct on seeing the skip was that the script was wrong, which it was, and the skip was still real. Had it been corrected without being explained, the adjacency hole would have survived into Phase 8 and been found by an operator instead. Third, this is a second instance of a shape already recorded here after Round 6: a verification that produces a confident signal about something other than what it claims to measure. The earlier instances produced false passes; this one produced a **true finding for a false reason**, which is the same fault wearing the opposite sign.

- **Stage adjacency is now enforced on forward transitions, and backward moves are permitted ungated as a deliberate concession, Round 9 Phase 4A, 2026-08-19.** The rule, confirmed with the business and built in `transitions.js` with no new table and no schema change: a forward transition must be to the immediately next stage and is gated exactly as configured; a backward transition to any earlier stage is permitted, **ungated**, and marked in `audit_log` with `regression: true`, `direction: "backward"` and `gated: false`; a same-stage or unknown-stage transition is refused. An unknown *current* stage is refused too rather than being treated as the start of the list, since a record whose status is not in its own type's stage list is a data fault and guessing a direction for it would turn that fault into an unaudited stage change. **Adjacency is measured by position in the sort_order-ordered list, not by `sort_order` arithmetic**, which is a deliberate and stated departure from the rule as written ("exactly +1 on sort_order"). For every record type today the two are identical because every stage list is contiguous from 1, but they stop being identical the moment a list is numbered 10, 20, 30 to leave room for insertions, and +1 arithmetic would then refuse every forward transition in that record type. Position is also what `GET /records/:id/exit-criteria` already uses to decide which stage a record is heading for, so the endpoint that reports what is needed to exit and the endpoint that performs the exit now agree by construction rather than by coincidence. **Why backward is ungated, stated plainly because it is a real concession and not an oversight:** gate rules describe what it takes to LEAVE a stage, not what it takes to re-enter one, so evaluating them on a reversal asks the wrong question, and the (from, to) pair of a reversal is not a configured transition and never will be. A record advanced in error has to be recoverable and this is the mechanism. **What remains genuinely open, and is deliberately not decided here:** whether a reversal should require a stated reason, an entitlement, or both. That is the same governance question as approval entitlement, which is also unenforced, and the two should be answered together rather than separately.

- **The approvals unique constraint now carries `stage`, closing a defect Round 7 Phase 3.1 created and did not see, Round 9 Phase 4A.2, 2026-08-19.** The constraint was `(record_id, revision_number, track, approver_id)`, written at Milestone 1 when approvals had no concept of stage. Phase 3.1 added `approvals.stage` and made stage-scoped rules match on it, but left the constraint alone, so **a track that had already approved at an earlier stage could not approve at the next one until some field edit advanced the revision.** It is now `(record_id, revision_number, stage, track, approver_id)` with `NULLS NOT DISTINCT`. **Both keys are retained on purpose.** Dropping `revision_number` would have been the smaller-looking change and is wrong: Phase 3.1's own constraint 1 requires approvals to keep recording the revision even when gated on stage, so a future pricing-history view over `record_revisions` stays possible. `NULLS NOT DISTINCT` is required rather than incidental: `approvals.stage` is nullable and pre-3.1 rows carry null by design, deliberately un-backfilled, and under Postgres's default `NULLS DISTINCT` two null-stage approvals for the same record, revision, track and approver would stop colliding with each other, quietly weakening the constraint for exactly the historical rows it already protects. **One property was established rather than measured before building.** Phase 0 had found zero null-stage rows, which is a fact about that day's data and says nothing about future writes. Checked directly instead: `src/routes/approvals.js` is the only insert path into the table anywhere in `src/`, and it writes `stage: record.status` where `records.status` is `NOT NULL`, so every approval written from here on carries a stage as a property of the code. **The general shape worth carrying: adding a column that changes what a row means is also a change to every constraint that row participates in, and nothing in the database will point that out.** Phase 3.1 was reviewed carefully, added a migration, an index and a shared predicate, and still left the uniqueness rule describing the old meaning.

- **The first Test Bed to complete the full lifecycle, Qualification to Closed through every configured gate, 2026-08-19, Round 9 Phase 5.** `TT-SGP-AIRPRT-004` passed all seven transitions with every gate genuinely satisfied: 9 documents approved, 18 approvals across 7 stages, 5 judgement criteria ticked, 3 buyer roles linked, and 3 payload fields set. Recorded because until this point the Test Bed lifecycle was a configured shell that no record had ever been through, and several things which had looked correct for three milestones were only tested for the first time here. **Two real defects were found by driving it and would not have been found any other way.** The transition endpoint enforced no stage adjacency, so 51 of 56 ordered stage pairs were completely ungated and `Qualification` to `Closed` would have been permitted outright. And the `approvals` unique constraint still carried the pre-stage-scoping shape, so a track that had approved at one stage could not approve at the next until an unrelated field edit moved the revision. Both were configuration-independent mechanism faults sitting underneath correctly configured rules, which is why no amount of checking the rules would have surfaced them. **The general point, and the reason this is worth an entry rather than a note: a workflow that has never been completed end to end is not a workflow, it is a set of rules that have each been tested alone.** Every gate rule was individually correct before this walkthrough, every automated test passed, and the lifecycle still could not be completed as configured. Driving it once, by the person who configured it, was the cheapest possible way to learn that, and it should be the closing act of any round that configures a process rather than something deferred to the first real user.

- **Saving a document's working-copy URL would have approved the document and released the gate that document exists to hold, found Round 9 Phase 6.1, 2026-08-19. Ranked the most consequential defect of the round after the missing adjacency check.** The counterfactual, stated plainly because it is the whole point: an operator pasting a link to a half-written Site Assessment Report into the URL box would have marked that document approved, satisfied the `document_status` rule on Site Assessment to Installation and Commissioning, and moved the Test Bed one step closer to a transition **on the strength of a link to a document nobody had reviewed.** The gate would have reported itself satisfied, the tick list would have shown a green row, and nothing anywhere would have recorded that a review had not happened. **And it would have shipped invisibly, which is the part worth carrying.** There was no bug to notice in any existing behaviour: every caller of `complete-document` up to that point genuinely did mean approve, so the endpoint was correct for every use it had. The fault only existed for a use that did not exist yet, and it would have arrived as a feature rather than as a regression - no test would have broken, because nothing was broken until the URL box was added. This is why the brief's instruction to "confirm that directly before building" earned its place: the phrase it was checking, "wiring rather than new mechanism", was a reasonable reading of an endpoint that really did already store a URL. `POST /test-beds/:id/complete-document` set `const status = 'approved'` unconditionally, and the same endpoint was the only way to store a Drive URL. The Round 9 brief expected the editable-URL half of the merged Terminus Documents panel to be "wiring rather than new mechanism, confirm that directly before building". Confirmed directly, and it was not wiring: **an operator pasting a link to a document still being written would have satisfied that document's gate**, which is precisely the failure a document gate exists to prevent. Fixed with an `approve` flag defaulting to `true`, so every pre-existing caller behaves exactly as before, and `approve: false` records or keeps the document child and its location without touching its status. A document that does not exist yet is created at `draft`. Proven in both directions rather than one: `approve:false` on a new document stores `draft`, a second URL-only save leaves it `draft` with the new URL, a default call with no `approve` key still approves, and a non-boolean is a 400. **Two smaller things were fixed alongside and are worth naming because neither was the reported problem.** The `document_details` upsert's error was never checked, so a failed URL save returned 200 while nothing was stored, which matters far more once the URL is a field an operator edits rather than an occasional argument. And the response reported the *requested* status rather than the stored one, so `approve:false` against an already-approved document would have replied `draft` about a row that was still `approved`. **The general shape: an endpoint named for one action, `complete-document`, had quietly become the only route to a second, unrelated one, storing a link. The name kept describing the first while the second was the one being used, and nothing about the signature made the coupling visible.**

- **The Customer Documents panel was removed from the Test Bed stage tabs, Round 9 Phase 6.1, 2026-08-19, correcting a display rename that attached a customer-facing name to Terminus's own data.** Round 7 Phase 7 renamed "Reference Material" to "Customer Documents" and "Documents" to "Terminus Docs", as a deliberate display-only change. The rename was applied to the wrong panel. `GET /test-beds/:id/document-requirements` returns `{ reference_docs, completable_documents }`, and the panel labelled Customer Documents rendered `reference_docs`, which is sourced from `stage_reference_docs` - the table whose own migration comment describes it as "while at Pre-Site Assessment, go get the NDA", meaning **Terminus's own per-stage document list**. So the two panels were the same documents twice, and the customer-facing label sat on the half that had nothing to do with the customer. Confirmed by reading the rendering code in Phase 0 and visible in Phase 4's screenshot before the fix. The two are now one panel titled Terminus Documents. **Customer Documents as a concept does not exist in this system at all**, means client-supplied reference material, and arrives on the Reference tab in Round 11 with the Drive work; removing the label entirely is more honest than leaving it pointing at the wrong data. **This is the second recorded instance of a rename being applied without checking which data the renamed element actually rendered**, and it is worth stating as a rule: a display rename is safe only once the element's data source has been traced to its table, because the label is a claim about the data and nothing checks it.

- **A transient network failure mid-suite leaves fixture rows in the live configuration tables, and the new invariants caught it on their first run, Round 9 Phase 7, 2026-08-19.** `npm run test:db` failed once with `PGRST303 JWT issued at future` in one file's `before` hook and `TypeError: fetch failed` in another's concurrency test. Re-running passed, and the natural reading was a flake to be re-run and forgotten. It was not: that aborted run left **15 `stage_gate_rules` rows, 16 records that were still LIVE rather than soft deleted, 5 child documents, 2 contact links and 1 approval** behind under one synthetic `record_type`. The next `before` hook read them and invariants 2 and 4 failed, naming the exact rows. **The teardown itself is correct and was simply never reached.** `Fixtures.teardown()` runs in an `after` hook, and an `after` hook does not run the cleanup for work whose own file aborted in `before`, so a failure early enough in a run abandons everything the run had already created. **Three things worth carrying.** First, this contradicts a property `CURRENT_STATE.md` reported at Phase 0, that no harness `record_type` holds a live row - true when measured, and not a property of the system, which is exactly the distinction between a measurement and an invariant. Second, **the invariant earned its place on its first execution**, against residue rather than against the misconfiguration it was written for, which is the more common way these pay off. Third, a flaky test run is not only a signal about the test: it is a signal that some portion of that run's side effects were never undone, and re-running to green hides that rather than resolving it. **The underlying fragility is recorded and not fixed here:** teardown that runs only on the happy path is not teardown, and the harness should reconcile by run tag at startup, or sweep abandoned tags, rather than relying on every run reaching its own `after` hook.

- **The `JWT issued at future` rejection recurred, 2026-08-19, first observation since Milestone 1.** Recorded against the existing Deferred scope entry, which stated it had been observed once during Milestone 1 reference-number testing and that roughly 200 further attempts across 8 rounds had produced zero recurrence, cause unconfirmed. It has now happened a second time, in Round 9 Phase 7, as `PGRST303 JWT issued at future` from PostgREST during a `npm run test:db` run, alongside a `TypeError: fetch failed` in the same run - which suggests a transient condition affecting the connection generally rather than anything specific to token generation. The immediately following run passed with no change to any code or credential. **Still not reproducible on demand and still not fixed**, but no longer a single unrepeated observation, which is the only thing that has changed about it. Its real cost this time was not the failed run but what the failed run left behind, recorded separately above.

- **The Test Bed lifecycle was driven end to end through the browser by one operator, Round 9 Phase 8, 2026-08-19, and the friction it exposed is recorded here because it is the deliverable rather than a by-product.** `TT-SGP-AIRPRT-008` went Qualification to Closed through the real UI: seven transitions, 9 documents confirmed, 18 approvals, 5 criteria ticked, 3 buyer roles linked and 3 payload fields set. The audit trail is clean - seven transitions in ladder order, each exactly one stage forward, one real actor, strictly increasing timestamps, and zero `data_correction` or regression entries. Every approval carries a non-null stage.

  **The real click count for a full lifecycle is 59**, not the "nineteen approval ticks" the brief anticipated, and the shape of the number matters more than the number. 18 are approval ticks, 9 document confirms, 5 criteria ticks, 7 Next Stage presses, 8 stage-tab openings, 8 field-entry clicks and 3 buyer selections. **A third of the total is navigation rather than decision**, which is the part worth revisiting before anyone concludes the approval count is the problem.

  **Every transition throws the operator back to the Reference tab.** Already recorded as a standing entry after Round 8 Phase 1, where it was found on note-adding and field saves and left deliberately unfixed pending a product decision. This walkthrough establishes that it fires on **every one of the seven transitions**: press Next Stage on the current stage tab, and the page returns to Reference, so reaching the next stage's gate costs an extra navigation every time. Seven of the 59 clicks exist only because of it. That moves it from an occasional irritation to a per-transition tax, and it is the single cheapest thing to fix on this list.

  **The exit criteria panel lags the server by one refresh after a rapid sequence.** On two transitions the panel still showed one outstanding row while the server considered the gate satisfied, and the transition then succeeded from the same screen. No incorrect outcome, because the server decides and the server was right, but an operator would see a red row and a working Next Stage button at the same time and have to guess which to believe. Caused by each approval triggering its own re-render while the previous request is still in flight, and worth fixing with a settled-state refresh rather than a per-action one.

  **Two Terminus-side fields are never required by any gate and stay empty through the whole lifecycle**: Terminus Lead, and the Commercial, Technical and Legal Authority fields. A record can reach Closed with no Terminus owner recorded at all. That is a configuration question rather than a defect - no rule asks for them - but a completed R&D engagement with no named internal owner is worth a deliberate decision rather than an accident of which rules were written.

  **What did not go wrong is worth stating too**, because each was a live risk: no approval needed a revision workaround, which is Phase 4A.2 holding across all 18; no stage could be skipped, which is Phase 4A.1 holding; and every required document rendered a working Confirm control at every stage, at a usable 80px, which is the affordance Phase 6 rebuilt.

- **The system records who approved and never records who was accountable. Established as its own decision, Round 9 Phase 8, 2026-08-19, and it is the mandatory-field column Round 7 Phase 4 left open.** `TT-SGP-AIRPRT-008` completed the entire Test Bed lifecycle, Qualification to Closed through every configured gate, with **Terminus Lead empty and the Commercial, Technical and Legal Authority fields all empty**. No gate rule asks for any of them, so nothing blocked, and the record reached Closed as a complete, fully audited engagement with **no internal owner named anywhere on it.**

  **The specific point, because it is sharper than "some fields were blank".** Eighteen approvals were recorded against the Commercial, Technical and Legal tracks across seven stages. The three fields that name the Commercial, Technical and Legal Authority for that Test Bed were empty the entire time. **The system captured, precisely and immutably, who clicked approve on each track at each stage - and captured nothing at all about who was supposed to be answerable for that track.** Attribution is real; accountability is absent. Those are different properties and the record only has the first, which matters directly for the ISO 9001 reading already recorded here: an approval proves a tick happened, not that the entitled person made it, and now not even that an entitled person was ever identified.

  **This is not a layout item and should not be carried as one.** Round 7 Phase 4 configured transitions 1 and 2 and recorded that the mandatory-field column was the open question for the remaining stages. Round 9 configured every remaining gate and answered that column for documents, approvals and judgement criteria, but never revisited whether any Terminus-side field should be mandatory. **Phase 8 is the evidence that question was waiting for**: it took a completed lifecycle to show that the answer "none of them" produces a closed record nobody owns.

  **Recommendation carried, deliberately not built in Round 9:** one `payload_field_required` rule on transition 1 for **Terminus Lead**, so an engagement cannot leave Qualification without a named internal owner. **The three Authority fields are left open**, for a reason worth stating: they name who *should* sign each track, and making them mandatory is only meaningful alongside approval entitlement, which is deliberately unenforced while there is one user. Requiring them now would create a field that must be filled and cannot yet be enforced against, which is how documents come to describe controls that do not exist. Terminus Lead is different because ownership is answerable regardless of who ends up approving.

- **Standing rule: every round ends by regenerating `CURRENT_STATE.md` and committing it. Established Round 9 Phase 9.3, 2026-08-19.** It is generated, never hand written, and records what is configured, never why. Reasoning stays here in `DESIGN_PRINCIPLES.md`; prototype extraction stays in `PROTOTYPE_SPECIFICATION.md`. **Its diff between rounds is the configuration changelog**, and is worth more than any single snapshot of the file. It carries no secrets and no client-identifying data, because it is uploaded into chat sessions where design work happens away from the repository. **A round is not complete until it has been regenerated and its diff reconciled against that round's own phase list, item by item. A change in the diff that no phase accounts for is a finding, not noise.**

  **The three-way separation this completes, and why it needs three documents rather than two.** `PROTOTYPE_SPECIFICATION.md` answers what the prototype does, cited by line. `DESIGN_PRINCIPLES.md` answers why a decision was taken and what it supersedes. `CURRENT_STATE.md` answers what is configured right now. Collapsing any two has already caused real rework: Section 8 of this document described a senior-tier gate that had never had data behind it, and said so confidently for three milestones, because the only place recording what actually existed was the database and nobody was reading it between rounds.

  **Where the generated file and a hand-written one disagree, the generated one is right about what exists and the hand-written one is right about what was intended, and the disagreement itself is the finding.** Round 9 Phase 0 produced two on its first run: this document still asserted that `child_record_status` had no code branch, which Round 7 Phase 3.2 had built, and still described document rules on the final transition that the same phase had deleted. Neither would have surfaced by re-reading the document, because a document re-read confirms itself.

  **One caution learned by doing it.** A measurement in the generated file is not an invariant. Phase 0 reported that no harness `record_type` held a live row, which was true when measured and became false the moment a test run died before its teardown. What the file records is the state at a moment; what holds always belongs in the automated suite. Round 9 Phase 7's invariants exist for exactly the facts that were previously being read off this file and treated as guarantees.

- **`scripts/state-dump.mjs` must never be run while `npm run test:db` is running, established Round 10 Phase 0, 2026-08-19.** The generator reads the live database, and the test harness creates its fixtures in the same live configuration tables it reads. A dump taken mid-run reports those fixtures as configuration. **This is not a cosmetic overlap, it is indistinguishable from a real finding.** The first Round 10 Phase 0 dump reported **63 `stage_gate_rules` rows including 9 under a synthetic `harness_*` record type**, which is precisely the shape of Round 9 Phase 7's genuine abandoned-fixture defect, where a run that died before its `after` hook left 15 gate rules and 16 live records behind. The two are the same output. Only the timing distinguishes them, and the file itself records no timing beyond a generation timestamp that means nothing without knowing what else was running. Re-running after the suite finished, with `teardown verified: rulesDeleted: 23` in its output, gave the correct 54. **The rule: let the suite finish, confirm its teardown line, then dump.** If a dump does show harness rows in a configuration table, check whether a suite was running before reporting it as residue, and say which was established rather than assuming either. **Worth recording as its own entry rather than as a note on the round, because the failure mode is a false positive in the one file the project relies on to be right about what exists**, and because the honest reading on the day was that a real defect had recurred.

- **The unfiltered `onAuthStateChange` handler navigates to Leads on a background token refresh, and it misattributes as a bug in whatever the user last did. Found Round 10 Phase 0, 2026-08-19, from a report that named the wrong cause.** `init()` in `frontend/app.js` wires `supabaseClient.auth.onAuthStateChange((_event, session) => { if (session) showApp(session) ... })` with **no event filter**, and `showApp()` ends with `navigate('leads')`. Every session-bearing auth event therefore re-runs the whole sign-in path, including the navigation. Supabase refreshes the access token automatically in the background, so roughly once an hour, wherever the user is and whatever they are doing, they are silently returned to Leads.

  **How it was reported, and why that is the point of this entry.** It arrived as "the New Contact dialogue's Save returns the user to the Leads page", and the Round 10 brief scoped a phase to fixing that save path. **Neither contact-creation dialogue navigates anywhere near Leads.** There are exactly two in the whole frontend, confirmed by sweeping every `POST /api/contacts` caller: the New Lead modal, whose `saveContact` ends in `closeNewLeadModal()` then `loadContactsData()` and does not navigate at all, and whose trigger button exists only inside `view-leads` so the user was already there; and the inline buyer-contact modal, which has two callers, Test Bed and Opportunity, and already reloads the originating record for each. Both were already correct. Building the phase as briefed would have changed working code and left the real defect in place.

  **Reproduced directly rather than argued from the code.** Sitting on a Test Bed detail page with no user action: a `visibilitychange` produced no auth event and no navigation, a window `focus` event produced no auth event and no navigation, and a genuine `refreshSession()` produced a `TOKEN_REFRESHED` event and moved the app to `view-leads`. The trigger is specifically the token refresh, not tab focus.

  **The general shape, and the reason this is worth a standing entry rather than a bug note: a periodic background event that steals the user's place will always be reported as a bug in whatever they last did.** The user has no way to see the refresh, so the only thing available to blame is the last deliberate action, and the report will name it confidently and specifically. Two consequences follow. A report of the form "X takes me back to Y" should be checked against whether X navigates **at all** before a fix is scoped to X, because the answer here was that it does not and never did. And an app-wide handler that re-runs a whole entry path on every event of a class is worth auditing for exactly this, since the cost lands far from the code and looks like someone else's defect.

- **One click now both reveals and opens a click-to-edit control, closing a two-click defect that Round 8 could not reproduce and that turned out to be eight controls wide. Round 10 Phase 0A, 2026-08-19.**

  **The cause was never the dropdown, which is why looking at the dropdown found nothing.** A closed click-to-edit field is a `<div class="ref-field-display">` and its control lives in a **sibling** `<div class="ref-field-edit hidden">`. The `open*Field` handlers hide the div, unhide the sibling and call `focus()`. **The click that reveals the control is therefore consumed by a different element and can never also open it.** Measured directly rather than reasoned about: after one real click at the field's own centre, the `<select>` was revealed, focused, and sitting under the pointer having received **zero** pointer events, and a second click at the identical coordinates was needed. The original report, "a first click focuses without opening, a second is needed", was exactly accurate about the observable state. Round 8 Phase 1 investigated the same symptom and could not reproduce it; the most likely reason is that there is no defect in the `<select>` to find, since the control is entirely healthy.

  **Eight controls affected, not the one reported**: five `<select>` (Terminus Lead, Commercial Authority, Technical Authority, Legal Authority, Region), one more on Site Details (Site Ownership), and two `<input type="date">` (Estimated Installation Date, Est. Go Live) whose calendar has the identical two-click cost. Seven text, number and textarea fields on the same tab were **not** affected and were deliberately left alone: focus alone already makes them usable, so one click genuinely works there and a change would have been a regression rather than a fix. **The defect is specific to controls with a popup layer**, which is the distinction that makes the fix targetable at all.

  **Built as one shared helper, `window.revealFieldControl` in `app.js`, not four copies.** Four independent implementations of this pattern exist, `openTbField`, `openRefField`, `openCdField` and `openAcctField`, across Test Bed, Opportunity, Contact and Account detail. Fixing only the eight reported fields would have been a textbook instance of the standing entry above, a fix built for the surfaces that existed at the time, which has produced a shipped defect three separate times in this project. `app.js` loads first, so a helper defined there reaches all four, and the helper is attached to `window` rather than declared as a top-level `const` per the recorded name-collision rule.

  **`showPicker()` is the mechanism, and an explicit gesture flag rather than activation detection is the guard. That choice was vindicated by a finding, not by reasoning.** The obvious implementation is to detect a user gesture with `navigator.userActivation.isActive` and open the picker whenever one is present. That was rejected in favour of an explicit `fromUserGesture` parameter passed only by the real click and keydown handlers, because `openTbField` is **also called programmatically** to restore an open edit after a save, and Chrome's transient activation lasts several seconds, so a save click could still be "active" when the restore ran and would have popped a picker open in the user's face. **The finding that settles it: `showPicker()` on these controls did not throw with `navigator.userActivation.isActive === false`** in Chrome 152, verified directly. So activation detection would not have protected the restore path at all, and the explicit flag is the only thing that does. Confirmed by test: the restore path records zero `showPicker` calls while still opening and focusing the field exactly as before.

  **A verification lesson worth keeping, because the first two checks I wrote both proved nothing while appearing to pass or fail correctly.** First, the metric had to change with the mechanism. The instrumentation that *reproduced* the defect counted `mousedown` events reaching the control, and under the fix that count is still zero, because the picker is now opened programmatically rather than by the click reaching it. Continuing to measure mousedowns would have reported the fix as a failure. **The check has to follow the claim, not the previous check.** Second, my initial negative control called `showPicker()` on a control that had never been revealed, got a `NotSupportedError` from the unrendered element, and I nearly read that as proof of activation enforcement; it was proof of nothing. **The decisive negative control was the obvious one: run the identical probe against the real pre-fix code.** That gives 0 of 8 before and 8 of 8 after, which is what makes the measurement evidence rather than assertion. Third, a check that six unaffected text fields still accept typing failed on all six until I noticed the caret lands at the **start** of a focused text input, so `value.endsWith(typed)` is the wrong assertion; comparing the value before and after is the right one. None of these three was a product fault and all three looked like one.

  **Known limitation, stated rather than papered over: the native popup layer is not screenshot-verifiable.** A `<select>` list and a date picker render in the browser's own popup layer, outside normal page compositing, exactly as already recorded here for the native `<datalist>` suggestion popup. What a screenshot proves is that the reveal renders correctly and the panel does not break; what proves the picker opened is that `showPicker()` was invoked exactly once per single click, under real user activation, and was accepted by the browser without throwing, against a pre-fix baseline of zero invocations.

- **An ephemeral auth user created for browser verification is silently adopted by the test harness as the owner of every fixture it creates, and then cannot be deleted. Found Round 10 Phase 0A, 2026-08-19, unresolved at the time of writing.** `resolveOwnerId()` in `scripts/verify-harness.mjs` resolves the account that owns fixture records with `db.auth.admin.listUsers({ page: 1, perPage: 1 })` and takes `users[0]`, that is, **whichever auth user the admin API happens to return first**. Its own comment explains the deliberate choice to reuse an existing user rather than create one, on the reasoning that creating auth users as a test side effect is a bigger footprint than the suite needs and that users are not cleaned up by teardown. That reasoning is sound and is not what failed. What failed is the assumption that the first user is a stable, known account.

  **What happened.** A short-lived probe user was created to drive the browser for Phase 0A's evidence, per the standing preference for ephemeral users over mutating the shared test fixture. It became `users[0]`, so the `npm run test:db` run that followed created **all 30 of its fixture records under the probe account** rather than under the real one. Teardown worked correctly and every one of the 30 is soft deleted with zero live, so nothing is wrong with the data. **The probe user then could not be deleted**: three consecutive `deleteUser` calls returned `AuthRetryableFetchError` with status 500, and a re-query confirmed the user still present each time, so it is not the transient it names itself.

  **The cause was established from the schema rather than from the error's wording**, per rule 9, since a 500 tells you nothing about which row is holding what. `supabase/migrations/20260801000000_initial_schema.sql:26` declares `owner_id uuid not null references auth.users(id)` **with no `ON DELETE` clause**, so it defaults to `NO ACTION` and the delete is refused while any referencing row survives. Soft deletion does not help: `deleted_at` is a column on a row that still exists and still holds the reference. **This is the identical shape to the recorded rule that a `reference_number_counters` row must never be deleted while a soft-deleted record still holds a code from it**, and to both `NOT VALID` findings above: soft delete makes a row invisible to the product, never to a constraint.

  **Three things follow.** A verification script that creates an auth user has to assume the test harness may adopt it, so either the harness should resolve a **named** owner rather than positionally, or verification users should be created and deleted strictly outside any window in which the suite can run. **Deleting an auth user is not a safe teardown step at all** once anything can reference it, and a teardown that assumes it is will fail exactly as this one did. And the general point already recorded twice in other forms: **an ephemeral fixture is only ephemeral if nothing durable is allowed to point at it**, and in this schema `records.owner_id` always will.

- **Open item, carried forward: `scripts/verify-harness.mjs` is less deterministic than it looks, in two independent ways, and both are unresolved.** Logged together rather than as two isolated notes because they share a theme, and because each was found by a different round stumbling over it rather than by anything watching for it. The harness presents as a clean create-and-tear-down fixture system. It is not: **what it owns and what it cleans up are both conditional on things it does not control.**

  **1. `resolveOwnerId()` adopts whichever auth user comes back first.** It resolves the account that owns every fixture record with `db.auth.admin.listUsers({ page: 1, perPage: 1 })` and takes `users[0]`. That is a **positional** choice, not a named one, so **any auth user created for any reason can silently become the owner of every fixture the suite creates**. Found Round 10 Phase 0A when a short-lived probe user, created to drive a browser for one phase's evidence, became `users[0]` and took ownership of all 30 records from the next `npm run test:db` run. The compounding half is that `records.owner_id` is declared `not null references auth.users(id)` with **no `ON DELETE` clause** (`20260801000000_initial_schema.sql:26`), so it defaults to `NO ACTION`, and **soft-deleted fixtures pin that user permanently**: `deleted_at` hides a row from the product, never from a constraint. The probe user could not be deleted afterward, three attempts, each confirmed by re-query rather than by the returned error. **Decision taken, Round 10: the probe user stays.** It owns nothing live and cannot sign in, and the alternative, a bulk rewrite of `owner_id` across 30 rows, is a larger and riskier action than the problem. **Left open, not fixed:** the harness should resolve a named owner rather than a positional one, and deleting an auth user should not be treated as a safe teardown step by anything, ever, in this schema.

  **2. `Fixtures.teardown()` only runs on the happy path.** It sits in an `after` hook, so a file that aborts in `before` abandons everything it has already created. Found Round 9 Phase 7 when a transient `PGRST303 JWT issued at future` left **15 `stage_gate_rules` rows, 16 records that were still live rather than soft deleted, 5 documents, 2 contact links and 1 approval** behind under one synthetic record type, and the next run's new invariants failed against the residue rather than against the misconfiguration they were written for. The harness should reconcile by run tag at startup, or sweep abandoned tags, rather than relying on every run reaching its own `after` hook.

  **The theme worth carrying, since it is the reusable part: a test harness is itself a system with failure modes, and its failures do not look like test failures.** One of these produced records owned by the wrong account with no symptom at all; the other produced a green re-run that concealed everything the failed run had left behind. In both cases the honest first reading was that the tooling was fine and something else was wrong. **A flaky run is not only a signal about the test, it is a signal that some portion of that run's side effects were never undone**, and re-running to green hides that rather than resolving it.

- **A correct check can become wrong the moment the mechanism it measures changes, and this is a distinct failure shape from a check that measured the wrong thing. Named Round 10 Phase 0A, 2026-08-19.** This document already records the shape where a check is technically true and proves nothing: an inline `<span>`'s `scrollWidth > clientWidth` always comparing `0 > 0`, and a stage panel's "container is non-empty" resolving instantly against the previous tab's stale content. **Those checks were wrong when written.** This one was right when written, and became wrong through no change to itself.

  **The instance.** Round 10 Phase 0 reproduced the two-click dropdown by counting `mousedown` events reaching the control after a single real click. That count was **0**, and it was the correct measurement: it proved the click never reached the control, which was exactly the defect. Phase 0A then fixed it by opening the control programmatically with `showPicker()` rather than by making the click reach it. **Under the fix, the mousedown count is still 0.** The same check, unmodified and still measuring exactly what it always measured, would have reported a working fix as a failure.

  **Why it is worth separating from the existing entry.** The remedy for a check that measured the wrong thing is to ask what a false pass would look like. That question does not catch this one, because there was no false pass and no false reasoning at the time. The remedy here is different: **when a fix changes the mechanism rather than the value, the check has to be re-derived from the claim, not carried over from the reproduction.** The reproduction's metric answers "did the click reach the control"; the fix's claim is "does one click open the control". Those were the same question before the fix and are different questions after it. The check that actually holds across both is the pre-fix versus post-fix comparison, 0 of 8 against 8 of 8, because it is stated in terms of the claim rather than of any one mechanism for satisfying it.

- **Round 10 Phase 1, 2026-08-19: the Test Bed name is chosen at creation and editable afterward. This reverses Round 5 Phase 2's deliberate choice of a silent auto-suffix, and the reversal is only safe because the same phase closes the gap that decision was built around.**

  **What Round 5 Phase 2 decided, and why it was right at the time.** Every Test Bed created from a Contact inherited the linked Account's name unsuffixed, so a second one under the same Account was indistinguishable from the first. That round considered two remedies, a sequence suffix or a name prompt at creation, and **chose the suffix specifically to avoid the prompt**. Two reasons were recorded. First, this build's established "no friction at fast entry" precedent, where creation is a single click. Second, and load-bearing: **`name` had no editable UI anywhere**, unlike Opportunity's equivalent field which had been made editable in Round 3, so a name chosen badly or skipped at a prompt could never be corrected. A skippable prompt was therefore not a safe option, and automatic sequencing was the only remedy that guaranteed a distinguishing name unconditionally.

  **What changed.** Two separate testing sessions reported the resulting names as unusable in practice, and the live data showed why: three Test Beds under one Account reading `Willowglen`, `Willowglen (2)`, `Willowglen (3)`, and a second set reading `21st Century Boy` and `21st Century Boy (2)`. A suffix distinguishes records from each other; it does not tell anyone which engagement is which. The suffix succeeded at the problem it was given and the problem turned out to be the wrong one.

  **Why the reversal is safe now, and why the two halves had to ship together.** The second of Round 5's reasons stops being true in this same phase: `name` gains an ordinary click-to-edit control on the Reference tab, using `tbFieldRow` and the existing batched save bar, not a new mechanism. **A name chosen badly at the prompt is now correctable, which is exactly the escape valve whose absence ruled the prompt out.** Shipping the prompt without the edit control would have reintroduced the precise risk Round 5 identified, so Phase 1 is deliberately both halves or neither.

  **The first of Round 5's reasons is answered rather than overridden.** The friction objection is real, and the design keeps it small: the suffixed value is **pre-filled and pre-selected** in the dialogue, so it can be accepted with a single keystroke or replaced by typing over it. **The suffix is offered, not applied silently.** That is the whole distinction between this and what it replaces.

  **One computation path for the naming rule, deliberately.** The suffix is computed by `suggestTestBedName()` in `src/routes/contacts.js`, called both by `POST /contacts/:id/create-test-bed` and by the new read-only `GET /contacts/:id/test-bed-name-suggestion` that populates the dialogue's default. **The browser never recomputes it.** A client-side count would have been the obvious shortcut and would have been a second implementation of the rule, which is the standing "a second path that agrees today will disagree later" case. Because both endpoints call the same function, the name a user is offered is by construction the name they would otherwise have been given.

  **Two smaller decisions worth recording.** `name` gained a server-side non-blank guard on `PATCH /test-beds/:id`: it has been a writable key since Milestone 4, but nothing in the product could reach it, so it never needed one. Now that a control exists, clearing the field would leave a record with no name in the header, both list views and the linked-records modal. And **the pre-existing linked-records warning stays a separate first step** rather than absorbing the name field, because that warning is shared with Opportunity and folding a Test Bed-only input into it would fork a shared mechanism to save one click.

  **Backward compatibility was verified, not assumed, and the first check was wrong.** The endpoint had to keep behaving exactly as before for a caller that supplies no name, since that is every existing test and any direct API caller. The first check sent an `application/json` header with no body and got a 400, which looked like a regression; **Fastify rejects that shape on its own, before any route code runs.** Re-tested properly: a bodyless POST returns 201 and auto-suffixes exactly as before, an empty `{}` does the same, an explicit name is honoured, and a blank supplied name is refused with 400.

- **Round 10 Phase 2, 2026-08-19: Reference tab layout. Summary returns to the name's own line, Notes moves to the bottom of the page, and the panel order becomes Terminus, Customer, Site Details, Key Dates. This partially reverses Round 8 Phase 5, and the reversal recovers more vertical space than that phase cost.**

  **What was reversed and why the arithmetic matters.** Round 8 Phase 5 moved Summary and the two most recent notes out of a middle column and stacked them beneath the name. That was correct for its own brief, and its cost was recorded honestly at the time: side by side the header was `max(name 130, digest 191) = 191px`; stacked it measured **346px**, and the page-density entry above records that it pushed Total Cost *down* by 156px rather than recovering anything. Phase 2 puts Summary back in line and moves Notes off the header entirely. Measured on the same record at the same widths: header **346px to 145px at 1920 and 3440**, and **366px to 222px at 1240**. That is 201px and 144px recovered, against a whole-page density gap the same entry quantified at roughly 306px. **It does not close that gap and should not be read as closing it** - the real levers named there, the 145px of page furniture, the 96px tab row and the 379px of input-rate panels, are all untouched.

  **A genuine defect found while moving Notes, fixed rather than carried across.** The header digest computed its two-most-recent default as `notes.slice(-2).reverse()`, which assumes the array is oldest-first. **It is not.** `addTbNote()` prepends (`[newNote, ...existing]`), so the array is newest-first and `slice(-2)` takes the two **oldest** notes. The header therefore displayed the two oldest under the label "Latest notes", and "Show all" listed the whole history in reverse. **Demonstrated before changing anything**, on a record with three notes added through the real control in a known order: stored THIRD/SECOND/FIRST, header showed FIRST and SECOND. **It had never been visible in production because no live Test Bed had more than one note**, which is why two rounds of screenshots did not catch it. Fixed by sorting on the notes' own `at` timestamps rather than trusting array order, so a payload written by any future path sorts correctly whichever end it appends to. **The general shape, already recorded in other forms: a default view that silently selects the wrong subset looks identical to one that selects the right subset until the data is large enough to tell them apart.**

  **Two renderers of one list is what let it survive.** The header and the Reference tab each rendered `payload.notes` independently, and only one of them was wrong. Phase 2 leaves exactly one, at the bottom of the page, carrying both the default and the expansion. The header copy was deleted rather than kept in sync.

  **A correction to Round 10 Phase 0's own report, recorded because it was wrong in a way worth naming.** Phase 0 reported that `data-key="summary"` appears three times in the DOM and concluded that `tb-display-summary` and `tb-input-summary` are therefore **duplicate ids**, comparing it to the Round 9 buyer-role `select` ids containing spaces. **That was a false inference from a proxy.** Checked directly at the start of Phase 2: across all 500 elements carrying an id there are **zero duplicates**. The three rows live in three different top-level views, Contact detail, Test Bed detail and Opportunity detail, and each carries its own prefixed id (`cd-`, `tb-`, `ref-`). What is shared is the `data-key` **value**, which is not an identifier and is never resolved by `getElementById`. The original probe enumerated `.ref-field[data-key]` across the whole document, hidden views included, and I read a repeated attribute as a repeated id without checking the ids. **This is the same family as the checks recorded above that measured something true and materially different from the claim** - the count was real, the conclusion drawn from it was not - and it is recorded because the wrong version was reported confidently enough to have justified work that was never needed.

  **Item 4, narrowing Customer Details, was deliberately NOT built in this phase.** It is only safe alongside the label shortening, because Round 6 Phase 2 widened that panel specifically to stop the buyer role dropdown and its actions truncating, confirmed live by screenshot at the time. Deferred to Phase 3 so the narrowing and the shorter labels land together with one set of truncation evidence, rather than splitting a conditional pair across two phases. **Confirmed unchanged in the meantime**: the panel still spans `.pg-card-wide` at 856px at all three tested widths, the buyer `select` renders at 256px inside it, and `scrollWidth > clientWidth` on the control is false at every width, so Round 6 Phase 2's fix is intact and untouched.

- **A wrong finding that resembles a recorded shape is harder to catch than one that stands alone, because the resemblance supplies the confidence. Named Round 10 Phase 2, 2026-08-19.** This document is deliberately a catalogue of recognisable failure shapes, and that is most of its value: a new observation gets matched against the catalogue and the match is what makes it legible. **The cost of that, not previously written down, is that a wrong observation which happens to resemble a catalogued shape inherits the catalogue's authority without ever having earned it.**

  **The instance.** Round 10 Phase 0 reported that `tb-display-summary` and `tb-input-summary` were duplicate ids, and cited the Round 9 finding that buyer-role `select` ids contain spaces so `#id` parses as a descendant selector. The two really do belong to one family, "an element cannot be reliably addressed", and that family really is recorded here. **The claim was still false.** There are zero duplicate ids anywhere in the document; what repeats is the `data-key` **value**, on three rows living in three different top-level views, each carrying its own prefixed id. The underlying error was ordinary, reading a repeated attribute as a repeated identifier. What made it survive review was the citation: once it was framed as another instance of a known trap, the question "is the id actually duplicated" stopped being asked, by me, at the moment it most needed asking.

  **Why this is worth its own entry rather than a note on that phase.** The existing entries warn about checks that measure the wrong thing and about checks that go stale when a mechanism changes. Both are about the check. **This one is about the reasoning wrapped around the check**, and it points the other way from most of this document's advice: pattern-matching against recorded findings is the right habit and it is also the mechanism by which a bad finding gets promoted. **The practical guard is small and specific: when an observation is about to be reported as another instance of something already in this document, verify the observation on its own terms first, exactly as if the precedent did not exist.** A precedent explains a fact; it is never evidence that the fact obtains.

- **A default that shows "the N most recent" cannot be verified against a record holding one. Named Round 10 Phase 2, 2026-08-19.** The header notes digest built in Round 8 Phase 5 selected the two **oldest** notes and labelled them "Latest notes", because it computed `notes.slice(-2)` against an array that `addTbNote()` prepends to. It shipped, was screenshotted across two rounds, and was never wrong on screen, **because no live Test Bed has ever held more than one note**. With one note, every possible implementation of "the two most recent" produces identical output, including every wrong one.

  **The general shape: a selection rule is only exercised by data large enough to distinguish it from its alternatives, and a fixture that happens to be smaller than that makes the check vacuous while it still passes.** The same applies to sorting, to "top N", to pagination boundaries, to "first match" and to any default view that is a subset of a larger set. It is a close relative of the recorded rule about proving an invariant capable of failing: here nothing had to be injected, only enough rows to make the wrong answer differ from the right one.

  **The practical guard.** When building or verifying a rule that selects a subset, state the smallest dataset on which a wrong implementation would look different from a correct one, and test on at least that. For "the two most recent" the answer is **three**, ordered so that recency and array position disagree. That is exactly the fixture that exposed this one, built deliberately because the live data could not.

- **Round 10 Phase 3, 2026-08-19: labels shortened, Customer Details narrowed, Installation Environment becomes a picklist. The premise that the label shortening makes the narrowing safe turned out to be false on its own, and the reason is worth recording precisely.**

  **The brief's conditional was right to exist and wrong about the mechanism.** Phase 2 item 4 was held back specifically because Round 6 Phase 2 had widened Customer Details to `.pg-card-wide` to stop the buyer role dropdown truncating, so narrowing was only ever to ship alongside shorter labels. **Shortening the label text frees no horizontal space at all.** `.ref-field-label` is `flex: 0 0 170px`, a fixed basis: the column occupies 170px whether it reads "CLIENT COMMERCIAL BUYER" or "COMM. BUYER". Measured on the narrowed card, the buyer `select` fell to **108px** while needing **268px** to show its widest option. The shortening buys room only once the column itself is narrowed, which is a separate change nobody had written down.

  **What actually made it fit, in three steps, each measured rather than reasoned.** The label column was narrowed to 90px **scoped to Customer Details only** - the widest label elsewhere on the tab is "Estimated Installation Date" at 161px, which would wrap under about 165px, and `.ref-field-label` is shared with Contact and Opportunity detail whose labels were not shortened. That gave the select 12px, not 80, because **a `select` sizes to its own widest option, not to the space available**. Letting it grow moved nothing either, because its wrapper held it at content width; both the wrapper and the control needed `flex: 1 1 auto; min-width: 0`. And the widest thing in the panel was not data at all but the placeholder "Select a contact linked to this Account", shortened to "Select a contact". Final state: select **188px**, needs **130px**, fits at 1240, 1920 and 3440 with the control and its "+ New" button inside the card and no container overflowing.

  **An honest limit, measured both ways rather than claimed.** A genuinely long contact name ("Christopher Featherstonehaugh-Wallace", 36 characters) needs 281px and still clips. **It clipped before this phase too**: on the pre-narrowing 856px card the select was 272px, also short of 281px. So long-name clipping is pre-existing and unchanged in kind; what changed is the headroom, from 272px to 188px. Recorded because the tempting summary, "narrowing was safe", is only true of the specific failure Round 6 Phase 2 fixed, which was the control being cut off by the card edge.

  **A second call site was silently ignoring its own field definitions, the same shape Round 5 Phase 4 recorded in this very file.** `renderTbSiteDetails()` hardcoded each label and each `opts` object at the call site instead of reading `TB_SITE_FIELDS`. Both of Phase 3's changes to that field - the "Inst. Env." rename and the picklist itself - were applied to the definition and **had no effect whatsoever on screen**, found only by looking in the browser. Round 5 Phase 4 hit the identical thing on `TB_DATE_FIELDS`, where the call site "explicitly constructed its own opts object rather than spreading the field definition" and would have dropped `noPast`/`integer`. Fixed generally this time: the panel now renders from the definitions. **It renders an explicit four-key subset, not the whole array** - `TB_SITE_FIELDS` still carries `estCostPerUnit` and `indicativeCost`, which Round 5 Phase 6 made server-computed and removed from `TEST_BED_WRITABLE_KEYS`, so mapping the array wholesale would have put two editable fields on screen whose every save the server rejects.

  **Buyer role strings are gate keys, not labels, and only the display moved.** `CLIENT_BUYER_ROLES` holds `Client Commercial Buyer` / `Client Technical Buyer` / `Client Legal Buyer`, each a real `record_contacts` role, validated by `VALID_CLIENT_BUYER_ROLES` server-side and named by three live `contact_role_linked` rules on the Qualification exit. Shortening those strings would have broken three gates. The shortened text lives in its own map, which is the display-rename rule applied literally.

  **A fatal load-order error, caught in the browser and not by any syntax check.** `INSTALLATION_ENVIRONMENT_OPTIONS` was first declared next to the other picklist constants, below `TB_SITE_FIELDS` which references it in its own initialiser. `const` is not hoisted, so the file threw `Cannot access before initialization` at load, `window.initTestBedDetailPanel` was never defined, and **the entire Test Bed detail panel was dead**. `node --check` passes on this: it is a runtime temporal-dead-zone fault, not a syntax error. Same total-page-failure mode as the recorded top-level `const` collision, reached by a different route, and the same lesson: in a codebase of classic scripts sharing one scope, a declaration mistake is not a local mistake.

  **3.2's data migration was NOT written, and the survey is why.** The brief states "at least one live record carries the free-text value 'Indoor and Outdoor'". Surveyed directly across all 109 Test Bed records, live and soft deleted, current revision of each: **that record is soft deleted, not live.** The complete picture is 104 records with the key absent, **2 live records holding "Outdoor"** which is already a valid value, **1 soft-deleted record holding "Indoor and Outdoor"**, and **2 soft-deleted records holding "Roadside verge - real save"**, which maps to nothing and is reported rather than cleared, per the brief's own instruction. **No live record needs mapping.** Against that, `record_revisions` is deliberately immutable - the initial schema states it carries no UPDATE or DELETE policy and that writes are blocked by RLS deny-by-default once a row is inserted - so a mapping migration cannot rewrite a payload in place without contradicting a schema-level decision, and would instead have to insert new revisions on soft-deleted records to correct a display value nobody will open. Recorded as a decision pending sign-off rather than taken unilaterally.

  **What the validation deliberately does not do.** It is guarded on the key being present in the **submitted** payload, exactly like `siteOwnership`, never on the merged result. Proven rather than asserted: a record was given a legacy `"Indoor and Outdoor"` value written straight to its revision, and an unrelated `city` save through the real API then returned 200 with **the legacy value preserved, not stripped**. Had the guard read the merged payload, that save would have failed for a field the user never touched, which is the same shape as the `NOT VALID` CHECK constraint that once edit-locked a batch of Test Beds including for soft-delete. **One consequence is worth knowing:** the read-only row still displays a legacy value correctly, but opening the field presents a select with no matching option, so it falls back to blank and saving would clear it. That is an argument for mapping the data whenever the decision above is taken, not an argument against the guard.

- **Changing a picklist's allowed values silently discards any existing value outside the new set, on the next edit of that field. General hazard, named Round 10 Phase 3, 2026-08-19.** A field that was free text, or that had a wider vocabulary, leaves records holding values the new list does not contain. The read-only row still renders such a value correctly, so nothing looks wrong. **The loss happens the moment someone opens that field**: a `select` with no matching `option` falls back to its blank entry, and saving writes the blank. The user sees a field they opened, did not deliberately change, and cleared. Nothing warns them, and the old value is only recoverable from `record_revisions`.

  **The mitigation, proven rather than assumed: validate the key that was SUBMITTED, never the merged payload.** `PATCH /test-beds/:id` guards `installationEnvironment` with `if ('installationEnvironment' in payload && ...)`, matching the existing `siteOwnership` shape. Demonstrated by giving a record a legacy `"Indoor and Outdoor"` value written straight to its revision, then saving an unrelated `city` through the real API: **200, with the legacy value preserved and not stripped.** Validating the merged payload instead would have failed that save for a field the user never touched, and every subsequent save on that record, permanently. **That is the same shape as the `NOT VALID` CHECK constraint that once edit-locked a batch of Test Beds including for soft-delete**, and as the two `NOT VALID` entries above: a rule written against new data quietly becomes a rule against old rows.

  **So the guard protects unrelated saves and does not protect the field itself.** Both halves need stating, because the first makes the second easy to overlook. Whenever a picklist narrows, the choices are to map the existing values, to widen the list, or to accept the silent clear - and accepting it is only reasonable when the affected records are known and disposable, which is why Round 10 surveyed all 109 Test Beds before deciding rather than after.

- **"Shorter labels make room" is intuitive, wrong, and was believed by a brief. Recorded Round 10 Phase 3, 2026-08-19.** Phase 2 item 4 was deliberately held back because narrowing Customer Details was "only safe because of the label changes in Phase 3", and that pairing was correct. **The stated mechanism was not.** `.ref-field-label` is `flex: 0 0 170px` - a **fixed** basis - so the label column occupies exactly 170px whether it reads "CLIENT COMMERCIAL BUYER" or "COMM. BUYER". Shortening the text changes what is written in the column and frees **nothing** for the value beside it. Measured after the narrowing and before anything else: the buyer `select` collapsed to **108px** while needing **268px**.

  **The pairing was right for a different reason: shorter labels are what make it possible to narrow the label COLUMN.** 170px was needed for the old wording; 90px carries every label in that panel now, and that is where the room comes from. Two further facts were needed and neither is obvious: **a `select` sizes to its own widest option rather than to available space**, so it must be told to grow, and telling it to grow does nothing while its wrapper is still at content width, so both need `flex: 1 1 auto; min-width: 0`. The final contributor was not layout at all - the widest thing in the panel was the placeholder string "Select a contact linked to this Account", shortened to "Select a contact".

  **Recorded at this length deliberately.** The intuition is reasonable, it will recur the next time a panel is narrowed, and it fails silently: the labels genuinely do get shorter, the layout genuinely does look tidier, and the control beside them is quietly unusable.

- **`node --check` passes on a fault that kills an entire page at load. Recorded Round 10 Phase 3, 2026-08-19.** `INSTALLATION_ENVIRONMENT_OPTIONS` was declared below `TB_SITE_FIELDS`, which references it inside its own initialiser. `const` is not hoisted, so the file threw `ReferenceError: Cannot access 'INSTALLATION_ENVIRONMENT_OPTIONS' before initialization` at load, every later declaration in the file was never evaluated, `window.initTestBedDetailPanel` did not exist, and **the whole Test Bed detail panel was dead**. **`node --check` reports the file as valid, because it is**: a temporal dead zone violation is a runtime error, not a syntax error, and no static check in this project catches it. It was found by loading the page in a real browser and reading the `pageerror`.

  **The general point: syntax validity and load-order validity are different properties, and only one of them is checked.** This is the second total-page-failure recorded in this codebase from a top-level declaration mistake, after the `const SUMMARY_FIELD` collision between two files sharing one script scope. Both were invisible until the page was actually loaded. **Any change to top-level declarations in `frontend/` needs a real page load before it is called done, and a passing `node --check` is not evidence of anything beyond parseability.**

- **Second confirmed instance of a render call site bypassing its own field definitions, same file as the first. Round 10 Phase 3, 2026-08-19.** `renderTbSiteDetails()` hardcoded each label and each `opts` object inline instead of reading `TB_SITE_FIELDS`, so Phase 3's rename of that field to "Inst. Env." **and** its conversion to a picklist were both applied to the definition and **neither reached the screen**. Found by looking in the browser, not by reading the diff. **Round 5 Phase 4 recorded the identical shape on `TB_DATE_FIELDS` in this same file**, where the call site "explicitly constructed its own `opts` object rather than spreading the field definition" and would have silently dropped `noPast`/`integer`.

  **Two instances in one file makes it a pattern rather than a slip.** The failure mode is specific and quiet: the field definition remains the apparent source of truth, edits to it look correct in review, and the rendered output never changes. Fixed generally here by having the panel render from the definitions - **though deliberately over an explicit key subset, not the whole array**, since `TB_SITE_FIELDS` still carries `estCostPerUnit` and `indicativeCost` which Round 5 Phase 6 made server-computed and removed from `TEST_BED_WRITABLE_KEYS`. **Worth checking the remaining renderers against their own definitions rather than waiting for a third instance.**

- **Round 10 Phase 4, 2026-08-19: mobile validation built, the Leads-navigation defect fixed at its real cause, and City-to-Region declined on evidence.**

  **Item 1, mobile. The rule, stated before it was written**: an optional single leading `+`, then digits with space, hyphen, parenthesis and full stop allowed as separators, and once separators are stripped between **7 and 15 digits** must remain. 15 is the E.164 maximum, 7 about the shortest real national significant number. **Nothing is checked about country prefixes or number plans**, deliberately: that needs a real library and a maintained dataset, and a half-correct version rejects genuine numbers, which is worse than no validation at all. `isValidMobile()` lives in the shared `src/lib/field-validation.js` and is enforced on **both** contact write paths, `POST /contacts` and `PATCH /contacts/:id`, so the inline buyer-contact dialogue is covered by the same rule without a second implementation. **Known, accepted exclusion, recorded rather than left silent: extensions are rejected**, because supporting "ext"/"x" means admitting letters and there is no evidence this business records them.

  **Item 3 was re-scoped after Phase 0 refuted its premise, and the fix is guarded on app state rather than on event names.** The report was "the New Contact dialogue's Save returns the user to the Leads page". Neither contact-creation dialogue navigates anywhere. The real cause was `onAuthStateChange` calling `showApp(session)` for every session-bearing event, and `showApp()` ends with `navigate('leads')`. **The handler now checks whether the app shell is already visible** and, if so, refreshes the header email and changes nothing else. That is deliberately not an allowlist of event names: which events supabase-js emits, and when, varies by version, whereas "am I already inside the app" is the question actually being asked and cannot drift. Verified both directions - a real `refreshSession()` fires `TOKEN_REFRESHED` and the view stays put, and entering the app from a signed-out shell still lands on Leads.

  **Item 2, City-to-Region: declined, and the reasoning is evidence rather than caution.** **Region already auto-populates, from Country, and has since the New Lead modal was built.** `regionForCountry()` is a line-cited port of the prototype's own function (`Terminus Ops.dc.html:7510-7523`), wired to the Country field's `input` event, and it was confirmed working live across all five regions, correctly leaving Region untouched for an unrecognised country rather than clearing it.

  **Country is a strictly better key than City for this particular target, and that is the whole argument.** Region here is **continent-scale** - Americas, Europe & UK, Middle East, APAC, Africa - so country-to-region is a total, unambiguous function: every country sits in exactly one region. City-to-region is neither. **Newcastle** alone spans three of the five regions (upon Tyne, New South Wales, KwaZulu-Natal), and **Tripoli** splits Africa from Middle East. A city gazetteer would also have to be obtained and maintained, against a mapping of about 70 country names that already exists and already works.

  **The live data makes the same point by accident.** Across every live contact, account and test bed the geography is Singapore/APAC and Leeds/United Kingdom/Europe & UK - and one record reads city `"Singapoer"` with country `"Singapore"` correct. **The misspelling is in the field the proposal wanted to key on, and not in the one already used.**

  **This is the second time a location-derivation heuristic has been declined against real data, and the pattern is now worth naming rather than rediscovering.** Round 2 Phase 6 abandoned City-from-Site-Address after it broke on two of four real non-UK formats. Both proposals shared a shape: **derive a coarse, structured value from a finer-grained free-text one**. The reliable direction is the opposite - derive from the field that is already structured, already mandatory, and already validated. Region stays manual in the sense the brief meant, and automatic in the sense that matters, because it was already populated from the right field.

- **Deriving a coarse structured value from a finer-grained free-text one is the unreliable direction. The reverse is the reliable one. Named Round 10 Phase 4, 2026-08-19, on the second instance.** Both instances were requested in good faith and both were declined against real data rather than on principle, which is why the shape is worth naming: it is not obviously wrong when proposed.

  **Instance one, Round 2 Phase 6:** derive **City** from **Site Address**. Abandoned after testing against real non-UK address formats and failing on two of four. **Instance two, Round 10 Phase 4:** derive **Region** from **City**. Declined before building.

  **Why the direction matters.** The target in both cases is coarser and more structured than the source. Region here is continent-scale, five values. **Country to Region is a total, unambiguous function**: every country belongs to exactly one region, the mapping is about seventy entries, and it never needs a gazetteer. **City to Region is neither total nor a function**: Newcastle alone spans three of the five regions (upon Tyne, New South Wales, KwaZulu-Natal) and Tripoli splits Africa from Middle East. The same asymmetry held for address parsing: an address contains a city, but extracting it reliably requires knowing each country's format, whereas a city field already holds it.

  **The general rule: derive from the field that is already structured, already mandatory and already validated, not from the one that happens to sit nearer the answer in a form.** Free text is the wrong end to pull from even when it looks closer, because its failure mode is silent - a wrong region looks exactly like a right one.

  **A detail worth keeping, because it argues the case better than the reasoning does.** Across every live contact, account and test bed, one record holds city `"Singapoer"` with its country `"Singapore"` correct. **The misspelling is in the field the proposal wanted to key on, and not in the one already in use.** Region had in fact been auto-populating from Country since the New Lead modal was built, via a line-cited port of the prototype's own `regionForCountry()`, so the feature existed and was already keyed on the better field.

- **A plausible measurement that returns a false negative confirming what the brief already said is the hardest kind to catch. Second instance, Round 10 Phase 4, 2026-08-19.** Recorded alongside the "a wrong finding that resembles a recorded shape" entry above, because these two are the same family seen from opposite ends: there, a wrong conclusion was protected by matching a known pattern; here, a wrong measurement was protected by matching the expected story.

  **The instance.** The Round 10 brief said Region should be made to populate. Checking whether it already did, the probe set `contact-country` and dispatched a `change` event. **The listener is on `input`.** The probe returned a clean, orderly column of empty Regions for all six countries tested - no error, no exception, a perfectly legible result - and it agreed exactly with what the brief had asserted. Typing into the field for real returned the correct region for all five recognised countries and an empty string for the unrecognised one. **The feature had worked the whole time.**

  **The earlier instance, Phase 0**, was the duplicate-id claim: a real observation, a false inference, and a citation to a recorded trap that supplied the confidence.

  **What actually caught both was the same move: testing the measurement rather than trusting it.** The specific guard worth carrying is that **a negative result which confirms the brief deserves more scrutiny than a positive one that contradicts it**, because nothing about it feels like it needs checking. Concretely for browser probes: drive the real interaction rather than synthesising the event you assume is wired, since a synthetic event on the wrong listener is indistinguishable from an absent feature.

- **The auth-navigation fix guards on app state, not on an event-name allowlist. Round 10 Phase 4, 2026-08-19.** `onAuthStateChange` called `showApp(session)` for every session-bearing event, and `showApp()` ends with `navigate('leads')`, so a background token refresh threw the user back to Leads from wherever they were. **The obvious fix is to filter on the event name** - handle `SIGNED_IN` and `INITIAL_SESSION`, ignore `TOKEN_REFRESHED` and `USER_UPDATED`. That was deliberately not built.

  **The reasoning: event names and their emission timing are library surface, and they vary by version.** supabase-js has changed which events fire on session restore, on tab focus and on refresh across releases. An allowlist written against today's set is correct until a dependency bump, at which point it fails silently and in the same direction as the original defect - and nothing in this project's tests would catch a navigation regression. **App state does not vary**: the handler now asks whether the app shell is already visible, refreshes the header email if so, and calls `showApp()` only when genuinely entering the app. That is the question actually being asked, expressed directly.

  **The general point, which is not specific to auth: when a guard can be written either against an external vocabulary or against local state that means the same thing, prefer the local state.** The vocabulary belongs to someone else and can change without notice; the state belongs to this application. Verified both directions rather than one, since a guard that simply never fires would also pass the first test: a real refresh leaves the view untouched, and entering from a signed-out shell still lands on Leads.

- **Round 10 Phase 5A, 2026-08-19: the stale render. Parallelising halved it, a synchronous pending state closed it, and the pending state exposed a latent fault that made "permanently static UI" a real outcome rather than a hypothetical one.**

  **Step 1, parallelising, measured before and after on the same record and the same tab switch.** `loadTbStageDetailTab` awaited three fetches in series: documents 654ms, approvals 310ms, exit-criteria 1070ms, summing to exactly the 2034ms the criteria panel took to stop showing the previous stage. **The criteria panel depends on neither of the other two and was waiting on both.** Run concurrently: criteria **2034ms to 1083ms**, documents unchanged at ~649ms since it was never waiting on anything. Concurrency is provable from the figures rather than asserted - the three requests still sum to ~2065ms while the panel settles at ~1109ms.

  **A required correctness change came with it, and it would have been easy to miss.** `renderTbStageExitCriteria` had **no load-token guard at all**. It was safe only because it ran last, after two token checks, so nothing could overtake it. Started concurrently it can resolve after a newer tab's load and write the wrong stage into the panel - the exact race `tbStageTabLoadToken` exists to prevent and which Round 5 Phase 7 confirmed live on the other two panels. **Parallelising an ordered chain removes protection that the ordering was silently providing.** Worth stating generally: before making sequential work concurrent, check what the sequence was guaranteeing beyond its result.

  **Step 2, the pending state, and the contract that makes it verifiable.** `dataset.stage` now means only "the stage whose data is currently displayed" - set when real data renders, cleared while in flight and on error. `dataset.pending` carries the stage being loaded and exists only in flight. **A test therefore still waits on `dataset.stage`, which cannot be satisfied by this mechanism's own side effects**; waiting on `dataset.pending` would be waiting on the fix rather than on the data. Marking happens synchronously at the moment of the click, before any await, so there is no window in which stale content is presented as current. Verified by sampling every animation frame (**zero samples where any panel claimed a stage other than the selected one**) and by a MutationObserver across three rapid tab switches (**zero violations**).

  **The fault the pending state exposed, which is the most useful part of this phase.** `api()` did `await fetch(...)` with **no try/catch**. `fetch` rejects on a dropped connection, an offline client or an aborted request, so `api()` rejected, so every caller's `if (!result.ok)` branch **was unreachable in exactly the case it was written for**. That was survivable while a failed load simply left the previous content on screen: wrong, but not obviously broken. **It stopped being survivable the moment a synchronous pending state existed** - the throw skipped the error branch, nothing cleared the marker, and the panel sat on "Loading ..." indefinitely, which is precisely the permanently-static UI this phase was told not to produce. Found by aborting the requests deliberately, not by reasoning about the code. Fixed in `api()` itself rather than per-caller, so every screen in the app now takes its real error path on a network failure, plus a `try/catch` around the three renderers as defence in depth.

  **The general shape worth carrying: a latent fault becomes a live one when something starts depending on the branch it was skipping.** Nothing about `api()` changed; what changed is that a new mechanism relied on the error path actually running. This is the same family as `complete-document` hardcoding `status = 'approved'` - correct for every caller it had, and a gate bypass the moment a URL field was added - and the same argument for testing the failure path of a dependency before building on it.

- **Round 10 Phase 5B, 2026-08-19: the tick. Server-confirmed rather than optimistic, writes serialised, and the approval path stopped cancelling itself.**

  **Remeasured after 5A rather than building against Phase 0's figures**, since parallelising had already moved the baseline: criterion tick **1162ms** (PATCH 305ms then a full exit-criteria GET 838ms, strictly serial, nothing changing on screen in between), approval tick **749ms** across three round trips including a whole tab reload.

  **The criterion tick reflects its own result the moment the server confirms that result, and not before.** It is deliberately **not optimistic**: the row updates only after its own `PATCH` returns success, which is the point at which the value is genuinely stored. What it no longer waits for is the recomputation of every other row, which is what the 838ms `GET` is doing. **1162ms to 296ms**, with one request before the tick appears instead of two. The contract holds in both directions: nothing is shown that the server has not confirmed, and a failed write leaves the control exactly as it was, with a message, rather than a tick that has to be taken back.

  **Criterion writes are serialised per record, and that is a correctness fix rather than a nicety.** Two `PATCH`es in flight together each merge into whatever revision they read at the start, so an interleaved pair can silently drop the first tick. "Tick two criteria in rapid succession and confirm both register" is exactly the case that breaks. A queue is the honest fix; a debounce would only have made it less likely. Verified: two clicks with no await between them, both ticked on screen by t=2s and **both keys present in the server payload** at revision 3.

  **The approval path no longer reloads the whole tab.** It called `loadTbStageDetailTab`, which re-fetches documents, approvals and criteria **and increments `tbStageTabLoadToken` as its first act** - so a second approval ticked while the first was still reloading **invalidated the first**, which then returned early and never rendered. That is Round 9 Phase 8's "each approval triggers its own re-render while the previous request is still in flight", and the reason a red criteria row could sit beside an enabled Next Stage button. It now refreshes only what an approval can change, the approvals panel and the criteria it may satisfy, and **drops the documents fetch entirely** because an approval cannot change a stage's documents. Nothing touches the tab load token, so an approval no longer cancels a genuine tab switch, nor another approval. **749ms to 416ms**, and two approvals clicked together both land on screen and both are recorded server-side.

  **A note on the harness, because four separate probe faults in one phase is itself the finding.** Every one of them produced a confident, legible, wrong result: a fixed 3500ms delay that was marginally too short; a test that ticked a criterion and then immediately unticked it; a wait on `dataset.stage === 'Qualification'` that **the previous record's panel already satisfied**; and a wait on `#tb-display-name` existing, which is satisfied by any record because that element persists across navigations. The last two are the same fault as the defect this phase exists to fix - **a stale-satisfiable wait condition** - committed in the tool built to measure it. Two of the four briefly looked like product bugs, one of them a serious cross-record one where an approval appeared bound to the previous Test Bed's id. **The guard that resolved all four was the same: make the wait condition name something only the new state can satisfy**, here the record's own unique name rather than the existence of an element or a stage label that outlives it.

- **Round 10 Phase 6, 2026-08-19: a successful transition lands on the tab for the stage just entered. The final transition is the deliberate exception, and it is temporary.**

  **What it removes.** `loadTestBedDetail()` sets `tbUserPickedTab = false` as its first statement and `renderTestBedDetail()` then switches to Reference. That is right for a genuinely fresh navigation into a record and wrong for a transition, which is a user already working somewhere specific. Round 8 Phase 1 found the behaviour and left it for a product decision; Round 9 Phase 8 quantified it as **7 of a full lifecycle's clicks existing only because of it**. Confirmed by driving all seven transitions through the browser: every one now lands on the stage just entered.

  **Carried as an intent flag rather than a parameter**, `tbLandOnStageAfterLoad`, set in `attemptTransition` and read and cleared in `renderTestBedDetail`. The two sit two calls apart and `loadTestBedDetail` has six other call sites, none of which care - threading a parameter through all of them to serve one would have been the larger change. Same shape as `tbUserPickedTab` directly above it, deliberately.

  **The final transition lands on Reference, not Closed, and this is stated plainly rather than left as an unexplained inconsistency.** Round 9 Phase 6.3 made Closed render nothing at all, so landing there today would put the operator on a genuinely blank tab as the reward for completing the lifecycle. Round 10 Phase 7 gives Closed a real panel; **when it does, the exception should be removed, and it is one condition in one place.** Terminality is read from the data - no stage follows this one - rather than by matching the string `Closed`, matching how `loadTbStageDetailTab` already decides the same question.

  **The measured click count, and an honest comparison rather than a flattering one.** The full lifecycle now costs **47 clicks**: 18 approvals, 9 document confirms, 5 criteria ticks, 7 Next Stage presses, **1 stage-tab opening**, 4 field-entry clicks, 3 buyer selections. Against Round 9 Phase 8's 59 that looks like a saving of 12, and **only 7 of it belongs to this phase**. The stage-tab openings genuinely fall from 8 to 1, which is exactly the 7 the brief predicted. The other difference is that my driver spent 4 clicks on field entry where Round 9 counted 8; that is a difference in how the same work was counted, not an improvement. **Normalised to Round 9's own field-entry figure the total is 51.** Recorded this way because a click count is an input to a business decision and a number inflated by a change of method is worse than no number.

  **A discrepancy in the Round 9 record, noted not resolved.** Its stated total is 59, but its own itemisation - 18 approvals, 9 documents, 5 criteria, 7 Next Stage, 8 stage-tab openings, 8 field-entry, 3 buyer selections - sums to **58**. One click is unaccounted for in that breakdown. The 7-click saving this phase delivers is unaffected either way, since it is measured against the stage-tab line specifically.

  **The audit trail is clean on the driven record** (`TT-SGP-SMARTC-051`): seven transitions in ladder order, one actor, strictly increasing timestamps, no regression or skip entries, 18 approvals all carrying a non-null stage, 9 document child records.

  **Four wait-condition faults in my own driver, in the phase immediately after promoting the guard to `CLAUDE.md`.** Worth recording because the guard is evidently harder to apply than to state. (1) Waiting on `#tb-display-name` existing after a save-triggered reload - it persists, so the wait passed instantly, the stage tab was opened mid-reload, and the reload's own `switchTbTab('reference')` then reset it, leaving Next Stage disabled and the transition unattempted. **This is fault 4 of Phase 5B repeated verbatim.** (2) Counting `.tb-crit-box--met` across the whole criteria panel, which also counts the **computed** rows - three buyer links and three payload fields, all already satisfied - so the count was at least 6 before anything was ticked and every wait passed immediately, letting the loop re-click rows and untick them. (3) Selecting "the first tickable row" each iteration rather than the first **unmet** one, which re-clicked the same row. (4) Reading the active tab immediately after the status poll, before the reload had re-rendered, which reported the previous stage's tab on all seven transitions and looked exactly like the feature not working. **All four are the same shape: a condition satisfiable by state that is not the state being asked about.** The last one is the sharpest, because a wrong answer there would have been reported as a failed feature rather than a failed check.

- **Knowing the stale-satisfiable-wait rule does not confer the ability to spot which conditions are stale-satisfiable. Recorded Round 10 Phase 6, 2026-08-19.** The rule was promoted into `CLAUDE.md` at the start of that phase, having been extracted from four faults in Phase 5B. **Four more faults of the same family followed immediately, in the phase that promoted it**, written by the same person who had just written the rule down.

  **The reason is that the rule is easy to state and the judgement is per-condition.** "Wait on something only the new state can satisfy" gives no help in deciding whether `#tb-display-name` outlives a reload, or whether `.tb-crit-box--met` counts more rows than the ones being ticked. Each of those is a fact about the specific markup, and the rule is silent on all of them.

  **Fault 2 is the instructive one, because it hides inside a wait on the right element.** It counted `.tb-crit-box--met` inside `#tb-stage-exit-criteria-list`, the correct panel, and waited for the count to rise. But that panel renders **computed** rows alongside the tickable ones - the three buyer-role links and three payload fields, all already satisfied - so the count was at least six before anything had been ticked and every wait passed instantly. **The element was right, the scope was a superset.** A wait can name exactly the thing you mean and still be satisfied by state you did not mean, because the selector matches more than the concept does.

  **The practical form of the guard, sharper than the rule as promoted: state what the condition would look like if the action had NOT happened, and check it differs.** For fault 2 the answer is that six met boxes exist either way, which settles it immediately. For fault 1 the answer is that `#tb-display-name` exists either way. Neither needs any knowledge of the feature under test.

- **The Round 9 Phase 8 click count is 59 as stated and 58 as itemised. Recorded Round 10 Phase 6, 2026-08-19, next to the figure so it is not reconciled again.** The itemisation - 18 approval ticks, 9 document confirms, 5 criteria ticks, 7 Next Stage presses, 8 stage-tab openings, 8 field-entry clicks, 3 buyer selections - sums to 58. **One click is unaccounted for**, and the cause is visible in how the number was produced: the total was reconciled by hand from a partially instrumented run rather than counted by a ledger. **Not worth chasing.** Worth not reconciling against later, and worth knowing that any future comparison to "59" carries a one-click uncertainty that no amount of care in the new measurement removes. Round 10 Phase 6 measured 47 with a full click ledger, of which the 7-click saving is attributable to that phase; the comparison is stated against the stage-tab line specifically for exactly this reason.

- **A rule repeated in every brief looks established because it keeps being repeated. Swept Round 10 Phase 7, 2026-08-19, after the fixed-delay rule was found to have no permanent home.** "Never verify on a fixed delay" had been restated in four consecutive round briefs and appeared nowhere in `CLAUDE.md`, so its authority came entirely from repetition. Sweeping the other recurring brief instructions against `CLAUDE.md` found two more in the same position, now promoted:

  **The layout test widths, 1240px / 1920px / 3440px**, specified in seven briefs and nowhere permanent. Each brief restated them as though setting them for that round.

  **Soft delete for test fixtures, and never deleting a `reference_number_counters` row**, restated in four briefs and present in this document only as three separate incident write-ups, never as a standing instruction.

  **Everything else checked out.** Round 9's four governing rules are gate-specific rather than general, and three of them are now enforced by automated invariants, which is stronger than a rule. The phase-count check, the container-not-element rule, display-renames, jsonb comparison, seed reconciliation and one-computation-path are all already in `CLAUDE.md`. **The general point: a brief restating a rule is evidence the rule matters and evidence it may have no home. Those look identical from inside a round.**

- **Round 10 Phase 7, 2026-08-19: the Closed tab shows the completed record. This supersedes Round 9 Phase 6.3, and Phase 6's temporary exception is removed with it.**

  **THE SUPERSEDED DECISION, kept visible rather than deleted.** Round 9 Phase 6.3 decided: *"The Closed stage tab renders no panels. Not an empty Terminus Documents card, not an empty Approvals card. Nothing. Consistent with the documented decision not to build the Test Bed list matrices: permanently empty UI with no visible explanation is worse than absent UI."* **That was correct for what Closed was then.** Closed is terminal, so it has no exit gate, no documents of its own and no approvals; every panel on it would have been empty forever, and the reasoning generalises exactly as it was written.

  **Why this is the opposite case rather than a reversal of the rule.** The rule was against **permanently empty** UI, not against terminal-stage UI. A panel that becomes meaningful **at** Closed, and is genuinely full when reached, is the other side of the same argument: nine documents across seven stages is the most substantial thing the record holds, and it had nowhere to be shown. **The rule stands everywhere else, and this is not a licence to show empty panels on other terminal states.**

  **Read-only is structural, not a decision the frontend makes.** `GET /test-beds/:id/lifecycle-documents` returns no gate rule, no `required_status` and nothing a Confirm control could act on, so there is no editable URL and no Confirm to suppress. A closed Test Bed's documents **are** the record, and altering them after closure undermines the audit trail; the backward transition path from Round 9 Phase 4A is how something changes, and it records the move as a regression. Verified in the browser rather than asserted: **zero buttons, zero inputs, zero `onclick` attributes and zero `contenteditable` nodes** in the entire panel.

  **One call, not eight.** The obvious alternative was to call the existing per-stage `document-requirements` endpoint once per stage, which is eight round trips to build one read-only panel and would have made Closed the slowest screen in the app.

  **Grouping is authoritative because it comes from `stage_reference_docs`**, the table that says which document belongs to which stage, ordered by `stage_definitions.sort_order`. A document child record whose `variant` matches no catalogue entry is still returned, under its own heading, rather than silently dropped - the same union-not-intersection reasoning the stage panel already uses, and for the same reason: the two tables hold names as independent free strings with nothing aligning them.

  **It degrades honestly, and this was tested rather than assumed.** A Test Bed can reach Closed with documents missing via the backward transition path. On a fixture with 4 of 9 produced, the panel reads *"4 of 9 documents produced. 5 were never recorded."*, renders the missing five dimmed and labelled **Not produced** rather than as blank rows that would read like a missing URL, and shows real URLs where they exist and *"No document URL recorded"* where they do not. **The two genuinely completed records both hold nine approved documents and zero `document_details` rows**, so without the partial fixture the URL column would never have been exercised at all.

  **Phase 6's exception is gone.** Every transition, the last one included, now lands on the stage just entered. Re-verified by driving a full lifecycle: all seven landings correct, T7 on `stage-Closed`.

  **A real load-order race found while building it, and fixed in the product rather than worked around in the probe.** `loadTbStageDetailTab` decided terminality from `tbDetailStages`, which `renderTestBedDetail` assigns **after** it has written the header name, falling back to `tbStagesCache`, which only the LIST view ever populates. Opening a stage tab on a direct navigation inside that window left the ordered stage list empty, `isTerminal` false, and the Closed tab rendering the ordinary stage panels instead of the completed record. **Round 9 Phase 6.3 hit the same shape from the other side**, where the terminal check "read a cache only the list view populates". Resolved by letting the check fetch the stage list itself when neither cache holds it, so it can answer its own question rather than depending on where it is called from.

  **A CSS fault worth one line: I used `var(--accent)` and `var(--line)`, neither of which exists in this stylesheet** - the real tokens are `--green` and `--hairline`. An undefined custom property fails at computed-value time and the declaration is simply dropped, so the panel would have rendered with default colours and no visible error anywhere. Caught by checking every variable the new block referenced against the definitions, which is worth doing whenever a stylesheet's token names are being used from memory.

- **The document URL mechanism has never been exercised outside a purpose-built fixture. Found Round 10 Phase 7, 2026-08-19. Not a defect, and it matters for Round 13.** Round 9 Phase 6.1 built the editable document URL, and found and fixed the round's second most consequential defect doing it: `complete-document` hardcoded `status = 'approved'`, so saving a working-copy link would have approved the document and released the gate it existed to hold. That fix is real and is tested.

  **What has never happened is a URL actually being stored by a person.** Both genuinely completed Test Beds - `TT-SGP-AIRPRT-008`, driven end to end through the browser in Round 9 Phase 8, and `TT-SGP-EDUCAM-001`, driven by the business - hold **nine approved documents and zero `document_details` rows between them**. Round 10 Phase 6's own lifecycle drive produced a third with the same shape. Every operator so far has confirmed documents without recording where any of them lives.

  **How it surfaced is the useful part.** Phase 7's Closed panel renders each document's URL, and against the only two real completed records the entire URL column read "No document URL recorded". The mechanism looked built and tested and had simply never carried data. A partial fixture had to be constructed specifically to exercise it, which is the only reason the URL rendering path was verified at all.

  **Why it is not a defect.** Nothing is broken, no gate depends on a URL, and confirming a document without recording its location is a legitimate thing to do. Google Drive is not integrated, so there is no location to paste that the system can do anything with yet.

  **Why it matters for Round 13.** Customer Documents and the Drive work make URLs the point rather than an optional extra: the concept is a link to client-supplied material, and a link is all it is. That round will be building on a field whose only real-world usage to date is that nobody uses it. **Worth knowing before it is designed around**, and worth deciding deliberately whether the URL should become required at document confirmation, which is a `stage_gate_rules` question rather than a code one.

- **Round 10 Phase 8, 2026-08-19: the Sensors list becomes a toggle and one panel per sensor. Recorded as the visible surface of a real gap, not as a layout item.**

  **The gap, stated first because it is the point.** A Test Bed's sensor counts are three plain typed numbers on its own payload - `safesightCameras`, `airQualitySensors`, `hemirSensors` - and the "sensors" this panel lists are **generated from those numbers**, not read from anything. `SafeSight Camera 3` is not a record; it is the string `SafeSight Camera` followed by the loop index. **Nothing in this system links a Test Bed to a real device.** There is no serial, no location, no manufacture date, no install date and no status, because there is no device record to hold them.

  **This is already documented as connected work that was never wired up.** `PROTOTYPE_SPECIFICATION.md` Section 2b records that the prototype **already implements** a working Device-to-Test-Bed link, `applyDeviceLink()` and `linkTargetOptions()`, keyed by `linkKind`/`linkId` with a full history of linked and unlinked dates - and that it "is simply never surfaced in Test Bed's own Site Details tab, which still shows only typed-in counts". The business decision recorded there is that Test Bed should **consume that existing mechanism rather than build its own**, and that connecting it belongs to Asset Management's operational tracking work. That is still the right answer and this phase does not pre-empt it.

  **What that gap costs today, which is more than cosmetic.** Section 2b also records the two gates it would give teeth to: Installation and Commissioning could require N devices genuinely linked and matching the declared counts, and Decommissioning could require zero still linked, each unlinked with a reason. Both are document-only gates today. **So the counts are not merely unlinked, they are unverifiable**: nothing anywhere checks that a Test Bed declaring 24 cameras ever had 24 cameras.

  **Why the panels carry two lines and nothing else.** Identity, and the "not linked to a device" state that was already there. **No field was invented, deliberately.** An empty row labelled "Serial" would imply a serial exists and has not been entered, which is false - the same honesty rule that produced the deliberately empty Documents tab and that Round 9 Phase 6.3 applied to Closed. The panel carries one explicit line saying detail is not held anywhere yet and arrives when Asset Management links each sensor to a device, which marks the space without filling it.

  **One measured layout decision worth keeping.** The grid floor is **140px**, derived rather than chosen: the widest generated identity needs 114px of text plus 22px of panel chrome. An initial 118px floor **clipped 35 of 42 names at 1240px**, and since the identity is the only content these panels carry, truncating it defeats the panel entirely. This is the "assert a minimum usable width, not mere presence" rule applied to a case where the minimum usable width is exactly the width of the content, because there is only one piece of content.

  **The toggle state persists across records**, which is a display preference rather than record state and is left that way deliberately. Noted because it caught a probe of mine that assumed each record started collapsed.

- **Nothing verifies that a Test Bed declaring 24 cameras ever had 24 cameras. Round 10 Phase 8, 2026-08-19. Recorded as its own item because it is a data-integrity gap, not a consequence of the layout phase that surfaced it.**

  **The state today.** `safesightCameras`, `airQualitySensors` and `hemirSensors` are three plain typed numbers on the Test Bed's own payload. They are the sole input to the install and hosting cost lines, they appear on the Test Bed list view, and they generate the Sensors panel. **Nothing anywhere links a Test Bed to a device record**, so every one of those uses rests on a number somebody typed and nothing has ever checked. A Test Bed can be costed, driven through all seven gates and closed while declaring any count at all.

  **The mechanism already exists and was never surfaced.** `PROTOTYPE_SPECIFICATION.md` Section 2b records that the prototype **implements a working Device-to-Test-Bed link** - `applyDeviceLink()` and `linkTargetOptions()`, keyed by `linkKind`/`linkId`, carrying a full history of linked and unlinked dates - and states plainly that it "is simply never surfaced in Test Bed's own Site Details tab, which still shows only typed-in counts". The recorded business decision is that Test Bed should **consume that mechanism rather than build its own**, and that connecting it is "a wiring task, not new design".

  **Section 2b also names exactly what the connection would buy, and it is not cosmetic.** Two currently document-only gates would gain real, data-backed teeth:

  | Stage | Gate today | With the linkage |
  |---|---|---|
  | Installation and Commissioning | one document | N devices genuinely linked, matching the declared counts |
  | Decommissioning | one document | zero devices still linked, each unlinked with a reason |

  **So the counts are not merely unlinked, they are unverifiable, and two gates that read as physical checks are in fact paperwork checks.** A Test Bed can pass Installation and Commissioning with no device on site, and pass Decommissioning with every device still there, and the system cannot tell either way.

  **The argument this makes, stated as a recommendation rather than a decision.** Asset Management currently sits late in the build order, after Risk Register, Pilot and Deployment. **This is an argument for connecting it here earlier than planned**, and specifically for connecting the Device link before the rest of Asset Management: the mechanism is built, the consumer is built, the two gates that need it are already configured and already running against real records, and every completed Test Bed until then carries counts that no part of the system has verified. The cost of waiting is not a missing feature, it is a growing set of closed engagements whose physical claims were never checkable.

  **What was NOT done, deliberately.** Round 10 Phase 8 surfaced this and did not pre-empt it: the Sensors panels carry identity and the existing not-linked state, and no field was invented, precisely so that the honest empty space stays visible as an argument rather than being filled in with something that looks like data.

- **Round 10 Phase 9, 2026-08-19: `CURRENT_STATE.md` regenerated and reconciled line by line. Configuration unchanged; every delta is record churn, and one of them was a defect in my own teardown.**

  **Invariant 1 holds exactly. `stage_gate_rules` is 54 rows, 38 on `test_bed`** (18 `approval_obtained`, 3 `contact_role_linked`, 9 `document_status`, 8 `payload_field_required`), and the entire gate-rule section of the file is **byte-identical** to the Round 9 close-out, all 54 rows included. This round configured no gates, so identical is the required result rather than a pleasing one.

  **Three further sections are byte-identical and worth naming because two of them were expected to move.** The **writable-key allowlists** did not change: Phase 9 item 2 anticipated `TEST_BED_WRITABLE_KEYS` moving if Phase 3.2 altered Installation Environment, and it did not, because `installationEnvironment` was **already** a writable key - 3.2 added a validation rule, not a key. And the **migration list is unchanged at 45**, because 3.2's data migration was surveyed and deliberately not written. `stage_definitions`, `stage_reference_docs`, `approval_tracks`, `routing_rules`, `conversion_criteria` and `stage_probability_defaults` are all unchanged too.

  **Only two configuration lines moved, and both are code this round added:** the route inventory 41 to 43, being `GET /contacts/:id/test-bed-name-suggestion` (Phase 1, so the creation dialogue's default comes from the same function the create endpoint uses) and `GET /test-beds/:id/lifecycle-documents` (Phase 7).

  **The reconciliation found a real defect in my own teardown, which is the phase justifying its own existence for the second round running.** The first regeneration reported **60 live `document` records against 29 before the round**. Cause: every phase's teardown matched fixtures by `account_id` or `parent_record_id = account`, but a document child record hangs off the **Test Bed**, not the account, so **31 document children of soft-deleted probe Test Beds were still live**. Soft deleting a parent does not sweep its children, and nothing in the teardown noticed because it was verifying the rows it had selected rather than the rows it had created. Cleaned up, re-queried, live documents back to 29. **One further orphan under `TT-GBR-AIRPRT-031` predates this round and was deliberately left alone rather than tidied into my own cleanup.**

  **Every remaining delta reconciles arithmetically against the Round 9 file**, splitting each into activity between the two dumps and activity inside the round:

  | Line | Round 9 | now | reconciliation |
  |---|---|---|---|
  | documents soft deleted | 151 | 234 | + 8 (2 pre-round `test:db` runs x 4) + 75 (this round) |
  | documents live | 20 | 29 | + 9, the business's own lifecycle, before the round |
  | harness rows soft deleted | 1077 | 1415 | + 52 (2 pre-round runs) + 286 (11 runs this round) |
  | harness distinct types | 90 | 116 | + 4 + 22, two types per run |
  | approvals | 38 | 135 | + 20 (business activity) + 77 (probe lifecycles) |
  | test_bed soft deleted | 87 | 137 | + 50, every probe Test Bed |
  | contacts / accounts soft deleted | 138 / 141 | 161 / 152 | + 23 / + 11, all probe fixtures |

  **Zero records created during this round are still live**, confirmed by direct query rather than by trusting the teardowns. The seven live Test Beds are exactly the pre-round set.

  **Counter consumption, declared rather than discovered later.** `SGP-SMARTC` advanced from 6 to **52**: 46 reference codes drawn, `TT-SGP-SMARTC-007` through `-052`, across Phases 1, 2, 3, 5B, 6 and 7. A further 4 probe Test Beds were created by direct insert and drew no code. Per the standing rule no counter row was deleted; the table holds 412 rows.

  **Three probe auth users remain and cannot be deleted**, not the two carried forward from Phase 0A. `records.owner_id` is `not null references auth.users(id)` with no `ON DELETE` clause, so soft-deleted fixtures pin their owner permanently. **The containment worked from the point it was applied**: `session.mjs` was pinned to a single user per round during Phase 5B, and every phase after it reused that one account, so the count is three rather than one per phase. They own 377 records between them and **none live**.

- **A teardown that verifies the rows it SELECTED rather than the rows it CREATED is a correct check on the wrong set. Named Round 10 Phase 9, 2026-08-19.** Every phase's teardown this round selected its fixtures by `account_id` or `parent_record_id = account`, soft deleted exactly those rows, re-queried exactly those rows, and correctly reported zero live. **All of it was true and the sweep was incomplete**, because a `document` child record hangs off the **Test Bed**, not the account, and was never in the selection to begin with. Thirty-one document children of soft-deleted probe Test Beds stayed live across seven phases without a single teardown reporting anything wrong.

  **The two halves worth separating.** First, **soft deleting a parent does not sweep its children.** There is no cascade on `deleted_at`, by design - it is a column, not a delete - so every descendant has to be selected explicitly. Second, and the more general fault: **a teardown's verification is only as wide as its own selector**, so a re-query of the selected set can never reveal what the selector missed. Rule 9's discipline of querying the field rather than trusting the response was followed to the letter every time and could not have caught this.

  **The check that would have caught it, and it is cheap.** Count what the run created, independently of how teardown selects, and assert that count is zero live afterwards - `records` created since a timestamp, or tagged by run, rather than reached by relationship. That is what Phase 9 eventually did, and it found the residue in one query. **The general form: verify the complement, not the selection.** A cleanup proves itself by asking "what did this run leave behind" and never by asking "are the rows I chose to delete deleted".

- **The `CLAUDE.md` injected at session start is stale after any round that edits it, and the file exists precisely to carry standing rules across sessions. Recorded Round 10A, 2026-08-19.** `CLAUDE.md` is delivered automatically into each session as a `system-reminder`, which is what makes it the one document guaranteed to be read. **That copy is a snapshot taken at session start.** Round 10 added Architecture rule 8 and Verification rules 6, 7, 10 and 11, four of them promoted from briefs that had restated them for four and seven consecutive rounds, and the copy sitting in context throughout Round 10A's opening was the **pre-Round-10 file**, carrying none of them.

  **The failure is quiet and it is self-concealing.** Nothing signals that the injected copy is out of date; it is complete, well-formed and authoritative-looking, and the rules it is missing are exactly the ones most recently judged important enough to promote. A session working from it would apply Round 9's standards to a Round 11 build while believing it had read the current rules. **This is a narrower repeat of the failure already recorded here for Rounds 5 to 7**, where the governing documents were not read at all: there the remedy was to open them; here they were opened, automatically, and the wrong version arrived.

  **Standing remedy, and it is mechanical rather than a resolution to be careful.** **Re-read `CLAUDE.md` from disk at the start of any session that follows a round which modified it, and treat the injected copy as a pointer to the file rather than as the file's content.** The cheap general form is to re-read it whenever the previous round's close-out records a change to it, which the close-out is already obliged to state. **The same argument applies to any document delivered by injection rather than by reading**, and it is the reciprocal of the `CURRENT_STATE.md` rule: that file is trusted because it is regenerated, and an injected copy of a hand-edited file has no equivalent guarantee.

  **Two real gaps found by doing exactly this, on the first re-read.** Neither is caused by the staleness above; both are `CLAUDE.md` lagging what `DESIGN_PRINCIPLES.md` already records, and both would produce wrong behaviour if followed literally. They are reported rather than silently corrected. **(a)** Build discipline rule 7 still says to check the phase count with `grep -n "^## Phase"`. Round 10 split Phase 5 into `### Phase 5A` and `### Phase 5B`, and that grep **misses both**, which is precisely the undercount the rule exists to prevent; the Round 10 brief carries the corrected pattern and `CLAUDE.md` does not. **(b)** The `CURRENT_STATE.md` section still says a copy whose SHA "is not current `HEAD`" is stale. **Round 9 Phase 9.4 established that this check can never pass** - a generated file records the commit it was generated at and is then committed, so it can never name its own commit - and reworded the real check as ancestry plus unchanged configuration sources. That rewording lives in the Round 9 brief and here, and never reached `CLAUDE.md`.

- **First instance of Verification rule 7 being available and not applied, and the first fault in this project to reach the business rather than being caught by the person who wrote it. Round 10 Phase 2, found in Round 10A, 2026-08-19.**

  **What was verified and what was not.** Round 10 Phase 2 moved Summary to sit in line with the Test Bed name. Its evidence asserted `summaryInLine: true`, `headerNotesGone: true`, and a header height falling from 346px to 145px, plus zero container overflow at three widths and a screenshot that was opened and looked at. **Every one of those is satisfied whether or not a second Summary still renders further down the page.** The phase verified that the new Summary appeared and never verified that the old one had gone.

  **The counterfactual settles it in one line, and that is the whole point of the rule.** "If the old Summary were still there, what would these checks show?" - identical output, every assertion, at every width. Rule 7 names the absence of a thing as exactly the case where a positive check proves nothing, and I did not apply it to my own removal. **The rule was already written, already promoted into `CLAUDE.md`, and had been sharpened by me two phases earlier.**

  **Why this is recorded separately rather than as a ninth wait-condition fault.** The eight faults in Phases 5B and 6 were all in the harness, all found within the phase that wrote them, and none reached anything. **This one is in the product, and it reached the business.** That is a different category and a worse one: the round's own verification passed, the close-out reported the phase as delivered, the work was merged to `main`, and the defect was found by someone using the system. **Every prior fault in this project was caught by the person who made it; this is the first that was not.**

  **The specific lesson, which is narrower than "apply rule 7".** A change that MOVES something is two claims, not one: the thing appears in its new place, and the thing is gone from its old one. **The second claim needs its own assertion and almost never gets one**, because the natural evidence for a move is a screenshot of the destination, and a screenshot of the destination cannot show what is still sitting somewhere else on the page. For any relocation, assert the count: exactly one instance renders, not at least one.

- **Promotion into `CLAUDE.md` was one-way, so every later refinement of a promoted rule was stranded in a brief. Corrected Round 10A, 2026-08-19.** Round 10 established that a rule restated in four or seven consecutive briefs with no permanent home has authority only from repetition, and promoted three such rules. **The reciprocal fault was not visible until the next session opened the file: a rule promoted into `CLAUDE.md` and then found imprecise gets its correction written into the round's brief, and the copy that every session actually reads stays wrong.**

  **Both gaps found on the first re-read were exactly this shape, and both had been followed literally in the interval.** Build discipline rule 7 told sessions to count phases with `grep -n "^## Phase"`; Round 10 split Phase 5 into `### Phase 5A` and `### Phase 5B` and corrected the pattern **in the Round 10 brief only**, so the standing rule returns 11 headings against a brief whose real count is 13 and would have missed two signed-off phases. The `CURRENT_STATE.md` staleness test told sessions that a recorded SHA which "is not current `HEAD`" means stale; Round 9 Phase 9.4 established that **this can never pass**, reworded it as ancestry plus unchanged configuration sources, and put the rewording in the Round 9 brief. It was worked around by hand at the Round 10 merge rather than followed, which is precisely the behaviour that made Round 9 decline it as a merge gate.

  **The asymmetry worth naming: a brief is a record of one round, and `CLAUDE.md` is what the next session reads.** Writing a correction into a brief feels like recording it, and by every other measure it is - the reasoning is preserved, the round is auditable, `DESIGN_PRINCIPLES.md` carries the full account. **What it does not do is change what anyone will be told to do next time.** Promotion and refinement are the same act pointed at the same file, and only one of them was reaching it.

  **The standing rule is now in `CLAUDE.md`'s own Documentation section: when a round corrects or refines a rule that already lives there, the correction lands there in that round, not only in the brief.** Paired with the session-start staleness remedy directly above it, since the two failures compound: a refinement that never reaches the file cannot be read, and a refinement that reaches the file is still not read by a session holding the previous snapshot.

  **A rule that always fails is worse than no rule**, and that is the sharper half of the `CURRENT_STATE.md` case. It is not merely useless: it trains its readers to route around it, and once routed around it stops being consulted at all, taking whatever genuine check it contained with it.

- **An assertion written to catch one failure mode does not generalise to the next, and the Summary duplicate demonstrated both halves within one round. Round 10A Phase 1, 2026-08-19.**

  **The instruction, and why it was wrong.** Round 10A's brief said to remove the lower Summary block and keep the header instance. Investigation established that **the lower block is the only editable one**: it carries `onclick="openTbField('summary')"`, `tabindex="0"`, a keyboard handler, the `#tb-edit-summary` wrapper and the `#tb-input-summary` textarea, while the header instance is a `<div>` with no handler and no control of any kind inside it. `summary` stays writable server-side and stays in `TB_ALL_EDITABLE_FIELDS`, so **the capability would have survived everywhere except in the product**. Following the instruction would have left a Test Bed's Summary permanently uneditable.

  **The part worth recording is what the checks would have said.** The resulting state passes **every** assertion Round 10 Phase 2 made - Summary renders in line with the name, the header wraps correctly at 1240px, no container overflows at any width, and the screenshot looks right. **It also passes the relocation count assertion added to `CLAUDE.md` immediately afterward**, because exactly one Summary would render. That assertion was written specifically because Round 10 Phase 2 had missed that the **old instance survived**. It gives no help at all against the next failure, which is that the **surviving instance is inert**.

  **The general form: an assertion earned from a specific miss is a patch on that miss, not a test of the claim.** "Exactly one renders" answers how many, and says nothing about whether the one that remains does anything. The counterfactual is what generalises, because it is regenerated per claim rather than accumulated: **"if Summary were no longer editable, what would these checks show?"** - identical output, every assertion, every width. Two rounds running, the check that would have caught the defect was the one nobody had written yet, and in both cases the counterfactual would have produced it in a sentence.

  **This is also the second time in two rounds that a brief's instruction was wrong and the brief's own investigation item caught it.** Round 10 Phase 4's "Save returns to the Leads page" named a save path that has never navigated; this one named the wrong instance to delete. Both briefs asked for investigation before the fix, and both times that instruction was the thing that prevented the damage. **The value of "investigate before fixing" is highest exactly when the brief sounds most certain.**

- **Summary becomes editable from every tab, and that is a deliberate consequence of where the business asked for it. Round 10A Phase 1, 2026-08-19.** The fix moves the click-to-edit control into `.detail-head`, which sits **outside** the tab panels: `switchTbTab` only hides and shows `.detail-tab-panel` elements and never touches the header. So Summary is now reachable and editable from the Commercials tab and from all eight stage tabs, not only from Reference.

  **Recorded as chosen rather than discovered.** The alternative was to keep the control on the Reference tab and move the read-only display to the header, which would have reversed the placement the business confirmed in Round 10 Phase 2. **The judgement, stated by the business: it is acceptable and arguably correct, because Summary describes the Test Bed rather than any one stage.** That reasoning is worth keeping because it decides the next case too: a field that describes the record belongs in the header, and a field that describes a stage belongs in that stage's panel.

  **One visible consequence follows and is not optional.** The header Summary previously hid itself when the field was empty. **It cannot hide any more**, because a hidden control cannot be clicked and a Test Bed with no Summary could never be given one. It therefore renders its click-to-edit placeholder on every record, including the five of seven live Test Beds that currently hold no Summary at all. That is a real change to how an empty record looks, and it is the price of the control living there.

- **Investigate-before-fixing earns its cost precisely when the instruction sounds most certain. Named Round 10A Phase 1, 2026-08-19, on the second consecutive instance.** Both cases are briefs stating something confidently and specifically, and being wrong about it, and in both the brief's own investigate-first item is what prevented the damage.

  **Round 10 Phase 4.** The brief said "Save returns to the Leads page. The user should stay in the context they were working in", and scoped a phase to fixing that save path. There are exactly two contact-creation dialogues in the frontend and **neither navigates anywhere**: one ends in `closeNewLeadModal()` then `loadContactsData()` and its trigger button exists only inside the Leads view, and the other already reloads the originating record. The real cause was an unfiltered `onAuthStateChange` handler re-running the sign-in path on a background token refresh. **Building the item as written would have changed working code and left the defect in place.**

  **Round 10A Phase 1.** The brief said to remove the lower Summary block and keep the header instance. The lower block was **the only editable one**; the header instance was a `div` with no handler and no control inside it. **Following the instruction would have left Summary permanently uneditable**, and would have passed every check the previous round had run plus the assertion added afterward.

  **Why this keeps happening, and it is not carelessness.** Both briefs were written from the project's documents rather than from the code, which is the correct way to write a brief: documents record what was decided and why, and that is what a round needs to be scoped against. **The failure mode is structural: documents record intent, code records behaviour, and the two diverge silently.** A brief is therefore a hypothesis about the code, stated in the voice of a decision.

  **The operative form, and it inverts the intuition.** Certainty in a brief reflects the **author's confidence, not the code's state**, so the instructions that read as settled are exactly the ones whose premises have never been checked. A hedged instruction invites investigation and usually gets it; a confident one reads as already-established and gets built. **The cost of investigating is highest where it feels most redundant, and so is the payoff.**

  **Practical consequence for how these rounds are run.** Where a brief states a cause rather than a symptom - "Save returns to Leads", "the lower block is the duplicate" - treat the cause as the thing to verify first and the symptom as the thing that is actually known. **The business reported two real symptoms both times**, a jump to Leads and a doubled Summary, and both were genuine; only the diagnoses were wrong.

- **Two removals in one round left their containers behind, and both were verified the same wrong way. Round 10A, 2026-08-19.** Round 10 removed two things from the Reference tab and left something standing each time.

  **The duplicate Summary.** Phase 2 moved Summary into the header and never removed the original block, so it rendered twice. Verified by confirming the header instance appeared in line with the name; nothing asked whether the old block had gone. **Reached the business.**

  **The stale buyer wrapper.** Phase 3.1 removed the "CLIENT BUYERS" grouping label and left the `<div style="margin-top:16px">` that existed only to carry it and space it. Verified by confirming the label was absent from the rendered panel; nothing asked whether its container had gone with it. **Also reached the business**, as an uneven gap.

  **The shared shape: both phases verified that the intended NEW state existed, and neither verified that the OLD thing had stopped existing.** Every assertion was true. Summary did render in line with the name; the grouping label genuinely was gone. **A positive check on the new state is silent about the old one, always, and a removal is a claim about the old state only.**

  **Two instances in one round argues this is not carelessness but a default.** The natural evidence for a change is a screenshot or a measurement of the thing you built, and both are taken at the destination. Nothing about producing that evidence ever directs attention to where the thing used to be. **The counterfactual is what redirects it, and for a removal it is trivially easy to state:** if the old element were still there, would this check notice? For both of these the answer was no, in one line, before either shipped.

  **The concrete form for a removal, now in `CLAUDE.md` Verification rule 7: assert the count, not the presence.** Exactly one Summary renders, not at least one. Zero elements match the removed container's selector, not "the label is gone". **A removal is verified by counting to zero, and the thing to count is the element, not what it displayed** - the buyer wrapper displayed nothing at all after the label went, which is precisely why it survived a visual check.

- **Open item: the Customer Details buyer rows arrive 650ms after the record renders, and the pending-state pattern now has at least two surfaces. Round 10A Phase 2, 2026-08-19.** `renderTbBuyerRows()` is `async` and awaits a contacts fetch, so Customer Details shows Account and Client Lead and nothing else for **650ms after the record's name is on screen**, measured per animation frame. It is not a defect in the panel's markup, and removing the stale wrapper this round eliminated the unexplained blank space it left but not the delay itself.

  **Same class as Round 10 Phase 5A.** The stage panels had exactly this shape - content that arrives on its own schedule with nothing marking the interval - and the remedy there was a synchronous pending state written the moment the action starts, with `dataset.stage` set only when real data lands so a test still waits on data rather than on the marker. **That is now the second surface, which makes it a pattern to apply wherever a panel renders asynchronously rather than a fix to make case by case.** Worth doing as one pass over the async renderers rather than one panel at a time, and worth stating that the pending marker must never be the thing a check waits on.

  **STANDING NOTE, added Round 11 Phase 5: any wait written against a panel with a known stale window needs the counterfactual applied by default, not on suspicion.** The whole point of these panels is that the OLD state is on screen and looks settled, so it satisfies most conditions anyone would naturally write - the element exists, it has content, it names a person, the container is non-empty. **Two faults in Phase 5 alone were this shape**: one waited on a feedback message written before the reload was awaited, the other on a sibling row that settles 292ms earlier. Both reported the same wrong answer with complete confidence.

  The rule is cheap to apply and does not require knowing which panel is slow: **state what the condition would show if the change had not landed, and check it differs.** Where a panel is already recorded as having a stale window, treat that as the default assumption rather than something to rule out.

  **A separate and compounding problem in the same call: `GET /api/contacts` fetches EVERY contact and filters client-side** on `parent_record_id === tbBed.account_id`. That is why the wait is 650ms rather than tens of milliseconds, and it is a scaling problem rather than a fixed cost: **it gets slower with every contact added anywhere in the system, regardless of how many belong to this Account.** There are 161 contacts today, 9 of them live. A server-side filter is the fix, and it is a genuinely separate change from the pending state - one makes the wait honest, the other makes it short.

- **Open item: every `.ref-field` overflows its own box by 4px. Pre-existing, reported not fixed, Round 10A Phase 2, 2026-08-19.** Measured on the first row of all four Reference tab panels: `scrollWidth` 394 against `clientWidth` 390, identically. It appears on plain read-only text rows carrying no control, so it is not caused by any field type, and it was **identical before and after this round's change**, so nothing here introduced it.

  **Nothing is visibly clipped**: no label and no value reports truncation at 1240, 1920 or 3440, and every row's right edge sits inside its card. So the practical cost today is zero, and it is recorded because the standing layout rule treats `container.scrollWidth > container.clientWidth` as the overflow test and this trips it on every row of every Reference-style panel in the app.

  **Not fixed here deliberately.** `.ref-field` is a shared primitive used by Contact, Test Bed, Opportunity and Account detail, and changing its box model to chase 4px in a two-defect fix round risks a great deal more than it gains. **The reason to record it rather than ignore it: it is a standing 4px of false positive in exactly the check this project relies on to catch real overflow**, so anyone measuring a Reference-style row in future will see a non-zero delta and has to know that 4 is the floor rather than a finding.

- **The scoring model is two new reference tables, and the reasoning for not using an existing one is the part worth keeping. Round 11 Phase 1, 2026-08-19.** This is the first mechanism in the system that captures **judgement** rather than fact. Everything before it records what happened; a score records what someone thought, why, and when they changed their mind. Standing rule 4 says a phase appearing to need a new table stops and reports first, so all 18 existing tables were checked before either was created.

  **Not `stage_gate_rules.requirement_detail`**, which already holds the criterion key and label so anchors would "fit". The standing rule from `stage_reference_docs` is explicit that informational, non-gating content gets its own table and is never layered onto `stage_gate_rules` "just for display", because that table's rows carry real enforcement semantics elsewhere. **Anchor wording is the purest informational content in this system**, and the rule exists precisely because display and gating were once conflated into one mechanism and the endpoint silently returned `[]` for every stage of every Test Bed.

  **Not `records` / `record_revisions`.** A criterion is admin-managed vocabulary with no lifecycle, the same category this document already assigns to `industries` and `approval_tracks`. Six existing reference tables set that precedent. A new `record_type` would also need real `stage_definitions` rows before its transitions worked at all, which is forcing a lifecycle onto a list, and it would appear in record counts.

  **`scoring_criteria`** carries `record_type`, `criterion_key`, `name`, `asks`, `sort_order` and `rescore_through_stage`. `criterion_key` is the join to `stage_gate_rules.requirement_detail->>'field'`, so no extra column exists to link them. **`rescore_through_stage` is deliberately not the same question as the re-score gates Phase 4.2 configures**: it records where a re-score is PERMITTED, the gate rule records where one is REQUIRED, and the brief distinguishes the two itself. Collapsing them would give one decision two homes.

  **`scoring_anchors`** carries `criterion_id`, `version`, `score`, `wording`, unique on the triple. **Two tables rather than three columns on one**, because anchor-per-row means a wording change is a new version's rows rather than a duplicated criterion row, and because giving 2 or 4 real wording later is then **a row and not a migration**. The `score` check is `between 1 and 5` rather than `in (1,3,5)` for exactly that reason: anchor wording is provisional and the business will review it.

- **Anchor versioning is the part that cannot be retrofitted, and it is enforced by RLS rather than by convention. Round 11 Phase 1, 2026-08-19.** Every recorded score stores which version of the anchors it was made against. **Without it, rewriting an anchor in six months silently changes the meaning of every historical score**, and comparison across time becomes worthless without anyone noticing. With it, the business can say "under the current definition that would have scored a 2." It is the same discipline as immutable approved snapshots, applied to judgement rather than to money, and it is the difference between a framework that improves and one that merely persists.

  **Versioning is per-criterion, not global.** A score is made against one criterion, so `(criterion, version)` is the exact granularity. A global version would bump Data Rights' recorded version when only Rollout Path's wording changed, which makes the stored version misleading about what actually changed.

  **Immutability is deny-by-default, not discipline.** `scoring_anchors` has a select policy and **no update and no delete policy**, the identical construction that makes `record_revisions` immutable. Proven rather than asserted: an `UPDATE` and a `DELETE` through the publishable key each affected **0 rows** while a `SELECT` still returned 3, and the v1 wording was byte-identical afterwards. A wording change inserts a new version's full set of rows; nothing can rewrite history even by mistake. **Current version is `max(version)`, computed and never stored**, per the rule that computed values are computed.

  **Proven end to end, with the counterfactual stated before the change rather than after.** A score of 3 was recorded against Rollout Path stamped `anchorVersion: 1`; version 2 was then inserted with a visibly different string for score 3. The counterfactual was written down first: **if versioning were not being read at all, the historical score would resolve to the v2 string.** After the change the historical score still resolved to v1's wording, did not pick up v2, and the current wording was v2 - three separate assertions on the resolved **text**, not on a row coming back. The proof's version 2 was then torn down and the table re-queried at 15 rows carrying version 1 only.

- **`exitQualDataAndUseCase` retired, and the sequencing was chosen from a survey rather than from preference. Round 11 Phase 1, 2026-08-19.** Four Qualification criteria become five, so this is a **split rather than a rename**: the criterion asked two questions at once and the framework now asks them separately, as Clear Use Case Requirements and Metrics and as Data Rights. The other two renames are ordinary, and Physical Suitability keeps its name.

  **Every key is new, including the unchanged criterion, because the stored TYPE changes.** A tick stores an ISO timestamp; a score stores an append-only series. Reusing `exitQualPhysicalSuitability` would leave four Closed records holding a timestamp in a field now typed as an array. The `exitQual` prefix is also wrong for three of the five, which are re-scored at later stages.

  **Four references existed, not the three that are obvious**, and the fourth is free: `TEST_BED_WRITABLE_KEYS` is built by spreading `TB_EXIT_CRITERION_KEYS`, so removing the key from the criterion set also removes it from the write allowlist and a `PATCH` naming it is now rejected. That is intended, since the only records still holding it are historical.

  **The alternative sequencing was refuted by live data, not reasoned away.** Retiring the key from `TB_EXIT_CRITERION_KEYS` while leaving the labelled gate rule in place makes the row **computed rather than tickable**: it still blocks, and nothing in the product can satisfy it. That is the Round 7 Phase 3.2 shape, where building a branch without removing its rules would have made a transition impossible to complete. Surveyed across all 151 Test Bed records first: **all three live Qualification records hold zero ticks on any criterion**, so that sequencing would have blocked every one of them while the chosen one blocks none.

  **The intermediate weakening is stated rather than glossed.** Transition 1 carries three labelled criteria from this phase until Phase 4 restores five. It is safe for a specific, measured reason and not a general one: no live record holds a tick, so nothing loses one it was relying on, and the change cannot let a record through a gate it was otherwise close to passing.

- **A verification that reads the right data can still screenshot the wrong thing, and the screenshot rule is what catches it. Round 11 Phase 1, 2026-08-19.** The first browser probe called `switchTbTab('stage-Qualification')` programmatically, read `#tb-stage-exit-criteria-list` after waiting on `dataset.stage === 'Qualification'`, and returned entirely correct data: three tickable rows, the retired criterion absent. **The screenshot showed the Reference tab.** `loadTestBedDetail()` sets `tbUserPickedTab = false` and the render then switches to Reference, so the programmatic tab switch was reverted after the panel had already been populated and read.

  **Every assertion was true and the image was of somewhere else.** The data really was correct, which is why nothing in the numbers hinted at it. Re-driven by clicking the real tab button so `tbUserPickedTab` was genuinely set, and by waiting on the panel being **visible** as well as settled, the screenshot then showed what the assertions had been describing all along. **This is the standing rule "open the screenshot and look at it" earning its place in a case where the programmatic checks were not wrong**, only the evidence was, which is a weaker failure than the recorded ones and still worth the ten seconds it took to catch.

- **Scores are an append-only series on the record's own payload, written only by a dedicated endpoint, and the entry shape is deliberately general. Round 11 Phase 2, 2026-08-19.** Every score is a new entry; nothing is ever overwritten. A 3 revised to a 4 after site assessment is useful; **a 3 overwritten by a 1 when someone finally visits and finds no power at the mounting positions is the single most valuable data point this framework will produce**, and overwriting destroys it.

  **`PATCH /test-beds/:id` is the obvious reuse and is wrong.** A PATCH takes the whole value for a key, so the client would send the entire array and could forge `by`, back-date `at`, claim any `anchorVersion`, drop earlier entries or rewrite them. **That defeats append-only completely**, so the criterion keys are deliberately absent from `TEST_BED_WRITABLE_KEYS` and `POST /test-beds/:id/scores` is the only way in. Proven rather than assumed: a `PATCH` naming `scoreRolloutPath` returns 400 and the stored series is unchanged.

  **The entry shape is `{ at, by, value, comment, reason, anchorVersion, stage }`, and each choice is about Round 12 rather than about scoring.** `at` and `by` are **the same key names the notes pattern already uses**, so anything that renders one renders the other. **`value` rather than `score` is what makes it general**: Round 12's field-change trail records a new value in the same slot, and "what it was before" is the previous entry's value rather than a second field. `anchorVersion` is simply **absent** on a series with no anchors, which is how this codebase already reads optional payload keys. **No `meta` bag**, deliberately: a wrapper invented for a consumer that does not exist yet is structure without evidence, and Round 12 can add a key the same way this one did.

  **Author, timestamp and anchor version are all written server-side, never accepted from the client.** The author is a deliberate departure from the notes pattern, which sets `by` client-side from the session. **A note records that somebody said something; a score records a judgement somebody is answerable for**, and it gates a transition. Approvals get `with check (auth.uid() = approver_id)` from RLS; a payload key has no equivalent, because `record_revisions` RLS constrains who writes a revision, not what a JSON field inside it claims. `at` follows for the same reason, a client clock is not evidence, and **`anchorVersion` must be resolved server-side or a client could stamp a score with a version whose wording it was never made against**, which is the one thing the versioning exists to prevent. Proven by sending all three from the client and confirming each was ignored.

- **An unscored criterion is an ABSENT KEY, never an empty array, and the gate deliberately does not depend on that. Round 11 Phase 2, 2026-08-19.** The two questions constrain each other and were decided together rather than one at a time.

  **The write convention follows what this codebase already does.** Unticking an exit criterion sends `null` and the server **deletes** the key (`if (key in payload && payload[key] === null) delete mergedPayload[key]`) rather than storing a sentinel, and every notes reader normalises an absent key to `[]` at read time. Writing `[]` would mean "scored, zero times", which is not a state that exists. Confirmed on the fixture: after five entries on one criterion, the other four keys are genuinely **not present** in the payload rather than present and empty.

  **The gate is made correct by Phase 4.1.1's length clause, not by the convention holding.** `payload_field_required` treats `[]` as PRESENT, so an empty array arriving by any route, a future renderer, a migration, a bulk write, would open the gate. **Convention keeps the data clean; the clause keeps the gate honest.** Relying on the convention alone is exactly the discipline-not-a-property case the brief rejected, and the distinction is worth keeping because the two look interchangeable from inside a single phase: if the write path is careful, the clause appears redundant right up until something else writes.

- **A selection rule cannot be tested by data that agrees with every implementation of it, and appending in order is exactly such data. Round 11 Phase 2, 2026-08-19.** Round 10 Phase 2 found the header notes digest showing the two **oldest** notes labelled "Latest notes", because it assumed oldest-first against an array that prepends; it survived two rounds of screenshots because no live record ever held more than one note, and **with one entry every implementation of "the most recent" looks identical, including every wrong one.**

  **This series appends where notes prepend, so trusting array position would be the same bug with the sign flipped**, and a naturally-built fixture would never reveal it: append five entries in order and "last element" and "newest by timestamp" give the same answer every time. **The fixture was therefore built so the two answers differ**, by injecting the chronologically newest entry at array position 0:

      stored order    : 2 -> 3 -> 4 -> 1 -> 5
      chronological   : 3 -> 4 -> 1 -> 5 -> 2
      correct current : 2      (newest by `at`)
      wrong current   : 5      (last array element)

  The panel showed **2**, and the check could have failed. Both the renderer and the write path sort on `at` rather than on position, so a payload written by any future path orders correctly whichever end it appends to. **The general form: state the smallest dataset on which a wrong implementation would look different from a correct one, and build that, rather than the dataset the feature naturally produces.**

- **`var(--line)` is used twice in `style.css` and has never been defined, so two panels have had no row separators since Round 9 Phase 6. Found Round 11 Phase 2, 2026-08-19, reported not fixed.** The real tokens are `--hairline` and `--hairline-strong`. **An undefined custom property fails at computed-value time and the declaration is silently dropped**, so `.tb-doc-row` and `.tb-crit-row` both carry a `border-bottom` that has never rendered. Introduced by `66f2aa6`, Round 9 Phase 6.

  **This is the identical fault Round 10 Phase 7 recorded against my own CSS** (`var(--accent)` and `var(--line)`, caught before shipping by checking every variable a new block referenced against the definitions). The same check, run again in this phase, found the live instance the earlier entry did not think to look for: that entry fixed its own block and never swept the file.

  **Not fixed here deliberately.** It is a two-token change with no risk, and it would alter the rendered appearance of two existing panels, which is a visual change outside this phase's scope and outside its evidence. Recorded so the next phase touching either panel does not rediscover it, and as an argument for the sweep being cheap: `grep -oE "var\(--[a-z-]+\)"` against the definitions list takes seconds and would have caught this the day it landed.

- **The undefined-CSS-variable fault was found twice, fixed once, and the second instance shipped for two rounds. The remedy is a sweep encoded as a test, not a third individual fix. Named Round 11 Phase 2, 2026-08-19.**

  **Round 10 Phase 7 found it and recorded it**: "I used `var(--accent)` and `var(--line)`, neither of which exists in this stylesheet - the real tokens are `--green` and `--hairline`. An undefined custom property fails at computed-value time and the declaration is simply dropped, so the panel would have rendered with default colours and no visible error anywhere. Caught by checking every variable the new block referenced against the definitions." **That fix covered the block being written and nothing else.** The file was never swept.

  **`var(--line)` was already live in two places when that entry was written**, introduced by `66f2aa6` in Round 9 Phase 6: `.tb-doc-row` and `.tb-crit-row` each carry a `border-bottom` that has never rendered. So Terminus Documents and Exit Criteria have had no row separators for two rounds.

  **It was visible in a screenshot and nobody read it as a defect**, which is the part worth keeping. The standing rule says to open the screenshot and look at it, and that was done repeatedly across Rounds 9, 10 and 11; rows running together simply reads as a design choice. **Looking at a screenshot catches things that look wrong. It does not catch things that look deliberate**, and a missing separator is indistinguishable from a decision not to have one.

  **Three findings compound here and each is separately true.** A fix applied to the surface being written is not a fix for the file, which is the standing "a fix built for the pages that existed at the time" entry pointing inward at one file rather than outward at new pages. A silent failure mode plus a plausible appearance means no amount of looking will surface it. And **the check that found it, `grep -oE "var\(--[a-z-]+\)"` against the definitions list, takes seconds and was run by hand twice** - once in Round 10 Phase 7 scoped to one block, once in Round 11 Phase 2 scoped to the file, which is the only reason the live instance surfaced at all.

  **A check run by hand when someone remembers is not a control**, which this document already states in the form "when a control matters, the assertion belongs in the automated suite, where it passes or fails, not in prose". **Scoped to Round 11 Phase 7**, alongside the other invariants that round already adds, rather than to Round 12: the sweep is small, the suite it belongs in is being extended in this round anyway, and deferring it repeats the mistake of leaving a known cheap check to a future round. The two `var(--line)` declarations are fixed there, in the same phase that makes a third instance impossible, rather than as a third individual fix now.

- **The reason-for-change dialogue is now one mechanism with two storage targets, and the split is the point. Round 11 Phase 3, 2026-08-19.** The brief said "if it generalises, extend it", which framed the answer as one decision. It is two, and they go opposite ways.

  **The interaction generalised and is now `window.requestChangeReason` in `app.js`**, beside `revealFieldControl` and for the same reason: that file loads first, so a helper defined there reaches every detail screen. It owns the dialogue's DOM, its focus trap, its single Escape owner, its backdrop-click and its focus return. **What it does not own is storage**: each caller passes an `onConfirm`, and the helper never writes anything.

  **The storage could not be shared, and that is not a compromise.** Est. Close Date writes its reason into `payload.notes` as prose and bumps `closeMoves`; a score revision writes the reason **onto the score entry**, which this round's own evidence requires and which the note shape cannot express. **Opportunity's storage is deliberately unchanged** - it is correct for what it records, nothing in this round consumes it, and rewriting a working mechanism to look like a new one is scope this round was not given.

  **Both callers were re-verified after the rewire rather than one.** The property Round 3 Phase 3 proved empirically, that cancelling does not discard an unrelated dirty field edited in the same batch, is now a property of the shared helper, which touches no caller state on cancel. Confirmed on Test Bed (an unrelated `siteAddress` edit and the score draft both survived a cancel) and on Opportunity (an unrelated Summary edit and the `estClose` edit both survived). **A shared helper makes that property hold in one place instead of once per caller, which is the actual return on sharing it.**

  **`saveTbDirtyEntries` was split out of `saveTbFields` for the same reason `performGenericRefSave` was split out of `saveRefFields` in Round 3**: so the held fields from the same Save click are saved by the identical code path afterwards rather than by a second, drifting copy.

- **A shared dialogue placed inside one caller's view container works for that caller and silently fails for every other. Round 11 Phase 3, 2026-08-19.** The new dialogue was first added next to the one it replaced, which sat inside `#view-opportunity-detail`. Every view except the active one is hidden, so on a Test Bed page removing the dialogue's own `hidden` class revealed a node whose **ancestor** was still hidden.

  **The failure was quiet and partial, which is what makes it worth recording.** The dialogue's markup was correct, its state was correct, the class was genuinely removed, and the helper ran to completion without error. Only `focus()` failed, silently, because an element with no `offsetParent` cannot take focus. **Had the phase not asserted focus explicitly it would have shipped**: every other assertion passed, and the Opportunity caller, whose view the dialogue was sitting in, worked perfectly.

  **This is Architecture rule 8 in a form the three recorded instances would not have predicted.** That rule covers a path correct for every caller it has becoming wrong for the one about to be built, and its instances are all behavioural: `complete-document` hardcoding a status, `api()` lacking a `catch`, `renderTbStageExitCriteria` lacking a token guard. **Here the path was correct for every caller it had for a reason that had nothing to do with behaviour at all** - the dialogue happened to sit in the only view its only caller ever ran in, so its position was load-bearing and invisible. Nothing about reading the helper would reveal it; the dependency was on the DOM tree, not the code.

  **The asymmetry is the sharp part: it worked PERFECTLY for the caller whose view it was placed in, and failed silently for the one being added.** So the regression check on the existing caller passed, which is the check most likely to be run when a working mechanism is extracted. Only the new caller was broken, and only in one respect.

  **A visibly opening dialogue is the evidence most people would have stopped at**, and it was available: the dialogue rendered, was correctly populated, accepted typing and saved. Every visible thing about it was right. **The only assertion that failed was `document.activeElement`**, which is not something a screenshot shows and not something a person testing by hand would notice, because they click into the field they are about to type in.

  **The general form: a helper shared between screens must live where all of them can see it, and "next to the thing it replaces" is exactly the wrong instinct when the thing it replaces was not shared.** Confirmed structurally rather than by eye after moving it, by comparing `<div>` nesting depth against the three existing global modals: all four sit at depth 1.

- **Open item: confirming an Est. Close Date move while another field is dirty silently drops the move's own note from the current revision. Pre-existing since Round 3 Phase 3, found Round 11 Phase 3, 2026-08-19, not this round's scope.** The move POSTs to its own endpoint, which writes revision N with the note. The held fields are then saved by `performGenericRefSave`, which builds `payloadUpdate.notes = [...newNotes, ...(refPayload.notes ?? [])]` from **`refPayload`, the in-memory payload captured at page load**, and PATCHes it. That payload predates the note, so revision N+1 overwrites `notes` without it.

  Traced through the real revisions rather than inferred:

      rev 1  notes=0
      rev 2  notes=1   "Est. Close Date moved from 2027-01-15 to 2027-06-30..."
      rev 3  notes=1   "Executive Summary changed from before to ..."

  **The note survives in history and is absent from the current revision, so it never renders anywhere.** `closeMoves` and `forecast_close_date` are both correct, so the move itself is recorded; only its stated reason is lost, which is the half the dialogue exists to capture.

  **Confirmed pre-existing, not introduced by the rewire**: `payloadUpdate.notes` is line 460 in `HEAD` and line 460 now, and the diff shows no changed line touching `performGenericRefSave`. **Round 3's own evidence tested that cancelling preserves unrelated edits and never tested that confirming preserves the note**, which is the asymmetry that let it survive four rounds.

  **The attribution matters and is worth stating exactly. Round 3 Phase 3 proved that CANCELLING preserves unrelated edits, and never tested that CONFIRMING preserves the note.** Its evidence was written against the risk everyone could see, silent data loss on an abandoned dialogue, and the same Save click's other half went unexamined for four rounds. **A phase's confirmed status is only as good as what its evidence actually checked**, which this document already records at the round level; this is the same fault at the level of one assertion's blind side.

  **This is the same stale-snapshot shape already recorded for the Commercials tab in the 2026-08-15 real-use pass**: a screen that saves a whole form from state captured before another write silently reverts that write. That entry closed with "other fields on the Commercial tab's same whole-form save were not audited for the same risk and should not be assumed safe", and this is a second confirmed instance in a different file.

  **Not this round's scope. The fix is to `performGenericRefSave`'s note construction**, which is Opportunity's note storage, and Phase 3 was explicitly scoped not to change it. Carried as an open item so the fix is made for this reason rather than rediscovered as a new bug.

- **`payload_field_required` gained two optional series clauses, and they are an engine change written generally rather than a scoring one. Round 11 Phase 4.1.1, 2026-08-19.** The base test blocks only on `undefined`, `null` and `''`, so `[]` passes. A score series is an array and the empty series is its natural initial state, which means **an unscored criterion would open its own gate**.

  **`min_length` and `entry_stage_at_or_after` are both expressed in terms of the stored value, never in terms of what a score is**, because any payload field holding a series will want non-empty to mean non-empty and Round 12's field-change trail is the next one. **A rule carrying neither clause behaves exactly as before, by construction rather than by inspection**, so the 15 `contact` rules and the unlabelled date and duration rules are untouched. Proven by removing the clause from the same probe rule and watching `[]` pass again.

  **Key-absence was rejected as the mechanism** because it makes correctness depend on no renderer, no migration and no future write path ever initialising the key to `[]`, which is a discipline rather than a property. The write path still keeps the key absent; the clause is what makes the gate independent of that.

  **`entry_stage_at_or_after` compares by POSITION in the sort_order-ordered stage list, not by sort_order arithmetic** - the same deliberate departure Round 9 Phase 4A made for adjacency, so a stage list numbered 10, 20, 30 to leave room for insertions still behaves correctly.

  **Proven with the counterfactual stated first**, on a real injected rule that was then reverted: if the clause were not being read, `[]` would pass and the test would look identical to a correctly configured rule that happens to hold a score. Measured `[] -> blocks` and `[one entry] -> passes`, **and the two differing is the evidence**, not either result alone.

- **A re-score gate asks for a score recorded at or after a later stage, which is a different question from a score existing. Round 11 Phase 4.2, 2026-08-19.** `scoring_criteria.rescore_through_stage` records where a re-score is **permitted**; the gate rule records where one is **required**. Two homes, deliberately, for two genuinely different questions - the brief distinguishes them itself, and collapsing them would make "permitted" silently mean "required".

  **Proven against the real, mutating transition endpoint rather than the read-only one.** A Test Bed at Site Assessment holding Data Rights and Physical Suitability scores **stamped `stage: 'Qualification'`** satisfied `min_length` and was still refused, with the message naming the requirement: *"Requires Data Rights scored at or after Site Assessment"*. Re-scoring the same two criteria while the record sat at Site Assessment released both, leaving only the unrelated document and approval gates. **A stale qualification guess does not carry into installation, which is the entire point**, and Physical Suitability in particular exists to catch the site problem that is invisible at qualification and fatal on install day.

- **The measurability confirmation gates on the question being ANSWERED, not on the answer being yes, and that follows from "no thresholds anywhere". Round 11 Phase 4.3, 2026-08-19.** Confirmed with the business as a separate plain yes or no rather than folded into the 1 to 5, because either the sensors can capture what would be measured or they cannot and a 3 is not a meaningful answer.

  **A recorded "No" satisfies transition 1, confirmed with the business and deliberate.** Measured: `confirmed: false` returns 201 and the gate stops blocking.

  **The reasoning, because this is the case where it is least obvious.** The gate asks that the question be **answered**, not that the answer be yes. **Blocking a No would be a threshold in everything but name**, and it would sit on the one question where the honest answer matters most, so its real effect would be pressure to record Yes. **A recorded No is a visible, attributable decision with an author and a timestamp; a coerced Yes is invisible.** The framework is worth more with an honest No in it than with a Yes nobody believes, and a gate that manufactures the second while appearing to prevent the first is worse than no gate.

  **It is the second floor candidate, after Data Rights, and the two are the same shape.** Data Rights at 1 means the Test Bed cannot deliver its primary return to Terminus; measurability at No means the sensors cannot answer the question being asked. Both are **"this cannot deliver what it exists to deliver"**, which is a different kind of claim from "this scored low", and it is why they are the two candidates rather than the two lowest scores. Neither becomes a floor until there is evidence, per the round's own scope boundary.

  It is recorded with an author, server-written, through the same `appendPayloadSeriesEntry` helper a score uses rather than a second convention. Entitlement stays out of scope: this proves who confirmed it, not that they were entitled to.

- **A `select` inherits `width: 100%` from this stylesheet's base rule, so `flex: 0 0 auto` alone does nothing. Round 11 Phase 4, 2026-08-19.** The measurability control took the entire row and crushed every criterion name into one word per line, overlapping the value text. **Every programmatic assertion passed**: six rows rendered, the right values, the right entry counts, zero page errors, and the gate behaviour was entirely correct.

  **Only the screenshot showed it**, and the general form is worth stating plainly because it is not the usual version of this lesson. **Programmatic assertions verify that the right things are PRESENT, and presence is not legibility.** Every recorded instance until now was a check measuring the wrong thing, or a check gone stale, or a check satisfiable by old state. **This one measured exactly the right things and every answer was true.** Six correct rows, correct values, correct counts, correct gate behaviour, zero errors, no container overflow - in a panel nobody could read.

  There is no assertion that would have caught it as a by-product of checking correctness, because the panel WAS correct. Catching it needs a check aimed at legibility specifically, which is what the rendered-height-against-an-empirically-measured-single-line-baseline measurement is, and which nobody writes unless they already suspect the layout. **The screenshot is the only check that asks "is this usable" rather than "is this right", and those are different questions.**

  **This is the third instance of the Round 10 Phase 3 finding**: a `select` sizes to its own rules rather than to the space intended for it, and constraining the flex item is not the same as constraining the control. There the fix needed `flex: 1 1 auto; min-width: 0` on both the wrapper and the control to let it GROW; here it needed an explicit `width` to stop it growing. **The general form: `width: 100%` on the base `select` rule beats any flex sizing that does not set an explicit width**, and the measurement that catches it is the rendered name height against an empirically measured single-line baseline, not the container's overflow, which was false throughout.

- **Installer is a link to an Account, not a picklist, so client-installed versus contractor-installed becomes an observable fact. Round 11 Phase 5, 2026-08-19.** Confirmed with the business. Where the client installs with their own staff that is the Test Bed's own Account; where a contractor installs it is that contractor's Account. **`client_installed` is therefore computed, never stored**: it is simply whether `installer_account_id` equals `account_id`, so the two can never disagree the way a typed label and a link would.

  **A dedicated column, following the precedent this project set twice.** `account_id` exists on test_bed rather than reusing `parent_record_id` because that column already had one exclusive meaning, and `parent_account_id` exists for Account-to-Account for the same reason. This is a **second** account relationship on the same record, so overloading `account_id` would make it ambiguous to read back.

  **The conversion was greenfield and that was established by survey, not assumed.** Across all 154 Test Bed records: **zero live records** hold `installer` or `techTeam`, six soft-deleted probe fixtures hold synthetic `installer` values matching no Account name, and **`techTeam` has never held a value on any record**. So nothing needed mapping, which is the opposite of Round 10 Phase 3's Installation Environment case where a legacy value would have been silently cleared on the next save. **The survey is what distinguishes the two, and it cost one query.**

  **`POST /test-beds/:id/buyer-contacts` was left exactly as it is.** It refuses any Contact whose Account differs from the Test Bed's own, with a 422, and that check is what makes the three `contact_role_linked` gates on transition 1 mean anything: a Client Buyer who is not of the client's Account is not a client buyer. **Loosening it to accommodate this phase would have weakened three live gates to add one feature.** Phase 5 built its own path and reused the structure rather than the endpoint: a `record_contacts` row with a role, validated at save time, gated by `contact_role_linked`. What differs is which Account it validates against, which is one line rather than a new mechanism.

  **Changing the Installer clears an incompatible Tech Team, and says so.** Keeping the link would leave the gate satisfied by a Contact of an Account with nothing to do with the installation, which is exactly the integrity the buyer-contacts 422 protects. The removal is returned in the response as `cleared_tech_team` rather than done silently. Verified in both directions: the contractor's own Contact is then accepted, and the client's is refused.

- **`record_contacts` had no DELETE policy at all, so deletes returned zero rows and no error, and two endpoints I wrote believed them. Round 11 Phase 5, 2026-08-19.** The table has carried SELECT and INSERT policies since Milestone 3 and nothing else, so a delete through a user client is filtered by RLS to **zero affected rows with `error === null`**.

  **Two defects followed, both mine, both the recorded unchecked-write shape.** `PATCH /installer` checked the delete's `error`, found null, and **reported `cleared_tech_team` while the link was still there** - a response field asserting something that had not happened. And `POST /tech-team` replaced an existing link by deleting then inserting, so the delete removed nothing and **links accumulated**; two rows for the same `(record_id, role)` then made the `contact_role_linked` branch's own `.maybeSingle()` return an error, turning a working gate into a 500.

  **This is an EXTENSION of the recorded rule, not a fourth instance of it.** The existing entries all describe a write refused because of WHO was asking: a non-owner's update filtered to zero rows by an owner-scoped policy. **Here the caller genuinely was the owner and the operation was refused because no policy existed at all.** That is a different cause with an identical signature, which is the point.

  **`error === null` with zero rows affected cannot distinguish three different outcomes**: nothing matched the filter, the actor was not permitted, and no policy exists to permit anyone. All three are legitimate states of the database and all three return exactly the same thing. **The affected-row count carries what the error does not**, and it is the only signal that separates "this did nothing because there was nothing to do" from "this did nothing because it could not".

  **The compound chain, and the reason it is a distinct failure mode rather than a defect:**

      a missing DELETE policy      -> a delete that removes nothing and reports no error
      a no-op delete in replace    -> one link becomes two
      two rows for one (record, role) -> .maybeSingle() returns an error, not a row
      that error in the gate branch   -> 500 from the transition endpoint
      a 500 from the transition       -> a gate that cannot be evaluated

  **Every link is defensible on its own terms.** Declining to write a DELETE policy for a join table nothing deleted from is reasonable. RLS filtering rather than erroring is how RLS is specified to work. `.maybeSingle()` was the correct modifier for a table that could not then hold duplicates. Replace-then-insert is the ordinary way to enforce one-of-something. **Reviewing any single component finds nothing wrong, because nothing in any single component IS wrong.**

  **That is what separates this from a defect.** A defect is a component that fails its own contract and can be found by examining it. This is a set of components each meeting its contract, composed into a behaviour none of them describes, and the composition is not written down anywhere - so it survives review of every piece and appears only when the whole path is exercised. **The practical consequence: a chain like this can only be found by driving the real path end to end**, which is the same argument Round 9 Phase 5 made for completing a lifecycle rather than testing gates individually, arriving from a different direction.

  Fixed in both places by `.select()`ing the delete and asserting the row count, and by adding an owner-scoped DELETE policy, keyed on owning the parent record rather than on `created_by` so a record's owner can correct a link somebody else created.

- **A probe that reads only the response body treats a 500 as "nothing is blocking". Round 11 Phase 5, 2026-08-19.** The Phase 5 gate probe mapped `body.blocking ?? []` and asked whether any message matched. When the duplicate-link defect above turned the transition into a 500, the blocking array was absent, `[].some()` returned false, and the probe reported **"Tech Team gate blocking: false"** - which reads as the gate correctly releasing.

  **The status has to be asserted or an error masquerades as a pass, and the direction of this lie is the worst one available in this system.** A gate that blocks when it should not is visible immediately and annoying; **a gate that appears open when it is actually erroring is the failure this whole project's gate configuration exists to prevent**, and a probe that reports it as open is worse than no probe, because it supplies confidence. Every other recorded probe fault produced a wrong answer about a feature; this one produced a reassuring answer about the safety mechanism.

  Fixed by asserting the transition returns 422 or 200 and throwing otherwise. **It earned that immediately**: the very next run failed on a 401 from an expired token, which the previous version would have reported as every gate satisfied.

- **The Installation panel's Tech Team row is the third surface with the async-render shape, at 292ms. Round 11 Phase 5, 2026-08-19. Reported, not fixed here.** `renderTbTechTeamRow()` awaits `GET /api/contacts?account_id=` before it can render, so after the Installer changes the row briefly still names the person who was just cleared. Measured per animation frame from the moment the change is issued:

      installer row settled at   1165ms
      tech team row settled at   1457ms
      stale window                292ms

  **It does settle correctly**, so this is a latency shape rather than a defect, and it is materially shorter than Round 10A Phase 2's 650ms because the fetch is now filtered server-side to one Account rather than fetching every contact and filtering in the browser. **That is the same open item paying off partially**: the scaling problem behind the 650ms is halved for this one caller by the new `account_id` parameter, and untouched everywhere else.

  **Deliberately not fixed here**, per the standing decision that the pending-state pattern is a pass over every async renderer rather than a fix made panel by panel. **Third surface** after the stage panels and the buyer rows, which strengthens rather than changes that decision.

  **It caught me twice in one phase, which is the part worth recording.** My first probe waited on the feedback message, which `setTbInstaller` writes BEFORE awaiting the reload, so it read the pre-reload DOM. My second waited on the INSTALLER row naming the new Account, which settles 292ms before the tech team row does. **Both reported "still shows the old person" and both were the harness reading inside the stale window**, exactly the shape recorded across Round 10. The counterfactual settles both in one line: at the installer-settled moment the old person is on screen either way.

- **Retiring a free-text field for a real link is a removal, and the old renderer has to go with it. Round 11 Phase 5, 2026-08-19.** `installer` and `techTeam` were entries in `TB_INSTALL_FIELDS`, so `renderTbInstallSection` drew two ordinary click-to-edit rows for them. Leaving those in place beside the new controls would have put **an editable free-text copy of the same concept next to the real link**, which is the duplicate-Summary shape from Round 10 Phase 2 with the two copies disagreeing rather than merely repeating.

  **This is a CONVERSION rather than a removal, and the distinction changes what the risk is.** A removal leaves nothing behind and the failure is a stranded container, which is what Round 10 left twice. A conversion leaves a **second, still-functional copy of the same concept**, and the two then hold different values through different write paths: the free-text row would say "Bob's Electrical" while the link says an Account, both editable, both saved, neither marked as the real one.

  **That is worse than the duplicate Summary, and the reason is specific.** Two Summaries repeated the same value from the same payload key, so the fault was cosmetic until someone noticed. Two Installers would **disagree**, and there is no way to tell which one anyone meant: not from the data, not from the screen, and not from the audit trail, since both writes are legitimate. **A duplicate that repeats is untidy; a duplicate that diverges destroys the answer to the question the field exists to answer.**

  Both keys were removed from `TB_INSTALL_FIELDS` and from `TEST_BED_WRITABLE_KEYS` in the same change, so a `PATCH` naming either is now rejected rather than writing a value nothing reads. Verified by counting to zero in the browser: `#tb-display-installer` and `#tb-display-techTeam` are both absent.

- **A control that the server will refuse should not render as available. Round 11 Phase 5, 2026-08-19.** `POST /test-beds/:id/tech-team` returns 422 when no Installer is set, because a Tech Team has no Account to be validated against until there is one. **The UI does not render an empty select in that state** - it renders no control at all and says why: "Set the Installer first. The Tech Team is a person from the Installer's Account."

  **An empty dropdown is worse than an absent one**, because it looks operable and produces the refusal only after the user has tried, at which point the error explains a rule they had no way to know. The order is a real constraint in the data model, so the interface states it rather than enforcing it by rejection.

  **The same reasoning drives showing the clearing.** Changing the Installer removes a Tech Team belonging to the old Account, and the endpoint reports which link it removed so the browser can say so. Without that the row would simply empty and a gate satisfied a moment earlier would silently block again, with nothing on screen explaining why. **A silent consequence of a deliberate action is indistinguishable from a bug**, and the user is the only person who can act on the difference.

- **The fourth consumer of document records was found by sweeping, not by the investigation phase that was looking for exactly this. Round 11 Phase 6, 2026-08-19.** Phase 0 item 7 traced the document child shape and named three consumers: `completable_documents`, the Closed lifecycle panel, and `complete-document`'s existence check. **A `grep` for `record_type = 'document'` before building found a fourth: `transitions.js:166`, the `document_status` gate branch itself.**

  **What missing it would have cost, stated concretely because the abstraction understates it.** A Customer Document is named by a person. Nine catalogue names exist and nine `document_status` rules match on `variant` plus `status`. **A client-supplied file named `NDA` would have satisfied the NDA gate on transition 2** - a document nobody at Terminus reviewed releasing a gate that exists to prove somebody did.

  **That is the same outcome as Round 9 Phase 6.1, reached by a different route.** There, saving a working-copy URL approved a document because `complete-document` hardcoded `status = 'approved'`; the gate was satisfied **by status**. Here it would be satisfied **by naming**, with the status genuinely correct and the document genuinely present. Same failure, same gate, and no shared cause - which is why fixing the first did nothing to prevent the second.

  **The lesson is about the investigation rather than the code.** Phase 0 read the endpoints that PRODUCE and DISPLAY documents, because the question was "what is the document shape". It did not read the one that CONSUMES them as evidence, because that endpoint is a gate rather than a document endpoint and does not present itself as one. **A sweep by the thing itself, `record_type = 'document'`, found in one command what reading by feature area missed**, and it cost nothing.

- **A reader forgetting the `document_kind` filter cannot be caught by a data invariant, and that is an accepted weakness rather than a solved problem. Round 11 Phase 6, 2026-08-19.** The constraint added with the column protects against a **writer** omitting the kind. Nothing protects against a **reader** omitting the filter: a future query over a Test Bed's document children that does not say `document_kind = 'terminus'` silently includes Customer Documents, and there is no row anywhere whose contents are wrong.

  **This is a code property, not a data property, so it is not assertable in `config-invariants.test.mjs`**, which reads live configuration. The invariants this project relies on all work because the fault leaves a trace in the data; this one leaves none.

  **The protection is therefore discipline, and it is stated as such rather than dressed up.** All four call sites are changed in one commit and named in the migration's own comment, so anyone reading the schema change sees the complete list of places that had to know. **That is a mitigation, not a guarantee.** The honest position is that this is the same class as the `stage_reference_docs` and `stage_gate_rules` document-name coupling already recorded here, where two tables hold the same strings with nothing aligning them: a known, named, unautomatable seam.

  **What IS assertable, and is going into Phase 7:** no live document row may have a null `document_kind`. The constraint is `NOT VALID`, so it exempts every row that existed before it, and that exemption is a data property. A backfill that missed rows, or a legacy row resurfacing, is exactly the shape an invariant catches.

- **Round 11 Phase 6, 2026-08-19: Customer Documents ship with an explicit discriminator, and the constraint caught three writers on the day it landed.** `records.document_kind` holds `'terminus'` or `'customer'`, and **all four consumers read it positively** rather than excluding customer documents by absence. 344 existing documents backfilled to `'terminus'`, 0 nulls, 0 non-document rows carrying a kind.

  **The gate filter is the load-bearing one, and proving it required injecting a case the endpoint cannot produce.** The first probe compared the gate query with and without the filter and got 0 both times, because a Customer Document carries `status = 'received'` and the gate matches on `status = 'approved'` - so **the test could not distinguish the kind filter from the status difference**, and would have passed identically with no filter at all. Injecting a customer document at `variant: 'NDA', status: 'approved'`, which simulates any future path that does not hardcode the status, gave the discriminating result:

      matches WITHOUT the kind filter:  1     <- what the gate saw before Phase 6
      matches WITH the kind filter:     0
      the real evaluator still blocks:  true

  **Reverted afterwards, per rule 9. The general form, and it is sharper than the entries it sits beside: a check that passes for the wrong reason is indistinguishable from one that passes for the right reason.** No amount of re-reading either the check or the code separates them, because both are correct in isolation - the query is right, the filter is right, the result is right. **The only way to tell is to construct the case where the two reasons diverge**, and that case has to be built deliberately because nothing produces it by accident.

  **The divergent case was one the endpoint CANNOT produce, and that is the point rather than a caveat.** `POST /customer-documents` hardcodes `status: 'received'`, so no supported path can create a customer document at `approved`. It would have been entirely reasonable to call the filter untestable on that basis and move on. **But the filter does not exist for the write path that exists; it exists for the one that does not yet.** A restore, a bulk import, a second endpoint, a future status change - Architecture rule 8 in its own words, a path correct for every caller it has meeting a caller that has not been built. **A protection written for a hypothetical write path can only be proven by simulating that write path**, and declining to simulate it means shipping the protection untested precisely where it matters.

  **`status = 'received'`, not `'approved'` or `'draft'`.** These documents gate nothing, so a status borrowed from the approval vocabulary would be a claim about a review that never happens. `records.status` is plain `text` with no CHECK, confirmed against the DDL and then against a real stored row rather than only read.

  **The name is not an identifier here**, unlike `complete-document`, which upserts by `(parent, variant)`. Customer Documents are named by a person, so two files genuinely called "Site drawings rev C" are two documents: each POST creates a row and the row id addresses it. Verified: two rows share a name and both survive.

- **A fixed destructure is a quiet allowlist, and it silently discarded the column that had just been made mandatory. Round 11 Phase 6, 2026-08-19.** The `document_kind` CHECK constraint immediately failed three `gates.test.mjs` fixtures, which is the writer-side protection working exactly as designed and is worth recording as such rather than as an inconvenience.

  **The first fix did not work, and the reason is the finding.** `document_kind: 'terminus'` was added to all three fixture calls and the suite failed identically. `Fixtures.createRecord({ record_type, status, variant, parent_record_id, owner_id })` **destructures a fixed key set and builds its insert from those names only**, so the new key was accepted by the call, dropped by the function, and never reached the database. Nothing errored, nothing warned, and the failure message was byte-identical before and after a change that looked correct.

  **The general shape, now promoted to `CLAUDE.md` under Architecture: a destructuring parameter list is an allowlist that gives no feedback when it excludes something.** An options object **reads as open-ended at the call site and is closed at the definition**, and the two are far enough apart that the caller has no way to see it. Adding a key is a silent no-op.

  **The diagnostic signature is the part worth remembering: the suite failed BYTE-IDENTICALLY after a change that looked correct.** Not a different error, not a new line number, not a partial improvement - the same three tests, the same constraint name, the same message. That reads as "the fix did not address the cause", which sends the next hour into re-examining the constraint, and the constraint was never the problem. **A change that produces no change at all in the failure output is evidence the change never reached the code path**, and that is a cheaper hypothesis to test than any theory about the failure itself.

  Same family as the recorded render call sites that hardcoded their own `opts` instead of spreading the field definition, and it fails the same way: **the definition looks like the source of truth and the call site quietly ignores it.**

- **A brief specifying a grid position specifies it at one viewport, and either the brief names which or the implementation picks flow. Round 11 Phase 6, 2026-08-19.** The brief placed Customer Documents "to the right of Terminus Details and below the Customer Details, Site Details and Key Dates panels". In a responsive `auto-fit` grid that describes **one** arrangement: at 1920 the four existing cards fill row 1 and the new one lands at row 2, column 2, which is exactly what was asked.

  **At the other two tested widths the same words describe nothing.** At 1240 the grid is two columns, so "to the right of Terminus Details" is where Customer Details already is; at 3440 all five cards fit one row and there is no "below" at all. Forcing the 1920 arrangement with an explicit `grid-column` would hold it at one width and push the card out of flow at the others.

  **The implementation used the natural flow position and reported where it actually lands at each width**, rather than claiming the brief was met everywhere when it was met at one. Recorded as a general point rather than an issue with this brief: **a position in a reflowing layout is a function of viewport, so a brief that names a position is implicitly naming a viewport too, and it is worth saying which.** Absent that, flow is the right default, because it is the only choice that degrades predictably.

- **Round 11 Phase 7, 2026-08-19: four configuration invariants and one stylesheet invariant, each proven capable of failing against a real row.** `npm run test:db` goes 35 to 38, `npm test` 22 to 23.

  **Invariant 8, criteria named by gate rules.** The same shape as invariant 4, which closed the gap where `stage_gate_rules` and `stage_reference_docs` held document names as independent free strings. Here it is `requirement_detail.field` against `scoring_criteria.criterion_key`, and **the failure is worse than a mismatch: a gate naming a criterion that does not exist blocks on a field nothing can ever write**, so the transition is unsatisfiable from inside the product. Anchors are asserted too, because a criterion with no anchors is scoreable in principle and refused in practice, `POST /scores` returning 409. Proven in **both** its cases: a phantom criterion, and a real criterion with no anchor rows.

  **Invariant 9, stored scores against anchor versions.** Amended before it was written, because the obvious phrasing fails on legitimate data: anchors exist for 1, 3 and 5 only, so asserting a row for the exact score would report every genuine 2 and 4 as an orphan. **The referent is the version, and completeness is derived from the data** rather than assumed to be `{1,3,5}`, so giving 2 or 4 real wording later needs no change to the test.

  **Invariant 10, live documents with no `document_kind`.** The one that could not be proven without dropping the constraint, and the reason is the point: an INSERT without a kind is refused and an UPDATE to null is refused, **both confirmed directly**, so a live null-kind row is unreachable by any supported write. That is exactly why the invariant exists - the rows it protects against are reachable only by having been written when no constraint existed, which is what `NOT VALID` permanently exempts. **Reproduced rather than approximated**, using the temp-drop-then-restore migration pattern this repo already established twice (`20260815000009/10`, `20260815000013/14`). Restoration confirmed as real **enforcement** rather than presence, by a genuine rejected insert afterwards.

- **The stylesheet invariant caught a live two-round-old defect on its first run, which is the best possible argument for encoding a check rather than remembering it. Round 11 Phase 7, 2026-08-19.** It was written before the `var(--line)` instances were fixed, deliberately, so its first execution ran against the real fault:

      ✖ every custom property used in style.css is defined in it
        --line  line 2595  border-bottom: 1px solid var(--line);
        --line  line 2643  border-bottom: 1px solid var(--line);

  **Round 9 Phase 6 introduced them. Round 10 Phase 7 found this exact fault in its own new block, fixed that block, and did not sweep the file.** They then survived two further rounds of screenshots, because rows running together reads as a design choice: **opening the screenshot catches what looks wrong, not what looks deliberate.**

  **It lives in `npm test`, not `npm run test:db`**, and the placement is a decision rather than a convenience. It reads a file: no database, no credentials, no fixtures, no teardown. **A check that requires a live database to run is a check that gets skipped** - on a fresh checkout, in a hook, by anyone without `.env`, and by every future session that reaches for the fast suite because the slow one takes 28 seconds. This one costs milliseconds and has no reason to be gated behind any of that. **The general rule: put a check in the cheapest suite that can run it, because the real failure mode of a good check is not being run.**

  **`var(--x, fallback)` is deliberately excluded, and the reason generalises past CSS.** A reference carrying a fallback is well defined whether or not the token exists, which is the entire purpose of the syntax, so flagging it would report correct code as broken. **A check that cries wolf does not merely waste attention, it takes its own genuine coverage down with it**: once readers learn that some of its output is noise they stop reading the output, and the real finding arrives in a list nobody opens. Precision is not politeness in an assertion, it is what keeps the assertion readable enough to act on.


- **The temp-drop-then-restore migration pattern is now on its third use, and a fourth would make it a mechanism rather than a habit. Round 11 Phase 7, 2026-08-19.** Three instances, each forcing a real failure rather than reasoning about one:

      20260815000009/10   temporarily block record_revisions select
      20260815000013/14   temporarily drop the audit_log FK
      20260819000014/15   temporarily drop records_document_kind_required

  **The cost is two permanent ledger entries for a temporary condition**, which is worth paying here and is worth naming rather than absorbing. The migration list is the configuration changelog, and entries that exist only to have been undone dilute it: a future reader scanning 47 migrations for what the schema does now has to read two that describe a state that lasted minutes.

  **It is the right trade at three.** The alternative was proving invariant 10 by argument, and the standing rule is explicit that an invariant not proven capable of failing is not evidence. The violating state was **unreachable by any supported write** - an INSERT without a kind refused, an UPDATE to null refused, both confirmed - so reproducing the pre-constraint condition was the only route to a real failure.

  **If it recurs a fourth time it is a candidate for a test-only mechanism instead**: a suite that can drop and restore a constraint within its own transaction, or a fixture helper that does it around the assertion, leaving the ledger untouched. Recorded now, at three, so the fourth session recognises the threshold rather than adding a fifth pair and then noticing.
- **THE AMBIGUOUS ANCHORS, verbatim. Round 11 Phase 8, 2026-08-19. This list is the main output of the phase and the input to the business review, and it is recorded unparaphrased on purpose.** An anchor that caused hesitation is a finding, not a failure: the wording is provisional and stored as rows precisely so review changes data rather than a build.

  One Test Bed was driven from Qualification to Monitoring and Analysis, scoring all five criteria at qualification and re-scoring all three re-scoreable ones at their own later gates. The engagement was written down BEFORE scoring, so the scores were applied to facts rather than chosen and justified afterwards: a borough council air-quality Test Bed, six sensors, a bus gate that went live four months ago.

  **1. Rollout Path 5 is a conjunction of four conditions with no guidance on partial satisfaction.** Three and a half of the four were met: a defined rollout ("the other three corridors"), a budget route (Cabinet, March), a timeframe. The fourth, "the client has stated the Test Bed is the step toward that decision", was not - the sponsor said "if it shows something we'd want it on the other three corridors", which is close and not the same. **The 3 anchor was actively wrong** ("no defined scope or scale", "budget route is not identified"), so the choice was between a 5 that overstates and a 3 that misdescribes. Recorded a 4 because 2 and 4 are "between these", but **"between" implies a point on a line and this is a set of independent conditions where one is absent.**

  **2. Rollout Path 5: "A budget route for it is identified and its holder known."** The holder here is a committee, not a person. In local government the holder is almost always a committee. **The anchor does not say whether a committee counts**, and this will recur on every public-sector engagement.

  **3. Client Commitment: the 3 and 5 anchors were each false in their distinguishing clause.** Three client people were named across three functions, so 3's "nobody is named" is false; site access had no dates in writing, so 5's "confirmed in writing" is false. **Neither anchor described the situation** and a 4 was recorded because it is between, not because anything supported it.

  **4. Client Commitment 5: "A named executive sponsor with budget or site authority."** "Executive sponsor" reads as director level; the real sponsor was a Head of Environment holding a budget line. **The anchor does not say whether seniority or authority is the test.** If authority, she qualifies outright. If title, she may not. These give different scores.

  **5. Clear Use Case Requirements and Metrics: there is no language for a condition that is definitively IMPOSSIBLE rather than unknown.** The client question was specific and in their own terms, Terminus knew what to measure, and the sensors could capture it - three of the 5 anchor's four conditions fully met. The fourth failed absolutely: the bus gate went live four months ago, so no baseline exists and **none can now be captured**. The 3 anchor offers "or the baseline position is unclear", and unclear is strictly weaker than impossible, so it **understates** the problem; the 1 anchor is plainly wrong. Scored 3 with the least confidence of the five. **This is the sharpest of the eight**, because the anchors treat the baseline as a matter of knowledge and this case is a matter of fact.

  **6. Physical Suitability 5 describes an INPUT where the distinguishing act is an assessment.** "A Terminus technical person has assessed the site, in person or from client-supplied drawings and photographs." Drawings and photographs had been supplied and nobody at Terminus had looked at them. **On a fast read, "we have photographs" satisfies it**; the load-bearing words are "has assessed", and they are easy to skip past because the sentence ends with the artefacts.

  **7. Physical Suitability: power was confirmed at four of six positions, by the CLIENT rather than by Terminus.** The 3 anchor says power "is assumed rather than confirmed". Ours was confirmed, partially, by the wrong party. **The anchors have no vocabulary for partial coverage or for who did the confirming**, both of which are ordinary in practice.

  **8. Data Rights 3 offers two branches and the real case was a third.** Its branches are "assumed by both parties but has not been discussed explicitly" and "agreed by someone without authority". The real case was **discussed explicitly, not yet agreed, authority unknown** - better than both branches, since a real conversation had happened, and described by neither. Scored 3 for want of anywhere better.

  **9. Data Rights: the `asks` and the anchors measure different things, and the gap is a DRIFT rather than an error. Added Round 13 Phase 3, 2026-08-20, from a code read rather than from the walkthrough, which is why it is numbered after the eight rather than among them.**

  The `asks` states **intent**: "Is it worth doing for Terminus". That was deliberate. **Data Rights is the only one of the five that measures value to Terminus rather than value to the client**, and on a cost-only programme, where no client billing exists anywhere in the model, the data is a substantial part of what Terminus gets back. The question is doing real work.

  The anchors measure the **mechanism**: whether the client has confirmed Terminus may retain and use the data, whether the person confirming had authority, whether restrictions on use, retention and publication are stated and acceptable, and where personal data is involved whether the client's own basis for sharing is identified. Permission is necessary for the value and is not the same as the value: a client may grant unrestricted rights to data that is worth little, and may hedge rights on data that is worth a great deal.

  **Two defensible resolutions, and neither is a build decision.** Either the `asks` narrows to match the anchors, which makes the criterion a permission check and needs a name and question that say so. Or the anchors widen to measure worth, which makes it a materially different criterion, and one that would have to say what "worth" is assessed against on a programme with no revenue line. The first is a wording change; the second is a framework change of the same kind as the structural finding below.

  **The wording is NOT amended here, deliberately.** The rows are provisional by design and the business review is what changes them. Amending them now would substitute a build-time judgement for the review the framework was built to receive, and the whole point of storing anchors as data was that review changes rows rather than a build.

- **The structural finding: every 5 anchor is a conjunction of independent conditions, and "between these" cannot carry a gap that is not one dimension. Round 11 Phase 8, 2026-08-19. This is the round's main output.**

  **It is a design point, not a wording problem, and it is stated separately from the eight instances for that reason.** Fixing any individual anchor's phrasing would not touch it. Confirmed by the business as a design error in the framework rather than a fault in any one row.

  **The shape.** Each 5 anchor names three or four conditions joined by implicit AND: a defined rollout AND an identified budget route AND a timeframe AND a stated intent; an executive sponsor AND dates in writing AND named people AND support beyond the sponsor. **The 1 and 3 anchors do the same.** So each criterion is not a scale but a set of independent axes collapsed onto one number.

  **Why that breaks in use rather than in principle.** Real engagements satisfy MOST conditions of the 5 and fail one, which is exactly what happened on four of the five criteria in the walkthrough. The anchors describe the endpoints precisely and say nothing about the middle, **and the middle is where every real case sits**. The scale then offers 2 and 4 as "between these", which works when the gap is one dimension and does not when the gap is "three of four conditions met, and which one is missing changes what the score means".

  **The concrete cost, measured rather than asserted.** On Rollout Path the 5 was three-and-a-half of four and the 3 was actively false, so both anchors were wrong in opposite directions and the 4 was chosen because it is between, not because anything supported it. On Client Commitment both anchors were false in their own distinguishing clause. **A score chosen because no anchor fits is not an anchored score**, and the framework's stated purpose is that a good anchor can be checked by asking a question with a yes or no answer.

  **What the review might consider, offered as options rather than a recommendation**, since the business owns this: scoring the conditions individually and deriving the number; naming which condition is load-bearing at each level so a partial match has a rule; or giving 2 and 4 real wording so the middle is described rather than interpolated. **All three are row changes, not build changes**, which is the design decision that has held up.

- **Data Rights' question does not describe what its anchors measure. Round 13 Phase 3, 2026-08-20. Reported, not changed.**

  **The `asks` value is "Is it worth doing for Terminus".** The other four questions each describe their own criterion directly: does a suitable rollout path exist, will the client organisation genuinely engage, can it be proven, can it be installed. This one describes commercial worth.

  **The anchors it labels measure something else entirely**, and they are unambiguous about it: whether the client has confirmed Terminus may retain and use the data, whether the person confirming had authority to grant it, whether restrictions on use, retention and publication are stated and acceptable, and where personal data is involved whether the client's own basis for sharing is identified. Nothing in any of the three anchors concerns whether the engagement is worth doing.

  **A hypothesis about how it got there, REFUTED the same round and kept visible rather than deleted.** It read: Round 11 Phase 1 retired `exitQualTechnicalCommercialValue`, "Technical and Commercial Value", and split `exitQualDataAndUseCase` into two, so a commercial-worth question surviving onto one of the replacements is the obvious explanation. **It is wrong.** The business confirmed the wording was deliberate: Data Rights is the only criterion measuring value to Terminus rather than to the client, and on a cost-only programme the data is a substantial part of the return. **The framing above is therefore also wrong in its emphasis**, and item 9 of the ambiguous-anchor list carries the corrected version: this is a drift between a question about intent and anchors about mechanism, not a stray label. Left here because a plausible reconstruction that turned out to be false is worth seeing struck, and because it is a reminder that "the obvious explanation" for a value nobody has been asked about is a guess wearing evidence's clothes.

  **Proposed wording, for the business to accept or reject:** "May Terminus use the data". It matches the register and length of the other four, and it is the question the three anchors actually discriminate on. A fuller alternative, if the authority clause is felt to be load-bearing rather than a detail of the anchors: "May Terminus use the data, and has the right person agreed".

  **Not edited, and the proposal is now one of two options rather than a recommendation.** Narrowing the `asks` is only correct if the criterion is meant to be a permission check; widening the anchors is correct if it is meant to measure worth. The business owns that choice and it is recorded as item 9 of the review list. The round's scope was one row edit, confirmed, and this is a second.

- **The first cross-field rule: Est. Go Live cannot precede Estimated Installation Date, and the three cases were decided rather than left to fall out. Round 15 Phase 1, 2026-08-20.**

  Every other validation in this application checks one key against itself. This is the first that relates two, and relating two is what makes the edit-lock hazard live rather than theoretical.

  **Case 1, only one of the two set: no violation.** The rule describes a relationship, and with one value absent there is no relationship to break. Proven on three genuinely fresh records rather than on one record edited twice, because the first version of that check set the installation date in its own first step and then tested the second date against it, which is a case-2 test wearing a case-1 label.

  **Case 2, the violation from the other end: refused.** Moving the installation date later than a stored go-live date is the same violation approached backwards, and a check reading only the submitted key would miss it. So the check reads the merged VALUES once it has decided to run.

  **Case 3, records that already violate: they stay saveable.** Surveyed before building, across all 234 test_bed records paged: 28 carry both dates, **2 violate, one of them live**. So this was not hypothetical. The guard is on the SUBMITTED KEYS, `if ('estimatedInstallationDate' in payload || 'estGoLiveDate' in payload)`, following the shape the two existing date checks already use rather than inventing one. A save touching neither date is never checked, so an unrelated edit on a violating record still succeeds, proven from the browser as well as from the API.

  **An edit that touches a date is required to leave the pair valid, and that is not a trap:** either date can be moved to resolve it, and both routes out were tested.

  **The client bound is native, not a second mechanism.** `min` on go-live is the later of today and the stored installation date; `max` on installation is the stored go-live date. That is the same browser-level-plus-server split `noPast` already uses. A user editing both in one batch gets no client bound for the pair and is caught by the server, which is the affordance-versus-guarantee division this project already draws.

  **The message names labels, and the nine that do not are a separate item.** This message says "Est. Go Live cannot be before Estimated Installation Date". The two checks immediately above it name payload keys, and so do seven others across `test-beds.js` and `opportunities.js`, with no server-side key-to-label map anywhere. **Fixing the two adjacent ones would fix two of nine and leave seven**, which is Build discipline 8 pointing at a partial fix rather than away from one.

- **The hover popups size to their content: a deliberate partial reversal of Round 6 Phase 1. Round 14 Phase 3, 2026-08-20.**

  **Round 6 Phase 1's reasoning is left in place in the stylesheet rather than deleted, because that fix solved a real problem and this one modifies it rather than refuting it.** It added `white-space: nowrap`, `overflow: hidden` and `text-overflow: ellipsis` to `.linked-record-row`, plus a bounded `max-width` on the popup containers, to stop long names wrapping to three lines. Both halves were needed: nowrap alone stops wrapping, and without a width limit there is nothing for the ellipsis to truncate against.

  **The cost it created, from the business's own screenshot and then measured.** Two Test Beds under one Account rendered identically, because the part being cut is the `(2)` and `(3)` suffix that is the only thing telling them apart. Phase 0 measured it at 1240, 1920 and 3440: two rows, **one distinct visible string**. The popup listed two records and identified neither.

  **The lever is the container cap, not the row class, and the fourth surface is what establishes that.** `.linked-record-row` is also used by the linked-records modal, which sets no width bound and has no reported problem. Changing the row class would reach the modal; changing the container caps reaches exactly the three popups. **Single-line is kept**, so nothing Round 6 fixed comes back, and beyond the new ceiling the ellipsis still does its original job.

  **Three containers, not the two Round 6 recorded.** `.contact-count-popup` and `.tb-matrix-popup` at 280px, and `.chevron-popup` at 320px, which was added in Round 7 Phase 9 after Round 6's record was written and inherited the treatment without inheriting the note. **A record of which callers exist ages the moment a caller is added**, which is build-discipline rule 6 arriving from the documentation side rather than the code side.

  **The ceiling is a guard, not a layout choice:** `width: max-content` with `max-width: min(720px, calc(100vw - 48px))`, so the popup fits its longest row and a single absurd name cannot produce one wider than the window.

- **The sticky region is the tab row alone, and its cost is not constant. Round 13 Phase 5, 2026-08-20.**

  **Option A, confirmed with the business.** Not the workflow chevron, not the Test Bed name, not Summary. The tab row is the smallest thing that answers "where am I and how do I get elsewhere"; the chevron and the name are checked on arrival rather than continuously. **Every pixel made permanently sticky is a pixel taken from every long tab forever**, and Round 10 Phase 2 cut the header from 346px to 145px specifically to recover height. **Adding to the sticky region later is cheap; removing from it once people rely on it is not**, which is the whole reason for choosing the smallest version first.

  **The cost is largest where height is scarcest, because the row wraps.** Measured: 119px at 1240, 82px at 1920, 45px at 3440, which against realistic viewport heights is 14.9%, 7.6% and 3.1%.

  **The breakdown matters more than the total, and it locates the real lever.** At 1240 the tab buttons take 71px over two lines and the action group takes a further 34px on a line of its own; at 1920 the buttons take 34px on one line and the action group again takes 34px on its own line. So **the action group costs a full extra line at both of the widths people actually work at**, and removing it from the sticky region would save about 38px at each, more than any width threshold would.

  **The action group stays sticky, confirmed.** Round 7 Phase 6 put Next Stage, Cancel and Save Changes inside `#tb-detail-tabs` so they would pin right, so making that element sticky makes those actions sticky too. That was raised as possibly exceeding "the tab row alone" and **confirmed as intended**: the placement was deliberate, and a sticky Save is newly valuable rather than incidental, because Phase 1 and Phase 2 together mean a user working down five criteria now carries unsaved state the whole way. **119px at 1240 is accepted, at 15% of the viewport**, with the action group's own line named as the lever to reach for first if it grates in use.

  **Trim what sticks rather than disable it by width.** The width-threshold fallback was named in the brief and is the weaker option: it removes navigation help at exactly the width where wrapping makes navigation hardest, while saving less than dropping the action line would.

  **No new scroll context is created, and that was checked rather than assumed.** `.app-shell-flex` is `height: 100vh` with `overflow: hidden` and `.app-content-scroll` is the scroll container, so the body does not scroll and `top: 0` resolves against that container. There is no `overflow`, `transform`, `filter` or `contain` ancestor between the row and that scroller, any one of which would make `position: sticky` silently do nothing.

- **The Reference layout: two growing panels get their own row, and the scores summary does not join them. Round 13 Phase 6, 2026-08-20.**

  **The rejected alternative is recorded first, because a future round will otherwise restore it for tidiness.** The business proposed Use Cases and Customer Documents as their own wider panels with the scores summary in a left-hand column beside them. **A fixed five-row card beside two panels that grow indefinitely produces a short card next to a long one and a large dead area beneath it**, which is the dead-space failure mode already fixed three times in this project. The scores summary stays in the card row, where it is also read at the same moment as the four detail cards; Use Cases and Customer Documents are worked with once you are already in the record.

  **Why these two can sit side by side when the scores card could not.** Both grow, so which of them is taller varies by record and neither is permanently short. Measured both ways on purpose: with 24 use cases against 8 documents the panels are 1639px and 674px, and with 2 use cases against 20 documents they are 192px and 1328px. `align-items: start` is what makes that true rather than hoped for, since each panel then sizes to its own content instead of stretching to match the other.

  **A restructure, not a reorder.** Use Cases was a full-width section outside the grid, put there by Round 6 Phase 3 to sit beside Summary; Summary moved to the header in Round 10A Phase 1 and left it standing alone. Customer Documents was a 420px card inside the grid. Both moved.

  **Row 1 still wraps at 1920 and is deliberately not forced flat.** Five cards at 420px need roughly 2160px against a 1556px grid. Narrowing the cap to fit five across would reintroduce exactly the truncation Round 6 Phase 2 fixed, so the cap stays at 420px and the row wraps. Row counts are unchanged at 3, 2 and 1 across the three widths despite losing a card, because Customer Details spans two columns.

- **OPEN: the scoring panel is too tall for its own explanations, and this is now the second thing pointing at it. Round 13 Phase 5, 2026-08-20.**

  **Phase 1's lock note renders at the top of the scoring panel**, saying which criterion is holding up further entry. Working down to the fifth criterion scrolls it out of view entirely: measured at minus 509px at 1240, which is above the viewport rather than behind the sticky row. The lock still functions and the comment field is still marked, so nobody is stranded; what is lost is the explanation of why the other controls are disabled.

  **The first thing pointing here was the scrolling scoring panel request**, parked at the head of this round as superseded by the sticky tab row. It is not superseded by it: the sticky row solves "where am I in the record" and this is "the panel is taller than the decisions it contains". **Two independent observations now land on the same surface**, which is worth more than either on its own and is the reason this is recorded rather than fixed in passing. A per-criterion notice, a shorter panel, and a second sticky region inside the panel are all candidates, and choosing between them is a design decision rather than a build one.

- **The score dropdown stays where it is, and the reason it cannot simply be moved is a browser constraint rather than a layout preference. Round 13 Phase 4, 2026-08-20. Offered and declined by the business. No code changed.**

  **Recorded so a later round does not rediscover it as an unaddressed defect.** The observation is real and will be made again by anyone who opens the panel: choosing a score covers the anchor text the score is supposed to be chosen against.

  **The constraint.** The control is a native `select`. Its open list is rendered by the browser in its own popup layer, above the page, and **the position of that list is not controllable from CSS or from script**: it is placed by the browser relative to the control, and it will overlay whatever sits below it. So the overlap is not a consequence of where the anchors were put and cannot be fixed by adjusting spacing, z-index or stacking context. The only structural fix is to move the control so that what it covers does not matter.

  **What was offered.** Move the select below the anchor list, so the list opens over content already read rather than over the wording being consulted. **Declined by the business**, who looked at it and preferred the current arrangement.

  **Why the decision is worth having in writing rather than the observation.** The alternatives left, should it be raised again, are a non-native control, which means owning keyboard interaction, focus and accessibility that the native element provides for free, or a layout in which the anchors sit above the control. Both are real changes with real costs, and neither is a tidy-up. **A phase that ships no diff is still a phase**, per Round 11A, and the output here is that the next person to notice the overlap finds a decision rather than a bug.

- **Pending is a different mark, not an early tick, and the failure path is what the distinction is for. Round 13 Phase 2, 2026-08-20.**

  **An ordinary tick was rejected, and the reason decides every future case of showing unsaved state.** A tick that means "the server has recorded this" in one moment and "you have chosen this and not saved it" in another is a screen that lies, and Round 11A's fault was precisely a screen state that did not match the server. So an unsaved score gets its own mark: a filled dot rather than a check, a dashed rather than solid border, and the word "unsaved" on the row. **Three distinctions, none of them colour**, confirmed by taking the screenshot again under `grayscale(1)` and reading it.

  **The guarantee is structural rather than careful.** Each row carries `data-met`, written only by the render and only from the server's own `met`. The function that applies pending marks returns early on any row where that is `true`, so there is no path in it that can produce a confirmed tick. Asserted directly rather than by inspection: every tick on screen was cross-checked against a fresh `/exit-criteria` call in all four states, including immediately after a failure, and both directions were checked, ticks without server confirmation and server-confirmed rows not ticked.

  **The failure path is the half a happy-path driver never reaches**, and it was driven with a real server refusal rather than a simulated one: Phase 1's comment rule, with Phase 1's own client guard neutralised for the run. The mark did not promote, and the server held zero entries for that criterion.

- **Round 11A's recorded partial-failure behaviour is wrong about what survives, found while verifying something else. Round 13 Phase 2, 2026-08-20.**

  **The claim was "a recorded score stands; the first failure stops everything including the ordinary fields; everything unrecorded stays dirty".** The first two halves are correct. **The third is false.** `recordTbScores` calls `loadTestBedDetail` on its failure branch before returning, and loading a record resets `tbEdits`, so every unrecorded draft is discarded rather than left dirty.

  **Measured, not reasoned about.** Three criteria entered, the failing one in the middle: before the save the drafts were Rollout Path 4, Physical Suitability 2, Data Rights 5; after it `tbEdits` was `{}` and all three selects had returned to their empty state. Rollout Path was recorded, so the user keeps that one; **the valid 5 they entered for Data Rights is gone from the form and must be retyped**, with nothing on screen saying so.

  **Left as a finding rather than fixed, and the exposure is much smaller than it was.** Phase 1 makes the comment case unreachable from the browser, which was the only common route to a partial failure. What remains is a cancelled revision reason, a network failure, or a concurrent change. Recorded because a close-out that describes behaviour the code does not have is worse than no description: the next person reasons from it.

- **Test Bed creation reaches the naming dialogue from every browser path, and two server branches are not covered by that. Round 13 Phase 0, 2026-08-20.**

  **Recorded because the business reported a fault here and then withdrew it, and the withdrawal closes their report rather than the question.** They said creating a Test Bed named it after the Company with no chance to edit, then corrected themselves that renaming works.

  **The browser answer is clean, established by driving both paths rather than by reading them.** There are two entry points, the Contacts list hover "+ Create" dropdown and the Contact detail page's own Test Bed button, and both open the dialogue with the suffixed default pre-filled and fully pre-selected. Both funnel through one choke point, `startCreateFromContact`, which for a Test Bed always opens the dialogue; the duplicate-record warning routes into the same function via `onProceed`, and the dialogue refuses a blank name, so clearing the field cannot bypass it either. **One choke point is why this is safe, and it is worth naming as the reason rather than the coincidence.**

  **Two server-side branches sit outside that guarantee, and this is Architecture rule 8 in its exact form: correct for every caller that exists.**

  - `POST /contacts/:id/create-test-bed` treats `name` as optional and, when it is absent, silently applies the suffixed default. That branch is deliberate and documented, kept so existing tests and direct API callers keep the pre-Round-10 behaviour. It is also the branch a future caller inherits without knowing the dialogue exists.
  - `POST /test-beds` requires a name, and **has no browser caller at all**. It cannot produce an unnamed record, so it is not a naming risk; it is a second creation endpoint that nothing in the product exercises.

  **Recorded, not fixed.** Nothing is broken today and no phase of Round 13 depends on it. The value of the record is that the next person to add a creation path meets this note rather than the fault, which is the whole point of rule 8.

- **The framing for the business review, and the measurement that earns it. Round 12, 2026-08-20.**

  **The instrument makes its own gap legible, and no row edit closes it.** Rendering the anchors at the point of scoring was built to answer "I am scoring blind", and it did something the walkthrough could only argue: it put the gap on screen, permanently, for every person who scores anything from now on. A scorer looking at Rollout Path sees a 5 asking for four things at once and, directly above it, a 4 that is blank.

  **Measured from the rows rather than asserted.** A 5 anchor averages **3.4 sentences across the five criteria**, each an independent condition a real engagement can satisfy or fail on its own: 4, 4, 3, 3 and 3. **Scores 2 and 4 have no wording at any version**, which the count confirms directly: 15 anchor rows, one version, scores 1, 3 and 5 only.

  **This sharpens the closing line of the structural finding above rather than contradicting it.** That entry ends "all three are row changes, not build changes, which is the design decision that has held up", and that remains true about the MECHANISM: anchors are rows, so wording is cheap to change, and the framework does not need rebuilding to fix it. **What the measurement adds is that cheapness of change is not the same as the change being a wording change.** This is not a wording problem. **A scale whose middle is empty is not fixed by rewriting its ends**, so of the three options offered above, the first two change what the scale IS and only the third is wording, and the third is the one that fills the middle rather than improving the endpoints.

- **The measurability binary was answered instantly while every 1 to 5 scale caused hesitation, and that supports keeping it separate for a reason opposite to the one that produced the decision. Round 11 Phase 8, 2026-08-19.**

  **The original reasoning was about the question's nature**: either the sensors can capture what would be measured or they cannot, a 3 is not a meaningful answer, so it is not scored. That is an argument from the shape of the question.

  **The walkthrough produced an argument from use, pointing the same way.** Eight hesitations were recorded across five scored criteria, and **zero on the confirmation**. It was answered without pausing, in the same session, by the same person, against the same engagement. **The thing that was easy was the thing with no scale**, and the things that were hard were the things whose anchors are conjunctions.

  **Worth recording because the two arguments are independent.** A decision defended only by the reasoning that produced it is defended once; this one now has evidence from a source that could have contradicted it and did not. It also sharpens the structural finding above: the difficulty was not in judging the engagement, which was the same engagement throughout, **it was in mapping a judgement onto a scale whose endpoints are compound and whose middle is undescribed.**

- **Round 11A, 2026-08-19: `.find()` where `.filter()` was meant, and it cost the business four-fifths of a save. The fault is one character of intent and the shape is worth more than the fix.**

  `saveTbFields` intercepted scores with `dirtyEntries.find(...)`, took **one**, and passed every other dirty entry to `saveTbDirtyEntries`, which PATCHes them as ordinary payload fields. **The score keys are deliberately absent from `TEST_BED_WRITABLE_KEYS`** - that absence is what makes the series append-only - so the PATCH was rejected with "payload contains fields that cannot be set from this endpoint", **and it took any unrelated dirty field down with it.**

  **Round 11 never exercised it.** Phase 8 drove a full end-to-end walkthrough, scored all five criteria, re-scored three, and passed. Its `score()` helper set one draft and pressed Save, then the next.

- **A driver written alongside the feature inherits the author's model of how the feature is used, and that is structural rather than an oversight. Round 11A, 2026-08-19.**

  **The specific fact that makes it structural: the Phase 8 driver was written by the person who wrote the interception, in the same round, hours apart.** It therefore exercised the shape the code was built for. `recordTbScore` took one score, so the driver recorded one score at a time; the code and its test agreed with each other and both disagreed with how anyone would use a panel carrying five controls and a single Save button. **Scoring five things and pressing Save once was never tried by anyone until the business tried it.**

  **A walkthrough proves the path it walks. It does not discover that a different path exists**, and it is least likely to discover one when its author knows the implementation, because knowing the implementation is exactly what makes the built-for path feel like the natural one.

  **This is the second consecutive round in which the business's first few minutes of real use found a fault that passed every check.** Round 10 shipped a duplicate Summary and a stale wrapper, both caught by someone looking at the screen. Round 11 shipped this, caught the moment someone scored more than one criterion. In both cases the round's own evidence was real, the assertions were true, and the suites were green. **Two rounds is a pattern**: the checks are sound and the usage model behind them is narrower than reality.

  **The cheapest guard, and it is a question rather than a practice: before writing the driver, state how many of a thing a user would do before saving, and drive that number.** One is almost never the answer for a panel with more than one control.

- **Partial failure across N appends is a stated behaviour rather than whatever falls out, because it genuinely cannot be atomic. Round 11A Phase 1, 2026-08-19.** Each score is its own append to its own revision and `record_revisions` is immutable by design, so **there is no rollback available**: a recorded score is recorded. All-or-nothing is not on the menu, and pretending otherwise would be the real error.

  The rule, in full: scores are attempted in panel order; a recorded score **stands**; on the first failure everything stops, the remaining scores are not attempted and the ordinary fields are **not** saved; everything not recorded stays dirty so the edit bar keeps it visible; and the message names what was recorded and what was not, by criterion name rather than payload key.

  **Stopping rather than continuing is deliberate.** A failure here is far more likely to be systemic, an expired token or a dropped connection, than specific to one criterion, and pressing on turns one clear error into a list of them. **Not saving the fields is the other half**: leaving them dirty keeps the edit bar up, so what still needs doing is visible rather than silently half-applied.

  Proven with three valid scores, a fourth deliberately invalid, a fifth never attempted, and an unrelated field dirty in the same save. Server-side afterwards: three recorded, two absent, the field untouched, and the message reading *"Recorded Rollout Path, Client Commitment, Clear Use Case Requirements and Metrics. Physical Suitability could not be recorded: a comment is required at a score of 1 or 2. Your other edits have not been saved and are still open."*

- **OPEN ITEM: the whole-batch cross-tab save. Three problems in one behaviour, older than the fault that exposed it. Round 11A Phase 2, 2026-08-19. Not fixed.** Once Phase 1 landed, the score-specific leak became harmless: scores go to their own endpoint from wherever Save is pressed, and the PATCH carries only the field. **The general case did not become harmless.**

  `tbEdits` and the save bar are page-level and tabs are visibility only, so a field dirtied on one tab is saved by a Save pressed on another. Demonstrated with an invalid Est. Go Live date dirtied on Reference and a unit count edited on Commercials:

      active tab: commercials
      message: "estGoLiveDate cannot be in the past"
      the offending field is visible on this tab: false
      the valid unit-count edit: rejected along with it

  **THREE SEPARATE PROBLEMS, each independently worth fixing:**

  1. **The message names a raw payload key**, `estGoLiveDate`, not the label the user saw on the field. Every other error surface in this system uses the label; this one leaks the schema.
  2. **The field it names is not on screen**, and nothing in the message reaches it. The user is told which field is wrong and given no way to get to it, on a page with ten tabs.
  3. **A valid edit is refused because of an invalid one the user cannot see.** The unit count was correct and was rejected with the date. Nothing distinguishes "your edit failed" from "someone else's edit failed and took yours".

  **Pre-existing, and by a long way. The whole-batch PATCH dates to `7ae8a13`, Milestone 4. Fields were spread across tabs by `b5aa346`, Rounds 5 and 6.** So the two halves that combine into this have coexisted for six rounds. **Scoring exposed it rather than caused it**: the score interception was the first thing to put a control on one tab whose failure surfaced on another, which made a long-standing behaviour finally visible.

  **Recorded rather than fixed because the remedy is a design decision, not a repair.** The two candidates are **per-tab save bars**, so a save only ever carries what the user can see, or **a save that names and links its failures**, so a page-level save stays page-level but every error is reachable. The first is simpler and changes the mental model; the second keeps the model and costs more. That is a choice for the business, and this was a fix round scoped to a regression.


- **A reproduction reproduces the fault, not the user's session, and the difference was four-fifths of the damage. Round 11A, 2026-08-19.**

  The regression was reproduced exactly: same click sequence, same rejected keys, same error string, `disallowed` read from the server's own response. **From that reproduction the consequence was reported as "the business's work is four-fifths gone", and that was wrong.**

  **The fault was identical and the consequence was not.** The reproduction pressed Save once, so one score landed and four were rejected. The business pressed Save five times over eleven minutes, so four landed and one was rejected. Same defect, opposite outcome, and nothing in the reproduction could have shown it.

  **What showed it was the revision timestamps, and only those:**

      rev 3  12:38:32Z  +measurabilityConfirmed
      rev 4  12:39:26Z  +scoreRolloutPath
      rev 5  12:40:30Z  +scoreClientCommitment
      rev 6  12:41:39Z  +scoreUseCaseRequirementsAndMetrics
      rev 7  12:49:30Z  +scorePhysicalSuitability

  One append per revision, roughly one a minute. **That is a person retrying**, and it is visible nowhere except in the spacing. The current payload alone shows four scores present and one absent, which is equally consistent with the user having only entered four.

  **The general form: a reproduction establishes the mechanism and says nothing about the blast radius.** How much damage a fault did depends on what the user did in response to it, which is a fact about their session and is recoverable only from the record's own history. **Read the history before reporting the damage**, and where the damage is being reported to the person who suffered it, the difference between "re-enter four scores" and "re-enter one" is the whole value of the report.

- **The over-broad integer pass has now happened twice, and the second time it arrived through the mobile keypad rather than through a validator. Round 15 Phase 3, 2026-08-20.**

  **First instance, Round 3 Phase 4.** Every numeric entry field on the
  Commercials tab was forced through `isValidNonNegativeInteger`. That was right
  for genuine counts and wrong for margins and rates, and it broke the factoring
  rate's own 1.5% default outright. It was corrected twice the same day.

  **Second instance, Round 15 Phase 3.** The brief specified `type="text"` with
  `inputmode="numeric"` for all 43 numeric field definitions, and named decimal
  precision as the first of four things the change must not break. Those two
  instructions contradict each other and the contradiction is invisible from the
  code: `inputmode="numeric"` asks iOS for a digits-only keypad **with no decimal
  separator**, so all 25 Deal Sheet fields and all 9 Test Bed cost rates would
  have become untypeable on a phone. Nothing on a desktop browser would have
  shown it.

  **The reason this instance is worth recording separately is that it would have
  passed the check the brief specified.** The stated evidence was "confirm
  `inputmode="numeric"` is present", and it would have been present, on every
  field, exactly as asked. The build shipped the split instead: 32 integer fields
  take `numeric`, 37 decimal-capable fields take `decimal`, matching the
  pre-existing `step="1"` split field by field.

  **The shape, stated so the third instance is recognisable:** a numeric
  treatment is applied uniformly because uniformity is what makes it a class fix
  rather than per-field drift, and the class genuinely contains two kinds of
  number. The first instance came through a server validator and surfaced as a
  live bug; this one came through a keyboard hint on a platform the build was not
  being tested on. **Whenever a numeric rule is about to be applied across a
  whole surface, the question to ask first is which of those fields carry real
  decimal precision** - the answer has been "some of them" both times.


- **Presence is not legibility, and every programmatic check passes on the difference. Round 15 Phase 4, 2026-08-20.**

  The clearest instance yet of the rule that says to open the screenshot and
  look at it, and a sharper one than the cases that rule was written from,
  because nothing here was broken.

  Phase 4 added a Cost summary card whose whole purpose is that the totals read
  before the breakdowns they come from. It rendered in the right place, with the
  right three figures, verified against the engine's own output to the dollar,
  exactly one instance of each row, no overflow, no page scroll, identical
  measurements at 1240, 1920 and 3440. **Every check passed.**

  It was built with the shared `line()` helper, whose value carries the dimmed
  `.data-row-label` treatment meant for the itemized rows a total is built
  *from*. So the three category totals rendered as **the least prominent figures
  on the tab**, sitting beside neighbouring cards whose own subtotals were full
  white. The card said "Cost summary" and then whispered it.

  **No assertion available could have caught this**, because every property an
  assertion can name was correct. The figures were right, they were present,
  they were positioned as asked. What was wrong was their weight relative to
  everything around them, which is a judgement about hierarchy and exists only
  when a person looks at the whole screen at once.

  **The general form: a check confirms a thing is THERE; only looking confirms
  it READS.** For anything whose stated purpose is emphasis, ordering or
  prominence - a summary, a headline figure, a warning, a primary action - the
  screenshot is not a formality after the assertions pass. It is the only
  instrument that measures the thing the change was for. Assert presence and
  correctness by all means, and then look, because the two questions are
  different and the first one is not evidence for the second.


- **A bookkeeping file records what you meant to create, not what exists. Round 15 Phase 4, 2026-08-20.**

  Phase 4 built a fixture, then rebuilt it mid-phase to match Phase 0's payload
  exactly, and the rebuild **overwrote the same `f4.json`**. The teardown script
  read that file, found two ids, and would have reported a clean 2/2 while
  leaving an Account and a Test Bed live in the database indefinitely.

  What caught it was tearing down by **enumerating from the database on the
  fixture's own tag** rather than reading the file: four live records, not two,
  followed by a re-query confirming zero still tagged.

  **The fault is structural, not carelessness.** A file written at creation time
  is a record of intent at that instant; anything that supersedes it - a rebuild,
  a retry, a killed run, a second fixture created to isolate a case - leaves
  records the file no longer names, and it leaves NO trace of having done so. The
  teardown then reports success against its own incomplete list, which is worse
  than reporting nothing, because a clean 2/2 reads as proof.

  **This is the same shape as the killed-run residue in CLAUDE.md's build
  discipline rule 8:** cleanup scoped to what the record happens to name rather
  than to what the actor actually did. There it was an assertion naming four rows
  while the same event had written six more; here it is a JSON file naming two
  records while the same phase had created four. **Enumerate from the database,
  by a tag the fixtures themselves carry, and re-query to confirm zero remain.**


- **Use Cases and Customer Documents move into sub-tabs, superseding Round 13 Phase 6 one round later. Round 16 Phase 2, 2026-08-21.**

  **What Round 13 Phase 6 did, and its reasoning, left visible rather than
  deleted.** It moved Use Cases and Customer Documents out of the `.ref-cards`
  grid into a dedicated side-by-side `.ref-cards-wide` row with
  `align-items: start`, specifically so each panel could grow independently
  instead of one stretching to match the height of the other. That was a real
  problem, correctly diagnosed, and the fix worked.

  **The business's reason for reversing it is better, and it is worth being
  precise about why.** Independent growth solves a problem that only exists
  when the lists are long. They are usually short. So the layout optimised for
  the rare case and paid for it in the common one: two large, mostly-empty
  panels occupying a full-width row for two lists that typically hold two or
  three items each. One pane at a time gives whichever list is being read the
  entire width AND removes the empty half of the row.

  **Measured, because decluttering is the stated purpose and a height is the
  evidence.** Same record, same fixture, before and after:

      1240   1716px -> 1536px   (-180px)
      1920   1416px -> 1257px   (-159px)
      3440   1035px ->  876px   (-159px)

  **A supersession is not a reversal of a mistake.** Round 13 Phase 6 was
  right about the mechanism and right about the failure it prevented; what
  changed is a judgement about which case to optimise for, and that judgement
  belongs to the business rather than to the layout. Recorded this way so a
  future round reading the `.ref-cards-wide` rule does not reintroduce it on
  the strength of the original argument, which still reads as sound.

  **One consequence to watch.** The panes inherit the full content width, so at
  3440 a use-case row's Remove control sits roughly 2900px from the text it
  belongs to. That matches the Notes list directly beneath it, which has always
  been full width, so it is consistent with the page rather than anomalous, and
  it is recorded as an open item rather than fixed unasked.


- **A report with two parts became a brief with one, and the second part sat undelivered for a round while looking finished. Round 16 Phase 4, 2026-08-21.**

  The business reported two things about the arrow keys on Commercials: that
  they **changed values**, and that they **should navigate between fields**.
  Round 15 Phase 3 ended `type="number"` and stopped them changing values. It
  did not make them navigate. So after that round the arrow keys did nothing at
  all, which is not what was asked for and is arguably worse than the original
  complaint: a key that does the wrong thing is at least discoverable, and a
  key that does nothing reads as an application with no keyboard support.

  **The gap was in Round 15's own report and not in its brief.** Nobody
  overlooked it during the build; the build did exactly what it was scoped to
  do, verified it thoroughly, and the missing half was never in scope to be
  noticed. **That makes this a brief-writing failure rather than a build one**,
  and it is worth separating because the two have different remedies. No amount
  of build discipline catches a requirement that was never written down.

  **The shape, stated so it is recognisable:** a single report contains a
  complaint and a request. The complaint is concrete, reproducible and easy to
  scope, so it becomes the phase. The request is vaguer, needs a design
  decision, and quietly does not. The phase then passes every check it has,
  because the checks were written from the same half.

  **The practical remedy is at brief-writing time, not build time: when a
  report has two clauses, write two, and if only one is being scoped, say so
  in the brief.** Round 15's brief would have needed one sentence recording
  that navigation was deferred. Recording the deferral is what makes it
  visible; leaving it out is what let a half-delivered fix look complete for a
  round.


- **`el.focus()` can set `document.activeElement` and still leave the keyboard going nowhere, and the check that catches the known version of this does not catch it. Round 16 Phase 4, 2026-08-21.**

  Recorded separately from Round 15 Phase 3's zero-rect finding rather than
  folded into it, because **the diagnostic that catches that one passes
  cleanly here.**

  **The known version, Round 15 Phase 3.** `el.focus()` on an element with a
  zero rect is a silent no-op. An arrow-key probe reported 0 of 59 fields
  changing on unmodified code, and the tell was that the element was not
  visible: `offsetParent` null, `getBoundingClientRect()` zero.

  **The version found here passes every one of those checks.** The element was
  visible with a 190px rect, `offsetParent` was not null, and
  `document.activeElement === el` returned **true** immediately after the
  `focus()` call. A probe verifying "did the focus take" by the standard
  means got a clean yes. **And a capture-phase listener on `document` then
  recorded no keydown at all** when the key was pressed: not a keydown that
  was ignored, not one that reached the wrong element, none dispatched.

  It reported **130 mismatches across four screens on working code**, and every
  one of them looked exactly like the feature failing to work.

  **What distinguishes the two, and it is the only reliable tell: instrument
  the EVENT, not the focus.** Whether `activeElement` agrees says nothing
  about whether the browser will deliver a key to it. A capture-phase
  `keydown` listener on `document` answers the real question in one line, and
  distinguishes "the handler ran and did nothing" from "no event ever arrived",
  which are indistinguishable from the outcome alone.

  **The fix is the same as Round 15's and worth stating as the standing
  practice: drive keyboard tests from a REAL mouse click on the element.** A
  click is what a person does, it establishes whatever the browser needs in
  order to route keys, and it has now been the difference twice. Reserve
  `focus()` for setting up state you are not about to send keys to.

  Same family as Verification 12 and 13: a tool that reports nothing, a search
  that never ran, and a key that was never delivered are the same mistake
  wearing different clothes, and each one reads as a true negative.


- **Coordinates are the first fields in this system that legitimately accept a negative value, and every existing numeric validator would have rejected half the planet. Round 17 Phase 1, 2026-08-21.**

  This file already records two rounds of work on numeric validation, and both
  moved in the same direction: `isValidNonNegativeInteger` for counts and
  durations, `isValidNonNegativePercent` for rates and dollar figures, each
  with a comment explaining that the quantity cannot sensibly be negative.
  Round 15 Phase 3 then found the second instance of the over-broad integer
  pass. **The accumulated pattern in `field-validation.js` reads as "numbers
  in this system are non-negative", and by Round 17 that was true of every
  numeric field there was.**

  A latitude south of the equator and a longitude west of Greenwich are
  negative in the ordinary case, not the exceptional one. **Reusing any
  existing validator here would have rejected roughly half of the world's
  surface**, and it would have done so while looking entirely consistent with
  the file around it, which is what makes it worth recording rather than
  simply doing.

  `isValidLatitude` and `isValidLongitude` range-check as well as parse, since
  a latitude of 91 is not a coordinate and, unlike a three-decimal percentage,
  cannot be a rounding artefact. **Decimal places are deliberately NOT
  capped.** Six places is roughly 0.1m and real GPS output carries more;
  truncating would discard genuine precision on the one field whose entire
  purpose is recording exactly where a unit is.

  **The general form: a convention that has been correct for every case so far
  is not a rule, and the moment a genuinely different quantity arrives it
  becomes a trap** precisely because following it looks like consistency.


- **A unit cannot be edited by anyone but its creator, the block lands on the wrong table, and it reports as a server error. Round 17 Phase 1, 2026-08-21.**

  Named as a specific failure mode rather than a general note about RLS,
  because the general fact has been true and harmless for six rounds and this
  is the case where it stops being harmless.

  **`records_update` is `auth.uid() = owner_id`.** Reads are team-wide, so
  every record type until now has been effectively single-owner in practice:
  a Contact, an Opportunity or a Test Bed is created and edited by the same
  person, and nothing has needed otherwise.

  **Units are the first record type plausibly edited by someone other than
  their creator.** Slots are derived during setup by whoever is running the
  Test Bed; serials, coordinates and state are entered at the site by whoever
  installs them. That is two different people in the ordinary case, not the
  exceptional one, **so this bites the moment an installer opens the UI.**

  **Two things beyond the policy itself, both measured:**

  1. **The block lands on the `record_revisions` INSERT, not the `records`
     UPDATE.** A unit edit writes a revision first and only touches `records`
     when the state changes, so the refusal comes from the append-only history
     table rather than from the row being edited. Anyone reasoning about which
     policy to widen will look at `records_update` first, and that is not
     where the failure is.
  2. **It surfaces as an opaque HTTP 500** carrying `new row violates
     row-level security policy for table "record_revisions"`. A person who is
     not permitted to edit a unit is told the server broke. That is worse than
     a refusal, because it invites a retry and a bug report rather than a
     conversation about permissions.

  **Recorded and deliberately not fixed in the phase that found it.** Widening
  a write policy is a security decision with a blast radius across every
  record type, and it belongs in a change scoped to it rather than inside a
  phase building a record shape.


- **A write must not be the consequence of a read. Round 17 Phase 3, 2026-08-21.**

  Phase 2 derived unit slots when the Installation and Commissioning tab
  rendered. It was idempotent, it created only what the counts implied, and it
  was the obvious place to put it: the units are needed the moment that tab is
  open.

  **Phase 3 made the cost visible.** The count locks once units exist, so
  deriving on render meant **opening a tab would lock a field on a different
  tab**. Someone at Site Assessment, looking at the Installation and
  Commissioning tab to find out what installation involves, would have locked
  the Commercials counts by looking at it.

  **The general form is worse than the specific case.** Reading a screen is
  how a person finds out what something is. If reading changes state, then
  looking is committing, and the only safe way to explore the system is not
  to. That is a bad property for any system and a corrosive one for a system
  people are still learning.

  **The fix is an explicit control**, and it buys three things rather than
  one: the user has acted rather than been acted upon; **the lock becomes
  attributable to a person and a moment** instead of to a page view; and the
  stage question dissolves, because a control that exists only on the
  Installation and Commissioning tab cannot create units earlier, so the data
  condition and the stage condition agree without a stage rule being written.

  **The tell to look for.** A side effect on render is easy to justify while
  it is only creating something, and the justification stops holding the
  moment anything else keys off what was created. When a render writes,
  ask what else will read that write.


- **Open item 35: two writes to one record can collide on `record_revisions_record_id_revision_number_key`, and the unique constraint is the only thing standing between a race and a corrupted history. Found by business testing, 2026-08-21, after Round 17 merged.**

  Recorded here rather than in a round brief because the numbered sequence's
  home is Round 17's close-out list, which is signed off and ends at 34. This
  is 35 and lives in this file.

  **It is a race in the revision mechanism, not a scoring defect.** The
  business hit it scoring five criteria in one save and the message names
  scoring nowhere: it names `record_revisions`. Scoring is where it surfaced
  because scoring is what happened to be writing.

  **The same write succeeded on retry, and that is the whole diagnosis.** A
  duplicate key on identical input that then succeeds unchanged cannot be a
  property of the input. If the score, the payload or the criterion were
  wrong, the retry would have failed the same way, because nothing about them
  changed between the two attempts. **A changed outcome on unchanged input is
  timing.** This is the mirror of Architecture rule 9, where an unchanged
  failure output proves the change never reached the code path; here a changed
  outcome on an unchanged input proves the input was never the variable.

  **The mechanism, read out of the code rather than inferred from the
  message.** `src/routes/test-beds.js` reads the highest revision at 1609,
  computes `nextRevision = revRow.revision_number + 1` at 1683, and inserts it
  at 1687. Between the read and the insert there is no transaction, no `SELECT
  FOR UPDATE`, no sequence, no `ON CONFLICT` and no retry. Two requests that
  both read revision 12 both compute 13, and the second one loses.

  **What loses is not the point. What would happen without the constraint
  is.** `unique (record_id, revision_number)`, at
  `supabase/migrations/20260801000000_initial_schema.sql:41`, is the only
  reason the second write fails rather than landing as a second revision 13.
  A history table with two rows claiming the same revision number would break
  every reader that resolves "the current revision" by ordering on it, and
  that includes every gate decision, because `transitions.js` matches
  revision-scoped approvals on exactly that number. **The constraint is doing
  load-bearing correctness work and reporting it as a 500.**

  **Why it became reachable when it did.** Round 14 made `recordTbScores` post
  all dirty scores rather than one, which took the in-flight window for a
  single Save from one POST to N. The loop itself is sequential and awaits
  each response, so five scores alone do not overlap each other. **The
  overlap comes from two Save sequences, not from one.**
  `frontend/test-bed-detail.js:2197` sets `saveBtn.disabled` from
  `tbInvalidFields.size` and from nothing else, so the control is never
  disabled while a save is in flight: a second click during a five-POST
  sequence starts a second five-POST sequence against the same record, and the
  two interleave.

  **Stated precisely, because the distinction matters to whoever fixes it:**
  the unguarded read-then-insert is verified from the source. The overlapping
  Save click is the mechanism the code makes available and is not directly
  observed, so it is the leading candidate rather than a confirmed
  reproduction. Anything else that writes twice quickly to one record reaches
  the same place.

  **The class, not the instance, per build discipline rule 8.** Nine sites
  share this exact read-max-then-insert shape and none of them handles
  `23505`: `accounts.js:440`, `contacts.js:357` and `528`,
  `opportunities.js:354` and `440`, `test-beds.js:825`, `1480`, `1687` and
  `1869`, plus `deals.js:297` computing from a revision number resolved the
  same way. `approvals.js:97` is the only place in `src/routes/` that catches
  a unique violation at all, and it catches a different constraint. **The
  scoring endpoint is where the business stood when it fired, not where the
  fault lives.** Unit edits are the newest member of this set and the most
  exposed, since Round 17 made them the first record type two people edit.

  **This was noticed once already and scoped too narrowly.**
  `src/routes/records.js:43` carries a Milestone 2 TODO to wrap record
  creation in an rpc "to make creation atomic". Creation is the case that
  cannot collide, because a new record has no prior revision to read. The
  update path, which is the one that can, never got even a TODO. Same shape
  as the rule it illustrates: the fix was scoped to what the note named
  rather than to what the mechanism does.

  **Not fixed here.** Recorded so the fix is made for this reason, across all
  nine sites, rather than rediscovered as a scoring bug at the tenth.


- **Open item 35 is resolved: every record revision is now written by one atomic database function, and the payload merge moved with the number. Round 17A Phase 1, 2026-08-21.**

  **The reproduction, before and after, same script and same counts**, because a
  race with no forensic trace can only be shown fixed by the case that failed:

      concurrent writes to one record   before          after
        2                               50% refused     0%
        3                               53% refused     0%
        5                               68% refused     0%
       10                               82% refused     0%
      200 requests total                58 landed       200 landed

  Two concurrent writes collided in **10 of 10 trials** before. Through the UI,
  three values entered at paste speed produced two refused writes; after, all
  three persist.

  **THE COUNT WAS TEN, NOT NINE.** Every document in this round said nine,
  including the Phase 0 report that enumerated them. Re-enumerated from the
  code rather than from the list, the tenth is `test-beds.js`'s unit PATCH,
  **which is the site Phase 0 reproduced against and the site Phase 2 is
  about.** The enumeration dropped the one the round was named for, because
  the arithmetic in the original list already came to ten while the prose said
  nine and nobody added it up. A count restated often enough stops being
  checked.

  **The merge had to move with the number, and the narrower fix was worse than
  the defect.** One JS read supplied both, so making only the numbering atomic
  would let both writers succeed at different numbers, each merging its own
  field into the same stale payload, and the second silently drops the first's.
  Phase 0 had already produced that outcome from the race itself: three values
  entered, one stored, one absent, one holding a previous value, **and the row
  reading "Saved"** because all four fields of a unit row share one status cell
  and the write that succeeded finished last. **Numbering alone would have made
  that the normal result rather than the collision result**, trading a loud
  failure for a silent loss. Measured directly: 40 concurrent patches to
  distinct keys, 3 of 40 keys surviving under the old shape, 40 of 40 under the
  new one.

  **One writer, not ten, and this file had already half-made the argument.**
  `appendPayloadSeriesEntry` was extracted in Round 17 carrying the comment
  "two writers of one shape is not a fork of the mechanism". It had **one
  caller**, while the endpoint it was extracted from kept its own copy. A
  shared writer was created and the original was never migrated onto it, in the
  same file, in the same round. **An atomicity guarantee that lives in more
  than one place is not a guarantee**, which is a stronger claim than the
  usual case against duplication.

  **SECURITY INVOKER, which is the one place this diverges from
  `issue_reference_number`'s shape, and the divergence is the point.** That
  function is `security definer` because `reference_number_counters` has RLS
  enabled with no policies and is reachable only through it. `record_revisions`
  is the opposite: it carries a real insert policy requiring the caller to be
  the record's owner, which is the check open item 32 is about. **A definer
  function would have let any authenticated user write a revision to any
  record**, a severe permission widening arriving inside a bug fix and visible
  nowhere. Confirmed by exercising the failure branch rather than reasoning
  about it: a non-owner is still refused `42501`, and a forged `created_by` is
  still refused.

  **An advisory transaction lock rather than `SELECT ... FOR UPDATE` on the
  parent row.** Locking the record would serialize correctly, but under RLS a
  locking read also applies the UPDATE policy, `auth.uid() = owner_id`, so
  taking the lock would fail for exactly the non-owner case open item 32
  describes. `pg_advisory_xact_lock` needs no privilege on any table and is
  keyed per record, so writers to different records never contend.

  Worth recording that Phase 0's finding "no transaction is reachable through
  PostgREST" was true of the **client** and not of the database. A function
  body is a transaction. The option that looked unavailable was available all
  along, one layer down.

  **THE UNIQUE CONSTRAINT STAYS, and a future round must not remove it as
  redundant.** It stops being the mechanism and becomes the backstop: it is
  what would catch a call site added later that bypasses the function, which is
  precisely how ten sites came to share one shape in the first place. Proven
  still live by injecting a duplicate directly and watching it refuse, and
  asserted in the suite rather than in this paragraph.

  **The test is calibrated, not merely green.** Run against a JS reimplementation
  of the old read-then-insert at the same concurrency, 37 of 40 appends fail and
  3 of 40 keys survive, so both assertions genuinely fail on the old shape. The
  same run shows **contiguity alone would not have caught it**: the naive shape
  left revisions 1..4 perfectly contiguous while losing 37 writes. An invariant
  that only checks for gaps would have passed on a database losing most of its
  traffic.


- **When a list and its own count disagree, the list is the evidence. The count is a summary, and a summary is the thing that gets restated. Round 17A Phase 1, 2026-08-21.**

  Recorded separately from open item 35's resolution because the defect is in
  how the work was described, not in the code, and it will recur on a
  different subject.

  **What happened.** `ROUND17A_INPUT.md` enumerated the affected write sites as
  `accounts.js:440`, `contacts.js:357` and `528`, `opportunities.js:354` and
  `440`, `test-beds.js:825`, `1480`, `1687` and `1869`, and `deals.js:297`.
  **That is ten loci. The same sentence called them nine.** The arithmetic was
  wrong the first time it was written, in a document produced specifically to
  be precise about these loci.

  **The reconciliation went the wrong way.** Phase 0 re-enumerated, found ten
  in the list and nine in the prose, and **silently resolved it downward by
  dropping one from the enumeration to match the count** rather than by adding
  one to the count to match the enumeration. The nine-item list was then
  reported as authoritative, restated in the fix brief, and **accepted twice**,
  once at the input document and once at Phase 0.

  **The dropped site was `test-beds.js`'s unit PATCH: the one Phase 0
  reproduced the race against, and the one Phase 2 exists to fix.** The round
  leads with that surface. The enumeration dropped the site the round is named
  for, and every later document inherited it.

  **Why the count wins by default, which is the part worth generalising.** A
  count is short, quotable and travels into summaries, briefs and headings; a
  list is long and gets skimmed. So the count is what everyone checks against,
  and a list that contradicts it reads as a typo in the list. **It is the other
  way round: the list carries the loci, each independently checkable against
  the code, while the count carries nothing and is derived.** Re-derive the
  count from the list every time it is restated, and when they disagree,
  re-enumerate from the source rather than reconciling one document against
  another.

  Same family as the `CURRENT_STATE.md` rule that a generated file is right
  about what exists and a hand-written one about what was intended, and the
  same family as Verification 12: an enumeration nobody re-ran is not evidence
  that the thing enumerated is all there is.


- **Contiguity is the obvious check on a revision series and it is blind to the failure mode that actually occurs. Round 17A Phase 1, 2026-08-21.**

  The revision number exists so that gate evaluation can resolve current state
  by ordering on it, so "are the numbers contiguous per record" is the natural
  invariant to reach for, and it is the one a reasonable person would write.

  **Measured against the pre-fix shape at 40-way concurrency, it passes while
  most of the traffic is being lost:**

      naive read-then-insert:  37 of 40 appends refused
                                3 of 40 patch keys surviving
                                revisions 1..4, PERFECTLY CONTIGUOUS

  **A refused insert writes nothing**, so every collision removes a write and
  leaves no gap behind. Contiguity is preserved *by* the failure rather than
  broken by it. A suite asserting only contiguity would have reported a healthy
  database while 92% of the writes to it were being thrown away.

  **This is why the calibrated before case is the only proof.** Not the absence
  of errors afterwards, which is what a race that got rarer also looks like;
  not contiguity, which is what a race that is failing perfectly also looks
  like. The proof is the same test, at the same concurrency, shown failing on
  the old shape and passing on the new one: 37 failures and 3 of 40 keys, next
  to 0 failures and 40 of 40.

  **The general form: when choosing an invariant for a failure you cannot see,
  ask what the failure mode does to the invariant, not what health does to it.**
  Verification 9 says an invariant not proven capable of failing is not
  evidence. This is the sharper case, because contiguity IS capable of failing,
  just never on this fault.


- **Atomic writes and non-overlapping writes are different guarantees, and the unit row needed both. Round 17A Phase 2, 2026-08-21.**

  Phase 1 made concurrent writes to one record atomic. That fixed the refusals
  and the cross-field losses, and it did not fix ordering: two writes carrying
  the **same** key are both individually correct, and the one that reaches the
  lock second wins regardless of which the user meant last. Atomicity has
  nothing to say about it.

  **Measured before building anything**, because the residual after Phase 1 was
  smaller than expected and worth sizing rather than assuming: two overlapping
  same-key writes put the older value in the database **1 time in 60**. Rare,
  silent, and a wrong serial number on an installed device.

  **The guard is a per-unit promise chain**, so writes for one row run in the
  order the user made them and writes for different rows never wait on each
  other. Proven structurally rather than statistically, by running the old
  handler and the new one against the same page and the same gestures and
  counting requests in flight:

      pre-Phase-2 handler:   4 change events, 4 PATCHes, MAX 4 IN FLIGHT to one record
      shipped handler:       4 change events, 4 PATCHes, MAX 1 IN FLIGHT

  **A statistical result would not have been evidence here.** Both runs above
  stored the right values, because a 1-in-60 fault does not show up in one
  trial. What makes the fix real is that the overlap is gone by construction,
  not that a sample came out clean.

  **A user cannot outrun it, and what happens if they try is latency.** Eight
  changes across one row entered in 286ms drain in 2326ms, one round trip each,
  all eight landing with every last intent stored. Nothing is dropped and
  nothing is coalesced. Two rows entered together settle in 450ms, so a 24-row
  table still saves 24 rows concurrently.

  **The status cell was lying, and fixing it needed per-field state rather than
  per-burst.** One cell serves four fields, so the naive rule of each write
  setting it lets a later success erase an earlier refusal. Settling once per
  drain fixes the concurrent case and **leaves the commoner sequential one**:
  an invalid latitude is refused in about 40ms, long before the operator
  finishes typing the longitude, so the two never overlap, the row showed the
  error and then replaced it with "Saved" while the latitude sat unsaved on
  screen. Failures are now keyed by field and cleared only by a later
  successful write to that same field, so a refusal stays visible until it is
  resolved, and then clears on its own.

  **Save-on-blur is untouched.** The business flagged the inconsistency with
  the batched Save bar for discussion, and a discussion is not a decision.

  **What this does NOT cover, stated because the guard looks more complete than
  it is: it is a client-side serialization.** Two browser tabs, two people, or
  anything not going through this handler can still issue same-key writes that
  race, and the server will accept them in arrival order. Closing that needs
  optimistic concurrency on the endpoint, a version or an If-Match, which is a
  contract change rather than a fix.


- **A probe whose own input is silently altered reports on a case it never ran. Round 17A Phase 2, 2026-08-21.**

  Distinct from the failure modes already recorded here. Verification 12 is a
  search that never ran, 13 is an instrument never shown to reach one, 14 is a
  comparison with nothing on either side. **This one runs, measures correctly,
  and reports truthfully about the wrong input.** Every signal in the output is
  accurate. The only false thing is the label.

  **The instance.** A browser probe cleared a field before typing by selecting
  its contents. Headless, the selection silently did nothing, twice and by two
  different mechanisms: `Cmd+A` produced no selection, and `clickCount: 3` did
  not either. So the typed text **appended** rather than replaced. The field
  held `51.5074`, the probe typed `999` intending an out-of-range latitude, and
  the field became `51.5074999`.

  **51.5074999 is a perfectly valid latitude.** The server accepted it, exactly
  as it should, and the probe printed `invalid value accepted, 200` and
  `refusal not visible`. Both lines were true about what happened and both were
  read as findings about a rejection path that was never exercised. **The
  conclusion drawn was that server validation had a hole in it**, which is a
  serious claim, and it was wrong.

  **A third variant of the same shape in the same phase**, with no selection
  involved: a value retyped identically to what the field already held fired no
  `change` event at all, so no write occurred, and the previous run's data sat
  in the database satisfying every assertion about it. The probe was reporting
  on a save it had not made.

  **What catches all three is one cheap step: write a known value through the
  probe's own input path and read it back before trusting anything else.**
  It costs one round trip and it fails loudly on exactly the case that
  otherwise reads as a product defect. In this phase it caught the first two
  immediately; the third was caught only by noticing that the database held
  correct values while no change events had fired.

  **The general rule: calibrate the input, not only the instrument.**
  Verification 13 established that a counter must be shown capable of reaching
  one. This is the other half. **An instrument proven to measure correctly, wired
  to an input you never confirmed, produces confident output about a case that
  did not occur** - and it will usually look like a defect in the system rather
  than a defect in the probe, because the reading is real.


- **Open item 36: a state-only unit edit writes a no-op revision. Predates Round 17A Phase 1 and is not a regression. Logged Round 17A Phase 2, 2026-08-21.**

  `PATCH /api/test-beds/:id/units/:unitId` builds its payload patch from
  `serialNumber`, `latitude`, `longitude` and `stateSource` only. `state` is
  not a payload key: it is written to `records.status` separately. So changing
  only the State dropdown sends a patch with no keys, and
  `append_record_revision` appends a revision whose payload is identical to the
  one before it.

  **Not introduced by the atomic writer.** The pre-Phase-1 code did the same
  thing by a different route: it copied the current payload, applied whichever
  of the four keys were present, none were, and inserted the copy. Same
  outcome, same revision count. Phase 1 changed how the revision is written,
  not whether this one is written.

  **Why it is worth an item rather than a fix in passing.** It inflates a
  unit's history with entries that record nothing, which matters directly to
  Round 18, whose whole content is a History pane sourced from `audit_log` and
  the revision series. A reader will see a revision and reasonably infer a
  change. The fix is one guard on an empty patch, but "should a state change
  produce a revision at all" is a question about what a revision means, and
  that is Round 18's subject rather than a decision to take silently inside a
  race fix.


- **A raised unit count is a correction and reconciles its own slots. Round 17A Phase 3, 2026-08-21.**

  Two decisions the business's defect forced, stated rather than left to fall
  out of whichever branch happened to exist.

  **ONE: raising a locked count is a correction and needs a reason, exactly as
  lowering one does.** This was already the server's behaviour and had never
  been stated: the lock fires on any divergence between the count and the
  slots, in either direction. Confirmed in both directions rather than assumed,
  each refused 400 with the same message. It is the right rule on its own
  merits: an increase is as much a divergence between the plan and what is on
  site as a decrease, and the audit row records `from` and `to`, so direction
  is already legible without needing different treatment.

  **TWO: a successful increase derives the missing slots in the same request.
  It is not a second explicit act.**

  Round 17 Phase 2 established that a write must not be the consequence of a
  READ, after deriving on render meant that opening a tab locked a field on a
  different tab. **That rule is not engaged here.** A count correction is an
  explicit act: typed by a person, carrying a mandatory reason, and writing an
  audit row naming them. Deriving from an act is the ordinary case; the rule is
  about deriving from a page view.

  **The deciding argument is symmetry inside the endpoint.** A downward
  correction ALREADY removes surplus slots with no second act required.
  Reconciling one direction automatically while demanding a separate control
  for the other is an inconsistency the user has to learn rather than a rule
  they can infer, and the business found it as a defect precisely because they
  inferred the symmetric behaviour and did not get it.

  **Derivation now has one implementation**, `deriveMissingUnitSlots` in
  `src/lib/units.js`, called by both `POST /units/derive` and the correction
  path. Adding the second caller by copying the loop was the obvious move and
  is the exact shape Architecture rule 3 forbids. **It is also the shape Round
  17 got wrong in this same file**: `appendPayloadSeriesEntry` was extracted
  for this reason and left with one caller while its origin kept a copy.

  **The derive control is now gated on there being work to do, not on there
  being nothing there.** `if (!tbUnits.length)` was the reachability defect in
  its general form: the only caller of a working idempotent endpoint vanished
  at the moment it became useful. Counts and slots can still drift if the new
  derivation fails partway, because the count is written before it runs, so the
  units view shows a reconcile line naming the shortfall whenever one exists.


- **The unit index invariant was false the day it was written, and the correction is to the comment. Round 17A Phase 3, 2026-08-21.**

  `test-beds.js` stated that "a slot is never reissued after a removal:
  indexes identify a slot, not a position in an array." The next index is
  computed from `loadUnits`, **which excludes soft-deleted rows**, so
  `max(index)` has never seen a removed slot. Reduce three slots to two, raise
  it back, and the restored slot is index 3 again beside a soft-deleted index 3.

  **Reissue is kept, and the comment is corrected**, because reissue is right
  here for a reason that lives in a different function. A count correction
  removes surplus slots **only while they are still Planned**, highest index
  first, and refuses outright if any slot it would remove is Installed, Faulty
  or Removed. So a soft-deleted slot never held a device, and reissuing its
  number cannot overwrite the history of anything physical. Removing from the
  top also means live indexes for a type are always exactly 1..N, which is what
  the units table displays.

  The alternative, never reissuing, would print #1 to #10, #13, #14 on a Test
  Bed the business calls a twelve-unit site, which reads as missing data.

  **Asserted, not described**, per Verification 5, and the assertion was proven
  capable of failing per Verification 9: injecting a never-reissue
  implementation fails exactly the reissue test and nothing else, and reverting
  restores green. **That matters because the previous rule lived only in a
  comment**, which is why it could be false for a full round without anything
  noticing.

  **What this leaves for Round 18:** a soft-deleted slot and a live slot can
  share an index, so a History pane keyed on index alone would be ambiguous. It
  must key on the unit's record id.


- **A blank screenshot passes every check, because the checks are not looking at it. Round 17A Phase 3, 2026-08-21. Promoted into `CLAUDE.md` as a refinement to Verification 4 in the same round.**

  Verification 4 says to open the screenshot and look at it, because presence
  is not legibility and no assertion can tell them apart. **It assumes the
  screenshot contains the thing.**

  Phase 3 captured a clipped region to show the new reconcile line. The clip
  was computed from the element's rect while the element was scrolled out of
  the viewport, so the coordinates addressed empty page and the image was pure
  background. **Every programmatic check passed on that capture**, and
  correctly: they were querying the live DOM, which was fine. The picture and
  the assertions were describing different things, and only one of them was
  being offered as visual evidence.

  **A blank image is not a failed check. It is no check, and it looks like
  diligence** - the screenshot exists, it is attached, the step was performed.

  The fix costs one line: scroll the element into view, take its rect after
  scrolling, and confirm the capture is not empty before treating it as
  evidence. Same family as Verification 12 and 13, where a search that never
  ran and a counter never shown to reach one both read exactly like clean
  results, and the same family as Phase 2's altered-input probe: **the
  instrument produced output, and the output was about nothing.**


- **The stale date bound and the stale banner are one defect: neither knew what it was about. Round 17A Phase 4, 2026-08-21.**

  **4.1, downgraded on evidence before it was built.** Phase 0 confirmed the
  server refuses a bad pair in all three directions, so no invalid data could
  reach the database and this was never an integrity fault. It is an
  affordance: the picker offered dates the save would refuse, and the user
  found out at Save.

  The bound was not wrong, it was **stale**. It was computed from `tbPayload`
  and written into the input once at render, so it described the last save
  rather than the screen, and the code comment that stood there admitted
  exactly this. Both bounds now read the EFFECTIVE value, the open draft if
  there is one and the stored value otherwise, and are recomputed when either
  date moves or is discarded. Verified in one session without saving: moving
  the installation date to 2027-03-01 moved the go-live floor to 2027-03-01
  while the stored value stayed 2026-10-01, and discarding put it back.

  **4.2, and the class turned out to have two signs.** The reported fault was a
  banner surviving a stage transition. `clearTbSaveFeedback` had four callers
  and no path that changes what the user is looking at was among them.

  **Two more paths were found by sweeping rather than by fixing the report**,
  and one of them was the opposite fault:

  1. **`restoreTbOpenEdits` was clearing a message it should have kept.** A
     save fails, the handler writes the reason and reloads, the reload
     re-opens the very field the message is about, and `openTbField`'s
     2026-08-15 clear wipes it. The user sees a value rejected and no reason
     why. That clear is right for a person opening a field and wrong for the
     app restoring one, and `fromUserGesture` already separated the two: every
     real entry point passes it, the restore is the only caller that does not.
  2. **`renderTbValidationFeedback` was clearing a message it did not own.**
     Its comment said it cleared "only feedback this function itself put
     there" and it identified ownership by `className === 'msg-error'`, which
     is the class a server error carries too. Confirmed live: open two fields,
     make one save fail, type one valid digit into the other, and the server's
     reason vanished on the keystroke. Ownership is now marked on the element
     rather than inferred from its styling.

  **The unifying fault is that the element carried a message with no record of
  who put it there or what it was about.** One path would not clear a message
  after the thing it described had gone; another cleared one that was not its
  to clear. Both are the same missing fact.

  **What clears it now, stated so the next path added is measured against a
  rule rather than against the four callers that happen to exist:** the top
  level tab changing, arriving at the record afresh, and the existing
  deliberate cases. **What does NOT clear it, also deliberate:** a same-record
  reload on the same tab, because a failing save writes its reason and then
  reloads, so wiping there would destroy the report as it was being made. Sub
  tab switches do not clear either, since the fields the message is about are
  still on screen.


- **An injected precondition is not the precondition. Round 17A Phase 4, 2026-08-21.**

  Distinct from the altered-input rule recorded earlier in the same round, and
  the distinction is the point. There, the probe's input was silently changed
  and the probe reported truthfully about something the user never typed. Here
  **the precondition was created faithfully and was simply not the real thing**,
  so the probe ran against a state that looked identical and behaved
  differently.

  **The instance.** Testing whether an unrelated keystroke wiped a save error,
  the error was put on screen directly:

      el.textContent = 'Est. Go Live cannot be before Estimated Installation Date'
      el.className = 'msg-error'

  Visually and structurally that is what a server refusal produces. The test
  passed: the message survived the keystroke. **It was wrong.** Repeated by
  producing a genuine refusal through the real save path, the message was wiped
  on the first valid digit, which is how the second ownership fault in that
  element was found. It had been sitting behind a green result.

  **Why the fake differed, which is the general shape.** A real message arrives
  with everything else its production sets up: the field left open and dirty,
  the save bar's state, the validity map, whatever the reload restored. The
  injection reproduced the two properties I had thought of and none of the
  ones I had not, and the fault lived in one of those.

  **So: build the precondition by running the thing that produces it.** If that
  is too slow or too awkward, say the result is conditional on the injection
  rather than reporting it as a test of the real path. **A hand-made state
  tests the code against your model of the state, which is the thing you were
  trying to check.**


- **A rule caught its own author within the hour of being written, for the third time in this project. Round 17A Phase 4, 2026-08-21.**

  The altered-input rule was recorded at the start of Phase 4, from a probe
  whose selection silently failed so typed text appended. **Within the same
  phase, typing a date into `type="date"` filled the segments in an order that
  produced `0007-12-30` from `03/01/2027`**, and the first run reported "the
  bound did not follow the draft" - true about an input that was never entered.
  The rule's own remedy, calibrate the input before trusting the reading,
  caught it, and the rewritten probe now aborts rather than reporting.

  Third recorded instance of this shape. Round 10 Phase 5B promoted the
  stale-condition rule and then wrote four more stale conditions in the phase
  that promoted it. Round 14 promoted the calibrated-zero rule against the same
  pattern.

  **What this says about promotion, and it is not that the rules do not work.**
  Each of them worked: the fault was caught, quickly, by the rule just written.
  What it says is that **knowing a rule confers no ability to spot its
  instances**, which Round 10 already recorded and which keeps being confirmed.
  The value of writing one down is the mechanical check it prescribes, not the
  recognition it fails to grant. **Prefer rules that name a step to perform
  over rules that name a mistake to avoid.**


- **Total Cost moved into the Cost summary card, and the superseded reasoning turned out to be right about the cost. Round 17A Phase 5, 2026-08-21.**

  The business asked for the standalone Total Cost line to be removed and the
  Cost summary panel to carry the total. Round 15 Phase 4 had explicitly
  declined that, on the grounds that pulling the total into the grid would push
  it back down behind the rate panels, which is why Round 8 Phase 3 had put it
  above the detail in the first place.

  **Verification 15 was the reason to re-measure, and re-measuring did not
  overturn the objection.** The carried item HAD migrated between widths, which
  is what Verification 15 is about. The physics of this particular panel had
  not. Measured at Round 15 Phase 4's own anchor, before and after, and the
  before reproduced the carried record exactly:

      1240x800    below the fold  290px  ->  335px total first  /  475px total last
      1920x950    below the fold   25px  ->   70px total first  /  210px total last
      3440x1440   above the fold in every arrangement

  **THE MERGE CANNOT BE DONE FOR FREE, and the ordering inside the card is the
  whole difference.** Total last, the conventional form and the literal reading
  of the request, costs 185px, because the three category rows push it down.
  Total first costs 45px, and that 45px is exactly the card's own chrome:
  14px of padding, a 26px title, 4px of title margin. **A bare band has no
  title, so no arrangement of a titled card can match it.** Shipped total
  first, with the divider beneath the headline rather than above it.

  **What was gained and what was paid, both stated, because the whole reason
  this figure's position is argued about is a carried item about it being below
  the fold.** Gained: one place to read the cost, and the standalone band gone.
  Paid: 45px of fold at both widths. The carried item is not improved by this
  phase and must not be read as though it were; it is 45px worse.

  **Prominence checked by looking, not only by measuring**, because Round 15
  Phase 4 shipped this same card with its totals in the dimmed itemized-row
  treatment and every assertion passed. Total Cost renders at 15px/600 against
  the category rows' 13px/300, is the first row in the card, and is
  unambiguously the heaviest figure in it. **One honest caveat from the
  screenshots: it is the dominant figure in its CARD, and less dominant on the
  TAB than the full-width band was**, because it no longer spans the content
  width and now sits beside two cards of equal visual weight. That is inherent
  to the merge rather than to this implementation of it.

  **Asserted as a move, which is two claims** (Verification 7): exactly one
  instance of the string renders anywhere in the detail view, counted by text
  across the whole view rather than within the new card, and zero
  `.tb-cost-total` nodes remain. Both at all three widths, with zero overflow
  on the cards, the panel and the body.


- **The cost preview computes on the server, because a second engine agrees on the day it is written. Round 17A Phase 6, 2026-08-21.**

  The business reported that the cost summaries read zero while values sat on
  screen unsaved. The obvious fix is to add the figures up in the browser, and
  it is the wrong one: it would be a second implementation of arithmetic that
  carries a go/no-go decision, matching the server on the day it is written and
  drifting quietly afterwards. Same discipline Round 9 established for
  `computeBlocking`, and the business has confirmed the Opportunities cash flow
  tool will use the same engine, which makes the rule matter beyond this tab.

  **So the drafts go to the server and the figures come back.** `POST
  /api/test-beds/calculate` is one new route over `buildTestBedCostBreakdown`,
  which was already exported and already the single mapping point for a saved
  record. The preview and the save therefore run the same function over the
  same values **by construction rather than by agreement.**

  **Shaped after `POST /api/deals/calculate`, not wired to it.** That endpoint
  has the right contract, full inputs in the body and computed figures out with
  no record id and no persistence, and the wrong engine: it calls
  `calculateDeal`, which is Opportunity's.

  **It cannot persist, structurally rather than carefully.** The handler has no
  database client and its contract has no record id. Confirmed by direct query
  rather than by reading it: previewing left the revision count at 4 and the
  stored total at 78,000 while the screen showed 83,000.

  **THE ONE-ENGINE PROOF IS THE COMPARISON, NOT THE ARCHITECTURE.** The same
  values previewed and then saved produce the identical figure, USD 83,000.00
  both times, which is what distinguishes one engine from two that happen to
  agree. Asserting the design would have proved nothing.

  **The trigger is debounced on input at 400ms, and blur was the other
  candidate.** Blur was rejected because the complaint is that the summary
  reads stale WHILE the values are on screen, and a blur trigger leaves it
  stale for exactly as long as the user is looking at the number they just
  typed. Measured: four keystrokes produce one call, not four.

  **The itemized labels follow the drafts too.** They quote their own inputs,
  so a preview would otherwise render "SafeSight (10 x USD 4,000.00)" beside a
  figure computed from 4,500: a row contradicting itself.

  **A KEY LIST THAT IS SILENTLY AN ALLOWLIST, and the assertion that makes it
  loud.** Fastify strips body keys a schema does not name, by default and
  without error, so a key misspelled on the client would arrive absent, compute
  as zero, and render a confident wrong total. That is Architecture rule 9's
  shape at a distance of two files. `scripts/tests/cost-preview.test.mjs`
  parses both real files and asserts the lists are identical, plus that every
  key the engine reads is accepted. Proven capable of failing by misspelling
  one key, which fails that test alone with its own message.

  **The unsaved state is marked in the card's own title**, next to the figures,
  rather than relying on the Save bar being noticed elsewhere on the page: a
  total that cannot be told apart from a saved one makes the Save bar
  advisory. **Honest note from the screenshots: the word UNSAVED is doing the
  work, not the colour.** The badge and card outline use `--green`, which is
  also every card title's colour in this palette, so it reads as emphasis
  rather than as warning. It is unmistakable against the three unmarked cards
  beside it, and a palette with an attention colour would say it better.


- **A calibration that silently fails to inject produces the same output as a test that cannot fail. Round 17A Phase 6, 2026-08-21.**

  Verification 9 says an invariant not proven capable of failing is not
  evidence, and the way to prove it is to inject a violating case and watch it
  fail. **The injection is itself a step that can fail silently**, and when it
  does the suite prints exactly what a working injection against a broken
  invariant prints: everything passes.

  **The instance.** A new invariant asserts that the client's cost-key list and
  the route's body schema name the same keys. To prove it could fail, one key
  was to be misspelled:

      sed -i '' "s/'hemirHostingCost', 'testBedDuration',/.../" frontend/...

  The two keys sit on different lines in the source, so the pattern matched
  nothing. **`sed` exits 0 when it matches nothing**, so the `|| python3`
  fallback never ran either, and the file was untouched. The suite reported 25
  passing, and **that was very nearly recorded as proof the invariant works.**
  It was proof of nothing: an unchanged file cannot violate anything.

  **What makes it dangerous is that the reading is indistinguishable.** A green
  suite after a real injection means the invariant is broken. A green suite
  after a failed injection means the injection is broken. The output is the
  same, and the natural reading is the wrong one, because the whole point of
  the exercise was to test the invariant rather than the tooling.

  **The step: assert the file actually changed before running the suite.** In
  Python, `assert s.count(old) == 1` before writing, and a `grep` for the
  injected text afterwards. Both are one line, and either would have caught
  this. Same family as the altered-input and injected-precondition rules
  recorded earlier this round: **the instrument ran, and it ran on the wrong
  thing.**


- **Open item 37: the palette has no attention colour, so every warning state has to say the word. Logged Round 17A Phase 6, 2026-08-21.**

  `:root` defines `--dark`, `--black`, `--white`, `--green`, three hairline and
  muted greys, and three typefaces. **`--green` is the only accent**, and it is
  already the colour of every card title, every active tab and the brand mark.

  So a state that needs to say "look at this, it is not normal" has nothing to
  say it with. Phase 6's unsaved cost preview marks itself with a `--green`
  badge and card outline, and it is unmistakable against three unmarked cards
  beside it, but **the colour reads as emphasis rather than as warning and the
  word UNSAVED is carrying the meaning on its own.**

  `.msg-error` exists and has its own colour, and it is the wrong borrow: an
  unsaved preview is not an error, and using the error treatment for a normal
  state would spend the one signal the app has for genuine failures.

  **This will recur** rather than being a one-off in one card: pending states,
  stale data, anything provisional, and open item 32's permissions refusal all
  want the same missing token. Adding one is a palette decision and belongs
  with the business alongside the brand colours in Section 9 of this document,
  not inside a fix round.


- **A round can make a latent defect materially worse without touching it. Round 17 did exactly that to open item 35, and nothing in that round could have noticed. Recorded Round 17A, 2026-08-21.**

  The revision race has existed since the first `PATCH` was written. For most
  of the system's life it needed **two overlapping user actions** to reach: a
  second Save pressed while the first was in flight, a double click, two tabs.
  Rare enough that it was never reported.

  **Round 17 built the units view, and the defect became reachable by ordinary
  typing.** `onTbUnitFieldChange` writes on every `change` event, unawaited and
  with no in-flight guard, on a table that holds up to 24 rows of four fields
  each. Round 17A Phase 0 measured it: values entered at scanner or paste speed
  produce writes 14ms apart, and 2 of 3 were refused, with the row reading
  "Saved" over the top of two discarded values.

  **Round 17 introduced no defect.** Every line it wrote was correct against
  the code it was written for. It changed the *reachability* of something
  already there, which no test of Round 17's own work would show, because
  Round 17's own work behaved exactly as specified.

  **The general shape, which is the reason to record it rather than fold it
  into item 35's entry:** a latent fault's severity is a function of the
  surfaces that reach it, and those are added by rounds that never look at the
  fault. So severity is not a property of the defect that can be assessed once
  and carried forward. **An item's carried entry describes the day it was
  written**, and a new surface over an old fault deserves a re-read of what the
  old fault now costs.

  What would have caught it here: asking, while building a write path, what
  else writes to the same record and how close together. Nothing in this
  project asks that yet.


- **The `PGRST303` diagnosis does not fit the call path it was recorded against. The correlation holds; the mechanism is unresolved. Round 18 Phase 0, 2026-08-21.**

  **Superseding, not deleting**, the Round 17 Phase 0 entry that reads
  "PGRST303 DIAGNOSED against open item 30... the host clock is 185ms ahead...
  with a zero-tolerance `iat` check, a token minted and used inside the same
  second reads as issued in the future." That reasoning stays visible because
  it is careful and its measurement is real; it is the conclusion that
  overreached.

  **What it cannot explain.** The failure caught with full output in Round 18
  Phase 0 is at `scripts/tests/reference-number.test.mjs:76`, seeding a counter
  row through `adminClient()`. That client authenticates with
  `SUPABASE_SECRET_KEY`, which on this project is an **opaque `sb_secret_` key,
  not a JWT**. The host mints no token on that path, so there is no `iat` for a
  host clock to stamp ahead of anything.

  **The measurement is still real.** The host is consistently ahead of the
  Supabase `Date` header: +0.34s, +0.39s, +0.45s across three samples, mean
  +0.39s, in the same range Round 17 recorded. It is simply not evidence for
  the stated mechanism on this path, because the host's clock never touches the
  token.

  **What is established:** the error is `PGRST303 JWT issued at future`; it is
  intermittent; it needs the full suite rather than the file alone, 0 in 8
  isolated runs against 2 in roughly 14 full-suite runs; and it is unrelated to
  any code under test. **What is not established is why**, and candidates now
  include skew between Supabase's own gateway and database rather than anything
  on this machine, which nothing here can measure.

  **How it happened, which is the part worth carrying.** Round 17 Phase 0 found
  a real measurement, a plausible mechanism and a fit to every prior sighting,
  and wrote DIAGNOSED. Seven sightings of an uncharacterised fault make a
  mechanism that explains them all very attractive. **The check it skipped was
  the cheapest one: which credential does the failing call actually present.**
  Same family as this project's own rule that a document describing a control
  is not evidence the control exists, applied to a cause rather than a control.

  **Operationally unchanged:** a suite run failing only with `PGRST303` is not
  a failing suite, and should be re-run with both results reported. That advice
  was right and does not depend on the mechanism.


- **Open item 38: the chevron popup overlays the detail tab row and swallows clicks on it. Round 18 Phase 1, 2026-08-21.**

  Found as a probe fault and confirmed as a real one. A click on a stage tab
  landed on the popup instead, so a panel that had rendered perfectly well
  looked like a hang.

  **It is not confined to automation.** The popup opens on hover with a 180ms
  rest, is positioned inside `#tb-chevron-wrap`, and the detail tab row sits
  directly beneath it. The gesture that triggers it is the same gesture someone
  makes on the way to the tabs: the chevron strip runs the full page width
  immediately above them, so a pointer travelling from the strip down to a
  stage tab rests on a chevron en route, opens the popup, and arrives at a tab
  that is now covered.

  **Anyone moving between stages with a popup open hits this**, and the failure
  is silent: the click does nothing and the tab does not change, which reads as
  an unresponsive tab rather than as an overlay.

  Not fixed in the phase that found it, because Phase 1 was scoped to what the
  popup SAYS rather than where it sits, and moving a positioned element is a
  layout change with its own before-and-after obligations at three widths.
  Candidates, none chosen: dismiss on pointer-down anywhere, make the popup
  `pointer-events: none` (it currently accepts the pointer so it can be moved
  into, which was deliberate), or position it above the strip rather than
  below.


- **CANDIDATE, not a claim: a cross-file race in the database suite. Round 18 Phase 1, 2026-08-21.**

  Recorded as a hypothesis with its mechanism named, because it was not
  established and the runs that would have established it were contaminated.

  **The observation.** `INVARIANT 2: no gate rule names a stage absent from
  stage_definitions` failed naming an orphaned `harness_*` gate rule. Queried
  immediately afterwards, **zero orphaned rules existed** and the run tag's
  records were all soft deleted, so the row the assertion saw had been a LIVE
  fixture at the moment of reading rather than residue.

  **The mechanism.** `npm run test:db` passes five files to `node --test`,
  which runs files in parallel across the available CPUs, eight here.
  `config-invariants.test.mjs` asserts properties of the WHOLE configuration
  while `gates.test.mjs` legitimately holds fixture `stage_gate_rules` rows for
  the duration of its own tests. A global invariant and a fixture-creating file
  running concurrently against one database is a race by construction.

  **Why it fits the intermittency pattern**, which is the reason to write it
  down rather than dismiss it:

  - It needs the full suite. Isolated runs of a single file cannot produce it,
    which matches 0 failures in 8 isolated runs against 2 in roughly 14
    full-suite runs.
  - It clears on retry, because the next run's timing differs.
  - **It leaves no residue when the holding file finishes normally**, which is
    exactly why it reads as unexplained: by the time anyone looks, the row is
    gone and the database is clean.

  That third property is what makes it worth naming. An intermittent failure
  that leaves evidence gets diagnosed; one that tidies up after itself gets
  recorded as uncharacterised, which is what has happened to this suite's
  intermittency for several rounds.

  **Two serial runs (`--test-concurrency=1`) passed 50/50**, which is
  consistent and is not proof: two runs of a race that fires perhaps one time
  in seven prove very little.

  **Phase 6 investigates if there is room; otherwise this carries as an open
  item with the mechanism named.** The cheap test is a run count at
  `--test-concurrency=1` against the same count in parallel, on a database
  with confirmed-zero residue at the start of each.


- **A declaration placed near its relatives rather than after its dependencies takes the whole page down, and nothing static catches it. Second instance, Round 18 Phase 2, 2026-08-21.**

  Promoting this from two recorded incidents to a named pattern, because the
  second arrived by exactly the same route as the first and was written by
  someone who had read the first.

  **Instance one, Round 10 Phase 3, 2026-08-19.**
  `INSTALLATION_ENVIRONMENT_OPTIONS` was declared next to the other picklist
  constants, below `TB_SITE_FIELDS`, which references it inside its own
  initialiser. **Instance two, Round 18 Phase 2, 2026-08-21.**
  `UNIT_TYPE_FOR_TAB_KEY` was declared beside `COUNT_KEY_FOR_UNIT_TYPE`, its
  closest relative in meaning, **1800 lines above the `UNIT_TYPES` it derives
  from**. The Round 10 entry also names a top-level `const` collision reaching
  the same outcome by a third route.

  **The shape, which is what makes it worth naming:**

  - The declaration is put where it BELONGS BY MEANING, next to the constants
    it reads like, rather than after the thing it depends on. That instinct is
    correct everywhere else and wrong here.
  - `const` is not hoisted, so the reference throws at load.
  - The file is a classic script sharing one global scope, so **every later
    declaration in it is never evaluated**. The failure is not the missing
    constant; it is that `window.initTestBedDetailPanel` and everything after
    it stops existing.
  - **The whole screen is blank.** Not the control, not the panel: the screen.
  - **`node --check` passes, correctly.** A temporal dead zone violation is a
    runtime error, not a syntax error, and no static check in this project
    catches it.

  **What actually catches it is loading the page and reading `pageerror`**, and
  in both instances that is what did. In this one the symptom presented as a
  probe failing to find the record's name, which is two steps removed from the
  cause and reads at first like a broken test.

  **The step to perform, since a rule naming a mistake to avoid has now failed
  twice:** after adding any top-level `const` to a classic script, load the
  page once and check `pageerror` is empty, before running anything that
  depends on the page working. It costs one browser open and it is the only
  instrument that reports this at all.


- **The history pane, and what looking at it decided. Round 18 Phase 4, 2026-08-21. Recorded verbatim: this list is the input to the vocabulary work and must not be tidied.**

  Deferred eight times, shipped raw and read-only from `audit_log`, in the
  Reference sub-tab strip. What follows is the phase's actual output.

  **THE MEASUREMENTS.** Largest record: **83 entries**. Tab click to first row
  painted: **235ms**, one request, fetched only when the tab is opened. Pane
  height **4983px against a 1000px viewport, five screens**. Operable nodes in
  the rendered pane: **0**, with the counter shown moving to 1 on an injected
  button and back.

  **RECOMMENDATION, in priority order.**

  1. **Grouping beats paging, and filtering beats both.** 83 rows is a long
     scroll, not a pagination problem, and paging it would hide the one thing
     the pane is for: seeing the shape of what happened. **71 of the 83
     entries share the previous entry's minute.** This is not a timeline, it is
     a handful of bursts, and the right first move is to collapse a burst into
     one line that can be opened.
  2. **Two action types are 64% of the record**, 33 `approval_submitted` and
     20 `document_approved`. Any grouping that does not collapse consecutive
     runs of the same action will not help.
  3. **Fix the When column before anything else.** It is 41px wide and **every
     one of 83 rows wraps to three lines**, so every row is 59px instead of
     about 30. The pane is twice as tall as its content needs for no reason a
     reader could see, and that is a five-minute fix that halves the scroll.
  4. **The actor column is doing nothing on this record and should not be
     removed.** All 83 entries carry one actor. Phase 0 found five actors
     across the log as a whole, three real accounts and two probe users, so
     the column is real; it is this record that is single-actor. What it must
     not do is show a raw uuid, which is what it does today.
  5. **Decide what belongs here before deciding what it should say.** The
     wording work is cheap once the set is settled and wasted if it is not.

  **WHICH ACTION TYPES READ AS NOISE, from the 83 on this record.** Verbatim,
  as observed, not as reasoned:

  - `document_location_set` **reads as noise, four entries, two of them
    consecutive duplicates on the same document** with different URLs a minute
    apart. It records that someone pasted a link, then repasted it. Nobody
    reviewing a Test Bed's history needs that.
  - `approval_submitted` **is not noise but is unreadable in bulk**: 33
    entries, arriving in threes, differing only by `track`. Three consecutive
    lines saying Technical, Commercial, Legal are one event to a human.
  - `document_approved` **at 20 entries has the same problem**, and pairs with
    the `transition` immediately after it. A document approved and the stage it
    unblocked are one story told twice.
  - `transition` **is the signal**, 14 entries, and is what a reader is looking
    for. It is currently indistinguishable from everything around it.
  - `buyer_contact_linked` **reads as setup rather than history**, 9 entries
    all within one minute at the start.
  - `created_from_contact` **is the one entry that anchors the record** and it
    is at the bottom of a five-screen scroll.
  - `data_correction` **is genuinely interesting and is invisible**, two
    entries lost among 81 others.

  **The shape of the finding: the two entries a person would most want, the
  correction and the creation, are the hardest to find, and the two action
  types that dominate are the ones that carry least meaning per row.**

  **What the pane says about where it belongs.** It works as a sub-tab and
  reads as a peer of Use Cases, but it is five times the height of anything
  else in that strip. That is tolerable now and will not be once grouping
  makes it useful enough to open often.


- **Notes carry the stage they were written at, and nothing migrates. Round 18 Phase 5, 2026-08-21.**

  Notes were thin because they lacked context, not because there were too few
  of them. A note written while scoring already had its context, captured as
  the Reason on the score. A note written while advancing a stage had none.

  **NOTHING MIGRATES, and that is the decision rather than the easy path.**
  Every note written before this change has no stage and **did not have one
  when it was written**. Deriving one from the record's current status would be
  a claim about a decision nobody made: the record is at Closed today and the
  note was written months ago at Qualification, and stamping today's status
  onto it would be a fabrication dressed as data. **Round 14 Phase 1 made the
  same call about comments and reasons**, leaving historical entries carrying
  what they carried, and the reasoning holds unchanged.

  **The key is omitted, not emptied.** An empty string is a claim that the note
  was written at a stage called "", and the renderer would then have to tell
  that apart from a note that genuinely predates this. Absent means absent, and
  an older note therefore gets **no chip and no placeholder**: a dash or an
  "unknown" label would imply something is missing when nothing is. Confirmed
  by measurement, row heights identical at 37px with and without a chip.

  **TWO DECISIONS STATED RATHER THAN DISCOVERED, both reported before building.**

  **One: the same-key lost update is OUT OF SCOPE, and the real fix is not what
  it looks like.** `addTbNote` rebuilds the whole `notes` array from a value
  read at page load, so two notes added concurrently resolve last-writer-wins
  and one disappears. That is Round 17A Phase 2's explicitly open same-key case
  sitting on this very write.

  It is not fixed here, and the reason matters: **the obvious fix does not
  work.** Moving the append server-side, the shape `appendPayloadSeriesEntry`
  already uses for scores, still reads the array and writes it back in
  JavaScript, so two concurrent calls still lose one. A real fix appends inside
  the SQL statement, which means teaching `append_record_revision` a
  jsonb-array-append operation, which changes the single atomic writer that ten
  call sites depend on. **That is not a note-stage phase's work**, and writing
  it down here is what stops the next round "fixing" it by re-reading before
  writing and believing the problem gone.

  **Two: `by` stays client-supplied.** Seven sites across four frontend files
  construct a user-typed note with `currentSession.user.email`; five server
  routes construct a system-composed note with `request.user.email`. **That
  split is coherent: whoever writes the text sets the author.** Moving one of
  the seven would replace a consistent arrangement with an inconsistent one, so
  it moves as a set or not at all. The stage therefore travels beside `by` at
  the same trust level, in the same object, rather than one field being
  authoritative and its neighbour not.

  **Both Test Bed note writers changed**, `notes` and `installNotes`, through
  one shared constructor. Doing one and not the other would have been exactly
  the arbitrary inconsistency the `by` decision above argues against.

  **The write path is unchanged**: `PATCH /api/test-beds/:id`, which since
  Round 17A Phase 1 goes through `appendRecordRevision` and therefore through
  the atomic writer. This phase added a key to a payload object; it did not add
  a path.


- **The suite's intermittent invariant failures are a cross-file race, characterised and reproducible on demand. Round 18 Phase 6, 2026-08-21. This closes the candidate recorded in Phase 1.**

  **The mechanism.** `npm run test:db` passes five files to `node --test`,
  which runs files in parallel across the available CPUs.
  `config-invariants.test.mjs` asserts properties of the WHOLE configuration
  while `gates.test.mjs` legitimately holds fixture `stage_gate_rules` rows for
  the duration of its own tests. A global invariant and a fixture-creating file
  running concurrently against one database is a race by construction.

  **The window, observed directly rather than waited for.** Polling
  `stage_gate_rules` every 120ms while `gates.test.mjs` ran: harness rows first
  visible at **1.8 seconds**, peaking at **23 rows visible at once**, across
  most of the run.

  **Reproduced deterministically**, which is what turns this from a candidate
  into a finding. Start `gates.test.mjs`, wait six seconds for it to create its
  fixtures, then run `config-invariants.test.mjs` alone against the same
  database:

      residue before                     0 harness gate rules
      6s in, visible                     8 harness gate rules
      config-invariants                  2 FAILED: INVARIANT 2 and INVARIANT 4
      gates finished                     0 failed
      residue after                      0 harness gate rules

  Those are exactly the two invariants seen failing intermittently, and the
  rows they named were gone by the time anyone looked.

  **Why running the two files together does NOT reproduce it.**
  `config-invariants` completes in about a second and `gates` does not create
  a rule until 1.8 seconds in, so the fast file finishes before the window
  opens. It fires in the five-file suite because the scheduler starts
  `config-invariants` later or runs it slower under load. **That is the whole
  intermittency**: not randomness in the database, but where in the schedule
  one file lands.

  **It explains all three properties** recorded when this was still a
  hypothesis: it needs the full suite's parallelism, it clears on retry because
  the next run's scheduling differs, and **it leaves no residue when the
  holding file finishes normally**, which is why it stayed uncharacterised for
  several rounds.

  **Not fixed here.** The fix is a choice between scoping the global
  invariants to exclude `harness_%` record types, and running that file
  serially, and each has a cost: the first weakens an invariant that exists to
  catch exactly the orphaned rows a killed run leaves, and the second slows the
  suite. That is a decision, not a repair.


- **`PGRST303` remains unresolved, and Round 17's mechanism is wrong on every path rather than merely on one. Round 18 Phase 6, 2026-08-21.**

  Sharpening the Phase 0 correction, which said the diagnosis did not fit the
  admin call path. It does not fit any path.

  **No code in this project mints a token.** The session JWT's `iss` is
  `https://<project>.supabase.co/auth/v1`, so its `iat` is stamped by Supabase
  Auth, and `SUPABASE_SECRET_KEY` is an opaque `sb_secret_` key that is not a
  JWT at all. **The host clock cannot stamp an `iat` on anything**, so the
  +0.39s host skew Round 17 measured, re-measured today at +0.27s, is real and
  is evidence for nothing about this error.

  **Not reproducible by volume.** 650 requests in four shapes produced zero
  occurrences: 200 concurrent reads on one client, 200 concurrent reads each on
  a freshly constructed client, 150 sustained sequential reads, and 100
  concurrent writes to `reference_number_counters` itself, the exact table and
  operation that fails. So it is not concurrency, not client construction, and
  not that table.

  **What is established:** three sightings today, all in full-suite runs, all
  at `reference-number.test.mjs:76`; never in an isolated run of that file, 0
  in 8; unrelated to any code under test; clears on re-run.

  **The leading untested candidate**, recorded as untested: Supabase exchanges
  the opaque key for a JWT at its own gateway, stamped with the gateway's
  clock, which PostgREST then validates against the database's. Skew between
  two of their components would produce exactly this and would be invisible
  from here. **Nothing in this repository can test that**, which is itself the
  finding: the next round should stop trying to characterise it locally and
  either ask Supabase or accept it as environmental.

  **Operationally unchanged and still right:** a run failing only with
  `PGRST303` is not a failing suite, and both results should be reported.


- **Live test fixtures reached the business's working set and stayed there for eleven rounds. Round 18A Phase 1, 2026-08-21.**

  A Round 9 probe created a Test Bed named "21st Century Boy", owned by the
  automation account, and never tore it down. The business adopted it as real
  data: they linked their own contact to it as a buyer, moved it to Closed, and
  eventually tried to edit its Summary. That failed with open item 32's message,
  which is the only reason any of this was found.

  **Twenty-six live records, five of them top-level and visible in list views.**
  Three Accounts and two Test Beds, plus twenty children and one orphan document
  whose parent was already deleted. No `terminus-probe.invalid` user owned a
  single live record; the entire set belonged to `john+test@`, the account
  interactive probes run as, which is exactly the account whose fixtures were
  never covered by `Fixtures.teardown()` because they were created through the
  API rather than the harness.

  **What would have caught it.** Nothing did, for eleven rounds. Every round's
  residue check asked "are there live `harness_*` rows" and "are there live
  records owned by a probe user", and the answer to both was honestly zero the
  whole time. **The check that was missing is the one nobody wrote: are there
  live records owned by the interactive test account.** A residue rule phrased
  around the harness cannot see fixtures made by a browser.

  **THE DELETE THAT WOULD HAVE DESTROYED BUSINESS DATA, and the thing that
  stopped it was asking rather than checking after.** The obvious removal is to
  clear the join rows for the records being deleted, and the obvious filter is
  the contact. A live business-owned contact, "joane tester", held **21
  `record_contacts` links, of which 6 were to LIVE business-owned Test Beds as
  Test Bed Tech Team** and only 7 were to the fixtures. `delete where contact_id
  = joane` would have silently removed six real working links, on a table with
  no soft delete and no history.

  **The mechanism that made it safe: resolve to explicit row ids, then delete by
  id.** Not by record, not by contact, not by any predicate. Nine rows were
  enumerated, each checked to have at least one side inside the removal set, and
  deleted one at a time with the affected-row count asserted. **A filter can
  over-match; a list of ids cannot.** The surviving count was then asserted
  directly: joane's live business links, 6 before and 6 after.

  **Records soft deleted, junctions hard deleted**, per Verification 11 and the
  harness's own convention. `record_revisions` and `audit_log` were left
  untouched at 50 and 132 rows: the records are withdrawn, and their history is
  not rewritten. Two reference codes retire with them and are never reissued,
  which is what the counter table exists to guarantee.

  **Live records fell from 119 to 93, the first time that number has gone down
  in this project.**


- **A residue check phrased around one production mechanism cannot see residue made by another. Round 18A Phase 1, 2026-08-21.**

  Eighteen rounds of residue reports were true and none of them looked at the
  place the residue was.

  **What the standing check asks.** Are there live `harness_*` rows? Are there
  live records owned by a `terminus-probe.invalid` user? Both were honestly and
  correctly zero, every round, including the rounds in which twenty-six live
  fixture records sat in the business's Test Bed list.

  **Why it missed.** Those two questions are shaped around one producer,
  `scripts/verify-harness.mjs`, which mints a synthetic `record_type` per run
  and owns its records as a probe user. **A browser session driven by an
  interactive test account produces neither.** It signs in as
  `john+test@terminustechnologies.io` and calls the real API, so what it leaves
  behind is an ordinary `test_bed` with an ordinary reference code, owned by an
  account that is not a probe user and is not the business either. It is
  indistinguishable from real data by every property the check tests.

  **The general form, which is the reason to record this rather than just add a
  query:** a residue check inherits the shape of the mechanism it was written
  against. Every new way of creating data is a new way of leaving it behind, and
  the existing check will keep reporting zero, truthfully, about the mechanism
  it knows. **The question to ask is not "is the harness clean" but "is anything
  live that no person owns".**

  **The check that was missing, now added to the standing step:** live records
  owned by any account that is not a real business account, not only harness
  record types and not only probe users.

  Same family as build discipline rule 8, which says to enumerate everything the
  responsible actor writes rather than what the failing assertion names. This is
  that rule applied to actors instead of tables: enumerate every actor that can
  write, not only the one the check was built for.

- **The same permission failure takes two shapes and only one of them is
  loud. Round 18A Phase 2, 2026-08-21.** The reported defect was an INSERT:
  `record_revisions_insert` requires `auth.uid() = owner_id`, and a refused
  INSERT raises `42501` with a Postgres message the route passed through as
  a 500. Mapping `42501` to a readable 403 fixes that shape and only that
  shape. An UPDATE refused by the same ownership rule **raises nothing at
  all**: RLS filters the row out of the statement's scope, so the update
  succeeds against zero rows and returns no error. Nine routes had already
  detected the zero-row case independently and replied `403 "not
  permitted"`, which is why the second shape never looked like a defect and
  never got a message worth reading either.

  Both shapes now route through `sendWriteError` and `sendRefusal` in
  `src/lib/write-errors.js` and produce one sentence: "This record belongs
  to another user. You can view it, but only its owner can change it."
  **The general form: a single rule enforced at two layers can surface as
  an error on one and as silence on the other, and a fix derived from the
  reported instance will cover whichever layer happened to be reported.**
  Searching for the error code finds the loud shape and cannot find the
  quiet one, because the quiet one has no code to search for. The quiet
  shape was found by asking what the same RLS policy does to a different
  verb, not by extending the search.

- **A helper that both hides the site and is the site defeats a
  call-site heuristic, and the heuristic reports a smaller number rather
  than an error. Round 18A Phase 2, 2026-08-21.** Phase 0 counted 45
  write-error sites by pattern-matching. Asked to re-derive rather than
  inherit that figure, the first analyser was calibrated against the three
  handlers already known to exist and **found one of them.** Two returned
  their refusal through `appendPayloadSeriesEntry` rather than replying
  directly, so the reply-shaped pattern could not see them.

  The cause was not the pattern but the walk: a two-pass design resolved
  each variable to its **final** state and applied that to every site,
  so a variable reused down a file mislabelled its own earlier uses. A
  single pass tracking state as it walks found 3 of 3, and then reported
  **52 sites, a different set from the 45**, not merely more of them.
  **Calibration is what separated the two runs**, and the calibration was
  available for free because the three handlers already existed. Same
  family as Verification 13: an instrument that has never been shown
  producing the answer you are looking for is not measuring, and a
  count is exactly the kind of output that looks reasonable while being
  wrong.

- **Ask what the same policy does to a different verb. Round 18A Phase 2,
  2026-08-21.** A general form for a class of defect that build discipline
  rule 8 states too narrowly for this case. Rule 8 says fix the class, not
  the instance the failure named, and it is written around an actor leaving
  residue: enumerate everything the actor writes. That framing pointed at
  the wrong axis here.

  The reported defect was one route surfacing `42501` as a 500. The obvious
  class is **every site that handles this error**, and sweeping for it
  produced 52 sites and a real fix. But the actual class is **every way this
  policy manifests**, and the two are not the same set. `records_update` and
  `record_revisions_insert` are the same ownership rule enforced at two
  layers. Refused on an INSERT it raises `42501`. Refused on an UPDATE it
  raises **nothing at all**: RLS filters the row out of the statement's
  scope, so the update succeeds against zero rows and returns no error.

  **A search for the error code cannot reach a silent zero-row success.**
  There is no code to search for, no log line, no failure. Nine routes had
  independently detected the zero-row case and replied `403 "not
  permitted"`, which means nine separate authors had each met this and
  handled it locally **without anyone noticing they were all handling the
  same policy** as the defect being reported. Nine independent local fixes
  to one thing is itself the signal, and it was sitting in the codebase in
  plain sight the whole time.

  **The question that reaches it: take the rule, not the error, and ask
  what it does to each verb it governs.** Insert, update, delete, and the
  RPC path. One of those answers is usually "nothing visible happens",
  and that is the branch no error-shaped search will ever return.

- **A suite that authenticates with a credential which bypasses the rule
  cannot see the rule, correct or broken. Round 18A Phase 3, 2026-08-21.**
  Every database-backed test in this project ran through `adminClient()`,
  which holds the service key. Row-level security is not consulted for that
  client at all. So the suite reported green roughly fifty times across two
  rounds while a business user could not save a Summary, and **there was no
  version of those tests that could have caught it**, because none of them
  ever met a policy.

  This is not a missing assertion. It is a missing actor. Adding ownership
  assertions to the existing files would have changed nothing: they would
  have been asserted by a client for which the answer is always yes.
  `scripts/tests/ownership.test.mjs` is the first thing here that signs in
  as a person, via `userClient()`, and it needed two of them, because one
  user cannot demonstrate a boundary.

  **The demonstration is injection B in that phase's calibration.** Swapping
  the non-owner's client back to the service key, which is exactly the state
  the suite was in for two rounds, turns four of the nine tests red. The
  measurement of what the old suite was blind to is the new suite failing
  when put back into the old suite's position.

  **General form: ask which credential the tests hold, and what that
  credential is exempt from.** Anything it is exempt from is invisible, and
  it will be invisible in a way that produces passes rather than errors.

- **A foreign-key violation still reaches the user as a raw Postgres message.
  Found Round 20 Phase 5, 2026-08-22. RECORDED, NOT FIXED.**

  `POST /records/:id/approvals` with a `track` that is not a row in
  `approval_tracks` returns **500** carrying
  `insert or update on table "approvals" violates foreign key constraint
  "approvals_track_fkey"`.

  Round 18A routed every write-error site through `src/lib/write-errors.js`
  and gave row-level-security refusals a sentence a person can act on. That
  helper maps `42501` and nothing else. **`23503`, a foreign-key violation,
  is the same defect wearing a different code**: a constraint the user
  cannot see, surfacing as "the server broke" on an action that was simply
  not allowed.

  The correct message already exists in shape. A track that is not
  configured is not a server fault, it is a choice the caller cannot make,
  and the readable form is the same one Round 18A wrote for ownership.

  **Not this round.** It is the reason-codes round's natural neighbour,
  because that round adds the first new constrained vocabulary since this
  was found. Recorded now so it is met as a note rather than as a
  production 500.

- **The chevron leads with Closed Lost, because sort_order 0 is both a
  probability and a position. Found Round 20 Phase 6, 2026-08-22 by looking
  at a screenshot. FIXED Round 20 Phase 7: sort_order 110.**

  **Why 0 was chosen, so nobody restores it by reasoning from probability.**
  Closed Lost was given sort_order 0 so its position and its probability
  agreed: a lost deal is 0 percent, and 0 is a natural first slot. **That
  pairing reads well and is not load-bearing.** Probability lives in its own
  column on its own table, `stage_probability_defaults`, keyed by stage
  name. It is not derived from sort_order and never has been. The two
  numbers happened to match and nothing consulted them together.

  **Why it changed, and it is worse than the reading order.**
  `GET /records/:id/stage-approvals` computes each stage's state as
  `completed` when its index is below the current one. With Closed Lost at
  index 0, **all three live Opportunities returned Closed Lost as
  `completed`**, measured before the change rather than inferred. The server
  was asserting that a deal which has never been lost had already passed
  through being lost. After the move it reads `upcoming`.

  110 rather than 101: the list is spaced by 20 and 110 leaves a gap above
  Closed Won.

  **The alternative that was rejected, so it is not proposed again.** The
  chevron could be ordered by something other than sort_order: a
  display_order column, or a code-side sort pushing
  `reachable_from_any_stage` rows to the end. **Both create a second
  ordering that has to be kept in step with the first.** They would agree on
  the day they were written and drift the first time a stage is inserted,
  which is the second-computation-path failure this document already records
  in several forms. One ordering, and it is sort_order.

  **What the move proved, which the original position had been hiding.**
  Closed Lost at 0 was reached from Qualification as a BACKWARD move of one
  position, and backward moves have always been unrestricted. So the
  reachable_from_any_stage test passed for a reason unrelated to the column.
  At 110 the same transition is a FORWARD jump of five positions, which
  nothing but that column permits, and it still succeeds. The fix turned a
  test that could not fail into one that can.

  **Superseded reasoning, retained: RECORDED, NOT FIXED.**

  `Closed Lost` carries `sort_order` 0 so that its probability and its
  ordering agree, and the stage chevron renders stages in `sort_order`. So
  the Opportunity workflow reads, left to right, **Closed Lost,
  Qualification, Solution Alignment, Proposal, Evaluation, Negotiating,
  Closed Won**, and a new deal appears to begin one step after having been
  lost.

  **Nothing functional is wrong.** Adjacency is measured by position in the
  ordered list, `reachable_from_any_stage` bypasses adjacency entirely on
  the way in, and `is_terminal` blocks the way out. Every gate behaves
  correctly and every test passes.

  **No assertion would have caught this**, which is the point of it being
  recorded here. The panel has a real layout box at all three widths, every
  row has usable width, there is no overflow, and the criteria and labels
  are exactly right. What is wrong is the story the row tells, and only
  looking at it measures that. Verification 4.

  Two resolutions, both cheap, neither taken here because the ordering was
  a confirmed decision rather than an accident: give `Closed Lost` a
  sort_order above `Closed Won` and let probability and position stop
  agreeing, or exclude `reachable_from_any_stage` rows from the chevron and
  render them as a separate control. The second is probably right, since a
  stage reachable from anywhere is not a step in a sequence.

- **A fix built for the screen that existed is not a fix for the screen
  built after it. Three instances in three rounds, Round 21, 2026-08-22.
  RECORDED FOR A DELIBERATE AUDIT IN ROUND 22.**

  Build discipline rule 6 says a fix built for the pages that existed is not
  a fix for the pages built after it, and names three instances from earlier
  rounds. Three more have now landed in consecutive rounds, all on the same
  seam: **Test Bed was built first and Opportunity was built beside it, so
  every Test Bed fix is a fix Opportunity does not have.**

  - **`refFieldRow`'s missing blank option**, Round 19. Test Bed's field
    renderer had a leading blank `<option>`; Opportunity's did not, so an
    unset dropdown silently pre-selected the alphabetically first name. Two
    implementations of one job, and the fix reached only one.
  - **`renderTransitionSection` duplicating server-owned logic**, Round 20
    Phase 6. Round 20 Phase 2 fixed `records.js` so a record in a terminal
    stage is offered no next stage. The browser computed
    `stages[currentIdx + 1]` independently, where the server fix could not
    reach, and a lost deal would have been offered "Move to Qualification".
  - **`tbUserPickedTab` with no Opportunity equivalent**, Round 21 Phase 1.
    Round 5 Phase 7 found that an unconditional default-to-Reference landing
    after an awaited load silently overwrites a tab click made in that
    window, and fixed it for Test Bed. Opportunity kept the race for
    sixteen rounds, and it was one of the two causes behind the reported
    blocker.

  - **`submitStageApproval` refreshing nothing for Opportunity**, Round 21
    Phase 4. Every branch of that function tests `currentTestBed`.
    Opportunity's all-stages approvals table has called it since Round 9, so
    an Opportunity approval POSTed successfully and then matched no branch:
    no refresh, no error, nothing on screen at all.

  - **Two shared loaders defaulting to a deleted container**, Round 21
    Phase 5. `loadStageApprovals` and `renderStageApprovalsRows` both default
    `containerId` to `'opp-stage-approvals-rows'`, the all-stages table this
    round replaced with per-stage cards and removed. Test Bed passes its own
    container and is unaffected, so every caller that exists is fine and the
    next one to omit the argument would have thrown on a null element rather
    than doing nothing. Both now guard.

  - **Element ids built from a stage name, containing spaces**, Round 21
    Phase 7. `getElementById('opp-stage-criteria-stage-Solution Alignment')`
    resolves. `querySelector` on the same id parses it as
    `#opp-stage-criteria-stage-Solution` with a descendant `Alignment` and
    matches nothing, **with no error from either**. Four of the six
    Opportunity stages are two words, so it was latent in two thirds of the
    panels, and only a probe that happened to use a selector rather than an
    id lookup would ever have surfaced it. The tab-strip factory already
    sanitised the same way when building button ids; the new panel ids did
    not.

  **The fourth instance is different from the other three, and worse.** The
  blank option, the duplicated next-stage derivation and the missing tab
  guard were all LATENT: wrong code waiting for a use that had not arrived,
  or a defect the user could work around without noticing what it was. This
  one **has been live in production since Round 9**. Anyone approving a
  track from Opportunity's Stage and Approvals tab has watched the screen do
  nothing, and the only reason it was not reported is that Opportunity's
  approvals were barely used before this round configured them.

  **A silent production defect is what this pattern produces when the
  forked screen is actually in use**, rather than merely built. The other
  three were found by working nearby. This one would have been found by the
  business.

  **The pattern is not carelessness, it is structural.** Nothing links the
  two implementations, so nothing reports that one has moved. Each was found
  by working on the Opportunity side for an unrelated reason, which means
  the ones nobody has had a reason to touch are still there.

  **A deliberate audit belongs in Round 22**, which is already about
  convergence between the two screens. Enumerate every Test Bed behaviour
  that Opportunity's equivalent should have, rather than waiting for the
  next one to surface as a defect. Not audited here: this round is the stage
  tabs, and an audit found mid-round becomes scope creep rather than a
  finding.

- **The Exit Criteria and Approvals panels repeat each other, on both record
  types. Observed Round 21 Phase 4, 2026-08-22. NOT INTRODUCED HERE AND NOT
  THIS ROUND'S WORK.**

  A stage tab shows an Exit Criteria card and an Approvals card side by side.
  The Approvals card lists Commercial, Technical and Legal with their dates.
  The Exit Criteria card lists the same three as computed rows reading
  "Requires an approved Commercial decision at stage Solution Alignment", and
  so on. Three facts, stated twice, a hand apart.

  **This is Test Bed's existing behaviour, not something the Opportunity
  build created.** `renderTbStageExitCriteria`'s `isProcessRequirement`
  returns true for `approval_obtained`, so Test Bed shows them in both panels
  too, and has since Round 9 Phase 6.2.

  **Test Bed solved the mirror image of this and recorded why.** That round's
  comment notes the Approvals panel used to carry a Stage / Exit criteria /
  Approvers header, "which made sense on Opportunity's all-stages table and
  made none here, where the panel shows exactly one stage and sits next to a
  dedicated Exit Criteria panel repeating the same text". The header went.
  The rows did not.

  Two defensible readings, which is why this is an observation rather than a
  fix. The Exit Criteria card is the complete gate, and a gate that omitted
  its approvals would be lying about what blocks the transition. Or the
  Approvals card is the authority on approvals and the criteria card should
  defer to it. Nobody has chosen, and choosing changes both record types.

### The four lens rollups on the Exit Criteria card

Round 32 Phase 2. Sits directly on the observation above: this is a second
thing in that card, and it is deliberately not a gate.

**A display, and the approvals still gate.** Round 26 settled that the criteria
inform and the approvals gate, choosing a manual Assessment reviewed tick over
a computed rollup because a computed rollup tightens silently as criteria are
configured. A computed DISPLAY needs neither that decision reopened nor any
gate-rule mechanism: it reads the series the Assessment panel already reads and
counts.

**Satisfied means every criterion in the lens at this stage is at Not
applicable, Buyer confirmed or Verified.** Unknown is plainly a gap. **Our
hypothesis is a real answer that is not yet confirmed and reads as a gap**,
which is a judgement the business took rather than arithmetic: a lens full of
hypotheses is not a lens to be confident in.

**STAGE SCOPED, not lens wide.** Criterion visibility marks the stages a
criterion can be answered at, and Commercial holds one criterion at
Qualification and seven at Proposal. Read lens wide, a record at Qualification
would be asked to satisfy six criteria that Qualification does not render, and
no action at that stage could change the answer. That is unactionable rather
than strict. The brief specified lens wide; measured on one record at one
moment the two readings returned `false` and `true`.

**THREE STATES AT THE RULE, not two with a rendering rule over them.**
`every()` on an empty array returns true, so a lens with nothing configured
computes SATISFIED on no evidence, and three of the four lenses are empty until
Round C. Returning early on an empty set is what makes "satisfied" and "nothing
to satisfy" different values rather than one value rendered twice.

**A FRACTION, NOT A TICK, and two separate constraints resolve to the same
answer.** Every other row in that card is a tick box against a label, so a tick
row would claim to be a requirement in a card where everything else is one. And
because the rollup is stage scoped, a satisfied lens becomes unsatisfied on
advancing a stage, correctly: **a vanishing tick says nothing about why, where
"1 of 1" becoming "6 of 7" says the stage brought six more criteria into
view.** The count is not decoration on the state, it is what makes the state
legible. Walked across both transitions on one record in Round 32 Phase 3.

**"None at this stage" rather than "0 of 0"**, because a zero fraction reads as
a measurement of nothing rather than as nothing to measure. The three-state
distinction survives into the wording rather than stopping at the rule.

**Cost: 152px on a card that is 420px wide at 1240, 1920 and 3440 and does not
grow.** Roughly 66px of that is the three empty lenses, which stop being empty
at Round C.

### The confirmation scale is three level, reversing Round 24

Round 33 Phase 1. **Round 24 recorded "Binary criteria remain two-state" as a
decision. This reverses it**, and the reversal is recorded here with the
superseded reasoning left visible, because Round 24 was right on what it could
see.

**What Round 24 could not see: the lens rollups did not exist.** They were
built in Round 32, and they made a two-state scale untenable for a reason
unrelated to the scale itself. A rollup is satisfied when every criterion in a
lens at a stage is at Not applicable, Buyer confirmed or Verified. **A
two-state scale has no Not applicable**, so a criterion that genuinely does not
apply to a deal had nowhere to say so and would have read as unsatisfied for
the life of the record. Nine criteria sit on this scale and eight are Legal,
where export control on a domestic deal, local content with no offset regime
and anti-corruption diligence with no intermediary are the ordinary cases.

**A second reason, independent of the rollup, and the one nobody had reached.**
The row says a criterion is unassessed BY SILENCE: no segment is filled.
Against five levels silence can only mean "no judgement". Against **Not
confirmed / Confirmed** silence reads as "not confirmed", which is a claim the
record has not made. **The unassessed state and the negative state were one
keystroke and no pixels apart.** A third level restores the distinction,
because silence is again none of the three.

**Renamed, because it is no longer binary.** `Binary confirmation` became
`Requirement confirmation, three level`, mirroring `Deal evidence, five level`
and naming the kind of claim it makes: a requirement, and whether it has been
discharged.

#### The values are 1, 2 and 4, and the gaps are the design

| Value | Confirmation scale | Evidence scale, same value |
|---|---|---|
| 1 | Not applicable | Not applicable |
| 2 | Not confirmed | Unknown |
| 4 | Confirmed | Buyer confirmed |

Each state takes the value of the evidence-scale state it is ordinally
equivalent to, so **one rule is correct for both scales with no special case**
and no second computation path.

**The obvious numbering is the one that breaks it.** Numbered 1, 2, 3, the
rollup's satisfying set of `{1, 4, 5}` would not contain Confirmed, because 3
is Our hypothesis. Measured rather than reasoned: `Set([1,4,5]).has(3)` is
false. **It would have broken in the direction that reports finished work as
outstanding**, which is the direction nobody investigates.

**The gaps at 3 and 5 are true statements about the scale.** A requirement has
no hypothesis state and nothing beyond confirmed to verify.

Safe on three counts, each checked rather than assumed: `scoring_scale_levels`
declares `unique (scale_id, value)` and no contiguity constraint;
`scoring_anchors.score` checks `between 1 and 5`, which all three satisfy; and
`src/lib/score-entry.js` validates with `allowed.includes(score)` over the
configured values rather than a range, which is Round 24's own "score <= 2 made
data-driven" paying off.

#### Writing the two descriptions restored Round 30's anchor split

The scale carried **no descriptions on either level**, deliberately, because
nothing pointed at it. `wordingFor` resolves `anchorSet[value] ?? description
?? ''`, so before this phase every criterion on this scale would have needed
per-criterion anchors at every level or the hover would have opened an empty
box. **Round 30's split, which retires middle anchors to the generic scale
wording, was unavailable to it.**

With the descriptions written the split works: measured on a probe criterion
carrying anchors at 1 and 4 only, hovering Not confirmed reads *"Not confirmed,
the requirement is open or unmet"* from the scale.

**CORRECTED IN PHASE 3: the sentence above described Round 30's split as
something that had happened, and it has not.** Phase 1 wrote that claim into
this document, inherited from Round C's brief, which inherited it from Round
31's brief, which stated that "Round 30's retirement decision kept 15". Read
from the live table in Phase 3, **all seven Commercial criteria carry anchors
at all five scores, at both versions**: 35 rows at version 2, not 14. Round 31
Phase 2 reversioned all 35 and its own report says so, so the data was never
wrong. The claim about the data was.

**The split is a capability, not a precedent.** It works, it is now available
on both scales, and it has never been used. See the anchor-drafting decision
below.

**The wording is a proposal the business corrects**, under the standing rule
recorded for the Commercial seven: code can write it, the business judges it in
use. The evidence scale grades how strongly something is evidenced and rises
through who said it. This scale asks whether a requirement has been discharged,
so its wording names the requirement rather than the source of belief.

**Left unchanged and flagged rather than decided:** `reason_required` is false
on all three levels. Whether Not confirmed should require a reason the way
Unknown does on the evidence scale is a business decision this phase did not
take.

### Six criterion names wrap, and the cell is not widened

Round 33 Phase 2, decided rather than deferred.

Six of Round C's twenty-three names exceed the 230px the criterion cell gives a
name, the widest being "Anti-corruption and integrity due diligence" at 281px
against a cell Round 30 sized to the 227px of the longest name of that day.

**Measured at 1240, the binding width: the cell can grow by exactly 51px before
the value cell is forced off the line, and the widest name needs exactly 51px.**

**That is a coincidence, not a fit, and it is why the cell is not widened.** A
cell that exactly accommodates today's longest name has no slack, and no slack
is the condition that produced this problem in the first place: 258px was
exactly right for the seven names that existed in Round 30. **Twenty-five more
criteria are the visible future**, between Round D's creation checks and
whatever follows, so spending the last pixel now buys one round.

**Accepted instead: the wrap.** Six rows are 20px taller. Measured on the Legal
lens, four wrapped names take the panel from 769px to 959px at 1240, against
879px for eight unwrapped ones. The cost is height on a panel that scrolls,
against a column that breaks on the next name added.

**The alternative left open is shortening the names**, which is the business's
to take and only genuinely helps one: "Anti-corruption and integrity due
diligence" is 51px over and the other five are between 2px and 17px over.

### Inline role creation: reconsidered against a live proposal, and refused

Round 35 Phase 0, 2026-08-27. **The 2026-08-15 three-tier buyer-role model above
stands unsuperseded**, and this entry records that it was tested rather than
merely left alone.

Round 35's brief proposed that a new role be creatable from the Key Customer
Contacts panel by any user, with a system-wide effect confirmation, citing the
Use Case Curation design's Industry escape valve as the precedent.

**The precedent does not transfer, in three ways that each matter on their own.**
It writes into Admin - Picklists, a screen `PROTOTYPE_SPECIFICATION.md` Section 7
puts out of v1 scope and which does not exist in this build, so a role created
badly could not be retired by anyone using this application. It is gated to a
CTO or CEO project role, with everyone else able only to flag "New industry,
needs review" and no ability to write. And it carries a mandatory six-character
code as deliberate friction, for which a role has no equivalent.

**So inline creation as proposed meant any user adding a permanent row nobody in
this app can remove.** Refused by the business on that finding. The role list is
admin-managed as rows, the same deferral `industries`, `terminus_staff`,
`stage_gate_rules` and `closed_lost_reasons` already carry: seeded by migration,
`GET`-only from the API, edited through Supabase's own editor until an Admin
module exists.

**One consequence, opened here and answered by the business the same day.** Tier
3 of the 2026-08-15 model is a free-text escape valve on the specific deal. A
configured list with no inline creation and no free text would leave no escape
valve at all, so this note originally recorded tier 3's survival as an open
question.

**TIER 3 SURVIVES. Answered 2026-08-27.** A free-text role sits alongside the
nine configured ones, and the business's reasoning is their own from the
original request: the list should grow as they work with different
organisations, and admin promotes the recurring ones into the catalog later.

**That is how the catalog learns what to add.** Admin-only with no free text
means a salesperson meeting a role outside the nine has nowhere to put them, and
nine roles will not cover every organisation. The free-text entry is the record
of a role the catalog does not yet have, which is the evidence admin needs in
order to add it.

**So the 2026-08-15 three-tier model is intact and unsuperseded**: core roles, an
admin-curated catalog, and a free-text escape valve on the deal. The admin-only
decision above applies to tier 2, as it always did, and never applied to tier 3.

### Pain Owner is a stance, and the roles are nine

Round 35 Phase 0, 2026-08-27. The business corrected a Phase 0 recommendation and
the correction is the record.

Phase 0 proposed Pain Owner as the tenth **role**, to close the gap against the
live Organisational criterion "Internal pain owner". **The business moved it to
stance instead: the person whose problem this is has a job title, and whose
problem it is is a posture**, which is the same argument that moves Champion out
of the role list.

**Roles, nine:** Executive Sponsor, Technical Buyer, Commercial Buyer,
Procurement, Legal, IT, Cyber Sec, QHSE, DPO. Every one names a function someone
holds regardless of this deal.

**Stance gains a seventh value.** Role is the function, stance is where they
stand, and stance is what the Organisational lens is scored against: "Political
dynamics" asks who gains and who loses, and "Champion identified" asks who is
selling this internally, neither of which a job title can answer.

**To establish rather than assume in Phase 2:** Champion and Pain Owner are not
mutually exclusive with Supporter, Sceptic and Blocker the way those three are
with each other. One person can be the pain owner and a sceptic. Whether stance
is therefore one field or two is a question for that phase, not an assumption to
carry into it.

### A gate that asked for exactly one now asks for at least one

Round 35 Phase 1, 2026-08-27.

`contact_role_linked` is the requirement type behind four live `stage_gate_rules`
rows, all of them Test Bed's: three on the Qualification exit (Client
Commercial, Technical and Legal Buyer) and one on Installation and Commissioning
(Test Bed Tech Team). Its evaluator in `computeBlocking` read the link with
`.maybeSingle()`.

**That was correct for every record that existed and could not survive the model
this round introduces.** Every writer of a `record_contacts` row wrote it into a
fixed slot, one role holding one contact, so no record was ever expected to hold
two. Round 35 replaces that on Opportunity with a list whose whole purpose is to
hold two technical evaluators, or a champion who is also the commercial buyer.

**`.maybeSingle()` errors on two rows, and the failure is not a wrong verdict but
no verdict.** The error falls through to `computeBlocking`'s `return { error }`,
and both callers turn that into a 500. So a second contact in a gated role does
not weaken the gate, it takes down `POST /records/:id/transition` and the
exit-criteria panel in `records.js` for that record.

Measured through supabase-js itself, the same client the route uses, across all
three states:

| rows | error | data | what the gate then does |
|---|---|---|---|
| zero | null | null | `met: false`, correct |
| one | null | a row | `met: true`, correct |
| two | `PGRST116` | null | `return { error }`, a 500 |

**And the condition is reachable through the product today, without this round.**
`POST /test-beds/:id/buyer-contacts` accepts a second contact in the same role
with a 201: there is no duplicate guard at the endpoint, and the Test Bed
batch-save path fires one call per dropdown. Two soft-deleted Test Beds already
hold Client Commercial Buyer twice. Only the soft delete is keeping this off a
live screen.

**Fixed by asking the question the rule actually asks.** The rule asks whether
anyone holds the role, so the query is `.limit(1)` and the verdict is
`(links?.length ?? 0) > 0`. One row is all the answer needs, and the query now
says so rather than fetching a set in order to be surprised by its size.

Proven live on a real Test Bed at Qualification carrying two contacts in one
role, with the fix stashed and restored and the server's own reload waited on
rather than a delay: `GET /records/:id/exit-criteria` returned **500 "JSON object
requested, multiple (or no) rows returned"** before and **200 with Commercial
Buyer = true** after.

**The error branch was checked rather than assumed**, because that is the branch
Architecture rule 8 says goes stale unnoticed. `step 3.0: a failed
record_contacts query returns an error, never a silent block` still passes: the
test's failing-client stub already answers both `maybeSingle` and a directly
awaited chain, so a genuine query failure still surfaces.

### Stance is one vocabulary on two axes, not one field and not two

Round 35 Phase 2, 2026-08-27. Established against the live Organisational
criteria rather than decided from the shape, which is what the phase was asked
for.

The seven stances are Champion, Supporter, Neutral, Sceptic, Blocker, Unknown
and Pain Owner. The question was whether they compete for one slot. Worked
through as pairs, asking of each whether a real person could hold both and
whether any configured criterion needs them to:

| pair | expressible | why |
|---|---|---|
| Champion + Supporter | no | points on one scale of active support |
| Supporter + Blocker | no | a direct contradiction |
| Champion + Sceptic | no | someone selling this internally is not hedging |
| Pain Owner + Champion | **yes** | the commonest good case |
| Pain Owner + Blocker | **yes, and a criterion needs it** | see below |
| Pain Owner + Unknown | yes | we know whose problem it is, not where they stand |

**"Political dynamics: who gains and who loses if this goes ahead" is what
settles it.** The head of operations owns the problem and blocks because the fix
costs their team headcount. One field records either the ownership or the
opposition and loses the fact that they are the same person, which is the whole
content of that criterion.

**So neither "one field" nor "two fields" is the answer as posed.** One field
cannot express Pain Owner with Blocker. Two hardcoded fields would put Pain
Owner in the schema, so the next orthogonal stance, a Gatekeeper who controls
access or a Coach who feeds us information, becomes a migration rather than a
row.

**One vocabulary, an `axis` column, and a link row carries at most one value per
axis.** `disposition` holds the six competing values, exactly one, defaulting to
Unknown. `stake` holds Pain Owner and is optional. A third axis is a row, and a
fourth value on an existing axis is a row. Deliberately not a CHECK, for the
same reason `closed_lost_reasons` took a foreign key over one.

**Asserted in the suite rather than described here**, as INVARIANT 12 in
`config-invariants.test.mjs`, because the constraint lives entirely in data:
moving Pain Owner onto the disposition axis would leave every query, route and
test passing while making that case unrecordable. Proven capable of failing by
injection, and the negative half is asserted too, so the test cannot pass
against a table where every row has a unique axis and nothing competes with
anything.

**What it still cannot express, recorded rather than papered over.** "Buying
committee mapped" asks who else has a say AND what does each of them want. List
plus role plus stance answers the first half, and no enumeration answers the
second. That half needs a free-text line per contact, and it is Phase 3's to
place.

### A configured role reference and a free-text role are two columns, not one

Round 35 Phase 2, 2026-08-27. The other thing this phase was asked to establish
rather than assume, and the live data answered it.

A configured reference plus a separate free-text column is one shape; a text
column that usually holds a configured label is another. **The question the
catalog exists for, "which roles do we cover on deals we win", is already broken
by the second shape**, measured across all 459 `record_contacts` rows:

```
"commercial buyer"  written 2 ways, 390 rows: 350 lowercase + 40 "Client Commercial Buyer"
"technical buyer"   written 2 ways,  31 rows: 28 "Client Technical Buyer" + 3 "Technical Buyer"

2 of 4 distinct roles are already split across more than one spelling.
A GROUP BY on that column returns 6 rows for 4 real roles.
```

**That divergence arrived with no free-text feature in the product at all**, from
two independently-built writers. Adding one to the same column would make it
worse by design.

**So `contact_roles` is uuid-keyed and the link row will carry
`role_id uuid references contact_roles(id)` for tiers 1 and 2 and `role_other
text` for tier 3**, exactly one of them set. "Which roles do we cover" becomes a
join, free-text entries are a visibly separate bucket rather than silent
misspellings of catalog members, and admin can see which text keeps recurring,
which is what makes promotion into the catalog possible at all.

**Phase 3 builds that link-row change**, and it has to reckon with
`record_contacts.role` being `not null` with a `unique (record_id, contact_id,
role)` on it. Test Bed's rows and the three live `contact_role_linked` gates
match on that column and must not move.

### The Key Customer Contacts panel is full width below the three, not a fourth card

Round 35 Phase 3, 2026-08-27. Read only in this phase.

**Phase 0 measured a fourth card in `.ref-cards` at all three widths and the
worst case is the common one.** At 1240 it pairs with Key Dates and costs
nothing until the list is long; at 3440 all four fit in one row; **at 1920 it
strands itself on a second row with two thirds of that row empty**, because
`#view-opportunity-detail .ref-cards` resolves to three 420px tracks there.

**The other half of the reason is that a list has no ceiling.** The three cards
above are each a known height. A panel that grows to eleven contacts inside a
fixed-height row forces the row rather than growing on its own.

`.ref-cards-wide` already exists for exactly this, `minmax(420px, 1fr)` with
`align-items: start`, and with a single child resolves to one full-width track.
Reused rather than given a new rule. Measured full width at every viewport: 876,
1556 and 3076px, sitting 28px below the three cards in all three cases, with no
horizontal overflow at any list length.

| contacts | panel height |
|---|---|
| 0 (empty state) | 185px |
| 1 | 131px |
| 4 | 291px |
| 11 | 590px |

**The trailing space at wide viewports is accepted and named.** At 3440 the data
columns occupy about 630px of a 3076px card. The first version made Role the
flexible column on the reasoning that a typed role has no natural length; looked
at, that was wrong, because the Role track resolved to 2594px and stranded
Linked at the far right of the row, a thousand pixels from anything it related
to. The columns now group left and a fourth empty track absorbs the slack, which
is what every dense list in this app already does. Phase 4's stance column and
the per-contact note the design record already calls for are what fill it.

### Showing every link is the panel's purpose, and the role is not uppercased

Round 35 Phase 3, 2026-08-27.

**The four fixed slots filter `record_contacts` to four title-cased strings, and
that filter is why the vocabulary diverged unnoticed.** All four live
opportunities carry a lowercase `commercial buyer` link, and not one of them has
ever appeared on screen. Nothing looked broken, so nothing was reported. Phase 2
measured the result: 2 of 4 distinct roles across `record_contacts` are already
split across more than one spelling.

Confirmed through the real UI on all four: the panel now shows each one, marked
as typed rather than catalog, with a derived legend.

**The role is rendered without `text-transform: uppercase`, a deliberate
departure from `.tag`**, which every other pill in this app uses. Uppercasing
renders `commercial buyer` and `Commercial Buyer` identically, which erases the
exact difference the panel exists to show. The stored value is shown as stored.

**A typed role is not a lesser fact about the deal.** Same size, same colour,
same weight as a catalog role; only the border differs, dashed against solid. It
is the record of a role the catalog does not yet carry, which is what tells admin
what to add. The escape valve is how the catalog learns, so treating it as an
error state would be backwards.

**One fetch, two derivations.** `GET /opportunities/:id` previously queried
`record_contacts` filtered to `VALID_OPPORTUNITY_BUYER_ROLES`. Rather than add a
second query that would agree today and drift later, the fetch is now unfiltered
and both `buyer_contacts` and `key_contacts` derive from it. The error is
checked, which the query it replaces did not do: a read whose error goes
unchecked renders as an empty list, and here that is indistinguishable from "this
deal knows nobody", the exact reading the panel exists to make trustworthy.

### The buyer-role select offers the wrong account's contacts after the first record

Round 35 Phase 3, 2026-08-27. Found while investigating an empty panel, not
looked for. **Pre-existing, in code Phase 5 removes. Reported, not fixed.**

`refAccountContacts` (`opportunity-reference.js`) is a module-level cache
guarded by `if (!refAccountContacts.length)`, so it is fetched once per page
load, filtered to whichever Opportunity was opened FIRST, and reused for every
subsequent one regardless of account.

Demonstrated on two live records with disjoint contact lists:

```
TT-SGP-MANUFI-002 account really has: Boon Sain
TT-SGP-SMARTC-002 account really has: Kim Zhang, Tan Jun, Wong Guang Shing

visited MANUFI-002 first, its select offers: Boon Sain
then SMARTC-002, its select offers:          Boon Sain
```

Opened on its own, SMARTC-002's select offers its own three. **The list follows
the page load rather than the record.**

**Not a data-integrity hole**, because `POST /opportunities/:id/buyer-contacts`
re-validates and returns 422 for a Contact of another Account. It is a control
that appears to offer something the server will refuse, which is the exact shape
Round 35 Phase 0 was asked about under "does `LINK` reach outside the account":
the answer is still no, and this is a picker that looks as though it might.

### What `record_contacts`' own constraints leave for Phase 4

Round 35 Phase 3, 2026-08-27. Established while reading the same rows this phase
renders.

`role text not null`, `unique (record_id, contact_id, role)`, no UPDATE policy,
a DELETE policy since Round 11 Phase 5, and `on delete restrict` on both foreign
keys to `records`.

1. **`role` cannot stay NOT NULL once a row carries `role_id` instead.** Dropping
   the NOT NULL is additive and leaves every existing row untouched, which is
   what keeps Test Bed's rows and the three live `contact_role_linked` gates
   working: the gate reads `.eq('role', role)`, so that column must survive as a
   column. The alternative, writing a denormalised label into `role` alongside
   `role_id`, creates two sources for one fact and goes stale the moment admin
   renames a catalog row.

2. **The unique constraint stops constraining once `role` is null**, because
   Postgres treats nulls as distinct in a unique constraint by default. Phase 4
   needs partial replacements on `role_id` and on `role_other`. **This is stated
   as a property to verify in Phase 4, not one verified here**: no row with a
   null role exists yet, so it cannot be tested until Phase 4 creates one.

3. **There is no UPDATE policy, so a stance cannot be changed in place.** The
   table's own comment records that as deliberate: a wrong link is corrected by
   adding the right row. But a stance genuinely changes over time, which is the
   point of recording it, and delete-plus-insert loses that history unless
   something else keeps it. Phase 4 decides between an UPDATE policy and an
   append-only stance history, and the decision belongs in the open rather than
   inside whichever is easier to build.

### Round 11 Phase 5 met the `.maybeSingle()` fault, diagnosed it exactly, and fixed the instance

Round 35 Phase 4, 2026-08-27. Found while reading `record_contacts`' own
policies for an unrelated reason. **Build discipline rule 8, twenty-four rounds
before the class was fixed.**

`20260819000012_record_contacts_delete_policy.sql` records, in its own header:

> the delete removed nothing, so links ACCUMULATED, and two rows for the same
> (record_id, role) then made the `contact_role_linked` branch's own
> `.maybeSingle()` return an error, turning a working gate into a 500.

**Every word of that is the fault Round 35 Phase 1 fixed.** Round 11 reached it
from the other side, understood it completely, and fixed what had produced the
second row: it added the missing DELETE policy so links would stop
accumulating. **`.maybeSingle()` was left as it was**, because with duplicates
no longer being created it stopped mattering.

**The fix was scoped to the event rather than to the class**, exactly as rule 8
describes. The rule then held for twenty-four rounds because nothing else
created a duplicate, and Round 35's whole purpose is a panel that creates them
deliberately.

Nothing here is a criticism of that round's work: the diagnosis is better than
most, and it is written down, which is why this could be found at all. The
lesson is narrower and worse. **A correct diagnosis recorded in a migration
header is not a fix, and the thing it names goes on being true.**

### The stance shape: an append-only table, and the reasoned departure named

Round 35 Phase 4, 2026-08-27.

The instruction was to follow the assessment score pattern rather than invent a
second shape. A score entry is `{ at, by, value, comment? }` appended to an
array in the record's payload through `append_record_revision`, never mutated,
current value = last.

**`record_contact_stances` is that shape. What differs is the medium, and the
medium is chosen by where the data belongs.** A score belongs to the record,
the record has a payload. A stance belongs to the LINK, and `record_contacts`
has no payload. Storing link data in the record's payload keyed by link uuid
gives opaque top-level keys and an orphaned key on every removal with nothing
to clean it up; and because `append_record_revision` merges shallowly at the
top level, the alternative of one nested object read and rewritten whole
reintroduces exactly the lost-update race that function exists to remove.

An append-only table carrying `created_by` and `created_at` is also the
dominant shape in this schema already: `record_revisions`, `approvals`,
`audit_log` and `record_contacts` itself are all precisely that.

**No UPDATE and no DELETE policy**, so append-only is enforced by RLS rather
than by discipline at the call site. Confirmed live against a user client: an
UPDATE and a DELETE by the record's own owner both returned HTTP 200 affecting
zero rows, and the entry was unchanged afterwards. **Calibrated by the three
inserts the same client had just made**, so the zero is the missing policy
rather than a broken client.

### The note lands with the stance, because it has the same question inside it

Round 35 Phase 4, 2026-08-27. The business agreed a per-contact free-text line
for "what does each of them want", to land in Phase 4 or Phase 5.

**Phase 4, and the reason is not convenience.** The note has the same
mutability question stance has, and answering that question twice in two phases
is how a second shape gets invented. A score entry already carries an optional
free-text `comment` beside its value; this is that slot.

**So an entry is one observation**: where they stand, optionally what they want,
at a time, by someone. Updating only the note appends an entry repeating the
stance, which is honest rather than wasteful, because it is a new reading made
at a new time by a named person, and that is what the Organisational lens is
scored against.

**One entry per action, in the interface too.** Changing either control arms
that row's Record button and clicking it writes one entry. Two controls saving
independently would make "the note changed" and "the stance changed" separate
history when they were one reading.

### What a stance history shows in the panel, and where it lives

Round 35 Phase 4, 2026-08-27. These are two questions and the answers differ.

**The row reads the CURRENT stance**, because that is what someone scanning a
buying committee needs: eleven rows each answering "where does this person
stand" at a glance.

**The history hangs off a count that appears only when there is more than one
reading.** Every link opens at Unknown, so one reading is the floor rather than
a fact, and a "1" beside every row is noise. `2 readings` appearing exactly
where a stance has moved is a signal, and the full history, each entry with its
date, stance and note, is the tooltip on it.

**It does not get a column.** Most rows would leave it empty, and a column that
is usually empty costs the width that the note now uses.

### Remove and stance-change are different operations, structurally

Round 35 Phase 4, 2026-08-27.

Opportunity had no unlink endpoint at all and `record_contacts` has no UPDATE
policy, so this phase had to build removal and decide what it means.

**They touch different tables.** `DELETE .../key-contacts/:linkId` deletes a
`record_contacts` row; `POST .../key-contacts/:linkId/stance` inserts into
`record_contact_stances`. Nothing can do one while meaning the other, which is
a property of the shape rather than of care at the call site.

**Removal cascades the stance entries, so the endpoint copies them into
`audit_log.detail` first.** `on delete cascade` rather than `restrict` because
restrict would make any link with a stance recorded permanent. `audit_log`
references `records` rather than the link, so the copy survives. **That one
audit write is the only one in the file whose error is returned rather than
logged**: deleting the link after failing to record its history would lose the
history silently, which is the opposite of what an append-only stance is for.

### A near-miss of a catalog role is refused at input, and reported when stored

Round 35 Phase 4, 2026-08-27. Two jobs that look like one.

**Classifying a stored row does not fold case.** `commercial buyer` against a
catalog holding `Commercial Buyer` is genuinely a role typed on the deal, and
saying so is what surfaces the divergence Phase 2 measured across 459 rows.

**Refusing new input does fold case**, because this is the only moment at which
a near-miss can be prevented rather than merely reported. Typing `legal` when
`Legal` is in the catalog returns 422 naming the catalog role.

### The four fixed buyer slots are retired, and that is what fixes "Sel"

Round 35 Phase 5, 2026-08-27.

Removed entirely rather than hidden: `BUYER_ROLES`, `renderRefBuyerRows`,
`window.linkRefBuyer`, `refAccountContacts`, the `#ref-buyer-rows` markup and
its `ref-buyer-select-*` / `ref-buyer-feedback-*` ids,
`VALID_OPPORTUNITY_BUYER_ROLES`, `POST /opportunities/:id/buyer-contacts`, and
`buyer_contacts` from the Opportunity GET.

**Verified by counting to zero with the counter calibrated**, because Round 10
left two containers behind and both reached the business. Six selectors read
zero on the live page; the same six read one after a matching element was
injected, and zero again after it was removed. `window.linkRefBuyer` is
`undefined`; `openInlineBuyerContactModal` is still a function, because Test
Bed uses it.

**THE TRUNCATED CONTROL GOES WITH THE SLOTS, AND THAT IS THE FIX.** Phase 0
measured the select at 41px of the 256px it needs, 16%, identical at 1240, 1920
and 3440 because it was a fixed collapse rather than a responsive squeeze, and
established that removing `LINK` would return only 67px and reach 108px, still
42%. **The 196px control column was the constraint, so nothing short of
replacing the row could fix it.** Measured again after the retirement, the
Reference tab's remaining selects are 320px of the 256px they need and 220px of
137px. The truncation is not improved; the control it afflicted no longer
exists.

**The four live `commercial buyer` rows were DELETED, not migrated**, on the
business's standing instruction that test data is deleted rather than
preserved. All four came from the Milestone 3 backfill, whose own migration
says of the role: *"this is a default, not a verified fact"*. None carried
`role_id` or `role_other`, so none was written by the new panel, and none had a
stance entry. Re-queried afterwards: zero rows remain on live Opportunities,
and `record_contacts` still holds 455, all Test Bed's.

### "+ New" survives the retirement, because it was the slots' one real capability

Round 35 Phase 5, 2026-08-27.

Phase 0 established that `LINK` did nothing the select did not, so removing it
removed nothing. **`+ New` is different**: it creates a qualified Contact
without leaving the deal, orchestrating four already-proven endpoints in
sequence. Retiring the slots without it would have taken that away silently,
which is not what "retire the slots" asked for.

`openInlineBuyerContactModal` is shared with Test Bed and stays one
implementation. Its step 4 now branches on record type, because the two link
differently: Test Bed by one of three hardcoded role strings, Opportunity by a
catalog `role_id` or a `role_other` typed on the deal.

**That makes Test Bed reachable, so it was checked rather than reasoned about,
and the check is stronger than a pixel comparison would have been.** A fixture
Test Bed was created and the shared modal driven end to end through the real
`+ New` button: the Contact was created, linked to the Account, transitioned to
Qualified through the ordinary gate, and appeared in the slot. The link it
wrote carries `role` as text with `role_id` and `role_other` both null, so Test
Bed's model is untouched by a change to the function it shares.

### Enumerating teardown from the database is necessary and not sufficient

Round 35 Phase 5, 2026-08-27. **A refinement to Verification rule 11, found by
it failing.**

Rule 11 says to enumerate teardown from the database by a tag the fixtures
carry, never from a file the harness wrote, because a rebuild leaves records
the file no longer names. This phase enumerated from the database and **still
nearly left a live Contact on a business Account**, because the query that
enumerated it read `record_revisions` with no `Range` header and saw 1000 of
15,800 rows.

**The teardown then reported clean, and it was clean about the empty set it had
been given.** The same truncation made an assertion fail that was actually
true: the Contact existed, was Qualified, and was on the right Account, and the
probe that said otherwise had simply not looked at the page containing it.

This is Round 34 Phase 2's paged scan arriving in a new place, and the earlier
entry framed it as a scanning problem. **It is a teardown problem too, and that
direction is worse**, because a scan that under-reports produces a wrong
finding somebody may notice, while a teardown that under-reports produces
residue nobody is looking for.

**The check: a teardown enumeration is a scan, so it carries every obligation a
scan carries.** Page it, and confirm the population it walked is the whole
population, not the first page of it.

## Round 35 close-out: Key Customer Contacts

2026-08-27. Seven phases, 0 through 6. Opportunity's four fixed buyer slots are
replaced by a list of people, each carrying a role from a configured catalog or
typed on the deal, and an append-only stance carrying what they want.

### A correct diagnosis recorded in a migration header is not a fix

**The round's most valuable finding, and it is about this project rather than
about contacts.** `20260819000012_record_contacts_delete_policy.sql`, Round 11
Phase 5, records in its own header:

> the delete removed nothing, so links ACCUMULATED, and two rows for the same
> (record_id, role) then made the `contact_role_linked` branch's own
> `.maybeSingle()` return an error, turning a working gate into a 500.

That is precisely what Round 35 Phase 1 fixed, **twenty-four rounds later**.
Round 11 reached it from the other side, understood it completely, and fixed
what had produced the second row: the missing DELETE policy. `.maybeSingle()`
was left alone, because with duplicates no longer created it stopped mattering.
Build discipline rule 8: **the fix was scoped to the event rather than to the
class**, and it held until a round whose whole purpose is creating duplicates
deliberately.

**It pairs with two earlier findings and the three together are one pattern:**

| round | form |
|---|---|
| 29 | a written rationale is not a guard |
| 33 | a recorded decision is not a record of what happened |
| 35 | a correct diagnosis recorded in a migration header is not a fix |

All three are the same shape: **prose that is true, kept next to code that does
not enforce it, and the prose keeps being true while the thing it describes
stops being safe.** The Round 11 case is the sharpest because the prose is not
merely true, it is a complete and accurate diagnosis of the exact fault, sitting
four directories from the line that carries it.

### A teardown enumeration is a scan, and carries every obligation a scan carries

Phase 5. **Not promoted to `CLAUDE.md` on one instance; recorded here as a
promotion candidate if a second appears.**

Verification rule 11 says to enumerate teardown from the database by a tag,
never from a file. Phase 5 did exactly that and **still nearly left a live
Contact on a business Account**, because the enumerating query read
`record_revisions` with no `Range` header and saw 1000 of 15,800 rows.

**The teardown then reported clean, and it was clean, about the empty set it had
been handed.**

The refinement: *an under-reporting scan produces a wrong finding somebody may
notice, while an under-reporting teardown produces residue nobody is looking
for.*

**And the failure was the evidence that found it.** The same truncation made an
assertion fail that was actually TRUE: the Contact existed, was Qualified, and
was on the right Account. Had that assertion passed, the residue would have gone
unnoticed. A probe wrong in the safe direction is how the probe got checked.

### The axis model, and an invariant that exists because the constraint is data

Phase 2. Stance is one vocabulary on two axes, which is neither of the two
answers the question offered. One field cannot express a Pain Owner who is also
a Blocker, and the live Organisational criterion "Political dynamics: who gains
and who loses if this goes ahead" exists to record exactly that person. Two
hardcoded fields would put Pain Owner in the schema and make the next orthogonal
stance a migration rather than a row.

**INVARIANT 12 exists because the constraint lives entirely in data.** Moving
Pain Owner onto the disposition axis would leave every query, route and test
passing while making that case unrecordable. Proven capable of failing by
injection, **and its negative half is asserted too**, so it cannot pass against a
table where every row has a unique axis and nothing competes with anything.

### The live data answered a question posed as a design choice

Phase 2. Whether a free-text role shares a column with a configured one was
posed as a shape decision. It was already decided, in the data:

```
"commercial buyer"  written 2 ways, 390 rows: 350 lowercase + 40 "Client Commercial Buyer"
"technical buyer"   written 2 ways,  31 rows: 28 "Client Technical Buyer" + 3 "Technical Buyer"

2 of 4 distinct roles already split across more than one spelling.
A GROUP BY returns 6 rows for 4 real roles.
```

**With no free-text feature in the product at all.** The divergence came from two
independently-built writers. So `role_id` and `role_other` are separate columns.

### The role is not uppercased, because `.tag` would erase the difference

Phase 3. Every other pill in this app is `text-transform: uppercase`. That
renders `commercial buyer` and `Commercial Buyer` identically, which is the one
difference the panel exists to show. The stored value is shown as stored, and
that is the only deliberate departure from `.tag`.

**Related, and the same principle applied twice in opposite directions:**
classifying a stored row does NOT fold case, because a near-miss is a real fact
about the deal; refusing new input DOES fold case, because that is the only
moment a near-miss can be prevented rather than reported.

### `refAccountContacts` followed the page load rather than the record

Phase 3, found while investigating an empty panel. A module-level cache guarded
by `if (!length)`, so after opening one Opportunity every later one offered the
FIRST one's account contacts. Demonstrated on two records with disjoint lists.
Not a data-integrity hole, since the server returned 422; **a control that
appeared to offer what it could not deliver.** Removed with the slots in Phase 5,
and the replacement keys its cache on the account.

### Zero media queries, so the first one did not arrive here

Phase 4. The note began as a seventh column: 568px at 1920, 2088px at 3440, and
**twelve pixels at 1240**, because six fixed tracks plus six gaps need 958px of
the 876px that width gives. A breakpoint would have fixed it. **The stylesheet
contains none at all** - the whole app adapts through `minmax()` and `auto-fit` -
so the note became its own dimmed second line instead. **Establish the
convention before departing from it.**

### The two standing changes the business made this round

Both apply to **data and process, not to shape**:

1. **Test Bed pixel-identical is no longer an every-phase requirement.** Keep it
   where a phase touches shared CSS or a shared function; where a phase
   demonstrably cannot reach Test Bed, establish that and skip it. Round 32
   Phase 2's three-way blind check is the argument: a comparison on a page with
   none of the elements under test proves nothing and costs a calibration.
2. **Test data is deleted rather than migrated.** Pre-revenue; the records here
   are fixtures, not trading history. The exception is anything a real deal was
   worked through, and the instruction is to ask rather than preserve.

**Schema, vocabularies, append-only history and gate semantics stay as careful as
they have been, because shape is cheap now and expensive once the business is
trading.**

### `state-dump.mjs` dumps no configured vocabulary table at all

Its eleven configuration sections are `stage_definitions`, `stage_gate_rules`,
`scoring_criteria`, `scoring_anchors`, `stage_reference_docs`,
`approval_tracks`, `routing_rules`, `conversion_criteria`,
`stage_probability_defaults`, `approvals` and record counts.

**So the nine roles and seven stances do not appear in `CURRENT_STATE.md`**, and
neither do `industries`, `terminus_staff`, `closed_lost_reasons` or
`scoring_lenses`. Confirmed by search on the regenerated file: `Executive
Sponsor` and `Pain Owner` both read 0, while `Champion identified`, a
`scoring_criteria` row, reads 2, which is the calibration that the file does
print row content for tables it covers.

Pre-existing, not created by this round, and reported rather than fixed: it
touches six tables and belongs to whoever picks up the generator.

---

## Round 38: approval is of a version, and what that makes load-bearing

2026-08-29. Decided by the business, recorded here because two consequences of
it are structural and must not be unpicked by a later round that reads only the
code.

### The decision

**A Commercial approval is of a VERSION, not of a revision.**

A revision is a save. Thirty of them can mean nothing, and a person cannot sign
a save. A version is the commercial object: self-sufficient, reproducible,
carrying its own catalog rates and a mandatory reason, and it is the thing that
goes to the customer.

**The engine is not forked to say so.** `approvals` stays keyed to
`(record_id, revision_number, track, approver_id)`, which is deliberate and
record-type agnostic: Test Beds, Contacts and Opportunities all approve through
one mechanism, and a second approvals table keyed to a Commercials-only concept
would be exactly the parallel structure Architecture rule 1 forbids.

The **version** carries the link instead:
`deal_sheet_versions.revision_number`, added in
`20260829000001_version_carries_its_revision.sql`. Approving V1.2 is approving
the revision V1.2 names, and those are the same act rather than two that must be
kept in step.

### Consequence 1: SAVE-THEN-VERSION IS NOW LOAD-BEARING. Do not unpick it.

Round 38 Phase 1 made taking a version save the record first. At the time the
argument was traceability: Phase 0 had measured a version capturing unsaved
input, so a version could cite figures the record never held, and a traceability
record that cannot be checked against anything is not one.

**That is no longer the only argument, and the new one is stronger.** The
version's `revision_number` is meaningful **only** because save-then-version
guarantees the version was taken from the record as saved. Separate the two and
the version holds the payload that was on screen while naming a revision holding
something else, and every approval downstream is an approval of a document
nobody can reproduce.

So the reasons now stack, and the weaker one is the one that reads as optional:

- **Traceability** (Round 38 Phase 1): a version must cite figures the record
  actually held.
- **Approval** (Round 38, here): a version must NAME the revision that holds
  them, and the name is only true because of the rule above.

A future round finding save-then-version inconvenient - it makes taking a
version write a revision, which looks like noise in the history - is looking at
the cost without the second reason. **Splitting them silently breaks approval,
and nothing would fail at the moment of the split.** The version would still
save, still carry a number, still render; only the correspondence between the
number and the contents would stop being true, and no test can see a number that
is merely wrong rather than absent.

### Consequence 2: ANY REVISION AFTER APPROVAL VOIDS IT

An approval given at revision N stops describing the deal the moment revision
N+1 exists. It is **superseded**, and a new version must be taken and approved.

**Without this rule an approval means "something was once approved", which is
worse than no approval at all, because it looks like control.** A page showing
an approved badge over pricing that has moved since is a stronger claim than a
page showing nothing, and it is false.

**Derived, never stored.** `src/lib/version-approval.js` computes the state from
three facts that are already immutable: the version's revision, the approval
rows, and the record's current revision. Architecture rule 2 - computed values
are computed. A stored `superseded` flag would be a fourth thing to keep true,
and it would be the one people read.

The states are `unapprovable`, `none`, `rejected`, `approved`, `superseded` and
`inconsistent`. `inconsistent` exists so a version naming a revision the record
has not reached surfaces as a fault rather than folding into one of the others:
a data error must never be reachable as an approval.

### What is deliberately NOT changed

- Versions taken before this column exists carry `revision_number` null and
  **cannot be approved**. Not backfilled. The store is append-only and the one
  such row is `issued`, which the immutability trigger refuses to alter at all;
  the variance is absorbed at the read boundary, which is the same principle the
  numeric payload work settled in this round.
- The relabel guard `deal_sheet_versions_immutable()` gained `revision_number`
  in the same migration that added the column, because a guard that is complete
  for the columns existing when it was written is the fault that already
  happened once here, with `created_by_email`.
  `scripts/tests/version-guard.test.mjs` now fails if any future column is
  neither guarded nor explicitly exempted with a reason.

---

## Where a field belongs: the record, the catalog, and a version

2026-08-29, Round 38. Stated as a principle because it settles the placement of
every future field, and because the asymmetry it describes was found as a defect
report before it was recognised as a design.

> **The record holds what the deal decided.**
> **The catalog holds what things cost.**
> **A version holds both, frozen.**

### What it explains

`PATCH /opportunities/:id` refuses the ten catalog rate keys - `ssUnitCost`,
`aqUnitCost`, `hemirUnitCost`, `inSsExisting`, `inSsNew`, `inAqm`, `inHemir`,
`hoSafesight`, `hoAqm`, `hoHemir` - and the Commercials tab strips them through
`COMMERCIALS_OWNED_KEYS` before saving. **A record therefore never stores a
rate.** That reads as an artefact when you meet it in an error message. It is
policy.

An unapproved deal sheet should price at today's costs, because it is a live
quote and the business's costs are what they are today. An approved version
should price at the costs it was approved against, because an approval is of a
document and a document does not move.

**A version's self-sufficiency is a consequence of this, not a coincidence.**
`inputs` carries the decision and the costs together, so
`buildDealInputs(version.inputs)` reproduces exactly what was signed, with no
lookup and no assumption. That is what makes block 2's cost-basis step a real
number rather than a definitional zero, and it is why
`deal_sheet_versions_has_cost_basis` refuses a version with no rates: a version
carrying only half the pair is not the thing this principle describes.

### Where a new field goes

- **Something a person decided about this deal** - a quantity, a term, a margin,
  a structure: the record's payload, and it appears in a bridge step.
- **Something that is true of the world and priced into every deal** - a unit
  cost, an install rate, a hosting rate: the catalog, never the payload.
- **Both, at a moment** - the version, and only ever written at creation.

### THE CONSEQUENCE, NAMED AND OWNED. Phase 3.

**A catalog change is an unannounced re-price of every live deal.**

Change a unit cost in Base Cost Data and every unapproved deal in the system
prices differently from that moment. There is no revision, no `audit_log` entry
against any Opportunity, and nothing said to any owner. A salesperson who saw
30% last week opens the deal and sees 27%, and **no explanation is available
anywhere on the screen** - not in Notes, not in the version list, not in the
revision history, because nothing about that deal changed.

The default is right. The invisibility is the fault, and this round created it by
making the pricing path correct: before Round 36 the rates were never read at
all, so nothing moved because nothing worked.

**The control, for Phase 3:** when a batch turns over, the system knows which
live deals it moves and by how much, and tells their owners. It has everything it
needs to compute that already - every unapproved Opportunity's payload, the old
batch and the new one, and one shared translation - so this is a notification
and a diff, not new arithmetic.

Two things it must not become: a block on changing costs, and a stored
recalculation. Costs change; the system's job is to say so.
