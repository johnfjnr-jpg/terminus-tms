// Unit calibration for W7 and W8a: Escape reverts, and releases the lock.
const P = 'frontend-react/src/testbed/StagePanel.tsx'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'walk2',
  testFiles: ['src/__tests__/stage-panels-walk2.test.tsx', 'src/__tests__/testbed-scoring.test.tsx'],
  injections: [
    I('W7 Escape on the reason box does nothing', P,
      '                      onKeyDown={revertOnEscape}\n                      onChange={(e) => {',
      '                      onChange={(e) => {',
      ['Escape in the reason box drops the draft']),

    I('W7 Escape on the score control does nothing', P,
      '                disabled={!!blocking && !isBlocking}\n                onKeyDown={revertOnEscape}',
      '                disabled={!!blocking && !isBlocking}',
      ['Escape on the score control itself does the same']),

    // The revert must REVERT, not merely close: leaving the draft in place
    // would keep the lock on and trap the person W8a is about.
    I('W7 Escape closes without dropping the draft', P,
      "          if (e.key !== 'Escape') return\n          e.preventDefault()\n          onDraft(key, '', blocking)",
      "          if (e.key !== 'Escape') return\n          e.preventDefault()",
      ['Escape in the reason box drops the draft',
        'a blank reason locks the other criteria, and Escape releases them']),

    // Escape must be a no-op with nothing drafted, or it becomes a way to
    // disturb a recorded score by pressing a key at it.
    // ANCHORED ON THE TEST THIS ACTUALLY FALSIFIES, which is not the one it was
    // written for. It first named "Escape with NO draft changes nothing", and
    // came back SILENT: with no draft the handler is a no-op either way, so
    // that test cannot see the guard. The claim it really breaks is that
    // ordinary typing leaves the draft alone, and no test asserted that until
    // this silence named it (Verification 51).
    I('W7 Escape fires on every key, not only Escape', P,
      "          if (e.key !== 'Escape') return", '          if (false) return',
      ['ORDINARY keys in the reason box leave the draft alone']),

    // W9's own claims, which the scoring suite asserts.
    I('W9 the blocking row is not marked', P,
      "            data-blocking={isBlocking ? 'true' : undefined}>", '            >',
      ['the LOCK holds: the OTHER selects']),
    I('W9 the shared line names nothing', P,
      '                  The other criteria are waiting on the Reason for {name}.</p>',
      '                  Some criteria are waiting.</p>',
      ['the LOCK holds: the OTHER selects']),
  ],
}
