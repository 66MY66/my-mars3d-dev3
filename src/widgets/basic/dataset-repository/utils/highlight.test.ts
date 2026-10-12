import { describe, it, expect } from "vitest"
import { highlightText, containsKeyword } from "./highlight"

describe("highlightText", () => {
  it("应该高亮匹配的关键词", () => {
    const result = highlightText("地震灾害损失评估", "地震")
    expect(result).toBe('<mark class="search-highlight">地震</mark>灾害损失评估')
  })

  it("应该高亮多个匹配", () => {
    const result = highlightText("地震风险评估和地震预警", "地震")
    expect(result).toBe(
      '<mark class="search-highlight">地震</mark>风险评估和<mark class="search-highlight">地震</mark>预警'
    )
  })

  it("应该不区分大小写", () => {
    const result = highlightText("Earthquake Data", "earthquake")
    expect(result).toBe('<mark class="search-highlight">Earthquake</mark> Data')
  })

  it("应该处理空关键词", () => {
    const result = highlightText("测试文本", "")
    expect(result).toBe("测试文本")
  })

  it("应该处理null关键词", () => {
    const result = highlightText("测试文本", null)
    expect(result).toBe("测试文本")
  })

  it("应该处理undefined关键词", () => {
    const result = highlightText("测试文本", undefined)
    expect(result).toBe("测试文本")
  })

  it("应该处理空文本", () => {
    const result = highlightText("", "关键词")
    expect(result).toBe("")
  })

  it("应该转义正则特殊字符 - 美元符号", () => {
    const result = highlightText("价格: $100 (折扣)", "$100")
    expect(result).toBe('价格: <mark class="search-highlight">$100</mark> (折扣)')
  })

  it("应该转义正则特殊字符 - 括号", () => {
    const result = highlightText("函数名: test()", "test()")
    expect(result).toBe('函数名: <mark class="search-highlight">test()</mark>')
  })

  it("应该转义正则特殊字符 - 点号", () => {
    const result = highlightText("文件路径: test.js", "test.js")
    expect(result).toBe('文件路径: <mark class="search-highlight">test.js</mark>')
  })

  it("应该转义正则特殊字符 - 星号", () => {
    const result = highlightText("通配符: *.txt", "*.txt")
    expect(result).toBe('通配符: <mark class="search-highlight">*.txt</mark>')
  })

  it("应该转义正则特殊字符 - 反斜杠", () => {
    const result = highlightText("文件路径: C:\\Users\\test", "C:\\Users")
    expect(result).toContain('<mark class="search-highlight">')
    expect(result).toContain("C:\\Users")
  })

  it("应该转义正则特殊字符 - 方括号", () => {
    const result = highlightText("数组: [1, 2, 3]", "[1, 2, 3]")
    expect(result).toBe('数组: <mark class="search-highlight">[1, 2, 3]</mark>')
  })

  it("应该处理特殊中文字符", () => {
    const result = highlightText("包含中文的文本", "中文")
    expect(result).toBe('包含<mark class="search-highlight">中文</mark>的文本')
  })

  it("应该处理包含空格的关键词", () => {
    const result = highlightText("这是一个测试 文本", "测试 文")
    expect(result).toBe('这是一个<mark class="search-highlight">测试 文</mark>本')
  })

  it("应该处理长关键词", () => {
    const longKeyword = "这是一个非常长的关键词用于测试"
    const text = `文本包含：${longKeyword}，以及其他内容`
    const result = highlightText(text, longKeyword)
    expect(result).toContain('<mark class="search-highlight">')
  })

  it("应该保持原文本不变当没有匹配", () => {
    const result = highlightText("这是测试文本", "xyz")
    expect(result).toBe("这是测试文本")
  })

  it("应该处理只有空格的关键词", () => {
    const result = highlightText("测试文本", "   ")
    expect(result).toBe("测试文本")
  })
})

describe("containsKeyword", () => {
  it("应该返回true当文本包含关键词", () => {
    expect(containsKeyword("地震灾害", "地震")).toBe(true)
  })

  it("应该返回false当文本不包含关键词", () => {
    expect(containsKeyword("洪水灾害", "地震")).toBe(false)
  })

  it("应该不区分大小写", () => {
    expect(containsKeyword("Earthquake", "earthquake")).toBe(true)
  })

  it("应该处理空关键词", () => {
    expect(containsKeyword("测试文本", "")).toBe(false)
  })

  it("应该处理null关键词", () => {
    expect(containsKeyword("测试文本", null)).toBe(false)
  })

  it("应该处理undefined关键词", () => {
    expect(containsKeyword("测试文本", undefined)).toBe(false)
  })

  it("应该处理空文本", () => {
    expect(containsKeyword("", "关键词")).toBe(false)
  })

  it("应该处理特殊字符", () => {
    expect(containsKeyword("价格: $100", "$100")).toBe(true)
  })
})
