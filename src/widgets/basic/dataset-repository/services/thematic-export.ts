import type { Artifact, ServiceRef, ThematicJob, ThematicJobResult, CreateJobParams } from "../types/eoapi-types"
import { isLikely3DServiceRef } from "./service-ref"

type ThematicServiceRef = Partial<ServiceRef> & {
  name?: unknown
  description?: unknown
  metadata?: {
    name?: unknown
    description?: unknown
  } | Record<string, unknown>
}

export type QualityPreset = "standard" | "high" | "print"

export type ThematicCreateForm = {
  templateId: string
  datasetId?: string
  outputFormat?: string
  qualityPreset?: QualityPreset
  parameters?: Record<string, any>
  publishType?: "none" | "xyz" | "mvt" | "wms" | "wmts"
  shouldPublish?: boolean
}

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase()
}

function normalizeRichText(value: unknown): string {
  return String(value || "").trim()
}

function getParameterText(parameters: Record<string, any> | undefined, key: string): string {
  return normalizeRichText(parameters?.[key])
}

function getArtifactExtension(artifact: Artifact | null | undefined): string {
  const name = String(artifact?.name || "")
  const matched = name.match(/\.([a-z0-9]+)(?:\?.*)?$/i)
  return normalizeText(matched?.[1] || "")
}

function mimeMatchesFormat(mime: string, format: string): boolean {
  if (!mime || !format) {
    return false
  }
  if (format === "jpg") {
    return mime.includes("jpeg") || mime.includes("jpg")
  }
  if (format === "pdf") {
    return mime.includes("pdf")
  }
  return mime.includes(format)
}

function extensionMatchesFormat(ext: string, format: string): boolean {
  if (!ext || !format) {
    return false
  }
  if (format === "jpg") {
    return ext === "jpg" || ext === "jpeg"
  }
  return ext === format
}

export function pickThematicExportArtifact(
  artifacts: Artifact[] = [],
  outputFormat?: string
): Artifact | null {
  const list = Array.isArray(artifacts) ? artifacts : []
  const expectedFormat = normalizeText(outputFormat)

  const exactFormatMatch = expectedFormat
    ? list.find((artifact) => {
      const mime = normalizeText((artifact as any)?.mime)
      const ext = getArtifactExtension(artifact)
      return mimeMatchesFormat(mime, expectedFormat) || extensionMatchesFormat(ext, expectedFormat)
    })
    : null
  if (exactFormatMatch) {
    return exactFormatMatch
  }

  const typedExport = list.find((artifact: any) => artifact?.type === "export")
  if (typedExport) {
    return typedExport
  }

  const report = list.find((artifact: any) => artifact?.type === "report")
  if (report) {
    return report
  }

  return list[0] || null
}

export function buildThematicExportFilename(job: Partial<ThematicJob> | null | undefined, artifact: Artifact | null | undefined): string {
  const ext = getArtifactExtension(artifact) || normalizeText(job?.outputFormat) || "dat"
  const templateId = String(job?.templateId || "thematic").trim() || "thematic"
  const jobId = String(job?.jobId || "").trim()
  const suffix = jobId ? `-${jobId}` : ""
  return `${templateId}${suffix}.${ext}`
}

export function buildThematicCreateJobParams(form: ThematicCreateForm): CreateJobParams {
  const publishName = getParameterText(form.parameters, "publishName")
  const publishDesc = getParameterText(form.parameters, "publishDesc")
  const notes = getParameterText(form.parameters, "notes")
  const publishType = normalizeText(form.publishType) as any
  const shouldPublish = form.shouldPublish !== false && publishType !== "none"
  const effectivePublishType = publishType && publishType !== "none" ? publishType : "xyz"
  const mergedParameters = {
    ...(form.parameters && typeof form.parameters === "object" ? form.parameters : {})
  } as Record<string, any>
  if (shouldPublish && mergedParameters.prefer2D === undefined) {
    mergedParameters.prefer2D = true
  }
  return {
    templateId: String(form.templateId || "").trim(),
    datasetId: String(form.datasetId || "").trim() || undefined,
    outputFormat: normalizeText(form.outputFormat) || "png",
    parameters: {
      ...mergedParameters,
      qualityPreset: normalizeText(form.qualityPreset) || "standard"
    },
    publish: shouldPublish
? {
      type: effectivePublishType,
      name: publishName || undefined,
      description: publishDesc || notes || undefined
    }
: undefined
  }
}

