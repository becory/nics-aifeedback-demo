import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterBar, type FilterBarValue, type FilterFieldGroup } from './FilterBar'

type Preset = '7d' | '30d' | 'custom'
type Field = 'keyword' | 'rating' | 'service'
type Value = FilterBarValue<Preset, Field>

const PRESETS: { key: Preset; label: string }[] = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'custom', label: '自訂' },
]

const RATING_OPTIONS = [
  { value: 'good', label: '好' },
  { value: 'normal', label: '普通' },
  { value: 'bad', label: '差' },
]

const SERVICE_OPTIONS = [
  { value: 'svc-a', label: 'Alpha 服務' },
  { value: 'svc-b', label: 'Beta 服務' },
]

function fieldGroups({ ratingLoading = false } = {}): FilterFieldGroup<Field>[] {
  return [
    { label: '內容', fields: [{ value: 'keyword', label: '關鍵字' }] },
    {
      label: '屬性',
      fields: [
        { value: 'rating', label: '評價', options: RATING_OPTIONS, single: true, loading: ratingLoading },
        { value: 'service', label: '服務', options: SERVICE_OPTIONS, searchable: true },
      ],
    },
  ]
}

const EMPTY: Value = { time: { preset: '7d', customFrom: '', customTo: '' }, conditions: [] }

interface SetupOptions {
  initial?: Value
  dateOnly?: boolean
  fieldPlaceholder?: string
  ratingLoading?: boolean
}

/** Controlled the way the pages use it: every onChange becomes the next value. */
function setup({ initial = EMPTY, dateOnly, fieldPlaceholder, ratingLoading }: SetupOptions = {}) {
  const onChange = vi.fn<(next: Value) => void>()
  function Harness() {
    const [value, setValue] = useState(initial)
    return (
      <>
        <FilterBar
          value={value}
          onChange={(next) => {
            onChange(next)
            setValue(next)
          }}
          presets={PRESETS}
          customKey="custom"
          fieldGroups={fieldGroups({ ratingLoading })}
          fieldPlaceholder={fieldPlaceholder}
          dateOnly={dateOnly}
          extra={<button type="button">匯出</button>}
        />
        <button type="button">外部</button>
      </>
    )
  }
  render(<Harness />)
  return { onChange }
}

