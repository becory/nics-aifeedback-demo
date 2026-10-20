import { describe, expect, it } from 'vitest'
import type { Service } from '../types'
import {
  DEFAULT_TIME_SELECTION,
  buildFeedbackFilterParams,
  filtersFromSearchParams,
  filtersToSearchParams,
  formatSourceLabel,
  organizationOptions,
  previousTimeRange,
  resolveServiceCodes,
  resolveTimeRange,
  serviceOptions,
  type AppliedFeedbackFilters,
  type FilterCondition,
} from './feedbackFilters'

function service(overrides: Partial<Service>): Service {
  return {
    id: 'id',
    organizationId: 'org-a',
    organizationName: '甲機關',
    name: '服務',
    code: 'svc',
    host: 'svc.example.gov.tw',
    isActive: true,
    ...overrides,
  }
}

const services: Service[] = [
  service({ id: '1', code: 'alpha', name: 'Alpha', host: 'alpha.gov.tw', organizationId: 'org-a', organizationName: '甲機關' }),
  service({ id: '2', code: 'beta', name: 'Beta', host: 'beta.example.com', organizationId: 'org-a', organizationName: '甲機關' }),
  service({ id: '3', code: 'gamma', name: 'Gamma', host: 'Gamma.GOV.tw', organizationId: 'org-b', organizationName: '乙機關' }),
]

