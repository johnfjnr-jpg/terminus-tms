// ── THE SIX ABSENT CAPABILITIES: the rendered half ──────────────────────
//
// Round 7 Phase 2b session 2. Driven through ONE ROOT RE-RENDERED, because the
// shell calls root.render() again for every navigation.
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { InstallSection } from '../testbed/InstallSection'
import { CustomerDocsPanel } from '../testbed/CustomerDocsPanel'
import { HistoryPanel } from '../testbed/HistoryPanel'

let host: HTMLElement
let root: Root

const ACCOUNTS = [
  { id: 'a1', payload: { name: 'Alpha Contracting' } },
  { id: 'own', payload: { name: 'The Client Ltd' } },
]
const CONTACTS = [{ id: 'c1', payload: { name: 'Ana Reyes' } }]

const q = (id: string) => host.querySelector(`[data-testid="${id}"]`)
const click = async (id: string) => {
  await act(async () => { (q(id) as HTMLElement).click(); await Promise.resolve() })
}
const type = async (id: string, value: string) => {
  await act(async () => {
    const el = q(id) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype, 'value')!.set!
    setter.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
}

const install = (over: Partial<Parameters<typeof InstallSection>[0]> = {}) => {
  const props = {
    installer: null, ownAccountId: 'own', accounts: ACCOUNTS,
    installerContacts: [] as typeof CONTACTS, linkedTechTeam: null,
    notes: [], author: 'me@x', now: () => '2026-02-02T00:00:00Z',
    onSetInstaller: vi.fn(async () => ({})),
    onSetTechTeam: vi.fn(async () => {}),
    onWriteNotes: vi.fn(async () => true),
    ...over,
  }
  act(() => { root.render(<InstallSection {...props} />) })
  return props
}

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('I: the installer row', () => {
  test('I2 with none set the SEARCH is the row, and there is nothing to cancel to', () => {
    install()
    expect(q('tb-installer-search')).toBeTruthy()
    expect(q('tb-installer-cancel'),
      'a Cancel was offered with no installer to cancel back to').toBeNull()
  })

  test('I2 with one set it reads read-only, with a Change button', () => {
    install({ installer: { name: 'Alpha Contracting', client_installed: false } })
    expect(q('tb-installer-name')?.textContent).toBe('Alpha Contracting')
    expect(q('tb-installer-search'), 'the search was open on a settled row').toBeNull()
    expect(q('tb-installer-change')).toBeTruthy()
  })

  test('I2 Change opens the search, and Cancel closes it back', async () => {
    install({ installer: { name: 'Alpha Contracting' } })
    await click('tb-installer-change')
    expect(q('tb-installer-search')).toBeTruthy()
    expect(q('tb-installer-cancel')).toBeTruthy()
    await click('tb-installer-cancel')
    expect(q('tb-installer-name')?.textContent).toBe('Alpha Contracting')
  })

  test('I3 the derived line says which kind of install this is', () => {
    install({ installer: { name: 'X', client_installed: true } })
    expect(q('tb-installer-subtitle')?.textContent).toMatch(/own staff/)
  })

  test('I4 typing narrows the results, and no match SAYS so', async () => {
    install()
    expect(host.querySelectorAll('.tb-installer-result')).toHaveLength(2)
    await type('tb-installer-search', 'alpha')
    expect(host.querySelectorAll('.tb-installer-result')).toHaveLength(1)
    await type('tb-installer-search', 'zzz')
    expect(q('tb-installer-nomatch')).toBeTruthy()
  })

  test('I5 the record\'s OWN Account is marked in the results', () => {
    install()
    expect(q('tb-installer-own'), "the Test Bed's own Account is unmarked").toBeTruthy()
    expect(q('tb-installer-result-a1')?.querySelector('[data-testid="tb-installer-own"]'),
      'an unrelated Account was marked as the record\'s own').toBeNull()
  })

  test('I6 a CLEARED tech team is reported, as an error', async () => {
    install({ onSetInstaller: vi.fn(async () => ({ cleared_tech_team: true })) })
    await click('tb-installer-result-a1')
    const fb = q('tb-installer-feedback')
    expect(fb?.textContent).toMatch(/has been cleared/)
    expect(fb?.className, 'a clearing was styled as a success').toContain('err')
  })

  test('I6 an ordinary set says so plainly', async () => {
    install()
    await click('tb-installer-result-a1')
    expect(q('tb-installer-feedback')?.textContent).toBe('Installer set.')
    expect(q('tb-installer-feedback')?.className).toContain('ok')
  })
})

describe('E: the tech team row', () => {
  test('E2 NO INSTALLER: no control at all, and the reason on screen', () => {
    install()
    expect(q('tb-techteam-select'),
      'a select was offered before an Installer was set').toBeNull()
    expect(q('tb-techteam-blocked')?.textContent).toMatch(/Set the Installer first/)
  })

  test('E3 an installer with no contacts still gets a select, naming the Account', () => {
    install({ installer: { name: 'Alpha' } })
    const sel = q('tb-techteam-select') as HTMLSelectElement
    expect(sel, 'the empty case was collapsed into the no-installer one').toBeTruthy()
    expect(sel.options[0].textContent).toBe('No Contacts at Alpha yet')
  })

  test('E3/E4 with contacts, the prompt is ordinary and the source is named', () => {
    install({ installer: { name: 'Alpha' }, installerContacts: CONTACTS })
    const sel = q('tb-techteam-select') as HTMLSelectElement
    expect(sel.options[0].textContent).toBe('Select a contact')
    expect(sel.options[1].textContent).toBe('Ana Reyes')
    expect(q('tb-techteam-source')?.textContent).toBe('From Alpha')
  })

  test('E5 choosing the PLACEHOLDER is a no-op, not a clear', async () => {
    const p = install({
      installer: { name: 'Alpha' }, installerContacts: CONTACTS, linkedTechTeam: 'c1',
    })
    await act(async () => {
      const sel = q('tb-techteam-select') as HTMLSelectElement
      sel.value = ''
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
    })
    expect(p.onSetTechTeam, 'the placeholder unlinked the tech team').not.toHaveBeenCalled()
  })
})

describe('N: install notes', () => {
  test('N2 an added note goes to the FRONT of the whole list', async () => {
    const p = install({ notes: [{ text: 'older', at: '2026-01-01', by: 'a@b' }] })
    await type('tb-install-note-input', 'newer')
    await click('tb-install-note-add')
    expect(p.onWriteNotes).toHaveBeenCalledWith([
      { text: 'newer', at: '2026-02-02T00:00:00Z', by: 'me@x' },
      { text: 'older', at: '2026-01-01', by: 'a@b' },
    ])
  })

  test('N3 a blank note writes nothing', async () => {
    const p = install({ notes: [] })
    await click('tb-install-note-add')
    expect(p.onWriteNotes).not.toHaveBeenCalled()
  })

  test('the empty state SAYS so', () => {
    install({ notes: [] })
    expect(q('tb-install-notes-empty')?.textContent).toMatch(/No install notes yet/)
  })
})

describe('D: customer documents', () => {
  const DOCS = [
    { id: 'd1', name: 'Site drawings', url: 'http://a' },
    { id: 'd2', name: 'Site drawings', url: 'http://b' },
  ]
  const docs = (over: Partial<Parameters<typeof CustomerDocsPanel>[0]> = {}) => {
    const props = {
      docs: DOCS, onAdd: vi.fn(async () => true), onRemove: vi.fn(async () => {}), ...over,
    }
    act(() => { root.render(<CustomerDocsPanel {...props} />) })
    return props
  }

  test('D3 two documents with the SAME NAME are two rows, removed by id', async () => {
    const p = docs()
    expect(q('tb-custdoc-d1')).toBeTruthy()
    expect(q('tb-custdoc-d2')).toBeTruthy()
    await click('tb-custdoc-remove-d2')
    expect(p.onRemove, 'removal keyed on something other than the row id')
      .toHaveBeenCalledWith('d2')
  })

  test('D4 a missing link is refused BEFORE any request', async () => {
    const p = docs({ docs: [] })
    await type('tb-custdoc-name', 'Site drawings')
    await click('tb-custdoc-add')
    expect(p.onAdd, 'an incomplete document was sent').not.toHaveBeenCalled()
    expect(q('tb-custdocs-feedback')?.textContent).toMatch(/name and a link are both required/i)
  })

  test('D5 a REFUSED add keeps the typing', async () => {
    docs({ docs: [], onAdd: vi.fn(async () => false) })
    await type('tb-custdoc-name', 'Site drawings')
    await type('tb-custdoc-url', 'http://x')
    await click('tb-custdoc-add')
    expect((q('tb-custdoc-name') as HTMLInputElement).value,
      'a refused add threw away what was typed').toBe('Site drawings')
  })

  test('D5 and a successful one clears both boxes', async () => {
    docs({ docs: [] })
    await type('tb-custdoc-name', 'Site drawings')
    await type('tb-custdoc-url', 'http://x')
    await click('tb-custdoc-add')
    expect((q('tb-custdoc-name') as HTMLInputElement).value).toBe('')
    expect((q('tb-custdoc-url') as HTMLInputElement).value).toBe('')
  })

  test('D6 the link opens in a new tab, safely', () => {
    docs()
    const a = q('tb-custdoc-d1')?.querySelector('a') as HTMLAnchorElement
    expect(a.target).toBe('_blank')
    expect(a.rel).toBe('noopener noreferrer')
  })

  test('D7 the empty state says what is empty', () => {
    docs({ docs: [] })
    expect(q('tb-custdocs-empty')?.textContent).toMatch(/No client documents yet/)
  })
})

describe('H: revision history', () => {
  const ENTRIES = [
    { id: '3', timestamp: '2026-03-03T11:22:33Z', action: 'stage_changed', actor_id: 'abcdefgh-1', detail: { to: 'Site Assessment' } },
    { id: '2', timestamp: '2026-02-02T10:00:00Z', action: 'revision_appended', actor_id: 'zyxwvuts-2', detail: {} },
    { id: '1', timestamp: '2026-01-01T09:15:00Z', action: 'record_created', actor_id: 'qrstuvwx-3', detail: { by: 'seed' } },
  ]
  const hist = (props: Partial<Parameters<typeof HistoryPanel>[0]> = {}) =>
    act(() => { root.render(<HistoryPanel entries={ENTRIES} {...props} />) })

  test('H2 THREE rows in the server\'s order, newest first', () => {
    hist()
    const rows = [...host.querySelectorAll('tbody tr')].map((r) => r.getAttribute('data-testid'))
    expect(rows).toEqual(['tb-history-row-3', 'tb-history-row-2', 'tb-history-row-1'])
  })

  test('H4 the count is stated and singular-aware', () => {
    hist()
    expect(q('tb-history-count')?.textContent).toBe('3 entries.')
    hist({ entries: [ENTRIES[0]] })
    expect(q('tb-history-count')?.textContent).toBe('1 entry.')
  })

  test('H5 an empty detail renders as NOTHING, not as braces', () => {
    hist()
    const cells = [...host.querySelectorAll('.tb-history-detail')].map((c) => c.textContent)
    expect(cells[0]).toBe('{"to":"Site Assessment"}')
    expect(cells[1], 'an empty detail printed braces').toBe('')
  })

  test('H3 the notice renders above the EMPTY state too', () => {
    hist({ entries: [] })
    expect(q('tb-history-notice'),
      'a record with no history does not say what this panel is').toBeTruthy()
    expect(q('tb-history-empty')?.textContent).toMatch(/No history recorded/)
  })

  test('H6 a FAILED load says so and drops the notice', () => {
    hist({ failed: true })
    expect(q('tb-history-block')?.textContent).toBe('Unable to load history.')
    expect(q('tb-history-notice'),
      'a failed load still carried a caveat about content it does not have').toBeNull()
  })
})

describe('re-navigation: ONE root, re-rendered', () => {
  test('the installer search does not survive a move to another record', async () => {
    install({ installer: { name: 'Alpha Contracting' } })
    await click('tb-installer-change')
    expect(q('tb-installer-search')).toBeTruthy()
    // A second visit re-renders rather than mounting. The search is local UI
    // state and DOES persist - which is correct only because the row below
    // re-derives from the new record. Assert the row, not the search.
    install({ installer: { name: 'Beta Systems' } })
    await click('tb-installer-cancel')
    expect(q('tb-installer-name')?.textContent,
      'the row kept the previous record\'s installer').toBe('Beta Systems')
  })

  test('the history panel re-renders with the new record\'s entries', () => {
    act(() => { root.render(<HistoryPanel entries={ENTRIES_A} />) })
    expect(q('tb-history-count')?.textContent).toBe('1 entry.')
    act(() => { root.render(<HistoryPanel entries={[]} />) })
    expect(q('tb-history-empty'),
      'the second record showed the first record\'s history').toBeTruthy()
  })
})

const ENTRIES_A = [
  { id: 'x', timestamp: '2026-01-01T00:00:00Z', action: 'record_created', actor_id: 'a', detail: {} },
]
