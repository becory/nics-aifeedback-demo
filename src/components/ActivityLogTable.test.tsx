import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityLogTable } from './ActivityLogTable'
import type { Feedback, FeedbackRating } from '../types'

const ratingLabels: Record<FeedbackRating, string> = { good: '讚', normal: '普通', bad: '差' }

function feedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    id: 'fb-1',
    organizationId: 'org-a',
    organizationName: '甲機關',
    serviceId: 'svc-1',
    serviceName: '客服機器人',
    ipAsn: 'AS3462',
    ipCountry: 'TW',
    ipAddress: '203.0.113.5',
    note: '備註內容',
    createdAt: '2026-10-19T16:30:00Z',
    feedbackComment: '回答很清楚',
    userAgent: 'Mozilla/5.0',
    feedbackRating: 'good',
    inferenceSec: 1.5,
    sessionId: 'sess-1',
    originHost: 'chat.example.gov.tw',
    device: 'desktop',
    source: 'realtime',
    durationSec: 30,
    ...overrides,
  }
}

type Props = ComponentProps<typeof ActivityLogTable>

function renderTable(props: Partial<Props> = {}) {
  const onPageChange = vi.fn()
  const view = render(
    <ActivityLogTable
      feedbacks={[feedback()]}
      page={1}
      pageSize={20}
      total={1}
      onPageChange={onPageChange}
      ratingLabels={ratingLabels}
      {...props}
    />,
  )
  return { ...view, onPageChange }
}

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent).filter(Boolean)
const bodyRows = () => screen.getAllByRole('row').slice(1)
/** "label" → value text in the expanded detail list. */
const detail = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling

beforeEach(() => {
  localStorage.clear()
})

describe('ActivityLogTable rows', () => {
  it('shows the default columns with Taipei time, rating label, service name and source label', () => {
    renderTable()

    expect(headers()).toEqual(['時間', '評價', '國家', '來源 IP', '主機', '服務', '資料來源'])
    const cells = within(bodyRows()[0]).getAllByRole('cell').slice(1).map((c) => c.textContent)
    expect(cells).toEqual([
      '2026-10-20 00:30:00 GMT+8',
      '讚',
      'TW',
      '203.0.113.5',
      'chat.example.gov.tw',
      '客服機器人',
      '即時',
    ])
  })

  it('falls back for a missing service name, country and an unknown source', () => {
    renderTable({
      feedbacks: [feedback({ serviceName: '', ipCountry: '', source: 'offline', feedbackRating: 'bad' })],
    })
    const cells = within(bodyRows()[0]).getAllByRole('cell').slice(1).map((c) => c.textContent)
    expect(cells).toEqual(['2026-10-20 00:30:00 GMT+8', '差', '—', '203.0.113.5', 'chat.example.gov.tw', '未知', '離線匯入'])
  })

  it('expands a row to show every detail, with the organization from the feedback, and collapses it', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: '展開詳情' }))

    expect(detail('Session ID')).toHaveTextContent('sess-1')
    expect(detail('服務')).toHaveTextContent('客服機器人')
    expect(detail('組織')).toHaveTextContent('甲機關')
    expect(detail('ASN')).toHaveTextContent('AS3462')
    expect(detail('裝置')).toHaveTextContent('desktop')
    expect(detail('資料來源')).toHaveTextContent('即時')
    expect(detail('使用者代理程式')).toHaveTextContent('Mozilla/5.0')
    expect(detail('評價')).toHaveTextContent('讚')
    expect(detail('回饋評論')).toHaveTextContent('回答很清楚')
    expect(detail('備註')).toHaveTextContent('備註內容')
    expect(detail('推論秒數')).toHaveTextContent('1.5')
    expect(detail('持續秒數')).toHaveTextContent('30')
    expect(detail('建立時間')).toHaveTextContent('2026-10-20 00:30:00 GMT+8')

    await user.click(screen.getByRole('button', { name: '收合詳情' }))
    expect(screen.queryByText('建立時間')).not.toBeInTheDocument()
  })

  it('shows 未知 for a missing organization or service and "—" for missing values in the detail', async () => {
    const user = userEvent.setup()
    renderTable({
      feedbacks: [feedback({ organizationName: '', serviceName: '', durationSec: undefined })],
    })

    await user.click(screen.getByRole('button', { name: '展開詳情' }))

    expect(detail('組織')).toHaveTextContent('未知')
    expect(detail('服務')).toHaveTextContent('未知')
    expect(detail('持續秒數')).toHaveTextContent('—')
  })

  it('expands only one row at a time', async () => {
    const user = userEvent.setup()
    renderTable({
      feedbacks: [feedback({ sessionId: 's-a', note: 'note A' }), feedback({ sessionId: 's-b', note: 'note B' })],
      total: 2,
    })

    const [first, second] = screen.getAllByRole('button', { name: '展開詳情' })
    await user.click(first)
    expect(screen.getByText('note A')).toBeInTheDocument()

    await user.click(second)
    expect(screen.getByText('note B')).toBeInTheDocument()
    expect(screen.queryByText('note A')).not.toBeInTheDocument()
  })
})

