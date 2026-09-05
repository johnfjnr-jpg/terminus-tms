# Migration Round 2, Phase 0: investigation

**2026-09-05.** Numbered against `MIGRATION_ROUND_2_BRIEF.md`'s Phase 0 items.
Gate green at **20 stages** before reporting. Nothing pushed. Phase 1 not
started.

**Four discrepancies are recorded, and the brief says discrepancies stop the
round.** They are D1 to D4 in section 11. Two are blocking as scoped.

---

## Preconditions

**P-1. The method skill.** Present, and it was **UNTRACKED** - one `git clean`
from gone, as the brief says. Committed as `b49211e`, message
`.claude/skills: the round method, encoded from Migration Round 1`.

**Did it load in this session?** `ListSkills` reports it registered and
`enabled: true`. **It did not load into this session's context**: the session
began before the file existed, and no skill listing carrying it reached me. I
read it from disk instead, so this phase ran against its actual text rather
than a summary. Worth stating plainly, because a session that assumed it had
loaded would be running on `CLAUDE.md` alone.

**P-2. The gate.** Green. Run on `b49211e` rather than on `origin/main` HEAD:
that is the tree that exists, and the skill says run the gate on the exact tree
and do not reason a gate forward. The two differ only by the skill markdown.
Environment pre-checked first as separate named steps: DNS 12ms, TCP open, VPN
**active** (13 tunnel interfaces, resolver `100.64.0.2`), real query 846ms.

---

## Inherited items 1 to 6

### 1. The `CURRENT_STATE.md` staleness watcher - EXTENDED, and the brief's premise corrected

**The check existed only as PROSE in `CLAUDE.md:2429`.** There was no script.
That is why nobody noticed it was narrow: **a procedure a person types is a
procedure nobody calibrates**, and the brief requires items 1 to 4 to be
calibrated both directions. So it is now `scripts/check-state-fresh.mjs`,
which is what makes the calibration possible at all.

**THE WATCH LIST IS NOW THE GENERATOR'S OWN INPUTS, derived rather than typed.**
Measured against `scripts/state-dump.mjs` (with `grep -a`, per Verification 12 -
that file holds NUL bytes and plain `grep` reads nothing from it):

| watched | in the old list? |
|---|---|
| `supabase/migrations` | yes |
| `supabase/seeds` | yes |
| `src/routes` | yes |
| **`src/server.js`** | **NO** |
| **`OPEN_SECURITY_STEPS.json`** | **NO** |

**So the list was already incomplete before the React tree existed.** It was
missing two of the generator's five inputs. That is a sharper finding than
"blind to `frontend-react/`", and it is the one that would have bitten first:
Round 1 changed `src/server.js` in three separate phases and the staleness check
reported "not stale" every time.

**`frontend-react/` is deliberately NOT on the list, and this contradicts the
brief - see D3.**

**Calibration, both directions, and the second half is the discriminating one:**

| direction | result |
|---|---|
| a committed change to `src/server.js` | **FAIL**, names the file, exit 1 |
| the SAME change under the old three-path list | **sees NOTHING** - would report fresh |
| after reverting | **PASS**, exit 0 |

**Not added to the merge gate**, and that is a position rather than an
oversight: `CURRENT_STATE.md` is regenerated at a round's close, so a watched
source changing mid-round is the normal state of a working tree. A gate stage
would be red for most of every round and would be learned-to-ignore, which is
the failure mode `CLAUDE.md` records for the old always-fails staleness rule.
It is a close-out tool and runs there.

### 2. `refresh-session.js` prints the caught error - DONE

It printed `The refresh token has expired too` **unconditionally on every
failure**. On 2026-09-05 the real cause was `fetch failed` from a stuck VPN DNS
entry, and that sentence sent two separate diagnoses toward a password nobody in
the session had. Architecture 9's fourth variant, and load-bearing because
people act on it.

The error is now printed first and in full, with the status, and **the remedy is
chosen from what the error says**. Where it recognises nothing, it says so and
offers both routes rather than guessing.

**Calibration - the brief's requirement is that the two read differently:**

