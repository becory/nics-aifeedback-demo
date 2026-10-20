import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrganizationKeysModal } from './OrganizationKeysModal'
import {
  createOrganizationKey,
  generateOrganizationKeyEnv,
  getOrganizationKeys,
  getServices,
  revokeOrganizationKey,
  updateOrganizationKey,
} from '../api'
import type { CreatedOrganizationKey, Organization, OrganizationKey, Service } from '../types'

vi.mock('../api', () => ({
  createOrganizationKey: vi.fn(),
  generateOrganizationKeyEnv: vi.fn(),
  getOrganizationKeys: vi.fn(),
  getServices: vi.fn(),
  revokeOrganizationKey: vi.fn(),
  updateOrganizationKey: vi.fn(),
}))

const api = {
  create: vi.mocked(createOrganizationKey),
  env: vi.mocked(generateOrganizationKeyEnv),
  list: vi.mocked(getOrganizationKeys),
  services: vi.mocked(getServices),
  revoke: vi.mocked(revokeOrganizationKey),
  update: vi.mocked(updateOrganizationKey),
}

// 2026-10-20 12:00 in Taipei.
const NOW = new Date('2026-10-20T04:00:00.000Z')

const org: Organization = { id: 'org-1', name: '數位發展部', code: 'moda', isActive: true }

const activeKey: OrganizationKey = {
  id: 'aaaa1111-0000-4000-8000-000000000001',
  organizationId: 'org-1',
  description: '台北機房',
  keyPreview: 'AbCd…',
  createdAt: '2026-03-31T16:30:00Z', // 2026-04-01 in Taipei
  expiresAt: '2027-03-31T16:30:00Z', // 2027-04-01 in Taipei
  isRevoked: false,
}
const expiredKey: OrganizationKey = {
  ...activeKey,
  id: 'bbbb2222-0000-4000-8000-000000000002',
  description: null,
  keyPreview: 'EfGh…',
  expiresAt: '2026-01-01T00:00:00Z',
}
const revokedKey: OrganizationKey = {
  ...activeKey,
  id: 'cccc3333-0000-4000-8000-000000000003',
  description: '舊主機',
  keyPreview: 'IjKl…',
  isRevoked: true,
  revokedAt: '2026-05-01T00:00:00Z',
}

const svc = (id: string, name: string): Service => ({
  id,
  organizationId: 'org-1',
  organizationName: org.name,
  name,
  code: `${id}-code`,
  host: `${id}.example.gov.tw`,
  isActive: true,
})
const services = [svc('svc-1', '客服機器人'), svc('svc-2', '公文助理')]

const ok = <T,>(data: T) => ({ data }) as AxiosResponse<T>
const httpError = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status, data } as AxiosResponse)

function renderModal(organization: Organization | null = org, onClose = vi.fn()) {
  const view = render(<OrganizationKeysModal organization={organization} onClose={onClose} />)
  return { ...view, onClose }
}

/** A modal's content, found by its title (Modal has no dialog role). */
function modal(title: string) {
  const heading = screen.getByRole('heading', { name: title })
  return within(heading.parentElement!.parentElement!)
}
const keysModal = () => modal(`離線金鑰 — ${org.name}`)
const row = (preview: string) => within(screen.getByText(preview).closest('tr')!)

async function renderLoaded(keys: OrganizationKey[] = [activeKey, expiredKey, revokedKey], organization = org) {
  api.list.mockResolvedValue(ok({ data: keys }))
  const view = renderModal(organization)
  await waitFor(() => expect(api.list).toHaveBeenCalled())
  if (keys.length) await screen.findByText(keys[0].keyPreview)
  else await screen.findByText('此組織尚無離線金鑰')
  return view
}

/** userEvent.setup() installs its own clipboard; replace it afterwards with a spy. */
function setupUserWithClipboard() {
  const user = userEvent.setup()
  const writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return { user, writeText }
}

