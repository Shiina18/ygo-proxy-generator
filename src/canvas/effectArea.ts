// 效果框相对卡图比例
export const TEXTBOX_X_RATIO = 50 / 648
export const TEXTBOX_WIDTH_RATIO = 548 / 648
export const TEXTBOX_Y_RATIO = (712 + 2) / 948
export const TEXTBOX_HEIGHT_RATIO = (888 - 712) / 948
export const TEXTBOX_Y_RATIO_MONSTER = (738 + 1) / 948
export const TEXTBOX_HEIGHT_RATIO_MONSTER = (857 - 738) / 948

// 上方灵摆效果框
export const PENDULUM_TEXTBOX_X_RATIO = 105 / 680
export const PENDULUM_TEXTBOX_WIDTH_RATIO = (573 - 105) / 680
export const PENDULUM_TEXTBOX_Y_RATIO = (622 + 2) / 986
export const PENDULUM_TEXTBOX_HEIGHT_RATIO = (727 - 622) / 986

// 下方怪兽效果框
export const PENDULUM_MONSTER_TEXTBOX_X_RATIO = 51 / 680
export const PENDULUM_MONSTER_TEXTBOX_WIDTH_RATIO = (626 - 51) / 680
export const PENDULUM_MONSTER_TEXTBOX_Y_RATIO = (764 + 3) / 986
export const PENDULUM_MONSTER_TEXTBOX_HEIGHT_RATIO = (890 - 764) / 986

export function computeEffectAreaRect(
  imageWidth: number,
  imageHeight: number,
  isMonster: boolean,
): { x: number; y: number; w: number; h: number } {
  const x = Math.floor(imageWidth * TEXTBOX_X_RATIO)
  const w = Math.floor(imageWidth * TEXTBOX_WIDTH_RATIO)
  const y = Math.floor(
    imageHeight * (isMonster ? TEXTBOX_Y_RATIO_MONSTER : TEXTBOX_Y_RATIO),
  )
  const h = Math.floor(
    imageHeight *
      (isMonster ? TEXTBOX_HEIGHT_RATIO_MONSTER : TEXTBOX_HEIGHT_RATIO),
  )
  return { x, y, w, h }
}

export async function sampleEffectBackgroundColor(
  img: HTMLImageElement | ImageBitmap,
  isMonster: boolean,
): Promise<{ r: number; g: number; b: number }> {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  const rect = computeEffectAreaRect(w, h, isMonster)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('当前环境不支持 Canvas 2D')
  }
  ctx.drawImage(img as CanvasImageSource, 0, 0)
  const imageData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h)
  const data = imageData.data
  const count: Record<string, number> = {}
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`
    count[key] = (count[key] ?? 0) + 1
  }
  let maxKey = ''
  let maxCount = 0
  for (const [key, n] of Object.entries(count)) {
    if (n > maxCount) {
      maxCount = n
      maxKey = key
    }
  }
  const [r, g, b] = maxKey.split(',').map(Number)
  return { r, g, b }
}
