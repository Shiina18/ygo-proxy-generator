const API_BASE = 'https://ygocdb.com/api/v0'

export interface CardText {
  types: string
  desc: string
}

interface CardApiResponse {
  id: number
  text?: { types?: string; desc?: string }
}

export async function fetchCardText(cardId: number): Promise<CardText> {
  const url = `${API_BASE}/card/${cardId}`
  console.log('fetchCardText', { cardId })
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`获取卡牌失败: ${cardId}，状态码 ${res.status}`)
  }
  const data: CardApiResponse = await res.json()
  const text = data.text
  const types = text?.types ?? ''
  const desc = text?.desc ?? `(未找到卡牌 ${cardId} 的效果文本)`
  return { types, desc }
}

export function isMonster(types: string): boolean {
  return types.includes('怪兽')
}

export function isPendulum(types: string): boolean {
  return types.includes('灵摆')
}
