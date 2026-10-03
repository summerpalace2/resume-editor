/** @file 文档草稿与组件事件的编排；业务变换交给纯操作模块，存储交给父页面。 */
import { computed, onUnmounted } from 'vue'
import { cloneData } from '../data/clone'
import * as operations from '../domain/operations'
import { compressPhoto } from '../services/photos'
import { isColumnTemplate, resolveSectionColumn } from '../data/templates'
import type { ResumeDocument, ResumeSection, SectionColumn } from '../types'

export function useResumeEditing(
  current: () => ResumeDocument,
  submit: (resume: ResumeDocument) => void,
) {
  const usesColumns = computed(() => isColumnTemplate(current().templateId))
  let alive = true
  let photoRequest = 0
  onUnmounted(() => {
    alive = false
    photoRequest += 1
  })

  /** 对当前文档创建副本，仅有效操作发出事件；时间和校验统一由 store 处理。 */
  function apply(operation: operations.DraftOperation): void {
    const draft = cloneData(current())
    if (operation(draft)) submit(draft)
  }

  const updateProfile = (key: operations.ProfileTextKey, value: string) =>
    apply((draft) => operations.updateProfile(draft, key, value))
  const updateProfileLine = (index: number, value: string) =>
    apply((draft) => operations.updateProfileLine(draft, index, value))
  const updateSection = (id: string, patch: operations.SectionPatch) =>
    apply((draft) => operations.updateSection(draft, id, patch))
  const updateEntry = (
    sectionId: string,
    entryId: string,
    key: operations.EntryTextKey,
    value: string,
  ) => apply((draft) => operations.updateEntry(draft, sectionId, entryId, key, value))
  const moveSection = (index: number, offset: number) =>
    apply((draft) => operations.moveSection(draft, index, offset))
  const moveSectionToColumn = (id: string, column: SectionColumn) =>
    apply((draft) => operations.moveSectionToColumn(draft, id, column))
  const addSection = (column?: SectionColumn) =>
    apply((draft) => operations.addSection(draft, column))
  const addEntry = (id: string) => apply((draft) => operations.addEntry(draft, id))
  const moveEntry = (sectionId: string, index: number, offset: number) =>
    apply((draft) => operations.moveEntryTo(draft, sectionId, index, index + offset))
  const canMoveSection = (index: number, offset: number) =>
    operations.canMoveSection(current(), index, offset)
  const sectionColumn = (section: ResumeSection, index: number) =>
    resolveSectionColumn(current().templateId, section, index)

  function toggleSection(id: string): void {
    const section = current().sections.find((item) => item.id === id)
    if (section) updateSection(id, { visible: !section.visible })
  }

  function removeSection(id: string): void {
    if (window.confirm('确定删除这个栏目及其中的内容吗？'))
      apply((draft) => operations.removeSection(draft, id))
  }

  function removeEntry(sectionId: string, entryId: string): void {
    if (window.confirm('确定删除这条经历吗？'))
      apply((draft) => operations.removeEntry(draft, sectionId, entryId))
  }

  function updateGitHubFromInput(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      updateProfile('github', event.target.value)
  }

  function updateEntryLinkFromInput(
    sectionId: string,
    entryId: string,
    event: Event,
  ): void {
    if (event.target instanceof HTMLInputElement)
      updateEntry(sectionId, entryId, 'link', event.target.value)
  }

  function startSectionDrag(event: DragEvent, index: number): void {
    event.dataTransfer?.setData('text/plain', `section:${index}`)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function dropSection(event: DragEvent, target: number): void {
    const match = /^section:(\d+)$/.exec(event.dataTransfer?.getData('text/plain') ?? '')
    if (match?.[1])
      apply((draft) => operations.moveSectionTo(draft, Number(match[1]), target))
  }

  function startEntryDrag(event: DragEvent, sectionId: string, index: number): void {
    event.dataTransfer?.setData(
      'text/plain',
      JSON.stringify({ kind: 'entry', sectionId, index }),
    )
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }

  function dropEntry(event: DragEvent, sectionId: string, target: number): void {
    // JSON 负载允许备份中的稳定 ID 包含冒号；外部/栏目负载不会改变条目。
    let payload: unknown
    try {
      payload = JSON.parse(event.dataTransfer?.getData('text/plain') ?? '')
    } catch {
      return
    }
    if (
      payload &&
      typeof payload === 'object' &&
      'kind' in payload &&
      payload.kind === 'entry' &&
      'sectionId' in payload &&
      payload.sectionId === sectionId &&
      'index' in payload &&
      typeof payload.index === 'number'
    ) {
      const from = payload.index
      event.stopPropagation()
      apply((draft) => operations.moveEntryTo(draft, sectionId, from, target))
    }
  }

  /** 异步压缩期间换文档、移除照片或选另一张时，丢弃旧结果。 */
  async function selectPhoto(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) return
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    const id = current().id
    const request = ++photoRequest
    try {
      const photo = await compressPhoto(file)
      if (alive && request === photoRequest && id === current().id)
        apply((draft) => {
          draft.profile.photo = photo
          return true
        })
    } catch (error) {
      if (alive && request === photoRequest)
        window.alert(error instanceof Error ? error.message : '无法读取这张图片。')
    } finally {
      input.value = ''
    }
  }

  function removePhoto(): void {
    photoRequest += 1
    apply((draft) => {
      if (!draft.profile.photo) return false
      draft.profile.photo = null
      return true
    })
  }

  return {
    usesColumns,
    sectionColumn,
    canMoveSection,
    updateProfile,
    updateProfileLine,
    updateSection,
    updateEntry,
    moveSection,
    moveSectionToColumn,
    addSection,
    addEntry,
    moveEntry,
    toggleSection,
    removeSection,
    removeEntry,
    updateGitHubFromInput,
    updateEntryLinkFromInput,
    startSectionDrag,
    dropSection,
    startEntryDrag,
    dropEntry,
    selectPhoto,
    removePhoto,
  }
}
