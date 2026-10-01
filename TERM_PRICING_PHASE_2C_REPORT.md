# TERM_PRICING Phase 2 re-review report

**STOPPED. Phase 3 waits for John's approval of the mockup.** Nothing has been pushed.

## Rulings (John, 2026-10-01), appended verbatim to the brief

- **Settings stays expandable read-only in the salesperson view.** No change made. Re-measured:
  expanded in that view, 0 of 16 setting controls are enabled.
- **Under CAPEX, the product-lines table is labelled "Pricing basis (OPEX fees)".** Done in
  `build-mockup.mjs`. Under OPEX it still reads "Product lines (bands count per line)".

## Evidence (measured first, then the page captured)

| width | state | page overflow | overflowing blocks | figures in one row | table label |
|---|---|---|---|---|---|
| 1240 | default (OPEX) | none | 0 | yes | Product lines (bands count per line) |
| 1240 | CAPEX + 3% + WHT borne | none | 0 | yes | Pricing basis (OPEX fees) |
| 1240 | settings expanded, admin | none | 0 | yes | Pricing basis (OPEX fees) |
| 1920 | default (OPEX) | none | 0 | yes | Product lines (bands count per line) |
| 1920 | CAPEX + 3% + WHT borne | none | 0 | yes | Pricing basis (OPEX fees) |
| 1920 | settings expanded, admin | none | 0 | yes | Pricing basis (OPEX fees) |

## Screenshots

- The four affected images (both CAPEX states, at both widths) were replaced. They are named
  `p2c-*` after the run that made them.
- The two default captures from this run were **byte-identical** to the `p2b-*-default.png`
  already committed, so those are kept rather than replaced.
- I opened and read `p2c-1240-capex-esc-wht.png`.
- The set is in `prototypes/term-pricing/screens/`: `p2b-1240-default`, `p2b-1920-default`,
  `p2c-1240-capex-esc-wht`, `p2c-1920-capex-esc-wht`, `p2c-1240-settings-admin` and
  `p2c-1920-settings-admin`.
