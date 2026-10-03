/** @file 页面离开前的草稿提交协议；存储和模板无需互相持有组件引用。 */
export const COMMIT_EDITS_EVENT = 'resume-studio:commit-edits'

/** 同步通知活动编辑框；DOM 更新前文档副本已通过事件提交给工作区。 */
export function commitActiveEdits(): void {
  // 原生 URL 输入框按 change 提交；关闭页面时未必发生 blur，显式提交其当前值。
  const input = document.activeElement
  if (input instanceof HTMLInputElement && input.matches('.link-address-input'))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  window.dispatchEvent(new Event(COMMIT_EDITS_EVENT))
}