export function buildThematicArchiveMetadata(
  job: Partial<ThematicJob> | null | undefined,
  result?: Partial<ThematicJobResult> | null
): Record<string, any> {
  const parameters = (job?.parameters && typeof job.parameters === "object") ? job.parameters as Record<string, any> : {}
  const publishName = normalizeRichText(job?.publishParams?.name) || getParameterText(parameters, "publishName")
  const publishDesc = normalizeRichText(job?.publishParams?.description) || getParameterText(parameters, "publishDesc")
  const notes = getParameterText(parameters, "notes")
  const serviceRef = result?.serviceRef
  const artifacts = Array.isArray(result?.artifacts) ? result?.artifacts : []
  const artifactRefs = artifacts
    .map((artifact) => ({
      artifactId: String((artifact as any)?.artifactId || "").trim(),
      name: String((artifact as any)?.name || "").trim() || undefined,
      type: String((artifact as any)?.type || "").trim() || undefined,
      mime: String((artifact as any)?.mime || "").trim() || undefined
    }))
    .filter((artifact) => artifact.artifactId)

  return {
    ...(parameters || {}),
    templateId: String(job?.templateId || "").trim() || undefined,
    templateVersion: String(job?.templateVersion || "").trim() || undefined,
    outputFormat: normalizeText(job?.outputFormat) || undefined,
    qualityPreset: getParameterText(parameters, "qualityPreset") || undefined,
    publishName: publishName || undefined,
    publishDesc: publishDesc || undefined,
    notes: notes || undefined,
    serviceName: publishName || undefined,
    serviceDescription: publishDesc || notes || undefined,
    description: publishDesc || notes || undefined,
    thematicTemplate: {
      templateId: String(job?.templateId || "").trim() || undefined,
      templateVersion: String(job?.templateVersion || "").trim() || undefined
    },
    exportConfig: {
      outputFormat: normalizeText(job?.outputFormat) || undefined,
      qualityPreset: getParameterText(parameters, "qualityPreset") || undefined
    },
    publishConfig: job?.publishParams
? {
      type: String(job?.publishParams?.type || "").trim() || undefined,
      name: publishName || undefined,
      description: publishDesc || notes || undefined
    }
: undefined,
    serviceRefSnapshot: serviceRef
? {
      type: String(serviceRef.type || "").trim() || undefined,
      serviceId: String((serviceRef as any)?.serviceId || "").trim() || undefined,
      urlTemplate: String((serviceRef as any)?.urlTemplate || "").trim() || undefined,
      url: String((serviceRef as any)?.url || "").trim() || undefined,
      format: String((serviceRef as any)?.format || "").trim() || undefined,
      is3D: isLikely3DServiceRef(serviceRef),
      prefer2D: parameters.prefer2D === true
    }
: undefined,
    decorationConfig: {
      includeTitle: parameters.includeTitle === true,
      includeLegend: parameters.includeLegend === true,
      includeScale: parameters.includeScale === true,
      includeNorth: parameters.includeNorth === true,
      includeText: parameters.includeText === true,
      includeIcon: parameters.includeIcon === true,
      title: getParameterText(parameters, "title") || undefined,
      subtitle: getParameterText(parameters, "subtitle") || undefined,
      legendTitle: getParameterText(parameters, "legendTitle") || undefined,
      palette: getParameterText(parameters, "palette") || undefined
    },
    annotationConfig: {
      text: getParameterText(parameters, "notes") || undefined,
      title: getParameterText(parameters, "title") || undefined,
      subtitle: getParameterText(parameters, "subtitle") || undefined,
      legendTitle: getParameterText(parameters, "legendTitle") || undefined
    },
    artifactRefs: artifactRefs.length ? artifactRefs : undefined
  }
}

export function resolveThematicServiceName(
  job: Partial<ThematicJob> | null | undefined,
  serviceRef?: ThematicServiceRef | null
): string {
  const parameters = (job?.parameters && typeof job.parameters === "object") ? job.parameters as Record<string, any> : {}
  return normalizeRichText(serviceRef?.name) ||
    normalizeRichText(serviceRef?.metadata?.name) ||
    normalizeRichText(job?.publishParams?.name) ||
    getParameterText(parameters, "publishName")
}

export function resolveThematicServiceDescription(
  job: Partial<ThematicJob> | null | undefined,
  serviceRef?: ThematicServiceRef | null
): string {
  const parameters = (job?.parameters && typeof job.parameters === "object") ? job.parameters as Record<string, any> : {}
  return normalizeRichText(serviceRef?.description) ||
    normalizeRichText(serviceRef?.metadata?.description) ||
    normalizeRichText(job?.publishParams?.description) ||
    getParameterText(parameters, "publishDesc") ||
    getParameterText(parameters, "notes")
}

export function downloadThematicArtifact(
  artifact: Artifact,
  filename?: string
): boolean {
  const url = String(artifact?.url || "").trim()
  if (!url) {
    return false
  }
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.target = "_blank"
  anchor.rel = "noopener noreferrer"
  anchor.download = filename || String(artifact?.name || "").trim() || "thematic-export"
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  return true
}
