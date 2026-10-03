/**
 * @file 工作区业务动作与保存状态；页面通过动作修改文档，禁止分散写入副作用。
 * 只有成功读取的工作区允许写回；读取失败不创建临时文档覆盖未知旧数据。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { cloneResume, createResume, createStarterResume } from '../data/defaultResume'
import { cloneData } from '../data/clone'
import { readBackup } from '../storage/backup'
import { loadWorkspace, saveWorkspace, WorkspaceConflictError } from '../storage/database'
import { createSaveQueue, type SaveState } from '../storage/saveQueue'
import { parseResumeDocument } from '../domain/validation'
import type { ResumeAppearance, ResumeDocument, ResumeTemplateId } from '../types'

export const useResumeStore = defineStore('resumes', () => {
  const resumes = ref<ResumeDocument[]>([])
  const activeResumeId = ref<string | null>(null)
  /** 页面完成读取尝试不等于获得写权限；失败界面可重试，canPersist 单独保护。 */
  const ready = ref(false)
  const canPersist = ref(false)
  const conflict = ref(false)
  const saveState = ref<SaveState>('loading')
  const saveErrorMessage = ref<string | null>(null)
  const hasUnsavedChanges = ref(false)
  const activeResume = computed(
    () => resumes.value.find((resume) => resume.id === activeResumeId.value) ?? null,
  )
  let databaseRevision = 0
  let initialization: Promise<void> | undefined

  const queue = createSaveQueue({
    enabled: () => canPersist.value && !conflict.value,
    snapshot: () => ({
      resumes: cloneData(resumes.value),
      activeResumeId: activeResumeId.value,
    }),
    write: async (snapshot) => {
      databaseRevision = await saveWorkspace(
        snapshot.resumes,
        snapshot.activeResumeId,
        databaseRevision,
      )
    },
    onState: (state, error) => {
      hasUnsavedChanges.value = state !== 'saved'
      if (error instanceof WorkspaceConflictError) conflict.value = true
      saveState.value = conflict.value ? 'error' : state
      if (error && !conflict.value)
        saveErrorMessage.value =
          error instanceof Error ? error.message : '本地保存失败，请重试或下载备份。'
      else if (error instanceof WorkspaceConflictError)
        saveErrorMessage.value = error.message
      else if (state === 'saved') saveErrorMessage.value = null
    },
  })

  function assertEditable(): void {
    if (!canPersist.value || conflict.value)
      throw new Error('请先成功读取本地工作区，再进行编辑。')
  }

  /** 成功读取后才创建首次示例；旧集合校验失败时停止并保留数据库原记录。 */
  async function readInitialWorkspace(): Promise<void> {
    canPersist.value = false
    saveState.value = 'loading'
    try {
      const saved = await loadWorkspace()
      queue.reset()
      databaseRevision = saved.revision
      resumes.value = saved.resumes
      activeResumeId.value = saved.activeResumeId
      conflict.value = false
      canPersist.value = true
      saveErrorMessage.value = null
      hasUnsavedChanges.value = false
      if (!resumes.value.length) {
        const first = createStarterResume()
        resumes.value = [first]
        activeResumeId.value = first.id
        queue.markDirty()
      } else {
        if (!activeResume.value) {
          activeResumeId.value = resumes.value[0]?.id ?? null
          queue.markDirty()
        } else saveState.value = 'saved'
      }
    } catch (error) {
      canPersist.value = false
      saveState.value = 'error'
      saveErrorMessage.value =
        error instanceof Error ? error.message : '无法读取本机简历数据。'
    } finally {
      ready.value = true
    }
  }

  /** 初始化/重读合并并发调用；先等待队列结束，失败不会自动覆盖已有内存副本。 */
  async function initialize(): Promise<void> {
    if (initialization) return initialization
    initialization = (async () => {
      if (queue.hasPending()) await queue.flush().catch(() => undefined)
      await readInitialWorkspace()
    })()
    try {
      await initialization
    } finally {
      initialization = undefined
    }
  }

  /** 显式保存供离开页面、完成编辑和备份使用；失败保留待保存修改。 */
  async function flush(): Promise<void> {
    if (!canPersist.value || conflict.value) {
      if (queue.hasPending())
        throw new Error(saveErrorMessage.value ?? '工作区暂不能写回。')
      return
    }
    await queue.flush()
  }

  function setActive(id: string): void {
    assertEditable()
    if (id !== activeResumeId.value && resumes.value.some((resume) => resume.id === id)) {
      activeResumeId.value = id
      queue.markDirty()
    }
  }

  function createNew(): ResumeDocument {
    assertEditable()
    const resume = createResume(`我的简历 ${resumes.value.length + 1}`)
    resumes.value.push(resume)
    activeResumeId.value = resume.id
    queue.markDirty()
    return resume
  }

  function duplicate(id: string): ResumeDocument | null {
    assertEditable()
    const source = resumes.value.find((resume) => resume.id === id)
    if (!source) return null
    const copy = cloneResume(source)
    resumes.value.push(copy)
    activeResumeId.value = copy.id
    queue.markDirty()
    return copy
  }

  function remove(id: string): void {
    assertEditable()
    if (!resumes.value.some((resume) => resume.id === id)) return
    resumes.value = resumes.value.filter((resume) => resume.id !== id)
    if (activeResumeId.value === id) activeResumeId.value = resumes.value[0]?.id ?? null
    if (!resumes.value.length) {
      const replacement = createResume('我的简历')
      resumes.value.push(replacement)
      activeResumeId.value = replacement.id
    }
    queue.markDirty()
  }

  /** 所有完整文档替换共用校验、时间与调度；文档 ID 不允许由编辑动作改变。 */
  function replaceResume(value: ResumeDocument): void {
    // 冲突发生时允许根组件提交最后的局部草稿到内存，队列仍禁止写数据库。
    if (!canPersist.value) throw new Error('请先成功读取本地工作区。')
    const resume = parseResumeDocument(value)
    const index = resumes.value.findIndex((item) => item.id === resume.id)
    if (index < 0) return
    resume.updatedAt = Date.now()
    resumes.value[index] = resume
    queue.markDirty()
  }

  function renameResume(id: string, title: string): void {
    const source = resumes.value.find((resume) => resume.id === id)
    if (!source || source.title === title) return
    const copy = cloneData(source)
    copy.title = title
    replaceResume(copy)
  }

  /** @param patch 只覆盖指定外观字段；范围检查与时间更新统一由 replaceResume 完成。 */
  function updateAppearance(id: string, patch: Partial<ResumeAppearance>): void {
    const source = resumes.value.find((resume) => resume.id === id)
    if (!source) return
    const copy = cloneData(source)
    Object.assign(copy.appearance, patch)
    replaceResume(copy)
  }

  function selectTemplate(id: string, templateId: ResumeTemplateId): void {
    const source = resumes.value.find((resume) => resume.id === id)
    if (!source || source.templateId === templateId) return
    const copy = cloneData(source)
    copy.templateId = templateId
    replaceResume(copy)
  }

  /** 完整文件先校验，再合并；冲突的文档 ID 重生成，内嵌 ID 在所属文档内定位。 */
  async function importBackup(file: File): Promise<number> {
    assertEditable()
    const imported = await readBackup(file)
    assertEditable()
    const existingIds = new Set(resumes.value.map((resume) => resume.id))
    const copies = imported.map((resume) => {
      const copy = cloneData(resume)
      while (existingIds.has(copy.id)) copy.id = crypto.randomUUID()
      existingIds.add(copy.id)
      return copy
    })
    if (copies.length) {
      resumes.value.push(...copies)
      activeResumeId.value = copies[0]!.id
      queue.markDirty()
    }
    return copies.length
  }

  return {
    resumes,
    activeResumeId,
    activeResume,
    ready,
    canPersist,
    conflict,
    saveState,
    saveErrorMessage,
    hasUnsavedChanges,
    initialize,
    flush,
    setActive,
    createNew,
    duplicate,
    remove,
    replaceResume,
    renameResume,
    updateAppearance,
    selectTemplate,
    importBackup,
  }
})
