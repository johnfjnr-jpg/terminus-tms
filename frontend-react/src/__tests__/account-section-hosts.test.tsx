// ── R6 + R2: THE ACCOUNT, FROM THE ROUTE'S OWN DERIVATION ────────────────
//
// Derived from the ruling, not from the components. The requirement:
//
//   R6  a linked contact shows its ACCOUNT NAME. The bespoke screen read
//       `record.account?.name`, no route returned an `account`, and all ten
//       live Qualified contacts were therefore told "Not linked".
//   R2  the section is contact-only on the lead card, decided by the
//       RECORD; and on the screen where an account is LINKED, the unlinked
//       state must keep its control.
//
// Verification 14's clause: "shows the name" is paired with "and does NOT
// say Not linked", because a surface rendering both would pass the first.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AccountSection } from '../leads/AccountSection'
import { ContactPanel } from '../contact/ContactPanel'
import { ShellProvider } from '../ShellContext'
import type { ShellServices } from '../shell-services'
import { shellServices } from './fixtures'

let host: HTMLElement
let root: Root
const must = (t: string) => {
  const el = host.querySelector(`[data-testid="${t}"]`)
  if (!el) throw new Error(`no ${t}`)
  return el as HTMLElement
}
const SOURCE = { payload: { name: 'Ada Lovelace', email: 'a@b.com' }, industryId: null, industries: [] }
const ACC = { id: 'acc-1', name: 'Singapore Instutue of Technology' }

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => { root.unmount() }); host.remove() })

const services: ShellServices = shellServices({
  canEditFields: () => true,
  currentUserEmail: () => 'probe@example.invalid',
  confirmDiscard: (p: () => void) => { p() },
})
const render = async (el: React.ReactElement) => {
  await act(async () => { root.render(<ShellProvider services={services}>{el}</ShellProvider>) })
}

describe('R6: the account reaches the screen', () => {
  test('R6-1 a linked contact shows its ACCOUNT NAME on the bespoke screen', async () => {
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={ACC} parentRecordId="acc-1" onSave={() => {}} />)
    expect(must('cd-account-status').textContent).toBe('Singapore Instutue of Technology')
  })

  test('R6-2 and does NOT say "Not linked" - V14: the pair, not the half', async () => {
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={ACC} parentRecordId="acc-1" onSave={() => {}} />)
    expect(must('cd-card-account').textContent).not.toMatch(/not linked/i)
  })

  test('R6-3 a contact whose account will NOT resolve says so, naming the id', async () => {
    // Distinguished from absence on purpose: collapsing the two is the
    // defect this round fixes, wearing a friendlier face.
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={null} parentRecordId="acc-deadbeef-0000" onSave={() => {}} />)
    const t = must('cd-account-status').textContent ?? ''
    expect(t).toMatch(/could not be resolved/i)
    expect(t).not.toMatch(/not linked/i)
    expect(t).toContain('acc-dead')
  })

  test('R6-4 "Not linked" is said where linking is OFFERED, and only there', async () => {
    // WRITTEN AS A PAIR, and the first half failed on its first run - which
    // is what made the render rule explicit rather than incidental.
    //
    // The naive version asserted "Not linked" with nothing on offer. That
    // contradicts R2: a record with no account and no control has nothing
    // to say, and saying it anyway is the empty card R2 removes. The state
    // the requirement DOES name is the linking screen, where the sentence
    // is the label on a control.
    //
    // `ContactHost` passes `linkPanel` unconditionally, so this is the
    // production shape and not a contrivance.
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={null} parentRecordId={null} onSave={() => {}}
      linkPanel={<button data-testid="the-link-control">Link</button>} />)
    expect(must('cd-account-status').textContent).toMatch(/not linked/i)

    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={null} parentRecordId={null} onSave={() => {}} />)
    expect(host.querySelector('[data-testid="cd-card-account"]'),
      'nothing to say and nothing to offer renders no section').toBeNull()
  })
})

describe('R2: the render rule, both hosts', () => {
  test('R2-1 a LEAD with nothing on offer renders no section at all', async () => {
    await render(<AccountSection account={null} parentRecordId={null} testid="acc" />)
    expect(host.querySelector('[data-panel="account"]')).toBeNull()
  })

  test('R2-2 an UNLINKED record on the linking screen KEEPS its link control', async () => {
    // The regression the render rule protects. Dropping the section for a
    // record with no parent would take the link panel with it, and
    // probe-gated-fields-reachable names cd-card-account as
    // parent_record_id's own container.
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={null} parentRecordId={null} onSave={() => {}}
      linkPanel={<button data-testid="the-link-control">Link</button>} />)
    expect(must('cd-card-account')).toBeTruthy()
    expect(must('the-link-control')).toBeTruthy()
  })

  test('R6-5 the section carries THE SAME FRAME its sibling cards carry', async () => {
    // Verification 4, and the automatable half of it: the assertion is a
    // RELATIONSHIP between elements, never a property of one. "has pg-card"
    // would pass on a screen where nothing else did.
    //
    // The defect it fires on shipped and was found by opening the
    // screenshot: swapping Card for the panel shell dropped the frame, so
    // the account name hung outside any border while all five siblings were
    // framed, and the link control below it was clipped.
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={ACC} parentRecordId="acc-1" onSave={() => {}} />)
    const frame = (t: string) => [...must(t).classList].filter((c) => /card/.test(c)).sort().join(' ')
    expect(frame('cd-card-account'), 'the account section is framed like its siblings')
      .toBe(frame('cd-card-contact'))
    expect(frame('cd-card-account'), 'and the frame is a real class, not two empty strings agreeing')
      .not.toBe('')
  })

  test('R2-3 the section is ONE component, so both hosts carry the panel registry mark', async () => {
    // Verification 20: the lead card and the bespoke screen must not grow
    // two readers of "what is this record's account".
    await render(<ContactPanel source={SOURCE as never} blocking={null}
      account={ACC} parentRecordId="acc-1" onSave={() => {}} />)
    expect(must('cd-card-account').getAttribute('data-panel')).toBe('account')
  })
})
