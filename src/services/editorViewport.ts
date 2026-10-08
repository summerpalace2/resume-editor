/** @file 编辑器交接焦点时保留画布和页面的滚动位置，防止浏览器选区自动滚动。 */
export interface ScrollSnapshot {
  left: number
  top: number
  parents: { element: HTMLElement; top: number; left: number }[]
}

export function captureEditorViewport(element: HTMLElement): ScrollSnapshot {
  const parents: ScrollSnapshot['parents'] = []
  for (let parent = element.parentElement; parent; parent = parent.parentElement)
    parents.push({ element: parent, top: parent.scrollTop, left: parent.scrollLeft })
  return { left: window.scrollX, top: window.scrollY, parents }
}

export function restoreEditorViewport(snapshot: ScrollSnapshot): void {
  for (const position of snapshot.parents) {
    if (!position.element.isConnected) continue
    position.element.scrollTop = position.top
    position.element.scrollLeft = position.left
  }
  window.scrollTo({ left: snapshot.left, top: snapshot.top, behavior: 'instant' })
}
