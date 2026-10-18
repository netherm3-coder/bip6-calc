import * as hmUI from '@zos/ui'

export function statusBar(visible) {
  try {
    if (typeof hmUI.setStatusBarVisible === 'function') hmUI.setStatusBarVisible(visible)
  } catch (e) {}
}

export function setProps(widget, props) {
  if (!widget) return
  try {
    widget.setProperty(hmUI.prop.MORE, props)
  } catch (e) {}
}

// Запасна оцінка ширини (із запасом), якщо getTextLayout недоступний.
const NARROW = ' ,.:;!|il1'
const WIDE = '%…mwMWЖШЩЮжшщю'

function estimate(text, size) {
  let w = 0
  for (const ch of String(text)) {
    if (NARROW.indexOf(ch) >= 0) w += 0.34
    else if (WIDE.indexOf(ch) >= 0) w += 0.95
    else w += 0.62
  }
  return Math.ceil(w * size)
}

// Ширина тексту в один рядок.
export function textWidth(text, size) {
  if (!text) return 0
  try {
    const r = hmUI.getTextLayout(String(text), { text_size: size, text_width: 2000, wrapped: 0 })
    if (r && r.width > 0) return r.width
  } catch (e) {}
  return estimate(text, size)
}

// Найбільший кегль зі списку, з яким текст влазить у ширину.
export function fitSize(text, sizes, width) {
  for (let i = 0; i < sizes.length; i++) {
    if (textWidth(text, sizes[i]) <= width) return sizes[i]
  }
  return sizes[sizes.length - 1]
}

// Довгий вираз: показуємо кінець (останнє введене), спереду «…».
export function tailToFit(text, size, width) {
  if (textWidth(text, size) <= width) return text
  const chars = Array.from(String(text))
  let lo = 1
  let hi = chars.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (textWidth('…' + chars.slice(chars.length - mid).join(''), size) <= width) lo = mid
    else hi = mid - 1
  }
  return '…' + chars.slice(chars.length - lo).join('').replace(/^\s+/, '')
}

function rawWidth(text, size) {
  try {
    const r = hmUI.getTextLayout(String(text), { text_size: size, text_width: 2000, wrapped: 0 })
    return r && r.width > 0 ? r.width : 0
  } catch (e) {
    return 0
  }
}

// Чи є символ у шрифті годинника: ширина як у свідомо відсутнього символу — значить, немає.
// Еталон — непризначений код U+0378 (його немає в жодному шрифті, на відміну від приватної
// зони, де бувають значки). Сумнів — на користь запасного символу.
export function glyphOk(ch, size) {
  const base = rawWidth('aa', size)
  const w = rawWidth('a' + ch + 'a', size) - base
  if (!(base > 0) || !(w > 0)) return false
  const miss = rawWidth('a\u0378a', size) - base
  return !(miss > 0 && Math.abs(miss - w) < 0.5)
}

// Символи для виразу й клавіш — із запасними, якщо в шрифті їх немає.
export function detectSymbols(size) {
  return {
    minus: glyphOk('−', size) ? '−' : '-',
    sqrt: glyphOk('√', size) ? '√' : 'sqrt',
    pi: glyphOk('π', size) ? 'π' : 'pi',
    sq: glyphOk('²', size) ? '²' : '^2',
    pow: glyphOk('ʸ', size) ? 'xʸ' : 'x^y'
  }
}
