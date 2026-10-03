/** @file 将文档外观编排为响应式 CSS 变量；字体就绪后重新测量侧栏。 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { headerFontSize, profileLineFontSize } from '../data/typography'
import { getResumePalette } from '../data/palettes'
import { isSidebarTemplate } from '../data/templates'
import { githubLabel } from '../domain/links'
import type { ResumeDocument } from '../types'

export function useResumeStyle(resume: () => ResumeDocument) {
  const fontsVersion = ref(0)
  let alive = true
  onMounted(() => {
    void document.fonts.ready.then(() => {
      if (alive) fontsVersion.value += 1
    })
  })
  onUnmounted(() => {
    alive = false
  })
  /** 本机字体回退栈；未嵌入字体文件，不同系统可能使用不同的实际字体。 */
  const fontStacks = {
    modern: '"Museo Sans", Arial, "Microsoft YaHei", sans-serif',
    classic: 'Georgia, "Songti SC", "SimSun", serif',
    round: '"Trebuchet MS", "Microsoft YaHei", sans-serif',
  }

  /** 将持久化的外观配置转成画布 CSS 变量；侧栏测量依赖浏览器 DOM API。 */
  const pageStyle = computed(() => {
    void fontsVersion.value
    const colors = getResumePalette(resume().appearance.accent)
    const appearance = resume().appearance
    const size = (target: Parameters<typeof headerFontSize>[2]) =>
      headerFontSize(appearance, resume().templateId, target)
    // 300px 是默认侧栏宽度；字号放大时按单行内容扩展，最多占逻辑画布的一半。
    let sidebarWidth = 300
    if (isSidebarTemplate(resume().templateId) && typeof document !== 'undefined') {
      const context = document.createElement('canvas').getContext('2d')
      if (context) {
        const measure = (text: string, fontSize: number) => {
          context.font = `${fontSize}px ${fontStacks[appearance.font]}`
          return context.measureText(text).width
        }
        // 联系方式的 51px = 左右内边距 44px + 图标间距 7px，另加图标字号。
        // GitHub 的 50px = 内边距 44px + 间距 6px；个人信息仅预留 44px 内边距。
        sidebarWidth = Math.min(
          512,
          Math.max(
            300,
            measure(resume().profile.email, size('email')) + size('email') + 51,
            measure(resume().profile.phone, size('phone')) + size('phone') + 51,
            measure(resume().profile.location, size('location')) + size('location') + 51,
            measure(githubLabel(resume().profile.github), size('github')) +
              size('github') * 1.4 +
              50,
            ...(resume().profile.profileLines ?? []).map(
              (line, index) => measure(line, profileLineFontSize(appearance, index)) + 44,
            ),
          ),
        )
      }
    }
    return {
      '--accent': colors.strong,
      '--accent-soft': colors.soft,
      '--accent-line': colors.line,
      '--header-bg': colors.header,
      '--header-ink': colors.onHeader,
      '--resume-font': fontStacks[resume().appearance.font],
      '--name-size': `${resume().appearance.nameScale}px`,
      '--heading-size': `${resume().appearance.headingScale}px`,
      '--body-size': `${resume().appearance.bodyScale}px`,
      '--role-size': `${size('role')}px`,
      '--github-size': `${size('github')}px`,
      '--email-size': `${size('email')}px`,
      '--phone-size': `${size('phone')}px`,
      '--location-size': `${size('location')}px`,
      '--sidebar-width': `${Math.ceil(sidebarWidth)}px`,
    }
  })

  return pageStyle
}
