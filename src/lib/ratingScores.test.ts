import { describe, expect, it } from 'vitest'
import { RATING_KEYS } from './ratingScores'

describe('RATING_KEYS', () => {
  it('lists ratings in the order good, normal, bad', () => {
    expect(RATING_KEYS).toEqual(['good', 'normal', 'bad'])
  })
})
