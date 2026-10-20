import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getOrganizations,
  getUserById,
  getUsers,
  resetUser2FA,
  updateUser,
} from '../api'
import { PASSWORD_RULE_HINT } from '../lib/passwordRules'
import type { Organization, User } from '../types'

vi.mock('../api', () => ({
  changeUserPassword: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getOrganizations: vi.fn(),
  getUserById: vi.fn(),
  getUsers: vi.fn(),
  resetUser2FA: vi.fn(),
  updateUser: vi.fn(),
}))

/** Axios-shaped response: the page reads `res.data` (and `res.data.data` for lists). */
const res = (data: unknown) => ({ data }) as never
const list = (data: unknown) => res({ data })
const apiError = (message: string) =>
  new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
    status: 400,
    data: { message },
  } as AxiosResponse)

const orgs: Organization[] = [
  { id: 'o1', name: '資安院', code: 'NICS', isActive: true },
  { id: 'o2', name: '數位部', code: 'MODA', isActive: true },
]
const alice: User = {
  id: 'u1',
  name: 'Alice',
  email: 'alice@example.com',
  organizationIds: ['o1', 'o2'],
  isSystemAdmin: true,
  twoFactorEnabled: true,
}
const bob: User = {
  id: 'u2',
  name: 'Bob',
  email: 'bob@example.com',
  organizationIds: ['o1'],
  isSystemAdmin: false,
  twoFactorEnabled: false,
}

let alertSpy: ReturnType<typeof vi.spyOn>
let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.mocked(getUsers).mockResolvedValue(list([alice, bob]))
  vi.mocked(getOrganizations).mockResolvedValue(list(orgs))
  vi.mocked(createUser).mockResolvedValue(res({}))
  vi.mocked(updateUser).mockResolvedValue(res({}))
  vi.mocked(deleteUser).mockResolvedValue(res(null))
  vi.mocked(changeUserPassword).mockResolvedValue(res({}))
  vi.mocked(resetUser2FA).mockResolvedValue(res(null))
  vi.mocked(getUserById).mockImplementation(async (id) => res([alice, bob].find((u) => u.id === id)))
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function renderPage() {
  const user = userEvent.setup()
  render(<UsersPage />)
  await screen.findByText('Alice')
  return user
}

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
/** The modal box holding the given title (the Modal has no dialog role; its title is an h2). */
const dialogOf = (title: string) =>
  within(screen.getByRole('heading', { name: title }).parentElement?.parentElement as HTMLElement)

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '新增使用者' }))
  await user.type(screen.getByLabelText('中文名稱'), '  Carol  ')
  await user.type(screen.getByLabelText('信箱'), '  Carol@Example.COM ')
  await user.type(screen.getByLabelText('密碼'), 'Secret#Pass123')
}

