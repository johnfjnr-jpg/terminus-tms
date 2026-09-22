# Contacts polish (walk 10): PARKED, built but ungated

Branch `contacts-2`, off `main` at `ea0fa96`, confirmed equal to `origin/main`
by `git ls-remote`.

**The round parks as built-but-ungated, on John's own stop condition.** `main`
is untouched at `ea0fa96`. Nothing merged, nothing pushed.

---

## The three items are built and independently green

| | State | Evidence |
|---|---|---|
| **1** header alignment | **built** | 34/34 live at 1440 and 1240; every cell and header computes `table-cell` |
| **2** Add button treatment | **built** | `btn-sm`, and Record beside it |
| **3** duplicated contact ids | **built** | **zero** duplicated ids anywhere in the document |

Calibrated **6/6**, every injection firing on its NAMED check, revert green.
Pure 626/626, react 1292/1292, typecheck clean.

**Item 1's finding is worth keeping**: the first measurement did NOT reproduce
the reported misalignment. Header boxes and header GLYPHS both read drift 0,
both widths, resting and armed. What was actually wrong ran DOWN the card: the
armed row's stance select measured 104px and the other three 183px, with the
note starting at x 665 on one row and 744 on the rest, because a flex item
shrinks by default and Record is hidden until a stance changes.

---

## The gate: red on the same stage, twice

| | stage result | duration |
|---|---|---|
| first gate, dirty machine | **FAIL** `HTTP readonly-view probe` | 69,162ms |
| second gate, quiesced machine | **FAIL** `HTTP readonly-view probe` | 105,765ms |

Both: `TimeoutError: Navigation timeout of 30000 ms exceeded` at
`probe-readonly-view.mjs:147`, `page.reload({ waitUntil: 'networkidle0' })`.

23 of 24 stages passed on both runs.

### The machine WAS quiesced, and it is measured

| | before | after |
|---|---|---|
| stray polling shells | **13** (oldest 23 hours) | **0** |
| Chrome for Testing | 0 | 0 |
| probe node processes | 0 | 0 |
| dev servers | 1 | 1 |
| total node processes | 2 | 2 |

NordVPN's app is running but **the tunnel is down**: no `utun` carries an inet
address and the default route is direct via `en1`. DNS cache flushed;
`killall -HUP mDNSResponder` needs a password this session does not have and
was NOT run.

**Five settle samples on the quiet machine**, request tracker attached:

```
3035ms  3043ms  3045ms  3819ms  6539ms      5/5 settled
min 3035  median 3045  max 6539  spread 3504
```

Against **12,050ms** measured on the dirty machine. The 13 spinning pollers
were real load, and removing them cut the settle time fourfold.

### And that contrast is the diagnosis

**Isolated, this reload settles in 3 seconds. Inside the probe it exceeds 30.**

`probe-readonly-view.mjs` opens **one browser and one page** at lines 135-136
and reuses that single page across every iteration: two widths by three
records in the first loop, and a second loop after it. Each settle sample
above used a FRESH browser, which is exactly why they were fast.

So the failure is not the machine and not the product. It is
`networkidle0` degrading on a long-lived page as that page accumulates state,
on a probe that never gets a fresh one.

---

## Carried

1. **The probe's proper ready-condition hardening, as its own diagnosed item.**
   The diagnosis above is the starting point: a fresh page per iteration, or a
   real ready-condition instead of `networkidle0`. **Both failed attempts are
   cited so they are not repeated:**
   - `networkidle0` to `load` plus a `navigate` check made it WORSE, 2 of 3
     runs failing "the view never settled". `networkidle0` is load-bearing
     here: it waits for the app's own data, not merely the document.
   - Raising the navigation ceiling 30s to 90s fixed the navigation timeout
     and then a DIFFERENT wait failed with the same message.
   The probe is reverted to exactly its committed state. No third edit.
2. **The self-matching polling pattern, fixed at SOURCE.** A waiter written as
   `while pgrep -f 'scripts/verify-all.mjs'` matches ITS OWN command line, so
   it can never exit and accumulates one immortal shell per wait. Thirteen
   were alive, the oldest 23 hours, and they measurably slowed the machine.
   The fix is to wait on the OUTPUT FILE rather than on a process pattern, or
   to match a pattern the waiter cannot contain.

---

## Exit gate

| Point | Answered |
|---|---|
| Three items built | **Yes**, all three, independently green |
| Red-first, calibrated | **Yes**, 6/6 on named checks |
| Live proof at 1440 and 1240 | **Yes**, 34/34 |
| Screenshots opened and read | **Yes**, and the screenshot found the real defect |
| Machine quiesced and measured | **Yes**, counts before and after |
| One gate on the quiet machine | **Yes**, at `bddd7f3`, and it was RED on the same stage |
| Merged | **No.** John's stop condition: no further re-runs |
| Pushed | **No push from the session** |

