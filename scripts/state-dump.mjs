// Round 9 Phase 0.1 - generates CURRENT_STATE.md at the repo root.
//
// What this is: read-only reporting tooling, in the same category as
// scripts/verify-harness.mjs and scripts/seed.js. It makes no product
// change and writes nothing to the database.
//
// Why it exists: design conversations happen in chat, away from the repo.
// The facts that go stale between sessions are factual rather than
// conceptual - gate rule contents, stage definitions, approval tracks,
// writable-key allowlists, route inventory, record counts by status.
// Those were previously reconstructed by hand at the start of every round,
// which is slow and occasionally wrong.
//
// Rules this file exists to satisfy (PROJECT_INSTRUCTIONS_ADDENDUM.md,
// ROUND9_BUILD_BRIEF.md section 0.1):
//
//   1. Generated, never hand edited. The output carries a generation
//      timestamp and the git commit SHA it was produced at, so a stale
//      copy is detectable rather than silently trusted.
//   2. It records what IS, never why. Reasoning stays in
//      DESIGN_PRINCIPLES.md; prototype extraction stays in
//      PROTOTYPE_SPECIFICATION.md.
//   3. Every value is read from the live database or by parsing the real
//      source file. Nothing here is restated from any document in this
//      repo. A generator that reads a document is a document with extra
//      steps.
//   4. No secrets and no client data. Environment variables, keys and
//      tokens are never printed. Records are reported as counts by status
//      only - never a name, a reference code, an owner or an id. This file
//      is uploaded into chat sessions.
//   5. Written to CURRENT_STATE.md at the repo root and tracked in git.
//      The diff between rounds is the configuration changelog.
//
// Determinism: two runs with no change between them must produce
// byte-identical output apart from the timestamp, or the diffs the file
// exists for are worthless. Every list is explicitly sorted in JS on a
// content key; nothing relies on database return order. Row `id` and
// `created_at` are deliberately NOT emitted - they are per-environment
// noise that would swamp the configuration changes the diff is for.
//
// Usage:
//   node --env-file-if-exists=.env scripts/state-dump.mjs
//   npm run state:dump
//
// Credentials come from the environment (or the local .env, via the same
// loader the database test suite already uses). Never a hardcoded path.

import { writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

// Reuses the harness's environment loader rather than writing a second
// one. Same concern, one implementation - a second copy is how two paths
// drift apart. Nothing else from that module is imported, and no fixture
// is ever created: this script only reads.
import { loadEnv, adminClient } from './verify-harness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..')

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function git(...args) {
  try {
    return execFileSync('git', ['--no-optional-locks', ...args], {
      cwd: REPO_ROOT, encoding: 'utf8'
    }).trim()
  } catch {
    return null
  }
}

// Canonical JSON: keys sorted recursively, so a jsonb column that comes
// back with a different key order between runs still renders identically.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k])
    return out
  }
  return value
}

function jsonCell(value) {
  if (value === null || value === undefined) return '(null)'
  return '`' + JSON.stringify(canonical(value)) + '`'
}

