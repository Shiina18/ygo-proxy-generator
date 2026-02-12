import { parseYdk, sectionDeckToCardIds } from './ydk/parseYdk'
import { generateImagePdf } from './pdf/generatePdf'
import { DEFAULT_SPACING_MM, computeMaxSpacingMm } from './pdf/layout'
import { cachedFetchCardImage, cachedFetchCardText } from './api/cardCache'
import { fetchIdChangelog } from './api/idChangelog'
import type { CardLanguage } from './api/imageApi'
import { normalizeCardIds } from './utils/normalizeCardId'
import { sampleEffectBackgroundColor } from './canvas/effectArea'
import appHtml from './app.html?raw'
import './style.css'

function getRequiredElement<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(selector)
  if (!el) {
    throw new Error(`缺少元素: ${selector}`)
  }
  return el
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file, 'utf-8')
  })
}

export function setupApp(root: HTMLDivElement) {
  root.innerHTML = appHtml

  const dropZone = getRequiredElement<HTMLDivElement>('#drop-zone', root)
  const fileInput = getRequiredElement<HTMLInputElement>('#file-input', root)
  const ydkText = getRequiredElement<HTMLTextAreaElement>('#ydk-text', root)
  const overlayCheckbox = getRequiredElement<HTMLInputElement>(
    '#overlay-effects',
    root,
  )
  const generateBtn = getRequiredElement<HTMLButtonElement>(
    '#generate-btn',
    root,
  )
  const messageEl = getRequiredElement<HTMLParagraphElement>('#message', root)
  const errorsEl = getRequiredElement<HTMLDivElement>('#errors', root)
  const spacingInput = getRequiredElement<HTMLInputElement>(
    '#card-spacing',
    root,
  )
  const spacingLabel = getRequiredElement<HTMLSpanElement>(
    '#card-spacing-label',
    root,
  )
  const languageRadios = root.querySelectorAll<HTMLInputElement>(
    'input[name="card-language"]',
  )
  const overlayTip = getRequiredElement<HTMLSpanElement>('#overlay-tip', root)
  const pdfPreviewEl = getRequiredElement<HTMLDivElement>('#pdf-preview', root)
  const pdfIframe = getRequiredElement<HTMLIFrameElement>('#pdf-iframe', root)
  const pdfDownloadLink = getRequiredElement<HTMLButtonElement>(
    '#pdf-download',
    root,
  )

  let currentPdfUrl: string | null = null
  let currentPdfName: string | null = null

  const maxSpacingMm = computeMaxSpacingMm()
  spacingInput.max = String(maxSpacingMm)
  spacingInput.value = String(DEFAULT_SPACING_MM)
  spacingLabel.textContent = `${DEFAULT_SPACING_MM} mm`

  let spacingMm = DEFAULT_SPACING_MM

  let currentLanguage: CardLanguage = 'zh'

  let lastFileName: string | null = null
  let isGenerating = false

  function setMessage(text: string) {
    messageEl.textContent = text
  }

  function setErrors(errors: Array<{ cardId: number; message: string }>) {
    errorsEl.hidden = false
    errorsEl.innerHTML = ''
    const title = document.createElement('p')
    title.className = 'errors-title'
    title.textContent = `以下 ${errors.length} 张卡加载失败，PDF 中已留空：`
    errorsEl.appendChild(title)
    const list = document.createElement('ul')
    list.className = 'errors-list'
    for (const { cardId, message } of errors) {
      const li = document.createElement('li')
      li.textContent = `卡号 ${cardId}: ${message}`
      list.appendChild(li)
    }
    errorsEl.appendChild(list)
  }

  function clearErrors() {
    errorsEl.hidden = true
    errorsEl.innerHTML = ''
  }

  function setGenerating(on: boolean) {
    isGenerating = on
    generateBtn.disabled = on
    generateBtn.textContent = on ? '生成中…' : '生成 PDF'
  }

  function updateOverlayAvailability() {
    if (currentLanguage === 'zh') {
      overlayCheckbox.disabled = false
      overlayCheckbox.checked = true
      overlayTip.textContent = '覆盖效果文本以保证打印文字清晰（仅中文卡图）'
      return
    }
    overlayCheckbox.checked = false
    overlayCheckbox.disabled = true
    overlayTip.textContent =
      '当前语言不支持覆盖效果文本，打印时文字可能略微模糊'
  }

  spacingInput.addEventListener('input', () => {
    spacingMm = Number(spacingInput.value)
    spacingLabel.textContent = `${spacingMm} mm`
  })

  languageRadios.forEach((radio) => {
    if (radio.checked) {
      currentLanguage = radio.value as CardLanguage
    }
    radio.addEventListener('change', () => {
      if (!radio.checked) return
      currentLanguage = radio.value as CardLanguage
      updateOverlayAvailability()
    })
  })

  updateOverlayAvailability()

  dropZone.addEventListener('click', () => fileInput.click())

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropZone.classList.add('dragover')
  })
  dropZone.addEventListener('dragleave', () =>
    dropZone.classList.remove('dragover'),
  )
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('dragover')
    const file = (e as DragEvent).dataTransfer?.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.ydk')) {
      setMessage('请拖入 .ydk 文件')
      return
    }
    lastFileName = file.name
    readFileAsText(file).then(
      (text) => {
        ydkText.value = text
        setMessage('已读取文件')
      },
      (err) => {
        setMessage(String(err instanceof Error ? err.message : err))
      },
    )
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (!file) return
    lastFileName = file.name
    readFileAsText(file).then(
      (text) => {
        ydkText.value = text
        setMessage('已读取文件')
      },
      (err) => {
        setMessage(String(err instanceof Error ? err.message : err))
      },
    )
    fileInput.value = ''
  })

  ydkText.addEventListener('input', () => {
    lastFileName = null
  })

  generateBtn.addEventListener('click', async () => {
    if (isGenerating) {
      return
    }
    const text = ydkText.value.trim()
    if (!text) {
      setMessage('请先提供 YDK 内容')
      return
    }
    setGenerating(true)
    const deck = parseYdk(text, lastFileName ?? undefined)
    const cardIds = sectionDeckToCardIds(deck)
    if (cardIds.length === 0) {
      setMessage('未解析到任何卡号')
      setGenerating(false)
      return
    }
    const idChangelog = await fetchIdChangelog()
    const normalizedIds = normalizeCardIds(cardIds, idChangelog)
    const lang = currentLanguage
    const overlayEffects = overlayCheckbox.checked && lang === 'zh'
    if (import.meta.env.DEV) {
      console.log('生成 PDF', {
        cardCount: normalizedIds.length,
        first5CardIds: normalizedIds.slice(0, 5),
        overlayEffects,
        spacingMm,
        lang,
      })
    }
    const fetchImage = (id: number) => cachedFetchCardImage(id, lang)
    let buffer: ArrayBuffer
    let errors: Array<{ cardId: number; message: string }> = []
    try {
      const result = await generateImagePdf({
        cardIds: normalizedIds,
        fetchImage,
        overlayEffects,
        fetchCardText: overlayEffects ? cachedFetchCardText : undefined,
        sampleBgColor: overlayEffects ? sampleEffectBackgroundColor : undefined,
        spacingMm,
        onProgress: ({ done, total }) => {
          const percent = total > 0 ? Math.round((done / total) * 100) : 0
          setMessage(
            overlayEffects
              ? `生成中… (${percent}%) 覆盖效果中`
              : `生成中… (${percent}%)`,
          )
        },
      })
      buffer = result.buffer
      errors = result.errors
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('generateImagePdf 失败', e)
      }
      setMessage(String(e instanceof Error ? e.message : e))
      setGenerating(false)
      return
    }
    if (errors.length > 0) {
      setErrors(errors)
    } else {
      clearErrors()
    }
    const stem = lastFileName ? lastFileName.replace(/\.ydk$/i, '') : 'proxy'
    const now = new Date()
    const ts =
      now.getFullYear() +
      '-' +
      String(now.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(now.getDate()).padStart(2, '0') +
      '-' +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0')
    const pdfName = `${stem}-${lang}-${ts}.pdf`

    if (currentPdfUrl) {
      URL.revokeObjectURL(currentPdfUrl)
      currentPdfUrl = null
    }
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    currentPdfUrl = url
    currentPdfName = pdfName
    pdfIframe.src = url
    pdfPreviewEl.hidden = false
    setMessage(`已生成 PDF (${pdfName})，可在此预览或点击下方下载`)
    setGenerating(false)
  })

  pdfDownloadLink.addEventListener('click', (e) => {
    e.preventDefault()
    if (!currentPdfUrl || !currentPdfName) return
    const a = document.createElement('a')
    a.href = currentPdfUrl
    a.download = currentPdfName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
}

const appRoot = getRequiredElement<HTMLDivElement>('#app')
setupApp(appRoot)
