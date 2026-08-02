// Applies every .sql file in supabase/seeds/ to the linked Supabase project,
// in filename order. Add new seed files as 002_..., 003_... and they're
// picked up automatically on the next run.
//
// Prerequisites (one-time):
//   npx supabase login
//   npx supabase link --project-ref <your-project-ref>
//
// For CI, set SUPABASE_ACCESS_TOKEN as a secret instead of running login.

import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedsDir = join(__dirname, '..', 'supabase', 'seeds')

const files = readdirSync(seedsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  console.log('No seed files found in supabase/seeds/ — nothing to do.')
  process.exit(0)
}

let failed = false

for (const file of files) {
  const filePath = join(seedsDir, file)
  process.stdout.write(`Applying ${file} ... `)

  const result = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '--file', filePath],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )

  if (result.status !== 0) {
    console.log('FAILED')
    const stderr = result.stderr?.toString().trim()
    const stdout = result.stdout?.toString().trim()
    if (stderr) console.error(stderr)
    if (stdout) console.error(stdout)
    failed = true
    break
  }

  console.log('ok')
}

if (failed) {
  console.error('\nSeed run aborted.')
  process.exit(1)
}

console.log(`\n${files.length} seed file(s) applied.`)