// Markdown table cells cannot carry a raw pipe or newline.
function cell(value) {
  if (value === null || value === undefined) return '(null)'
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

// Stable sort key built from the named columns, so ordering never depends
// on what Postgres happened to return.
function by(...keys) {
  return (a, b) => {
    for (const k of keys) {
      const av = a[k] === null || a[k] === undefined ? '' : String(a[k])
      const bv = b[k] === null || b[k] === undefined ? '' : String(b[k])
      if (av !== bv) return av < bv ? -1 : 1
    }
    return 0
  }
}

// PostgREST caps a plain select at 1000 rows. Page explicitly rather than
// silently reporting the first page as the whole table.
async function fetchAll(db, table, columns) {
  const PAGE = 1000
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1)
    if (error) throw new Error(`state-dump: reading ${table} failed: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

function table(headers, rows) {
  if (!rows.length) return '_None._\n'
  const head = `| ${headers.join(' | ')} |`
  const sep = `|${headers.map(() => '---').join('|')}|`
  return [head, sep, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n') + '\n'
}

// ─────────────────────────────────────────────────────────────
// Source-file parsing (never the database, never a document)
// ─────────────────────────────────────────────────────────────

const ROUTES_DIR = join(REPO_ROOT, 'src', 'routes')

function routeFiles() {
  return readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js')).sort()
}

// Extracts the string literals from a block of JavaScript source, skipping
// // and /* */ comments and any `...spread` identifiers.
//
// This is a character scanner rather than a regex for a real reason: these
// allowlists carry long explanatory comments, and those comments contain
// apostrophes ("Opportunity's own", "it's read-only"). A regex for quoted
// strings reads each of those apostrophes as a delimiter and returns
// fragments of prose as though they were payload keys - which is exactly
// what the first draft of this function did, reporting 40 and 44 keys for
// two allowlists that hold neither number.
function stringLiteralsIn(body) {
  const strings = []
  const spreads = []
  let i = 0
  while (i < body.length) {
    const c = body[i]
    const next = body[i + 1]

    if (c === '/' && next === '/') {
      while (i < body.length && body[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < body.length && !(body[i] === '*' && body[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c
      i += 1
      let value = ''
      while (i < body.length && body[i] !== quote) {
        if (body[i] === '\\') { value += body[i + 1] ?? ''; i += 2; continue }
        value += body[i]
        i += 1
      }
      i += 1
      strings.push(value)
      continue
    }
    if (c === '.' && body.slice(i, i + 3) === '...') {
      const m = /^\.\.\.(\w+)/.exec(body.slice(i))
      if (m) { spreads.push(m[1]); i += m[0].length; continue }
    }
    i += 1
  }
  return { strings, spreads }
}

// Parses `const SOMETHING_WRITABLE_KEYS = new Set([...])` out of the real
// route files.
//
// A spread inside the Set (`...BILLING_KEYS`) is resolved when the
// referenced const is a literal array of strings. When it is computed
// (accounts.js builds its address keys with .map()), it is reported as an
// unresolved spread with the defining line cited, never dropped. Silently
// listing 4 keys for a Set that really allows more is exactly the kind of
// quiet wrongness this file exists to remove.
function parseWritableKeys() {
  const out = []
  for (const file of routeFiles()) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
    const lines = src.split('\n')

    // Resolves both shapes a key list is written in here: a literal array
    // `const X = [...]`, and a `const X = new Set([...])`. The Set form was
    // missed by the first version, which mattered immediately: Round 9
    // Phase 3 declared TB_EXIT_CRITERION_KEYS as a Set and spread it into
    // TEST_BED_WRITABLE_KEYS, so the five judgement-criterion keys stopped
    // being enumerated in this file at all. An allowlist reported as 35 of
    // its 40 keys is under-reporting, and a state file that under-reports
    // is worse than one that admits it cannot tell.
    function resolveSpread(ident) {
      const set = src.match(new RegExp(`const\\s+${ident}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`, 'm'))
      if (set) {
        const keys = stringLiteralsIn(set[1]).strings
        if (keys.length) return keys
      }
      const arr = src.match(new RegExp(`const\\s+${ident}\\s*=\\s*\\[([^\\]]*)\\]`, 'm'))
      if (!arr) return null
      const keys = stringLiteralsIn(arr[1]).strings
      return keys.length ? keys : null
    }
    function defLine(ident) {
      const idx = lines.findIndex(l => new RegExp(`const\\s+${ident}\\s*=`).test(l))
      return idx < 0 ? null : idx + 1
    }

    const re = /const\s+([A-Z0-9_]*WRITABLE_KEYS)\s*=\s*new Set\(\[([\s\S]*?)\]\)/g
    let m
    while ((m = re.exec(src)) !== null) {
      const { strings, spreads } = stringLiteralsIn(m[2])
      const keys = [...strings]
      const unresolved = []
      for (const sp of spreads) {
        const resolved = resolveSpread(sp)
        if (resolved) keys.push(...resolved)
        else unresolved.push({ ident: sp, line: defLine(sp) })
      }
      out.push({ file: `src/routes/${file}`, name: m[1], keys, unresolved })
    }
  }
  return out.sort(by('name'))
}

// Route inventory: the prefix each route module is registered under comes
// from src/server.js, the paths from the module itself. Both parsed from
// the real source.
function parseRoutes() {
  const serverSrc = readFileSync(join(REPO_ROOT, 'src', 'server.js'), 'utf8')

  // import fooRoutes from './routes/foo.js'
  const identToFile = new Map()
  for (const m of serverSrc.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w.-]+)'/g)) {
    identToFile.set(m[1], m[2])
  }

  // app.register(fooRoutes, { prefix: '/api' })
  const fileToPrefix = new Map()
  for (const m of serverSrc.matchAll(/register\((\w+)\s*,\s*\{\s*prefix:\s*'([^']*)'/g)) {
    const file = identToFile.get(m[1])
    if (file) fileToPrefix.set(file, m[2])
  }

  const routes = []

  // Routes declared directly on the server instance (unauthenticated).
  for (const m of serverSrc.matchAll(/fastify\.(get|post|patch|put|delete)\('([^']+)'/g)) {
    routes.push({ method: m[1].toUpperCase(), path: m[2], source: 'src/server.js', auth: 'public' })
  }

  for (const file of routeFiles()) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
    const prefix = fileToPrefix.get(file)
    for (const m of src.matchAll(/app\.(get|post|patch|put|delete)\('([^']*)'/g)) {
      routes.push({
        method: m[1].toUpperCase(),
        path: `${prefix ?? '(unregistered)'}${m[2]}`,
        source: `src/routes/${file}`,
        auth: prefix === undefined ? 'not registered' : 'authenticated'
      })
    }
  }

  return routes.sort(by('path', 'method'))
}

function parseMigrations() {
  return readdirSync(join(REPO_ROOT, 'supabase', 'migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort()
}

function parseSeeds() {
  return readdirSync(join(REPO_ROOT, 'supabase', 'seeds'))
    .filter(f => f.endsWith('.sql'))
    .sort()
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const env = loadEnv()
const db = adminClient(env)

const sha = git('rev-parse', 'HEAD')
const dirty = git('status', '--porcelain')
const generatedAt = new Date().toISOString()

const out = []
const w = s => out.push(s)

w('# Current state')
w('')
w('**Generated by `scripts/state-dump.mjs`. Never hand edit.** Any edit here is')
w('overwritten on the next run. It records what is configured right now, never')
w('why: reasoning lives in `DESIGN_PRINCIPLES.md`, and what the prototype does')
w('lives in `PROTOTYPE_SPECIFICATION.md`.')
w('')
w('Every value below is read from the live database or parsed from the real')
w('source file. Nothing is restated from another document in this repo.')
w('')
w('Contains no environment variable, key or token, and no client data. Records')
w('appear as counts by status only, never by name or reference code, because')
w('this file is uploaded into chat sessions.')
w('')
w(`- Generated at: \`${generatedAt}\``)
w(`- Git commit: \`${sha ?? '(unavailable)'}\``)
w(`- Working tree at generation: \`${dirty ? 'dirty (uncommitted changes present)' : 'clean'}\``)
w('')
// Round 15 Phase 6: this printed the pre-Round-10A staleness rule, "if the
// commit above is not current HEAD, this file is stale", for five rounds
// after CLAUDE.md corrected it. That check can never pass: the file records
// the commit it was generated at and is then committed, so it can never name
// its own commit and was stale by its own rule the moment it was written.
// A rule that always fails gets worked around rather than followed, and this
// file is uploaded into chat sessions, so the wrong version travelled.
// CLAUDE.md is the authority; the two-part test is restated here only because
// a reader of this file may not have that one open.
w('Staleness has two parts, and both must hold for this file to be current:')
w('the recorded commit is an ancestor of `HEAD`, AND no tracked configuration')
w('source has changed since it. See `CLAUDE.md`, which is the authority.')
w('')
w('    git merge-base --is-ancestor <recorded-sha> HEAD')
w('    git diff --name-only <recorded-sha>..HEAD -- \\')
w('      supabase/migrations supabase/seeds src/routes')
w('')
w('A changed source is not automatically staleness: the generator parses')
w('source files from disk, so a run made with uncommitted changes present')
w('already reflects them. Regenerate and diff rather than assuming.')
w('')

