import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceListPage } from './ServiceListPage'
import { getOrganizations, getServices } from '../api'
import { useAuth } from '../lib/auth'
import type { Organization, Service, User } from '../types'

vi.mock('../api', () => ({ getOrganizations: vi.fn(), getServices: vi.fn() }))
vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))

const res = (data: unknown) => ({ data: { data } }) as never
const apiError = (message: string) =>
  new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
    status: 403,
    data: { message },
  } as AxiosResponse)

const member: User = { id: 'u1', name: 'Bob', email: 'b@example.com', organizationIds: ['o1'], isSystemAdmin: false }
const org: Organization = { id: 'o1', name: '資安院', code: 'NICS', isActive: true, serviceCount: 1 }
const service: Service = {
  id: 's1',
  organizationId: 'o1',
  organizationName: '資安院',
  name: '客服機器人',
  code: 'CHATBOT',
  host: 'chat.example.com',
  isActive: true,
}

function setUser(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({
    ready: true,
    session: user ? { accessToken: 'tok' } : null,
    user,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn(),
    logout: vi.fn(),
  })
}

beforeEach(() => {
  setUser(member)
  vi.mocked(getOrganizations).mockResolvedValue(res([org]))
  vi.mocked(getServices).mockResolvedValue(res([service]))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ServiceListPage', () => {
  it('lists only the current user organizations, read-only', async () => {
    render(<ServiceListPage />)
    expect(await screen.findByText('資安院')).toBeInTheDocument()
    expect(getOrganizations).toHaveBeenCalledWith({ currentUser: true })
    expect(screen.getByText('NICS')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '操作' })).not.toBeInTheDocument()
  })

  it('loads the services of an expanded organization scoped to the current user', async () => {
    const user = userEvent.setup()
    render(<ServiceListPage />)
    await user.click(await screen.findByRole('button', { name: '展開 資安院 的服務' }))
    expect(await screen.findByText('客服機器人')).toBeInTheDocument()
    expect(getServices).toHaveBeenCalledWith({ currentUser: true, organizationId: 'o1' })
    expect(screen.getByText('chat.example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '編輯' })).not.toBeInTheDocument()
  })

  it('shows the page-specific message for an organization without services', async () => {
    vi.mocked(getServices).mockResolvedValue(res([]))
    const user = userEvent.setup()
    render(<ServiceListPage />)
    await user.click(await screen.findByRole('button', { name: '展開 資安院 的服務' }))
    expect(await screen.findByText('此組織目前尚無服務')).toBeInTheDocument()
  })

  it('tells a user without organizations that they have not been assigned', async () => {
    vi.mocked(getOrganizations).mockResolvedValue(res([]))
    render(<ServiceListPage />)
    expect(await screen.findByText('您尚未被指派至任何組織，無法檢視服務')).toBeInTheDocument()
  })

  it('shows the API error message when organizations fail to load', async () => {
    vi.mocked(getOrganizations).mockRejectedValue(apiError('沒有權限'))
    render(<ServiceListPage />)
    expect(await screen.findByText('載入組織資料時發生錯誤：沒有權限')).toBeInTheDocument()
    // A failed load is not the same as having no organizations.
    expect(screen.queryByText('您尚未被指派至任何組織，無法檢視服務')).not.toBeInTheDocument()
  })

  it('does not request anything before the user is known', () => {
    setUser(null)
    render(<ServiceListPage />)
    expect(getOrganizations).not.toHaveBeenCalled()
    expect(screen.queryByText('您尚未被指派至任何組織，無法檢視服務')).not.toBeInTheDocument()
  })
})
