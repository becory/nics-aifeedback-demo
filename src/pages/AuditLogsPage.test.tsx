import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditLogsPage } from './AuditLogsPage'
import { getAuditLogs, getOrganizations, getUsers } from '../api'
import type { AuditLogEntry, DataResponse, Organization, User } from '../types'

vi.mock('../api', () => ({
  getAuditLogs: vi.fn(),
  getOrganizations: vi.fn(),
  getUsers: vi.fn(),
}))

const mockedGetAuditLogs = vi.mocked(getAuditLogs)
const mockedGetOrganizations = vi.mocked(getOrganizations)
const mockedGetUsers = vi.mocked(getUsers)

type AuditResponse = AxiosResponse<DataResponse<AuditLogEntry[]>>
const ok = <T,>(data: T) => Promise.resolve({ data } as AxiosResponse<T>)
const page = (data: AuditLogEntry[], nextPageToken?: string) => ok({ data, nextPageToken })

const NOW = new Date('2026-10-20T04:00:00Z')
const SEVEN_DAYS_AGO = '2026-10-13T04:00:00.000Z'
const HIDE_QUERIES = '-auditLogs.queried'

const alice: User = { id: 'u-alice', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: true }
const bob: User = { id: 'u-bob', name: 'Bob', email: 'b@example.com', organizationIds: [], isSystemAdmin: false }
const orgA: Organization = { id: 'org-a', name: '甲機關', code: 'A', isActive: true }

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    insertId: 'ins-1',
    timestamp: '2026-10-19T16:30:00Z',
    severity: 'INFO',
    eventType: 'auth.login_succeeded',
    description: 'User logged in',
    userId: 'u-alice',
    clientIp: '203.0.113.5',
    resource: null,
    properties: {},
    ...overrides,
  }
}

function LocationProbe() {
  const { search } = useLocation()
  return <output aria-label="search">{search}</output>
}

function renderPage(path = '/audit-logs') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuditLogsPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const currentSearch = () => new URLSearchParams(screen.getByLabelText('search').textContent ?? '')
const lastParams = () => mockedGetAuditLogs.mock.lastCall?.[0]

