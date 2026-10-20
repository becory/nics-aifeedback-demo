import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServicesPage } from './ServicesPage'
import {
  createOrganization,
  createService,
  deleteOrganization,
  deleteService,
  getOrganizations,
  getServices,
  updateOrganization,
  updateService,
} from '../api'
import type { Organization, Service } from '../types'

vi.mock('../api', () => ({
  createOrganization: vi.fn(),
  createService: vi.fn(),
  deleteOrganization: vi.fn(),
  deleteService: vi.fn(),
  getOrganizations: vi.fn(),
  getServices: vi.fn(),
  updateOrganization: vi.fn(),
  updateService: vi.fn(),
}))

// The keys modal has its own API calls and is out of scope here; a stub shows which org it got.
vi.mock('../components/OrganizationKeysModal', () => ({
  OrganizationKeysModal: ({ organization }: { organization: Organization | null }) =>
    organization ? <div>keys-modal:{organization.name}</div> : null,
}))

const res = (data: unknown) => ({ data }) as never
const list = (data: unknown) => res({ data })
const apiError = (message: string) =>
  new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
    status: 400,
    data: { message },
  } as AxiosResponse)

const nics: Organization = { id: 'o1', name: '資安院', code: 'NICS', isActive: true, serviceCount: 2 }
const moda: Organization = { id: 'o2', name: '數位部', code: 'MODA', isActive: true }
const chatbot: Service = {
  id: 's1',
  organizationId: 'o1',
  organizationName: '資安院',
  name: '客服機器人',
  code: 'CHATBOT',
  host: 'chat.example.com',
  isActive: true,
}
const portal: Service = { ...chatbot, id: 's2', name: '入口網', code: 'PORTAL', host: '' }

let alertSpy: ReturnType<typeof vi.spyOn>
let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.mocked(getOrganizations).mockResolvedValue(list([nics, moda]))
  vi.mocked(getServices).mockImplementation(async (params) => {
    const code = params?.code
    if (code) return list([chatbot, portal].filter((s) => s.code === code.toUpperCase()))
    return list(params?.organizationId === 'o1' ? [chatbot, portal] : [])
  })
  vi.mocked(createOrganization).mockResolvedValue(res({}))
  vi.mocked(updateOrganization).mockResolvedValue(res({}))
  vi.mocked(deleteOrganization).mockResolvedValue(res(null))
  vi.mocked(createService).mockResolvedValue(res({}))
  vi.mocked(updateService).mockResolvedValue(res({}))
  vi.mocked(deleteService).mockResolvedValue(res(null))
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function LocationProbe() {
  const { search } = useLocation()
  return <div data-testid="search">{search}</div>
}

async function renderPage(path = '/services') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/services" element={<><ServicesPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByText('資安院')
  return user
}

const orgRow = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const serviceRow = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
const dialogOf = (title: string) =>
  within(screen.getByRole('heading', { name: title }).parentElement?.parentElement as HTMLElement)

async function expandNics(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '展開 資安院 的服務' }))
  await screen.findByText('客服機器人')
}

