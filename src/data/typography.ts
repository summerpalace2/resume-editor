/** @file 头部及个人信息的字号解析与可选字段校验，兼容未保存这些字段的旧文档。 */
import type { HeaderFontTarget, ResumeAppearance, ResumeTemplateId } from '../types'
import { isSidebarTemplate } from './templates'

/** 基础字号范围的唯一登记，设置滑杆、修改动作和外部校验共用。 */
export const baseFontOptions = [
  { key: 'nameScale', label: '姓名', min: 40, max: 60 },
  { key: 'headingScale', label: '栏目标题', min: 20, max: 32 },
  { key: 'bodyScale', label: '正文', min: 14, max: 24 },
] as const

/** 逻辑画布 px 范围，设置滑杆和导入校验共用；不对应 PDF 的直接 pt 值。 */
export const headerFontOptions: {
  key: HeaderFontTarget
  label: string
  min: number
  max: number
}[] = [
  { key: 'role', label: '求职意向', min: 12, max: 36 },
  { key: 'github', label: 'GitHub', min: 12, max: 28 },
  { key: 'email', label: '邮箱', min: 12, max: 28 },
  { key: 'phone', label: '电话', min: 12, max: 28 },
  { key: 'location', label: '城市', min: 12, max: 28 },
]

const defaultSizes: Record<HeaderFontTarget, number> = {
  role: 30,
  github: 15,
  email: 17.5,
  phone: 17.5,
  location: 17.5,
}
const sidebarSizes: Record<HeaderFontTarget, number> = {
  role: 20,
  github: 18,
  email: 18,
  phone: 18,
  location: 18,
}

/**
 * 获取单项头部字号；有效覆盖值限幅，缺省或非有限数回退到版式默认值。
 * @param appearance 文档外观设置。
 * @param template 版式 ID，用于选择侧栏或普通页眉默认字号。
 * @param target 需要解析的头部字段，与 headerFontOptions.key 对应。
 */
export function headerFontSize(
  appearance: ResumeAppearance,
  template: ResumeTemplateId,
  target: HeaderFontTarget,
): number {
  const option = headerFontOptions.find((item) => item.key === target)!
  const value = appearance.headerFontSizes?.[target]
  // 旧文档和 v1 备份没有新增字号字段，沿用对应版式原有字号。
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(option.max, Math.max(option.min, value))
    : (isSidebarTemplate(template) ? sidebarSizes : defaultSizes)[target]
}

/** @param index 个人信息数组的零基索引；未设置时为 18px，有效值限幅到 12～28px。 */
export function profileLineFontSize(appearance: ResumeAppearance, index: number): number {
  const value = appearance.profileLineScales?.[index]
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(28, Math.max(12, value))
    : 18
}

/** 仅校验可选头部/逐行字号：旧文档缺省可通过；不检查基础字号、字体和配色。 */
export function hasValidHeaderTypography(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const appearance = value as Record<string, unknown>
  if (appearance.headerFontSizes !== undefined) {
    if (
      !appearance.headerFontSizes ||
      typeof appearance.headerFontSizes !== 'object' ||
      Array.isArray(appearance.headerFontSizes)
    )
      return false
    for (const [key, size] of Object.entries(appearance.headerFontSizes)) {
      const option = headerFontOptions.find((item) => item.key === key)
      if (
        !option ||
        typeof size !== 'number' ||
        !Number.isFinite(size) ||
        size < option.min ||
        size > option.max
      )
        return false
    }
  }
  return (
    appearance.profileLineScales === undefined ||
    (Array.isArray(appearance.profileLineScales) &&
      Array.from(appearance.profileLineScales).every(
        (size) =>
          typeof size === 'number' && Number.isFinite(size) && size >= 12 && size <= 28,
      ))
  )
}
