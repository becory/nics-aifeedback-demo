import { describe, expect, it } from 'vitest'
import { formatDisplayDate, formatDisplayTime } from './datetime'

describe('formatDisplayDate', () => {
  it('formats an instant as the Taipei calendar date', () => {
    expect(formatDisplayDate('2026-06-24T08:49:39Z')).toBe('2026-06-24')
  })

  it('moves a UTC instant just before midnight onto the next Taipei date', () => {
    expect(formatDisplayDate('2026-06-24T16:30:00Z')).toBe('2026-06-25')
  })

  it('crosses a year boundary in Taipei time', () => {
    expect(formatDisplayDate('2025-12-31T16:00:00Z')).toBe('2026-01-01')
  })

  it('honors an explicit offset in the input', () => {
    expect(formatDisplayDate('2026-06-24T23:30:00-05:00')).toBe('2026-06-25')
  })

  it.each([null, undefined, '', 'not-a-date'])('shows an em dash for %j', (input) => {
    expect(formatDisplayDate(input)).toBe('—')
  })
})

describe('formatDisplayTime', () => {
  it('formats an instant as Taipei date and 24-hour time with a GMT+8 suffix', () => {
    expect(formatDisplayTime('2026-06-24T08:49:39Z')).toBe('2026-06-24 16:49:39 GMT+8')
  })

  it('moves a UTC instant near midnight onto the next Taipei date', () => {
    expect(formatDisplayTime('2026-06-24T16:05:07Z')).toBe('2026-06-25 00:05:07 GMT+8')
  })

  it('pads single-digit month, day, hour, minute and second', () => {
    expect(formatDisplayTime('2026-01-01T17:02:03Z')).toBe('2026-01-02 01:02:03 GMT+8')
  })

  it.each([null, undefined, '', 'garbage'])('shows an em dash for %j', (input) => {
    expect(formatDisplayTime(input)).toBe('—')
  })
})
