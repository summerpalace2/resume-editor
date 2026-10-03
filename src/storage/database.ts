/** @file IndexedDB 原子快照存储；读取校验与修订比较都在存储边界完成。 */
import type { ResumeDocument } from '../types'
import { parseWorkspaceDocuments } from '../domain/validation'

const DATABASE_NAME = 'resume-studio'
// 新修订字段存入已有 settings 仓库，不改变旧数据库的仓库结构。
const DATABASE_VERSION = 1
const RESUMES_STORE = 'resumes'
const SETTINGS_STORE = 'settings'

export interface WorkspaceSnapshot {
  resumes: ResumeDocument[]
  activeResumeId: string | null
  revision: number
}

/** 另一个标签页先保存时拒绝旧快照，调用方保留内存数据供备份和恢复。 */
export class WorkspaceConflictError extends Error {
  constructor() {
    super('其他标签页已保存新内容。请先备份当前修改，再重新读取本地数据。')
    this.name = 'WorkspaceConflictError'
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(
        new Error(
          '当前预览环境未开放浏览器本地数据库，请在 Chrome 或 Edge 中打开此页面。',
        ),
      )
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let blocked = false
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(RESUMES_STORE))
        database.createObjectStore(RESUMES_STORE, { keyPath: 'id' })
      if (!database.objectStoreNames.contains(SETTINGS_STORE))
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
    }
    request.onblocked = () => {
      blocked = true
      reject(new Error('本地数据库被其他页面占用，请关闭旧页面后重试。'))
    }
    request.onsuccess = () => {
      if (blocked) request.result.close()
      else {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('无法打开本地简历数据库。'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法读取本地记录。'))
  })
}

/** 完整事务提交才表示成功；各请求成功时仍可能在之后回滚。 */
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('本地事务已取消。'))
    transaction.onerror = () => reject(transaction.error ?? new Error('本地事务失败。'))
  })
}

function settingValue(record: unknown): unknown {
  return record && typeof record === 'object' && 'value' in record
    ? record.value
    : undefined
}

function readRevision(record: unknown): number {
  // 无修订记录的旧数据库按 0 读取，首次保存自动补充。
  if (record === undefined) return 0
  const value = settingValue(record)
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('本地工作区修订信息损坏，已停止写回。')
  return value
}

/** 所有读取、事务和文档校验均成功后才返回；错误时不创建或覆盖默认数据。 */
export async function loadWorkspace(): Promise<WorkspaceSnapshot> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([RESUMES_STORE, SETTINGS_STORE], 'readonly')
    const settings = transaction.objectStore(SETTINGS_STORE)
    const [raw, active, revision] = await Promise.all([
      requestResult(transaction.objectStore(RESUMES_STORE).getAll()),
      requestResult(settings.get('activeResumeId')),
      requestResult(settings.get('workspaceRevision')),
      transactionDone(transaction),
    ])
    const activeId = settingValue(active)
    if (active !== undefined && activeId !== null && typeof activeId !== 'string')
      throw new Error('本地当前简历记录损坏，已停止写回。')
    return {
      resumes: parseWorkspaceDocuments(raw),
      activeResumeId: typeof activeId === 'string' ? activeId : null,
      revision: readRevision(revision),
    }
  } finally {
    database.close()
  }
}

/**
 * 保存完整快照，并在同一个 readwrite 事务内比较修订号。
 * @param expectedRevision 必须来自成功读取或上次成功提交；不能猜测或强制覆盖。
 * @returns 新修订号。冲突检查先于 clear，任何失败都不提交部分文档。
 */
export async function saveWorkspace(
  resumes: ResumeDocument[],
  activeResumeId: string | null,
  expectedRevision: number,
): Promise<number> {
  const documents = parseWorkspaceDocuments(resumes)
  if (
    activeResumeId !== null &&
    !documents.some((resume) => resume.id === activeResumeId)
  )
    throw new Error('当前简历不在待保存工作区中。')
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision >= Number.MAX_SAFE_INTEGER
  )
    throw new Error('工作区修订号无效。')
  const database = await openDatabase()
  try {
    return await new Promise<number>((resolve, reject) => {
      const transaction = database.transaction(
        [RESUMES_STORE, SETTINGS_STORE],
        'readwrite',
      )
      const settings = transaction.objectStore(SETTINGS_STORE)
      let cause: unknown
      const nextRevision = expectedRevision + 1
      transaction.oncomplete = () => resolve(nextRevision)
      transaction.onerror = () =>
        reject(cause ?? transaction.error ?? new Error('本地保存失败。'))
      transaction.onabort = () =>
        reject(cause ?? transaction.error ?? new Error('本地保存已取消。'))
      const request = settings.get('workspaceRevision')
      // 在请求回调内同步排入写操作，避免 await 后事务自动变为 inactive。
      request.onsuccess = () => {
        try {
          if (readRevision(request.result) !== expectedRevision)
            throw new WorkspaceConflictError()
          const store = transaction.objectStore(RESUMES_STORE)
          store.clear()
          for (const resume of documents) store.put(resume)
          settings.put({ key: 'activeResumeId', value: activeResumeId })
          settings.put({ key: 'workspaceRevision', value: nextRevision })
        } catch (error) {
          cause = error
          transaction.abort()
        }
      }
    })
  } finally {
    database.close()
  }
}
