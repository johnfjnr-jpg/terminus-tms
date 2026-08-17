# Round 4 build brief: Account Details architecture

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`, `ROUND3_BUILD_BRIEF.md`. Read all four before
starting. This brief builds on top of Round 3's completed Account
architecture (Account resolved once at Lead qualification, auto-opened
reconciliation panel, Test Bed/Opportunity inherit read-only).

Work through phases in order. Stop after each, report real test evidence,
wait for sign-off before starting the next.

---

## Phase 1: Investigate current Account schema and reference-number mechanism ✅ COMPLETE

No building yet. Report before Phase 2 starts.

1. What fields does `Account` (record_type='account') actually carry
   today? Confirm directly, don't assume from what's displayed anywhere.
   Specifically confirm whether Country is captured anywhere on Account
   currently, the new Account Number scheme needs a country code and
   there may be nothing to source it from yet.
2. Re-confirm `parent_record_id`'s current real usage (2 legacy Lead
   pointers, confirmed superseded, per Milestone 3's decision to build
   a dedicated `account_id` column rather than reuse it). The new
   Parent Account field must NOT reuse `parent_record_id` for the same
   reason that decision was made the first time, report a clean,
   dedicated field/mechanism instead.
3. Confirm the existing `issue_reference_number()` mechanism (Milestone
   1) can be generalised to a new key shape (country + name-prefix)
   without touching its proven atomic-counter core, or whether it
   needs a genuinely separate function. Prefer reusing the existing
   function generically if it can be done without weakening its
   existing guarantees.

---

## Phase 2: Account Number generator ✅ COMPLETE

Format: `TT-{country code}-{name prefix}-{counter}`.

- Name prefix: strip all punctuation and spaces (letters and digits
  only), force uppercase, take the first 10 characters of the result.
  Confirmed examples: "Willowglen Pte Ltd" → `WILLOWGLEN`, "AT&T" →
  `ATT`, "O'Brien's Ltd" → `OBRIENSLTD`.
- Counter: same atomic mechanism as the existing `TT-` scheme
  (Milestone 1), keyed by `country + name-prefix` instead of
  `country + industry`. Must inherit the same proven guarantees:
  genuinely atomic under concurrency, never reused even after
  deletion, correct behaviour past 999 (the exact boundary bug found
  and fixed in Milestone 1 must not be reintroduced here).

**Test evidence required:** real concurrency test (multiple
simultaneous requests for the same country+name-prefix), confirm no
duplicate numbers issued. Confirm the boundary case (999→1000) behaves
correctly for this new key shape too, don't assume the original fix
generalises without checking.

---

## Phase 3: Account Details panel, new fields ✅ COMPLETE

New fields on Account, following the generic records/payload pattern
already used everywhere else in this build:

| Field | Notes |
|---|---|
| Account Number | Generated per Phase 2, not user-entered |
| Account Name | Already exists |
| Terminus Lead | New, Account-level relationship, "the person in Terminus who manages the account", dropdown sourced from the existing `terminus_staff` table (built Round 3), distinct from any per-engagement Terminus Lead field on Test Bed/Opportunity |
| Billing Address | Structured fields matching Contact's own Address panel shape (Address Line 1/2, City, Postcode, Country, Region), not a single free-text block |
| Shipping Address | Same structure as Billing Address |
| Website URL | Plain text field |
| Created Date | System-populated, not user-entered |
| Parent Account | Optional, single level only (a parent does not itself need a parent for this phase), a genuine link to another real, non-deleted Account record, NOT via `parent_record_id` (see Phase 1 finding). Confirm whether a direct circular reference (A's parent is B, B's parent is A) needs guarding against even at single-level depth, and build a guard if a plausible path to it exists. |

**Billing/Shipping Address default from Contact.** On first Account
creation (not on every later view), pre-fill Billing and Shipping
Address from the originating Contact's own Address fields, a one-time
copy, not a live sync, editable independently afterward, consistent
with how `account_id` itself is a one-time snapshot rather than a
continuously-synced relationship elsewhere in this build.

**Mandatory vs optional:** only Account Name is required to create the
record. Every other field in this table is optional at creation,
fillable later.

**Test evidence required:** create a new Account from a Contact with a
real address, confirm Billing and Shipping both pre-fill correctly
from that Contact's address, then edit Shipping independently and
confirm Billing is unaffected. Confirm Parent Account only accepts a
real, non-deleted Account, and confirm the circular-reference guard
(if built) actually rejects a direct A↔B case.

---

## Phase 4: Trigger the Account Details panel at Lead qualification ✅ COMPLETE

Extends Round 3 Phase 1's auto-opened reconciliation panel. When the
Company text at qualification does **not** match an existing Account
(the create-new path), show the full Account Details panel from Phase
3, not just the lightweight name-and-create action currently there.
When it **does** match an existing Account (the link-existing path),
behaviour is unchanged, no need to show the full panel for something
already fully specified.

**Test evidence required:** qualify a Lead whose Company doesn't match
anything, confirm the full Account Details panel appears, confirmed
correctly pre-filled (Account Name from Company text, Billing/Shipping
from the Contact's own address). Qualify a second Lead whose Company
does match an existing Account, confirm behaviour is unchanged from
Round 3, the lightweight link action, not the full panel.

---

## Phase 5: New Lead modal, lightweight Company autocomplete ✅ COMPLETE

**Confirmed scope: lightweight only.** The New Lead modal's Company
field becomes an autocomplete suggesting existing Account names as the
user types, but stays genuinely free text underneath, nothing is
resolved, linked, or created at this point. This does not reverse the
"no friction at fast entry" decision from earlier in this build, real
Account resolution still only happens at qualification (Phase 4 above,
building on Round 3).

**Test evidence required:** type a partial name matching an existing
Account in the New Lead modal, confirm it's suggested. Confirm
submitting a genuinely new name (no match) still creates the Lead
successfully, exactly as today, no new requirement introduced.

---

## Documentation discipline

Same as every prior round: update `DESIGN_PRINCIPLES.md` the moment a
decision in this brief changes during the build. Record the Account
Number scheme and its confirmed sanitisation rule precisely, the same
level of precision `PROTOTYPE_SPECIFICATION.md` already holds for the
existing `TT-` scheme, so a future session isn't left reconstructing
the exact rule from a chat transcript.

---

## Build complete, all 5 phases genuinely verified

Full write-up in `DESIGN_PRINCIPLES.md` (Section 9, Account Number, and
Account Details panel entries) and `PROTOTYPE_SPECIFICATION.md` (the
corrected historical note on `parent_record_id`). This round's own
close-out was handled differently from Rounds 2 and 3: rather than a
single consolidated write-up done after all phases closed, each phase
updated `DESIGN_PRINCIPLES.md` live as it was built. Verified against
the real, current repo files before this summary was written, not
assumed complete from the phase reports alone.

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Investigation | Confirmed Account carries almost nothing today (just `name`/`address`, no Country, no detail screen exists at all), `parent_record_id`'s legacy usage had already been fully cleared by the 2026-08-15 data reset | Correctly recommended against reusing `parent_record_id` a second time, same reasoning as Milestone 3's original `account_id` decision |
| 2. Account Number generator | New `TT-{country}-{name prefix}-{counter}` scheme, reusing the proven atomic core | Two real bugs caught before shipping: a namespace-collision risk with the existing industry-code keyspace (confirmed with a real exact-match test, "Smartc" vs. `SMARTC`), and a `CREATE OR REPLACE` overload bug that would have broken every existing Opportunity/Test Bed creation call in production |
| 3. Account Details panel | Full new field set, structured Billing/Shipping addresses, dedicated `parent_account_id` with an application-layer circular-reference guard | An undocumented build-time judgment call (Billing over Shipping as the country source) caught and surfaced retroactively rather than left implicit; a real unchecked-Supabase-error bug found in a file outside the original documented scan; a single-quote/XSS-adjacent bug in the Parent Account search renderer caught before testing, not after |
| 4. Trigger at Lead qualification | Branches Round 3's auto-open between the full panel (no match) and the lightweight link panel (match) | The multi-match case (a Company matching 2+ real Accounts) was explicitly tested, not assumed, confirming the branch correctly treats "any matches" as "match," not just "exactly one" |
| 5. New Lead modal autocomplete | Native `<datalist>` suggesting existing Account names | Chose a mechanism that makes "stays genuinely free text" a structural property rather than a discipline to maintain, reusing the existing `accountsCache` with no new fetch |

**Genuinely open items, not part of this round:**

- Test Bed still writes no per-field Notes History (known from Round 2,
  unchanged).
- The full buyer-role catalog design remains confirmed but unscoped.
- Deep Parent Account cycles (A→B→C→A) are explicitly out of scope,
  only direct A↔B and self-reference are guarded against, matching the
  brief's confirmed "single level only" decision.