// ── TAGS, AS FACTS ─────────────────────────────────────────────────────────
//
// Round 40. Each tag, the commit it points at, and how far that commit is from
// HEAD. A tag is a claim about a commit, so which commit it names is a fact
// this file can carry; whether the claim is TRUE is a judgement and lives in
// DESIGN_PRINCIPLES.md, per this file's own rule that it records what is and
// never why.
//
// It exists because `reshape-complete` names a property its commit does not
// have: the reshape was completed a round later. Nothing showed that, because
// nothing recorded where the tags were.
//
// ── AND IT READS ORIGIN, NOT LOCAL. CLAUDE.md rule 35 ─────────────────────
//
// On its FIRST generation this section would have published a wrong fact with
// full confidence: local `reshape-complete` pointed at 46f3fdf and origin at
// 3499884, because the tag had been force-moved after being pushed.
//
// A generated file is read as authoritative, so it reports the PUBLISHED
// position, and a local tag disagreeing with it is stated as a disagreement
// rather than resolved silently in either direction. Silently preferring either
// one is the fault; the disagreement is the finding.
//
// `git ls-remote` needs the network. When it is unavailable the row says so
// rather than falling back to local and calling it fact, because a fallback
// that changes the MEANING of a column without changing its heading is how the
// wrong fact gets published in the first place.
// ── OPEN STEPS, READ FROM A TRACKED FILE ─────────────────────────────────
//
// The business asked for an open step to be CARRIED IN CURRENT_STATE.md until
// it is closed, and this file is generated and must never be hand edited. Both
// are satisfied by generating it from a source: OPEN_SECURITY_STEPS.json is the
// record, this prints it, and closing a step is deleting its entry there.
//
// It is "what is" rather than "why": an open step is a fact about the system's
// current state, in the same way a stage rule is.
try {
  const openSteps = JSON.parse(readFileSync(join(REPO_ROOT, 'OPEN_SECURITY_STEPS.json'), 'utf8'))
  if ((openSteps.steps ?? []).length) {
    w('## Open steps')
    w('')
    w('From `OPEN_SECURITY_STEPS.json`. Each is closed by deleting its entry there,')
    w('on the business\'s word, and regenerating this file.')
    w('')
    for (const s of openSteps.steps) {
      w(`### ${s.title}`)
      w('')
      w(`Opened ${s.opened} by ${s.opened_by}.`)
      w('')
      w(`**Why it is open:** ${s.why_open}`)
      w('')
      w(`**It closes when:** ${s.closes_when}`)
      w('')
      for (const a of s.actions ?? []) w(`- ${a}`)
      w('')
      w('**Exposure while it is open:**')
      w('')
      for (const e of s.exposure_while_open ?? []) w(`- ${e}`)
      w('')
      if (s.related) { w(s.related); w('') }
    }
  }
} catch (e) {
  w('## Open steps')
  w('')
  w(`**OPEN_SECURITY_STEPS.json could not be read: ${e.message}.** That is reported`)
  w('rather than omitted: a section that disappears when something goes wrong is')
  w('read as "nothing open" by whoever it was for.')
  w('')
}

