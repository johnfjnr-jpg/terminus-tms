# Door at 1920: diagnosis report

**OUTCOME (a): THE DOOR IS PRESENT AT 1920. NO SECURITY DEFECT.**

And a correction the brief did not anticipate: **the settle condition is not
stale and there is nothing to fix in the probe.**

## The measurement

Taken twice - a fresh page per width, and the probe's own reused-page
sequence - on the genuinely unowned record `d86369b3`.

| | 1240 | **1920** |
|---|---|---|
| view exists | 10ms | 8ms |
| `is-loading` cleared | 3337ms | 3335ms |
| `data-record-id` present | 2128ms | 2126ms |
| a name element has text | 2128ms | 1824ms |
| **SETTLED** | **4851ms** | **4850ms** |
| `is-not-mine` applied | true | **true** |
| controls / **typeable** | 290 / **0** | 290 / **0** |
| Mark Closed Lost found | true | **true** |
| ...and blocked | true | **true** |

**The screenshot confirms it**: the read-only banner - *"This record belongs
to another user. You can view it, but only its owner can change it"* - every
field dimmed, Mark Closed Lost greyed.

**The three gate failures were readings of an unrendered page, exactly as the
probe's own fourth line said.** Its capture is nav-sidebar-only at 11KB; the
settled capture is a full record.

## THE BRIEF'S PREMISE WAS WRONG, AND SAYING SO IS THE DELIVERABLE

R2(a) anticipated *"fix the probe's 1920 settle condition"*. **There is
nothing wrong with it.**

```
settles at ~4.85s against a 25,000ms timeout - a 5x margin
replicated sequence, all six combinations: 4816 - 6610ms, every one settled
```

The gate failure was a **transient ~5x slowdown on one combination**. The
probe behaved correctly: it failed LOUD rather than reading an unrendered
page, which is precisely the repair built into it after it once passed
silently on exactly that.

## THE RULING, AND WHY IT IS THE F5 PRECEDENT

**Option 1: change nothing, re-gate.** Legitimate because the failure is
DIAGNOSED rather than retried past - the door is confirmed present, the cause
is identified, and the captures are preserved.

**NOT option 2, raising the timeout.** That is the F5 error exactly: a single
tail crossing at a 5x margin is not a level shift, and F5 established that
raising a ceiling to accommodate variance is the move to refuse.

**NOT option 3, retry-on-non-settle.** It would destroy the flake-versus-
defect evidence, which is the one thing F5 proved you cannot get back.

**One failing sample (>25s) against thirteen passes (~5s) is a heavy tail
spiking once, not a trend.**

**AND THE STANDING CONDITION IF IT RECURS**: a second failure is a second
sample, and the question then is whether the probe's SINGLE-SAMPLE settle
check should become a robust-statistic check - F5's own fix - and NOT whether
to raise the timeout.

## What this does NOT establish

- **The replication used one record for all six combinations.** The
  `MINE`/`APPROVING` ids live in the probe's env and were not available, so
  it faithfully exercises six navigations on one page at both widths but not
  three distinct records. **The door measurement itself is unaffected** - it
  was taken on the genuinely unowned record at both widths.
- **Why the slowdown happened.** Observed, not explained. One sample.
- **That 25s is the right timeout.** It is untouched by ruling, and the
  evidence for changing it does not exist yet.
