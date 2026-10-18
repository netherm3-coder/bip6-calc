// Рушій калькулятора: введення, обчислення, формат чисел.
//
// Вираз — масив токенів { k, s, i?, r? }:
//   num   — число як набрано: «12», «0.», «3.5». Результат (r: true) може мати знак і порядок:
//           «-2.5», «1.5e+12»; цифра після нього починає нове число на його місці.
//   op    — '+', '-', '*', '/', '^'; i: true — неявне множення (2π, 2(…), 2√9).
//   neg   — мінус перед числом: «-5», «5×-3», «(-2)».
//   lp/rp — дужки; fn — функція разом із дужкою: sin cos tan ln lg sqrt;
//   const — pi, e; post — '%' (відсоток) або 'sq' (квадрат).
// Стан: { tokens, done, error, expr, deg }:
//   done  — щойно «=»: у tokens лише результат, expr — вираз, що його дав;
//   error — 'div0' | 'overflow' | 'domain' | 'syntax' після невдалого «=»;
//   deg   — тригонометрія в градусах (інакше в радіанах).

export const MAX_DIGITS = 12
export const MAX_TOKENS = 60
export const MAX_HISTORY = 30

const OPS = { '+': 1, '-': 1, '*': 1, '/': 1, '^': 1 }
const FNS = { sin: 1, cos: 1, tan: 1, ln: 1, lg: 1, sqrt: 1 }
const CONSTS = { pi: Math.PI, e: Math.E }
const POSTS = { '%': 1, sq: 1 }

// Символи на екрані. Сторінка замінює √, π, ², −, якщо їх немає в шрифті годинника.
export const SYM = { minus: '-', times: '×', div: '÷', sqrt: '√', pi: 'π', sq: '²' }

export function setSymbols(s) {
  Object.keys(s || {}).forEach((k) => {
    if (typeof s[k] === 'string' && s[k]) SYM[k] = s[k]
  })
}

export const ERRORS = {
  div0: 'Ділення на 0',
  overflow: 'Завелике число',
  domain: 'Не визначено',
  syntax: 'Помилка'
}

const TYPED_RE = /^\d*(\.\d*)?$/
const RESULT_RE = /^-?\d+(\.\d+)?(e[+-]\d{1,3})?$/

export function blank(deg) {
  return { tokens: [], done: false, error: '', expr: '', deg: deg !== false }
}

function top(st) {
  return st.tokens[st.tokens.length - 1]
}

function clone(st) {
  return {
    tokens: (st.tokens || []).map((t) => {
      const c = { k: t.k, s: t.s }
      if (t.i) c.i = true
      if (t.r) c.r = true
      return c
    }),
    done: !!st.done,
    error: st.error || '',
    expr: st.expr || '',
    deg: st.deg !== false
  }
}

function room(st, n) {
  return st.tokens.length + (n || 1) <= MAX_TOKENS
}

function isExp(t) {
  return t.k === 'num' && t.s.indexOf('e') >= 0
}

function digitCount(s) {
  return (s.match(/\d/g) || []).length
}

// Чекаємо операнд (число, дужку, функцію, константу)?
function operandNext(st) {
  const t = top(st)
  return !t || t.k === 'op' || t.k === 'neg' || t.k === 'lp' || t.k === 'fn'
}

function openCount(tokens) {
  let n = 0
  tokens.forEach((t) => {
    if (t.k === 'lp' || t.k === 'fn') n++
    else if (t.k === 'rp') n--
  })
  return n
}

function trimDot(st) {
  const t = top(st)
  if (t && t.k === 'num' && t.s.charAt(t.s.length - 1) === '.') t.s = t.s.slice(0, -1) || '0'
}

// ---------- введення ----------

function startFresh(st) {
  st.tokens = []
  st.done = false
  st.expr = ''
}

function continueResult(st) {
  st.done = false
  st.expr = ''
}

// Перед числом, дужкою, функцією чи константою після операнда — неявне множення.
function implicitTimes(st) {
  if (!operandNext(st)) {
    trimDot(st)
    st.tokens.push({ k: 'op', s: '*', i: true })
  }
}

