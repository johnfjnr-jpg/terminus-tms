# Documentation amendments, 2026-08-22

Targeted edits to `DESIGN_PRINCIPLES.md` and `CLAUDE.md`, arising from the
Opportunity design review that produced `OPPORTUNITY_DESIGN.md` v1.1.

**These are insertions, not rewrites.** Nothing existing is deleted. The
superseded reasoning stays visible, per the documentation rule in
`CLAUDE.md`.

Apply each edit by matching the anchor text exactly. Verify each anchor
appears **once** before editing. `DESIGN_PRINCIPLES.md` contains two literal
NUL-adjacent quirks elsewhere in the repo tooling, so if `grep` returns
nothing for an anchor that is visibly present, re-run with `grep -a` before
concluding the anchor is absent. That is Verification rule 12.

**Do not regenerate `CURRENT_STATE.md` as part of this change.** It is
generated at round close, and this is documentation, not configuration.

**Do not edit `PROTOTYPE_SPECIFICATION.md`.** Amendment 4 below records a
contradiction involving it. The contradiction must be investigated against
the live database and route file before either document is changed. Editing
it now would resolve a finding by assertion.

---

## Amendment 1. `CLAUDE.md`, add `OPPORTUNITY_DESIGN.md` to the read list

**Why.** `OPPORTUNITY_DESIGN.md` is the authority on what Opportunities is
meant to become, and nothing currently tells a session to read it. A design
record nobody is instructed to open is a design record that gets
re-litigated, which is the exact failure it was written to prevent.

**Anchor**

    | `CURRENT_STATE.md` | What is configured and built right now. Generated |
    | The current round's build brief | This round's scope |

**Replace with**

    | `CURRENT_STATE.md` | What is configured and built right now. Generated |
    | `OPPORTUNITY_DESIGN.md` | What Opportunities is meant to become, and what is still undecided. Read for any Opportunity work |
    | The current round's build brief | This round's scope |

---

## Amendment 2. `DESIGN_PRINCIPLES.md` Section 5, superseding banner

**Why.** Section 5 describes a six-stage Opportunity model, Discovery
through Closing, that `OPPORTUNITY_DESIGN.md` replaces. Two of its
statements are confirmed and carried forward, one is superseded, and one
was flagged for confirmation and has now been confirmed. A reader arriving
at Section 5 today has no way to know any of that.

**Anchor**

    ## 5. Sales opportunity stage gates in detail

    **This section describes Opportunity, Discovery through Closing.**

**Insert between the heading and the paragraph**, so the block sits
immediately under `## 5.` and immediately above `**This section describes`:

    > **PARTIALLY SUPERSEDED, 2026-08-22, by `OPPORTUNITY_DESIGN.md` v1.1.**
    > The six-stage model below (Discovery, Qualified, Proposal, Evaluation,
    > Negotiation, Closing) is replaced by four working stages and two
    > terminal states. Read `OPPORTUNITY_DESIGN.md` before building any
    > Opportunity stage gate. The reasoning below is retained rather than
    > deleted because three of its statements still govern.
    >
    > **What still stands, unchanged:**
    >
    > - **Approvals have no required order between tracks.** All required
    >   tracks must be satisfied, in parallel, whoever is ready first. An
    >   earlier draft of `OPPORTUNITY_DESIGN.md` proposed an ordered
    >   sequence at Negotiating and that proposal has been withdrawn.
    >   Ordering is not expressible in `stage_gate_rules`, and more
    >   importantly it was a decision taken here and should not have been
    >   reversed silently.
    > - **Every new or revised commercial document requires approval before
    >   being sent**, as a document-level gate rather than an
    >   Opportunity-stage gate. This is a standing control and it is at risk:
    >   the four-stage compression turns Evaluation and Negotiation into one
    >   stage whose approvals fire on exit, which would let a re-priced
    >   proposal reach a client unapproved. Recorded as an unresolved gap in
    >   `OPPORTUNITY_DESIGN.md`.
    > - **The Deal Sheet freezes when the proposal is approved for
    >   submission**, which is the natural application of the immutable
    >   approved snapshot principle. The transition it was named against,
    >   Proposal to Evaluation, no longer exists. The principle stands and
    >   the transition needs renaming.
    >
    > **What has been confirmed since:**
    >
    > - **Bid/No Bid is an approval at the gate into Proposal.** This
    >   section flagged that placement as an assumption for confirmation.
    >   The business confirmed it on 2026-08-22. What a rejection means,
    >   block versus auto-close, remains undecided.
    >
    > **What is still true and still broken:** `routing_rules` was flagged
    > empty in the Milestone 2 audit below. It holds **0 rows today**,
    > confirmed at commit `dd7459a`. The tiered Commercial escalation
    > described in this section, and still described on the
    > `approval_tracks.Commercial` row, has never worked. Opportunity is the
    > record type it was designed for.

---

## Amendment 3. `DESIGN_PRINCIPLES.md` Section 6, reframe from stale to control gap

**Why.** Section 6 is currently understood as stale documentation awaiting
a rewrite. It is worse than that, and the difference changes who needs to
act. The section assumes a `product_defaults` catalog supplies unit,
mounting and hosting costs. That table does not exist, and the
deferred-scope entry in this same document confirms the cost lines are
freely editable payload fields on each Opportunity.

