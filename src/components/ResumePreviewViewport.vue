<script setup lang="ts">
/** @file 设置页的小预览和展开预览共用查看器；缩放、拖动均不修改简历。 */
import { nextTick, ref, useTemplateRef } from 'vue'
import ResumePreview from './ResumePreview.vue'
import PreviewZoomControls from './PreviewZoomControls.vue'
import { usePreviewZoom } from '../composables/usePreviewZoom'
import type { ResumeDocument } from '../types'

defineProps<{ resume: ResumeDocument; large?: boolean }>()
const stage = useTemplateRef<HTMLElement>('stage')
const { fitWidth, zoomPercent, minZoom, maxZoom, setZoom } = usePreviewZoom(stage, {
  minZoom: 10,
})
const dragMode = ref(true)
const dragging = ref(false)
let pointer: { id: number; x: number; y: number; left: number; top: number } | null = null

/** 按实际内容高度适应整页；长简历也纳入计算，不假定只有一张 A4。 */
async function fitPage(): Promise<void> {
  await nextTick()
  const element = stage.value
  const page = element?.querySelector<HTMLElement>('.resume-page')
  if (!element || !page) return
  const style = getComputedStyle(element)
  const width =
    element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const height =
    element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
  setZoom(
    Math.floor(Math.min(width / page.offsetWidth, height / page.offsetHeight, 1) * 100),
  )
  element.scrollTo(0, 0)
}

function startDrag(event: PointerEvent): void {
  const element = stage.value
  if (!element || !dragMode.value || event.button !== 0 || !event.isPrimary) return
  // 链接继续正常跳转，滚动条由浏览器处理，只有画布内容进入拖动。
  if (event.target instanceof Element && event.target.closest('a, button, input')) return
  const bounds = element.getBoundingClientRect()
  if (
    event.clientX >= bounds.left + element.clientLeft + element.clientWidth ||
    event.clientY >= bounds.top + element.clientTop + element.clientHeight
  )
    return
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: element.scrollLeft,
    top: element.scrollTop,
  }
  element.setPointerCapture(event.pointerId)
  dragging.value = true
  event.preventDefault()
}

function moveDrag(event: PointerEvent): void {
  if (!pointer || pointer.id !== event.pointerId || !stage.value) return
  stage.value.scrollLeft = pointer.left - (event.clientX - pointer.x)
  stage.value.scrollTop = pointer.top - (event.clientY - pointer.y)
}

function stopDrag(): void {
  if (pointer && stage.value?.hasPointerCapture(pointer.id))
    stage.value.releasePointerCapture(pointer.id)
  pointer = null
  dragging.value = false
}
</script>

<template>
  <div class="resume-preview-viewer" :class="{ 'resume-preview-viewer--large': large }">
    <PreviewZoomControls
      class="preview-controls--compact"
      label="实时预览缩放"
      :percent="zoomPercent"
      :fit-width="fitWidth"
      :min="minZoom"
      :max="maxZoom"
      @change="setZoom"
      @fit="fitWidth = true"
    >
      <button type="button" @click="fitPage">整页</button>
      <button type="button" :aria-pressed="dragMode" @click="dragMode = !dragMode">
        {{ dragMode ? '拖动画布' : '选中文字' }}
      </button>
      <slot name="actions" />
    </PreviewZoomControls>
    <div
      ref="stage"
      class="settings-resume-preview"
      :class="{ 'preview-pan-enabled': dragMode, 'preview-panning': dragging }"
      tabindex="0"
      aria-label="简历预览画布，可滚动查看"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
      @lostpointercapture="stopDrag"
    >
      <div class="preview-zoom-frame" :style="{ '--preview-zoom': zoomPercent / 100 }">
        <ResumePreview :resume="resume" :editing="false" />
      </div>
    </div>
    <p class="preview-note">
      {{
        dragMode
          ? '按住画布拖动查看，或使用滚轮；点击“拖动画布”可切换为选字。'
          : '当前可选择文字；点击“选中文字”可切换为拖动画布。'
      }}
    </p>
  </div>
</template>
