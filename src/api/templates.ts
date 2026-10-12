export type TemplateMeta = {
  id: string
  name: string
  type: string
}

export async function getTemplates(): Promise<TemplateMeta[]> {
  return []
}

export async function saveTemplate(t: TemplateMeta): Promise<void> {
  
}
