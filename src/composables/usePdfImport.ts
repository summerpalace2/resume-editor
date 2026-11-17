/** @file 供首页工作区与简历管理页共用的 PDF 选择与解析状态管理。 */
import { shallowRef, ref } from 'vue'
import { buildResumeFromPdf, type PdfImportSummary } from '../domain/pdfImport'

export function usePdfImport() {
  const parsingPdf = ref(false)
  const pendingPdf = shallowRef<PdfImportSummary | null>(null)

  async function parsePdfFile(file: File): Promise<PdfImportSummary | null> {
    if (parsingPdf.value) return null
    parsingPdf.value = true
    try {
      const { extractPdfContent } = await import('../services/pdfParser')
      const parsed = await extractPdfContent(file)
      const summary = buildResumeFromPdf(parsed)
      pendingPdf.value = summary
      return summary
    } finally {
      parsingPdf.value = false
    }
  }

  function clearPendingPdf(): void {
    pendingPdf.value = null
  }

  return {
    parsingPdf,
    pendingPdf,
    parsePdfFile,
    clearPendingPdf,
  }
}
