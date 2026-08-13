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

**Mandatory fields at creation (`Unqualified`):** Name, Company, Email, Mobile, Industry, Source (Web, Email Inquiry, Referral, Direct Outreach, Marketing Campaign), and a free-text Summary of what the business believes this person's interest in Terminus is, with respect to solution and use case. This is a deliberately small set, capturing what's realistically known at first contact, not the full Contact record.

**Qualification gate, `Unqualified` → `Qualified`:** enforced by `stage_gate_rules` requiring every mandatory field above to be complete before the transition is allowed, since a "qualified" Contact with gaps in its basic details isn't meaningfully qualified. **Budget, timescale, and intent are explicitly not system-checked**, that's a sales judgement call, not a data-completeness check, and this system has no opinion on it.

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
      - Deal Sheet (record_type = 'deal'), actively developed and
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
  billing. Has its own owner_id, its own Contacts, its own Documents
  (NDA, Site Assessment, Partnership and Test Bed Agreement, and
  Compliance and Data Protection, CaDP, which itself bundles APD and
  DPIA, these four are also its Planning sub-stages, see Section 8,
  same records serve both as documents and as gated stage steps),
  and its own reference code (Section 8), because it genuinely is
  its own thing, not because the schema forces it to look that way.
  stage (defined in `stage_definitions` for record_type = 'test_bed',
    no variant needed, there is only one Test Bed lifecycle): Planning
    (four sequential sub-stages) → Deployment → Monitoring and
    Analysis → Close out Review → Decommissioning → Closed, full
    detail and the heavier gate on the final transition in Section 8.
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

Nothing here is a special case. Neither Opportunity nor Test Bed is more fundamental than the other, they're both records like any other, one happens to be the `parent_record_id` for sales documents, the other for R&D documents. The workflow engine that moves a Deal Sheet through Draft → Submitted → Approved is the identical code path that moves an Opportunity through its stages, a Test Bed through its own entirely different ones, or a Deployment through Commissioning, it has no idea what any of them mean.

