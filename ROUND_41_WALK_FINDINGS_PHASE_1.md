# Round 41 walk findings, phase 1: the conflict cluster

**REPORT ONLY. No code.** The re-price-and-version walk failed with a hard stop.
Every statement below is from the audit trail, the revision table, the approvals
table and the source; nothing is inferred from the screen.

**Record: TT-SGP-SMARTC-003, `d86369b3`.** Today is 2026-08-31.

---

## 1. What moved the record from revision 30 to 33

**The hypothesis was that the user's own other tab advanced the revision. It is
FALSE, and the truth is worse: it was the same tab, the same page.**

| rev | at | write | screen | route | Round 41? |
|---|---|---|---|---|---|
| 30 | 22:52:08 | `notes, lead, legal, region, country, estGoLive, technical, commercial, actualClose, actualGoLive, commAddressSameAsAccount` | **Reference tab**, one generic save | `PATCH /opportunities/:id` via `oppPatch` | **no**, pre-existing |
| 31 | 22:52:41 | `assessOrgEconomicBuyer` = 4 | **Assessment panel** | `POST /opportunities/:id/scores` | **no**, pre-existing |
| 32 | 22:52:42 | `assessOrgChampion` = 4 | **Assessment panel**, same click-through | `POST /opportunities/:id/scores` | **no**, pre-existing |
| 33 | 23:02:36 | `assessmentReviewed` | **Exit criteria**, the review tick | `POST /opportunities/:id/assessment-reviewed` | **no**, pre-existing |

**No Round 41 write site is involved.** Round 41 added three: the
structure-selection conditional defaults (`PATCH /opportunities/:id`, gated on
`structure` or `factoring` being sent), the version freeze (a READ of the
defaults, writing only into the version row), and creation-time initial values
(`contacts.js`, `test-beds.js`). **None of them ran in this session** - the
structure was never changed, no version was successfully taken, and the record
was created in Round 33's era.

**"Currency initial value" is not a Round 41 write site and, measured, is not a
coercing default either.** `populateForm` sets the two selects through
`setCurrencySelect(id, p.bidCurrency)` with no `?? 'USD'`, and `readPayload`
sends `emptyToNull`. A blank stays null.

### The mechanism, and it is one variable

`frontend/app.js:5831`:

```js
let oppLoadedRevision = null
```

**One module-level variable for the whole SPA**, set on load and updated **only**
by `window.oppPatch`, which re-reads `revision_number` from the PATCH response.
`saveVersion` sends `expected_revision: window.getOppLoadedRevision()`.

**Three of this session's four writes do not go through `oppPatch`:**

| write | call | updates `oppLoadedRevision` |
|---|---|---|
| Reference save | `window.oppPatch(...)` | **yes** |
| exit-criterion tick | `window.oppPatch(...)` | **yes** |
| **score recorded** | `api('POST', .../scores)` | **NO** |
| **assessment reviewed** | `api('POST', .../assessment-reviewed)` | **NO** |

So the variable tracked to 30 at the Reference save and **stopped there**, while
the record went to 33 through three writes the handshake never saw.

**This is Architecture rule 8's shape.** `oppPatch` was correct for every caller
it had. The scores route and the assessment-reviewed route are correct too. What
is wrong is that a revision handshake exists on one write path and not on the
others, so a screen holding a stale number is the normal outcome of ordinary use
rather than a race.

---

## 2. Three revision numbers on one screen

| on screen | value | element | live or stale |
|---|---|---|---|
| `Saved (revision 24).` | 24 | `#deal-feedback` | **STALE**, and by 7 hours 38 minutes |
| `would have recorded revision 30` | 30 | `#deal-version-feedback` | **live at the moment it was written** |
| `now at revision 33` | 33 | same message | **live** |

**Why all three can be on screen at once.**

**24** was written by `saveDeal()` at `opportunity-deal.js:2116` at **15:35:54**,
when it created revision 24. **Nothing ever clears `#deal-feedback`.** It is set
only on save and read by nobody, so it sat there through eight later writes.

**30 and 33 are one sentence**, raised by the database inside
`append_deal_sheet_version` and passed through unchanged:

