# Opportunity round: Step 0, the brief, and PHASE 0

Model: **Claude Opus 5 (1M context)**.
Branch `opportunity-round`, off `main` at `1124917`, confirmed equal to
`origin/main` and to `git ls-remote origin main` before the branch was cut.

**NOTHING IS PUSHED.** Three commits sit on the branch. Ready for John's push
when he wants them, at the SHA named in the closing section.

---

## 0. What is NOT built, first

**Phase 0 builds nothing, by design**, and this section leads because a carried
item mentioned only at the end reads as a delivery to the session writing it.

- **F-TOP part A is not built.** Phase 0 found a structural fact that changes
  its shape, section 4.1, and the brief's own instruction is that Phase 0
  measures the route and does not pick it.
- **F-TOP part B is not built**, as instructed. It is design-first and waits on
  a ruling. Phase 0 answers its three questions, section 4.2.
- **The `--red` adoption is not built.** The census is taken and calibrated;
  the guard and the adoption follow the ruling.
- **`Record scores` is not dressed.** The missing class is identified.

---

## 1. Step 0: the push hook, built and calibrated

`.githooks/pre-push`, commit `10b873e`. Build discipline 18 named a pre-push as
available and NOT built because building a gate around John's own instruction
was his to call. He called it, and rule 18 now records it built with the
superseded paragraph left standing.

### The discriminator, and the obvious one does not work

The instruction offered "the sandbox user" as a candidate. **There is no
sandbox user.** This session runs as `USER=johnfryatt`, `LOGNAME=johnfryatt`,
**uid 501**, the same account as John's own terminal. No user, home directory
or group separates them.

Two signals do, both measured rather than assumed:

| signal | in this session | in a normal login shell |
|---|---|---|
| `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT` | set | **unset** under `env -i zsh -l`, and named in **no dotfile** (`~/.zshrc` is one line, `PATH` only) |
| a terminal on stderr | **absent**, on all three descriptors | present under a real pty |

The dotfile search was calibrated on a known-present string before its silence
was read as absence.

### Both are gated on, because they fail in opposite directions

The env marker **fails OPEN**: a release that stops exporting `CLAUDECODE`
would disarm the hook, and its silence would read exactly like its success. The
tty test **fails CLOSED** and depends on no vendor's variable, so it is what
survives the marker going away. Only the tty test carries an override
(`TMS_PUSH_NONINTERACTIVE=1`), because only it has a false positive to answer
for: a piped push from John's own terminal is not a tty either.

### Calibrated both directions, 5 of 5

| case | verdict |
|---|---|
| this session as it is, no tty, marker set | REFUSE, citing the marker |
| a real pty, marker still set | REFUSE, so the env test dominates |
| **a real pty, markers unset, John's terminal** | **ALLOW** |
| no tty, markers unset | REFUSE, citing the missing terminal |
| no tty, unset, override set | ALLOW |

**How the "inert for John" half was proven, stated honestly as the instruction
asked.** Not by observing John's terminal, which I cannot open. By allocating a
**real pty** with `script` and unsetting the markers in it. That is a genuine
terminal, not a simulation of one, and the markers are proven absent from a
clean login shell separately. What it does not prove is John's exact shell
configuration; his one dotfile was read and sets only `PATH`.

**My first harness scored a vacuous pass and the instrument caught it.** It
read ALLOW as "no refusal seen", which is also what a hook that never ran
produces. Rewritten to require a positive witness each way, two cases that had
read `ok` reported "the hook never ran at all". Cause: `script` needs a
terminal on its own stdout and dies on a file redirect.

### And the product, not only the logic

A hook's logic being right does not prove git invokes it. Against a
**throwaway local bare repo**, so nothing could leave the machine:

- a real `git push` from this session was **refused, with zero refs landing**;
- the **identical push with the hooks path pointed at an empty directory
  succeeded**, and the ref landed.

