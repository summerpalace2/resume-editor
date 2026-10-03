<script setup lang="ts">
/** @file 栏目标题与条目集合；负责栏目控件及事件转发，业务规则在 domain。 */
import InlineEdit from '../../components/InlineEdit.vue'
import ResumeEntry from './ResumeEntry.vue'
import { useResumeEditing } from '../../composables/useResumeEditing'
import type { ResumeDocument, ResumeSection } from '../../types'
const props = defineProps<{
  resume: ResumeDocument
  section: ResumeSection
  index: number
  editing: boolean
}>()
const emit = defineEmits<{ 'update:resume': [resume: ResumeDocument] }>()
const {
  usesColumns,
  sectionColumn,
  dropSection,
  updateSection,
  startSectionDrag,
  canMoveSection,
  moveSection,
  moveSectionToColumn,
  toggleSection,
  removeSection,
  addEntry,
} = useResumeEditing(
  () => props.resume,
  (resume) => emit('update:resume', resume),
)
</script>

<template>
  <section
    v-show="section.visible || editing"
    class="resume-section"
    :class="{ 'section-hidden': !section.visible }"
    @dragover.prevent
    @drop="dropSection($event, index)"
  >
    <div class="section-heading">
      <div class="section-heading-copy">
        <InlineEdit
          class="section-title"
          :model-value="section.title"
          :editing="editing"
          placeholder="栏目名称"
          @update:model-value="updateSection(section.id, { title: $event })"
        />
      </div>
      <div v-if="editing" class="section-tools no-print">
        <button
          class="drag-handle"
          title="拖动排序"
          draggable="true"
          @dragstart="startSectionDrag($event, index)"
        >
          ⠿
        </button>
        <button
          title="上移栏目"
          :disabled="!canMoveSection(index, -1)"
          @click="moveSection(index, -1)"
        >
          ↑
        </button>
        <button
          title="下移栏目"
          :disabled="!canMoveSection(index, 1)"
          @click="moveSection(index, 1)"
        >
          ↓
        </button>
        <button
          v-if="usesColumns"
          :title="sectionColumn(section, index) === 'left' ? '移至右栏' : '移至左栏'"
          @click="
            moveSectionToColumn(
              section.id,
              sectionColumn(section, index) === 'left' ? 'right' : 'left',
            )
          "
        >
          {{ sectionColumn(section, index) === 'left' ? '→右栏' : '←左栏' }}
        </button>
        <button
          :title="section.visible ? '隐藏栏目' : '显示栏目'"
          @click="toggleSection(section.id)"
        >
          {{ section.visible ? '隐藏' : '显示' }}
        </button>
        <button title="删除栏目" class="danger-text" @click="removeSection(section.id)">
          删除
        </button>
      </div>
    </div>

    <div v-if="section.visible" class="entry-list">
      <ResumeEntry
        v-for="(entry, entryIndex) in section.entries"
        :key="entry.id"
        :resume="resume"
        :section="section"
        :entry="entry"
        :entry-index="entryIndex"
        :editing="editing"
        @update:resume="emit('update:resume', $event)"
      />
      <button v-if="editing" class="add-entry no-print" @click="addEntry(section.id)">
        ＋ 添加一条经历
      </button>
    </div>
  </section>
</template>
