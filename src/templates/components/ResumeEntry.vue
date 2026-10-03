<script setup lang="ts">
/** @file 单条经历的展示、链接、字段编辑和排序按钮；不访问工作区存储。 */
import InlineEdit from '../../components/InlineEdit.vue'
import { useResumeEditing } from '../../composables/useResumeEditing'
import { externalUrl } from '../../domain/links'
import { hasEntryContent } from '../../domain/operations'
import type { ResumeDocument, ResumeSection, ResumeEntry } from '../../types'
const props = defineProps<{
  resume: ResumeDocument
  section: ResumeSection
  entry: ResumeEntry
  entryIndex: number
  editing: boolean
}>()
const emit = defineEmits<{ 'update:resume': [resume: ResumeDocument] }>()
const {
  updateEntry,
  updateEntryLinkFromInput,
  dropEntry,
  startEntryDrag,
  moveEntry,
  removeEntry,
} = useResumeEditing(
  () => props.resume,
  (resume) => emit('update:resume', resume),
)
</script>

<template>
  <article
    v-show="editing || hasEntryContent(entry)"
    class="resume-entry"
    @dragover.prevent
    @drop="dropEntry($event, section.id, entryIndex)"
  >
    <div class="entry-topline">
      <div class="entry-title-group">
        <InlineEdit
          class="entry-title"
          :model-value="entry.title"
          :editing="editing"
          placeholder="条目标题"
          @update:model-value="updateEntry(section.id, entry.id, 'title', $event)"
        />
        <a
          v-if="!editing && externalUrl(entry.link)"
          class="entry-title-link"
          :href="externalUrl(entry.link)"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`打开${entry.title}链接`"
          title="打开项目链接"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M11 3h6v6M17 3 9 11" />
            <path d="M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
          </svg>
          <span>跳转</span>
        </a>
        <label
          v-else-if="editing && section.kind === 'projects'"
          class="entry-link-editor"
        >
          <span aria-hidden="true">↗</span>
          <input
            class="link-address-input entry-link-input"
            type="url"
            :value="entry.link ?? ''"
            placeholder="添加项目链接"
            :aria-label="`${entry.title || '项目'}链接地址`"
            @change="updateEntryLinkFromInput(section.id, entry.id, $event)"
          />
        </label>
      </div>
      <InlineEdit
        class="entry-period"
        :model-value="entry.period"
        :editing="editing"
        placeholder="时间"
        @update:model-value="updateEntry(section.id, entry.id, 'period', $event)"
      />
    </div>
    <InlineEdit
      v-if="entry.subtitle || editing"
      class="entry-subtitle"
      :model-value="entry.subtitle"
      :editing="editing"
      placeholder="机构、专业或技术栈"
      @update:model-value="updateEntry(section.id, entry.id, 'subtitle', $event)"
    />
    <div v-if="entry.description || editing" class="entry-description">
      <InlineEdit
        v-if="editing"
        class="description-edit"
        :model-value="entry.description"
        :editing="editing"
        multiline
        tag="div"
        placeholder="添加描述，换行和列表符号由你自行输入"
        @update:model-value="updateEntry(section.id, entry.id, 'description', $event)"
      />
      <p v-else class="description-readonly">{{ entry.description }}</p>
    </div>
    <div v-if="editing" class="entry-tools no-print">
      <button
        class="drag-handle"
        title="拖动经历排序"
        draggable="true"
        @dragstart="startEntryDrag($event, section.id, entryIndex)"
      >
        拖动
      </button>
      <button
        title="上移经历"
        :disabled="entryIndex === 0"
        @click="moveEntry(section.id, entryIndex, -1)"
      >
        上移
      </button>
      <button
        title="下移经历"
        :disabled="entryIndex === section.entries.length - 1"
        @click="moveEntry(section.id, entryIndex, 1)"
      >
        下移
      </button>
      <button class="danger-text" @click="removeEntry(section.id, entry.id)">
        删除经历
      </button>
    </div>
  </article>
</template>
