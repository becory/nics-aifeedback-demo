import type { ReactNode } from 'react'

export function AuthLayout({
  title,
  description,
  wide,
  children,
}: {
  title: string
  description?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className="cf-auth">
      <div className={`cf-auth__wrap${wide ? ' cf-auth__wrap--wide' : ''}`}>
        <div className="cf-auth__brand">
          <div className="cf-auth__logo" aria-hidden>
            AI
          </div>
          <h1 className="cf-auth__title">{title}</h1>
          {description && <p className="cf-auth__desc">{description}</p>}
        </div>
        <div className="cf-form-card">{children}</div>
      </div>
    </div>
  )
}
