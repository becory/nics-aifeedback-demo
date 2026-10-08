import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="cf-page-header__title">{title}</h1>
        {description && <p className="cf-page-header__desc">{description}</p>}
      </div>
      {action}
    </div>
  )
}

interface EmptyStateProps {
  message: string
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="cf-empty">
      <p>{message}</p>
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex justify-center py-16">
      <div className="cf-spinner" />
    </div>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const variantClass =
    variant === 'secondary' ? 'cf-btn--secondary' : variant === 'danger' ? 'cf-btn--danger' : 'cf-btn--primary'
  return (
    <button type="button" className={`cf-btn ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label
  return (
    <div className="cf-field">
      <label htmlFor={inputId} className="cf-label">
        {label}
      </label>
      <input
        id={inputId}
        className={`cf-input ${error ? 'cf-input--error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-[#b42318]">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: { value: string; label: string }[]
  /** Options are still being fetched: disabled, showing 「載入中…」 and a spinner. */
  loading?: boolean
}

/** Small inline spinner for a field whose options are still loading. */
export function FieldSpinner({ className = '' }: { className?: string }) {
  return <span className={`cf-spinner cf-spinner--sm ${className}`} role="status" aria-label="載入中" />
}

export function Select({ label, error, options, loading, id, className = '', disabled, ...props }: SelectProps) {
  const selectId = id ?? label
  return (
    <div className="cf-field">
      <label htmlFor={selectId} className="cf-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={`cf-select-native ${error ? 'cf-input--error' : ''} ${className}`}
          disabled={disabled || loading}
          aria-busy={loading || undefined}
          {...props}
        >
          {loading ? (
            <option value={props.value as string | undefined}>載入中…</option>
          ) : (
            options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          )}
        </select>
        {loading && <FieldSpinner className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2" />}
      </div>
      {error && <p className="mt-1 text-xs text-[#b42318]">{error}</p>}
    </div>
  )
}

interface CheckboxGroupProps {
  label: string
  options: { value: string; label: string }[]
  values: string[]
  onChange: (values: string[]) => void
}

export function CheckboxGroup({ label, options, values, onChange }: CheckboxGroupProps) {
  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  return (
    <div className="cf-field">
      <p className="cf-label">{label}</p>
      <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-[#d9d9d9] p-3">
        {options.length === 0 ? (
          <p className="text-xs text-[#8c8c8c]">尚無可選組織</p>
        ) : (
          options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-[#1d1d1d]">
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-4 w-4 rounded border-[#d9d9d9] text-[#0055dc] focus:ring-[#0055dc]"
              />
              {opt.label}
            </label>
          ))
        )}
      </div>
    </div>
  )
}
