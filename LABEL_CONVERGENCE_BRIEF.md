ROUND: LABEL_CONVERGENCE
Base: origin/main expected 6550b09. Branch: label-convergence.
First commit: this brief verbatim as LABEL_CONVERGENCE_BRIEF.md, before any build commit.
Governing: CLAUDE.md, tms-round-method skill, DESIGN_PRINCIPLES.md, PRICING_LOGIC.md.
Standing: build ONLY the named items; no layout change without an approved mockup (STOP and photograph);
never git push; gate with NordVPN OFF; report to REPORT_FOR_CHAT.md + OneDrive TMS Test log + pbcopy.

SCOPE
L1  R-VL4: every version label prints V<major>.<minor> (V1.0, never V1) through ONE isomorphic composer
    in src/lib (V20 de-dup). Every site routes through it: version card, history, Working Version field,
    Approved Version field, approval view, refusal and error text, snapshots/print.
    Working Version grammar (John's ruling), converged: "V1.1", "V1.1 - Under Edit",
    "V1.0 - Under Edit - Not saved".
L2  R-VL1..3 VERIFY ONLY (audited conforming 2026-09-25): explicit Save version bumps the minor;
    approving relabels the draft in place to <major>.0; later saves go x.1, x.2; the next approval goes to (x+1).0.
    Measure by driving the flow. Any nonconformance: STOP.
L3  R-REV2 VERIFY ONLY: lumpSumCost is in the fundamental-input clear list (absolute overrides clear,
    margin overrides persist). Absent: STOP.
L4  Approved/Issued decision lines written into the decisions doc of record:
    APPROVED = the version through the Approve pricing gate (DB status word stays `issued`);
    ISSUED = sent to the customer, a future LOGGED event (who, when, which rendered document) tied to C4
    print/export, NOT a second approval workflow.
    User-facing copy that says issue/issued for the approval event becomes approve/approved.
    Routes, DB values and internal names are unchanged.
H1  Moved-since-version warning: the approval view shows one line in the --attention token when the deal's
    current state differs from the version under approval (pricingChanged semantics), naming the version.
    No line when equal. Placement in the existing header area; if it needs a structural change, STOP.
H2  Server refuses approval of a version whose frozen rates are empty: 409 with an explanatory message;
    the client shows the refusal (onIssue already reads r.ok). Forward-only; immutable versions untouched.
H3  The approval view's cost-basis block states the effective dates of the base_cost_batches FROZEN
    into the version, never today's date or the current catalog.

PHASE 0 (investigate, no code; report and STOP for sign-off)
0.1 git ls-remote origin main == 6550b09; else STOP. List remote branches.
0.2 Census every version-label composition site (the count was seven at 2026-09-25; the Working Version
    field was added since). Source check with comments stripped, calibrated against a known-good pattern.
0.3 Census user-facing issue/issued strings; classify each as approval event vs other.
0.4 Drive L2 and L3 and report measured results.
0.5 Count issued versions with empty frozen rates. State whether the current system can still produce
    that state. If unreachable, H2 lands as a server invariant with a declared synthetic fixture and the
    reason stated.
0.6 Confirm pricingChanged and frozen batch dates are reachable from the approval route.

TIERING
L1/L4 copy: cosmetic tier (affected suites + screenshots of every changed site at 1240 and 1920).
Composer guard: a source check that no site outside the composer builds a version label; zero allowed;
calibrated both directions.
H1/H2/H3: behaviour tier; each proved from the click, both directions (fires on the injected state,
silent on healthy). H2 gets a real non-owner JWT check that the refusal holds for every identity.

EXIT GATE (answer point by point with evidence)
E1 Golden deals suite green and UNCHANGED; no pricing figure moved.
E2 Zero label sites outside the composer; one format on screen for one version.
E3 L2 and L3 measured conforming.
E4 H1-H3 proved from the click, calibrated both ways.
E5 Decisions doc carries L4; census of issue/issued strings reconciled by count.
E6 Full gate green on the committed tree, NordVPN off; revert rehearsed byte-identical;
   CURRENT_STATE.md regenerated with its staleness check result.
E7 ls-remote re-check at merge; stop at "ready for John's push" with the expected SHA.
