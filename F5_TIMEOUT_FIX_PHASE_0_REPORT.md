# F5 statement-timeout fix: Phase 0 report

Measured 2026-09-13 on `a7e4315`. Read-only.

**THE MEASUREMENT CONTRADICTS THE INHERITED DIAGNOSIS, which is why R2
required it to be taken rather than carried forward.**

---

## 1. THE HEADLINE: F5 IS VARIANCE, NOT A CLOCK

R3 named the fork: *if the cost does not grow, F5 is variance not a clock,
and the fix differs.* **It does not meaningfully grow.**

**The cost decomposed**, `record_revisions` at 99,599 rows:

| component | cost | grows with the table? |
|---|---|---|
| network round trip (one indexed row) | ~147ms | **no** |
| full-table scan above that floor | **~126ms** | yes, linearly |
| returning 1000 rows | ~135ms | **no**, bounded by `.range` |
| **the real chunk, idle median** | **~408ms** | |

**The scan is 126ms of a 408ms statement.** Double the table to 200,000 rows
and the statement reaches roughly 534ms - still comfortably under the 889ms
ceiling. **Table growth cannot account for a 1178ms reading.**

**What CAN: the distribution.** 25 idle samples of each:

| case | min | p50 | p90 | max | spread |
|---|---|---|---|---|---|
| network floor, ONE indexed row | 133 | 150 | 234 | **498** | **3.7x** |
| full scan, zero rows returned | 195 | 221 | 275 | 519 | 2.7x |
| **the real chunk** | 144 | **264** | 416 | 536 | **3.7x** |

**A single indexed row swings 3.7x, from 133ms to 498ms.** That is the
connection to a remote Supabase instance, not the query - no query change
removes it.

And the distribution is **not stationary**. A separate run minutes earlier
read the same chunk at `437, 452, 458, 775, 899, 930` - **two of six over the
889ms ceiling while idle** - and sampling during a live `test:db` run read a
max of 1268ms with 2 of 30 over the ceiling.

> **F5 is a SINGLE SAMPLE of a heavy-tailed, non-stationary quantity asserted
> against a fixed ceiling. It will cross that ceiling a few percent of the
> time forever, whatever `TAG_CHUNK_SIZE` is set to.**

**That matches the evidence exactly**: 1 of 3 gates red; earlier, fired once
and passed twice.

## 2. AND THE CONTENTION HYPOTHESIS, TESTED AND REJECTED

The obvious alternative was that the suite's ten parallel files starve the
statement. **Measured, and it is false:**

```
idle median    775ms
loaded median  431ms   (0.6x - LOWER under load)
```

Recorded because it was my own first hypothesis after the decomposition and
it did not survive contact. The load run's max (1268ms) and the idle run's
max (930ms) are the same tail, sampled twice.

## 3. THE CEILING DERIVATION, REVIEWED (R1)

`CEILING = 8000ms / 6x cold / 1.5x margin = 889ms`

Each term is defensible and the **composition has a hole**: it is a
derivation for a DETERMINISTIC measurement. `6x` and `1.5x` convert a warm
reading to a cold worst case with headroom; **neither term accounts for the
reading itself being a draw from a 3.7x distribution.**

Against the measured p50 of ~264-425ms the margin is genuinely large. Against
the observed max of 1268ms it is not. **The ceiling is not wrong; the thing
being compared to it is a lottery ticket.**

**The real risk is not imaginary.** A 1268ms warm tail times the 6x cold
factor is 7.6s against an 8000ms statement timeout. The tail matters - which
is exactly why it must be measured rather than drawn once.

## 4. OPTIONS AND RECOMMENDATION

**(c) A THIRD `TAG_CHUNK` STEP-DOWN - REJECTED, and now with a measurement
behind the rejection.** The tag count is not the driver: 1 tag costs 314ms
and 8 tags cost 567ms, while the floor alone is ~150-273ms. Stepping down
from 3 to 2 would save perhaps 60ms of a 408ms statement, change nothing
about a 3.7x spread, **and run more statements** - each one paying the
~147ms floor again. It has been tried twice and did not hold because it was
never the lever.

**(a) DERIVATION FIX ALONE - insufficient.** Raising the ceiling is
forbidden by R1 and would be wrong anyway: the tail is real.

**(b) RECOMMENDED - STRUCTURAL, AND THE STRUCTURE TO FIX IS THE MEASUREMENT.**

> **Assert a ROBUST STATISTIC of several samples, not one draw.**

Take N samples of the heaviest chunk and assert the **median** against the
ceiling, reporting min/p50/max in the failure message. This is R4's "flat as
the table grows" achieved on the axis that actually varies:

- **It does not blind the guard - it sharpens it.** A median over N samples
  is MORE sensitive to a genuine cost increase than a single draw, because a
  real clock moves the whole distribution while noise moves one sample.
- **It measures the quantity the claim is about.** The claim is "this
  statement does not approach the 8s timeout", which is a property of the
  distribution, not of one draw.
- **The tail stays visible**: the max is printed, and a separate, looser
  assertion can hold the tail (max under the raw 8000/6 = 1333ms cold-only
  bound) so a genuinely dangerous outlier still fails.

**A genuinely structural DB option exists and is NOT recommended for this
round**: `payload->>name ilike '<tag>%'` is unindexed, which is the whole
126ms scan term. An expression index would take it to near zero. **It is a
migration**, so it needs its own ruling and the by-hand apply path, and it
would remove 126ms of a 408ms statement while leaving the 3.7x spread
untouched. **It fixes the small term and not the binding one.**

## 5. What this phase does NOT establish

- **A growth curve against table size.** The 126ms scan term is measured at
  one table size; linearity is inferred from it being a sequential scan, not
  measured across sizes. The projection to 200k rows rests on that.
- **The cause of the connection's 3.7x spread.** It is observed, not
  explained - it may be the hosted instance, the network, or this machine.
- **That the tail never exceeds 1333ms.** The largest reading seen is
  1268ms, across roughly 90 samples. A longer campaign might find worse.
