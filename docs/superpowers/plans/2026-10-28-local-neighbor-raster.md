# Local Neighborhood Raster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地 API 模式自动注册“本地合成风险指数”，并以同一二维数值数组完成地图渲染、区域统计和焦点统计预览。

**Architecture:** 新建纯 TypeScript 栅格模型，固定生成 512×512、EPSG:4326 的确定性数据，并提供区域裁剪、摘要统计、焦点窗口和颜色渲染函数。分析工具地图模块负责将模型注册为可分析数据源，并用 RectangleEntity 显示原始/焦点栅格；真实后端模式保持原调用链不变。

**Tech Stack:** Vue 3、TypeScript、Mars3D/Cesium、Vitest、Canvas API。

**Spec:** 本任务对话中用户确认的“本地合成栅格数据集”方案。

## Global Constraints

- 仅在 `VITE_LOCAL_API=1` 时自动注册本地栅格。
- 地图画面、区域摘要和焦点结果必须共享同一个 `Float32Array`。
- 使用固定生成规则，刷新后结果可重复。
- 不改变邻域分析弹窗整体 UI。
- 真实后端的 GeoTIFF/COG 分析与导出接口保持不变。

## Review Focus

- 绘制范围完全超出栅格时返回零有效像元，而不是无效数值。
- NoData 在“忽略”和“计入”两种模式下行为明确。
- 圆形与方形窗口、不同奇数窗口大小产生不同焦点结果。
- 焦点统计仅渲染绘制范围，并保留原始地理定位。
- 弹窗销毁后清理本地栅格图形，避免重复叠加。

---

### Task 1: Deterministic raster model and statistics

**Files:**
- Create: `src/widgets/basic/analysis-tool/local-neighbor-raster.ts`
- Test: `src/widgets/basic/analysis-tool/local-neighbor-raster.test.ts`

**Interfaces:**
- Produces: `createLocalRiskRaster()`, `summarizeRasterInPolygon()`, `computeFocalRaster()`, `renderRasterToCanvas()`。

- [ ] Write tests for deterministic generation, polygon statistics, NoData, and focal windows.
- [ ] Run tests and confirm they fail because the module is missing.
- [ ] Implement the smallest pure raster model that passes.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Local map registration and shared rendering

**Files:**
- Modify: `src/widgets/basic/analysis-tool/map.ts`
- Modify: `src/widgets/basic/analysis-tool/neighbor-analysis.ts`
- Test: `src/widgets/basic/analysis-tool/neighbor-analysis.test.ts`

**Interfaces:**
- Consumes: Task 1 raster model and rendering functions.
- Produces: local source entry `local-synthetic-risk`, original raster display, focal preview display.

- [ ] Add a failing source-discovery test for an in-memory analyzable raster.
- [ ] Register the local source only in local API mode and render it on map mount.
- [ ] Route local area/focal analysis through the shared array; keep real API routes unchanged.
- [ ] Clear preview graphics without removing the registered source graphic.

### Task 3: Verification

**Files:** No new production files.

- [ ] Run focused Vitest files.
- [ ] Run the complete project unit suite and report unrelated failures if any.
- [ ] Run Vue TypeScript and targeted ESLint checks.
- [ ] Build production assets and inspect the local page console.
