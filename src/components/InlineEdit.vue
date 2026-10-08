<script setup lang="ts">
/** @file 单字段编辑及选区格式；文字与格式以一次事件原子提交，避免副本互相覆盖。 */
import {
  computed,
  defineAsyncComponent,
  ref,
  shallowRef,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
} from 'vue'
import { COMMIT_EDITS_EVENT } from '../services/editLifecycle'
import { captureEditorViewport, type ScrollSnapshot } from '../services/editorViewport'
import { rebaseFormats, textSegments } from '../domain/textFormatting'
import { hasUnorderedList } from '../domain/textLists'
import { textColorGroups } from '../data/textColors'
import FormattedText from './FormattedText.vue'
import type { TextFormatRange } from '../types'
import type RichTextFieldComponent from './RichTextField.vue'
import type { TextSelection } from '../services/richTextDocument'

const RichTextField = defineAsyncComponent(() => import('./RichTextField.vue'))

// 工具栏 Teleport 后存在多个根节点，显式把字段字号/类名绑定到字段本身。
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{
    modelValue: string
    formats?: TextFormatRange[]
    multiline?: boolean
    listEnabled?: boolean
    placeholder?: string
    tag?: string
    editing?: boolean
  }>(),
  {
    formats: () => [],
    multiline: false,
    listEnabled: false,
    placeholder: '点击填写',
    tag: 'span',
    editing: false,
  },
)
const emit = defineEmits<{ commit: [value: string, formats: TextFormatRange[]] }>()
const isEditing = ref(false)
const editorReady = ref(false)
const draft = ref(props.modelValue)
const draftFormats = ref<TextFormatRange[]>([])
const field = ref<InstanceType<typeof RichTextFieldComponent> | null>(null)
const display = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const toolbarPosition = ref({ left: 12, top: 12 })
const selection = ref({ start: 0, end: 0 })
const initialSelection = ref({ start: 0, end: 0 })
const initialViewport = shallowRef<ScrollSnapshot | null>(null)
const clipboardHint = ref('')
const composing = ref(false)
const colorDialogActive = ref(false)
const colorPanelOpen = ref(false)
const colorCode = ref('')
const colorCodeError = ref('')
const hasSelection = computed(
  () => selection.value.end > selection.value.start && !composing.value,
)
const selectedSegments = computed(() =>
  textSegments(draft.value, draftFormats.value).filter(
    (segment) =>
      segment.end > selection.value.start && segment.start < selection.value.end,
  ),
)
const allBold = computed(
  () => hasSelection.value && selectedSegments.value.every((segment) => segment.bold),
)
const allBulleted = computed(() =>
  hasUnorderedList(draft.value, selection.value.start, selection.value.end),
)
const selectionColor = computed(
  () => selectedSegments.value.find((segment) => segment.color)?.color ?? '#334f72',
)
watch(
  selectionColor,
  (color) => {
    colorCode.value = color
    colorCodeError.value = ''
  },
  { immediate: true },
)
watch([colorPanelOpen, colorCodeError], () => {
  if (hasSelection.value) void positionToolbar()
})

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

/** 拖选展示文字后转入富文本编辑，保留同一选区；不另外展开预览。 */
async function begin(event?: MouseEvent): Promise<void> {
  if (!props.editing || isEditing.value) return
  initialViewport.value = display.value ? captureEditorViewport(display.value) : null
  let start = 0
  let end = 0
  const selected = window.getSelection()
  if (selected?.rangeCount && display.value && props.modelValue) {
    const range = selected.getRangeAt(0)
    if (
      display.value.contains(range.startContainer) &&
      display.value.contains(range.endContainer)
    ) {
      const prefix = range.cloneRange()
      prefix.selectNodeContents(display.value)
      prefix.setEnd(range.startContainer, range.startOffset)
      start = prefix.toString().length
      end = start + range.toString().length
    }
  }
  draft.value = props.modelValue
  draftFormats.value = (props.formats ?? []).map((range) => ({ ...range }))
  editorReady.value = false
  isEditing.value = true
  composing.value = false
  selection.value = { start: 0, end: 0 }
  initialSelection.value = {
    start: draft.value.slice(0, start).replace(/\r\n|\r/gu, '\n').length,
    end: draft.value.slice(0, end).replace(/\r\n|\r/gu, '\n').length,
  }
  clipboardHint.value = ''
  colorPanelOpen.value = false
  colorCodeError.value = ''
  await nextTick()
  // 加载期间原文字继续占位；仅在编辑内核就绪后交出焦点，避免两次聚焦跳动。
  if (event) void positionToolbar(event)
}

/** 子组件将编辑内核位置映射成纯文本选区；工具栏只使用这一契约。 */
function rememberSelection(value: TextSelection): void {
  selection.value = value
  if (hasSelection.value) void positionToolbar()
}

