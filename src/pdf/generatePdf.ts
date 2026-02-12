import { jsPDF } from 'jspdf'
import {
  CARD_WIDTH_MM,
  CARD_HEIGHT_MM,
  DEFAULT_SPACING_MM,
  computeCardPositions,
} from './layout'
import {
  TEXTBOX_X_RATIO,
  TEXTBOX_WIDTH_RATIO,
  TEXTBOX_Y_RATIO,
  TEXTBOX_HEIGHT_RATIO,
  TEXTBOX_Y_RATIO_MONSTER,
  TEXTBOX_HEIGHT_RATIO_MONSTER,
  PENDULUM_TEXTBOX_X_RATIO,
  PENDULUM_TEXTBOX_WIDTH_RATIO,
  PENDULUM_TEXTBOX_Y_RATIO,
  PENDULUM_TEXTBOX_HEIGHT_RATIO,
  PENDULUM_MONSTER_TEXTBOX_X_RATIO,
  PENDULUM_MONSTER_TEXTBOX_WIDTH_RATIO,
  PENDULUM_MONSTER_TEXTBOX_Y_RATIO,
  PENDULUM_MONSTER_TEXTBOX_HEIGHT_RATIO,
} from '../canvas/effectArea'
import { isMonster, isPendulum, type CardText } from '../api/cardApi'
import { runWithConcurrency } from '../utils/concurrency'
import { arrayBufferToBase64 } from '../utils/base64'

const MM_PER_POINT = 25.4 / 72
const DEFAULT_FONT_SIZE = 8
const MIN_FONT_SIZE = 4
const TEXT_HORIZONTAL_PADDING_MM = 1
const DEFAULT_CONCURRENCY = 4
const DEFAULT_MIN_DELAY_MS = 100
// jsPDF 的 text() 用 baseline 定位，首行顶需对齐效果框顶：偏移 = ascent ≈ fontSize×此估计值（常见字体约 0.8）
const ASCENT_RATIO = 0.8

let simkaiFontData: string | null = null

export function formatCardDesc(raw: string): string {
  const chars = Array.from(raw)
  for (let i = 0; i < chars.length; i += 1) {
    const code = chars[i].charCodeAt(0)
    if (code > 0x20 && code < 0x7f) {
      chars[i] = String.fromCharCode(code + 0xfee0)
    }
    if (code === 0x00b7) {
      chars[i] = '・'
    }
  }
  let desc = chars.join('')
  desc = desc.replace(/\r\n/g, '\n')
  desc = desc.replace(/（注：.*?[\n\s]+/gu, '')
  desc = desc.replace(/(?<=。)[\n\s]+(?=[①②③④⑤⑥⑦⑧⑨⑩])/gu, '')
  desc = desc.replace(/[\n\s]+(?=●)(?=.+。)/gu, '')
  return desc
}

export interface GeneratePdfOptions {
  cardIds: number[]
  fetchImage: (id: number) => Promise<HTMLImageElement | ImageBitmap>
  overlayEffects?: boolean
  fetchCardText?: (id: number) => Promise<CardText>
  sampleBgColor?: (
    img: HTMLImageElement | ImageBitmap,
    isMonster: boolean,
  ) => Promise<{ r: number; g: number; b: number }>
  onProgress?: (info: {
    done: number
    total: number
    phase: 'fetch' | 'render' | 'all'
    cardId?: number
  }) => void
  spacingMm?: number
}

export interface GeneratePdfResult {
  buffer: ArrayBuffer
  errors: Array<{ cardId: number; message: string }>
}

function getSimkaiFontUrl(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : '/'
  return base + (base.endsWith('/') ? '' : '/') + 'simkai.ttf'
}

async function ensureSimkaiFont(pdf: jsPDF): Promise<void> {
  if (!simkaiFontData) {
    const path = getSimkaiFontUrl()
    const url = new URL(path, window.location.href).href
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`simkai.ttf 加载失败: ${res.status} ${url}`)
    }
    const buf = await res.arrayBuffer()
    simkaiFontData = arrayBufferToBase64(buf)
  }
  pdf.addFileToVFS('simkai.ttf', simkaiFontData)
  pdf.addFont('simkai.ttf', 'simkai', 'normal')
}

