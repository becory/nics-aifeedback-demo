import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationServiceTable } from './OrganizationServiceTable'
import type { Organization, Service } from '../types'

const apiError = (message: string) =>
  new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
    status: 500,
    data: { message },
  } as AxiosResponse)

const orgA: Organization = { id: 'a', name: '組織甲', code: 'A', isActive: true, serviceCount: 1 }
const orgB: Organization = { id: 'b', name: '組織乙', code: 'B', isActive: true, serviceCount: 0 }
const svc = (id: string, organizationId: string, name: string): Service => ({
  id,
  organizationId,
  organizationName: '',
  name,
  code: id.toUpperCase(),
  host: `${id}.example.com`,
  isActive: true,
})

function setup(props: Partial<Parameters<typeof OrganizationServiceTable>[0]> = {}) {
  const loadServices =
    props.loadServices ??
    vi.fn(async (orgId: string) => (orgId === 'a' ? [svc('s1', 'a', '服務一')] : []))
  const user = userEvent.setup()
  const view = render(
    <OrganizationServiceTable organizations={[orgA, orgB]} {...props} loadServices={loadServices} />,
  )
  const rerender = (extra: Partial<Parameters<typeof OrganizationServiceTable>[0]>) =>
    view.rerender(
      <OrganizationServiceTable organizations={[orgA, orgB]} {...props} {...extra} loadServices={loadServices} />,
    )
  return { user, loadServices: vi.mocked(loadServices), rerender }
}

describe('OrganizationServiceTable', () => {
  it('loads services lazily: nothing on mount, once on the first expand', async () => {
    const { user, loadServices } = setup()
    expect(loadServices).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(await screen.findByText('服務一')).toBeInTheDocument()
    expect(loadServices).toHaveBeenCalledWith('a')

    await user.click(screen.getByRole('button', { name: '收合 組織甲' }))
    expect(screen.queryByText('服務一')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(screen.getByText('服務一')).toBeInTheDocument()
    expect(loadServices).toHaveBeenCalledTimes(1)
  })

  it('shows a loading line until the services arrive', async () => {
    let resolve: (s: Service[]) => void = () => {}
    const { user } = setup({ loadServices: vi.fn(() => new Promise<Service[]>((r) => (resolve = r))) })
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(screen.getByText('載入服務中…')).toBeInTheDocument()
    resolve([svc('s1', 'a', '服務一')])
    expect(await screen.findByText('服務一')).toBeInTheDocument()
  })

  it('expands when the organization row itself is clicked', async () => {
    const { user } = setup()
    await user.click(screen.getByText('組織甲'))
    expect(await screen.findByText('服務一')).toBeInTheDocument()
  })

  it('shows the given message for an organization without services', async () => {
    const { user } = setup({ emptyServicesMessage: '沒有服務' })
    await user.click(screen.getByRole('button', { name: '展開 組織乙 的服務' }))
    expect(await screen.findByText('沒有服務')).toBeInTheDocument()
  })

  it('shows the default empty message', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '展開 組織乙 的服務' }))
    expect(await screen.findByText('此組織尚無服務')).toBeInTheDocument()
  })

  it('shows the load error and retries on 重試', async () => {
    const loadServices = vi
      .fn<(orgId: string) => Promise<Service[]>>()
      .mockRejectedValueOnce(apiError('逾時'))
      .mockResolvedValue([svc('s1', 'a', '服務一')])
    const { user } = setup({ loadServices })
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(await screen.findByText('載入服務時發生錯誤：逾時')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('服務一')).toBeInTheDocument()
    expect(loadServices).toHaveBeenCalledTimes(2)
  })

  it('reloads a failed organization when it is expanded again', async () => {
    const loadServices = vi
      .fn<(orgId: string) => Promise<Service[]>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([svc('s1', 'a', '服務一')])
    const { user } = setup({ loadServices })
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(await screen.findByText('載入服務時發生錯誤')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '收合 組織甲' }))
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(await screen.findByText('服務一')).toBeInTheDocument()
  })

  it('loads initially expanded organizations on mount', async () => {
    const { loadServices } = setup({ initiallyExpanded: ['a'] })
    expect(screen.getByRole('button', { name: '收合 組織甲' })).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('服務一')).toBeInTheDocument()
    expect(loadServices).toHaveBeenCalledWith('a')
    expect(loadServices).not.toHaveBeenCalledWith('b')
  })

  it('applies serviceFilter to the shown services', async () => {
    const { user } = setup({
      loadServices: vi.fn(async () => [svc('s1', 'a', '服務一'), svc('s2', 'a', '服務二')]),
      serviceFilter: (s) => s.id === 's2',
    })
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(await screen.findByText('服務二')).toBeInTheDocument()
    expect(screen.queryByText('服務一')).not.toBeInTheDocument()
  })

  it('on refreshKey change reloads expanded organizations and drops the cache of collapsed ones', async () => {
    const { user, loadServices, rerender } = setup({ refreshKey: 0 })
    // Load both, then collapse 乙: it now has a cached (possibly stale) list.
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    await user.click(screen.getByRole('button', { name: '展開 組織乙 的服務' }))
    await screen.findByText('此組織尚無服務')
    await user.click(screen.getByRole('button', { name: '收合 組織乙' }))
    loadServices.mockClear()

    rerender({ refreshKey: 1 })
    await waitFor(() => expect(loadServices).toHaveBeenCalledWith('a'))
    expect(loadServices).not.toHaveBeenCalledWith('b')

    await user.click(screen.getByRole('button', { name: '展開 組織乙 的服務' }))
    expect(loadServices).toHaveBeenCalledWith('b')
  })

  it('keeps the current rows visible while a refresh is in flight', async () => {
    let calls = 0
    const loadServices = vi.fn(() => {
      calls += 1
      return calls === 1 ? Promise.resolve([svc('s1', 'a', '服務一')]) : new Promise<Service[]>(() => {})
    })
    const { user, rerender } = setup({ loadServices, refreshKey: 0 })
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    await screen.findByText('服務一')
    rerender({ refreshKey: 1 })
    expect(screen.getByText('服務一')).toBeInTheDocument()
    expect(screen.queryByText('載入服務中…')).not.toBeInTheDocument()
  })

  it('renders action columns and the org toolbar only when provided', async () => {
    const { user } = setup({
      orgActions: (org) => <button type="button">act-{org.code}</button>,
      serviceActions: (s) => <button type="button">svc-{s.code}</button>,
      renderOrgToolbar: (org) => <span>toolbar-{org.code}</span>,
    })
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeInTheDocument()
    // Clicking an org action does not toggle the row.
    await user.click(screen.getByRole('button', { name: 'act-A' }))
    expect(screen.queryByText('toolbar-A')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    expect(screen.getByText('toolbar-A')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'svc-S1' })).toBeInTheDocument()
  })

  it('has no action column when no actions are given', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '展開 組織甲 的服務' }))
    await screen.findByText('服務一')
    expect(screen.queryByRole('columnheader', { name: '操作' })).not.toBeInTheDocument()
  })
})
