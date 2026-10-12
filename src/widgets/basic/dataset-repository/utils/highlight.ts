/**
 * 文本高亮工具函数
 * @description 用于搜索结果中高亮显示关键词
 */

/**
 * 转义正则表达式特殊字符
 * @param str 原始字符串
 * @returns 转义后的字符串
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 高亮文本中的关键词
 * @param text 原始文本
 * @param keyword 关键词
 * @returns HTML字符串，关键词用<mark>标签包裹
 * @example
 * highlightText('地震灾害损失评估', '地震')
 * // 返回: '<mark class="search-highlight">地震</mark>灾害损失评估'
 */
export function highlightText(text: string, keyword: string | undefined | null): string {
  // 空关键词或空文本，直接返回原文本
  if (!keyword || !keyword.trim() || !text) {
    return text
  }

  // 转义特殊字符，避免正则错误
  const escapedKeyword = escapeRegExp(keyword.trim())

  // 创建全局不区分大小写的正则表达式
  const regex = new RegExp(`(${escapedKeyword})`, "gi")

  // 替换关键词为高亮标签
  return text.replace(regex, '<mark class="search-highlight">$1</mark>')
}

/**
 * 检查文本是否包含关键词（用于性能优化）
 * @param text 原始文本
 * @param keyword 关键词
 * @returns 是否包含关键词
 */
export function containsKeyword(text: string, keyword: string | undefined | null): boolean {
  if (!keyword || !keyword.trim() || !text) {
    return false
  }

  const escapedKeyword = escapeRegExp(keyword.trim())
  const regex = new RegExp(escapedKeyword, "gi")
  return regex.test(text)
}

/**
 * 高亮多个字段（用于性能优化，避免多次创建正则）
 * @param fields 字段数组 { text, keyword }
 * @returns 高亮后的文本数组
 */
export function highlightMultipleFields(
  fields: Array<{ text: string; keyword: string | undefined | null }>
): string[] {
  return fields.map(({ text, keyword }) => highlightText(text, keyword))
}