export async function generateImagePdf(
  options: GeneratePdfOptions,
): Promise<GeneratePdfResult> {
  const {
    cardIds,
    fetchImage,
    overlayEffects = false,
    fetchCardText,
    sampleBgColor,
    onProgress,
    spacingMm = DEFAULT_SPACING_MM,
  } = options
  if (import.meta.env.DEV) {
    console.log('generatePdf 开始', {
      cardCount: cardIds.length,
      overlayEffects,
    })
  }
  const positions = computeCardPositions(cardIds.length, spacingMm)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  if (overlayEffects) {
    await ensureSimkaiFont(pdf)
  }

  type PreparedCard = {
    cardId: number
    img: HTMLImageElement | ImageBitmap | null
    cardText?: CardText
    bgColor?: { r: number; g: number; b: number }
  }

  const errors: Array<{ cardId: number; message: string }> = []
  const total = cardIds.length
  let done = 0

  const tasks = cardIds.map((id) => {
    return async (): Promise<PreparedCard> => {
      const addError = (message: string) => {
        errors.push({ cardId: id, message })
      }

      let img: HTMLImageElement | ImageBitmap | null = null
      let cardText: CardText | undefined
      let bgColor: { r: number; g: number; b: number } | undefined

      const imgResult = await fetchImage(id).catch((e) => {
        addError(e instanceof Error ? e.message : String(e))
        return null
      })
      if (!imgResult) {
        done += 1
        if (onProgress) {
          onProgress({ done, total, phase: 'fetch' })
        }
        return { cardId: id, img: null, cardText, bgColor }
      }
      img = imgResult

      if (overlayEffects && fetchCardText && sampleBgColor) {
        const text = await fetchCardText(id).catch((e) => {
          addError(e instanceof Error ? e.message : String(e))
          return null
        })
        if (text) {
          const monster = isMonster(text.types)
          const bg = await sampleBgColor(img, monster)
          cardText = text
          bgColor = bg
        }
      }

      done += 1
      if (onProgress) {
        onProgress({ done, total, phase: 'fetch' })
      }
      return { cardId: id, img, cardText, bgColor }
    }
  })

  const prepared = await runWithConcurrency(
    tasks,
    DEFAULT_CONCURRENCY,
    DEFAULT_MIN_DELAY_MS,
  )

  let currentPage = 0

  for (let i = 0; i < prepared.length; i += 1) {
    const pos = positions[i]
    if (pos.page > currentPage) {
      pdf.addPage()
      currentPage = pos.page
    }
    const item = prepared[i]
    const { img, cardText, bgColor } = item
    if (img) {
      const dataUrl = imageToDataUrl(img)
      if (dataUrl) {
        pdf.addImage(
          dataUrl,
          'JPEG',
          pos.x,
          pos.y,
          CARD_WIDTH_MM,
          CARD_HEIGHT_MM,
        )
      }
    } else {
      pdf.setFillColor(255, 255, 255)
      pdf.rect(pos.x, pos.y, CARD_WIDTH_MM, CARD_HEIGHT_MM, 'F')
    }

    if (
      overlayEffects &&
      fetchCardText &&
      sampleBgColor &&
      img &&
      cardText &&
      bgColor
    ) {
      await ensureSimkaiFont(pdf)
      const pendulum = isPendulum(cardText.types)
      const monster = isMonster(cardText.types)

      pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
      pdf.setTextColor(0, 0, 0)

      if (pendulum) {
        const { pendulum: pendulumText, monster: monsterText } =
          splitPendulumDesc(cardText.desc)

        const pendX = pos.x + PENDULUM_TEXTBOX_X_RATIO * CARD_WIDTH_MM
        const pendW = CARD_WIDTH_MM * PENDULUM_TEXTBOX_WIDTH_RATIO
        const pendY = pos.y + PENDULUM_TEXTBOX_Y_RATIO * CARD_HEIGHT_MM
        const pendH = CARD_HEIGHT_MM * PENDULUM_TEXTBOX_HEIGHT_RATIO

        const monX = pos.x + PENDULUM_MONSTER_TEXTBOX_X_RATIO * CARD_WIDTH_MM
        const monW = CARD_WIDTH_MM * PENDULUM_MONSTER_TEXTBOX_WIDTH_RATIO
        const monY = pos.y + PENDULUM_MONSTER_TEXTBOX_Y_RATIO * CARD_HEIGHT_MM
        const monH = CARD_HEIGHT_MM * PENDULUM_MONSTER_TEXTBOX_HEIGHT_RATIO

        pdf.rect(pendX, pendY, pendW, pendH, 'F')
        pdf.rect(monX, monY, monW, monH, 'F')

        if (pendulumText) {
          renderTextInRect(pdf, pendulumText, pendX, pendY, pendW, pendH)
        }
        if (monsterText) {
          renderTextInRect(pdf, monsterText, monX, monY, monW, monH)
        }
      } else {
        const textX = pos.x + TEXTBOX_X_RATIO * CARD_WIDTH_MM
        const textW = CARD_WIDTH_MM * TEXTBOX_WIDTH_RATIO
        const textY =
          pos.y +
          CARD_HEIGHT_MM * (monster ? TEXTBOX_Y_RATIO_MONSTER : TEXTBOX_Y_RATIO)
        const textH =
          CARD_HEIGHT_MM *
          (monster ? TEXTBOX_HEIGHT_RATIO_MONSTER : TEXTBOX_HEIGHT_RATIO)

        pdf.rect(textX, textY, textW, textH, 'F')
        renderTextInRect(pdf, cardText.desc, textX, textY, textW, textH)
      }
    }
  }

  if (import.meta.env.DEV) {
    console.log('generatePdf 完成', {
      cardCount: cardIds.length,
      errorCount: errors.length,
    })
  }
  return {
    buffer: pdf.output('arraybuffer'),
    errors,
  }
}

