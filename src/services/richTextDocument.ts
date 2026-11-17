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
            ...(segment.italic ? [{ type: 'italic' }] : []),
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
      const italic = node.marks?.some((mark) => mark.type === 'italic')
      const color = node.marks?.find((mark) => mark.type === 'textStyle')?.attrs?.color
      const safeColor = storedColor(color)
      if (content && (bold || italic || safeColor))
        formats.push({
          start,
          end: text.length,
          ...(bold ? { bold: true } : {}),
          ...(italic ? { italic: true } : {}),
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

const PASTE_BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TR',
  'BLOCKQUOTE',
  'PRE',
])

const PASTE_SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'TITLE', 'NOSCRIPT', 'LINK'])

function isPasteBlock(element: Element): boolean {
  if (PASTE_BLOCK_TAGS.has(element.tagName)) return true
  if (element.classList.contains('formatted-paragraph')) return true
  const style = element.getAttribute('style') ?? ''
  return /(?:^|;)\s*display\s*:\s*block\b/iu.test(style)
}

function hasNestedPasteBlock(element: Element): boolean {
  for (const child of Array.from(element.children)) {
    if (isPasteBlock(child) || hasNestedPasteBlock(child)) return true
  }
  return false
}

function extractInlineLines(node: Node, inPre: boolean): string[] {
  const lines = ['']
  const walkInline = (current: Node, pre: boolean): void => {
    if (current.nodeType === Node.TEXT_NODE) {
      const raw = (current.textContent ?? '').replace(/\r\n|\r/gu, '\n')
      if (pre) {
        const parts = raw.split('\n')
        lines[lines.length - 1] += parts[0] ?? ''
        for (let i = 1; i < parts.length; i++) lines.push(parts[i]!)
      } else {
        lines[lines.length - 1] += raw.replace(/\n+/gu, ' ')
      }
      return
    }
    if (current.nodeType !== Node.ELEMENT_NODE) return
    const el = current as Element
    if (
      PASTE_SKIP_TAGS.has(el.tagName) ||
      el.classList.contains('paragraph-break') ||
      el.classList.contains('ProseMirror-trailingBreak')
    )
      return
    if (el.tagName === 'BR') {
      lines.push('')
      return
    }
    const nextPre = pre || el.tagName === 'PRE'
    for (const child of Array.from(el.childNodes)) walkInline(child, nextPre)
  }
  walkInline(node, inPre)
  // 空块内的单个占位 <br>（如 <p><br></p>）只代表一个空段落，不应拆出两行。
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    lines.length === 2 &&
    lines[0] === '' &&
    lines[1] === ''
  ) {
    return ['']
  }
  // 块末尾的单个 <br> 仅作换行占位（如 Word/浏览器复制时行末附带的 <br>）。
  if (lines.length > 1 && lines.at(-1) === '') {
    lines.pop()
  }
  return lines
}

/**
 * 浏览器复制多段 <p> 或块级 span 时会在 text/plain 中插入双换行（\n\n），
 * 优先解析 text/html 的块结构以还原真实行数，无 HTML 时回退规范化纯文本。
 */
export function extractPlainPasteText(clipboardData: DataTransfer | null): string {
  const plain = (clipboardData?.getData('text/plain') ?? '').replace(/\r\n|\r/gu, '\n')
  const html = clipboardData?.getData('text/html') ?? ''
  if (
    !html ||
    typeof DOMParser === 'undefined' ||
    !/<(?:p|div|li|h[1-6]|tr|blockquote|pre)\b|formatted-paragraph|display\s*:\s*block/iu.test(
      html,
    )
  ) {
    return plain
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const blocks: string[] = []
  let inlineBuffer = ''

  const flushInline = (): void => {
    const trimmed = inlineBuffer.replace(/^\n+|\n+$/gu, '')
    if (trimmed) blocks.push(trimmed)
    inlineBuffer = ''
  }

  const walk = (container: Element, inPre: boolean): void => {
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const raw = (child.textContent ?? '').replace(/\r\n|\r/gu, '\n')
        // 块标签之间的纯缩进/换行空白不作为正文内容。
        if (!raw.trim() && raw.includes('\n') && !inPre) continue
        inlineBuffer += inPre ? raw : raw.replace(/\n+/gu, ' ')
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const el = child as Element
      if (
        PASTE_SKIP_TAGS.has(el.tagName) ||
        el.classList.contains('paragraph-break') ||
        el.classList.contains('ProseMirror-trailingBreak')
      )
        continue
      if (el.tagName === 'BR') {
        flushInline()
        blocks.push('')
        continue
      }
      if (isPasteBlock(el)) {
        flushInline()
        if (hasNestedPasteBlock(el)) {
          walk(el, inPre || el.tagName === 'PRE')
        } else {
          blocks.push(...extractInlineLines(el, inPre || el.tagName === 'PRE'))
        }
        continue
      }
      inlineBuffer += extractInlineLines(el, inPre).join('\n')
    }
  }

  walk(parsed.body, false)
  flushInline()
  return blocks.length ? blocks.join('\n') : plain
}
