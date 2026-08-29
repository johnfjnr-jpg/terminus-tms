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
// A password on a command line lands in FOUR places, and clearing the first is
// the only one most people think of:
//
//   ~/.zsh_history   plaintext, backed up and synced. Note that a live shell
//                    holds history in memory and rewrites the file on exit, so
//                    editing it under a running session can put the lines back.
//   `ps` output      visible to every other process on the box while it runs
//   scrollback       the terminal's own buffer, and any saved window state
//   session logs     whatever the terminal or a multiplexer is recording
//
// NEITHER PARTY CAN ENUMERATE EVERYWHERE IT WENT, which is why the answer is to
// rotate rather than to clean up and then reason about coverage. Same
// discipline as the committed token: rotate, do not reason about whether it
// mattered.
//
// Round 39 had a real password typed on a command line three times before
// anybody said so.

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
    let done = false
    const finish = (fn, arg) => {
      if (done) return
      done = true
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
      fn(arg)
    }

    // ── EVERY CHARACTER IN THE CHUNK, NOT THE FIRST ONE ───────────────────
    //
    // This read `char.charCodeAt(0)` on the whole data event until Round 39.
    // A human typing delivers one keystroke per event, so the first character
    // IS the event and it worked for every caller it had. A PASTED password
    // arrives as ONE chunk: the code read only its first letter, found no
    // Enter, appended the entire chunk including the trailing carriage return
    // to the password, and waited forever for a submit that had already
    // happened.
    //
    // Nothing failed visibly. The prompt simply sat there, which reads as the
    // terminal ignoring you rather than as a bug. Found by driving it from a
    // pty, and it matters immediately: a rotated password comes out of a
    // password manager, and a password manager pastes.
    //
    // Architecture rule 8, exactly: correct for every caller that existed, and
    // wrong for the caller about to arrive.
    const onData = (chunk) => {
      for (const char of chunk) {
        const code = char.charCodeAt(0)
        if (ENTER_CODES.includes(code)) { finish(resolve, password); return }
        if (code === CTRL_C_CODE) { finish(() => process.exit(1)); return }
        if (code === BACKSPACE_CODE) password = password.slice(0, -1)
        else password += char
      }
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
