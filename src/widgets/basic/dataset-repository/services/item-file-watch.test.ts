import { describe, expect, it, vi } from "vitest"

const resolveEoapiHref = vi.fn((href: string) => `https://example.test${href.startsWith("/") ? href : `/${href}`}`)

vi.mock("./eoapi-client", () => ({
  resolveEoapiHref
}))

const { collectWatchableItemFiles } = await import("./item-file-watch")

describe("item-file-watch", () => {
  it("prioritizes selected item assets and limits watch list", () => {
    const items: any[] = [
      {
        id: "item-1",
        properties: { title: "第一景" },
        assets: {
          visual: { href: "/assets/visual-1.tif", title: "真彩色" },
          metadata: { href: "/assets/meta-1.json" }
        }
      },
      {
        id: "item-2",
        properties: { title: "第二景" },
        assets: {
          visual: { href: "/assets/visual-2.tif", title: "热异常" }
        }
      }
    ]

    const result = collectWatchableItemFiles(items as any, {
      selectedItemId: "item-2",
      limit: 2
    })

    expect(result).toEqual([
      {
        id: "item:item-2:visual",
        name: "第二景 / 热异常",
        url: "https://example.test/assets/visual-2.tif"
      },
      {
        id: "item:item-1:visual",
        name: "第一景 / 真彩色",
        url: "https://example.test/assets/visual-1.tif"
      }
    ])
  })

  it("uses alternate public href when available and skips empty assets", () => {
    const result = collectWatchableItemFiles([
      {
        id: "item-3",
        properties: {},
        assets: {
          visual: {
            href: "/private/visual-3.tif",
            alternate: {
              public: {
                href: "public/visual-3.tif"
              }
            }
          },
          empty: {}
        }
      } as any
    ], { limit: 5 })

    expect(result).toEqual([
      {
        id: "item:item-3:visual",
        name: "item-3 / visual",
        url: "https://example.test/public/visual-3.tif"
      }
    ])
  })
})