w('## Tags')
w('')
try {
  const tags = execFileSync('git', ['tag', '--sort=creatordate'], { encoding: 'utf8' })
    .split('\n').map((t) => t.trim()).filter(Boolean)
  if (!tags.length) {
    w('No tags.')
  } else {
    let remote = null
    try {
      remote = new Map(execFileSync('git', ['ls-remote', '--tags', 'origin'], { encoding: 'utf8', timeout: 15000 })
        .split('\n').filter(Boolean).map((l) => l.split('\t'))
        .filter(([, ref]) => ref.endsWith('^{}'))
        .map(([sha, ref]) => [ref.replace('refs/tags/', '').replace('^{}', ''), sha]))
    } catch { /* offline: say so below rather than substituting local */ }

    w('| tag | published commit | date | commits from `HEAD` | local agrees |')
    w('|---|---|---|---|---|')
    for (const t of tags) {
      const local = execFileSync('git', ['rev-list', '-n', '1', t], { encoding: 'utf8' }).trim()
      const published = remote?.get(t) ?? null
      const shown = published ?? local
      const date = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short', shown], { encoding: 'utf8' }).trim()
      let ahead = ''
      try { ahead = execFileSync('git', ['rev-list', '--count', `${shown}..HEAD`], { encoding: 'utf8' }).trim() } catch { ahead = 'unknown' }
      const agrees = remote === null ? 'origin unreachable, local shown'
        : published === null ? 'not on origin'
        : published === local ? 'yes'
        : `NO, local is \`${local.slice(0, 7)}\``
      w(`| \`${t}\` | \`${shown.slice(0, 7)}\` | ${date} | ${ahead} | ${agrees} |`)
    }
  }
} catch (e) {
  w(`Tags could not be read: ${e.message}`)
}
w('')

