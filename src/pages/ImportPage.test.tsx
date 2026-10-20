import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ImportPage } from './ImportPage'
import { getImportLogById, getImportLogs, getOrganizations, importOrganizationData } from '../api'
import type { ImportLog, ImportLogDetail, Organization } from '../types'

vi.mock('../api', () => ({
  getOrganizations: vi.fn(),
  getImportLogs: vi.fn(),
  getImportLogById: vi.fn(),
  importOrganizationData: vi.fn(),
}))

const mockedGetOrganizations = vi.mocked(getOrganizations)
const mockedGetImportLogs = vi.mocked(getImportLogs)
const mockedGetImportLogById = vi.mocked(getImportLogById)
const mockedImport = vi.mocked(importOrganizationData)

/** Only `data` is read by the page; the rest of the axios response is irrelevant here. */
const ok = <T,>(data: T) => Promise.resolve({ data } as AxiosResponse<T>)

function apiError(body: unknown, code = 'ERR_BAD_REQUEST') {
  return new AxiosError('Request failed', code, undefined, undefined, {
    data: body,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: {},
  } as AxiosResponse)
}

const orgA: Organization = { id: 'org-a', name: '甲機關', code: 'A', isActive: true }
const orgB: Organization = { id: 'org-b', name: '乙機關', code: 'B', isActive: true }

function makeLog(overrides: Partial<ImportLog> = {}): ImportLog {
  return {
    id: 'log-1',
    organizationId: 'org-a',
    keyId: 'key-uuid-1',
    keyDescription: '正式環境',
    fileSha256: 'abc',
    status: 'Succeeded',
    requestedByUserId: 'u1',
    requestedByEmail: 'alice@example.com',
    requestedByName: 'Alice',
    requestedAt: '2026-10-01T02:00:00Z',
    dataRangeStart: '2026-09-30T16:30:00Z',
    dataRangeEnd: '2026-10-01T03:00:00Z',
    totalRecordCount: 10,
    succeededRecordCount: 8,
    failedRecordCount: 1,
    duplicateRecordCount: 1,
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ImportLogDetail> = {}): ImportLogDetail {
  return { ...makeLog(), failedLineSamples: [], serviceSummaries: [], ...overrides }
}

const SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

function jsonFile(content: string, name = 'export.json') {
  return new File([content], name, { type: 'application/json' })
}

const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!
const uploadButton = () => screen.getByRole('button', { name: '上傳並匯入' })

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetOrganizations.mockImplementation(() => ok({ data: [orgA, orgB] }))
  mockedGetImportLogs.mockImplementation(() => ok({ data: [] }))
})

async function renderPage() {
  const view = render(<ImportPage />)
  await screen.findByRole('option', { name: '甲機關 (A)' })
  return view
}

