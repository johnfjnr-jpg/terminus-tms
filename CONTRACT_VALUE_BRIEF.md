# CONTRACT_VALUE: the round brief, verbatim

ROUND: CONTRACT_VALUE (John, 2026-11-17).
First commit: this brief verbatim. Branch contract-value off origin
main faa040a (confirm by ls-remote; STOP if different).

WHY: on a fixture record the Opportunity headline, the approval page
and the engine give contract value $227,138; Commercials shows
"contract net" $270,587. Two screens, two contract values, one deal.
An approver will see both. Since FROZEN_FIGURES, the approval page's
figure is stored at submission, so it is the figure of record.

PHASE 0 (read-only, STOP for rulings):
1. Name the fixture. Reconcile $270,587 to $227,138 LINE BY LINE:
   every term that is in one figure and not the other, with its amount,
   until the difference is fully explained to the cent. No unexplained
   residue.
2. For each surface that shows a contract value (Commercials, statement,
   stats strip, headline, list column, approval page, version card,
   anything else found), give: its label, its exact definition in code
   (file:line), and the engine field it reads. Table.
3. Classify: (a) same quantity, one surface wrong; (b) different
   quantities under the same or similar name; (c) both.
4. Census: every live Opportunity, both figures, the difference.
   Assert the walk covered every record. Calibrate the comparator on a
   known-equal and a known-different case first.
5. Does any golden pin either figure? Would any proposed fix move a
   CONFIRMED golden? (STOP if yes.)
6. Proposed rulings, each with a recommendation: which figure is
   "contract value" in TMS; what the other one is called; where each
   shows. Wording for any relabel.
7. Conflicts with decisions of record (Rule 38, R-TC, R-O7, the
   Commercials statement rulings), each with a recommendation.

RIDER (build phase, not Phase 0): PRICING_KEY_LABELS gains labels for
paymentMode, priceOverrides, hostingPriceMode, hostingUnitFees,
opexUnitFees, opexUnitMargins; a test fails if any pricing key in
src/lib/pricing-keys.js lacks a label.

STOP conditions: a CONFIRMED golden would move; any frozen_figures
would need to change (they cannot, and must not); any live non-test
record found.
Do not push.

## Phase 0 sign-off (John, 2026-11-17), appended verbatim at the phase it launches

PHASE 0 SIGN-OFF: CONTRACT_VALUE

Phase 0 ACCEPTED. The premise is withdrawn: $270,587 was a refused,
unsaved 12-unit edit, not a second contract value. Census 20/20, 0
DIFFERENT. Record this as the round's finding.

JOHN RULES:
1. "Contract value" is totals.contractNet. Affirmed, no change, no
   relabel.
2. OPTION (b): build the RIDER (PRICING_KEY_LABELS for the six keys,
   plus a test that fails on any unlabelled key in pricing-keys.js) AND
   the Commercials stats cell and statement print "--" for an unpriced
   deal, matching the headline and the decision of record ("zero is
   not a contract value, it is an unpriced deal"). Use the SAME
   unpriced test the headline uses, one definition. Prove it from the
   click on an unpriced fixture; calibrate.
3. (c) the unsaved-figures marker is PARKED for a mockup.
REFERENCES: "Rule 38" is PRICING_LOGIC.md Rule 38 (lump-sum install
shared by catalog per-unit rates); "R-TC" is the panel-separation
round's ruling that the statement's Total cost row foots its columns.
Neither is touched by this round; no check needed.

Build, then Phase 3 (DESIGN_PRINCIPLES note on the withdrawn premise:
compare figures only at equal inputs; CURRENT_STATE; full gate; merge;
"ready for John's push"). No stop between unless a STOP condition
fires. Do not push.
