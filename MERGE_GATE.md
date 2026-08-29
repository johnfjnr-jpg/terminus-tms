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

### Before any merge to `main`

```bash
npm run verify
```

It runs all three stages in order, captures **every stage's whole output** to
`.verify/verify-<stamp>.txt` before anything is filtered, prints the branch, the
commit and whether the working tree was dirty, and exits non-zero if any stage
fails.

**Paste the summary block into the merge.** It names the commit it ran at, so a
gate run against a different tree is visible rather than assumed.

```
MERGE GATE  round-38-commercials-reshape  38c5089...
  PASS  pure suite                 exit 0  849ms
  PASS  database suite             exit 0  32723ms
  PASS  HTTP precondition probe    exit 0  13009ms
```

Calibrated in both directions: an injected failing assertion in
`payload-diff.test.mjs` produced `FAIL  pure suite  exit 1` and
`1 of 3 stages FAILED. Do not merge.`, and the gate exited 1. A gate never seen
refusing is not a gate.

### Prerequisites the gate does not install for you

- `.env` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
- `npm run dev` running on `:3000`
- a current `session-ref.json` (`node scripts/sign-in.js`)

A missing prerequisite shows as a **failed stage**, never as a skipped one. A
skip reads exactly like a pass, which is the failure this whole file is about.

---

## What the CI-secret option would need

Recorded so it is a decision that can be taken later rather than a thing nobody
wrote down. It is fully automatable; nothing about it is blocked on design.

1. A **scratch Supabase project**, separate from the live one. `npm run test:db`
   writes real rows and the probe creates and soft-deletes real records.
2. Two repository secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
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
