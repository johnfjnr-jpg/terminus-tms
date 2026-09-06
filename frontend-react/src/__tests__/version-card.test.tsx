// ── THE VERSION CARD, AGAINST PHASE 0'S ENUMERATION ──────────────────────
//
// Every test names the behaviour it covers. The enumeration was written from
// the vanilla BEFORE this component existed, so these are derived from the
// contract rather than from the implementation.
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { VersionCard } from '../versions/VersionCard'
import type { AskReporter } from '../versions/VersionCard'
import { aVersion, aPendingApproval, allFixtureOnlyVersions, FIXTURE_ONLY_STATES, resetVersionIds }
  from './version-fixtures'
import type { DealVersion, PendingApproval } from '../versions/model'

let host: HTMLElement
interface Props {
  versions?: DealVersion[]
  pending?: PendingApproval | null
  gateApplies?: boolean
  onSave?: (reason: string) => Promise<void> | void
  onIssue?: () => Promise<void> | void
  onRestore?: (id: string) => Promise<void> | void
  onAsk?: (id: string, label: string, reporter: AskReporter) => void
  feedback?: { text: string, ok: boolean } | null
}
let currentRoot: Root
const render = (p: Props) => (
  <VersionCard
      versions={p.versions ?? []}
      pending={p.pending ?? null}
      gateApplies={p.gateApplies ?? true}
      onSave={p.onSave ?? (() => {})}
      onIssue={p.onIssue ?? (() => {})}
    onRestore={p.onRestore ?? (() => {})}
    onAsk={p.onAsk ?? (() => {})} />
)
const mount = async (p: Props = {}) => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
  currentRoot = createRoot(host)
  await act(async () => { currentRoot.render(render(p)) })
}
/** A re-render of the SAME tree, which is what a parent state change causes. */
const rerender = async (p: Props = {}) => {
  await act(async () => { currentRoot.render(render(p)) })
}
const el = (id: string) => host.querySelector(`#${id}`) as HTMLElement | null
const must = (id: string) => { const e = el(id); if (!e) throw new Error(`no #${id}`); return e }
const rows = () => [...host.querySelectorAll('.ds-row')]
const type = async (id: string, v: string) => {
  const e = must(id) as HTMLTextAreaElement
  const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => { set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })) })
}
// SIX distinct versions, so a range of five hides exactly one and the
// singular/plural branch is reachable.
const six = () => Array.from({ length: 6 }, (_, i) =>
  aVersion({ major: 0, minor: 6 - i, reason: `reason ${6 - i}` }))
beforeEach(() => resetVersionIds())

describe('R: the range toggle and its note', () => {
  test('R1: the toggle is hidden at the floor and shown above it', async () => {
    await mount({ versions: six().slice(0, 5) })
    expect(must('deal-version-range').classList.contains('hidden')).toBe(true)
    await mount({ versions: six() })
    expect(must('deal-version-range').classList.contains('hidden')).toBe(false)
  })

  test('R2: exactly the active range is marked, by data-range', async () => {
    await mount({ versions: six() })
    const active = () => [...must('deal-version-range').querySelectorAll('button')]
      .filter((b) => b.classList.contains('active')).map((b) => b.dataset.range)
    expect(active()).toEqual(['5'])
    await act(async () => {
      (must('deal-version-range').querySelector('[data-range="all"]') as HTMLElement).click()
    })
    expect(active()).toEqual(['all'])
  })

  test('R3: five shows the newest five; all shows all', async () => {
    await mount({ versions: six() })
    expect(rows()).toHaveLength(5)
    // Newest FIRST: the list is given newest-first and the range takes the head.
    expect(rows()[0].textContent).toContain('V0.6')
    await act(async () => {
      (must('deal-version-range').querySelector('[data-range="all"]') as HTMLElement).click()
    })
    expect(rows()).toHaveLength(6)
  })

  test('R4: the note counts what is hidden, and pluralises on THAT', async () => {
    await mount({ versions: six() })
    expect(must('deal-version-range-note').textContent)
      .toBe('Showing 5 of 6 versions. 1 older version is not listed.')
    await mount({ versions: [...six(), aVersion({ major: 0, minor: 0 })] })
    expect(must('deal-version-range-note').textContent)
      .toBe('Showing 5 of 7 versions. 2 older versions are not listed.')
  })

  test('R5/R6: all-shown says so ABOVE the floor, and is hidden at or below it', async () => {
    await mount({ versions: six() })
    await act(async () => {
      (must('deal-version-range').querySelector('[data-range="all"]') as HTMLElement).click()
    })
    expect(must('deal-version-range-note').textContent).toBe('Showing all 6 versions.')
    expect(must('deal-version-range-note').classList.contains('hidden')).toBe(false)
    await mount({ versions: six().slice(0, 5) })
    expect(must('deal-version-range-note').textContent).toBe('')
    expect(must('deal-version-range-note').classList.contains('hidden')).toBe(true)
  })
})

