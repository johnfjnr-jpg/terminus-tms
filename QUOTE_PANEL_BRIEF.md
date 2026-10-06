ROUND: QUOTE_PANEL (Term Pricing: quote and payment schedule in one panel; profit by product)
Base: origin/main expected <LABEL_CONTRAST pushed SHA> (ls-remote; mismatch, STOP). Branch quote-panel.
First commit: this brief verbatim as QUOTE_PANEL_BRIEF.md, plus ~/Downloads/quote-panel-opex.png and
quote-panel-capex.png copied byte for byte into prototypes/term-pricing-quote/. Missing: STOP and ask;
never recreate them. Mockup gate: build ONLY the approved pictures; anything they do not settle: STOP
and photograph.

RULINGS (John, 2026-10-05)
Q1 ONE PANEL, in this order: (a) the summary tiles, unchanged; (b) "Pricing by product and band":
   columns Product and band | Units | List fee / unit (USD) | Volume discount | Fee / unit (USD) |
   Monthly (USD); a subtotal row per product, band rows indented beneath it, a "Total per month" row.
   Under CAPEX the heading reads "Pricing basis (OPEX fees, year 1)". With an escalator, a note under
   it: "Fees rise <rate>% a year from year <S>." (CAPEX adds the mockup's sentence on how CAPEX pays.)
   (c) "Profit by product" (Q2); (d) "Payment schedule", rows and notes exactly as today, including
   split-WHT hardware and SaaS lines. The separate Product lines table, Profit table and Payment
   schedule card are removed; their content lives only here.
Q2 PROFIT BY PRODUCT: columns Product | Units | TCV (net) | Hardware and hosting cost | Gross profit |
   Margin on price; a row per product with units > 0, then Total. Product TCV includes the escalator
   and is the same under OPEX and CAPEX. When WHT borne > 0, two further rows: "WHT borne by Terminus
   (whole deal)" (negative) and "Gross profit after WHT" with the margin after WHT. WHT is never
   allocated to products (it is withheld per invoice).
Q3 WHT RULES CONFIRMED (no change): single rate applies to every invoice, CAPEX and OPEX. Split:
   CAPEX upfront invoice = hardware rate, monthly service invoices = SaaS rate; OPEX invoices keep
   the hardware and SaaS lines as built (John: option A).

SPEC FIRST (v1.4, own commit before code): section 4.3 gains per-product totals
(product TCV = Σ its bands' invoiced fees over the term, escalated per section 7; product cost and
gross profit as for the deal; Σ products = deal, exactly). Section 11 gains (COPY; computed outside
the engine):
  T29 120 SafeSight + 40 AQ + 2 HEMIR, 60 months, OPEX, no escalator: SafeSight TCV 17,389,126.20,
      cost 2,400,000.00, profit 14,989,126.20, 86.2%; AQ 2,245,484.40, 320,000.00, 1,925,484.40,
      85.7%; HEMIR 2,384,000.40, 260,000.00, 2,124,000.40, 89.1%; deal 22,018,611.00, 2,980,000.00,
      19,038,611.00, 86.5%.
  T30 same units, 60 months, CAPEX, escalator 3% from year 2, WHT 10% borne: SafeSight TCV
      18,464,248.32, 87.0%; AQ 2,384,313.00, 86.6%; HEMIR 2,531,396.40, 89.7%; deal TCV
      23,379,957.72, gross profit 20,399,957.72, 87.3%; upfront 1,550,000.04; service fees by year
      342,647.69 / 352,927.12 / 363,514.94 / 374,420.39 / 385,653.00; WHT borne 2,337,995.72;
      gross profit after WHT 18,061,962.00, 77.3%.
Engine change limited to exposing per-product totals; no existing figure may move.

EXIT
E1 Term-pricing goldens including T29 and T30 exact; G1 to G5 unchanged; calibration injections for
   the new claims (per-product sum ties to the deal; WHT not allocated to products).
E2 From the click: the OPEX and CAPEX states of the approved pictures reproduce on screen; per-product
   rows sum to the deal tiles; the band table totals equal the schedule's year-1 net fee.
E3 Overlap sweep 1240 to 1920 step 40, all states (OPEX, CAPEX, escalator, split WHT, WHT borne and
   gross-up): zero overlaps. Screenshots of the panel at 1240 and 1920, OPEX and CAPEX, beside the
   approved PNGs.
E4 Full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate; ls-remote re-check; stop at
   "ready for John's push". Never git push.

---

FIRST-COMMIT AMENDMENT (John, 2026-10-06):
First commit: this brief verbatim as QUOTE_PANEL_BRIEF.md, plus John's two approved pictures from
~/Downloads, copied byte for byte into prototypes/term-pricing-quote/ and renamed there:
  "One panel OPEX@1x.png" -> quote-panel-opex.png
  "One panel CAPEX, 3% escalator, WHT borne@1x.png" -> quote-panel-capex.png
If the second name differs, match by prefix: there must be EXACTLY two files in ~/Downloads whose names
start "One panel", one containing "OPEX" and one containing "CAPEX". Any other count or ambiguity:
STOP and ask; never recreate them. Mockup gate: build ONLY the approved pictures; anything they do
not settle: STOP and photograph.

BASE (John, 2026-10-06): b7310cb pushed by John. Re-run the base check: ls-remote origin/main must
equal b7310cb; any mismatch, STOP. If it matches, proceed with QUOTE_PANEL from the first commit,
using the two "One panel" files as resolved (the "%" missing from the CAPEX name is accepted).

RESOLVED (2026-10-06): ls-remote origin/main = b7310cb. Copied:
  "One panel OPEX@1x.png" -> quote-panel-opex.png
     sha256 fd5c01be0819c9fbfed1580b075d7ca6a123931a9e86e677e978cd72da6cf86b
  "One panel CAPEX, 3 escalator, WHT borne@1x.png" -> quote-panel-capex.png
     sha256 f7de5c9183ff10a7f8a27f43d9d2f0587d2fbb5745f283cea0da6c86c8c3027b

---

RULINGS (John, 2026-10-06):
D1 Keep the CAPEX "Upfront" tile (the picture omitted it in error).
D2 Keep "WHT borne" as the schedule column head when WHT is borne.
D3 CAPEX schedule note = today's sentence plus the picture's: "...the same TCV as OPEX; the upfront
   carries any rounding residue. WHT is withheld per invoice, so it is shown for the whole deal, not
   per product."
D4 Title hint with Gross up on: ", WHT <rate>% grossed up" (split: ", split WHT <hw>% hardware /
   <saas>% SaaS, grossed up" or "borne" as applies). Pin each wording in the probe.
OVERFLOW (section 4): fix in this round. First tighten the schedule's column padding (and only
then the figure font) until the table fits its content box at every width in the sweep, all
states; "Terminus receives" must stay visible without scrolling. If it cannot fit, STOP and
photograph before choosing a scroll container. --qp must be 26 / 26 with the legibility check
unrelaxed.
Then the EXIT list: full gate (NordVPN quit, resolver clean); merge --no-ff; merged gate;
ls-remote re-check; stop at "ready for John's push". Never git push.
