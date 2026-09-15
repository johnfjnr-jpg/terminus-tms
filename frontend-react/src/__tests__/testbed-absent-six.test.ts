// ── THE SIX ABSENT CAPABILITIES: the model half ─────────────────────────
//
// Round 7 Phase 2b session 2, from the I/E/V/D/N/H enumeration.
import { describe, test, expect } from 'vitest'
import { matchAccounts, installerSubtitle, installerMessage } from '../testbed/installer'
import { techTeamState } from '../testbed/techTeam'
import {
  validateNumeric, validationMessage, VALIDATION_OWNER,
} from '../testbed/validation'
import { customerDocInput, CUSTOMER_DOCS_ROUTE, customerDocRoute } from '../testbed/customerDocs'
import { addInstallNote } from '../testbed/installNotes'
import { historyRows, historyCount, HISTORY_NOTICE } from '../testbed/history'

const ACCOUNTS = [
  { id: 'a1', payload: { name: 'Alpha Contracting' } },
  { id: 'a2', payload: { name: 'Beta Systems' } },
  { id: 'a3', payload: { name: 'alpha Holdings' } },
]

describe('I: the installer', () => {
  test('I4 case-insensitive substring, and an empty term lists rather than hides', () => {
    expect(matchAccounts(ACCOUNTS, 'alpha').map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(matchAccounts(ACCOUNTS, '  ALPHA ').map((a) => a.id)).toEqual(['a1', 'a3'])
    expect(matchAccounts(ACCOUNTS, '').map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })

  test('I4 the result list is capped at eight', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, payload: { name: `Site ${i}` } }))
    expect(matchAccounts(many, 'Site')).toHaveLength(8)
  })

  test('I3 client-installed is DERIVED, and both words are said', () => {
    expect(installerSubtitle({ client_installed: true })).toMatch(/own staff/i)
    expect(installerSubtitle({ client_installed: false })).toMatch(/contractor/i)
    expect(installerSubtitle({ client_installed: true }))
      .not.toEqual(installerSubtitle({ client_installed: false }))
  })

  test('I6 a cleared tech team is reported as an ERROR, not a success', () => {
    const cleared = installerMessage({ cleared_tech_team: true })
    expect(cleared.kind, 'the user was told nothing needed doing').toBe('err')
    expect(cleared.text).toMatch(/Tech Team/)
    expect(cleared.text).toMatch(/choose a new one/i)
  })

  test('I6 and an ordinary set is a plain confirmation', () => {
    expect(installerMessage({})).toEqual({ text: 'Installer set.', kind: 'ok' })
  })
})

