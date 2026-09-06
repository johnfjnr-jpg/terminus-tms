import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCode } from '../lib/strip-comments.mjs'

// Two readers of one list, PROVEN equal rather than asserted equal. app.js
// holds it as a `const`, which no bundle can reach, so the React tree carries
// its own copy - and this is what stops the copies drifting.
const ROOT = new URL('../../', import.meta.url)

const listFrom = (src, name) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
  assert.ok(m, `${name} is gone; the two lists can no longer be compared`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

test('the React currency list is exactly the shell\'s', () => {
  const app = listFrom(readCode(new URL('frontend/app.js', ROOT)), 'CURRENCY_CODES')
  const react = listFrom(readCode(new URL('frontend-react/src/deal/currencies.ts', ROOT)), 'CURRENCY_CODES')
  assert.ok(app.length >= 5, 'the extraction found too few codes to be the real list')
  assert.deepEqual(react, app, 'the two currency lists have drifted')
})
