export const CARD_WIDTH_MM = 59
export const CARD_HEIGHT_MM = 86
export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
export const CARDS_PER_ROW = 3
export const CARDS_PER_COLUMN = 3
export const CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COLUMN
export const DEFAULT_SPACING_MM = 0
export const MIN_PAGE_MARGIN_MM = 5

const GRID_WIDTH_MM = CARD_WIDTH_MM * CARDS_PER_ROW
const GRID_HEIGHT_MM = CARD_HEIGHT_MM * CARDS_PER_COLUMN

const BASE_MARGIN_X_MM = Math.floor((PAGE_WIDTH_MM - GRID_WIDTH_MM) / 2)
const BASE_MARGIN_Y_MM = Math.floor((PAGE_HEIGHT_MM - GRID_HEIGHT_MM) / 2)

const CENTER_X_MM = BASE_MARGIN_X_MM + CARD_WIDTH_MM
const CENTER_Y_MM = BASE_MARGIN_Y_MM + CARD_HEIGHT_MM

const SPACING_MAX_X_MM =
  (PAGE_WIDTH_MM - GRID_WIDTH_MM) / 2 - MIN_PAGE_MARGIN_MM
const SPACING_MAX_Y_MM =
  (PAGE_HEIGHT_MM - GRID_HEIGHT_MM) / 2 - MIN_PAGE_MARGIN_MM

export const MAX_SPACING_MM = Math.max(
  0,
  Math.floor(Math.min(SPACING_MAX_X_MM, SPACING_MAX_Y_MM)),
)

export function computeMaxSpacingMm(): number {
  return MAX_SPACING_MM
}

export interface CardPosition {
  page: number
  x: number
  y: number
}

export function computeCardPositions(
  count: number,
  spacingMm: number,
): CardPosition[] {
  const positions: CardPosition[] = []
  for (let i = 0; i < count; i += 1) {
    const page = Math.floor(i / CARDS_PER_PAGE)
    const indexInPage = i % CARDS_PER_PAGE
    const row = Math.floor(indexInPage / CARDS_PER_ROW)
    const col = indexInPage % CARDS_PER_ROW
    const offsetRow = row - 1
    const offsetCol = col - 1
    const x = CENTER_X_MM + offsetCol * (CARD_WIDTH_MM + spacingMm)
    const y = CENTER_Y_MM + offsetRow * (CARD_HEIGHT_MM + spacingMm)
    positions.push({ page, x, y })
  }
  return positions
}
