<script setup lang="ts">
/** @file 多种版式共用的画布入口；只编排列组和展示组件，不持有存储状态。 */
import { computed } from 'vue'
import ResumeHeader from './components/ResumeHeader.vue'
import ResumeSection from './components/ResumeSection.vue'
import { getResumeTemplate } from '../data/templates'
import { useResumeStyle } from '../composables/useResumeStyle'
import { useResumeEditing } from '../composables/useResumeEditing'
import type { ResumeDocument } from '../types'

const props = defineProps<{ resume: ResumeDocument; editing: boolean }>()
const emit = defineEmits<{ 'update:resume': [resume: ResumeDocument] }>()
const templateDefinition = computed(() => getResumeTemplate(props.resume.templateId))
const pageStyle = useResumeStyle(() => props.resume)
const { usesColumns, sectionColumn, addSection } = useResumeEditing(
  () => props.resume,
  (resume) => emit('update:resume', resume),
)
// 保留原始全局索引供排序，双栏使用独立容器，不按行锁定高度。
const sectionGroups = computed(() => {
  const items = props.resume.sections.map((section, index) => ({ section, index }))
  if (!usesColumns.value) return [{ column: undefined, items }]
  return (['left', 'right'] as const).map((column) => ({
    column,
    items: items.filter(({ section, index }) => sectionColumn(section, index) === column),
  }))
})
</script>

<template>
  <article
    class="resume-page"
    :class="[
      `accent-${resume.appearance.accent}`,
      `font-${resume.appearance.font}`,
      `layout-${resume.templateId}`,
      `structure-${templateDefinition.layout}`,
      { 'light-header': templateDefinition.header === 'light' },
      { 'has-photo': Boolean(resume.profile.photo) },
    ]"
    :style="pageStyle"
  >
    <ResumeHeader
      :resume="resume"
      :editing="editing"
      @update:resume="emit('update:resume', $event)"
    />

    <div class="resume-main">
      <div
        v-for="group in sectionGroups"
        :key="group.column ?? 'main'"
        class="resume-column"
        :class="group.column ? `resume-column-${group.column}` : undefined"
      >
        <ResumeSection
          v-for="{ section, index } in group.items"
          :key="section.id"
          :resume="resume"
          :section="section"
          :index="index"
          :editing="editing"
          @update:resume="emit('update:resume', $event)"
        />

        <button
          v-if="editing"
          class="add-section no-print"
          @click="addSection(group.column)"
        >
          {{
            group.column === 'left'
              ? '＋ 左栏添加栏目'
              : group.column === 'right'
                ? '＋ 右栏添加栏目'
                : '＋ 添加栏目'
          }}
        </button>
      </div>
    </div>
  </article>
</template>
