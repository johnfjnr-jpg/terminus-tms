# LEADS Phase 5: the New Lead batch grid

The last screen. Built to the ruled layout, verified on the live screen
after rebuild, calibrated by injection. Nothing pushed.

---

## 1. What this phase did NOT resolve, first

### F1. `jobRole` is mandatory in the ruled layout and NOT in the server's creation minimum

The ruling was explicit: *"Mandatory at creation: EVERYTHING EXCEPT
Summary"*, and *"Derive the mandatory set from the server's own creation
rule, NOT a hand-written client list."*

**Those two sentences disagree, and the disagreement is in the server.**
Measured by omitting each column in turn from a real `POST /contacts`
and reading the refusal:

| omitted | server |
|---|---|
| name | REFUSED |
| company | REFUSED |
| jobRole | **ACCEPTED** |
| industry_id | REFUSED |
| email | REFUSED |
| mobile | REFUSED |
| source | REFUSED |
| summary | ACCEPTED |

The grid follows the ruling that WINS on the estate's own reasoning:
it derives, so it marks six, not seven. Job Title renders as a column
with no `*`.

**Why it was not simply added.** `POST /contacts` is the single creation
path for every contact in the system, including the inline
buyer-contact dialogue on the Test Bed surface. Adding `jobRole` to its
minimum makes Job Title mandatory THERE too, on a dialogue this round
never looked at. That is a change to what every creation path requires,
which is a product decision and not this screen's to take.

**The position taken, and it is reversible in one line:** the grid marks
what the server refuses without. If John rules Job Title mandatory at
creation, the change is one tuple entry in `src/routes/contacts.js` and
the grid's marker appears with no edit to the grid at all. That is the
derivation doing its job, and it is the reason the ruling asked for it.

### F2. A capability was lost, named rather than absorbed

`regionForCountry` filled in a region when you typed a country. Its own
comment recorded that it was *"scoped to the New Lead creation form
only"*, and that form is retired. A comment-stripped sweep of the whole
estate found the declaration and **zero readers**, so it was deleted.

**The capability is gone from the estate, not moved.** Typing a country
no longer fills a region anywhere. It never worked on the detail page
(that comment recorded why), and the ruled grid has no address columns
at all, so there is no surface here to carry it. The map itself is in
git and in the prototype at `Terminus Ops.dc.html:7510-7523`.

Flagged for John. Not rebuilt inside this phase.

### F3. Unclassed buttons across three React surfaces

Visible in `p5-pipeline.png`: **Add note** and **Save task** on every
lead card render as white browser defaults on the dark screen, the same
fault this phase just fixed on its own Save. They are P3's and P4's,
signed off, and not this phase's authorship - so they are reported and
queued rather than fixed here.

Worth saying plainly: the React migration has been shipping unclassed
buttons for several phases and **no suite can see it**. It took opening
a screenshot, and the one that was found belonged to this phase only by
luck of being in the same frame.

### F4. `reference_code` reads null on the contacts list

Noticed while writing the probe, which had keyed its card match on it.
Not investigated, not this phase's scope, and the probe was re-pointed
at the record id. Recorded so it is not discovered twice.

---

## 2. What was built

**`frontend-react/src/leads/NewLeadGrid.tsx`** - eight columns in the
ruled order, four blank rows, Save bottom-right.

- **The mandatory set is derived.** `GET /contacts/creation-requirements`
  is a new endpoint serving the very tuple `POST /contacts` refuses
  without, so both read one source. A field added to that tuple marks
  itself on this screen with no edit here.
- **The mobile validator is imported, not copied.** `isValidMobile` is
  the function the route itself calls. P1 measured that mobile is
  already enforced server-side, so mobile is PROVEN and email is the
  BUILD.
- **Email format is the new rule**, deliberately permissive: one `@`,
  something either side, a dot in the domain, no spaces. It exists to
  catch a typo before a batch is saved, not to be RFC 5322.
