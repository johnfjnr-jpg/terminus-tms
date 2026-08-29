// The one masked-password prompt. Round 39, 2026-08-29.
//
// Extracted from scripts/create-test-user.js, which had the only correct
// implementation in the repository, rather than written a second time.
// Verification 20: a second reader of the same value always drifts, and two
// hand-rolled raw-mode readers would drift on exactly the details that make
// this safe (raw mode restored on every exit path, Ctrl-C honoured, nothing
// echoed).
//
// ── WHY A PROMPT AND NOT AN ARGUMENT ──────────────────────────────────────
//
// A password on a command line lands in ~/.zsh_history in plaintext, and that
// file is backed up, synced, and readable by anything with filesystem access to
// the machine. It is also visible in `ps` output to any other process on the
// box for the lifetime of the call. Neither of those is recoverable by deleting
// the process afterwards.
//
// Round 39 had a real password typed on a command line three times before
// anybody said so. The cost was small because it was a test account, and the
// discipline is the same one applied to the committed token: rotate, do not
// reason about whether it mattered.
const ENTER_CODES = [10, 13, 4] // newline, carriage return, Ctrl-D
const CTRL_C_CODE = 3
const BACKSPACE_CODE = 127

export function promptHiddenPassword(query) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process

    // A prompt needs a terminal. Without one, raw mode is unavailable and the
    // read would silently return nothing, which reads exactly like an empty
    // password. Fail instead, and name the unattended path.
    // The env-var hint belongs to readPassword's callers, not to this one:
    // create-test-user.js calls straight through here and TMS_TEST_PASSWORD does
    // nothing for it, so naming it would describe a configuration that does not
    // apply to the caller reading the message.
    if (!stdin.isTTY) {
      reject(new Error('No terminal available for a password prompt.'))
      return
    }

    stdout.write(query)
    stdin.resume()
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')

    let password = ''
    const finish = (fn, arg) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
      fn(arg)
    }
    const onData = (char) => {
      const code = char.charCodeAt(0)
      if (ENTER_CODES.includes(code)) finish(resolve, password)
      else if (code === CTRL_C_CODE) finish(process.exit, 1)
      else if (code === BACKSPACE_CODE) password = password.slice(0, -1)
      else password += char
    }
    stdin.on('data', onData)
  })
}

// ── TWO PATHS FOR TWO DIFFERENT NEEDS ─────────────────────────────────────
//
// Set by the business, Round 39. Not one mechanism with a fallback: two paths,
// because the two credentials are different KINDS of thing.
//
//   A person signing in interactively -> masked prompt. Never argv, never a
//   file. A real password must not be storable.
//
//   The gate, unattended -> TMS_TEST_PASSWORD, and ONLY for the scratch
//   project's throwaway account. The environment variable exists for a
//   credential that is disposable by design, which is the only kind that
//   belongs in a file at all.
//
// That is also what keeps the .env scan gap small: the only password it will
// ever guard is one whose exposure costs nothing.
export async function readPassword(prompt) {
  const fromEnv = process.env.TMS_TEST_PASSWORD
  if (fromEnv) {
    console.error('Using TMS_TEST_PASSWORD. This is for a scratch project throwaway account only.')
    return fromEnv
  }
  try {
    return await promptHiddenPassword(prompt)
  } catch (e) {
    throw new Error(`${e.message} For unattended use set TMS_TEST_PASSWORD, `
      + 'and only for a scratch project throwaway account.')
  }
}

// A password passed as an argument is already in the shell history by the time
// this runs, so there is nothing to protect and the only useful act is to say
// so. It refuses rather than accepting, because accepting it teaches the habit
// back, and it names rotation because the exposure has already happened.
export function refuseArgvPassword(argv, usage) {
  if (argv.length <= 1) return
  console.error('Refusing a password passed as an argument.')
  console.error('It is already in your shell history in plaintext, and was visible in `ps` while it ran.')
  console.error('Remove it from ~/.zsh_history and rotate that password, then run:')
  console.error(`  ${usage}`)
  process.exit(1)
}