/** Teleport + fixed 脱离简历缩放/裁剪；根据实际工具栏尺寸限制在视口内。 */
async function positionToolbar(event?: Event): Promise<void> {
  const rect = field.value?.getSelectionRect()
  if (!rect) return
  const pointer = event instanceof MouseEvent && event.type !== 'select'
  const anchorX = pointer ? event.clientX : rect.left + rect.width / 2
  const anchorY = pointer ? event.clientY : rect.bottom
  const anchorTop = pointer ? event.clientY : rect.top
  await nextTick()
  if (!toolbar.value || !isEditing.value || !hasSelection.value) return
  const bounds = toolbar.value.getBoundingClientRect()
  const viewport = window.visualViewport
  const minLeft = (viewport?.offsetLeft ?? 0) + 12
  const minTop = (viewport?.offsetTop ?? 0) + 12
  const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 12
  const bottom =
    (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12
  toolbarPosition.value = {
    left: Math.max(minLeft, Math.min(anchorX - bounds.width / 2, right - bounds.width)),
    top: Math.max(
      minTop,
      Math.min(
        anchorY + 12 + bounds.height <= bottom
          ? anchorY + 12
          : anchorTop - bounds.height - 12,
        bottom - bounds.height,
      ),
    ),
  }
}

function onViewportChange(): void {
  if (hasSelection.value) void positionToolbar()
}

function updateDraft(text: string, formats: TextFormatRange[]): void {
  draft.value = text
  draftFormats.value = formats
}

function restoreSelection(): void {
  field.value?.restoreSelection(selection.value)
}

function applyFormat(
  patch: { bold?: boolean; color?: string; clear?: boolean; resetColor?: boolean },
  focus = true,
): void {
  if (!hasSelection.value) return
  field.value?.applyFormat(patch, focus)
}

function changeColor(event: Event): void {
  if (event.target instanceof HTMLInputElement)
    applyFormat({ color: event.target.value }, false)
}

function colorIsSelected(value: string): boolean {
  return (
    hasSelection.value &&
    selectedSegments.value.every((segment) => segment.color === value)
  )
}

/** 手动输入允许三位简写，应用前转为六位颜色，保持已有存储契约。 */
function applyColorCode(): void {
  const code = colorCode.value.trim().replace(/^#/u, '')
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/iu.test(code)) {
    colorCodeError.value = '请输入 #RRGGBB 或 #RGB 颜色。'
    return
  }
  const value = `#${(code.length === 3 ? [...code].map((part) => part + part).join('') : code).toLowerCase()}`
  colorCode.value = value
  colorCodeError.value = ''
  applyFormat({ color: value })
}

function toggleList(): void {
  if (!props.multiline || !props.listEnabled || !hasSelection.value) return
  field.value?.toggleList(selection.value)
}

function finishColor(): void {
  colorDialogActive.value = false
  restoreSelection()
}

/** 逐次去掉首尾空白并映射区间，避免一次 trim 同时移除两端时丢失中间格式。 */
function commit(): void {
  if (!isEditing.value) return
  colorDialogActive.value = false
  const snapshot = field.value?.getDraft()
  if (snapshot) updateDraft(snapshot.text, snapshot.formats)
  const startTrimmed = draft.value.trimStart()
  const value = startTrimmed.trimEnd()
  const formats = rebaseFormats(
    startTrimmed,
    value,
    rebaseFormats(draft.value, startTrimmed, draftFormats.value),
  )
  isEditing.value = false
  if (
    value !== props.modelValue ||
    JSON.stringify(formats) !== JSON.stringify(props.formats ?? [])
  )
    emit('commit', value, formats)
}

/** 只在焦点离开整个编辑区域时提交；点击工具栏与打开颜色选择器保留草稿。 */
function onFocusOut(event: FocusEvent): void {
  if (
    event.relatedTarget instanceof Node &&
    (display.value?.contains(event.relatedTarget) ||
      toolbar.value?.contains(event.relatedTarget))
  )
    return
  if (event.relatedTarget === null && colorDialogActive.value) return
  commit()
}

function onOutsidePointer(event: PointerEvent): void {
  if (
    isEditing.value &&
    event.target instanceof Node &&
    !display.value?.contains(event.target) &&
    !toolbar.value?.contains(event.target)
  )
    commit()
}

function cancel(): void {
  draft.value = props.modelValue
  isEditing.value = false
}

// 仅活动字段监听视口变化；选区由编辑内核通知，避免所有字段都执行测量。
watch(isEditing, (active, _previous, onCleanup) => {
  if (!active) return
  document.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('resize', onViewportChange)
  window.visualViewport?.addEventListener('scroll', onViewportChange)
  onCleanup(() => {
    document.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scroll', onViewportChange)
  })
})

onMounted(() => {
  window.addEventListener(COMMIT_EDITS_EVENT, commit)
  document.addEventListener('pointerdown', onOutsidePointer, true)
})
onUnmounted(() => {
  window.removeEventListener(COMMIT_EDITS_EVENT, commit)
  document.removeEventListener('pointerdown', onOutsidePointer, true)
})
</script>

<template>
  <component
    :is="tag"
    ref="display"
    v-bind="$attrs"
    :class="{
      'inline-editable': editing && !isEditing,
      'inline-edit-host': isEditing,
    }"
    :tabindex="isEditing ? -1 : undefined"
    @focusout="onFocusOut"
    @click.stop="begin"
  >
    <template v-if="!isEditing || !editorReady">
      <FormattedText
        v-if="modelValue"
        :text="modelValue"
        :formats="formats"
        :paragraphs="multiline"
      />
      <span v-else-if="editing" class="empty-hint">{{ placeholder }}</span>
    </template>
    <span
      v-if="isEditing"
      class="inline-editor"
      :class="{ 'inline-editor--loading': !editorReady }"
    >
      <RichTextField
        ref="field"
        :text="draft"
        :formats="draftFormats"
        :multiline="multiline"
        :placeholder="placeholder"
        :initial-selection="initialSelection"
        :initial-viewport="initialViewport"
        @ready="editorReady = true"
        @change="updateDraft"
        @selection="rememberSelection"
        @complete="commit"
        @cancel="cancel"
        @composing="(active) => (composing = active)"
        @hint="(message) => (clipboardHint = message)"
      />
      <span v-if="clipboardHint" class="rich-text-hint no-print" role="status">{{
        clipboardHint
      }}</span>
    </span>
  </component>
  <Teleport to="body">
    <div
      v-if="isEditing && hasSelection"
      ref="toolbar"
      class="text-format-toolbar text-format-toolbar--floating no-print"
      :style="{ left: `${toolbarPosition.left}px`, top: `${toolbarPosition.top}px` }"
      role="group"
      aria-label="选中文字格式"
      @focusout="onFocusOut"
      @click.stop
    >
      <span class="text-format-label">文字格式</span>
      <button
        v-if="multiline && listEnabled"
        type="button"
        :aria-pressed="allBulleted"
        title="给选中段落添加或取消圆点，保留空行"
        @mousedown.prevent
        @click="toggleList"
      >
        • 无序列表
      </button>
      <button
        type="button"
        :disabled="!hasSelection"
        :aria-pressed="allBold"
        title="加粗（Ctrl / Cmd + B）"
        @mousedown.prevent
        @click="applyFormat({ bold: !allBold })"
      >
        <b>B</b> 加粗
      </button>
      <button
        type="button"
        class="text-color-toggle"
        :aria-expanded="colorPanelOpen"
        @mousedown.prevent
        @click="colorPanelOpen = !colorPanelOpen"
      >
        <i :style="{ backgroundColor: selectionColor }" aria-hidden="true"></i>文字颜色
        {{ colorPanelOpen ? '▴' : '▾' }}
      </button>
      <label class="text-custom-color"
        >自选颜色<input
          type="color"
          :value="selectionColor"
          :disabled="!hasSelection"
          aria-label="自定义文字颜色"
          @pointerdown="colorDialogActive = true"
          @input="changeColor"
          @change="finishColor"
      /></label>
      <button
        type="button"
        :disabled="!hasSelection"
        @mousedown.prevent
        @click="applyFormat({ clear: true })"
      >
        清除格式
      </button>
      <button type="button" @mousedown.prevent @click="commit">完成</button>
      <div
        v-if="colorPanelOpen"
        class="text-color-panel"
        role="group"
        aria-label="文字颜色选择"
      >
        <div v-for="group in textColorGroups" :key="group.name" class="text-color-group">
          <span>{{ group.name }}</span>
          <div role="group" :aria-label="group.name">
            <button
              v-for="color in group.colors"
              :key="color.value"
              type="button"
              class="text-color-swatch"
              :style="{ backgroundColor: color.value }"
              :aria-label="`${color.name} ${color.value}`"
              :title="`${color.name} ${color.value}`"
              :aria-pressed="colorIsSelected(color.value)"
              @mousedown.prevent
              @click="applyFormat({ color: color.value })"
            />
          </div>
        </div>
        <div class="text-color-code-controls">
          <label
            >色号<input
              v-model="colorCode"
              type="text"
              spellcheck="false"
              maxlength="7"
              placeholder="#2563eb"
              aria-label="文字颜色色号"
              :aria-invalid="Boolean(colorCodeError)"
              @input="colorCodeError = ''"
              @keydown.enter.prevent="applyColorCode"
          /></label>
          <button type="button" @mousedown.prevent @click="applyColorCode">应用</button>
          <button
            type="button"
            @mousedown.prevent
            @click="applyFormat({ resetColor: true })"
          >
            默认颜色
          </button>
        </div>
        <span v-if="colorCodeError" class="text-color-code-error" role="alert">{{
          colorCodeError
        }}</span>
      </div>
    </div>
  </Teleport>
</template>