function inputDigit(st, d) {
  if (st.done) startFresh(st)
  const t = top(st)
  if (t && t.k === 'num') {
    if (t.r || isExp(t)) {
      t.s = d
      delete t.r
      return
    }
    if (digitCount(t.s) >= MAX_DIGITS) return
    t.s = t.s === '0' ? d : t.s + d
    return
  }
  if (!room(st, 2)) return
  implicitTimes(st)
  st.tokens.push({ k: 'num', s: d })
}

function inputDot(st) {
  if (st.done) startFresh(st)
  const t = top(st)
  if (t && t.k === 'num') {
    if (t.r || isExp(t)) {
      t.s = '0.'
      delete t.r
      return
    }
    if (t.s.indexOf('.') < 0 && digitCount(t.s) < MAX_DIGITS) t.s += '.'
    return
  }
  if (!room(st, 2)) return
  implicitTimes(st)
  st.tokens.push({ k: 'num', s: '0.' })
}

function inputOp(st, o) {
  if (st.done) continueResult(st)
  const t = top(st)
  if (!t || t.k === 'lp' || t.k === 'fn') {
    // на початку (чи після дужки) лише мінус — від'ємне число
    if (o === '-' && room(st)) st.tokens.push({ k: 'neg', s: '-' })
    return
  }
  if (t.k === 'neg') {
    if (o === '-') return
    // «5×-» і інша операція: мінус геть, операція замінюється
    st.tokens.pop()
    const p = top(st)
    if (p && p.k === 'op') {
      p.s = o
      delete p.i
    }
    return
  }
  if (t.k === 'op') {
    if (o === '-' && t.s !== '+' && t.s !== '-') {
      if (room(st)) st.tokens.push({ k: 'neg', s: '-' })
      return
    }
    t.s = o
    delete t.i
    return
  }
  trimDot(st)
  if (room(st)) st.tokens.push({ k: 'op', s: o })
}

function inputParen(st, open) {
  if (open) {
    if (st.done) startFresh(st)
    if (!room(st, 2)) return
    implicitTimes(st)
    st.tokens.push({ k: 'lp', s: '(' })
    return
  }
  if (st.done || operandNext(st) || openCount(st.tokens) <= 0 || !room(st)) return
  trimDot(st)
  st.tokens.push({ k: 'rp', s: ')' })
}

// Функція після «=» береться від результату: √ → √(25.
function inputFn(st, name) {
  if (st.done) {
    const r = st.tokens[0]
    continueResult(st)
    st.tokens = [{ k: 'fn', s: name }]
    if (r) st.tokens.push(r)
    return
  }
  if (!room(st, 2)) return
  implicitTimes(st)
  st.tokens.push({ k: 'fn', s: name })
}

function inputConst(st, name) {
  if (st.done) startFresh(st)
  if (!room(st, 2)) return
  implicitTimes(st)
  st.tokens.push({ k: 'const', s: name })
}

// %, x² — до числа, дужки, константи чи результату.
function inputPost(st, p) {
  if (st.done) continueResult(st)
  const t = top(st)
  if (!t || operandNext(st) || !room(st)) return
  if (p === '%' && t.k === 'post' && t.s === '%') return
  trimDot(st)
  st.tokens.push({ k: 'post', s: p })
}

function inputBack(st) {
  if (st.done) {
    startFresh(st)
    return
  }
  const t = top(st)
  if (!t) return
  if (t.k === 'num' && !t.r && !isExp(t)) {
    t.s = t.s.slice(0, -1)
    if (!t.s) st.tokens.pop()
  } else {
    st.tokens.pop()
  }
  // неявне множення само не лишається
  const p = top(st)
  if (p && p.k === 'op' && p.i) st.tokens.pop()
}

