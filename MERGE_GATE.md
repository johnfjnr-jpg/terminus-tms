# The merge gate

Round 38, 2026-08-29. This document exists because the answer to "what gates a
merge" was **the one suite that could not see the defect**, and nothing said so.

---

## What runs in CI today

One job, `.github/workflows/test.yml`, on every push and every pull request:

| | |
|---|---|
| Job | `pure suite (no database)` |
| Steps | `npm ci`, then `npm test` |
| Covers | 8 files, 71 tests |
| Needs | nothing. No database, no network, no server, no secrets |

**That is the whole of CI.** Nothing else runs automatically, on any event.

## What does not run in CI

| | Tests | Blocked by |
|---|---|---|
| `npm run test:db` | 8 files, 70 tests | `.env` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` |
| `node scripts/probe-preconditions.mjs` | 23 checks | the same credentials, **plus** a dev server on `:3000`, **plus** a live `session-ref.json` access token |
| `node scripts/probe-version-approval.mjs` | 13 checks | the same three |

### Why this mattered, concretely

Round 38 shipped `PATCH /accounts/:id` answering **500 to every call**: the six
arguments were all present and the identifier they named had never been
imported. The pure suite passed it. The source scan that exists specifically to
police those call sites passed it. The HTTP probe found it in under a minute,
and the HTTP probe is not in CI.

A green CI tick on this repository means the pure suite passed. It has never
meant more than that, and it must not be read as more than that.

---

## The decision taken

**A documented manual gate, enforced by one command, until the database suite
runs in CI.** Chosen over the CI-secret option because a scratch Supabase
project has to be created by a person with the account, and an enforced gate
today beats a CI job that cannot run.

> **SUPERSEDED IN PART, 2026-08-29, Round 39, by the business, on measurement
> rather than argument.** The reasoning above weighed "a gate that runs today"
> against "a CI job that cannot run", and the premise it rests on has been
> falsified: **the gate does not run today either, not without a person at a
> keyboard.**
>
> Three of the five stages need an authenticated session, the session needs a
> password, and the password belongs to one person. **The round stalled on this
> twice in one day.** It is worse when that person travels and different again
> the moment a second person can merge, at which point the gate is either shared
> credentials or no gate.
>
> The command and its five stages stand. What changes is the standing of the
> section below: **the CI-secret path is no longer a CI nicety awaiting a
> trigger. It is the fix for a thing blocking day-to-day work now**, and it has
> moved into the environment-separation package in `DESIGN_PRINCIPLES.md` rather
> than waiting behind that package's own trigger.

### Before any merge to `main`

```bash
npm run verify
```

It runs all four stages in order, captures **every stage's whole output** to
`.verify/verify-<stamp>.txt` before anything is filtered, prints the branch, the
commit and whether the working tree was dirty, and exits non-zero if any stage
fails.

**Paste the summary block into the merge.** It names the commit it ran at, so a
gate run against a different tree is visible rather than assumed.

**On a fast-forward there is no merge commit to paste into**, learned the first
time this gate ran against a real merge. Put the summary in an ANNOTATED TAG on
the merged commit instead: `git tag -a <name> -F -`. The tag is durable, it is in
the repository, and it marks the boundary as well as carrying the evidence. A
`--no-ff` merge purely to create somewhere to write would make the history worse
to buy nothing.

```
MERGE GATE  round-38-commercials-reshape  <commit>
  PASS  pure suite                    exit 0
  PASS  database suite                exit 0
  PASS  HTTP precondition probe       exit 0
  PASS  HTTP version-approval probe   exit 0
```

Calibrated in both directions: an injected failing assertion in
`payload-diff.test.mjs` produced `FAIL  pure suite  exit 1` and a
`N of M stages FAILED. Do not merge.` line, and the gate exited 1. A gate never seen
refusing is not a gate.

### Prerequisites the gate does not install for you

- `.env` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- `npm run dev` running on `:3000`
- a current `session-ref.json` (`node scripts/sign-in.js`)

A missing prerequisite shows as a **failed stage**, never as a skipped one. A
skip reads exactly like a pass, which is the failure this whole file is about.

---

## What the CI-secret option would need

**Promoted 2026-08-29: this is the fix for the gate needing a human, not only
the fix for CI.** It is fully automatable; nothing about it is blocked on
design. The one part needing a person is creating the scratch project, once.

**A DEDICATED TEST ACCOUNT IN A SCRATCH PROJECT, CREDENTIALS IN THE
ENVIRONMENT, SO THE GATE IS SELF-SERVE.** That is the whole requirement, and it
is the same scratch project environment separation already asks for.

1. A **scratch Supabase project**, separate from the live one. `npm run test:db`
   writes real rows and the probe creates and soft-deletes real records.
2. Two repository secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and a test
   account whose password is an environment variable rather than a thing typed
   at a prompt. **`scripts/sign-in.js` takes the password as `argv[2]` today**,
   which is what makes the gate need a keyboard: it should read
   `TMS_TEST_PASSWORD` from the environment and fail loudly when it is absent,
   the same way a missing prerequisite fails a stage rather than skipping it.
3. A CI job that runs `npx supabase db push`, `npm run db:seed`,
   `node scripts/create-test-user.js`, `node scripts/sign-in.js`,
   `npm start &`, then `npm run verify`.

**The one thing that must not happen:** a job that skips silently when the
secrets are absent. If the job is added, it either runs or it fails; a green
tick that means "did not run" is worse than no job, because it looks like
control.

---

## Related

`CLAUDE.md` Verification 16 (capture the run, then search the file) and
Verification 9 (an invariant not proven capable of failing is not evidence) are
both what this command implements rather than asks you to remember.
