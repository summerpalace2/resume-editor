/**
 * @file 将浏览器提取的 PDF 页面元素（文字、颜色、加粗、链接、色块）映射为简历文档。
 * 属于纯领域逻辑，不依赖 Vue、DOM、Pinia 或 pdfjs-dist。
 */
import { appearanceDefaults, createResume } from '../data/defaultResume'
import { resumePalettes } from '../data/palettes'
import { getResumeTemplate } from '../data/templates'
import { baseFontOptions, headerFontOptions } from '../data/typography'
import type {
  AccentChoice,
  ResumeDocument,
  ResumeEntry,
  ResumeSection,
  ResumeTemplateId,
  SectionColumn,
  SectionKind,
  TextFormatRange,
} from '../types'
import { createEntry, createSection } from './factories'
import { externalUrl, githubLabel, githubUrl } from './links'
import { normalizeFormats, splitsSurrogate } from './textFormatting'
import { parseResumeDocument } from './validation'

export interface PdfTextRun {
  text: string
  color: string
  bold: boolean
  italic?: boolean
}

export interface PdfTextSpan {
  text: string
  runs: PdfTextRun[]
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  color: string
  bold: boolean
  italic?: boolean
  hasEOL: boolean
}

export interface PdfLinkBox {
  url: string
  x: number
  y: number
  width: number
  height: number
}

export interface PdfFillRect {
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface PdfPageContent {
  pageNumber: number
  width: number
  height: number
  spans: PdfTextSpan[]
  links: PdfLinkBox[]
  fillRects: PdfFillRect[]
}

export interface ParsedPdfContent {
  fileName: string
  pages: PdfPageContent[]
}

export interface PdfImportSummary {
  resume: ResumeDocument
  pageCount: number
  sectionCount: number
  entryCount: number
  linkCount: number
  extractedLinks: string[]
  formatRangeCount: number
  coloredRangeCount: number
  boldRangeCount: number
  matchedPaletteName: string
  matchedTemplateName: string
  warnings: string[]
}

interface StyledText {
  text: string
  formats: TextFormatRange[]
}

interface VisualLine {
  pageNumber: number
  x: number
  y: number
  right: number
  height: number
  fontSize: number
  styled: StyledText
  spans: PdfTextSpan[]
  links: string[]
  onDarkBackground: boolean
  column?: SectionColumn
}

interface RgbColor {
  r: number
  g: number
  b: number
}

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE_REGEX = /(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:\d{3,4}[-\s])?\d{7,8}/
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>()]+|github\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*/gi
const PERIOD_REGEX =
  /(?:(?:19|20)\d{2}\s*[./年-]\s*(?:1[0-2]|0?[1-9])\s*(?:月(?:\s*\d{1,2}\s*日?)?|[./-]\s*\d{1,2})?|(?:1[0-2]|0?[1-9])\/(?:19|20)\d{2}|现今|至今|今|Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})\s*(?:[-–—~至到]+|\bto\b)\s*(?:(?:19|20)\d{2}\s*[./年-]\s*(?:1[0-2]|0?[1-9])\s*(?:月(?:\s*\d{1,2}\s*日?)?|[./-]\s*\d{1,2})?|(?:1[0-2]|0?[1-9])\/(?:19|20)\d{2}|至今|现在|今|Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(?:19|20)\d{2})/i
const YEAR_RANGE_REGEX =
  /(?:19|20)\d{2}\s*[-–—~至到]+\s*(?:(?:19|20)\d{2}|至今|现在|今|Present|Current)/i

const SECTION_KIND_RULES: { kind: SectionKind; patterns: RegExp[] }[] = [
  {
    kind: 'education',
    patterns: [/教育(?:经历|背景)|学历背景|学习经历|^education$/i, /^academic/i],
  },
  {
    kind: 'work',
    patterns: [
      /工作(?:经历|经验)|实习(?:经历|经验)|实践(?:经历|经验)|任职经历|职业经历/i,
      /^(?:work\s*)?experience$|^internships?$/i,
    ],
  },
  {
    kind: 'projects',
    patterns: [
      /项目(?:经历|经验|作品)|个人项目|主要项目/i,
      /^(?:selected\s*)?projects?$/i,
    ],
  },
  {
    kind: 'skills',
    patterns: [
      /专业技能|个人能力|技能特长|技术栈|核心技能|能力特长|IT技能/i,
      /^(?:technical\s*)?skills?$/i,
    ],
  },
  {
    kind: 'awards',
    patterns: [
      /荣誉(?:证书|奖项)?|获奖(?:情况|经历)|奖项荣誉|资格证书|证书/i,
      /^awards?$|^honors?$|^certifications?$/i,
    ],
  },
  {
    kind: 'custom',
    patterns: [
      /自我评价|个人总结|个人简介|个人优势|学校经历|校园经历|在校经历|社团经历|科研经历|发表论文|语言能力|兴趣爱好/i,
      /^summary$|^about(?:\s+me)?$|^publications?$|^research$|^languages?$/i,
    ],
  },
]

const HEADER_ROLE_HINT_REGEX =
  /工程师|开发|架构|实习|设计|产品|算法|测试|运维|运营|分析|经理|总监|主管|顾问|研究员|前端|后端|全栈|客户端|Engineer|Developer|Designer|Manager|Analyst|Intern|Architect/i

const BULLET_PREFIX_REGEX = /^[•·▪▫◦●○■□◆◇▶►\-*+]\s*|^\d+[.)、]\s*/
const DECORATIVE_ICON_REGEX =
  /[✉☎⌖◉↗\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu
const PAGE_NUMBER_REGEX =
  /^(?:第\s*\d+\s*页(?:\s*\/\s*共\s*\d+\s*页)?|page\s*\d+(?:\s*of\s*\d+)?|\d+\s*\/\s*\d+)$/i

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(color: string): RgbColor | null {
  const match = /^#([\da-f]{6})$/i.exec(color.trim())
  if (!match) return null
  const hex = match[1]!
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function normalizeHexColor(color: string | undefined): string {
  if (!color) return '#000000'
  const six = /^#([\da-f]{6})$/i.exec(color.trim())
  if (six) return `#${six[1]!.toLowerCase()}`
  const three = /^#([\da-f]{3})$/i.exec(color.trim())
  if (three) {
    const [r, g, b] = three[1]!.toLowerCase().split('')
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return '#000000'
}

function colorLuminance(color: string): number {
  const rgb = parseHexColor(color)
  if (!rgb) return 0
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
}

function colorChroma(color: string): number {
  const rgb = parseHexColor(color)
  if (!rgb) return 0
  return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)
}

function colorDistance(a: string, b: string): number {
  const ca = parseHexColor(a)
  const cb = parseHexColor(b)
  if (!ca || !cb) return 999
  const dr = ca.r - cb.r
  const dg = ca.g - cb.g
  const db = ca.b - cb.b
  return Math.hypot(dr, dg, db)
}

function isNearWhite(color: string): boolean {
  const lum = colorLuminance(color)
  const chroma = colorChroma(color)
  return lum > 0.94 && chroma < 18
}

function isSubtlePageTint(color: string): boolean {
  const lum = colorLuminance(color)
  const chroma = colorChroma(color)
  return lum > 0.9 && chroma < 15
}

function normalizeText(value: string): string {
  // 康熙部首（如 ⼯/⼤/⻔/⽬）在 NFKC 下会统一归并为标准汉字，避免正则漏匹配。
  return value.normalize('NFKC').replace(/\r\n?/g, '\n')
}

function buildStyledText(
  runs: { text: string; bold?: boolean; italic?: boolean; color?: string }[],
): StyledText {
  let text = ''
  const ranges: TextFormatRange[] = []
  for (const run of runs) {
    const content = normalizeText(run.text)
    if (!content) continue
    const start = text.length
    text += content
    const end = text.length
    const color =
      run.color && /^#[\da-f]{6}$/i.test(run.color) ? run.color.toLowerCase() : undefined
    if (run.bold || run.italic || color) {
      ranges.push({
        start,
        end,
        ...(run.bold ? { bold: true as const } : {}),
        ...(run.italic ? { italic: true as const } : {}),
        ...(color ? { color } : {}),
      })
    }
  }
  return { text, formats: normalizeFormats(ranges) }
}

function sliceStyledText(
  source: StyledText,
  rawStart: number,
  rawEnd = source.text.length,
): StyledText {
  let start = clamp(rawStart, 0, source.text.length)
  let end = clamp(rawEnd, start, source.text.length)
  if (splitsSurrogate(source.text, start)) start = Math.max(0, start - 1)
  if (splitsSurrogate(source.text, end)) end = Math.min(source.text.length, end + 1)
  if (start >= end) return { text: '', formats: [] }

  const text = source.text.slice(start, end)
  const ranges: TextFormatRange[] = []
  for (const range of source.formats) {
    const overlapStart = Math.max(start, range.start)
    const overlapEnd = Math.min(end, range.end)
    if (overlapStart >= overlapEnd) continue
    ranges.push({
      start: overlapStart - start,
      end: overlapEnd - start,
      ...(range.bold ? { bold: true as const } : {}),
      ...(range.italic ? { italic: true as const } : {}),
      ...(range.color ? { color: range.color } : {}),
    })
  }
  return { text, formats: normalizeFormats(ranges) }
}

function trimStyledText(source: StyledText): StyledText {
  let start = 0
  let end = source.text.length
  while (start < end && /\s/.test(source.text[start]!)) start++
  while (end > start && /\s/.test(source.text[end - 1]!)) end--
  return sliceStyledText(source, start, end)
}

function concatStyledTexts(parts: StyledText[], separator = ''): StyledText {
  let text = ''
  const ranges: TextFormatRange[] = []
  let appended = false
  for (const part of parts) {
    if (!part.text) continue
    if (appended && separator) text += separator
    const offset = text.length
    text += part.text
    for (const range of part.formats) {
      ranges.push({
        ...range,
        start: range.start + offset,
        end: range.end + offset,
      })
    }
    appended = true
  }
  return { text, formats: normalizeFormats(ranges) }
}

function removeStyledMatches(source: StyledText, pattern: RegExp): StyledText {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  )
  const parts: StyledText[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = global.exec(source.text)) !== null) {
    if (!match[0]) {
      global.lastIndex++
      continue
    }
    if (match.index > cursor) parts.push(sliceStyledText(source, cursor, match.index))
    cursor = match.index + match[0].length
  }
  if (cursor < source.text.length) parts.push(sliceStyledText(source, cursor))
  return trimEdgeSeparators(concatStyledTexts(parts))
}