// Клавіша: '0'…'9', '.', '+', '-', '*', '/', '^', '(', ')', '%', 'sq',
// 'sin' 'cos' 'tan' 'ln' 'lg' 'sqrt', 'pi' 'e', 'back', 'clear', 'deg', '='.
// Повертає { state, entry }: entry — запис для історії після вдалого «=».
export function press(state, key) {
  const st = clone(state)
  st.error = ''
  if (key === '=') return equals(st)
  if (key === 'clear') return { state: blank(st.deg), entry: null }
  if (key === 'deg') st.deg = !st.deg
  else if (/^\d$/.test(key)) inputDigit(st, key)
  else if (key === '.') inputDot(st)
  else if (OPS[key]) inputOp(st, key)
  else if (key === '(' || key === ')') inputParen(st, key === '(')
  else if (FNS[key]) inputFn(st, key)
  else if (CONSTS[key] !== undefined) inputConst(st, key)
  else if (POSTS[key]) inputPost(st, key)
  else if (key === 'back') inputBack(st)
  return { state: st, entry: null }
}

// Вираз, готовий до обчислення: без незавершеного хвоста, із закритими дужками.
function workList(tokens) {
  const list = tokens.slice()
  for (;;) {
    const t = list[list.length - 1]
    if (t && (t.k === 'op' || t.k === 'neg' || t.k === 'lp' || t.k === 'fn')) list.pop()
    else break
  }
  for (let n = openCount(list); n > 0; n--) list.push({ k: 'rp', s: ')' })
  return list
}

// Є що рахувати (не просто одне число)?
function hasWork(list) {
  return list.length > 1 || (list.length === 1 && list[0].k !== 'num')
}

function equals(st) {
  if (st.done) return { state: st, entry: null }
  const work = workList(st.tokens)
  const r = evaluate(st.tokens, st.deg)
  if (r.empty) return { state: st, entry: null }
  if (r.error) {
    st.error = r.error
    return { state: st, entry: null }
  }
  const token = { k: 'num', s: toTokenString(r.value), r: true }
  const counted = hasWork(work)
  const expr = counted ? formatExpression(work) : ''
  return {
    state: { tokens: [token], done: true, error: '', expr, deg: st.deg },
    entry: counted ? { e: expr, r: formatToken(token.s, true), v: token.s } : null
  }
}

// ---------- обчислення ----------

function fail(code) {
  throw new Error(code)
}

// Тригонометрія без «1,22e-16» замість нуля: кратні 90° — точно, решта округлюється.
function trig(name, x, deg) {
  if (deg) {
    const a = ((x % 360) + 360) % 360
    if (a % 90 === 0) {
      const q = a / 90
      if (name === 'sin') return [0, 1, 0, -1][q]
      if (name === 'cos') return [1, 0, -1, 0][q]
      if (q % 2 === 1) fail('domain')
      return 0
    }
    x = (x * Math.PI) / 180
  }
  let v
  if (name === 'tan') {
    const c = Math.cos(x)
    if (Math.abs(c) < 1e-12) fail('domain')
    v = Math.sin(x) / c
  } else v = name === 'sin' ? Math.sin(x) : Math.cos(x)
  return Math.abs(v) < 1e-14 ? 0 : v
}

function applyFn(name, x, deg) {
  if (name === 'sin' || name === 'cos' || name === 'tan') return trig(name, x, deg)
  if (name === 'sqrt') {
    if (x < 0) fail('domain')
    return Math.sqrt(x)
  }
  if (x <= 0) fail('domain')
  return name === 'ln' ? Math.log(x) : Math.log(x) / Math.LN10
}

