// ── D: CUSTOMER DOCUMENTS ───────────────────────────────────────────────
import { useState } from 'react'
import { customerDocInput, type CustomerDoc } from './customerDocs'

export function CustomerDocsPanel({ docs, onAdd, onRemove }: {
  docs: readonly CustomerDoc[]
  onAdd: (name: string, url: string) => Promise<boolean>
  onRemove: (docId: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div data-testid="tb-custdocs">
      <div data-testid="tb-custdocs-list">
        {docs.length
          ? docs.map((d) => (
            // D3: keyed on the ROW ID, never the name. Two client files
            // genuinely called "Site drawings" are two documents.
            <div className="tb-custdoc-row" key={d.id} data-doc-id={d.id}
              data-testid={`tb-custdoc-${d.id}`}>
              <div>
                <div className="tb-custdoc-name">{d.name}</div>
                {/* D6 */}
                <a className="tb-custdoc-url" href={d.url ?? ''}
                  target="_blank" rel="noopener noreferrer">{d.url ?? ''}</a>
              </div>
              <button type="button" className="btn-text"
                data-testid={`tb-custdoc-remove-${d.id}`}
                onClick={() => { void onRemove(d.id) }}>Remove</button>
            </div>))
          : <p className="empty-state" data-testid="tb-custdocs-empty">
              No client documents yet.</p>}
      </div>

      <input value={name} data-testid="tb-custdoc-name"
        onChange={(e) => setName(e.target.value)} />
      <input value={url} data-testid="tb-custdoc-url"
        onChange={(e) => setUrl(e.target.value)} />
      <button type="button" data-testid="tb-custdoc-add"
        onClick={() => {
          const input = customerDocInput(name, url)
          if (!input.ok) { setError(input.error); return }
          setError(null)
          void onAdd(input.name, input.url).then((ok) => {
            // D5: the inputs clear ONLY on success, so a refused add does not
            // cost the typing.
            if (ok) { setName(''); setUrl('') } else { setError('Could not add the document.') }
          })
        }}>Add document</button>
      {error
        ? <p className="tb-doc-feedback err" data-testid="tb-custdocs-feedback">{error}</p>
        : null}
    </div>
  )
}