The consequence is commercial, not editorial: every Opportunity carries its
own private cost basis and nothing compares them.

**Anchor**

    ## 6. Opportunity value estimation, before a Deal Sheet exists

    The sales owner shouldn't need a completed Deal Sheet just to see a ballpark contract value early in the sales cycle.

**Insert between the heading and the paragraph:**

    > **UNBUILT, AND THE GAP IS A CONTROL GAP RATHER THAN A DOCUMENTATION
    > GAP. Recorded 2026-08-22.**
    >
    > Everything below assumes `product_defaults` and `system_defaults`
    > supply unit, mounting and hosting costs. **Neither table exists.** The
    > Deferred scope entry for Base Cost Data in this document says so
    > directly: the cost lines are a stopgap, held as freely editable
    > payload fields on the Opportunity record itself, which
    > `SALESPERSON_WRITABLE_KEYS` confirms.
    >
    > **The consequence is not that this section is out of date.** It is
    > that every Opportunity carries its own private cost basis and nothing
    > compares them. Two deals priced in the same week can use different
    > hardware costs, and the Commercial approval is computed against
    > whatever the salesperson typed. The Round 17A Phase 6 rule guarantees
    > one calculation path. It does not guarantee one set of inputs.
    >
    > This matters more from the moment Bid/No Bid and the Proposal gate
    > make Commercial approval load-bearing on Opportunity.
    >
    > **Not scheduled, and not a reason to stop.** Recorded so that the next
    > person to reach for this section knows they are reading a design for
    > something unbuilt, and so the gap is owned rather than rediscovered.
    > Reconciling it is the first thing any commercial-model work has to do.

---

## Amendment 4. `DESIGN_PRINCIPLES.md` Deferred scope, add the staff directory contradiction

**Why.** Two documents make incompatible claims and something has to be
built against one of them shortly. `CLAUDE.md` requires that a
disagreement be reported rather than resolved quietly, so this is recorded
as a finding with an investigation, not as a correction.

**Anchor.** The first bullet under `## Deferred scope`, beginning:

    - **JWT "issued in the future" rejection, rare and unreproduced.**

**Insert immediately above that bullet:**

    - **A staff directory may or may not exist, and two documents disagree.
      Found 2026-08-22 by reading `CURRENT_STATE.md` against
      `PROTOTYPE_SPECIFICATION.md`. NOT RESOLVED, deliberately.**

      `PROTOTYPE_SPECIFICATION.md` Section 3 states that there is no staff
      directory record type anywhere in this system, and that Opportunity's
      four Authority fields were therefore built as free text rather than as
      pickers. `SALESPERSON_WRITABLE_KEYS` is consistent with that: `lead`,
      `commercial`, `technical` and `legal` are writable payload strings.

      `CURRENT_STATE.md` at commit `dd7459a` lists migration
      `20260816000000_terminus_staff.sql` and a live registered route
      `GET /api/terminus-staff`.

      **These cannot both be current.** The plausible reconstruction is that
      `terminus_staff` was added after the prototype section was written and
      the section was never revisited, but that is a guess wearing
      evidence's clothes, which this document has been caught by before. Do
      not resolve it by choosing the more plausible one. **Query the table
      and read the route.**

      **Why it is urgent rather than tidy.** The Opportunity assessments are
      scored by a named Sales Lead and challenged in bid review, and
      Bid/No Bid needs an approval track tied to a real person.
      Attribution to a free-text string is not attribution. Whichever answer
      is true, both documents need correcting once it is known.

---

## Verification for this change

This is a documentation change and it ships no code, so the evidence is
small and specific.

1. Each anchor matched exactly once before editing. Confirm with
   `grep -acF -e` on the anchor's first line.

   **Use `grep -acF -e`, not `grep -ac`.** Amendment 4 revised's anchor
   begins with `- **JWT`, and a leading dash is parsed as an option rather
   than as a pattern: the first Phase 0 run of that anchor errored instead
   of counting. It errored visibly, so it was caught, but the same shape
   returning `0` would have read as a genuine absence. `-e` ends option
   parsing, `-F` takes the anchor literally so its asterisks and backticks
   are not read as a pattern.
2. Each inserted block renders as a blockquote or list item in the
   surrounding structure, not as a broken table or a code fence.
3. `grep -n "^## " DESIGN_PRINCIPLES.md` returns the same heading count and
   the same headings as before the edit. No heading was created, moved or
   consumed.
4. **No em dash in any text this change introduces.** The em dash count is
   unchanged at 28 in `PROTOTYPE_SPECIFICATION.md` and zero in every other
   file. Those 28 are pre-existing, they sit in section headings, and
   removing them is a deferred item rather than this round's work. This
   change edits `CLAUDE.md` and `DESIGN_PRINCIPLES.md`, both of which are
   at zero and must stay there.
5. The `CLAUDE.md` read-list table has exactly one added row and still
   renders as a table.
6. `CURRENT_STATE.md` is unchanged and untouched.
7. `PROTOTYPE_SPECIFICATION.md` is unchanged and untouched.
