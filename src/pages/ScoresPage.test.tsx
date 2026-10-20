import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScoresPage } from './ScoresPage'
import { getScoreConfigs, updateScoreConfig } from '../api'
import type { ScoreConfig } from '../types'

vi.mock('../api', () => ({ getScoreConfigs: vi.fn(), updateScoreConfig: vi.fn() }))

const mockedGet = vi.mocked(getScoreConfigs)
const mockedUpdate = vi.mocked(updateScoreConfig)

const good: ScoreConfig = { id: 'good', name: '滿意', description: '回答有幫助', scoreValue: 100 }
const normal: ScoreConfig = { id: 'normal', name: '普通', description: '回答尚可', scoreValue: 50 }
const bad: ScoreConfig = { id: 'bad', name: '不佳', description: '回答沒有幫助', scoreValue: 0 }

const respond = <T,>(data: T) => Promise.resolve({ data } as AxiosResponse<T>)
const listResponse = (configs: ScoreConfig[]) => respond({ data: configs })

function apiError(message: string) {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 500,
    data: { message },
  } as AxiosResponse)
}

/** The three body rows as [code, name, description, score] cell texts. */
async function bodyRows() {
  await screen.findByRole('table')
  const [, ...rows] = screen.getAllByRole('row')
  return rows.map((row) =>
    within(row)
      .getAllByRole('cell')
      .slice(0, 4)
      .map((cell) => cell.textContent),
  )
}

function rowFor(code: string) {
  const row = screen.getAllByRole('row').find((r) => within(r).queryAllByRole('cell')[0]?.textContent === code)
  if (!row) throw new Error(`no row for ${code}`)
  return row
}

async function openEdit(code: string) {
  const user = userEvent.setup()
  await screen.findByRole('table')
  await user.click(within(rowFor(code)).getByRole('button', { name: '編輯' }))
  return user
}

beforeEach(() => {
  mockedGet.mockReset()
  mockedUpdate.mockReset()
})

