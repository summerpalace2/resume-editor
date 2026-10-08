/** @file 编辑内核的临时文档适配；持久化仍使用纯文本和格式区间，不存 HTML。 */
import type { JSONContent } from '@tiptap/vue-3'
import type { TextFormatRange } from '../types'
import { normalizeFormats, textParagraphs, textSegments } from '../domain/textFormatting'

export interface TextSelection {
  start: number
  end: number
}
export interface RichTextDraft {
  text: string
  formats: TextFormatRange[]
}

/** 浏览器可能把 span 的十六进制样式读回 rgb；统一成现有备份允许的六位颜色。 */
function storedColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (/^#[\da-f]{6}$/iu.test(value)) return value.toLowerCase()
  const rgb = value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u)
  if (!rgb) return undefined
  const channels = rgb.slice(1).map(Number)
  return channels.every((channel) => channel <= 255)
    ? `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
    : undefined
}

export function toRichDocument(
  text: string,
  formats: TextFormatRange[],
  multiline: boolean,
): JSONContent {
  const parts = multiline
    ? textParagraphs(text, formats).map((paragraph) => paragraph.segments)
    : [textSegments(text, formats)]
  return {
    type: 'doc',
    content: parts.map((segments) => ({
      type: 'paragraph',
      content: segments
        .filter((segment) => segment.text.length > 0)
        .map((segment) => ({
          type: 'text',
          text: multiline ? segment.text : segment.text.replace(/\r\n|\r|\n/gu, ' '),
          marks: [
            ...(segment.bold ? [{ type: 'bold' }] : []),
            ...(segment.color
              ? [{ type: 'textStyle', attrs: { color: segment.color } }]
              : []),
          ],
        })),
    })),
  }
}

/** 只读取 schema 中的段落、文字及允许的样式，所有位置仍以 UTF-16 计。 */
export function fromRichDocument(document: JSONContent): RichTextDraft {
  let text = ''
  const formats: TextFormatRange[] = []
  for (const [index, paragraph] of (document.content ?? []).entries()) {
    if (index) text += '\n'
    for (const node of paragraph.content ?? []) {
      const content = node.type === 'hardBreak' ? '\n' : (node.text ?? '')
      const start = text.length
      text += content
      const bold = node.marks?.some((mark) => mark.type === 'bold')
      const color = node.marks?.find((mark) => mark.type === 'textStyle')?.attrs?.color
      const safeColor = storedColor(color)
      if (content && (bold || safeColor))
        formats.push({
          start,
          end: text.length,
          ...(bold ? { bold: true } : {}),
          ...(safeColor ? { color: safeColor } : {}),
        })
    }
  }
  return { text, formats: normalizeFormats(formats) }
}

function paragraphLength(paragraph: JSONContent): number {
  return (paragraph.content ?? []).reduce(
    (length, node) => length + (node.type === 'hardBreak' ? 1 : (node.text?.length ?? 0)),
    0,
  )
}

/** 编辑内核的段落有开/闭位置，纯文本只有一个换行；不能直接共用原生 Range 偏移。 */
export function toEditorPosition(document: JSONContent, offset: number): number {
  let textStart = 0
  let editorStart = 1
  for (const paragraph of document.content ?? []) {
    const length = paragraphLength(paragraph)
    if (offset <= textStart + length) return editorStart + Math.max(0, offset - textStart)
    textStart += length + 1
    editorStart += length + 2
  }
  return Math.max(1, editorStart - 2)
}

export function fromEditorPosition(document: JSONContent, position: number): number {
  let textStart = 0
  let editorStart = 1
  for (const paragraph of document.content ?? []) {
    const length = paragraphLength(paragraph)
    if (position <= editorStart + length)
      return textStart + Math.max(0, position - editorStart)
    textStart += length + 1
    editorStart += length + 2
  }
  return Math.max(0, textStart - 1)
}
