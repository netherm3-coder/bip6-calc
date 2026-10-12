// Кольори й розміри. Екран Bip 6: 390x450, AMOLED, кути з радіусом 86 px.

export const COLOR = {
  BG: 0x000000,
  TEXT: 0xffffff,
  TEXT_DIM: 0x8e8e93,
  PREVIEW: 0xa9a9ae,
  WARN: 0xff9f0a,
  KEY_NUM: 0x2c2c2e,
  KEY_NUM_PRESS: 0x5c5c60,
  KEY_FN: 0x48484c,
  KEY_FN_PRESS: 0x76767b,
  KEY_OP: 0xff9f0a,
  KEY_OP_PRESS: 0xffc46b,
  CLEAR: 0xff7a6e,
  CARD: 0x1c1c1e,
  CARD_PRESS: 0x3a3a3c,
  NEUTRAL: 0x2c2c2e,
  NEUTRAL_PRESS: 0x48484a,
  DANGER: 0xff6b5e
}

// Висота системного рядка стану (назва програми + час) на сторінці історії.
export const STATUS_BAR_H = 64

// Калькулятор займає весь екран (без рядка стану).
export const LAYOUT = {
  EXPR: { x: 28, y: 18, w: 328, h: 34 },
  EXPR_SIZE: 26,
  MAIN: { x: 16, y: 50, w: 358, h: 70 },
  MAIN_SIZES: [52, 46, 40, 34, 28],
  ERROR_SIZE: 32,
  KEYS_TOP: 124,
  KEY_H: 56,
  KEY_GAP_Y: 6,
  KEY_SIDE: 14,
  KEY_GAP_X: 6,
  KEY_RADIUS: 22
}

// Скільки екран світиться без дотиків, поки відкритий калькулятор.
export const SCREEN_ON_MS = 60 * 1000
