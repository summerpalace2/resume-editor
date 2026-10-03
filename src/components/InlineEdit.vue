<script setup lang="ts">
/** @file 单字段就地编辑：管理局部草稿、提交和取消，通过事件交回父组件。 */
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { COMMIT_EDITS_EVENT } from '../services/editLifecycle'

const props = withDefaults(
  defineProps<{
    /** 父组件已提交的值；输入阶段不直接修改。 */
    modelValue: string
    /** true 使用 textarea，Ctrl/Cmd+Enter 提交；普通字段按 Enter 提交。 */
    multiline?: boolean
    /** 只在空内容的编辑状态提示，不写入文档。 */
    placeholder?: string
    /** 观察状态的语义 HTML 标签，如 span 或 p。 */
    tag?: string
    /** 全局编辑开关；false 时提交当前活动草稿，供完成编辑和 PDF 导出使用。 */
    editing?: boolean
  }>(),
  { multiline: false, placeholder: '点击填写', tag: 'span', editing: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/** 全局编辑允许点选；isEditing 表示当前这个字段的输入框已展开。 */
const isEditing = ref(false)
const draft = ref(props.modelValue)
const field = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

// 外部更新只刷新非活动草稿，避免父组件更新其他字段时覆盖正在输入的文字。
watch(
  () => props.modelValue,
  (value) => {
    if (!isEditing.value) draft.value = value
  },
)

watch(
  () => props.editing,
  (editing) => {
    if (!editing && isEditing.value) commit()
  },
)

/** 开启字段输入后等待 DOM 更新，再聚焦；普通输入框同时全选现有文字。 */
async function begin(): Promise<void> {
  if (!props.editing) return
  draft.value = props.modelValue
  isEditing.value = true
  await nextTick()
  field.value?.focus()
  if (field.value instanceof HTMLInputElement) field.value.select()
}

/** 提交去掉首尾空白后的草稿并收起输入框；内部换行仍保留。 */
function commit(): void {
  if (!isEditing.value) return
  const value = draft.value.trim()
  if (value !== props.modelValue) emit('update:modelValue', value)
  isEditing.value = false
}

// 页面离开或进入后台时先提交局部草稿，再让工作区执行 flush。
onMounted(() => window.addEventListener(COMMIT_EDITS_EVENT, commit))
onUnmounted(() => window.removeEventListener(COMMIT_EDITS_EVENT, commit))

/** 恢复父组件已提交的值，不发修改事件；Escape 使用此入口。 */
function cancel(): void {
  draft.value = props.modelValue
  isEditing.value = false
}

/** 阻止提交/取消快捷键的默认行为；多行字段的普通 Enter 仍插入换行。 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  } else if (
    event.key === 'Enter' &&
    (!props.multiline || event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault()
    commit()
  }
}
</script>

<template>
  <component
    :is="tag"
    v-if="!isEditing"
    :class="{ 'inline-editable': editing }"
    @click.stop="begin"
  >
    <template v-if="modelValue">{{ modelValue }}</template>
    <span v-else-if="editing" class="empty-hint">{{ placeholder }}</span>
  </component>
  <textarea
    v-else-if="multiline"
    ref="field"
    v-model="draft"
    class="inline-field inline-field--multiline"
    :placeholder="placeholder"
    rows="3"
    @blur="commit"
    @keydown="handleKeydown"
  />
  <input
    v-else
    ref="field"
    v-model="draft"
    class="inline-field"
    :placeholder="placeholder"
    @blur="commit"
    @keydown="handleKeydown"
  />
</template>
