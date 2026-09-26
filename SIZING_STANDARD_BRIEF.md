# The sizing standard round: build brief

Branch `sizing-standard`.

**PROVENANCE, AND IT IS THIS ROUND'S FIRST FINDING.** This round ran from
`18d977f` with no committed brief. The findings below were given in
conversation and are reconstructed here from the round's own artefacts, each
with the file that records it, plus John's rulings of 2026-09-26 verbatim. A
round with no committed brief has no referent for the stop rule "a constraint
the brief does not cover", which is what this document now supplies and what
the method rule promoted with it exists to prevent.

---

## The findings

**S1, THE FIELD SIZING STANDARD. Set by John 2026-09-26, permanent.**

> every numeric input declares its maximum format (a format string), held in
> ONE registry, not per-site literals. An input's width derives from its format
> string measured in the input's own computed font, plus fixed padding.

The five formats, John's own strings:

```
money-large   xxx,xxx.xx        money-small   x,xxx.xx
percent       xx.x              months        XXX            count   XX
```

Calibrate by oversizing one field and undersizing another. Band 100% to 135%.
Recorded at `DESIGN_PRINCIPLES.md`, "THE FIELD SIZING STANDARD"; registry at
`src/lib/field-formats.js`.

**S2, ONE TOKEN PER FIELD-LABEL ROLE.** The field-label role collapses to one
token across the commercial panels. Source: `18d977f`, and the census that
opened the round found 18 distinct fonts, the Units card's 9px against
`.form-group`'s 10.5px being what made it read as shrunken type beside the
Installation panel.

**N1, THE UNITS AND INSTALLATION ROWS PAIR OFF.** John, 2026-09-26, as restated
at the ruling:

> the Units card rows top-align with the Installation per-unit rows in the same
> dress.

The probe's own record of the original adds the second half: "each subsequent
row level". Recorded at `scripts/sizing/probe-live.mjs`.

**N2, WORDING NOT RECOVERABLE.** N2 is named once in the estate, in
`scripts/sizing/probe-live.mjs`'s header, "S2, N1/N2, N5, N6, N7", and its text
is in no file. It sits beside N1 in that header, so it is about the same
surface, and the round's instrument carries no assertion bearing its number.
**Recorded as unrecovered rather than reconstructed, and it needs John's
wording before anything is built for it.** Nothing in this round's close claims
N2.

**N3, THE INSTALLATION FORMATS.** Cost (USD) inputs are `money-large` and
Margin is `percent`. Asserted at
`frontend-react/src/__tests__/field-formats.test.ts`, "S1h: N3".

**N4** is not in the round's finding list and is not claimed here.

**N5, A TWO-STATE SELECTOR IS NOT AN ON/OFF SWITCH.** John, 2026-09-26:

> a TWO-STATE SELECTOR names both states outside the track; an ON/OFF SWITCH
> names the one it is in, inside.

Superseded the same day by John's later ruling, recorded in `18d977f`: the
flanked variant's own track and knob geometry is removed entirely, so both
controls take `.deal-toggle`'s untouched and are EQUAL by measurement rather
than by matching numbers.

**N6, INVOICING ABOVE THE MONEY.** The invoicing radios render above the money
and read horizontally. Inverts M7, whose reasoning survives at the site because
it was about the hard part rather than the direction. Recorded at
`frontend-react/src/deal/section5.tsx` and `polish.test.tsx`.

**N7, TWO TABLES SHARING A ROW START THEIR FIGURES LEVEL.** John, 2026-09-26,
as restated at the ruling:

> under Hybrid, and wherever two tables share a row, the FIRST FIGURE ROWS
> top-align.

**N8, ONE FONT PER ROLE ON THE COMMERCIAL PANELS.** Every font in use on the
commercial panels, with counts, before and after. S2's evidence. Recorded at
`scripts/sizing/census.mjs`.

---

## Mid-round corrections, John 2026-09-26

**N1 AND N7 ARE NOT DEMOTED.** They are John's findings and this round builds
them. A phase had recorded both as "MEASURED, NOT BUILT" prints rather than
assertions; that is reversed. If either is genuinely blocked by a constraint
the brief does not cover, STOP and photograph the options per the standing
rule. Do not ship a demotion.

**THE EQUALITY RE-CHECK AT MERGE.** The round branched from a base that was not
yet on origin, `main` at `5ed1941` against `origin/main` at `20056eb`. Before
the merge step, re-run the `ls-remote` equality check and confirm origin is at
`5ed1941`. If not, STOP and report.

---

## THE RULING: R-SZ2, OPTION A. John, 2026-09-26

> the Units card and the Installation per-unit table merge into ONE per-product
> grid: one row per product, units half and installation half sharing the row
> track, heads in one shared head track so both bodies start level by
> construction. The responsibility and lump-sum block relocates above the
> merged columns. Same construction levels N7: the Hybrid schedule label
> becomes a grid item in section5's shared head track (N6's box preserved: the
> testid keeps a box), and the OPEX 12px head-stack difference dies in the same
> shared-track rule.

> The 28 touched assertions across seven files re-point with reasoning at each
> site; the W13 hybrid grid numbers that stop applying are retired as
> superseded by this ruling, quoted not deleted. No guard weakened: the
> identity ratchet, class rules, wiring, panel conformance and the probe
> re-point to the merged structure's own properties.

**Recorded finding, ruled to be carried:** N7's OPEX half was a latent 12px
defect invisible to the old selector, present at all widths.

---

## The close

N1 row-pairs green at all three widths. N7 both halves green. The S1 sizing
guard and S2 tokens still green across the merged grid. Calibration in both
directions, including one injection that misaligns a row and one that regrows a
phantom class. Live proof at 1920, 1440 and 1240 across the mode and structure
combinations, with screenshots opened and read. Close-out. `CURRENT_STATE`.
The `ls-remote` equality re-check at merge time, expecting `5ed1941`. Branch
gate `--round-close`, merge `--no-ff`, merged-tree gate, then "ready for John's
push".

**Any red: STOP.** Reports per M6.
