/**
 * @file 简历文档的数据契约，供创建、编辑、持久化和导入导出共用。
 * 类型仅在编译时检查；外部 JSON 仍需在 storage 层进行运行时校验。
 */
/** 栏目类别用于默认名称和版式分组；用户可另外修改栏目标题。 */
export type SectionKind =
  'education' | 'work' | 'projects' | 'skills' | 'awards' | 'custom'
export type SectionColumn = 'left' | 'right'

/** 一条经历或一组技能；稳定 ID 用于编辑定位，与当前排序位置无关。 */
export interface ResumeEntry {
  id: string
  title: string
  subtitle: string
  /** 直接展示的时间文本，不进行日期解析或自动改写。 */
  period: string
  /** 纯文本正文，保留换行；列表符号属于用户内容。 */
  description: string
  /** 可选跳转地址；渲染时规范化为 HTTP(S) 链接，兼容旧备份缺少此字段。 */
  link?: string
}

/** 栏目及其条目集合；隐藏只影响展示，不删除内容。 */
export interface ResumeSection {
  id: string
  kind: SectionKind
  title: string
  visible: boolean
  /** 双栏中的显式归属；缺省时由模板推导，单栏切换仍保留此信息。 */
  column?: SectionColumn
  entries: ResumeEntry[]
}

/** 个人信息；与模板无关，切换版式时复用同一份数据。 */
export interface ResumeProfile {
  name: string
  /** 求职意向或职位名称。 */
  role: string
  /** 自由填写的个人信息行；按数组索引与 profileLineScales 对应。 */
  profileLines?: string[]
  /** 支持账号、github.com 路径或完整主页 URL，实际链接由画布解析。 */
  github?: string
  phone: string
  email: string
  location: string
  /** 保留的简介字段，当前画布未单独显示。 */
  summary: string
  /** 本地图片数据地址；null 表示无照片，备份包含图片内容。 */
  photo: string | null
}

export type FontChoice = 'modern' | 'classic' | 'round'
/** 可持久化的主题 ID；颜色值及展示名称在 data/palettes.ts 中维护。 */
export type AccentChoice =
  | 'ocean'
  | 'forest'
  | 'plum'
  | 'graphite'
  | 'navy'
  | 'ink'
  | 'teal'
  | 'sage'
  | 'olive'
  | 'burgundy'
  | 'terracotta'
  | 'amber'
  | 'sand'
  | 'slate'
  | 'lavender'
  | 'ice'
/** 可持久化的版式 ID；结构及默认分组在 data/templates.ts 中维护。 */
export type ResumeTemplateId =
  | 'two-column'
  | 'single-column'
  | 'sidebar-left'
  | 'minimal'
  | 'executive'
  | 'editorial'
  | 'timeline'
  | 'sidebar-right'
export type HeaderFontTarget = 'role' | 'github' | 'email' | 'phone' | 'location'

/** 外观设置中的字号都是 1024px 逻辑画布的 px 值，Scale 并非缩放倍数。 */
export interface ResumeAppearance {
  /** 姓名字号；设置界面提供 40～60px。 */
  nameScale: number
  /** 栏目标题字号；设置界面提供 20～32px。 */
  headingScale: number
  /** 正文、条目标题和时间字号；设置界面提供 14～24px。 */
  bodyScale: number
  /** 单项头部字号覆盖；缺项使用对应版式默认值，兼容旧文档。 */
  headerFontSizes?: Partial<Record<HeaderFontTarget, number>>
  /** 个人信息逐行字号；索引与 profile.profileLines 对齐。 */
  profileLineScales?: number[]
  font: FontChoice
  accent: AccentChoice
}

/** 一份可独立保存、复制和导出的简历，包含内容及外观设置。 */
export interface ResumeDocument {
  id: string
  /** 简历管理页的文件名称，不等同于投递人的姓名。 */
  title: string
  templateId: ResumeTemplateId
  profile: ResumeProfile
  sections: ResumeSection[]
  appearance: ResumeAppearance
  /** Unix 毫秒时间戳，供管理页排序和展示使用。 */
  updatedAt: number
}

/** 可携带多份简历的 JSON 备份；version 与 IndexedDB 版本是不同的协议。 */
export interface ResumeBackup {
  format: 'resume-studio-backup'
  version: 1
  createdAt: string
  resumes: ResumeDocument[]
}
