import { describe, expect, it, vi } from "vitest"
import {
  buildThematicArchiveMetadata,
  buildThematicCreateJobParams,
  buildThematicExportFilename,
  downloadThematicArtifact,
  pickThematicExportArtifact,
  resolveThematicServiceDescription,
  resolveThematicServiceName
} from "./thematic-export"

describe("thematic-export", () => {
  it("prefers artifact matching the selected output format", () => {
    const picked = pickThematicExportArtifact([
      { artifactId: "a1", name: "report.pdf", type: "report", url: "/report.pdf", mime: "application/pdf" } as any,
      { artifactId: "a2", name: "render.png", type: "thumbnail", url: "/render.png", mime: "image/png" } as any,
      { artifactId: "a3", name: "render.jpg", type: "export", url: "/render.jpg", mime: "image/jpeg" } as any
    ], "pdf")

    expect(picked?.artifactId).toBe("a1")
  })

  it("falls back to export typed artifact when format-specific match is absent", () => {
    const picked = pickThematicExportArtifact([
      { artifactId: "a1", name: "preview.webp", type: "thumbnail", url: "/preview.webp", mime: "image/webp" } as any,
      { artifactId: "a2", name: "export.bin", type: "export", url: "/export.bin", mime: "application/octet-stream" } as any
    ], "png")

    expect(picked?.artifactId).toBe("a2")
  })

  it("builds filename from template and job id", () => {
    expect(buildThematicExportFilename({
      templateId: "damage-map",
      jobId: "job_1",
      outputFormat: "png"
    } as any, {
      name: "output.png"
    } as any)).toBe("damage-map-job_1.png")
  })

  it("builds create-job params with quality preset and publish flags", () => {
    expect(buildThematicCreateJobParams({
      templateId: "tpl_1",
      datasetId: "ds_1",
      outputFormat: "pdf",
      qualityPreset: "print",
      publishType: "wms",
      parameters: {
        includeTitle: false,
        title: "示例"
      },
      shouldPublish: false
    })).toEqual({
      templateId: "tpl_1",
      datasetId: "ds_1",
      outputFormat: "pdf",
      parameters: {
        includeTitle: false,
        title: "示例",
        qualityPreset: "print"
      },
      publish: undefined
    })
  })

  it("publishes the selected service type when enabled", () => {
    expect(buildThematicCreateJobParams({
      templateId: "tpl_2",
      datasetId: "ds_2",
      outputFormat: "png",
      qualityPreset: "standard",
      publishType: "wmts",
      shouldPublish: true
    })).toMatchObject({
      publish: {
        type: "wmts"
      },
      parameters: {
        prefer2D: true
      }
    })
  })

  it("maps publish name and description from job parameters", () => {
    expect(buildThematicCreateJobParams({
      templateId: "tpl_3",
      parameters: {
        publishName: "专题服务",
        publishDesc: "服务简介",
        notes: "专题备注"
      },
      shouldPublish: true,
      publishType: "xyz"
    })).toMatchObject({
      publish: {
        type: "xyz",
        name: "专题服务",
        description: "服务简介"
      }
    })
  })

  it("builds archive metadata and resolves service display text with fallbacks", () => {
    const job: any = {
      templateId: "tpl_archive",
      templateVersion: "2.0",
      outputFormat: "pdf",
      publishParams: {
        type: "wmts",
        name: "服务标题",
        description: "发布说明"
      },
      parameters: {
        qualityPreset: "print",
        includeTitle: true,
        includeLegend: true,
        includeText: true,
        title: "专题主标题",
        subtitle: "专题副标题",
        legendTitle: "图例标题",
        palette: "blue-red",
        prefer2D: true,
        publishDesc: "参数说明",
        notes: "备注"
      }
    }
    const result: any = {
      artifacts: [
        { artifactId: "art_1", name: "report.pdf", type: "report", mime: "application/pdf" },
        { artifactId: "art_2", name: "preview.png", type: "thumbnail", mime: "image/png" }
      ],
      serviceRef: {
        type: "3dtiles",
        serviceId: "svc_1",
        urlTemplate: "https://example.com/3d/tileset.json",
        metadata: {
          url2d: "https://example.com/2d/{z}/{x}/{y}.png"
        }
      }
    }

    expect(buildThematicArchiveMetadata(job, result)).toMatchObject({
      templateId: "tpl_archive",
      templateVersion: "2.0",
      outputFormat: "pdf",
      qualityPreset: "print",
      publishName: "服务标题",
      publishDesc: "发布说明",
      serviceDescription: "发布说明",
      description: "发布说明",
      thematicTemplate: {
        templateId: "tpl_archive",
        templateVersion: "2.0"
      },
      exportConfig: {
        outputFormat: "pdf",
        qualityPreset: "print"
      },
      publishConfig: {
        type: "wmts",
        name: "服务标题",
        description: "发布说明"
      },
      serviceRefSnapshot: {
        type: "3dtiles",
        serviceId: "svc_1",
        is3D: true,
        prefer2D: true
      },
      decorationConfig: {
        includeTitle: true,
        includeLegend: true,
        includeText: true,
        title: "专题主标题",
        subtitle: "专题副标题",
        legendTitle: "图例标题",
        palette: "blue-red"
      },
      annotationConfig: {
        text: "备注",
        title: "专题主标题",
        subtitle: "专题副标题",
        legendTitle: "图例标题"
      },
      artifactRefs: [
        { artifactId: "art_1", name: "report.pdf", type: "report", mime: "application/pdf" },
        { artifactId: "art_2", name: "preview.png", type: "thumbnail", mime: "image/png" }
      ]
    })
    expect(resolveThematicServiceName(job, { serviceId: "svc_1" } as any)).toBe("服务标题")
    expect(resolveThematicServiceDescription(job, { serviceId: "svc_1" } as any)).toBe("发布说明")
  })

  it("downloads thematic artifact with filename via anchor element", () => {
    const anchor = document.createElement("a")
    const click = vi.spyOn(anchor, "click").mockImplementation(() => {})
    const appendChild = vi.spyOn(document.body, "appendChild")
    const removeChild = vi.spyOn(document.body, "removeChild")
    const createElement = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        return anchor
      }
      return document.createElement(tagName)
    }) as any)

    const ok = downloadThematicArtifact({
      artifactId: "a1",
      name: "导出图.png",
      url: "https://example.com/export.png"
    } as any, "专题图.png")

    expect(ok).toBe(true)
    expect(click).toHaveBeenCalledTimes(1)
    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledTimes(1)

    click.mockRestore()
    createElement.mockRestore()
    appendChild.mockRestore()
    removeChild.mockRestore()
  })
})
