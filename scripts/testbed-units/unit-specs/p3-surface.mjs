// Unit calibration spec for Test Bed units Phase 3: each item of the unit
// surface reinjected on its own, each reddening the test that names it.
const PANE = 'frontend-react/src/testbed/UnitsPane.tsx'
const CARDS = 'frontend-react/src/testbed/CommercialsCards.tsx'
const INST = 'frontend-react/src/testbed/InstallSection.tsx'
const QUEUE = 'frontend-react/src/testbed/unitQueue.ts'
const I = (id, file, find, replace, expect) => ({ id, file, find, replace, expect })

export default {
  name: 'p3-surface',
  testFiles: ['src/__tests__/testbed-units-surface.test.tsx', 'src/__tests__/testbed-queue.test.ts'],
  injections: [
    I('L4: latitude loses its control again', PANE,
      '              <input type="text" data-testid={`tb-unit-latitude-${u.id}`}', '              <input type="hidden" data-nope={`tb-unit-latitude-${u.id}`}',
      ['index, serial, latitude, longitude and a state select, per row']),
    I('L4: the state select loses a state', PANE,
      '{UNIT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}',
      "{UNIT_STATES.filter((s) => s !== 'Faulty').map((s) => <option key={s} value={s}>{s}</option>)}",
      ['index, serial, latitude, longitude and a state select, per row']),
    I('L4: a field saves under a key the route does not take', PANE,
      "queues.current.write(u.id, 'latitude', e.target.value)", "queues.current.write(u.id, 'lat', e.target.value)",
      ['each field saves FLAT through the real route, under its own key']),
    I('L4: the queue forgets the revision the route returned', QUEUE,
      'const held = latest.get(unitId) ?? deps.unitById(unitId)', 'const held = deps.unitById(unitId)',
      ['Q3 the NEXT write expects the revision the route just returned, not the host']),
    I('L2: Apply goes live without a reason', PANE,
      'disabled={ccBusy || !ccCount.trim() || !ccReason.trim()}', 'disabled={ccBusy || !ccCount.trim()}',
      ['the open type offers a new count and a reason, and Apply waits for both']),
    I('L2: the correction is sent without its reason', PANE,
      'COUNT_KEY_FOR_UNIT_TYPE[UNIT_TYPE_FOR_TAB_KEY[tab]], ccCount.trim(), ccReason.trim())',
      "COUNT_KEY_FOR_UNIT_TYPE[UNIT_TYPE_FOR_TAB_KEY[tab]], ccCount.trim(), '')",
      ['Apply sends the vanilla\'s body: the payload count plus countCorrectionReason']),
    I('L3: the locked count renders as an ordinary field again', CARDS,
      'if (SENSORS.includes(name) && countIsLocked(name, units)) return lockedRow(name, f)', 'if (false) return lockedRow(name, f)',
      ['the Commercials count for a type with units renders locked, naming where to correct it']),
    I('R8: the installer list opens with no search again', INST,
      '                {!term.trim()\n                  ? null\n                  : matchAccounts(p.accounts, term).length',
      '                {matchAccounts(p.accounts, term).length',
      ['a fresh Installation tab shows no Account names']),
  ],
}
