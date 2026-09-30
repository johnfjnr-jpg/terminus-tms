ROUND: TEST_LOG_1 (reissued; the original block was never pasted).
Base: origin/main expected d09a979 (ls-remote; mismatch, STOP). Branch test-log-1.
First commit: this brief verbatim as TEST_LOG_1_BRIEF.md.
Already established (the addendum and census reports): 0.1 to 0.5 are answered; do not redo them.

RULINGS (John, 2026-09-30)
R-TL1 The all-in fee absorbs the type's lump-sum installation share. ONE function computes a type's
      installation price for both buildDealInputs and opexRows (V20: one reader). With a stored fee,
      row Contract Total = units x fee x term, in both installation modes (rounding tolerance
      declared and justified in the report).
R-TL2 Either-or on entry: typing an OPEX fee clears that row's stored margin, and the reverse; the
      cleared cell shows its derived value at normal weight. Server-side: where one row stores both,
      the margin is dropped on save (the fee already wins pricing, so it is inert; assert inert).
R-TL3 Golden deal G5: OPEX, Lump Sum installation, a stored SafeSight fee, a margin override on a
      DIFFERENT row. PROVISIONAL until John's Excel check. G1 to G4 stay green and UNCHANGED.
W-TL2 Cosmetic tier: Key Customer Contacts stance note at double its current visible width; Linked
      column shows dd/mm/yyyy, no time. Screenshots at 1240 and 1920.

PHASE 0 (short; STOP only if a premise fails)
0.A Report every reader of a type's installation price under OPEX; name the one R-TL1 converges on.
0.B W-TL2: measure table width vs panel, current note width, Linked column format source.
0.C W-TL3: does any follow-up, next-action or task concept exist in schema or UI? Report only.

EXIT
E1 G1 to G4: figures exact and unmoved. G5 added, PROVISIONAL, its figures listed for John.
E2 Driven on a fresh Lump Sum OPEX deal from the click: row total ties to units x fee x term; the
   failing case is shown red on the old code first.
E3 R-TL2 proved from the click both ways; server drop proved over HTTP, with the non-owner check.
E4 TT-SGP-MANUFI-004 NOT written by the round. Report what it will show when John opens it.
E5 W-TL2 screenshots; W-TL3 findings.
E6 Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check;
   stop at "ready for John's push". Never git push.
