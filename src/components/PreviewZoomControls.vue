<script setup lang="ts">
/** @file 工作区和设置页共用缩放控件；比例由页面管理，不修改简历文档。 */
withDefaults(
  defineProps<{
    percent: number
    fitWidth: boolean
    min: number
    max: number
    label?: string
  }>(),
  { label: '简历预览缩放' },
)
const emit = defineEmits<{ change: [percent: number]; fit: [] }>()

function changeZoom(event: Event): void {
  if (event.target instanceof HTMLInputElement) emit('change', event.target.valueAsNumber)
}
</script>

<template>
  <div class="preview-controls no-print" role="group" :aria-label="label">
    <span>预览缩放</span>
    <button
      type="button"
      aria-label="缩小预览"
      :disabled="percent <= min"
      @click="emit('change', percent - 10)"
    >
      −
    </button>
    <input
      type="range"
      :min="min"
      :max="max"
      step="1"
      :value="percent"
      aria-label="预览缩放比例"
      @input="changeZoom"
    />
    <output aria-live="polite">{{ percent }}%</output>
    <button
      type="button"
      aria-label="放大预览"
      :disabled="percent >= max"
      @click="emit('change', percent + 10)"
    >
      ＋
    </button>
    <button
      type="button"
      :aria-pressed="!fitWidth && percent === 100"
      @click="emit('change', 100)"
    >
      100%
    </button>
    <button type="button" :aria-pressed="fitWidth" @click="emit('fit')">适应宽度</button>
    <slot />
  </div>
</template>