> `This Opportunity is at revision %, and the version would have recorded revision %. Reload and take it again.`

**33** is `v_current`, read under the advisory lock. **30** is
`p_expected_revision`, which is `oppLoadedRevision` - the number question 1
explains.

**So the screen is not confused. It is showing one number from 15:35, one from
22:52 and one from 23:13, and none of them is labelled with when it was true.**

---

## 3. The approval write refuses while the display shows unticked

**They disagree because they measure against two different revisions, and one of
them is `null`.**

### What the WRITE checks

`src/routes/approvals.js` inserts into `approvals` and maps a `23505` unique
violation to the refusal. The uniqueness is over **(record, revision, track,
approver)**, and the revision is **the record's current revision**.

### What the DISPLAY reads

`records.js` → `loadVersionApproval` → `liveVersionApproval` →
`versionApprovalState`, and the first line of that function is:

```js
const at = version?.revision_number     // the DEAL SHEET VERSION's revision
```

**Not the record's.** The Commercial rule is `{"scope":"version","track":"Commercial"}`,
so the tick asks: *is there a Commercial approval at the revision the latest
approvable version was taken from?*

### The data

```
approvals   rev 32 Commercial approved   23:00:20
            rev 33 Commercial approved   23:13:16
            rev 33 Technical  approved   23:13:18
            rev 33 Legal      approved   23:13:24

deal_sheet_versions   V1.0  issued   revision_number = NULL   2026-08-27
```

**The only version on this record carries a null `revision_number`**, so
`Number.isInteger(null)` is false and `versionApprovalState` returns
`state: 'unapprovable'` before it looks at a single approval.

**The Commercial track on this record cannot be ticked by any approval, ever.**

**And this is a documented, deliberate state**, from
`20260829000001_version_carries_its_revision.sql`:

> *One version row exists that predates this column... a version with a null
> revision_number cannot be approved, and the screen says why rather than the
> store being corrected.*

**What was NOT built is the second half of that sentence.** The screen does not
say why: `liveVersionApproval` produces `"V1 is unapprovable."` for this state,
and **the approve control is still offered and still writes.** So the product
accepted three approvals it had already decided could never count, and then
refused the fourth with a message about a revision number that has nothing to do
with why the first three were useless.

**Three failures, in order:** an unapprovable version is not said to be
unapprovable; the action that cannot succeed is still offered; and the refusal
when it is repeated names the wrong reason.

---

## 4. Why the message persisted, and what was actually written

### The persistence

**Nothing clears either feedback element on load.** `versionFeedback()` is called
only from the version actions and `#deal-feedback` only from `saveDeal`; neither
`loadOpportunityDetail` nor `populateForm` resets them. Navigating back into the
record through the application re-renders the panel's *contents* and leaves both
messages exactly where they were. **Only a real browser refresh clears them**,
because that is the only thing that rebuilds the DOM.

### What persisted, per field

| what | persisted | where |
|---|---|---|
| close date move to `2026-09-14`, reason `eqrtqet` | **yes** | `opportunity_details.forecast_close_date`, rev 28 |
| Reference tab: `estGoLive` `2026-10-21`, `actualClose` `2026-10-15`, `actualGoLive` `2026-10-21`, plus `notes, lead, legal, region, country, technical, commercial` | **yes** | revision 30 |
| five assessment scores | **yes** | revisions 25, 26, 27, 31, 32 |
| exit criteria: `exitSolKeyStakeholders`, `assessmentReviewed` | **yes** | revisions 29, 33 |
| four approvals | **yes** | `approvals`, and **three of them can never count** |
| **the deal sheet version** | **NO** | no row was created; the record still has exactly one version, V1.0 from 2026-08-27 |
| **anything typed on Commercials at 23:13** | **NOTHING WAS PENDING** | see below |

**The Commercials form was not dirty**, and this is derivable rather than
assumed. `saveVersion()` saves the record first when `isDealFormDirty()`, and
reports `"The pricing could not be saved, so no version was taken."` if that save
fails. The message John saw came from the **version insert**, so the save either
succeeded or never ran - and no revision exists after 33, so it never ran.

