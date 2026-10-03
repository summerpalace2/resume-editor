/** @file 八种版式的共享登记表；选择界面、画布、缩略图和备份校验从此读取。 */
import type { ResumeSection, ResumeTemplateId, SectionColumn } from '../types'

/** 渲染结构与展示名称分离：不同版式可共用同一种结构。 */
export type ResumeLayout = 'single' | 'columns' | 'sidebar'

/** 版式元信息，不包含用户内容，也不访问组件状态或存储。 */
export interface ResumeTemplateDefinition {
  /** 持久化标识，须与 types.ts 的 ResumeTemplateId 同步，避免改名破坏旧数据。 */
  id: ResumeTemplateId
  name: string
  description: string
  layout: ResumeLayout
  /** solid 使用主题页眉底色；light 使用白底及主题强调色。 */
  header: 'solid' | 'light'
  /** 仅用于尚未指定左右归属的栏目，不覆盖用户保存的 column。 */
  columnStrategy?: 'qualifications-left'
}

export const layoutLabels: Record<ResumeLayout, string> = {
  single: '单栏',
  columns: '双栏',
  sidebar: '信息侧栏',
}

/** 新版式应同时登记 ID、结构、页眉风格、缩略图样式与打印行为。 */
export const resumeTemplates: ResumeTemplateDefinition[] = [
  {
    id: 'two-column',
    name: '双栏经典',
    description: '彩色页眉，左右栏目独立排列',
    layout: 'columns',
    header: 'solid',
  },
  {
    id: 'single-column',
    name: '单栏简洁',
    description: '彩色页眉，经历按顺序纵向阅读',
    layout: 'single',
    header: 'solid',
  },
  {
    id: 'sidebar-left',
    name: '左侧信息栏',
    description: '个人信息在左，经历集中在右',
    layout: 'sidebar',
    header: 'solid',
  },
  {
    id: 'minimal',
    name: '极简居中',
    description: '白色页眉、居中姓名、横排联系方式',
    layout: 'single',
    header: 'light',
  },
  {
    id: 'executive',
    name: '商务线条',
    description: '左对齐身份信息，细线分隔栏目',
    layout: 'single',
    header: 'light',
  },
  {
    id: 'editorial',
    name: '编辑式双栏',
    description: '宽窄双栏，分组展示技能与经历',
    layout: 'columns',
    header: 'light',
    columnStrategy: 'qualifications-left',
  },
  {
    id: 'timeline',
    name: '时间线履历',
    description: '纵向轨道串联条目，突出经历层次',
    layout: 'single',
    header: 'light',
  },
  {
    id: 'sidebar-right',
    name: '右侧信息栏',
    description: '经历在左，个人信息集中在右',
    layout: 'sidebar',
    header: 'solid',
  },
]

/** 获取元信息；运行时未知 ID 回退到第一个模板，外部导入仍由校验入口拒绝未知值。 */
export function getResumeTemplate(id: ResumeTemplateId): ResumeTemplateDefinition {
  return resumeTemplates.find((template) => template.id === id) ?? resumeTemplates[0]!
}

/** 运行时判断持久化/备份中的版式 ID，TypeScript 联合类型无法检查外部 JSON。 */
export function isResumeTemplateId(value: unknown): value is ResumeTemplateId {
  return resumeTemplates.some((template) => template.id === value)
}

/** 判断是否需要左右两个独立栏目容器，供排序、添加和版式分组共用。 */
export function isColumnTemplate(id: ResumeTemplateId): boolean {
  return getResumeTemplate(id).layout === 'columns'
}

/** 判断是否采用个人信息侧栏，供字号默认值和动态侧栏宽度计算共用。 */
export function isSidebarTemplate(id: ResumeTemplateId): boolean {
  return getResumeTemplate(id).layout === 'sidebar'
}

/**
 * 推导栏目展示位置，不修改文档：显式归属优先，其次采用模板默认规则。
 * @param templateId 当前版式，决定未分配栏目的分组策略。
 * @param section 只需要类别和可选左右归属，避免绑定具体 UI。
 * @param index 原始 sections 数组索引；普通双栏按奇偶分组，非过滤后的索引。
 */
export function resolveSectionColumn(
  templateId: ResumeTemplateId,
  section: Pick<ResumeSection, 'kind' | 'column'>,
  index: number,
): SectionColumn {
  // 只为未指定位置的栏目提供默认排法，用户已设置的左右归属优先。
  if (section.column) return section.column
  if (getResumeTemplate(templateId).columnStrategy === 'qualifications-left') {
    return ['education', 'skills', 'awards'].includes(section.kind) ? 'left' : 'right'
  }
  return index % 2 === 0 ? 'left' : 'right'
}
