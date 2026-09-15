# Test Bed layout moves: close-out

**R1 and R2 CLOSED.** Gate **24 of 24, exit 0** on `78a1195`. React
**1009/1009**, conformance and class rules **16/16**, live **5 of 5** at 1440.
**R3 REVERTED and carried.**

**NO SERVER RESTART**: `src/` is **0 files**. The change is
`frontend-react/src/testbed/TestBedPanel.tsx`, one scoped CSS rule, and the
bundle.

**Nothing pushed.**

---

## Reconciliation by counting

| commit | |
|---|---|
| `4b36cb1` | the brief |
| `78a1195` | **R1 and R2**, built and proven |
| this | the close |

**R3 has no commit, correctly** - it was built, found blocked, and reverted.

## R1 - Summary and Notes to the header

Both already existed at the bottom of the screen and both were already
editable, so this is layout and nothing else. Test Bed's notes/audit split was
measured clean last round and is untouched.

**`.lead-card-body` is the LEAD's layout CLASS and this is its third consumer.
THE CLASS IS NOT MODIFIED** - which is precisely why the blast radius is nil:
adding a consumer cannot move leads or contacts. The two-column override is
scoped to `.tb-top-row`.

**Follow-up is NOT here**, and the premise that it would "come with the shared
panel" rested on the panel being a component. It is a class; nothing arrives by
adopting one. Test Bed has no follow-up field in its payload, its descriptors
or its route, and **the route's allowlist refuses the key with a 400** -
measured. A new write path, carried.

### A DUPLICATE WAS CAUGHT MID-BUILD

Moving the Summary card left the original in place, and the same for the bare
`{notes}`. **A move is TWO claims - it appears in its new place AND it is gone
from its old one** - and this estate has shipped the duplicate that skipping
the second one produces. **Now asserted**: exactly one Summary and one Notes
render.

## R2 - Key Dates beside Site Details

A sibling in the same card row. **The session's own heads-up - that a fourth
card might WRAP at 1440 - did not materialise**: measured tops **[965, 965]**.
No scoped column rule was needed and the shared `.ref-cards` rule is untouched.
**Recorded because the warning was right to give and wrong in outcome**, which
is what measuring settles.

---

## R3 REVERTED, AND THE REASON IS A PRE-EXISTING BUG

```jsx
{active === 'reference'   ? <div>{reference}</div>   : null}
{active === 'commercials' ? <div>{commercials}</div> : null}
```

**`StageTabs` UNMOUNTS each panel when its tab is inactive.** `TestBedPanel`
owns the `useFieldRows` draft store, so it ceases to exist the moment you leave
Reference. A portal cannot render from an unmounted component - which is why R3
could not land - but that is the smaller half.

> ## THE FOUND BUG, recorded regardless of R3's fate
>
> **ANY UNSAVED EDIT ON A TEST BED TAB IS DISCARDED WHEN THE TAB CHANGES.**
> This is true today, on `origin/main`, before this round. It is not caused by
> anything here, and it is not visible as an error - the draft simply goes.
>
> The design risk carried into this round was that moving cards *would create*
> a second draft store. **Measured, the tabs already discard the one store
> there is.** The concern was right and its shape was different.

**Three fixes with different blast radii, and none was guessed:**

1. **Lift `useFieldRows` to `TestBedHost`** and pass the controller down. One
   store, survives switches, and it **fixes the draft-loss**. A
   state-ownership change - **no longer layout**.
2. **Hide inactive panels** rather than unmount. Smallest portal-enabler, but
   it changes shared `StageTabs`, so the radius is **every Test Bed tab**, and
   it does not fix draft-loss elsewhere.
3. **Drop R3** and take it with the state question.

---

## Carried

1. **R3**, per John's ruling on the fork above.
2. **The draft-loss-on-tab-switch bug** - real, pre-existing, and worth its own
   decision whether or not R3 proceeds.
3. **R1's Follow-up** - new field pair, new write path, **server allowlist
   change**. Same class as the notes/audit split and belongs in that round.
4. **The leads/contacts notes/audit split** - server write-path plus a display
   renderer, Architecture 12. **Reconfirm the 20-entry ruling at that round's
   open**, because the shape changed after it was given.
5. `StageActions` outside the conformance gate · the two unstyled buttons ·
   **(d)** unscoped · ENFORCEMENT GAPS carrieds · navigation-state survival ·
   item 5's teardown population dependency · the Commercials tab not switching
   under a probe.

**This close-out is markdown with no gate reader and rides the green gate at
`78a1195` under build-discipline 48(a).**
