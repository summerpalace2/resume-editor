/** @file 工作区与设置页的画布缩放；仅影响屏幕查看，比例不写入简历或备份。 */
import { computed, ref, watch, type Ref } from 'vue'

const canvasWidth = 1024
const defaultMinZoom = 25
const maxZoom = 200

export function usePreviewZoom(
  stage: Readonly<Ref<HTMLElement | null>>,
  options: { minZoom?: number } = {},
) {
  const minZoom = options.minZoom ?? defaultMinZoom
  const availableWidth = ref(canvasWidth)
  const fitWidth = ref(true)
  const manualZoom = ref(100)
  const zoomPercent = computed(() =>
    fitWidth.value
      ? Math.max(
          minZoom,
          Math.min(100, Math.floor((availableWidth.value / canvasWidth) * 100)),
        )
      : manualZoom.value,
  )

  function setZoom(value: number): void {
    if (!Number.isFinite(value)) return
    manualZoom.value = Math.max(minZoom, Math.min(maxZoom, Math.round(value)))
    fitWidth.value = false
  }

  // 监听真实工作区宽度，适配浏览器侧栏/窗口变化；手动比例不随窗口重置。
  watch(stage, (element, _previous, onCleanup) => {
    if (!element) return
    const measure = () => {
      const style = getComputedStyle(element)
      availableWidth.value = Math.max(
        1,
        element.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  })

  return { fitWidth, zoomPercent, minZoom, maxZoom, setZoom }
}