describe('ServicesPage organizations', () => {
  it('lists active organizations, collapsed, with their service counts', async () => {
    await renderPage()
    expect(getOrganizations).toHaveBeenCalledWith({ IsActive: true })
    expect(getServices).not.toHaveBeenCalled()
    expect(within(orgRow('資安院')).getByText('NICS')).toBeInTheDocument()
    expect(within(orgRow('資安院')).getByText('2')).toBeInTheDocument()
    expect(within(orgRow('數位部')).getByText('—')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展開 資安院 的服務' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the empty state when there are no organizations', async () => {
    vi.mocked(getOrganizations).mockResolvedValue(list([]))
    render(<MemoryRouter><ServicesPage /></MemoryRouter>)
    expect(await screen.findByText('尚無組織資料，點擊「新增組織」開始建立')).toBeInTheDocument()
  })

  it('shows the API error on load failure and reloads on 重試', async () => {
    vi.mocked(getOrganizations).mockRejectedValueOnce(apiError('服務暫停'))
    const user = userEvent.setup()
    render(<MemoryRouter><ServicesPage /></MemoryRouter>)
    expect(await screen.findByText('載入組織資料時發生錯誤：服務暫停')).toBeInTheDocument()
    expect(screen.queryByText('尚無組織資料，點擊「新增組織」開始建立')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('資安院')).toBeInTheDocument()
    expect(screen.queryByText(/載入組織資料時發生錯誤/)).not.toBeInTheDocument()
  })

  it('opens the offline keys of an organization', async () => {
    const user = await renderPage()
    await user.click(within(orgRow('數位部')).getByRole('button', { name: '檢視離線金鑰' }))
    expect(screen.getByText('keys-modal:數位部')).toBeInTheDocument()
  })

  it.each([
    ['name', '請輸入組織名稱', ''],
    ['code', '請輸入組織代碼', '新組織'],
  ])('requires the organization %s', async (_field, message, name) => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增組織' }))
    if (name) await user.type(screen.getByLabelText('組織名稱'), name)
    await user.type(screen.getByLabelText('組織代碼'), name ? '   ' : 'X')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(createOrganization).not.toHaveBeenCalled()
  })

  it('creates an organization with a trimmed name and an upper-case code, then reloads', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增組織' }))
    await user.type(screen.getByLabelText('組織名稱'), '  新組織 ')
    await user.type(screen.getByLabelText('組織代碼'), ' new ')
    vi.mocked(getOrganizations).mockClear()
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(createOrganization).toHaveBeenCalledWith({ name: '新組織', code: 'NEW' })
    expect(updateOrganization).not.toHaveBeenCalled()
    await waitFor(() => expect(getOrganizations).toHaveBeenCalledWith({ IsActive: true }))
    expect(screen.queryByRole('heading', { name: '新增組織' })).not.toBeInTheDocument()
  })

  it('shows the API message when creating an organization fails', async () => {
    vi.mocked(createOrganization).mockRejectedValue(apiError('代碼已被使用'))
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增組織' }))
    await user.type(screen.getByLabelText('組織名稱'), '新組織')
    await user.type(screen.getByLabelText('組織代碼'), 'NICS')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('新增組織時發生錯誤：代碼已被使用')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新增組織' })).toBeInTheDocument()
  })

  it('sends only one create request when 儲存 is clicked again while saving', async () => {
    let finish: (v: unknown) => void = () => {}
    vi.mocked(createOrganization).mockImplementation(() => new Promise((r) => (finish = r)) as never)
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增組織' }))
    await user.type(screen.getByLabelText('組織名稱'), '新組織')
    await user.type(screen.getByLabelText('組織代碼'), 'NEW')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    const saving = screen.getByRole('button', { name: '儲存中…' })
    expect(saving).toBeDisabled()
    await user.click(saving)
    expect(createOrganization).toHaveBeenCalledTimes(1)
    finish(res({}))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '新增組織' })).not.toBeInTheDocument())
  })

  it('edits an organization: pre-filled form, update sent to its id', async () => {
    const user = await renderPage()
    await user.click(within(orgRow('數位部')).getByRole('button', { name: '編輯' }))
    expect(screen.getByLabelText('組織名稱')).toHaveValue('數位部')
    const code = screen.getByLabelText('組織代碼')
    expect(code).toHaveValue('MODA')
    await user.clear(code)
    await user.type(code, 'moda2')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(updateOrganization).toHaveBeenCalledWith('o2', { name: '數位部', code: 'MODA2' })
    expect(createOrganization).not.toHaveBeenCalled()
  })

  it('shows the API message when updating an organization fails', async () => {
    vi.mocked(updateOrganization).mockRejectedValue(apiError('衝突'))
    const user = await renderPage()
    await user.click(within(orgRow('數位部')).getByRole('button', { name: '編輯' }))
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('更新組織時發生錯誤：衝突')).toBeInTheDocument()
  })

  it('deletes an organization after confirmation and reloads', async () => {
    const user = await renderPage()
    vi.mocked(getOrganizations).mockClear()
    await user.click(within(orgRow('數位部')).getByRole('button', { name: '刪除' }))
    expect(confirmSpy).toHaveBeenCalledWith('確定要刪除組織「數位部」？')
    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith('o2'))
    await waitFor(() => expect(getOrganizations).toHaveBeenCalled())
  })

  it('does not delete an organization when the confirmation is cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    const user = await renderPage()
    await user.click(within(orgRow('數位部')).getByRole('button', { name: '刪除' }))
    expect(deleteOrganization).not.toHaveBeenCalled()
  })

  it('alerts with the API message when deleting an organization fails', async () => {
    vi.mocked(deleteOrganization).mockRejectedValue(apiError('組織仍有服務'))
    const user = await renderPage()
    await user.click(within(orgRow('資安院')).getByRole('button', { name: '刪除' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('刪除組織時發生錯誤：組織仍有服務'))
  })
})

