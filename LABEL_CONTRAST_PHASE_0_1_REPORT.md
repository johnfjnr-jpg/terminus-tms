# LABEL_CONTRAST: Phase 0 (measured) and Phase 1 (proposal), STOP for approval

## 1. Not done

**Nothing in the product has changed.** The proposal was injected in the browser only, for
measurement and screenshots.

Phase 2 waits on your approval:

- apply the change;
- the sweep;
- the goldens;
- the gate, the merge and the merged gate.

Branch `label-contrast` from `8458f57`. Commits: `eee3067` (the brief) and this report, with the
instruments and captures.

## 2. Phase 0.1: every label style, as painted

**Instrument.** `scripts/label-contrast/census.mjs` takes every visible text node on Term Pricing
(Settings open, Split WHT and Gross up on) and on the Commercials tab of an OPEX fixture. For each
it reads the computed colour, size, weight, tracking and case, and composites the real background
behind the text from the page up, because the quiet colour is an ALPHA colour. It then takes WCAG
contrast.

**Result: 1,035 text nodes, 77 styles. The 526 quiet nodes measure 2.63 to 4.83:1.**

The two card backgrounds are `--dark` #1A1B23 and `--black` #15161C. The cash-flow section rows are
lighter, rgb(43,44,51).

| label kind | style (colour `--muted` unless noted) | contrast | where |
|---|---|---|---|
| Field labels | mono 10.5px, uppercase, 0.1em (the size token) | 4.75 to 4.83 | Term Pricing `.tp-label`, `.tp-section-head`; `.label`, `.form-group label`, `.po-field label`, the follow-up task's labels |
| Table column headers | mono 10.5px token (`.tp-table th`, `.ig-head`); 11px (`thead th`); **9px** (`#deal-opex-table th`, `.cm-grid-head`); 10px (`.stmt-colhead`) | 4.75 to 4.83 | the Term Pricing tables; units grid; OPEX fee table; installation milestones; Deal Sheet Summary |
| Section headings | mono 12px, uppercase, 1.44px | 4.75 | Commercials `p.section-title` ("Structural Terms", "Payment Terms", "Cash flow (USD)") |
| Sublabels | Satoshi 12px | 4.75 to 4.83 | "SafeSight", "AQ", "HEMIR" (`.tp-unit span`); "Year 1" to "Year 5" (`.ys-year`) |
| Captions and notes | Satoshi 11.5 to 12px; mono 10px | 4.75 to 4.83 | `.field-note`, `.tp-small`, `.tp-hint`, `.stmt-sub`, `.stmt-lbl small` |
| Header figure labels | mono 10px, uppercase | 4.75 | `.ohl-label` ("Total contract value", "Probability") |
| Chips and tags | mono 10.5 and 10px, uppercase | 4.83 | `.tp-chip` (margin floor), `.tp-tag` ("admin") |
| **Cash-flow empties and section labels** | **`--muted-2`**, mono 11px | **2.73** (2.63 on the section rows) | cash-flow cells "-" and blanks, a section label, the Deal Sheet "Total" and a 9px caption |

Buttons, nav links, tabs, the stage strip and the hide latches also paint in `--muted`, at 4.75 to
4.83. They are controls, not labels, so they are outside this round's label proposal, but they
inherit any change to the token.

## 3. Phase 0.2: one token or several?

**Colour: ONE token.** Every CSS-styled quiet text binds `--muted`, which is
`rgba(242,242,240,0.5)`.

**The exception is a finding:** the `--muted-2` text comes from INLINE styles, not the stylesheet:

- `frontend-react/src/deal/cashflow.ts`, lines 33, 39, 44 and 68;
- `frontend-react/src/deal/panelParts.tsx`, lines 79 and 82.

The G9 guard (`label-contrast.test.mjs`) retired `--muted-2` as a text colour, but it scans
`style.css` only. An inline `color: 'var(--muted-2)'` in a `.tsx` file is invisible to it. That is
Verification 37: a rule that names a mechanism polices the mechanism.

**Size: NOT one token.** `--field-label-size` (10.5px) drives **5 rules**:

- `.tp-label`;
- `.tp-section-head`;
- `.tp-table th`;
- `.form-group label`;
- `.product-grid .ig-head`.

