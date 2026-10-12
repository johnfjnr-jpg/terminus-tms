ROUND: TP_BANDS (term pricing: configurable volume discount bands, per product)
Follow the tms-round-method skill. Never run git push. Gates run with NordVPN quit.

PRECONDITIONS
- git ls-remote origin main shows 4058c9e (TP_TABS). If not, STOP: John has not pushed.
- John has placed prototypes/term-pricing-bands/term-pricing-bands.html (approved mockup,
  John 2026-10-12, two states: SafeSight with 6 bands and one floor breach; HEMIR with an
  overlap error). Commit it with this brief, verbatim, as TP_BANDS_BRIEF.md, as the first commit.
- Branch tp-bands off origin/main.

OUT OF SCOPE: the ladder formula and anchor margins (John: on hold). The mockup's margin figures
are illustrated at a 64.8% anchor; the built screen uses the live settings.

RULINGS (John, 2026-10-12)
B-1  PER-PRODUCT BANDS. Each product (SafeSight, Air Quality, HEMIR) has its own bands. Seed every
     product with today's bands: starts 1, 10, 50, 200; discounts 0, 5, 10, 15%. With the seed,
     every v1.7 golden and G1 to G5 are unchanged; that is the proof nothing moved.
B-2  2 TO 6 BANDS per product.
B-3  A BAND IS (start, discount %). Band 1 starts at 1 (fixed). Each later start is a whole number
     above the previous start. "To" is derived (next start - 1); the last band is "and above".
     Discount 0 to below 100, one decimal place.
B-4  DISCOUNTS NEVER FALL as volume rises (equal is allowed).
B-5  BANDED ONLY: each band's discount applies to the units inside it (unchanged rule).
B-6  VALIDATION AS TYPED, in the editor, naming the fix (mockup 4b: "Band 4 must start above 5,
     where band 3 starts. Bands cannot overlap. Fix this to save."). Save is disabled while any
     rule is broken. The server enforces the same rules and refuses an invalid set with the same
     wording; the client check is a convenience, the server is the authority.
B-7  MARGIN CHECK GRID beside the editor: worst-case margin on price per band (every unit at that
     band's fee) for every term, from the ENGINE (the screen does no money arithmetic). Cells below
     the margin floor are flagged. A breach WARNS and does not block saving (mockup 4a wording).
     The grid shows "Fix the band rules to see the margin check" while the set is invalid.
     Below the grid: fee per unit per month for each band at 36 / 60 / 84 / 120 months.
B-8  ADMIN ONLY to edit (system_roles, as every term_pricing_settings write). Everyone can read.
     The editor lives in the Settings card at the bottom of the Pricing tab, with product tabs.
B-9  Pricing tab, Payment terms and Quote read the configured bands: the breakdown table shows
     each product's own bands; a product with 6 bands shows 6 rows where units reach them.

PHASE 0 (investigate, then STOP with a report)
1. Where bands live today (engine constants, term_pricing_settings, spec) and every reader.
2. Propose the storage: shape (per product, ordered list of {start, discountPct}), the migration
   file with the seed (B-1) and any constraint. WRITE the migration file, DO NOT APPLY IT.
   Claude reviews it; John applies it in the SQL editor.
3. Propose the engine API for B-6 validation and the B-7 grid.
4. Name every test, golden, probe and sweep that assumes four fixed bands.
5. Name any conflict with this brief, the mockup, the spec or CLAUDE.md.
STOP. Report. Wait for rulings and the migration review.

GOLDENS (spec v1.8; copy, never compute with the code under test; spec settings, anchor 90%)
BG-1 SafeSight bands 1/10/50/200/500/1000 at 0/5/10/15/20/30%; 1,000 units; 60 months, OPEX:
     band fees 2,613.33 / 2,482.67 / 2,352.00 / 2,221.33 / 2,090.67 / 1,829.33;
     units 9 / 40 / 150 / 300 / 500 / 1; monthly 2,189,190.10; Base TCV 131,351,406.00;
     margin 84.8%.
BG-2 HEMIR bands 1/2/5/10 at 0/5/10/15%; 2 units; 60 months: fees 19,866.67 (1 unit) and
     18,873.33 (1 unit); monthly 38,740.00; Base TCV 2,324,400.00; margin 88.8%.
BG-3 Grid, SafeSight 30% band (worst case): 12 months fee 6,066.67, margin 85.7%; 36: 2,955.56,
     85.7%; 60: 1,829.33, 81.8%; 120: 984.67, 72.9%.
BG-4 Refusals (server and editor): band 1 start not 1; a start not above the previous; 1 band;
     7 bands; a falling discount; a discount of 100 or more; a non-whole start.
BG-5 Seed equivalence: with the B-1 seed, every v1.7 golden unchanged.

AFTER RULINGS (normal round method)
migration applied by John -> spec v1.8 -> tests fail first -> engine -> settings route ->
view -> probes from the click (both mockup states; an admin edit and a non-admin read-only view;
a quote priced on configured bands) -> calibration injections each FIRED -> overlap sweep
1240..1920 step 40 including the band editor at 2 and 6 bands -> full gate -> merge --no-ff ->
merged gate -> ls-remote -> "ready for John's push".

RULINGS ON PHASE 0 (appended verbatim at the phase they launch, CLAUDE.md build discipline 7;
pasted by John 2026-10-12. The brief above stays verbatim.)

TP_BANDS: RULINGS ON PHASE 0 (Claude, under John's rulings 2026-10-12). Resume.

0.1 ADMIN PROBE: OPTION (b). The probe proves the editor up to the request it sends; the
    route's success and refusal paths are proven over HTTP by tests calling the route's own
    validation. No grant to john+test; no automated write to live settings. The close-out
    states that a real admin save was not driven from the click; John does it as a walk step.
0.2 WARNING WORDING (the mockup's sentence was Claude's error): "1 term breaches the 25% floor.
    [band and term detail as drawn]. You can still save. A quote is flagged for approval only
    when its whole-deal margin falls below the floor."
0.3 B-7 GOVERNS: the fee table shows every band.
0.4 DO NOT BUILD the "How bands differ by product" card. While the set is invalid, the fee table
    shows the same "Fix the band rules" state as the grid.
0.5 ACCEPTED: the editor keeps its own Save bands / Discard, saving the shown product's bands
    only; the Settings card's four discount boxes retire; Save settings keeps every other key.
0.6 ACCEPTED: rulings cited as TB-1 to TB-9 in spec, code and reports; the brief stays verbatim.
0.7 ACCEPTED: non-admins see the editor read-only with "Only an admin can change these."; the
    eyebrow reads "Admin edits" for an admin, none otherwise.
Section 5 positions ACCEPTED: "?" in To while a start is invalid; one line per problem, in band
    order. Storage, new key and later removal migration ACCEPTED as proposed. Engine API
    (validateBands, bandMarginGrid) ACCEPTED.

MIGRATION: reviewed by Claude; applied by John in the SQL editor inside begin/commit, ledger row
recorded. Verify by reading the row back before building on it.

Continue: spec v1.8 -> tests fail first -> engine -> route -> view -> probes -> calibration ->
sweep -> full gate -> merge -> merged gate -> ls-remote -> "ready for John's push".
At the close, write (do not apply) the migration removing VOLUME_BANDS, for after John's push.