- **One invalid row blocks only itself.** Save loops the valid rows,
  and a row the server refuses stays with the rest rather than stopping
  those after it.
- **The last row auto-extends on FOCUS**, not on typing, so the row is
  there before it is needed.

**The retirement.** The single-record New Lead form is DELETED, not
hidden beside its replacement - 120 lines of markup and, with it,
`populateContactFormPickers`, `saveContact` and `clearContactForm`,
each of which was left defined-and-never-called. That is the
`#deal-form-vanilla` shape, where a retired surface that still parses
absorbs an edit silently and source verification passes while the
screen does not move.

**The shell keeps the modal frame** - the backdrop, Escape, focus
return, the close X, the unsaved-changes guard. React owns only the
grid inside it. Four handlers that pointed at retired ids were
re-pointed at the grid's own Save; one, `getElementById('contact-country')
.addEventListener`, would have thrown on a null at load and killed every
listener declared after it in `app.js`.

---

## 3. Evidence

`scripts/leads/probe-new-lead-grid.mjs`, **19/19 checks pass**, live DOM
after rebuild, bundle freshness asserted before measuring.

### CLAIM 1: the mandatory set matches the server

**The obvious probe here is a tautology and was not written.** Reading
the markers off the screen and comparing them with
`GET /contacts/creation-requirements` compares the endpoint with itself:
the grid renders its markers FROM that endpoint, so the two agree by
construction whatever the server actually refuses. Verification 20's
second-reader trap with both readers pointed at one value.

The server's mandatory set is defined by **what `POST /contacts`
refuses**, so the instrument omits each field in turn from a real POST.

| check | result |
|---|---|
| the omission instrument reaches both answers | refused without 6 of 8, accepted without 2 |
| the grid marks exactly what the server refuses without | server and screen both `[name, company, industry_id, email, mobile, source]` |
| the marker probe discriminates | 6 markers found, `summary` unmarked |

The first line is the calibration: a blanket refusal (an expired token,
a malformed body) would otherwise read as "everything is mandatory".

### CLAIM 2: field-by-field validation, both directions

| check | result |
|---|---|
| the mobile case is one the server's own validator rejects | `isValidMobile("+65 9000 0031")=true`, `isValidMobile("abc")=false` |
| an invalid email flags its own field on blur | row 0 email: "Not an email address" |
| an invalid mobile flags its own field on blur | row 1 mobile: "Not a phone number" |
| valid rows are NOT flagged while invalid ones are | flags `["true","true","false","false"]` |
| the grid reports the split | "2 ready, 2 to correct" |
| focusing the last row extends the grid | 6 to 7 rows |

The fourth line is what stops the three above it being satisfied by a
grid that flags everything.

Inputs are driven with **real keystrokes** (`page.type`). A synthetic
`.value` write is deduped by React's value tracker, and the DOM then
shows text the component's state never received - which reads as a
controlled input diverging from its own render.

### CLAIM 3: partial save, by membership

| check | result |
|---|---|
| both valid rows exist on the list | two records, by id |
| the two invalid rows did NOT create records | 4 tagged records, was 2 before Save |
| the message agrees with the membership | "2 leads created." |
| the invalid rows stay in the grid, still flagged | flags `["true","true","false","false","false"]`, row 0 email still `not-an-email` |

Membership is read from `GET /contacts`, and the message is checked
**against** it rather than instead of it.

### CLAIM 4: Unqualified, and on the pipeline

| check | result |
|---|---|
| both created leads carry status Unqualified | both `Unqualified` |
| both appear INSIDE the Unqualified group | `["Unqualified","Unqualified"]` |
| the group probe discriminates | groups on the page: `["Unqualified","Nurture"]` |

Membership is the `<section>` the card sits inside, not the heading
above it - which is what John ruled, and the first attempt proved him
right: walking up from a card to "the previous heading" found the
hidden modal instead.

### And one claim the probe did not set out to make

| check | result |
|---|---|
| the close X still routes through the unsaved-changes guard | two invalid rows pending, the shared discard dialogue opened |
| Discard then closes the modal | `#new-contact-form` hidden |

