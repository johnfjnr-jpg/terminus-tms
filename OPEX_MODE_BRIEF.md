# OPEX/CAPEX payment terms round

Branch `opex-mode`, off `main` at `e46aec614048405791c076be9a6551c539670bf6`,
confirmed equal to `origin/main` by `git ls-remote` against the real remote.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push"
and nothing is pushed from the session.

---

## Design of record, John, 2026-09-25, verbatim

> **R-OX1:** a switch OPEX / CAPEX in the Payment Terms panel, same dress and
> interaction as the Factoring enabled toggle. CAPEX restores today's behaviour
> exactly: the three-way recovery choice and existing fee tables. OPEX locks
> recovery to Single phase and shows the per-unit table.
>
> **R-OX2:** the OPEX table sits in the panel's left-hand space (reclaimed by
> G7), rows SafeSight, AQ Sensor, HEMIR; columns: # of Units | Monthly Fee |
> Margin % | Contract Total. "Monthly Fee" is the ruled heading (a customer
> price, not a cost). Contract Total = monthly fee x units x term, term from
> Contract Duration.
>
> **R-OX3:** the Monthly Fee is ALL-IN per unit per month: hardware, warranty
> share, installation, AND hosting, amortised over the term. Initially derived
> from base costs and target margin. Margin % is the blended all-in line margin
> (John ruled all-in; it will differ from the sheet's per-component margins,
> correctly).
>
> **R-OX4:** either-or per R-O7: edit the Monthly Fee, the Margin % rederives;
> edit the Margin %, the fee rederives. An edited value stores as an override
> through the existing R-O7 key family (Phase 0: measure whether an existing
> per-unit monthly key serves or ONE new server-validated key is needed; both
> allowlists per the drift finding), renders bold + amber per the
> effective-values standard, and the deal sheet drawers reflect the same stored
> fact (one store, two views, equality asserted).
>
> **R-OX5:** the # of Units column edits the SAME stored counts as the rest of
> the estate, and R-REV applies: a count or other fundamental-input change
> clears the absolute monthly fee override, margins persist.

---

## PHASE 0, THREE MEASUREMENTS

### (a) The panel's left-hand geometry

Measured live, Per Unit installation, a populated deal:

```
                1440                     1240
region          1076px                   876px
payment panel   787px                    637px
factoring col   269px                    219px
```

The panel's own left-hand space currently holds the invoiced-fee table at
roughly **270px**, with about **480px unused to its right** at 1440 and about
**330px** at 1240. A four-column table - label, units, fee, margin, total -
needs roughly 450 to 500px, **so it fits at both widths** and the round does not
need to reclaim anything further.

The switch to copy is `#deal-factoring-toggle`, `btn-ghost deal-toggle`, with
`role="switch"`, `aria-checked`, a state label and a title saying what a click
will do.

### (b) The derivation pieces, and whether each has a single source

| piece | single source | per-type? |
|---|---|---|
| hardware | `hardwareGroup.rows` `hwSs`/`hwAqm`/`hwHemir` | **yes** |
| hosting | `hostingGroup.rows` `hoSs`/`hoAqm`/`hoHemir`, already per month | **yes** |
| installation, per unit | `installGroup.rows` `inSsEx`/`inSsNew`/`inAqm`/`inHemir` | **yes**, with SafeSight spanning two rows |
| warranty | `result.hardware.warrantyCost` | **yes, and it is SafeSight's alone** |

**The warranty allocation needed no invention, which I expected it to.**
Measured rather than assumed: `warrantyBasisUnits` reads 32 on a deal of
20 + 12 SafeSight, and **does not move** when AQ Sensor goes 4 to 400 or HEMIR
goes 3 to 300; it moves to 52 when SafeSight existing goes 20 to 40. So the
warranty share belongs entirely to the SafeSight row.

**ONE GAP, AND IT IS A DESIGN GAP RATHER THAN A CODE ONE.** Under
`installResp: Lump Sum` the installation group is a SINGLE line, `inLump`, for
the whole deal. There is no per-type installation figure and the design of
record does not say how to split one. **3 of 18 live opportunities owned by real
or walk accounts carry lump-sum installation** (5 per-unit, 8 with nothing
recorded, 2 other).

**Position taken, and it is John's to overturn:** the lump sum is allocated
across types **in the proportions the catalog's own per-unit installation rates
would have produced**, falling back to unit count where those rates are absent.
That uses an existing single source and respects that a HEMIR install costs
5,000 against an AQ Sensor's 500, where a flat per-unit split would overcharge
the cheap units. Stated at the code site, not buried.

### (c) The storage question

**ONE NEW KEY IS NEEDED. The existing R-O7 family cannot serve.**

`hostingUnitFees` is documented and CONSUMED as hosting alone:

```js
const unitFees = payload.hostingUnitFees ?? {}
const feeFor = (key, units) => ... n * units
hostingLine('hoSs', (rates.hoSafesight ?? 0) * (ssExisting + ssNew), ...)
```

It becomes the **hosting group's** price override. An all-in figure written
there would price hosting at the all-in rate, and switching OPEX to CAPEX would
leave that figure sitting in the hosting slot - one key holding two different
quantities depending on a mode.

So the round adds one key, and per the drift finding it goes in **both**
allowlists: `COMMERCIALS_OWNED_KEYS` on the client and
`SALESPERSON_WRITABLE_KEYS` on the server, with server-side validation, plus
`valuesFromPayload` hydration and `readPayload`.

**Scope is unchanged** by any of the three, so the round proceeds.