Same command, same target, hooks path the only difference. The hook, and only
the hook, is what refused. The scratch repo was destroyed; `origin` was never
a target at any point.

### The honest limit

This binds accident and pasted instruction. **It cannot bind a session that
chooses to unset the marker, because that session can also edit the hook.** It
is a guard, not a cage, and rule 18 remains the control.

The hook is run by git or by nobody, so a deletion would be silent. Its
assertions live in `edit-guard.test.mjs` beside the pre-commit ones, read
**through the comment stripper**, which is load-bearing here: the hook's own
comments name `CLAUDECODE` and the refusal banner, so an unstripped scan would
pass on a gutted file. Five injections, **5 of 5 fired on the right named
assertion**, including one that merely comments the check out.

---

## 2. Step 1: the brief

`OPPORTUNITY_ROUND_BRIEF.md`, commit `bc0f887`, markdown only, riding the green
gate at `10b873e` under build discipline 48(a) and named here as that clause
requires.

Two things were measured before writing it, so it asserts neither:

- **The sharing is real**, so "third caller" is exact: `TestBedHost` imports
  `FollowUpTask`, `NotesHistory` and `notes` **from `../contact/`**. Contact is
  the owning module.
- **And the structural fact in 4.1 below**, which the brief names as the first
  thing Phase 0 must settle.

---

## 3. A correction to a figure in the instruction

The instruction says **"zero of 23 opportunities"** carry a follow-up task.

**The zero is right. The 23 is not the current number.** Measured: **18 live
opportunities**, 9,634 total, 9,616 soft-deleted. Zero of the 18 carry
`followUpDate` or `followUpDescription`.

**And the first version of that probe printed `1000 total, 6 live`**, which is
exactly PostgREST's default cap and therefore a truncated page rather than a
count. Both numbers were wrong, and the 6 would have been reported as the
population. The probe now takes the exact count first and **asserts the rows
walked equal it**, so it cannot silently truncate again.

The zero is calibrated: the same reader finds **2 follow-ups on contacts**, the
record type that uses the keys. A zero from an instrument never shown reaching
one is not a measurement.

---

## 4. Phase 0: the four answers

### 4.1 The Opportunity's top region, and a defect in it

Measured live at 1240, 1920 and 3440 on an existing record, screenshots opened
and read.

**What renders above the tab row today**, in order: the read-only banner, the
`.detail-head` block, the headline stat strip, the stage chevron strip, then
the tabs. Ten to sixteen sibling containers render nothing at all.

| | 1240 | 1920 | 3440 |
|---|---|---|---|
| view width | 1000 | 1680 | 3200 |
| tab row starts at | y=580 | y=515 | y=515 |
| headline strip height | **137** | 72 | 72 |

**The headline strip wraps at 1240**, 137px against 72px: six cells in a
six-up grid, so the sixth drops to a second row and leaves a wide empty cell
beside it. Visible in the capture.

#### THE FINDING: the Opportunity has no title on screen

**`h1#ref-display-name` renders EMPTY on every record measured, 4 of 4**, while
the record is named in the database. The name reaches only `#detail-company`,
the small sub-line beneath. On one record the database name is
`Trilogy Technology Opp 1` and the sub-line reads `Trilogy Technologies Pte Ltd`,
because that line is the **account**, not the record. So the opportunity's own
name renders nowhere in the top region.

Confirmed visually: the capture shows the green `OPPORTUNITY` eyebrow, then
blank space where the title belongs, then the name in the small sub style.

**The cause, and it is a retirement that took a writer with it.** `app.js`
carries this comment at the site:

> `ref-display-name` is set below by `opportunity-reference.js`'s
> `renderReferenceTab` ... not set redundantly here too.

**`frontend/opportunity-reference.js` does not exist.** It was retired in the
migration. Nothing sets the title, and the comment is a pointer to a deleted
file. This is `CLAUDE.md`'s own clause about a swap retiring a code path: list
what that path WROTE, not only what called it.

