// Рушій калькулятора: введення, обчислення з пріоритетом операцій, формат чисел.
//
// Вираз — масив токенів { k: 'num' | 'op', s }; числа й операції чергуються.
//   num.s — як набрано: «-» (лише мінус, цифри ще не набрані), «12», «0.», «-3.5», «50%».
//           Крапка внутрішня, на екрані — кома. Результат може бути в
//           експоненційному записі: «1.23456789012e+14».
//   op.s  — '+', '-', '*', '/'.
// Стан: { tokens, done, error, expr }:
//   done  — щойно натиснуто «=», у tokens лише результат;
//   expr  — вираз, що дав цей результат (для верхнього рядка «… =»);
//   error — 'div0' | 'overflow' | 'syntax' після невдалого «=».

export const MAX_DIGITS = 12
export const MAX_TOKENS = 39
export const MAX_HISTORY = 30

const OP_TEXT = { '+': '+', '-': '-', '*': '×', '/': '÷' }

export const ERRORS = {
  div0: 'Ділення на 0',
  overflow: 'Завелике число',
  syntax: 'Помилка'
}

const PLAIN_RE = /^-?(\d+(\.\d*)?)?%?$/
const EXP_RE = /^-?\d(\.\d+)?e[+-]\d{1,3}%?$/

export function blank() {
  return { tokens: [], done: false, error: '', expr: '' }
}

function isNum(t) {
  return !!t && t.k === 'num'
}

function isOp(t) {
  return !!t && t.k === 'op'
}

function hasDigits(t) {
  return isNum(t) && /\d/.test(t.s)
}

function isPercent(t) {
  return isNum(t) && t.s.charAt(t.s.length - 1) === '%'
}

function isExp(t) {
  return isNum(t) && t.s.indexOf('e') >= 0
}

function digitCount(s) {
  return (s.match(/\d/g) || []).length
}

function top(st) {
  return st.tokens[st.tokens.length - 1]
}

function clone(st) {
  return {
    tokens: (st.tokens || []).map((t) => ({ k: t.k, s: t.s })),
    done: !!st.done,
    error: st.error || '',
    expr: st.expr || ''
  }
}

function room(st) {
  return st.tokens.length < MAX_TOKENS
}

// ---------- введення ----------

function startFresh(st) {
  st.tokens = []
  st.done = false
  st.expr = ''
}

// Після «50%» цифра чи кома означає множення: «50% × 2».
function afterPercent(st) {
  if (isPercent(top(st)) && room(st)) {
    st.tokens.push({ k: 'op', s: '*' })
    return true
  }
  return !isPercent(top(st))
}

function inputDigit(st, d) {
  if (st.done) startFresh(st)
  if (!afterPercent(st)) return
  const last = top(st)
  if (!isNum(last)) {
    if (room(st)) st.tokens.push({ k: 'num', s: d })
    return
  }
  if (isExp(last)) {
    last.s = d
    return
  }
  if (digitCount(last.s) >= MAX_DIGITS) return
  if (last.s === '0') last.s = d
  else if (last.s === '-0') last.s = '-' + d
  else last.s += d
}

function inputDot(st) {
  if (st.done) startFresh(st)
  if (!afterPercent(st)) return
  const last = top(st)
  if (!isNum(last)) {
    if (room(st)) st.tokens.push({ k: 'num', s: '0.' })
    return
  }
  if (isExp(last)) {
    last.s = '0.'
    return
  }
  if (last.s.indexOf('.') >= 0 || digitCount(last.s) >= MAX_DIGITS) return
  last.s = last.s === '-' ? '-0.' : last.s + '.'
}

function inputOp(st, op) {
  st.done = false
  st.expr = ''
  const last = top(st)
  if (!last) {
    if (op === '-') st.tokens.push({ k: 'num', s: '-' }) // мінус на початку — від'ємне число
    return
  }
  if (isOp(last)) {
    last.s = op
    return
  }
  if (!hasDigits(last)) {
    // «5 × -» без цифр: інша операція замінює попередню
    if (op === '-') return
    st.tokens.pop()
    const prev = top(st)
    if (isOp(prev)) prev.s = op
    return
  }
  if (last.s.charAt(last.s.length - 1) === '.') last.s = last.s.slice(0, -1)
  if (room(st)) st.tokens.push({ k: 'op', s: op })
}

