# Round 2 build brief: Leads, Contacts, Test Bed, Opportunity refinements

Source of truth: `PROTOTYPE_SPECIFICATION.md`, `DESIGN_PRINCIPLES.md`,
`INTERACTION_STANDARDS.md`. Read all three in full before starting.

This brief exists because this round bundled real feature work, a
significant layout convention change, and a screen rebuild into one
feedback document. Splitting it into phases keeps each one verifiable
on its own, same discipline as the original Test Bed build.

Work through phases in order. Stop after each one, report real test
evidence, wait for sign-off before starting the next.

---

## Phase 1: Origin-contact field, real behaviour, not just a label

**Confirmed finding, not assumed:** `initialLead` (Test Bed) and
`customerLead` (Opportunity) exist as plain, freely-editable fields.
Neither auto-populates at creation, neither is protected from being
overwritten, and neither carries across on Test Bed to Opportunity
conversion. The "permanently preserved origin contact" behaviour was
documented as intent, never built.

**Confirmed decisions:**

1. At creation (Contact → Test Bed, Contact → Opportunity), auto-
   populate the origin-contact field from the source Contact.
2. Protected from silent overwrite, not fully locked. Same freshness-
   check pattern already built and proven for Opportunity's Duration
   field: a save that doesn't touch this field must never revert it to
   stale data; a genuine edit checks the current server value first
   before proceeding; a real conflict refuses outright rather than
   picking a winner silently.
3. Applies symmetrically to both `initialLead` and `customerLead`.
4. Carries across unchanged on Test Bed to Opportunity conversion, the
   same way `account_id` and `reference_code` already do.

**Test evidence required:** create a Test Bed from a Contact, confirm
`initialLead` auto-populates. Attempt an unrelated save afterward,
confirm it's untouched. Genuinely edit it, confirm it saves with the
usual freshness check. Convert to Opportunity, confirm the value
carries across unchanged.

---

## Phase 2: Add Note button positioning, re-check first

**Not confirmed as a regression yet.** Investigation could not
reproduce the reported issue against Contact/Lead detail's actual
current behaviour. Precise description of what was reported: "ADD
NOTE" sitting in its own row above the note input, separate from the
input's own row, which has its own right-aligned × discard icon. The
button itself doesn't move, it stays top-left throughout.

Re-check against this precise description before building anything.
Confirm whether this is the actual current structure, and if so,
whether the original fix's intent was for the button to sit inside
the same row as the input (moving to that row's right edge once
active), or whether the two-row structure described is correct as
designed and nothing is actually broken.

Report findings before any fix.

---

## Phase 3: Label/value same-line layout, app-wide

Currently labels sit above their values, stacked vertically, on every
screen. Change to label and value sitting on the same line.

**Confirmed scope:** applies to Lead/Contact detail, Test Bed's
Reference tab, and Opportunity's Reference tab, all three, for
consistency, given Phase 7 makes Test Bed and Opportunity's Reference
tabs structurally identical, leaving one inline and the other stacked
would just create a new inconsistency in place of the old one.

**Test evidence required:** screenshot before/after on all three
screens, confirm no field labels or values get clipped or wrap
awkwardly at narrow widths, given the field-value pair now shares a
line instead of two.

---

## Phase 4: Lead/Contact Account field, real autocomplete

Currently defaults to free-text company name, even when a matching
Account already exists. Change to a dropdown/autocomplete against
existing Account names, matching as the user types, with the option to
create a new Account if nothing matches, same as the existing
Contact-to-Account linking pattern already built elsewhere.

Apply the identical pattern to the Opportunity-linking dialogue too,
confirmed as the same requirement.

**Test evidence required:** type a partial company name that matches
an existing Account, confirm it's suggested and selectable. Type
something with no match, confirm a create-new path still works.

---

## Phase 5: Contacts list rebuild

1. Replace "Manage" with a "+Create" hover-triggered dropdown listing
   Test Bed / Opportunity as plain clickable items, matching the
   prototype exactly, not the current boxed-button popup.
2. Move the Test Bed/Opportunity count columns to sit immediately after
   the Name column.
3. Change the count-click interaction from click to hover for preview.
4. Whole-row click to navigate, confirmed as already the real, working
   pattern on the Test Beds list (`renderTestBedsTable`, every cell
   wrapped in one `onclick` handler, not just the name). Replicate that
   exact pattern on Contacts, don't build a new one.

**Test evidence required:** hover over Create, confirm the dropdown
appears without a click. Hover over a non-zero count, confirm the
preview appears without a click. Click anywhere on a row other than
the name, confirm it navigates.

---

## Phase 6: Test Bed list, matrices and field set

**Confirmed buildable now, real existing data, no gap:** two summary
matrices, Test Beds by stage by region, and Test Beds by industry by
region, both using real, already-populated fields (stage, region,
industry). Not the same as the open-tickets/issue/live-degraded
matrices flagged earlier as unbuildable, this pair has no missing-data
problem.