**The name is not lost.** It renders as a field row inside the Reference tab
(`OPPORTUNITY NAME  Willowglen`). What is missing is the record's title.

**Bearing on F-TOP part A:** the top region this round is asked to add a card
row to currently has a hole in it, directly above where that row would sit.

#### And the structural fact part A must answer

**There is no `opportunity/` module in the React tree.** That surface is
rendered by vanilla `frontend/app.js`, which mentions it 176 times. A React
component cannot be added to it the way a caller is added to a host. The estate
has a precedent, `deal/` is a React island mounted into that same vanilla
surface, and whether the top row follows it is a ruling rather than a
measurement. **Part A may be larger than "a third caller", and I have not
assumed either way.**

### 4.2 Contact's follow-up task, and whether it lifts

**Storage: two ordinary payload keys**, `followUpDate` and
`followUpDescription`. No column, no table, no separate mechanism.

**Routes: one allowlist entry per record type**, on the ordinary PATCH:

| route | line | carries the keys |
|---|---|---|
| `src/routes/contacts.js` | 424 | yes |
| `src/routes/test-beds.js` | 484 | yes |
| `src/routes/opportunities.js` | 386 | **no** |

**The estate has already answered this question once**, and the answer is in
the Test Bed's own comment:

> the same two ordinary payload keys the Contact surface uses, written on the
> same ordinary write path. Not a new mechanism ... taking the same spelling is
> what lets one component serve both rather than two renderers of one idea.

**So it lifts, and my recommendation is to lift it the same way: add the two
keys to `SALESPERSON_WRITABLE_KEYS`.** That route already refuses any key
outside its allowlist with a 400, so the two keys are the whole storage change.

**A gate rule is attached to the Contact's key and does not travel.**
`stage_gate_rules` requires `followUpDate` for the contact transition to
Nurture. That is a contact business rule, not a property of the keys, and
nothing about adding the keys to the Opportunity creates an equivalent.

**What part A needs is already there:** `summary` and `notes` are **both
already in the Opportunity's allowlist**. Part A really does bind to existing
stored data, with no route change at all.

### 4.3 The `--red` census, derived from a scan

Not a word list. Colour **literals** are parsed and classified by **hue**, so a
site named `danger`, `err` or nothing at all is still found. The band was
written as a requirement before any value was measured.

**204 files scanned, 65 colour literals parsed, 10 red by hue, all in
`frontend/style.css`.** The population is small because the estate is
tokenised: `style.css` carries 81 colour literals against **740 `var(--…)`
uses**.

**Two distinct reds, which is the finding:**

| value | sites | hue | sat | light |
|---|---|---|---|---|
| `rgba(242,100,100,0.9)` | 6 | 0 | 85% | 67% |
| `#e06c6c` | 4 | 0 | 65% | 65% |

- **Six sites carry `rgba(242,100,100,.9)` and reach no token at all**:
  `.auth-error`, `.msg-error`, `input.input-invalid` (border and outline),
  `.nlg-why`, and `.new-lead-table select[aria-invalid="true"]`. Every one is
  error or invalid semantics.
- **Three sites carry `var(--red, #e06c6c)`**, duplicating the token's value as
  a fallback: `.tb-doc-feedback.err`, and `.stat-value--overdue` twice.
- **One is the definition**, `--red: #e06c6c`, which sits in a second `:root`
  at line 7089 rather than in the palette block at the top of the file.

**These are not the same colour.** The six untokenised sites are a
noticeably more saturated red than the token. Adopting `--red` at those sites
is a visible change, not a refactor, which is why the census stops here.

**Calibrated 5 of 5**, including the two directions that matter: a red injected
into live `.tsx` **is found** (so the scan reaches React), and the same red in
a **comment is not** (so prose cannot supply findings). It also **refuses** on
anything it cannot classify rather than returning a shorter list, which a
smaller count would read as progress. That refusal fired for real on the first
run and caught HTML numeric entities (`&#10003;`) being read as colours.

