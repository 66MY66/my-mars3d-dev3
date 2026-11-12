import { describe, expect, it } from "vitest"
import { flowOutcome } from "./flow-outcome"
describe("flow execution versus business outcome", () => {
  it("never calls a pending catalog change published", () => {
    expect(flowOutcome("stac_flow", { status: "pending_review", approved: false, published: false })).toMatchObject({ state: "pending-review", refresh: false })
    expect(flowOutcome("stac_flow", { published: true, item_url: "http://backend/item" })).toMatchObject({ state: "published", refresh: true })
    expect(flowOutcome("stac_flow", { published: true })).toMatchObject({ state: "unverified", refresh: false })
    expect(flowOutcome("stac_flow", { action: "query" })).toMatchObject({ state: "queried", refresh: false })
    expect(flowOutcome("stac_flow", { errors: ["invalid"], approved: false, published: false })).toMatchObject({ state: "rejected", refresh: false })
  })
  it("requires nonempty successful business counts before calling an archive successful", () => {
    expect(flowOutcome("result_flow", { received: 1, published: 1, failed: 0 })).toMatchObject({ state: "published", refresh: true })
    expect(flowOutcome("result_flow", { received: 0, published: 0, failed: 0 }).state).toBe("unverified")
    expect(flowOutcome("result_flow", { received: 2, published: 1, failed: 1 }).state).toBe("partial")
    expect(flowOutcome("result_flow", null).state).toBe("unverified")
  })
})
