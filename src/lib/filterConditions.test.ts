import { describe, expect, it } from 'vitest'
import { addCondition, conditionKey } from './filterConditions'

describe('addCondition', () => {
  const device = { field: 'device', value: 'iOS' }

  it('adds a condition, trimming its value', () => {
    expect(addCondition([], { field: 'device', value: '  iOS  ' })).toEqual([device])
  })

  it('ignores a blank value and returns the same array', () => {
    const list = [device]
    expect(addCondition(list, { field: 'device', value: '   ' })).toBe(list)
  })

  it('ignores an exact duplicate (after trimming) and returns the same array', () => {
    const list = [device]
    expect(addCondition(list, { field: 'device', value: ' iOS ' })).toBe(list)
  })

  it('keeps several values of the same field by default', () => {
    expect(addCondition([device], { field: 'device', value: 'Android' })).toEqual([
      device,
      { field: 'device', value: 'Android' },
    ])
  })

  it('replaces the existing condition of that field when single', () => {
    const list = [device, { field: 'source', value: 'offline' }]
    expect(addCondition(list, { field: 'device', value: 'Android' }, true)).toEqual([
      { field: 'source', value: 'offline' },
      { field: 'device', value: 'Android' },
    ])
  })
})

describe('conditionKey', () => {
  it('distinguishes field and value', () => {
    expect(conditionKey({ field: 'device', value: 'iOS' })).not.toBe(conditionKey({ field: 'source', value: 'iOS' }))
  })
})