### 4.4 `Record scores`

`StagePanel.tsx:585`: `<button type="button" data-testid="tb-score-record"`
with **no `className` at all**. It is the only one of the three buttons in that
file with none.

**Recommended: `btn-sm btn-primary`**, which is what `Next Stage` wears on the
same surface and what the walk-2 suite already asserts there. It matters
doubly because this control is disabled most of the time and `.btn-sm:disabled`
carries a real treatment, where a bare disabled `<button>` is a grey browser
default.

---

## 5. What these results do NOT establish

- **All 18 live opportunities are owned by other users; zero by this session's
  account.** Every Opportunity screen measured is therefore a read-only one. I
  have no reason to think the empty title depends on ownership, and the cause
  found in source is ownership-independent, but I have not measured an owned
  Opportunity and will not claim it.
- The `--red` census covers `frontend/` and `frontend-react/src`. It does not
  cover colours arriving from a library, an inline SVG fill expressed outside
  these forms, or anything computed at runtime.
- Nothing here is a claim about how the top row should LOOK. Phase 0 measured
  the region; it did not design one.

---

## 6. Instrument faults this phase caught in its own work

Recorded because the estate's rule is that the record is trustworthy rather
than tidy. **Four, all mine, all caught before anything was reported:**

1. **A truncated page read as a count.** `1000 total, 6 live` against a true
   9,634 and 18.
2. **A vacuous calibration pass**, where ALLOW meant "no refusal seen" and so
   did a hook that never ran.
3. **A wait satisfied by the previous record.** Navigating list to detail and
   back, `#detail-company` keeps the old text, so the same record read
   "Willowglen" in one run and "Trilogy Technologies Pte Ltd" in the next. Fixed
   with a full reload per record.
4. **The sharpest: `visibility: hidden` preserves layout.** This shell covers a
   loading detail view with `.is-loading > * { visibility: hidden }`. Every
   child keeps a full, correct, non-zero bounding box while invisible, so a
   wait on rendered text passed, **a guard asserting the tab row was on screen
   passed**, and all three captures showed nothing but "Loading the record...".
   Every programmatic check in that run was green.

**Number 4 was found by opening the screenshot**, which was the only instrument
that could have. The geometry in section 4.1 is from the corrected run, and the
numbers moved: the banner sat at y=125 before and y=48 after, and six more
children were enumerated.

---

## 7. STOP: the rulings Phase 0 needs

1. **F-TOP part A's route.** Does the top row mount as a React island into the
   vanilla Opportunity, following `deal/`? Or is the answer that part A is a
   larger piece of work than the instruction assumed?
2. **The empty Opportunity title.** It is a live defect, found by this round and
   not created by it, so under rule 10 it goes on the list unless ruled
   otherwise. It sits inside part A's own region, which is the argument for
   taking it here.
3. **F-TOP part B.** Adding `followUpDate` and `followUpDescription` to
   `SALESPERSON_WRITABLE_KEYS`, one mechanism, same spelling as the other two
   record types. Recommended.
4. **`--red` adoption.** The six untokenised sites are a different, more
   saturated red than the token. Do they adopt `--red` as it stands, or is the
   token's value the thing to settle first?
5. **`Record scores`**: `btn-sm btn-primary`. Recommended, cosmetic tier.

---

## 8. State

Three commits on `opportunity-round`, nothing merged, nothing pushed.

| commit | what |
|---|---|
| `10b873e` | the pre-push hook, its test, and rule 18's amendment |
| `bc0f887` | the brief, markdown only, riding `10b873e`'s gate |
| Phase 0 | the probes and this report |

No fixtures were created, so there is nothing to tear down; every measurement
was taken against existing records.

**Ready for John's push** when he wants it. The branch tip SHA is printed at the
end of this run.