/** Opens 「＋新增」, picks field and value, and commits with Enter. */
async function addCondition(user: ReturnType<typeof userEvent.setup>, fieldLabel: string, value: string) {
  await user.click(screen.getByRole('button', { name: '＋新增' }))
  await user.selectOptions(screen.getByRole('combobox', { name: '篩選欄位' }), fieldLabel)
  const valueControl = screen.queryByRole('textbox', { name: '關鍵字' })
  if (valueControl) {
    await user.type(valueControl, value)
  } else {
    await user.selectOptions(screen.getByRole('combobox', { name: fieldLabel }), value)
  }
  await user.keyboard('{Enter}')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  mockedGetUsers.mockImplementation(() => ok({ data: [alice, bob] }))
  mockedGetOrganizations.mockImplementation(() => ok({ data: [orgA] }))
  mockedGetAuditLogs.mockImplementation(() => page([entry()]))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuditLogsPage query', () => {
  it('queries the last 7 days without audit-query events by default', async () => {
    renderPage()
    await screen.findByText('登入成功')

    expect(mockedGetAuditLogs).toHaveBeenCalledTimes(1)
    expect(mockedGetAuditLogs).toHaveBeenCalledWith({
      eventType: [HIDE_QUERIES],
      from: SEVEN_DAYS_AGO,
      pageSize: 50,
    })
    expect(currentSearch().toString()).toBe('')
    // Deleted users are included so old entries still resolve to names.
    expect(mockedGetUsers).toHaveBeenCalledWith(true)
  })

  it('switching the time preset queries the new range and writes it to the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')

    await user.click(screen.getByRole('button', { name: '近 24 小時' }))

    expect(lastParams()).toEqual(expect.objectContaining({ from: '2026-10-19T04:00:00.000Z', pageSize: 50 }))
    expect(currentSearch().get('range')).toBe('24h')
    expect(screen.getByRole('button', { name: '近 24 小時' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: '近 30 天' }))
    expect(lastParams()?.from).toBe('2026-09-20T04:00:00.000Z')
    expect(currentSearch().get('range')).toBe('30d')
  })

  it('turns conditions into API params and the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')

    await addCondition(user, '事件類別', '認證')
    expect(lastParams()?.eventType).toEqual(['auth.*', HIDE_QUERIES])

    await addCondition(user, '最低等級', '警告以上')
    await addCondition(user, '操作者', 'Bob')
    await addCondition(user, '對象使用者', 'Alice')
    await addCondition(user, '組織', '甲機關 (A)')
    await addCondition(user, 'IP', '198.51.100.7')

    expect(lastParams()).toEqual(
      expect.objectContaining({
        eventType: ['auth.*', HIDE_QUERIES],
        minSeverity: 'WARNING',
        userId: ['u-bob'],
        targetUserId: ['u-alice'],
        organizationId: ['org-a'],
        clientIp: ['198.51.100.7'],
        from: SEVEN_DAYS_AGO,
        pageSize: 50,
      }),
    )
    const search = currentSearch()
    expect(search.get('category')).toBe('auth')
    expect(search.get('minSeverity')).toBe('WARNING')
    expect(search.get('userId')).toBe('u-bob')
    expect(search.get('clientIp')).toBe('198.51.100.7')
  })

  it('minimum severity is a single value: picking another replaces it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')

    await addCondition(user, '最低等級', '警告以上')
    await addCondition(user, '最低等級', '錯誤以上')

    expect(lastParams()?.minSeverity).toBe('ERROR')
    expect(currentSearch().getAll('minSeverity')).toEqual(['ERROR'])
  })

  it('removing a condition and clearing all drop them from the query', async () => {
    const user = userEvent.setup()
    renderPage('/audit-logs?category=auth&category=user&clientIp=1.2.3.4')
    await screen.findByText('登入成功')
    expect(lastParams()?.eventType).toEqual(['auth.*', 'user.*', HIDE_QUERIES])

    await user.click(screen.getByRole('button', { name: '移除 IP 篩選' }))
    expect(lastParams()?.clientIp).toBeUndefined()
    expect(currentSearch().get('clientIp')).toBeNull()

    await user.click(screen.getByRole('button', { name: '× 清除' }))
    expect(lastParams()?.eventType).toEqual([HIDE_QUERIES])
    expect(currentSearch().toString()).toBe('')
  })

  it('showing audit-query events stops excluding them and is kept in the URL', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')

    await user.click(screen.getByRole('checkbox', { name: '隱藏「查詢稽核日誌」事件' }))

    expect(lastParams()?.eventType).toBeUndefined()
    expect(currentSearch().get('showQueries')).toBe('1')
  })

  it('restores filters from the URL, including a custom range, for the first query', async () => {
    renderPage('/audit-logs?range=custom&from=2026-10-01T08:00&to=2026-10-02T09:30&userId=u-bob&showQueries=1')
    await screen.findByText('登入成功')

    expect(mockedGetAuditLogs).toHaveBeenCalledTimes(1)
    expect(mockedGetAuditLogs).toHaveBeenCalledWith({
      userId: ['u-bob'],
      // The picker time is local; it is sent as the matching instant.
      from: new Date('2026-10-01T08:00').toISOString(),
      to: new Date('2026-10-02T09:30').toISOString(),
      pageSize: 50,
    })
    expect(screen.getByRole('button', { name: '移除 操作者 篩選' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '隱藏「查詢稽核日誌」事件' })).not.toBeChecked()
  })

  it('queries a custom range picked in the filter bar only when 查詢 is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')
    const before = mockedGetAuditLogs.mock.calls.length

    await user.click(screen.getByRole('button', { name: '自訂' }))
    await user.keyboard('2026-10-01 08:00')
    await user.click(screen.getByRole('textbox', { name: '結束時間' }))
    await user.keyboard('2026-10-02 09:30')
    expect(mockedGetAuditLogs.mock.calls.length).toBe(before)

    await user.click(screen.getByRole('button', { name: '查詢' }))
    await waitFor(() =>
      expect(lastParams()).toMatchObject({
        from: new Date('2026-10-01T08:00').toISOString(),
        to: new Date('2026-10-02T09:30').toISOString(),
      }),
    )
    expect(mockedGetAuditLogs.mock.calls.length).toBe(before + 1)
    expect(currentSearch().get('range')).toBe('custom')
  })

  it('falls back to the default range for an invalid range in the URL', async () => {
    renderPage('/audit-logs?range=1y')
    await screen.findByText('登入成功')
    expect(lastParams()?.from).toBe(SEVEN_DAYS_AGO)
  })

  it('only shows the response of the latest query when responses arrive out of order', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('登入成功')

    const pending: ((r: AuditResponse) => void)[] = []
    mockedGetAuditLogs.mockImplementation(() => new Promise((r) => pending.push(r)))
    await user.click(screen.getByRole('button', { name: '近 24 小時' }))
    await user.click(screen.getByRole('button', { name: '近 30 天' }))

    pending[1]({ data: { data: [entry({ insertId: 'new', eventType: 'user.created' })] } } as AuditResponse)
    expect(await screen.findByText('新增使用者')).toBeInTheDocument()
    pending[0]({ data: { data: [entry({ insertId: 'stale', eventType: 'user.deleted' })] } } as AuditResponse)

    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText('刪除使用者')).not.toBeInTheDocument()
    expect(screen.getByText('新增使用者')).toBeInTheDocument()
  })
})

