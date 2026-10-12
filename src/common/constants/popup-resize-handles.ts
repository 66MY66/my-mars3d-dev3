/** 功能弹窗统一缩放把手：上/右/下边 + 左下/右下角，不含单独左边 */
export const POPUP_PANEL_RESIZE_HANDLES = ["t", "r", "b", "lb", "rb"] as const

export type PopupPanelResizeHandle = (typeof POPUP_PANEL_RESIZE_HANDLES)[number]