**This system will grow well beyond sales, expenses, timesheets, and whatever comes after that, and the model needs to hold for those without rework.** A concrete check, not just an assertion: an Expense claim is `record_type = 'expense'`, no `parent_record_id` (it doesn't belong to an Opportunity), one required approval track (Manager) via a single `stage_gate_rules` row, submitted by the employee who owns it. A Timesheet is the same shape, `record_type = 'timesheet'`, its own approval track, its own payload. Neither needs a new table, a new approval mechanism, or a new audit log, they're both just new rows in `stage_gate_rules` and a new payload shape, exactly the "new modules extend, they don't fork" rule already states. If a future module ever *does* need something the current schema can't express, that's the signal to revisit the generic model itself, not to bolt on a one-off exception for that module alone.

| Table | Purpose |
|---|---|
| `records` | `id`, `record_type`, `parent_record_id` (nullable, e.g. a Deal Sheet's parent is its Opportunity), `status`, `owner_id`, `created_at`, `updated_at`, `industry_id` (nullable, references `industries`, a real FK needing referential integrity, not a payload key, added when Contact/Account were built but generic to any record type), `deleted_at` (nullable, soft delete, see below) |
| `industries` | `id`, `name`, `short_code` (6 characters, matches Section 9's reference-code format). Small, admin-managed reference data, same category as `approval_tracks`, not a business object with its own lifecycle. Select-only RLS for authenticated users, no write policy yet, admin-edited directly for now, same deliberate deferral as `stage_gate_rules` config (Build Order item 8). Standalone table, not folded into Contact or Account, so Section 7's future Taxonomy can extend it with `classification` and `use_case` tables referencing `industry_id`, rather than needing a second, disconnected industry concept. |

**Soft delete, `deleted_at`:** the correct way to let a record stop appearing in normal views without violating Section 1's own immutable-audit-trail and no-silent-overwrites principles. A `deleted_at` timestamp, hidden from default list views and roll-ups, `record_revisions` and `audit_log` stay completely untouched, nothing is ever actually removed. First used for Contact (letting genuinely time-wasting or out-of-space entries stop cluttering the working list, distinct from `Parked`, which is for real interest that isn't viable yet), but the column lives on the generic `records` table, any future record type gets this for free, no new migration, no cascading deletes, no new DELETE RLS policies needed.
| `record_revisions` | `record_id`, `revision_number`, `payload` (JSON, shape depends on `record_type`), `created_by`, `created_at`. Immutable once written. |
| `approval_tracks` | `track_name` (Legal, Commercial, Sales, Technical, Finance, or whatever gets added later), admin-defined, not hardcoded in application code |
| `approvals` | `record_id`, `revision_number`, `track` (references `approval_tracks`), `tier` (nullable, only tracks with escalation logic like Commercial use this), `approver_id`, `decision` (a tick box: approved / rejected), `comment` (free text, expected especially when rejected), `decided_at` (timestamp) |
| `audit_log` | `record_id`, `record_type`, `action`, `actor_id`, `timestamp`, `detail` |
| `roles` | `user_id`, `record_id` (nullable, set for instance-specific assignments like "Technical approver on *this* Opportunity"; null for type-wide defaults), `record_type` (nullable, `null` means the role applies globally, across every record type, e.g. `admin`, rather than one specific type), `track` (which `approval_tracks` entry this person can approve for), `role` (`owner` / `reviewer` / `approver` / `viewer` / `admin`) |
| `system_roles` | `user_id`, `role` (`admin`, extensible for future system-wide roles). Deliberately separate from `roles`, `roles` grants permission over a specific record or record type, `system_roles` grants permission over the system's own configuration, who can edit `stage_gate_rules`, `stage_definitions`, `product_defaults`, and similar, not any one record. Confirmed: `admin` is a single general permission, no finer-grained tiers needed yet. |
| `routing_rules` | `record_type`, `track`, `condition` (e.g. discount % band), `required_tier`, computes *which tier within a track* is needed, only relevant for tracks with escalation logic (Commercial today). Tracks without escalation (Legal, Technical) just use a direct `roles` nomination, no tier needed. |
| `stage_definitions` | `record_type` (`opportunity`, `test_bed`, extensible), `variant` (nullable, most record types don't need one), `stage_name`, `sort_order`, `phase` (nullable, groups several fine-grained stages under one recognisable higher-level name for reporting and UI, e.g. Test Bed's four Planning sub-stages all carry `phase = 'Planning'`, while stages that aren't part of a broader grouping leave this null). Defines the valid, ordered stage list for that record type. **This exists because a real bug was found in testing**: Opportunity and Test Bed were originally modelled as one record type with a mutable `type` field and a shared stage list, both assumptions were wrong, they're genuinely separate record types (Section 2) with genuinely separate stage lists, Opportunity's Discovery through Closing, Test Bed's Planning through Closed (Section 8). This table is what makes each record type's stage list data-driven rather than hardcoded. |
| `stage_gate_rules` | `record_type`, `variant` (nullable, most record types don't need one, kept generic in case a future record type does), `from_stage`, `to_stage`, `requirement_type` (`document_status`, `approval_obtained`, `child_record_status`, `payload_field_required`), `requirement_detail` (JSON, e.g. `{track: 'Legal'}` for an approval requirement, `{field: 'followUpDate'}` for a field-completeness requirement). A gate can have any number of `approval_obtained` rows, one per required track, admin-configurable, not fixed at two. **All** required tracks must reach `decision = approved` before the transition is allowed, and there is no required order between them, they can be requested and completed in parallel. `from_stage`/`to_stage` values must be valid entries in `stage_definitions` for that record's `record_type` (and `variant`, if it has one). **`payload_field_required` checks a named field is present and non-empty**, read from the current revision's payload for most fields, but from the `records` row directly for the two fields that are real columns rather than payload keys (`parent_record_id`, `industry_id`), the transition endpoint knows which is which. Used for Contact's Parked follow-up date and its Qualification gate (Section 2).
| **Invariant, found and closed the hard way**: `POST /api/records/:id/transition` **must reject every `to_stage` when a record type has zero `stage_definitions` rows**, not treat an empty list as "anything goes." A record type with no seeded stage list previously let its status be set to literally anything, unvalidated, this was found when a Lead's real status was accidentally corrupted while regression-testing the Contact migration, corrected immediately and the incident logged to `audit_log` rather than erased. **Any new record type must have real `stage_definitions` rows before its transitions will work at all**, this is now a hard requirement, not a nice-to-have, worth remembering when Build Order's later items (Risk Register, Pilot, Deployment, and beyond) get built. |
| `conversion_criteria` | `from_record_type` (`contact`, `test_bed`), `to_record_type` (`opportunity` or `test_bed`, a Contact can convert to either), `condition`, same data-driven pattern as `stage_gate_rules`, kept separate since converting *between* record types is a different action than progressing *within* one. **Not** used for Lead-to-Contact, that's a stage transition on one record, not a conversion, see Section 2's Lead/Contact/Account subsection. |
| `record_contacts` | `record_id` (the Opportunity or Test Bed), `contact_id`, `role` (commercial buyer, end user, technical buyer, IT/Security, procurement, and others). Many-to-many, not `parent_record_id`, since one Contact can hold roles across more than one Opportunity or Test Bed over time, see Section 2. |
| `stage_probability_defaults` | `record_type` (`opportunity`), `stage`, `default_probability_pct`. Admin-editable, same data-driven pattern as the rest. Sales leadership can retune what "normal" looks like per stage without a code change. Opportunity-only, Test Bed has no probability concept, it isn't a sales pipeline. |
| `product_defaults` | `product_type` (`SafeSight`, `AQ Sensor`, `HEMIR`, extensible), `unit_cost`, `mount_cost_new`, `mount_cost_existing` (nullable, null means this product has no existing/new distinction, `mount_cost_new` is used as its single flat rate, this is how AQ Sensor works today), `hosting_cost_default` (flat monthly hosting cost per unit, the current placeholder model, see Section 6 for its known limitation). Row-based, not hardcoded columns, so a future product is a new row, not a schema change. HEMIR gets a row now, even before HEMIR itself is a built module, so its defaults exist when it's needed. |
| `system_defaults` | `key`, `value`. Singleton admin-configurable values, first entry `target_profitability_pct`. Generic key/value shape so future one-off settings don't each need their own table. |

A Deal Sheet is `record_type = 'deal'` with `parent_record_id` pointing at its Opportunity. Its payload holds everything currently in the calculator, SafeSight(TM) counts, discount %, payment structure, and so on.

**Promoted fields on Opportunity, same exception as serial number and reference code:** `probability_pct` and `forecast_close_date` are real, indexed columns on the Opportunity record, not buried in the JSON payload, since pipeline forecast reporting (weighted and unweighted) will sum, filter, and group by both constantly. Parsing JSON for every report query would be the wrong trade-off here. Opportunity age and days-since-last-update need no new storage at all, both are just `today minus created_at` and `today minus updated_at`, computed at display time from fields the generic `records` table already has.

**Probability behaviour:** when an Opportunity's stage changes, `probability_pct` auto-populates from `stage_probability_defaults` for the new stage. Between stage changes, it's freely editable, a deliberate override for that specific Opportunity (a sales person's read that this one's better or worse odds than the stage average). The *next* stage change resets it to the new stage's default again, overrides don't silently persist forever and quietly stop reflecting what's actually normal for that stage.

**Probability governance:** only the Opportunity owner or a user holding `commercial_approver` on that specific Opportunity may change `probability_pct`. If the new value differs from the current stage default, a justification (free text, required, not optional) must be entered before the change saves, explaining why this Opportunity is being called better or worse odds than normal for its stage. The change, old value, new value, who made it, and the justification, is written to `audit_log` like any other action. In the UI, a probability that differs from its stage default is visually distinguished from one that matches it (a stronger border and an explicit "differs from stage default" label, not a new accent color, the brand system reserves its single accent for live states, not for flagging overrides).

**Pipeline forecast reporting (to build later, once Opportunity and probability exist):** unweighted pipeline = sum of deal value across open opportunities. Weighted pipeline = sum of (deal value × probability_pct) across open opportunities. Both need deal value, which lives on the Deal Sheet child record today, so this report will need to join Opportunity to its current Deal Sheet revision, not just read the Opportunity alone.

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

---

## 4. Honest scope note

Software that supports traceability, controlled approval, and documented decisions is a *foundation* for ISO 9001 and similar management-practice frameworks. It is not certification by itself, certification is an organisational commitment (procedures, internal audits, management review) that this system can support with evidence, not replace. Worth keeping that distinction explicit as the system grows, so it's never mistaken for the whole job.

---

## 5. Sales opportunity stage gates in detail

**This section describes Opportunity, Discovery through Closing.** Test Bed is a genuinely separate record type with its own lifecycle, Planning through Closed, see Section 8. The gate mechanics below (configurable tracks, no required order) apply equally to both, this is one engine used by two different record types, not two engines.

**Every stage gate has a configurable set of required approvals, not a fixed number:**

Legal, Commercial, Sales, Technical, Finance, or whatever gets defined later, admins set which tracks a given gate requires via `stage_gate_rules` and `approval_tracks`, this is not hardcoded to two. **All** required tracks must be satisfied before the transition is allowed, and **there is no required order between them**, they're requested and can be completed in parallel, whoever's needed can approve whenever they're ready, not queued behind each other.

Each individual approval is a tick box (`decision = approved` or `rejected`), timestamped (`decided_at`), with a comment field, expected in particular when an approver rejects, so the person who owns the record knows what to fix.

For the two tracks already concretely needed, Commercial (Sales/line management, escalating tier based on conditions like discount %, via `routing_rules`) and Technical (a Technical Authority nominated per-opportunity, e.g. the CTO, via `roles`), the mechanics work as described below, this is the *current* concrete requirement, not a ceiling on how many tracks a gate can have.

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

**Test Bed has its own stage lifecycle**, defined in `stage_definitions` for `record_type = 'test_bed'` (no variant needed, there is only one Test Bed lifecycle). Planning is not one stage, it's four genuine sequential sub-stages, found in testing, not a single checklist item:

1. NDA (`phase = 'Planning'`)
2. Site Assessment (`phase = 'Planning'`)
3. Partnership and Test Bed Agreement (`phase = 'Planning'`)
4. Compliance and Data Protection, CaDP (`phase = 'Planning'`), gated by two document requirements together, not sequentially, APD (Appropriate Policy Document) and DPIA (Data Protection Impact Assessment) both complete before moving on
5. Deployment
6. Monitoring and Analysis
7. Close out Review (renamed from Review), the final customer meeting, going through the success criteria and driving next actions, including the decision on whether this converts to an Opportunity
8. Decommissioning (only reached if it doesn't convert)
9. Closed

Each Planning sub-stage is gated the same way any other transition is, `stage_gate_rules` requiring the named document(s) reviewed before moving to the next, no new mechanism, just rows in the same table. **Document requirements per phase or sub-stage are already configurable, this needs no new mechanism**: `stage_gate_rules` is admin-editable data, not hardcoded logic, so a Test Bed in a jurisdiction that needs an extra document beyond CaDP's two is a new row, or a different `variant` value if the whole set needs to vary by location, the same table either way. Grouping sub-stages under `phase = 'Planning'` means a report or the stage tracker UI can still show "Planning" as one recognisable block when that's more useful than four granular steps, without losing the individual gating underneath. **The frontend should show Planning as a single step in the main stage tracker, with its sub-stages displayed as a secondary track beneath it, found in testing to be clearer than flattening everything into one long line.** **The order above is assumed to be the required sequence, since it was described as the record moving through them in order, flag it if that's wrong, it's a one-line change to `sort_order`, not a redesign.**

**Noted for later, not designed yet**: regular check-in meetings with the client during Monitoring and Analysis, weekly cadence suggested, the goal being to stay close to the customer, ideally with some automation around scheduling or reminders. How this actually gets organised in the UX is a separate conversation, deliberately deferred, not something to build speculatively now.

**The final transition, Decommissioning to Closed, is gated more heavily than the rest of the lifecycle**, since closing out an R&D engagement is a bigger decision than moving between working stages. It requires, via the same `stage_gate_rules` engine used everywhere else, nothing new: every stage-gate document from the lifecycle actually reviewed (`child_record_status` requirements, same mechanism already used elsewhere), and a senior-tier sign-off (`approval_obtained` with a higher tier than earlier approvals in the lifecycle, via `routing_rules`, exact tier and who holds it is a real chart-of-authority decision, not something to invent here).

**Test Bed can convert to Opportunity at any point in its lifecycle, not only at Decommissioning.** This is a genuine cross-record-type conversion, the same mechanism as Contact to Opportunity, a `conversion_criteria` row with `from_record_type = 'test_bed'`, `to_record_type = 'opportunity'`. A new Opportunity record is created, referencing the Test Bed it came from (`converted_from_test_bed_id`), the Test Bed record itself is not mutated in place, it remains the historical record of the R&D work. The Test Bed's accumulated cost carries across and attaches to the new Opportunity's eventual Deal Sheet as a cost line, the same treatment Pilot cost already gets, a real cost of winning this deal, not something to lose on conversion.

A Test Bed or Pilot record carries its own unit counts (SafeSight, AQ Sensor, and later HEMIR) and its own duration in months, independent of whatever the eventual full deployment's numbers turn out to be, proving the technology with 5 units for 2 months is a different, smaller thing than the 200-unit rollout it might lead to. Cost is computed the same way as the Opportunity-level estimate in Section 6, against these smaller numbers, see the test bed and pilot costing subsection there for how a Pilot's cost feeds into the Deal Sheet's profitability specifically.

### Assets and components

A deployed unit is `record_type = 'asset'`, child of a **Deployment** record (not directly of the Opportunity, see the corrected hierarchy in Section 2), with a `product_type` field (SafeSight, AQ Sensor, future products) rather than hardcoding a camera-specific type. Its physical components, sensor, onboard compute chip, others, are their own records with `parent_record_id` pointing at the asset. This reuses the same parent-child pattern as Opportunity → Deal Sheet, no new mechanism needed, a genuine validation that the generic model holds up outside the sales domain.

**Exception to "generic payload, no dedicated columns":** serial number needs to be a real, indexed, unique database column, not buried in JSON. It will be queried constantly (warranty lookups, component tracing) and uniqueness must be enforced by the database, not by convention. The same likely applies to the reference code below. Generic-by-default is the rule, not a religion, fields with real integrity or performance requirements get real columns.

Each asset also needs: latitude/longitude at deployment, date of manufacture, and a full history log (manufacture, shipment, installation, relocation, service events, warranty claims), the existing `audit_log` table covers this if asset lifecycle events are logged there like any other action.

### Stage gates (supersedes the earlier "document-gates-deployment" idea)

A camera cannot go live until prerequisite documents reach the right status, an NDA signed before any unit is placed on site, and for test beds, a PDPA assessment and Data Protection Impact Assessment completed. An Opportunity can't move from Negotiation to Closing without its Deal Sheet approved. A Contact doesn't convert to an Opportunity without meeting defined criteria. These are all the same underlying need, expressed generically as `stage_gate_rules` and `conversion_criteria` in the schema above, one configurable engine, not a hand-built check per rule, and not something rebuilt narrowly for cameras and then rebuilt again for the next thing that needs a gate.

### Reference code

Format: `CCC-Type-Application-NNN` (e.g. country code, R&D/COM, application vertical such as Educational/Smart City/Manufacturing/Security, sequential number). This is the human-readable business key for an Opportunity or R&D Test Bed, generated and stored as a real column, distinct from the internal record ID. The sequence must increment per Country+Type+Application combination specifically, via a proper counter (a dedicated sequence or counters table with correct locking), not "count existing rows", to avoid two people generating the same reference simultaneously.

## 9. Reference codes

Every Opportunity and Test Bed gets exactly one, once-only, internal reference code, assigned automatically at creation, never reassigned, never edited by a user.

**Format:** `TT-CCC-INDUST-XXX`

- `TT`: fixed prefix.
- `CCC`: country code, derived automatically from the customer's country field on the record, not a separate manual selection.
- `INDUST`: 6-character industry short code, matching the Industry picklist (Taxonomy, Section 7), admin-configurable there, not hardcoded here.
- `XXX`: incremental counter within each country-industry group, starting at 3 digits (`001`), never resets, grows past 999 by adding digits (`0999` → `1000`) rather than wrapping or resetting.

**The counter is shared across Opportunities and Test Beds within the same country-industry group, but more importantly, the code itself is a single, persistent identity, not just a shared numbering pool.** Test Bed can convert to Opportunity (Section 8's Close out Review decision) and Opportunity can have an associated Test Bed or pilot. When that conversion happens, **the reference code carries over unchanged**, it is not redrawn. The same real-world engagement keeps the same reference for its whole lifecycle, across a type change, exactly the way `stage_gate_rules` already carries the Test Bed to Opportunity conversion as one mechanism, not two (Section 10, Build order, item 5).

**Not yet built.** No reference-number generation exists anywhere in the current codebase, this was discovered as a gap during the Reference tab (B1) build, where the strip correctly shows "Not yet generated" rather than a fabricated code, matching Rule 8's discipline, don't invent data that doesn't exist. Building this needs its own small migration, a counter table keyed by `(country_code, industry_code)`, incremented atomically on creation to avoid a race condition producing duplicate codes under concurrent creation, not a client-side or naive read-then-write counter.

## 10. Build order

1. **Contact, Account, and Opportunity** (minimal): just enough to create a Contact and Account, an Opportunity (with `stage`, no `type` field, Opportunity is always commercial), and attach records to it, this is the anchor everything else needs, build it before the Deal Sheet needs somewhere to attach. **Rework needed on what's already built**: the first Opportunity milestone was built against an earlier model where `type` mutated between R&D and Commercial on the same record, and Contacts were assumed to attach via exclusive `parent_record_id` ownership. Both are superseded, Opportunity drops `type` entirely, Test Bed becomes its own record type (below), not a variant, and Contact attachment becomes the many-to-many `record_contacts` join table (Section 2), not `parent_record_id`. The stage transition and gate-checking logic itself doesn't need to change, only the type field, the conversion endpoint, and the Contact-attachment mechanism do.
2. **Test Bed** (minimal): its own top-level record type, own `stage_definitions` (Planning through Closed), own Contacts and Documents, same pattern as Opportunity, not a child of it. Build alongside Opportunity, since a Contact can convert to either.
3. **Deal sheet**: `record_type = 'deal'`, `parent_record_id` = the Opportunity it belongs to. Full workflow, chart-of-authority routing, cash flow and P&L calculation, as already built.
4. Once stable: extract the workflow/approval/audit engine to confirm it's genuinely record-type agnostic, before building the next document type (Risk Register, Pilot, Contacts). If extracting it is hard, the generic model wasn't generic enough, fix that before adding more record types on top of it.
5. **Stage gate rules engine** (`stage_gate_rules`, `conversion_criteria`): build this once, generically, as soon as a second real gating need shows up (NDA-before-deployment is the first concrete case), rather than hand-coding that one check and generalising later. This now also carries the Test Bed to Opportunity conversion, the same mechanism as Contact to Opportunity, not a new one.
6. **Opportunity value estimation** (`product_defaults`, `system_defaults`, `stage_probability_defaults`): build once the Opportunity exists and before the Deal Sheet needs to inherit from it, per Section 6.
7. **Product capability catalog** (`capability`, `use_case`, `success_criterion`, `record_use_cases`, per Section 7): build once Opportunity exists, sales needs to select use cases fairly early in the cycle, before the auto-generated scope document and performance tracking pieces that depend on it.
8. **Admin configuration screen** for `stage_gate_rules` (which documents and approval tracks a stage requires): a real module, not a quick addition, since it needs a proper UI for adding/removing requirements per record type and stage, not just direct table edits. Deliberately not urgent, editing `stage_gate_rules` directly (via Supabase's own editor) is fine until this reaches the front of the queue. Requires a global `admin` role, a `roles` row with `record_type = null` (applies to every record type, not one), distinct from the per-record roles like Technical Approver.
9. Subsequent modules (Risk Register, Pilot, Deployment, then Asset Management and component tracking, then the rest of the build-not-buy list) plug into the existing engine rather than rebuilding it.

## Deferred scope

Explicitly deferred, not forgotten, not a section number of its own since this is a running list, not a build phase. Add to it as new deferrals come up rather than letting them live only in conversation.

- **Base Cost Data**: a real admin-maintained rate catalog (hardware/installation/hosting cost lines). Currently a stopgap: the ten cost lines are freely-editable payload fields on the Opportunity itself, gated only by a route-level `SALESPERSON_WRITABLE_KEYS` allowlist, not a real permission model or a maintained master table.
- **Contractor Management**: the full module (ISO 9001:2015 Clause 8.4 profile, evaluation & selection, requirements, performance, lifecycle & approvals) is prototype-only, nothing built.
- **Full seven-tab Admin**: only Data Objects/Picklists/Workflows exist in minimal form. General, Taxonomy, Users, Base Costs (see above) are all unbuilt.
- **Documents module**: a richer, template-tracked version (shared template library, per-record completion status, document location tracking). The current Opportunity Documents tab is a deliberate, honest empty state, not a stand-in for this.
- **Tab/Enter field navigation and unsaved-changes-on-navigate warnings**: system-wide, not screen-specific. Sized comparable to the Contact detail view itself, not a quick add-on - no `<form>` elements exist anywhere in the app today (Enter currently does nothing in any input), and unsaved-changes detection needs a generic dirty-state registry wired into every editable screen and into `navigate()` centrally. Not built.