function trimEdgeSeparators(source: StyledText): StyledText {
  let current = trimStyledText(source)
  while (current.text.length && /^[|｜·•/,:：]+$/u.test(current.text[0]!)) {
    current = trimStyledText(sliceStyledText(current, 1))
  }
  while (current.text.length && /^[|｜·•/,]+$/u.test(current.text.at(-1)!)) {
    current = trimStyledText(sliceStyledText(current, 0, current.text.length - 1))
  }
  return current
}

function stripHeadingFormats(
  formats: TextFormatRange[],
  text: string,
): TextFormatRange[] {
  // 整段标题（忽略空格和连接符）全部加粗属于标题默认样式，仅保留局部加粗和自定义颜色。
  let nonSepChars = 0
  let boldNonSepChars = 0
  for (let i = 0; i < text.length; i++) {
    if (/[\s·|｜/]/.test(text[i]!)) continue
    nonSepChars++
    if (formats.some((r) => r.bold && r.start <= i && r.end > i)) boldNonSepChars++
  }
  const allBold = nonSepChars > 0 && boldNonSepChars === nonSepChars
  if (!allBold) return normalizeFormats(formats)

  return normalizeFormats(
    formats
      .map((range) => {
        if (range.bold) {
          return range.color
            ? { start: range.start, end: range.end, color: range.color }
            : null
        }
        return range
      })
      .filter((item): item is TextFormatRange => item !== null),
  )
}

function pointInRect(px: number, py: number, rect: PdfFillRect, padding = 1): boolean {
  return (
    px >= rect.x - padding &&
    px <= rect.x + rect.width + padding &&
    py >= rect.y - padding &&
    py <= rect.y + rect.height + padding
  )
}

function isOversizedBodyRect(
  rect: PdfFillRect,
  pageWidth: number,
  pageHeight: number,
): boolean {
  // 部分 PDF 导出器会用全屏/半屏矢量路径再 clip 成细装饰条，未做路径裁剪时不能当成正文背景。
  return (
    rect.width >= pageWidth * 0.8 &&
    rect.height >= pageHeight * 0.55 &&
    !isSubtlePageTint(rect.color)
  )
}

function findBackgroundColor(span: PdfTextSpan, page: PdfPageContent): string {
  const cx = span.x + span.width / 2
  const cy = span.y - span.height * 0.35
  // 后绘制的色块覆盖先绘制的色块，倒序查找最上层背景。
  for (let i = page.fillRects.length - 1; i >= 0; i--) {
    const rect = page.fillRects[i]!
    if (isOversizedBodyRect(rect, page.width, page.height)) continue
    if (
      rect.width < Math.max(8, span.fontSize * 0.8) ||
      rect.height < Math.max(8, span.fontSize * 0.8)
    )
      continue
    if (pointInRect(cx, cy, rect, 2)) return rect.color
  }
  return '#ffffff'
}

function detectBaselineInks(pages: PdfPageContent[]): {
  bodyInk: string
  headerBgColor: string | null
  headerInk: string
} {
  const darkCounts = new Map<string, number>()
  const headerRectCounts = new Map<string, number>()
  const headerInkCounts = new Map<string, number>()

  for (const page of pages) {
    for (const rect of page.fillRects) {
      if (isSubtlePageTint(rect.color)) continue
      if (isOversizedBodyRect(rect, page.width, page.height)) continue
      const isHeaderBanner =
        rect.width >= page.width * 0.45 &&
        rect.height >= 45 &&
        rect.height <= page.height * 0.35 &&
        rect.y <= page.height * 0.35
      const isSidebarBanner =
        rect.height >= page.height * 0.45 &&
        rect.width >= page.width * 0.18 &&
        rect.width <= page.width * 0.5
      if (isHeaderBanner || isSidebarBanner) {
        headerRectCounts.set(
          rect.color,
          (headerRectCounts.get(rect.color) ?? 0) + rect.width * rect.height,
        )
      }
    }
  }

  let headerBgColor: string | null = null
  let bestRectArea = 0
  for (const [color, area] of headerRectCounts) {
    if (area > bestRectArea) {
      bestRectArea = area
      headerBgColor = color
    }
  }

  for (const page of pages) {
    for (const span of page.spans) {
      const bg = findBackgroundColor(span, page)
      const bgLum = colorLuminance(bg)
      const runs = span.runs.length
        ? span.runs
        : [{ text: span.text, color: span.color, bold: span.bold }]
      for (const run of runs) {
        const len = run.text.trim().length
        if (!len) continue
        if (bgLum > 0.82) {
          if (colorLuminance(run.color) < 0.45 && colorChroma(run.color) <= 36) {
            darkCounts.set(run.color, (darkCounts.get(run.color) ?? 0) + len)
          }
        } else {
          headerInkCounts.set(run.color, (headerInkCounts.get(run.color) ?? 0) + len)
        }
      }
    }
  }

  let bodyInk = '#000000'
  let bestBodyCount = 0
  for (const [color, count] of darkCounts) {
    if (count > bestBodyCount) {
      bestBodyCount = count
      bodyInk = color
    }
  }

  let headerInk =
    headerBgColor && colorLuminance(headerBgColor) > 0.72 ? '#1f2937' : '#ffffff'
  let bestHeaderCount = 0
  for (const [color, count] of headerInkCounts) {
    if (count > bestHeaderCount) {
      bestHeaderCount = count
      headerInk = color
    }
  }

  return { bodyInk, headerBgColor, headerInk }
}

function filterMeaningfulColor(
  rawColor: string,
  onDarkBg: boolean,
  bodyInk: string,
  headerInk: string,
): string | undefined {
  const color = normalizeHexColor(rawColor)
  if (onDarkBg) {
    if (colorLuminance(color) > 0.88 && colorChroma(color) < 25) return undefined
    if (colorDistance(color, headerInk) <= 38 && colorChroma(color) < 35) return undefined
    return color
  }
  if (isNearWhite(color)) return undefined
  if (
    colorChroma(color) <= 32 &&
    colorLuminance(color) < 0.42 &&
    colorDistance(color, bodyInk) <= 44
  ) {
    return undefined
  }
  return color
}

