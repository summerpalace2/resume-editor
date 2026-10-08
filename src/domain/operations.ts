/** @file 纯文档操作；只修改调用方的草稿，不访问 Vue、DOM、数据库或系统时间。 */
import { createEntry, createSection } from './factories'
import { isColumnTemplate, resolveSectionColumn } from '../data/templates'
import type {
  ResumeDocument,
  ResumeEntry,
  ResumeSection,
  SectionColumn,
  ProfileTextField,
  EntryTextField,
  TextFormatRange,
} from '../types'
import { rebaseFormats } from './textFormatting'

export type ProfileTextKey = ProfileTextField
export type EntryTextKey = EntryTextField
export type SectionPatch = Partial<
  Pick<ResumeSection, 'title' | 'visible' | 'titleFormats'>
>
export type DraftOperation = (draft: ResumeDocument) => boolean

function validIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length
}

export function updateProfile(
  draft: ResumeDocument,
  key: ProfileTextKey,
  value: string,
  formats?: TextFormatRange[],
): boolean {
  const previous = draft.profile.textFormats?.[key] ?? []
  const next = formats ?? rebaseFormats(draft.profile[key] ?? '', value, previous)
  if (draft.profile[key] === value && JSON.stringify(previous) === JSON.stringify(next))
    return false
  draft.profile.textFormats = { ...draft.profile.textFormats, [key]: next }
  draft.profile[key] = value
  return true
}

/** 只允许覆盖现有行或追加末尾，避免产生稀疏数组。 */
export function updateProfileLine(
  draft: ResumeDocument,
  index: number,
  value: string,
  formats?: TextFormatRange[],
): boolean {
  const lines = draft.profile.profileLines ?? []
  if (!Number.isInteger(index) || index < 0 || index > lines.length) return false
  const previous = draft.profile.profileLineFormats?.[index] ?? []
  const next = formats ?? rebaseFormats(lines[index] ?? '', value, previous)
  if (lines[index] === value && JSON.stringify(previous) === JSON.stringify(next))
    return false
  draft.profile.profileLines = [...lines]
  draft.profile.profileLines[index] = value
  const lineFormats = Array.from(
    { length: draft.profile.profileLines.length },
    (_, i) => draft.profile.profileLineFormats?.[i] ?? [],
  )
  lineFormats[index] = next
  draft.profile.profileLineFormats = lineFormats
  return true
}

export function updateSection(
  draft: ResumeDocument,
  id: string,
  patch: SectionPatch,
): boolean {
  const section = draft.sections.find((item) => item.id === id)
  if (!section) return false
  if (patch.title !== undefined && patch.titleFormats === undefined)
    patch = {
      ...patch,
      titleFormats: rebaseFormats(section.title, patch.title, section.titleFormats),
    }
  if (
    Object.entries(patch).every(
      ([key, value]) => section[key as keyof SectionPatch] === value,
    )
  )
    return false
  Object.assign(section, patch)
  return true
}

export function updateEntry(
  draft: ResumeDocument,
  sectionId: string,
  entryId: string,
  key: EntryTextKey,
  value: string,
  formats?: TextFormatRange[],
): boolean {
  const entry = draft.sections
    .find((section) => section.id === sectionId)
    ?.entries.find((item) => item.id === entryId)
  if (!entry) return false
  const previous = entry.textFormats?.[key] ?? []
  const next = formats ?? rebaseFormats(entry[key] ?? '', value, previous)
  if (entry[key] === value && JSON.stringify(previous) === JSON.stringify(next))
    return false
  entry.textFormats = { ...entry.textFormats, [key]: next }
  entry[key] = value
  return true
}

/** 排序前固定原始默认分组，防止奇偶索引改变时其他栏目跟着换栏。 */
function fixColumns(draft: ResumeDocument): void {
  draft.sections.forEach((section, index) => {
    section.column ??= resolveSectionColumn(draft.templateId, section, index)
  })
}

