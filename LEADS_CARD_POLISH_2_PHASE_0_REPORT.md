# Phase 0: measurement

Read-only after the F5 act. The follow-up panel was not touched and Lead
Detail was not opened. Nothing pushed.

**R1 and R2 turn out to be the same fix**, and **R4 and R5 collide with
the frozen surface in a way R2 does not.** Sections 1 and 2.

---

## 0. The F5 first act, completed

`7a3f905`, then **re-gated 22/22, 0 SKIP**, door stage `PASS 112159ms`.

| | before | after |
|---|---|---|
| `teardown-scoping` headline test | 19,887ms failing / 6,339ms passing | **7,510ms** |
| heaviest single statement | ~1,459ms warm (25 tags) | **526ms warm** (6 tags) |

The timeout is **per statement**, so per-statement work was bounded:
`TAG_CHUNK_SIZE` 25 to 6, measured roughly linear. **Same rows, more
statements, coverage untouched.** A headroom guard asserts the
**heaviest** chunk against a **derived** ceiling - warm times the observed
6x cold factor times 1.5 margin must clear the 8s timeout, so 889ms.
Calibrated both ways: 25 fires it at 944ms; removing `pagedSelect`'s
coverage claim breaks two tests.

### And the first fix rested on a measurement I got wrong

I measured *"with payload 7,879ms, without 1,308ms, six times"* and
concluded an unread column was the cost. **Both numbers are real and the
conclusion was false** - they ran in that order, so the first paid for a
cold cache. Alternated and warm the honest ratio is **1.17x**.

**The calibration caught it, not a re-read.** The guard was supposed to
fire on the reinjected defect and did not. The superseded reasoning is
left at the site.

**And the guard itself was wrong twice before it was right**: first it
watched the slowest page any scan had run, which was this test's own
5,525-row teardown rather than the 24,443-row statement that failed
(Verification 25); then it timed the FIRST six tags, 407 rows, and its
own population assertion refused the reading. It now times the
**heaviest** chunk.

---

## 1. R1: confirmed, and it is R2

**The record carries both lines. The popup can only enter one.**

| | |
|---|---|
| live contacts | 14 |
| carrying `address` (Line 1) | 10 |
| **carrying `address2` (Line 2)** | **10** |
| example | `"11 Riviera Drive"` / `"04-12"` |

**The cause is not a missing field - it is the popup's design.** The
completion popup renders **exactly the keys the server names as
blocking**, which was the right answer to the last round's R1 and is
proven by a probe comparing the rendered inputs against `exit-criteria`.
The Qualify gate carries **14** fields and **`address2` is not one of
them**:

```
address, city, company, country, email, industry_id, jobRole,
linkedin, mobile, name, postcode, region, source, summary
```

So a lead can be qualified without Line 2, correctly - and **the popup
therefore never offers it**, so a person filling in an address on that
surface cannot enter the second line at all.

**That is exactly what R2 fixes.** Rendering the address **panel** rather
than the blocking **list** gives all six address fields, Line 2 included.
**R1 needs no separate work**; it is the first consequence of R2, and
doing R1 alone would mean special-casing one field into a list the whole
point of R2 is to stop using.

---

## 2. R2's real scope: card-local and achievable

**The card shares exactly four things with frozen Lead Detail**, measured
by walking the card's imports:

| shared with frozen Lead Detail | wanted by |
|---|---|
| `contact/LinkAccountPanel` | **R4** |
| `contact/NotesHistory` | **R5** |
| `contact/FollowUpTask` | frozen anyway (R7) |
| `contact/notes` (the Note type) | nothing |

**Everything R2 needs is already card-local**: `leadFields.ts`,
`LeadFieldInput`, and `AddressPopup`'s field grid all live in `leads/`
and nothing outside that folder imports them.

**So R2 is achievable with no contact on the frozen surface.** The
completion surface is assembled from the card's own address grid, its own
contact fields and its own summary editor - the same components that
render and edit those fields elsewhere on the card, which is the
two-readers drift R2 exists to remove.

### But R4 and R5 do touch shared components, and the pattern is established

**`LinkAccountPanel` has already been extended twice this way** -
`submitPath` and `onCancel`, each an **optional prop defaulting to the
existing behaviour**, so Lead Detail was provably untouched. That is the
pattern for R4.

