import { type ReactNode, useEffect, useRef } from 'react'

// Open modals, oldest first. Escape closes only the topmost one, so a modal opened from inside
// another (e.g. the .env service picker over the key list) doesn't close both.
const openStack: object[] = []

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** true = max-w-2xl, 'xl' = max-w-5xl (wide tables). */
  wide?: boolean | 'xl'
  /**
   * The body doesn't scroll; it's a flex column of the remaining height, so a child with
   * `min-h-0 flex-1 overflow-auto` (e.g. a long table) fills the modal and scrolls on its own.
   */
  fillHeight?: boolean
}

export function Modal({ open, title, onClose, children, wide, fillHeight }: ModalProps) {
  const token = useRef({})
  useEffect(() => {
    if (!open) return
    const self = token.current
    openStack.push(self)
    return () => {
      openStack.splice(openStack.indexOf(self), 1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === token.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1d1d1d]/40" onClick={onClose} />
      <div
        // The box never scrolls itself; only the body below the title does, vertically.
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden border border-[#d9d9d9] bg-white shadow-lg ${
          wide === 'xl' ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        style={{ borderRadius: 4 }}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-5 pt-6">
          <h2 className="text-base font-semibold text-[#1d1d1d]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#8c8c8c] hover:bg-[#f5f5f5] hover:text-[#1d1d1d]"
            aria-label="關閉"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-x-hidden px-6 pb-6 ${
            fillHeight ? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
