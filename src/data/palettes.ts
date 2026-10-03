/** @file 16 套主题的语义颜色登记表，选择卡片、缩略图、画布及 PDF 共用。 */
import type { AccentChoice } from '../types'

export type PaletteGroup = 'classic' | 'natural' | 'warm' | 'cool'

/** 保持页眉底色与强调色独立，浅色主题可以使用深色文字。 */
export interface ResumePalette {
  /** 保存到文档中的主题 ID；扩展时保留已有 ID，维护备份兼容。 */
  id: AccentChoice
  name: string
  group: PaletteGroup
  /** 栏目边线、链接和轻量页眉中的强调色，对应 --accent。 */
  strong: string
  /** 彩色页眉或侧栏的背景，对应 --header-bg。 */
  header: string
  /** 彩色页眉中的文字色，与 header 配套，对应 --header-ink。 */
  onHeader: string
  /** 栏目及链接的浅色底，对应 --accent-soft。 */
  soft: string
  /** 分隔线和时间线的弱强调色，对应 --accent-line。 */
  line: string
}

export const paletteGroups: { id: PaletteGroup; name: string }[] = [
  { id: 'classic', name: '经典商务' },
  { id: 'natural', name: '自然绿系' },
  { id: 'warm', name: '温暖色调' },
  { id: 'cool', name: '柔和冷色' },
]

// 强调色和页眉底色独立，浅色页眉可使用深色文字及清晰的栏目标题。
export const resumePalettes: ResumePalette[] = [
  {
    id: 'ocean',
    name: '原版蓝',
    group: 'classic',
    strong: '#3498db',
    header: '#3498db',
    onHeader: '#ffffff',
    soft: '#eef7fc',
    line: '#b8d9ee',
  },
  {
    id: 'graphite',
    name: '石墨灰',
    group: 'classic',
    strong: '#374151',
    header: '#374151',
    onHeader: '#ffffff',
    soft: '#f1f3f5',
    line: '#d5dae0',
  },
  {
    id: 'navy',
    name: '午夜海军蓝',
    group: 'classic',
    strong: '#203b5b',
    header: '#203b5b',
    onHeader: '#ffffff',
    soft: '#eef2f7',
    line: '#bdcbdc',
  },
  {
    id: 'ink',
    name: '墨黑银白',
    group: 'classic',
    strong: '#27272a',
    header: '#27272a',
    onHeader: '#ffffff',
    soft: '#f4f4f5',
    line: '#d4d4d8',
  },
  {
    id: 'forest',
    name: '森林绿',
    group: 'natural',
    strong: '#285f48',
    header: '#285f48',
    onHeader: '#ffffff',
    soft: '#edf7f0',
    line: '#bbdfc7',
  },
  {
    id: 'teal',
    name: '深海青',
    group: 'natural',
    strong: '#17656a',
    header: '#17656a',
    onHeader: '#ffffff',
    soft: '#edf7f7',
    line: '#b4d9d9',
  },
  {
    id: 'sage',
    name: '鼠尾草浅绿',
    group: 'natural',
    strong: '#3f6252',
    header: '#e3eee6',
    onHeader: '#294a3a',
    soft: '#f1f6f2',
    line: '#b9cdbf',
  },
  {
    id: 'olive',
    name: '橄榄绿',
    group: 'natural',
    strong: '#575f35',
    header: '#575f35',
    onHeader: '#ffffff',
    soft: '#f3f4ec',
    line: '#cbd0b5',
  },
  {
    id: 'burgundy',
    name: '酒红玫瑰',
    group: 'warm',
    strong: '#773749',
    header: '#773749',
    onHeader: '#ffffff',
    soft: '#faf0f3',
    line: '#dfbbc5',
  },
  {
    id: 'terracotta',
    name: '陶土暖棕',
    group: 'warm',
    strong: '#92513b',
    header: '#92513b',
    onHeader: '#ffffff',
    soft: '#fbf2ed',
    line: '#e3c2b3',
  },
  {
    id: 'amber',
    name: '琥珀咖啡',
    group: 'warm',
    strong: '#795725',
    header: '#795725',
    onHeader: '#ffffff',
    soft: '#faf5e9',
    line: '#dfcda6',
  },
  {
    id: 'sand',
    name: '奶油沙色',
    group: 'warm',
    strong: '#6b5540',
    header: '#f0e8dc',
    onHeader: '#51402f',
    soft: '#faf7f2',
    line: '#d8c9b5',
  },
  {
    id: 'plum',
    name: '柔和紫',
    group: 'cool',
    strong: '#6d4779',
    header: '#6d4779',
    onHeader: '#ffffff',
    soft: '#f5eff8',
    line: '#dec9e7',
  },
  {
    id: 'slate',
    name: '雾霭蓝灰',
    group: 'cool',
    strong: '#4b6279',
    header: '#4b6279',
    onHeader: '#ffffff',
    soft: '#eff3f7',
    line: '#c4d0dc',
  },
  {
    id: 'lavender',
    name: '浅薰衣草',
    group: 'cool',
    strong: '#63517e',
    header: '#eee8f5',
    onHeader: '#4c3e61',
    soft: '#f7f4fb',
    line: '#d1c4e2',
  },
  {
    id: 'ice',
    name: '冰川浅蓝',
    group: 'cool',
    strong: '#335e7a',
    header: '#e5f0f7',
    onHeader: '#27495f',
    soft: '#f2f7fb',
    line: '#bcd3e2',
  },
]

/** 元信息查询；未知运行时 ID 使用原版蓝兜底，导入时仍要求通过正式校验。 */
export function getResumePalette(id: AccentChoice): ResumePalette {
  return resumePalettes.find((palette) => palette.id === id) ?? resumePalettes[0]!
}

/** 完整主题登记表的运行时校验，备份导入使用此入口。 */
export function isAccentChoice(value: unknown): value is AccentChoice {
  return resumePalettes.some((palette) => palette.id === value)
}
