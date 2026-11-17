<script setup lang="ts">
/** @file 编辑工作区页面：连接 store 与画布，管理编辑模式、保存提示和 PDF 导出。 */
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import { useRouter } from 'vue-router'
import PdfImportDialog from '../components/PdfImportDialog.vue'
import ResumePreview from '../components/ResumePreview.vue'
import PreviewZoomControls from '../components/PreviewZoomControls.vue'
import { usePdfImport } from '../composables/usePdfImport'
import { usePreviewZoom } from '../composables/usePreviewZoom'
import { DIRECT_EDIT_REQUEST_KEY } from '../services/editLifecycle'
import { useResumeStore } from '../stores/resumes'
import type { ResumeDocument } from '../types'

const store = useResumeStore()
const router = useRouter()
const stage = useTemplateRef<HTMLElement>('stage')
const pdfInput = useTemplateRef<HTMLInputElement>('pdfInput')
const { fitWidth, zoomPercent, minZoom, maxZoom, setZoom } = usePreviewZoom(stage)
const { parsingPdf, pendingPdf, parsePdfFile, clearPendingPdf } = usePdfImport()
/** 路由页面的临时交互状态，不写入简历文档。 */
const editing = ref(false)
/** 导出准备期间阻止重复触发，打印窗口结束后释放。 */
const preparingPdf = ref(false)
const isMobileViewport = ref(false)
const mobileA4Preview = ref(false)
const useMobileResponsive = computed(
  () => isMobileViewport.value && !mobileA4Preview.value,
)

provide(DIRECT_EDIT_REQUEST_KEY, () => {
  editing.value = true
})

let mobileMediaQuery: MediaQueryList | null = null
function syncMobileViewport(): void {
  if (!mobileMediaQuery) return
  isMobileViewport.value = mobileMediaQuery.matches
  if (!mobileMediaQuery.matches) mobileA4Preview.value = false
}

onMounted(() => {
  mobileMediaQuery = window.matchMedia('(max-width: 768px)')
  syncMobileViewport()
  mobileMediaQuery.addEventListener('change', syncMobileViewport)
})

onUnmounted(() => {
  mobileMediaQuery?.removeEventListener('change', syncMobileViewport)
})

/** 完成编辑时提交草稿并等待保存；失败提示由跨页面恢复条保留。 */
async function toggleEditing(): Promise<void> {
  editing.value = !editing.value
  if (!editing.value) {
    await nextTick()
    await store.flush().catch(() => undefined)
  }
}

/** 接收画布副本；校验、修改时间和保存统一交给工作区动作。 */
function updateResume(resume: ResumeDocument): void {
  store.replaceResume(resume)
}

/** 将保存/读取状态转换为界面文字；ready 与保存成功是两个不同概念。 */
function statusText(): string {
  if (store.saveState === 'saving') return '正在保存…'
  if (store.saveErrorMessage?.includes('当前预览环境')) return '预览环境不支持本地保存'
  if (store.saveState === 'error') return '本地保存失败'
  if (store.saveState === 'loading') return '正在读取…'
  return '已保存在当前浏览器'
}

/**
 * 退出编辑以提交字段草稿，等待字体/照片，再调用浏览器打印；分页交给共享打印 CSS。
 * 这是打印对话框入口，文件保存由用户选择的打印目标完成，不是直接生成 PDF Blob。
 */
async function exportPdf(): Promise<void> {
  if (preparingPdf.value) return
  preparingPdf.value = true
  try {
    editing.value = false
    await nextTick()
    await store.flush().catch(() => undefined)
    // 字体及照片加载完成后再让打印引擎取快照，避免刚切换模板时导出旧排版。
    await document.fonts.ready
    await Promise.all(
      Array.from(document.querySelectorAll<HTMLImageElement>('.resume-page img')).map(
        (image) => image.decode().catch(() => undefined),
      ),
    )
    await nextTick()
    window.print()
  } finally {
    preparingPdf.value = false
  }
}

