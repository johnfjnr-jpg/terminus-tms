// ── R2: THE ACCOUNT SECTION ──────────────────────────────────────────────
//
// A contact has an account; a lead does not - it gets one at qualification.
// So this renders for a record that HAS one and not for a record that does
// not, and the surface asks for it by passing the record.
//
// ── ONE SOURCE, AND THE MEASUREMENT THAT MADE IT A RULE ──────────────────
//
// The bespoke screen reads `record.account?.name`. **No route returns an
// `account` object** - not `GET /api/contacts/:id`, not `GET /api/contacts`
// - so it resolves to `undefined` and the card renders "Not linked".
// Measured at this round's baseline: **all ten live Qualified contacts have
// a `parent_record_id`, and the screen tells every one of them they have no
// account.**
//
// Verification 20: two readers of one value, and the second was reading a
// key nobody writes. The truth is `records.parent_record_id`, so that is
// what this reads.
//
// ── AND THE SECOND HOST CHANGED THE RENDER RULE, ON MEASUREMENT ──────────
//
// R2 was written for the lead card, where "renders for a contact, not for a
// lead" is the whole rule. The bespoke contact screen is the surface where
// an account is LINKED, and there the unlinked state is the one that needs
// a control. Dropping the section for a record with no parent would have
// taken the link panel with it - and `probe-gated-fields-reachable.mjs`
// names `cd-card-account` as `parent_record_id`'s own container, so the
// gated-field route would have had nowhere to land.
//
// So the rule is: render when the record HAS an account, or when the host
// has given the section something to OFFER. Both halves are structural -
// the record, and what was passed - rather than a flag somebody remembers.
//
// ── AND ABSENCE IS DISTINGUISHED FROM UNRESOLVED ─────────────────────────
//
// "No account" and "an account I cannot resolve" are different states, and
// collapsing them is exactly the bug above wearing a friendlier face. A
// record with no `parent_record_id` says so; one whose account is not in
// the list the host fetched says THAT, and names the id.
import { Panel } from '../ui/Panel'

export interface AccountRef { id: string, name: string | null }

export function AccountSection({
  account, parentRecordId, blocked, framed, testid, statusTestid, actions, children,
}: {
  /**
   * THE ROUTE'S OWN DERIVATION, and the one source. R6 taught
   * `GET /contacts` and `GET /contacts/:id` to resolve
   * `parent_record_id` to the account's latest revision, in ONE helper both
   * call - so the list and the detail view cannot disagree.
   *
   * The client does not resolve it again from an accounts list, which would
   * be the second reader this whole defect was made of.
   */
  account: AccountRef | null | undefined
  /** Still needed: it is what separates ABSENT from UNRESOLVED. */
  parentRecordId: string | null | undefined
  /** The qualification tint, when the account is what is blocking. */
  blocked?: boolean
  /**
   * THE HOST'S FRAME, and the reason it is a prop rather than a default.
   *
   * `Panel` is the header-and-body contract, not a card: `NotesHistory`
   * sits inside a frame the host already draws, and the lead card's copy
   * sits inline in the completion popup with no frame at all. The bespoke
   * contact screen draws its sections as `.pg-card`, which is what the
   * `Card` this replaced carried.
   *
   * FOUND BY OPENING THE SCREENSHOT, per Verification 4, and it is
   * build-discipline 10's limit rather than a new item: swapping the card
   * for the shell took the frame with it, so the account name rendered as
   * bare text hanging outside any border while all five of its siblings
   * were framed - and the link control below it was clipped. Every
   * assertion passed, because the name was correct and present.
   */
  framed?: boolean
  testid: string
  statusTestid?: string
  /** A header-line control, per S1. The 30px line takes a control, not a panel. */
  actions?: React.ReactNode
  /** The link panel, which is a surface rather than a control and sits in the body. */
  children?: React.ReactNode
}) {
  // A LEAD HAS NO ACCOUNT AND NOTHING ON OFFER, so it renders no section at
  // all. Decided by the record and by what the host passed, never by a flag.
  if (!parentRecordId && !children && !actions) return null

  return (
    <Panel name="account" title="Account" testid={testid} actions={actions}
      className={[framed ? 'pg-card' : '', blocked ? 'field-blocked' : '']
        .filter(Boolean).join(' ') || undefined}>
      {account?.name
        ? <div className="panel-value" data-testid={statusTestid ?? `${testid}-name`}>{account.name}</div>
        : parentRecordId
          ? (
            // NOT "Not linked". The record IS linked; this surface cannot
            // resolve the name, which is a different thing and is worth
            // saying out loud rather than reporting as an absence.
            <div className="panel-value sub" data-testid={statusTestid ?? `${testid}-unresolved`}>
              Linked, and the account could not be resolved ({parentRecordId.slice(0, 8)})
            </div>
          )
          : (
            // Genuinely no account. This is the state the link control below
            // exists for, and the only one where "Not linked" is TRUE.
            <div className="panel-value sub" data-testid={statusTestid ?? `${testid}-absent`}>
              Not linked
            </div>
          )}
      {children}
    </Panel>
  )
}