describe('W: the row', () => {
  test('W1/W2: one row per shown version, labelled and stated', async () => {
    await mount({ versions: [aVersion({ major: 2, minor: 0, status: 'issued' }), aVersion({ major: 2, minor: 1 })] })
    expect(rows()).toHaveLength(2)
    expect(rows()[0].textContent).toContain('V2')
    expect(rows()[0].textContent).toContain('issued')
    expect(rows()[1].textContent).toContain('V2.1')
    expect(rows()[1].textContent).toContain('draft')
  })

  test('W3: the author is the issuer for an issued version and the creator otherwise', async () => {
    await mount({ versions: [aVersion({ status: 'issued', author: 'issuer@x.invalid' })] })
    expect(rows()[0].textContent).toContain('issuer@x.invalid')
    await mount({ versions: [aVersion({ status: 'draft', author: 'drafter@x.invalid' })] })
    expect(rows()[0].textContent).toContain('drafter@x.invalid')
  })

  test('and an absent author says so rather than rendering nothing', async () => {
    const v = aVersion({ status: 'draft' })
    v.created_by_email = null
    await mount({ versions: [v] })
    expect(rows()[0].textContent).toContain('unknown author')
  })

  test('W5: the section count pluralises and carries the full list in the title', async () => {
    await mount({ versions: [aVersion({ sections: ['A', 'B', 'C'] })] })
    const note = rows()[0].querySelector('[title]') as HTMLElement
    expect(note.textContent).toBe('3 sections recorded')
    expect(note.title).toBe('A, B, C')
    await mount({ versions: [aVersion({ sections: ['Only'] })] })
    expect((rows()[0].querySelector('[title]') as HTMLElement).textContent).toBe('1 section recorded')
  })

  test('W6: EVERY row carries a restore control, in every state', async () => {
    await mount({ versions: allFixtureOnlyVersions() })
    // SIX states against a default range of five shows five, which is R3
    // working. The claim here is about every ROW, so the range opens first.
    await act(async () => {
      (must('deal-version-range').querySelector('[data-range="all"]') as HTMLElement).click()
    })
    expect(rows()).toHaveLength(FIXTURE_ONLY_STATES.length)
    for (const r of rows()) {
      const btn = r.querySelector('[data-restore-version]') as HTMLButtonElement | null
      expect(btn, 'a row lost its restore').not.toBeNull()
      // Presence is not availability: a hidden or disabled control still
      // matches a selector, and the calibration that hid it came back silent.
      expect(btn!.hidden, 'the restore is present but hidden').toBe(false)
      expect(btn!.disabled, 'the restore is present but disabled').toBe(false)
      expect(btn!.closest('[hidden]'), 'the restore sits inside a hidden parent').toBeNull()
    }
  })

  test('W7: a reason carrying markup is TEXT, never markup', async () => {
    await mount({ versions: [aVersion({ reason: '<img src=x onerror=alert(1)>bad' })] })
    expect(rows()[0].querySelector('img'), 'the reason was emitted as markup').toBeNull()
    expect(rows()[0].textContent).toContain('<img src=x onerror=alert(1)>bad')
  })
})

