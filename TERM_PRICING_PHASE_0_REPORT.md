# TERM_PRICING Phase 0 report

**STOPPED: one premise failed. NO ADMIN EXISTS SERVER-SIDE.** R-TP3 needs "editable by ADMIN only
(server-enforced)", and the estate has no admin concept to enforce it with. Creating one is an auth
decision, so it is John's to rule (proposal in 0.2c). Everything else in Phase 0 holds, and Phase 1
(pure engine and goldens) does not depend on the ruling.

Base: `origin/main` = `a84573f31369c42bfb2a84e8dad1fece6c23505a` (ls-remote), matching the brief.
Branch `term-pricing`, first commit `c4558d0` (the brief, verbatim). `docs/pricing-spec.md` sha256
`479e7b81bdf863cea238e744d248b9133e8c2bce09e8b6d5eae1f4d339ea81e0` matches the brief, and
`git diff a84573f -- docs/pricing-spec.md CLAUDE.md` is empty. Architecture rule 14 is present at
CLAUDE.md line 971.

## 0.1 Catalog (premise HOLDS)

Read live from `base_cost_batches` with the service key, then resolved through the estate's own
`resolveCurrentBatches` as of 2026-10-01. There are 3 rows in total, one batch per product, all
labelled "Initial catalog" and effective from 2026-08-27.

| product key | HW_COST (`unit_cost`) | HOSTING_MONTHLY (`hosting_cost_month`) |
|---|---|---|
| `safesight` | 8,000.00 | 200.00 |
| `air_quality` (AQ) | 2,000.00 | 100.00 |
| `hemir` | 100,000.00 | 500.00 |

SafeSight is 8,000.00 / 200.00, so the reference tables in spec section 10 apply. Columns are
`numeric(12,2)`. The install columns exist but are not read, because installation is excluded
(spec section 13).

## 0.2 Money, settings, admin

**(a) Money: exact rationals over BigInt, with integer cents at every rounded figure. No library,
no new dependency.** Integer cents alone cannot carry `list_fee(T)` "full precision": 152,000 / 36
is not a whole number of cents. A decimal library would be a new dependency, so I chose an
in-module fraction type (BigInt numerator over BigInt denominator) instead. Every parameter and
cost enters as a DECIMAL STRING and becomes an exact fraction. `round_half_up(x, 2)` is integer
arithmetic on the fraction. Margins and savings display at 1 dp, also half-up. No `Number` arithmetic
touches money. Checked by hand against the spec: T1 gives 15,200 x 9 = 136,800 profit, fee
152,000 / 36 = 4,222.2 recurring, which rounds to 4,222.22, times 36 = 151,999.92. That matches.

The transit hazard: PostgREST returns `numeric` as a JSON number. Position: settings and catalog
reads used by term pricing select the value cast to text, so no float exists even in transit.

**(b) Settings location (proposal):** a new table `term_pricing_settings`, with one row per section 3
parameter (`ANCHOR_TERM`, `ANCHOR_MARGIN`, `SHORT_TERM_MARGIN`, `PROFIT_STEP`, `VOLUME_BANDS`,
`HW_UPFRONT_MARGIN`, `MARGIN_FLOOR`, `CURRENCY`), with `updated_at` and `updated_by`. It is NOT
`system_defaults`, which Architecture 11 defines as initial values written into deals, and which the
deal sheet reads (R-TP5). `HW_COST` and `HOSTING_MONTHLY` are not stored here; they are read from
the catalog (R-TP3).

Position on an ambiguity: the offered term list (12 ... 120) is in spec section 2, not section 3.
Rule 14 says "no hard-coded parameters", and `steps_above` is defined by that list, so I propose it
is stored as a setting too (`TERMS`). This is revisitable.

**(c) Admin: DOES NOT EXIST. This is the failed premise.** Measured:

- `requireAuth` verifies the JWT and sets `{ id, email }`. It checks nothing else.
- The `roles` table exists, has 0 rows, and its check constraint is
  `role in ('owner','reviewer','approver','viewer')`, so it cannot hold `admin` at all.
