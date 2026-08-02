import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Fetch Supabase config from the API so this file has no hardcoded credentials.
const { supabaseUrl, supabaseAnonKey } = await fetch('/api/config').then(r => r.json())
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth state ────────────────────────────────────────────────────────────────
let currentSession = null

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session
  if (session) {
    showApp(session)
  } else {
    showAuth()
  }
})

// Restore any existing session on page load (handles the OAuth redirect return)
const { data: { session: existingSession } } = await supabase.auth.getSession()
if (existingSession) {
  currentSession = existingSession
  showApp(existingSession)
} else {
  showAuth()
}

// ── Auth controls ─────────────────────────────────────────────────────────────
document.getElementById('btn-google-login').addEventListener('click', async () => {
  document.getElementById('auth-error').textContent = ''
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) document.getElementById('auth-error').textContent = error.message
})

document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut()
})

// ── Record actions ────────────────────────────────────────────────────────────
document.getElementById('btn-create-record').addEventListener('click', async () => {
  const name = document.getElementById('record-name').value.trim()
  if (!name) return alert('Enter a name first')
  const result = await api('POST', '/api/records', {
    record_type: 'smoke_test',
    status: 'draft',
    payload: { name }
  })
  showOutput(result)
  if (result.ok) loadRecords()
})

document.getElementById('btn-refresh-records').addEventListener('click', loadRecords)

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAuth() {
  document.getElementById('auth-section').classList.remove('hidden')
  document.getElementById('app-section').classList.add('hidden')
}

function showApp(session) {
  document.getElementById('auth-section').classList.add('hidden')
  document.getElementById('app-section').classList.remove('hidden')
  document.getElementById('user-email').textContent = session.user.email
  loadRecords()
}

async function api(method, path, body) {
  if (!currentSession) return { ok: false, data: { error: 'not authenticated' } }
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentSession.access_token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

function showOutput(result) {
  document.getElementById('output').textContent = JSON.stringify(result.data, null, 2)
}

async function loadRecords() {
  const result = await api('GET', '/api/records?record_type=smoke_test')
  if (!result.ok) {
    showOutput(result)
    return
  }
  const records = result.data
  const list = document.getElementById('records-list')

  if (!records.length) {
    list.innerHTML = '<em style="font-size:0.85rem;color:#666;">No records yet.</em>'
    return
  }

  list.innerHTML = records.map(r => `
    <div class="record-card">
      <h3>${escHtml(r.id)}</h3>
      <div class="meta">
        type: ${escHtml(r.record_type)} &nbsp;|&nbsp;
        status: <span class="status-badge ${escHtml(r.status)}">${escHtml(r.status)}</span> &nbsp;|&nbsp;
        created: ${new Date(r.created_at).toLocaleString()}
      </div>
      <div class="record-actions">
        <button onclick="approveRecord('${r.id}')">Approve (Internal)</button>
        <button onclick="tryTransition('${r.id}', 'active')">Transition → active</button>
        <button class="secondary" onclick="viewRecord('${r.id}')">View details</button>
      </div>
    </div>
  `).join('')
}

// Expose to onclick handlers (module scope doesn't expose to global by default)
window.approveRecord = async (id) => {
  const result = await api('POST', `/api/records/${id}/approvals`, {
    track: 'Internal',
    decision: 'approved',
    comment: 'Smoke test approval'
  })
  showOutput(result)
  if (result.ok) loadRecords()
}

window.tryTransition = async (id, to_stage) => {
  const result = await api('POST', `/api/records/${id}/transition`, { to_stage })
  showOutput(result)
  if (result.ok) loadRecords()
}

window.viewRecord = async (id) => {
  const result = await api('GET', `/api/records/${id}`)
  showOutput(result)
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
