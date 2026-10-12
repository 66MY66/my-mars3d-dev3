export type ThemeMode = "light" | "dark"

const storageKey = "theme"

export function getStoredTheme(): ThemeMode | null {
  const value = localStorage.getItem(storageKey)
  if (value === "light" || value === "dark") {
    return value
  }
  return null
}

export function getCurrentTheme(): ThemeMode {
  const datasetTheme = document.documentElement.dataset.theme
  if (datasetTheme === "dark") {
    return "dark"
  }
  return "light"
}

export function setTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  localStorage.setItem(storageKey, mode)
  window.dispatchEvent(new CustomEvent("themeChange"))
}

export function initTheme() {
  const stored = getStoredTheme()
  if (stored) {
    setTheme(stored)
    return
  }
  setTheme("light")
}
