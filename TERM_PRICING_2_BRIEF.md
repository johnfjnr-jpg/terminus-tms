ROUND: TERM_PRICING_2 (settings overlap fix, 10-year terms, manual and split WHT)
Base: origin/main expected 328da3a (ls-remote; mismatch, STOP). Branch term-pricing-2.
First commit: this brief verbatim as TERM_PRICING_2_BRIEF.md.

PART A: SETTINGS OVERLAP (cosmetic tier, plus a guard gap)
A1 John's screenshot, 2026-10-02: with Settings expanded, the product-margin and volume-band block
   overprints the parameter table (value inputs render underneath it; headers collide). John's
   window is between 1240 and 1920; only those two widths were measured. Settings uses two columns
   ONLY where both fit without overlap, determined by measured container width; otherwise one
   column. No grid track may shrink below its content.
A2 WIDTH SWEEP: every Term Pricing layout assertion runs at 1240 to 1920 in steps of 40, in all
   states (OPEX, CAPEX, settings expanded, admin and non-admin, split WHT on and off).
A3 GUARD GAP, investigate first: why did the ink/overlap guard miss this (and the OPEX card
   overprint at 1240, queued earlier)? If it enumerates screens by name, make it cover every routed
   screen by structure, calibrated red on this defect before the fix and on the OPEX-card
   overprint. If that is more than a small change, STOP and report.

PART B: RULINGS (John, 2026-10-02). SPEC FIRST: docs/pricing-spec.md v1.3 in its own commit
before any code, carrying B1 to B5 and the figures below. No existing figure moves.
B1 TERMS default becomes 12, 24, 36, 48, 60, 72, 84, 96, 108, 120 (every year to ten). steps_above
   counts positions in TERMS (108 -> 6, 120 -> 7; PROFIT_STEP is 0, so no figure moves).
   Spec 10.1 gains the 108 row: fee 1,540.74; vs 36 -63.5%; TCV per unit 166,399.92; cost
   29,600.00; profit 136,799.92; margin 82.2%. Spec 10.2 gains the 108 row: 1,540.74 / 1,463.70 /
   1,386.67 / 1,309.63. The live TERMS setting is NOT changed by this round: John changes it as
   admin after the push. Do not migrate it.
B2 TERM BUTTONS: laid out in rows of five, in term order (12 to 60, then 72 to 120), at every
   width in the sweep.
B3 WHT MANUAL: the WHT preset buttons are replaced by a percent input (0 up to but not including
   100; blank is 0 per the blank-zero rule), plus a separate "Gross up" switch.
B4 SPLIT WHT: a switch "Split WHT". Off: one WHT input applies to every invoice line. On: two
   inputs, "WHT on hardware %" and "WHT on software as a service %"; the single input is hidden.
   One Gross up switch applies to both lines.
   Invoice lines: CAPEX: the upfront invoice is hardware; monthly service fees are software.
   OPEX: each monthly invoice has two lines: hardware = round_half_up(hardware_upfront / T, 2),
   flat for the term (hardware_upfront as section 6, at HW_UPFRONT_MARGIN); service = the month's
   fee minus the hardware line (so an escalator raises the service line only). WHT per line,
   half-up to cents, before GST; gross-up per line: line_invoice = round_half_up(line_net /
   (1 - wht_line), 2). With Split WHT off, the OPEX invoice may still show one line.
B5 Spec section 11 gains (figures computed outside the engine; COPY them, never compute):
   T24 T6 as capex, split WHT hardware 5% / service 10%, gross-up OFF: WHT on upfront 60,000.00,
       Terminus receives 1,140,000.00; WHT per service invoice 26,981.88, Terminus receives
       242,836.89; total WHT borne 1,678,912.80.
   T25 T6 as opex, split WHT hardware 5% / service 10%, gross-up ON, GST 0: hardware line
       20,000.00 -> invoice 21,052.63, WHT 1,052.63, receives 20,000.00; service line 269,818.77
       -> invoice 299,798.63, WHT 29,979.86, receives 269,818.77; invoice total 320,851.26.
   T26 1 SafeSight, 108 months: TCV 166,399.92; margin 82.2%.

LAYOUT STOP: B2, B3 and B4 change the Inputs card with no mockup. Build them, then STOP with
screenshots of the Inputs card (split WHT off and on, gross-up on) and the expanded Settings, at
1240, 1440, 1600, 1680 and 1920, for John's approval BEFORE the gate.

EXIT (after approval): term-pricing goldens including T24 to T26 exact; G1 to G5 unchanged;
overlap zero across the sweep; guard calibrated red on the defect, green after; E2-style proofs
from the click for split WHT (T24, T25) and a 108-month quote (with TERMS passed in test, since
the live setting is John's to change); full gate (NordVPN quit, resolver clean); merge --no-ff;
merged gate; ls-remote re-check; stop at "ready for John's push". Never git push.
