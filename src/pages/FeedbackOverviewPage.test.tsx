import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackOverviewPage } from './FeedbackOverviewPage'
import {
  getFeedbackOverview,
  getFeedbackServiceRatings,
  getFeedbackTopColumns,
  getFeedbacks,
  getScoreConfigs,
  getServices,
  type FeedbackOverview,
  type FeedbackServiceRating,
  type FeedbackTopColumns,
} from '../api'
import type { Feedback, ScoreConfig, Service } from '../types'

vi.mock('../api', () => ({
  getFeedbackOverview: vi.fn(),
  getFeedbackServiceRatings: vi.fn(),
  getFeedbackTopColumns: vi.fn(),
  getFeedbacks: vi.fn(),
  getScoreConfigs: vi.fn(),
  getServices: vi.fn(),
}))

const api = {
  overview: vi.mocked(getFeedbackOverview),
  serviceRatings: vi.mocked(getFeedbackServiceRatings),
  topColumns: vi.mocked(getFeedbackTopColumns),
  feedbacks: vi.mocked(getFeedbacks),
  scoreConfigs: vi.mocked(getScoreConfigs),
  services: vi.mocked(getServices),
}

const respond = <T,>(data: T) => Promise.resolve({ data } as AxiosResponse<T>)

function apiError(message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 500,
    data: { message },
  } as AxiosResponse)
}

// "Now" is local noon, so the presets resolve to the same local strings in every time zone
// without DST (UTC, Asia/Taipei).
const NOW = new Date(2026, 9, 20, 12, 0, 0)
const FROM_30D = '2026-09-20T12:00'
const FROM_7D = '2026-10-13T12:00'
const FROM_60D = '2026-08-21T12:00'

const services: Service[] = [
  { id: '1', organizationId: 'org1', organizationName: '甲機關', name: 'Alpha', code: 'svc-a', host: 'a.example.com', isActive: true },
  { id: '2', organizationId: 'org1', organizationName: '甲機關', name: 'Beta', code: 'svc-b', host: 'b.Example.com', isActive: true },
  { id: '3', organizationId: 'org2', organizationName: '乙機關', name: 'Gamma', code: 'svc-c', host: 'other.org', isActive: true },
]

// Shuffled, and bad scores higher than normal: names must still follow the ids.
const scoreConfigs: ScoreConfig[] = [
  { id: 'normal', name: '普通', description: '', scoreValue: 50 },
  { id: 'bad', name: '不佳', description: '', scoreValue: 60 },
  { id: 'good', name: '滿意', description: '', scoreValue: 100 },
]

const overview = (over: Partial<FeedbackOverview> = {}): FeedbackOverview => ({
  totalCount: 10,
  averageScore: 80,
  counts: [],
  ...over,
})

const ratingColumns: FeedbackTopColumns = {
  column: 'rate',
  items: [
    { value: 'bad', label: 'bad', count: 1 },
    { value: 'good', label: 'good', count: 6 },
    { value: 'normal', label: 'normal', count: 3 },
  ],
  distinctCount: 3,
}

const deviceColumns: FeedbackTopColumns = {
  column: 'device',
  items: [
    { value: 'iOS', label: 'iOS', count: 7 },
    { value: '', label: '', count: 3 },
  ],
  distinctCount: 3,
}

const serviceRatings: FeedbackServiceRating[] = [
  { serviceId: 'svc-a', label: 'Alpha', totalCount: 4, ratingCounts: { good: 2, normal: 1, bad: 1 }, averageScore: 62.5 },
  { serviceId: 'svc-b', label: 'Beta', totalCount: 6, ratingCounts: { good: 4, normal: 2 }, averageScore: 83.33 },
  { serviceId: 'svc-c', label: 'Gamma', totalCount: 0, ratingCounts: {}, averageScore: null },
]