const addButton = () => screen.queryByRole('button', { name: '＋新增' })
const openEditor = () => userEvent.click(addButton() as HTMLElement)
const fieldSelect = () => screen.getByRole('combobox', { name: '篩選欄位' })
const outside = () => userEvent.click(screen.getByRole('button', { name: '外部' }))
const lastValue = (onChange: ReturnType<typeof setup>['onChange']) => onChange.mock.lastCall?.[0]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('FilterBar: time presets', () => {
  it('marks the active preset as pressed', () => {
    setup()
    expect(screen.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '近 30 天' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('picking a preset reports it, keeping the conditions', async () => {
    const conditions = [{ field: 'keyword' as const, value: 'foo' }]
    const { onChange } = setup({ initial: { ...EMPTY, conditions } })
    await userEvent.click(screen.getByRole('button', { name: '近 30 天' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: '30d', customFrom: '', customTo: '' },
      conditions,
    })
    expect(screen.getByRole('button', { name: '近 30 天' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('FilterBar: adding a condition', () => {
  it('＋新增 opens the editor on the first field with the value focused', async () => {
    setup()
    await openEditor()
    expect(addButton()).not.toBeInTheDocument()
    expect(fieldSelect()).toHaveValue('keyword')
    expect(screen.getByRole('textbox', { name: '關鍵字' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: '關鍵字' })).toHaveAttribute('placeholder', '搜尋關鍵字')
  })

  it('Enter submits the condition (trimmed) and closes the editor', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('  退款  {Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [{ field: 'keyword', value: '退款' }] })
    expect(addButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除 關鍵字 篩選' })).toBeInTheDocument()
    expect(screen.getByText('退款')).toBeInTheDocument()
  })

  it('Esc cancels without reporting anything', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('退款{Escape}')
    expect(addButton()).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '關鍵字' })).not.toBeInTheDocument()
    await outside()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reopening after Esc starts over on the first field with an empty value', async () => {
    setup()
    await openEditor()
    await userEvent.selectOptions(fieldSelect(), 'rating')
    await userEvent.keyboard('{Escape}')
    await openEditor()
    expect(fieldSelect()).toHaveValue('keyword')
    expect(screen.getByRole('textbox', { name: '關鍵字' })).toHaveValue('')
  })

  it('focus leaving the editor submits', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('退款')
    await outside()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [{ field: 'keyword', value: '退款' }] })
    expect(addButton()).toBeInTheDocument()
  })

  it('moving focus between the field and value halves does not submit', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('退款')
    await userEvent.click(fieldSelect())
    await userEvent.click(screen.getByRole('textbox', { name: '關鍵字' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(addButton()).not.toBeInTheDocument()
  })

  it('a blank value adds nothing', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('   {Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(addButton()).toBeInTheDocument()
  })

  it('a duplicate condition adds nothing', async () => {
    const { onChange } = setup({ initial: { ...EMPTY, conditions: [{ field: 'keyword', value: '退款' }] } })
    await openEditor()
    await userEvent.keyboard('退款{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: '移除 關鍵字 篩選' })).toHaveLength(1)
  })

  it('a dropdown field adds the picked option value and shows its label', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.selectOptions(fieldSelect(), 'rating')
    const ratingSelect = screen.getByRole('combobox', { name: '評價' })
    expect(ratingSelect).toHaveFocus()
    await userEvent.selectOptions(ratingSelect, 'bad')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [{ field: 'rating', value: 'bad' }] })
    expect(screen.getByText('差')).toBeInTheDocument()
  })

  it('changing the field drops the value typed for the previous one', async () => {
    const { onChange } = setup()
    await openEditor()
    await userEvent.keyboard('退款')
    await userEvent.selectOptions(fieldSelect(), 'rating')
    await userEvent.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a single-valued field replaces its existing condition', async () => {
    const { onChange } = setup({
      initial: {
        ...EMPTY,
        conditions: [
          { field: 'rating', value: 'good' },
          { field: 'keyword', value: '退款' },
        ],
      },
    })
    await openEditor()
    await userEvent.selectOptions(fieldSelect(), 'rating')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '評價' }), 'normal')
    await userEvent.keyboard('{Enter}')
    expect(lastValue(onChange)?.conditions).toEqual([
      { field: 'keyword', value: '退款' },
      { field: 'rating', value: 'normal' },
    ])
  })

  it('a dropdown field whose options are loading is disabled and says 載入中…', async () => {
    setup({ ratingLoading: true })
    await openEditor()
    await userEvent.selectOptions(fieldSelect(), 'rating')
    const ratingSelect = screen.getByRole('combobox', { name: '評價' })
    expect(ratingSelect).toBeDisabled()
    expect(ratingSelect).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('option', { name: '載入中…' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '差' })).not.toBeInTheDocument()
  })

  it('with a field placeholder picked, the value is disabled and nothing is added', async () => {
    const { onChange } = setup({ fieldPlaceholder: '選擇欄位' })
    await openEditor()
    await userEvent.selectOptions(fieldSelect(), '')
    const value = screen.getByRole('textbox', { name: '關鍵字' })
    expect(value).toBeDisabled()
    expect(value).toHaveAttribute('placeholder', '先選擇欄位')
    fieldSelect().focus()
    await userEvent.keyboard('{Enter}')
    expect(onChange).not.toHaveBeenCalled()
    expect(addButton()).toBeInTheDocument()
  })

  describe('searchable field (Combobox)', () => {
    const openService = async () => {
      await openEditor()
      await userEvent.selectOptions(fieldSelect(), 'service')
      const input = screen.getByRole('combobox', { name: '服務' })
      expect(input).toHaveFocus()
      return input
    }

    it('typing filters and Enter adds the matching option value', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.keyboard('beta{Enter}')
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [{ field: 'service', value: 'svc-b' }] })
      expect(screen.getByText('Beta 服務')).toBeInTheDocument()
      expect(addButton()).toBeInTheDocument()
    })

    it('arrow keys + Enter add the highlighted option', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.keyboard('{ArrowDown}{Enter}')
      expect(lastValue(onChange)?.conditions).toEqual([{ field: 'service', value: 'svc-b' }])
    })

    it('clicking an option adds it', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.click(screen.getByRole('option', { name: 'Alpha 服務' }))
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [{ field: 'service', value: 'svc-a' }] })
    })

    it('regression: Enter on free text not in the list adds nothing', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.keyboard('不存在的服務{Enter}')
      expect(onChange).not.toHaveBeenCalled()
    })

    it('regression: leaving with free text not in the list adds nothing', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.keyboard('Alpha')
      await outside()
      expect(onChange).not.toHaveBeenCalled()
      expect(addButton()).toBeInTheDocument()
    })

    it('Esc closes the list and the editor', async () => {
      const { onChange } = setup()
      await openService()
      await userEvent.keyboard('alp{Escape}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(addButton()).toBeInTheDocument()
      expect(onChange).not.toHaveBeenCalled()
    })
  })
})