describe('A: the approval line, all seven states', () => {
  test('each state renders its own sentence', async () => {
    await mount({ versions: allFixtureOnlyVersions() })
    await act(async () => {
      (must('deal-version-range').querySelector('[data-range="all"]') as HTMLElement).click()
    })
    const text = host.textContent ?? ''
    expect(text).toContain('and the pricing has not changed since.')
    expect(text).toContain('SUPERSEDED.')
    expect(text).toContain('could not be determined')
    expect(text).toContain('Rejected at revision 37.')
    expect(text).toContain('so it cannot be approved.')
    expect(text).toContain('which this record has not reached')
  })

  test("'none' is its own sentence, distinct from having no approval at all", async () => {
    await mount({ versions: [aVersion({ approval: 'none' })] })
    expect(rows()[0].textContent).toContain('Not yet approved.')
    await mount({ versions: [aVersion()] })
    expect(rows()[0].textContent).not.toContain('Not yet approved.')
  })

  test('superseded NAMES what moved, through the shared reader', async () => {
    await mount({ versions: [aVersion({ approval: 'superseded',
      changedKeys: ['targetMargin', 'duration', 'gstPct', 'whtPct', 'warrantyPct'] })] })
    // namedChangedKeys names three and counts the rest: asserted as a shape so
    // this does not restate its rule.
    expect(rows()[0].textContent).toMatch(/ and \d+ more\./)
  })
})

describe('T: the track line', () => {
  test('T1: it renders ONLY on the version the open request froze', async () => {
    const vs = [aVersion({ major: 1, minor: 0, status: 'issued' }), aVersion({ major: 1, minor: 1 })]
    await mount({ versions: vs, pending: aPendingApproval({ frozen_version_id: vs[0].id }) })
    expect(rows()[0].textContent).toContain('Under approval since')
    expect(rows()[1].textContent).not.toContain('Under approval since')
  })

  test('T2: decided tracks read their decision, undecided read waiting, rejection SHOUTS', async () => {
    const v = aVersion({ major: 1, minor: 0, status: 'issued' })
    await mount({ versions: [v], pending: aPendingApproval({ frozen_version_id: v.id,
      decisions: [{ track: 'Commercial', decision: 'approved' }, { track: 'Legal', decision: 'rejected' }] }) })
    const t = rows()[0].textContent ?? ''
    expect(t).toContain('Commercial approved')
    expect(t).toContain('Legal REJECTED')
    expect(t).toContain('Technical waiting')
  })

  test('T3: no required tracks renders nothing, not a bare prefix', async () => {
    const v = aVersion({ major: 1, minor: 0, status: 'issued' })
    await mount({ versions: [v], pending: aPendingApproval({ frozen_version_id: v.id, required: [] }) })
    expect(rows()[0].textContent).not.toContain('Under approval since')
  })

  test('T4: a missing request date says so rather than rendering an invalid one', async () => {
    const v = aVersion({ major: 1, minor: 0, status: 'issued' })
    await mount({ versions: [v], pending: aPendingApproval({ frozen_version_id: v.id, requested_at: null }) })
    expect(rows()[0].textContent).toContain('an unknown time')
  })
})

describe('I: the issue control', () => {
  test('I1: the target is the newest draft, NOT the latest one', async () => {
    // A stranded V2.1 draft with V3 issued: the latest draft is V2.1, and the
    // newest draft at the issued major is none, so nothing may be issued.
    await mount({ versions: [
      aVersion({ major: 3, minor: 0, status: 'issued' }),
      aVersion({ major: 2, minor: 1, status: 'draft' })] })
    expect((must('btn-issue-version') as HTMLButtonElement).disabled).toBe(true)
    expect(must('btn-issue-version').textContent).toBe('Save a new version to issue')
  })

  test('I2/I3: a draft AT the issued major is the target, and the label names both', async () => {
    await mount({ versions: [
      aVersion({ major: 3, minor: 1, status: 'draft' }),
      aVersion({ major: 3, minor: 0, status: 'issued' })] })
    const btn = must('btn-issue-version') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('Issue V3.1 as V4')
  })

  test('I4: the two empty titles say different things', async () => {
    await mount({ versions: [aVersion({ major: 3, minor: 0, status: 'issued' })] })
    expect(must('btn-issue-version').title).toContain('there is no newer draft')
    await mount({ versions: [] })
    expect(must('btn-issue-version').title).toContain('Save a version first')
  })

  test('I5: the gate hides the control entirely', async () => {
    await mount({ versions: six(), gateApplies: false })
    expect(must('btn-issue-version').classList.contains('hidden')).toBe(true)
  })
})