// Розбір з пріоритетами: + − < × ÷ < мінус перед числом < ^ (справа наліво) < %, ² < дужки.
// Відсотки як на телефоні: «200 + 10%» = 220, «200 − 10%» = 180, «200 × 10%» = 20, «50%» = 0,5.
function parse(list, deg) {
  let i = 0
  const peek = () => list[i]
  const isOp = (t, chars) => t && t.k === 'op' && chars.indexOf(t.s) >= 0

  function expr() {
    let left = term()
    while (isOp(peek(), '+-')) {
      const op = list[i++].s
      const right = term()
      const rv = right.pct !== null ? (left.v * right.pct) / 100 : right.v
      left = { v: op === '+' ? left.v + rv : left.v - rv, pct: null }
    }
    return left
  }

  function term() {
    let left = unary()
    while (isOp(peek(), '*/')) {
      const op = list[i++].s
      const right = unary()
      if (op === '/' && right.v === 0) fail('div0')
      left = { v: op === '*' ? left.v * right.v : left.v / right.v, pct: null }
    }
    return left
  }

  function unary() {
    if (peek() && peek().k === 'neg') {
      i++
      const u = unary()
      return { v: -u.v, pct: u.pct !== null ? -u.pct : null }
    }
    return power()
  }

  function power() {
    const base = postfix()
    if (isOp(peek(), '^')) {
      i++
      const exp = unary()
      const v = Math.pow(base.v, exp.v)
      if (isNaN(v)) fail('domain')
      return { v, pct: null }
    }
    return base
  }

  function postfix() {
    let p = primary()
    while (peek() && peek().k === 'post') {
      const t = list[i++]
      p = t.s === '%' ? { v: p.v / 100, pct: p.v } : { v: p.v * p.v, pct: null }
    }
    return p
  }

  function primary() {
    const t = list[i++]
    if (!t) fail('syntax')
    if (t.k === 'num') {
      const v = parseFloat(t.s)
      if (isNaN(v)) fail('syntax')
      return { v, pct: null }
    }
    if (t.k === 'const') return { v: CONSTS[t.s], pct: null }
    if (t.k === 'lp' || t.k === 'fn') {
      const inner = expr()
      const close = list[i++]
      if (!close || close.k !== 'rp') fail('syntax')
      return { v: t.k === 'fn' ? applyFn(t.s, inner.v, deg) : inner.v, pct: null }
    }
    fail('syntax')
  }

  const r = expr()
  if (i !== list.length) fail('syntax')
  return r.v
}