describe('AuditLogsPage results', () => {
  it('shows each entry with Taipei time, Chinese event label, actor name, IP and description', async () => {
    renderPage()
    const row = (await screen.findByText('登入成功')).closest('tr')!
    const cells = within(row)

    expect(cells.getByText('2026-10-20 00:30:00 GMT+8')).toBeInTheDocument()
    expect(cells.getByText('INFO')).toBeInTheDocument()
    expect(cells.getByText('auth.login_succeeded')).toBeInTheDocument()
    expect(cells.getByText('Alice')).toBeInTheDocument()
    expect(cells.getByText('203.0.113.5')).toBeInTheDocument()
    expect(cells.getByText('User logged in')).toBeInTheDocument()
    expect(screen.getByText('已載入 1 筆（最新在前）')).toBeInTheDocument()
    expect(screen.getByText('已無更多資料')).toBeInTheDocument()
  })

  it('describes the target of each event, most specific first', async () => {
    mockedGetAuditLogs.mockImplementation(() =>
      page([
        entry({ insertId: '1', description: 'd1', properties: { targetUserId: 'u-bob', organizationId: 'org-a' } }),
        entry({ insertId: '2', description: 'd2', properties: { targetUserId: 'u-gone' } }),
        entry({ insertId: '3', description: 'd3', properties: { agentCode: 'AG1' } }),
        entry({
          insertId: '4',
          description: 'd4',
          eventType: 'organizationKey.created',
          properties: { keyPreview: 'ab12…', organizationId: 'org-a' },
        }),
        entry({ insertId: '5', description: 'd5', properties: { serviceCode: 'SVC', organizationId: 'org-a' } }),
        entry({ insertId: '6', description: 'd6', properties: { organizationId: 'org-a' } }),
        entry({ insertId: '7', description: 'd7', properties: { organizationCode: 'ZZ' } }),
        entry({ insertId: '8', description: 'd8', resource: '/api/x', userId: 'u-unknown' }),
        entry({ insertId: '9', description: '', userId: null, clientIp: null, eventType: 'custom.event' }),
      ]),
    )
    renderPage()
    await screen.findAllByText('登入成功')

    const target = (description: string) => within(screen.getByText(description).closest('tr')!)
    expect(target('d1').getByText('Bob')).toBeInTheDocument()
    expect(target('d2').getByText('u-gone')).toBeInTheDocument()
    expect(target('d3').getByText('服務代理 AG1')).toBeInTheDocument()
    expect(target('d4').getByText('離線金鑰 ab12…（甲機關）')).toBeInTheDocument()
    expect(target('d5').getByText('服務 SVC')).toBeInTheDocument()
    expect(target('d6').getByText('組織 甲機關')).toBeInTheDocument()
    expect(target('d7').getByText('組織 ZZ')).toBeInTheDocument()
    expect(target('d8').getByText('/api/x')).toBeInTheDocument()
    // Unknown actor ids fall back to the raw id.
    expect(target('d8').getByText('u-unknown')).toBeInTheDocument()

    // An unlisted event type shows as-is; missing actor, target, IP and description show "—".
    const last = within(screen.getAllByText('custom.event')[0].closest('tr')!)
    expect(last.getAllByText('—')).toHaveLength(4)
  })

  it('still lists entries with raw ids when users and organizations cannot be loaded', async () => {
    mockedGetUsers.mockImplementation(() => Promise.reject(new Error('down')))
    mockedGetOrganizations.mockImplementation(() => Promise.reject(new Error('down')))
    mockedGetAuditLogs.mockImplementation(() => page([entry({ properties: { organizationId: 'org-a' } })]))
    renderPage()

    const row = within((await screen.findByText('登入成功')).closest('tr')!)
    expect(row.getByText('u-alice')).toBeInTheDocument()
    expect(row.getByText('組織 org-a')).toBeInTheDocument()
  })

  it('loads more with the page token and the same params, appending entries', async () => {
    const user = userEvent.setup()
    mockedGetAuditLogs
      .mockImplementationOnce(() => page([entry({ insertId: 'a', eventType: 'user.created' })], 'token-2'))
      .mockImplementationOnce(() => page([entry({ insertId: 'b', eventType: 'user.deleted' })]))
    renderPage('/audit-logs?range=24h')
    await screen.findByText('新增使用者')

    await user.click(screen.getByRole('button', { name: '載入更多' }))

    expect(mockedGetAuditLogs).toHaveBeenLastCalledWith({
      eventType: [HIDE_QUERIES],
      from: '2026-10-19T04:00:00.000Z',
      pageSize: 50,
      pageToken: 'token-2',
    })
    expect(await screen.findByText('刪除使用者')).toBeInTheDocument()
    expect(screen.getByText('新增使用者')).toBeInTheDocument()
    expect(screen.getByText('已載入 2 筆（最新在前）')).toBeInTheDocument()
    expect(screen.getByText('已無更多資料')).toBeInTheDocument()
  })

  it('keeps the loaded entries when loading more fails', async () => {
    const user = userEvent.setup()
    mockedGetAuditLogs
      .mockImplementationOnce(() => page([entry()], 'token-2'))
      .mockImplementationOnce(() => Promise.reject(new Error('down')))
    renderPage()
    await screen.findByText('登入成功')

    await user.click(screen.getByRole('button', { name: '載入更多' }))

    expect(await screen.findByText('查詢稽核日誌時發生錯誤')).toBeInTheDocument()
    expect(screen.getByText('登入成功')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '載入更多' })).toBeEnabled()
  })

  it('shows an empty state when nothing matches', async () => {
    mockedGetAuditLogs.mockImplementation(() => page([]))
    renderPage()
    expect(await screen.findByText('此條件下沒有稽核事件')).toBeInTheDocument()
  })

  it('shows the error, without the empty state, when the query fails', async () => {
    mockedGetAuditLogs.mockImplementation(() =>
      Promise.reject(
        new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
          data: { message: '查詢配額已用盡' },
        } as AxiosResponse),
      ),
    )
    renderPage()

    expect(await screen.findByText('查詢稽核日誌時發生錯誤：查詢配額已用盡')).toBeInTheDocument()
    expect(screen.queryByText('此條件下沒有稽核事件')).not.toBeInTheDocument()
  })

  it('a later successful query clears the error', async () => {
    const user = userEvent.setup()
    mockedGetAuditLogs.mockImplementationOnce(() => Promise.reject(new Error('down')))
    renderPage()
    await screen.findByText('查詢稽核日誌時發生錯誤')

    await user.click(screen.getByRole('button', { name: '近 24 小時' }))

    expect(await screen.findByText('登入成功')).toBeInTheDocument()
    expect(screen.queryByText(/查詢稽核日誌時發生錯誤/)).not.toBeInTheDocument()
  })

  it('opens the detail of a clicked entry with the resolved actor name, and closes it', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('User logged in'))

    expect(screen.getByRole('heading', { name: '稽核事件詳情' })).toBeInTheDocument()
    expect(screen.getByText('操作者：').parentElement).toHaveTextContent('操作者：Alice')
    await user.click(screen.getByRole('button', { name: '關閉' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '稽核事件詳情' })).not.toBeInTheDocument())
  })
})
