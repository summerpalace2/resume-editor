<script setup lang="ts">
/** @file 单条经历的展示、链接、字段编辑和排序按钮；不访问工作区存储。 */
import { nextTick, ref, watch } from 'vue'
import InlineEdit from '../../components/InlineEdit.vue'
import FormattedText from '../../components/FormattedText.vue'
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

// 展开状态只属于当前条目的交互，所有栏目共用已存在的 entry.link 数据契约。
const linkEditorOpen = ref(false)
const linkInput = ref<HTMLInputElement | null>(null)

async function openLinkEditor(): Promise<void> {
  linkEditorOpen.value = true
  await nextTick()
  linkInput.value?.focus()
  linkInput.value?.select()
}

function finishLinkEditor(): void {
  // blur 会先触发 change，沿用统一修改动作保存地址，再收起输入框。
  linkInput.value?.blur()
  linkEditorOpen.value = false
}

watch(
  [
    () => props.resume.id,
    () => props.section.id,
    () => props.entry.id,
    () => props.editing,
  ],
  () => {
    linkEditorOpen.value = false
  },
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
          :formats="entry.textFormats?.title"
          :editing="editing"
          placeholder="条目标题"
          @commit="
            (value, formats) => updateEntry(section.id, entry.id, 'title', value, formats)
          "
        />
        <a
          v-if="!editing && externalUrl(entry.link)"
          class="entry-title-link"
          :href="externalUrl(entry.link)"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`打开${entry.title}链接`"
          title="打开链接"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M11 3h6v6M17 3 9 11" />
            <path d="M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
          </svg>
          <span>跳转</span>
        </a>
        <button
          v-else-if="editing && !linkEditorOpen"
          type="button"
          class="entry-title-link no-print"
          @click="openLinkEditor"
        >
          {{ entry.link?.trim() ? '修改链接' : '+ 添加链接' }}
        </button>
        <label v-if="editing && linkEditorOpen" class="entry-link-editor no-print">
          <span aria-hidden="true">↗</span>
          <input
            ref="linkInput"
            class="link-address-input entry-link-input"
            type="url"
            :value="entry.link ?? ''"
            placeholder="输入链接地址"
            :aria-label="`${entry.title || '条目'}链接地址`"
            @change="updateEntryLinkFromInput(section.id, entry.id, $event)"
            @blur="linkEditorOpen = false"
            @keydown.enter.prevent="finishLinkEditor"
          />
        </label>
      </div>
      <InlineEdit
        class="entry-period"
        :model-value="entry.period"
        :formats="entry.textFormats?.period"
        :editing="editing"
        placeholder="时间"
        @commit="
          (value, formats) => updateEntry(section.id, entry.id, 'period', value, formats)
        "
      />
    </div>
    <InlineEdit
      v-if="entry.subtitle || editing"
      class="entry-subtitle"
      :model-value="entry.subtitle"
      :formats="entry.textFormats?.subtitle"
      :editing="editing"
      multiline
      tag="div"
      placeholder="机构、专业或技术栈"
      @commit="
        (value, formats) => updateEntry(section.id, entry.id, 'subtitle', value, formats)
      "
    />
    <div v-if="entry.description || editing" class="entry-description">
      <InlineEdit
        v-if="editing"
        class="description-edit"
        :model-value="entry.description"
        :formats="entry.textFormats?.description"
        :editing="editing"
        multiline
        list-enabled
        tag="div"
        placeholder="添加描述；选中段落后可添加无序列表"
        @commit="
          (value, formats) =>
            updateEntry(section.id, entry.id, 'description', value, formats)
        "
      />
      <p v-else class="description-readonly">
        <FormattedText
          :text="entry.description"
          :formats="entry.textFormats?.description"
          paragraphs
        />
      </p>
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