The first run timed out here, and **the reason was the guard doing its
job**. Verification 7's replacement clause: what was already there must
still be there, and a retirement that quietly dropped the guard would
have read as a clean close. It is now asserted rather than worked
around.

| check | result |
|---|---|
| Save carries the estate treatment and sits bottom-right | `class="btn-primary"`, flush to the footer's right edge |

**That check exists because a screenshot found it wrong.** The first
build shipped `<button>` with no class, and **every assertion passed**:
the button was present, positioned bottom-right, correctly disabled,
and clicking it saved. It rendered as a **white browser default on a
dark screen** - the one property no assertion named. `.btn-primary` is
what the control it replaces carried, so this is Verification 7's
replacement clause reaching TREATMENT and not only presence.
Calibrated: removing the class reads 18/19.

Screenshots: `.verify/leads/p5-grid-mixed.png`,
`p5-grid-after-save.png`, `p5-pipeline.png`.

---

## 4. Three probe faults, recorded

**A wait satisfied by static markup.** The probe waited on
`[data-testid="nlg-th-name"]` and read **zero** required markers. The
grid was correct; the `th` is static and exists whether or not the
fetch has answered. Verification 7's counterfactual names it exactly.
The wait is now on the industry select being populated - deliberately
NOT on the markers, since both are set by the same `Promise.all` and
waiting on the markers would be waiting on the very thing CLAIM 1b
asserts.

**A refusal read as a crash.** `api()` throws on non-2xx, so the
omission loop died at the first mandatory field and would have reported
one, not six. The loop now reads the refusal as data.

**A teardown against the wrong table.** `records.payload` does not
exist; payload lives on revisions. The error surfaced because the
helper checks it - and it masked the browser error underneath. Teardown
now enumerates from the database by tag, per Verification 11.

---

## 5. Calibration

`scripts/leads/calibrate-new-lead-grid.mjs`. Seven injections, one per
claim.

### The harness's own two faults, both found before any result was quoted

**The IN_FLIGHT marker earned its keep on its first run.** The shell's
two-minute wall killed the sweep during injection 2, leaving
`src/routes/contacts.js` mutated on disk and the API server running the
mutated route. The marker was present, so a fresh run would have
REFUSED rather than snapshotting the mutation as the original - which
is exactly the failure that poisoned a previous round's baseline, where
a killed run's damage was not merely left behind but BLESSED. Recovered
from the snapshot, verified byte-identical, marker cleared, server
restarted and its answer re-read.

**And then the sweep hung, and the cause was the harness.** It sat on
injection 2 for over two minutes with every process healthy and the
probe never launched. `restartApi` used

    execFileSync('bash', ['-c', '... & sleep 2'], { stdio: 'pipe' })

and **`execFileSync` waits for its stdout pipe to CLOSE, not for the
command to exit.** The backgrounded subshell inherits that pipe and
holds it open for as long as the server lives, which is forever. Every
diagnostic read healthy: the harness process alive, the server up, port
3000 answering, the injection correctly on disk. Nothing pointed at the
restart.

Replaced with `spawn` detached and `stdio: 'ignore'`, which has no pipe
to hold, and the readiness wait is now on the server ANSWERING
`/health` rather than a fixed delay. The readiness signal was itself
calibrated both ways - unreachable with the server down, 200 with it up
- because a readiness check that always returns true is the same
instrument fault one layer up.

### And injection 2 could never have fired

The first list carried *"remove `company` from the server's creation
tuple"* as the test of CLAIM 1b. **That injection cannot fail, and the
reason is the thing under test.** The tuple feeds both the refusal and
the endpoint the grid reads, so removing it moves BOTH readers together
and they still agree. It would have come back SILENT while the design
was working perfectly - and a silent injection is supposed to name a
claim nothing asserts, so it would have sent the next reader looking
for a missing detector that does not exist.

