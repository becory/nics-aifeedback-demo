import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { zhTW } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { containsFocus, registerPopover } from '../lib/popoverFocus'

type PickerType = 'datetime-local' | 'date'

export interface DateTimeInputHandle {
  /** Focuses the field and opens the calendar (e.g. chaining start → end of a range). */
  open: () => void
}

interface DateTimeInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'min' | 'max'
  > {
  ref?: Ref<DateTimeInputHandle>
  /** "date" picks a day only; defaults to date + time. */
  type?: PickerType
  /** "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD" with type="date"); "" = empty. */
  value: string
  onChange: (value: string) => void
  /**
   * The user finished picking: a day clicked (date), 完成 pressed (date + time), or Enter in the
   * text field. Called after onChange with the final value. Not called when focus just leaves.
   */
  onCommit?: (value: string) => void
  min?: string
  max?: string
  /** Classes for the text field; `className` styles the wrapper. */
  inputClassName?: string
}

const pad = (n: number) => n.toString().padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))
// Year dropdown range when there's no min/max bound.
const YEARS_AROUND = 10

/** Local-time Date from a date / datetime-local string, or undefined. */
function parseValue(value: string | undefined): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return undefined
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
}

function formatDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeOf(d: Date | undefined): string {
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '00:00'
}

/**
 * Typed text → value string, "" for empty, or null when it isn't a real date. Accepts
 * 2026-10-03, 2026/10/3, 2026.10.03 and 20261003, optionally followed by a time (14:30 / 1430);
 * a missing time keeps `fallbackTime`. Date-only fields ignore any time.
 */
function parseTyped(text: string, dateOnly: boolean, fallbackTime: string): string | null {
  const t = text.trim()
  if (!t) return ''
  const m =
    t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[\sT]+(\d{1,2}):?(\d{2}))?$/) ??
    t.match(/^(\d{4})(\d{2})(\d{2})(?:[\sT]*(\d{2}):?(\d{2}))?$/)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const date = new Date(y, mo - 1, d)
  // Rejects 2026-02-30 and the like, which Date would roll over into March.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  if (dateOnly) return formatDay(date)
  if (m[4] === undefined) return `${formatDay(date)}T${fallbackTime}`
  const [h, mi] = [+m[4], +m[5]]
  if (h > 23 || mi > 59) return null
  return `${formatDay(date)}T${pad(h)}:${pad(mi)}`
}

/**
 * Date / date-time field: type it in, or pick from our own calendar popover (year/month
 * dropdowns + day grid, plus hour/minute for date-time) instead of the browser's native picker,
 * which renders in the browser's locale (mm/dd/yyyy, AM/PM, …). Values stay in the native
 * input's string formats, shown as "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" regardless of locale.
 *
 * Typed text is applied on Enter or when focus leaves; anything that isn't a real date reverts.
 *
 * Pair two of them as a range by passing the other end as `min` / `max`: days outside the bounds
 * are disabled and a value outside them is clamped to the nearest bound. Both formats are
 * fixed-width, so plain string comparison orders them.
 *
 * The popover is portalled to <body>, so a parent's focus-leaves-group check must use
 * containsFocus() rather than Element.contains() to see focus moving into it.
 */
