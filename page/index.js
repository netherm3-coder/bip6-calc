// Калькулятор: дисплей угорі, 20 клавіш знизу. Торкнись дисплея — історія.

import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { getDeviceInfo } from '@zos/device'
import { setPageBrightTime } from '@zos/display'
import { press, display, MAX_HISTORY } from '../utils/calc'
import { loadData, saveData } from '../utils/store'
import { COLOR, LAYOUT, SCREEN_ON_MS } from '../utils/constants'
import { statusBar, setProps, fitSize, tailToFit } from '../utils/ui'

// [напис, клавіша, вид]
const KEYS = [
  [['C', 'clear', 'clear'], ['', 'back', 'back'], ['%', '%', 'fn'], ['÷', '/', 'op']],
  [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['×', '*', 'op']],
  [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['-', '-', 'op']],
  [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+', '+', 'op']],
  [['±', 'neg', 'fn'], ['0', '0', 'num'], [',', '.', 'num'], ['=', '=', 'op']]
]

const LABEL_SIZE = { ',': 42, '-': 44, '÷': 40, '×': 38, '+': 40, '=': 40, '±': 34, '%': 30, C: 32 }

function keyStyle(kind) {
  if (kind === 'op') return { bg: COLOR.KEY_OP, press: COLOR.KEY_OP_PRESS, text: COLOR.TEXT }
  if (kind === 'fn' || kind === 'back') return { bg: COLOR.KEY_FN, press: COLOR.KEY_FN_PRESS, text: COLOR.TEXT }
  if (kind === 'clear') return { bg: COLOR.KEY_FN, press: COLOR.KEY_FN_PRESS, text: COLOR.CLEAR }
  return { bg: COLOR.KEY_NUM, press: COLOR.KEY_NUM_PRESS, text: COLOR.TEXT }
}

Page({
  onInit() {
    this.data = loadData()
    this.zoneDown = 0
    this.leaving = false
  },

  build() {
    const { width: W } = getDeviceInfo()
    statusBar(false)
    try {
      setPageBrightTime({ brightTime: SCREEN_ON_MS })
    } catch (e) {}

    const L = LAYOUT
    this.exprWidget = hmUI.createWidget(
      hmUI.widget.TEXT,
      Object.assign({}, L.EXPR, {
        text: '',
        text_size: L.EXPR_SIZE,
        color: COLOR.TEXT_DIM,
        align_h: hmUI.align.RIGHT,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.NONE
      })
    )
    this.mainWidget = hmUI.createWidget(
      hmUI.widget.TEXT,
      Object.assign({}, L.MAIN, {
        text: '0',
        text_size: L.MAIN_SIZES[0],
        color: COLOR.TEXT,
        align_h: hmUI.align.RIGHT,
        align_v: hmUI.align.CENTER_V,
        text_style: hmUI.text_style.NONE
      })
    )

    // Прозорий шар над дисплеєм: торкання відкриває історію.
    const zone = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: 0,
      w: W,
      h: L.KEYS_TOP - 4,
      text: ' ',
      text_size: 10,
      color: COLOR.BG
    })
    try {
      zone.addEventListener(hmUI.event.CLICK_DOWN, () => {
        this.zoneDown = Date.now()
      })
      zone.addEventListener(hmUI.event.CLICK_UP, () => {
        const quick = this.zoneDown && Date.now() - this.zoneDown < 800
        this.zoneDown = 0
        if (quick) this.openHistory()
      })
    } catch (e) {}

    const keyW = Math.floor((W - L.KEY_SIDE * 2 - L.KEY_GAP_X * 3) / 4)
    KEYS.forEach((row, r) => {
      row.forEach((def, c) => {
        const x = L.KEY_SIDE + c * (keyW + L.KEY_GAP_X)
        const y = L.KEYS_TOP + r * (L.KEY_H + L.KEY_GAP_Y)
        this.key(def, x, y, keyW, L.KEY_H)
      })
    })

    this.render()
  },

  key(def, x, y, w, h) {
    const [label, key, kind] = def
    const style = keyStyle(kind)
    const opts = {
      x,
      y,
      w,
      h,
      radius: LAYOUT.KEY_RADIUS,
      text: label,
      text_size: LABEL_SIZE[label] || 36,
      color: style.text,
      normal_color: style.bg,
      press_color: style.press,
      click_func: () => this.onKey(key)
    }
    if (kind === 'back') {
      // Значка ⌫ у шрифті годинника може не бути — клавіша-картинка.
      delete opts.normal_color
      delete opts.press_color
      opts.normal_src = 'key_back.png'
      opts.press_src = 'key_back_p.png'
    }
    hmUI.createWidget(hmUI.widget.BUTTON, opts)
  },

  onKey(key) {
    const { state, entry } = press(this.data.state, key)
    this.data.state = state
    if (entry) {
      this.data.history.unshift(entry)
      if (this.data.history.length > MAX_HISTORY) this.data.history.length = MAX_HISTORY
      saveData(this.data)
    }
    this.render()
  },

  render() {
    const L = LAYOUT
    const d = display(this.data.state)
    setProps(this.exprWidget, Object.assign({}, L.EXPR, { text: tailToFit(d.upper, L.EXPR_SIZE, L.EXPR.w) }))
    const error = d.kind === 'error'
    setProps(
      this.mainWidget,
      Object.assign({}, L.MAIN, {
        text: d.main,
        text_size: error ? L.ERROR_SIZE : fitSize(d.main, L.MAIN_SIZES, L.MAIN.w),
        color: error ? COLOR.WARN : d.kind === 'preview' ? COLOR.PREVIEW : COLOR.TEXT
      })
    )
  },

  openHistory() {
    if (this.leaving) return
    this.leaving = true
    saveData(this.data)
    push({ url: 'page/history' })
  },

  onDestroy() {
    if (!this.leaving) saveData(this.data)
  }
})
