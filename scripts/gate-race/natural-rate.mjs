// How often does the race actually fire unaided? Phase 1 will claim "20 runs
// green". That claim is only as strong as the base rate it is measured
// against: if the natural failure rate is 5%, twenty green runs is weak
// evidence and saying so is part of the result.
// Verification 16: capture the run to a file and search the FILE. The first
// version of this script discarded `out` and printed a boolean, so run 2
// reported "any failure: YES" with INVARIANT 2 green and the causal line was
// already gone. Written by the author of a round about blind instruments.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
const N = Number(process.argv[2] ?? 8)
const OUT = process.env.RATE_OUT ?? '/tmp/rate-runs'
mkdirSync(OUT, { recursive: true })
const MARKER = /✖ INVARIANT 2: no gate rule names a stage absent|not ok \d+ - INVARIANT 2: no gate rule names a stage absent/
let red = 0
for (let i = 1; i <= N; i++) {
  const t = Date.now()
  let out = ''
  try { out = execFileSync('npm', ['run', 'test:db'], { cwd: '/Users/johnfryatt/terminus-tms', encoding: 'utf8', stdio: 'pipe' }) }
  catch (e) { out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  writeFileSync(`${OUT}/run-${String(i).padStart(2, '0')}.txt`, out)
  const hit = MARKER.test(out)
  const anyFail = /✖ failing tests|# fail [1-9]/.test(out)
  if (hit) red++
  // NAME what failed, so a non-INVARIANT-2 red is a finding rather than a boolean.
  const named = [...out.matchAll(/✖ ([^(\n]{4,80})/g)].map((m) => m[1].trim())
    .filter((x) => !/failing tests|tests \d/.test(x))
  console.log(`  run ${String(i).padStart(2)}: INVARIANT 2 red: ${hit ? 'YES' : 'no '}   any failure: ${anyFail ? 'YES' : 'no '}   ${Date.now() - t}ms`)
  if (named.length) console.log(`           failed: ${[...new Set(named)].slice(0, 4).join(' | ')}`)
}
console.log(`\n  ${red} of ${N} runs had INVARIANT 2 red  (${Math.round(red / N * 100)}%)`)
