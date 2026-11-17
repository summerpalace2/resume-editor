/**
 * @file 浏览器本地 PDF 解析服务：通过 pdfjs-dist 提取文字、坐标、图形状态颜色、粗体、背景色块与链接注释。
 */
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFPageProxy, TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api'
import { externalUrl } from '../domain/links'
import {
  normalizeHexColor,
  type ParsedPdfContent,
  type PdfFillRect,
  type PdfLinkBox,
  type PdfPageContent,
  type PdfTextRun,
  type PdfTextSpan,
} from '../domain/pdfImport'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

type Matrix6 = [number, number, number, number, number, number]

interface GraphicsState {
  ctm: Matrix6
  fillColor: string
  fillAlpha: number
  fillTransparent: boolean
  fontName: string
  fontSize: number
  fontDirection: 1 | -1
  fontBold: boolean
  fontItalic: boolean
  fontVertical: boolean
  fontMatrix0: number
  textMatrix: Matrix6
  lineMatrix: Matrix6
  textX: number
  textY: number
  textRise: number
  charSpacing: number
  wordSpacing: number
  leading: number
  textHScale: number
  textRenderingMode: number
}

interface OpTextRun {
  text: string
  x: number
  y: number
  width: number
  fontName: string
  color: string
  bold: boolean
  italic: boolean
  used: boolean
}

const IDENTITY_MATRIX: Matrix6 = [1, 0, 0, 1, 0, 0]
const BOLD_FONT_NAME_REGEX =
  /(bold|black|heavy|semibold|demibold|extrabold|ultrabold|simhei|stheiti|heiti|黑体|[-_]w[6-9]\b)/i
const ITALIC_FONT_NAME_REGEX = /(italic|oblique|slant)/i

function isNumericArrayLike(
  value: unknown,
  minLength: number,
): value is ArrayLike<number> {
  if (!value || typeof value !== 'object') return false
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return false
  return (value as ArrayLike<number>).length >= minLength
}

function toNumberArray(value: ArrayLike<number>, length: number): number[] {
  const result: number[] = []
  for (let i = 0; i < length; i++) {
    result.push(Number(value[i] ?? 0))
  }
  return result
}

function cloneState(state: GraphicsState): GraphicsState {
  return {
    ...state,
    ctm: [...state.ctm] as Matrix6,
    textMatrix: [...state.textMatrix] as Matrix6,
    lineMatrix: [...state.lineMatrix] as Matrix6,
  }
}

function multiplyMatrices(m1: Matrix6, m2: Matrix6): Matrix6 {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

function applyMatrixToPoint(m: Matrix6, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

function toViewportRect(
  viewport: pdfjsLib.PageViewport,
  rect: [number, number, number, number],
): { x: number; y: number; width: number; height: number } {
  const [vx1, vy1] = viewport.convertToViewportPoint(rect[0], rect[1]) as [number, number]
  const [vx2, vy2] = viewport.convertToViewportPoint(rect[2], rect[3]) as [number, number]
  return {
    x: Math.min(vx1, vx2),
    y: Math.min(vy1, vy2),
    width: Math.abs(vx2 - vx1),
    height: Math.abs(vy2 - vy1),
  }
}

function transformRect(
  minMax: [number, number, number, number],
  ctm: Matrix6,
): [number, number, number, number] {
  const [x0, y0, x1, y1] = minMax
  const corners: [number, number][] = [
    applyMatrixToPoint(ctm, x0, y0),
    applyMatrixToPoint(ctm, x1, y0),
    applyMatrixToPoint(ctm, x0, y1),
    applyMatrixToPoint(ctm, x1, y1),
  ]
  const xs = corners.map((p) => p[0])
  const ys = corners.map((p) => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

function toHexByte(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)))
  return clamped.toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number): string {
  const scale = r <= 1 && g <= 1 && b <= 1 ? 255 : 1
  return `#${toHexByte(r * scale)}${toHexByte(g * scale)}${toHexByte(b * scale)}`
}

function parseColorArgs(args: unknown[]): string | null {
  if (!args.length) return null
  const first = args[0]
  if (typeof first === 'string') {
    if (first.startsWith('#')) return normalizeHexColor(first)
    const rgbMatch = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(first)
    if (rgbMatch) {
      return rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]))
    }
    return null
  }
  if (args.length >= 3 && args.slice(0, 3).every((n) => typeof n === 'number')) {
    return rgbToHex(args[0] as number, args[1] as number, args[2] as number)
  }
  return null
}