let confirmMock: ReturnType<typeof vi.fn>
let alertMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  for (const fn of Object.values(api)) fn.mockReset()
  confirmMock = vi.fn(() => true)
  alertMock = vi.fn()
  vi.stubGlobal('confirm', confirmMock)
  vi.stubGlobal('alert', alertMock)
})

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else delete (navigator as { clipboard?: unknown }).clipboard
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OrganizationKeysModal — list', () => {
  it('renders nothing when no organization is given', () => {
    renderModal(null)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(api.list).not.toHaveBeenCalled()
  })

  it("loads the organization's keys and shows them with status, dates and description", async () => {
    await renderLoaded()
    expect(api.list).toHaveBeenCalledWith('org-1')

    const active = row('AbCd…')
    expect(active.getByText(activeKey.id)).toBeInTheDocument()
    expect(active.getByText('有效')).toBeInTheDocument()
    expect(active.getByText('2026-04-01')).toBeInTheDocument()
    expect(active.getByText('2027-04-01')).toBeInTheDocument()
    expect(active.getByText('台北機房')).toBeInTheDocument()

    expect(row('EfGh…').getByText('已過期')).toBeInTheDocument()
    expect(row('EfGh…').getByText('—')).toBeInTheDocument()
    expect(row('IjKl…').getByText('已撤銷')).toBeInTheDocument()
  })

  it('shows an empty message when the organization has no keys', async () => {
    await renderLoaded([])
    expect(screen.getByText('此組織尚無離線金鑰')).toBeInTheDocument()
  })

  it('shows a load error and retries on request', async () => {
    api.list.mockRejectedValueOnce(httpError(500, { message: '伺服器忙碌' }))
    api.list.mockResolvedValueOnce(ok({ data: [activeKey] }))
    renderModal()
    expect(await screen.findByText('載入離線金鑰時發生錯誤：伺服器忙碌')).toBeInTheDocument()
    expect(screen.queryByText('此組織尚無離線金鑰')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('AbCd…')).toBeInTheDocument()
    expect(screen.queryByText(/載入離線金鑰時發生錯誤/)).not.toBeInTheDocument()
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it('copies a key UUID', async () => {
    await renderLoaded([activeKey])
    const { user, writeText } = setupUserWithClipboard()
    await user.click(row('AbCd…').getByRole('button', { name: '複製' }))
    expect(writeText).toHaveBeenCalledWith(activeKey.id)
    expect(row('AbCd…').getByRole('button', { name: '已複製' })).toBeInTheDocument()
  })

  it('keeps showing 複製 when the clipboard write fails', async () => {
    await renderLoaded([activeKey])
    const { user, writeText } = setupUserWithClipboard()
    writeText.mockRejectedValue(new Error('denied'))
    await user.click(row('AbCd…').getByRole('button', { name: '複製' }))
    expect(writeText).toHaveBeenCalled()
    expect(row('AbCd…').getByRole('button', { name: '複製' })).toBeInTheDocument()
  })

  it('closes via the close button', async () => {
    const { onClose } = await renderLoaded([activeKey])
    await userEvent.setup().click(keysModal().getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('OrganizationKeysModal — create', () => {
  const created: CreatedOrganizationKey = {
    ...activeKey,
    id: 'dddd4444-0000-4000-8000-000000000004',
    keyPreview: 'MnOp…',
    aesKey: 'q1w2e3r4t5y6u7i8o9p0q1w2e3r4t5y6u7i8o9p0abc=',
  }

  it('cannot create a key for an inactive organization', async () => {
    await renderLoaded([activeKey], { ...org, isActive: false })
    expect(screen.getByRole('button', { name: '新增金鑰' })).toBeDisabled()
  })

  it('creates a key with the trimmed description and a default expiry one year from now', async () => {
    await renderLoaded([activeKey])
    api.create.mockResolvedValue(ok(created))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    expect(form.getByText(`所屬組織：${org.name}`)).toBeInTheDocument()
    await user.type(form.getByLabelText('金鑰說明'), '  新竹機房  ')
    await user.click(form.getByRole('button', { name: '儲存' }))

    expect(api.create).toHaveBeenCalledWith('org-1', {
      description: '新竹機房',
      expiresAt: '2027-10-20T04:00:00.000Z',
    })
    expect(screen.queryByRole('heading', { name: '新增離線金鑰' })).not.toBeInTheDocument()
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
  })

  it('omits a blank description', async () => {
    await renderLoaded([activeKey])
    api.create.mockResolvedValue(ok(created))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    await user.type(form.getByLabelText('金鑰說明'), '   ')
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(api.create).toHaveBeenCalledWith('org-1', { description: undefined, expiresAt: '2027-10-20T04:00:00.000Z' })
  })

  it('sends a typed expiry time', async () => {
    await renderLoaded([activeKey])
    api.create.mockResolvedValue(ok(created))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    const expiry = form.getByRole('textbox', { name: '到期時間' })
    await user.clear(expiry)
    await user.type(expiry, '2027-06-30 18:00{Enter}')
    expect(expiry).toHaveValue('2027-06-30 18:00')
    await user.click(form.getByRole('button', { name: '儲存' }))
    // The field is local time; whatever the zone, it is sent as that instant in ISO form.
    expect(api.create).toHaveBeenCalledWith('org-1', {
      description: undefined,
      expiresAt: new Date(2027, 5, 30, 18, 0).toISOString(),
    })
  })

  it('requires an expiry time', async () => {
    await renderLoaded([activeKey])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    await user.click(form.getByRole('button', { name: '清除到期時間' }))
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(form.getByText('請設定到期時間')).toBeInTheDocument()
    expect(api.create).not.toHaveBeenCalled()
  })

  it('rejects an expiry time in the past', async () => {
    await renderLoaded([activeKey])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    const expiry = form.getByRole('textbox', { name: '到期時間' })
    await user.clear(expiry)
    await user.type(expiry, '2026-01-01 00:00{Enter}')
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(form.getByText('到期時間必須晚於現在')).toBeInTheDocument()
    expect(api.create).not.toHaveBeenCalled()
  })

  it('shows the API error and keeps the form open', async () => {
    await renderLoaded([activeKey])
    api.create.mockRejectedValue(httpError(400, { message: '說明過長' }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    const form = modal('新增離線金鑰')
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(await form.findByText('新增金鑰時發生錯誤：說明過長')).toBeInTheDocument()
    expect(form.getByRole('button', { name: '儲存' })).toBeEnabled()
  })

  it('starts from an empty form each time it is opened', async () => {
    await renderLoaded([activeKey])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    await user.type(modal('新增離線金鑰').getByLabelText('金鑰說明'), 'draft')
    await user.click(modal('新增離線金鑰').getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('heading', { name: '新增離線金鑰' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    expect(modal('新增離線金鑰').getByLabelText('金鑰說明')).toHaveValue('')
  })

  it('shows the new key UUID and full AES key once, with copy buttons', async () => {
    await renderLoaded([activeKey])
    api.create.mockResolvedValue(ok(created))
    const { user, writeText } = setupUserWithClipboard()
    await user.click(screen.getByRole('button', { name: '新增金鑰' }))
    await user.click(modal('新增離線金鑰').getByRole('button', { name: '儲存' }))

    const result = modal('金鑰已建立')
    expect(result.getByText(created.id)).toBeInTheDocument()
    expect(result.getByText(created.aesKey)).toBeInTheDocument()
    const [copyId, copyKey] = result.getAllByRole('button', { name: '複製' })
    await user.click(copyId)
    await user.click(copyKey)
    expect(writeText).toHaveBeenNthCalledWith(1, created.id)
    expect(writeText).toHaveBeenNthCalledWith(2, created.aesKey)

    // Closing it removes the full key from the screen for good.
    await user.click(result.getByText('關閉', { selector: 'button' }))
    expect(screen.queryByRole('heading', { name: '金鑰已建立' })).not.toBeInTheDocument()
    expect(screen.queryByText(created.aesKey)).not.toBeInTheDocument()
  })
})

describe('OrganizationKeysModal — edit description', () => {
  async function openEdit(key = activeKey) {
    await renderLoaded([key])
    const user = userEvent.setup()
    await user.click(row(key.keyPreview).getByRole('button', { name: '編輯' }))
    return { user, form: modal('編輯金鑰說明') }
  }

  it('starts from the current description and saves the trimmed new one', async () => {
    api.update.mockResolvedValue(ok(activeKey))
    const { user, form } = await openEdit()
    const input = form.getByLabelText('金鑰說明')
    expect(input).toHaveValue('台北機房')
    await user.clear(input)
    await user.type(input, '  台中機房 ')
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(api.update).toHaveBeenCalledWith('org-1', activeKey.id, { description: '台中機房' })
    await waitFor(() => expect(screen.queryByRole('heading', { name: '編輯金鑰說明' })).not.toBeInTheDocument())
    expect(api.list).toHaveBeenCalledTimes(2)
  })

  it('clears the description when left blank', async () => {
    api.update.mockResolvedValue(ok(activeKey))
    const { user, form } = await openEdit()
    await user.clear(form.getByLabelText('金鑰說明'))
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(api.update).toHaveBeenCalledWith('org-1', activeKey.id, { description: null })
  })

  it('shows the API error and keeps the form open', async () => {
    api.update.mockRejectedValue(httpError(403, { message: '權限不足' }))
    const { user, form } = await openEdit()
    await user.click(form.getByRole('button', { name: '儲存' }))
    expect(await form.findByText('更新金鑰說明時發生錯誤：權限不足')).toBeInTheDocument()
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it('closes without saving on cancel', async () => {
    const { user, form } = await openEdit()
    await user.click(form.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('heading', { name: '編輯金鑰說明' })).not.toBeInTheDocument()
    expect(api.update).not.toHaveBeenCalled()
  })
})

describe('OrganizationKeysModal — revoke', () => {
  it('revokes after confirmation and reloads the list', async () => {
    await renderLoaded([activeKey])
    api.revoke.mockResolvedValue(ok({ ...activeKey, isRevoked: true }))
    api.list.mockResolvedValue(ok({ data: [{ ...activeKey, isRevoked: true }] }))
    await userEvent.setup().click(row('AbCd…').getByRole('button', { name: '撤銷' }))
    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('AbCd…'))
    expect(api.revoke).toHaveBeenCalledWith('org-1', activeKey.id)
    expect(await screen.findByText('已撤銷')).toBeInTheDocument()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    await renderLoaded([activeKey])
    confirmMock.mockReturnValue(false)
    await userEvent.setup().click(row('AbCd…').getByRole('button', { name: '撤銷' }))
    expect(api.revoke).not.toHaveBeenCalled()
  })

  it('alerts the API error and does not reload', async () => {
    await renderLoaded([activeKey])
    api.revoke.mockRejectedValue(httpError(409, { message: '金鑰已撤銷' }))
    await userEvent.setup().click(row('AbCd…').getByRole('button', { name: '撤銷' }))
    await waitFor(() => expect(alertMock).toHaveBeenCalledWith('撤銷金鑰時發生錯誤：金鑰已撤銷'))
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it('cannot revoke an already revoked key', async () => {
    await renderLoaded([revokedKey])
    expect(row('IjKl…').getByRole('button', { name: '撤銷' })).toBeDisabled()
  })
})

describe('OrganizationKeysModal — .env download', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let downloads: string[]

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:env')
    revokeObjectURL = vi.fn()
    // jsdom has no object URLs.
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    downloads = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}|${this.href}`)
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL')
    Reflect.deleteProperty(URL, 'revokeObjectURL')
  })

  async function openEnv(svcList: Service[] = services) {
    await renderLoaded([activeKey])
    api.services.mockResolvedValue(ok({ data: svcList }))
    const user = userEvent.setup()
    await user.click(row('AbCd…').getByRole('button', { name: '下載 .env' }))
    const form = modal('下載 .env — 選擇可連入的服務')
    return { user, form }
  }

  it('is not offered for revoked or expired keys', async () => {
    await renderLoaded([expiredKey, revokedKey])
    expect(row('EfGh…').getByRole('button', { name: '下載 .env' })).toBeDisabled()
    expect(row('IjKl…').getByRole('button', { name: '下載 .env' })).toBeDisabled()
  })

  it("lists the organization's active services and needs at least one selected", async () => {
    const { form } = await openEnv()
    expect(api.services).toHaveBeenCalledWith({ organizationId: 'org-1', isActive: true })
    expect(await form.findByRole('checkbox', { name: /客服機器人/ })).not.toBeChecked()
    expect(form.getByRole('checkbox', { name: /公文助理/ })).not.toBeChecked()
    expect(form.getByRole('button', { name: '下載 .env' })).toBeDisabled()
  })

  it('downloads the .env for the selected services and closes', async () => {
    const blob = new Blob(['KEY=1'])
    api.env.mockResolvedValue(ok(blob))
    const { user, form } = await openEnv()
    await user.click(await form.findByRole('checkbox', { name: /公文助理/ }))
    await user.click(form.getByRole('button', { name: '下載 .env' }))

    expect(api.env).toHaveBeenCalledWith('org-1', activeKey.id, ['svc-2'])
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(downloads).toEqual(['aaaa1.env|blob:env'])
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:env')
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: '下載 .env — 選擇可連入的服務' })).not.toBeInTheDocument(),
    )
  })

  it('selects and clears all services with 全選', async () => {
    api.env.mockResolvedValue(ok(new Blob(['KEY=1'])))
    const { user, form } = await openEnv()
    const all = await form.findByRole('checkbox', { name: '全選（0/2）' })
    await user.click(all)
    expect(form.getByRole('checkbox', { name: '全選（2/2）' })).toBeChecked()
    expect(form.getByRole('checkbox', { name: /客服機器人/ })).toBeChecked()
    expect(form.getByRole('checkbox', { name: /公文助理/ })).toBeChecked()

    await user.click(form.getByRole('checkbox', { name: '全選（2/2）' }))
    expect(form.getByRole('checkbox', { name: '全選（0/2）' })).not.toBeChecked()
    expect(form.getByRole('checkbox', { name: /客服機器人/ })).not.toBeChecked()

    await user.click(form.getByRole('checkbox', { name: '全選（0/2）' }))
    await user.click(form.getByRole('button', { name: '下載 .env' }))
    expect(api.env).toHaveBeenCalledWith('org-1', activeKey.id, ['svc-1', 'svc-2'])
  })

  it('unchecks a service on a second click', async () => {
    const { user, form } = await openEnv()
    const box = await form.findByRole('checkbox', { name: /客服機器人/ })
    await user.click(box)
    await user.click(box)
    expect(box).not.toBeChecked()
    expect(form.getByRole('button', { name: '下載 .env' })).toBeDisabled()
  })

  it('does not remember the selection between downloads', async () => {
    const { user, form } = await openEnv()
    await user.click(await form.findByRole('checkbox', { name: /客服機器人/ }))
    await user.click(form.getByRole('button', { name: '取消' }))
    await user.click(row('AbCd…').getByRole('button', { name: '下載 .env' }))
    const again = modal('下載 .env — 選擇可連入的服務')
    expect(await again.findByRole('checkbox', { name: /客服機器人/ })).not.toBeChecked()
  })

  it('explains when the organization has no active services', async () => {
    const { form } = await openEnv([])
    expect(await form.findByText('此組織沒有啟用中的服務，無法產生 .env')).toBeInTheDocument()
    expect(form.getByRole('button', { name: '下載 .env' })).toBeDisabled()
  })

  it('shows an error when the services cannot be loaded', async () => {
    await renderLoaded([activeKey])
    api.services.mockRejectedValue(httpError(500, { message: '伺服器忙碌' }))
    const user = userEvent.setup()
    await user.click(row('AbCd…').getByRole('button', { name: '下載 .env' }))
    expect(
      await modal('下載 .env — 選擇可連入的服務').findByText('載入服務清單時發生錯誤：伺服器忙碌'),
    ).toBeInTheDocument()
  })

  it('reads the error message from a blob error body', async () => {
    const body = new Blob([JSON.stringify({ message: '金鑰已過期' })], { type: 'application/json' })
    api.env.mockRejectedValue(httpError(400, body))
    const { user, form } = await openEnv()
    await user.click(await form.findByRole('checkbox', { name: /客服機器人/ }))
    await user.click(form.getByRole('button', { name: '下載 .env' }))
    expect(await form.findByText('下載 .env 時發生錯誤：金鑰已過期')).toBeInTheDocument()
    expect(downloads).toEqual([])
  })

  it('falls back to a generic error when the blob body is not JSON', async () => {
    api.env.mockRejectedValue(httpError(500, new Blob(['<html>oops</html>'])))
    const { user, form } = await openEnv()
    await user.click(await form.findByRole('checkbox', { name: /客服機器人/ }))
    await user.click(form.getByRole('button', { name: '下載 .env' }))
    expect(await form.findByText('下載 .env 時發生錯誤')).toBeInTheDocument()
  })

  it('reads the error message from a JSON error body too', async () => {
    api.env.mockRejectedValue(httpError(403, { message: '權限不足' }))
    const { user, form } = await openEnv()
    await user.click(await form.findByRole('checkbox', { name: /客服機器人/ }))
    await user.click(form.getByRole('button', { name: '下載 .env' }))
    expect(await form.findByText('下載 .env 時發生錯誤：權限不足')).toBeInTheDocument()
  })
})
