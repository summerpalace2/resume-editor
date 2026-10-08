/** @file 无序列表段落操作；圆点保留为纯文本，格式按精确插入/删除位置映射。 */
import type { TextFormatRange } from '../types'
import { normalizeFormats } from './textFormatting'

interface Paragraph {
  start: number
  end: number
  indent: number
  markerLength: number
}

export interface ListEditResult {
  text: string
  formats: TextFormatRange[]
  selection: { start: number; end: number }
}

/** 选区结束在下一行开头时不处理下一行；空白段落不生成空列表项。 */
function selectedParagraphs(text: string, start: number, end: number): Paragraph[] {
  if (start < 0 || end < start || end > text.length) return []
  let offset = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1
  const last = end > start ? end - 1 : start
  const paragraphs: Paragraph[] = []
  while (offset <= last) {
    const newline = text.indexOf('\n', offset)
    const lineEnd = newline === -1 ? text.length : newline
    const content = text.slice(offset, lineEnd)
    if (content.trim()) {
      const indent = content.match(/^[\t ]*/u)![0].length
      const marker = content.slice(indent).match(/^•[\t ]?/u)
      paragraphs.push({
        start: offset,
        end: lineEnd,
        indent,
        markerLength: marker?.[0].length ?? 0,
      })
    }
    if (lineEnd >= last) break
    offset = lineEnd + 1
  }
  return paragraphs
}

export function hasUnorderedList(text: string, start: number, end: number): boolean {
  const paragraphs = selectedParagraphs(text, start, end)
  return (
    paragraphs.length > 0 && paragraphs.every((paragraph) => paragraph.markerLength > 0)
  )
}

/** 全部已有圆点时取消，否则只补缺失圆点；从后往前修改，保留正文原有加粗和颜色。 */
export function toggleUnorderedList(
  text: string,
  formats: TextFormatRange[],
  start: number,
  end: number,
): ListEditResult {
  const paragraphs = selectedParagraphs(text, start, end)
  if (!paragraphs.length) return { text, formats, selection: { start, end } }
  const removing = paragraphs.every((paragraph) => paragraph.markerLength > 0)
  let nextText = text
  let nextFormats = formats
  let deltaTotal = 0
  for (const paragraph of [...paragraphs].reverse()) {
    if (!removing && paragraph.markerLength) continue
    const from = paragraph.start + paragraph.indent
    const to = from + (removing ? paragraph.markerLength : 0)
    const replacement = removing ? '' : '• '
    const delta = replacement.length - (to - from)
    const ranges: TextFormatRange[] = []
    for (const range of nextFormats) {
      if (range.start < from) ranges.push({ ...range, end: Math.min(range.end, from) })
      if (range.end > to)
        ranges.push({
          ...range,
          start: Math.max(range.start, to) + delta,
          end: range.end + delta,
        })
    }
    nextText = nextText.slice(0, from) + replacement + nextText.slice(to)
    nextFormats = normalizeFormats(ranges)
    deltaTotal += delta
  }
  return {
    text: nextText,
    formats: nextFormats,
    selection: { start: paragraphs[0]!.start, end: paragraphs.at(-1)!.end + deltaTotal },
  }
}