describe('ImportPage organizations and logs', () => {
  it("loads only the current user's organizations and selects the first one", async () => {
    await renderPage()
    expect(mockedGetOrganizations).toHaveBeenCalledWith({ currentUser: true })
    expect(screen.getByLabelText('組織')).toHaveValue('org-a')
    await waitFor(() => expect(mockedGetImportLogs).toHaveBeenCalledWith({ organizationId: 'org-a' }))
    expect(await screen.findByText('尚無匯入紀錄')).toBeInTheDocument()
  })

  it('loads the import logs of the organization the user picks', async () => {
    const user = userEvent.setup()
    mockedGetImportLogs.mockImplementation((params) =>
      ok({ data: params?.organizationId === 'org-b' ? [makeLog({ id: 'b1', keyId: 'key-of-b' })] : [] }),
    )
    await renderPage()
    await screen.findByText('尚無匯入紀錄')

    await user.selectOptions(screen.getByLabelText('組織'), 'org-b')

    expect(mockedGetImportLogs).toHaveBeenLastCalledWith({ organizationId: 'org-b' })
    expect(await screen.findByRole('cell', { name: 'key-of-b' })).toBeInTheDocument()
  })

  it('tells a user without organizations that nothing can be imported', async () => {
    mockedGetOrganizations.mockImplementation(() => ok({ data: [] }))
    render(<ImportPage />)
    expect(await screen.findByText('您尚未被指派至任何組織，無法匯入資料')).toBeInTheDocument()
    expect(mockedGetImportLogs).not.toHaveBeenCalled()
  })

  it('shows an organization load error instead of the "no organizations" message, and retries', async () => {
    const user = userEvent.setup()
    mockedGetOrganizations.mockImplementationOnce(() => Promise.reject(apiError({ message: '權限不足' })))
    render(<ImportPage />)

    expect(await screen.findByText('載入組織資料時發生錯誤：權限不足')).toBeInTheDocument()
    expect(screen.queryByText('您尚未被指派至任何組織，無法匯入資料')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByRole('option', { name: '甲機關 (A)' })).toBeInTheDocument()
    expect(screen.queryByText(/載入組織資料時發生錯誤/)).not.toBeInTheDocument()
  })

  it('explains an organization request timeout', async () => {
    mockedGetOrganizations.mockImplementationOnce(() => Promise.reject(new AxiosError('timeout', 'ECONNABORTED')))
    render(<ImportPage />)
    expect(await screen.findByText('載入組織資料時發生錯誤：伺服器回應逾時，請稍後重試')).toBeInTheDocument()
  })

  it('shows a log load error and retries for the same organization', async () => {
    const user = userEvent.setup()
    mockedGetImportLogs.mockImplementationOnce(() => Promise.reject(apiError({ message: '查詢失敗' })))
    await renderPage()

    expect(await screen.findByText('載入匯入紀錄時發生錯誤：查詢失敗')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重試' }))

    expect(mockedGetImportLogs).toHaveBeenLastCalledWith({ organizationId: 'org-a' })
    await waitFor(() => expect(screen.queryByText(/載入匯入紀錄時發生錯誤/)).not.toBeInTheDocument())
  })

  it('lists logs newest first with Taipei times, labels and counts, and summarises the last import', async () => {
    mockedGetImportLogs.mockImplementation(() =>
      ok({
        data: [
          makeLog({ id: 'old', keyId: 'key-old', requestedAt: '2026-09-01T00:00:00Z', status: 'Failed' }),
          makeLog({
            id: 'new',
            keyId: 'key-new',
            requestedAt: '2026-10-01T02:00:00Z',
            status: 'PartiallySucceeded',
          }),
        ],
      }),
    )
    await renderPage()

    const rows = (await screen.findAllByRole('row')).slice(1)
    expect(rows).toHaveLength(2)
    const newest = within(rows[0])
    expect(newest.getByText('2026-10-01 10:00:00 GMT+8')).toBeInTheDocument()
    expect(newest.getByText('key-new')).toBeInTheDocument()
    expect(newest.getByText('部分成功')).toBeInTheDocument()
    // Data range shown as Taipei dates: 2026-09-30T16:30Z is already 10/01 in Taipei.
    expect(newest.getByText('2026-10-01 ~ 2026-10-01')).toBeInTheDocument()
    expect(newest.getByText('Alice')).toBeInTheDocument()
    expect(newest.getByText('alice@example.com')).toBeInTheDocument()
    expect(within(rows[1]).getByText('失敗')).toBeInTheDocument()

    expect(
      screen.getByText('上次匯入：金鑰 正式環境（key-new），Alice，2026-10-01 10:00:00 GMT+8'),
    ).toBeInTheDocument()
  })

  it('falls back to "—" and the email when key, range or name are missing', async () => {
    mockedGetImportLogs.mockImplementation(() =>
      ok({
        data: [
          makeLog({
            keyId: null,
            keyDescription: null,
            requestedByName: null,
            dataRangeStart: null,
            status: 'Duplicate',
          }),
        ],
      }),
    )
    await renderPage()

    const row = within((await screen.findAllByRole('row'))[1])
    expect(row.getByText('alice@example.com')).toBeInTheDocument()
    expect(row.getAllByText('—')).toHaveLength(3) // key, description, data range
    expect(row.getByText('重複')).toBeInTheDocument()
    expect(screen.getByText('上次匯入：—，alice@example.com，2026-10-01 10:00:00 GMT+8')).toBeInTheDocument()
  })
})

describe('ImportPage upload', () => {
  it('sends the parsed JSON envelope to the selected organization and shows the result', async () => {
    const user = userEvent.setup()
    const envelope = { key_id: 'key-uuid-1', payload: 'ciphertext', nested: { a: 1 } }
    mockedImport.mockImplementation(() =>
      ok(
        makeDetail({
          status: 'PartiallySucceeded',
          totalRecordCount: 10,
          succeededRecordCount: 7,
          failedRecordCount: 2,
          duplicateRecordCount: 1,
          errorMessage: '部分資料格式錯誤',
          serviceSummaries: [
            { serviceId: 'svc-1', totalCount: 10, succeededCount: 7, failedCount: 2, duplicateCount: 1, failedReason: '欄位缺漏' },
          ],
        }),
      ),
    )
    const { container } = await renderPage()
    await user.selectOptions(screen.getByLabelText('組織'), 'org-b')

    expect(uploadButton()).toBeDisabled()
    await user.upload(fileInput(container), jsonFile(JSON.stringify(envelope)))
    expect(screen.getByText('已選擇檔案：export.json')).toBeInTheDocument()
    const logCallsBefore = mockedGetImportLogs.mock.calls.length

    await user.click(uploadButton())

    expect(mockedImport).toHaveBeenCalledTimes(1)
    expect(mockedImport).toHaveBeenCalledWith('org-b', envelope)
    expect(
      await screen.findByText(/匯入結果：部分成功，\s*共 10 筆，成功 7，\s*失敗 2，重複 1，部分資料格式錯誤/),
    ).toBeInTheDocument()
    expect(screen.getByText(/共 10 筆，\s*成功 7，失敗 2，重複 1（失敗原因：欄位缺漏）/)).toBeInTheDocument()
    // The selected file is cleared and the log list refreshed for the same organization.
    expect(screen.queryByText(/已選擇檔案/)).not.toBeInTheDocument()
    expect(uploadButton()).toBeDisabled()
    await waitFor(() => expect(mockedGetImportLogs.mock.calls.length).toBe(logCallsBefore + 1))
    expect(mockedGetImportLogs).toHaveBeenLastCalledWith({ organizationId: 'org-b' })
  })

  it('rejects a file that is not valid JSON without calling the API', async () => {
    const user = userEvent.setup()
    const { container } = await renderPage()

    await user.upload(fileInput(container), jsonFile('{ not json', 'broken.json'))
    await user.click(uploadButton())

    expect(await screen.findByText('檔案不是有效的 JSON 格式')).toBeInTheDocument()
    expect(mockedImport).not.toHaveBeenCalled()
  })

  it('shows the API error message when the import is rejected', async () => {
    const user = userEvent.setup()
    mockedImport.mockImplementation(() =>
      Promise.reject(apiError({ message: '金鑰不符', errors: ['金鑰已撤銷'] })),
    )
    const { container } = await renderPage()

    await user.upload(fileInput(container), jsonFile('{}'))
    await user.click(uploadButton())

    expect(await screen.findByText('匯入時發生錯誤：金鑰不符 金鑰已撤銷')).toBeInTheDocument()
    // The file stays selected so the user can retry.
    expect(screen.getByText('已選擇檔案：export.json')).toBeInTheDocument()
  })

  it('shows a generic message when the error carries no detail', async () => {
    const user = userEvent.setup()
    mockedImport.mockImplementation(() => Promise.reject(new Error('boom')))
    const { container } = await renderPage()

    await user.upload(fileInput(container), jsonFile('{}'))
    await user.click(uploadButton())

    expect(await screen.findByText('匯入時發生錯誤')).toBeInTheDocument()
  })

  it('explains an upload timeout', async () => {
    const user = userEvent.setup()
    mockedImport.mockImplementation(() => Promise.reject(new AxiosError('timeout', 'ECONNABORTED')))
    const { container } = await renderPage()

    await user.upload(fileInput(container), jsonFile('{}'))
    await user.click(uploadButton())

    expect(await screen.findByText(/^上傳逾時/)).toBeInTheDocument()
  })

  it('disables the button and shows progress while importing, so it cannot be sent twice', async () => {
    const user = userEvent.setup()
    let resolve!: (v: AxiosResponse<ImportLogDetail>) => void
    mockedImport.mockImplementation(() => new Promise((r) => (resolve = r)))
    const { container } = await renderPage()

    await user.upload(fileInput(container), jsonFile('{}'))
    await user.click(uploadButton())

    const busy = await screen.findByRole('button', { name: '匯入中…' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    expect(mockedImport).toHaveBeenCalledTimes(1)

    resolve({ data: makeDetail() } as AxiosResponse<ImportLogDetail>)
    expect(await screen.findByText(/匯入結果：成功/)).toBeInTheDocument()
  })
})

describe('ImportPage detail', () => {
  it('expands a log to show service counts, failed lines and the full file SHA-256, then collapses', async () => {
    const user = userEvent.setup()
    mockedGetImportLogs.mockImplementation(() => ok({ data: [makeLog({ id: 'log-9' })] }))
    mockedGetImportLogById.mockImplementation(() =>
      ok(
        makeDetail({
          id: 'log-9',
          fileSha256: SHA,
          errorMessage: '有 1 列解析失敗',
          serviceSummaries: [
            { serviceId: 'svc-x', totalCount: 5, succeededCount: 4, failedCount: 1, duplicateCount: 0, failedReason: null },
          ],
          failedLineSamples: [{ lineNumber: 42, reason: '缺少 rating 欄位' }],
        }),
      ),
    )
    await renderPage()

    await user.click(await screen.findByRole('button', { name: '詳情' }))

    expect(mockedGetImportLogById).toHaveBeenCalledWith('log-9')
    // The full 64-character value, labelled, not shortened.
    expect((await screen.findByText(SHA)).parentElement).toHaveTextContent(`檔案 SHA-256：${SHA}`)
    expect(screen.getByText('有 1 列解析失敗')).toBeInTheDocument()
    expect(screen.getByText('各服務匯入筆數')).toBeInTheDocument()
    const serviceRow = screen.getByRole('cell', { name: 'svc-x' }).closest('tr')!
    expect(within(serviceRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['svc-x', '5', '4', '1', '0', '—'])
    expect(screen.getByRole('cell', { name: '42' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '缺少 rating 欄位' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '收合' }))
    expect(screen.queryByText(/檔案 SHA-256/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '詳情' })).toBeInTheDocument()
  })

  it('says there are no failed lines when the detail has none', async () => {
    const user = userEvent.setup()
    mockedGetImportLogs.mockImplementation(() => ok({ data: [makeLog()] }))
    mockedGetImportLogById.mockImplementation(() => ok(makeDetail({ fileSha256: SHA })))
    await renderPage()

    await user.click(await screen.findByRole('button', { name: '詳情' }))

    expect(await screen.findByText('無失敗列細節')).toBeInTheDocument()
    expect(screen.queryByText('各服務匯入筆數')).not.toBeInTheDocument()
  })

  it('shows an error when the detail cannot be loaded', async () => {
    const user = userEvent.setup()
    mockedGetImportLogs.mockImplementation(() => ok({ data: [makeLog()] }))
    mockedGetImportLogById.mockImplementation(() => Promise.reject(apiError({ message: '找不到紀錄' })))
    await renderPage()

    await user.click(await screen.findByRole('button', { name: '詳情' }))

    expect(await screen.findByText('載入匯入詳情時發生錯誤：找不到紀錄')).toBeInTheDocument()
  })
})
