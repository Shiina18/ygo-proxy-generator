export type CardLanguage = 'zh' | 'sc' | 'jp' | 'en'

const RAW_CARD_IMAGE_TEMPLATE_BY_LANG: Record<CardLanguage, string> = {
  zh: 'https://cdn.233.momobako.com/ygoimg/ygopro/cardid.webp',
  sc: 'https://cdn.233.momobako.com/ygoimg/sc/cardid.webp',
  jp: 'https://cdn.233.momobako.com/ygoimg/jp/cardid.webp',
  en: 'https://cdn.233.momobako.com/ygoimg/en/cardid.webp',
}

// 通过公共代理服务为卡图添加 CORS 头
const IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url='

/**
 * 卡图 CDN（233）文件名无前导零，例如 3739500.webp 而非 03739500.webp。
 * 此处仅对 URL 路径做去前导零，卡号在应用内仍为原字符串。
 */
export function getRawCardImageUrl(
  cardId: string,
  lang: CardLanguage = 'zh',
): string {
  const template = RAW_CARD_IMAGE_TEMPLATE_BY_LANG[lang]
  const pathId = cardId.replace(/^0+/, '') || '0'
  return template.replace('cardid', pathId)
}

export function getCardImageUrl(
  cardId: string,
  lang: CardLanguage = 'zh',
): string {
  return `${IMAGE_PROXY_BASE}${encodeURIComponent(getRawCardImageUrl(cardId, lang))}`
}

export function fetchCardImage(
  cardId: string,
  lang: CardLanguage = 'zh',
): Promise<HTMLImageElement> {
  const url = getCardImageUrl(cardId, lang)
  console.log('fetchCardImage', { cardId, lang, url })

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      img
        .decode()
        .then(() => resolve(img))
        .catch(() => resolve(img))
    }
    img.onerror = (e: Event | string) => {
      const ev = typeof e === 'string' ? null : e
      const type = ev?.type ?? 'error'
      console.error('卡图加载失败', { cardId, lang, type })
      reject(new Error(`加载卡图失败: ${cardId}`))
    }
    img.src = url
  })
}
