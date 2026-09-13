# F5 statement-timeout fix: close-out

**CLOSED** on three gates, **all 22/22**, F6 quiet, zero failing assertions.
**PUSHED** at `26e9dd3`. **Test-tooling only; a revert is pure git.**

## THE PROOF CONTAINS THE DEFECT REPRODUCING ITSELF

| gate | F5 samples | min | worst |
|---|---|---|---|
| 1 | 556, 340, 237, 277, 152 | 152ms | 556ms |
| 2 | 402, 309, 295, 228, 197 | 197ms | 402ms |
| **3** | 898, 363, 463, 263, 384 | **263ms** | **898ms** |

**Gate 3 drew 898ms, over the 889ms ceiling.** Under the old single-sample
probe that gate goes red. It passed on a 263ms minimum.

## What F5 actually was

**Not a defect on a clock.** Decomposed at 99,599 rows the statement is
~408ms: **~147ms network round trip, ~126ms scan, ~135ms returning 1000
rows.** Only the scan grows with the table, so doubling it reaches ~534ms -
**table growth cannot produce the 1178ms that turned a gate red.**

What could: 25 samples of a **single indexed row** swing 133ms to 498ms, a
**3.7x spread**, non-stationary between runs. **F5 was a single draw of a
heavy-tailed quantity asserted against a fixed ceiling**, and would cross it
a few percent of the time forever.

**That is the close on its history.** `TAG_CHUNK_SIZE` was stepped 25 -> 6 ->
3 to reduce per-statement work on a defect that was never per-statement work.
Measured: 1 tag costs 314ms and 8 cost 567ms against a ~150ms floor, so each
step saved tens of milliseconds and added statements that each paid the floor
again.

## The fix

**The MINIMUM of 5 samples, not the median.** The median was implemented
first as recommended and **measured insufficient** - a median of 5 read 945ms
for a 16-tag chunk and 314ms for a 24-tag chunk walking MORE rows.

The minimum is right structurally: **this noise is strictly additive.** Jitter
only ever makes a statement slower. So `min(N)` is a lower bound on true cost
and discards exactly the noise. **It sharpens the guard** - a real increase
raises the floor, and the floor is what the minimum measures.

**The cold-tail guard went on the scan term**, because the 6x cold factor
multiplies disk reads, not the round trip or the fetch. The two things F5
conflated are now separated: **network jitter, which the minimum handles, and
real scan growth, which the cold bound catches** at roughly 3.6x headroom.

## The five failed injections are the definitive finding

Leading wildcards cost the same as prefixes (**not prefix-indexed either
way**); 10,000 rows cost the same as 1,000 (**PostgREST caps the response**);
regex and deep paths barely moved it. Only everything at once crossed, at
1145ms against a ~357ms baseline.

> **The ceiling sat about 2.5x above the statement's true cost, and nothing
> reachable through this API got near it. The guard was drawing lottery
> tickets against a threshold it could not otherwise approach.**

## Promotion: an instance on the rule that mis-diagnosed it

**Verification 48** reads flat-versus-climbing off two passing and two
failing samples. That reading was inherited, acted on three times, and was
wrong - **"passing flat, failing climbing" is exactly what a heavy tail looks
like through four samples.** The clause now carries the action it lacked: see
the SPREAD before calling a trend; never assert one duration against a fixed
threshold; prefer the minimum when noise is additive; and separate terms that
scale differently.

## The detour, closed

The gate is now deterministic on both counts that made it lie: **racing
invariants**, fixed at root, and **the lottery-ticket timeout**, fixed by
measuring a statistic instead of a draw. **Seven promotion instances across
the three rounds, zero new numbers.**
