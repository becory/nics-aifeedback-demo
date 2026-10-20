import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuditLogDetailModal } from './AuditLogDetailModal'
import type { AuditLogEntry } from '../types'

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    insertId: 'ins-42',
    timestamp: '2026-10-19T16:30:05Z',
    severity: 'WARNING',
    eventType: 'user.org_access_granted',
    description: 'Granted access',
    userId: 'u-alice',
    clientIp: '203.0.113.5',
    resource: '/api/users/u-bob',
    properties: {},
    ...overrides,
  }
}

/** The value shown after a "label：" heading in the summary grid. */
const summary = (label: string) => screen.getByText(`${label}：`).parentElement

describe('AuditLogDetailModal', () => {
  it('renders nothing while no entry is selected', () => {
    render(<AuditLogDetailModal entry={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: '稽核事件詳情' })).not.toBeInTheDocument()
  })

  it('shows the summary with Taipei time, Chinese event label and the actor', () => {
    render(<AuditLogDetailModal entry={entry()} actorLabel="Alice" onClose={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '稽核事件詳情' })).toBeInTheDocument()
    expect(summary('時間')).toHaveTextContent('時間：2026-10-20 00:30:05 GMT+8')
    expect(summary('等級')).toHaveTextContent('等級：WARNING')
    expect(summary('事件')).toHaveTextContent('事件：授予組織權限user.org_access_granted')
    expect(summary('操作者')).toHaveTextContent('操作者：Alice')
    expect(summary('IP')).toHaveTextContent('IP：203.0.113.5')
    expect(summary('資源')).toHaveTextContent('資源：/api/users/u-bob')
    expect(summary('說明')).toHaveTextContent('說明：Granted access')
    expect(screen.getByText(/Insert ID：/)).toHaveTextContent('Insert ID：ins-42，操作者 ID：u-alice')
  })

  it('shows "—" for missing summary fields and an unknown event type as-is', () => {
    render(
      <AuditLogDetailModal
        entry={entry({ eventType: 'custom.thing', userId: null, clientIp: null, resource: null, description: null })}
        onClose={vi.fn()}
      />,
    )

    expect(summary('事件')).toHaveTextContent('事件：custom.thingcustom.thing')
    expect(summary('操作者')).toHaveTextContent('操作者：—')
    expect(summary('IP')).toHaveTextContent('IP：—')
    expect(summary('資源')).toHaveTextContent('資源：—')
    expect(summary('說明')).toHaveTextContent('說明：—')
    expect(screen.getByText(/Insert ID：/)).not.toHaveTextContent('操作者 ID')
    expect(screen.getByText('無')).toBeInTheDocument() // no properties
  })

  it('lists properties with Chinese labels (keeping the raw key) and formatted values', () => {
    render(
      <AuditLogDetailModal
        entry={entry({
          properties: {
            targetUserId: 'u-bob',
            isSystemAdmin: false,
            grantedOrganizationIds: ['org-a', 'org-b'],
            reason: '',
            customKey: 7,
          },
        })}
        onClose={vi.fn()}
      />,
    )

    const valueOf = (label: string) => {
      const row = screen.getByText(label).closest('tr')!
      return within(row).getAllByRole('cell')[1]
    }
    expect(within(screen.getByText('對象使用者 ID').closest('td')!).getByText('targetUserId')).toBeInTheDocument()
    expect(valueOf('對象使用者 ID')).toHaveTextContent('u-bob')
    expect(valueOf('系統管理員')).toHaveTextContent('否')
    expect(valueOf('授予的組織').textContent).toBe(JSON.stringify(['org-a', 'org-b'], null, 2))
    expect(valueOf('原因')).toHaveTextContent('—')
    // A key without a label shows the raw key.
    expect(valueOf('customKey')).toHaveTextContent('7')
  })

  it('keeps the stack trace out of the property table and toggles it', async () => {
    const user = userEvent.setup()
    render(
      <AuditLogDetailModal
        entry={entry({ properties: { exceptionType: 'NullReference', stack_trace: 'at Foo.Bar()' } })}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('例外類型')).toBeInTheDocument()
    expect(screen.queryByText('stack_trace')).not.toBeInTheDocument()
    expect(screen.queryByText('at Foo.Bar()')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '顯示 Stack trace' }))
    expect(screen.getByText('at Foo.Bar()')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '隱藏 Stack trace' }))
    expect(screen.queryByText('at Foo.Bar()')).not.toBeInTheDocument()
  })

  it('has no stack trace toggle when the entry has none', () => {
    render(<AuditLogDetailModal entry={entry()} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Stack trace/ })).not.toBeInTheDocument()
  })

  it('copies the whole entry as JSON', async () => {
    const user = userEvent.setup()
    const e = entry({ properties: { keyId: 'k1' } })
    render(<AuditLogDetailModal entry={e} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '複製 JSON' }))

    expect(await navigator.clipboard.readText()).toBe(JSON.stringify(e, null, 2))
    expect(await screen.findByRole('button', { name: '已複製' })).toBeInTheDocument()
  })

  it('resets the stack trace view when a different entry is shown', async () => {
    const user = userEvent.setup()
    const first = entry({ insertId: 'a', properties: { stack_trace: 'trace A' } })
    const second = entry({ insertId: 'b', properties: { stack_trace: 'trace B' } })
    const { rerender } = render(<AuditLogDetailModal entry={first} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '顯示 Stack trace' }))
    expect(screen.getByText('trace A')).toBeInTheDocument()

    rerender(<AuditLogDetailModal entry={second} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: '顯示 Stack trace' })).toBeInTheDocument()
    expect(screen.queryByText('trace B')).not.toBeInTheDocument()
  })

  it('closes with the close button and with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<AuditLogDetailModal entry={entry()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
