<script setup lang="ts">
/** @file 版式示意缩略图：展示结构与配色，不读取正文或生成 PDF 截图。 */
import { computed } from 'vue'
import { getResumeTemplate } from '../data/templates'
import { getResumePalette } from '../data/palettes'
import type { AccentChoice, ResumeTemplateId } from '../types'

const props = defineProps<{
  /** 与模板登记表对应的持久化 ID。 */
  templateId: ResumeTemplateId
  /** 当前主题 ID，省略时使用原版蓝；使画廊和管理页配色与文档同步。 */
  accent?: AccentChoice
  /** 管理页使用较大的示意图，样式设置使用紧凑尺寸。 */
  large?: boolean
}>()
const template = computed(() => getResumeTemplate(props.templateId))
/** 缩略图使用自己的变量名称，避免颜色泄露到应用界面或真实简历画布。 */
const paletteStyle = computed(() => {
  const palette = getResumePalette(props.accent ?? 'ocean')
  return {
    '--thumbnail-accent': palette.strong,
    '--thumbnail-header': palette.header,
    '--thumbnail-ink': palette.onHeader,
    '--thumbnail-soft': palette.soft,
    '--thumbnail-line': palette.line,
  }
})
</script>

<template>
  <span
    aria-hidden="true"
    class="template-thumbnail"
    :style="paletteStyle"
    :class="[
      `thumbnail-${template.id}`,
      `thumbnail-layout-${template.layout}`,
      { 'thumbnail-light': template.header === 'light', 'thumbnail-large': large },
    ]"
  >
    <span class="thumbnail-header"><b></b><em></em><i></i><i></i></span>
    <span class="thumbnail-body">
      <span
        v-for="column in template.layout === 'columns' ? 2 : 1"
        :key="column"
        class="thumbnail-column"
      >
        <b></b><i></i><i></i><i></i><b></b><i></i><i></i><i></i>
      </span>
    </span>
  </span>
</template>

<style scoped>
.template-thumbnail {
  --unit: 2px;
  display: grid;
  grid-template-rows: 28% 1fr;
  width: 54px;
  max-width: 100%;
  aspect-ratio: 210 / 297;
  overflow: hidden;
  border: 1px solid #dfe4eb;
  background: #fff;
}
.thumbnail-large {
  --unit: 4px;
  width: 145px;
}
.thumbnail-header {
  display: flex;
  flex-direction: column;
  gap: var(--unit);
  padding: calc(var(--unit) * 2);
  background: var(--thumbnail-header);
}
.thumbnail-header b,
.thumbnail-header em,
.thumbnail-header i,
.thumbnail-column b,
.thumbnail-column i {
  display: block;
  flex-shrink: 0;
}
.thumbnail-header b {
  width: 52%;
  height: calc(var(--unit) * 2);
  background: var(--thumbnail-ink);
}
.thumbnail-header em,
.thumbnail-header i {
  width: 78%;
  height: var(--unit);
  background: color-mix(in srgb, var(--thumbnail-ink) 70%, transparent);
}
.thumbnail-body {
  display: grid;
  gap: calc(var(--unit) * 2);
  padding: calc(var(--unit) * 2.5);
}
.thumbnail-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: calc(var(--unit) * 1.3);
}
.thumbnail-column b {
  width: 80%;
  height: calc(var(--unit) * 2);
  margin-top: var(--unit);
  background: var(--thumbnail-accent);
}
.thumbnail-column i {
  width: 100%;
  height: var(--unit);
  background: #d8dee8;
}
.thumbnail-column i:nth-child(3n) {
  width: 70%;
}
.thumbnail-layout-columns .thumbnail-body {
  grid-template-columns: 1fr 1fr;
}
.thumbnail-layout-sidebar {
  grid-template-columns: 34% 1fr;
  grid-template-rows: 1fr;
}
.thumbnail-layout-sidebar .thumbnail-header {
  padding: calc(var(--unit) * 1.5);
  gap: calc(var(--unit) * 2);
}
.thumbnail-layout-sidebar .thumbnail-header b,
.thumbnail-layout-sidebar .thumbnail-header i {
  width: 100%;
}
.thumbnail-layout-sidebar .thumbnail-body {
  padding: calc(var(--unit) * 2);
}
.thumbnail-sidebar-right {
  grid-template-columns: 1fr 34%;
}
.thumbnail-sidebar-right .thumbnail-header {
  grid-column: 2;
  grid-row: 1;
}
.thumbnail-sidebar-right .thumbnail-body {
  grid-column: 1;
  grid-row: 1;
}
.thumbnail-single-column {
  grid-template-rows: 23% 1fr;
}
.thumbnail-light .thumbnail-header {
  background: #fff;
}
.thumbnail-light .thumbnail-header b {
  background: #3b4757;
}
.thumbnail-light .thumbnail-header em {
  width: 55%;
  background: var(--thumbnail-accent);
}
.thumbnail-light .thumbnail-header i {
  background: #d8dee8;
}
.thumbnail-minimal .thumbnail-header {
  align-items: center;
  border-bottom: 1px solid var(--thumbnail-line);
}
.thumbnail-minimal .thumbnail-column b {
  width: 100%;
  height: var(--unit);
  background: var(--thumbnail-accent);
}
.thumbnail-executive .thumbnail-header {
  border-bottom: calc(var(--unit) * 1.5) solid var(--thumbnail-accent);
}
.thumbnail-executive .thumbnail-column b {
  background: var(--thumbnail-accent);
}
.thumbnail-editorial .thumbnail-header {
  border-top: calc(var(--unit) * 2) solid var(--thumbnail-accent);
}
.thumbnail-editorial .thumbnail-body {
  grid-template-columns: 42% 1fr;
}
.thumbnail-editorial .thumbnail-column b {
  width: 100%;
  height: var(--unit);
  background: var(--thumbnail-accent);
}
.thumbnail-timeline .thumbnail-column {
  position: relative;
  margin-left: var(--unit);
  padding-left: calc(var(--unit) * 3);
  border-left: 1px solid var(--thumbnail-line);
}
.thumbnail-timeline .thumbnail-column b {
  position: relative;
  background: var(--thumbnail-soft);
}
.thumbnail-timeline .thumbnail-column b::before {
  position: absolute;
  left: calc(var(--unit) * -4);
  top: 0;
  width: calc(var(--unit) * 2);
  height: calc(var(--unit) * 2);
  border-radius: 50%;
  background: var(--thumbnail-accent);
  content: '';
}
</style>
