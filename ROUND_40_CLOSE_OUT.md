# Round 40 close-out

The Commercials reshape, built against the layout the business decided in
`COMMERCIALS_RESHAPE_PHASE_0_BRIEF.md` under "Decided with the business" and
which Round 39 read past. `CLAUDE.md` rule 31.

---

## Phases, enumerated from sign-offs

**Build-discipline rule 7, run rather than recalled.** The grep instrument
returns **1** from this round's brief and **0** from the previous close-out,
which is the plausible-number result the rule warns about. The count comes from
the sign-offs.

| # | signed off | commits |
|---|---|---|
| Phase 0 | measured what reads the eleven margin inputs before removing them, and found the Verification 23 conflict on editable rates | reported in conversation, no diff |
| Phase 1 | the per-line margin model superseded, eleven inputs removed | `5374825` |
| Phase 1b | one resolver decides where a rate comes from; the database floor follows | `c611c09`, `16f5cd8` |
| Phase 2 | the sub-tabs go, five sections on one scrolling screen; versions move to the end | `2b015a2`, `0d2a973` |
| Phase 3 | the detail opens beside the summary, on request | `14f641e` |

**Six further commits are rules and tooling**, each raised by the business
mid-round and each signed off in conversation: the ledger's two halves
(`05c3cf5`), a decision that lives only in a conversation (`4571457`), a
migration carrying its own ledger row (`d22b7fb`), the one-command edit guard
(`9c0eea4`), the two Phase 2 rules (`b8b8d48`), and the dead-selector probe with
"a count is not a structure" (`5d0c590`).

**Two commits at the head of the range belong to Round 39** and were made after
its tag: `5b58c49` and `48f10ac`. Recorded rather than silently absorbed.

---

## `CURRENT_STATE.md` reconciled

Staleness test before regenerating: the recorded SHA is an ancestor of `HEAD`,
and four tracked configuration sources changed since it, which is expected for a
round that added a migration and touched three routes.

The regenerated diff has **three kinds of change and no fourth**:

- **Soft-deleted counts grow** across every record type, from this round's gate
  runs. **Live counts are unchanged at 95**, all owned by the business's own
  account.
- **The salesperson-writable allowlist gains exactly four keys** - `inSsExisting`,
  `inSsNew`, `inAqm`, `inHemir` - and the literal-key count moves 62 to 66.
  That is Phase 1b, and the arithmetic matches.
- **97 migrations become 98**, the new one named. That is Phase 1b's floor move.

**No change that a phase does not account for.**

---

## The measures this round used, and what each could not see

Recorded because `CLAUDE.md` rule 33 was written from this round and the
instances are the evidence.

| measure | caught | could not see |
|---|---|---|
| Control census, before and after | a control failing to arrive | a section losing its NAME |
| Div balance | nothing here | a comment swallowing `</section>`; two sections nested |
| Comment delimiter count | nothing here | an orphaned tail rendering as prose |
| Class-has-a-rule scan | five classes with no rule | a rule that exists and can never match |

The last row is why `scripts/probe-dead-selectors.mjs` exists.

---

## Still open at the close

- **The finished-screen read and the three task walks.** The business's own, in
  progress, and they are the round's actual measure.
- **The push**, as usual, and it is a git operation: there is no deployment.