function readFontInfo(
  page: PDFPageProxy,
  fontRefName: string,
  styles: Record<string, TextStyle>,
): { bold: boolean; italic: boolean; fontMatrix0: number; vertical: boolean } {
  let bold = false
  let italic = false
  let fontMatrix0 = 0.001
  let vertical = false

  try {
    if (page.commonObjs.has(fontRefName)) {
      const fontObj = page.commonObjs.get(fontRefName) as
        | {
            bold?: boolean
            black?: boolean
            italic?: boolean
            vertical?: boolean
            name?: string
            fallbackName?: string
            systemFontInfo?: { css?: string }
            fontMatrix?: ArrayLike<number>
          }
        | undefined
      if (fontObj) {
        if (fontObj.bold || fontObj.black) bold = true
        if (fontObj.italic) italic = true
        if (fontObj.vertical) vertical = true
        if (fontObj.name && BOLD_FONT_NAME_REGEX.test(fontObj.name)) bold = true
        if (fontObj.name && ITALIC_FONT_NAME_REGEX.test(fontObj.name)) italic = true
        if (fontObj.systemFontInfo?.css) {
          if (BOLD_FONT_NAME_REGEX.test(fontObj.systemFontInfo.css)) bold = true
          if (ITALIC_FONT_NAME_REGEX.test(fontObj.systemFontInfo.css)) italic = true
        }
        if (isNumericArrayLike(fontObj.fontMatrix, 1)) {
          fontMatrix0 = Number(fontObj.fontMatrix[0]) || 0.001
        }
      }
    }
  } catch {
    // 字体对象尚未加载完成时回退到 textContent styles
  }

  const style = styles[fontRefName]
  if (style?.fontFamily && BOLD_FONT_NAME_REGEX.test(style.fontFamily)) bold = true
  if (style?.fontFamily && ITALIC_FONT_NAME_REGEX.test(style.fontFamily)) italic = true
  if (style?.vertical) vertical = true
  return { bold, italic, fontMatrix0, vertical }
}

function extractGlyphTextAndAdvance(
  glyphs: unknown[],
  state: Pick<
    GraphicsState,
    | 'fontSize'
    | 'fontMatrix0'
    | 'textHScale'
    | 'charSpacing'
    | 'wordSpacing'
    | 'fontDirection'
    | 'fontVertical'
  >,
): { text: string; dx: number; dy: number } {
  let text = ''
  let advance = 0
  const widthScale = state.fontSize * state.fontMatrix0
  const spacingDir = state.fontVertical ? 1 : -1
  for (const glyph of glyphs) {
    if (typeof glyph === 'number') {
      advance += (spacingDir * glyph * state.fontSize) / 1000
    } else if (glyph && typeof glyph === 'object') {
      const g = glyph as {
        unicode?: string
        fontChar?: string
        width?: number
        isSpace?: boolean
        vmetric?: number[]
      }
      text += g.unicode ?? g.fontChar ?? ''
      const spacing = (g.isSpace ? state.wordSpacing : 0) + state.charSpacing
      const glyphWidth =
        state.fontVertical && Array.isArray(g.vmetric) && typeof g.vmetric[0] === 'number'
          ? -g.vmetric[0]
          : typeof g.width === 'number'
            ? g.width
            : 0
      advance += state.fontVertical
        ? glyphWidth * widthScale - spacing * state.fontDirection
        : glyphWidth * widthScale + spacing * state.fontDirection
    }
  }
  return state.fontVertical
    ? { text, dx: 0, dy: -advance }
    : { text, dx: advance * state.textHScale * state.fontDirection, dy: 0 }
}

function isTextItem(item: unknown): item is TextItem {
  return Boolean(item && typeof item === 'object' && 'str' in item)
}

