/** @file 创建空简历、首次示例和副本；不读取存储，不依赖页面组件。 */
import type { ResumeAppearance, ResumeDocument } from '../types'
import { cloneData } from './clone'
import { createEntry, createSection } from '../domain/factories'
export { createEntry, createSection } from '../domain/factories'

/** 默认字号以逻辑画布 px 表示；新增文档复制此对象，避免共用可变外观状态。 */
export const appearanceDefaults: ResumeAppearance = {
  nameScale: 50,
  headingScale: 24,
  bodyScale: 20,
  font: 'modern',
  accent: 'ocean',
}

/** @param title 管理页中的简历名称；新建后正文及个人信息均为空。 */
export function createResume(title = '我的简历'): ResumeDocument {
  return {
    id: crypto.randomUUID(),
    title,
    templateId: 'two-column',
    profile: {
      name: '',
      role: '',
      profileLines: ['', ''],
      github: '',
      phone: '',
      email: '',
      location: '',
      summary: '',
      photo: null,
    },
    sections: [
      createSection('education'),
      createSection('work'),
      createSection('projects'),
      createSection('skills'),
      createSection('awards'),
    ],
    appearance: { ...appearanceDefaults },
    updatedAt: Date.now(),
  }
}

/** 首次打开空数据库时使用完全虚构的演示简历；已保存的个人文档不会被替换。 */
export function createStarterResume(): ResumeDocument {
  const resume = createResume('示例简历（虚构数据）')
  resume.profile = {
    name: '张同学',
    role: '客户端开发工程师',
    profileLines: ['2026 届本科 · 求职示例', '示例大学 · 软件工程'],
    github: 'https://github.com/example',
    phone: '13800000000',
    email: 'candidate@example.com',
    location: '示例城市',
    summary: '',
    photo: null,
  }

  const education = createSection('education')
  education.entries = [
    {
      ...createEntry(),
      title: '示例大学',
      subtitle: '软件工程 · 本科',
      period: '2022.9 - 2026.6',
      description:
        '学习数据结构、计算机网络、数据库与软件工程等课程。\n参与课程设计，完成需求分析、界面实现与项目文档。',
    },
  ]

  const work = createSection('work')
  work.title = '实践经历'
  work.entries = [
    {
      ...createEntry(),
      title: '示例科技公司',
      subtitle: '客户端开发实习生',
      period: '2025.7 - 2025.9',
      description:
        '使用 Kotlin 参与客户端页面开发，完成列表展示、搜索与表单交互。\n协助梳理接口状态和异常处理，整理开发说明，与团队完成迭代交付。',
    },
  ]

  const skills = createSection('skills')
  skills.title = '个人能力'
  skills.entries = [
    {
      ...createEntry(),
      description:
        '掌握 Java、Kotlin 和 Git 的基本使用，能够完成常见客户端功能。\n了解 Android 生命周期、网络请求与本地数据存储。\n熟悉 Compose 的基础组件和状态管理，能够根据设计稿实现界面。\n具备需求拆分、问题定位和技术文档整理能力。',
    },
  ]

  const projects = createSection('projects')
  projects.entries = [
    {
      ...createEntry(),
      title: '校园生活助手（示例项目）',
      subtitle: 'Kotlin · Compose · 本地缓存',
      period: '2025.3 - 2025.6',
      link: 'https://example.com/campus-demo',
      description:
        '设计课程查询与校园资讯页面，实现列表筛选、详情展示和收藏功能。\n使用本地缓存保留最近访问的数据，为加载失败和空内容提供提示。',
    },
    {
      ...createEntry(),
      title: '个人任务管理工具（示例项目）',
      subtitle: 'Vue · TypeScript · IndexedDB',
      period: '2025.10 - 2025.12',
      link: 'https://example.com/tasks-demo',
      description:
        '实现任务新增、分类筛选和完成状态切换，支持浏览器本地保存。\n拆分文档操作与界面组件，补充输入校验和使用说明。',
    },
  ]

  resume.sections = [education, work, skills, projects]
  return resume
}

/**
 * 复制整份简历，包括照片和样式；只重建文档 ID，内嵌 ID 在各自文档内使用。
 * @param source 原文档，不会被修改。
 * @param title 可选的副本名称；缺省时在原名称后添加“副本”。
 */
export function cloneResume(source: ResumeDocument, title?: string): ResumeDocument {
  const copy = cloneData(source)
  copy.id = crypto.randomUUID()
  copy.title = title ?? `${source.title}（副本）`
  copy.updatedAt = Date.now()
  return copy
}
