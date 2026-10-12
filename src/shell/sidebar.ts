const storageKey = "sidebar_collapsed"

export function getStoredSidebarCollapsed(): boolean {
  return localStorage.getItem(storageKey) === "1"
}

export function setStoredSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(storageKey, collapsed ? "1" : "0")
}

