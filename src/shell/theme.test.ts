import { describe, expect, it, vi } from "vitest"
import { getCurrentTheme, setTheme } from "@/shell/theme"

describe("theme", () => {
  it("setTheme updates dataset, storage, and emits event", () => {
    const spy = vi.fn()
    window.addEventListener("themeChange", spy)

    setTheme("dark")
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(getCurrentTheme()).toBe("dark")
    expect(spy).toHaveBeenCalled()

    window.removeEventListener("themeChange", spy)
  })
})

