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

---

RULINGS AFTER PHASE 2 (John, 2026-10-01), appended verbatim at the phase they launch:

Phase 1 accepted. Phase 2 questions ruled (John, 2026-10-01). Mockup approval to follow
separately after John reviews the screens; do not start Phase 3.

Q1 CAPEX + escalator: the monthly service fee ESCALATES like the OPEX fee; TCV stays identical to
   the OPEX TCV. SPEC FIRST (v1.2.2, own commit, header updated): section 6 CAPEX with an escalator:
     s = (TCV − hardware_upfront) / (12 × Σ_{k=1..years} (1 + escalator)^(k−1))
     service_year(k) = round_half_up( s × (1 + escalator)^(k−1), 2 )
     upfront = TCV − Σ_k (12 × service_year(k))        (carries any rounding residue)
   Add to section 11:
     T22 T6 as capex with escalator 3%: TCV 18,464,248.32; upfront 1,200,000.00; service fees by
         year 270,983.34 / 279,112.84 / 287,486.23 / 296,110.81 / 304,994.14; upfront + Σ = TCV.
   Then the engine change and T22 pinned as a golden.
Q2 Accept; label the ladder column "vs 36 months, this deal".
Q3 Accept GST on the grossed-up invoice (keep it as the pinned POSITION test).
Q4 Accept; ALSO show "Margin on price after WHT" whenever WHT is borne (> 0).
Q5 Settings card collapsed by default; admin expands it. The page opens on the ladder and quote.

Regenerate the mockup with Q1, Q2, Q4 and Q5, re-measure at 1240 and 1920, and STOP again with the
six screenshots for John.

---

RULINGS AFTER THE PHASE 2 RE-REVIEW (John, 2026-10-01), appended verbatim:

Rulings (John, 2026-10-01): Settings stays expandable read-only in the salesperson view (no change).
Under CAPEX, relabel the product-lines table "Pricing basis (OPEX fees)". Regenerate the mockup,
re-measure at 1240 and 1920, replace the affected screenshots, and STOP. Phase 3 waits for John's
approval of the mockup.

---

MOCKUP APPROVAL (John, 2026-10-01), appended verbatim at the phase it launches (Phase 3):

MOCKUP APPROVED (John, 2026-10-01) with four changes, built into Phase 3:
A1 Under CAPEX the term ladder shows "Upfront" and "Monthly service fee (year 1)" columns from the
   CAPEX quote at each term, replacing the OPEX monthly fee column; under OPEX unchanged. The
   selected row's figures must equal the Quote card's (assert it). "vs 36 months, this deal"
   compares the service fee under CAPEX.
A2 Mockup-only elements are NOT built: the MOCKUP banner, the States card, the Admin/Salesperson
   toggle, the "Figures generated by" footer. The floor flag and error states are real behaviour;
   edit rights follow the user's system_roles row.
A3 Copy: "An 18-month term is not offered..." (article chosen by the number, not hard-coded).
A4 WHT options read "0%", "10% gross-up", "10% borne".
Update the mockup with A1, A3 and A4 so prototypes/ matches what is built, then proceed with
Phase 3 as briefed (R-TP6 migrations listed with exact apply steps for John). Screenshots must show
the ladder, quote and schedule under both OPEX and CAPEX at 1240 and 1920.

---

RULINGS AFTER THE PHASE 3 STOP (John, 2026-10-02), appended verbatim:

Rulings (John, 2026-10-02):
T14 on screen, option (a): SafeSight 120 + AQ 30 at 60 months, catalog costs. SPEC FIRST: add to
docs/pricing-spec.md section 11 as T23 (header v1.2.3, own commit) with these figures, computed
outside the engine:
  AQ band fees 973.33 (1 to 9) and 924.67 (10 to 49); AQ line 1,690,682.40;
  deal TCV 19,079,808.60; cost 2,640,000.00; margin on price 86.2%.
Pin T23 as an engine golden too, then prove it on screen.
E3 admin path, option (a): a temporary system_roles admin row for john+test2, inserted for the
proof only. At the end of E3, DELETE it and prove the removal (select returns 0 rows for that
user). State the insert, the removal and its proof in the report. No other system_roles change.
Then continue: verify tables, E2, E3, screenshots (OPEX and CAPEX, 1240 and 1920), close.