function rectsOverlapOrNear(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad = 4,
): number {
  const xOverlap = Math.max(
    0,
    Math.min(ax + aw + pad, bx + bw + pad) - Math.max(ax - pad, bx - pad),
  )
  const yOverlap = Math.max(
    0,
    Math.min(ay + ah + pad, by + bh + pad) - Math.max(ay - pad, by - pad),
  )
  return xOverlap * yOverlap
}

function linkUrlsForSpan(span: PdfTextSpan, links: PdfLinkBox[]): string[] {
  const spanTop = span.y - span.height
  const spanCenterY = spanTop + span.height / 2
  const matched: string[] = []
  for (const link of links) {
    const linkCenterY = link.y + link.height / 2
    // 要求纵向中心对齐，避免链接框下缘误触到下一行（如项目副标题）。
    if (Math.abs(spanCenterY - linkCenterY) > Math.max(span.height, link.height) * 0.65) {
      continue
    }
    const area = rectsOverlapOrNear(
      span.x,
      spanTop,
      Math.max(4, span.width),
      Math.max(6, span.height),
      link.x,
      link.y,
      link.width,
      link.height,
      1,
    )
    if (area > 0 && !matched.includes(link.url)) matched.push(link.url)
  }
  return matched
}

function spanNeedsSpace(prev: PdfTextSpan, next: PdfTextSpan): boolean {
  if (!prev.text || !next.text) return false
  if (/\s$/.test(prev.text) || /^\s/.test(next.text)) return false
  const gap = next.x - (prev.x + prev.width)
  const threshold = Math.max(2.2, Math.min(prev.fontSize, next.fontSize) * 0.22)
  if (gap < threshold) return false
  // 两个中文字符之间正常排版无空格；仅较大间距时补空格以便拆分栏位。
  const prevCjk = /[\u4e00-\u9fff]$/.test(prev.text)
  const nextCjk = /^[\u4e00-\u9fff]/.test(next.text)
  if (prevCjk && nextCjk && gap < prev.fontSize * 0.65) return false
  return true
}

function mergeLineSpans(
  spans: PdfTextSpan[],
  page: PdfPageContent,
  bodyInk: string,
  headerInk: string,
): VisualLine {
  const sorted = [...spans].sort((a, b) => a.x - b.x)
  const runs: { text: string; bold?: boolean; italic?: boolean; color?: string }[] = []
  const links: string[] = []
  let darkBgCount = 0

  const keptSpans: PdfTextSpan[] = []
  let lastKept: PdfTextSpan | undefined

  for (let i = 0; i < sorted.length; i++) {
    const span = sorted[i]!
    const bg = findBackgroundColor(span, page)
    const onDarkBg = colorLuminance(bg) <= 0.82
    if (onDarkBg) darkBgCount++

    const spanLinks = linkUrlsForSpan(span, page.links)
    for (const url of spanLinks) {
      if (!links.includes(url)) links.push(url)
    }

    // 简历工坊及常见简历模板会在外链旁放「跳转」「Link>」按钮文字，保留链接但剔除按钮标签。
    if (
      spanLinks.length > 0 &&
      /^(?:跳转|Link>?|链接|查看|Open)$/i.test(span.text.trim())
    ) {
      continue
    }

    if (lastKept) {
      const gap = span.x - (lastKept.x + lastKept.width)
      const wideThreshold = Math.min(lastKept.fontSize, span.fontSize) * 1.6
      if (!span.text.trim() && span.width > span.fontSize * 1.5) {
        runs.push({ text: '  ' })
        continue
      }
      if (gap >= wideThreshold && !/\s{2,}$/.test(runs[runs.length - 1]?.text ?? '')) {
        runs.push({ text: '  ' })
      } else if (spanNeedsSpace(lastKept, span)) {
        runs.push({ text: ' ' })
      }
    }
    keptSpans.push(span)
    lastKept = span

    const spanRuns = span.runs.length
      ? span.runs
      : [{ text: span.text, color: span.color, bold: span.bold, italic: span.italic }]
    for (const run of spanRuns) {
      const cleanColor = filterMeaningfulColor(run.color, onDarkBg, bodyInk, headerInk)
      runs.push({
        text: run.text,
        bold: run.bold,
        italic: run.italic,
        color: cleanColor,
      })
    }
  }

  const styled = trimStyledText(buildStyledText(runs))

  const first = sorted[0]!
  const maxRight = Math.max(...sorted.map((item) => item.x + item.width))
  const maxHeight = Math.max(...sorted.map((item) => item.height))
  const weightedFontSize =
    sorted.reduce(
      (sum, item) => sum + item.fontSize * Math.max(1, item.text.trim().length),
      0,
    ) /
    Math.max(
      1,
      sorted.reduce((sum, item) => sum + Math.max(1, item.text.trim().length), 0),
    )

  return {
    pageNumber: page.pageNumber,
    x: first.x,
    y: sorted.reduce((sum, item) => sum + item.y, 0) / sorted.length,
    right: maxRight,
    height: maxHeight,
    fontSize: weightedFontSize,
    styled,
    spans: keptSpans.length ? keptSpans : sorted,
    links,
    onDarkBackground: darkBgCount > sorted.length / 2,
  }
}