describe('ActivityLogTable columns', () => {
  it('adds and removes columns and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTable()

    await user.click(screen.getByRole('button', { name: '編輯資料欄' }))
    await user.click(screen.getByRole('checkbox', { name: '回饋評論' }))
    await user.click(screen.getByRole('checkbox', { name: '國家' }))

    expect(headers()).toEqual(['時間', '評價', '來源 IP', '主機', '服務', '資料來源', '回饋評論'])
    expect(within(bodyRows()[0]).getByText('回答很清楚')).toBeInTheDocument()

    unmount()
    renderTable()
    expect(headers()).toEqual(['時間', '評價', '來源 IP', '主機', '服務', '資料來源', '回饋評論'])
  })

  it('keeps at least two columns visible', async () => {
    const user = userEvent.setup()
    localStorage.setItem('activity_log_columns', JSON.stringify(['createdAt', 'feedbackRating']))
    renderTable()

    await user.click(screen.getByRole('button', { name: '編輯資料欄' }))
    await user.click(screen.getByRole('checkbox', { name: '時間' }))

    expect(screen.getByRole('checkbox', { name: '時間' })).toBeChecked()
    expect(headers()).toEqual(['時間', '評價'])
  })

  it('falls back to the default columns when the saved choice is unreadable', () => {
    localStorage.setItem('activity_log_columns', '{not json')
    renderTable()
    expect(headers()).toEqual(['時間', '評價', '國家', '來源 IP', '主機', '服務', '資料來源'])
  })
})

describe('ActivityLogTable states', () => {
  it('shows the error instead of paging', () => {
    renderTable({ error: '查詢失敗' })
    expect(screen.getByText('查詢失敗')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '下一頁' })).not.toBeInTheDocument()
  })

  it('shows loading when there are no rows yet', () => {
    renderTable({ feedbacks: [], total: 0, loading: true })
    expect(screen.getByText('載入中…')).toBeInTheDocument()
    expect(screen.queryByText('尚無活動記錄')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no records', () => {
    renderTable({ feedbacks: [], total: 0 })
    expect(screen.getByText('尚無活動記錄')).toBeInTheDocument()
  })

  it('keeps the rows while the next page loads and disables paging', () => {
    renderTable({ page: 2, total: 60, loading: true })
    expect(bodyRows()).toHaveLength(1)
    expect(screen.getByText(/第 21–40 筆，共 60 筆（載入中…）/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一頁' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3' })).toBeDisabled()
  })
})

describe('ActivityLogTable paging', () => {
  it('shows the range of the current page and the total', () => {
    renderTable({ page: 3, total: 45 })
    expect(screen.getByText('第 41–45 筆，共 45 筆')).toBeInTheDocument()
    expect(screen.getByText(/\/ 3 頁/)).toBeInTheDocument()
  })

  it('moves to the previous and next page and stops at the ends', async () => {
    const user = userEvent.setup()
    const { onPageChange, rerender } = renderTable({ page: 1, total: 60 })

    expect(screen.getByRole('button', { name: '上一頁' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '下一頁' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)

    rerender(
      <ActivityLogTable
        feedbacks={[feedback()]}
        page={3}
        pageSize={20}
        total={60}
        onPageChange={onPageChange}
        ratingLabels={ratingLabels}
      />,
    )
    expect(screen.getByRole('button', { name: '下一頁' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '上一頁' }))
    expect(onPageChange).toHaveBeenLastCalledWith(2)
  })

  it('shows up to five page numbers around the current page', async () => {
    const user = userEvent.setup()
    const { onPageChange } = renderTable({ page: 5, total: 200 }) // 10 pages

    const numbers = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => /^\d+$/.test(t ?? ''))
    expect(numbers).toEqual(['3', '4', '5', '6', '7'])
    expect(screen.getAllByText('…')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onPageChange).toHaveBeenCalledWith(7)

    await user.click(screen.getByRole('button', { name: '5' }))
    expect(onPageChange).toHaveBeenCalledTimes(1) // the current page is not re-requested
  })

  it('keeps the window inside the page count near the last page', () => {
    renderTable({ page: 10, total: 200 })
    const numbers = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter((t) => /^\d+$/.test(t ?? ''))
    expect(numbers).toEqual(['6', '7', '8', '9', '10'])
  })

  it('jumps to a typed page on Enter or blur, clamped to the page count', async () => {
    const user = userEvent.setup()
    const { onPageChange } = renderTable({ page: 1, total: 200 })
    const input = screen.getByRole('spinbutton', { name: '前往頁碼（共 10 頁）' })

    await user.type(input, '4{Enter}')
    expect(onPageChange).toHaveBeenLastCalledWith(4)
    expect(input).toHaveValue(null)

    await user.type(input, '99')
    await user.tab()
    expect(onPageChange).toHaveBeenLastCalledWith(10)

    await user.type(input, '0{Enter}')
    expect(onPageChange).toHaveBeenCalledTimes(2) // clamped to 1, the current page
  })

  it('collapses an expanded row when the page changes', async () => {
    const user = userEvent.setup()
    renderTable({ page: 1, total: 60 })
    await user.click(screen.getByRole('button', { name: '展開詳情' }))
    expect(screen.getByText('建立時間')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一頁' }))

    expect(screen.queryByText('建立時間')).not.toBeInTheDocument()
  })
})