**51 uppercase quiet rules hard-code 9 to 11px.** Of those, 17 render on these two screens: 7 on
Term Pricing and 17 on Commercials. Most of them are buttons, nav and tabs. The labels among them
are `.label`, `.cm-grid-head`, `.cm-total-label`, `.cf-row.head .cf-label`, `.ohl-label`,
`#deal-opex-table th`, `.tp-chip` and `.tp-tag`.

## 4. Phase 1: the proposal (B recommended)

| | change | measured result |
|---|---|---|
| **C1** | `--muted` alpha 0.50 to **0.75** (one token) | **all 526 quiet nodes 7.69 to 9.40:1** (9.05 on `--dark`, 9.40 on `--black`, 7.68 on the cash-flow section rows). The white figures stay at 13.48 to 16.10:1, so labels stay visibly quieter. 0.70 was tried first and read **6.90** on the section rows |
| **C2** | Re-point the six inline `--muted-2` text colours to `--muted`, and extend G9 to scan `frontend-react/src` and `frontend/*.js` for an inline `--muted-2` text colour | removes the 2.73:1 text |
| **S1** | `--field-label-size` 10.5px to **12px** | the 5 token rules move together |
| **S2 (B)** | Point `.label`, `.cf-row.head .cf-label`, `.ohl-label`, `.tp-chip` and `.tp-tag` at the token (12px) | sizes then come from one token |

**What A taught, measured and looked at.** Proposal A also pointed `#deal-opex-table th`,
`.cm-grid-head` and `.cm-total-label` at 12px.

- At 1240 the OPEX fee table widened and **the year figures crossed the card's right border**.
  That is the card Q1 fixed.
- The installation panel also grew wider.

The overprint detector cannot see a border (a limit recorded in the module), but the shrink check
flagged the squeeze (the payment-terms panel at 637px needed 657px), and opening the screenshot
confirmed it. **B leaves those three heads at their sizes and gives them the colour only.**

**Detectors, before and after, on both screens at 1240 and 1920
(`scripts/label-contrast/preview.mjs`):**

- **Overprints:** 0 in every state, before, A and B.
- **Shrinks on the Commercials tab:**
  - before: 4 at 1240, 2 at 1920;
  - A: 6 at 1240;
  - **B: 5 at 1240**, 2 at 1920.

**ONE SQUEEZE B STILL CREATES, AND IT IS PART OF THE CHANGE.** Raising the token enlarges the units
grid's "UNITS" head (`.product-grid .ig-head`): the column is 36px and needs 42. So the
units-and-installation section needs 882px of 876px at 1240, and the installation panel's edge sits
about 6px past its section. **Phase 2 would widen that column's track** rather than hold the head
back with an override.

**Visible changes for your eye** (screenshots in `prototypes/label-contrast/`, `lc-before-*`,
`lc-after-*` for A and `lc-afterB-*` for B, at 1240 and 1920):

- at 1240 more Term Pricing column heads wrap onto two lines (the payment schedule's
  "Invoice (pre-GST)" and "Terminus receives");
- the quote's "Margin on price" tile label wraps.

Headers may wrap under the estate's rules, and nothing overprints.

**The brief's "12px where labels are 11px":** very few labels are 11px. The field-label token is
10.5px, and several labels are a literal 9 or 10px. S1 and S2 move those to 12px. **`thead th`
(11px) is left alone:** it is the generic table head across the whole estate, overridden on Term
Pricing, and changing it reaches screens Phase 2's sweep does not cover.

## 5. Queued (pre-existing, Rule 10), not part of this change

**Squeezes on the Commercials tab at 1240, present before any change:**

- the units grid head (32px, needs 37);
- the intake head track (365px, needs 379);
- the PO factoring card (219px, needs 243);
- the factoring toggle (185px, needs 209), where "FACTORING DISABLED" touches its border.

They surfaced because the shrink check was run on the whole tab for the first time; until now it
covered only the OPEX card.

## 6. What I need from you

- **B as proposed** (C1, C2, S1, S2 B, plus widening the units column in Phase 2), **or A**, or
  adjustments.
- **The alpha: 0.75**, the lowest round value clearing 7:1 on the cash-flow section rows with
  margin. 0.72 reads 7.20 there.