- `system_roles` appears in 0 migrations (the same grep finds `track_approvers` in 7). It is
  designed in `DESIGN_PRINCIPLES.md` (line 166: `user_id`, `role`, "admin is a single general
  permission") and was never built.
- There are 0 references in `src/` to any role or admin check.
- Every config table (`system_defaults`, `base_cost_batches`, `industries` and so on) is
  "admin-edited" only in the sense that it is changed in the Supabase editor. No route writes any
  of them.

**Proposal for John's ruling (recommended):**

- Build `system_roles` exactly as DESIGN_PRINCIPLES line 166 already designed it, with `role`
  checked to `('admin')`. Seed John's user id (`75425a02-...`, the same id `track_approvers` seeds).
- Enforce writes to `term_pricing_settings` in two places:
  - the route checks `system_roles` for `request.user.id` and answers 403;
  - RLS insert and update policies require `exists (select 1 from system_roles where user_id =
    auth.uid() and role = 'admin')`.
  Both are needed. An RLS refusal returns success with zero rows (the Verification 8 shape), so the
  403 must come from the route. The policy is what binds a direct client call.
- `system_roles` is select-only to authenticated users, for their own row only. No route writes it,
  so granting admin stays an editor action.
- Both migrations need applying by hand (CLAUDE.md rule 14, cannot be parse-checked here). That
  blocks Phase 3, not Phase 1.

Not recommended: reusing `track_approvers` (Commercial) as the admin list. It would make "may
approve a price" and "may change the pricing model" one permission by accident.

## 0.3 Existing pure tax or rounding helpers: NONE importable

- `calculateTax` (`src/lib/deal-calculator.js:262`) is the only GST/WHT/gross-up helper. It lives
  INSIDE the deal-sheet pricing code, uses float arithmetic, and rounds to whole dollars with
  `Math.round`. It is excluded on all three counts.
- `gstPresentation` and `whtPresentation` (`deal-inputs.js`) are display readers of deal payloads,
  also inside pricing code.
- **So the R-TP1 exception list is EMPTY.** GST, WHT gross-up and rounding are re-implemented in
  exact arithmetic inside the term pricing module, reproducing `calculateTax`'s gross-up DEFINITION
  (`base = net / (1 - wht)`, and WHT borne when gross-up is off) as spec section 8 asks, without
  importing it.

Spec gap, recorded and not resolved: section 8 gives no WHT test case and no rounding rule for the
tax lines. Position: tax amounts round half-up to cents per invoice line, consistent with section 5.

## Isolation guard design (R-TP1), for Phase 1

- **The engine `src/lib/term-pricing.js` imports NOTHING.** That is a structural assertion: its
  import list is empty. It is stronger than a blocklist, because a new pricing file cannot slip past
  it.
- **Nothing in the pricing set imports it.** The importer side is an ALLOWLIST: only the term
  pricing route, screen and tests may import the module. Any other importer fails the guard
  (Verification 19: enumerate by structure, fail on the unrecorded instance).
- Comments are stripped before matching, with `scripts/lib/strip-comments.mjs` (Verification 39).
- Calibrated red by injecting one import each way, as the brief asks: `deal-calculator.js` into
  term pricing, and term pricing into `deal-calculator.js`.
- The catalog read is done by the ROUTE, which imports `resolveCurrentBatches` from
  `src/lib/base-costs.js`. That file is the catalog resolver: it imports nothing and is not pricing
  code. Re-implementing it would create a second reader (Architecture 3).

**G1 to G5** are the deal-sheet goldens in `GOLDEN_DEALS.md`, checked by the `golden deals` gate
stage (`scripts/golden-deals-check`). Nothing in this round touches them.

## 0.4 Navigation (proposal, not built)

- A new sidebar entry **"Term Pricing"**, after Opportunities and before Approvals
  (`frontend/index.html` `.sidebar-nav`), mounted as its own React view.
- The admin settings live on the same screen as a collapsible panel: visible to everyone, editable
  only by an admin.
- It does not go under the disabled "Admin" entry: no Admin module exists, and building one is out
  of scope.

## Phase 1 can run without the admin ruling

The engine takes parameters and costs as arguments, and the goldens pass section 3's values and the
reference costs in directly. Settings storage, the admin write and the 403 belong to Phase 3.