**New field set for the list itself:** Reference, Test Bed Name,
Company, City (derived from the existing Site Address field, not a new
stored field), Region, Stage, Terminus Lead, Client Lead (the
origin-contact field from Phase 1), Estimated Cost, Created date.

**Test evidence required:** confirm matrix counts match a real,
independent count of live Test Beds by stage/region and industry/
region. Confirm City displays correctly derived from Site Address for
a record with a real address.

---

## Phase 7: Test Bed Reference tab, 3-panel rebuild

**Confirmed:** Test Bed's Reference tab restructures to match
Opportunity's 3-panel layout (Terminus Details / Customer Details /
Key Dates), even though this is not what Test Bed's own prototype
screen shows, a deliberate consistency decision, not a prototype-
fidelity one. Apply the same width-cap discipline already proven
earlier (`minmax(280px, 420px)`, `justify-content: start`) so panels
don't end up sparse with dead space, the same failure mode already
found and fixed once on Contact detail.

**Terminus-side fields renamed Owner → Authority**, fully consistent
with Opportunity's naming, not just the panel shape.

**Proposed field mapping, confirm before building:**

| Panel | Fields |
|---|---|
| Terminus Details | Terminus Lead, Commercial Authority, Technical Authority, Legal Authority, Industry, Region, Country, Stage |
| Customer Details | Account, Client Lead (Phase 1's origin-contact field), Client Commercial Buyer, Client Technical Buyer, Client Legal Buyer |
| Key Dates | Unchanged: Date Created, Estimated Installation Date, Est Go Live, Test Bed Duration |

Summary and Notes stay at the left margin, full width, below the
3-panel row, not inside any panel, matching the explicit instruction.

**Test evidence required:** screenshot at 1240px, 1920px, and 3440px,
confirm no panel shows excessive dead space at wide viewports, confirm
all renamed fields display as "Authority" not "Owner" anywhere,
including in Notes History entries that reference the old name if any
exist.

---

## Sequencing note

Phase 1 before Phase 7, since Phase 7's Customer Details panel includes
the Client Lead field, which needs its real auto-populate/protection
behaviour working first, not bolted on after the panel already exists.

---

## Build complete, all 7 phases signed off

| Phase | Delivered | Beyond the original brief |
|---|---|---|
| 1. Origin-contact field | Auto-populate + freshness-check on Initial Lead/Customer Lead, carries across on conversion | Confirmed both fields had no second writer yet, built the protection defensively ahead of one, proven correct against a genuine independent writer (a direct API call standing in for a second session), not just the anticipated case |
| 2. Add Note positioning | Re-checked against a precise description since no image could be passed through, found the original report was accurate. Button now physically relocates into the input's own row when active | A stale, no-longer-applicable right-align-within-header mechanism removed entirely rather than left alongside the new one |
| 3. Label/value same-line | Applied app-wide (Lead/Contact, Test Bed, Opportunity), 170px label column chosen by surveying all 45 real labels in the app | Est. Close Date's tight Edit-link spacing found and fixed in the same pass |
| 4. Account autocomplete | Found already fully built on both Contact detail and Opportunity's Reference tab, including pre-fill from Company text, nothing to build | A real multi-match bug question resolved (no bug, confirmed via two similarly-named test Accounts), and a genuine gap closed: the create-new field was hardcoded to the search text verbatim, now genuinely editable |
| 5. Contacts list rebuild | Hover-create dropdown, count repositioning, hover-preview, whole-row click | A real hover-tracking bug found and fixed: replacing the hovered DOM node mid-gesture silently broke mouseenter/mouseleave, fixed by toggling visibility instead of re-rendering |
| 6. Test Bed list rebuild | Two summary matrices with click-to-filter, new field set | The City-from-Site-Address heuristic was tested against real non-UK formats, found broken on 2 of 4, abandoned in favour of a real, separately-entered field rather than continuing to patch an approach that can't be made reliable for free-text international addresses |
| 7. Reference tab 3-panel rebuild | Terminus Details / Customer Details / Key Dates, Authority renaming | Found and resolved a genuine field-duplication bug (two independently-built "who's responsible" field sets), and surfaced a new, real gap: Test Bed has no per-field Notes History at all, unlike Contact and Opportunity |

**Genuinely open items, not part of this build, tracked in
`DESIGN_PRINCIPLES.md`:**

- Whether the named Authority fields are literally who submits the
  corresponding `approval_obtained` decision, flagged unconfirmed in
  `Terminus_Role_Definitions.docx`.
- Test Bed's missing per-field Notes History.
- The confirmed but not yet built buyer-role catalog design
  (mandatory core / admin catalog / free-text escape valve).
- SSH remote access setup between the Mac build environment and a
  Windows laptop, parked mid-troubleshooting, not build-related.