export function canMoveSection(
  draft: ResumeDocument,
  index: number,
  offset: number,
): boolean {
  if (!validIndex(index, draft.sections.length) || !Number.isInteger(offset)) return false
  if (!isColumnTemplate(draft.templateId))
    return validIndex(index + offset, draft.sections.length)
  const section = draft.sections[index]!
  const column = resolveSectionColumn(draft.templateId, section, index)
  const items = draft.sections.filter(
    (item, i) => resolveSectionColumn(draft.templateId, item, i) === column,
  )
  return validIndex(items.indexOf(section) + offset, items.length)
}

/** index 为原始数组索引，offset 为当前栏内的偏移；保留跨栏栏目的相对顺序。 */
export function moveSection(
  draft: ResumeDocument,
  index: number,
  offset: number,
): boolean {
  if (!offset || !canMoveSection(draft, index, offset)) return false
  if (!isColumnTemplate(draft.templateId)) {
    const [item] = draft.sections.splice(index, 1)
    draft.sections.splice(index + offset, 0, item!)
  } else {
    fixColumns(draft)
    const item = draft.sections[index]!
    const local = draft.sections
      .filter((section) => section.column === item.column)
      .indexOf(item)
    draft.sections.splice(index, 1)
    const remaining = draft.sections.filter((section) => section.column === item.column)
    const next = remaining[local + offset]
    const insertion = next
      ? draft.sections.indexOf(next)
      : draft.sections.reduce(
          (last, section, i) => (section.column === item.column ? i + 1 : last),
          0,
        )
    draft.sections.splice(insertion, 0, item)
  }
  return true
}

/** 拖拽索引都来自移动前的原始数组；双栏移到目标之前，并采用目标栏。 */
export function moveSectionTo(
  draft: ResumeDocument,
  from: number,
  target: number,
): boolean {
  if (
    !validIndex(from, draft.sections.length) ||
    !validIndex(target, draft.sections.length) ||
    from === target
  )
    return false
  if (isColumnTemplate(draft.templateId)) {
    fixColumns(draft)
    const item = draft.sections[from]!
    const targetItem = draft.sections[target]!
    item.column = targetItem.column
    draft.sections.splice(from, 1)
    draft.sections.splice(draft.sections.indexOf(targetItem), 0, item)
  } else {
    const [item] = draft.sections.splice(from, 1)
    draft.sections.splice(target, 0, item!)
  }
  return true
}

export function moveSectionToColumn(
  draft: ResumeDocument,
  id: string,
  column: SectionColumn,
): boolean {
  fixColumns(draft)
  const index = draft.sections.findIndex((section) => section.id === id)
  const item = draft.sections[index]
  if (!item || item.column === column) return false
  item.column = column
  draft.sections.splice(index, 1)
  const last = draft.sections.reduce(
    (previous, section, i) => (section.column === column ? i : previous),
    -1,
  )
  draft.sections.splice(last + 1, 0, item)
  return true
}

export function addSection(draft: ResumeDocument, column?: SectionColumn): boolean {
  const section = createSection('custom')
  if (column) section.column = column
  draft.sections.push(section)
  return true
}

export function addEntry(draft: ResumeDocument, id: string): boolean {
  const section = draft.sections.find((item) => item.id === id)
  if (!section) return false
  section.entries.push(createEntry())
  return true
}

export function moveEntryTo(
  draft: ResumeDocument,
  sectionId: string,
  from: number,
  target: number,
): boolean {
  const section = draft.sections.find((item) => item.id === sectionId)
  if (
    !section ||
    !validIndex(from, section.entries.length) ||
    !validIndex(target, section.entries.length) ||
    from === target
  )
    return false
  const [entry] = section.entries.splice(from, 1)
  section.entries.splice(target, 0, entry!)
  return true
}

export function removeEntry(
  draft: ResumeDocument,
  sectionId: string,
  entryId: string,
): boolean {
  const section = draft.sections.find((item) => item.id === sectionId)
  if (!section || !section.entries.some((entry) => entry.id === entryId)) return false
  section.entries = section.entries.filter((entry) => entry.id !== entryId)
  return true
}

export function removeSection(draft: ResumeDocument, id: string): boolean {
  if (!draft.sections.some((section) => section.id === id)) return false
  draft.sections = draft.sections.filter((section) => section.id !== id)
  return true
}

export function hasEntryContent(entry: ResumeEntry): boolean {
  return Boolean(
    entry.title || entry.subtitle || entry.period || entry.description || entry.link,
  )
}