describe('E: the empty state', () => {
  test('E1: it names the act and the label that act produces', async () => {
    await mount({ versions: [] })
    expect(host.textContent).toContain('No versions saved yet. V0.1 is the first.')
    expect(rows()).toHaveLength(0)
  })
})

describe('N: the reason box', () => {
  test('N1: a blank reason refuses, writes nothing, and says what is wanted', async () => {
    const onSave = vi.fn()
    await mount({ versions: [], onSave })
    await act(async () => { must('btn-save-version').click() })
    expect(onSave, 'a blank reason still wrote').not.toHaveBeenCalled()
    expect(must('deal-version-feedback').textContent).toContain('what is this price based on?')
    expect(must('deal-version-feedback').className).toBe('msg-error')
  })

  test('N2: the prompt CHANGES with the version count, from the shared module', async () => {
    await mount({ versions: [] })
    const first = must('deal-version-reason').getAttribute('placeholder')
    const firstLabel = host.querySelector('label[for="deal-version-reason"]')!.textContent
    await mount({ versions: [aVersion()] })
    expect(must('deal-version-reason').getAttribute('placeholder')).not.toBe(first)
    expect(host.querySelector('label[for="deal-version-reason"]')!.textContent).not.toBe(firstLabel)
  })

  test('N3: a successful save clears the box; a refused one does not', async () => {
    await mount({ versions: [], onSave: () => {} })
    await type('deal-version-reason', 'the quote of 4 March')
    await act(async () => { must('btn-save-version').click() })
    expect((must('deal-version-reason') as HTMLTextAreaElement).value).toBe('')

    await mount({ versions: [], onSave: () => { throw new Error('refused by the server') } })
    await type('deal-version-reason', 'kept')
    await act(async () => { must('btn-save-version').click() })
    expect((must('deal-version-reason') as HTMLTextAreaElement).value,
      'a refused save threw the reason away').toBe('kept')
  })
})

describe('F: the feedback line', () => {
  test('F1: ok, error and empty are exclusive by construction', async () => {
    await mount({ versions: [], onSave: () => {} })
    expect(must('deal-version-feedback').className).toBe('hidden')
    await act(async () => { must('btn-save-version').click() })
    expect(must('deal-version-feedback').className).toBe('msg-error')
    await type('deal-version-reason', 'a real reason')
    await act(async () => { must('btn-save-version').click() })
    expect(must('deal-version-feedback').className).toBe('msg-success')
  })

  test("and a refusal's own words are shown, not a generic sentence", async () => {
    await mount({ versions: [], onSave: () => { throw new Error('the contractor schedule is under by $187,500') } })
    await type('deal-version-reason', 'x')
    await act(async () => { must('btn-save-version').click() })
    expect(must('deal-version-feedback').textContent).toContain('under by $187,500')
  })
})

