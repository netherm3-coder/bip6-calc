// Кольори й розміри — як у калькуляторі Xiaomi (темна тема).
// Екран Bip 6: 390x450, AMOLED, кути з радіусом 86 px.

export const COLOR = {
  BG: 0x000000,
  TEXT: 0xffffff,
  TEXT_DIM: 0x8e8e93,
  PREVIEW: 0x9d9da3,
  ORANGE: 0xff7a1a,
  ORANGE_PRESS: 0xffa35e,
  WARN: 0xff7a1a,
  KEY: 0x1c1c1e,
  KEY_PRESS: 0x3a3a3d,
  FN_TEXT: 0xe2e2e6,
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
  // попереднє обчислення з історії
  HIST: { x: 44, y: 10, w: 302, h: 30 },
  HIST_SIZE: 20,
  // під час набору: вираз великим, «= результат» сірим під ним
  EXPR_BIG: { x: 16, y: 40, w: 358, h: 62 },
  EXPR_SIZES: [46, 40, 34, 28],
  PREVIEW: { x: 16, y: 102, w: 358, h: 40 },
  PREVIEW_SIZE: 28,
  // після «=»: вираз дрібно, результат великим
  EXPR_SMALL: { x: 16, y: 42, w: 358, h: 36 },
  EXPR_SMALL_SIZE: 26,
  RESULT: { x: 16, y: 78, w: 358, h: 64 },
  RESULT_SIZES: [50, 44, 38, 32, 28],
  ERROR_SIZE: 30,
  // DEG / RAD — ліворуч від попереднього результату, коли у виразі є sin, cos, tan
  ANGLE: { x: 26, y: 108, w: 70, h: 28 },
  KEYS_TOP: 148,
  KEY_H: 54,
  KEY_GAP_Y: 4,
  KEY_SIDE: 14,
  KEY_GAP_X: 6
}

// Скільки екран світиться без дотиків, поки відкритий калькулятор.
export const SCREEN_ON_MS = 60 * 1000
