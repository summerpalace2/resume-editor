/** @file 局部文字的预设色板；六位颜色沿用现有格式区间和备份契约。 */
export const textColorGroups = [
  {
    name: '黑白灰',
    colors: [
      { name: '墨黑', value: '#111827' },
      { name: '深灰', value: '#374151' },
      { name: '中灰', value: '#6b7280' },
      { name: '浅灰', value: '#9ca3af' },
      { name: '纯白', value: '#ffffff' },
    ],
  },
  {
    name: '蓝色',
    colors: [
      { name: '海军蓝', value: '#1e3a8a' },
      { name: '深蓝', value: '#1d4ed8' },
      { name: '经典蓝', value: '#2563eb' },
      { name: '天蓝', value: '#0284c7' },
      { name: '青蓝', value: '#0e7490' },
    ],
  },
  {
    name: '绿色',
    colors: [
      { name: '森林绿', value: '#14532d' },
      { name: '深绿', value: '#15803d' },
      { name: '草绿', value: '#16a34a' },
      { name: '翡翠绿', value: '#059669' },
      { name: '蓝绿', value: '#0f766e' },
    ],
  },
  {
    name: '暖色',
    colors: [
      { name: '棕色', value: '#7c2d12' },
      { name: '琥珀棕', value: '#b45309' },
      { name: '琥珀黄', value: '#d97706' },
      { name: '橙色', value: '#ea580c' },
      { name: '金色', value: '#ca8a04' },
    ],
  },
  {
    name: '红粉色',
    colors: [
      { name: '酒红', value: '#7f1d1d' },
      { name: '深红', value: '#b91c1c' },
      { name: '经典红', value: '#dc2626' },
      { name: '玫瑰红', value: '#e11d48' },
      { name: '深粉', value: '#be185d' },
    ],
  },
  {
    name: '紫色',
    colors: [
      { name: '深紫', value: '#4c1d95' },
      { name: '靛紫', value: '#6d28d9' },
      { name: '经典紫', value: '#7c3aed' },
      { name: '亮紫', value: '#9333ea' },
      { name: '紫红', value: '#a21caf' },
    ],
  },
  // 浅色也是文字颜色，适合深色页眉等场景；不替用户改变色号或整份主题。
  {
    name: '浅蓝青',
    colors: [
      { name: '晴空蓝', value: '#60a5fa' },
      { name: '柔和浅蓝', value: '#93c5fd' },
      { name: '冰蓝', value: '#bae6fd' },
      { name: '浅青', value: '#67e8f9' },
      { name: '水光青', value: '#a5f3fc' },
    ],
  },
  {
    name: '浅绿色',
    colors: [
      { name: '嫩绿', value: '#4ade80' },
      { name: '浅草绿', value: '#86efac' },
      { name: '淡绿', value: '#bbf7d0' },
      { name: '薄荷绿', value: '#6ee7b7' },
      { name: '浅薄荷', value: '#a7f3d0' },
    ],
  },
  {
    name: '浅暖色',
    colors: [
      { name: '明黄', value: '#fbbf24' },
      { name: '浅金黄', value: '#fcd34d' },
      { name: '奶油黄', value: '#fde68a' },
      { name: '浅杏橙', value: '#fdba74' },
      { name: '柔和杏色', value: '#fed7aa' },
    ],
  },
  {
    name: '浅粉紫',
    colors: [
      { name: '浅樱粉', value: '#f9a8d4' },
      { name: '淡玫瑰', value: '#fecdd3' },
      { name: '浅丁香紫', value: '#c4b5fd' },
      { name: '淡薰衣草', value: '#ddd6fe' },
      { name: '浅兰紫', value: '#d8b4fe' },
    ],
  },
  {
    name: '柔和浅灰',
    colors: [
      { name: '蓝灰', value: '#94a3b8' },
      { name: '雾灰蓝', value: '#b8c4d4' },
      { name: '银灰蓝', value: '#cbd5e1' },
      { name: '珍珠灰', value: '#d1d5db' },
      { name: '淡银灰', value: '#e5e7eb' },
    ],
  },
] as const
