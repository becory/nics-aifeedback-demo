import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DateTimeInput, type DateTimeInputHandle } from './DateTimeInput'
import { Modal } from './Modal'

type Props = Omit<React.ComponentProps<typeof DateTimeInput>, 'value' | 'onChange'> & { initial?: string }

/** Controlled like the app uses it; onChange / onCommit are spies. */
function setup({ initial = '', ...props }: Props = {}) {
  const onChange = vi.fn()
  const onCommit = vi.fn()
  function Harness() {
    const [value, setValue] = useState(initial)
    return (
      <>
        <DateTimeInput
          aria-label="開始時間"
          value={value}
          onChange={(v) => {
            onChange(v)
            setValue(v)
          }}
          onCommit={onCommit}
          {...props}
        />
        <button type="button">外部</button>
      </>
    )
  }
  render(<Harness />)
  return { onChange, onCommit, input: screen.getByRole('textbox', { name: '開始時間' }) }
}

/** Day button in the calendar, e.g. day(3) → 「2026年10月3日 星期六」. */
const day = (d: number, month = 10, year = 2026) =>
  screen.getByRole('button', { name: new RegExp(`^${year}年${month}月${d}日`) })
/** Moves focus out of the whole field (past its clear button, which is part of the field). */
const leave = () => userEvent.click(screen.getByRole('button', { name: '外部' }))
const calendar = () => screen.queryByRole('dialog', { name: '開始時間' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DateTimeInput: typing', () => {
  it('shows the value as YYYY-MM-DD HH:mm', () => {
    const { input } = setup({ initial: '2026-10-05T09:15' })
    expect(input).toHaveValue('2026-10-05 09:15')
  })

  it('applies typed text when Tab moves focus away, without committing', async () => {
    const { input, onChange, onCommit } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('2026-10-03 14:30')
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-03T14:30')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input).toHaveValue('2026-10-03 14:30')
    expect(calendar()).not.toBeInTheDocument()
  })

  it('with a value, applies typed text once Tab leaves the field past its clear button', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-03 14:30')
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '外部' })).toHaveFocus()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-03T14:30')
  })

  it.each([
    ['2026/10/3 9:05', '2026-10-03T09:05'],
    ['2026.10.03T1430', '2026-10-03T14:30'],
    ['20261003 1430', '2026-10-03T14:30'],
    ['202610031430', '2026-10-03T14:30'],
  ])('accepts %s', async (typed, expected) => {
    const { input, onChange } = setup()
    await userEvent.type(input, typed)
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith(expected)
  })

  it('keeps the current time when only a date is typed', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-07')
    await leave()
    expect(onChange).toHaveBeenLastCalledWith('2026-10-07T09:15')
  })

  it('uses 00:00 when only a date is typed into an empty field', async () => {
    const { input, onChange } = setup()
    await userEvent.type(input, '2026-10-07')
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-07T00:00')
  })

  it('date-only fields ignore a typed time', async () => {
    const { input, onChange } = setup({ type: 'date' })
    expect(input).toHaveAttribute('placeholder', 'YYYY-MM-DD')
    await userEvent.type(input, '2026/1/2 10:30')
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-01-02')
    expect(input).toHaveValue('2026-01-02')
  })

  it.each(['2026-02-30', '2026-13-01', 'hello', '2026-10-03 24:00', '2026-10-03 12:60'])(
    'reverts invalid input %s to the current value',
    async (typed) => {
      const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
      await userEvent.clear(input)
      await userEvent.type(input, typed)
      await leave()
      // Clearing the text is a draft too; only the final (invalid) text is applied on Tab.
      expect(onChange).not.toHaveBeenCalled()
      expect(input).toHaveValue('2026-10-05 09:15')
    },
  )

  it('clearing the text and leaving empties the value', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.clear(input)
    await leave()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('')
  })

  it('does not report a change when the typed value equals the current one', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-05 09:15')
    await leave()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Enter applies the typed value, commits it and closes the calendar', async () => {
    const { input, onChange, onCommit } = setup()
    await userEvent.click(input)
    expect(calendar()).toBeInTheDocument()
    await userEvent.keyboard('2026-10-03 08:00{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-03T08:00')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2026-10-03T08:00')
    expect(calendar()).not.toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('clamps a typed value into min / max', async () => {
    const { input, onChange } = setup({ min: '2026-10-05T00:00', max: '2026-10-10T23:59' })
    await userEvent.type(input, '2026-10-01 10:00')
    await leave()
    expect(onChange).toHaveBeenLastCalledWith('2026-10-05T00:00')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-10-20 10:00')
    await leave()
    expect(onChange).toHaveBeenLastCalledWith('2026-10-10T23:59')
  })

  it('the clear button empties the value and keeps focus in the field', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.click(screen.getByRole('button', { name: '清除開始時間' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(screen.queryByRole('button', { name: '清除開始時間' })).not.toBeInTheDocument()
  })

  it('has no clear button when disabled', () => {
    const { input } = setup({ initial: '2026-10-05T09:15', disabled: true })
    expect(input).toBeDisabled()
    expect(screen.queryByRole('button', { name: '清除開始時間' })).not.toBeInTheDocument()
  })
})

describe('DateTimeInput: calendar', () => {
  it('opens on click, showing the month of the value with that day selected', async () => {
    const { input } = setup({ initial: '2026-08-05T09:15' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(input)
    expect(calendar()).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(day(5, 8)).toHaveAccessibleName(/已選取/)
  })

  it('opens on today’s month when empty', async () => {
    const { input } = setup()
    await userEvent.click(input)
    expect(screen.getByRole('button', { name: /2026年10月15日/ })).toBeInTheDocument()
  })

  it('ArrowDown opens the calendar', async () => {
    const { input } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    expect(calendar()).not.toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}')
    expect(calendar()).toBeInTheDocument()
  })

  it('date: picking a day applies, commits and closes', async () => {
    const { input, onChange, onCommit } = setup({ type: 'date' })
    await userEvent.click(input)
    await userEvent.click(day(3))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-03')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2026-10-03')
    expect(calendar()).not.toBeInTheDocument()
    expect(input).toHaveValue('2026-10-03')
    expect(input).toHaveFocus()
  })

  it('date + time: picking a day keeps the time and the calendar open; 完成 commits and closes', async () => {
    const { input, onChange, onCommit } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.click(input)
    await userEvent.click(day(3))
    expect(onChange).toHaveBeenLastCalledWith('2026-10-03T09:15')
    expect(onCommit).not.toHaveBeenCalled()
    expect(calendar()).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '時' }), '14')
    expect(onChange).toHaveBeenLastCalledWith('2026-10-03T14:15')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '分' }), '45')
    expect(onChange).toHaveBeenLastCalledWith('2026-10-03T14:45')

    await userEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2026-10-03T14:45')
    expect(calendar()).not.toBeInTheDocument()
    expect(input).toHaveValue('2026-10-03 14:45')
  })

  it('the time selects are disabled until a day is chosen', async () => {
    const { input } = setup()
    await userEvent.click(input)
    expect(screen.getByRole('combobox', { name: '時' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: '分' })).toBeDisabled()
  })

  it('a day picked over a typed draft replaces the draft', async () => {
    const { input, onChange } = setup({ type: 'date' })
    await userEvent.click(input)
    await userEvent.keyboard('2026-1')
    await userEvent.click(day(20))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-20')
    expect(input).toHaveValue('2026-10-20')
  })

  it('typing a real date moves the calendar to its month', async () => {
    const { input } = setup({ type: 'date' })
    await userEvent.click(input)
    await userEvent.keyboard('2025-03-09')
    expect(day(9, 3, 2025)).toBeInTheDocument()
  })

  it('days outside min / max are disabled', async () => {
    const { input } = setup({ type: 'date', min: '2026-10-05', max: '2026-10-10' })
    await userEvent.click(input)
    expect(day(4)).toBeDisabled()
    expect(day(5)).toBeEnabled()
    expect(day(10)).toBeEnabled()
    expect(day(11)).toBeDisabled()
  })

  it('opens on the bound’s month when empty and today is out of range', async () => {
    const { input } = setup({ type: 'date', min: '2027-02-10' })
    await userEvent.click(input)
    expect(day(10, 2, 2027)).toBeEnabled()
  })

  it('clicking inside the calendar keeps it open and does not apply the draft', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.click(input)
    await userEvent.clear(input)
    await userEvent.keyboard('2026-10-07')
    await userEvent.click(screen.getByRole('combobox', { name: '時' }))
    expect(calendar()).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('focus leaving the field closes the calendar and applies the draft', async () => {
    const { input, onChange } = setup({ type: 'date' })
    await userEvent.click(input)
    await userEvent.keyboard('2026-10-07')
    await userEvent.click(screen.getByRole('button', { name: '外部' }))
    expect(calendar()).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2026-10-07')
  })

  it('open() through the ref focuses the field and opens the calendar', () => {
    const ref = createRef<DateTimeInputHandle>()
    render(<DateTimeInput ref={ref} aria-label="結束時間" value="" onChange={vi.fn()} />)
    act(() => ref.current?.open())
    expect(screen.getByRole('textbox', { name: '結束時間' })).toHaveFocus()
    expect(screen.getByRole('dialog', { name: '結束時間' })).toBeInTheDocument()
  })

  it('autoFocus focuses the field and opens the calendar', () => {
    const { input } = setup({ autoFocus: true })
    expect(input).toHaveFocus()
    expect(calendar()).toBeInTheDocument()
  })
})