function groupSpansIntoRows(spans: PdfTextSpan[]): PdfTextSpan[][] {
  const valid = spans
    .filter((span) => span.text.trim().length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: PdfTextSpan[][] = []
  for (const span of valid) {
    const lastRow = rows.at(-1)
    if (lastRow) {
      const avgY = lastRow.reduce((sum, item) => sum + item.y, 0) / lastRow.length
      const avgH = lastRow.reduce((sum, item) => sum + item.fontSize, 0) / lastRow.length
      if (Math.abs(span.y - avgY) <= Math.max(3.5, avgH * 0.42)) {
        lastRow.push(span)
        continue
      }
    }
    rows.push([span])
  }
  return rows
}

interface ColumnLayoutDetection {
  mode: 'single' | 'columns' | 'sidebar-left' | 'sidebar-right'
  splitX: number
  headerSplitY: number
}

function detectPageColumns(page: PdfPageContent): ColumnLayoutDetection {
  const rows = groupSpansIntoRows(page.spans)
  if (rows.length < 6) return { mode: 'single', splitX: page.width / 2, headerSplitY: 0 }

  // 若存在整宽顶部色块，则色块以下才进入分栏判定；白色页眉也在首个已知栏目标题处划分。
  let headerSplitY = 0
  for (const rect of page.fillRects) {
    if (
      !isSubtlePageTint(rect.color) &&
      rect.width >= page.width * 0.65 &&
      rect.y <= page.height * 0.25 &&
      rect.height >= 45 &&
      rect.height <= page.height * 0.35
    ) {
      headerSplitY = Math.max(headerSplitY, rect.y + rect.height)
    }
  }

  if (headerSplitY === 0 && page.pageNumber === 1) {
    for (const row of rows) {
      const rowText = row
        .map((s) => s.text)
        .join('')
        .trim()
      if (detectSectionKind(rowText)) {
        headerSplitY = Math.max(0, row[0]!.y - row[0]!.height - 4)
        break
      }
    }
    if (headerSplitY === 0) {
      // 跳过顶部大字号姓名及联系信息区（前 18% 页面高度）
      const topLimit = page.height * 0.18
      const firstBodyRow = rows.find((r) => r[0]!.y > topLimit)
      if (firstBodyRow) headerSplitY = topLimit
    }
  }

  // 在页面 28% ~ 72% 宽度范围内搜索横向空隙，寻找分栏沟槽。
  const candidateRows = rows.filter((row) => {
    const y = row[0]!.y
    return y >= headerSplitY && row.some((item) => item.text.trim().length > 0)
  })
  if (candidateRows.length < 6) {
    return { mode: 'single', splitX: page.width / 2, headerSplitY }
  }

  let bestSplitX = page.width / 2
  let bestScore = -1
  for (let ratio = 0.28; ratio <= 0.72; ratio += 0.02) {
    const x = page.width * ratio
    let crossing = 0
    let leftCount = 0
    let rightCount = 0
    let rightDateOrShortOnly = 0
    for (const row of candidateRows) {
      const leftItems = row.filter((s) => s.x + s.width < x - 6)
      const rightItems = row.filter((s) => s.x > x + 6)
      const crosses = row.some((s) => s.x < x - 4 && s.x + s.width > x + 4)
      if (crosses) crossing++
      if (leftItems.length) leftCount++
      if (rightItems.length) {
        rightCount++
        const rightText = rightItems
          .map((s) => s.text)
          .join(' ')
          .trim()
        if (
          rightText.length <= 26 &&
          (PERIOD_REGEX.test(rightText) || YEAR_RANGE_REGEX.test(rightText))
        ) {
          rightDateOrShortOnly++
        }
      }
    }
    // 若右侧绝大多数只是右对齐时间/日期标签，则属于单栏排版而非双栏/右侧栏。
    if (rightCount > 0 && rightDateOrShortOnly >= rightCount * 0.6) continue

    // 两栏必须在分界线两侧同时存在多行，且跨越分界线的行极少。
    if (
      leftCount >= 4 &&
      rightCount >= 4 &&
      crossing <= Math.max(1, candidateRows.length * 0.08)
    ) {
      const balance = Math.min(leftCount, rightCount)
      const score = balance * 3 - crossing * 10
      if (score > bestScore) {
        bestScore = score
        bestSplitX = x
      }
    }
  }

  if (bestScore <= 0) return { mode: 'single', splitX: page.width / 2, headerSplitY }

  const ratio = bestSplitX / page.width
  if (ratio <= 0.39) return { mode: 'sidebar-left', splitX: bestSplitX, headerSplitY }
  if (ratio >= 0.61) return { mode: 'sidebar-right', splitX: bestSplitX, headerSplitY }
  return { mode: 'columns', splitX: bestSplitX, headerSplitY }
}

function buildVisualLinesForPage(
  page: PdfPageContent,
  bodyInk: string,
  headerInk: string,
): { layout: ColumnLayoutDetection; lines: VisualLine[] } {
  const layout = detectPageColumns(page)
  const rows = groupSpansIntoRows(page.spans)
  const lines: VisualLine[] = []

  for (const row of rows) {
    const rowY = row.reduce((sum, s) => sum + s.y, 0) / row.length
    const isHeaderBand = layout.mode !== 'single' && rowY < layout.headerSplitY
    const spansCrossSplit =
      layout.mode !== 'single' &&
      row.some((s) => s.x < layout.splitX - 4 && s.x + s.width > layout.splitX + 4)

    if (layout.mode === 'single' || isHeaderBand || spansCrossSplit) {
      const line = mergeLineSpans(row, page, bodyInk, headerInk)
      if (spansCrossSplit) {
        line.column = row[0]!.x < layout.splitX ? 'left' : 'right'
      }
      if (line.styled.text && !PAGE_NUMBER_REGEX.test(line.styled.text)) lines.push(line)
      continue
    }

    const leftSpans = row.filter((s) => s.x + s.width / 2 <= layout.splitX)
    const rightSpans = row.filter((s) => s.x + s.width / 2 > layout.splitX)
    if (leftSpans.length) {
      const leftLine = mergeLineSpans(leftSpans, page, bodyInk, headerInk)
      leftLine.column = 'left'
      if (leftLine.styled.text && !PAGE_NUMBER_REGEX.test(leftLine.styled.text))
        lines.push(leftLine)
    }
    if (rightSpans.length) {
      const rightLine = mergeLineSpans(rightSpans, page, bodyInk, headerInk)
      rightLine.column = 'right'
      if (rightLine.styled.text && !PAGE_NUMBER_REGEX.test(rightLine.styled.text))
        lines.push(rightLine)
    }
  }

  return { layout, lines }
}

function detectSectionKind(text: string): SectionKind | null {
  const cleaned = normalizeText(text)
    .replace(DECORATIVE_ICON_REGEX, '')
    .replace(/^[\d.|｜▪▫●■◆\-*\s]+/, '')
    .replace(/[:：\s]+$/, '')
    .trim()
  if (!cleaned || cleaned.length > 26) return null
  if (/[、，,。；;]/.test(cleaned) && cleaned.length > 8) return null
  if (PERIOD_REGEX.test(cleaned) || YEAR_RANGE_REGEX.test(cleaned)) return null

  for (const rule of SECTION_KIND_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(cleaned))) return rule.kind
  }
  return null
}

function isLikelySectionHeading(
  line: VisualLine,
  medianBodyFontSize: number,
  allowUnknown = true,
): boolean {
  const text = line.styled.text.trim()
  if (!text || text.length > 28) return false
  if (EMAIL_REGEX.test(text) || PHONE_REGEX.test(text) || PERIOD_REGEX.test(text))
    return false
  if (detectSectionKind(text)) return true
  if (!allowUnknown || line.onDarkBackground) return false

  // 显著大于正文的短独立标题行也识别为自定义栏目。
  const isLarger = line.fontSize >= medianBodyFontSize * 1.18
  const isAllBold =
    line.styled.formats.length > 0 &&
    line.styled.formats.every((r) => r.bold) &&
    line.styled.formats.reduce((sum, r) => sum + (r.end - r.start), 0) >=
      text.length * 0.85
  if (isLarger && isAllBold && text.length <= 16 && !/[。；;，,]/.test(text)) return true
  return false
}