export function DateTimeInput({
  ref,
  type = 'datetime-local',
  value,
  onChange,
  onCommit,
  min,
  max,
  placeholder,
  className = '',
  inputClassName = '',
  disabled,
  autoFocus,
  ...props
}: DateTimeInputProps) {
  const dateOnly = type === 'date'
  const selected = parseValue(value)
  const minDate = parseValue(min)
  const maxDate = parseValue(max)

  // autoFocus also opens the calendar, so picking a range can start right away.
  const [open, setOpen] = useState(!!autoFocus)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  // Text being typed; null = not editing, show the value.
  const [draft, setDraft] = useState<string | null>(null)
  // Month shown; null = follow the value (or the nearest bound), resolved at render time so it
  // sees the current props even when opened from another field's event handler.
  const [monthOverride, setMonth] = useState<Date | null>(null)
  const month = monthOverride ?? selected ?? minDate ?? maxDate ?? new Date()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const setPopover = (el: HTMLDivElement | null) => {
    popoverRef.current = el
    if (el && wrapperRef.current) registerPopover(el, wrapperRef.current)
  }

  const clamp = (next: string) => {
    if (!next) return next
    if (min && next < min) return min
    if (max && next > max) return max
    return next
  }

  const openPicker = () => {
    inputRef.current?.focus()
    if (open) return
    setMonth(null)
    setOpen(true)
  }

  useImperativeHandle(ref, () => ({ open: openPicker }))

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // Only on mount, like the native autoFocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Place below the field (above when there's no room), kept inside the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const field = inputRef.current?.getBoundingClientRect()
      const popover = popoverRef.current
      if (!field || !popover) return
      const { offsetWidth: w, offsetHeight: h } = popover
      const below = field.bottom + 4
      const top = below + h > window.innerHeight && field.top - 4 - h >= 0 ? field.top - 4 - h : below
      const left = Math.max(8, Math.min(field.left, window.innerWidth - w - 8))
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const closePicker = () => {
    setOpen(false)
    setPos(null)
  }

  /** Applies the typed text; returns the resulting value (unchanged if nothing / invalid). */
  const commitDraft = (): string => {
    if (draft === null) return value
    setDraft(null)
    const parsed = parseTyped(draft, dateOnly, timeOf(selected))
    if (parsed === null) return value
    const next = clamp(parsed)
    if (next !== value) onChange(next)
    return next
  }

  const finish = (next: string) => {
    // Focus stays on this field before the popover unmounts, so it's never dropped; onCommit
    // may then move it on (e.g. to the end of a range).
    inputRef.current?.focus()
    closePicker()
    onCommit?.(next)
  }

  const selectDay = (day: Date | undefined) => {
    if (!day) return
    setDraft(null)
    const next = clamp(dateOnly ? formatDay(day) : `${formatDay(day)}T${timeOf(selected)}`)
    onChange(next)
    if (dateOnly) finish(next)
  }

  const setTime = (hour: string, minute: string) => {
    if (selected) onChange(clamp(`${formatDay(selected)}T${hour}:${minute}`))
  }

  const display = selected ? (dateOnly ? formatDay(selected) : `${formatDay(selected)} ${timeOf(selected)}`) : ''
  const [hour, minute] = timeOf(selected).split(':')
  const selectClass = 'cf-select-native'

  // Year dropdown: ±YEARS_AROUND around today (and the selected day), cut at min/max.
  const now = new Date()
  const startMonth =
    minDate ?? new Date(Math.min(now.getFullYear(), selected?.getFullYear() ?? Infinity) - YEARS_AROUND, 0)
  const endMonth =
    maxDate ?? new Date(Math.max(now.getFullYear(), selected?.getFullYear() ?? -Infinity) + YEARS_AROUND, 11)

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onBlur={(e) => {
        if (containsFocus(wrapperRef.current, e.relatedTarget as Node | null)) return
        commitDraft()
        if (open) closePicker()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && (open || draft !== null)) {
          // Don't let an enclosing Modal close too.
          e.stopPropagation()
          setDraft(null)
          inputRef.current?.focus()
          closePicker()
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={draft ?? display}
        placeholder={placeholder ?? (dateOnly ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm')}
        size={dateOnly ? 10 : 16}
        onChange={(e) => {
          setDraft(e.target.value)
          // Follow along in the calendar once the text is a real date.
          const typed = parseValue(parseTyped(e.target.value, dateOnly, timeOf(selected)) ?? '')
          if (typed) setMonth(typed)
        }}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(commitDraft())
          } else if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            openPicker()
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`min-w-0 flex-1 tabular-nums ${inputClassName}`}
        {...props}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            setDraft(null)
            onChange('')
            // The button unmounts once the value is empty; hand focus back to the field so it
            // isn't dropped (a parent's focus-leaves-group logic keeps working).
            inputRef.current?.focus()
          }}
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#d9d9d9] bg-white text-sm leading-none text-[#595959] hover:border-[#bfbfbf] hover:bg-[#f5f5f5] hover:text-[#1d1d1d]"
          aria-label={`清除${props['aria-label'] ?? ''}`}
        >
          ×
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={setPopover}
            // Focusable so clicks on its background keep focus inside the component.
            tabIndex={-1}
            role="dialog"
            aria-label={props['aria-label']}
            className="cf-datepicker fixed z-60 rounded border border-[#d9d9d9] bg-white p-2 text-[#1d1d1d] shadow-lg outline-none"
            style={pos ?? { top: 0, left: 0, visibility: 'hidden' }}
          >
            <DayPicker
              mode="single"
              locale={zhTW}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={selectDay}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
            />
            {!dateOnly && (
              <div className="flex items-center justify-between gap-2 border-t border-[#ebebeb] px-1 pt-2">
                <span className="flex items-center gap-1 text-sm text-slate-700">
                  時間
                  <select
                    aria-label="時"
                    value={hour}
                    disabled={!selected}
                    onChange={(e) => setTime(e.target.value, minute)}
                    className={selectClass}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span>:</span>
                  <select
                    aria-label="分"
                    value={minute}
                    disabled={!selected}
                    onChange={(e) => setTime(hour, e.target.value)}
                    className={selectClass}
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </span>
                <button type="button" onClick={() => finish(value)} className="cf-btn-outline h-8">
                  完成
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  )
}
