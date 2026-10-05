# TP_INPUTS: STOP, one thing the approved pictures do not settle

## 1. Not done yet

The gate, the merge, the merged gate and the ls-remote re-check (E5) are waiting on the one ruling
in section 3. Nothing is pushed.

## 2. Built and evidenced (branch `tp-inputs`, from `e800b2d`)

| commit | what |
|---|---|
| `63de30e` | the brief, verbatim, and your three PNGs, byte for byte (sha256 in the brief) |
| `2b5e9c0` | the Inputs card, I1 to I6 |

**Matches the pictures, measured:**

- **I1 headings:** DEAL TERMS and TAX, each with a rule to its right.
- **I1 layout:** both rows packed from the left, 56px between the deal-term groups and 28px
  between the tax controls (both read off the pictures).
- **I2 sizes:** units inputs 72px; escalator and start year 110px; GST and every WHT input 56px,
  under their labels.
- **I4:** the note line, about 19px under the tax row.
- **I5:** "WHT on SaaS %" and "SaaS line".
- **I6:** the start-year select keeps its dimmed border when disabled.

| exit point | evidence |
|---|---|
| E1 no figure moves | term-pricing goldens 78 / 78; `npm run goldens` `PASS: 9 checks, 4734 figures exact.`; no file under `src/` or `docs/` changed |
| E2 overlap sweep | `probe-overlap.mjs`, 1240 to 1920 step 40, 16 states plus the OPEX card: **3096 / 3096**. That is zero overlaps, plus at every width: I1 each row one line, I2 widths, I3 height unchanged when Split WHT toggles (and the tax row still one line), I4 note text |
| calibration | `i1-wrap` fired I1 in 288 states. `i3-height` fired **I3 only**: a field pushed down makes the row taller without wrapping, and a bottom-aligned row then reads as one line. The two checks are both needed |
| E3 from the click | `probe-screen.mjs --tp2`: **24 / 24**. Split WHT off puts the single field exactly where the hardware field was (same left, same top, same row top); on again, both fields return to their positions; T25 still reads, with "SaaS line" |
| E4 screenshots | `prototypes/term-pricing-inputs/built/built-<width>-split-<off/on>.png` at 1240, 1440, 1600 and 1920, beside the approved files. The card is 385px tall in both split states at every width |

**Faults found on the way, all mine and all caught before a claim was made:**

- **Input width.** A bare `.tp-pct2` lost to the later `.tp-num` on source order, so the inputs
  took the browser's 183px and the split tax row wrapped. The sweep's I2 and I3 caught it; it is
  fixed with a compound selector.
- **The white "on" border in my captures (and in TERM_PRICING_2's) was `:hover`.** The probe's
  pointer was still resting on the switch it had just clicked. Computed styles confirm the resting
  switch is green.

## 3. THE STOP: button size against I1 at 1240

**Your picture's term and payment buttons are bigger than the live ones:**

- "12" is 42px wide in the picture and 34px built.
- "OPEX monthly" is 116px wide in the picture and 106px built.

The picture's card is also wider than the real one: about 1,060px at "1240", where the real card
at 1240 is 911px (849px inside its padding).

**Measured at 1240:**

| | deal-terms row needs | available | result |
|---|---|---|---|
| as built | 835px | 849px | one row |
| at the picture's button sizes | 919px | 849px | **Payment structure wraps to a second line**, against I1 |

So at 1240 the picture can be matched for button size or for I1's one row, not both. I built the
existing button size, which keeps I1, and did not change the estate's segment buttons on my own.

**Ruling needed, one of:**

- **(a)** keep the current button size (built, recommended);
- **(b)** enlarge the buttons to the picture's size and accept two rows at the narrowest widths;
- **(c)** enlarge them, with a smaller gap between the deal-term groups, measured to stay one row
  at 1240.

## 4. Recorded, not acted on

- **The engine's refusal still says "WHT on software as a service must be..."**, seen only if a
  SaaS rate of 100 or more is typed. This round is cosmetic tier with no engine change, so it is
  left alone. The spec's section 8.1 likewise keeps "software as a service".
