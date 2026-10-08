<script setup lang="ts">
/** @file 原位富文本编辑，编辑内核管理输入/撤销，向外只提交文字与允许的格式。 */
import { nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Slice } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import {
  captureEditorViewport,
  restoreEditorViewport,
  type ScrollSnapshot,
} from '../services/editorViewport'
import { toggleUnorderedList } from '../domain/textLists'
import {
  fromEditorPosition,
  fromRichDocument,
  toEditorPosition,
  toRichDocument,
  type TextSelection,
} from '../services/richTextDocument'
import type { TextFormatRange } from '../types'

const props = defineProps<{
  text: string
  formats: TextFormatRange[]
  multiline: boolean
  placeholder: string
  initialSelection: TextSelection
  initialViewport: ScrollSnapshot | null
}>()
const emit = defineEmits<{
  ready: []
  change: [text: string, formats: TextFormatRange[]]
  selection: [selection: TextSelection]
  complete: []
  cancel: []
  composing: [active: boolean]
  hint: [message: string]
}>()
const editor = shallowRef<Editor | null>(null)

function getDraft() {
  return editor.value
    ? fromRichDocument(editor.value.getJSON())
    : { text: props.text, formats: props.formats }
}

function publishDraft(): void {
  const draft = getDraft()
  emit('change', draft.text, draft.formats)
}

function publishSelection(): void {
  const active = editor.value
  if (!active) return
  const document = active.getJSON()
  emit('selection', {
    start: fromEditorPosition(document, active.state.selection.from),
    end: fromEditorPosition(document, active.state.selection.to),
  })
}

/** 焦点与选区同步交接；缩放画布中浏览器的自动滚动不能改变用户正在看的位置。 */
function preserveScroll(action: () => void, viewport?: ScrollSnapshot | null): void {
  const active = editor.value
  if (!active) return
  const snapshot = viewport ?? captureEditorViewport(active.view.dom)
  action()
  restoreEditorViewport(snapshot)
}

function focusEditor(active: Editor): void {
  active.view.dom.focus({ preventScroll: true })
  active.view.focus()
}

function restoreSelection(
  selection: TextSelection,
  viewport?: ScrollSnapshot | null,
): void {
  const active = editor.value
  if (!active) return
  const document = active.getJSON()
  preserveScroll(() => {
    focusEditor(active)
    active.commands.setTextSelection({
      from: toEditorPosition(document, selection.start),
      to: toEditorPosition(document, selection.end),
    })
  }, viewport)
}

/** 使用编辑内核的原生事务改格式，选中文字立即渲染，并进入同一撤销历史。 */
function applyFormat(
  patch: { bold?: boolean; color?: string; clear?: boolean; resetColor?: boolean },
  focus = true,
): void {
  const active = editor.value
  if (!active || active.view.composing) return
  const chain = active.chain()
  chain.command(({ tr }) => {
    closeHistory(tr)
    return true
  })
  if (patch.clear) chain.unsetBold().unsetColor()
  else {
    if (patch.bold === true) chain.setBold()
    if (patch.bold === false) chain.unsetBold()
    if (patch.color) chain.setColor(patch.color)
    if (patch.resetColor) chain.unsetColor()
  }
  chain.run()
  if (focus) preserveScroll(() => focusEditor(active))
}

function toggleList(selection: TextSelection): void {
  const active = editor.value
  if (!active || active.view.composing) return
  const draft = getDraft()
  const result = toggleUnorderedList(
    draft.text,
    draft.formats,
    selection.start,
    selection.end,
  )
  // 圆点属于现有纯文本契约；以单次可撤销事务更新临时文档，不引入额外列表数据。
  const content = active.state.schema.nodeFromJSON(
    toRichDocument(result.text, result.formats, props.multiline),
  )
  const transaction = closeHistory(active.state.tr).replaceWith(
    0,
    active.state.doc.content.size,
    content.content,
  )
  active.view.dispatch(transaction)
  restoreSelection(result.selection)
}

function getSelectionRect(): DOMRect | null {
  const active = editor.value
  if (!active) return null
  const selected = window.getSelection()
  if (
    selected?.rangeCount &&
    active.view.dom.contains(selected.anchorNode) &&
    active.view.dom.contains(selected.focusNode)
  ) {
    const bounds = selected.getRangeAt(0).getBoundingClientRect()
    if (bounds.width || bounds.height) return bounds
  }
  const position = active.view.coordsAtPos(active.state.selection.to)
  return new DOMRect(
    position.left,
    position.top,
    position.right - position.left,
    position.bottom - position.top,
  )
}

function handleKeydown(event: KeyboardEvent): boolean {
  if (event.isComposing || editor.value?.view.composing) return false
  if (event.key === 'Escape') {
    emit('cancel')
    return true
  }
  if (event.key === 'Enter') {
    if (!props.multiline || event.ctrlKey || event.metaKey) emit('complete')
    else editor.value?.commands.splitBlock()
    return true
  }
  return false
}

onMounted(async () => {
  editor.value = new Editor({
    content: toRichDocument(props.text, props.formats, props.multiline),
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        underline: false,
        trailingNode: false,
      }),
      TextStyle,
      Color,
    ],
    editorProps: {
      attributes: (state) => ({
        class: props.multiline
          ? 'rich-text-surface rich-text-surface--multiline'
          : 'rich-text-surface',
        role: 'textbox',
        'aria-multiline': String(props.multiline),
        'aria-label': props.placeholder,
        'data-placeholder': props.placeholder,
        'data-empty': String(
          state.doc.childCount === 1 && state.doc.textContent.length === 0,
        ),
      }),
      handleKeyDown: (_view, event) => handleKeydown(event),
      handlePaste: (view, event) => {
        event.preventDefault()
        const text = event.clipboardData?.getData('text/plain') ?? ''
        // 空剪贴板不替换现有选区；空格/换行仍是有效文字，不用 trim 判断。
        if (text.length === 0) {
          emit('hint', '剪贴板没有文字，请粘贴文字内容。')
          return true
        }
        const document = view.state.schema.nodeFromJSON(
          toRichDocument(text, [], props.multiline),
        )
        view.dispatch(
          view.state.tr
            .replaceSelection(new Slice(document.content, 1, 1))
            .scrollIntoView(),
        )
        emit('hint', '')
        return true
      },
      handleDrop: (_view, event) => {
        event.preventDefault()
        return true
      },
      handleDOMEvents: {
        compositionstart: () => {
          emit('composing', true)
          return false
        },
        compositionend: () => {
          emit('composing', false)
          return false
        },
      },
    },
    onUpdate: () => publishDraft(),
    onSelectionUpdate: () => publishSelection(),
  })
  // 旧 CRLF 段落规范成编辑内核的 LF 后，同步文字和对应的新区间。
  publishDraft()
  await nextTick()
  if (!editor.value || editor.value.isDestroyed) return
  // EditorContent 已挂载后才撤下原文字；等父组件完成交接再恢复焦点和选区。
  emit('ready')
  await nextTick()
  if (!editor.value || editor.value.isDestroyed) return
  restoreSelection(props.initialSelection, props.initialViewport)
  publishSelection()
})

onUnmounted(() => {
  editor.value?.destroy()
  editor.value = null
})
defineExpose({ getDraft, restoreSelection, applyFormat, toggleList, getSelectionRect })
</script>

<template>
  <EditorContent :editor="editor ?? undefined" />
</template>
