# Contact-mode furniture: close-out

**CLOSED** on the gate at `47d1e84`: **24 of 24 stages, exit 0, F6 quiet, no
skips.** Suites emitted by the run - pure **543/543**, database **102/102**,
react **1009/1009**. The browser stage passed, so `PUPPETEER_PATH` reached the
gate itself rather than only the individual probes.

**NOTHING PUSHED.** The stack waits on John's word.

---

## THE WALK, and what it did and did not cover

John walked it in parallel with the close and confirmed: **the contact's title
is correct and the removed fields are gone, and the lead operates correctly.**
That is R1, R2, R3 and lead-mode, on the real screen.

> **R4 is NOT covered by that statement.** The Create control, its menu and the
> shell's dialogue were proven by probe - a real Test Bed created from the
> contact, carrying it as its lead - and by screenshot. **The walk's own words
> do not mention them**, and recording them as walked would be putting words
> in it.

## Reconciliation by counting, and two corrections

**This round is FIVE commits, not four.** The close's `CURRENT_STATE` regen is
the fifth, made after the instruction was written.

| commit | what |
|---|---|
| `48cf729` | the brief |
| `302842e` | Phase 0 |
| `b228ef0` | Phase 1, the build |
| `731e838` | Phase 1, the report |
| `47d1e84` | close: `CURRENT_STATE` regen |

**So the unpushed stack is TWELVE, not eleven** - these five plus R1 (c) /
R7 / R8's seven. Every commit maps to a phase or a close step; none is
unaccounted.

## THE BOUNDARY, and it is narrower than the instruction assumed

The instruction says *"this touched src/frontend-react"*. **Measured, `src/`
has ZERO changes - across this round AND across the whole twelve-commit
stack.**

| | this round | whole stack |
|---|---|---|
| `src` | **0** | **0** |
| `supabase` | 0 | 0 |
| `frontend` | 1 (`style.css`) | 1 |
| `frontend-react` | 7 | 12 |

**So NO server restart is needed, for a revert or for anything else.** The API
server runs without `--watch`, which is build-discipline 9's stale-server
hazard, and it does not bite here: the `src/` the process loaded is
byte-identical to the tree and to `origin/main`.

**`frontend/style.css` is served from disk**, so it needs a browser reload and
nothing more. **`frontend-react/dist/terminus-react.js` is TRACKED**, so a
revert restores the source and the built bundle together and no rebuild is
required after one.

## Revert rehearsed, and it took three attempts to become a fact

```
target tree (6a593da)  3845bf3c7c4444e971f41efb7fa091a4e4d6f1ef
after revert           3845bf3c7c4444e971f41efb7fa091a4e4d6f1ef   MATCHES
restored               1e581caa672994f7f66211a0c5be0e8ca098e54e   BYTE-IDENTICAL
```

**A revert needs two steps, not one.** `git checkout <ref> -- .` does not
remove the six files this round ADDED (V44's own clause), so they need an
explicit `git rm`; and `git write-tree` measures the INDEX, so removing them
from the working tree alone leaves the rehearsal reading a difference that is
not there.

## `CURRENT_STATE` regenerated, staleness both halves

```
HALF 1 PASS  recorded SHA 731e838ac985 is an ancestor of HEAD
HALF 2 PASS  0 configuration sources changed since
```

The gate's own `CURRENT_STATE staleness` stage agrees.

**All 16 diff lines account to phases**, and the load-bearing half is that the
**live counts did not move**: 6 Unqualified, 11 Qualified, exactly as at the
start. **25 fixture records across four tags, 0 live** - the growth is all
soft-deleted rows and revisions, which is what V11's soft-only teardown
produces by design.

---

## Promotion: ONE, an extension, no new number

**Verification 7 gains a FOURTH AXIS: the class survives and the ELEMENT TYPE
changes underneath it, so the class assertion passes.**

V7's existing remedy is *assert it carries the replaced control's CLASS*.
**That remedy was satisfied.** `.contact-create-item` was written for a `<div>`
and `.contact-create-trigger` for a `<span>`; both became `<button>` for
keyboard and ARIA, and **neither class says `background`, because a div and a
span do not have one.** The menu rendered as two white blocks with white text.

The check it prescribes: ask what the new tag brings that the old one did not,
and **put the reset in the stylesheet rather than the markup**, because the old
element type is usually still out there - here the vanilla's list rows keep the
div and the span, and all four added declarations are inert on them.

**The tell: a class whose rules name only what it ADDS and never what it
SUPPRESSES has an element type baked into it that nobody wrote down.**

## RECORDED PLAINLY: what this close cost in apparatus

**Three instrument faults, all mine, all caught before they were quoted:**

1. **I redirected `state-dump.mjs`'s stdout into the file it writes itself**,
   so the log overwrote the real output and the header was lost. Caught by
   reading the diff rather than trusting `exit 0`.
2. **I silenced `git rm` and read its silence as a result** - twice - which is
   Verification 12's own shape in my own hands. Run visibly, it worked first
   time.
3. **Phase 1's first door reading was "0 of 0 fields editable"** - a comparison
   with nothing on either side (V14), caused by a wait the old state already
   satisfied (V7).

**None reached a report as a finding.** Recorded because a close that lists
only the clean readings misrepresents what measuring costs.

---

## Carried

1. **`StageActions` is outside the conformance gate.** Its closure starts at
   `leads/LeadsList.tsx` and nothing under `leads/` imports it, so the new
   Create control is **not** gate-covered. Carried, per John's ruling.
2. **Group A's A6**: the eyebrow reads "Contact details" and the first field
   card is also titled "Contact Details". **Queued, not fixed here.**
3. **`Link to Account` and `Save task` still render as unstyled white
   buttons** - `LinkAccountPanel` and `FollowUpTask`, untouched by this round.
   **The fourth axis above is the rule that now names them.**
4. R4 create-actions and full `ContactHost` retirement (d) - still not scoped.
5. Everything carried from the ENFORCEMENT GAPS close: P4's four rotted
   assertions, P5/P6, the mechanical-fault hardening, the features, and the
   Sections 6-11 walk.

**This close-out and the `CLAUDE.md` promotion are markdown with no gate
reader, measured per file rather than inherited, and RIDE the green gate at
`47d1e84` under build-discipline 48(a) - named here, which is the control that
clause requires.**
