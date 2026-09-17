// Unit calibration spec for Round A ruling R12: the blocked list clears on the
// host's own reload after a save, and nowhere else.
const TABS = 'frontend-react/src/testbed/StageTabs.tsx'
const HOST = 'frontend-react/src/testbed/TestBedHost.tsx'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'p5-r12',
  testFiles: ['src/__tests__/testbed-riders.test.tsx'],
  injections: [
    I('R12 the host reload no longer moves the token', HOST,
      '    setReloads((n) => n + 1)\n', '',
      ['a save the host reloads after CLEARS the list the shell wrote']),
    I('R12 the StageTabs clear removed', TABS,
      "if (reloadToken && blockedRef.current) blockedRef.current.innerHTML = ''", 'void reloadToken',
      ['a save the host reloads after CLEARS the list the shell wrote']),
    I('R8 the clear runs on every render, so a tab change clears', TABS,
      "if (reloadToken && blockedRef.current) blockedRef.current.innerHTML = ''\n  }, [reloadToken])",
      "if (blockedRef.current) blockedRef.current.innerHTML = ''\n  })",
      ['SURVIVES tab switches']),
    I('R12 cleared when the save is ATTEMPTED, not on the reload after it', HOST,
      'const writePayload = useCallback(async (payload: Record<string, unknown>) => {\n',
      'const writePayload = useCallback(async (payload: Record<string, unknown>) => {\n    setReloads((n) => n + 1)\n',
      ['a REFUSED save that does not reload leaves the list']),
    I('R12 the clear removes the element instead of emptying it', TABS,
      "blockedRef.current.innerHTML = ''", 'blockedRef.current.remove()',
      ['the element survives the clear, once, with its id']),
  ],
}