| injected cause | what it now says |
|---|---|
| network (`SUPABASE_URL` at an unresolvable host) | `refresh failed: fetch failed` → *"That is a CONNECTIVITY failure, not an expired token"* → `scripts/check-reachable.mjs` |
| genuinely invalid refresh token, network fine | `refresh failed: Refresh token is not valid`, `status: 400` → *"The refresh token itself is no longer valid"* → `sign-in.js` |
| diffed | **DIFFERENT.** The remedy follows the cause |

### 3. The session pre-stage's mid-run coverage - EXTEND AT GATE START

The brief offered two options. **Measured before choosing, both halves:**

- a token is issued for **3600s**;
- the last four gate runs took **356, 361, 365 and 375 seconds** of stage time.

**So a gate cannot outlive a FRESH token.** It only dies when the token was
already near expiry at the start, which is exactly what happened.

**Position: extend at gate start.** Re-validating before the HTTP block only
*labels* the failure - the pure and database suites have already run and the
HTTP block still does not execute. Extending *prevents* it, for about one
second, and turns a 6-minute gate against a 60-minute token into a 10x margin.

The threshold is **15 minutes**, 2.5x the longest observed gate. Above it
nothing is touched, so an ordinary run does not churn credentials. A failed
refresh is deliberately **not fatal**: the existing token may still have minutes
on it, and the validation below it is the authority.

**Calibration:**

| direction | result |
|---|---|
| `expires_at` set to 5 minutes out | *"session has 5 minutes left, under the 15 minute floor. Extending."* → refreshed → 60 minutes |
| token with 60 minutes | **0 lines** mentioning `Extending` |

### 4. The environment reachability pre-check - DONE, and it is gate stage 1

`scripts/check-reachable.mjs`. **DNS and TCP as separate named steps, because
they fail differently and the difference IS the diagnosis:**

| DNS | TCP | what it means |
|---|---|---|
| fails | untestable | a resolver problem. **The service is fine** |
| works | refused | the host is up and the port is shut. The service, not the network |
| works | times out | a firewall or a black hole in between |
| works | open | any later failure is a real service or credential problem |

Diagnosed as one step, all four look identical.

**The VPN note is printed every run, whether or not it is the cause**, because a
VPN resolver with a stuck entry is indistinguishable from the service being down
until measured. Current output: `vpn: ACTIVE OR LIKELY (13 tunnel interfaces,
resolvers 100.64.0.2, 192.168.18.1)`.

On failure it says **"ENVIRONMENT, NOT FINDINGS"** in those words, and
**"No suite has been run. Nothing here is a defect in this repository."**

**Wired as gate stage 1**, ahead of the session, and the **database suite is now
gated on it** - that is the stage which reported 91 failures over 821 seconds
against a dead network.

**Calibration, all branches:**

| direction | result |
|---|---|
| unresolvable host | `DNS resolution failed`, `getaddrinfo ENOTFOUND after 17ms`, VPN named as first suspect |
| resolves, port closed (`localhost:9`) | `TCP connect failed`, `ECONNREFUSED, though DNS resolved`, *"That is the service, not the network"* |
| healthy | `PASS ... dns and tcp both answered` |
| full gate with the network broken | `FAIL reachability 80ms`, database suite and 14 HTTP stages **SKIP** |

**AND THE CALIBRATION FOUND A DEFECT IN THE CHECK ITSELF.** The first version
hardcoded `port = 443`, so a deliberately closed port in the URL was silently
replaced by an open one and the TCP branch **passed on a case built to fail
it**. The port now comes from the URL. Verification 17: a probe that runs
cleanly and cannot tell two states apart.

**A second defect, created by this item and fixed under build discipline 10's
limit.** With two gate stages, every skip line read `not run: the session
precondition failed` **on a run where reachability was what failed**. A label
asserting something nobody checked, in the round whose Round 1 close-out was
about exactly that. The flag now holds the failing stage's NAME:
`not run: reachability failed`.

### 5. The P/S numbering scheme - CONVENTION RECORDED, and see D4

Brief points are `P1..Pn`; enumerated shapes are `S1..Sn`.