describe('UsersPage list', () => {
  it('loads users and active organizations and shows each user', async () => {
    await renderPage()
    expect(getOrganizations).toHaveBeenCalledWith({ IsActive: true })

    const aliceRow = within(rowOf('Alice'))
    expect(aliceRow.getByText('alice@example.com')).toBeInTheDocument()
    expect(aliceRow.getByText('資安院、數位部')).toBeInTheDocument()
    expect(aliceRow.getByText('已綁定')).toBeInTheDocument()
    expect(aliceRow.getByText('是')).toBeInTheDocument()

    const bobRow = within(rowOf('Bob'))
    expect(bobRow.getByText('資安院')).toBeInTheDocument()
    expect(bobRow.getByText('待綁定')).toBeInTheDocument()
    expect(bobRow.getByText('否')).toBeInTheDocument()
  })

  it('shows a dash when none of the user organizations is known', async () => {
    vi.mocked(getUsers).mockResolvedValue(list([{ ...bob, organizationIds: ['gone'] }]))
    render(<UsersPage />)
    const row = (await screen.findByText('Bob')).closest('tr') as HTMLElement
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('offers 重設二階段驗證 only for users who have bound 2FA', async () => {
    await renderPage()
    expect(within(rowOf('Alice')).getByRole('button', { name: '重設二階段驗證' })).toBeInTheDocument()
    expect(within(rowOf('Bob')).queryByRole('button', { name: '重設二階段驗證' })).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no users', async () => {
    vi.mocked(getUsers).mockResolvedValue(list([]))
    render(<UsersPage />)
    expect(await screen.findByText('尚無使用者資料')).toBeInTheDocument()
  })

  it('shows the API error message on load failure and reloads on 重試', async () => {
    vi.mocked(getUsers).mockRejectedValueOnce(apiError('伺服器忙碌'))
    const user = userEvent.setup()
    render(<UsersPage />)
    expect(await screen.findByText('載入使用者資料時發生錯誤：伺服器忙碌')).toBeInTheDocument()
    expect(screen.queryByText('尚無使用者資料')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText(/載入使用者資料時發生錯誤/)).not.toBeInTheDocument()
  })

  it('shows a generic load error when the error carries no message', async () => {
    vi.mocked(getUsers).mockRejectedValueOnce(new Error('network'))
    render(<UsersPage />)
    expect(await screen.findByText('載入使用者資料時發生錯誤')).toBeInTheDocument()
  })
})

describe('UsersPage create', () => {
  it('shows the password rule hint and the mandatory-2FA note', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增使用者' }))
    expect(screen.getByRole('heading', { name: '新增使用者' })).toBeInTheDocument()
    expect(screen.getByText(PASSWORD_RULE_HINT)).toBeInTheDocument()
    expect(screen.getByText(/二階段驗證為強制要求/)).toBeInTheDocument()
  })

  it.each([
    ['name', '請輸入中文名稱', {}],
    ['email', '請輸入信箱', { name: 'Carol' }],
    ['password', '請輸入密碼', { name: 'Carol', email: 'c@example.com' }],
  ])('requires %s before sending', async (_field, message, values: { name?: string; email?: string }) => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增使用者' }))
    if (values.name) await user.type(screen.getByLabelText('中文名稱'), values.name)
    if (values.email) await user.type(screen.getByLabelText('信箱'), values.email)
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only name as missing', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: '新增使用者' }))
    await user.type(screen.getByLabelText('中文名稱'), '   ')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText('請輸入中文名稱')).toBeInTheDocument()
  })

  it('creates a system admin with trimmed name, normalized email and the chosen organizations', async () => {
    const user = await renderPage()
    await fillCreateForm(user)
    await user.click(screen.getByRole('checkbox', { name: '數位部 (MODA)' }))
    await user.click(screen.getByRole('checkbox', { name: '管理員' }))
    vi.mocked(getUsers).mockClear()
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(createUser).toHaveBeenCalledTimes(1)
    expect(createUser).toHaveBeenCalledWith({
      id: expect.any(String),
      name: 'Carol',
      email: 'carol@example.com',
      initialPassword: 'Secret#Pass123',
      organizationIds: ['o2'],
      isSystemAdmin: true,
    })
    await waitFor(() => expect(screen.queryByRole('heading', { name: '新增使用者' })).not.toBeInTheDocument())
    expect(getUsers).toHaveBeenCalled()
  })

  it('creates a regular user (isSystemAdmin false) with no organizations by default', async () => {
    const user = await renderPage()
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ organizationIds: [], isSystemAdmin: false }),
    )
  })

  it('keeps the dialog open and shows the API message when creation fails', async () => {
    vi.mocked(createUser).mockRejectedValue(apiError('Email 已被使用'))
    const user = await renderPage()
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('新增使用者時發生錯誤：Email 已被使用')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新增使用者' })).toBeInTheDocument()
  })

  it('sends only one create request when 儲存 is clicked again while saving', async () => {
    let finish: (v: unknown) => void = () => {}
    vi.mocked(createUser).mockImplementation(() => new Promise((r) => (finish = r)) as never)
    const user = await renderPage()
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: '儲存' }))

    const saving = screen.getByRole('button', { name: '儲存中…' })
    expect(saving).toBeDisabled()
    await user.click(saving)
    expect(createUser).toHaveBeenCalledTimes(1)

    finish(res({}))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '新增使用者' })).not.toBeInTheDocument())
  })

  it('starts with an empty form after a previous edit', async () => {
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '編輯' }))
    await screen.findByRole('heading', { name: '編輯使用者' })
    await user.click(screen.getByRole('button', { name: '取消' }))

    await user.click(screen.getByRole('button', { name: '新增使用者' }))
    expect(screen.getByLabelText('中文名稱')).toHaveValue('')
    expect(screen.getByLabelText('信箱')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: '管理員' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '資安院 (NICS)' })).not.toBeChecked()
  })
})

