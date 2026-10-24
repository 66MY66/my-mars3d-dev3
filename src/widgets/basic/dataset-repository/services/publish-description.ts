export const MIN_PUBLISH_DESCRIPTION_LENGTH = 5
export const PUBLISH_DESCRIPTION_ERROR = "发布描述至少需要 5 个有效字符，空白不计入字数"

export function publishDescriptionLength(value: string): number {
  return Array.from(value.replace(/[\s\u200b-\u200d\ufeff]/gu, "")).length
}

export function isPublishDescriptionValid(value: string): boolean {
  return publishDescriptionLength(value) >= MIN_PUBLISH_DESCRIPTION_LENGTH
}