const feedbackRow = (over: Partial<Feedback> = {}): Feedback => ({
  id: 'f1',
  organizationId: 'org1',
  organizationName: '甲機關',
  serviceId: 'svc-a',
  serviceName: 'Alpha',
  ipAsn: '',
  ipCountry: 'TW',
  ipAddress: '1.2.3.4',
  note: '',
  createdAt: '2026-10-19T01:00:00Z',
  feedbackComment: '',
  userAgent: '',
  feedbackRating: 'bad',
  inferenceSec: 0,
  sessionId: 'sess-1',
  originHost: 'a.example.com',
  device: 'iOS',
  source: 'realtime',
  ...over,
} as Feedback)

/** The previous-period request ends where a current-period request starts. */
const isPreviousPeriod = (params: { to?: string } | undefined) =>
  !!params?.to && api.overview.mock.calls.some(([other]) => other?.from === params.to)

/** Default backend: current period avg 80, previous 75.5. */
function mockBackend({ current = overview(), previous = overview({ averageScore: 75.5 }) } = {}) {
  api.services.mockReturnValue(respond({ data: services }) as never)
  api.scoreConfigs.mockReturnValue(respond({ data: scoreConfigs }) as never)
  api.overview.mockImplementation((params) => respond(isPreviousPeriod(params) ? previous : current) as never)
  api.topColumns.mockImplementation((params) => respond(params?.groupBy === 'rate' ? ratingColumns : deviceColumns) as never)
  api.serviceRatings.mockReturnValue(respond({ data: serviceRatings }) as never)
  api.feedbacks.mockReturnValue(respond({ data: [feedbackRow()] }) as never)
}