**Nothing was lost. Nothing was saved either.** The walk stopped before it could
put a price anywhere.

---

## 5. Every date field on the Opportunity

### The population, both directions

**Forward, from the field definitions** (`opportunity-reference.js:136-139`):
four entries carrying `date: true`. **Backward, from the routes**: the
`SALESPERSON_WRITABLE_KEYS` date members and the `close-date-move` endpoint.
**The two agree at four fields, and one of them is not a payload key at all.**

| field | stored | written by | entry validation | save validation |
|---|---|---|---|---|
| **Est. Close Date** `estClose` | `opportunity_details.forecast_close_date`, **a column, not a payload key** | `POST /opportunities/:id/close-date-move` **only**. Mandatory reason, audited, move counter | `min=today` on the native input | `isValidIsoDate` **and** `isNotPastIsoDate` |
| **Actual Close Date** `actualClose` | payload | generic `PATCH` from the **Reference tab**, any stage | `type="date"`, **no `min`** | `isValidIsoDate` only. **No past check, no future check, no stage check** |
| **Est. Go Live** `estGoLive` | payload | generic `PATCH` | `min=today` | `isValidIsoDate`, `isNotPastIsoDate`, and `>= estClose` |
| **Actual Go Live** `actualGoLive` | payload | generic `PATCH` | `type="date"`, **no `min`** | `isValidIsoDate`, and `>= actualClose` since Round 34 |

**No other date field exists on the Opportunity.** `cd-park-date` is the only
other `type="date"` in the markup and it belongs to Contact detail.

### Why the past-go-live fix did not hold

**Measured across all four live opportunities:**

```
TT-SGP-MANUFI-002  Closed Won   estClose 2026-08-31   actualClose 2026-10-14   estGoLive 2026-09-23   actualGoLive 2026-08-30 PAST
TT-SGP-SMARTC-002  open         -                     -                        -                      -
TT-SGP-SMARTC-003  open         estClose 2026-09-14   actualClose 2026-10-15   estGoLive 2026-10-21   actualGoLive 2026-10-21
TT-SGP-SMARTC-001  open         estClose 2026-07-29 PAST
```

**The fix holds at the moment of writing and cannot hold afterwards, because it
validates an EVENT and the defect is a STATE.**

`isNotPastIsoDate` compares against `new Date()` **at write time**. TT-SGP-
SMARTC-001's estimated close of **2026-07-29** was valid when it was entered and
is now **33 days past**, on an open deal, and no code path will ever look at it
again. **Nothing did anything wrong. Time passed.**

**And the same property makes the rule bite the wrong person.** The Reference tab
saves the WHOLE payload, so an `estGoLive` that has since passed is re-sent
unchanged on the next save and **refused** - the deal becomes unsaveable from
that tab until somebody changes a date they did not intend to change.

### Two more things the sweep found, both pre-existing

**A Closed Won deal whose actual close date has not happened yet.**
TT-SGP-MANUFI-002 carries `actualClose 2026-10-14`, six weeks in the future.
**Nothing checks that an actual date is not in the future**, and nothing ties
`actualClose` to the Closed Won transition: it is an ordinary Reference field,
writable at any stage. **TT-SGP-SMARTC-003 carries one too, and it is in Solution
Alignment.**

**A go-live before its own close, in the live data.** The same record has
`actualGoLive 2026-08-30` against `actualClose 2026-10-14`. The check that
forbids this landed **2026-08-26** (Round 34); the record was last written
**2026-08-22**. **Pre-existing data that the current rules would refuse, and
nothing re-validates what is already stored.**

---

## What the walk actually hit, in one paragraph

The record moved three revisions under the user's own hand through panels whose
writes do not participate in the revision handshake; the Commercials tab kept a
number from before that and refused its version with a message naming two
revisions and a third stale one beside it; the approval it offered instead could
never have ticked, because the only version on the record predates the column
that makes a version approvable; and the message explaining none of this stayed
on screen because nothing clears it.

**Report only. No fix is proposed here.**