function inputNeg(st) {
  st.done = false
  st.expr = ''
  const last = top(st)
  if (!last || isOp(last)) {
    if (room(st)) st.tokens.push({ k: 'num', s: '-' })
    return
  }
  if (last.s.charAt(0) === '-') {
    last.s = last.s.slice(1)
    if (!last.s) st.tokens.pop()
    return
  }
  last.s = '-' + last.s
}

function inputPercent(st) {
  const last = top(st)
  if (!hasDigits(last) || isPercent(last)) return
  st.done = false
  st.expr = ''
  if (last.s.charAt(last.s.length - 1) === '.') last.s = last.s.slice(0, -1)
  last.s += '%'
}

function inputBack(st) {
  if (st.done) {
    startFresh(st)
    return
  }
  const last = top(st)
  if (!last) return
  if (isOp(last) || isExp(last)) {
    st.tokens.pop()
    return
  }
  last.s = last.s.slice(0, -1)
  if (!last.s) st.tokens.pop()
}

// Натискання клавіші. key: '0'…'9', '.', '+', '-', '*', '/', '%', 'neg', 'back', 'clear', '='.
// Повертає { state, entry }: entry — запис для історії після вдалого «=».
export function press(state, key) {
  const st = clone(state)
  st.error = ''
  if (key === '=') return equals(st)
  if (key === 'clear') return { state: blank(), entry: null }
  if (/^\d$/.test(key)) inputDigit(st, key)
  else if (key === '.') inputDot(st)
  else if (OP_TEXT[key]) inputOp(st, key)
  else if (key === 'neg') inputNeg(st)
  else if (key === '%') inputPercent(st)
  else if (key === 'back') inputBack(st)
  return { state: st, entry: null }
}

function trimTail(tokens) {
  const list = tokens.slice()
  while (list.length && (isOp(list[list.length - 1]) || !hasDigits(list[list.length - 1]))) list.pop()
  return list
}

function hasWork(tokens) {
  return tokens.some((t) => isOp(t) || isPercent(t))
}

function equals(st) {
  if (st.done) return { state: st, entry: null }
  const work = trimTail(st.tokens)
  const r = evaluate(st.tokens)
  if (r.empty) return { state: st, entry: null }
  if (r.error) {
    st.error = r.error
    return { state: st, entry: null }
  }
  const token = { k: 'num', s: toTokenString(r.value) }
  const counted = hasWork(work)
  const expr = counted ? formatExpression(work) : ''
  return {
    state: { tokens: [token], done: true, error: '', expr },
    entry: counted ? { e: expr, r: formatToken(token.s, true), v: token.s } : null
  }
}

// ---------- обчислення ----------

function rawValue(t) {
  return parseFloat(t.s.replace('%', ''))
}

function numValue(t) {
  const v = rawValue(t)
  return isPercent(t) ? v / 100 : v
}

// Множення й ділення раніше за додавання й віднімання.
// Відсотки як на телефоні: «200 + 10%» = 220, «200 - 10%» = 180, «200 × 10%» = 20.
export function evaluate(tokens) {
  const list = trimTail(tokens || [])
  if (!list.length) return { empty: true }
  let acc = null
  let addOp = '+'
  let i = 0
  while (i < list.length) {
    const first = list[i]
    if (!hasDigits(first)) return { error: 'syntax' }
    let term = numValue(first)
    let single = true
    i++
    while (i < list.length && (list[i].s === '*' || list[i].s === '/')) {
      const op = list[i].s
      const rhs = list[i + 1]
      if (!hasDigits(rhs)) return { error: 'syntax' }
      const v = numValue(rhs)
      single = false
      if (op === '*') term *= v
      else {
        if (v === 0) return { error: 'div0' }
        term /= v
      }
      i += 2
    }
    if (single && acc !== null && isPercent(first)) term = (acc * rawValue(first)) / 100
    acc = acc === null ? term : addOp === '+' ? acc + term : acc - term
    if (i < list.length) {
      if (!isOp(list[i])) return { error: 'syntax' }
      addOp = list[i].s
      i++
    }
  }
  if (typeof acc !== 'number' || isNaN(acc)) return { error: 'syntax' }
  if (!isFinite(acc)) return { error: 'overflow' }
  return { value: acc }
}

