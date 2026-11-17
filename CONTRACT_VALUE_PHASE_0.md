# CONTRACT_VALUE Phase 0: the premise does not hold

Branch `contract-value` off origin `main` `faa040a`, confirmed by `ls-remote`. The brief is the first commit (`8039699`). Read-only throughout: the census sent zero write requests, and the one fixture is torn down with zero residue (the same scan read 5 for a known live name).

## The finding first: there were never two contract values

**The $270,587 was a refused edit on screen, and the error was mine.** It came from `probe-closed-won-pricing-click.mjs` in FROZEN_FIGURES. That probe types **12** units into a Closed Won deal's Commercials form and proves the save is refused. By design (the COMMERCIALS FACTORING B1 ruling), a refused value stays in the form, unsaved and dirty. The screenshot was taken in that state, and its deal sheet reads "12 UNITS". The headline priced the stored **10**. I reported the two figures as a disagreement without reading the unit count on the same image, and the round was queued on that.

**Measured, to the dollar.** The engine over the same stored payload:

| units | `totals.contractNet` |
|---|---|
| 10 (stored) | **227,138** |
| 12 (typed, refused, unsaved) | **270,587** |

So both figures are the same quantity, contract net, for two different unit counts. Nothing on any screen disagrees on a saved deal.

## 1. The fixture, and the reconciliation

The original fixture (`ffwonclick`) was torn down at the end of its probe. I recreated it with identical inputs: `cvfix`, record `9c747c36`, `ssNew 10`, `duration 36`, `freshOpportunity` defaults.
- **Headline:** $227,138.
- **Commercials, as opened:** $227,138.
- **Commercials with 12 typed and unsaved:** $270,587.

**The difference of $43,449 is entirely the two extra SafeSight units,** priced through every line they reach (hardware, installation, hosting over 36 months, warranty), with no residue. The line-by-line itemisation the brief asks for would be an itemisation of "two more units". I have not written it out because no term is in one figure and not the other: same engine, same rates, same field, one input changed.

## 2. Every surface that shows a contract value

**Every one reads the SAME engine field, `result.totals.contractNet`.**

| surface | label | definition | input it prices |
|---|---|---|---|
| Headline strip | Total contract value | `frontend/app.js:7296`; value from `src/routes/opportunities.js:419`, via `totalContractValue` (`src/lib/opportunity-headline.js:37`) | the stored payload, live catalog; on Closed Won, the won version (`wonHeadline`) |
| Opportunities list | TCV | `frontend/app.js:7169-7171`; value from `src/routes/opportunities.js:126` | the same as the headline, per row |
| Commercials stats cell | Contract net | `frontend-react/src/deal/panelParts.tsx:362` | the FORM's payload (`readDealPayload`, `useDealForm.ts:126`), including unsaved edits |
| Commercials statement | Revenue, contract value net | `frontend-react/src/deal/statement.ts:349-351` | the same as the Commercials cell |
| Commercials statement strip | REVENUE | `DealStatement.tsx:242`; `statement.ts:468` | the same as the Commercials cell |
| Approval page, the ask | Contract net, and the sentence "...on a contract net of $X" | `ApprovalBlocks.tsx:61`; `approval-page.js:1013`, `:1019` | the version: stored figures since FROZEN_FIGURES, else its own inputs and frozen rates |
| Approval page, the bridge | opening and closing net | `ApprovalBlocks.tsx:151`, `:182`; `approval-page.js:377-378` | the baseline version, then the version |

The version card shows no contract value: the search found none in `frontend-react/src/versions`.

**Three legitimate reasons two surfaces can show different numbers, all by design:**
1. **Commercials prices unsaved edits; the headline prices what is saved.** That is what produced $270,587.
2. **The approval page prices the VERSION; the headline prices the record now.** The page already says so: "The deal has changed since V2.0 was taken...".
3. **A Closed Won headline shows the won version** (R-FF4).