function collectOpsData(
  page: PDFPageProxy,
  opList: { fnArray: number[]; argsArray: unknown[] },
  styles: Record<string, TextStyle>,
): { opRuns: OpTextRun[]; fillRects: PdfFillRect[] } {
  const viewport = page.getViewport({ scale: 1 })
  const OPS = pdfjsLib.OPS
  const stack: GraphicsState[] = []
  let state: GraphicsState = {
    ctm: [...IDENTITY_MATRIX] as Matrix6,
    fillColor: '#000000',
    fillAlpha: 1,
    fillTransparent: false,
    fontName: '',
    fontSize: 0,
    fontDirection: 1,
    fontBold: false,
    fontItalic: false,
    fontVertical: false,
    fontMatrix0: 0.001,
    textMatrix: [...IDENTITY_MATRIX] as Matrix6,
    lineMatrix: [...IDENTITY_MATRIX] as Matrix6,
    textX: 0,
    textY: 0,
    textRise: 0,
    charSpacing: 0,
    wordSpacing: 0,
    leading: 0,
    textHScale: 1,
    textRenderingMode: 0,
  }

  const opRuns: OpTextRun[] = []
  const fillRects: PdfFillRect[] = []
  const fillOpCodes = new Set<number>([
    OPS.fill,
    OPS.eoFill,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke,
  ])

  const moveText = (dx: number, dy: number): void => {
    state.lineMatrix = multiplyMatrices(state.lineMatrix, [1, 0, 0, 1, dx, dy])
    state.textMatrix = [...state.lineMatrix] as Matrix6
    state.textX = 0
    state.textY = 0
  }

  const recordShowText = (glyphs: unknown[]): void => {
    const combinedMatrix = multiplyMatrices(state.ctm, state.textMatrix)
    const [ux, uy] = applyMatrixToPoint(
      combinedMatrix,
      state.textX,
      state.textY + state.textRise,
    )
    const [vx, vy] = viewport.convertToViewportPoint(ux, uy)
    const { text, dx, dy } = extractGlyphTextAndAdvance(glyphs, state)
    const [uxEnd, uyEnd] = applyMatrixToPoint(
      combinedMatrix,
      state.textX + dx,
      state.textY + state.textRise + dy,
    )
    const [vxEnd] = viewport.convertToViewportPoint(uxEnd, uyEnd)
    state.textX += dx
    state.textY += dy
    if (
      !text.length ||
      state.fillTransparent ||
      state.fillAlpha <= 0.05 ||
      state.textRenderingMode === 3
    )
      return
    const syntheticBold = state.textRenderingMode === 2
    opRuns.push({
      text,
      x: Math.min(vx, vxEnd),
      y: vy,
      width: Math.abs(vxEnd - vx),
      fontName: state.fontName,
      color: state.fillColor,
      bold: state.fontBold || syntheticBold,
      italic: state.fontItalic,
      used: false,
    })
  }

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]!
    const args = (opList.argsArray[i] as unknown[]) ?? []

    switch (fn) {
      case OPS.save:
        stack.push(cloneState(state))
        break
      case OPS.restore: {
        const prev = stack.pop()
        if (prev) state = prev
        break
      }
      case OPS.paintFormXObjectBegin: {
        stack.push(cloneState(state))
        const matrix = args[0]
        if (isNumericArrayLike(matrix, 6)) {
          state.ctm = multiplyMatrices(state.ctm, toNumberArray(matrix, 6) as Matrix6)
        }
        break
      }
      case OPS.paintFormXObjectEnd: {
        const prev = stack.pop()
        if (prev) state = prev
        break
      }
      case OPS.beginGroup:
        // beginGroup 的 matrix 仅用于画布组裁剪，不重复乘入 CTM（CTM 由 paintFormXObjectBegin 应用）。
        stack.push(cloneState(state))
        break
      case OPS.endGroup: {
        const prev = stack.pop()
        if (prev) state = prev
        break
      }
      case OPS.transform:
        if (args.length >= 6) {
          state.ctm = multiplyMatrices(state.ctm, args.slice(0, 6) as Matrix6)
        }
        break
      case OPS.setGState: {
        const pairs = args[0]
        if (Array.isArray(pairs)) {
          for (const pair of pairs) {
            if (!Array.isArray(pair)) continue
            if (pair[0] === 'ca' && typeof pair[1] === 'number') {
              state.fillAlpha = pair[1]
            } else if (
              pair[0] === 'Font' &&
              Array.isArray(pair[1]) &&
              pair[1].length >= 2
            ) {
              const fontRefName = String(pair[1][0] ?? '')
              const rawSize = typeof pair[1][1] === 'number' ? pair[1][1] : 10
              const info = readFontInfo(page, fontRefName, styles)
              state.fontName = fontRefName
              state.fontDirection = rawSize < 0 ? -1 : 1
              state.fontSize = Math.abs(rawSize)
              state.fontBold = info.bold
              state.fontItalic = info.italic
              state.fontVertical = info.vertical
              state.fontMatrix0 = info.fontMatrix0
            }
          }
        }
        break
      }
      case OPS.setFillRGBColor: {
        const hex = parseColorArgs(args)
        if (hex) {
          state.fillColor = hex
          state.fillTransparent = false
        }
        break
      }
      case OPS.setFillGray:
        if (typeof args[0] === 'number') {
          state.fillColor = rgbToHex(args[0], args[0], args[0])
          state.fillTransparent = false
        }
        break
      case OPS.setFillCMYKColor:
        if (args.length >= 4 && args.slice(0, 4).every((n) => typeof n === 'number')) {
          const [c, m, y, k] = args as [number, number, number, number]
          state.fillColor = rgbToHex(
            (1 - c) * (1 - k),
            (1 - m) * (1 - k),
            (1 - y) * (1 - k),
          )
          state.fillTransparent = false
        }
        break
      case OPS.setFillTransparent:
        state.fillTransparent = true
        break
      case OPS.setFont: {
        const fontRefName = String(args[0] ?? '')
        const rawSize = typeof args[1] === 'number' ? args[1] : 10
        const info = readFontInfo(page, fontRefName, styles)
        state.fontName = fontRefName
        state.fontDirection = rawSize < 0 ? -1 : 1
        state.fontSize = Math.abs(rawSize)
        state.fontBold = info.bold
        state.fontItalic = info.italic
        state.fontVertical = info.vertical
        state.fontMatrix0 = info.fontMatrix0
        break
      }
      case OPS.setCharSpacing:
        if (typeof args[0] === 'number') state.charSpacing = args[0]
        break
      case OPS.setWordSpacing:
        if (typeof args[0] === 'number') state.wordSpacing = args[0]
        break
      case OPS.setTextRise:
        if (typeof args[0] === 'number') state.textRise = args[0]
        break
      case OPS.setTextRenderingMode:
        if (typeof args[0] === 'number') state.textRenderingMode = args[0]
        break
      case OPS.setHScale:
        if (typeof args[0] === 'number') state.textHScale = args[0] / 100
        break
      case OPS.setLeading:
        if (typeof args[0] === 'number') state.leading = -args[0]
        break
      case OPS.beginText:
        state.textMatrix = [...IDENTITY_MATRIX] as Matrix6
        state.lineMatrix = [...IDENTITY_MATRIX] as Matrix6
        state.textX = 0
        state.textY = 0
        break
      case OPS.setTextMatrix: {
        const candidate = isNumericArrayLike(args[0], 6) ? args[0] : args
        if (isNumericArrayLike(candidate, 6)) {
          const m = toNumberArray(candidate, 6) as Matrix6
          state.textMatrix = m
          state.lineMatrix = [...m] as Matrix6
          state.textX = 0
          state.textY = 0
        }
        break
      }
      case OPS.moveText:
        if (typeof args[0] === 'number' && typeof args[1] === 'number') {
          moveText(args[0], args[1])
        }
        break
      case OPS.setLeadingMoveText:
        if (typeof args[0] === 'number' && typeof args[1] === 'number') {
          state.leading = args[1]
          moveText(args[0], args[1])
        }
        break
      case OPS.nextLine:
        moveText(0, state.leading)
        break
      case OPS.showText:
      case OPS.showSpacedText:
        if (Array.isArray(args[0])) recordShowText(args[0])
        break
      case OPS.nextLineShowText:
      case OPS.nextLineSetSpacingShowText:
        moveText(0, state.leading)
        if (Array.isArray(args[0])) recordShowText(args[0])
        break
      case OPS.constructPath: {
        const subOp = args[0] as number
        const minMax = args[2]
        if (
          fillOpCodes.has(subOp) &&
          isNumericArrayLike(minMax, 4) &&
          !state.fillTransparent &&
          state.fillAlpha > 0.1
        ) {
          const rect = toNumberArray(minMax, 4) as [number, number, number, number]
          const pageRect = transformRect(rect, state.ctm)
          const box = toViewportRect(viewport, pageRect)
          if (box.width >= 2 && box.height >= 2) {
            fillRects.push({ ...box, color: state.fillColor })
          }
        }
        break
      }
      default:
        break
    }
  }

  return { opRuns, fillRects }
}