describe('ServicesPage services', () => {
  it('loads an organization services when it is expanded', async () => {
    const user = await renderPage()
    await expandNics(user)
    expect(getServices).toHaveBeenCalledWith({ organizationId: 'o1' })
    expect(within(serviceRow('客服機器人')).getByText('CHATBOT')).toBeInTheDocument()
    expect(within(serviceRow('客服機器人')).getByText('chat.example.com')).toBeInTheDocument()
    expect(within(serviceRow('入口網')).getByText('—')).toBeInTheDocument()
  })

  it('adds a service to the organization it was opened from', async () => {
    const user = await renderPage()
    await expandNics(user)
    await user.click(screen.getByRole('button', { name: '＋新增服務' }))
    expect(screen.getByLabelText('所屬組織')).toHaveValue('o1')
    await user.type(screen.getByLabelText('服務名稱'), ' 新服務 ')
    await user.type(screen.getByLabelText('服務代碼'), ' svc ')
    await user.type(screen.getByLabelText('網域'), ' Feedback.Example.COM ')
    vi.mocked(getServices).mockClear()
    vi.mocked(getOrganizations).mockClear()
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(createService).toHaveBeenCalledWith({
      organizationId: 'o1',
      name: '新服務',
      code: 'SVC',
      host: 'feedback.example.com',
    })
    // The expanded organization's services and the per-org counts are reloaded.
    await waitFor(() => expect(getServices).toHaveBeenCalledWith({ organizationId: 'o1' }))
    await waitFor(() => expect(getOrganizations).toHaveBeenCalledWith({ IsActive: true }))
    expect(screen.queryByRole('heading', { name: '新增服務' })).not.toBeInTheDocument()
    // Still expanded after the change.
    expect(screen.getByRole('button', { name: '收合 資安院' })).toHaveAttribute('aria-expanded', 'true')
  })

  it.each([
    ['name', '請輸入服務名稱', {}],
    ['code', '請輸入服務代碼', { name: 'S' }],
    ['host', '請輸入網域', { name: 'S', code: 'C' }],
  ])('requires the service %s', async (_field, message, values: { name?: string; code?: string }) => {
    const user = await renderPage()
    await expandNics(user)
    await user.click(screen.getByRole('button', { name: '＋新增服務' }))
    if (values.name) await user.type(screen.getByLabelText('服務名稱'), values.name)
    if (values.code) await user.type(screen.getByLabelText('服務代碼'), values.code)
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(createService).not.toHaveBeenCalled()
  })

  it('shows the API message when creating a service fails', async () => {
    vi.mocked(createService).mockRejectedValue(apiError('網域已被使用'))
    const user = await renderPage()
    await expandNics(user)
    await user.click(screen.getByRole('button', { name: '＋新增服務' }))
    await user.type(screen.getByLabelText('服務名稱'), 'S')
    await user.type(screen.getByLabelText('服務代碼'), 'C')
    await user.type(screen.getByLabelText('網域'), 'h.example.com')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('新增服務時發生錯誤：網域已被使用')).toBeInTheDocument()
  })

  it('edits a service within the same organization without asking to move it', async () => {
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('客服機器人')).getByRole('button', { name: '編輯' }))
    expect(screen.getByLabelText('服務名稱')).toHaveValue('客服機器人')
    expect(screen.getByLabelText('服務代碼')).toHaveValue('CHATBOT')
    expect(screen.getByLabelText('網域')).toHaveValue('chat.example.com')
    const name = screen.getByLabelText('服務名稱')
    await user.clear(name)
    await user.type(name, '客服 2')
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(updateService).toHaveBeenCalledWith('s1', {
      organizationId: 'o1',
      name: '客服 2',
      code: 'CHATBOT',
      host: 'chat.example.com',
    })
  })

  it('warns and asks for confirmation before moving a service to another organization', async () => {
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('客服機器人')).getByRole('button', { name: '編輯' }))
    expect(screen.queryByText(/變更所屬組織後/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('所屬組織'), 'o2')
    expect(screen.getByText(/變更所屬組織後/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('確定要將服務「客服機器人」移至組織「數位部」？'))
    expect(updateService).toHaveBeenCalledWith('s1', expect.objectContaining({ organizationId: 'o2' }))
  })

  it('does not move the service when the move is not confirmed', async () => {
    confirmSpy.mockReturnValue(false)
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('客服機器人')).getByRole('button', { name: '編輯' }))
    await user.selectOptions(screen.getByLabelText('所屬組織'), 'o2')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(updateService).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '編輯服務' })).toBeInTheDocument()
  })

  it('shows the API message when updating a service fails', async () => {
    vi.mocked(updateService).mockRejectedValue(apiError('衝突'))
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('客服機器人')).getByRole('button', { name: '編輯' }))
    await user.click(dialogOf('編輯服務').getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('更新服務時發生錯誤：衝突')).toBeInTheDocument()
  })

  it('deletes a service after confirmation and reloads the services', async () => {
    const user = await renderPage()
    await expandNics(user)
    vi.mocked(getServices).mockClear()
    await user.click(within(serviceRow('入口網')).getByRole('button', { name: '刪除' }))
    expect(confirmSpy).toHaveBeenCalledWith('確定要刪除服務「入口網」？')
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith('s2'))
    await waitFor(() => expect(getServices).toHaveBeenCalledWith({ organizationId: 'o1' }))
  })

  it('does not delete a service when cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('入口網')).getByRole('button', { name: '刪除' }))
    expect(deleteService).not.toHaveBeenCalled()
  })

  it('alerts with the API message when deleting a service fails', async () => {
    vi.mocked(deleteService).mockRejectedValue(apiError('仍有回饋資料'))
    const user = await renderPage()
    await expandNics(user)
    await user.click(within(serviceRow('入口網')).getByRole('button', { name: '刪除' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('刪除服務時發生錯誤：仍有回饋資料'))
  })
})

describe('ServicesPage ?code= deep link', () => {
  it('expands the organization of that service and shows only the matching service', async () => {
    await renderPage('/services?code=chatbot')
    expect(getServices).toHaveBeenCalledWith({ code: 'chatbot' })
    expect(await screen.findByText('客服機器人')).toBeInTheDocument()
    expect(screen.queryByText('入口網')).not.toBeInTheDocument()
    expect(screen.getByText('chatbot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收合 資安院' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: '展開 數位部 的服務' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('clears the filter: all services shown and the query removed from the URL', async () => {
    const user = await renderPage('/services?code=chatbot')
    await screen.findByText('客服機器人')
    await user.click(screen.getByRole('button', { name: '清除服務代碼篩選' }))
    expect(screen.getByText('入口網')).toBeInTheDocument()
    expect(screen.queryByText(/僅顯示服務代碼/)).not.toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/)
  })
})
