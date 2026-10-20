import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUDIT_LOG_FILTERS,
  auditFiltersFromSearchParams,
  auditFiltersToSearchParams,
  buildAuditLogParams,
  resolveAuditTimeRange,
  type AuditLogFilters,
} from './auditLogFilters'

const NOW = new Date('2026-10-20T12:34:56Z')
const HOUR = 3600_000

/** A date as a datetime-local value (local time, to the minute), built independently of the code under test. */
function local(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Expected `from` for a relative preset: `hours` before NOW, truncated to the minute (local time). */
function relativeFromIso(hours: number): string {
  return new Date(local(new Date(NOW.getTime() - hours * HOUR))).toISOString()
}

function filters(overrides: Partial<AuditLogFilters>): AuditLogFilters {
  return { ...DEFAULT_AUDIT_LOG_FILTERS, ...overrides }
}

describe('resolveAuditTimeRange', () => {
  it('resolves a relative preset to a start time and no end', () => {
    expect(resolveAuditTimeRange({ preset: '24h', customFrom: '', customTo: '' }, NOW)).toEqual({
      from: local(new Date(NOW.getTime() - 24 * HOUR)),
    })
    expect(resolveAuditTimeRange({ preset: '30d', customFrom: '', customTo: '' }, NOW)).toEqual({
      from: local(new Date(NOW.getTime() - 30 * 24 * HOUR)),
    })
  })

  it('returns the custom range as given', () => {
    expect(
      resolveAuditTimeRange({ preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-02T09:30' }, NOW),
    ).toEqual({ from: '2026-10-01T08:00', to: '2026-10-02T09:30' })
  })

  it('leaves the end open when a custom range has no end', () => {
    expect(resolveAuditTimeRange({ preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '' }, NOW)).toEqual({
      from: '2026-10-01T08:00',
      to: undefined,
    })
  })
})

describe('buildAuditLogParams', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('by default only hides audit-query events and covers the last 7 days', () => {
    expect(buildAuditLogParams(DEFAULT_AUDIT_LOG_FILTERS, 50)).toEqual({
      eventType: ['-auditLogs.queried'],
      minSeverity: undefined,
      userId: undefined,
      targetUserId: undefined,
      organizationId: undefined,
      clientIp: undefined,
      from: relativeFromIso(7 * 24),
      to: undefined,
      pageSize: 50,
    })
  })

  it('sends no eventType filter when audit queries are shown and no category is chosen', () => {
    expect(buildAuditLogParams(filters({ hideAuditQueries: false }), 50).eventType).toBeUndefined()
  })

  it('turns categories into eventType prefixes, in category order, plus the query exclusion', () => {
    const params = buildAuditLogParams(
      filters({
        conditions: [
          { field: 'category', value: 'settings' },
          { field: 'category', value: 'auth' },
        ],
      }),
      20,
    )
    expect(params.eventType).toEqual(['auth.*', 'scoreConfig.*', '-auditLogs.queried'])
  })

  it('ignores an unknown category value', () => {
    const params = buildAuditLogParams(
      filters({ conditions: [{ field: 'category', value: 'bogus' }], hideAuditQueries: false }),
      20,
    )
    expect(params.eventType).toBeUndefined()
  })

  it('passes repeated fields as lists and minSeverity as a single value', () => {
    const params = buildAuditLogParams(
      filters({
        conditions: [
          { field: 'userId', value: 'u1' },
          { field: 'userId', value: 'u2' },
          { field: 'targetUserId', value: 't1' },
          { field: 'organizationId', value: 'o1' },
          { field: 'clientIp', value: '10.0.0.1' },
          { field: 'minSeverity', value: 'ERROR' },
        ],
      }),
      100,
    )
    expect(params).toMatchObject({
      userId: ['u1', 'u2'],
      targetUserId: ['t1'],
      organizationId: ['o1'],
      clientIp: ['10.0.0.1'],
      minSeverity: 'ERROR',
      pageSize: 100,
    })
  })

  it('converts a custom local range to ISO instants', () => {
    const params = buildAuditLogParams(
      filters({ time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-02T09:30' } }),
      50,
    )
    expect(params.from).toBe(new Date('2026-10-01T08:00').toISOString())
    expect(params.to).toBe(new Date('2026-10-02T09:30').toISOString())
  })

  it('omits from when a custom range has no start', () => {
    const params = buildAuditLogParams(filters({ time: { preset: 'custom', customFrom: '', customTo: '' } }), 50)
    expect(params.from).toBeUndefined()
    expect(params.to).toBeUndefined()
  })
})

describe('auditFiltersToSearchParams', () => {
  it('writes nothing for the default filters', () => {
    expect(auditFiltersToSearchParams(DEFAULT_AUDIT_LOG_FILTERS).toString()).toBe('')
  })

  it('writes a non-default preset, conditions and showQueries', () => {
    const params = auditFiltersToSearchParams({
      time: { preset: '24h', customFrom: 'ignored', customTo: 'ignored' },
      conditions: [
        { field: 'category', value: 'auth' },
        { field: 'category', value: 'user' },
        { field: 'userId', value: 'u1' },
      ],
      hideAuditQueries: false,
    })
    expect(params.get('range')).toBe('24h')
    expect(params.has('from')).toBe(false)
    expect(params.has('to')).toBe(false)
    expect(params.getAll('category')).toEqual(['auth', 'user'])
    expect(params.get('userId')).toBe('u1')
    expect(params.get('showQueries')).toBe('1')
  })

  it('writes the custom range bounds that are set', () => {
    const params = auditFiltersToSearchParams(
      filters({ time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '' } }),
    )
    expect(params.get('range')).toBe('custom')
    expect(params.get('from')).toBe('2026-10-01T08:00')
    expect(params.has('to')).toBe(false)
  })
})

describe('auditFiltersFromSearchParams', () => {
  it('returns the defaults for an empty query string', () => {
    expect(auditFiltersFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_AUDIT_LOG_FILTERS)
  })

  it('round-trips filters through the query string', () => {
    const original: AuditLogFilters = {
      time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-02T09:30' },
      conditions: [
        { field: 'category', value: 'auth' },
        { field: 'minSeverity', value: 'WARNING' },
        { field: 'clientIp', value: '10.0.0.1' },
      ],
      hideAuditQueries: false,
    }
    expect(auditFiltersFromSearchParams(auditFiltersToSearchParams(original))).toEqual(original)
  })

  it('reads a known relative preset', () => {
    expect(auditFiltersFromSearchParams(new URLSearchParams('range=30d')).time).toEqual({
      preset: '30d',
      customFrom: '',
      customTo: '',
    })
  })

  it('falls back to the default time for an unknown preset', () => {
    expect(auditFiltersFromSearchParams(new URLSearchParams('range=90d')).time).toEqual(DEFAULT_AUDIT_LOG_FILTERS.time)
  })

  it('falls back to the default time for an invalid custom range', () => {
    for (const qs of [
      'range=custom',
      'range=custom&from=not-a-date',
      'range=custom&from=2026-10-05T00:00&to=2026-10-01T00:00',
    ]) {
      expect(auditFiltersFromSearchParams(new URLSearchParams(qs)).time).toEqual(DEFAULT_AUDIT_LOG_FILTERS.time)
    }
  })

  it('accepts a custom range without an end', () => {
    expect(auditFiltersFromSearchParams(new URLSearchParams('range=custom&from=2026-10-01T08:00')).time).toEqual({
      preset: 'custom',
      customFrom: '2026-10-01T08:00',
      customTo: '',
    })
  })

  it('ignores unknown keys, blank and duplicate values, and keeps only the last minSeverity', () => {
    const result = auditFiltersFromSearchParams(
      new URLSearchParams(
        'foo=bar&userId=u1&userId=u1&userId=%20&minSeverity=WARNING&minSeverity=ERROR&organizationId=o1',
      ),
    )
    expect(result.conditions).toEqual([
      { field: 'userId', value: 'u1' },
      { field: 'minSeverity', value: 'ERROR' },
      { field: 'organizationId', value: 'o1' },
    ])
  })

  it('hides audit queries unless showQueries=1', () => {
    expect(auditFiltersFromSearchParams(new URLSearchParams('showQueries=0')).hideAuditQueries).toBe(true)
    expect(auditFiltersFromSearchParams(new URLSearchParams('showQueries=1')).hideAuditQueries).toBe(false)
  })
})
