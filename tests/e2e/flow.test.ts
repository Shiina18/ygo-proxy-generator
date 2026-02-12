/// <reference path="../../src/vite-env.d.ts" />
import { describe, it, expect } from 'vitest'
import { parseYdk, sectionDeckToCardIds } from '../../src/ydk/parseYdk'
import { generateImagePdf } from '../../src/pdf/generatePdf'
import { getRawCardImageUrl } from '../../src/api/imageApi'
import { fetchCardText } from '../../src/api/cardApi'
import { arrayBufferToBase64 } from '../../src/utils/base64'
import ydkText from '../fixtures/sample.ydk?raw'

async function fetchImageFromNetwork(
  cardId: number,
): Promise<HTMLImageElement> {
  const url = getRawCardImageUrl(cardId, 'zh')
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`获取卡图失败: ${cardId}，状态码 ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(buf)
  const dataUrl = `data:image/webp;base64,${base64}`
  const img = document.createElement('img')
  img.src = dataUrl
  return img
}

describe('e2e: YDK → PDF (real network)', () => {
  const deck = parseYdk(ydkText)
  const cardIds = sectionDeckToCardIds(deck)

  it('generates image-only PDF from YDK', async () => {
    const fetchImage = (id: number) => fetchImageFromNetwork(id)
    const { buffer } = await generateImagePdf({
      cardIds,
      fetchImage,
    })
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  }, 60000)
})