function cleanSectionTitle(text: string): string {
  return text
    .replace(DECORATIVE_ICON_REGEX, '')
    .replace(/^[▪▫●■◆▶►|｜]+\s*/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
}

function splitTitleAndPeriod(line: VisualLine): {
  title: StyledText
  period: StyledText
} {
  const text = line.styled.text
  const match = PERIOD_REGEX.exec(text) ?? YEAR_RANGE_REGEX.exec(text)
  if (match) {
    let before = trimEdgeSeparators(sliceStyledText(line.styled, 0, match.index))
    const period = trimStyledText(
      sliceStyledText(line.styled, match.index, match.index + match[0].length),
    )
    let after = trimEdgeSeparators(
      sliceStyledText(line.styled, match.index + match[0].length),
    )
    // 若时间原本包裹在括号内（如“Android学员（2024.9 - 2025.8）”），剔除残留空括号。
    if (/[（(]\s*$/.test(before.text) && /^\s*[）)]/.test(after.text)) {
      before = trimEdgeSeparators(
        sliceStyledText(before, 0, before.text.replace(/[（(]\s*$/, '').length),
      )
      const afterOffset = after.text.length - after.text.replace(/^\s*[）)]/, '').length
      after = trimEdgeSeparators(sliceStyledText(after, afterOffset))
    }
    const combinedTitle =
      before.text && after.text
        ? concatStyledTexts([before, after], ' · ')
        : before.text
          ? before
          : after
    if (combinedTitle.text) return { title: combinedTitle, period }
  }

  // 若同一行中有明显横向间距（例如左对齐标题 + 右对齐短文本），按实际合并后的字符边界拆出右侧部分。
  if (line.spans.length >= 2) {
    let maxGap = 0
    let splitAfterIndex = -1
    for (let i = 0; i < line.spans.length - 1; i++) {
      const current = line.spans[i]!
      const next = line.spans[i + 1]!
      const gap = next.x - (current.x + current.width)
      if (gap > maxGap) {
        maxGap = gap
        splitAfterIndex = i
      }
    }
    if (maxGap > line.fontSize * 3.5 && splitAfterIndex >= 0) {
      let splitOffset = 0
      for (let i = 0; i <= splitAfterIndex; i++) {
        const span = line.spans[i]!
        if (i > 0 && spanNeedsSpace(line.spans[i - 1]!, span)) splitOffset += 1
        splitOffset += span.text.length
      }
      const left = trimEdgeSeparators(sliceStyledText(line.styled, 0, splitOffset))
      const right = trimEdgeSeparators(sliceStyledText(line.styled, splitOffset))
      if (left.text && right.text && right.text.length <= 28 && /\d/.test(right.text)) {
        return { title: left, period: right }
      }
    }
  }

  return { title: trimEdgeSeparators(line.styled), period: { text: '', formats: [] } }
}

function hasStrongBold(line: VisualLine): boolean {
  const len = line.styled.text.trim().length
  if (!len) return false
  const boldChars = line.styled.formats
    .filter((range) => range.bold)
    .reduce((sum, range) => sum + (range.end - range.start), 0)
  return boldChars >= len * 0.55
}

function isPurePeriodText(text: string): boolean {
  const trimmed = text.trim()
  const match = PERIOD_REGEX.exec(trimmed) ?? YEAR_RANGE_REGEX.exec(trimmed)
  return Boolean(match && match[0].length >= trimmed.length * 0.85)
}

function hasDistinctLineColor(line: VisualLine): boolean {
  const len = line.styled.text.trim().length
  if (!len) return false
  const coloredChars = line.styled.formats
    .filter((range) => Boolean(range.color))
    .reduce((sum, range) => sum + (range.end - range.start), 0)
  return coloredChars >= len * 0.8
}

function isLikelyEntryStart(
  line: VisualLine,
  prevLine: VisualLine | undefined,
  currentGroup: VisualLine[] | undefined,
  medianBodyFontSize: number,
  sectionKind: SectionKind,
): boolean {
  const text = line.styled.text.trim()
  if (!text) return false
  if (sectionKind === 'skills') return false
  if (BULLET_PREFIX_REGEX.test(text)) return false

  const currentGroupSize = currentGroup?.length ?? 0
  // 若上一行刚作为条目标题（且不含时间），紧随其后的纯时间行属于该条目的折行时间。
  if (
    currentGroupSize === 1 &&
    prevLine &&
    isPurePeriodText(text) &&
    !PERIOD_REGEX.test(prevLine.styled.text) &&
    !YEAR_RANGE_REGEX.test(prevLine.styled.text)
  ) {
    return false
  }

  if (PERIOD_REGEX.test(text) || YEAR_RANGE_REGEX.test(text)) return true
  if (sectionKind === 'custom') {
    const hasVerticalGap = prevLine
      ? line.y - prevLine.y > medianBodyFontSize * 1.8
      : false
    return (
      hasVerticalGap &&
      (hasStrongBold(line) || hasDistinctLineColor(line)) &&
      text.length <= 42
    )
  }

  // 带链接注解的短标题行（例如项目标题旁带「跳转」链接，即使时间折到下一行也应独立成条）。
  if (
    line.links.some((u) => !/^(?:mailto:|tel:)/i.test(u)) &&
    text.length <= 48 &&
    !/[。！？；]$/.test(text)
  ) {
    return true
  }

  const hasVerticalGap = prevLine
    ? line.y - prevLine.y > medianBodyFontSize * 1.65
    : false
  // 紧跟在带时间的条目标题后的短行（无新时间、无新链接）通常是该条目的副标题，而非下一条新经历。
  if (
    currentGroupSize === 1 &&
    !hasVerticalGap &&
    prevLine &&
    (PERIOD_REGEX.test(prevLine.styled.text) ||
      YEAR_RANGE_REGEX.test(prevLine.styled.text)) &&
    !line.links.some((u) => !/^(?:mailto:|tel:)/i.test(u)) &&
    !/[。！？；.]$/.test(text) &&
    text.length <= 54
  ) {
    return false
  }
  if (
    (hasStrongBold(line) ||
      line.fontSize >= medianBodyFontSize * 1.08 ||
      (hasDistinctLineColor(line) &&
        (!prevLine ||
          /[。！？；.]$/.test(prevLine.styled.text.trim()) ||
          hasVerticalGap))) &&
    text.length <= 48
  ) {
    if (!prevLine || hasVerticalGap || !/[。！？；;.]$/.test(text)) return true
  }
  return false
}

function parseSkillsEntries(lines: VisualLine[]): ResumeEntry[] {
  const categoryRegex = /^([^：:]{2,16})[:：]\s*(.+)$/
  const allMatchCategory =
    lines.length >= 2 && lines.every((l) => categoryRegex.test(l.styled.text.trim()))
  if (allMatchCategory) {
    return lines.map((line) => {
      const entry = createEntry()
      const trimmed = trimStyledText(line.styled)
      const match = categoryRegex.exec(trimmed.text)!
      const sepIndex = trimmed.text.search(/[:：]/)
      const titleStyled = trimStyledText(sliceStyledText(trimmed, 0, sepIndex))
      const descStyled = trimStyledText(sliceStyledText(trimmed, sepIndex + 1))
      entry.title = titleStyled.text || match[1]!
      entry.description = descStyled.text || match[2]!
      const titleFormats = stripHeadingFormats(titleStyled.formats, entry.title)
      entry.textFormats = {
        ...(titleFormats.length ? { title: titleFormats } : {}),
        ...(descStyled.formats.length ? { description: descStyled.formats } : {}),
      }
      if (Object.keys(entry.textFormats).length === 0) delete entry.textFormats
      return entry
    })
  }

  const entry = createEntry()
  const desc = concatStyledTexts(
    lines.map((l) => l.styled),
    '\n',
  )
  entry.description = desc.text
  if (desc.formats.length) entry.textFormats = { description: desc.formats }
  const firstHttpLink = lines
    .flatMap((l) => l.links)
    .find((u) => !/^(?:mailto:|tel:)/i.test(u))
  if (firstHttpLink) entry.link = firstHttpLink
  return [entry]
}

function parseEntriesFromLines(
  lines: VisualLine[],
  sectionKind: SectionKind,
  medianBodyFontSize: number,
): ResumeEntry[] {
  if (!lines.length) return []
  if (sectionKind === 'skills') return parseSkillsEntries(lines)

  const groups: VisualLine[][] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const prev = lines[i - 1]
    const currentGroup = groups.at(-1)
    if (
      !currentGroup ||
      isLikelyEntryStart(line, prev, currentGroup, medianBodyFontSize, sectionKind)
    ) {
      groups.push([line])
    } else {
      currentGroup.push(line)
    }
  }

  return groups.map((group) => {
    const first = group[0]!
    const entry = createEntry()
    const allLinks: string[] = []
    for (const line of group) {
      for (const url of line.links) {
        if (/^(?:mailto:|tel:)/i.test(url)) continue
        if (!allLinks.includes(url)) allLinks.push(url)
      }
    }

    const firstIsHeaderLike =
      !BULLET_PREFIX_REGEX.test(first.styled.text) &&
      (group.length > 1 ||
        PERIOD_REGEX.test(first.styled.text) ||
        YEAR_RANGE_REGEX.test(first.styled.text) ||
        hasStrongBold(first) ||
        first.links.length > 0 ||
        first.styled.text.length <= 40)

    let bodyStartIndex = 0
    if (firstIsHeaderLike) {
      const { title, period } = splitTitleAndPeriod(first)
      entry.title = title.text
      entry.period = period.text
      const titleFormats = stripHeadingFormats(title.formats, title.text)
      const periodFormats = period.formats
      entry.textFormats = {
        ...(titleFormats.length ? { title: titleFormats } : {}),
        ...(periodFormats.length ? { period: periodFormats } : {}),
      }
      bodyStartIndex = 1

      // 若第二行是折行的纯时间（如“2026.6-至今”），直接填入 period 而非放进副标题/正文。
      if (!entry.period && group[1] && isPurePeriodText(group[1].styled.text)) {
        const wrappedPeriod = trimStyledText(group[1].styled)
        entry.period = wrappedPeriod.text
        if (wrappedPeriod.formats.length) {
          entry.textFormats = { ...entry.textFormats, period: wrappedPeriod.formats }
        }
        bodyStartIndex = 2
      }

      // 检查紧接其后的行是否为副标题（机构/专业/技术栈）：通常带有分隔符或后面还有正文行。
      const second = group[bodyStartIndex]
      const looksLikeSubtitle =
        second &&
        !BULLET_PREFIX_REGEX.test(second.styled.text) &&
        second.styled.text.length <= 54 &&
        !/[。！？；.]$/.test(second.styled.text.trim()) &&
        (/[·|｜/]/.test(second.styled.text) ||
          (group.length > bodyStartIndex + 1 &&
            (sectionKind === 'education' ||
              sectionKind === 'work' ||
              sectionKind === 'projects')))
      if (looksLikeSubtitle) {
        const sub = trimEdgeSeparators(second.styled)
        entry.subtitle = sub.text
        if (sub.formats.length) {
          entry.textFormats = { ...entry.textFormats, subtitle: sub.formats }
        }
        bodyStartIndex += 1
      }
    }

    const descParts = group.slice(bodyStartIndex).map((line) => line.styled)
    let descriptionStyled = concatStyledTexts(descParts, '\n')

    if (allLinks.length > 0) {
      entry.link = allLinks[0]
      for (const extraUrl of allLinks.slice(1)) {
        if (!descriptionStyled.text.includes(extraUrl)) {
          descriptionStyled = concatStyledTexts(
            [descriptionStyled, { text: extraUrl, formats: [] }],
            descriptionStyled.text ? '\n' : '',
          )
        }
      }
    } else {
      // 从文本中提取明文 URL（如果尚未有链接注释）
      const plainUrls =
        descriptionStyled.text.match(URL_REGEX) ??
        entry.subtitle.match(URL_REGEX) ??
        first.styled.text.match(URL_REGEX)
      if (plainUrls?.length) {
        const normalized = externalUrl(plainUrls[0])
        if (normalized) entry.link = normalized
      }
    }

    if (descriptionStyled.text) {
      entry.description = descriptionStyled.text
      if (descriptionStyled.formats.length) {
        entry.textFormats = {
          ...entry.textFormats,
          description: descriptionStyled.formats,
        }
      }
    }
    if (entry.textFormats && Object.keys(entry.textFormats).length === 0) {
      delete entry.textFormats
    }

    return entry
  })
}

