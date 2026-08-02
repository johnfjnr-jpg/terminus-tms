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

When a future module needs a document, it stores a Google Drive file ID and links to it, it does not build its own file storage. When it needs to notify someone, it goes through one shared notification service, it does not send email itself.

---

## 2. Data model: generic by default

Every business object in this system, a lead, an opportunity, a deal, a nonconformity report, a corrective action, a controlled document, anything added later, is a **record**. Records do not get their own bespoke tables. They get a `record_type` and a JSON payload.

### Sales journey, the first concrete flow through this model

```
Lead (record_type = 'lead')
  Top of funnel: website, conference, prospecting.
  → converts to Opportunity on defined criteria (e.g. webinar attended,
    demo requested), criteria are data-driven (see conversion_criteria
    below), not hardcoded

Opportunity (record_type = 'opportunity', the anchor object)
  owner_id: the sales person. Owns the Opportunity (and the Lead it came
    from) end to end, responsible for progressing it through the stage
    gates, collating required documents, and requesting approvals. This
    is the existing `owner_id` field on `records`, not a new mechanism.
  type: R&D | Commercial — mutable. An R&D-type Opportunity can convert
    to Commercial later, it's the same record, the type field changes,
    logged as a significant event in audit_log. There is always a client
    organisation, even for R&D, so R&D Opportunities are NOT parentless,
    correcting an earlier version of this document that assumed they were.
  stage (= this record type's status field): Discovery → Qualified →
    Proposal → Evaluation → Negotiation → Closing
    (Quotation renamed to Proposal, Evaluation added, see Section 8
    for what happens at each stage and what gates each transition)
  → Contacts attach here, added incrementally as the relationship
    deepens, not all upfront: commercial buyer, end user, technical
    buyer, IT/Security, procurement, and others, each record_type =
    'contact' with a `role` field, linked via parent_record_id
  → Documents attach here as the buying journey progresses, extensible,
    not a fixed list:
      - Deal Sheet (record_type = 'deal') — actively developed and
        revised through Discovery, Qualified, and Proposal; effectively
        frozen once the proposal is submitted (see Section 8)
      - Risk Register (record_type = 'risk_register')
      - NDA, PDPA assessment, Data Protection Impact Assessment
      - Test Bed (record_type = 'test_bed') — may occur during Discovery,
        it's a child record of the Opportunity, not a separate top-level
        concept
  → closes (Won) →

Deployment (record_type = 'deployment', child of Opportunity)
  Possibly phased. Own stage progression: Planned → In Progress →
  Commissioned → Handed Over.
  → Asset (record_type = 'asset', child of Deployment)
    SafeSight(TM) and AQ Sensor units, see Section 6.
    → Component (record_type = 'component', child of Asset)
  → handover →
Support (ongoing)
```

Nothing here is a special case. An Opportunity is a record like any other, it just happens to be the `parent_record_id` that other records point back to. The workflow engine that moves a Deal Sheet through Draft → Submitted → Approved is the identical code path that moves an Opportunity through its stages, a Test Bed through its own, or a Deployment through Commissioning, it has no idea what any of them mean.