**There is nothing in the repository to rename.** Measured: no tracked probe
carries a numeric `point` field. The Round 1 walk probe that produced the
collision was a scratch file and was never committed. The convention is
forward-looking only, and it is already in the method skill ("Numbering schemes
must not share a range in one document... Prefix or rename").

**The brief's own claim that it is "Applied in this document" is not true - D4.**

### 6. Commit the method skill - DONE

`b49211e`, as precondition P-1.

---

## This round's investigation, items 7 to 10

### 7. The Account surface, enumerated completely

**THERE ARE NO TABS.** Measured live: `tabs: 0`. The Account view is one
scrolling `wrap` with three `pg-card` panels and a linked-contacts list. The
contract's "default tab only" caveat is **moot for this surface** - its count
was already complete.

**Counted by what RENDERS, on `TT-SGP-21STCENTUR-001`, which is the instrument
the contract used:**

| panel | `.ref-field` rows |
|---|---|
| Account Details | 4 (2 editable, Date Created read-only, Parent Account read-only) |
| Billing Address | 6 |
| Shipping Address | 6 |
| **total `.ref-field`** | **16** |

- **14 click-to-edit rows**, each `.ref-field` with a `.ref-field-display[tabindex]`:
  `terminusLead`, `websiteUrl`, and `billing`/`shipping` × `Address`,
  `Address2`, `City`, `Postcode`, `Country`, `Region`.
- **2 read-only rows**: `Date Created` (via `acctReadonlyRow`) and
  **`parentAccount`** (via `renderAcctParentRow`, `readonly` in BOTH branches).
- **1 name-header editor**, which is **not a row**: an `<h1
  class="cd-name-display">` in `index.html`, outside any `.ref-field`, with
  **no `tabindex`** and an inline `onclick`.
- The reference code (`#acct-detail-number`) is a `<p class="sub">`, not a row.
- 3 `<select>`, 12 `<input>` (11 row inputs + the name input).

**14 + 2 + 1 = 17**, which is the brief's seventeen - but only under one
specific split. See D1 and D2.

**The parent-link widget's three functions:**

| function | what it does |
|---|---|
| `openAcctParentSearch()` | reveals `#acct-parent-search-panel` and renders the search box |
| `renderAcctParentResults(query)` | filters `accountsCache` client-side by name |
| `linkAcctParent(parentId)` | `PATCH /api/accounts/:id` with `{ parent_account_id }` |

**`parent_account_id` is a real column, not a payload key, and it saves
IMMEDIATELY on Link** - it never joins the batched save bar. The vanilla says so
in its own comment and the code agrees.

**The save path and its payload shape:**

```js
PATCH /api/accounts/:id
{ payload: { <only the dirty keys> }, expected_revision: acctLoadedRevision }
```

- dirty is computed as `e.draft !== e.orig` - **the contract's behaviour 1,
  already**;
- only dirty keys are sent, never the whole payload;
- `name` is validated client-side as required (non-blank) before the call;
- **there IS a revision handshake**: `expected_revision` on the way out, and on
  the way back `if (Number.isInteger(result.data?.revision_number))
  acctLoadedRevision = result.data.revision_number`. A 409 renders *"This
  Account changed since the screen loaded"*;
- on success it re-fetches the record AND the accounts list.

**The name header shares the draft store.** `ACCT_ALL_EDITABLE_FIELDS` is
`[name, ...detail, ...billing, ...shipping]` = 15, and `saveAcctFields` reads
`acctEdits` for all of them. The brief asks whether the edit bar aggregates
across the header: **it does**, so unifying them in React is faithful rather
than a silent unification.

### 8. The coupled surface - the revert list, five entries

Scan calibrated before being read as absence: `account-detail.js` found in 2
files, `ds-row` in 3, across 99 scanned scripts. `openAcctField` at zero is a
real absence - **no test or probe names any Account symbol.**

| # | location | what it is | Phase 1 disposition |
|---|---|---|---|
| 1 | `frontend/index.html:3186` | `<script src="/account-detail.js">` | swapped for the bundle tag |
| 2 | `frontend/index.html:383` | `onclick="openAcctField('name')"` on the name `<h1>` | removed |
| 3 | `frontend/index.html:386` | `onclick="discardAcctField('name')"` on the discard `<span>` | removed |
| 4 | `scripts/tests/opportunity-headline.test.mjs:132` | reads `frontend/account-detail.js` and asserts `label: 'Terminus Lead'` survives | **the Round 1 `ds-row` shape exactly**: it will go on PASSING against a file the browser never fetches. Needs the three-part re-point |
| 5 | `scripts/tests/class-rules.test.mjs:66` | a STRING in `STATE_CLASSES` naming `account-detail.js` as where `field-editing` is toggled | becomes false when React owns the surface. **Nothing fails** - it is prose inside a data structure |

**Entry 5 is a shape Round 1 did not meet**: a claim living inside a test's data
structure, which the test uses as documentation rather than asserting. It cannot
fail and cannot be caught by the three-part template. Named here so Phase 1 does
not walk past it.

**The revert is therefore THREE edits to `index.html` plus the re-point**, not
one script tag. The brief already anticipates this ("however many edits it truly
is").

### 9. The guard - MEASURED, no door exists

**Confirmed, both halves:**

- **`openAcctField` carries no ownership check.** Its only guard is
  `if (acctEdits[key]) return`, a reentrancy check. Full body read.
- **`is-not-mine` appears 0 times in `account-detail.js`** and **twice in
  `app.js`**, on `view-test-bed-detail` (line 6371) and `view-opportunity-detail`
  (line 7900). **Never on `view-account-detail`.**

So the ruling is accurate: the vanilla Account surface is editable by any signed-in
user who can see it, and that is now deliberate rather than unexamined.

**The wiring is scoped, and that is a position - see D-position below.** The
brief says `canEditFields()` returns true on the Account surface. A global
`() => true` would be a claim about **every** surface, including Opportunity and
Test Bed, which do have doors and which Round 3 migrates. Under addendum finding
10 an unwired guard fails closed; a wrongly-wired one fails **open**, which is
worse.

**Position: wire it to return `true` for `account-detail` and `false` for
anything else**, until each surface's door is ruled. That satisfies the brief's
ruling exactly, is one line to change when it is revisited, and cannot leak
permission to a surface nobody has ruled on. **Not implemented in Phase 0**: it
is a change to `frontend/app.js`, which is product code, and Phase 0 is
investigation. It lands in Phase 1 with the rest of the wiring.

### 10. Field descriptors - and a blocking gap

**`src/lib/field-validation.js` does not speak about any Account field.**
Measured: it exports nine **type** validators (`isValidIsoDate`,
`isValidNumber`, `isValidNonNegativeInteger`, `isValidNonNegativePercent`,
`isNotPastIsoDate`, `isValidIsoTimestamp`, `isValidMobile`, `isValidLatitude`,
`isValidLongitude`), contains **no object keyed by field name**, and is imported
by `contacts.js`, `test-beds.js` and `opportunities.js` - **not by
`accounts.js`**. The only validation on the Account route is
`validateParentAccountId`, a referential check on the link, not a field-value
rule.

So **no Account field carries a validation-implied `inputMode`.**

| field | label | editor | inputMode | readOnly |
|---|---|---|---|---|
| `name` | Account Name | text (header) | - | no |
| `terminusLead` | Terminus Lead | **SELECT**, options from `terminusStaffCache` | - | no |
| `websiteUrl` | Website URL | text | - | no |
| `billingAddress` | Address Line 1 | text | - | no |
| `billingAddress2` | Address Line 2 | text | - | no |
| `billingCity` | City | text | - | no |
| `billingPostcode` | Postcode / Zip | text | - | no |
| `billingCountry` | Country | text | - | no |
| `billingRegion` | Region | **SELECT**, 5 fixed options | - | no |
| `shipping*` | (same six) | same, incl. **SELECT** Region | - | no |
| - | Date Created | - | - | **yes** |
| `parentAccount` | Parent Account | widget | - | **yes** |

**`websiteUrl` has no `url` inputMode and no validation anywhere** - it is plain
text on both sides today. Declaring `inputMode: 'url'` would be a new
constraint, not a port, so it is left alone and named here.

---

## 11. Discrepancies

The brief says discrepancies stop the round. **D1 and D2 are counting; D3 and D4
are claims about documents. D-BLOCK is the one that stops Phase 1 as scoped.**

**D1. "Fifteen click-to-edit rows" is 14 rows plus the name header.** Measured:
14 `.ref-field` elements carry a tab stop. The name header is an `<h1>` outside
any `.ref-field`, and it has **no `tabindex` at all**. The contract's 15 and the
brief's fifteen both fold a structurally different element into a row count.

**D2. The brief lists the parent-account link widget as separate from the two
read-only rows. The parent row IS one of the two.** `renderAcctParentRow`
renders a `.ref-field` whose display carries `readonly` in both branches. Read
literally, "fifteen click-to-edit rows, two read-only rows, a parent-account link
widget and the record-name header editor" sums to 19; the true total is 17, and
seventeen is right only if the header is inside the 15 and the widget is inside
the 2.

**D3. `frontend-react/` cannot go on the staleness watch list, contrary to item
1's framing.** `scripts/state-dump.mjs` does not read it, so a change there
cannot make `CURRENT_STATE.md` stale - adding it would report **false**
staleness. The real gap is different and larger: **the generator records nothing
about the React tree at all**, so `CURRENT_STATE.md` is silent about a whole
workspace. That is a generator-coverage question and it needs a ruling, not a
watch-list edit.

**D4. Item 5 says the P/S scheme is "Applied in this document". It is not.** The
brief uses `P1`/`S1` only at lines 60-61, where the convention is *stated*.
Phase 0 uses plain `1..10`, and Phases 1 to 3 use bullets. The convention is
declared, not applied.

### D-BLOCK. The field-row component cannot render 3 of the 14 rows

**`terminusLead`, `billingRegion` and `shippingRegion` are `<select>`s.**

- `FieldDescriptor` has **no `options` key**.
- `FieldRow` renders an `<input>` and **no `<select>` anywhere**.

**And the contract puts this out of scope in writing:** *"Field-specific
editors. Dates, staff pickers, currency and the numeric guard are per-field
concerns layered on the row, not part of it."* `terminusLead` is a **staff
picker**, named explicitly.

So Phase 1 as scoped - "the fifteen rows and two read-only rows render through
`FieldRow` and `useFieldRows`" - **cannot be executed for 3 of them** without
either extending the component past its contract or building a second editor
beside it.

**This is first contact doing its job**, and it is the single most useful thing
this phase found: the contract was written from five implementations and the
first surface to consume it needs an editor the contract excluded.

**Three routes, and the choice is John's because it changes the contract:**

1. **Extend the row with an `options` descriptor key** and render a `<select>`
   when present. Smallest change; makes a select part of the row rather than an
   editor layered on it, which amends the contract's scope sentence.
2. **A sibling `SelectRow`** sharing `useFieldRows`, leaving `FieldRow` text-only
   and honouring the contract exactly. Two components to keep in step.
3. **A descriptor-declared editor slot** - the row owns state, door, dirty and
   keyboard; the editor is pluggable. Most general, most work, and it is the
   shape dates and currency will want in Round 3.

**Nothing built.** Route 3 is where the estate is going, but that is a design
ruling on the contract, not an implementation decision, so it waits.

---

## 12. Gate

```
MERGE GATE  20 stages
  PASS  reachability                          94ms
  PASS  session precondition                 256ms
  PASS  pure suite                 440/440 pass, 0 fail
  PASS  database suite              92/92 pass, 0 fail
  PASS  react suite                 86/86 pass, 0 fail
  PASS  react bundle freshness
  PASS  14 HTTP probes
All 20 stages passed.
```

Two stages are new this phase, both calibrated in both directions above.

---

## Standing at the close

Not pushed. Phase 1 not started. **Four discrepancies and one blocking gap are
on the table; D-BLOCK needs a ruling before Phase 1 can be scoped honestly.**
