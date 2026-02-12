import { fetchCardImage, type CardLanguage } from './imageApi'
import type { CardText } from './cardApi'
import { fetchCardText } from './cardApi'

const MAX_CACHE_SIZE = 100

const imageCache = new Map<string, Promise<HTMLImageElement>>()
const textCache = new Map<number, Promise<CardText>>()

function ensureCacheCapacity<K, V>(cache: Map<K, V>) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) {
      cache.delete(firstKey)
    }
  }
}

export function cachedFetchCardImage(
  cardId: number,
  lang: CardLanguage,
): Promise<HTMLImageElement> {
  const key = `${lang}:${cardId}`
  const cached = imageCache.get(key)
  if (cached) {
    return cached
  }
  const p = fetchCardImage(cardId, lang)
  ensureCacheCapacity(imageCache)
  imageCache.set(key, p)
  return p
}

export function cachedFetchCardText(cardId: number): Promise<CardText> {
  const cached = textCache.get(cardId)
  if (cached) {
    return cached
  }
  const p = fetchCardText(cardId)
  ensureCacheCapacity(textCache)
  textCache.set(cardId, p)
  return p
}