// ── stage_definitions ────────────────────────────────────────
{
  const rows = (await fetchAll(db, 'stage_definitions', 'record_type, variant, stage_name, sort_order'))
    .sort(by('record_type', 'variant', 'sort_order', 'stage_name'))
  w('## `stage_definitions`')
  w('')
  w(`${rows.length} rows.`)
  w('')
  w(table(
    ['record_type', 'variant', 'sort_order', 'stage_name'],
    rows.map(r => [cell(r.record_type), cell(r.variant), cell(r.sort_order), cell(r.stage_name)])
  ))
}

// ── stage_gate_rules ─────────────────────────────────────────
{
  const rows = (await fetchAll(db, 'stage_gate_rules',
    'record_type, variant, from_stage, to_stage, requirement_type, requirement_detail'))
    .sort(by('record_type', 'variant', 'from_stage', 'to_stage', 'requirement_type'))
  w('## `stage_gate_rules`')
  w('')
  w(`${rows.length} rows. Full \`requirement_detail\`, keys sorted.`)
  w('')
  w(table(
    ['record_type', 'variant', 'from_stage', 'to_stage', 'requirement_type', 'requirement_detail'],
    rows.map(r => [
      cell(r.record_type), cell(r.variant), cell(r.from_stage), cell(r.to_stage),
      cell(r.requirement_type), jsonCell(r.requirement_detail)
    ])
  ))

  const counts = {}
  for (const r of rows) {
    const k = `${r.record_type} | ${r.requirement_type}`
    counts[k] = (counts[k] ?? 0) + 1
  }
  w('Rule count by record type and requirement type:')
  w('')
  w(table(['record_type', 'requirement_type', 'rules'],
    Object.keys(counts).sort().map(k => [...k.split(' | ').map(cell), counts[k]])))
}

// ── stage_reference_docs ─────────────────────────────────────
{
  const rows = (await fetchAll(db, 'stage_reference_docs', 'record_type, stage_name, document_name'))
    .sort(by('record_type', 'stage_name', 'document_name'))
// ── scoring_criteria and scoring_anchors ─────────────────────
//
// Added Round 11 Phase 9. These are configuration in exactly the sense this
// file exists to record: admin-managed reference data holding the scoring
// framework's own content, in the same category as stage_definitions and
// approval_tracks. Without them the round that introduced the framework
// would have produced a CURRENT_STATE.md that does not mention it, and the
// reconciliation would be incomplete by construction.
//
// ANCHOR WORDING IS DELIBERATELY NOT PRINTED. It is long, provisional, and
// about to be revised by the business, so emitting it would swamp every
// future diff with prose changes and bury the configuration changes this
// file exists to surface. What is printed is the SHAPE: which criteria
// exist, which versions each carries, and which scores each version
// defines. A wording change is then visible as a new version rather than as
// a wall of text.
{
  // `asks` is included, Round 13 Phase 3. It is a configuration value that can
  // change by row edit, and until this round it was not recorded here at all,
  // so changing it produced no diff and the configuration changelog simply
  // missed it. Note the ORDER this matters in: a row edit is only visible as a
  // row edit if the column already exists in the baseline, so the column is
  // added and committed BEFORE the value changes, not after.
  //
  // Unlike the anchor wording below, `asks` is printed in full. It is one
  // short question per criterion, not a wall of provisional text, and it is
  // the label a scorer reads, so a change to it is exactly the kind of thing
  // the diff between rounds exists to surface.
  const crits = (await fetchAll(db, 'scoring_criteria',
    'id, record_type, criterion_key, name, asks, sort_order, rescore_through_stage'))
    .sort(by('record_type', 'sort_order', 'criterion_key'))
  const anchorRows = await fetchAll(db, 'scoring_anchors', 'criterion_id, version, score')

  w('## `scoring_criteria`')
  w('')
  w(`${crits.length} rows.`)
  w('')
  w(table(
    ['record_type', 'sort_order', 'criterion_key', 'name', 'asks', 'rescore_through_stage'],
    crits.map(r => [cell(r.record_type), cell(r.sort_order), cell(r.criterion_key),
                    cell(r.name), cell(r.asks), cell(r.rescore_through_stage)])
  ))

  w('## `scoring_anchors`')
  w('')
  w(`${anchorRows.length} rows. Wording is not printed: it is provisional and`)
  w('pending business review, and emitting it would bury every configuration')
  w('change in prose. The shape is what a diff needs.')
  w('')
  const shape = {}
  for (const a of anchorRows) {
    const k = `${a.criterion_id}||${a.version}`
    ;(shape[k] ??= []).push(a.score)
  }
  const byCrit = Object.fromEntries(crits.map(c => [c.id, c]))
  const rows = Object.keys(shape).sort().map(k => {
    const [id, version] = k.split('||')
    return { key: byCrit[id]?.criterion_key ?? '(unknown criterion)', version: Number(version),
             scores: shape[k].sort((a, b) => a - b).join(', ') }
  }).sort(by('key', 'version'))
  w(table(['criterion_key', 'version', 'scores defined'],
    rows.map(r => [cell(r.key), cell(r.version), cell(r.scores)])))
}

  w('## `stage_reference_docs`')
  w('')
  w(`${rows.length} rows. \`document_name\` reproduced exactly, including spacing.`)
  w('')
  w(table(
    ['record_type', 'stage_name', 'document_name'],
    rows.map(r => [cell(r.record_type), cell(r.stage_name), '`' + r.document_name + '`'])
  ))
}