**`NotesHistory` has no such prop yet**, so R5 needs the same treatment: an
optional prop that changes the header layout for the card and leaves Lead
Detail's exactly as it is.

**The alternative - a card-local copy of each - buys independence at the
cost of a third and fourth declared duplication**, on top of
`NurtureDialog` and the address popup. **Recommended: additive optional
props**, because the pattern is proven, asserted, and disappears cleanly
when Lead Detail retires.

---

## 3. R3: the region list lives in six places, none of them authoritative

| copy | |
|---|---|
| `frontend-react/src/contact/descriptors.ts` | `REGION_OPTIONS` - **frozen Lead Detail's** |
| `frontend-react/src/testbed/descriptors.ts` | `REGION_OPTIONS` |
| `frontend-react/src/account/descriptors.ts` | `ACCT_REGION_OPTIONS` |
| `frontend-react/src/reference/descriptors.ts` | `REGION_OPTIONS` - the Opportunity Reference tab John pointed at |
| `frontend/app.js` | `TB_MATRIX_REGIONS` |
| `frontend/index.html` | three hardcoded `<option>` blocks |

Plus two more in tests. **All six carry the same five values** -
`Americas, Europe & UK, Middle East, APAC, Africa` - **and none is in the
database.**

**Region is free text in every place the card enters it today**: the
completion surface, the address popup and the New Lead grid all render it
through `LeadFieldInput`'s default `text` branch.

**So R3 is not "add a dropdown", it is "choose a source".** Three options:

1. **A seventh copy, card-local.** Cheapest, and it makes the drift worse
   in a round whose load-bearing item exists to remove drift.
2. **A new shared module the card reads**, leaving the other six until
   their surfaces are touched. One new reader, no edit to frozen code.
3. **Serve it from the server**, the way `creation-requirements` already
   serves `sources` to both the grid and the popup. **Derived rather than
   copied**, which is the property that made `jobRole` reach the grid's
   markers with no grid edit.

**Recommended: (3).** It is the only one that makes the list
authoritative, it matches a pattern already working in this exact screen,
and it costs one route. **Decision needed before Phase 1 builds.**

---

## 4. R4: the search already works; the CREATE is what is missing

`findAccountMatches` already filters client-side on every keystroke, and
the card already fetches the account list. **Live accounts: 5.** No
endpoint is needed and none should be added.

**The actual gap is one line:**

```js
{query.trim() && !matches.length ? <Create ...> : null}
```

**Create is offered only when NOTHING matches.** Type `Willow` and
`Willowglen` matches, so creating a distinct account called `Willow` is
impossible - which is precisely R4's *"continuing to type creates a new
account"*.

So R4 is: **offer Create alongside matches**, and present the matches as a
dropdown rather than an inline button row. Both changes go behind an
optional prop per section 2.

---

## 5. R5: the delta, and it is on a shared component

Today the header row carries **"Latest first"** and, when the editor is
closed, **Add note**. When the editor is OPEN, Add note and **Discard**
sit in the input wrapper **below** the header.

R5 wants **Add note and Discard both on the header line**, and Notes moved
**further left** (the last round closed 108px to 36px).

**The Discard is a cancel-this-note, not a card-level discard** - it
already behaves that way (`setOpen(false); setText('')`), so only its
placement moves.

---

## 6. Decisions Phase 1 needs

1. **R3's source** - section 3. Recommended: serve the region list from
   the server, as `creation-requirements` already serves `sources`.
   **Needed before Phase 1 builds**, because it decides whether a route
   is written.
2. **R4 and R5's mechanism** - additive optional props on the shared
   components (recommended, pattern proven twice) versus card-local
   copies.
3. **R1 folds into R2** - confirm that rather than tracking it separately.

---

## 7. What this phase does not establish

- Nothing was built after `7a3f905`. No source differs except the brief
  and this report.
- **The follow-up panel was not measured or touched**, and Lead Detail was
  not opened.
- **R2's scope is measured by imports, not by rendering.** That a
  component is card-local says it can be changed safely; it does not say
  the assembled surface will look right, which is Phase 1's screenshot
  work at three widths.
- The account count is **5**. Client-side search is feasible **at that
  size**; nothing here establishes a ceiling where it stops being.
