ROUND: TERM_PRICING (standalone quote calculator; ideas prototype feeding Plexus; demo-critical)
Base: origin/main expected a84573f (ls-remote; mismatch, STOP). Branch term-pricing.
First commit: this brief verbatim as TERM_PRICING_BRIEF.md. docs/pricing-spec.md (v1.2, sha256
479e7b81bdf863cea238e744d248b9133e8c2bce09e8b6d5eae1f4d339ea81e0) and CLAUDE.md Architecture rule 14
are already on main; verify both are present and unchanged. Missing or different: STOP.

RULINGS (John, 2026-10-01)
R-TP1 ISOLATION: a pure module (no UI, DB or network inside the calculation). It imports nothing from
      the deal-sheet PRICING code, and nothing there imports it: a source check, calibrated red by
      injecting one import each way. Exception: pure tax or rounding helpers, named in Phase 0.
      G1 to G5 exact and UNCHANGED.
R-TP2 MONEY: exact arithmetic (integer cents or a decimal library; Phase 0 names which). Rounding
      exactly as spec sections 4.2 and 5.
R-TP3 SETTINGS: spec section 3 parameters in the database, editable by ADMIN only (server-enforced;
      non-admin write refused 403, proved over HTTP). Product costs READ from the TMS catalog.
R-TP4 LABELS: "margin" means margin on price everywhere on this screen. Section 13 items NOT built.
R-TP5 Nothing on the deal sheet, opportunities or the Commercials tab changes.

PHASE 0 (short; STOP only if a premise fails)
0.1 Catalog: report HW_COST and HOSTING_MONTHLY for SafeSight, AQ and HEMIR as the catalog holds
    them today. If SafeSight is not 8,000.00 / 200.00, STOP: the reference tables assume it.
0.2 Money representation; settings table location; how admin is established server-side.
0.3 Any existing pure GST/WHT/gross-up helper that can be imported without touching pricing code.
0.4 Where the screen sits in navigation (propose; do not build).

PHASE 1: ENGINE AND TESTS (no screen)
Pin spec sections 10.1, 10.2, 10.3 (every cell) and section 11 T1 to T19 as golden term-pricing
cases, figures COPIED from the spec, never computed by the code under test. Plus the parameter-flow
tests in section 11's last line.

PHASE 2: MOCKUP, THEN STOP
Static mockup under prototypes/term-pricing/: units per product (SafeSight, AQ, HEMIR); term selector;
the TERM LADDER (every term side by side: monthly fee, saving or premium vs 36 months, TCV, margin);
the selected quote (monthly total, TCV net, GST, TCV incl. GST, margin, floor flag); payment
structure toggle OPEX / CAPEX with its schedule; escalator and tax inputs; admin settings area.
STOP for John's approval. Build no screen before it.

PHASE 3: SCREEN (after approval)
E1 G1 to G5 unchanged; all term-pricing goldens exact.
E2 From the click: T1, T6, T14, T15, T16 and one error case proved on screen, plus the ladder table.
E3 Admin setting change flows through (ANCHOR_MARGIN 80%); non-admin refused 403 over HTTP.
E4 Isolation guard green and calibrated; estate guards green; screenshots at 1240 and 1920.

PHASE 4: CASH FLOW (spec section 9; may follow the demo)
Monthly receipts vs costs, cumulative position, payback month; PO factoring on/off with its cost;
margin before and after finance cost. Reuse the deal sheet's factoring definitions, re-implemented
or imported as a pure helper per R-TP1.

CLOSE (after Phase 3, and again after Phase 4 if run separately)
Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check;
stop at "ready for John's push". Never git push.

---

RULINGS AFTER PHASE 0 (John, 2026-10-01), appended verbatim at the phase they launch (CLAUDE.md
build discipline 7):

TERM_PRICING Phase 0 accepted. RULINGS (John, 2026-10-01):

R-TP6 ADMIN (option A): build system_roles exactly as DESIGN_PRINCIPLES line 166 designs it, role
      checked to ('admin'), seeded with John's user id only. Writes to term_pricing_settings: the
      route answers 403 for non-admins AND RLS insert/update policies require the admin row.
      system_roles is select-only, own row only; no route writes it. Migrations applied by John by
      hand: list them in the report with exact apply steps. Blocks Phase 3 only.
R-TP7 SPEC FIRST (v1.2.1): before any engine code, commit these amendments to docs/pricing-spec.md,
      header "Specification v1.2.1", in its own commit:
      (a) Section 3: add TERMS (12, 24, 36, 48, 60, 72, 84, 96, 120); section 2 refers to it.
      (b) Section 3: ANCHOR_MARGIN[product] and SHORT_TERM_MARGIN[product], each default 90%.
          Section 4.1 uses the product's own values.
      (c) Section 8: tax amounts round half-up per invoice line; WHT applies to the fee before GST.
      (d) Section 11: add
          T20 T6, WHT 10%, gross-up ON: monthly invoice 322,020.86; WHT 32,202.09;
              Terminus receives 289,818.77 (= T6 monthly total).
          T21 T6, WHT 10%, gross-up OFF: monthly invoice 289,818.77; WHT 28,981.88 borne;
              Terminus receives 260,836.89.
      All existing figures in sections 10 and 11 are unchanged (every product still defaults to 90%).
Accepted as proposed: BigInt fractions; text casts; TERMS as a setting; empty R-TP1 exception list;
the isolation guard design; sidebar "Term Pricing" after Opportunities with the settings panel on
the same screen.

Proceed: spec commit, then Phase 1 (engine and goldens, including T20 and T21), then Phase 2 mockup
and STOP.
