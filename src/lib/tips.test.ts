import { describe, expect, it } from 'vitest'
import { WEIGHT_GAIN_TIPS, pickTip } from './tips.ts'

describe('pickTip', () => {
  it('maps the random range onto the whole list', () => {
    expect(pickTip(() => 0)).toBe(WEIGHT_GAIN_TIPS[0])
    expect(pickTip(() => 0.999999)).toBe(WEIGHT_GAIN_TIPS[WEIGHT_GAIN_TIPS.length - 1])
  })

  it('always returns a tip from the list', () => {
    for (let i = 0; i < 100; i++) expect(WEIGHT_GAIN_TIPS).toContain(pickTip())
  })
})

describe('WEIGHT_GAIN_TIPS', () => {
  it('has plenty of tips, all short and unique', () => {
    expect(WEIGHT_GAIN_TIPS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(WEIGHT_GAIN_TIPS).size).toBe(WEIGHT_GAIN_TIPS.length)
    for (const tip of WEIGHT_GAIN_TIPS) expect(tip.length).toBeLessThanOrEqual(40)
  })
})