describe('ScoresPage', () => {
  it('shows fixed good / normal / bad rows filled from the config with the same id', async () => {
    mockedGet.mockReturnValue(listResponse([bad, good, normal]))
    render(<ScoresPage />)

    expect(await bodyRows()).toEqual([
      ['good', '滿意', '回答有幫助', '100'],
      ['normal', '普通', '回答尚可', '50'],
      ['bad', '不佳', '回答沒有幫助', '0'],
    ])
  })

  it('keeps each row on its own id when bad scores higher than normal (regression)', async () => {
    mockedGet.mockReturnValue(
      listResponse([
        { ...good, scoreValue: 100 },
        { ...normal, scoreValue: 50 },
        { ...bad, scoreValue: 60 },
      ]),
    )
    render(<ScoresPage />)

    expect(await bodyRows()).toEqual([
      ['good', '滿意', '回答有幫助', '100'],
      ['normal', '普通', '回答尚可', '50'],
      ['bad', '不佳', '回答沒有幫助', '60'],
    ])
  })

  it('shows "—" and disables editing for a rating without a config', async () => {
    mockedGet.mockReturnValue(listResponse([good, bad]))
    render(<ScoresPage />)

    expect(await bodyRows()).toEqual([
      ['good', '滿意', '回答有幫助', '100'],
      ['normal', '—', '—', '—'],
      ['bad', '不佳', '回答沒有幫助', '0'],
    ])
    expect(within(rowFor('normal')).getByRole('button', { name: '編輯' })).toBeDisabled()
    expect(within(rowFor('good')).getByRole('button', { name: '編輯' })).toBeEnabled()
  })

  it('ignores configs whose id is not a rating code', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad, { id: 'other', name: '其他', description: 'x', scoreValue: 70 }]))
    render(<ScoresPage />)

    expect((await bodyRows()).map((r) => r[0])).toEqual(['good', 'normal', 'bad'])
    expect(screen.queryByText('其他')).not.toBeInTheDocument()
  })

  it('opens the editor filled with the clicked row’s config', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, { ...bad, scoreValue: 60 }]))
    render(<ScoresPage />)
    await openEdit('bad')

    expect(screen.getByRole('heading', { name: '編輯評價：bad' })).toBeInTheDocument()
    expect(screen.getByLabelText('中文名稱')).toHaveValue('不佳')
    expect(screen.getByLabelText('中文說明')).toHaveValue('回答沒有幫助')
    expect(screen.getByLabelText('分數（0～100）')).toHaveValue(60)
  })

  it('submits the edited, trimmed values to the edited config’s id and reloads the list', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    mockedUpdate.mockReturnValue(respond({ ...bad, name: '很差', description: '完全沒幫助', scoreValue: 10 }))
    render(<ScoresPage />)
    const user = await openEdit('bad')

    await user.clear(screen.getByLabelText('中文名稱'))
    await user.type(screen.getByLabelText('中文名稱'), '  很差 ')
    await user.clear(screen.getByLabelText('中文說明'))
    await user.type(screen.getByLabelText('中文說明'), '完全沒幫助  ')
    await user.clear(screen.getByLabelText('分數（0～100）'))
    await user.type(screen.getByLabelText('分數（0～100）'), '10')

    mockedGet.mockReturnValue(listResponse([good, normal, { ...bad, name: '很差', description: '完全沒幫助', scoreValue: 10 }]))
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(mockedUpdate).toHaveBeenCalledWith('bad', { name: '很差', description: '完全沒幫助', scoreValue: 10 })
    await waitFor(() => expect(screen.queryByRole('heading', { name: /編輯評價/ })).not.toBeInTheDocument())
    await waitFor(async () => expect((await bodyRows())[2]).toEqual(['bad', '很差', '完全沒幫助', '10']))
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it('shows exactly what is typed after clearing the score, without a leading 0 (regression)', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')
    const score = screen.getByLabelText('分數（0～100）') as HTMLInputElement

    await user.clear(score)
    expect(score.value).toBe('')
    await user.type(score, '60')
    expect(score.value).toBe('60')
  })

  it('requires a score instead of saving an empty field as 0', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')

    await user.clear(screen.getByLabelText('分數（0～100）'))
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(screen.getByText('請輸入分數')).toBeInTheDocument()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('selects the current score on focus, so typing replaces it', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    const select = vi.spyOn(HTMLInputElement.prototype, 'select')
    render(<ScoresPage />)
    const user = await openEdit('good')

    await user.click(screen.getByLabelText('分數（0～100）'))

    expect(select).toHaveBeenCalled()
    expect(select.mock.contexts.at(-1)).toBe(screen.getByLabelText('分數（0～100）'))
    select.mockRestore()
  })

  it('accepts the 0 and 100 boundaries', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    mockedUpdate.mockReturnValue(respond(good))
    render(<ScoresPage />)

    let user = await openEdit('normal')
    await user.clear(screen.getByLabelText('分數（0～100）'))
    await user.type(screen.getByLabelText('分數（0～100）'), '100')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(mockedUpdate).toHaveBeenLastCalledWith('normal', { name: '普通', description: '回答尚可', scoreValue: 100 })

    await waitFor(() => expect(screen.queryByRole('heading', { name: /編輯評價/ })).not.toBeInTheDocument())
    user = await openEdit('good')
    await user.clear(screen.getByLabelText('分數（0～100）'))
    await user.type(screen.getByLabelText('分數（0～100）'), '0')
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(mockedUpdate).toHaveBeenLastCalledWith('good', { name: '滿意', description: '回答有幫助', scoreValue: 0 })
  })

  it.each([
    ['above 100', '101'],
    ['below 0', '-1'],
  ])('rejects a score %s without sending a request', async (_case, typed) => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')

    // fireEvent: user-event can't type a leading "-" into a number input in jsdom.
    fireEvent.change(screen.getByLabelText('分數（0～100）'), { target: { value: typed } })
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(screen.getByText('分數須為 0～100 的數字')).toBeInTheDocument()
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '編輯評價：good' })).toBeInTheDocument()
  })

  it('requires a name (whitespace only does not count)', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')

    await user.clear(screen.getByLabelText('中文名稱'))
    await user.type(screen.getByLabelText('中文名稱'), '   ')
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(screen.getByText('請輸入中文名稱')).toBeInTheDocument()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('requires a description', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')

    await user.clear(screen.getByLabelText('中文說明'))
    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(screen.getByText('請輸入中文說明')).toBeInTheDocument()
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('shows the API error in the editor and keeps it open when saving fails', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    mockedUpdate.mockRejectedValue(apiError('分數重複'))
    render(<ScoresPage />)
    const user = await openEdit('normal')

    await user.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByText('更新分數設定時發生錯誤：分數重複')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '編輯評價：normal' })).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('clears a previous validation error when the editor is reopened', async () => {
    mockedGet.mockReturnValue(listResponse([good, normal, bad]))
    render(<ScoresPage />)
    const user = await openEdit('good')
    await user.clear(screen.getByLabelText('中文名稱'))
    await user.click(screen.getByRole('button', { name: '儲存' }))
    expect(screen.getByText('請輸入中文名稱')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('heading', { name: /編輯評價/ })).not.toBeInTheDocument()
    await user.click(within(rowFor('good')).getByRole('button', { name: '編輯' }))

    expect(screen.queryByText('請輸入中文名稱')).not.toBeInTheDocument()
    expect(screen.getByLabelText('中文名稱')).toHaveValue('滿意')
  })

  it('shows a load error with the API message and reloads on 重試', async () => {
    mockedGet.mockRejectedValueOnce(apiError('伺服器錯誤')).mockReturnValue(listResponse([good, normal, bad]))
    const user = userEvent.setup()
    render(<ScoresPage />)

    expect(await screen.findByText('載入分數設定時發生錯誤：伺服器錯誤')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重試' }))

    expect((await bodyRows())[0]).toEqual(['good', '滿意', '回答有幫助', '100'])
    expect(screen.queryByText(/載入分數設定時發生錯誤/)).not.toBeInTheDocument()
  })

  it('shows a load error without detail when the failure carries no message', async () => {
    mockedGet.mockRejectedValue(new Error('network'))
    render(<ScoresPage />)

    expect(await screen.findByText('載入分數設定時發生錯誤')).toBeInTheDocument()
  })
})