describe('UsersPage edit', () => {
  async function openEdit(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(within(rowOf(name)).getByRole('button', { name: '編輯' }))
    await screen.findByRole('heading', { name: '編輯使用者' })
  }

  it('fetches the user and pre-fills the form without a password field', async () => {
    const user = await renderPage()
    await openEdit(user, 'Alice')
    expect(getUserById).toHaveBeenCalledWith('u1')
    expect(screen.getByLabelText('中文名稱')).toHaveValue('Alice')
    expect(screen.getByLabelText('信箱')).toHaveValue('alice@example.com')
    expect(screen.queryByLabelText('密碼')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '資安院 (NICS)' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '數位部 (MODA)' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '管理員' })).toBeChecked()
    expect(dialogOf('編輯使用者').getByText('已綁定')).toBeInTheDocument()
  })

  it('grants admin and an organization to a regular user', async () => {
    const user = await renderPage()
    await openEdit(user, 'Bob')
    await user.click(screen.getByRole('checkbox', { name: '數位部 (MODA)' }))
    await user.click(screen.getByRole('checkbox', { name: '管理員' }))
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(updateUser).toHaveBeenCalledWith('u2', {
      name: 'Bob',
      email: 'bob@example.com',
      organizationIds: ['o1', 'o2'],
      isSystemAdmin: true,
    })
    expect(createUser).not.toHaveBeenCalled()
  })

  it('revokes admin and an organization, normalizing name and email', async () => {
    const user = await renderPage()
    await openEdit(user, 'Alice')
    await user.click(screen.getByRole('checkbox', { name: '資安院 (NICS)' }))
    await user.click(screen.getByRole('checkbox', { name: '管理員' }))
    const email = screen.getByLabelText('信箱')
    await user.clear(email)
    await user.type(email, ' Alice@NEW.org ')
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(updateUser).toHaveBeenCalledWith('u1', {
      name: 'Alice',
      email: 'alice@new.org',
      organizationIds: ['o2'],
      isSystemAdmin: false,
    })
    await waitFor(() => expect(screen.queryByRole('heading', { name: '編輯使用者' })).not.toBeInTheDocument())
  })

  it('shows the API message when the update fails', async () => {
    vi.mocked(updateUser).mockRejectedValue(apiError('無權限'))
    const user = await renderPage()
    await openEdit(user, 'Bob')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('更新使用者時發生錯誤：無權限')).toBeInTheDocument()
  })

  it('alerts with the API message when the user cannot be fetched', async () => {
    vi.mocked(getUserById).mockRejectedValue(apiError('找不到使用者'))
    const user = await renderPage()
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '編輯' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('取得使用者資料時發生錯誤：找不到使用者'))
    expect(screen.queryByRole('heading', { name: '編輯使用者' })).not.toBeInTheDocument()
  })

  it('alerts when the fetched user does not exist', async () => {
    vi.mocked(getUserById).mockResolvedValue(res(null))
    const user = await renderPage()
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '編輯' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('使用者不存在'))
    expect(screen.queryByRole('heading', { name: '編輯使用者' })).not.toBeInTheDocument()
  })

  it('opens the password dialog from the edit dialog', async () => {
    const user = await renderPage()
    await openEdit(user, 'Bob')
    await user.click(dialogOf('編輯使用者').getByRole('button', { name: '修改密碼' }))
    expect(screen.getByRole('heading', { name: '修改密碼 — Bob' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '編輯使用者' })).not.toBeInTheDocument()
  })

  it('resets 2FA from the edit dialog of a bound user', async () => {
    const user = await renderPage()
    await openEdit(user, 'Alice')
    await user.click(dialogOf('編輯使用者').getByRole('button', { name: '重設二階段驗證' }))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Alice'))
    await waitFor(() => expect(resetUser2FA).toHaveBeenCalledWith('u1'))
  })
})

