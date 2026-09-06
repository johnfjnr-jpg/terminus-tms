# Migration Round 3, Session E (run 2): the backbone and the latch

**Ratchet before:** 5 ids, 43 classes.
**Ratchet after:** 1 id, 34 classes.
**Delta: 4 ids and 9 classes.** Gate green at 21 stages. Not pushed.

The class delta is modest and the structural change is not: this run replaced
the panel's invented sectioning with **the screen's own five sections** and
built **the latch feature**, which had no React counterpart at all.

---

## 1. The section backbone

The React panel had invented `deal-section-catalog`, `-milestones`,
`-contractor`, `-toggles`, `-ui`. No stylesheet rule and no latch panel knows
any of those. It now renders the vanilla's five: `deal-sections-1-2`,
`deal-section-3`, `deal-section-4`, `deal-section-5`, `deal-section-6`.

**The map was measured, not inferred**, by reading every census field out of the
vanilla's own skeleton and recording where the vanilla renders it. It agrees
with the census `section` label everywhere except one, and that one is recorded
rather than smoothed over:

> `deal-recoveryMonths` carries census section `structural` and the vanilla
> renders it in **Payment Terms**, because hardware recovery is a payment-terms
> question.

The map therefore keys on the **field**, not the census section, and
`dirtyVanillaSections` maps dirty keys the same way - otherwise a save button
would appear over Structural Terms for a field that is not in it.

`milestones` and `contractor` were placed the same way: `#deal-milestones-tbody`
is in section 5, `#deal-contractor-tbody` in sections 1-2 beside the
installation lump sum it reconciles against.

---

## 2. The latch, as behaviour

Enumerated from `applyLatches` (:782) and its click wiring (:1899) before
anything was built. Ten tests, red before green.

| | behaviour |
|---|---|
| L1 | four panels latch; **section 4 has none**, because it is the summary and hiding it would hide the answer rather than the inputs |
| L2 | the **panel** carries `is-latched`, not the button |
| L3 | the button reads Show when latched, Hide when not: it names the ACTION, not the state |
| L4 | `aria-expanded` is the inverse of latched |
| L5 | the title is `signalSentence`'s, from `src/lib/latches.js`, never written here |
| L6 | `#latch-all` returns to **everything visible** rather than to a remembered set, because there is no remembered set |
| L7 | latching is session only, so it must not make the form dirty |

`panelSignal` and `signalSentence` are called rather than reimplemented, so the
two surfaces cannot drift about what a hidden section is worth warning about.

---

## 3. Injection calibration

Verified-snapshot harness over three files, restore checked after each, final
reverted run green. **Both directions the instruction names are covered.**

| injection | verdict |
|---|---|
| **a latched section renders anyway** (`is-latched` never applied) | FIRED |
| **an unlatched section is hidden** (`is-latched` always applied) | FIRED |
| the button says the state rather than the action | FIRED |
| show-all latches everything instead of clearing | FIRED |
| the signal sentence written here instead of shared | FIRED |
| the section save lands after the latch button | FIRED |
| **the `recoveryMonths` exception dropped** | **SILENT** |

**The silent one is the finding.** The exception was a claim with no detector:
removing it changed nothing observable, because nothing asserted where that
field renders. Two tests now do - the input is inside `#deal-section-5`, and its
save button lands there too - and the injection fires.

---

## 4. Duplicate ids, again, and where the fix belongs

The restructure re-introduced the duplicate the last run fixed: `censusBySection`
returned every census field including the seven pricing-card margins, which
section 4 also renders. **The exclusion now lives in the mapping**, not at the
call site, so there is one place that decides it. Caught by the
exactly-one-element-per-id detector built last run, which is what that detector
is for.

---

## 5. The coverage instrument was measuring a still screen

Four classes were on the outstanding list that the render already produces:
`detail-open`, `section-save`, `btn-primary`, `btn-sm`. **None of them exists
until somebody has done something** - opened the disclosure, edited a field -
and the identity census only ever looked at the first frame.

That is the same fault as the census which measured a form that had never
initialised, one layer in: the gap was in the instrument, not the render. `seen()`
now exercises the panel before its second reading.

---

## 6. Re-points this run forced

- The section-save tests moved from census names to the screen's own:
  `section-save-risk` became `section-save-deal-section-3`. The claim is
  unchanged; the save belongs to the section the input **sits in**, which is
  what the vanilla groups by.

---

## 7. What is left

**1 id, 34 classes**, and they are now almost entirely **two interiors**:

- **Section 5's interior**: `payment-card`, `payment-terms-panel`, the
  `ring-radio` set (5 classes), `po-factoring-panel`, `po-field`, `help-dot`,
  `view-toggle`, `view-toggle--stacked`, `active`, `doc-table`, `form-group`,
  `deal-payment-col`, `deal-payment-region`, `btn-ghost`, `deal-toggle`, and the
  one remaining id `deal-factoring-fields`.
- **Sections 1-2's interior**: `unit-card`, `unit-cards`, `form-grid`,
  `col-mono`, `data-row-label`, `int-only`, `is-computed`.
- **Section 3**: `terms-cards`, `terms-achieved`, `terms-field-row`.
- **Section 6**: `cashflow-scroll`, `deal-cashflow-col`, `empty-state`,
  `is-scrollable`, `msg-success`.

Nothing live changed. `initOpportunityDealPanel` is still unregistered and the
vanilla form is still the Commercials surface.