function matchPalette(
  pages: PdfPageContent[],
  headerBgColor: string | null,
): AccentChoice {
  const candidates: { color: string; weight: number }[] = []
  if (headerBgColor && !isNearWhite(headerBgColor)) {
    candidates.push({ color: headerBgColor, weight: 8 })
  }
  for (const page of pages) {
    for (const rect of page.fillRects) {
      if (isNearWhite(rect.color) || colorLuminance(rect.color) < 0.08) continue
      if (colorChroma(rect.color) > 20) {
        candidates.push({ color: rect.color, weight: 3 })
      }
    }
    for (const span of page.spans) {
      if (colorChroma(span.color) > 35) {
        candidates.push({
          color: span.color,
          weight: Math.max(1, span.text.trim().length * 0.2),
        })
      }
    }
  }

  if (!candidates.length) return 'graphite'

  // 选出权重最高的主强调色
  const grouped = new Map<string, number>()
  for (const item of candidates) {
    grouped.set(item.color, (grouped.get(item.color) ?? 0) + item.weight)
  }
  let dominantColor = candidates[0]!.color
  let maxWeight = -1
  for (const [color, weight] of grouped) {
    if (weight > maxWeight) {
      maxWeight = weight
      dominantColor = color
    }
  }

  let bestId: AccentChoice = 'ocean'
  let bestDist = Number.POSITIVE_INFINITY
  for (const palette of resumePalettes) {
    const dHeader = headerBgColor
      ? colorDistance(headerBgColor, palette.header)
      : colorDistance(dominantColor, palette.strong)
    const dStrong = colorDistance(dominantColor, palette.strong)
    const score = headerBgColor ? dHeader * 0.75 + dStrong * 0.25 : dStrong
    if (score < bestDist) {
      bestDist = score
      bestId = palette.id
    }
  }
  return bestId
}

function inferTemplateId(
  layoutMode: ColumnLayoutDetection['mode'],
  hasSolidHeader: boolean,
): ResumeTemplateId {
  if (layoutMode === 'sidebar-left') return 'sidebar-left'
  if (layoutMode === 'sidebar-right') return 'sidebar-right'
  if (layoutMode === 'columns') return hasSolidHeader ? 'two-column' : 'editorial'
  return hasSolidHeader ? 'single-column' : 'ats-classic'
}

function inferAppearance(
  pages: PdfPageContent[],
  lines: VisualLine[],
  headerBgColor: string | null,
  medianBodyFontSize: number,
  nameFontSize: number,
  headingFontSize: number,
): ResumeDocument['appearance'] {
  const accent = matchPalette(pages, headerBgColor)
  // 标准 A4 宽度约 595pt，逻辑画布为 1024px，换算系数约为 1024 / pageWidth。
  const pageWidth = pages[0]?.width || 595
  const scaleFactor = 1024 / pageWidth

  const nameOpt = baseFontOptions.find((o) => o.key === 'nameScale')!
  const headingOpt = baseFontOptions.find((o) => o.key === 'headingScale')!
  const bodyOpt = baseFontOptions.find((o) => o.key === 'bodyScale')!

  const bodyScale = Math.round(
    clamp(medianBodyFontSize * scaleFactor, bodyOpt.min, bodyOpt.max),
  )
  const headingScale = Math.round(
    clamp(headingFontSize * scaleFactor, headingOpt.min, headingOpt.max),
  )
  const nameScale = Math.round(
    clamp(nameFontSize * scaleFactor, nameOpt.min, nameOpt.max),
  )

  const roleOpt = headerFontOptions.find((o) => o.key === 'role')!
  const headerFontSizes: ResumeDocument['appearance']['headerFontSizes'] = {
    role: Math.round(clamp(headingScale * 1.1, roleOpt.min, roleOpt.max)),
  }

  void lines
  return {
    ...appearanceDefaults,
    nameScale,
    headingScale,
    bodyScale,
    headerFontSizes,
    accent,
  }
}

const CITY_HINT_REGEX =
  /(?:市|省|区|北京|上海|广州|深圳|杭州|成都|重庆|武汉|南京|西安|苏州|长沙|厦门|天津|青岛|大连|郑州|合肥|福州|济南|沈阳|哈尔滨|昆明|宁波|无锡|佛山|珠海|东莞|香港|澳门|台北|London|New York|San Francisco|Seattle|Singapore|Tokyo|Beijing|Shanghai|Shenzhen|Hangzhou|Chengdu)$/i

function extractHeaderAndBody(
  orderedLines: VisualLine[],
  layoutMode: ColumnLayoutDetection['mode'],
  medianBodyFontSize: number,
): {
  headerLines: VisualLine[]
  bodyColumns: { column?: SectionColumn; lines: VisualLine[] }[]
} {
  const page1Lines = orderedLines.filter((l) => l.pageNumber === 1)
  const laterLines = orderedLines.filter((l) => l.pageNumber > 1)

  if (layoutMode === 'sidebar-left' || layoutMode === 'sidebar-right') {
    const sidebarCol: SectionColumn = layoutMode === 'sidebar-left' ? 'left' : 'right'
    const mainCol: SectionColumn = sidebarCol === 'left' ? 'right' : 'left'
    const sidebarLines1 = page1Lines.filter((l) => l.column === sidebarCol)
    const mainLines1 = page1Lines.filter((l) => l.column === mainCol)
    const topLines1 = page1Lines.filter((l) => !l.column)

    const firstSideSection = sidebarLines1.findIndex((l) =>
      isLikelySectionHeading(l, medianBodyFontSize),
    )
    const headerFromSidebar =
      firstSideSection >= 0 ? sidebarLines1.slice(0, firstSideSection) : sidebarLines1
    const restSidebar = [
      ...(firstSideSection >= 0 ? sidebarLines1.slice(firstSideSection) : []),
      ...laterLines.filter((l) => l.column === sidebarCol),
    ]
    const restMain = [...mainLines1, ...laterLines.filter((l) => l.column !== sidebarCol)]

    return {
      headerLines: [...topLines1, ...headerFromSidebar],
      bodyColumns: [
        ...(restSidebar.length ? [{ column: sidebarCol, lines: restSidebar }] : []),
        ...(restMain.length ? [{ column: mainCol, lines: restMain }] : []),
      ],
    }
  }

  // 单栏或双栏：只在第 1 页首个栏目标题之前提取页眉个人信息，第 2 页起全部进入正文。
  const topMaxFont = page1Lines
    .slice(0, 5)
    .reduce((max, line) => Math.max(max, line.fontSize), 0)
  const knownHeadingIdx = page1Lines.findIndex(
    (l) => detectSectionKind(l.styled.text) !== null,
  )
  const fallbackHeadingIdx = page1Lines.findIndex(
    (l, index) =>
      index >= 2 &&
      l.fontSize < topMaxFont * 0.85 &&
      isLikelySectionHeading(l, medianBodyFontSize, true),
  )
  const firstHeadingIdx = knownHeadingIdx >= 0 ? knownHeadingIdx : fallbackHeadingIdx
  const splitIdx = firstHeadingIdx >= 0 ? firstHeadingIdx : Math.min(6, page1Lines.length)
  const headerLines = page1Lines.slice(0, splitIdx)
  const bodyLines = [...page1Lines.slice(splitIdx), ...laterLines]

  if (layoutMode === 'columns') {
    const leftLines = bodyLines.filter((l) => l.column !== 'right')
    const rightLines = bodyLines.filter((l) => l.column === 'right')
    return {
      headerLines,
      bodyColumns: [
        ...(leftLines.length ? [{ column: 'left' as const, lines: leftLines }] : []),
        ...(rightLines.length ? [{ column: 'right' as const, lines: rightLines }] : []),
      ],
    }
  }

  return {
    headerLines,
    bodyColumns: [{ lines: bodyLines }],
  }
}