function LocationProbe() {
  const { search } = useLocation()
  return <output aria-label="location">{decodeURIComponent(search)}</output>
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/feedback${search}`]}>
      <FeedbackOverviewPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const loaded = () => screen.findByText('總平均分數')
const currentLocation = () => screen.getByRole('status', { name: 'location' }).textContent

/** The latest current-period overview request's params. */
const lastCurrentParams = () => api.overview.mock.calls.map(([params]) => params).findLast((params) => !isPreviousPeriod(params))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  for (const fn of Object.values(api)) fn.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FeedbackOverviewPage: rating names', () => {
  it('names each rating by the score config with the same id, not by score order (regression)', async () => {
    mockBackend()
    renderPage()
    await loaded()

    // Donut legend: each label with its own share (good 6, normal 3, bad 1 of 10).
    const legend = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(legend).toEqual(['滿意60%', '普通30%', '不佳10%'])
    // 好評率 hint uses good's name.
    expect(screen.getByText('共 6 筆 滿意')).toBeInTheDocument()
    // Activity log shows the bad row with bad's name.
    const table = within(screen.getByRole('table'))
    expect(table.getByText('不佳')).toBeInTheDocument()
  })

  it('falls back to the raw codes when score configs are missing', async () => {
    mockBackend()
    api.scoreConfigs.mockReturnValue(respond({ data: [] }) as never)
    renderPage()
    await loaded()

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['good60%', 'normal30%', 'bad10%'])
  })

  it('offers the rating names in the 評價 filter and sends the rating code', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: '＋新增' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '篩選欄位' }), '評價')
    const ratingSelect = screen.getByRole('combobox', { name: '評價' })
    expect(within(ratingSelect).getAllByRole('option').map((o) => o.textContent)).toEqual([
      '請選擇評價',
      '滿意',
      '普通',
      '不佳',
    ])
    await user.selectOptions(ratingSelect, '不佳')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ feedbackRating: ['bad'] }))
    expect(screen.getByRole('button', { name: '移除 評價 篩選' }).parentElement).toHaveTextContent('評價不佳')
  })
})

describe('FeedbackOverviewPage: filter params', () => {
  it('requests every visible service for the last 30 days by default', async () => {
    mockBackend()
    renderPage()
    await loaded()

    expect(api.services).toHaveBeenCalledWith({ currentUser: true })
    const base = { from: FROM_30D }
    expect(api.overview).toHaveBeenCalledTimes(2)
    expect(api.overview.mock.calls[0][0]).toEqual({
      organizationId: undefined,
      serviceId: undefined,
      feedbackRating: undefined,
      device: undefined,
      ipCountry: undefined,
      sessionId: undefined,
      source: undefined,
      from: FROM_30D,
      to: undefined,
    })
    // Previous period: the 30 days right before.
    expect(api.overview.mock.calls[1][0]).toMatchObject({ from: FROM_60D, to: FROM_30D })
    expect(api.topColumns).toHaveBeenCalledWith(expect.objectContaining({ ...base, groupBy: 'rate' }))
    expect(api.topColumns).toHaveBeenCalledWith(expect.objectContaining({ ...base, groupBy: 'device' }))
    expect(api.serviceRatings).toHaveBeenCalledWith(expect.objectContaining(base))
    expect(api.feedbacks).toHaveBeenCalledWith(expect.objectContaining({ ...base, page: 1, pageSize: 25 }))
    expect(screen.getByText(`資料區間：2026/09/20 12:00 – 至今（近 30 天）`)).toBeInTheDocument()
  })

  it('turns the conditions in the link into API params (same field OR, host keyword case-insensitive)', async () => {
    mockBackend()
    renderPage(
      '?serviceHost=EXAMPLE&organization=org1&device=iOS&device=Android&feedbackRating=bad&ipCountry=TW&sessionId=s1&source=offline',
    )
    await loaded()

    const expected = {
      organizationId: ['org1'],
      serviceId: ['svc-a', 'svc-b'],
      feedbackRating: ['bad'],
      device: ['iOS', 'Android'],
      ipCountry: ['TW'],
      sessionId: ['s1'],
      source: ['offline'],
      from: FROM_30D,
    }
    expect(api.overview.mock.calls[0][0]).toEqual({ ...expected, to: undefined })
    expect(api.topColumns).toHaveBeenCalledWith({ ...expected, groupBy: 'rate' })
    expect(api.topColumns).toHaveBeenCalledWith({ ...expected, groupBy: 'device' })
    expect(api.serviceRatings).toHaveBeenCalledWith(expected)
    expect(api.feedbacks).toHaveBeenCalledWith({ ...expected, page: 1, pageSize: 25 })
  })

  it('combines picked services with host keywords (AND)', async () => {
    mockBackend()
    renderPage('?service=svc-a&service=svc-c&serviceHost=example')
    await loaded()

    expect(api.overview.mock.calls[0][0]).toMatchObject({ serviceId: ['svc-a'] })
  })

  it('sends no feedback request when the service conditions match no service', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage('?serviceHost=nomatch&feedbackRating=good')

    // The rating chip turns into its name once the score configs (loaded with the services) are in.
    expect(await screen.findByTitle('滿意')).toBeInTheDocument()
    expect(screen.getByText('沒有符合篩選條件的服務')).toBeInTheDocument()
    expect(api.overview).not.toHaveBeenCalled()
    expect(api.topColumns).not.toHaveBeenCalled()
    expect(api.serviceRatings).not.toHaveBeenCalled()
    expect(api.feedbacks).not.toHaveBeenCalled()

    // Removing the condition queries again.
    await user.click(screen.getByRole('button', { name: '移除 網域 篩選' }))
    await loaded()
    expect(lastCurrentParams()).toMatchObject({ serviceId: undefined, feedbackRating: ['good'] })
    expect(currentLocation()).toBe('?feedbackRating=good')
  })

  it('adds a free-text condition, queries with it and writes it to the link', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: '＋新增' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '篩選欄位' }), '裝置')
    await user.type(screen.getByRole('textbox', { name: '關鍵字' }), 'Android{Enter}')

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ device: ['Android'], from: FROM_30D }))
    expect(api.feedbacks).toHaveBeenLastCalledWith(expect.objectContaining({ device: ['Android'], page: 1 }))
    expect(currentLocation()).toBe('?device=Android')
  })

  it('picks a service from the list and sends its code', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: '＋新增' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '篩選欄位' }), '服務')
    const options = within(screen.getByRole('listbox', { name: '服務' })).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Alpha (svc-a)', 'Beta (svc-b)', 'Gamma (svc-c)'])
    await user.type(screen.getByRole('combobox', { name: '服務' }), 'beta{Enter}')

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ serviceId: ['svc-b'] }))
    expect(screen.getByTitle('Beta (svc-b)')).toBeInTheDocument()
  })

  it('sends the organization id for an organization condition', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage()
    await loaded()

    await user.click(screen.getByRole('button', { name: '＋新增' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '篩選欄位' }), '組織')
    await user.type(screen.getByRole('combobox', { name: '組織' }), '乙{Enter}')

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ organizationId: ['org2'], serviceId: undefined }))
  })

  it('clears all conditions with 清除', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage('?device=iOS&source=offline')
    await loaded()

    await user.click(screen.getByRole('button', { name: '× 清除' }))

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ device: undefined, source: undefined }))
    expect(currentLocation()).toBe('')
  })
})

describe('FeedbackOverviewPage: time range', () => {
  it('marks 近 30 天 as the default preset', async () => {
    mockBackend()
    renderPage()
    await loaded()

    expect(screen.getByRole('button', { name: '近 30 天' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('queries the last 7 days (and the 7 days before as the previous period) after clicking 近 7 天', async () => {
    mockBackend()
    const user = userEvent.setup()
    renderPage('?device=iOS')
    await loaded()

    await user.click(screen.getByRole('button', { name: '近 7 天' }))

    await waitFor(() => expect(lastCurrentParams()).toMatchObject({ from: FROM_7D, to: undefined, device: ['iOS'] }))
    const previous = api.overview.mock.calls[api.overview.mock.calls.length - 1][0]
    expect(previous).toMatchObject({ from: '2026-10-06T12:00', to: FROM_7D, device: ['iOS'] })
    expect(screen.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'true')
    expect(currentLocation()).toBe('?range=7d&device=iOS')
    expect(await screen.findByText('資料區間：2026/10/13 12:00 – 至今（近 7 天）')).toBeInTheDocument()
  })

  it('opens with the 60-day preset from the link', async () => {
    mockBackend()
    renderPage('?range=60d')
    await loaded()

    expect(api.overview.mock.calls[0][0]).toMatchObject({ from: FROM_60D })
    expect(screen.getByRole('button', { name: '近 60 天' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('queries whole days for a custom range from the link', async () => {
    mockBackend()
    renderPage('?range=custom&from=2026-10-01&to=2026-10-05')
    await loaded()

    expect(api.overview.mock.calls[0][0]).toMatchObject({ from: '2026-10-01T00:00:00', to: '2026-10-05T23:59:59' })
    // Previous period: the same length right before the start.
    expect(api.overview.mock.calls[1][0]).toMatchObject({ from: '2026-09-26T00:00', to: '2026-10-01T00:00:00' })
    expect(screen.getByText('資料區間：2026/10/01 00:00 – 2026/10/05 23:59')).toBeInTheDocument()
  })

  it('falls back to 近 30 天 for an invalid custom range in the link', async () => {
    mockBackend()
    renderPage('?range=custom&from=2026-10-05&to=2026-10-01')
    await loaded()

    expect(api.overview.mock.calls[0][0]).toMatchObject({ from: FROM_30D, to: undefined })
  })
})

describe('FeedbackOverviewPage: summary and charts', () => {
  it('shows the average score with its change, the good rate and the total', async () => {
    mockBackend()
    renderPage()
    await loaded()

    expect(screen.getByText('80.0')).toBeInTheDocument()
    expect(screen.getByText('較上期 ↑4.5')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it.each([
    [80, '較上期 ↓4.5'],
    [75.5, '與上期持平'],
    [null, '上期無資料'],
  ])('describes a previous average of %s as "%s"', async (prevAvg, text) => {
    mockBackend({ current: overview({ averageScore: 75.5 }), previous: overview({ averageScore: prevAvg }) })
    renderPage()
    await loaded()

    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('shows "—" for the average and good rate when nothing is scored', async () => {
    mockBackend({ current: overview({ averageScore: null }) })
    api.topColumns.mockImplementation((params) =>
      respond(params?.groupBy === 'rate' ? { ...ratingColumns, items: [] } : deviceColumns) as never,
    )
    renderPage()
    await loaded()

    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText(/上期/)).not.toBeInTheDocument()
  })

  it('lists services by average score (highest first), leaving out unscored ones', async () => {
    mockBackend()
    renderPage()
    await loaded()

    const card = screen.getByRole('heading', { name: '各服務平均分數' }).parentElement!
    const rows = within(card).getAllByTitle(/（svc-/)
    expect(rows.map((r) => r.getAttribute('title'))).toEqual(['Beta（svc-b）：83.3 分，6 筆', 'Alpha（svc-a）：62.5 分，4 筆'])
  })

  it('shows per-service feedback counts split by rating name', async () => {
    mockBackend()
    renderPage()
    await loaded()

    const card = within(screen.getByRole('heading', { name: '各服務回饋數' }).parentElement!)
    expect(card.getByTitle('Alpha｜不佳：1 筆（佔 25%）')).toBeInTheDocument()
    expect(card.getByTitle('Beta｜滿意：4 筆（佔 66.7%）')).toBeInTheDocument()
    expect(card.getByText('滿意')).toBeInTheDocument()
    expect(card.getByText('不佳')).toBeInTheDocument()
  })

  it('shows the top devices, naming an empty device 未知', async () => {
    mockBackend()
    renderPage()
    await loaded()

    const card = within(screen.getByRole('heading', { name: '主要裝置' }).parentElement!)
    expect(card.getByTitle('iOS：7 筆')).toBeInTheDocument()
    expect(card.getByTitle('未知：3 筆')).toBeInTheDocument()
    expect(card.getByText('共 3 種裝置類型，顯示前 2 名')).toBeInTheDocument()
  })

  it('notes how many services are left out of the charts beyond 10', async () => {
    mockBackend()
    api.serviceRatings.mockReturnValue(
      respond({
        data: Array.from({ length: 12 }, (_, i) => ({
          serviceId: `s${i}`,
          label: `S${i}`,
          totalCount: 1,
          ratingCounts: { good: 1 },
          averageScore: 100,
        })),
      }) as never,
    )
    renderPage()
    await loaded()

    expect(screen.getAllByText('另有 2 個服務')).toHaveLength(2)
  })

  it('shows an empty state when the period has no feedback', async () => {
    mockBackend({ current: overview({ totalCount: 0, averageScore: null }) })
    renderPage()

    expect(await screen.findByText('此條件下沒有回饋紀錄')).toBeInTheDocument()
    expect(screen.queryByText('總平均分數')).not.toBeInTheDocument()
  })
})

describe('FeedbackOverviewPage: activity log and errors', () => {
  it('loads the next page with the same filters and keeps the page in the link', async () => {
    mockBackend({ current: overview({ totalCount: 60 }) })
    const user = userEvent.setup()
    renderPage('?device=iOS')
    await loaded()

    await user.click(screen.getByRole('button', { name: '下一頁' }))

    await waitFor(() =>
      expect(api.feedbacks).toHaveBeenLastCalledWith(expect.objectContaining({ device: ['iOS'], page: 2, pageSize: 25 })),
    )
    expect(currentLocation()).toBe('?device=iOS&page=2')
  })

  it('opens on the page from the link and goes back to page 1 when the filters change', async () => {
    mockBackend({ current: overview({ totalCount: 60 }) })
    const user = userEvent.setup()
    renderPage('?page=3')
    await loaded()
    expect(api.feedbacks).toHaveBeenCalledWith(expect.objectContaining({ page: 3 }))

    await user.click(screen.getByRole('button', { name: '近 7 天' }))

    await waitFor(() =>
      expect(api.feedbacks).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, from: FROM_7D })),
    )
    expect(currentLocation()).toBe('?range=7d')
  })

  it('shows the load error with the API message and retries on 重試', async () => {
    mockBackend()
    api.serviceRatings.mockRejectedValueOnce(apiError('資料庫忙碌'))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('載入回饋資料時發生錯誤：資料庫忙碌')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重試' }))

    await loaded()
    expect(screen.queryByText(/載入回饋資料時發生錯誤/)).not.toBeInTheDocument()
  })

  it('shows the activity log error separately from the charts', async () => {
    mockBackend()
    api.feedbacks.mockRejectedValue(apiError('逾時'))
    renderPage()
    await loaded()

    expect(await screen.findByText('載入活動記錄時發生錯誤：逾時')).toBeInTheDocument()
  })
})
