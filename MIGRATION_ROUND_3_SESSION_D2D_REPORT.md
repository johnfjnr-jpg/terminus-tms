# Migration Round 3, Session D2d

**What ran: item 1, the identity census and the beginning of adoption.**
**What did not: items 2 to 6, the swap and everything downstream of it.**

The triage in the instruction is the reason, and it is the instruction's own
rule rather than a judgement I substituted for it: items 1 to 3 are a whole that
must not land partial. **Item 1 turned out to be much larger than a census plus
a renaming pass**, and section 5 states that with the measurement behind it. A
swap onto a partially-adopted render would put a visibly broken Commercials tab
in front of the business, so the swap did not land.

Nothing live changed this session. The vanilla form is still the Commercials
surface, `initOpportunityDealPanel` is still unregistered in the bundle, and
every commit is green.

---

## 1. The adoption list

**15 ids and 100 classes**, in `frontend-react/src/deal/adopted-identity.ts`,
committed with a provenance test.

A name is on the list because **something outside the form depends on it**: a
`style.css` rule, a reader in `app.js` or `opportunity-deal-versions.js`, or
other markup inside the form pointing at it. Names read only by
`frontend/opportunity-deal.js` are deliberately absent, because that file is
what React replaces and its reads go with it. Testids are separate and stay.

Two independent instruments, because one regex census is exactly what missed
`clearDealFeedback` in D2c: the **source**, `index.html` with comments
stripped, and the **live DOM**, queried in the browser. The source cannot see
what JavaScript injects; the DOM cannot miss what renders.

`scripts/tests/adopted-identity.test.mjs` checks the list is a true claim rather
than a generated artefact nobody re-reads. Calibrated three ways: an invented
class, a renamed `label[for]` target and a duplicate entry all fire.

---

## 2. The census was wrong three times before it was right

### 2.1 It measured a form that had never initialised

The first reading was **143 ids and 71 classes**, and it agreed with the source
exactly. Both halves of that were wrong.

The probe wrote the session to `sb-session`; the app reads
`sb-anvildouaacbhsjytkii-auth-token`. So the app sat on `view-auth`, the record
never loaded, and `app.js` calls the panel init as
`window.initOpportunityDealPanel?.(opp)` - **an optional call, which does
nothing at all when the module has not registered and reports nothing when the
record has not loaded**. The form rendered completely and ran not at all.

**The perfect agreement between the two instruments was the tell.** A form that
has run adds rows the source cannot contain. Signed in and initialised, the real
figures are **183 ids and 101 classes**: 40 ids and 30 classes missed, every one
of them built by `innerHTML` - the cash-flow rows, the deal matrix cells, the
year schedule lines, and the forty milestone and contractor row ids.

The census now asserts the sign-in took, waits for the module to register before
navigating, and sweeps four branch variants rather than sampling one shape.

### 2.2 `app.js` builds ids by template interpolation

`document.getElementById(\`opp-tab-${key}\`)`. **35 DOM lookups in `app.js` are
built this way, and no literal scan can see any of them**, so "read by app.js"
was unsound as a criterion the moment it was written.

Measured rather than assumed: the prefixes were enumerated and tested against
every census id. **The only FORM id any of them can reach is
`opp-tab-commercial`**, which is the mount container and stays static. The
hazard is real and its reach is nil. `opportunity-deal-versions.js` has **zero**
interpolated lookups, so a literal scan is sound there.

### 2.3 The stated criterion could not see ids referenced by other markup

Verification 33: name what the measure cannot see, and look at that.

A stylesheet scan and a JS-reader scan both miss an id that is pointed at by
**other markup inside the form**. Twelve were missing and **not one was on the
list**:

| ids | referenced by |
|---|---|
| `deal-aqm`, `deal-hemir`, `deal-ssExisting`, `deal-ssNew`, `deal-factoring-ratePct`, `deal-factoring-termMonths` | `label[for]` |
| `deal-detail-heading` | `aria-labelledby` |
| `deal-detail-panel`, `deal-sections-1-2`, `deal-section-3`, `deal-section-5`, `deal-section-6` | `aria-controls` |

**An input that loses its id stops being focused by its label, silently.** No
stylesheet rule and no reader breaks; the screen looks identical; clicking the
label just stops working. The six are now asserted individually by name, because
Round 40's own calibration found that renaming one input leaves a count intact
and the claim false.

### 2.4 A correction to the list itself

`detail-tab-panel` was on the list and cannot ever be adopted: it belongs to
`#opp-tab-commercial`, the container React mounts **inside**. The two
instruments had already reported this as their only disagreement and I unioned
it in anyway. The census now measures descendants only, matching the DOM
instrument, and the list is 100 classes rather than 101.

---

## 3. What was adopted