/** 切换当前文档时退出编辑，避免将前一份简历的交互状态带到后一份。 */
watch(
  () => store.activeResumeId,
  () => {
    editing.value = false
  },
)

async function handlePdfFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await parsePdfFile(file)
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'PDF 解析失败，请确认文件有效。',
    )
  } finally {
    input.value = ''
  }
}

function confirmWorkspacePdfImport(payload: {
  resume: ResumeDocument
  mode: 'overwrite' | 'create'
}): void {
  const active = store.activeResume
  try {
    editing.value = false
    if (payload.mode === 'overwrite' && active) {
      store.overwriteResume(active.id, payload.resume)
    } else {
      store.importResume(payload.resume)
    }
    clearPendingPdf()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '导入失败，请稍后重试。')
  }
}
</script>

<template>
  <main v-if="store.activeResume" class="workspace-shell">
    <header class="app-toolbar no-print">
      <RouterLink class="brand" to="/resumes"
        ><span class="brand-icon">R</span><span>简历工坊</span></RouterLink
      >
      <div class="toolbar-center">
        <span class="document-name">{{ store.activeResume.title }}</span>
        <span
          class="save-state"
          :class="`save-${store.saveState}`"
          :title="store.saveErrorMessage ?? undefined"
          ><i></i>{{ statusText() }}</span
        >
      </div>
      <nav class="toolbar-actions">
        <RouterLink class="toolbar-link" to="/resumes">我的简历</RouterLink>
        <button class="toolbar-link" @click="router.push('/settings')">样式设置</button>
        <button
          class="button button-quiet"
          :disabled="parsingPdf"
          @click="pdfInput?.click()"
        >
          {{ parsingPdf ? '解析 PDF 中…' : '导入 PDF' }}
        </button>
        <input
          ref="pdfInput"
          class="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          @change="handlePdfFile"
        />
        <button class="button button-quiet" :disabled="preparingPdf" @click="exportPdf">
          {{ preparingPdf ? '准备导出…' : '导出 PDF' }}
        </button>
        <button
          class="button"
          :class="editing ? 'button-done' : 'button-primary'"
          @click="toggleEditing"
        >
          {{ editing ? '完成编辑' : '编辑简历' }}
        </button>
      </nav>
    </header>

    <div class="workspace-hint no-print">
      <span v-if="editing"
        ><strong>编辑模式</strong> ·
        点击简历中的文字即可修改，修改会自动保存到当前浏览器。</span
      >
      <span v-else
        >轻触简历文字或点击“编辑简历”即可修改内容，数据仅保存在当前浏览器。</span
      >
      <button v-if="editing" class="hint-close" @click="toggleEditing">完成</button>
    </div>

    <div v-if="useMobileResponsive" class="mobile-preview-bar no-print">
      <span>当前为手机适配视图（支持直接点击文字修改）</span>
      <button type="button" class="button button-quiet" @click="mobileA4Preview = true">
        查看 A4 原比例
      </button>
    </div>

    <PreviewZoomControls
      v-else
      :percent="zoomPercent"
      :fit-width="fitWidth"
      :min="minZoom"
      :max="maxZoom"
      @change="setZoom"
      @fit="fitWidth = true"
    >
      <button v-if="isMobileViewport" type="button" @click="mobileA4Preview = false">
        手机适配视图
      </button>
    </PreviewZoomControls>

    <section
      ref="stage"
      class="resume-stage"
      :class="useMobileResponsive ? 'resume-stage--mobile' : 'resume-stage--zoomable'"
    >
      <div
        :class="useMobileResponsive ? 'resume-mobile-frame' : 'preview-zoom-frame'"
        :style="useMobileResponsive ? undefined : { '--preview-zoom': zoomPercent / 100 }"
      >
        <ResumePreview
          :resume="store.activeResume"
          :editing="editing"
          @update:resume="updateResume"
        />
      </div>
    </section>

    <PdfImportDialog
      :summary="pendingPdf"
      :current-resume="store.activeResume"
      allow-overwrite
      @close="clearPendingPdf"
      @confirm="confirmWorkspacePdfImport"
    />
  </main>
</template>