describe('DateTimeInput: Esc', () => {
  it('closes the calendar and keeps focus in the field', async () => {
    const { input, onChange } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    expect(calendar()).not.toBeInTheDocument()
    expect(input).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the calendar when pressed inside it', async () => {
    const { input } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.click(input)
    within(calendar() as HTMLElement)
      .getByRole('combobox', { name: '時' })
      .focus()
    await userEvent.keyboard('{Escape}')
    expect(calendar()).not.toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('discards a typed draft', async () => {
    const { input, onChange } = setup({ initial: '2026-10-05T09:15' })
    await userEvent.click(input)
    await userEvent.clear(input)
    await userEvent.keyboard('2026-10-07{Escape}')
    expect(input).toHaveValue('2026-10-05 09:15')
    await leave()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('inside a Modal closes only the calendar; the next Esc closes the Modal', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="編輯" onClose={onClose}>
        <DateTimeInput aria-label="到期時間" value="" onChange={vi.fn()} />
      </Modal>,
    )
    const input = screen.getByRole('textbox', { name: '到期時間' })
    await userEvent.click(input)
    expect(screen.getByRole('dialog', { name: '到期時間' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '到期時間' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('inside a Modal, Esc on a typed draft (calendar closed) only discards the draft', async () => {
    const onClose = vi.fn()
    render(
      <Modal open title="編輯" onClose={onClose}>
        <DateTimeInput aria-label="到期時間" value="" onChange={vi.fn()} />
      </Modal>,
    )
    const input = screen.getByRole('textbox', { name: '到期時間' })
    await userEvent.click(input)
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('2026{Escape}')
    expect(input).toHaveValue('')
    expect(onClose).not.toHaveBeenCalled()
  })
})