describe('E: the tech team', () => {
  const CONTACTS = [{ id: 'c1', payload: { name: 'Ana' } }]

  test('E2 NO INSTALLER means NO CONTROL, and the reason is on screen', () => {
    const s = techTeamState({ installer: null, contacts: [], linked: null })
    expect(s.control, 'a control was offered with no Installer set').toBe('none')
    expect(s.message).toMatch(/Set the Installer first/)
    expect(s.message).toMatch(/Installer's Account/)
  })

  test('E3 an installer with NO contacts still renders the select, saying so', () => {
    const s = techTeamState({ installer: { name: 'Alpha' }, contacts: [], linked: null })
    expect(s.control, 'the empty case was collapsed into E2').toBe('select')
    expect(s.placeholder).toBe('No Contacts at Alpha yet')
  })

  test('E3 and with contacts the placeholder is the ordinary prompt', () => {
    const s = techTeamState({ installer: { name: 'Alpha' }, contacts: CONTACTS, linked: null })
    expect(s.control).toBe('select')
    expect(s.placeholder).toBe('Select a contact')
    expect(s.options.map((o) => o.id)).toEqual(['c1'])
  })

  test('E4 the source Account is named under the control', () => {
    expect(techTeamState({ installer: { name: 'Alpha' }, contacts: CONTACTS, linked: null }).source)
      .toBe('From Alpha')
  })
})

describe('V: validation', () => {
  const f = { key: 'safesightCameras', label: 'SafeSight cameras', integer: true }

  test('V2 an EMPTY field is not-set, which is legitimate', () => {
    expect(validateNumeric('', f)).toBeNull()
    expect(validateNumeric('   ', f)).toBeNull()
  })

  test('V2 the three problems, each with its own words', () => {
    expect(validateNumeric('abc', f)).toBe('must be a number')
    expect(validateNumeric('-1', f)).toBe('cannot be negative')
    expect(validateNumeric('1.5', f)).toBe('must be a whole number')
  })

  test('V2 a decimal is fine where the field is not an integer field', () => {
    expect(validateNumeric('1.5', { ...f, integer: false })).toBeNull()
  })

  test('V3 a NEGATIVE is refused, which the keystroke guard alone does not do', () => {
    // The React pattern is /^-?\d*$/, so a minus can be typed. This is the
    // half that says no.
    expect(validateNumeric('-4', f)).toBe('cannot be negative')
  })

  test('V4 the message is label plus problem, joined across fields', () => {
    const m = validationMessage(new Map([
      ['a', 'SafeSight cameras must be a whole number'],
      ['b', 'Air quality sensors cannot be negative'],
    ]))
    expect(m).toBe('SafeSight cameras must be a whole number. '
      + 'Air quality sensors cannot be negative.')
  })

  test('V4 one invalid field still ends with a stop', () => {
    expect(validationMessage(new Map([['a', 'X must be a number']]))).toBe('X must be a number.')
  })

  test('V4 no invalid fields produces NO message rather than an empty stop', () => {
    expect(validationMessage(new Map())).toBeNull()
  })

  test('V5 the banner is OWNED, so it cannot clear somebody else\'s message', () => {
    expect(VALIDATION_OWNER).toBe('validation')
  })
})

describe('D: customer documents', () => {
  test('D4 both a name and a link are required, and the words say both', () => {
    const refused = (n: string, u: string) => {
      const r = customerDocInput(n, u)
      expect(r.ok, `"${n}" / "${u}" was accepted`).toBe(false)
      return r.ok ? '' : r.error
    }
    expect(refused('', 'http://x')).toMatch(/name and a link are both required/i)
    expect(refused('Site drawings', '')).toMatch(/name and a link are both required/i)
    expect(refused('  ', '  ')).toMatch(/required/i)
  })

  test('D4 a complete pair is accepted, trimmed', () => {
    expect(customerDocInput('  Site drawings ', ' http://x ')).toEqual({
      ok: true, name: 'Site drawings', url: 'http://x',
    })
  })

  test('D3 removal is keyed on the row ID, never the name', () => {
    expect(customerDocRoute('tb-1', 'doc-9')).toBe('/api/test-beds/tb-1/customer-documents/doc-9')
    expect(CUSTOMER_DOCS_ROUTE('tb-1')).toBe('/api/test-beds/tb-1/customer-documents')
  })
})

describe('N: install notes', () => {
  const existing = [{ text: 'older', at: '2026-01-01', by: 'a@b' }]

  test('N2 a note is prepended, so the list is NEWEST FIRST', () => {
    const next = addInstallNote(existing, 'newer', 'me@x', '2026-02-02')
    expect(next?.map((n) => n.text)).toEqual(['newer', 'older'])
  })

  test('N3 a blank note is not written at all', () => {
    expect(addInstallNote(existing, '   ', 'me@x', '2026-02-02')).toBeNull()
  })

  test('N4 the note carries when and who', () => {
    const next = addInstallNote(undefined, 'first', 'me@x', '2026-02-02')
    expect(next?.[0]).toMatchObject({ text: 'first', by: 'me@x', at: '2026-02-02' })
  })
})

describe('H: revision history', () => {
  // H2: the fixture carries entries the SERVER would have ordered, and the
  // assertion is that the client preserves them - not that it sorts.
  const ENTRIES = [
    { id: '3', timestamp: '2026-03-03T11:22:33Z', action: 'stage_changed', actor_id: 'abcdefgh-1111', detail: { to: 'Site Assessment' } },
    { id: '2', timestamp: '2026-02-02T10:00:00Z', action: 'revision_appended', actor_id: 'zyxwvuts-2222', detail: {} },
    { id: '1', timestamp: '2026-01-01T09:15:00Z', action: 'record_created', actor_id: 'qrstuvwx-3333', detail: { by: 'seed' } },
  ]

  test('H2 the SERVER\'s order is preserved, not re-imposed', () => {
    expect(historyRows(ENTRIES).map((r) => r.id)).toEqual(['3', '2', '1'])
  })

  test('H2 and a list the client would sort DIFFERENTLY is still left alone', () => {
    // The distinguishing fixture: ascending input. A client that sorted would
    // return it descending; one that preserves returns it as given.
    const ascending = [...ENTRIES].reverse()
    expect(historyRows(ascending).map((r) => r.id),
      'the client re-sorted, so it is a second reader of the order').toEqual(['1', '2', '3'])
  })

  test('H5 four columns, and R7\'s timestamp in the reader\'s own time', () => {
    const r = historyRows(ENTRIES)[0]
    // R7 supersedes "cut to minutes and the T replaced", which rendered UTC.
    // EXPRESSED, NOT RESTATED (Verification 20): the shape is asserted, and
    // the hour is derived from the same input rather than typed, so the test
    // is not a second reader of the formatter's own arithmetic.
    expect(r.whenText).toMatch(/^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/)
    const local = new Date(ENTRIES[0].timestamp as string)
    expect(r.whenText.slice(9, 11)).toBe(String(local.getHours()).padStart(2, '0'))
    expect(r.whenText).not.toContain('T')
    expect(r.action).toBe('stage_changed')
    expect(r.actor).toBe('abcdefgh')
    expect(r.detail).toBe('{"to":"Site Assessment"}')
  })

  test('H5 an EMPTY detail object renders as nothing, not as {}', () => {
    expect(historyRows(ENTRIES)[1].detail, 'an empty detail printed braces').toBe('')
  })

  test('H4 the count is singular-aware', () => {
    expect(historyCount(1)).toBe('1 entry.')
    expect(historyCount(3)).toBe('3 entries.')
    expect(historyCount(0)).toBe('0 entries.')
  })

  test('R3 a field-change entry renders as PROSE, not as JSON', () => {
    const rows = historyRows([{
      id: 'a', action: 'fields_changed', timestamp: '2026-09-15T10:00:00Z',
      detail: { changes: { city: { from: 'KL', to: 'Jakarta' } }, revision: 4 },
    }])
    expect(rows[0].detail).toBe('city changed from KL to Jakarta.')
    expect(rows[0].detail.includes('{'), 'raw JSON reached the screen').toBe(false)
  })

  test('R3 it uses the label the SCREEN uses, when the host supplies one', () => {
    // The key is the FALLBACK, deliberately: the host owns the vocabulary, and
    // a second label table here would agree today and drift (Verification 20).
    const rows = historyRows(
      [{ id: 'a', action: 'fields_changed', detail: { changes: { ssUnitCost: { from: null, to: '90' } } } }],
      (k) => (k === 'ssUnitCost' ? 'SafeSight Unit Cost' : k))
    expect(rows[0].detail).toBe('SafeSight Unit Cost changed from not recorded to 90.')
  })

  test('R3 an absent value reads NOT RECORDED, the way the screens say it', () => {
    const rows = historyRows([{ id: 'a', action: 'fields_changed',
      detail: { changes: { city: { from: null, to: null } } } }])
    expect(rows[0].detail).toBe('city changed from not recorded to not recorded.')
  })

  test('R3 every OTHER action keeps its raw render', () => {
    // The paired negative: composing prose must not swallow the actions whose
    // wording is still undecided, which is what the notice promises.
    const rows = historyRows([{ id: 'a', action: 'transition', detail: { from: 'draft', to: 'active' } }])
    expect(rows[0].detail).toBe('{"from":"draft","to":"active"}')
  })

  test('R3 several changed fields read as several sentences', () => {
    const rows = historyRows([{ id: 'a', action: 'fields_changed', detail: { changes: {
      city: { from: 'KL', to: 'Jakarta' }, country: { from: 'MY', to: 'ID' },
    } } }])
    expect(rows[0].detail).toBe('city changed from KL to Jakarta. country changed from MY to ID.')
  })

  test('H3 the notice separates what IS decided from what is not', () => {
    // R3 decided the wording for ONE action, so the notice can no longer say
    // every entry is raw. It must still caveat the rest: a notice that stopped
    // saying "undecided" would overclaim in the other direction.
    expect(HISTORY_NOTICE, 'the notice no longer says field changes are server-worded')
      .toMatch(/Field changes are written and worded by the server/)
    expect(HISTORY_NOTICE, 'the notice dropped its caveat for every other action')
      .toMatch(/raw audit entries, unedited/)
    expect(HISTORY_NOTICE, 'the notice now claims the whole panel is decided')
      .toMatch(/not decided yet/)
  })
})
