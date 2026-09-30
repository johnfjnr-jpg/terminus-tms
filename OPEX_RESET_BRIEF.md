ROUND: OPEX_RESET
Base: origin/main expected 518c591 (ls-remote; mismatch, STOP). Branch opex-reset.
First commit: this brief verbatim as OPEX_RESET_BRIEF.md, plus John's approved mockup: copy the two
Option 1 PNG exports from ~/Downloads into prototypes/opex-reset/ (overrides-present.png,
no-overrides.png). Missing files: STOP and ask; do not recreate them.
Mockup gate: build ONLY the approved picture. Any placement the mockup does not settle: STOP and photograph.

RULINGS (John, 2026-09-30)
R-RS1 One control beneath the OPEX table, right-aligned: "RESET TO TARGET MARGIN (<t>%)", where <t> is
      the deal's target margin, formatted through the field-format registry. Dress: the estate's
      existing outline button (as the Key Customer Contacts ADD button), with a circular-arrow icon.
R-RS2 Shown ONLY when at least one OPEX row stores a fee or margin override. Otherwise ABSENT from
      the DOM, nothing in its place. Never shown under CAPEX.
R-RS3 Click clears opexUnitFees and opexUnitMargins for every row in the FORM state. Unit counts
      untouched. No confirmation dialog: the form goes dirty and the sticky Save/Discard bar governs;
      Discard restores the overrides. Rows re-derive from cost + target margin; the button disappears.
R-RS4 No new route. Saving after a reset persists no OPEX fee or margin overrides.
W-LC1 Working Version empty state reads "none"; Approved Version reads "None". Converge on "None"
      (cosmetic tier) and screenshot both fields.

TIERING: behaviour tier for R-RS1 to R-RS4 (it clears stored pricing inputs through the save path);
cosmetic tier for W-LC1.

PHASE 0 (short; STOP only if a premise fails)
0.1 Confirm R-TL2 derived-margin display is on main.
0.2 Name the deal's target margin field and its format entry; name the existing outline-button dress.
0.3 REPORT ONLY: Total Contract Value in the header vs contract net on the Commercials tab. Name each
    figure's reader and definition; state whether TCV reads the saved record or the form, and whether
    the two should differ. Evidence: on one deal, TCV $1,131,445 held while contract net read
    $1,117,303 (per-unit) and $1,119,389 (lump sum). Propose nothing; no fix in this round.

EXIT
E1 G1 to G5 figures exact and unmoved (the reset is never clicked on a golden).
E2 From the click, both directions: button present with overrides, absent without; click clears
   both keys on every row and re-derives; Discard restores; Save persists none (read back over
   HTTP, with the non-owner check refusing the save).
E3 Label shows the deal's actual target margin: two deals with different targets.
E4 Estate guards green (field formats, containment, adjacency, ink); screenshots at 1240 and 1920,
   both states, beside the approved PNGs. Screenshots must SHOW the OPEX table rows.
E5 W-LC1 screenshot of both version fields reading "None".
E6 Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check;
   stop at "ready for John's push". Never git push.

---

## THE MOCKUP FILENAMES, AND THE MAPPING APPLIED

The brief names `overrides-present.png` and `no-overrides.png`. The exports in
`~/Downloads` carry their design-tool names, and the mapping is unambiguous, so
they were copied rather than stopped on:

    Option 1 one reset for the table, overrides present@1x.png  ->  overrides-present.png
    Option 1 no overrides, control absent@1x.png                ->  no-overrides.png

Both copied byte for byte and verified by size against the sources. **Nothing
was recreated.**

## WHAT THE APPROVED PICTURE SETTLES

Read off the two PNGs rather than inferred:

- the control sits **below the table's closing rule**, **right-aligned**;
- it is an **outline button** carrying a **circular-arrow icon** then the label;
- the label reads **`RESET TO TARGET MARGIN (30%)`** - upper case, the percentage
  in parentheses;
- in the no-overrides state the control is **absent and nothing takes its
  place**: the rule is there and the card simply ends.

Anything these two pictures do not settle is a STOP and a photograph.