// Local-time "YYYY-MM-DDTHH:mm" in the same form toDatetimeLocal produces.
function local(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

describe('resolveServiceCodes', () => {
  it('returns undefined when no service or host condition narrows the services', () => {
    expect(resolveServiceCodes([{ field: 'device', value: 'iOS' }], services)).toBeUndefined()
  })

  it('ORs picked services', () => {
    const conditions: FilterCondition[] = [
      { field: 'service', value: 'alpha' },
      { field: 'service', value: 'gamma' },
    ]
    expect(resolveServiceCodes(conditions, services)).toEqual(['alpha', 'gamma'])
  })

  it('keeps services whose host contains the keyword, case-insensitively', () => {
    expect(resolveServiceCodes([{ field: 'serviceHost', value: 'gov.TW' }], services)).toEqual(['alpha', 'gamma'])
  })

  it('requires every host keyword to match', () => {
    const conditions: FilterCondition[] = [
      { field: 'serviceHost', value: 'gov' },
      { field: 'serviceHost', value: 'gamma' },
    ]
    expect(resolveServiceCodes(conditions, services)).toEqual(['gamma'])
  })

  it('intersects picked services with host keywords', () => {
    const conditions: FilterCondition[] = [
      { field: 'service', value: 'alpha' },
      { field: 'service', value: 'beta' },
      { field: 'serviceHost', value: 'example' },
    ]
    expect(resolveServiceCodes(conditions, services)).toEqual(['beta'])
  })

  it('returns an empty list when nothing matches', () => {
    expect(resolveServiceCodes([{ field: 'service', value: 'unknown' }], services)).toEqual([])
  })
})

describe('buildFeedbackFilterParams', () => {
  const range = { from: '2026-10-01T00:00:00', to: '2026-10-20T23:59:59' }

  it('leaves every filter undefined without conditions and passes the time range', () => {
    expect(buildFeedbackFilterParams([], services, range)).toEqual({
      organizationId: undefined,
      serviceId: undefined,
      feedbackRating: undefined,
      device: undefined,
      ipCountry: undefined,
      sessionId: undefined,
      source: undefined,
      from: '2026-10-01T00:00:00',
      to: '2026-10-20T23:59:59',
    })
  })

  it('maps each condition field to its param, ORing the same field as an array', () => {
    const conditions: FilterCondition[] = [
      { field: 'organization', value: 'org-a' },
      { field: 'organization', value: 'org-b' },
      { field: 'service', value: 'alpha' },
      { field: 'feedbackRating', value: 'good' },
      { field: 'feedbackRating', value: 'bad' },
      { field: 'device', value: 'iOS' },
      { field: 'ipCountry', value: 'TW' },
      { field: 'sessionId', value: 'sess-1' },
      { field: 'source', value: 'offline' },
    ]
    expect(buildFeedbackFilterParams(conditions, services, range)).toEqual({
      organizationId: ['org-a', 'org-b'],
      serviceId: ['alpha'],
      feedbackRating: ['good', 'bad'],
      device: ['iOS'],
      ipCountry: ['TW'],
      sessionId: ['sess-1'],
      source: ['offline'],
      from: '2026-10-01T00:00:00',
      to: '2026-10-20T23:59:59',
    })
  })

  it('sends the services left after intersecting picked services with host keywords', () => {
    const conditions: FilterCondition[] = [
      { field: 'service', value: 'alpha' },
      { field: 'service', value: 'gamma' },
      { field: 'serviceHost', value: 'gamma' },
    ]
    expect(buildFeedbackFilterParams(conditions, services, range)?.serviceId).toEqual(['gamma'])
  })

  it('returns null when the service conditions match no service', () => {
    expect(buildFeedbackFilterParams([{ field: 'service', value: 'nope' }], services, range)).toBeNull()
  })

  it('returns null when the host keyword matches no service', () => {
    expect(buildFeedbackFilterParams([{ field: 'serviceHost', value: 'nowhere' }], services, range)).toBeNull()
  })

  it('does not narrow services for an organization condition alone', () => {
    const params = buildFeedbackFilterParams([{ field: 'organization', value: 'org-b' }], services, range)
    expect(params?.serviceId).toBeUndefined()
    expect(params?.organizationId).toEqual(['org-b'])
  })

  it('omits empty from and missing to', () => {
    const params = buildFeedbackFilterParams([], services, { from: '' })
    expect(params?.from).toBeUndefined()
    expect(params?.to).toBeUndefined()
  })
})

describe('serviceOptions', () => {
  it('labels each service as "name (code)" sorted by label', () => {
    const list = [
      service({ code: 'z', name: 'Zeta' }),
      service({ code: 'a', name: 'Alpha' }),
      service({ code: 'm', name: 'Mu' }),
    ]
    expect(serviceOptions(list)).toEqual([
      { value: 'a', label: 'Alpha (a)' },
      { value: 'm', label: 'Mu (m)' },
      { value: 'z', label: 'Zeta (z)' },
    ])
  })

  it('returns an empty list for no services', () => {
    expect(serviceOptions([])).toEqual([])
  })
})

describe('organizationOptions', () => {
  it('lists each organization once, sorted by name', () => {
    const list = [
      service({ organizationId: 'org-c', organizationName: 'Charlie' }),
      service({ organizationId: 'org-a', organizationName: 'Alpha' }),
      service({ organizationId: 'org-c', organizationName: 'Charlie' }),
      service({ organizationId: 'org-b', organizationName: 'Bravo' }),
    ]
    expect(organizationOptions(list)).toEqual([
      { value: 'org-a', label: 'Alpha' },
      { value: 'org-b', label: 'Bravo' },
      { value: 'org-c', label: 'Charlie' },
    ])
  })
})

describe('formatSourceLabel', () => {
  it('maps known sources to their labels', () => {
    expect(formatSourceLabel('realtime')).toBe('即時')
    expect(formatSourceLabel('offline')).toBe('離線匯入')
  })

  it('shows an unknown source as-is', () => {
    expect(formatSourceLabel('api')).toBe('api')
  })

  it('shows a dash for an empty source', () => {
    expect(formatSourceLabel('')).toBe('—')
  })
})

describe('filtersToSearchParams', () => {
  it('produces an empty query for the defaults on page 1', () => {
    expect(filtersToSearchParams({ time: DEFAULT_TIME_SELECTION, conditions: [] }, 1).toString()).toBe('')
  })

  it('writes a non-default preset, conditions as repeated keys, and the page', () => {
    const filters: AppliedFeedbackFilters = {
      time: { preset: '7d', customFrom: '2026-01-01', customTo: '2026-01-02' },
      conditions: [
        { field: 'device', value: 'iOS' },
        { field: 'device', value: 'Android' },
        { field: 'service', value: 'alpha' },
      ],
    }
    const params = filtersToSearchParams(filters, 3)
    expect(params.get('range')).toBe('7d')
    expect(params.has('from')).toBe(false)
    expect(params.has('to')).toBe(false)
    expect(params.getAll('device')).toEqual(['iOS', 'Android'])
    expect(params.get('service')).toBe('alpha')
    expect(params.get('page')).toBe('3')
  })

  it('writes custom dates only when set', () => {
    const params = filtersToSearchParams(
      { time: { preset: 'custom', customFrom: '2026-10-01', customTo: '' }, conditions: [] },
      1,
    )
    expect(params.get('range')).toBe('custom')
    expect(params.get('from')).toBe('2026-10-01')
    expect(params.has('to')).toBe(false)
    expect(params.has('page')).toBe(false)
  })
})

describe('filtersFromSearchParams', () => {
  it('round-trips filters and page through the query string', () => {
    const filters: AppliedFeedbackFilters = {
      time: { preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-15' },
      conditions: [
        { field: 'organization', value: 'org-a' },
        { field: 'serviceHost', value: 'gov.tw' },
        { field: 'feedbackRating', value: 'good' },
        { field: 'source', value: 'offline' },
        { field: 'feedbackRating', value: 'bad' },
      ],
    }
    const query = filtersToSearchParams(filters, 4).toString()
    expect(filtersFromSearchParams(new URLSearchParams(query))).toEqual({ filters, page: 4 })
  })

  it('round-trips a relative preset', () => {
    const filters: AppliedFeedbackFilters = { time: { ...DEFAULT_TIME_SELECTION, preset: '60d' }, conditions: [] }
    expect(filtersFromSearchParams(filtersToSearchParams(filters, 1))).toEqual({ filters, page: 1 })
  })

  it('falls back to the defaults for an empty query', () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({ filters: { time: DEFAULT_TIME_SELECTION, conditions: [] }, page: 1 })
  })

  it('falls back to the default time for an unknown range', () => {
    expect(filtersFromSearchParams(new URLSearchParams('range=90d')).filters.time).toEqual(DEFAULT_TIME_SELECTION)
  })

  it('falls back to the default time for custom without from', () => {
    expect(filtersFromSearchParams(new URLSearchParams('range=custom&to=2026-10-01')).filters.time).toEqual(
      DEFAULT_TIME_SELECTION,
    )
  })

  it('falls back to the default time when from is after to', () => {
    expect(
      filtersFromSearchParams(new URLSearchParams('range=custom&from=2026-10-10&to=2026-10-01')).filters.time,
    ).toEqual(DEFAULT_TIME_SELECTION)
  })

  it('falls back to the default time for malformed or invalid dates', () => {
    for (const query of [
      'range=custom&from=yesterday',
      'range=custom&from=2026-13-01',
      'range=custom&from=2026-10-01&to=soon',
    ]) {
      expect(filtersFromSearchParams(new URLSearchParams(query)).filters.time).toEqual(DEFAULT_TIME_SELECTION)
    }
  })

  it('ignores from/to when the range is not custom', () => {
    expect(filtersFromSearchParams(new URLSearchParams('range=7d&from=2026-10-01')).filters.time).toEqual({
      preset: '7d',
      customFrom: '',
      customTo: '',
    })
  })

  it('accepts custom with only from, leaving to open', () => {
    expect(filtersFromSearchParams(new URLSearchParams('range=custom&from=2026-10-01')).filters.time).toEqual({
      preset: 'custom',
      customFrom: '2026-10-01',
      customTo: '',
    })
  })

  it('keeps only the date part of older datetime-local values', () => {
    const query = 'range=custom&from=2026-10-01T08:30&to=2026-10-05T17:00'
    expect(filtersFromSearchParams(new URLSearchParams(query)).filters.time).toEqual({
      preset: 'custom',
      customFrom: '2026-10-01',
      customTo: '2026-10-05',
    })
  })

  it('ignores unknown keys and blank or duplicate condition values, keeping URL order', () => {
    const query = 'foo=bar&device=iOS&utm_source=x&service=alpha&device=%20%20&device=iOS&ipCountry=%20TW%20'
    expect(filtersFromSearchParams(new URLSearchParams(query)).filters.conditions).toEqual([
      { field: 'device', value: 'iOS' },
      { field: 'service', value: 'alpha' },
      { field: 'ipCountry', value: 'TW' },
    ])
  })

  it('falls back to page 1 for a missing, invalid, or non-positive page', () => {
    for (const query of ['', 'page=abc', 'page=0', 'page=-2', 'page=1']) {
      expect(filtersFromSearchParams(new URLSearchParams(query)).page).toBe(1)
    }
    expect(filtersFromSearchParams(new URLSearchParams('page=7')).page).toBe(7)
  })
})

describe('resolveTimeRange', () => {
  const now = new Date(2026, 5, 30, 12, 34)

  it('goes back the preset number of days from now with an open end', () => {
    expect(resolveTimeRange({ ...DEFAULT_TIME_SELECTION, preset: '7d' }, now)).toEqual({
      from: local(new Date(2026, 5, 23, 12, 34)),
    })
    expect(resolveTimeRange({ ...DEFAULT_TIME_SELECTION, preset: '30d' }, now)).toEqual({
      from: local(new Date(2026, 4, 31, 12, 34)),
    })
    expect(resolveTimeRange({ ...DEFAULT_TIME_SELECTION, preset: '60d' }, now)).toEqual({
      from: local(new Date(2026, 4, 1, 12, 34)),
    })
  })

  it('covers whole custom days from 00:00:00 to 23:59:59', () => {
    expect(resolveTimeRange({ preset: 'custom', customFrom: '2026-10-01', customTo: '2026-10-05' }, now)).toEqual({
      from: '2026-10-01T00:00:00',
      to: '2026-10-05T23:59:59',
    })
  })

  it('leaves a custom range open where a date is missing', () => {
    expect(resolveTimeRange({ preset: 'custom', customFrom: '', customTo: '' }, now)).toEqual({
      from: '',
      to: undefined,
    })
  })
})

describe('previousTimeRange', () => {
  it('returns the equally long window ending where the range starts', () => {
    expect(previousTimeRange({ from: '2026-06-10T00:00:00', to: '2026-06-20T00:00:00' })).toEqual({
      from: '2026-05-31T00:00',
      to: '2026-06-10T00:00:00',
    })
  })

  it('treats an open-ended range as ending now', () => {
    const now = new Date(2026, 5, 20, 6, 0)
    expect(previousTimeRange({ from: '2026-06-15T06:00' }, now)).toEqual({
      from: '2026-06-10T06:00',
      to: '2026-06-15T06:00',
    })
  })

  it('returns null for an invalid range', () => {
    expect(previousTimeRange({ from: '' })).toBeNull()
    expect(previousTimeRange({ from: 'not a date', to: '2026-06-20T00:00:00' })).toBeNull()
  })

  it('returns null for a zero or negative span', () => {
    expect(previousTimeRange({ from: '2026-06-10T00:00:00', to: '2026-06-10T00:00:00' })).toBeNull()
    expect(previousTimeRange({ from: '2026-06-20T00:00:00', to: '2026-06-10T00:00:00' })).toBeNull()
  })
})
