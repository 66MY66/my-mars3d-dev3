import { describe, expect, it } from "vitest"
import { mount } from "@vue/test-utils"
import { additionalProducts, productDefinitions, productDefinition } from "./product-definitions"
import { workflowRequirements } from "./cartography-workflow"
import { mergeWorkbenchTemplateCatalog, groupTemplateCatalog, productCatalog } from "./workbench-template-catalog"
import ProductRequirements from "./ProductRequirements.vue"

describe("scoped product system", () => {
  it("has nineteen distinct business products in five stable groups independent of backend supply", () => {
    expect(productDefinitions).toHaveLength(19)
    expect(new Set(productDefinitions.map(product => product.templateId)).size).toBe(19)
    expect(additionalProducts).toHaveLength(7)
    const catalog = mergeWorkbenchTemplateCatalog(productDefinitions.filter(product => product.group !== "emergency").map(product => ({ templateId: product.templateId, name: product.name, templateVersion: "1.0", parameters: [], createdAt: 0 })))
    expect(productCatalog(catalog)).toHaveLength(19)
    expect(groupTemplateCatalog(productCatalog(catalog)).map(group => [group.id, group.items.length])).toEqual([["emergency", 6], ["remote", 3], ["damage", 6], ["assessment", 3], ["business", 1]])
    for (const product of productDefinitions) {
      expect(productDefinition(product.templateId)).toBe(product)
      expect(workflowRequirements(product.kind).length).toBeGreaterThan(0)
      expect(product.inputs.length).toBeGreaterThan(1)
      expect(product.statistics).toBeTruthy(); expect(product.expression).toBeTruthy(); expect(product.boundary).toBeTruthy()
    }
  })
  it("does not claim reference layers satisfy the assessment or hide a missing product", async () => {
    const wrapper = mount(ProductRequirements, { props: { topic: "building-damage", layers: [{ id: "online:boundary", enabled: true } as any], states: { assessment: "empty" }, busy: false } })
    expect(wrapper.text()).toContain("专题资料待补齐")
    expect(wrapper.text()).toContain("建筑物破坏评估专题图")
    const buttons = wrapper.findAll("button")
    await buttons[0].trigger("click")
    expect(wrapper.emitted("locate")?.[0]).toEqual([["assessment"]])
    await wrapper.setProps({ layers: [{ id: "online:assessment", enabled: true } as any] })
    expect(wrapper.text()).toContain("所需图层已显示")
    expect(wrapper.text()).not.toContain("审核通过")
    await wrapper.setProps({ layers: [{ id: "online:assessment", enabled: false } as any] })
    expect(wrapper.text()).toContain("专题资料待补齐")
  })
})
