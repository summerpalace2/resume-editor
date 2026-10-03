/** @file JSON 备份协议、导入入口校验及下载；实际合并文档由 store 完成。 */
import type { ResumeBackup, ResumeDocument } from '../types'
import { cloneData } from '../data/clone'
import { parseResumeDocument } from '../domain/validation'

/** @param resumes 全部待备份文档，包含照片、布局和外观；返回独立快照。 */
export function createBackup(resumes: ResumeDocument[]): ResumeBackup {
  return {
    format: 'resume-studio-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    resumes: cloneData(resumes),
  }
}

/**
 * 读取用户选择的 JSON 文件，识别协议标识与版本，并校验目前支持的字段。
 * @param file 浏览器 File 对象；读取、JSON 解析及校验失败均向调用方抛错。
 * @returns 待合并文档，本函数不修改已有工作区。
 */
export async function readBackup(file: File): Promise<ResumeDocument[]> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('备份文件格式无法识别。')

  const backup = parsed as Partial<ResumeBackup>
  if (
    backup.format !== 'resume-studio-backup' ||
    backup.version !== 1 ||
    typeof backup.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(backup.createdAt)) ||
    !Array.isArray(backup.resumes)
  ) {
    throw new Error('这不是有效的简历工坊备份文件。')
  }
  return backup.resumes.map((resume, index) =>
    parseResumeDocument(resume, `备份简历[${index}]`),
  )
}

/** @param filename 下载文件名；value 应为可 JSON 序列化数据，下载后释放临时 URL。 */
export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
