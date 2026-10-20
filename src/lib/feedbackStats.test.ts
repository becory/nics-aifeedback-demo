import { describe, expect, it } from 'vitest'
import { toDatetimeLocal, truncateLabel } from './feedbackStats'

// Dates are built from local-time components so the tests pass in any machine time zone.
function localIso(y: number, mo: number, d: number, h = 0, mi = 0): string {
  return new Date(y, mo - 1, d, h, mi).toISOString()
}

describe('toDatetimeLocal', () => {
  it('formats an instant as a local datetime-local value with zero padding', () => {
    expect(toDatetimeLocal(localIso(2026, 3, 5, 7, 9))).toBe('2026-03-05T07:09')
  })

  it('drops seconds', () => {
    expect(toDatetimeLocal(new Date(2026, 11, 31, 23, 59, 58).toISOString())).toBe('2026-12-31T23:59')
  })
})

describe('truncateLabel', () => {
  it('keeps a label at or under the default limit of 22 characters', () => {
    const label = 'x'.repeat(22)
    expect(truncateLabel(label)).toBe(label)
  })

  it('cuts a longer label to 22 characters plus an ellipsis', () => {
    expect(truncateLabel('x'.repeat(23))).toBe(`${'x'.repeat(22)}…`)
  })

  it('accepts a custom limit', () => {
    expect(truncateLabel('abcdef', 3)).toBe('abc…')
    expect(truncateLabel('abc', 3)).toBe('abc')
  })
})
