/** @file 链接规范化与标签提取；不访问界面、DOM 或存储。 */
/** 规范化项目链接：缺少协议时补 HTTPS，仅返回可解析的 HTTP(S) 地址。 */
export function externalUrl(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

/** 兼容旧数据中的 GitHub 账号和新输入的主页 URL，输出供观察模式跳转的地址。 */
export function githubUrl(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed) || /^(?:www\.)?github\.com\//i.test(trimmed)) {
    return externalUrl(trimmed)
  }
  return externalUrl(`https://github.com/${trimmed.replace(/^@/, '')}`)
}

/** 编辑框优先显示完整地址；无法解析时保留原文字供用户修正。 */
export function githubEditValue(value?: string): string {
  return githubUrl(value) ?? value ?? ''
}

/** 取 URL 的最后一个路径段作为紧凑标签；标签和真实跳转地址分别处理。 */
export function githubLabel(value?: string): string {
  const url = githubUrl(value)
  if (!url) return value ?? ''
  try {
    const path = new URL(url).pathname.replace(/\/$/, '')
    return path.split('/').filter(Boolean).at(-1) ?? 'GitHub'
  } catch {
    return value ?? ''
  }
}
