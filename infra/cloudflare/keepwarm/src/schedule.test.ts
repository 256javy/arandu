import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pingOffsets, WARM_OFFSETS_S } from './schedule.ts'

const FROM = '2026-11-04T12:00:00Z'
const UNTIL = '2026-11-10T03:00:00Z'
const at = (iso: string) => Date.parse(iso)

test('inside the window: three pings every minute', () => {
  assert.deepEqual(pingOffsets(at('2026-11-04T12:00:00Z'), FROM, UNTIL), WARM_OFFSETS_S)
  assert.deepEqual(pingOffsets(at('2026-11-06T17:33:00Z'), FROM, UNTIL), [0, 20, 40])
  assert.deepEqual(pingOffsets(at('2026-11-10T02:59:00Z'), FROM, UNTIL), [0, 20, 40])
})

test('outside the window: one ping on minutes divisible by 4, otherwise skip', () => {
  assert.deepEqual(pingOffsets(at('2026-11-04T11:56:00Z'), FROM, UNTIL), [0])
  assert.deepEqual(pingOffsets(at('2026-11-04T11:59:00Z'), FROM, UNTIL), [])
  assert.deepEqual(pingOffsets(at('2026-11-10T03:00:00Z'), FROM, UNTIL), [0])
  assert.deepEqual(pingOffsets(at('2026-11-10T03:01:00Z'), FROM, UNTIL), [])
})

test('a missing or invalid window means idle mode', () => {
  assert.deepEqual(pingOffsets(at('2026-11-06T17:32:00Z'), '', ''), [0])
  assert.deepEqual(pingOffsets(at('2026-11-06T17:33:00Z'), 'nope', UNTIL), [])
})
