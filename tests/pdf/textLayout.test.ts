import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { CARD_WIDTH_MM, CARD_HEIGHT_MM } from '../../src/pdf/layout'
import {
  TEXTBOX_WIDTH_RATIO,
  TEXTBOX_HEIGHT_RATIO_MONSTER,
} from '../../src/canvas/effectArea'
import {
  formatCardDesc,
  layoutTextWithConstraints,
} from '../../src/pdf/generatePdf'

const MAX_WIDTH_MM = 40
const MAX_HEIGHT_MM = 60

const MONSTER_BOX_WIDTH_MM = CARD_WIDTH_MM * TEXTBOX_WIDTH_RATIO
const MONSTER_BOX_HEIGHT_MM = CARD_HEIGHT_MM * TEXTBOX_HEIGHT_RATIO_MONSTER

const BULLET_REGEX = /[①-⑩●]\s*$/u
const BULLET_COLON_REGEX = /(?:[①-⑩●][：:])\s*$/u

const PUNCTUATION = new Set([
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

function assertLinesWidth(pdf: jsPDF, lines: string[], maxWidth: number): void {
  for (const line of lines) {
    const w = pdf.getTextWidth(line)
    expect(w).toBeLessThanOrEqual(maxWidth + 0.1)
  }
}

function assertBulletAndPunctuationRules(lines: string[]): void {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    // 列表符号不能在行末（单独或跟着冒号）
    expect(BULLET_REGEX.test(line)).toBe(false)
    expect(BULLET_COLON_REGEX.test(line)).toBe(false)

    if (i === 0) continue
    // 普通标点不能在行首（列表符号允许）
    let idx = 0
    while (idx < line.length && /\s/u.test(line.charAt(idx))) {
      idx += 1
    }
    if (idx >= line.length) continue
    const ch = line.charAt(idx)
    if ('●①②③④⑤⑥⑦⑧⑨⑩'.includes(ch)) {
      continue
    }
    expect(PUNCTUATION.has(ch)).toBe(false)
  }
}

describe('text layout constraints', () => {
  it('keeps bullets away from line end and punctuation away from line start', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw = `
①：这是第一条效果，用来测试行尾的 ① 不会单独挂在行末。
这行是接着①的描述，用来制造较长的一段文本，迫使其在框内发生换行。
②：这是第二条效果，同样包含较长的描述文本，用来测试多次换行的情况。
●这是一个使用 ● bullet 的条目，用来验证 bullet 不会出现在行末。
攻击力 1500 以下的灵摆怪兽可以被加入手卡。
`
    const { lines } = layoutTextWithConstraints(
      pdf,
      raw,
      MAX_WIDTH_MM,
      MAX_HEIGHT_MM,
    )

    expect(lines.length).toBeGreaterThan(1)
    assertLinesWidth(pdf, lines, MAX_WIDTH_MM)
    assertBulletAndPunctuationRules(lines)
  })

  it('works for simple non-list descriptions without breaking layout', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw =
      '以高攻击力著称的传说之龙。任何对手都能粉碎，其破坏力不可估量。这是一段连续的描述文本，用来验证在没有列表符号和特殊标点规则影响时的换行行为。'

    const desc = formatCardDesc(raw)
    const { lines } = layoutTextWithConstraints(
      pdf,
      desc,
      MAX_WIDTH_MM,
      MAX_HEIGHT_MM,
    )

    expect(lines.length).toBeGreaterThan(0)
    assertLinesWidth(pdf, lines, MAX_WIDTH_MM)
    assertBulletAndPunctuationRules(lines)
  })

  it('lays out Five-Headed Dragon (99267150) within monster textbox', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw =
      '龙族怪兽×5\r\n这张卡不用融合召唤不能特殊召唤。\r\n①：这张卡不会被和暗·地·水·炎·风属性怪兽的战斗破坏。'
    const desc = formatCardDesc(raw)

    const { lines, fontSize } = layoutTextWithConstraints(
      pdf,
      desc,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    expect(lines.length).toBeGreaterThan(0)
    assertLinesWidth(pdf, lines, MONSTER_BOX_WIDTH_MM)
    assertBulletAndPunctuationRules(lines)

    const mmPerPoint = 25.4 / 72
    const fontSizeMm = fontSize * mmPerPoint
    expect(lines.length * fontSizeMm).toBeLessThanOrEqual(
      MONSTER_BOX_HEIGHT_MM + 0.1,
    )
  })

  it('lays out Thunder King Rai-Oh (71564252) within monster textbox', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw =
      '只要这张卡在自己场上表侧表示存在，双方不能用抽卡以外的方法从卡组把卡加入手卡。此外，可以把自己场上表侧表示存在的这张卡送去墓地，让1只对方怪兽的特殊召唤无效并破坏。'
    const desc = formatCardDesc(raw)

    const { lines, fontSize } = layoutTextWithConstraints(
      pdf,
      desc,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    expect(lines.length).toBeGreaterThan(0)
    assertLinesWidth(pdf, lines, MONSTER_BOX_WIDTH_MM)
    assertBulletAndPunctuationRules(lines)

    const mmPerPoint = 25.4 / 72
    const fontSizeMm = fontSize * mmPerPoint
    expect(lines.length * fontSizeMm).toBeLessThanOrEqual(
      MONSTER_BOX_HEIGHT_MM + 0.1,
    )
  })

  it.skip('prints final lines for debug cards (99267150, 71564252, 76666602)', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw99267150 =
      '龙族怪兽×5\r\n这张卡不用融合召唤不能特殊召唤。\r\n①：这张卡不会被和暗·地·水·炎·风属性怪兽的战斗破坏。'
    const desc99267150 = formatCardDesc(raw99267150)
    const layout99267150 = layoutTextWithConstraints(
      pdf,
      desc99267150,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    const raw71564252 =
      '只要这张卡在自己场上表侧表示存在，双方不能用抽卡以外的方法从卡组把卡加入手卡。此外，可以把自己场上表侧表示存在的这张卡送去墓地，让1只对方怪兽的特殊召唤无效并破坏。'
    const desc71564252 = formatCardDesc(raw71564252)
    const layout71564252 = layoutTextWithConstraints(
      pdf,
      desc71564252,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    // eslint-disable-next-line no-console
    console.log('99267150 lines:', layout99267150.lines)
    // eslint-disable-next-line no-console
    console.log('71564252 lines:', layout71564252.lines)

    const raw76666602 =
      '「阿不思的落胤」＋光·暗属性怪兽＋效果怪兽\r\n这个卡名的①③的效果1回合各能使用1次。\r\n①：这张卡特殊召唤的场合才能发动。自己·对方的墓地·除外状态的卡合计最多2张回到卡组。\r\n②：只要自己或对方的场上或墓地有「艾克莉西娅」怪兽存在，这张卡攻击力上升500，不受这张卡以外的效果影响。\r\n③：这张卡被送去墓地的回合的结束阶段才能发动。从卡组把1张「教导」、「铁兽」卡加入手卡。'
    const desc76666602 = formatCardDesc(raw76666602)
    const layout76666602 = layoutTextWithConstraints(
      pdf,
      desc76666602,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    // eslint-disable-next-line no-console
    console.log('76666602 lines:', layout76666602.lines)

    expect(layout99267150.lines.length).toBeGreaterThan(0)
    expect(layout71564252.lines.length).toBeGreaterThan(0)
    expect(layout76666602.lines.length).toBeGreaterThan(0)
  })

  it('76666602: no spurious line break inside 攻击力上升 (reflow must not preserve previous breaks)', () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    pdf.setFont('helvetica', 'normal')

    const raw76666602 =
      '「阿不思的落胤」＋光·暗属性怪兽＋效果怪兽\r\n这个卡名的①③的效果1回合各能使用1次。\r\n①：这张卡特殊召唤的场合才能发动。自己·对方的墓地·除外状态的卡合计最多2张回到卡组。\r\n②：只要自己或对方的场上或墓地有「艾克莉西娅」怪兽存在，这张卡攻击力上升500，不受这张卡以外的效果影响。\r\n③：这张卡被送去墓地的回合的结束阶段才能发动。从卡组把1张「教导」、「铁兽」卡加入手卡。'
    const desc76666602 = formatCardDesc(raw76666602)
    const { lines } = layoutTextWithConstraints(
      pdf,
      desc76666602,
      MONSTER_BOX_WIDTH_MM,
      MONSTER_BOX_HEIGHT_MM,
    )

    assertLinesWidth(pdf, lines, MONSTER_BOX_WIDTH_MM)
    assertBulletAndPunctuationRules(lines)
    // 重排时后续行用 join('') 合并再按宽度折行，不应把上一轮的折行当硬换行保留，导致 "击力" 单独一行
    expect(lines).not.toContain('击力')
  })
})
