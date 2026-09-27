# MINOR ADJUSTMENTS ROUND: PHASE 0

Measurement before any build. Nothing was built in this phase.

Five of the six findings rest on a claim about what exists today, and **three of
those claims are wrong**. None blocks the ruled work; each changes how it is
built, and each is recorded here rather than discovered halfway through.

---

## 1. P4's HISTORY CLAIM IS FALSE, AND THE TRUTH IS A BETTER ARGUMENT

The ruling says to record that "white default buttons and token collapse were
separate mechanisms already fixed; **autofill is a third, never previously
addressed**."

**Measured, autofill WAS addressed.** `frontend/style.css:8482`, R1,
2026-09-13, with the exact technique this round's brief names:

```css
.lead-field-input:-webkit-autofill,
.lead-field-input:-webkit-autofill:hover,
.lead-field-input:-webkit-autofill:focus,
.cd-note-input:-webkit-autofill,
.lead-summary-input:-webkit-autofill,
.acct-picker-input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--black) inset;
  -webkit-text-fill-color: var(--white);
  caret-color: var(--white);
}
```

**What is true is the part that matters: it was never made ESTATE-WIDE.** Six
class selectors, all on leads and contact surfaces. The deal panel's inputs -
the lump sum box and the milestone percentages in John's screenshot - are not
among them, and were built after.

**That is build discipline 6 arriving for the fourth recorded time**: a fix
built for the pages that existed at the time is not a fix for the pages built
after it. It also explains why nobody saw it: the 2026-09-13 comment says the
defect "was invisible to every probe this estate writes because it is a
PSEUDO-CLASS", so the narrow fix was never measured for reach either.

**Consequence for the build: the rule is written against ELEMENT selectors, not
a class list.** `input:-webkit-autofill, textarea:-webkit-autofill,
select:-webkit-autofill` and the standard `:autofill` beside them. Verification
19: an enumeration by name fails on the unrecorded instance, and this one
already has.

**The estate's input tokens, read from the base rule rather than assumed**:
`background: var(--black)`, `color: var(--white)`, at
`input[type="text"], input[type="date"], select, textarea`. The R1 rule already
uses that pair, so the estate-wide rule is consistent with it by construction.

---

## 2. P6's "ONE VERSION-LABEL SOURCE" DOES NOT EXIST. THERE ARE FOUR

The ruling says labels come "from the ONE version-label source". Measured,
the same rule is implemented **four times**, identically, as an inline ternary:

| site | form |
|---|---|
| `frontend-react/src/versions/model.ts:48` | `versionLabel()`, documented as "W2's label" |
| `src/lib/approval-page.js:862` | inline ternary |
| `src/lib/approval-page.js:928` | inline ternary, the baseline label |
| `src/lib/version-approval.js:304` | inline ternary |

All four agree today, which is Verification 20's benign end and is not a reason
to keep four. **Adding a fifth for the Working Version field would be the worst
available outcome**, and would make the ruling's own sentence false.

**Consequence for the build: the ONE source is created, in `src/lib/`, and the
existing readers call it.** `src/lib/` is importable by both the server and the
React tree, which already reaches into it (`useFieldWidth.tsx` imports
`../../../src/lib/field-formats.js`), so one module can serve every caller.

---

## 3. P1's CAUSE IS A DEFECT THE PREVIOUS ROUND CREATED

The underline is `border-bottom` on `.product-grid .ig-head`
(`style.css:1689`), and the head cell is pinned to a FIXED height:

```css
.units-row .ig-head,
.units-row .cm-grid-head { height: var(--w1-head-h); box-sizing: border-box; }
--w1-head-h: calc(var(--field-label-size) * 1.5 + 17px);
```

The comment says that value "is not chosen, it is how `.ig-head` is already
composed - the field-label line box, 8px of padding each side and the 1px
rule". **That is one line box.** R-US4 then accepted a two-line Rate heading,
so a wrapped head overflows a band sized for one line and the border is painted
across it. That is John's strike-through exactly.

**AND THE PREMISE FOR THE FIXED HEIGHT MAY HAVE FAILED.** Its comment reasons:
"Each half is its own grid, so neither can put its head in the other's track."
R-US1 then made the two cards share the parent's tracks by `subgrid`, with
`.units-row .ig-head { grid-row: 3 }` on both. If the heads are genuinely in
one shared track now, the track sizes to the tallest head by itself and the
pin is what breaks it. **Verification 29: the premise is tested before the
decision is re-taken**, and that test is a live measurement in Phase 1.

---

## 4. WHAT P5 DISPLAYS TODAY, WHICH THE RENAME MUST PRESERVE

`frontend/app.js:6983`. The label is `Proposal version`, lower-case v, so the
ruling's "Proposal Version" is the field, not the string to match:

```js
oppHeadlineFigure('Proposal version',
  Number.isInteger(opp.issued_major) ? `V${opp.issued_major}` : null,
  { absent: 'none' })
```

`issued_major` is computed server-side by `issuedMajor()`
(`src/lib/opportunity-headline.js:83`): the **highest major among versions with
`status === 'issued'`**, or null. Rendered `V<major>`, or the ruled `none`
rather than a blank, because a blank reads as a figure that failed to load.

**One thing to flag rather than fix: the field counts ISSUED versions and the
new name says APPROVED.** The ruling directs that the semantics be preserved
under the new name, so they are, and the tension is reported rather than
quietly resolved. Issuing and approving are different events in this estate.

**Occurrence census**: the string appears in exactly two places, the render
above and a comment at `app.js:6951` explaining the `none`. No identifier is
named `proposalVersion` anywhere, so the rename is a label change and stays one
(Architecture 6).

---

## 5. WHAT P2 AND P3 ARE MADE OF

**P2, the head band.** `#deal-intake-head` is a `.form-grid.ur-band` holding
four `form-group`s: the Responsibility select, the lump cost group, and the
see-table and not-applicable notes. It is currently a single stacked column
(`grid-template-columns: minmax(0, max-content)`), which is why the lump sum
field sits under the dropdown rather than beside it.

**P2, the milestone columns.** `.cm-grid-head, .cm-grid-row` are
`grid-template-columns: 44px 195px 44px max-content` over Month, Milestone, %
and Amount. The amount column was already converted to `max-content` under
R-US4; **the `%` column is still the prototype's 44px literal**, and its header
is right-aligned into that track while the input inside it is sized from the S1
registry. The two do not have to agree, and John's screenshot is what happens
when they do not. Exact widths are measured live in Phase 2 rather than
reasoned about here.

**P3, the affordance.** One pattern, in `DealPanel.tsx:149`, driven by a
field's `help` string:

```jsx
<span className="help-dot" tabIndex={0} role="note"
  aria-label={help} title={help}>?</span>
```

It renders inside `.deal-field-label`, after the label text and a space. The
sentence to move is at `intake.tsx:197`, a `<p className="data-row-label"
id="deal-lump-summary">`, and one assertion reads it
(`deal-intake.test.tsx:207`).

---

## 6. WHAT PHASE 0 DOES NOT ESTABLISH

- **No live measurement was taken.** Every width in section 5 is read from the
  stylesheet, and the stylesheet is not the rendered box. Phases 1 and 2 open
  with measurement.
- **Whether the heads share a subgrid track is unconfirmed** and is the single
  fact P1's fix turns on.
- **Nothing here tests the autofill pseudo-class.** Whether a probe can enter
  it at all is P4's own open question, and the report will say what the proof
  could and could not simulate rather than implying a state was reached.
