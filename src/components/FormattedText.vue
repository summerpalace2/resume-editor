<script setup lang="ts">
/** @file 安全渲染纯文本及其局部格式；预览和打印共用，不使用 v-html。 */
import { computed } from 'vue'
import { textSegments, textParagraphs } from '../domain/textFormatting'
import type { TextFormatRange } from '../types'
const props = withDefaults(
  defineProps<{ text: string; formats?: TextFormatRange[]; paragraphs?: boolean }>(),
  {
    formats: () => [],
    paragraphs: false,
  },
)
const segments = computed(() => textSegments(props.text, props.formats))
const paragraphParts = computed(() => textParagraphs(props.text, props.formats))
</script>

<template>
  <template v-if="paragraphs">
    <span
      v-for="paragraph in paragraphParts"
      :key="paragraph.start"
      class="formatted-paragraph"
    >
      <span
        v-for="segment in paragraph.segments"
        :key="segment.start"
        :style="{ fontWeight: segment.bold ? 700 : undefined, color: segment.color }"
        >{{ segment.text }}</span
      ><span v-if="paragraph.breakText" class="paragraph-break" aria-hidden="true">{{
        paragraph.breakText
      }}</span>
    </span>
  </template>
  <template v-else>
    <span
      v-for="segment in segments"
      :key="segment.start"
      :style="{ fontWeight: segment.bold ? 700 : undefined, color: segment.color }"
      >{{ segment.text }}</span
    >
  </template>
</template>
