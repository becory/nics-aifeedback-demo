import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} title="標題" onClose={vi.fn()}>
        內容
      </Modal>,
    )
    expect(screen.queryByText('內容')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '標題' })).not.toBeInTheDocument()
  })

  it('shows the title and body while open', () => {
    render(
      <Modal open title="標題" onClose={vi.fn()}>
        內容
      </Modal>,
    )
    expect(screen.getByRole('heading', { name: '標題' })).toBeInTheDocument()
    expect(screen.getByText('內容')).toBeInTheDocument()
  })

  it('closes on Esc', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    await userEvent.keyboard('{Enter}a')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes with the 關閉 button', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: '關閉' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked, but not when the box content is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    await userEvent.click(screen.getByText('內容'))
    expect(onClose).not.toHaveBeenCalled()

    // The backdrop is aria-hidden and has no role or text: the only way to reach it.
    const backdrop = document.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
    await userEvent.click(backdrop as Element)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stops listening for Esc once closed', async () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    rerender(
      <Modal open={false} title="標題" onClose={onClose}>
        內容
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('nested modals', () => {
    /** Outer modal with a button that opens an inner one, the way the app nests them. */
    function Nested({ onOuterClose, onInnerClose }: { onOuterClose: () => void; onInnerClose: () => void }) {
      const [outer, setOuter] = useState(true)
      const [inner, setInner] = useState(false)
      return (
        <>
          <Modal
            open={outer}
            title="外層"
            onClose={() => {
              onOuterClose()
              setOuter(false)
            }}
          >
            <button type="button" onClick={() => setInner(true)}>
              開啟內層
            </button>
          </Modal>
          <Modal
            open={inner}
            title="內層"
            onClose={() => {
              onInnerClose()
              setInner(false)
            }}
          >
            內層內容
          </Modal>
        </>
      )
    }

    it('Esc closes only the topmost modal, then the next one', async () => {
      const onOuterClose = vi.fn()
      const onInnerClose = vi.fn()
      render(<Nested onOuterClose={onOuterClose} onInnerClose={onInnerClose} />)
      await userEvent.click(screen.getByRole('button', { name: '開啟內層' }))
      expect(screen.getByRole('heading', { name: '內層' })).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(onInnerClose).toHaveBeenCalledTimes(1)
      expect(onOuterClose).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: '內層' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '外層' })).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(onOuterClose).toHaveBeenCalledTimes(1)
      expect(onInnerClose).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('heading', { name: '外層' })).not.toBeInTheDocument()
    })

    it('Esc closes the most recently opened modal even when it is rendered inside the outer one', async () => {
      const onOuterClose = vi.fn()
      const onInnerClose = vi.fn()
      function Inside() {
        const [inner, setInner] = useState(false)
        return (
          <Modal open title="外層" onClose={onOuterClose}>
            <button type="button" onClick={() => setInner(true)}>
              開啟內層
            </button>
            <Modal open={inner} title="內層" onClose={onInnerClose}>
              內層內容
            </Modal>
          </Modal>
        )
      }
      render(<Inside />)
      await userEvent.click(screen.getByRole('button', { name: '開啟內層' }))
      await userEvent.keyboard('{Escape}')
      expect(onInnerClose).toHaveBeenCalledTimes(1)
      expect(onOuterClose).not.toHaveBeenCalled()
    })
  })
})