export function evaluate(tokens, deg) {
  const list = workList(tokens || [])
  if (!list.length) return { empty: true }
  try {
    const v = parse(list, deg !== false)
    if (typeof v !== 'number' || isNaN(v)) return { error: 'syntax' }
    if (!isFinite(v)) return { error: 'overflow' }
    return { value: v }
  } catch (e) {
    const code = e && e.message
    return { error: ERRORS[code] ? code : 'syntax' }
  }
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

// Токен числа → текст: кома замість крапки; group — пробіли між тисячами.
export function formatToken(s, group) {
  let body = String(s)
  let sign = ''
  if (body.charAt(0) === '-') {
    sign = SYM.minus
    body = body.slice(1)
  }
  const e = body.indexOf('e')
  if (e >= 0) {
    let exp = body.slice(e + 1)
    if (exp.charAt(0) === '+') exp = exp.slice(1)
    return sign + body.slice(0, e).replace('.', ',') + 'e' + exp.replace('-', SYM.minus)
  }
  const dot = body.indexOf('.')
  const int = dot >= 0 ? body.slice(0, dot) : body
  return sign + (group ? groupDigits(int) : int) + (dot >= 0 ? ',' + body.slice(dot + 1) : '')
}

export function formatNumber(value) {
  if (typeof value !== 'number' || !isFinite(value)) return ''
  return formatToken(toTokenString(value), true)
}

function tokenText(t, next) {
  switch (t.k) {
    case 'num':
      return formatToken(t.s, false)
    case 'op':
      if (t.i) return next && next.k === 'num' ? SYM.times : ''
      return { '+': '+', '-': SYM.minus, '*': SYM.times, '/': SYM.div, '^': '^' }[t.s]
    case 'neg':
      return SYM.minus
    case 'lp':
      return '('
    case 'rp':
      return ')'
    case 'fn':
      return (t.s === 'sqrt' ? SYM.sqrt : t.s) + '('
    case 'const':
      return t.s === 'pi' ? SYM.pi : 'e'
    case 'post':
      return t.s === '%' ? '%' : SYM.sq
    default:
      return ''
  }
}

// Як у Xiaomi — без пробілів: «12+7×3», «2π», «√(9)».
export function formatExpression(tokens) {
  return tokens.map((t, i) => tokenText(t, tokens[i + 1])).join('')
}

// Що показати:
//   typing — expr (великим), preview: «= 14» сірим, якщо є що рахувати;
//   done   — expr (дрібно), result: «= 14» великим (якщо виразу немає — просто число);
//   error  — expr і текст помилки.
export function display(state) {
  const st = clone(state)
  if (st.error) return { mode: 'error', expr: formatExpression(st.tokens), result: ERRORS[st.error] || ERRORS.syntax }
  if (st.done && st.tokens.length) {
    const num = formatToken(st.tokens[0].s, true)
    return { mode: 'done', expr: st.expr, result: st.expr ? '= ' + num : num }
  }
  if (!st.tokens.length) return { mode: 'typing', expr: '0', preview: '' }
  let preview = ''
  if (hasWork(workList(st.tokens))) {
    const r = evaluate(st.tokens, st.deg)
    if (r.value !== undefined) preview = '= ' + formatNumber(r.value)
  }
  return { mode: 'typing', expr: formatExpression(st.tokens), preview }
}

// Чи є у виразі тригонометрія (тоді на екрані видно DEG / RAD).
export function hasTrig(state) {
  const list = state.done ? [] : state.tokens || []
  return list.some((t) => t.k === 'fn' && (t.s === 'sin' || t.s === 'cos' || t.s === 'tan'))
}

// ---------- збереження ----------

function validToken(t) {
  if (!t || typeof t.s !== 'string') return false
  if (t.k === 'num') return t.r ? RESULT_RE.test(t.s) : t.s !== '' && TYPED_RE.test(t.s)
  if (t.k === 'op') return !!OPS[t.s]
  if (t.k === 'neg') return t.s === '-'
  if (t.k === 'lp') return t.s === '('
  if (t.k === 'rp') return t.s === ')'
  if (t.k === 'fn') return !!FNS[t.s]
  if (t.k === 'const') return CONSTS[t.s] !== undefined
  if (t.k === 'post') return !!POSTS[t.s]
  return false
}

// Версія 1.0 зберігала числа зі знаком і відсотком усередині («-5», «50%»).
function upgradeV1(tokens) {
  const out = []
  tokens.forEach((t) => {
    if (!t || t.k !== 'num' || typeof t.s !== 'string') {
      out.push(t)
      return
    }
    let s = t.s
    let pct = false
    if (s.charAt(s.length - 1) === '%') {
      pct = true
      s = s.slice(0, -1)
    }
    if (s.charAt(0) === '-' && !/e/.test(s)) {
      out.push({ k: 'neg', s: '-' })
      s = s.slice(1)
    }
    if (s) out.push(/e/.test(s) ? { k: 'num', s, r: true } : { k: 'num', s })
    if (pct) out.push({ k: 'post', s: '%' })
  })
  return out
}

export function restoreState(raw) {
  try {
    if (!raw || !Array.isArray(raw.tokens) || raw.tokens.length > MAX_TOKENS) return blank()
    const deg = raw.deg !== false
    const src = raw.v2 ? raw.tokens : upgradeV1(raw.tokens)
    const tokens = []
    for (let i = 0; i < src.length; i++) {
      const t = src[i]
      if (!validToken(t)) return blank(deg)
      const c = { k: t.k, s: t.s }
      if (t.i && t.k === 'op' && t.s === '*') c.i = true
      if (t.r && t.k === 'num') c.r = true
      tokens.push(c)
    }
    if (tokens.length > MAX_TOKENS) return blank(deg)
    const done = !!raw.done && tokens.length === 1 && tokens[0].k === 'num' && RESULT_RE.test(tokens[0].s)
    if (done) tokens[0].r = true
    return { tokens, done, error: '', expr: done && typeof raw.expr === 'string' ? raw.expr.slice(0, 300) : '', deg }
  } catch (e) {
    return blank()
  }
}

// Для збереження у файл: з позначкою версії токенів.
export function packState(st) {
  return { v2: true, tokens: st.tokens, done: st.done, expr: st.expr, deg: st.deg !== false }
}

export function restoreHistory(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((h) => h && typeof h.e === 'string' && typeof h.r === 'string' && typeof h.v === 'string' && RESULT_RE.test(h.v))
    .slice(0, MAX_HISTORY)
    .map((h) => ({ e: h.e.slice(0, 300), r: h.r.slice(0, 40), v: h.v }))
}
