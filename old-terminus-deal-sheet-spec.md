# Terminus Deal Sheet: Portal Integration Specification

**Purpose:** Convert the standalone deal sheet calculator into a per-deal, saved, workflow-driven tool on the internal portal. This document is a blueprint for the development team, not a finished spec, sections marked **[NEEDS INPUT]** require a business decision before build.

---

## 1. Scope

- Every field currently in the calculator becomes a stored field on a Deal record.
- Deals move through a fixed workflow: Draft, Submitted, Approved, Rejected, with escalation routing based on discount %.
- Once Approved, the calculation is locked. Any further edit creates a new revision requiring re-approval.
- Authentication and user identity come from the existing portal login, this spec assumes SSO is available and does not cover building a new auth system.

---

## 2. Data model

### 2.1 Deal record (top level)

| Field | Type | Notes |
|---|---|---|
| deal_id | UUID | Primary key |
| deal_name | string | |
| created_by | user reference | From portal SSO |
| status | enum | draft / submitted / approved / rejected |
| current_revision | integer | Increments on every post-approval edit |
| created_at, updated_at | timestamp | |

### 2.2 Deal inputs (one set per revision)

All fields below map directly to the current calculator's inputs. Store as a single JSON blob per revision (simplest, matches the calculator's own state shape) or as normalised columns if the dev team prefers queryability across deals (e.g. for reporting on average discount %, margin trends).

| Group | Fields |
|---|---|
| Deal parameters | contract term (years), Target Profitability (HW) %, Target Profitability (hosting) % |
| SafeSight(TM) | total units, existing pole mount count + cost, new pole mount count (calculated) + cost, unit cost |
| AQ Sensor | unit count, unit cost, install cost |
| Hosting and warranty | hosting cost/camera/month, hosting cost/sensor/month, warranty % |
| PO factoring | enabled (bool), interest rate %, loan term (months), repayment method (straight-line / declining balance) |
| Discount | discount % off list price |
| Payment structure | structure type (phased / hybrid), recovery period (months), milestone rows (month, %, $) × 5 |

### 2.3 Deal outputs (calculated, stored as a snapshot at submission and at approval)

Store the calculated outputs, not just the inputs, at the moment a deal is submitted and again at the moment it's approved. This is the audit trail: it proves what numbers the approver actually saw, even if inputs are edited later.

| Field | Notes |
|---|---|
| computed_contract_value | List price |
| target_offer_price | List price minus discount |
| total_actual_revenue, total_actual_cost, total_actual_net_profit | |
| margin_achieved | |
| gap_vs_target | Structured payments vs target offer price |
| min_cash_position, min_cash_month | From the cash flow check |
| approval_tier_required | Calculated from discount %, see Section 4 |

### 2.4 Workflow / audit log

| Field | Notes |
|---|---|
| log_id | |
| deal_id | |
| revision | |
| action | submitted / approved / rejected / edited-post-approval |
| actor | user reference |
| timestamp | |
| comment | Free text, required on rejection |

---

## 3. Workflow state machine

```
Draft --submit--> Submitted --approve--> Approved (locked)
                       |
                    reject
                       |
                       v
                     Draft (with reviewer comment)

Approved --edit--> Draft (new revision, previous revision retained in history)
```

Rules:
- Only the deal owner can submit.
- Only the assigned approver (see routing, Section 4) can approve or reject.
- Editing an Approved deal does not overwrite it, it creates a new revision in Draft status. The prior approved revision stays visible in history.
- A rejected deal returns to Draft with the reviewer's comment attached, editable by the owner, resubmittable.

---

## 4. Approval routing (escalation)

**Trigger:** Discount % off list price, entered by the sales rep before structuring payments.

**[NEEDS INPUT]** The actual chart of authority thresholds and approver tiers. Placeholder structure below, replace the percentages and roles with your real policy:

| Discount % range | Approver tier |
|---|---|
| 0% – X% | Line manager |
| X% – Y% | [Regional director / VP, TBD] |
| Above Y% | [VP / CFO, TBD] |

Additional open questions for whoever owns the chart of authority:
- Does the threshold apply to discount % alone, or does a large deal in absolute dollar terms also escalate even at a small discount %?
- Is routing to a specific named approver, or to a role (so it doesn't break when someone changes job)?
- Sequential or single-tier: does a large discount require line manager approval first, then escalate, or does it skip straight to the senior approver?

---

## 5. API sketch (REST, illustrative)

| Endpoint | Method | Purpose |
|---|---|---|
| /deals | POST | Create new deal (Draft) |
| /deals/:id | GET | Fetch deal, latest revision |
| /deals/:id | PUT | Update Draft inputs |
| /deals/:id/revisions/:n | GET | Fetch a specific historical revision |
| /deals/:id/submit | POST | Draft → Submitted, snapshots outputs, determines approver tier |
| /deals/:id/approve | POST | Submitted → Approved, locks revision |
| /deals/:id/reject | POST | Submitted → Draft, requires comment |
| /deals/:id/history | GET | Full audit log |

---

## 6. Integration notes

- The existing calculator's HTML/JS can be adapted as the deal-entry frontend largely as-is, its input fields map directly to Section 2.2. The main change needed is replacing its current "compute on every keystroke, nothing persists" model with save-to-API calls (on blur or on an explicit Save action) and a load-from-API call on page open.
- Consider whether calculation happens client-side (as now) or is recomputed server-side at submission time, to prevent a tampered client from submitting a deal with fabricated output numbers. For an internal tool with trusted users this may be low risk, worth a deliberate decision rather than a default.