function normalizeForMatch(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ')
}

function matchRunsToTextItem(
  str: string,
  vx: number,
  vy: number,
  width: number,
  fontSize: number,
  fontName: string,
  opRuns: OpTextRun[],
  fallbackBold: boolean,
  fallbackItalic: boolean,
): { runs: PdfTextRun[]; color: string; bold: boolean; italic: boolean } {
  const yTol = Math.max(4, fontSize * 0.55)
  const itemEnd = vx + Math.max(width, fontSize)
  const candidates = opRuns.filter((run) => {
    if (Math.abs(run.y - vy) > yTol) return false
    const runEnd = run.x + Math.max(run.width, fontSize * 0.5)
    return runEnd >= vx - 10 && run.x <= itemEnd + 10
  })

  const sameFontCandidates = candidates.filter((run) => run.fontName === fontName)
  const pool = sameFontCandidates.length ? sameFontCandidates : candidates
  const unused = pool.filter((run) => !run.used)
  const activePool = unused.length ? unused : pool

  if (!activePool.length) {
    return {
      runs: [{ text: str, color: '#000000', bold: fallbackBold, italic: fallbackItalic }],
      color: '#000000',
      bold: fallbackBold,
      italic: fallbackItalic,
    }
  }

  // 若所有候选片段颜色、粗细和斜体一致，全部标记为已消费后整体返回。
  const first = activePool[0]!
  const uniform = activePool.every(
    (run) =>
      run.color === first.color && run.bold === first.bold && run.italic === first.italic,
  )
  if (uniform || activePool.length === 1) {
    for (const run of activePool) run.used = true
    const italic = first.italic || fallbackItalic
    return {
      runs: [{ text: str, color: first.color, bold: first.bold || fallbackBold, italic }],
      color: first.color,
      bold: first.bold || fallbackBold,
      italic,
    }
  }

  // 按顺序在 str 中消费匹配子串；未命中前导片段保留默认黑色/字体样式，避免样式串色。
  const sorted = [...activePool].sort((a, b) => a.x - b.x)
  const runs: PdfTextRun[] = []
  let cursor = 0
  for (const candidate of sorted) {
    const cleanNeedle = candidate.text.trim()
    if (!cleanNeedle) continue
    let idx = str.indexOf(cleanNeedle, cursor)
    let matchedLen = cleanNeedle.length
    if (idx < 0) {
      const normNeedle = normalizeForMatch(cleanNeedle)
      const normTail = normalizeForMatch(str.slice(cursor))
      const normIdx = normNeedle ? normTail.indexOf(normNeedle) : -1
      if (normIdx >= 0) {
        idx = cursor + normIdx
        matchedLen = Math.min(str.length - idx, normNeedle.length)
      }
    }
    if (idx < 0) continue
    if (idx > cursor) {
      runs.push({
        text: str.slice(cursor, idx),
        color: '#000000',
        bold: fallbackBold,
        italic: fallbackItalic,
      })
    }
    const end = idx + matchedLen
    runs.push({
      text: str.slice(idx, end),
      color: candidate.color,
      bold: candidate.bold || fallbackBold,
      italic: candidate.italic || fallbackItalic,
    })
    candidate.used = true
    cursor = end
  }
  if (cursor < str.length) {
    const tail = runs.at(-1)
    runs.push({
      text: str.slice(cursor),
      color: tail?.color ?? '#000000',
      bold: tail?.bold ?? fallbackBold,
      italic: tail?.italic ?? fallbackItalic,
    })
  }

  if (!runs.length) {
    for (const run of activePool) run.used = true
    const italic = first.italic || fallbackItalic
    return {
      runs: [{ text: str, color: first.color, bold: first.bold || fallbackBold, italic }],
      color: first.color,
      bold: first.bold || fallbackBold,
      italic,
    }
  }

  return {
    runs,
    color: runs[0]!.color,
    bold: runs.some((r) => r.bold),
    italic: runs.some((r) => r.italic),
  }
}

