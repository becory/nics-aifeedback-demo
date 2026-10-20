import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Combobox } from './Combobox'

const OPTIONS = [
  { value: 'svc-a', label: 'Alpha 服務' },
  { value: 'svc-b', label: 'Beta 服務' },
  { value: 'svc-c', label: 'Gamma 系統' },
]

function setup(props: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const onSelect = vi.fn()
  render(<Combobox options={OPTIONS} label="服務" onSelect={onSelect} {...props} />)
  const input = screen.getByRole('combobox', { name: '服務' })
  const optionLabels = () =>
    within(screen.getByRole('listbox', { name: '服務' }))
      .queryAllByRole('option')
      .map((o) => o.textContent)
  return { onSelect, input, optionLabels }
}

describe('Combobox', () => {
  it('lists every option before anything is typed, the first one active', () => {
    const { input, optionLabels } = setup()
    expect(optionLabels()).toEqual(['Alpha 服務', 'Beta 服務', 'Gamma 系統'])
    expect(input).toHaveAttribute('placeholder', '搜尋服務')
    expect(screen.getByRole('option', { name: 'Alpha 服務' })).toHaveAttribute('aria-selected', 'true')
  })

  it('narrows the list by case-insensitive substring of the label', async () => {
    const { input, optionLabels } = setup()
    await userEvent.type(input, 'BETA')
    expect(optionLabels()).toEqual(['Beta 服務'])
    await userEvent.clear(input)
    await userEvent.type(input, ' 服務 ')
    expect(optionLabels()).toEqual(['Alpha 服務', 'Beta 服務'])
  })

  it('shows a no-match message when nothing matches', async () => {
    const { input, optionLabels } = setup()
    await userEvent.type(input, 'zzz')
    expect(optionLabels()).toEqual([])
    expect(screen.getByText('沒有符合的服務')).toBeInTheDocument()
  })

  it('Enter picks the active (first) match', async () => {
    const { input, onSelect } = setup()
    await userEvent.type(input, '系統{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-c')
  })

  it('ArrowDown / ArrowUp move the active option (wrapping) and Enter picks it', async () => {
    const { input, onSelect } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Gamma 系統' })).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Gamma 系統' }).id)
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: 'Alpha 服務' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-b')
  })

  it('arrow keys move within the filtered list only', async () => {
    const { input, onSelect } = setup()
    await userEvent.type(input, '服務{ArrowUp}{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-b')
  })

  it('typing again resets the active option to the first match', async () => {
    const { input, onSelect } = setup()
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.type(input, 'a{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-a')
  })

  it('picks an option with the mouse', async () => {
    const { onSelect, input } = setup()
    await userEvent.click(input)
    await userEvent.click(screen.getByRole('option', { name: 'Beta 服務' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-b')
    // Picked on mousedown without stealing focus from the input.
    expect(input).toHaveFocus()
  })

  it('hovering an option makes it the one Enter picks', async () => {
    const { input, onSelect } = setup()
    await userEvent.click(input)
    await userEvent.hover(screen.getByRole('option', { name: 'Gamma 系統' }))
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-c')
  })

  describe('only values from the list can be chosen (regression)', () => {
    it('Enter with free text that matches nothing selects nothing and lets Enter through', async () => {
      const outerKeyDown = vi.fn()
      const onSelect = vi.fn()
      render(
        <div onKeyDown={(e) => outerKeyDown(e.key)}>
          <Combobox options={OPTIONS} label="服務" onSelect={onSelect} />
        </div>,
      )
      const input = screen.getByRole('combobox', { name: '服務' })
      await userEvent.type(input, 'not-a-service{Enter}')
      expect(onSelect).not.toHaveBeenCalled()
      expect(input).not.toHaveAttribute('aria-activedescendant')
      expect(outerKeyDown).toHaveBeenCalledWith('Enter')
    })

    it('Enter on a match is handled by the combobox and does not reach the surrounding editor', async () => {
      const outerKeyDown = vi.fn()
      const onSelect = vi.fn()
      render(
        <div onKeyDown={(e) => outerKeyDown(e.key)}>
          <Combobox options={OPTIONS} label="服務" onSelect={onSelect} />
        </div>,
      )
      await userEvent.type(screen.getByRole('combobox', { name: '服務' }), 'alp{Enter}')
      expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-a')
      expect(outerKeyDown).not.toHaveBeenCalledWith('Enter')
    })

    it('selects the option value, never the typed text', async () => {
      const { input, onSelect } = setup()
      await userEvent.type(input, 'gam{Enter}')
      expect(onSelect).toHaveBeenCalledExactlyOnceWith('svc-c')
      expect(onSelect).not.toHaveBeenCalledWith('gam')
    })
  })

  it('arrow keys do nothing when nothing matches', async () => {
    const { input, onSelect } = setup()
    await userEvent.type(input, 'zzz{ArrowDown}{ArrowUp}{Enter}')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows at most 50 matches', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ value: `v${i}`, label: `項目 ${i}` }))
    const { optionLabels } = setup({ options: many })
    expect(optionLabels()).toHaveLength(50)
  })

  it('while loading: disabled, busy, shows 載入中… and no list', () => {
    setup({ loading: true })
    const input = screen.getByRole('combobox', { name: '服務' })
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('aria-busy', 'true')
    expect(input).toHaveAttribute('placeholder', '載入中…')
    expect(screen.getByRole('status', { name: '載入中' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('uses a custom placeholder when given', () => {
    const { input } = setup({ placeholder: '輸入名稱' })
    expect(input).toHaveAttribute('placeholder', '輸入名稱')
  })
})