describe('UsersPage delete', () => {
  it('refuses to delete the last system admin', async () => {
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '刪除' }))
    expect(alertSpy).toHaveBeenCalledWith('系統至少需要一位管理員，無法刪除')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('deletes a system admin when another admin remains', async () => {
    vi.mocked(getUsers).mockResolvedValue(list([alice, { ...bob, isSystemAdmin: true }]))
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '刪除' }))
    expect(confirmSpy).toHaveBeenCalledWith('確定要刪除使用者「Alice」？')
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('u1'))
  })

  it('deletes a regular user after confirmation and reloads the list', async () => {
    const user = await renderPage()
    vi.mocked(getUsers).mockClear()
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '刪除' }))
    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith('u2'))
    await waitFor(() => expect(getUsers).toHaveBeenCalled())
  })

  it('does nothing when the confirmation is cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    const user = await renderPage()
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '刪除' }))
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('alerts with the API message when deletion fails', async () => {
    vi.mocked(deleteUser).mockRejectedValue(apiError('使用者仍有資料'))
    const user = await renderPage()
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '刪除' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('刪除使用者時發生錯誤：使用者仍有資料'))
  })
})

describe('UsersPage reset 2FA', () => {
  it('resets after confirmation', async () => {
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '重設二階段驗證' }))
    expect(confirmSpy).toHaveBeenCalledWith('確定要重設「Alice」的二階段驗證？該使用者下次登入時需重新綁定。')
    await waitFor(() => expect(resetUser2FA).toHaveBeenCalledWith('u1'))
  })

  it('does nothing when cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '重設二階段驗證' }))
    expect(resetUser2FA).not.toHaveBeenCalled()
  })

  it('alerts with the API message on failure', async () => {
    vi.mocked(resetUser2FA).mockRejectedValue(apiError('失敗了'))
    const user = await renderPage()
    await user.click(within(rowOf('Alice')).getByRole('button', { name: '重設二階段驗證' }))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('重設二階段驗證時發生錯誤：失敗了'))
  })
})

describe('UsersPage change password', () => {
  async function openPassword(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(rowOf('Bob')).getByRole('button', { name: '修改密碼' }))
    expect(screen.getByRole('heading', { name: '修改密碼 — Bob' })).toBeInTheDocument()
  }

  it('shows the password rule hint', async () => {
    const user = await renderPage()
    await openPassword(user)
    expect(screen.getByText(PASSWORD_RULE_HINT)).toBeInTheDocument()
  })

  it('requires a new password', async () => {
    const user = await renderPage()
    await openPassword(user)
    await user.click(screen.getByRole('button', { name: '更新密碼' }))
    expect(screen.getByText('請輸入新密碼')).toBeInTheDocument()
    expect(changeUserPassword).not.toHaveBeenCalled()
  })

  it('requires the confirmation to match', async () => {
    const user = await renderPage()
    await openPassword(user)
    await user.type(screen.getByLabelText('新密碼'), 'Secret#Pass123')
    await user.type(screen.getByLabelText('確認新密碼'), 'Secret#Pass124')
    await user.click(screen.getByRole('button', { name: '更新密碼' }))
    expect(screen.getByText('新密碼與確認密碼不一致')).toBeInTheDocument()
    expect(changeUserPassword).not.toHaveBeenCalled()
  })

  it('sends the new password for the chosen user and closes', async () => {
    const user = await renderPage()
    await openPassword(user)
    await user.type(screen.getByLabelText('新密碼'), 'Secret#Pass123')
    await user.type(screen.getByLabelText('確認新密碼'), 'Secret#Pass123')
    await user.click(screen.getByRole('button', { name: '更新密碼' }))
    expect(changeUserPassword).toHaveBeenCalledWith('u2', 'Secret#Pass123')
    await waitFor(() => expect(screen.queryByRole('heading', { name: /修改密碼 —/ })).not.toBeInTheDocument())
  })

  it('shows the API message when the change fails', async () => {
    vi.mocked(changeUserPassword).mockRejectedValue(apiError('密碼強度不足'))
    const user = await renderPage()
    await openPassword(user)
    await user.type(screen.getByLabelText('新密碼'), 'weak')
    await user.type(screen.getByLabelText('確認新密碼'), 'weak')
    await user.click(screen.getByRole('button', { name: '更新密碼' }))
    expect(await screen.findByText('更新密碼時發生錯誤：密碼強度不足')).toBeInTheDocument()
  })
})