The defect the ruling exists to prevent is a SECOND READER, so that is
what is injected now: the grid stops asking the server and carries its
own hardcoded list.

### Results: 8/8 injections fired, none silent

| injection | fired |
|---|---|
| the required markers stop rendering | yes |
| the grid hardcodes its own mandatory list instead of deriving it | yes |
| email format is no longer checked | yes |
| mobile format is no longer checked | yes |
| every filled row is treated as valid | yes |
| the last row stops auto-extending | yes |
| the endpoint stops serving the tuple the refusal reads | yes |
| save clears every row, invalid ones included | yes |

**Final reverted run: 19/19, exit 0.** Both files compared
byte-identical to their snapshots after every injection, and the
`IN_FLIGHT` marker was cleared.

### The eighth injection exists because a fix left a recovery path unrun

Removing the raw `fetch` (below) left **no injection touching `src/` at
all**, so `restartApi` was called only in the harness's `finally` -
a recovery path nothing exercised, which is the shape this estate has
been caught by before.

The injection added is also the only one that can break the two readers
apart **from the server's side**: it makes the endpoint stop serving the
tuple the refusal reads. That reintroduces a second reader from the far
end, which is the defect the ruling exists to prevent, and it exercises
the restart at the same time.

### And the calibration found a check that could not fail

**The auto-extend injection was firing in the wrong place.** Removing
auto-extend killed the probe at `page.click('[data-testid="nlg-name-4"]')`
- a blur target six lines earlier that exists **only because
auto-extend works**. The probe never reached its own auto-extend
assertion, so that assertion had never been shown capable of failing,
which is the one thing a calibration exists to establish.

The blur moved to a `th`, which is always present. Re-run with the same
injection, the probe now gets through the flag checks and reports
`FAIL focusing the last row extends the grid`, 17/18 - the check
falsified by name. The wait is also bounded and its timeout caught, so
a missing auto-extend reads as a named failure rather than a stack
trace at a line number.

**A check that is only ever reached when it passes is not a check**, and
nothing in the output said so: the injection read FIRED either way.

---

## 6. Two estate guards fired on this work, and both were right

**`no script calls fetch directly`** caught the calibration harness's
readiness poll. The guard's reasoning applied exactly: a poll that
treats ANY answer as ready is the silent-non-2xx shape the throwing
client exists to prevent, so a server that came back **broken** would
have read as ready. Replaced with `api('GET', '/industries')`, which
throws on non-2xx and therefore proves the server can serve an
authenticated route rather than merely that something is listening.
**No exemption was taken**, and the allowlist is unchanged at two.

**`the loaders are registered after import, and NOTHING else is added`**
caught `mountNewLeadGrid`. The list was updated only after checking the
thing the test is actually for: a comment-stripped scan of `app.js`
finds no top-level `function mountNewLeadGrid` and no assignment to
that name, only two reads. A top-level declaration in a classic script
IS a window property, and `app.js` loads after the bundle, so such a
name would silently overwrite the registration - the collision that
cost a live walk in Round 7.

`renderLeadsCardsAfterCreate` travels the other way: `app.js` publishes
it and the grid calls it, so the bundle does not register it and it is
correctly absent from that list.

---

## 7. Suites

| suite | result |
|---|---|
| pure (`npm test`) | 512/512 |
| React (`npm run test:react`) | 939/939 |
| database (`npm run test:db`) | 100/100 |

Each number is the one its own runner printed. The pre-commit hook runs
pure and React on every commit and the database suite when a session is
live.

---

## 8. What this does not establish

- Nothing here says the eight columns are the right eight. That is the
  ruled layout, rendered.
- Email validity is a FORMAT check on the client only. The server still
  requires email to be present and does not check its shape, so a
  malformed address posted by any other path is still accepted.
- The probe drives one account. Nothing about the grid was exercised as
  a non-owner, and nothing needs to be: creation makes the actor the
  owner.
- `jobRole` (F1), the lost region autofill (F2), the unclassed
  buttons (F3) and the null `reference_code` (F4) are open.
