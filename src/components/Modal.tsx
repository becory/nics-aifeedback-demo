import { type ReactNode, useEffect } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1d1d1d]/40" onClick={onClose} />
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto border border-[#d9d9d9] bg-white p-6 shadow-lg ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        style={{ borderRadius: 4 }}
      >
        <div className="mb-5 flex items-center justify-between">
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
        {children}
      </div>
    </div>
  )
}
