import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, CheckboxGroup, Input, Select } from './ui'

const ORGS = [
  { value: 'o1', label: '組織甲' },
  { value: 'o2', label: '組織乙' },
  { value: 'o3', label: '組織丙' },
]

describe('CheckboxGroup', () => {
  it('checks the boxes for the given values', () => {
    render(<CheckboxGroup label="組織" options={ORGS} values={['o2']} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: '組織甲' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '組織乙' })).toBeChecked()
  })

  it('checking a box adds its value', async () => {
    const onChange = vi.fn()
    render(<CheckboxGroup label="組織" options={ORGS} values={['o2']} onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox', { name: '組織丙' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['o2', 'o3'])
  })

  it('unchecking a box removes only its value', async () => {
    const onChange = vi.fn()
    render(<CheckboxGroup label="組織" options={ORGS} values={['o1', 'o2', 'o3']} onChange={onChange} />)
    await userEvent.click(screen.getByText('組織乙'))
    expect(onChange).toHaveBeenCalledExactlyOnceWith(['o1', 'o3'])
  })

  it('says so when there is nothing to choose', () => {
    render(<CheckboxGroup label="組織" options={[]} values={[]} onChange={vi.fn()} />)
    expect(screen.getByText('尚無可選組織')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})

describe('Input', () => {
  it('is labelled by its label and reports typing', async () => {
    const onChange = vi.fn()
    render(<Input label="名稱" value="" onChange={(e) => onChange(e.target.value)} />)
    await userEvent.type(screen.getByRole('textbox', { name: '名稱' }), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('uses an explicit id for the label association', () => {
    render(<Input label="名稱" id="name-field" />)
    expect(screen.getByRole('textbox', { name: '名稱' })).toHaveAttribute('id', 'name-field')
  })

  it('keeps two fields with the same label each tied to its own label', () => {
    render(
      <>
        <Input label="目前密碼" defaultValue="first" />
        <Input label="目前密碼" defaultValue="second" />
      </>,
    )
    const fields = screen.getAllByLabelText('目前密碼') as HTMLInputElement[]
    expect(fields.map((f) => f.value)).toEqual(['first', 'second'])
    expect(fields[0].id).not.toBe(fields[1].id)
  })

  it('shows the hint and the error', () => {
    render(<Input label="名稱" hint="最多 50 字" error="必填" />)
    expect(screen.getByText('最多 50 字')).toBeInTheDocument()
    expect(screen.getByText('必填')).toBeInTheDocument()
  })
})

describe('Select', () => {
  it('is labelled and reports the picked option', async () => {
    const onChange = vi.fn()
    render(<Select label="組織" options={ORGS} value="o1" onChange={(e) => onChange(e.target.value)} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '組織' }), 'o3')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('o3')
  })

  it('keeps two selects with the same label each tied to its own label', () => {
    render(
      <>
        <Select label="組織" options={ORGS} value="o1" onChange={vi.fn()} />
        <Select label="組織" options={ORGS} value="o3" onChange={vi.fn()} />
      </>,
    )
    expect((screen.getAllByLabelText('組織') as HTMLSelectElement[]).map((s) => s.value)).toEqual(['o1', 'o3'])
  })

  it('while loading: disabled, busy, only 載入中… and a spinner', () => {
    render(<Select label="組織" options={ORGS} value="o1" onChange={vi.fn()} loading />)
    const select = screen.getByRole('combobox', { name: '組織' })
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['載入中…'])
    expect(screen.getByRole('status', { name: '載入中' })).toBeInTheDocument()
  })

  it('shows the error', () => {
    render(<Select label="組織" options={ORGS} error="請選擇組織" />)
    expect(screen.getByText('請選擇組織')).toBeInTheDocument()
  })
})

describe('Button', () => {
  it('does not submit the surrounding form (type="button" by default)', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onClick = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Button onClick={onClick}>儲存</Button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits when given type="submit"', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">送出</Button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: '送出' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
