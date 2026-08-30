# Applicability rules for `buildNotRecorded`

**Ruling 3 of the Phase 1 rulings. REPORT ONLY. `buildNotRecorded` is
unchanged until this table is approved.**

## What is being decided

A disclosure currently fires for **every** key in `NUMERIC_DEFAULTS` the payload
does not set. Measured in Phase 1: the approval page tells an approver *"Nobody
entered a value"* for `lumpSumCost` on three installation types where the field
cannot apply, and for `factoringRatePct` on every deal with factoring off.

The rule becomes: **a disclosure fires only when the field applies to the deal**,
decided **from deal data**, never from DOM visibility. The server has no screen,
so this is the only decidable form.

## The three inputs applicability may read

Named explicitly, because "decided from deal data" needs a closed list or it
becomes "whatever the author reached for":

| input | payload location | values |
|---|---|---|
| installation responsibility | `installResp` | Client Own Installation Team, Terminus Contractor - Per Unit, Terminus Contractor - Lump Sum, Terminus - Reseller Installation |
| factoring | `factoring.enabled` | true, false |
| payment structure | `structure` | single, twoPhase, hybrid |

**Nothing else.** If a key needs a fourth input, that is a finding, not a
licence.

## The table

**Every key in `NUMERIC_DEFAULTS`, none omitted.** `factoring.termMonths` is
included because ruling 5 makes it a field; it is not in `NUMERIC_DEFAULTS`
today.

| key | applies when | proposed rule | reason |
|---|---|---|---|
| `targetMargin` | always | **unconditional** | every deal is priced against a margin. There is no deal shape where a target does not apply. |
| `warrantyPct` | always | **unconditional** | warranty is provisioned on hardware, and every deal carries hardware. |
| `whtPct` | always | **unconditional** | withholding is a property of the customer's jurisdiction, not of the deal's shape. Absent means nobody asked, on any deal. |
| `gstPct` | always | **unconditional** | same. Measured in Round 39: 406 of 467 carry none, and that absence is exactly what the disclosure exists to report. |
| `ssExisting` | always | **unconditional** | a unit count. Zero is a real answer, so this key is *ruled out of* `ZERO_IS_NOT_A_VALUE` and its disclosure is moot, but the applicability answer is still "always". |
| `ssNew` | always | **unconditional** | same. |
| `aqm` | always | **unconditional** | same. |
| `hemir` | always | **unconditional** | same. |
| `duration` | always | **unconditional** | every deal has a term. |
| **`recoveryMonths`** | **`structure === 'twoPhase'`** | **conditional** | ruling 1: recovery period is two-phase only. On single the term is the duration; on hybrid, after ruling 1, the concept does not exist. |
| **`lumpSumCost`** | **`installResp` includes `Lump Sum`** | **conditional** | on the other three types Terminus pays no contractor lump sum, so there is no value to record and no absence to report. |
| **`factoringRatePct`** | **`factoring.enabled === true`** | **conditional** | a rate on a facility nobody is using is not a missing value. |
| **`factoring.termMonths`** | **`factoring.enabled === true`** | **conditional** | same. New key, per ruling 5. |
| `fxContingency` | **see the open question below** | **unconditional, provisionally** | proposed unconditional, and flagged rather than assumed. |

## The one open question, flagged rather than decided

**`fxContingency`.** It is captured and applied to nothing: `buildDealInputs`
does not read it and `calculateDeal` has no currency handling. The approval page
already reports it separately as *"recorded and does NOT affect any figure"*.

Two defensible rules and I am not choosing between them:

- **Unconditional.** Currency risk is a judgement on any deal, and the deal
  carries `bidCurrency` and `proposalCurrency` whether or not they differ.
- **Conditional on `bidCurrency !== proposalCurrency`.** A contingency against a
  conversion that does not happen is not a missing value.

**The second would add a fourth applicability input**, which the closed list
above says is a finding rather than a licence. That is why it is flagged: taking
it would widen the rule's inputs, and that should be a decision rather than a
side effect.

## Three consequences of the rule, stated because they are part of it

**A disclosure that stops firing is not a disclosure that was wrong.** Making
`lumpSumCost` conditional removes it from three installation types; it must
still fire on the fourth, and a test should prove both halves.

**Applicability is evaluated on the deal being approved, not on the deal
today.** The approval page prices a stored version. If a version was taken as
Lump Sum and the record has since changed, the version's own `installResp`
governs its disclosures.

**A key can be applicable and unset and still not be a `ZERO_IS_NOT_A_VALUE`
member.** The two lists answer different questions: applicability asks whether
the field belongs to this deal, `ZERO_IS_NOT_A_VALUE` asks whether zero is a
value somebody would enter. `ssExisting` is applicable on every deal and out of
the zero list; `lumpSumCost` is in the zero list and applicable on one type.

## What happens on approval

`buildNotRecorded` gains a single applicability predicate per key, evaluated
from the payload. Every conditional key gets two tests: it fires when the field
applies and is unset, and it does not fire when the field does not apply.
Calibration by injection, per Verification 9.
