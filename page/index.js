// Калькулятор у стилі Xiaomi: зверху — попереднє обчислення, вираз великим і «= результат»
// сірим під ним (після «=» — навпаки). Клавіші 5×4; fx — наукові функції (на одне натискання,
// потім знову цифри). Торкнись дисплея — історія.

import * as hmUI from '@zos/ui'
import { push } from '@zos/router'
import { getDeviceInfo } from '@zos/device'
import { setPageBrightTime } from '@zos/display'
import { press, display, hasTrig, setSymbols, MAX_HISTORY } from '../utils/calc'
import { loadData, saveData } from '../utils/store'
import { COLOR, LAYOUT, SCREEN_ON_MS } from '../utils/constants'
import { statusBar, setProps, fitSize, tailToFit, detectSymbols } from '../utils/ui'

// [напис, клавіша, вид]; напис '-' / '√' / 'π' / 'x²' / 'xʸ' підміняється символами шрифту.
const BASIC = [
  [['AC', 'clear', 'orange'], ['', 'back', 'back'], ['%', '%', 'orange'], ['÷', '/', 'orange']],
  [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['×', '*', 'orange']],
  [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['-', '-', 'orange']],
  [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+', '+', 'orange']],
  [['fx', 'layer', 'mode'], ['0', '0', 'num'], [',', '.', 'num'], ['=', '=', 'equals']]
]
const FX = [
  [['(', '(', 'fn'], ['', 'back', 'back'], [')', ')', 'fn'], ['÷', '/', 'orange']],
  [['sin', 'sin', 'fn'], ['cos', 'cos', 'fn'], ['tan', 'tan', 'fn'], ['×', '*', 'orange']],
  [['ln', 'ln', 'fn'], ['lg', 'lg', 'fn'], ['√', 'sqrt', 'fn'], ['-', '-', 'orange']],
  [['π', 'pi', 'fn'], ['e', 'e', 'fn'], ['xʸ', '^', 'fn'], ['+', '+', 'orange']],
  [['123', 'layer', 'mode'], ['x²', 'sq', 'fn'], ['DEG', 'deg', 'mode'], ['=', '=', 'equals']]
]

// Після цих клавіш шар fx лишається (решта повертає цифри).
const FX_STAYS = { back: 1, deg: 1, layer: 1 }

const SIZE = { AC: 30, '%': 34, ',': 40, '=': 42, fx: 26, '123': 24, DEG: 22, RAD: 22, sin: 26, cos: 26, tan: 26, ln: 26, lg: 26, e: 32 }

Page({
  onInit() {
    this.data = loadData()
    this.layer = 'basic'
    this.zoneDown = 0
    this.leaving = false
    this.keys = []
  },

  build() {
    const { width: W } = getDeviceInfo()
    statusBar(false)
    try {
      setPageBrightTime({ brightTime: SCREEN_ON_MS })
    } catch (e) {}
    this.sym = detectSymbols(40)
    setSymbols(this.sym)

    const L = LAYOUT
    this.histWidget = hmUI.createWidget(hmUI.widget.TEXT, Object.assign({}, L.HIST, this.textStyle(L.HIST_SIZE, COLOR.TEXT_DIM)))
    this.exprWidget = hmUI.createWidget(hmUI.widget.TEXT, Object.assign({}, L.EXPR_BIG, this.textStyle(L.EXPR_SIZES[0], COLOR.TEXT)))
    this.mainWidget = hmUI.createWidget(hmUI.widget.TEXT, Object.assign({}, L.PREVIEW, this.textStyle(L.PREVIEW_SIZE, COLOR.PREVIEW)))
    this.angleWidget = hmUI.createWidget(
      hmUI.widget.TEXT,
      Object.assign({}, L.ANGLE, this.textStyle(20, COLOR.TEXT_DIM), { align_h: hmUI.align.LEFT, text: '' })
    )

    // Прозорий шар над дисплеєм: торкання відкриває історію.
    const zone = hmUI.createWidget(hmUI.widget.TEXT, { x: 0, y: 0, w: W, h: L.KEYS_TOP - 4, text: ' ', text_size: 10, color: COLOR.BG })
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

    this.keyW = Math.floor((W - L.KEY_SIDE * 2 - L.KEY_GAP_X * 3) / 4)
    BASIC.forEach((row, r) => {
      this.keys.push(row.map((def, c) => this.makeKey(def, r, c)))
    })
    this.render()
  },

  textStyle(size, color) {
    return {
      text: '',
      text_size: size,
      color,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    }
  },

  rect(r, c) {
    const L = LAYOUT
    return { x: L.KEY_SIDE + c * (this.keyW + L.KEY_GAP_X), y: L.KEYS_TOP + r * (L.KEY_H + L.KEY_GAP_Y), w: this.keyW, h: LAYOUT.KEY_H }
  },

  // Напис клавіші з урахуванням символів шрифту й поточного режиму кутів.
  label(def) {
    const [text, key] = def
    if (key === '-') return this.sym.minus
    if (key === 'sqrt') return this.sym.sqrt
    if (key === 'pi') return this.sym.pi
    if (key === 'sq') return 'x' + this.sym.sq
    if (key === '^') return this.sym.pow
    if (key === 'deg') return this.data.state.deg === false ? 'RAD' : 'DEG'
    return text
  },

  look(def) {
    const kind = def[2]
    const label = this.label(def)
    let size = SIZE[label] || (label.length > 3 ? 22 : label.length > 1 ? 30 : 40)
    if (kind === 'num') size = SIZE[label] || 40
    const color = kind === 'orange' ? COLOR.ORANGE : kind === 'mode' ? COLOR.TEXT_DIM : kind === 'fn' ? COLOR.FN_TEXT : COLOR.TEXT
    const eqKey = kind === 'equals'
    return {
      text: label,
      text_size: size,
      color,
      normal_color: eqKey ? COLOR.ORANGE : COLOR.KEY,
      press_color: eqKey ? COLOR.ORANGE_PRESS : COLOR.KEY_PRESS,
      radius: Math.floor(LAYOUT.KEY_H / 2)
    }
  },

  makeKey(def, r, c) {
    const box = this.rect(r, c)
    const opts = Object.assign({}, box, { click_func: () => this.onKey(r, c) })
    if (def[2] === 'back') {
      // Значка ⌫ у шрифті годинника може не бути — клавіша-картинка (однакова в обох шарах).
      opts.text = ''
      opts.normal_src = 'key_back.png'
      opts.press_src = 'key_back_p.png'
    } else Object.assign(opts, this.look(def))
    return hmUI.createWidget(hmUI.widget.BUTTON, opts)
  },

  defs() {
    return this.layer === 'fx' ? FX : BASIC
  },

  // Перемкнути шар: ті самі кнопки, інші написи.
  setLayer(layer) {
    if (layer === this.layer) return
    this.layer = layer
    this.refreshKeys()
  },

  refreshKeys() {
    const defs = this.defs()
    defs.forEach((row, r) =>
      row.forEach((def, c) => {
        if (def[2] === 'back') return
        setProps(this.keys[r][c], Object.assign({}, this.rect(r, c), this.look(def)))
      })
    )
  },

  onKey(r, c) {
    const def = this.defs()[r][c]
    const key = def[1]
    if (key === 'layer') {
      this.setLayer(this.layer === 'fx' ? 'basic' : 'fx')
      return
    }
    const { state, entry } = press(this.data.state, key)
    this.data.state = state
    if (entry) {
      this.data.history.unshift(entry)
      if (this.data.history.length > MAX_HISTORY) this.data.history.length = MAX_HISTORY
      saveData(this.data)
    }
    if (this.layer === 'fx' && !FX_STAYS[key]) this.setLayer('basic')
    else if (key === 'deg') this.refreshKeys()
    this.render()
  },

  // Попереднє обчислення (після «=» — те, що було перед поточним).
  histText() {
    const h = this.data.history
    const st = this.data.state
    let item = h[0]
    if (st.done && item && st.tokens[0] && item.v === st.tokens[0].s && item.e === st.expr) item = h[1]
    return item ? item.e + ' = ' + item.r : ''
  },

  render() {
    const L = LAYOUT
    const d = display(this.data.state)
    setProps(this.histWidget, Object.assign({}, L.HIST, { text: tailToFit(this.histText(), L.HIST_SIZE, L.HIST.w) }))

    if (d.mode === 'done') {
      setProps(
        this.exprWidget,
        Object.assign({}, L.EXPR_SMALL, { text: tailToFit(d.expr, L.EXPR_SMALL_SIZE, L.EXPR_SMALL.w), text_size: L.EXPR_SMALL_SIZE, color: COLOR.TEXT_DIM })
      )
      setProps(
        this.mainWidget,
        Object.assign({}, L.RESULT, { text: d.result, text_size: fitSize(d.result, L.RESULT_SIZES, L.RESULT.w), color: COLOR.TEXT })
      )
    } else {
      const sizes = L.EXPR_SIZES
      let size = fitSize(d.expr, sizes, L.EXPR_BIG.w)
      const text = tailToFit(d.expr, size, L.EXPR_BIG.w)
      setProps(this.exprWidget, Object.assign({}, L.EXPR_BIG, { text, text_size: size, color: COLOR.TEXT }))
      const error = d.mode === 'error'
      setProps(
        this.mainWidget,
        Object.assign({}, L.PREVIEW, {
          text: error ? d.result : d.preview,
          text_size: error ? L.ERROR_SIZE : L.PREVIEW_SIZE,
          color: error ? COLOR.WARN : COLOR.PREVIEW
        })
      )
    }
    const angle = d.mode !== 'done' && hasTrig(this.data.state) ? (this.data.state.deg === false ? 'RAD' : 'DEG') : ''
    setProps(this.angleWidget, Object.assign({}, L.ANGLE, { text: angle }))
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