describe('P: the pricing-approval control, against the reporter interface', () => {
  test('an open request disables the ask and says which version is waiting', async () => {
    const v = aVersion({ major: 1, minor: 0, status: 'issued' })
    await mount({ versions: [v], pending: aPendingApproval({ label: 'V1', frozen_version_id: v.id }) })
    expect((must('btn-request-pricing-approval') as HTMLButtonElement).disabled).toBe(true)
    expect(must('pricing-approval-state').textContent).toBe('V1 is awaiting approval.')
  })

  test('with nothing issued it says to issue first', async () => {
    await mount({ versions: [aVersion()] })
    expect((must('btn-request-pricing-approval') as HTMLButtonElement).disabled).toBe(true)
    expect(must('pricing-approval-state').textContent).toBe('Issue a version before requesting approval.')
  })

  test('an issued version with a NEWER draft refuses, and says why it would be wrong', async () => {
    await mount({ versions: [
      aVersion({ major: 1, minor: 1, status: 'draft' }),
      aVersion({ major: 1, minor: 0, status: 'issued' })] })
    expect(must('pricing-approval-state').textContent)
      .toContain('not of the price on screen')
  })

  test('an already-approved version says so and does not offer to ask again', async () => {
    await mount({ versions: [aVersion({ major: 2, minor: 0, status: 'issued', approval: 'approved' })] })
    expect((must('btn-request-pricing-approval') as HTMLButtonElement).disabled).toBe(true)
    expect(must('pricing-approval-state').textContent).toBe('V2 is already approved.')
  })

  test('and an issued version with nothing in the way CAN be asked for', async () => {
    const onAsk = vi.fn()
    await mount({ versions: [aVersion({ major: 2, minor: 0, status: 'issued', approval: 'none' })], onAsk })
    const btn = must('btn-request-pricing-approval') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toBe('Request approval of V2')
    await act(async () => { btn.click() })
    expect(onAsk).toHaveBeenCalledTimes(1)
  })

  test('THE REPORTER OWNS THE BUTTON WHILE A REQUEST IS IN FLIGHT', async () => {
    // Phase 0's sharpest finding: app.js drives this button and this line by id
    // while a request is in flight. The card hands over an INTERFACE instead,
    // and must not take control back on the next render.
    let reporter: AskReporter | null = null
    const onAsk = vi.fn((_id: string, _label: string, r: AskReporter) => { reporter = r })
    const props = { versions: [aVersion({ major: 2, minor: 0, status: 'issued', approval: 'none' as const })], onAsk }
    await mount(props)
    const btn = () => must('btn-request-pricing-approval') as HTMLButtonElement
    expect(btn().disabled).toBe(false)

    await act(async () => { btn().click() })
    expect(onAsk).toHaveBeenCalledTimes(1)
    await act(async () => { reporter!.onStart() })
    expect(btn().disabled, 'the card did not hand over').toBe(true)
    expect(btn().textContent).toBe('Requesting...')

    // A RE-RENDER MID-REQUEST, which is what any parent state change causes.
    await rerender(props)
    expect(btn().disabled, 'a re-render re-enabled the button mid-request').toBe(true)
    expect(btn().textContent).toBe('Requesting...')

    // And the reporter's outcome is what ends it.
    await act(async () => { reporter!.onResult('V2 sent for approval.', true) })
    expect(btn().disabled).toBe(false)
    expect(must('pricing-approval-state').textContent).toBe('V2 sent for approval.')
  })

  test('I5 applies here too: the gate hides the ask and its state line', async () => {
    await mount({ versions: [aVersion({ major: 1, minor: 0, status: 'issued' })], gateApplies: false })
    expect(must('btn-request-pricing-approval').classList.contains('hidden')).toBe(true)
    expect(must('pricing-approval-state').classList.contains('hidden')).toBe(true)
  })
})

// ── SUPERSEDED BY THE SWAP, Round 4 Phase 2. Claim changed by instruction ─
//
// It read: Phase 1 builds it and registers NOTHING, and asserted the bundle did
// not expose `initOpportunityDealVersions`. That was correct for Phase 1 and is
// the guard that kept the card behind the line while it was built.
//
// Phase 2 registers it deliberately. The reasoning is kept because the
// replacement has to say what it now protects: the ENTRY IS UNCHANGED, so the
// form's init hands the card its seam exactly as it handed the vanilla one.
describe('the card is registered, and the entry is unchanged', () => {
  test('the bundle registers initOpportunityDealVersions', async () => {
    await import('../main')
    const w = window as unknown as Record<string, unknown>
    expect(typeof w.initOpportunityDealVersions,
      'the bundle does not register the card, so the form hands its seam to nothing')
      .toBe('function')
  })
})