async function extractPageContent(
  page: PDFPageProxy,
  pageNumber: number,
): Promise<PdfPageContent> {
  const viewport = page.getViewport({ scale: 1 })
  const [textContent, opList, annotations] = await Promise.all([
    page.getTextContent(),
    page.getOperatorList(),
    page.getAnnotations({ intent: 'display' }),
  ])

  const { opRuns, fillRects } = collectOpsData(page, opList, textContent.styles)
  const rotated90 = viewport.rotation % 180 !== 0

  const spans: PdfTextSpan[] = []
  for (const item of textContent.items) {
    if (!isTextItem(item) || !item.str) continue
    const transformed = pdfjsLib.Util.transform(viewport.transform, item.transform)
    const vx = transformed[4]!
    const vy = transformed[5]!
    const fontSize = Math.hypot(transformed[0]!, transformed[1]!) || item.height || 10
    const rawW = Math.max(item.width, 0)
    const rawH = item.height > 0 ? item.height : fontSize
    const width = rotated90 ? rawH : rawW
    const height = rotated90 ? rawW : rawH
    const fontMeta = readFontInfo(page, item.fontName, textContent.styles)
    const matched = matchRunsToTextItem(
      item.str,
      vx,
      vy,
      width,
      fontSize,
      item.fontName,
      opRuns,
      fontMeta.bold,
      fontMeta.italic,
    )

    spans.push({
      text: item.str,
      runs: matched.runs,
      x: vx,
      y: vy,
      width,
      height,
      fontSize,
      color: matched.color,
      bold: matched.bold,
      italic: matched.italic,
      hasEOL: item.hasEOL,
    })
  }

  const links: PdfLinkBox[] = []
  for (const raw of annotations) {
    const annot = raw as {
      subtype?: string
      url?: string
      unsafeUrl?: string
      rect?: [number, number, number, number]
      quadPoints?: ArrayLike<number>
    }
    if (annot.subtype !== 'Link' || !annot.rect) continue
    const rawUrl = (
      typeof annot.url === 'string' && annot.url.trim()
        ? annot.url
        : typeof annot.unsafeUrl === 'string'
          ? annot.unsafeUrl
          : ''
    ).trim()
    if (!rawUrl) continue
    let normalizedUrl: string | undefined
    if (/^(?:mailto:|tel:)/i.test(rawUrl)) {
      normalizedUrl = rawUrl
    } else {
      normalizedUrl = externalUrl(rawUrl)
    }
    if (!normalizedUrl) continue
    if (isNumericArrayLike(annot.quadPoints, 8)) {
      const quadCount = Math.floor(annot.quadPoints.length / 8)
      for (let q = 0; q < quadCount; q++) {
        const base = q * 8
        const pts: [number, number][] = []
        for (let p = 0; p < 4; p++) {
          const [qx, qy] = viewport.convertToViewportPoint(
            Number(annot.quadPoints[base + p * 2]),
            Number(annot.quadPoints[base + p * 2 + 1]),
          ) as [number, number]
          pts.push([qx, qy])
        }
        const xs = pts.map((pt) => pt[0])
        const ys = pts.map((pt) => pt[1])
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        links.push({
          url: normalizedUrl,
          x: minX,
          y: minY,
          width: Math.max(...xs) - minX,
          height: Math.max(...ys) - minY,
        })
      }
    } else {
      const box = toViewportRect(viewport, annot.rect)
      links.push({
        url: normalizedUrl,
        ...box,
      })
    }
  }

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    spans,
    links,
    fillRects,
  }
}