// ---------- формат ----------

// Число → рядок токена: 12 значущих цифр (прибирає 0,30000000000000004),
// великі й дуже малі — в експоненційному записі.
export function toTokenString(value) {
  const v = Number(Number(value).toPrecision(12))
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e12 || abs < 1e-6) return v.toExponential()
  return String(v)
}

function groupDigits(int) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

// Токен → текст на екрані: кома замість крапки; group — пробіли між тисячами.
export function formatToken(s, group) {
  let body = String(s)
  let sign = ''
  let pct = ''
  if (body.charAt(0) === '-') {
    sign = '-'
    body = body.slice(1)
  }
  if (body.charAt(body.length - 1) === '%') {
    pct = '%'
    body = body.slice(0, -1)
  }
  let out
  const e = body.indexOf('e')
  if (e >= 0) {
    let exp = body.slice(e + 1)
    if (exp.charAt(0) === '+') exp = exp.slice(1)
    out = body.slice(0, e).replace('.', ',') + 'e' + exp
  } else {
    const dot = body.indexOf('.')
    const int = dot >= 0 ? body.slice(0, dot) : body
    out = (group ? groupDigits(int) : int) + (dot >= 0 ? ',' + body.slice(dot + 1) : '')
  }
  return sign + out + pct
}

export function formatNumber(value) {
  if (typeof value !== 'number' || !isFinite(value)) return ''
  return formatToken(toTokenString(value), true)
}

export function formatExpression(tokens) {
  return tokens
    .map((t) => (isOp(t) ? ' ' + OP_TEXT[t.s] + ' ' : formatToken(t.s, false)))
    .join('')
    .trim()
}

// Що показати: upper — вираз (дрібно), main — число (великим),
// kind: 'value' | 'preview' (попередній результат) | 'error'.
export function display(state) {
  const st = clone(state)
  const work = hasWork(st.tokens)
  let upper = ''
  if (st.done) upper = st.expr ? st.expr + ' =' : ''
  else if (work) upper = formatExpression(st.tokens)

  let main = '0'
  let kind = 'value'
  if (st.error) {
    main = ERRORS[st.error] || ERRORS.syntax
    kind = 'error'
  } else if (!st.tokens.length) {
    main = '0'
  } else if (st.done || !work) {
    main = formatToken(st.tokens[0].s, true)
  } else {
    kind = 'preview'
    const r = evaluate(st.tokens)
    if (r.value !== undefined) main = formatNumber(r.value)
    else {
      const last = st.tokens.filter(isNum).pop()
      main = last ? formatToken(last.s, true) : ''
    }
  }
  return { upper, main, kind }
}

// ---------- збереження ----------

function validNum(s) {
  return typeof s === 'string' && s !== '%' && s !== '-%' && (PLAIN_RE.test(s) || EXP_RE.test(s))
}

export function restoreState(raw) {
  try {
    if (!raw || !Array.isArray(raw.tokens) || raw.tokens.length > MAX_TOKENS) return blank()
    const tokens = []
    for (let i = 0; i < raw.tokens.length; i++) {
      const t = raw.tokens[i]
      const wantNum = i % 2 === 0
      if (!t || t.k !== (wantNum ? 'num' : 'op')) return blank()
      if (wantNum ? !validNum(t.s) : !OP_TEXT[t.s]) return blank()
      if (wantNum && !hasDigits(t) && i !== raw.tokens.length - 1) return blank()
      tokens.push({ k: t.k, s: t.s })
    }
    const done = !!raw.done && tokens.length === 1 && hasDigits(tokens[0])
    return { tokens, done, error: '', expr: done && typeof raw.expr === 'string' ? raw.expr.slice(0, 300) : '' }
  } catch (e) {
    return blank()
  }
}

export function restoreHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h) => h && typeof h.e === 'string' && typeof h.r === 'string' && validNum(h.v) && /\d/.test(h.v))
    .slice(0, MAX_HISTORY)
    .map((h) => ({ e: h.e.slice(0, 300), r: h.r.slice(0, 40), v: h.v }))
}