// ── approval_tracks ──────────────────────────────────────────
{
  const rows = (await fetchAll(db, 'approval_tracks', 'track_name, description')).sort(by('track_name'))
  w('## `approval_tracks`')
  w('')
  w(`${rows.length} rows.`)
  w('')
  w(table(['track_name', 'description'], rows.map(r => [cell(r.track_name), cell(r.description)])))
}

// ── routing_rules ────────────────────────────────────────────
{
  const rows = (await fetchAll(db, 'routing_rules', 'record_type, track, condition, required_tier'))
    .sort(by('record_type', 'track', 'required_tier'))
  w('## `routing_rules`')
  w('')
  w(`${rows.length} rows.`)
  w('')
  w(table(['record_type', 'track', 'required_tier', 'condition'],
    rows.map(r => [cell(r.record_type), cell(r.track), cell(r.required_tier), jsonCell(r.condition)])))
}

// ── conversion_criteria ──────────────────────────────────────
{
  const rows = (await fetchAll(db, 'conversion_criteria', 'from_record_type, to_record_type, condition'))
    .sort(by('from_record_type', 'to_record_type'))
  w('## `conversion_criteria`')
  w('')
  w(`${rows.length} rows.`)
  w('')
  w(table(['from_record_type', 'to_record_type', 'condition'],
    rows.map(r => [cell(r.from_record_type), cell(r.to_record_type), jsonCell(r.condition)])))
}

// ── stage_probability_defaults ───────────────────────────────
{
  const rows = (await fetchAll(db, 'stage_probability_defaults', 'record_type, variant, stage, default_probability_pct'))
    .sort(by('record_type', 'variant', 'stage'))
  w('## `stage_probability_defaults`')
  w('')
  w(`${rows.length} rows.`)
  w('')
  w(table(['record_type', 'variant', 'stage', 'default_probability_pct'],
    rows.map(r => [cell(r.record_type), cell(r.variant), cell(r.stage), cell(r.default_probability_pct)])))
}

// ── record counts ────────────────────────────────────────────
// Counts only. No id, no reference code, no owner, no payload.
{
  const rows = await fetchAll(db, 'records', 'record_type, status, deleted_at')
  const counts = new Map()
  for (const r of rows) {
    const key = `${r.record_type} ${r.status}`
    const bucket = counts.get(key) ?? { record_type: r.record_type, status: r.status, live: 0, deleted: 0 }
    if (r.deleted_at) bucket.deleted += 1
    else bucket.live += 1
    counts.set(key, bucket)
  }
  const all = [...counts.values()].sort(by('record_type', 'status'))

  const totalLive = all.reduce((a, b) => a + b.live, 0)
  const totalDeleted = all.reduce((a, b) => a + b.deleted, 0)

  // scripts/verify-harness.mjs mints a synthetic record_type per run,
  // `harness_<runTag>` (scripts/tests/gates.test.mjs), so every
  // `npm run test:db` run adds new record_type values permanently. Listed
  // one line each they swamp this section and make the round-on-round diff
  // useless, so they are aggregated into a single line. Aggregated, not
  // hidden: the totals above include them, the distinct-type count is
  // reported, and any harness type still holding a LIVE row is listed
  // individually, because that is a teardown failure rather than
  // accumulated residue.
  const HARNESS_TYPE = /^harness_/
  const harness = all.filter(r => HARNESS_TYPE.test(r.record_type))
  const business = all.filter(r => !HARNESS_TYPE.test(r.record_type))
  const harnessLive = harness.filter(r => r.live > 0)
  const harnessTypes = new Set(harness.map(r => r.record_type))
  const harnessLiveTotal = harness.reduce((a, b) => a + b.live, 0)
  const harnessDeletedTotal = harness.reduce((a, b) => a + b.deleted, 0)

  w('## Record counts by type and status')
  w('')
  w(`${totalLive} live, ${totalDeleted} soft deleted, ${totalLive + totalDeleted} rows in total.`)
  w('')
  w(table(['record_type', 'status', 'live', 'soft deleted'],
    business.map(r => [cell(r.record_type), cell(r.status), r.live, r.deleted])))
  w('')
  w('### Test fixture record types')
  w('')
  w('`scripts/verify-harness.mjs` mints one synthetic `record_type` per run, so')
  w('these accumulate permanently. They are aggregated here rather than listed')
  w('row by row, and are included in the totals above.')
  w('')
  w(table(['distinct `harness_*` record types', 'live rows', 'soft deleted rows'],
    [[harnessTypes.size, harnessLiveTotal, harnessDeletedTotal]]))
  w('')
  if (harnessLive.length) {
    w('Harness record types still holding a live row, which teardown should have')
    w('soft deleted:')
    w('')
    w(table(['record_type', 'status', 'live'],
      harnessLive.map(r => [cell(r.record_type), cell(r.status), r.live])))
  } else {
    w('No harness record type holds a live row; every fixture row is soft deleted.')
    w('')
  }
}

