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

  it('generates PDF with overlay effects from YDK', async () => {
    const overlayCardIds = cardIds.slice(0, 3)
    const fetchImage = (id: number) => fetchImageFromNetwork(id)
    const { buffer } = await generateImagePdf({
      cardIds: overlayCardIds,
      fetchImage,
      overlayEffects: true,
      fetchCardText,
      // In tests we do not sample background color via Canvas,
      // because jsdom does not implement canvas rendering APIs.
      sampleBgColor: async () => ({ r: 240, g: 230, b: 220 }),
    })
    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  }, 60000)
})