describe('FilterBar: chips', () => {
  const conditions = [
    { field: 'keyword' as const, value: '退款' },
    { field: 'rating' as const, value: 'bad' },
  ]

  it('shows each condition with its field label and option label', () => {
    setup({ initial: { ...EMPTY, conditions } })
    expect(screen.getByText('退款')).toBeInTheDocument()
    expect(screen.getByText('差')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除 關鍵字 篩選' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移除 評價 篩選' })).toBeInTheDocument()
  })

  it('× removes just that condition', async () => {
    const { onChange } = setup({ initial: { ...EMPTY, conditions } })
    await userEvent.click(screen.getByRole('button', { name: '移除 評價 篩選' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [conditions[0]] })
    expect(screen.queryByText('差')).not.toBeInTheDocument()
  })

  it('清除 removes all conditions and then hides itself', async () => {
    const { onChange } = setup({ initial: { ...EMPTY, conditions } })
    await userEvent.click(screen.getByRole('button', { name: '× 清除' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ time: EMPTY.time, conditions: [] })
    expect(screen.queryByRole('button', { name: '× 清除' })).not.toBeInTheDocument()
  })

  it('has no 清除 without conditions, and shows the extra control', () => {
    setup()
    expect(screen.queryByRole('button', { name: '× 清除' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '匯出' })).toBeInTheDocument()
  })
})

