# Slider direction fix

Branch `slider-direction`, off `main` at `244dabc491f5c5da20774333c5be20ac2f212dc9`,
confirmed equal to `origin/main` by `git ls-remote`.

Rule 18 and build discipline 19 govern: this round ends "ready for John's push".

## The defect and the rule, John 2026-09-25, verbatim

> **THE DEFECT:** with OPEX active (label green), the slider knob renders on the
> RIGHT, toward CAPEX. The knob and the highlight disagree.
>
> **THE RULE:** the knob sits on the side of the ACTIVE mode: OPEX active = knob
> left (toward the OPEX label), CAPEX active = knob right. Knob position
> asserted as COMPUTED geometry relative to the two labels in BOTH states (the
> knob's centre nearer the active label than the inactive one), not from a
> class, per the cascade lesson. The green active-label highlight and aria state
> stay as built and are asserted unchanged in both states.

## The cause

`.deal-toggle` is an ON/OFF switch and moves its knob RIGHT when on. The OPEX
slider reused it and set `is-on` for OPEX, so the knob travelled toward CAPEX
while the OPEX label went green. It is a two-state SELECTOR, not a switch, so
the direction inverts.

## AND THE RULE AS WRITTEN IS SATISFIED BY A KNOB THAT BARELY MOVES

Measured before the fix: the knob's centre moved **377 to 389**, twelve pixels,
while the labels sat at **333 and 443**. With the direction corrected that still
passes "nearer the active label" - **by two pixels** in one state - because the
labels are not symmetric about the track: OPEX is four characters and CAPEX
five.

**Proved rather than argued**: deleting the OPEX override so the knob falls back
to the inherited 12px travel leaves the brief's assertion PASSING. So the probe
also asserts the knob is **at the END of its track** in each state, which is
what "sits on the side" means, and the travel grew to 22px in a 40px track.
