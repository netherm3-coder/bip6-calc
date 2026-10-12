// Стан калькулятора й історія — у файлі на годиннику, щоб нічого не губилось,
// коли екран гасне й програма закривається.

import { readFileSync, writeFileSync, renameSync, rmSync, statSync } from '@zos/fs'
import { blank, restoreState, restoreHistory } from './calc'

const FILE = 'calc.json'
const TMP = 'calc.tmp'

function readJson(path) {
  try {
    if (!statSync({ path })) return null
    const raw = readFileSync({ path, options: { encoding: 'utf8' } })
    if (typeof raw !== 'string' || !raw.length) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export function loadData() {
  const raw = readJson(FILE) || readJson(TMP)
  if (!raw) return { state: blank(), history: [] }
  return { state: restoreState(raw.state), history: restoreHistory(raw.history) }
}

export function saveData(data) {
  const text = JSON.stringify({ v: 1, state: data.state, history: data.history })
  try {
    writeFileSync({ path: TMP, data: text, options: { encoding: 'utf8' } })
    if (renameSync({ oldPath: TMP, newPath: FILE }) === 0) return true
    rmSync({ path: FILE })
    if (renameSync({ oldPath: TMP, newPath: FILE }) === 0) return true
  } catch (e) {}
  try {
    writeFileSync({ path: FILE, data: text, options: { encoding: 'utf8' } })
    return true
  } catch (e) {
    return false
  }
}