describe('FilterBar: custom range', () => {
  const start = () => screen.getByRole('textbox', { name: '開始時間' })
  const end = () => screen.getByRole('textbox', { name: '結束時間' })

  it('自訂 opens the start field (focused, calendar open) without reporting anything yet', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    expect(start()).toHaveFocus()
    expect(screen.getByRole('dialog', { name: '開始時間' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '近 7 天' })).toHaveAttribute('aria-pressed', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies the range once focus leaves the group, not when moving from start to end', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await userEvent.keyboard('2026-10-01 08:00')
    await userEvent.click(end())
    await userEvent.keyboard('2026-10-05 18:30')
    expect(onChange).not.toHaveBeenCalled()
    await outside()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-05T18:30' },
      conditions: [],
    })
  })

  it('Tab from start to end does not apply; Tab out of the group does', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await userEvent.keyboard('2026-10-01 08:00')
    await userEvent.tab()
    expect(end()).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.keyboard('2026-10-05 18:30')
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-05T18:30' },
      conditions: [],
    })
  })

  it('an empty end means up to now', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await userEvent.keyboard('2026-10-01 08:00')
    await outside()
    expect(lastValue(onChange)?.time).toEqual({ preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '' })
  })

  it('leaving without a start flags the start field and reports nothing', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await outside()
    expect(onChange).not.toHaveBeenCalled()
    expect(start()).toHaveAttribute('aria-invalid', 'true')
    expect(start()).toHaveAccessibleDescription('請設定起始時間')
  })

  it('a typed start later than the end is clamped to the end', async () => {
    const { onChange } = setup({
      initial: { ...EMPTY, time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-05T18:00' } },
    })
    await userEvent.clear(start())
    await userEvent.keyboard('2026-10-09 08:00')
    await outside()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-05T18:00', customTo: '2026-10-05T18:00' },
      conditions: [],
    })
  })

  it('reports the 起始不可晚於結束 problem for an inverted stored range and keeps the current range', async () => {
    // A range can only become inverted from outside (e.g. the URL); the fields themselves clamp.
    const { onChange } = setup({
      initial: { ...EMPTY, time: { preset: 'custom', customFrom: '2026-10-09T00:00', customTo: '2026-10-02T00:00' } },
    })
    expect(start()).toHaveFocus()
    await outside()
    expect(onChange).not.toHaveBeenCalled()
    expect(start()).toHaveAccessibleDescription('起始時間不可晚於結束時間')
    // Editing the end clears that hint.
    await userEvent.click(screen.getByRole('button', { name: '清除結束時間' }))
    expect(start()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('typing a start again clears the 請設定起始 hint', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await outside()
    expect(start()).toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(start())
    await userEvent.keyboard('2026-10-01')
    await userEvent.tab()
    expect(start()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('date-only: picking the start day moves on to the end calendar; picking the end day applies', async () => {
    const { onChange } = setup({ dateOnly: true })
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    expect(screen.getByRole('textbox', { name: '開始日期' })).toHaveAttribute('placeholder', 'YYYY-MM-DD')
    await userEvent.click(screen.getByRole('button', { name: /^2026年10月3日/ }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: '結束日期' })).toHaveFocus()
    expect(screen.getByRole('dialog', { name: '結束日期' })).toBeInTheDocument()
    // Days before the start are disabled at the end.
    expect(screen.getByRole('button', { name: /^2026年10月2日/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^2026年10月9日/ }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-03', customTo: '2026-10-09' },
      conditions: [],
    })
  })

  it('date-only: picking a start while an end is set applies right away', async () => {
    const { onChange } = setup({
      dateOnly: true,
      initial: { ...EMPTY, time: { preset: 'custom', customFrom: '2026-10-05', customTo: '2026-10-09' } },
    })
    await userEvent.click(screen.getByRole('button', { name: /^2026年10月2日/ }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-02', customTo: '2026-10-09' },
      conditions: [],
    })
  })

  it('Enter in the end field applies the range', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    await userEvent.keyboard('2026-10-01 08:00')
    await userEvent.click(end())
    await userEvent.keyboard('2026-10-02 08:00{Enter}')
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '2026-10-02T08:00' },
      conditions: [],
    })
  })

  it('自訂 with a remembered start applies it immediately', async () => {
    const { onChange } = setup({
      initial: { ...EMPTY, time: { preset: '7d', customFrom: '2026-10-01T08:00', customTo: '' } },
    })
    await userEvent.click(screen.getByRole('button', { name: '自訂' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '' },
      conditions: [],
    })
  })

  it('picking another preset closes the custom range and reports that preset', async () => {
    const { onChange } = setup({
      initial: { ...EMPTY, time: { preset: 'custom', customFrom: '2026-10-01T08:00', customTo: '' } },
    })
    await userEvent.click(screen.getByRole('button', { name: '近 30 天' }))
    expect(lastValue(onChange)?.time).toEqual({ preset: '30d', customFrom: '2026-10-01T08:00', customTo: '' })
    expect(screen.queryByRole('textbox', { name: '開始時間' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '自訂' })).toHaveAttribute('aria-pressed', 'false')
  })
})