// ── approvals ────────────────────────────────────────────────
{
  const rows = await fetchAll(db, 'approvals', 'decision, track, stage')
  const counts = new Map()
  for (const r of rows) {
    const key = `${r.decision} ${r.track}`
    const b = counts.get(key) ?? { decision: r.decision, track: r.track, total: 0, nullStage: 0 }
    b.total += 1
    if (r.stage === null || r.stage === undefined) b.nullStage += 1
    counts.set(key, b)
  }
  const list = [...counts.values()].sort(by('decision', 'track'))
  const nullStage = rows.filter(r => r.stage === null || r.stage === undefined).length

  w('## `approvals`')
  w('')
  w(`${rows.length} rows, of which ${nullStage} carry a null \`stage\`.`)
  w('')
  w(table(['decision', 'track', 'rows', 'null stage'],
    list.map(r => [cell(r.decision), cell(r.track), r.total, r.nullStage])))
}

// ── writable key allowlists ──────────────────────────────────
{
  w('## Writable-key allowlists')
  w('')
  w('Parsed from the real route files. A `PATCH` naming a key absent from the')
  w("relevant list is rejected.")
  w('')
  for (const set of parseWritableKeys()) {
    w(`### \`${set.name}\` (\`${set.file}\`)`)
    w('')
    w(`${set.keys.length} literal keys.`)
    w('')
    w(set.keys.map(k => '`' + k + '`').join(', '))
    w('')
    for (const u of set.unresolved) {
      w(`Plus a spread of \`${u.ident}\`, computed at \`${set.file}:${u.line ?? '?'}\` rather`)
      w('than written as a literal list, so its members are not enumerable here.')
      w('')
    }
  }
}

// ── routes ───────────────────────────────────────────────────
{
  const routes = parseRoutes()
  w('## Registered routes')
  w('')
  w(`${routes.length} routes. Prefixes parsed from \`src/server.js\`, paths from each route module.`)
  w('')
  w(table(['method', 'path', 'auth', 'source'],
    routes.map(r => [r.method, '`' + r.path + '`', r.auth, '`' + r.source + '`'])))
}

// ── migrations and seeds ─────────────────────────────────────
{
  const migrations = parseMigrations()
  w('## Migrations, in filename order')
  w('')
  w(`${migrations.length} files in \`supabase/migrations/\`.`)
  w('')
  w(migrations.map((f, i) => `${i + 1}. \`${f}\``).join('\n'))
  w('')

  const seeds = parseSeeds()
  w('## Seed files, in application order')
  w('')
  w(`\`npm run db:seed\` applies these in filename order.`)
  w('')
  w(seeds.map((f, i) => `${i + 1}. \`${f}\``).join('\n'))
  w('')
}

const target = join(REPO_ROOT, 'CURRENT_STATE.md')
writeFileSync(target, out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n')
console.log(`Wrote ${target}`)
console.log(`  commit ${sha ?? '(unavailable)'}${dirty ? ' (working tree dirty)' : ''}`)
