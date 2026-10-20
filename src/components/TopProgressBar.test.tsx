import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TopProgressBar } from './TopProgressBar'
import { attachTopProgress } from '../lib/topProgress'

vi.mock('../lib/topProgress', () => ({ attachTopProgress: vi.fn() }))

const mockedAttach = vi.mocked(attachTopProgress)

beforeEach(() => {
  mockedAttach.mockReset()
})

describe('TopProgressBar', () => {
  it('drives its own bar while mounted and detaches on unmount', () => {
    const detach = vi.fn()
    mockedAttach.mockReturnValue(detach)
    const { container, unmount } = render(<TopProgressBar />)

    const wrap = container.firstElementChild as HTMLElement
    expect(wrap).toHaveAttribute('aria-hidden')
    expect(mockedAttach).toHaveBeenCalledTimes(1)
    expect(mockedAttach).toHaveBeenCalledWith(wrap, wrap.firstElementChild)
    expect(detach).not.toHaveBeenCalled()

    unmount()
    expect(detach).toHaveBeenCalledTimes(1)
  })
})
