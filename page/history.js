// Історія обчислень: найновіші згори. Торкнись запису — результат повернеться в калькулятор.

import * as hmUI from '@zos/ui'
import { back, replace } from '@zos/router'
import { getScrollTop } from '@zos/page'
import { getDeviceInfo } from '@zos/device'
import { loadData, saveData } from '../utils/store'
import { COLOR, STATUS_BAR_H } from '../utils/constants'
import { statusBar, setProps, fitSize, tailToFit } from '../utils/ui'

const ROW_H = 90
const ROW_GAP = 10
const PAD = 16
const EXPR_SIZE = 22
const RESULT_SIZES = [36, 30, 26]

function scrollTop() {
  try {
    return getScrollTop() || 0
  } catch (e) {
    return 0
  }
}

Page({
  onInit() {
    this.data = loadData()
    this.press = null
    this.leaving = false
    this.armed = false
    this.armTimer = null
  },

  build() {
    const { width: W } = getDeviceInfo()
    this.W = W
    statusBar(true)

    let y = STATUS_BAR_H + 4
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 40,
      text: 'Історія',
      text_size: 28,
      color: COLOR.TEXT,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })
    y += 48

    const items = this.data.history
    if (!items.length) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 30,
        y: y + 10,
        w: W - 60,
        h: 120,
        text: 'Поки порожньо.\nПісля «=» обчислення з\'являться тут.',
        text_size: 24,
        color: COLOR.TEXT_DIM,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.TOP,
        text_style: hmUI.text_style.WRAP
      })
      y += 140
    } else {
      items.forEach((item) => {
        this.row(item, y, W)
        y += ROW_H + ROW_GAP
      })
      y += 6
      this.clearBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: 50,
        y,
        w: W - 100,
        h: 56,
        radius: 28,
        normal_color: COLOR.NEUTRAL,
        press_color: COLOR.NEUTRAL_PRESS,
        text: 'Очистити історію',
        text_size: 24,
        color: COLOR.DANGER,
        click_func: () => this.clear()
      })
      this.clearY = y
      y += 56
    }

    y += 16
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 50,
      y,
      w: W - 100,
      h: 56,
      radius: 28,
      normal_color: COLOR.NEUTRAL,
      press_color: COLOR.NEUTRAL_PRESS,
      text: 'До калькулятора',
      text_size: 24,
      color: COLOR.TEXT,
      click_func: () => this.close()
    })
    y += 56
    // відступ знизу, щоб кнопку можна було прокрутити з-під заокругленого кута
    hmUI.createWidget(hmUI.widget.FILL_RECT, { x: 0, y: y + 60, w: W, h: 2, radius: 0, color: COLOR.BG })
  },

  row(item, y, W) {
    const x = PAD
    const w = W - PAD * 2
    const textW = w - 32
    const bg = hmUI.createWidget(hmUI.widget.FILL_RECT, { x, y, w, h: ROW_H, radius: 20, color: COLOR.CARD })
    const expr = hmUI.createWidget(hmUI.widget.TEXT, {
      x: x + 16,
      y: y + 8,
      w: textW,
      h: 30,
      text: tailToFit(item.e + ' =', EXPR_SIZE, textW),
      text_size: EXPR_SIZE,
      color: COLOR.TEXT_DIM,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })
    const result = hmUI.createWidget(hmUI.widget.TEXT, {
      x: x + 16,
      y: y + 38,
      w: textW,
      h: 46,
      text: item.r,
      text_size: fitSize(item.r, RESULT_SIZES, textW),
      color: COLOR.TEXT,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.NONE
    })

    const paint = (color) => setProps(bg, { x, y, w, h: ROW_H, radius: 20, color })
    const down = () => {
      this.press = { item, top: scrollTop(), t: Date.now() }
      paint(COLOR.CARD_PRESS)
      setTimeout(() => {
        if (!this.leaving) paint(COLOR.CARD)
      }, 300)
    }
    const up = () => {
      const p = this.press
      this.press = null
      if (!p || p.item !== item) return
      if (Math.abs(scrollTop() - p.top) > 6) return
      if (Date.now() - p.t > 1500) return
      this.recall(item)
    }
    ;[bg, expr, result].forEach((wd) => {
      try {
        wd.addEventListener(hmUI.event.CLICK_DOWN, down)
        wd.addEventListener(hmUI.event.CLICK_UP, up)
      } catch (e) {}
    })
  },

  // Результат стає поточним числом калькулятора, вираз — над ним.
  recall(item) {
    if (this.leaving) return
    this.leaving = true
    this.data.state = { tokens: [{ k: 'num', s: item.v }], done: true, error: '', expr: item.e }
    saveData(this.data)
    back()
  },

  // Перше натискання просить підтвердження, друге (протягом 3 с) очищає.
  clear() {
    if (!this.armed) {
      this.armed = true
      setProps(this.clearBtn, { x: 50, y: this.clearY, w: this.W - 100, h: 56, text: 'Ще раз — очистити' })
      this.armTimer = setTimeout(() => {
        this.armed = false
        if (!this.leaving) setProps(this.clearBtn, { x: 50, y: this.clearY, w: this.W - 100, h: 56, text: 'Очистити історію' })
      }, 3000)
      return
    }
    try {
      clearTimeout(this.armTimer)
    } catch (e) {}
    this.leaving = true
    this.data.history = []
    saveData(this.data)
    replace({ url: 'page/history' })
  },

  close() {
    if (this.leaving) return
    this.leaving = true
    back()
  },

  onDestroy() {
    this.leaving = true
    try {
      clearTimeout(this.armTimer)
    } catch (e) {}
  }
})
