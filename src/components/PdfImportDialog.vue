<script setup lang="ts">
/** @file PDF 解析结果与实时画布预览弹窗，支持新建导入或覆盖当前简历。 */
import { computed, nextTick, ref, toRaw, useTemplateRef, watch } from 'vue'
import ResumePreviewViewport from './ResumePreviewViewport.vue'
import { cloneData } from '../data/clone'
import type { PdfImportSummary } from '../domain/pdfImport'
import type { ResumeDocument } from '../types'

const props = defineProps<{
  summary: PdfImportSummary | null
  allowOverwrite?: boolean
  currentResume?: ResumeDocument | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [payload: { resume: ResumeDocument; mode: 'overwrite' | 'create' }]
}>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleInput = ref('')
const keepCurrentStyle = ref(false)

const previewResume = computed<ResumeDocument | null>(() => {
  if (!props.summary) return null
  const base = cloneData(toRaw(props.summary.resume))
  const trimmedTitle = titleInput.value.trim()
  if (trimmedTitle) base.title = trimmedTitle
  if (props.allowOverwrite && keepCurrentStyle.value && props.currentResume) {
    const current = cloneData(toRaw(props.currentResume))
    base.templateId = current.templateId
    base.appearance = current.appearance
    // 清空 PDF 推导的左右栏归属，让目标版式按自身策略重新分配栏目位置。
    base.sections = base.sections.map((section) => {
      const rest = { ...section }
      delete rest.column
      return rest
    })
  }
  return base
})

watch(
  () => props.summary,
  async (value) => {
    if (!value) {
      if (dialog.value?.open) dialog.value.close()
      return
    }
    titleInput.value = value.resume.title
    keepCurrentStyle.value = false
    await nextTick()
    if (dialog.value && !dialog.value.open) {
      dialog.value.showModal()
    }
  },
  { immediate: true },
)

function closeDialog(): void {
  if (dialog.value?.open) dialog.value.close()
  emit('close')
}

function submit(mode: 'overwrite' | 'create'): void {
  const resume = previewResume.value
  if (!resume) return
  if (mode === 'overwrite' && props.currentResume) {
    const confirmed = window.confirm(
      `确定用该 PDF 的解析结果覆盖当前简历「${props.currentResume.title}」吗？覆盖后原有内容将被替换。`,
    )
    if (!confirmed) return
  }
  emit('confirm', { resume: cloneData(resume), mode })
}
</script>

<template>
  <dialog
    ref="dialog"
    class="pdf-import-dialog pdf-import-dialog--preview"
    aria-labelledby="pdf-import-title"
    @cancel.prevent="closeDialog"
  >
    <div v-if="summary && previewResume" class="pdf-import-layout">
      <div class="pdf-import-sidebar">
        <header class="pdf-import-header">
          <div>
            <p class="eyebrow">LOCAL PDF PARSER</p>
            <h2 id="pdf-import-title">PDF 导入预览</h2>
            <p class="muted">
              共 {{ summary.pageCount }} 页 · 自动匹配「{{
                summary.matchedTemplateName
              }}」与「{{ summary.matchedPaletteName }}」
            </p>
          </div>
          <button
            type="button"
            class="button button-quiet"
            aria-label="关闭导入弹窗"
            @click="closeDialog"
          >
            关闭
          </button>
        </header>

        <label class="pdf-import-name-field">
          <span>简历名称</span>
          <input
            v-model="titleInput"
            type="text"
            placeholder="输入简历名称"
            maxlength="80"
          />
        </label>

        <label v-if="allowOverwrite && currentResume" class="pdf-import-toggle">
          <input v-model="keepCurrentStyle" type="checkbox" />
          <span>保留当前简历的版式与配色（仅覆盖文字、链接和局部颜色）</span>
        </label>

        <div class="pdf-import-stats">
          <div>
            <strong>{{ summary.sectionCount }} / {{ summary.entryCount }}</strong>
            <span>栏目 / 经历条目</span>
          </div>
          <div>
            <strong>{{ summary.linkCount }}</strong>
            <span>识别到的链接</span>
          </div>
          <div>
            <strong>{{ summary.formatRangeCount }}</strong>
            <span>
              样式区间（{{ summary.coloredRangeCount }} 处颜色 ·
              {{ summary.boldRangeCount }} 处加粗）
            </span>
          </div>
        </div>

        <div v-if="summary.extractedLinks.length" class="pdf-import-links">
          <strong>已提取链接</strong>
          <ul>
            <li v-for="url in summary.extractedLinks" :key="url">
              <a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a>
            </li>
          </ul>
        </div>

        <ul v-if="summary.warnings.length" class="pdf-import-warnings">
          <li v-for="warning in summary.warnings" :key="warning">{{ warning }}</li>
        </ul>

        <footer class="pdf-import-actions">
          <button type="button" class="button button-quiet" @click="closeDialog">
            取消
          </button>
          <button
            v-if="allowOverwrite"
            type="button"
            class="button button-quiet"
            @click="submit('create')"
          >
            存为新简历
          </button>
          <button
            type="button"
            class="button button-primary"
            @click="submit(allowOverwrite ? 'overwrite' : 'create')"
          >
            {{ allowOverwrite ? '覆盖当前简历' : '导入并打开编辑' }}
          </button>
        </footer>
      </div>

      <section class="pdf-import-preview-pane" aria-label="导入效果实时预览">
        <div class="pdf-import-preview-head">
          <strong>导入效果实时预览</strong>
          <span>所见即导入后的排版效果，导入后仍可逐项拖拽和编辑</span>
        </div>
        <ResumePreviewViewport :resume="previewResume" large />
      </section>
    </div>
  </dialog>
</template>
