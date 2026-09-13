# F5 statement-timeout fix: Phase 1 report

## The fix

**A. The regression guard now asserts the MINIMUM of 5 samples**, not one
draw, against the unchanged 889ms ceiling.

**THE MEDIAN WAS IMPLEMENTED FIRST, AS RECOMMENDED, AND MEASURED
INSUFFICIENT.** A median of 5 read **945ms for a 16-tag chunk and 314ms for
a 24-tag chunk that walks MORE rows** - non-monotonic, because the
distribution shifted between the two runs. The superseded choice is left
visible: the premise failed rather than a preference changing.

**The minimum is right for a structural reason.** This noise is **strictly
additive**: jitter, scheduling and contention only ever make a statement
slower, and nothing makes it faster. So `min(N)` is a lower bound on the true
cost and ignores precisely the samples that are noise, while a median still
carries whatever the connection was doing during those seconds.

**It SHARPENS the guard.** A real cost increase raises the floor, and the
floor is exactly what the minimum measures; jitter raises only the upper
samples, which the minimum discards.

**B. The cold-tail guard went on the term that actually multiplies.** The 6x
cold factor is a disk-cache effect on the SCAN - not on the network round
trip and not on the fetch of 1000 rows. Applying it to a jitter-inflated
total overstates the risk; applying it to an isolated zero-row scan measures
the real one. That term is ~180-245ms, so `x6 = ~1100-1470ms` against a
`8000/1.5 = 5333ms` bound, and it fires if the scan roughly quadruples -
which is the table growth F5 was always meant to watch.

**Coverage is untouched**: the rows-walked exact-count assertion stays, as
does the assertion that the probe uses the same chunk size the code does.

## Both halves (R7)

### A. It stops false-failing

```
8 of 8 runs GREEN
1 of 40 INDIVIDUAL DRAWS was over the 889ms ceiling
   run 6: samples [336, 935, 422, 417, 304] min 304ms -> GREEN
```

**Run 6 is the demonstration.** A 935ms draw - the exact shape that turned
gate 2 red - and the run is green because the minimum is 304ms.

**And two more arrived unplanned during the build**: consecutive runs drew
**921ms** and **1701ms** individual samples, minimums 454ms and 314ms, both
green. The old single-draw probe would have failed all three.

### B. It still catches a real regression

```
injected: 33 leading-wildcard tags, payload selected, non-indexed sort, 10k rows
          (1145ms minimum against a ~357ms baseline - a real 3x increase)
headroom: 5 samples [1700, 1633, 2708, 2618, 1156] min 1156ms, ceiling 889ms
the MINIMUM assertion FIRED: true
restored, byte-identical to the snapshot
reverted run: GREEN
```

**A genuine cost increase, not a lowered threshold** (Verification 47).

## FINDING THE INJECTION TOOK FIVE ATTEMPTS, AND THE FAILURES ARE THE RESULT

| attempt | outcome | what it establishes |
|---|---|---|
| leading wildcard `%tag%` | 419ms vs 416ms | **`payload->>name` is not prefix-indexed either way** |
| 10,000 rows instead of 1,000 | 420ms vs 357ms | **PostgREST caps the response**; row count is not a lever |
| all 99,599 rows | 124ms | same cap, and a plain indexed read is only ~124ms |
| regex `imatch` | 348ms | predicate cost is not the driver |
| deep payload path | 233ms | nor is the path |
| **all of them at once** | **1145ms** | crosses, and is the injection used |

> **The ceiling sits about 2.5x above the statement's true cost, and nothing
> reachable through this API gets near it.** The guard was never close to its
> limit - it was drawing lottery tickets against a threshold it could not
> otherwise approach.

That is the strongest single statement of why three rounds of `TAG_CHUNK_SIZE`
step-downs did not hold.

## What this does NOT establish

- **A growth curve against table size.** The scan term is measured at one
  table size; its linearity is inferred from it being a sequential scan.
- **The cause of the connection's spread.** Observed, not explained.
- **That 5 samples is enough in every window.** 1 of 40 draws crossed here;
  an earlier window had 2 of 6. If a future window is bad enough that the
  MINIMUM of 5 crosses, that is either a real regression or a connection
  problem worth knowing about - and the failure message prints all five
  samples so the two can be told apart.
