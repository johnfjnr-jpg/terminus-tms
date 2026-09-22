# Contacts polish, the unpark sequence: item 4 is a NULL RESULT

The park was lifted for one sequence because the red had a diagnosis. **The
diagnosis was wrong, and the measurement that was supposed to justify the
repair is what killed it.**

---

## ITEM 4: the fresh-page hypothesis is FALSIFIED

The park recorded that `networkidle0` degrades on a long-lived page: isolated
settle samples ran about 3s, the probe exceeded 30s, and the probe reuses one
page where every sample used a fresh browser. The repair was to give each of
the six passes its own page.

`scripts/walk10/ab-page-lifetime.mjs` replicates the probe's loop exactly and
runs it three times under each shape, on the quiet machine, in the same
minutes.

### Iteration 6, which is the iteration the hypothesis is about

| shape | iteration 6, three runs |
|---|---|
| ONE LONG-LIVED PAGE, as shipped | **3458 / 3729 / 5032 ms** |
| FRESH PAGE PER ITERATION | **6951 / 8591 / 18981 ms** |

**The repair is slower at iteration 6 than the thing it replaces**, and by a
factor of three at the median. It would have been adopted on the strength of a
diagnosis and made the stage more likely to fail, not less.

### And there is no iteration trend in either shape

```
ONE LONG-LIVED PAGE      run 1: 6752  4014 17884  4020  3757  5032
                         run 2: 3862  3456  5031  3896 11040  3729
                         run 3: 8262 20544  4024  3244 12487  3458

FRESH PAGE PER ITERATION run 1: 4030  3936  3951  4863  8033  6951
                         run 2: 6030  3686  4801 10971  3939  8591
                         run 3: 3650  3943 25978  3949  4463 18981
```

The long readings land at iteration 2, 3, 5 and 6 indifferently. Four of
eighteen exceed 10s under the old shape and three of eighteen under the new
one. **Page lifetime is not the variable.**

**This is Verification 48's own caveat, and I walked into it.** The park read
a trend off a handful of samples - fast isolated, slow in the probe - and the
clause says two readings of each cannot separate a trend from a distribution.
The settle time here is heavy-tailed, and a heavy tail through a few samples
looks exactly like a trend.

---

## WHAT THE TAIL IS ACTUALLY MADE OF

A request tracker over ten reloads, printing the slowest request each time:

```
reload  3: 23007ms   ->  /api/contacts 21597ms,  /api/contacts 20892ms
reload  2:  6969ms   ->  /api/contacts  5452ms,  /api/contacts  3647ms
reload  5:  3027ms   ->  /api/contacts  1685ms,  /api/contacts   906ms
```

**Every reload's slowest request is `/api/contacts`, and there are several of
them in flight at once.** Served alone it takes 0.83s to 1.90s across eight
calls. Eight live client sites fetch it, unscoped:

```
ContactHost.tsx  ContactView.tsx  TestBedHost.tsx (x2)
NewLeadGrid.tsx  LeadsList.tsx    KeyContacts.tsx   app.js (x2)
```

The shell keeps several surfaces resident, so one page load issues three or
more concurrent copies of the same unscoped query, and when the upstream is
slow they stack. That is the tail, and `networkidle0` waits for all of it.

---

## THE STAGE WAS ALWAYS A LOTTERY TICKET, AND IT IS NOT THIS ROUND'S

Every gate transcript on disk, read for this one stage:

```
PASS  112159ms    PASS  101037ms    PASS  100416ms    PASS  87438ms
PASS   83786ms    PASS   74034ms    PASS   73043ms    PASS  72498ms
...  nineteen passes in all, from 60675ms to 112159ms
FAIL   67041ms    (the opportunity round)
FAIL  105765ms    (this round)
```

**It passed at 112,159ms and failed at 105,765ms.** The total does not
discriminate, because the failure is not the total: it is ONE navigation
crossing a 30,000ms ceiling, and the settle distribution's tail reaches
25,978ms in the numbers above.

Verification 48 states this exactly: *never assert a single measured duration
against a fixed threshold; that is a lottery ticket, and any heavy tail
crosses any ceiling eventually.* The stage has had one for its whole life, and
this round's three items did not touch it, its surface or the route it waits
for.

---

## ITEM 5: the self-matching poller, fixed at source

The pattern was never a repository helper. It was inline shell, written by
hand, each time:

```sh
while pgrep -f 'scripts/verify-all.mjs' >/dev/null; do sleep 20; done
```

`pgrep -f` reads full command lines, so the waiter matches ITSELF and never
exits. Thirteen such shells accumulated, the oldest 23 hours old, and they
were real load: the same settle measured 12,050ms with them running and
3,045ms without.

**So "at source" means giving the correct form somewhere to be reached for**,
which is `scripts/await-run.sh`. Mechanical enforcement is gateable and a
habit is not.

**Two self-matches, and the bracket trick only closes one.** Writing the
pattern `[v]erify-all` hides this script from its own search. It does nothing
about the parent: a shell invoked as `sh await-run.sh verify-all` carries the
bare word. The ancestor chain is therefore excluded explicitly as well.

### Calibrated 4/4, end to end, with the fault reproduced

```
PASS  the waiter is STILL WAITING while its target runs
PASS  the NAIVE form sees 2 processes: the target AND the waiter
PASS  the waiter EXITED 1s after its target did
PASS  zero processes carrying the token remain
```

The negative is scored first, because a waiter that exits immediately passes
any test that only checks it exits. The naive form is run against the same
live population rather than described, and it finds two processes where one is
running: that second one is the waiter, and it is why the naive form can never
exit.

**The first version of this self-test FAILED, and the guard was right.** It
tried to reproduce the fault with `sh -c 'pgrep -f "sleep 25"'` and read
`clean`. `pgrep` excludes its own process, so the self-match is the PARENT
shell, and `sh -c` with a single command execs that parent away. The
reproduction had to become a real waiter carrying the token. A calibration
that had merely been asserted would have shipped the wrong explanation.

---

## Disposition

- **The probe is NOT edited.** It stands byte-identical to `main`. The ruled
  repair is falsified, and the two earlier failed attempts stay recorded:
  `networkidle0` to `load` made it worse at 2 of 3 runs, and raising the
  ceiling to 90s moved the failure to a different wait.
- **Item 5 is built and calibrated.**
- The carried item changes shape: it is no longer "harden the probe's ready
  condition". It is **the duplicated unscoped `/api/contacts` fetch**, with
  the probe's fixed ceiling as the thing that makes it visible.
