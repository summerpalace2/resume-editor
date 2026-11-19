/** @file GitHub 链接贴纸样式登记表；样式设置界面、画布与导入校验共用此数据源。 */
import type { GithubStickerId, ResumeAppearance } from '../types'

export const githubStickerOptions: {
  id: GithubStickerId
  name: string
  description: string
}[] = [
  { id: 'github', name: 'GitHub 原版', description: '经典章鱼猫剪影' },
  { id: 'github-badge', name: 'GitHub 圆章', description: '高对比圆形徽章' },
  { id: 'code', name: '代码括号', description: '极简 </> 开发标识' },
  { id: 'terminal', name: '终端命令', description: '命令行 >_ 徽标' },
  { id: 'spark', name: '灵感星标', description: '四角星精选角标' },
  { id: 'rocket', name: '启动火箭', description: '项目推进火箭贴纸' },
  { id: 'globe', name: '个人主页', description: '通用站点地球标识' },
  { id: 'dot', name: '经典圆点', description: '极简几何靶心圆点' },
]

const stickerIds = new Set<string>(githubStickerOptions.map((item) => item.id))

export function isGithubStickerId(value: unknown): value is GithubStickerId {
  return typeof value === 'string' && stickerIds.has(value)
}

export function resolveGithubSticker(appearance?: ResumeAppearance): GithubStickerId {
  const value = appearance?.githubSticker
  return isGithubStickerId(value) ? value : 'github'
}

export function nextGithubSticker(current?: GithubStickerId): GithubStickerId {
  const index = githubStickerOptions.findIndex((item) => item.id === current)
  const next = githubStickerOptions[(index + 1) % githubStickerOptions.length]
  return next?.id ?? 'github'
}
