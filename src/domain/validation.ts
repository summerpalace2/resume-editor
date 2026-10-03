/** @file 外部数据的完整运行时边界；导入、数据库读取及写入共用同一契约。 */
import type { ResumeDocument, ResumeEntry, ResumeSection, SectionKind } from '../types'
import { isResumeTemplateId } from '../data/templates'
import { isAccentChoice } from '../data/palettes'
import { baseFontOptions, hasValidHeaderTypography } from '../data/typography'

export class DocumentValidationError extends Error {
  constructor(path: string, expected: string) {
    super(`${path}：${expected}`)
    this.name = 'DocumentValidationError'
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DocumentValidationError(path, '应为对象')
  return value as Record<string, unknown>
}

function text(value: unknown, path: string, required = false): string {
  if (typeof value !== 'string' || (required && !value.trim()))
    throw new DocumentValidationError(path, required ? '应为非空字符串' : '应为字符串')
  return value
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new DocumentValidationError(path, '应为数组')
  return Array.from(value)
}

function uniqueIds(items: { id: string }[], path: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new DocumentValidationError(path, '存在重复 ID')
}

function parseEntry(value: unknown, path: string): ResumeEntry {
  const entry = record(value, path)
  return {
    id: text(entry.id, `${path}.id`, true),
    title: text(entry.title, `${path}.title`),
    subtitle: text(entry.subtitle, `${path}.subtitle`),
    period: text(entry.period, `${path}.period`),
    description: text(entry.description, `${path}.description`),
    // 旧版没有项目链接；只补这一已知可选字段，不修正无效的必填数据。
    ...(entry.link === undefined ? {} : { link: text(entry.link, `${path}.link`) }),
  }
}

const sectionKinds: SectionKind[] = [
  'education',
  'work',
  'projects',
  'skills',
  'awards',
  'custom',
]
function parseSection(value: unknown, path: string): ResumeSection {
  const section = record(value, path)
  if (!sectionKinds.includes(section.kind as SectionKind))
    throw new DocumentValidationError(`${path}.kind`, '未知栏目类别')
  if (typeof section.visible !== 'boolean')
    throw new DocumentValidationError(`${path}.visible`, '应为布尔值')
  if (
    section.column !== undefined &&
    section.column !== 'left' &&
    section.column !== 'right'
  )
    throw new DocumentValidationError(`${path}.column`, '应为 left 或 right')
  const entries = list(section.entries, `${path}.entries`).map((entry, index) =>
    parseEntry(entry, `${path}.entries[${index}]`),
  )
  uniqueIds(entries, `${path}.entries`)
  return {
    id: text(section.id, `${path}.id`, true),
    title: text(section.title, `${path}.title`),
    kind: section.kind as SectionKind,
    visible: section.visible,
    ...(section.column === undefined ? {} : { column: section.column }),
    entries,
  }
}

/**
 * 逐层校验并重建可持久化文档，剔除未知字段，不修改输入。
 * @param path 错误提示中的位置，便于定位备份中的具体文档、栏目和条目。
 * 已知旧字段缺省：github/profileLines/summary/photo；新增样式和链接保持可选。
 */
export function parseResumeDocument(value: unknown, path = '简历'): ResumeDocument {
  const resume = record(value, path)
  if (!isResumeTemplateId(resume.templateId))
    throw new DocumentValidationError(`${path}.templateId`, '未知版式')
  const profile = record(resume.profile, `${path}.profile`)
  const appearance = record(resume.appearance, `${path}.appearance`)
  if (!isAccentChoice(appearance.accent))
    throw new DocumentValidationError(`${path}.appearance.accent`, '未知配色')
  if (
    appearance.font !== 'modern' &&
    appearance.font !== 'classic' &&
    appearance.font !== 'round'
  )
    throw new DocumentValidationError(`${path}.appearance.font`, '未知字体')
  for (const option of baseFontOptions) {
    const size = appearance[option.key]
    if (
      typeof size !== 'number' ||
      !Number.isFinite(size) ||
      size < option.min ||
      size > option.max
    )
      throw new DocumentValidationError(
        `${path}.appearance.${option.key}`,
        `字号应在 ${option.min}～${option.max}px 内`,
      )
  }
  if (!hasValidHeaderTypography(appearance))
    throw new DocumentValidationError(`${path}.appearance`, '头部或个人信息字号无效')
  if (
    typeof resume.updatedAt !== 'number' ||
    !Number.isSafeInteger(resume.updatedAt) ||
    resume.updatedAt < 0 ||
    resume.updatedAt > 8_640_000_000_000_000
  )
    throw new DocumentValidationError(`${path}.updatedAt`, '应为有效毫秒时间戳')
  const photo = profile.photo ?? null
  if (
    photo !== null &&
    (typeof photo !== 'string' ||
      !/^data:image\/(?:jpeg|png|webp|gif|bmp|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(
        photo,
      ))
  )
    throw new DocumentValidationError(`${path}.profile.photo`, '应为本地图片数据或 null')
  const sections = list(resume.sections, `${path}.sections`).map((section, index) =>
    parseSection(section, `${path}.sections[${index}]`),
  )
  uniqueIds(sections, `${path}.sections`)
  return {
    id: text(resume.id, `${path}.id`, true),
    title: text(resume.title, `${path}.title`),
    templateId: resume.templateId,
    profile: {
      name: text(profile.name, `${path}.profile.name`),
      role: text(profile.role, `${path}.profile.role`),
      email: text(profile.email, `${path}.profile.email`),
      phone: text(profile.phone, `${path}.profile.phone`),
      location: text(profile.location, `${path}.profile.location`),
      summary:
        profile.summary === undefined
          ? ''
          : text(profile.summary, `${path}.profile.summary`),
      github:
        profile.github === undefined
          ? ''
          : text(profile.github, `${path}.profile.github`),
      profileLines:
        profile.profileLines === undefined
          ? []
          : list(profile.profileLines, `${path}.profile.profileLines`).map(
              (line, index) => text(line, `${path}.profile.profileLines[${index}]`),
            ),
      photo,
    },
    sections,
    // 上面已验证全部字段；复制已知字段，避免外部 JSON 注入未知对象属性。
    appearance: {
      nameScale: appearance.nameScale as number,
      headingScale: appearance.headingScale as number,
      bodyScale: appearance.bodyScale as number,
      font: appearance.font as ResumeDocument['appearance']['font'],
      accent: appearance.accent,
      ...(appearance.headerFontSizes === undefined
        ? {}
        : { headerFontSizes: { ...(appearance.headerFontSizes as object) } }),
      ...(appearance.profileLineScales === undefined
        ? {}
        : { profileLineScales: [...(appearance.profileLineScales as number[])] }),
    },
    updatedAt: resume.updatedAt,
  }
}

/** 数据库快照要求文档 ID 唯一；备份合并则由 store 重生成冲突文档 ID。 */
export function parseWorkspaceDocuments(value: unknown): ResumeDocument[] {
  const documents = list(value, '工作区').map((resume, index) =>
    parseResumeDocument(resume, `工作区[${index}]`),
  )
  uniqueIds(documents, '工作区')
  return documents
}