The **stats strip**, and it is a pattern rather than a token gesture: the margin
accent reads `marginPresentation` from `src/lib/deal-inputs.js`, **the same
function the vanilla paints from**, rather than reimplementing the rule. Round
39 wrote that rule inline and toggled it on one of the two renderings, so the
strip showed a deal 22 points under target in the treatment of one on target.

That took 5 classes off the outstanding list: `stats-grid`, `stats-grid--deal`,
`stat-value`, `stat-value--lead`, `under-target`.

---

## 4. The ratchet

`frontend-react/src/__tests__/deal-identity.test.tsx` asserts the render carries
the list. The outstanding gap is an **enforced list**, not a note, and it is
asserted in both directions: the render may not lose a name it carries, and the
outstanding list may not name something the render already produces, so it
cannot rot into a list of things fixed long ago. When both lists empty, the two
subset assertions become the real coverage test.

Written **red first** and kept red until the ratchet was added, because a suite
green on its first run is the signature of tests written to agree with the
component.

**The first calibration was SILENT, and that was the fixture rather than the
detector.** The injection renamed `dm-row head`; both names render from several
other elements, so nothing was actually removed and the detector was handed two
states that did not differ. Re-run against `dm-cell--span`, which renders
exactly once, it fires. Verification 17.

---

## 5. THE FINDING THAT STOPPED THE SWAP

**Of the 75 names outstanding after the census, 68 are not in the React source
at all.** Only 7 are missing because the coverage fixtures do not reach the
state that renders them.

**Identity adoption is not a renaming pass. It is the remaining half of the
panel build.** Sessions A to D1 built the calculator and the input census; they
did not build the screen. What is missing is structure and, in one case,
behaviour:

| region | outstanding | what is absent |
|---|---|---|
| `#deal-section-4` | 19 | the pricing cards (`pg-card`, `pg-row`, `pg-cost`, `pg-price`, `pg-total`, `pg-head`), the cost-basis block, and the whole disclosure panel (`disclose`, `disclose-chevron`, `detail-open`) |
| `#deal-section-5` | 13 | Payment Terms: `payment-card`, `payment-terms-panel`, the `ring-radio` control set, `po-factoring-panel`, `po-field`, `help-dot` |
| `#deal-sections-1-2` | 8 | the intake columns and `unit-card` / `unit-cards`; the census inputs render, but not in the card structure the stylesheet targets |
| `#deal-section-3` | 3 | `terms-cards`, `terms-achieved`, `terms-field-row` |
| `#deal-section-6` | 3 | `cashflow-scroll`, `deal-cashflow-col`, `empty-state` |
| latch row | 3 | **`latch`, `latch-all-row`, `latch-row--intake` - and the latch FEATURE does not exist in React at all.** Only the `latch-row` class on section headers. Hiding sections is a real feature of the live screen with no React counterpart |
| shared | rest | `section-title`, `form-grid`, `form-group`, `view-toggle`, `doc-table`, `btn-ghost`, `btn-text`, `field-note`, `hidden` |

The React panel's sections are also named for an invented scheme -
`deal-section-catalog`, `-milestones`, `-contractor`, `-toggles`, `-ui` -
against the vanilla's `deal-sections-1-2` and `deal-section-3` through `-6`,
which is why five section ids are on the outstanding list.

**This is a re-plan, not a delay.** The remaining work is a screen build with a
test-driven work list attached to it, and the ratchet makes progress on it
measurable commit by commit.

---

## 6. Items 2 to 6: NOT RUN, and stated as such

| item | status |
|---|---|
| 2. the swap | **not started.** Blocked on item 1 by the instruction's own triage |
| 3. the workflow probe against the React form | **not run.** There is no React form to run it against yet |
| 4. the 38 behavioural blocks against the React panel | **not run** |
| 5. visual comparison at three widths | **not run.** It would compare the vanilla against a panel missing six regions |
| 6. render-level injection calibration | **partly.** The two detectors built this session are calibrated, both directions, with a verified snapshot and a final reverted run. The render-level work D1 did not cover is not done |

**The re-point ledger is unchanged from D2c** - 3 of 17 source-shape blocks
re-pointed, 14 outstanding, 8 stylesheet blocks outstanding - because a re-point
follows the swap and the swap did not happen.

---

## 7. Surprises

- **An optional call is a silent failure mode.** `window.initOpportunityDealPanel?.(opp)`
  cannot report that the panel was never initialised, and a fully-rendered inert
  form looks exactly like a working one to any instrument that only reads markup.
- **Two agreeing instruments can both be measuring nothing.** The agreement was
  the evidence that something was wrong, not that the reading was sound.
- **A stylesheet with almost no id selectors is a good stylesheet and a bad
  criterion.** `style.css` carries exactly one `#deal-` rule, so "carries a
  stylesheet rule" selected 3 ids out of 184 and the real dependency on ids was
  almost entirely in `label[for]` and `aria-*`.
- **The census had to be built before it could be specified.** Each of the three
  faults changed what the criterion should be, and none was visible from reading.
