import { type ReactNode, useEffect, useId, useRef } from 'react'

// Open modals, bottom first. Escape closes only the topmost one, so a modal opened from inside
// another (e.g. the .env service picker over the key list) doesn't close both.
const openStack: HTMLElement[] = []

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
  const boxRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open || !boxRef.current) return
    const self = boxRef.current
    // A child's effect runs before its parent's, so when an outer and an inner modal open in the
    // same render the inner one is already here: go below any modal rendered inside this one.
    const firstInside = openStack.findIndex((el) => self.contains(el))
    openStack.splice(firstInside < 0 ? openStack.length : firstInside, 0, self)
    return () => {
      openStack.splice(openStack.indexOf(self), 1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openStack[openStack.length - 1] === boxRef.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Purely visual: clicking it is a mouse shortcut for 關閉 / Esc, so screen readers skip it. */}
      <div className="absolute inset-0 bg-[#1d1d1d]/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // The box never scrolls itself; only the body below the title does, vertically.
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden border border-[#d9d9d9] bg-white shadow-lg ${
          wide === 'xl' ? 'max-w-5xl' : wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        style={{ borderRadius: 4 }}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-5 pt-6">
          <h2 id={titleId} className="text-base font-semibold text-[#1d1d1d]">{title}</h2>
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