/**
 * 读取用户选择的 PDF 文件并提取每页文字、样式颜色、链接与背景色块。
 */
export async function extractPdfContent(file: File): Promise<ParsedPdfContent> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('请选择有效的 PDF 文件。')
  }
  const buffer = await file.arrayBuffer()
  if (!buffer.byteLength) {
    throw new Error('所选 PDF 文件为空。')
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    verbosity: pdfjsLib.VerbosityLevel.ERRORS,
  })

  let pdfDocument: pdfjsLib.PDFDocumentProxy | undefined
  try {
    pdfDocument = await loadingTask.promise
    const pages: PdfPageContent[] = []
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber)
      pages.push(await extractPageContent(page, pageNumber))
    }
    return {
      fileName: file.name,
      pages,
    }
  } catch (error) {
    if (error instanceof pdfjsLib.PasswordException) {
      throw new Error('该 PDF 受密码保护，请先解除密码后再导入。', { cause: error })
    }
    if (error instanceof pdfjsLib.InvalidPDFException) {
      throw new Error('PDF 文件格式损坏或无法识别。', { cause: error })
    }
    throw error instanceof Error
      ? error
      : new Error('PDF 解析失败，请检查文件是否完整。', { cause: error })
  } finally {
    await pdfDocument?.cleanup().catch(() => undefined)
    await loadingTask.destroy().catch(() => undefined)
  }
}
