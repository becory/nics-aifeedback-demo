import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { zhTW } from 'react-day-picker/locale'
import 'react-day-picker/style.css'

type PickerType = 'datetime-local' | 'date'

interface DateTimeInputProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'type' | 'value' | 'onChange' | 'min' | 'max'
  > {
  /** "date" picks a day only; defaults to date + time. */
  type?: PickerType
  /** "YYYY-MM-DDTHH:mm" (or "YYYY-MM-DD" with type="date"); "" = empty. */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  /** Classes for the trigger button; `className` styles the wrapper. */
  inputClassName?: string
}

const pad = (n: number) => n.toString().padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))

/** Local-time Date from a date / datetime-local string, or undefined. */
function parseValue(value: string | undefined): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return undefined
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))
}

function formatDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Date / date-time field with our own calendar popover instead of the browser's native picker,
 * which renders in the browser's locale (mm/dd/yyyy, AM/PM, …). Values stay in the native
 * input's string formats, shown as "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" regardless of locale.
 *
 * Pair two of them as a range by passing the other end as `min` / `max`: days outside the bounds
 * are disabled and a value outside them (e.g. a time on the boundary day) is clamped to the
 * nearest bound. Both formats are fixed-width, so plain string comparison orders them.
 *
 * The popover is position: fixed (so it escapes overflow-hidden parents) but stays inside this
 * component's DOM, so a parent's focus-leaves-group logic still sees focus moving into it.
 */
export function DateTimeInput({
  type = 'datetime-local',
  value,
  onChange,
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
  // autoFocus also opens the calendar, so picking a range can start right away.
  const [open, setOpen] = useState(!!autoFocus)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const selected = parseValue(value)
  const minDate = parseValue(min)
  const maxDate = parseValue(max)

  const clamp = (next: string) => {
    if (!next) return next
    if (min && next < min) return min
    if (max && next > max) return max
    return next
  }

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus()
    // Only on mount, like the native autoFocus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Place below the trigger (above when there's no room), kept inside the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const popover = popoverRef.current
      if (!trigger || !popover) return
      const { offsetWidth: w, offsetHeight: h } = popover
      const below = trigger.bottom + 4
      const top = below + h > window.innerHeight && trigger.top - 4 - h >= 0 ? trigger.top - 4 - h : below
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - w - 8))
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

  const close = () => {
    // Focus goes back to the trigger before the popover unmounts, so it's never dropped.
    triggerRef.current?.focus()
    setOpen(false)
    setPos(null)
  }

  const timeOf = (d: Date | undefined) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '00:00')

  const selectDay = (day: Date | undefined) => {
    if (!day) return
    if (dateOnly) {
      onChange(clamp(formatDay(day)))
      close()
    } else {
      onChange(clamp(`${formatDay(day)}T${timeOf(selected)}`))
    }
  }

  const setTime = (hour: string, minute: string) => {
    if (selected) onChange(clamp(`${formatDay(selected)}T${hour}:${minute}`))
  }

  const display = selected
    ? dateOnly
      ? formatDay(selected)
      : `${formatDay(selected)} ${timeOf(selected)}`
    : ''

  const [hour, minute] = timeOf(selected).split(':')
  const selectClass = 'cf-select-native w-auto! px-2! py-1!'

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onBlur={(e) => {
        if (open && !wrapperRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
          setPos(null)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          // Don't let an enclosing Modal close too.
          e.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`min-w-0 flex-1 whitespace-nowrap text-left tabular-nums ${display ? '' : 'text-[#8c8c8c]'} ${inputClassName}`}
        {...props}
      >
        {display || placeholder || (dateOnly ? '選擇日期' : '選擇日期時間')}
      </button>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            // The button unmounts once the value is empty; hand focus back to the trigger so it
            // isn't dropped (a parent's focus-leaves-group logic keeps working).
            triggerRef.current?.focus()
          }}
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#d9d9d9] bg-white text-sm leading-none text-[#595959] hover:border-[#bfbfbf] hover:bg-[#f5f5f5] hover:text-[#1d1d1d]"
          aria-label={`清除${props['aria-label'] ?? ''}`}
        >
          ×
        </button>
      )}
      {open && (
        <div
          ref={popoverRef}
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
            selected={selected}
            onSelect={selectDay}
            defaultMonth={selected ?? minDate ?? maxDate}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            autoFocus
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
              <button type="button" onClick={close} className="cf-btn-outline h-8">
                完成
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
