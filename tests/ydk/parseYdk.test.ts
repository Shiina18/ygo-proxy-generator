import { describe, it, expect } from 'vitest'
import { parseYdk, sectionDeckToCardIds } from '../../src/ydk/parseYdk'

describe('parseYdk', () => {
  it('accepts card ids with leading zeros (e.g. 03739500)', () => {
    const ydk = `#main
03739500
3739500
#extra
!side
`
    const deck = parseYdk(ydk)
    expect(deck.main).toEqual(['03739500', '3739500'])
    expect(deck.extra).toEqual([])
    expect(deck.side).toEqual([])
    const ids = sectionDeckToCardIds(deck)
    expect(ids).toEqual(['03739500', '3739500'])
  })
})