**This system will grow well beyond sales, expenses, timesheets, and whatever comes after that, and the model needs to hold for those without rework.** A concrete check, not just an assertion: an Expense claim is `record_type = 'expense'`, no `parent_record_id` (it doesn't belong to an Opportunity), one required approval track (Manager) via a single `stage_gate_rules` row, submitted by the employee who owns it. A Timesheet is the same shape, `record_type = 'timesheet'`, its own approval track, its own payload. Neither needs a new table, a new approval mechanism, or a new audit log, they're both just new rows in `stage_gate_rules` and a new payload shape, exactly the "new modules extend, they don't fork" rule already states. If a future module ever *does* need something the current schema can't express, that's the signal to revisit the generic model itself, not to bolt on a one-off exception for that module alone.

| Table | Purpose |
|---|---|
| `records` | `id`, `record_type`, `parent_record_id` (nullable, e.g. a Deal Sheet's parent is its Opportunity), `status`, `owner_id`, `created_at`, `updated_at` |
| `record_revisions` | `record_id`, `revision_number`, `payload` (JSON, shape depends on `record_type`), `created_by`, `created_at`. Immutable once written. |
| `approval_tracks` | `track_name` (Legal, Commercial, Sales, Technical, Finance, or whatever gets added later), admin-defined, not hardcoded in application code |
| `approvals` | `record_id`, `revision_number`, `track` (references `approval_tracks`), `tier` (nullable, only tracks with escalation logic like Commercial use this), `approver_id`, `decision` (a tick box: approved / rejected), `comment` (free text, expected especially when rejected), `decided_at` (timestamp) |
| `audit_log` | `record_id`, `record_type`, `action`, `actor_id`, `timestamp`, `detail` |
| `roles` | `user_id`, `record_id` (nullable, set for instance-specific assignments like "Technical approver on *this* Opportunity"; null for type-wide defaults), `record_type`, `track` (which `approval_tracks` entry this person can approve for), `role` (`owner` / `reviewer` / `approver` / `viewer`) |
| `routing_rules` | `record_type`, `track`, `condition` (e.g. discount % band), `required_tier`, computes *which tier within a track* is needed, only relevant for tracks with escalation logic (Commercial today). Tracks without escalation (Legal, Technical) just use a direct `roles` nomination, no tier needed. |
| `stage_gate_rules` | `record_type`, `variant` (nullable, e.g. `opportunity_type = 'R&D'` vs `'Commercial'`), `from_stage`, `to_stage`, `requirement_type` (`document_status`, `approval_obtained`, `child_record_status`), `requirement_detail` (JSON, e.g. `{track: 'Legal'}` for an approval requirement). A gate can have any number of `approval_obtained` rows, one per required track, admin-configurable, not fixed at two. **All** required tracks must reach `decision = approved` before the transition is allowed, and there is no required order between them, they can be requested and completed in parallel. |
| `conversion_criteria` | `from_record_type` (`lead`), `to_record_type` (`opportunity`), `condition` (e.g. webinar attended, demo requested), same data-driven pattern as `stage_gate_rules`, kept separate since converting *between* record types is a different action than progressing *within* one |

A deal is `record_type = 'deal'` with `parent_record_id` pointing at its Opportunity. Its payload holds everything currently in the calculator, SafeSight(TM) counts, discount %, payment structure, and so on.

---

## 3. Non-negotiable rules

These apply to every module, present and future. If a new feature can't be built without breaking one of these, the feature needs rethinking, not the rule.

1. **Server-side recomputation.** Any calculated figure a decision gets made on (a deal's margin, a corrective action's due date) is recomputed and verified server-side at submission time. Never trust client-submitted numbers for something an approval rests on.
2. **Immutable approved snapshots.** Once a record is approved, that revision is frozen. Further edits create a new revision, never an overwrite. History is permanent.
3. **Data-driven process rules, not hardcoded.** Chart of authority thresholds (`routing_rules`), stage-gate requirements (`stage_gate_rules`), and Lead-to-Opportunity conversion criteria (`conversion_criteria`) all live in the database, not in application code. Changing who approves what, what's required to progress a stage, or when a Lead qualifies, is a data edit, not a deploy.
4. **One audit trail, one shape.** Every record type logs to the same `audit_log` table in the same format. A future compliance or audit view queries one table, not one per module.
5. **New modules extend, they don't fork.** Adding a new record type means adding a payload shape and, if needed, new routing rules, not duplicating the workflow, approval, or audit machinery.

---

## 4. Honest scope note

Software that supports traceability, controlled approval, and documented decisions is a *foundation* for ISO 9001 and similar management-practice frameworks. It is not certification by itself, certification is an organisational commitment (procedures, internal audits, management review) that this system can support with evidence, not replace. Worth keeping that distinction explicit as the system grows, so it's never mistaken for the whole job.

---

## 5. Sales opportunity stage gates in detail

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

## 6. Deployment types and asset tracking

Camera (SafeSight(TM)) and sensor (AQ Sensor) deployments trace back to three Opportunity scenarios, distinguished by `type` and `stage`, not by parentage, every one of them has a client organisation and an Opportunity, including R&D:

| Scenario | Billing | Opportunity type | Notes |
|---|---|---|---|
| Test Bed (R&D) | Cost to business, no client billing | R&D (mutable, can convert to Commercial) | Terminus-funded, gathers real-world data for model development. Still has a client organisation, still anchors to an Opportunity. |
| Test Bed (Commercial) | Tied to a commercial Opportunity | Commercial | Typically occurs during Discovery stage, short-term, precursor to a wider sale |
| Commercial Deployment | Revenue-generating, post-close | Commercial | Created when Opportunity reaches Closed/Won, rollout may be phased |

### Assets and components

A deployed unit is `record_type = 'asset'`, child of a **Deployment** record (not directly of the Opportunity, see the corrected hierarchy in Section 2), with a `product_type` field (SafeSight, AQ Sensor, future products) rather than hardcoding a camera-specific type. Its physical components, sensor, onboard compute chip, others, are their own records with `parent_record_id` pointing at the asset. This reuses the same parent-child pattern as Opportunity → Deal Sheet, no new mechanism needed, a genuine validation that the generic model holds up outside the sales domain.

**Exception to "generic payload, no dedicated columns":** serial number needs to be a real, indexed, unique database column, not buried in JSON. It will be queried constantly (warranty lookups, component tracing) and uniqueness must be enforced by the database, not by convention. The same likely applies to the reference code below. Generic-by-default is the rule, not a religion, fields with real integrity or performance requirements get real columns.

Each asset also needs: latitude/longitude at deployment, date of manufacture, and a full history log (manufacture, shipment, installation, relocation, service events, warranty claims), the existing `audit_log` table covers this if asset lifecycle events are logged there like any other action.

### Stage gates (supersedes the earlier "document-gates-deployment" idea)

A camera cannot go live until prerequisite documents reach the right status, an NDA signed before any unit is placed on site, and for test beds, a PDPA assessment and Data Protection Impact Assessment completed. An Opportunity can't move from Negotiation to Closing without its Deal Sheet approved. A Lead doesn't become an Opportunity without meeting defined criteria. These are all the same underlying need, expressed generically as `stage_gate_rules` and `conversion_criteria` in the schema above, one configurable engine, not a hand-built check per rule, and not something rebuilt narrowly for cameras and then rebuilt again for the next thing that needs a gate.

### Reference code

Format: `CCC-Type-Application-NNN` (e.g. country code, R&D/COM, application vertical such as Educational/Smart City/Manufacturing/Security, sequential number). This is the human-readable business key for an Opportunity or R&D Test Bed, generated and stored as a real column, distinct from the internal record ID. The sequence must increment per Country+Type+Application combination specifically, via a proper counter (a dedicated sequence or counters table with correct locking), not "count existing rows", to avoid two people generating the same reference simultaneously.

## 7. Build order

1. **Lead and Opportunity** (minimal): just enough to create an Opportunity (with `type` and `stage`) and attach records to it, this is the anchor everything else needs, build it before the Deal Sheet needs somewhere to attach.
2. **Deal sheet**: `record_type = 'deal'`, `parent_record_id` = the Opportunity it belongs to. Full workflow, chart-of-authority routing, cash flow and P&L calculation, as already built.
3. Once stable: extract the workflow/approval/audit engine to confirm it's genuinely record-type agnostic, before building the next document type (Risk Register, Test Bed, Contacts). If extracting it is hard, the generic model wasn't generic enough, fix that before adding more record types on top of it.
4. **Stage gate rules engine** (`stage_gate_rules`, `conversion_criteria`): build this once, generically, as soon as a second real gating need shows up (NDA-before-deployment is the first concrete case), rather than hand-coding that one check and generalising later.
5. Subsequent modules (Risk Register, Test Bed, Deployment, then Asset Management and component tracking, then the rest of the build-not-buy list) plug into the existing engine rather than rebuilding it.
