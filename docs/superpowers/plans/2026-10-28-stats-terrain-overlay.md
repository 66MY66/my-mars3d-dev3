# 综合统计地形分析膜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为综合统计上图增加连续贴地分析区域、稳定的有效网格柱体布局和近景柱体 LOD，同时保持导入图层独立。

**Architecture:** 将纯空间算法拆入无副作用工具模块并通过 Vitest 固定行为；`mars-map.vue` 仅负责把合并轮廓渲染为独立 GraphicLayer、管理地形高度和相机 LOD。第一阶段以单一合并轮廓和少量图形控制 GPU 开销，模拟卡片数据使用明确的汇总/估算降级，不继续使用包围盒随机点。

**Tech Stack:** Vue 3、TypeScript、Mars3D/Cesium、Vitest

**Spec:** `docs/superpowers/specs/2026-10-28-stats-terrain-overlay-design.md`

## Global Constraints

- 默认不渲染内部网格线，不为每个网格创建独立可视 Entity。
- 不修改全局底图、地形或数据集仓库导入图层样式。
- 柱体完整底面必须留在最终分析区域内；失败时不得回退到随机点。
- 远距离不显示柱体、替代点和标签，近距离才显示。
- 当前柱体颜色和磨砂立体造型保持不变。
- 所有空间算法必须是确定性的，可在无地图环境的单元测试中验证。

## Review Focus

- 凹多边形的顶点平均值可能落在面外：锚点必须仍位于有效区域。
- 狭长或极小范围无法容纳默认柱脚：应缩小或不返回锚点。
- 绘制环顺逆时针及闭合点重复：生成结果应一致。
- 地形关闭或采样失败：覆盖面和边界应回退到贴地模式且不阻塞上图。
- 导入图层位于统计层下方：分析面不得抢占底层对象拾取或改变其 show/opacity。

---

### Task 1: 无副作用网格与边界模型

**Files:**
- Create: `src/utils/stats-terrain-overlay.ts`
- Create: `src/utils/stats-terrain-overlay.test.ts`

**Interfaces:**
- Produces: `buildStatsAnalysisRegion(ring, options): StatsAnalysisRegion | null`
- Produces: `buildStatsColumnAnchors(region, count, footprintMeters): StatsColumnAnchor[]`
- Produces: `isFootprintInsideRegion(anchor, sideMeters, outline): boolean`

- [ ] **Step 1: Write failing tests for rectangle, concave polygon, reversed/closed rings and tiny ranges**

Assertions: valid cells exist; merged outline has at least three points; all returned anchors and four footprint corners are inside; repeated calls are identical; a range too small for the minimum footprint returns fewer/no anchors instead of outside points.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the spatial model**

Use a bounded quadtree-like edge subdivision over the ring bbox. Keep interior cells coarse, recursively split boundary cells, derive a deterministic set of safe cell centers, and build a dissolved exterior outline from boundary edges. Normalize duplicated closing points and winding direction.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts`
Expected: PASS.

### Task 2: 分析面材质和地形边界图层

**Files:**
- Modify: `src/components/mars-work/mars-map.vue:1365-1460`
- Modify: `src/components/mars-work/mars-map.vue:2210-2430`
- Test: `src/utils/stats-terrain-overlay.test.ts`

**Interfaces:**
- Consumes: `StatsAnalysisRegion` from Task 1.
- Produces: `ensureStatsAnalysisRegionLayer()`, `renderStatsAnalysisRegion()`, `clearStatsAnalysisRegion()`.

- [ ] **Step 1: Add tests for stable simplified outlines and bounded vertex counts**

Assertions: ordinary shapes stay below the configured 1000-cell cap and the outline contains no internal grid edges.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts`

- [ ] **Step 3: Add one independent analysis-region layer**

Render one semi-transparent terrain-clamped polygon using `#315F68`, plus light `#B7E1D9` and dark `#17343A` terrain-following outlines. Mark region graphics non-interactive where supported; do not change existing imported layers.

- [ ] **Step 4: Add terrain sampling with safe fallback**

Sample densified outline heights only when the terrain provider supports it; cache by region hash and terrain identity. On rejection or unavailable terrain, retain clamp-to-ground rendering.

