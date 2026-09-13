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
// ── AND ABSENCE IS DISTINGUISHED FROM UNRESOLVED ─────────────────────────
//
// "No account" and "an account I cannot resolve" are different states, and
// collapsing them is exactly the bug above wearing a friendlier face. A
// record with no `parent_record_id` says so; one whose account is not in
// the list the host fetched says THAT, and names the id.
import { Panel } from '../ui/Panel'

export interface AccountRef { id: string, name: string }

export function AccountSection({ parentRecordId, accounts, testid, actions }: {
  /** `records.parent_record_id` - the one source. */
  parentRecordId: string | null | undefined
  /** The accounts the host already fetched. Not a second request. */
  accounts: AccountRef[]
  testid: string
  /** The link/change control, supplied by the host that owns the write. */
  actions?: React.ReactNode
}) {
  // A LEAD HAS NO ACCOUNT, and renders no section at all. R2: it appears
  // for contacts and not for leads, decided by the record rather than by a
  // flag somebody has to remember to pass.
  if (!parentRecordId) return null

  const found = accounts.find((a) => a.id === parentRecordId)
  return (
    <Panel name="account" title="Account" testid={testid} actions={actions}>
      {found
        ? <div className="panel-value" data-testid={`${testid}-name`}>{found.name}</div>
        : (
          // NOT "Not linked". The record IS linked; this surface cannot
          // resolve the name, which is a different thing and is worth
          // saying out loud rather than reporting as an absence.
          <div className="panel-value sub" data-testid={`${testid}-unresolved`}>
            Linked, and the account could not be resolved ({parentRecordId.slice(0, 8)})
          </div>
        )}
    </Panel>
  )
}
