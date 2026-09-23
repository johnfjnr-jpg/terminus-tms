# C2 Tier 2, Phase 0: STOPPED at (a)

**Unit costs are SHARED CATALOG RATES, not the deal's own values.** The brief's
stop condition is met, so **no edit control exists** and Tier 2 is not built.

Step 0 and Tier 1 are built, green and committed.

---

## (a) WHERE EACH VALUE LIVES, AND WHAT WRITES IT

| what the drawer would edit | lives in | written by | deal's own? |
|---|---|---|---|
| **unit counts** `ssExisting` `ssNew` `aqm` `hemir` | the record's payload | `readDealPayload` -> `PATCH /opportunities/:id` | **YES** |
| **margins** `marginOverrides.*` (12 keys) | the record's payload | same | **YES** |
| **hosting price override** `hostingPriceMode` + `hostingUnitFees` | the record's payload | same | **YES** |
| **installation rates** `inSsExisting` `inSsNew` `inAqm` `inHemir` | the record's payload, as OVERRIDES | same | **YES** |
| **unit costs** `ssUnitCost` `aqUnitCost` `hemirUnitCost` `hoSafesight` `hoAqm` `hoHemir` | **`base_cost_batches`** | the Base Cost Data screen | **NO** |

### The stop, established four ways

**1. The rate resolver names them, and separates them on purpose.**

```js
export const OVERRIDABLE_RATE_KEYS = ['inSsExisting', 'inSsNew', 'inAqm', 'inHemir'];
// The other six. Named rather than derived, so a new catalog key is a decision
// somebody takes against the test above rather than something that acquires a
// permission by being added to a list.
export const CATALOG_ONLY_RATE_KEYS = [
  'ssUnitCost', 'aqUnitCost', 'hemirUnitCost', 'hoSafesight', 'hoAqm', 'hoHemir',
];
```

**2. The enforcement is independent of the allowlist, and the code says so
in a comment written for exactly this question:**

> *"A non-overridable key is never read from the payload, whatever it holds.
> **That is the enforcement, not the allowlist: even a payload that somehow
> carried `ssUnitCost` cannot price a deal with it.**"*

So a control writing a unit cost onto the record would be accepted by nothing
and read by nothing. It would appear to work and change no price.

**3. The catalog is one table, shared by every deal.**
`base_cost_batches`: **3 rows**, one per product, columns `unit_cost`,
`install_cost_existing`, `install_cost_new`, `hosting_cost_month`, with
`batch_label` and `effective_from`. **Editing a unit cost here reprices every
opportunity in the estate**, which is a different act from editing a deal.

**4. Measured on live data.** Of **18 live opportunities, 0** carry any
catalog-only unit cost in their payload. The separation is not merely
intended; nothing has ever crossed it.

### What this leaves

Three of the four controls the brief names are on deal-owned keys and could be
built as asked: **margin %**, **unit count**, and the hosting **unit price**
override. Only **cost per unit** is blocked - and it is blocked by a
deliberate boundary rather than an oversight.

---

## (b) THE WRITABLE ALLOWLIST, AND A SECOND GAP

`COMMERCIALS_OWNED_KEYS` is what `readDealPayload` sends. Against the four
controls:

| control | key | in the allowlist? |
|---|---|---|
| margin % | `marginOverrides` | **yes** |
| unit count | `ssExisting` `ssNew` `aqm` `hemir` | **yes** |
| unit price, HOSTING | `hostingPriceMode` `hostingUnitFees` | **yes** |
| unit price, HARDWARE or INSTALLATION | **none exists** | **NO KEY AT ALL** |
| cost per unit | `ssUnitCost` and the rest | **no, and by design** |

**R-O7's either-or price override is HOSTING-ONLY.** Measured rather than
assumed: `priceOverride` is attached by exactly one function,

```js
const hostingLine = (key, cost, units) => {
  const override = feeFor(key, units)
  return { key, cost, marginPct: marginFor(key), ...(override === null ? {} : { priceOverride: override }) }
}
```

and no hardware or installation line ever receives one. `buildCostGroup`
would honour it - the mechanism is general - but no payload key carries it and
no route validates one.

**So "unit price, either-or with the derived counterpart, R-O7 semantics" for
the hardware lines is NEW DESIGN, not a wiring job**: a new payload key, a
mode flag or a per-line absence convention, server validation, and a ruling
on what an overridden hardware price means for the warranty line that prices
at cost.

---

## The three questions this stop puts to John

1. **Should a deal be able to override a unit COST at all?** Today it cannot,
   and the resolver enforces it in a second place so that it cannot be done by
   accident. If the answer is yes, it is a new overridable key, a new column
   on nothing, and a decision about what a deal-level cost override means for
   the Base Cost Data screen's own reporting.
2. **Or should the drawer show the cost READ-ONLY and link to Base Cost
   Data?** That is the smallest change, keeps the boundary, and makes the
   statement honest about which numbers belong to the deal.
3. **Does the hardware price override get built?** It is the one control of
   the four with no key behind it, and it carries its own ruling about the
   warranty line.

**Nothing was built for Tier 2.** The stop came before any edit control
existed, which is what the brief asked for.
