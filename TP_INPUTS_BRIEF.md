ROUND: TP_INPUTS (Term Pricing Inputs card: deal terms first, tax below)
Base: origin/main expected <TERM_PRICING_2 pushed SHA> (ls-remote; mismatch, STOP). Branch tp-inputs.
First commit: this brief verbatim as TP_INPUTS_BRIEF.md, plus John's approved mockup: copy
~/Downloads/inputs-1240-split-off.png, inputs-1240-split-on.png and inputs-1920-split-on.png
byte for byte into prototypes/term-pricing-inputs/. Missing: STOP and ask; never recreate them.
Mockup gate: build ONLY the approved picture. Anything it does not settle: STOP and photograph.

RULINGS (John, 2026-10-03). Cosmetic tier: no figure, engine or spec change.
I1 The Inputs card has two sections, each a small uppercase heading with a rule to its right:
   "DEAL TERMS": one row of Units per product | Term (months) | Payment structure, with Annual
   escalator % and Starts in year beneath Payment structure.
   "TAX": one row of GST % | Split WHT switch | WHT field(s) | Gross up switch.
I2 GST % and every WHT input are sized for two digits, sitting directly under their labels.
   Annual escalator % keeps its current width.
I3 Split WHT off: one "WHT %" input. On: "WHT on hardware %" and "WHT on SaaS %" side by side in
   the SAME row. Toggling Split WHT must not change the card's height at any width in the sweep
   (assert: height on = height off; tax row stays one line).
I4 Under the tax row, one note line: "WHT applies to each invoice line before GST. GST is added on
   top of every invoice." With Split WHT on, append: " With Split WHT on, OPEX invoices carry a
   hardware line and a SaaS line."
I5 Wording converges on "SaaS": the split label above, and the payment schedule's
   "Software as a service line" becomes "SaaS line".
I6 The start-year select keeps its dimmed, bordered disabled state (L2 from TERM_PRICING_2).

EXIT
E1 Term-pricing goldens exact and G1 to G5 unchanged (no figure may move).
E2 Overlap sweep (probe-overlap.mjs) at 1240 to 1920 step 40, all states including split on and
   off: zero overlaps; I3's height assertion at every width.
E3 From the click: Split WHT on and off swaps the fields in place; T25's figures still read on
   screen with split on and gross-up on.
E4 Screenshots of the Inputs card at 1240, 1440, 1600 and 1920, split off and on, placed beside
   the approved PNGs for comparison.
E5 Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check;
   stop at "ready for John's push". Never git push.

---

BASE RESOLVED (2026-10-05): origin/main e800b2d, the SHA handed over as TERM_PRICING_2's push.
MOCKUP FILE (John, 2026-10-05): inputs-1240-split-off.png was first found as
inputs-1240-split-off.png.png; John corrected its name before the copy. sha256 of the copies:
  inputs-1240-split-off.png fe8699ed2d044faf1d3ab52de914f5b45418e7762da53aa9c774d094692a72c9
  inputs-1240-split-on.png  a3e81bbafd7f5b0db07780acd170713226f48228d59f83f6b6f7b1ebc5ab1771
  inputs-1920-split-on.png  504c4eb756cdbe6735c58c860ce8f9eb66fbddadc31f0a20a2fa224a14bd64a6

---

RULING (John, 2026-10-03): option (a). Keep the current button size; the mockup's button
dimensions were illustrative, the approved picture is the arrangement, which is built. Record that
in the close-out beside the comparison screenshots. QUEUED, not built: the engine's error message
for an invalid SaaS rate still reads "WHT on software as a service"; converge to "SaaS" in the next
round that touches the engine. Proceed to the gate: full gate (NordVPN quit, resolver clean);
merge --no-ff; merged gate; ls-remote re-check; stop at "ready for John's push". Never git push.
