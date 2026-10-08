/** @file 局部文字样式的区间运算；保留纯文本，展示端只渲染安全 span。 */
import type { TextFormatRange } from '../types'

export interface TextSegment {
  text: string
  start: number
  end: number
  bold?: true
  color?: string
}

export interface TextParagraph {
  start: number
  segments: TextSegment[]
  /** 原始分段符保留在 DOM 文本中，保证拖选位置仍与纯文本格式区间一致。 */
  breakText: string
}

function sameStyle(
  a: Pick<TextFormatRange, 'bold' | 'color'>,
  b: Pick<TextFormatRange, 'bold' | 'color'>,
): boolean {
  return a.bold === b.bold && a.color === b.color
}

/** 避免在 emoji 等代理对中间切段，保持显示字符完整。 */
export function splitsSurrogate(text: string, position: number): boolean {
  if (position <= 0 || position >= text.length) return false
  const previous = text.charCodeAt(position - 1)
  const next = text.charCodeAt(position)
  return previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
}

/** 合并相邻相同样式，空样式不进入持久化数据。 */
export function normalizeFormats(ranges: TextFormatRange[]): TextFormatRange[] {
  const result: TextFormatRange[] = []
  for (const range of ranges) {
    if (range.start >= range.end || (!range.bold && !range.color)) continue
    const previous = result.at(-1)
    if (previous && previous.end === range.start && sameStyle(previous, range))
      previous.end = range.end
    else result.push({ ...range })
  }
  return result
}

/** 输入修改按共同前后缀映射位置；被替换的文字移除格式，新插入文字使用默认样式。 */
export function rebaseFormats(
  before: string,
  after: string,
  ranges: TextFormatRange[] = [],
): TextFormatRange[] {
  if (before === after) return ranges.map((range) => ({ ...range }))
  let prefix = 0
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  )
    prefix++
  if (splitsSurrogate(before, prefix) || splitsSurrogate(after, prefix)) prefix--
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++
  if (
    splitsSurrogate(before, before.length - suffix) ||
    splitsSurrogate(after, after.length - suffix)
  )
    suffix--
  const oldEnd = before.length - suffix
  const delta = after.length - before.length
  const result: TextFormatRange[] = []
  for (const range of ranges) {
    if (range.start < prefix) result.push({ ...range, end: Math.min(range.end, prefix) })
    if (range.end > oldEnd)
      result.push({
        ...range,
        start: Math.max(range.start, oldEnd) + delta,
        end: range.end + delta,
      })
  }
  return normalizeFormats(result)
}

/** 把格式边界拆为连续片段，未标记区间继承模板字体与颜色。 */
export function textSegments(
  text: string,
  ranges: TextFormatRange[] = [],
): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor)
      segments.push({
        text: text.slice(cursor, range.start),
        start: cursor,
        end: range.start,
      })
    segments.push({ text: text.slice(range.start, range.end), ...range })
    cursor = range.end
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), start: cursor, end: text.length })
  return segments
}

/** 只按显式换行拆段，段内自动折行交给 CSS；跨段样式按原始索引裁剪。 */
export function textParagraphs(
  text: string,
  ranges: TextFormatRange[] = [],
): TextParagraph[] {
  const segments = textSegments(text, ranges)
  const paragraphs: TextParagraph[] = []
  const append = (start: number, end: number, breakText: string) => {
    paragraphs.push({
      start,
      breakText,
      segments: segments
        .filter((segment) => segment.end > start && segment.start < end)
        .map((segment) => {
          const left = Math.max(start, segment.start)
          const right = Math.min(end, segment.end)
          return { ...segment, start: left, end: right, text: text.slice(left, right) }
        }),
    })
  }
  let start = 0
  for (const separator of text.matchAll(/\r\n|\r|\n/gu)) {
    append(start, separator.index, separator[0])
    start = separator.index + separator[0].length
  }
  append(start, text.length, '')
  return paragraphs
}

/** 修改选区的一个样式属性，保留其他属性；清除时恢复模板默认样式。 */
export function formatSelection(
  text: string,
  ranges: TextFormatRange[],
  start: number,
  end: number,
  patch: { bold?: boolean; color?: string; clear?: boolean },
): TextFormatRange[] {
  if (start < 0 || start >= end || end > text.length) return ranges
  if (splitsSurrogate(text, start)) start--
  if (splitsSurrogate(text, end)) end++
  const boundaries = [
    ...new Set([
      0,
      text.length,
      start,
      end,
      ...ranges.flatMap((range) => [range.start, range.end]),
    ]),
  ].sort((a, b) => a - b)
  const result: TextFormatRange[] = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    const left = boundaries[i]!
    const right = boundaries[i + 1]!
    const existing = ranges.find((range) => range.start <= left && range.end >= right)
    const range: TextFormatRange = {
      start: left,
      end: right,
      ...(existing?.bold ? { bold: true } : {}),
      ...(existing?.color ? { color: existing.color } : {}),
    }
    if (left >= start && right <= end) {
      if (patch.clear) {
        delete range.bold
        delete range.color
      } else {
        if (patch.bold !== undefined) {
          if (patch.bold) range.bold = true
          else delete range.bold
        }
        if (patch.color !== undefined) range.color = patch.color.toLowerCase()
      }
    }
    result.push(range)
  }
  return normalizeFormats(result)
}
