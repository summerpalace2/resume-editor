/** @file 空栏目和条目工厂；只分配稳定 ID，不依赖 Vue 或页面。 */
import type { SectionKind, ResumeEntry, ResumeSection } from '../types'

const sectionNames: Record<SectionKind, string> = {
  education: '教育经历',
  work: '工作 / 实习',
  projects: '项目经历',
  skills: '专业技能',
  awards: '荣誉证书',
  custom: '自定义栏目',
}

/** 创建空白条目并分配稳定 ID；观察模式隐藏完全没有内容的条目。 */
export function createEntry(): ResumeEntry {
  return {
    id: crypto.randomUUID(),
    title: '',
    subtitle: '',
    period: '',
    description: '',
  }
}

/** @param kind 栏目类别，决定初始标题；初始空条目供用户直接编辑。 */
export function createSection(kind: SectionKind = 'custom'): ResumeSection {
  return {
    id: crypto.randomUUID(),
    kind,
    title: sectionNames[kind],
    visible: true,
    entries: [createEntry()],
  }
}
