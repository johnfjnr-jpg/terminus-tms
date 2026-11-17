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