function renderTextInRect(
  pdf: jsPDF,
  rawText: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const desc = formatCardDesc(rawText)
  const maxWidthMm = w - TEXT_HORIZONTAL_PADDING_MM
  let fontSize: number = DEFAULT_FONT_SIZE
  for (;;) {
    pdf.setFontSize(fontSize)
    pdf.setFont('simkai', 'normal')
    const fontSizeMm = fontSize * MM_PER_POINT
    const lines = splitTextToLines(pdf, desc, maxWidthMm)
    if (lines.length * fontSizeMm <= h) {
      break
    }
    fontSize -= 0.25
    if (fontSize < MIN_FONT_SIZE) {
      break
    }
  }
  pdf.setFontSize(fontSize)
  pdf.setFont('simkai', 'normal')
  const fontSizeMm = fontSize * MM_PER_POINT
  const lines = splitTextToLines(pdf, desc, maxWidthMm)
  const textLeftX = x + TEXT_HORIZONTAL_PADDING_MM / 2
  const ascentMm = fontSize * MM_PER_POINT * ASCENT_RATIO
  let yy = y + ascentMm
  for (const line of lines) {
    pdf.text(line, textLeftX, yy)
    yy += fontSizeMm
  }
}

export function splitPendulumDesc(desc: string): {
  pendulum: string
  monster: string
} {
  const normalized = desc.replace(/\r\n/g, '\n')
  const pendulumMatch = normalized.match(
    /【灵摆效果】([\s\S]*?)(?=【怪兽效果】|$)/,
  )
  const monsterMatch = normalized.match(/【怪兽效果】([\s\S]*)/)
  const pendulum = (pendulumMatch?.[1] ?? '').trim()
  const monster = (monsterMatch?.[1] ?? '').trim()
  if (!pendulum && !monster) {
    return {
      pendulum: '',
      monster: normalized.trim(),
    }
  }
  return { pendulum, monster }
}

function splitTextToLines(
  pdf: jsPDF,
  text: string,
  maxWidthMm: number,
): string[] {
  const lines: string[] = []
  const segments = text.split('\n')
  const punctuation = new Set([
    '，',
    '。',
    '．',
    '、',
    '！',
    '？',
    '：',
    '；',
    ',',
    '.',
    '!',
    '?',
    ':',
    ';',
  ])
  for (const seg of segments) {
    if (!seg.trim()) {
      lines.push('')
      continue
    }
    const chars = Array.from(seg)
    let line = ''
    for (const ch of chars) {
      const next = line + ch
      const w = pdf.getTextWidth(next)
      if (w > maxWidthMm && line.length > 0) {
        if (punctuation.has(ch)) {
          line = next
          lines.push(line)
          line = ''
        } else {
          lines.push(line)
          line = ch
        }
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function imageToDataUrl(img: HTMLImageElement | ImageBitmap): string | null {
  if (
    img instanceof HTMLImageElement &&
    img.src &&
    img.src.startsWith('data:')
  ) {
    return img.src
  }
  const canvas = document.createElement('canvas')
  const w =
    img instanceof HTMLImageElement ? img.naturalWidth || img.width : img.width
  const h =
    img instanceof HTMLImageElement
      ? img.naturalHeight || img.height
      : img.height
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img as CanvasImageSource, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