## 3. Classification

**Neither (a) nor (b), on any saved deal.** It is one quantity, one field, and one value, under four labels: Total contract value, TCV, Contract net, and Revenue (contract value net).

**One small real (a) remains, measured in step 4:** on an UNPRICED deal, the headline and the list say "--" while Commercials prints "$0". The headline follows the decision of record ("ZERO IS NOT A CONTRACT VALUE, IT IS AN UNPRICED DEAL"); the Commercials cell does not.

## 4. Census: every live Opportunity

`.scratch/cv/census.mjs`, browser, read-only, one fresh tab per record, so no previous record's figure can satisfy the wait.

**Calibrated first, on the fixture:**
- known-EQUAL (as opened): route 227,138 against screen $227,138, read EQUAL;
- known-DIFFERENT (12 typed, unsaved): route 227,138 against screen $270,587, read DIFFERENT.

**The walk: 20 of 20 live opportunities, EVERY RECORD** (the 19 you confirmed are test data, plus `cvfix`). Zero write requests.

| verdict | count |
|---|---|
| EQUAL | 13 |
| BOTH UNPRICED (headline null, Commercials "$0") | 7 |
| DIFFERENT | **0** |

Both Closed Won records read EQUAL. They have no won version, so their headline is live, as ruled.

## 5. Goldens

`scripts/golden-deals/expectations.json` pins `totals.contractNet` for G1 to G5; G2, G3 and G4 are CONFIRMED. **No proposed change touches the engine, so no golden can move.**

## 6. Proposed rulings

1. **"Contract value" in TMS is `totals.contractNet`.** This is already the decision of record (DESIGN_PRINCIPLES, "The Opportunity headline strip": "Total Contract Value is `contractNet`... Naming a different number 'Total Contract Value' would put two contract values on one record"). **Recommend: affirm, no change.** There is no second quantity to name.
2. **What the round should become. Recommend option (a).**
   - **(a) Close it as a measured non-defect and build the RIDER only:** the `PRICING_KEY_LABELS` labels, plus the test that fails on an unlabelled pricing key.
   - **(b) As (a), plus Commercials prints "--" for an unpriced deal,** matching the headline and the decision of record. That is 7 live records today. It is display only and does not touch the engine or any golden.
   - **(c) As (b), plus a marker on the Commercials figures while the form holds unsaved edits.** The confusion that started this round was an unsaved figure read beside a saved one. Save changes being enabled is the only signal today.

   (b) is cheap and is the one real disagreement found. (c) is new design and a decision about the screen, so it is yours.
3. **Labels: recommend no relabel.** The four labels sit on four different kinds of surface. If you want one word, the candidate is "Contract value (net)" everywhere, but that is a taste call; nothing measured argues for it.

## 7. Conflicts with decisions of record

- **The headline strip decision** (TCV is `contractNet`; zero is not a contract value). No conflict with (a). (b) extends its zero rule to the Commercials cell, so it agrees with it.
- **R-O7** (hosting price override, either-or): unaffected; no proposal touches it.
- **"Rule 38" and "R-TC":** I could not identify these as decisions about contract value.
  - CLAUDE.md Verification 38 is "a detector that has never fired is an assertion", which this round respects (the comparator was calibrated both ways).
  - DESIGN_PRINCIPLES has no "R-TC" entry.
  - Please name the documents you meant, and I will check them before the build.
- **The Commercials statement rulings:** the statement's "Revenue, contract value net" is the label the headline decision cites. No conflict.

## What this phase does NOT establish

- That no FUTURE surface will price a different payload: the census covers the screens and records that exist today.
- The approval page against the headline was not censused, because by design they price different things (the version, and the record now).

## STOP conditions

None met:
- no CONFIRMED golden would move;
- no `frozen_figures` would need to change;
- no live non-test record was found: 20 live opportunities, which are your 19 test records plus the fixture, now torn down.