function splitStyledTokens(source: StyledText): StyledText[] {
  const parts: StyledText[] = []
  const sepRegex = /\s*[|｜/·•]\s*|\s{2,}/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = sepRegex.exec(source.text)) !== null) {
    if (match.index > cursor) {
      const piece = trimEdgeSeparators(sliceStyledText(source, cursor, match.index))
      if (piece.text) parts.push(piece)
    }
    cursor = match.index + match[0].length
  }
  if (cursor < source.text.length) {
    const tail = trimEdgeSeparators(sliceStyledText(source, cursor))
    if (tail.text) parts.push(tail)
  }
  return parts.length ? parts : [source]
}

function parseProfileFromHeader(
  headerLines: VisualLine[],
  allLinks: PdfLinkBox[],
): {
  profile: ResumeDocument['profile']
  nameFontSize: number
  extraLinks: string[]
} {
  let email = ''
  let emailFormats: TextFormatRange[] = []
  let phone = ''
  let phoneFormats: TextFormatRange[] = []
  let github = ''
  let location = ''
  let locationFormats: TextFormatRange[] = []
  let nameStyled: StyledText = { text: '', formats: [] }
  let roleStyled: StyledText = { text: '', formats: [] }
  const profileLines: StyledText[] = []
  const extraLinks: string[] = []

  // 先检查 mailto/tel 注释补充邮箱和电话（大小写不敏感，并剔除 ?subject 等查询参数）
  for (const link of allLinks) {
    if (/^mailto:/i.test(link.url) && !email) {
      email = link.url.slice(7).split('?')[0]!.trim()
    } else if (/^tel:/i.test(link.url) && !phone) {
      phone = link.url.slice(4).trim()
    }
  }

  // 按字号找最可能是姓名的行（即使同行右侧带有联系方式也不跳过）
  let nameLineIndex = -1
  let maxFont = -1
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i]!
    const withoutContacts = line.styled.text
      .replace(DECORATIVE_ICON_REGEX, '')
      .replace(EMAIL_REGEX, '')
      .replace(PHONE_REGEX, '')
      .replace(URL_REGEX, '')
      .replace(/[|｜·•/]+/g, ' ')
      .trim()
    if (!withoutContacts) continue
    if (line.fontSize > maxFont && withoutContacts.length <= 28) {
      maxFont = line.fontSize
      nameLineIndex = i
    }
  }

  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i]!
    let working = removeStyledMatches(line.styled, DECORATIVE_ICON_REGEX)

    // 提取当前行的链接注解（排除 mailto:/tel:），并剔除已识别的 GitHub 用户名标签防止混入求职意向
    for (const url of line.links) {
      if (/^(?:mailto:|tel:)/i.test(url)) continue
      if (/github\.com/i.test(url) && !github) {
        github = url
        const label = githubLabel(url)
        if (label && working.text.includes(label)) {
          working = removeStyledMatches(working, new RegExp(escapeRegExp(label), 'g'))
        }
      } else if (
        !github &&
        /^(?:个人主页|主页|GitHub|Blog|Portfolio)$/i.test(working.text.trim())
      ) {
        github = url
      } else if (!extraLinks.includes(url)) {
        extraLinks.push(url)
      }
    }

    // 从行内提取邮箱
    const emailMatch = EMAIL_REGEX.exec(working.text)
    if (emailMatch && !email) {
      email = emailMatch[0]
      const extracted = sliceStyledText(
        working,
        emailMatch.index,
        emailMatch.index + emailMatch[0].length,
      )
      emailFormats = extracted.formats
      working = removeStyledMatches(working, EMAIL_REGEX)
    }

    // 从行内提取电话
    const phoneMatch = PHONE_REGEX.exec(working.text)
    if (phoneMatch && !phone) {
      phone = phoneMatch[0].trim()
      const extracted = sliceStyledText(
        working,
        phoneMatch.index,
        phoneMatch.index + phoneMatch[0].length,
      )
      phoneFormats = extracted.formats
      working = removeStyledMatches(working, PHONE_REGEX)
    }

    // 从行内提取 GitHub / URL 并去重
    const urlMatches = working.text.match(URL_REGEX)
    if (urlMatches) {
      for (const rawUrl of urlMatches) {
        const normalized = /github\.com/i.test(rawUrl)
          ? githubUrl(rawUrl)
          : externalUrl(rawUrl)
        if (!normalized) continue
        if (/github\.com/i.test(normalized) && !github) {
          github = normalized
          working = removeStyledMatches(working, new RegExp(escapeRegExp(rawUrl), 'gi'))
        } else {
          if (!extraLinks.includes(normalized)) extraLinks.push(normalized)
          working = removeStyledMatches(working, new RegExp(escapeRegExp(rawUrl), 'gi'))
        }
      }
    }

    working = trimEdgeSeparators(working)
    if (!working.text) continue

    if (i === nameLineIndex && !nameStyled.text) {
      const tokens = splitStyledTokens(working)
      if (
        tokens.length >= 2 &&
        tokens[0]!.text.length <= 16 &&
        (HEADER_ROLE_HINT_REGEX.test(tokens[1]!.text) ||
          (tokens.length === 2 && tokens[1]!.text.trim().length <= 28))
      ) {
        nameStyled = tokens[0]!
        roleStyled = tokens[1]!
        for (const extraToken of tokens.slice(2)) profileLines.push(extraToken)
      } else {
        nameStyled = working
      }
      continue
    }

    // 拆分带分隔符的联系信息行，避免整行“北京 | 5年经验”漏判或串味
    const tokens = splitStyledTokens(working)
    const remainingTokens: StyledText[] = []
    for (const token of tokens) {
      const txt = token.text.trim()
      if (!txt) continue

      const locCandidate = txt.replace(/^(?:城市|地点|现居|Location)[:：]\s*/i, '')
      if (!location && locCandidate.length <= 18 && CITY_HINT_REGEX.test(locCandidate)) {
        const offset = txt.length - locCandidate.length
        const sliced = trimEdgeSeparators(sliceStyledText(token, offset))
        location = sliced.text
        locationFormats = sliced.formats
        continue
      }

      if (
        !roleStyled.text &&
        txt.length <= 32 &&
        (HEADER_ROLE_HINT_REGEX.test(txt) ||
          /^(?:求职意向|意向岗位|Target Role)[:：]/i.test(txt) ||
          (tokens.length === 1 &&
            line.fontSize >= maxFont * 0.62 &&
            i <= nameLineIndex + 2))
      ) {
        const colonIdx = txt.search(/[:：]/)
        roleStyled =
          /^(?:求职意向|意向岗位|Target Role)[:：]/i.test(txt) && colonIdx >= 0
            ? trimEdgeSeparators(sliceStyledText(token, colonIdx + 1))
            : token
        continue
      }

      if (github && githubUrl(txt) === github && !txt.includes(' ')) {
        continue
      }

      remainingTokens.push(token)
    }

    if (remainingTokens.length) {
      profileLines.push(concatStyledTexts(remainingTokens, ' · '))
    }
  }

  for (const url of extraLinks) {
    if (!github && /github\.com/i.test(url)) {
      github = url
    } else if (
      !profileLines.some((line) => {
        const existing = line.text.trim()
        return existing.includes(url) || externalUrl(existing) === url
      })
    ) {
      profileLines.push({ text: url, formats: [] })
    }
  }

  const nameFormats = stripHeadingFormats(nameStyled.formats, nameStyled.text)
  const roleFormats = stripHeadingFormats(roleStyled.formats, roleStyled.text)

  const textFormats: ResumeDocument['profile']['textFormats'] = {
    ...(nameFormats.length ? { name: nameFormats } : {}),
    ...(roleFormats.length ? { role: roleFormats } : {}),
    ...(emailFormats.length ? { email: emailFormats } : {}),
    ...(phoneFormats.length ? { phone: phoneFormats } : {}),
    ...(locationFormats.length ? { location: locationFormats } : {}),
  }

  const lineFormats = profileLines.map((line) => line.formats)

  return {
    profile: {
      name: nameStyled.text,
      role: roleStyled.text,
      profileLines: profileLines.map((line) => line.text),
      github,
      phone,
      email,
      location,
      summary: '',
      photo: null,
      ...(Object.keys(textFormats).length ? { textFormats } : {}),
      ...(lineFormats.some((item) => item.length > 0)
        ? { profileLineFormats: lineFormats }
        : {}),
    },
    nameFontSize: maxFont > 0 ? maxFont : 28,
    extraLinks,
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSectionsFromColumns(
  columns: { column?: SectionColumn; lines: VisualLine[] }[],
  medianBodyFontSize: number,
): { sections: ResumeSection[]; headingFontSizes: number[] } {
  const sections: ResumeSection[] = []
  const headingFontSizes: number[] = []

  for (const col of columns) {
    let currentKind: SectionKind = 'custom'
    let currentTitle = '简历内容'
    let currentTitleFormats: TextFormatRange[] = []
    let currentLines: VisualLine[] = []

    const flushSection = (): void => {
      if (!currentLines.length) return
      const section = createSection(currentKind)
      section.title = currentTitle
      if (col.column) section.column = col.column
      const cleanedTitleFormats = stripHeadingFormats(currentTitleFormats, currentTitle)
      if (cleanedTitleFormats.length) section.titleFormats = cleanedTitleFormats
      section.entries = parseEntriesFromLines(
        currentLines,
        currentKind,
        medianBodyFontSize,
      )
      if (section.entries.length) sections.push(section)
      currentLines = []
    }

    for (const line of col.lines) {
      if (isLikelySectionHeading(line, medianBodyFontSize)) {
        flushSection()
        let cleanedStyled = removeStyledMatches(line.styled, DECORATIVE_ICON_REGEX)
        cleanedStyled = removeStyledMatches(cleanedStyled, /^[▪▫●■◆▶►|｜]+\s*/)
        cleanedStyled = removeStyledMatches(cleanedStyled, /[:：]\s*$/)
        cleanedStyled = trimStyledText(cleanedStyled)
        const rawTitle = cleanedStyled.text || cleanSectionTitle(line.styled.text)
        currentKind = detectSectionKind(rawTitle) ?? 'custom'
        currentTitle = rawTitle || sectionTitleFallback(currentKind)
        currentTitleFormats = cleanedStyled.text ? cleanedStyled.formats : []
        headingFontSizes.push(line.fontSize)
      } else {
        currentLines.push(line)
      }
    }
    flushSection()
  }

  return { sections, headingFontSizes }
}

function sectionTitleFallback(kind: SectionKind): string {
  const map: Record<SectionKind, string> = {
    education: '教育经历',
    work: '工作 / 实习',
    projects: '项目经历',
    skills: '专业技能',
    awards: '荣誉证书',
    custom: '个人补充',
  }
  return map[kind]
}

function countResumeFormats(resume: ResumeDocument): {
  total: number
  colored: number
  bold: number
} {
  const allRanges: TextFormatRange[] = []
  if (resume.profile.textFormats) {
    for (const ranges of Object.values(resume.profile.textFormats)) {
      if (ranges) allRanges.push(...ranges)
    }
  }
  if (resume.profile.profileLineFormats) {
    for (const ranges of resume.profile.profileLineFormats) allRanges.push(...ranges)
  }
  for (const section of resume.sections) {
    if (section.titleFormats) allRanges.push(...section.titleFormats)
    for (const entry of section.entries) {
      if (entry.textFormats) {
        for (const ranges of Object.values(entry.textFormats)) {
          if (ranges) allRanges.push(...ranges)
        }
      }
    }
  }
  return {
    total: allRanges.length,
    colored: allRanges.filter((r) => Boolean(r.color)).length,
    bold: allRanges.filter((r) => Boolean(r.bold)).length,
  }
}

/**
 * 将提取后的 PDF 页面数据转换为通过完整校验的 `ResumeDocument` 及导入摘要。
 */
export function buildResumeFromPdf(parsed: ParsedPdfContent): PdfImportSummary {
  const warnings: string[] = []
  const totalSpans = parsed.pages.reduce((sum, p) => sum + p.spans.length, 0)
  if (!parsed.pages.length || totalSpans === 0) {
    throw new Error('未能从该 PDF 中识别到可编辑文字（可能是扫描件或纯图片 PDF）。')
  }

  const { bodyInk, headerBgColor, headerInk } = detectBaselineInks(parsed.pages)

  // 计算按字符长度加权的正文字号中位数（45 分位）
  const weightedFontSamples: { size: number; weight: number }[] = []
  let totalCharWeight = 0
  for (const page of parsed.pages) {
    for (const span of page.spans) {
      const len = span.text.trim().length
      if (!len) continue
      weightedFontSamples.push({ size: span.fontSize, weight: len })
      totalCharWeight += len
    }
  }
  weightedFontSamples.sort((a, b) => a.size - b.size)
  let medianBodyFontSize = 10.5
  let accWeight = 0
  for (const sample of weightedFontSamples) {
    accWeight += sample.weight
    if (accWeight >= totalCharWeight * 0.45) {
      medianBodyFontSize = sample.size
      break
    }
  }

  const pageLayouts: ColumnLayoutDetection[] = []
  const allLines: VisualLine[] = []
  for (const page of parsed.pages) {
    const { layout, lines } = buildVisualLinesForPage(page, bodyInk, headerInk)
    pageLayouts.push(layout)
    allLines.push(...lines)
  }

  if (!allLines.length) {
    throw new Error('该 PDF 缺少有效的文本行，无法导入。')
  }

  const primaryLayout = pageLayouts[0]?.mode ?? 'single'
  const { headerLines, bodyColumns } = extractHeaderAndBody(
    allLines,
    primaryLayout,
    medianBodyFontSize,
  )

  const allLinks = parsed.pages.flatMap((p) => p.links)
  const { profile, nameFontSize } = parseProfileFromHeader(headerLines, allLinks)
  const { sections, headingFontSizes } = buildSectionsFromColumns(
    bodyColumns,
    medianBodyFontSize,
  )

  const baseTitle = parsed.fileName.replace(/\.pdf$/i, '').trim() || '导入的 PDF 简历'
  const resume = createResume(baseTitle)
  const templateId = inferTemplateId(primaryLayout, Boolean(headerBgColor))
  const avgHeadingFontSize = headingFontSizes.length
    ? headingFontSizes.reduce((sum, s) => sum + s, 0) / headingFontSizes.length
    : medianBodyFontSize * 1.35

  resume.templateId = templateId
  resume.profile = profile
  resume.sections = sections.length ? sections : resume.sections
  resume.appearance = inferAppearance(
    parsed.pages,
    allLines,
    headerBgColor,
    medianBodyFontSize,
    nameFontSize,
    avgHeadingFontSize,
  )
  resume.updatedAt = Date.now()

  const validated = parseResumeDocument(resume, 'PDF 导入简历')

  // 汇总提取到的全部链接
  const extractedLinks: string[] = []
  const pushUniqueLink = (url?: string): void => {
    const valid = url ? (externalUrl(url) ?? githubUrl(url)) : undefined
    if (valid && !extractedLinks.includes(valid)) extractedLinks.push(valid)
  }
  pushUniqueLink(validated.profile.github)
  for (const section of validated.sections) {
    for (const entry of section.entries) pushUniqueLink(entry.link)
  }
  for (const link of allLinks) {
    if (!/^(?:mailto:|tel:)/i.test(link.url)) pushUniqueLink(link.url)
  }

  if (parsed.pages.some((p) => p.spans.length === 0)) {
    warnings.push('部分页面未检测到文字层（可能是纯图片页），已自动跳过。')
  }
  if (!validated.profile.name) {
    warnings.push('未能自动识别姓名，导入后请在顶部页眉直接点击补充。')
  }
  if (sections.length === 0) {
    warnings.push('未能识别出标准栏目标题，已保留默认栏目结构供你整理。')
  }

  const formatCounts = countResumeFormats(validated)
  const palette = resumePalettes.find((p) => p.id === validated.appearance.accent)
  const template = getResumeTemplate(validated.templateId)

  return {
    resume: validated,
    pageCount: parsed.pages.length,
    sectionCount: validated.sections.length,
    entryCount: validated.sections.reduce((sum, s) => sum + s.entries.length, 0),
    linkCount: extractedLinks.length,
    extractedLinks,
    formatRangeCount: formatCounts.total,
    coloredRangeCount: formatCounts.colored,
    boldRangeCount: formatCounts.bold,
    matchedPaletteName: palette?.name ?? validated.appearance.accent,
    matchedTemplateName: template.name,
    warnings,
  }
}
