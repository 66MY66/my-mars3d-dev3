import { describe, expect, it } from "vitest"
import { isLikelyMojibake, normalizeDatasetText } from "./dataset-text"

describe("dataset text normalization", () => {
  it("repairs known mojibake labels used by the local dataset fallback", () => {
    expect(normalizeDatasetText("鏈湴", "本地")).toBe("本地")
    expect(normalizeDatasetText("鏈湴淇濆瓨鐨勬暟鎹泦", "本地保存的数据集")).toBe("本地保存的数据集")
  })

  it("uses a clean fallback for suspicious API or cached text", () => {
    expect(isLikelyMojibake("鍏变韩")).toBe(true)
    expect(normalizeDatasetText("鍏变韩", "共享")).toBe("共享")
    expect(normalizeDatasetText("正常中文", "备用文案")).toBe("正常中文")
  })

  it("does not rewrite ordinary Chinese, English, or identifiers", () => {
    expect(isLikelyMojibake("地震科学实验场")).toBe(false)
    expect(normalizeDatasetText("MAXAR_afghanistan_earthquake22", "备用")).toBe("MAXAR_afghanistan_earthquake22")
  })
})