- [ ] **Step 5: Verify focused tests**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts src/utils/region-hit.test.ts`
Expected: PASS.

### Task 3: 柱体安全布局与数据降级

**Files:**
- Modify: `src/components/mars-work/mars-map.vue:1723-1858`
- Modify: `src/components/mars-work/mars-map.vue:2226-2425`
- Modify: `src/utils/stats-terrain-overlay.ts`
- Test: `src/utils/stats-terrain-overlay.test.ts`

**Interfaces:**
- Consumes: `buildStatsColumnAnchors` and `StatsAnalysisRegion`.
- Produces: deterministic `row -> anchor` mapping with `estimated`/`summary` metadata.

- [ ] **Step 1: Add failing tests for stable row-to-anchor assignment, collision spacing and footprint containment**

Assertions: same row keys keep anchors across refresh; anchors do not overlap at the configured footprint; no anchor is produced outside the safe region.

- [ ] **Step 2: Run focused test and verify failure**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts`

- [ ] **Step 3: Replace bbox random sampling in `renderOverlayForCard`**

Use safe anchors from the analysis region. Population/economy may use multiple estimated spatial cells with explicit tooltip provenance; housing/radiation/vegetation use a single stable summary anchor until real spatial rows exist. Remove the west/south random fallback.

- [ ] **Step 4: Preserve current prism material while enforcing safe footprint size**

Calculate the requested footprint first, shrink to the safe cell allowance, and skip a column when no valid complete footprint exists.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts src/utils/stats-overlay-metrics.test.ts`
Expected: PASS.

### Task 4: 相机 LOD 与生命周期

**Files:**
- Modify: `src/utils/stats-overlay-metrics.ts`
- Modify: `src/utils/stats-overlay-metrics.test.ts`
- Modify: `src/components/mars-work/mars-map.vue:2429-2460`
- Modify: `src/components/mars-work/mars-map.vue:2608-2668`
- Modify: `src/components/mars-work/mars-map.vue:4200-4240`

**Interfaces:**
- Produces: `getStatsOverlayLod(cameraHeight): "hidden" | "region" | "columns" | "labels"`.

- [ ] **Step 1: Replace the current two-state LOD tests with four-state expectations**

Pin initial thresholds as centralized constants: far=`hidden`, 10–20 km style overview=`region`, medium=`columns`, near=`labels`; thresholds remain calibratable after browser review.

- [ ] **Step 2: Run test and verify failure**

Run: `pnpm vitest run src/utils/stats-overlay-metrics.test.ts`

- [ ] **Step 3: Implement four-state LOD and visibility switching**

Camera changes toggle existing region/column/label graphics rather than rebuilding the grid or resampling terrain. Remove the current far-distance dot representation.

- [ ] **Step 4: Complete cleanup paths**

Close, range change and component unmount must remove region graphics, column graphics, labels, camera listeners and obsolete cache entries owned by the overlay.

- [ ] **Step 5: Run LOD and overlay tests**

Run: `pnpm vitest run src/utils/stats-overlay-metrics.test.ts src/utils/stats-terrain-overlay.test.ts`
Expected: PASS.

### Task 5: 图层兼容与最终验证

**Files:**
- Modify: `src/components/mars-work/mars-map.vue`
- Test: existing targeted tests

**Interfaces:**
- Consumes all earlier tasks.
- Produces the complete statistics overlay behavior.

- [ ] **Step 1: Verify the overlay never mutates imported layer properties**

Read-only integration inspection must confirm no writes to unrelated layer `show`, `opacity`, `zIndex` or material values; analysis graphics use their own layer and non-blocking picking configuration.

- [ ] **Step 2: Run targeted unit regression**

Run: `pnpm vitest run src/utils/stats-terrain-overlay.test.ts src/utils/stats-overlay-metrics.test.ts src/utils/region-hit.test.ts src/widgets/basic/dataset-repository/map.test.ts`
Expected: PASS.

- [ ] **Step 3: Run type/build validation**

Run the repository's available typecheck/build command from `package.json`; no new errors attributable to the overlay are allowed.

- [ ] **Step 4: Browser acceptance pass**

Verify rectangle, convex and concave drawings; terrain on/off; overview/near LOD; all five cards; imported raster, GeoJSON and 3D Tiles; close/reopen and repeated refresh. Capture any threshold-only tuning separately from correctness defects.

- [ ] **Step 5: Record final changed files, test evidence and remaining data limitations**

Explicitly state that real multi-column spatial truth still depends on real population/economy/building/radiation/vegetation geometries.
